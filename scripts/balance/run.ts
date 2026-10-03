/**
 * Headless balance runs (docs/02 §18), scaled to Phase 2: bots play the pure sim through
 * commands only, minute by minute, and every day is measured for the report.
 */
import { setAutoFreeze } from 'immer';
import { defaultBalance } from '../../src/content/balance';
import { getRegistry } from '../../src/content/registry';
import { mean } from '../../src/core/math';
import { createRng, type Rng, seedStream } from '../../src/core/rng';
import type { Command, CommandResult } from '../../src/sim/commands';
import type { SimContext } from '../../src/sim/context';
import { type PureContext, runCommand, tick } from '../../src/sim/engine';
import type { DomainEvent } from '../../src/sim/events';
import { itemMarketValue } from '../../src/sim/pricing';
import { reputationScore, reputationStars, sealedQuantity } from '../../src/sim/selectors';
import { createNewGame } from '../../src/sim/state/createNewGame';
import type { GameState } from '../../src/sim/state/types';
import { customerAtPaySpot } from '../../src/sim/systems/customers';
import { queuePatience } from '../../src/sim/systems/customers/satisfaction';
import { hasUnlock } from '../../src/sim/systems/progression';
import { SINGLES_CASE_UNLOCK } from '../../src/sim/systems/stock';

export const BOT_NAMES = ['balanced', 'cautious', 'ripper'] as const;
export type BotName = (typeof BOT_NAMES)[number];

const BOOSTER = 'gk.emberdawn.booster';
const BOX = 'gk.emberdawn.box';
const SUPPLIER = 'sup.budget-box';

/** One played day, measured after the night (orders placed, rent charged). */
export interface DayMetrics {
  day: number;
  revenue: number;
  cogs: number;
  opened: number;
  rent: number;
  /** The Day Summary receipt's profit: revenue − COGS − opened stock − rent − wages − other. */
  profit: number;
  visitors: number;
  served: number;
  lost: number;
  /** Mean exit satisfaction of everyone who left today (docs/02 §5.4). */
  satisfaction: number;
  rep: number;
  stars: number;
  level: number;
  cash: number;
  packsOpened: number;
  openFailures: number;
  stuck: string[];
}

export interface RunResult {
  seed: number;
  bot: BotName;
  days: DayMetrics[];
}

interface BotGame {
  state: GameState;
  ctx: PureContext;
  rng: Rng;
  openFailures: number;
  /** Pay-spot customer uid → minute the bot will ring them up. */
  ringAt: Map<number, number>;
  run(command: Command): CommandResult;
}

// ---------------------------------------------------------------------------------------------
// Shared play

/** Shelf priorities: the product mix a sensible owner keeps facing out. */
const SHELF_PRIORITY = [
  BOOSTER,
  'gk.emberdawn.blister',
  'gk.emberdawn.starter-ember',
  'gk.emberdawn.starter-volt',
];

/** Units on hand (storage + shelves) and on order, per product. */
function unitsHeld(state: GameState, productId: string): number {
  let units = sealedQuantity(state, productId);
  for (const fixture of state.shop.fixtures) {
    for (const slot of fixture.slots) if (slot.productId === productId) units += slot.qty;
  }
  for (const order of state.suppliers.orders) {
    if (order.status !== 'pending') continue;
    for (const line of order.lines) if (line.productId === productId) units += line.qty;
  }
  return units;
}

/** Restock All, then give every product in storage a face (one slot each first, then more). */
function stockShelves(g: BotGame): void {
  g.run({ type: 'stock/restockAll' });
  const content = g.ctx.content;
  for (const pass of [0, 1]) {
    for (const productId of SHELF_PRIORITY) {
      for (const fixture of g.state.shop.fixtures) {
        const def = content.fixtures.get(fixture.fixtureId);
        if (def?.slots.accepts.kind !== 'sealed') continue;
        fixture.slots.forEach((slot, index) => {
          if (sealedQuantity(g.state, productId) === 0 || slot.qty > 0) return;
          const faces = g.state.shop.fixtures
            .flatMap((f) => f.slots)
            .filter((s) => s.productId === productId && s.qty > 0).length;
          if (pass === 0 && faces > 0) return;
          g.run({ type: 'stock/fillSlot', fixtureUid: fixture.uid, slot: index, productId });
        });
      }
    }
  }
}

/**
 * From Lv 2: the best singles in the case at market price, alternating between the value caps the
 * archetypes look for (e.g. cheap holos for kids, docs/02 §5.2).
 */
