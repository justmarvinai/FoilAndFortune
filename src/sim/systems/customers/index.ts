import { createRng, type Rng, type RngState } from '@/core/rng';
import { type CommandResult, fail, ok } from '../../commands';
import type { SimContext } from '../../context';
import type { CustomerAgent, GameState } from '../../state/types';
import {
  advanceLane,
  type CustomerTick,
  checkout,
  closeUp,
  customerAtPaySpot,
  findAgent,
  spawnCustomer,
  updateAgent,
} from './agents';
import { arrivalsDue, drawNextArrival, firstArrival, pickArchetype } from './traffic';
import { buildShopWorld } from './world';

/**
 * Customer agents (docs/01 §10, docs/02 §5, docs/06 §5.6): arrivals, browsing, buying at fixed
 * prices, the register lane and manual checkout.
 *
 * Contract with the engine (keep these signatures):
 * - `onShopOpened` runs when the sign flips to OPEN (schedule today's first arrival).
 * - `tickCustomers` runs once per game-minute while open, after the clock.
 * - `checkoutCustomer` rings up the customer at the pay spot (or `uid`).
 * - `onShopClosed` runs at closing, before the books close (wrap up whoever is still inside).
 *
 * All randomness comes from the `customers` stream in state (docs/06 §5.4).
 */

export { customerAtPaySpot } from './agents';

/** Runs `fn` with the customers RNG stream and writes the advanced stream back to state. */
function withCustomerRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const stream = [...state.rng.customers] as RngState;
  const result = fn(createRng(stream));
  if (stream.some((word, i) => word !== state.rng.customers[i])) state.rng.customers = stream;
  return result;
}

function customerTick(state: GameState, ctx: SimContext, rng: Rng): CustomerTick | null {
  const world = buildShopWorld(state, ctx);
  return world ? { state, ctx, rng, now: state.clock.minute, world } : null;
}

export function onShopOpened(state: GameState, ctx: SimContext): void {
  state.customers.active = [];
  state.customers.lane = [];
  state.customers.nextArrivalMinute = buildShopWorld(state, ctx)
    ? withCustomerRng(state, (rng) => firstArrival(state, ctx, rng))
    : null;
}

/** Everyone due this tick walks in from the street; then the next arrival is drawn. */
function spawnArrivals(t: CustomerTick): void {
  const { customers } = t.state;
  const due = customers.nextArrivalMinute;
  if (due === null || due > t.now) return;
  const count = arrivalsDue(t.state, t.ctx, t.rng, due);
  for (let i = 0; i < count; i++) {
    const archetype = pickArchetype(t.state, t.ctx, t.rng);
    if (archetype) spawnCustomer(t, archetype);
  }
  customers.nextArrivalMinute = drawNextArrival(t.state, t.ctx, t.rng, Math.max(due, t.now));
}

export function tickCustomers(state: GameState, ctx: SimContext): void {
  const { customers } = state;
  const due = customers.nextArrivalMinute;
  if (customers.active.length === 0 && (due === null || due > state.clock.minute)) return;
  withCustomerRng(state, (rng) => {
    const t = customerTick(state, ctx, rng);
    if (!t) return;
    spawnArrivals(t);
    const gone: number[] = [];
    for (const uid of customers.active.map((agent) => agent.uid)) {
      const agent = findAgent(state, uid);
      if (agent && !updateAgent(t, agent)) gone.push(uid);
    }
    if (gone.length > 0) {
      customers.active = customers.active.filter((agent) => !gone.includes(agent.uid));
      customers.lane = customers.lane.filter((uid) => !gone.includes(uid));
    }
    advanceLane(t);
  });
}

/**
 * Manual checkout (docs/01 §11.1): only the customer standing at the pay spot can be rung up;
 * a given `uid` must be that customer.
 */
export function checkoutCustomer(
  state: GameState,
  ctx: SimContext,
  uid: number | undefined,
): CommandResult {
  const agent: CustomerAgent | null = customerAtPaySpot(state);
  if (!agent || (uid !== undefined && uid !== agent.uid)) return fail('NO_CUSTOMER');
  const done = withCustomerRng(state, (rng) => {
    const t = customerTick(state, ctx, rng);
    if (!t) return false;
    checkout(t, agent);
    return true;
  });
  return done ? ok : fail('NO_CUSTOMER');
}

/**
 * Debug tools and tests (docs/06 §19 "spawn a customer by archetype"): a customer appears on the
 * street corner right now. Returns the new agent, or null when the shop isn't open.
 */
export function spawnCustomerNow(
  state: GameState,
  ctx: SimContext,
  archetypeId: string,
): CustomerAgent | null {
  const archetype = ctx.content.archetypes.get(archetypeId);
  if (state.clock.phase !== 'open' || !archetype) return null;
  return withCustomerRng(state, (rng) => {
    const t = customerTick(state, ctx, rng);
    return t ? spawnCustomer(t, archetype) : null;
  });
}

export function onShopClosed(state: GameState, ctx: SimContext): void {
  withCustomerRng(state, (rng) => {
    const t = customerTick(state, ctx, rng);
    if (t) closeUp(t);
  });
  state.customers.active = [];
  state.customers.lane = [];
  state.customers.nextArrivalMinute = null;
}
