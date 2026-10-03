import { reputationSubs } from '@/content/balance/reputation';
import type { ArchetypeDef, Preference } from '@/content/schema/customers';
import type { Tile } from '@/content/schema/shop';
import { tileKey } from '@/content/shop/geometry';
import { clamp } from '@/core/math';
import type { Rng } from '@/core/rng';
import type { SimContext } from '../../context';
import {
  entrancePath,
  fixtureAccessTiles,
  tileCenter,
  tilePathPoints,
  walkMinutes,
} from '../../nav';
import { askingPrice, itemMarketValue, priceReaction } from '../../pricing';
import { reputationScore } from '../../selectors';
import type {
  AgentActivity,
  BasketItem,
  BubbleKind,
  CustomerAgent,
  FixtureSlot,
  GameState,
} from '../../state/types';
import { addCardStack, putSealed } from '../inventory';
import { addXp } from '../progression';
import { addRepSignal } from '../reputation';
import { completeSale } from '../sales';
import { takeFromSlot } from '../stock';
import { queuePatience, type VisitOutcome, visitSatisfaction, visitSignals } from './satisfaction';
import { normalizedAppeal } from './traffic';
import { drawWants, fixtureDisplays, inStockAnywhere, referenceValue, slotMatches } from './wants';
import {
  browseFacing,
  doorCrossingMinute,
  exitPath,
  isEntranceWalk,
  laneFacing,
  laneIndexOf,
  pathAvoiding,
  pointTile,
  type ShopWorld,
  type WorldFixture,
} from './world';
import { decidePurchase, priceTolerance } from './wtp';

/**
 * Customer agents (docs/01 §10.3, docs/06 §5.6): the sim owns each customer's plan and timings;
 * the view only animates `activity`, `bubble` and `basket`.
 *
 * Arrive (street) → enter (door bell) → browse 1–3 fixtures by interest → decide per item →
 * queue in the register lane → manual checkout → leave. Every activity starts where the previous
 * one ended, at the tick it begins, so the view can interpolate positions from the sim clock.
 */

/** Everything one step of customer logic needs. */
export interface CustomerTick {
  state: GameState;
  ctx: SimContext;
  rng: Rng;
  /** Current game-minute (the tick being processed). */
  now: number;
  world: ShopWorld;
}

type Reaction = CustomerAgent['reactions'][number];
type Walk = Extract<AgentActivity, { kind: 'walk' }>;

function bumpStat(state: GameState, key: string, by = 1): void {
  state.stats[key] = (state.stats[key] ?? 0) + by;
}

export function findAgent(state: GameState, uid: number): CustomerAgent | undefined {
  return state.customers.active.find((agent) => agent.uid === uid);
}

/** The customer standing at the pay spot, the only one who can be rung up (docs/01 §11.1). */
export function customerAtPaySpot(state: GameState): CustomerAgent | null {
  const uid = state.customers.lane[0];
  const agent = uid === undefined ? undefined : findAgent(state, uid);
  if (agent?.activity.kind !== 'queue' || agent.activity.laneIndex !== 0) return null;
  return agent;
}

// ---------------------------------------------------------------------------------------------
// Positions and bubbles

function lastPoint(path: readonly { x: number; z: number }[]) {
  return path[path.length - 1];
}

/** The tile the agent stands on when its current activity is over. */
function standingTile(t: CustomerTick, agent: CustomerAgent): Tile {
  const activity = agent.activity;
  const point =
    activity.kind === 'walk'
      ? lastPoint(activity.path)
      : activity.kind === 'leave'
        ? activity.path[0]
        : activity.at;
  return point ? pointTile(point) : t.world.nav.doorTile;
}

/** The tile an agent occupies or is heading to; lingering paid customers hold the pay spot. */
function claimedTile(agent: CustomerAgent, now: number): Tile | null {
  const activity = agent.activity;
  switch (activity.kind) {
    case 'walk': {
      const end = lastPoint(activity.path);
      return end && end.x >= 0 ? pointTile(end) : null;
    }
    case 'browse':
    case 'queue':
      return pointTile(activity.at);
    case 'leave': {
      const start = activity.path[0];
      return activity.startMinute > now && start ? pointTile(start) : null;
    }
  }
}

