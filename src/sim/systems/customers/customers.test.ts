import { describe, expect, it } from 'vitest';
import { nookStarterLayout } from '@/content/shop/layouts';
import type { Command } from '../../commands';
import { runCommand, runTicks } from '../../engine';
import type { DomainEvent } from '../../events';
import type { Point } from '../../nav';
import { sealedQuantity } from '../../selectors';
import type { AgentActivity, GameState } from '../../state/types';
import { newTestGame, testContext } from '../../testing';
import { customerAtPaySpot } from './index';
import {
  BLISTER,
  BOOSTER,
  certainBuyers,
  type Harness,
  harness,
  openQuiet,
  STARTER,
  spawnShopper,
  stockShelves,
  unitsOnHand,
  unitsSold,
  wantBooster,
} from './testkit';
import { doorCrossingMinute } from './world';

const STEAL = 300; // < 0.8 × $4.49: a sure sale for a certain buyer (docs/02 §5.3)
const PAY_SPOT = { x: 4.5, z: 2.5 };

function startPoint(activity: AgentActivity): Point | undefined {
  return activity.kind === 'walk' || activity.kind === 'leave' ? activity.path[0] : activity.at;
}

function endPoint(activity: AgentActivity): Point | undefined {
  return activity.kind === 'walk' || activity.kind === 'leave'
    ? activity.path[activity.path.length - 1]
    : activity.at;
}

function startMinute(activity: AgentActivity): number {
  return activity.kind === 'queue' ? activity.sinceMinute : activity.startMinute;
}

/** A shop with one shelf slot of boosters at a steal price and random arrivals switched off. */
function boosterShop(customers = certainBuyers): Harness {
  const h = harness(newTestGame(), customers);
  expect(
    h.run({ type: 'stock/fillSlot', fixtureUid: 'shelf-a', slot: 0, productId: BOOSTER }).ok,
  ).toBe(true);
  h.run({ type: 'pricing/setPrice', productId: BOOSTER, cents: STEAL });
  openQuiet(h);
  return h;
}

function bubblesOf(h: Harness, uid: number): string[] {
  return h.of('customer/bubble').flatMap((event) => (event.uid === uid ? [event.bubble] : []));
}

/** Checks lane/active consistency (docs/06 §5.6) on the current state. */
function expectConsistentLane(state: GameState, laneTiles: number): void {
  const { active, lane } = state.customers;
  const uids = active.map((agent) => agent.uid);
  expect(new Set(uids).size).toBe(uids.length);
  expect(new Set(lane).size).toBe(lane.length);
  expect(lane.length).toBeLessThanOrEqual(laneTiles);
  for (const uid of lane) {
    const agent = active.find((a) => a.uid === uid);
    expect(agent, `lane uid ${uid}`).toBeDefined();
    expect(['walk', 'queue']).toContain(agent?.activity.kind);
    expect(agent?.basket.length).toBeGreaterThan(0);
  }
  for (const agent of active) {
    if (agent.activity.kind === 'queue') expect(lane).toContain(agent.uid);
  }
}