function stockCase(g: BotGame): void {
  if (!hasUnlock(g.state, SINGLES_CASE_UNLOCK)) return;
  const caps = [...g.ctx.content.archetypes.values()]
    .flatMap((arch) => arch.preferences)
    .flatMap((pref) => (pref.kind === 'singles' ? [pref.maxValueCents ?? Infinity] : []))
    .sort((a, b) => b - a);
  if (caps.length === 0) return;
  const singles = Object.keys(g.state.inventory.cardStacks)
    .map((key) => ({ key, value: itemMarketValue(g.ctx, { cardKey: key }) ?? 0 }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
  for (const fixture of g.state.shop.fixtures) {
    if (g.ctx.content.fixtures.get(fixture.fixtureId)?.slots.accepts.kind !== 'singles') continue;
    fixture.slots.forEach((slot, index) => {
      if (slot.qty > 0) return;
      const cap = caps[index % caps.length] ?? Infinity;
      const best = singles.find(
        (card) => card.value <= cap && (g.state.inventory.cardStacks[card.key] ?? 0) > 0,
      );
      if (best) {
        g.run({ type: 'stock/fillSlot', fixtureUid: fixture.uid, slot: index, cardKey: best.key });
      }
    });
  }
}

/** An attentive owner rings up whoever reaches the pay spot within 1–2 minutes. */
function serveAttentively(g: BotGame): void {
  const payer = customerAtPaySpot(g.state);
  if (!payer) return;
  const now = g.state.clock.minute;
  const at = g.ringAt.get(payer.uid) ?? now + g.rng.int(1, 2);
  g.ringAt.set(payer.uid, at);
  if (now >= at) g.run({ type: 'customers/checkout', uid: payer.uid });
}

/** Opens up to `count` units of a product; failures are counted, never fatal. */
function rip(g: BotGame, productId: string, count: number): void {
  for (let i = 0; i < count; i++) {
    if (sealedQuantity(g.state, productId) === 0) return;
    if (!g.run({ type: 'open/openProduct', productId }).ok) {
      g.openFailures += 1;
      return;
    }
  }
}

/**
 * Night reorder from Budget Box Co. (next-morning delivery) up to `targets`, keeping a cash
 * reserve for the weekly rent (docs/02 §2–3).
 */
function reorder(g: BotGame, targets: Record<string, number>): void {
  const supplier = g.ctx.content.suppliers.get(SUPPLIER);
  if (!supplier) return;
  const rent = defaultBalance.shopTiers[0]?.dailyRent ?? 0;
  const reserve = 7 * rent;
  for (const item of supplier.items) {
    const need = (targets[item.productId] ?? 0) - unitsHeld(g.state, item.productId);
    if (need <= 0) continue;
    let qty = Math.ceil(need / item.minQty) * item.minQty;
    while (qty >= item.minQty && qty * item.costCents > g.state.finance.cashCents - reserve) {
      qty -= item.minQty;
    }
    if (qty < item.minQty) continue;
    const result = g.run({
      type: 'suppliers/placeOrder',
      supplierId: SUPPLIER,
      lines: [{ productId: item.productId, qty }],
    });
    if (!result.ok && result.code === 'STORAGE_FULL') {
      const fewer = qty - item.minQty;
      if (fewer >= item.minQty) {
        g.run({
          type: 'suppliers/placeOrder',
          supplierId: SUPPLIER,
          lines: [{ productId: item.productId, qty: fewer }],
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Bots (docs/02 §18): cautious seller, balanced, pack ripper

/** Stock targets for the night reorder: about a busy day of demand plus a buffer. */
const SHELF_TARGETS: Record<string, number> = {
  [BOOSTER]: 48,
  'gk.emberdawn.blister': 16,
  'gk.emberdawn.starter-ember': 6,
  'gk.emberdawn.starter-volt': 6,
};

interface Bot {
  prep(g: BotGame): void;
  minute(g: BotGame): void;
  night(g: BotGame): void;
}

const hourly = (g: BotGame) => {
  serveAttentively(g);
  if (g.state.clock.minute % 60 === 0) {
    stockShelves(g);
    stockCase(g);
  }
};

const bots: Record<BotName, Bot> = {
  /** Never opens product, prices at MSRP (the default), keeps the shelves and case full. */
  cautious: {
    prep: (g) => {
      stockShelves(g);
      stockCase(g);
    },
    minute: hourly,
    night: (g) => reorder(g, SHELF_TARGETS),
  },
  /** A sensible mix: a few packs a day for the fun and the XP, Theo's box once the case opens. */
  balanced: {
    prep: (g) => {
      rip(g, BOOSTER, 3);
      if (hasUnlock(g.state, SINGLES_CASE_UNLOCK)) rip(g, BOX, 1);
      stockShelves(g);
      stockCase(g);
    },
    minute: hourly,
    // Reorders the three packs it rips each morning on top of the shelf targets.
    night: (g) => reorder(g, { ...SHELF_TARGETS, [BOOSTER]: (SHELF_TARGETS[BOOSTER] ?? 0) + 3 }),
  },
  /** Opens nearly everything it buys and sells the singles. */
  ripper: {
    prep: (g) => {
      rip(g, BOX, 1);
      rip(g, BOOSTER, Math.max(0, sealedQuantity(g.state, BOOSTER) - 12));
      stockShelves(g);
      stockCase(g);
    },
    minute: hourly,
    night: (g) => reorder(g, { ...SHELF_TARGETS, [BOOSTER]: 96 }),
  },
};

// ---------------------------------------------------------------------------------------------
// The run

/** Agents that should have moved on by now, and lane drift: anything here is a stuck state. */
function stuckAgents(state: GameState, ctx: PureContext): string[] {
  const now = state.clock.minute;
  const problems: string[] = [];
  const { active, lane } = state.customers;
  for (const uid of lane) {
    if (!active.some((agent) => agent.uid === uid)) problems.push(`lane uid ${uid} not active`);
  }
  for (const agent of active) {
    const { activity } = agent;
    if (activity.kind === 'queue') {
      if (agent.waitedMinutes > queuePatience(agent, ctx.balance.customers) + 1) {
        problems.push(`uid ${agent.uid} waited past patience`);
      }
    } else if (activity.endMinute < now) {
      problems.push(`uid ${agent.uid} ${activity.kind} ended at ${activity.endMinute}`);
    }
  }
  return problems;
}

export function runSeed(seed: number, days: number, bot: BotName): RunResult {
  setAutoFreeze(false); // ticks mutate the state in place between (atomic) commands
  const ctx: PureContext = { content: getRegistry(), balance: defaultBalance };
  const g: BotGame = {
    state: createNewGame(
      {
        seed,
        shopName: 'Balance Bot',
        difficulty: 'standard',
        createdAt: '2026-10-01T00:00:00.000Z',
        gameVersion: 'balance-sim',
      },
      ctx,
    ),
    ctx,
    rng: createRng(seedStream(seed, `bot.${bot}`)),
    openFailures: 0,
    ringAt: new Map(),
    run(command) {
      const result = runCommand(this.state, command, ctx);
      this.state = result.state;
      return result.result;
    },
  };
  const strategy = bots[bot];
  const out: DayMetrics[] = [];
  for (let d = 0; d < days; d++) {
    const events: DomainEvent[] = [];
    const simCtx: SimContext = { ...ctx, emit: (event) => events.push(event) };
    const failuresBefore = g.openFailures;
    strategy.prep(g);
    const stuck: string[] = [];
    if (!g.run({ type: 'time/openShop' }).ok) stuck.push('could not open');
    while (g.state.clock.phase === 'open') {
      tick(g.state, simCtx);
      if (g.state.clock.phase !== 'open') break;
      stuck.push(...stuckAgents(g.state, ctx));
      strategy.minute(g);
    }
    const { customers } = g.state;
    if (customers.active.length > 0 || customers.lane.length > 0)
      stuck.push('agents left at night');
    strategy.night(g);
    const today = g.state.finance.today;
    const sellable =
      Object.keys(g.state.inventory.sealed).length > 0 ||
      g.state.shop.fixtures.some((f) => f.slots.some((slot) => slot.qty > 0)) ||
      g.state.suppliers.orders.some((order) => order.status === 'pending');
    if (!sellable) stuck.push('nothing to sell and nothing on order');
    if (g.state.finance.cashCents < 0) stuck.push('negative cash');
    const left = events.flatMap((e) => (e.type === 'customer/left' ? [e.satisfaction] : []));
    const rep = reputationScore(g.state);
    out.push({
      day: g.state.clock.day,
      revenue: today.revenue,
      cogs: today.cogs,
      opened: today.opened,
      rent: today.rent,
      profit: today.revenue - today.cogs - today.opened - today.rent - today.wages - today.other,
      visitors: events.filter((e) => e.type === 'customer/arrived').length,
      served: g.state.dayLog.served,
      lost: g.state.dayLog.lost,
      satisfaction: mean(left),
      rep,
      stars: reputationStars(rep),
      level: g.state.progression.level,
      cash: g.state.finance.cashCents,
      packsOpened: g.state.dayLog.packsOpened,
      openFailures: g.openFailures - failuresBefore,
      stuck,
    });
    g.ringAt.clear();
    if (!g.run({ type: 'time/startNextDay' }).ok) stuck.push('could not start the next day');
  }
  return { seed, bot, days: out };
}