function claimedTiles(t: CustomerTick, exceptUid: number): Set<string> {
  const taken = new Set<string>();
  for (const agent of t.state.customers.active) {
    if (agent.uid === exceptUid) continue;
    const tile = claimedTile(agent, t.now);
    if (tile) taken.add(tileKey(tile));
  }
  return taken;
}

function setBubble(
  t: CustomerTick,
  agent: CustomerAgent,
  kind: BubbleKind,
  durationMinutes?: number,
): void {
  const current = agent.bubble;
  if (durationMinutes === undefined && current?.kind === kind && current.untilMinute === undefined)
    return;
  agent.bubble =
    durationMinutes === undefined
      ? { kind, sinceMinute: t.now }
      : { kind, sinceMinute: t.now, untilMinute: t.now + durationMinutes };
  t.ctx.emit({ type: 'customer/bubble', uid: agent.uid, bubble: kind });
}

function walkAlong(t: CustomerTick, agent: CustomerAgent, tiles: readonly Tile[]): void {
  const path = tilePathPoints(tiles);
  const minutes = walkMinutes(path, t.ctx.balance.customers.walkMetersPerMinute);
  agent.activity = { kind: 'walk', path, startMinute: t.now, endMinute: t.now + minutes };
}

// ---------------------------------------------------------------------------------------------
// Arrive

/** A new customer on the street corner, walking to the door (docs/01 §10.3 "Arrive"). */
export function spawnCustomer(t: CustomerTick, archetype: ArchetypeDef): CustomerAgent {
  const { state, ctx, rng, now } = t;
  const balance = ctx.balance.customers;
  const appeal = normalizedAppeal(state, ctx);
  const modifier = ctx.balance.difficulty[state.meta.difficulty].customerKnowledgeModifier;
  const [budgetMin, budgetMax] = archetype.budgetCents;
  const [knowledgeMin, knowledgeMax] = archetype.knowledge;
  const [patienceMin, patienceMax] = archetype.patienceMinutes;
  const budgetCents = rng.int(Math.min(budgetMin, budgetMax), Math.max(budgetMin, budgetMax));
  const knowledge = clamp(rng.float(knowledgeMin, knowledgeMax) + modifier, 0, 1);
  // docs/02 §4.4: appeal makes people more patient.
  const patienceMinutes =
    rng.float(patienceMin, patienceMax) * (1 + balance.appealPatienceBonus * appeal);
  const wants = drawWants(state, ctx, rng, archetype);
  const lookSeed = Math.floor(rng.next() * 2 ** 31);
  const path = entrancePath(t.world.nav);
  const agent: CustomerAgent = {
    uid: state.customers.nextUid,
    archetypeId: archetype.id,
    lookSeed,
    activity: {
      kind: 'walk',
      path,
      startMinute: now,
      endMinute: now + walkMinutes(path, balance.walkMetersPerMinute),
    },
    bubble: null,
    basket: [],
    budgetCents,
    knowledge,
    patienceMinutes,
    waitedMinutes: 0,
    toBrowse: [],
    wants,
    reactions: [],
    missed: 0,
    satisfaction: 0,
    signals: {},
  };
  state.customers.nextUid += 1;
  state.customers.active.push(agent);
  bumpStat(state, 'customersVisited');
  ctx.emit({ type: 'customer/arrived', uid: agent.uid, archetypeId: archetype.id });
  return agent;
}

// ---------------------------------------------------------------------------------------------
// Browse

/** Interest in a fixture: Σ preference weight of the wants it displays, plus a little for any. */
function interest(t: CustomerTick, agent: CustomerAgent, fixture: WorldFixture): number {
  let weight = t.ctx.balance.customers.browseIdleInterest;
  for (const want of agent.wants) {
    if (fixtureDisplays(t.ctx, fixture.placed, want)) weight += want.weight;
  }
  return weight;
}