describe('arriving and browsing', () => {
  it('walks in from the street, rings the door bell on crossing, then browses', () => {
    const h = boosterShop();
    const agent = spawnShopper(h);
    expect(agent.activity.kind).toBe('walk');
    expect(agent.activity.kind === 'walk' && agent.activity.path[0]).toEqual({
      x: -0.9,
      z: nookStarterLayout.grid.d + 1.35,
    });
    const crossing = doorCrossingMinute(agent.activity);
    expect(crossing).not.toBeNull();
    let enteredAt: number | null = null;
    h.tickUntil(() => {
      if (enteredAt === null && h.of('customer/entered').length > 0)
        enteredAt = h.state.clock.minute;
      return agent.activity.kind === 'browse';
    });
    expect(enteredAt).toBe(crossing);
    expect(h.of('customer/entered')).toEqual([{ type: 'customer/entered', uid: agent.uid }]);
    expect(agent.activity).toMatchObject({ kind: 'browse', fixtureUid: 'shelf-a' });
    // Browsing faces the shelf: the fixture tile right behind the access tile.
    if (agent.activity.kind === 'browse') {
      expect(agent.activity.facing).toEqual({ x: agent.activity.at.x, z: agent.activity.at.z - 1 });
    }
    expect(agent.bubble?.kind).toBe('search');
  });

  it('picks items off the shelf, moving their cost basis into the basket', () => {
    const h = boosterShop();
    const before = { ...h.slot('shelf-a', 0) };
    const agent = spawnShopper(h, [wantBooster, wantBooster]);
    expect(h.tickUntil(() => agent.basket.length > 0)).toBe(true);
    expect(agent.basket).toEqual([
      {
        fixtureUid: 'shelf-a',
        slot: 0,
        productId: BOOSTER,
        qty: 2,
        priceCents: STEAL,
        costCents: 325,
      },
    ]);
    expect(h.slot('shelf-a', 0)).toMatchObject({
      productId: BOOSTER,
      qty: before.qty - 2,
      costCents: before.costCents - 2 * 325,
    });
    expect(h.of('stock/changed')).toContainEqual({
      type: 'stock/changed',
      fixtureUid: 'shelf-a',
      slot: 0,
    });
    // The true ratio 300 / 449 < 0.8 is a steal, shown for a few minutes.
    expect(agent.reactions).toEqual(['steal', 'steal']);
    expect(agent.bubble).toMatchObject({ kind: 'steal' });
    expect(agent.bubble?.untilMinute).toBe(
      (agent.bubble?.sinceMinute ?? 0) + h.ctx.balance.customers.reactionBubbleMinutes,
    );
  });

  it('empties a shelf slot but keeps its product for Restock All', () => {
    const h = harness(newTestGame(), certainBuyers);
    h.run({ type: 'stock/fillSlot', fixtureUid: 'shelf-a', slot: 0, productId: BOOSTER, qty: 1 });
    h.run({ type: 'pricing/setPrice', productId: BOOSTER, cents: STEAL });
    openQuiet(h);
    const agent = spawnShopper(h, [wantBooster, wantBooster]);
    expect(h.tickUntil(() => agent.basket.length > 0)).toBe(true);
    expect(h.slot('shelf-a', 0)).toMatchObject({ productId: BOOSTER, qty: 0, costCents: 0 });
    expect(agent.basket).toHaveLength(1);
    expect(agent.basket[0]?.qty).toBe(1);
  });

  it('shows 🚫 for wanted items nowhere in stock and walks out unhappy', () => {
    const h = boosterShop();
    const agent = spawnShopper(h, [{ kind: 'sealed', productKind: 'blister', weight: 20 }]);
    expect(h.tickUntil(() => h.of('customer/left').length > 0)).toBe(true);
    expect(agent.missed).toBe(1);
    expect(bubblesOf(h, agent.uid)).toContain('outOfStock');
    expect(agent.activity.kind).toBe('leave');
    const left = h.of('customer/left')[0];
    expect(left).toMatchObject({ uid: agent.uid, bought: false });
    expect(left?.satisfaction).toBeCloseTo(h.ctx.balance.customers.satisfaction.outOfStock);
    expect(h.state.reputation.signals.selection).toEqual({ sum: -1, weight: 1, count: 1 });
    // Walking out empty-handed isn't a lost sale.
    expect(h.state.dayLog.lost).toBe(0);
  });

  it('reacts to rip-off prices and mostly walks away', () => {
    const h = harness(newTestGame(), { browseIdleInterest: 0, fixturesPerVisit: [1, 1] });
    h.run({ type: 'stock/fillSlot', fixtureUid: 'shelf-a', slot: 0, productId: BOOSTER });
    h.run({ type: 'pricing/setPrice', productId: BOOSTER, cents: 449 * 3 });
    openQuiet(h);
    const shoppers = Array.from({ length: 8 }, () => spawnShopper(h));
    expect(h.tickUntil(() => h.of('customer/left').length === shoppers.length)).toBe(true);
    for (const shopper of shoppers) {
      expect(shopper.reactions).toEqual(['ripoff']);
      expect(bubblesOf(h, shopper.uid)).toContain('ripoff');
    }
    expect(h.of('sale/completed')).toHaveLength(0);
    expect(h.state.reputation.signals.prices.sum).toBeLessThan(0);
  });
});

