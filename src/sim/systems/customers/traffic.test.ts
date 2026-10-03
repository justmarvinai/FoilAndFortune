import { describe, expect, it } from 'vitest';
import { archetypeCatalog } from '@/content/customers/archetypes';
import { buildRegistry, defaultContentSource } from '@/content/registry';
import type { ArchetypeDef } from '@/content/schema/customers';
import { mean } from '@/core/math';
import { createRng, seedStream } from '@/core/rng';
import type { GameState } from '../../state/types';
import { newTestGame, testContext } from '../../testing';
import { harness } from './testkit';
import {
  arrivalsDue,
  arrivalsPerHour,
  drawNextArrival,
  expectedDailyArrivals,
  firstArrival,
  firstCustomerMinute,
  lastArrivalMinute,
  normalizedAppeal,
  pickArchetype,
  poissonAtLeastOne,
  repTrafficFactor,
  shopAppeal,
} from './traffic';

const ctx = testContext();
const { time } = ctx.balance;

/** Today's arrival ticks, drawn exactly as the engine does (docs/02 §5.1). */
function arrivalTicks(state: GameState, seed: number): number[] {
  const rng = createRng(seedStream(seed, 'customers'));
  const ticks: number[] = [];
  for (let due = firstArrival(state, ctx, rng); due !== null; ) {
    const count = arrivalsDue(state, ctx, rng, due);
    for (let i = 0; i < count; i++) ticks.push(due);
    due = drawNextArrival(state, ctx, rng, due);
  }
  return ticks;
}

function gameOnDay(day: number): GameState {
  const game = newTestGame();
  game.clock.day = day;
  return game;
}

function dailyCounts(state: GameState, runs: number): number[] {
  return Array.from({ length: runs }, (_, seed) => arrivalTicks(state, seed + 1).length);
}

describe('traffic rate λ(h) (docs/02 §5.1)', () => {
  it('computes B × R(rep) × (1 + 0.5a) × W × H from the Nook on Day 1', () => {
    const game = newTestGame();
    // docs/02 §4.2: two wall shelves (+1 each), the case (+2), the register (+1), plant and poster.
    expect(shopAppeal(game, ctx)).toBe(6);
    const a = 1 - Math.exp(-6 / 15);
    expect(normalizedAppeal(game, ctx)).toBeCloseTo(a, 12);
    const r = 0.6 + 0.8 * 0.2 ** 0.8;
    expect(repTrafficFactor(20, ctx)).toBeCloseTo(r, 12);
    // Day 1 is a Monday (W = 0.85); 15:00–17:00 is the afternoon peak (H = 1.3).
    expect(arrivalsPerHour(game, ctx, 15)).toBeCloseTo(2.5 * r * (1 + 0.5 * a) * 0.85 * 1.3, 12);
    expect(arrivalsPerHour(game, ctx, 9)).toBeCloseTo(2.5 * r * (1 + 0.5 * a) * 0.85 * 0.6, 12);
    expect(arrivalsPerHour(game, ctx, 8)).toBe(0);
    expect(arrivalsPerHour(game, ctx, 19)).toBe(0);
  });

  it('expects about 19–21 customers on Day 1 (the docs/02 §5.1 sanity check)', () => {
    const expected = expectedDailyArrivals(newTestGame(), ctx);
    expect(expected).toBeGreaterThan(18);
    expect(expected).toBeLessThan(22);
  });

  it('draws Poisson daily counts that match λ, weekday by weekday', () => {
    const runs = 500;
    for (const day of [1, 3, 6]) {
      const game = gameOnDay(day);
      const counts = dailyCounts(game, runs);
      const expected = expectedDailyArrivals(game, ctx);
      const m = mean(counts);
      const variance = mean(counts.map((c) => (c - m) ** 2));
      // ±4 standard errors of the mean; a Poisson count's variance equals its mean.
      expect(Math.abs(m - expected), `day ${day}`).toBeLessThan(4 * Math.sqrt(expected / runs));
      expect(variance / expected, `day ${day}`).toBeGreaterThan(0.8);
      expect(variance / expected, `day ${day}`).toBeLessThan(1.2);
    }
  });

  it('brings 1.4 / 0.85 as many customers on a Saturday as on a Monday', () => {
    const saturday = mean(dailyCounts(gameOnDay(6), 400));
    const monday = mean(dailyCounts(gameOnDay(8), 400));
    expect(saturday / monday).toBeGreaterThan((1.4 / 0.85) * 0.92);
    expect(saturday / monday).toBeLessThan((1.4 / 0.85) * 1.08);
  });

  it('brings more customers with a better reputation (R(rep))', () => {
    const famous = gameOnDay(8);
    for (const sub of Object.keys(famous.reputation.sub) as (keyof typeof famous.reputation.sub)[])
      famous.reputation.sub[sub] = 80;
    const ratio = expectedDailyArrivals(famous, ctx) / expectedDailyArrivals(gameOnDay(8), ctx);
    expect(ratio).toBeCloseTo(repTrafficFactor(80, ctx) / repTrafficFactor(20, ctx), 10);
    const counts = mean(dailyCounts(famous, 300)) / mean(dailyCounts(gameOnDay(8), 300));
    expect(counts).toBeGreaterThan(ratio * 0.9);
    expect(counts).toBeLessThan(ratio * 1.1);
  });

  it('follows the time-of-day curve and stops before closing', () => {
    const ticks = Array.from({ length: 300 }, (_, seed) => arrivalTicks(gameOnDay(4), seed + 1));
    const all = ticks.flat();
    expect(Math.min(...all)).toBeGreaterThan(time.openMinute);
    expect(Math.max(...all)).toBeLessThanOrEqual(lastArrivalMinute(ctx));
    expect(lastArrivalMinute(ctx)).toBe(time.closeMinute - 15);
    // 15:00–17:00 (H = 1.3) versus 09:00–11:00 (H = 0.6), both two full hours.
    const inBand = (from: number, to: number) =>
      all.filter((m) => m > from * 60 && m <= to * 60).length;
    const ratio = inBand(15, 17) / inBand(9, 11);
    expect(ratio).toBeGreaterThan((1.3 / 0.6) * 0.88);
    expect(ratio).toBeLessThan((1.3 / 0.6) * 1.12);
  });

  it('keeps several arrivals in one minute possible (zero-truncated Poisson)', () => {
    const rng = createRng(seedStream(3, 'test'));
    const draws = Array.from({ length: 20_000 }, () => poissonAtLeastOne(rng, 1));
    expect(Math.min(...draws)).toBe(1);
    // E[N | N ≥ 1] = μ / (1 − e^−μ).
    expect(mean(draws)).toBeCloseTo(1 / (1 - Math.exp(-1)), 1);
    expect(poissonAtLeastOne(rng, 0)).toBe(1);
  });
});