/** Picks 1–3 fixtures to browse by interest, without repeats, when they step inside. */
function planBrowse(t: CustomerTick, agent: CustomerAgent): string[] {
  const [min, max] = t.ctx.balance.customers.fixturesPerVisit;
  const pool = t.world.browsable.flatMap((uid) => {
    const fixture = t.world.fixtures.get(uid);
    return fixture ? [{ uid, weight: interest(t, agent, fixture) }] : [];
  });
  const count = Math.min(t.rng.int(min, max), pool.length);
  const plan: string[] = [];
  for (let i = 0; i < count; i++) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    const pick =
      total > 0
        ? t.rng.weighted(pool.map((entry) => ({ value: entry, weight: entry.weight })))
        : t.rng.pick(pool);
    plan.push(pick.uid);
    pool.splice(pool.indexOf(pick), 1);
  }
  return plan;
}

/** Path to the best access tile: free ones first, then the shortest walk. */
function routeToFixture(t: CustomerTick, agent: CustomerAgent, fixture: WorldFixture) {
  const from = standingTile(t, agent);
  const taken = claimedTiles(t, agent.uid);
  let best: Tile[] | null = null;
  let bestFree = false;
  for (const tile of fixtureAccessTiles(t.world.nav, fixture.nav)) {
    if (laneIndexOf(t.world, tile) >= 0) continue;
    const path = pathAvoiding(t.world.nav, from, tile, t.world.lane);
    if (!path) continue;
    const free = !taken.has(tileKey(tile));
    if (!best || (free && !bestFree) || (free === bestFree && path.length < best.length)) {
      best = path;
      bestFree = free;
    }
  }
  return best;
}

/** Walks to the next fixture on the plan, or wraps up the visit when the plan is done. */
function browseNext(t: CustomerTick, agent: CustomerAgent): void {
  while (agent.toBrowse.length > 0) {
    const uid = agent.toBrowse[0];
    const fixture = uid === undefined ? undefined : t.world.fixtures.get(uid);
    const route = fixture ? routeToFixture(t, agent, fixture) : null;
    if (!route) {
      agent.toBrowse.shift();
      continue;
    }
    if (route.length > 1) walkAlong(t, agent, route);
    else startBrowse(t, agent);
    return;
  }
  finishShopping(t, agent);
}

function startBrowse(t: CustomerTick, agent: CustomerAgent): void {
  const uid = agent.toBrowse.shift();
  const fixture = uid === undefined ? undefined : t.world.fixtures.get(uid);
  if (uid === undefined || !fixture) {
    browseNext(t, agent);
    return;
  }
  const tile = standingTile(t, agent);
  const [min, max] = t.ctx.balance.customers.browseMinutes;
  agent.activity = {
    kind: 'browse',
    fixtureUid: uid,
    at: tileCenter(tile),
    facing: browseFacing(fixture, tile),
    startMinute: t.now,
    endMinute: t.now + t.rng.int(min, max),
  };
  setBubble(t, agent, 'search');
}

function basketTotal(agent: CustomerAgent): number {
  let total = 0;
  for (const item of agent.basket) total += item.priceCents * item.qty;
  return total;
}

function addToBasket(agent: CustomerAgent, item: BasketItem): void {
  const same = agent.basket.find(
    (line) =>
      line.fixtureUid === item.fixtureUid &&
      line.slot === item.slot &&
      line.productId === item.productId &&
      line.cardKey === item.cardKey &&
      line.priceCents === item.priceCents &&
      line.costCents === item.costCents,
  );
  if (same) same.qty += item.qty;
  else agent.basket.push(item);
}

/**
 * One customer–item decision (docs/02 §5.3): react to the true price ratio p/V, then buy with
 * P(buy | p) if the budget allows. A bought unit leaves the shelf at once with its cost basis.
 */