describe('the register lane', () => {
  it('queues first come first served, caps the line and sends the rest home', () => {
    const h = boosterShop();
    const laneTiles = 3; // the Nook's lane is cut by the south wall (src/sim/nav.test.ts)
    const shoppers = Array.from({ length: 5 }, () => spawnShopper(h));
    const units = unitsOnHand(h.state);
    const filled = h.tickUntil(() => {
      expectConsistentLane(h.state, laneTiles);
      return h.state.customers.lane.length === laneTiles && h.of('customer/left').length === 2;
    });
    expect(filled).toBe(true);
    // The two who found the line full put their boosters back and left (lost sales).
    expect(h.state.dayLog.lost).toBe(2);
    expect(h.of('customer/left').every((event) => !event.bought)).toBe(true);
    expect(unitsOnHand(h.state)).toEqual(units);
    const queued = h.of('customer/queued').map((event) => event.uid);
    expect(queued).toHaveLength(laneTiles);
    expect(h.state.customers.lane).toEqual(queued);
    // Ring them up as they reach the pay spot: served in queue order.
    for (let i = 0; i < laneTiles; i++) {
      expect(h.tickUntil(() => customerAtPaySpot(h.state) !== null)).toBe(true);
      expect(h.run({ type: 'customers/checkout' })).toEqual({ ok: true });
      expectConsistentLane(h.state, laneTiles);
    }
    expect(h.of('sale/completed').map((event) => event.uid)).toEqual(queued);
    expect(shoppers.map((s) => s.uid)).toEqual(expect.arrayContaining(queued));
  });

  it('turns 🛒 into ⏳ at half patience, then walks out 😠 and puts the items back', () => {
    const h = boosterShop();
    const agent = spawnShopper(h, [wantBooster, wantBooster]);
    const slotBefore = { ...h.slot('shelf-a', 0) };
    expect(h.tickUntil(() => h.of('customer/left').length > 0)).toBe(true);
    expect(bubblesOf(h, agent.uid)).toEqual(['search', 'steal', 'cart', 'waiting', 'angry']);
    const patience = agent.patienceMinutes * h.ctx.balance.customers.queuePatienceMultiplier;
    expect(agent.waitedMinutes).toBe(Math.ceil(patience));
    expect(agent.basket).toEqual([]);
    expect(h.slot('shelf-a', 0)).toEqual(slotBefore);
    expect(h.state.customers.lane).toEqual([]);
    expect(h.state.dayLog.lost).toBe(1);
    expect(h.state.reputation.signals.service).toEqual({ sum: -1, weight: 1, count: 1 });
    expect(h.of('customer/left')[0]).toMatchObject({ uid: agent.uid, bought: false });
    expect(h.of('customer/left')[0]?.satisfaction).toBeLessThan(0);
    // They walk out through the door and vanish at the street corner.
    expect(agent.activity.kind).toBe('leave');
    h.tickUntil(() => h.state.customers.active.length === 0);
    expect(h.state.customers.active).toEqual([]);
  });

  it('returns items to storage when their slot now holds something else', () => {
    const h = boosterShop();
    const agent = spawnShopper(h);
    expect(h.tickUntil(() => agent.basket.length > 0)).toBe(true);
    expect(h.run({ type: 'stock/clearSlot', fixtureUid: 'shelf-a', slot: 0 }).ok).toBe(true);
    expect(
      h.run({ type: 'stock/fillSlot', fixtureUid: 'shelf-a', slot: 0, productId: BLISTER }).ok,
    ).toBe(true);
    const boostersInStorage = sealedQuantity(h.state, BOOSTER);
    agent.patienceMinutes = 1;
    h.tickUntil(() => h.of('customer/left').length > 0);
    expect(sealedQuantity(h.state, BOOSTER)).toBe(boostersInStorage + 1);
    expect(h.state.inventory.sealed[BOOSTER]?.at(-1)).toMatchObject({ unitCostCents: 325 });
    expect(h.slot('shelf-a', 0).productId).toBe(BLISTER);
  });

  it('puts a single back in its case slot at its custom price', () => {
    const h = harness(newTestGame(), certainBuyers);
    h.run({ type: 'debug/grantXp', amount: 80 }); // Lv 2 unlocks the singles case
    const key = Object.keys(h.state.inventory.cardStacks)[0] ?? '';
    expect(h.run({ type: 'stock/fillSlot', fixtureUid: 'case-1', slot: 0, cardKey: key }).ok).toBe(
      true,
    );
    h.run({ type: 'pricing/setSlotPrice', fixtureUid: 'case-1', slot: 0, cents: 1 });
    openQuiet(h);
    const agent = spawnShopper(h, [{ kind: 'singles', weight: 20 }]);
    expect(h.tickUntil(() => agent.basket.length > 0)).toBe(true);
    expect(agent.basket[0]).toMatchObject({ cardKey: key, priceCents: 1, costCents: 0 });
    expect(h.slot('case-1', 0)).toMatchObject({ qty: 0, cardKey: undefined });
    agent.patienceMinutes = 1;
    h.tickUntil(() => h.of('customer/left').length > 0);
    expect(h.slot('case-1', 0)).toMatchObject({ cardKey: key, qty: 1, priceCents: 1 });
  });
});