describe('Day 1 first customer', () => {
  it('walks in exactly firstCustomerDelayMinutes after opening, alone', () => {
    const h = harness();
    expect(h.run({ type: 'time/openShop' }).ok).toBe(true);
    const first = firstCustomerMinute(ctx);
    expect(first).toBe(time.openMinute + ctx.balance.customers.firstCustomerDelayMinutes);
    expect(h.state.customers.nextArrivalMinute).toBe(first);
    h.tick(first - time.openMinute - 1);
    expect(h.of('customer/arrived')).toHaveLength(0);
    h.tick(1);
    expect(h.of('customer/arrived')).toHaveLength(1);
    expect(h.state.customers.active).toHaveLength(1);
    expect(h.state.customers.nextArrivalMinute ?? Number.POSITIVE_INFINITY).toBeGreaterThan(first);
  });

  it('is only scripted on Day 1', () => {
    const later = gameOnDay(2);
    const firsts = Array.from({ length: 200 }, (_, seed) => arrivalTicks(later, seed + 1)[0]);
    expect(new Set(firsts).size).toBeGreaterThan(20);
  });
});

describe('archetype mix (docs/02 §5.2)', () => {
  it('matches the base mix weights', () => {
    const game = newTestGame();
    const rng = createRng(seedStream(5, 'test'));
    const counts = new Map<string, number>();
    const draws = 20_000;
    for (let i = 0; i < draws; i++) {
      const id = pickArchetype(game, ctx, rng)?.id ?? 'none';
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const total = archetypeCatalog.reduce((sum, arch) => sum + arch.mixWeight, 0);
    for (const arch of archetypeCatalog) {
      const share = (counts.get(arch.id) ?? 0) / draws;
      expect(share, arch.id).toBeCloseTo(arch.mixWeight / total, 1);
      expect(Math.abs(share - arch.mixWeight / total), arch.id).toBeLessThan(0.015);
    }
  });

  it('respects reputation gates', () => {
    const gated: ArchetypeDef = { ...archetypeCatalog[0]!, id: 'arch.gated', minRepStars: 2 };
    const content = buildRegistry({
      ...defaultContentSource,
      archetypes: [...archetypeCatalog, gated],
    });
    const gatedCtx = { ...ctx, content };
    const rng = createRng(seedStream(7, 'test'));
    const game = newTestGame(); // rep 20 = 1★
    const picks = Array.from({ length: 2000 }, () => pickArchetype(game, gatedCtx, rng)?.id);
    expect(picks).not.toContain('arch.gated');
    for (const sub of Object.keys(game.reputation.sub) as (keyof typeof game.reputation.sub)[])
      game.reputation.sub[sub] = 45; // 2★
    const later = Array.from({ length: 2000 }, () => pickArchetype(game, gatedCtx, rng)?.id);
    expect(later).toContain('arch.gated');
  });
});