function considerItem(
  t: CustomerTick,
  agent: CustomerAgent,
  fixture: WorldFixture,
  slot: FixtureSlot,
  slotIndex: number,
): Reaction | null {
  const { state, ctx } = t;
  const balance = ctx.balance.customers;
  const price = askingPrice(state, ctx, slot);
  const value = referenceValue(ctx, slot);
  if (price === null || value === null || value <= 0) return null;
  const reaction = priceReaction(price, value, balance.reaction);
  agent.reactions.push(reaction);

  const archetype = ctx.content.archetypes.get(agent.archetypeId);
  if (!archetype) return reaction;
  const tolerance = priceTolerance(
    archetype.toleranceBase,
    reputationScore(state),
    normalizedAppeal(state, ctx),
    balance,
  );
  const decision = decidePurchase(
    t.rng,
    {
      priceCents: price,
      valueCents: value,
      knowledge: agent.knowledge,
      sensitivity: archetype.priceSensitivity,
      tolerance,
    },
    balance,
  );
  // docs/02 §5.3: the budget caps the basket.
  if (!decision.buy || price > agent.budgetCents - basketTotal(agent)) return reaction;

  const what = slot.cardKey ? { cardKey: slot.cardKey } : { productId: slot.productId };
  const taken = takeFromSlot(slot, 1);
  if (taken.qty === 0) return reaction;
  addToBasket(agent, {
    fixtureUid: fixture.placed.uid,
    slot: slotIndex,
    ...what,
    qty: taken.qty,
    priceCents: price,
    costCents: taken.costCents,
  });
  ctx.emit({ type: 'stock/changed', fixtureUid: fixture.placed.uid, slot: slotIndex });
  return reaction;
}

/** The bubble worth showing after a browse: the most notable reaction, or the stock-out. */
function notableBubble(reactions: readonly Reaction[], missed: number): BubbleKind | null {
  if (reactions.includes('ripoff')) return 'ripoff';
  if (missed > 0) return 'outOfStock';
  for (const kind of ['steal', 'pricey', 'fair'] as const) {
    if (reactions.includes(kind)) return kind;
  }
  return null;
}

/** Wants nowhere in the shop count as missed (docs/01 §9.3). Returns how many. */
function noteMissing(t: CustomerTick, agent: CustomerAgent): number {
  const remaining: Preference[] = [];
  let missed = 0;
  for (const want of agent.wants) {
    if (inStockAnywhere(t.state, t.ctx, want)) remaining.push(want);
    else missed += 1;
  }
  agent.wants = remaining;
  agent.missed += missed;
  return missed;
}

/** End of a browse: decide per matching item, then move on (docs/02 §5.3). */
function finishBrowse(t: CustomerTick, agent: CustomerAgent, fixtureUid: string): void {
  const fixture = t.world.fixtures.get(fixtureUid);
  const seen: Reaction[] = [];
  if (fixture) {
    const remaining: Preference[] = [];
    for (const want of agent.wants) {
      const candidates: number[] = [];
      fixture.placed.slots.forEach((slot, index) => {
        if (slotMatches(t.ctx, slot, want)) candidates.push(index);
      });
      if (candidates.length === 0) {
        remaining.push(want);
        continue;
      }
      const index = t.rng.pick(candidates);
      const slot = fixture.placed.slots[index];
      const reaction = slot ? considerItem(t, agent, fixture, slot, index) : null;
      if (reaction) seen.push(reaction);
    }
    agent.wants = remaining;
  }
  const missed = noteMissing(t, agent);
  const bubble = notableBubble(seen, missed);
  if (bubble) setBubble(t, agent, bubble, t.ctx.balance.customers.reactionBubbleMinutes);
  agent.satisfaction = visitSatisfaction(agent, 'left', t.ctx.balance.customers);
  browseNext(t, agent);
}