describe('customers/checkout (docs/01 §11.1)', () => {
  it('only rings up the customer standing at the pay spot', () => {
    const h = boosterShop();
    expect(h.run({ type: 'customers/checkout' })).toMatchObject({ ok: false, code: 'NO_CUSTOMER' });
    const agent = spawnShopper(h);
    // On the way to the lane is not at the pay spot yet.
    expect(h.tickUntil(() => h.state.customers.lane.length > 0)).toBe(true);
    expect(agent.activity.kind).toBe('walk');
    expect(h.run({ type: 'customers/checkout' })).toMatchObject({ code: 'NO_CUSTOMER' });
    expect(h.tickUntil(() => customerAtPaySpot(h.state) !== null)).toBe(true);
    expect(h.run({ type: 'customers/checkout', uid: agent.uid + 1 })).toMatchObject({
      code: 'NO_CUSTOMER',
    });
    expect(h.run({ type: 'customers/checkout', uid: agent.uid })).toEqual({ ok: true });
    expect(h.run({ type: 'customers/checkout', uid: agent.uid })).toMatchObject({
      code: 'NO_CUSTOMER',
    });
  });

  it('books the sale, grants XP for a satisfied customer and records reputation signals', () => {
    const h = boosterShop();
    const agent = spawnShopper(h, [wantBooster, wantBooster]);
    expect(h.tickUntil(() => customerAtPaySpot(h.state) !== null)).toBe(true);
    const cash = h.state.finance.cashCents;
    const now = h.state.clock.minute;
    expect(h.run({ type: 'customers/checkout' }).ok).toBe(true);
    expect(h.state.finance.cashCents).toBe(cash + 2 * STEAL);
    expect(h.state.finance.today).toMatchObject({
      revenue: 2 * STEAL,
      cogs: 2 * 325,
      customers: 1,
    });
    expect(h.state.dayLog).toMatchObject({ served: 1, itemsSold: 2, lost: 0 });
    expect(h.of('sale/completed')).toEqual([
      {
        type: 'sale/completed',
        uid: agent.uid,
        items: [{ productId: BOOSTER, qty: 2, priceCents: STEAL }],
        totalCents: 2 * STEAL,
      },
    ]);
    // Two steals and found what they wanted: 1 + 1 = 2 → satisfied (+1 XP) and delighted.
    const left = h.of('customer/left')[0];
    expect(left).toMatchObject({ uid: agent.uid, bought: true });
    expect(left?.satisfaction).toBeCloseTo(2, 5);
    expect(h.of('xp/gained').map((event) => event.source)).toEqual(['sale', 'customer']);
    expect(agent.bubble?.kind).toBe('delight');
    const { signals } = h.state.reputation;
    expect(signals.prices).toEqual({ sum: 1, weight: 1, count: 1 });
    expect(signals.selection).toEqual({ sum: 1, weight: 1, count: 1 });
    expect(signals.service.count).toBe(1);
    expect(signals.service.sum).toBeGreaterThan(0.9);
    // The scan takes a moment at the counter, then they walk out through the door.
    expect(agent.activity).toMatchObject({
      kind: 'leave',
      startMinute: now + h.ctx.balance.customers.checkoutMinutes,
    });
    expect(agent.activity.kind === 'leave' && agent.activity.path[0]).toEqual(PAY_SPOT);
    expect(h.state.customers.lane).toEqual([]);
    h.tickUntil(() => h.state.customers.active.length === 0);
    expect(h.state.customers.active).toEqual([]);
  });

  it('keeps the pay spot free while the paid customer lingers, then the next steps up', () => {
    const scan = 3;
    const h = boosterShop({ ...certainBuyers, checkoutMinutes: scan });
    const first = spawnShopper(h);
    const second = spawnShopper(h);
    expect(
      h.tickUntil(
        () => customerAtPaySpot(h.state)?.uid === first.uid && second.activity.kind === 'queue',
      ),
    ).toBe(true);
    expect(second.activity).toMatchObject({ kind: 'queue', laneIndex: 1 });
    expect(h.run({ type: 'customers/checkout' }).ok).toBe(true);
    const paidAt = h.state.clock.minute;
    expect(h.state.customers.lane).toEqual([second.uid]);
    // Still scanning: the next customer waits a step back until the first walks off.
    for (let minute = paidAt + 1; minute < paidAt + scan; minute++) {
      h.tick(1);
      expect(second.activity).toMatchObject({ kind: 'queue', laneIndex: 1 });
      expect(first.activity).toMatchObject({ kind: 'leave', startMinute: paidAt + scan });
    }
    h.tick(1);
    expect(second.activity).toMatchObject({ kind: 'walk', startMinute: paidAt + scan });
    expect(h.tickUntil(() => customerAtPaySpot(h.state)?.uid === second.uid)).toBe(true);
    expect(second.activity).toMatchObject({ kind: 'queue', laneIndex: 0, at: PAY_SPOT });
    expect(second.bubble?.kind).toBe('cart');
  });

  it('is refused outside opening hours', () => {
    expect(runCommand(newTestGame(), { type: 'customers/checkout' }, testContext()).result).toEqual(
      { ok: false, code: 'WRONG_PHASE', params: { phase: 'prep' } },
    );
  });
});

