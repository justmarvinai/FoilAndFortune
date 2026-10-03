import { type BalanceConfig, defaultBalance } from '@/content/balance';
import { type CustomerBalance, customerBalance } from '@/content/balance/customers';
import type { Preference } from '@/content/schema/customers';
import type { Command, CommandResult } from '../../commands';
import type { SimContext } from '../../context';
import { dispatch, tick } from '../../engine';
import type { DomainEvent, DomainEventOf, DomainEventType } from '../../events';
import type { CustomerAgent, FixtureSlot, GameState } from '../../state/types';
import { newTestGame, testContext } from '../../testing';
import { spawnCustomerNow } from './index';

/**
 * Test kit for customer scenarios (not imported by production code). Commands and ticks apply in
 * place to a plain state, which is fast enough to play whole days tick by tick.
 */

/** The balance with literal `as const` types widened, so tests can try other values. */
type Widen<T> = T extends number
  ? number
  : T extends object
    ? { readonly [K in keyof T]: Widen<T[K]> }
    : T;
export type CustomerTunables = Widen<CustomerBalance>;

export const BOOSTER = 'gk.emberdawn.booster';
export const BLISTER = 'gk.emberdawn.blister';
export const STARTER = 'gk.emberdawn.starter-ember';
export const KID = 'arch.kid';
export const CASUAL = 'arch.casual';

export const wantBooster: Preference = { kind: 'sealed', productKind: 'booster', weight: 50 };

export interface Harness {
  state: GameState;
  ctx: SimContext;
  events: DomainEvent[];
  run(command: Command): CommandResult;
  /** Runs up to `count` ticks, stopping early if the shop closes. */
  tick(count?: number): void;
  /** Ticks until `done()` holds (checked before each tick). Returns whether it did. */
  tickUntil(done: () => boolean, maxTicks?: number): boolean;
  of<T extends DomainEventType>(type: T): DomainEventOf<T>[];
  agent(uid: number): CustomerAgent | undefined;
  slot(fixtureUid: string, index: number): FixtureSlot;
}

export function harness(
  state: GameState = newTestGame(),
  customers: Partial<CustomerTunables> = {},
): Harness {
  const events: DomainEvent[] = [];
  const balance: BalanceConfig = {
    ...defaultBalance,
    customers: { ...customerBalance, ...customers } as unknown as BalanceConfig['customers'],
  };
  const ctx: SimContext = { ...testContext(), balance, emit: (event) => events.push(event) };
  const h: Harness = {
    state,
    ctx,
    events,
    run: (command) => dispatch(state, command, ctx),
    tick: (count = 1) => {
      for (let i = 0; i < count && state.clock.phase === 'open'; i++) tick(state, ctx);
    },
    tickUntil: (done, maxTicks = 700) => {
      for (let i = 0; i < maxTicks; i++) {
        if (done()) return true;
        if (state.clock.phase !== 'open') return false;
        tick(state, ctx);
      }
      return done();
    },
    of: <T extends DomainEventType>(type: T) =>
      events.filter((event): event is DomainEventOf<T> => event.type === type),
    agent: (uid) => state.customers.active.find((agent) => agent.uid === uid),
    slot: (fixtureUid, index) => {
      const slot = state.shop.fixtures.find((f) => f.uid === fixtureUid)?.slots[index];
      if (!slot) throw new Error(`no slot ${fixtureUid}#${index}`);
      return slot;
    },
  };
  return h;
}

/** The starting sealed stock on the shelves: boosters ×2 slots, blisters, starter decks. */
export function stockShelves(h: Harness): void {
  const fills: [string, number, string][] = [
    ['shelf-a', 0, BOOSTER],
    ['shelf-a', 1, BOOSTER],
    ['shelf-a', 2, BLISTER],
    ['shelf-b', 0, STARTER],
  ];
  for (const [fixtureUid, slot, productId] of fills) {
    const result = h.run({ type: 'stock/fillSlot', fixtureUid, slot, productId });
    if (!result.ok) throw new Error(`fill ${fixtureUid}#${slot} failed: ${result.code}`);
  }
}

/** Opens the shop with random arrivals switched off, so the test controls who comes in. */
export function openQuiet(h: Harness): void {
  const result = h.run({ type: 'time/openShop' });
  if (!result.ok) throw new Error(`open failed: ${result.code}`);
  h.state.customers.nextArrivalMinute = null;
}

/**
 * Spawns a customer with a fixed want list and a comfortable budget. With knowledge 1 and
 * `buyProbabilityInside: 1`, anyone offered a price ≤ 0.8 × value buys for sure (docs/02 §5.3).
 */
export function spawnShopper(
  h: Harness,
  wants: Preference[] = [wantBooster],
  archetypeId = CASUAL,
): CustomerAgent {
  const agent = spawnCustomerNow(h.state, h.ctx, archetypeId);
  if (!agent) throw new Error('spawn failed');
  agent.wants = wants.map((want) => ({ ...want }));
  agent.budgetCents = 10_000;
  agent.knowledge = 1;
  return agent;
}

/** Balance for deterministic buyers: certain purchases at a steal, and focused browsing. */
export const certainBuyers: Partial<CustomerTunables> = {
  buyProbabilityInside: 1,
  browseIdleInterest: 0,
  fixturesPerVisit: [1, 1],
};

/** Units per item (product id or card key) in storage, on fixtures and in unpaid baskets. */
export function unitsOnHand(state: GameState): Map<string, number> {
  const units = new Map<string, number>();
  const add = (key: string | undefined, qty: number) => {
    if (key && qty !== 0) units.set(key, (units.get(key) ?? 0) + qty);
  };
  for (const [productId, lots] of Object.entries(state.inventory.sealed)) {
    for (const lot of lots) add(productId, lot.qty);
  }
  for (const [key, count] of Object.entries(state.inventory.cardStacks)) add(key, count);
  for (const fixture of state.shop.fixtures) {
    for (const slot of fixture.slots) add(slot.cardKey ?? slot.productId, slot.qty);
  }
  for (const agent of state.customers.active) {
    // A basket on the way out has been paid for: those units count as sold.
    if (agent.activity.kind === 'leave') continue;
    for (const item of agent.basket) add(item.cardKey ?? item.productId, item.qty);
  }
  return units;
}

/** Units sold per item, from `sale/completed` events. */
export function unitsSold(events: readonly DomainEvent[]): Map<string, number> {
  const sold = new Map<string, number>();
  for (const event of events) {
    if (event.type !== 'sale/completed') continue;
    for (const item of event.items) {
      const key = item.cardKey ?? item.productId;
      if (key) sold.set(key, (sold.get(key) ?? 0) + item.qty);
    }
  }
  return sold;
}