/** The plan is done: pay if holding anything, else walk out. */
function finishShopping(t: CustomerTick, agent: CustomerAgent): void {
  const missed = noteMissing(t, agent);
  if (missed > 0) {
    setBubble(t, agent, 'outOfStock', t.ctx.balance.customers.reactionBubbleMinutes);
  }
  // Anything still wanted was in stock somewhere they didn't look: neither found nor missed.
  agent.wants = [];
  if (agent.basket.length > 0) joinLane(t, agent);
  else {
    conclude(t, agent, 'left');
    startLeave(t, agent, t.now);
  }
}

// ---------------------------------------------------------------------------------------------
// Queue

/** Where a newcomer should stand: behind everyone ahead, on the first free lane tile. */
function joinTarget(t: CustomerTick, agent: CustomerAgent): number {
  const lane = t.state.customers.lane;
  let from = lane.length;
  for (const uid of lane) {
    const ahead = findAgent(t.state, uid);
    const tile = ahead ? claimedTile(ahead, t.now) : null;
    const index = tile ? laneIndexOf(t.world, tile) : -1;
    if (index >= 0) from = Math.max(from, index + 1);
  }
  const taken = claimedTiles(t, agent.uid);
  for (let index = from; index < t.world.lane.length; index++) {
    const tile = t.world.lane[index];
    if (tile && !taken.has(tileKey(tile))) return index;
  }
  return t.world.lane.length - 1;
}

/** Joins the end of the register lane, or gives up when it's full (docs/01 §11.1). */
function joinLane(t: CustomerTick, agent: CustomerAgent): void {
  const lane = t.state.customers.lane;
  if (t.world.lane.length === 0 || lane.length >= t.world.lane.length) {
    loseCustomer(t, agent, 'gaveUp');
    return;
  }
  const index = joinTarget(t, agent);
  const target = t.world.lane[index];
  const others = t.world.lane.filter((_, i) => i !== index);
  const route = target ? pathAvoiding(t.world.nav, standingTile(t, agent), target, others) : null;
  if (!route) {
    loseCustomer(t, agent, 'gaveUp');
    return;
  }
  lane.push(agent.uid);
  t.ctx.emit({ type: 'customer/queued', uid: agent.uid });
  if (route.length > 1) walkAlong(t, agent, route);
  else standInLine(t, agent);
}

/** Arrived on a lane tile: stand there, facing the register or the back of the one ahead. */
function standInLine(t: CustomerTick, agent: CustomerAgent): void {
  const tile = standingTile(t, agent);
  const index = laneIndexOf(t.world, tile);
  if (index < 0) {
    loseCustomer(t, agent, 'gaveUp'); // the lane moved under them (never in a fixed layout)
    return;
  }
  // Stepping forward counts as waiting: patience may have run out on the way.
  if (agent.waitedMinutes >= queuePatience(agent, t.ctx.balance.customers)) {
    loseCustomer(t, agent, 'lost');
    return;
  }
  agent.activity = {
    kind: 'queue',
    laneIndex: index,
    at: tileCenter(tile),
    facing: laneFacing(t.world, index),
    sinceMinute: t.now,
  };
  const kind = agent.bubble?.kind;
  if (kind !== 'cart' && kind !== 'waiting') setBubble(t, agent, 'cart');
}

/** One minute in line: patience drains; ⏳ at half, and they walk out at the end. */
function waitInLine(t: CustomerTick, agent: CustomerAgent): void {
  const balance = t.ctx.balance.customers;
  agent.waitedMinutes += 1;
  const patience = queuePatience(agent, balance);
  if (agent.waitedMinutes >= patience) {
    loseCustomer(t, agent, 'lost');
    return;
  }
  if (agent.waitedMinutes >= balance.waitingBubbleAt * patience) setBubble(t, agent, 'waiting');
}

/** A lane walk that starts on a lane tile is someone stepping forward. */
function isLaneStep(t: CustomerTick, walk: Walk): boolean {
  const start = walk.path[0];
  return start !== undefined && laneIndexOf(t.world, pointTile(start)) >= 0;
}

/**
 * When a spot ahead frees up, people in line step forward as far as they can without passing
 * anyone (short walks). The pay spot stays taken while a paid customer lingers there.
 */