describe('closing time', () => {
  it('rings up whoever holds items, sends everyone home and empties the shop', () => {
    const h = harness(newTestGame(), { ...certainBuyers, fixturesPerVisit: [2, 2] });
    stockShelves(h);
    for (const productId of [BOOSTER, STARTER]) {
      h.run({ type: 'pricing/setPrice', productId, cents: productId === BOOSTER ? STEAL : 1000 });
    }
    openQuiet(h);
    const queued = [spawnShopper(h), spawnShopper(h)];
    expect(h.tickUntil(() => h.state.customers.lane.length === 2)).toBe(true);
    const browsing = spawnShopper(h, [
      wantBooster,
      { kind: 'sealed', productKind: 'starterDeck', weight: 15 },
    ]);
    expect(
      h.tickUntil(() => browsing.basket.length > 0 && browsing.activity.kind === 'browse'),
    ).toBe(true);
    const outside = spawnShopper(h);
    expect(outside.activity.kind).toBe('walk');
    const sales = h.of('sale/completed').length;
    expect(sales).toBe(0);
    expect(h.run({ type: 'time/closeShop' }).ok).toBe(true);
    expect(h.state.customers).toMatchObject({ active: [], lane: [], nextArrivalMinute: null });
    // The line first, then the shopper still holding items; the latecomer leaves as they came.
    expect(h.of('sale/completed').map((event) => event.uid)).toEqual([
      ...queued.map((agent) => agent.uid),
      browsing.uid,
    ]);
    expect(h.state.dayLog).toMatchObject({ served: 3, lost: 0 });
    const left = h.of('customer/left');
    expect(left.map((event) => event.uid).sort((a, b) => a - b)).toEqual(
      h.of('customer/arrived').map((event) => event.uid),
    );
    expect(left.find((event) => event.uid === outside.uid)).toMatchObject({
      bought: false,
      satisfaction: 0,
    });
  });
});

