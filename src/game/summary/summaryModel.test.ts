import { describe, expect, it } from 'vitest';
import { runCommand, runTicks } from '@/sim/engine';
import { reputationScore } from '@/sim/selectors';
import type { GameState } from '@/sim/state/types';
import { newTestGame, testContext } from '@/sim/testing';
import { buildDaySummary, roundDelta, tomorrowItems } from './summaryModel';

const ctx = testContext();
const openMinutes = ctx.balance.time.closeMinute - ctx.balance.time.openMinute;

/** Plays the current day to its night phase. */
function closeDay(game: GameState): GameState {
  const opened = runCommand(game, { type: 'time/openShop' }, ctx).state;
  return runTicks(opened, openMinutes, ctx).state;
}

function nextDay(game: GameState): GameState {
  return runCommand(closeDay(game), { type: 'time/startNextDay' }, ctx).state;
}

describe('buildDaySummary', () => {
  it('computes profit from every cost line', () => {
    const game = closeDay(newTestGame());
    const edited: GameState = {
      ...game,
      finance: {
        ...game.finance,
        today: {
          ...game.finance.today,
          revenue: 68_420,
          cogs: 40_210,
          opened: 325,
          rent: 24_500,
          wages: 8_000,
          other: 100,
          purchases: 3_900,
        },
      },
    };
    const summary = buildDaySummary(edited, ctx.content);
    expect(summary.profit).toBe(68_420 - 40_210 - 325 - 24_500 - 8_000 - 100);
    // Orders placed are cash out, but not a cost of the day.
    expect(summary.purchases).toBe(3_900);
    expect(summary.day).toBe(1);
    expect(summary.date).toMatchObject({ weekday: 'mon', season: 'spring', dayOfSeason: 8 });
  });

  it('reports reputation against the start of the day', () => {
    const game = closeDay(newTestGame());
    const repStart = reputationScore(game) - 2.04;
    const summary = buildDaySummary({ ...game, dayLog: { ...game.dayLog, repStart } }, ctx.content);
    expect(summary.reputation.before).toBe(repStart);
    expect(summary.reputation.delta).toBe(2);
    expect(summary.reputation.stars).toBeGreaterThanOrEqual(summary.reputation.starsBefore);
  });

  it('names the best pull from content, falling back to the id', () => {
    const game = closeDay(newTestGame());
    const card = [...ctx.content.cards.values()].find((c) => c.rarity === 'holoRare');
    if (!card) throw new Error('test content needs a holo rare');
    const withPull = (cardId: string): GameState => ({
      ...game,
      dayLog: { ...game.dayLog, bestPull: { cardId, finish: 'holo', valueCents: 1234 } },
    });
    expect(buildDaySummary(withPull(card.id), ctx.content).bestPull).toMatchObject({
      name: card.name,
      rarity: 'holoRare',
      valueCents: 1234,
    });
    expect(buildDaySummary(withPull('gk.nope.001'), ctx.content).bestPull).toMatchObject({
      name: 'gk.nope.001',
      rarity: null,
    });
    expect(buildDaySummary(game, ctx.content).bestPull).toBeNull();
  });

  it('carries XP progress and never reports an infinite requirement', () => {
    const game = closeDay(newTestGame());
    const summary = buildDaySummary(game, ctx.content);
    expect(summary.xp.level).toBe(1);
    expect(Number.isFinite(summary.xp.needed)).toBe(true);
    expect(summary.xp.ratio).toBeGreaterThanOrEqual(0);
    expect(summary.xp.ratio).toBeLessThanOrEqual(1);
  });
});

describe('tomorrowItems (the teaser is always present)', () => {
  it('announces tomorrow’s deliveries with their unit count', () => {
    const game = closeDay(newTestGame());
    const ordered = runCommand(
      game,
      {
        type: 'suppliers/placeOrder',
        supplierId: 'sup.budget-box',
        lines: [{ productId: 'gk.emberdawn.booster', qty: 12 }],
      },
      ctx,
    ).state;
    expect(tomorrowItems(ordered, ctx.content)).toContainEqual({
      kind: 'delivery',
      orders: 1,
      units: 12,
    });
  });

  it('flags busy weekdays and Sunday rent', () => {
    let game = newTestGame();
    // Day 6 is a Saturday, so tomorrow is a busy Sunday (+25% traffic) and rent night.
    while (game.clock.day < 6) game = nextDay(game);
    const saturday = tomorrowItems(closeDay(game), ctx.content);
    expect(saturday).toContainEqual({ kind: 'busy', weekday: 'sun', pct: 25 });
    expect(saturday.some((item) => item.kind === 'rent')).toBe(true);
  });

  it('skips rent on Cozy and falls back to a fresh-day line when nothing else applies', () => {
    const game = closeDay(newTestGame('cozy'));
    const filled: GameState = {
      ...game,
      shop: {
        ...game.shop,
        fixtures: game.shop.fixtures.map((fixture) => ({
          ...fixture,
          slots: fixture.slots.map((slot) => ({ ...slot, qty: 5 })),
        })),
      },
    };
    // Day 1 (Mon) → Tue: no weekday bonus, no orders, full shelves.
    expect(tomorrowItems(filled, ctx.content)).toEqual([{ kind: 'fresh' }]);
  });

  it('counts empty sealed shelf slots only', () => {
    const game = closeDay(newTestGame());
    const items = tomorrowItems(game, ctx.content);
    // Two small wall shelves with four slots each; the display case holds singles.
    expect(items).toContainEqual({ kind: 'emptySlots', count: 8 });
  });
});

describe('roundDelta', () => {
  it('rounds to one decimal without negative zero', () => {
    expect(roundDelta(1.26)).toBe(1.3);
    expect(Object.is(roundDelta(-0.01), 0)).toBe(true);
    expect(roundDelta(-0.26)).toBe(-0.3);
  });
});
