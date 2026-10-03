import type { ArchetypeDef } from '@/content/schema/customers';
import { weekdayIndex } from '@/core/calendar';
import { clamp } from '@/core/math';
import type { Rng } from '@/core/rng';
import type { SimContext } from '../../context';
import { reputationScore, reputationStars } from '../../selectors';
import type { GameState } from '../../state/types';

/**
 * Customer traffic (docs/02 §5.1): a non-homogeneous Poisson process with hourly rate
 * λ(h) = B_tier × R(rep) × (1 + 0.5a) × W(weekday) × H(hour).
 *
 * Arrivals are counted per game-minute tick: everyone who arrives in the minute (m − 1, m] walks
 * in on tick m, so the count at tick m is Poisson(μ_m) with μ_m = λ(hour) / 60. The next tick
 * with an arrival is the first where the running Σμ passes an Exp(1) draw, which keeps
 * `nextArrivalMinute` an exact, integer game-minute.
 */

type TrafficContext = Pick<SimContext, 'content' | 'balance'>;

/** Σ fixture appeal of the placed fixtures, decor included (docs/02 §4.4). */
export function shopAppeal(state: GameState, ctx: TrafficContext): number {
  let total = 0;
  for (const fixture of state.shop.fixtures) {
    total += ctx.content.fixtures.get(fixture.fixtureId)?.appeal ?? 0;
  }
  return total;
}

/** Normalized appeal a = 1 − e^(−appeal / scale_tier), in [0, 1) (docs/02 §4.4). */
export function normalizedAppeal(state: GameState, ctx: TrafficContext): number {
  const scales = ctx.balance.customers.appealScaleByTier;
  const scale = scales[state.shop.tier - 1] ?? scales[scales.length - 1] ?? 1;
  return 1 - Math.exp(-Math.max(0, shopAppeal(state, ctx)) / scale);
}

/** R(rep) = base + scale × (rep / 100)^exponent (docs/02 §5.1). */
export function repTrafficFactor(rep: number, ctx: Pick<SimContext, 'balance'>): number {
  const { base, scale, exponent } = ctx.balance.customers.repFactor;
  return base + scale * (clamp(rep, 0, 100) / 100) ** exponent;
}

/** H(hour): the time-of-day curve (docs/02 §5.1), 0 outside business hours. */
export function hourTrafficFactor(hour: number, ctx: Pick<SimContext, 'balance'>): number {
  for (const band of ctx.balance.customers.hourFactor) {
    if (hour >= band.fromHour && hour < band.toHour) return band.factor;
  }
  return 0;
}

/** λ(h): expected customers during clock hour `hour` of today (docs/02 §5.1). */
export function arrivalsPerHour(state: GameState, ctx: TrafficContext, hour: number): number {
  const balance = ctx.balance.customers;
  const tier = ctx.balance.shopTiers.find((entry) => entry.tier === state.shop.tier);
  const hourFactor = hourTrafficFactor(hour, ctx);
  if (!tier || hourFactor === 0) return 0;
  const weekday = balance.weekdayFactor[weekdayIndex(state.clock.day)] ?? 1;
  const appeal = 1 + balance.appealTrafficBonus * normalizedAppeal(state, ctx);
  return (
    tier.baseTraffic * repTrafficFactor(reputationScore(state), ctx) * appeal * weekday * hourFactor
  );
}

/** Arrivals in the minute ending at tick `minute` belong to clock hour ⌊(minute − 1) / 60⌋. */
export function hourOfTick(minute: number): number {
  return Math.floor((minute - 1) / 60);
}

/** Last tick at which a new customer may walk in (docs/02 §5.1 latest arrival). */
export function lastArrivalMinute(ctx: Pick<SimContext, 'balance'>): number {
  return ctx.balance.time.closeMinute - ctx.balance.customers.lastArrivalBeforeCloseMinutes;
}

/** Day 1's scripted first arrival: `firstCustomerDelayMinutes` after opening. */
export function firstCustomerMinute(ctx: Pick<SimContext, 'balance'>): number {
  const open = ctx.balance.time.openMinute;
  return Math.max(open + 1, open + ctx.balance.customers.firstCustomerDelayMinutes);
}