export function advanceLane(t: CustomerTick): void {
  const lane = t.state.customers.lane;
  for (let position = 0; position < lane.length; position++) {
    const uid = lane[position];
    const agent = uid === undefined ? undefined : findAgent(t.state, uid);
    if (agent?.activity.kind !== 'queue') continue;
    const at = agent.activity.laneIndex;
    if (at <= position) continue;
    const taken = claimedTiles(t, agent.uid);
    let target = at;
    for (let index = at - 1; index >= position; index--) {
      const tile = t.world.lane[index];
      if (!tile || taken.has(tileKey(tile))) break;
      target = index;
    }
    if (target < at) walkAlong(t, agent, t.world.lane.slice(target, at + 1).reverse());
  }
}

function removeFromLane(state: GameState, uid: number): void {
  const index = state.customers.lane.indexOf(uid);
  if (index >= 0) state.customers.lane.splice(index, 1);
}

// ---------------------------------------------------------------------------------------------
// Leave

/** Returns one basket line to its slot, or to storage if the slot now holds something else. */
function returnItem(t: CustomerTick, item: BasketItem): void {
  const { state, ctx } = t;
  const fixture = state.shop.fixtures.find((f) => f.uid === item.fixtureUid);
  const def = fixture ? ctx.content.fixtures.get(fixture.fixtureId) : undefined;
  const slot = fixture?.slots[item.slot];
  let left = item.qty;
  if (slot && def) {
    if (item.productId && slot.productId === item.productId && !slot.cardKey) {
      const capacity = ctx.content.products.get(item.productId)?.perShelfSlot ?? 0;
      const fit = clamp(capacity - slot.qty, 0, left);
      if (fit > 0) {
        slot.qty += fit;
        slot.costCents += fit * item.costCents;
        left -= fit;
      }
    } else if (
      item.cardKey &&
      def.slots.accepts.kind === 'singles' &&
      slot.qty === 0 &&
      !slot.cardKey &&
      !slot.productId
    ) {
      slot.cardKey = item.cardKey;
      slot.qty = 1;
      slot.costCents = item.costCents;
      // Keep a custom price; a market-matched card goes back to matching the market.
      slot.priceCents =
        item.priceCents === itemMarketValue(ctx, { cardKey: item.cardKey })
          ? undefined
          : item.priceCents;
      left -= 1;
    }
    if (left < item.qty) {
      ctx.emit({ type: 'stock/changed', fixtureUid: item.fixtureUid, slot: item.slot });
    }
  }
  if (left <= 0) return;
  if (item.productId) putSealed(state, item.productId, left, item.costCents, state.clock.day);
  else if (item.cardKey) addCardStack(state, item.cardKey, left);
}

function returnBasket(t: CustomerTick, agent: CustomerAgent): void {
  for (const item of agent.basket) returnItem(t, item);
  agent.basket = [];
}

/** Scores the visit, records its reputation signals and announces the exit (docs/02 §5.4, §13). */
function conclude(t: CustomerTick, agent: CustomerAgent, outcome: VisitOutcome): void {
  const balance = t.ctx.balance.customers;
  agent.satisfaction = visitSatisfaction(agent, outcome, balance);
  agent.signals = visitSignals(agent, outcome, balance);
  for (const sub of reputationSubs) {
    const value = agent.signals[sub];
    if (value !== undefined) addRepSignal(t.state, sub, value);
  }
  t.ctx.emit({
    type: 'customer/left',
    uid: agent.uid,
    satisfaction: agent.satisfaction,
    bought: outcome === 'served',
  });
}

/** Walk out through the door to the street; `startMinute` may lie ahead (lingering). */
function startLeave(t: CustomerTick, agent: CustomerAgent, startMinute: number): void {
  const path = exitPath(t.world, standingTile(t, agent));
  const minutes = walkMinutes(path, t.ctx.balance.customers.walkMetersPerMinute);
  agent.activity = { kind: 'leave', path, startMinute, endMinute: startMinute + minutes };
}

