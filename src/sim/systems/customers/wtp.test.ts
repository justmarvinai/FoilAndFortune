import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { casualCollector, kid } from '@/content/customers/archetypes';
import type { ArchetypeDef } from '@/content/schema/customers';
import { createRng, seedStream } from '@/core/rng';
import { newTestGame, testContext } from '../../testing';
import { normalizedAppeal } from './traffic';
import {
  buyProbability,
  decidePurchase,
  drawMaxPrice,
  perceivedValue,
  priceTolerance,
} from './wtp';

const ctx = testContext();
const balance = ctx.balance.customers;
const MSRP = 449; // a booster (docs/02 §10.1)
const appeal = normalizedAppeal(newTestGame(), ctx);

/** Share of customers of an archetype (rep 20, the Nook) who buy at `factor` × MSRP. */
function buyRate(arch: ArchetypeDef, factor: number, seed: number, draws = 20_000): number {
  const rng = createRng(seedStream(seed, 'test'));
  const tolerance = priceTolerance(arch.toleranceBase, 20, appeal, balance);
  let buys = 0;
  for (let i = 0; i < draws; i++) {
    const knowledge = rng.float(arch.knowledge[0], arch.knowledge[1]);
    const input = {
      priceCents: Math.round(MSRP * factor),
      valueCents: MSRP,
      knowledge,
      sensitivity: arch.priceSensitivity,
      tolerance,
    };
    if (decidePurchase(rng, input, balance).buy) buys += 1;
  }
  return buys / draws;
}

describe('willingness to pay (docs/02 §5.3)', () => {
  it('has most customers buying at MSRP and few at 2× MSRP', () => {
    for (const arch of [kid, casualCollector]) {
      const atMsrp = buyRate(arch, 1, 1);
      const double = buyRate(arch, 2, 2);
      expect(atMsrp, arch.id).toBeGreaterThan(0.7);
      expect(double, arch.id).toBeLessThan(0.1);
      // Cheaper always sells better.
      const steal = buyRate(arch, 0.7, 3);
      const pricey = buyRate(arch, 1.25, 4);
      expect(steal).toBeGreaterThan(atMsrp);
      expect(atMsrp).toBeGreaterThan(pricey);
      expect(pricey).toBeGreaterThan(double);
    }
  });

  it('computes τ = τ_base + 0.10 × rep/100 + 0.05 × a', () => {
    expect(priceTolerance(0.1, 50, 0.4, balance)).toBeCloseTo(0.1 + 0.1 * 0.5 + 0.05 * 0.4, 12);
    expect(priceTolerance(0, 0, 0, balance)).toBe(0);
  });

  it('buys with 0.95 up to p_max, then decays by exp(−6 s (p/p_max − 1))', () => {
    expect(buyProbability(100, 100, 1, balance)).toBe(0.95);
    expect(buyProbability(50, 100, 1, balance)).toBe(0.95);
    expect(buyProbability(120, 100, 1.1, balance)).toBeCloseTo(0.95 * Math.exp(-6 * 1.1 * 0.2), 12);
    expect(buyProbability(100, 0, 1, balance)).toBe(0);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 1, max: 100_000 }),
        fc.double({ min: 0.5, max: 2, noNaN: true }),
        (a, b, pMax, s) => {
          const [low, high] = a <= b ? [a, b] : [b, a];
          const pLow = buyProbability(low, pMax, s, balance);
          const pHigh = buyProbability(high, pMax, s, balance);
          expect(pHigh).toBeLessThanOrEqual(pLow);
          expect(pLow).toBeLessThanOrEqual(0.95);
          expect(pHigh).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('lets experts see the true value, while novices misjudge it within the clip', () => {
    expect(perceivedValue(1000, 1, 0.5)).toBe(1000);
    expect(perceivedValue(1000, 0, 0.5)).toBe(1500);
    const rng = createRng(seedStream(9, 'test'));
    const { desire, perceivedValueClip: clip } = balance;
    for (let i = 0; i < 5000; i++) {
      const pMax = drawMaxPrice(rng, { valueCents: 1000, knowledge: 0, tolerance: 0.1 }, balance);
      expect(pMax).toBeGreaterThanOrEqual(1000 * (1 - clip) * 1.1 * desire[0] - 1e-9);
      expect(pMax).toBeLessThanOrEqual(1000 * (1 + clip) * 1.1 * desire[1] + 1e-9);
    }
  });
});