/** Expected arrivals Λ over the ticks (afterMinute, last arrival], the Poisson mean. */
export function expectedArrivals(
  state: GameState,
  ctx: TrafficContext,
  afterMinute: number,
): number {
  let total = 0;
  for (let minute = afterMinute + 1; minute <= lastArrivalMinute(ctx); minute++) {
    total += arrivalsPerHour(state, ctx, hourOfTick(minute)) / 60;
  }
  return total;
}

/** Expected arrivals for a whole day opened at the usual time, Day 1's scripted first included. */
export function expectedDailyArrivals(state: GameState, ctx: TrafficContext): number {
  if (state.clock.day === 1) {
    const first = firstCustomerMinute(ctx);
    return first <= lastArrivalMinute(ctx) ? 1 + expectedArrivals(state, ctx, first) : 0;
  }
  return expectedArrivals(state, ctx, ctx.balance.time.openMinute);
}

/**
 * The next tick after `afterMinute` with at least one arrival, or null when none comes before
 * the cutoff. Walks hour by hour: μ is constant within an hour (docs/02 §5.1).
 */
export function drawNextArrival(
  state: GameState,
  ctx: TrafficContext,
  rng: Rng,
  afterMinute: number,
): number | null {
  const last = lastArrivalMinute(ctx);
  let threshold = rng.exponential(1);
  let minute = afterMinute + 1;
  while (minute <= last) {
    const hour = hourOfTick(minute);
    const hourEnd = Math.min((hour + 1) * 60, last);
    const perMinute = arrivalsPerHour(state, ctx, hour) / 60;
    const span = hourEnd - minute + 1;
    if (perMinute > 0) {
      const needed = Math.max(1, Math.ceil(threshold / perMinute));
      if (needed <= span) return minute + needed - 1;
      threshold -= perMinute * span;
    }
    minute = hourEnd + 1;
  }
  return null;
}

/** The first arrival of today, scheduled when the sign flips to OPEN. */
export function firstArrival(state: GameState, ctx: TrafficContext, rng: Rng): number | null {
  if (state.clock.day === 1) {
    const first = firstCustomerMinute(ctx);
    return first <= lastArrivalMinute(ctx) ? first : null;
  }
  return drawNextArrival(state, ctx, rng, ctx.balance.time.openMinute);
}

/** Zero-truncated Poisson(μ) by inversion: how many walk in on a tick known to have arrivals. */
export function poissonAtLeastOne(rng: Rng, mean: number): number {
  if (!(mean > 0) || !Number.isFinite(mean)) return 1;
  const u = rng.next() * -Math.expm1(-mean); // uniform on [0, P(N ≥ 1))
  let k = 1;
  let pk = mean * Math.exp(-mean);
  let cdf = pk;
  while (u >= cdf && k < 1000) {
    k += 1;
    pk *= mean / k;
    cdf += pk;
  }
  return k;
}

/**
 * How many customers walk in on the scheduled arrival tick `due` (≥ 1). Day 1's scripted first
 * customer comes alone.
 */
export function arrivalsDue(state: GameState, ctx: TrafficContext, rng: Rng, due: number): number {
  if (state.clock.day === 1 && due === firstCustomerMinute(ctx)) return 1;
  return poissonAtLeastOne(rng, arrivalsPerHour(state, ctx, hourOfTick(due)) / 60);
}

/** Archetypes allowed in today: their reputation gate is met (docs/02 §5.2, §9.3). */
export function eligibleArchetypes(state: GameState, ctx: TrafficContext): ArchetypeDef[] {
  const stars = reputationStars(reputationScore(state));
  return [...ctx.content.archetypes.values()].filter((arch) => arch.minRepStars <= stars);
}

/** Picks the next visitor's archetype by base mix weight (docs/02 §5.2). */
export function pickArchetype(
  state: GameState,
  ctx: TrafficContext,
  rng: Rng,
): ArchetypeDef | null {
  const eligible = eligibleArchetypes(state, ctx);
  if (eligible.length === 0) return null;
  return rng.weighted(eligible.map((arch) => ({ value: arch, weight: arch.mixWeight })));
}