describe('determinism and continuity', () => {
  /** A full day through the immutable API, ringing up whoever reaches the pay spot. */
  function playDay(seed: number): { state: GameState; events: DomainEvent[] } {
    const ctx = testContext();
    const events: DomainEvent[] = [];
    let state = newTestGame('standard', seed);
    const apply = (command: Command) => {
      const result = runCommand(state, command, ctx);
      state = result.state;
      events.push(...result.events);
    };
    apply({ type: 'stock/fillSlot', fixtureUid: 'shelf-a', slot: 0, productId: BOOSTER });
    apply({ type: 'stock/fillSlot', fixtureUid: 'shelf-a', slot: 1, productId: BLISTER });
    apply({ type: 'time/openShop' });
    while (state.clock.phase === 'open') {
      const ticked = runTicks(state, 1, ctx);
      state = ticked.state;
      events.push(...ticked.events);
      if (state.clock.phase === 'open' && customerAtPaySpot(state)) {
        apply({ type: 'customers/checkout' });
      }
    }
    return { state, events };
  }

  it('replays identically from the same seed and commands (Immer drafts)', () => {
    const a = playDay(7);
    const b = playDay(7);
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
    expect(a.events.filter((e) => e.type === 'sale/completed').length).toBeGreaterThan(3);
    expect(playDay(8).events).not.toEqual(a.events);
  });

  it('continues identically after a mid-day save and load', () => {
    const h = harness(newTestGame('standard', 11));
    stockShelves(h);
    h.run({ type: 'time/openShop' });
    expect(h.tickUntil(() => h.state.customers.active.length >= 2)).toBe(true);
    const copy = harness(JSON.parse(JSON.stringify(h.state)) as GameState);
    for (const side of [h, copy]) {
      side.tickUntil(() => {
        if (customerAtPaySpot(side.state)) side.run({ type: 'customers/checkout' });
        return side.state.clock.minute >= 16 * 60;
      });
    }
    expect(copy.state).toEqual(h.state);
  });

  it('chains every activity where the last one ended, at the tick it starts', () => {
    for (const cashier of [true, false]) {
      const h = harness(newTestGame('standard', cashier ? 21 : 22));
      stockShelves(h);
      h.run({ type: 'time/openShop' });
      const grid = nookStarterLayout.grid;
      const last = new Map<number, AgentActivity>();
      let changes = 0;
      h.tickUntil(() => {
        const now = h.state.clock.minute;
        expectConsistentLane(h.state, 3);
        for (const agent of h.state.customers.active) {
          const activity = agent.activity;
          const previous = last.get(agent.uid);
          if (previous && JSON.stringify(previous) !== JSON.stringify(activity)) {
            changes += 1;
            expect(startPoint(activity), `uid ${agent.uid} at ${now}`).toEqual(endPoint(previous));
            if (activity.kind === 'leave') expect(activity.startMinute).toBeGreaterThanOrEqual(now);
            else expect(startMinute(activity)).toBe(now);
          }
          if (activity.kind === 'walk' || activity.kind === 'leave') {
            expect(activity.endMinute).toBeGreaterThan(activity.startMinute);
          }
          if (activity.kind === 'browse') expect(activity.endMinute).toBeGreaterThan(now);
          // Grid space, or the door approach from the street.
          const points =
            activity.kind === 'walk' || activity.kind === 'leave' ? activity.path : [activity.at];
          for (const p of points) {
            const inside = p.x >= 0 && p.z >= 0 && p.x <= grid.w && p.z <= grid.d;
            const approach = p.x < 0 && p.x > -1 && p.z >= 0 && p.z <= grid.d + 1.5;
            expect(inside || approach, `${p.x},${p.z}`).toBe(true);
          }
          last.set(agent.uid, JSON.parse(JSON.stringify(activity)) as AgentActivity);
        }
        if (cashier && customerAtPaySpot(h.state)) h.run({ type: 'customers/checkout' });
        return false;
      });
      expect(h.state.clock.phase).toBe('night');
      expect(changes).toBeGreaterThan(50);
      if (!cashier) expect(h.state.dayLog.lost).toBeGreaterThan(0);
      // Units are conserved across storage, shelves, baskets and sales.
      const start = harness(newTestGame('standard', cashier ? 21 : 22));
      const before = unitsOnHand(start.state);
      const after = unitsOnHand(h.state);
      for (const [key, sold] of unitsSold(h.events)) after.set(key, (after.get(key) ?? 0) + sold);
      expect(after).toEqual(before);
    }
  });
});
