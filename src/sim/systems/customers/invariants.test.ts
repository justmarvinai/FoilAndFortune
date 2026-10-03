import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { nookStarterLayout } from '@/content/shop/layouts';
import type { Command } from '../../commands';
import type { GameState } from '../../state/types';
import { newTestGame } from '../../testing';
import { customerAtPaySpot } from './index';
import {
  BLISTER,
  BOOSTER,
  type Harness,
  harness,
  STARTER,
  stockShelves,
  unitsOnHand,
  unitsSold,
} from './testkit';

/**
 * Invariants over random days (docs/06 §14 property tests): stock never goes negative, every unit
 * is conserved across storage, fixtures, baskets and sales, the lane matches the agents, and
 * agents never leave grid or door space.
 */

const SEED = 4242;
const LANE_TILES = 3;
const { grid } = nookStarterLayout;
const cardKeys = Object.keys(newTestGame('standard', SEED).inventory.cardStacks).slice(0, 12);

/** `serve`: tick until someone stands at the pay spot (at most an hour), then ring them up. */
type Step = Command | { type: 'tick'; count: number } | { type: 'serve'; uid: 'payer' | 'other' };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.integer({ min: 1, max: 150 }).map((count) => ({ type: 'tick' as const, count })),
  },
  {
    weight: 5,
    arbitrary: fc
      .constantFrom<'payer' | 'other'>('payer', 'payer', 'other')
      .map((uid) => ({ type: 'serve' as const, uid })),
  },
  { weight: 2, arbitrary: fc.constant<Command>({ type: 'time/openShop' }) },
  fc.constant<Command>({ type: 'time/closeShop' }),
  { weight: 2, arbitrary: fc.constant<Command>({ type: 'time/startNextDay' }) },
  {
    weight: 4,
    arbitrary: fc
      .option(fc.integer({ min: 1, max: 60 }), { nil: undefined })
      .map<Command>((uid) => ({ type: 'customers/checkout', uid })),
  },
  {
    weight: 2,
    arbitrary: fc
      .record({
        fixtureUid: fc.constantFrom('shelf-a', 'shelf-b'),
        slot: fc.integer({ min: 0, max: 3 }),
        productId: fc.constantFrom(BOOSTER, BLISTER, STARTER),
      })
      .map<Command>((fill) => ({ type: 'stock/fillSlot', ...fill })),
  },
  fc
    .record({ slot: fc.integer({ min: 0, max: 5 }), cardKey: fc.constantFrom(...cardKeys) })
    .map<Command>((fill) => ({ type: 'stock/fillSlot', fixtureUid: 'case-1', ...fill })),
  fc
    .record({
      fixtureUid: fc.constantFrom('shelf-a', 'shelf-b', 'case-1'),
      slot: fc.integer({ min: 0, max: 5 }),
    })
    .map<Command>((clear) => ({ type: 'stock/clearSlot', ...clear })),
  fc.constant<Command>({ type: 'stock/restockAll' }),
  fc
    .record({
      productId: fc.constantFrom(BOOSTER, BLISTER, STARTER),
      cents: fc.integer({ min: 50, max: 4000 }),
    })
    .map<Command>((price) => ({ type: 'pricing/setPrice', ...price })),
  fc
    .record({ slot: fc.integer({ min: 0, max: 5 }), cents: fc.integer({ min: 1, max: 5000 }) })
    .map<Command>((price) => ({ type: 'pricing/setSlotPrice', fixtureUid: 'case-1', ...price })),
  fc.constant<Command>({ type: 'debug/grantXp', amount: 80 }),
);

function apply(h: Harness, step: Step): void {
  if (step.type === 'tick') h.tick(step.count);
  else if (step.type === 'serve') {
    h.tickUntil(() => customerAtPaySpot(h.state) !== null, 60);
    const payer = customerAtPaySpot(h.state);
    const uid = payer && step.uid === 'other' ? payer.uid + 1 : payer?.uid;
    const result = h.run({ type: 'customers/checkout', uid });
    expect(result.ok).toBe(
      payer !== null && step.uid === 'payer' && h.state.clock.phase === 'open',
    );
  } else h.run(step);
}

function expectInvariants(
  state: GameState,
  initial: Map<string, number>,
  sold: Map<string, number>,
) {
  // Stock is never negative and slots stay within capacity.
  for (const fixture of state.shop.fixtures) {
    for (const slot of fixture.slots) {
      expect(slot.qty).toBeGreaterThanOrEqual(0);
      expect(slot.costCents).toBeGreaterThanOrEqual(0);
      if (slot.qty === 0) expect(slot.costCents).toBe(0);
      if (slot.cardKey) expect(slot.qty).toBeLessThanOrEqual(1);
    }
  }
  for (const lots of Object.values(state.inventory.sealed)) {
    for (const lot of lots) expect(lot.qty).toBeGreaterThan(0);
  }
  for (const count of Object.values(state.inventory.cardStacks)) expect(count).toBeGreaterThan(0);

  // Every unit is somewhere: storage, a fixture, an unpaid basket, or sold.
  const now = unitsOnHand(state);
  for (const [key, qty] of sold) now.set(key, (now.get(key) ?? 0) + qty);
  expect(now).toEqual(initial);

  // Lane and agents agree; nobody lingers outside opening hours.
  const { active, lane, nextArrivalMinute } = state.customers;
  if (state.clock.phase !== 'open') {
    expect(active).toEqual([]);
    expect(lane).toEqual([]);
    expect(nextArrivalMinute).toBeNull();
  }
  expect(new Set(lane).size).toBe(lane.length);
  expect(lane.length).toBeLessThanOrEqual(LANE_TILES);
  for (const uid of lane) {
    const agent = active.find((a) => a.uid === uid);
    expect(agent?.activity.kind === 'walk' || agent?.activity.kind === 'queue').toBe(true);
  }
  const minute = state.clock.minute;
  for (const agent of active) {
    const { activity } = agent;
    if (activity.kind === 'queue') expect(lane).toContain(agent.uid);
    for (const item of agent.basket) {
      expect(item.qty).toBeGreaterThan(0);
      expect(item.priceCents).toBeGreaterThan(0);
    }
    if (activity.kind === 'walk' || activity.kind === 'leave') {
      expect(activity.endMinute).toBeGreaterThan(activity.startMinute);
      expect(activity.endMinute).toBeGreaterThan(minute);
    }
    if (activity.kind === 'browse') expect(activity.endMinute).toBeGreaterThan(minute);
    const points =
      activity.kind === 'walk' || activity.kind === 'leave'
        ? activity.path
        : [activity.at, activity.facing];
    for (const p of points) {
      const inside = p.x >= 0 && p.z >= 0 && p.x <= grid.w && p.z <= grid.d;
      const door = p.x < 0 && p.x > -1 && p.z >= 0 && p.z <= grid.d + 1.5;
      expect(inside || door, `${p.x},${p.z}`).toBe(true);
    }
  }
}

describe('customer invariants over random days', () => {
  it('conserves units and keeps agents consistent', () => {
    fc.assert(
      fc.property(fc.array(stepArb, { minLength: 5, maxLength: 40 }), (steps) => {
        const h = harness(newTestGame('standard', SEED));
        const initial = unitsOnHand(h.state);
        stockShelves(h);
        h.run({ type: 'time/openShop' });
        for (const step of steps) {
          apply(h, step);
          expectInvariants(h.state, initial, unitsSold(h.events));
        }
        // The whole state stays JSON-serializable (saves).
        expect(JSON.parse(JSON.stringify(h.state))).toEqual(h.state);
      }),
      { numRuns: 60 },
    );
  });
});
