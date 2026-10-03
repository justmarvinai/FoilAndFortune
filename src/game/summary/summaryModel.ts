import { defaultBalance } from '@/content/balance';
import type { ContentRegistry } from '@/content/registry';
import type { Finish, Rarity } from '@/content/schema/common';
import { dayToDate, type GameDate, type Weekday, weekdayIndex, weekdayOf } from '@/core/calendar';
import type { Cents } from '@/core/money';
import { reputationScore, reputationStars, weeklyRentDue, xpProgress } from '@/sim/selectors';
import type { GameState } from '@/sim/state/types';

/**
 * Everything the Day Summary receipt prints (docs/05 §5.17), derived from the closed day. Pure,
 * so the numbers are unit-tested apart from the print animation.
 */

export type TomorrowItem =
  /** Supplier orders due at dawn (`suppliers.orders`, pending, `etaDay = day + 1`). */
  | { kind: 'delivery'; orders: number; units: number }
  /** Weekday traffic bonus (docs/02 §5.1 `weekdayFactor`), e.g. +40% on Saturdays. */
  | { kind: 'busy'; weekday: Weekday; pct: number }
  /** Weekly rent is charged tomorrow night (docs/02 §3). */
  | { kind: 'rent'; cents: Cents }
  /** Empty shelf slots the player can fill before opening. */
  | { kind: 'emptySlots'; count: number }
  /** Fallback: the teaser is always present (docs/05 §5.17). */
  | { kind: 'fresh' };

export interface BestPull {
  cardId: string;
  name: string;
  rarity: Rarity | null;
  finish: Finish;
  valueCents: Cents;
}

export interface DaySummary {
  day: number;
  date: GameDate;
  /** When the doors closed (19:00, or earlier when closed early). */
  closedMinute: number;
  shopName: string;
  served: number;
  lost: number;
  itemsSold: number;
  packsOpened: number;
  newCards: number;
  revenue: Cents;
  cogs: Cents;
  /** Cost basis of sealed product opened today. */
  opened: Cents;
  rent: Cents;
  wages: Cents;
  other: Cents;
  /** Revenue minus every cost line above. */
  profit: Cents;
  /** Supplier orders placed today: cash out, not a cost until sold (shown as a note). */
  purchases: Cents;
  reputation: { before: number; after: number; delta: number; stars: number; starsBefore: number };
  xp: { gained: number; level: number; xp: number; needed: number; ratio: number };
  bestPull: BestPull | null;
  tomorrow: { day: number; weekday: Weekday; items: TomorrowItem[] };
}

type SummaryContent = Pick<ContentRegistry, 'cards' | 'fixtures'>;

/** Rounds a reputation delta to one decimal, without a "−0.0". */
export function roundDelta(delta: number): number {
  const rounded = Math.round(delta * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function tomorrowItems(
  game: GameState,
  content: SummaryContent,
  balance = defaultBalance,
): TomorrowItem[] {
  const items: TomorrowItem[] = [];
  const tomorrow = game.clock.day + 1;

  let orders = 0;
  let units = 0;
  for (const order of game.suppliers.orders) {
    if (order.status !== 'pending' || order.etaDay > tomorrow) continue;
    orders += 1;
    for (const line of order.lines) units += line.qty;
  }
  if (orders > 0) items.push({ kind: 'delivery', orders, units });

  const factor = balance.customers.weekdayFactor[weekdayIndex(tomorrow)] ?? 1;
  if (factor > 1.05) {
    items.push({ kind: 'busy', weekday: weekdayOf(tomorrow), pct: Math.round((factor - 1) * 100) });
  }

  const rent = weeklyRentDue(game);
  if (rent > 0 && weekdayOf(tomorrow) === 'sun') items.push({ kind: 'rent', cents: rent });

  let empty = 0;
  for (const fixture of game.shop.fixtures) {
    if (content.fixtures.get(fixture.fixtureId)?.slots.accepts.kind !== 'sealed') continue;
    for (const slot of fixture.slots) if (slot.qty === 0) empty += 1;
  }
  if (empty > 0) items.push({ kind: 'emptySlots', count: empty });

  if (items.length === 0) items.push({ kind: 'fresh' });
  return items;
}

export function buildDaySummary(
  game: GameState,
  content: SummaryContent,
  balance = defaultBalance,
): DaySummary {
  const today = game.finance.today;
  const log = game.dayLog;
  const profit = today.revenue - today.cogs - today.opened - today.rent - today.wages - today.other;
  const before = log.repStart;
  const after = reputationScore(game);
  const xp = xpProgress(game);
  const best = log.bestPull;
  const bestCard = best ? content.cards.get(best.cardId) : undefined;
  const tomorrow = game.clock.day + 1;

  return {
    day: game.clock.day,
    date: dayToDate(game.clock.day),
    closedMinute: game.clock.minute,
    shopName: game.meta.shopName,
    served: log.served,
    lost: log.lost,
    itemsSold: log.itemsSold,
    packsOpened: log.packsOpened,
    newCards: log.newCards,
    revenue: today.revenue,
    cogs: today.cogs,
    opened: today.opened,
    rent: today.rent,
    wages: today.wages,
    other: today.other,
    profit,
    purchases: today.purchases,
    reputation: {
      before,
      after,
      delta: roundDelta(after - before),
      stars: reputationStars(after),
      starsBefore: reputationStars(before),
    },
    xp: {
      gained: log.xpGained,
      level: xp.level,
      xp: xp.xp,
      needed: Number.isFinite(xp.needed) ? xp.needed : 0,
      ratio: xp.ratio,
    },
    bestPull: best
      ? {
          cardId: best.cardId,
          name: bestCard?.name ?? best.cardId,
          rarity: bestCard?.rarity ?? null,
          finish: best.finish,
          valueCents: best.valueCents,
        }
      : null,
    tomorrow: {
      day: tomorrow,
      weekday: weekdayOf(tomorrow),
      items: tomorrowItems(game, content, balance),
    },
  };
}