/** Put the items back and walk out angry: patience ran out, or the lane was full. */
function loseCustomer(t: CustomerTick, agent: CustomerAgent, outcome: 'lost' | 'gaveUp'): void {
  returnBasket(t, agent);
  removeFromLane(t.state, agent.uid);
  t.state.dayLog.lost += 1;
  bumpStat(t.state, 'customersLost');
  conclude(t, agent, outcome);
  setBubble(t, agent, 'angry', t.ctx.balance.customers.reactionBubbleMinutes);
  startLeave(t, agent, t.now);
}

/**
 * Rings up a customer (docs/01 §11.1): books the sale, scores the visit, grants the satisfied-
 * customer XP (docs/02 §9.1). The caller decides where they go next.
 */
export function serveCustomer(t: CustomerTick, agent: CustomerAgent): void {
  const { state, ctx } = t;
  const balance = ctx.balance.customers;
  completeSale(state, ctx, agent.uid, agent.basket);
  removeFromLane(state, agent.uid);
  conclude(t, agent, 'served');
  if (agent.satisfaction >= balance.satisfaction.satisfiedAt) {
    addXp(state, ctx, ctx.balance.progression.xpPerSatisfiedCustomer, 'customer');
  }
  if (agent.satisfaction >= balance.satisfaction.delightBubbleAt) {
    setBubble(t, agent, 'delight', balance.reactionBubbleMinutes);
  } else {
    agent.bubble = null;
  }
}

/** Manual checkout: serve, then linger for the scan animation before walking out. */
export function checkout(t: CustomerTick, agent: CustomerAgent): void {
  serveCustomer(t, agent);
  startLeave(t, agent, t.now + t.ctx.balance.customers.checkoutMinutes);
}

/**
 * Closing time (docs/01 §5.3): the owner rings up everyone holding items, line first, then the
 * rest walk out. Their visits are scored like any other.
 */
export function closeUp(t: CustomerTick): void {
  const { customers } = t.state;
  const served = new Set<number>();
  const holding = [
    ...customers.lane.flatMap((uid) => findAgent(t.state, uid) ?? []),
    ...customers.active.filter(
      (agent) =>
        agent.basket.length > 0 &&
        agent.activity.kind !== 'leave' &&
        !customers.lane.includes(agent.uid),
    ),
  ];
  for (const agent of holding) {
    if (agent.basket.length === 0) continue;
    serveCustomer(t, agent);
    served.add(agent.uid);
  }
  // Everyone else walks out with what they experienced so far (nothing, for those still outside).
  for (const agent of customers.active) {
    if (agent.activity.kind !== 'leave' && !served.has(agent.uid)) conclude(t, agent, 'left');
  }
}

// ---------------------------------------------------------------------------------------------
// The per-minute update

/** Advances one agent by one tick. Returns false once the agent has left the scene. */
export function updateAgent(t: CustomerTick, agent: CustomerAgent): boolean {
  const activity = agent.activity;
  switch (activity.kind) {
    case 'walk': {
      if (isEntranceWalk(activity) && doorCrossingMinute(activity) === t.now) {
        t.ctx.emit({ type: 'customer/entered', uid: agent.uid });
      }
      const inLane = t.state.customers.lane.includes(agent.uid);
      if (inLane && isLaneStep(t, activity)) agent.waitedMinutes += 1;
      if (t.now < activity.endMinute) return true;
      if (isEntranceWalk(activity)) {
        agent.toBrowse = planBrowse(t, agent);
        browseNext(t, agent);
      } else if (inLane) standInLine(t, agent);
      else startBrowse(t, agent);
      return true;
    }
    case 'browse':
      if (t.now >= activity.endMinute) finishBrowse(t, agent, activity.fixtureUid);
      return true;
    case 'queue':
      waitInLine(t, agent);
      return true;
    case 'leave':
      return t.now < activity.endMinute;
  }
}
