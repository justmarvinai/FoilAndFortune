import { describe, expect, it } from 'vitest';
import { type BalanceConfig, defaultBalance } from '@/content/balance';
import { createRng, seedStream } from '@/core/rng';
import { itemMarketValue } from '../pricing';
import { packExpectedValue } from './ev';
import { generatePack, packRules } from './generate';
import { pulledCardKey } from './misprints';
import { setCardPool } from './pool';
import { ALPHA, alphaCards, packTestContext, sparseCards, testPackConfig } from './testing';

const MSRP = 449;
const { packs } = defaultBalance;

function balanceWith(overrides: Partial<BalanceConfig['packs']>): BalanceConfig {
  return { ...defaultBalance, packs: { ...packs, ...overrides } };
}
const noGodPacks = { godPack: { ...packs.godPack, chance: 0 } };
const noMisprints = { misprint: { ...packs.misprint, chancePerCard: 0 } };

describe('packExpectedValue (docs/02 §11.3)', () => {
  it('lands the market EV of a typical modern set within 0.85–1.10 × MSRP', () => {
    const ev = packExpectedValue(testPackConfig, alphaCards, defaultBalance);
    expect(ev / MSRP).toBeGreaterThanOrEqual(0.85);
    expect(ev / MSRP).toBeLessThanOrEqual(1.1);
  });

  it("reproduces the docs' hand check with typical values: ≈ $4.57 = 1.02 × MSRP", () => {
    // C 5 × 10 + U 3 × 20 + reverse (0.6 × 30 + 0.3 × 50 + 0.1 × 120)
    // + rare slot (0.625 × 60 + 0.25 × 220 + 0.08 × 800 + 0.03 × 1400 + 0.012 × 3600 + 0.003 × 20000)
    const handCheck = 50 + 60 + 45 + 301.7;
    const ev = packExpectedValue(
      testPackConfig,
      alphaCards,
      balanceWith({ ...noGodPacks, ...noMisprints }),
    );
    expect(ev).toBeCloseTo(handCheck, 6);
    expect(ev / MSRP).toBeCloseTo(1.017, 3);
  });

  it('adds god packs: (1 − p) × normal + p × 10 god-pack cards', () => {
    const normal = 456.7;
    const godPack = 10 * (0.75 * 1400 + 0.2 * 3600 + 0.05 * 20000);
    const ev = packExpectedValue(testPackConfig, alphaCards, balanceWith(noMisprints));
    expect(ev).toBeCloseTo((1 - 1 / 2000) * normal + godPack / 2000, 6);
  });

  it('prices misprints in: every card misprinted multiplies by the mean premium of its finish', () => {
    const all = { misprint: { ...packs.misprint, chancePerCard: 1 } };
    const ev = packExpectedValue(
      testPackConfig,
      alphaCards,
      balanceWith({ ...noGodPacks, ...all }),
    );
    // Non-foil cards can't lose their foil: 45 × 3 + 25 × 4 + 14 × 2 + 1 × 25 over 85.
    const plainPremium = (45 * 3 + 25 * 4 + 14 * 2 + 1 * 25) / 85;
    const foilPremium = (45 * 3 + 25 * 4 + 15 * 5 + 14 * 2 + 1 * 25) / 100;
    const plainValue = 50 + 60 + 0.625 * 60;
    const foilValue = 45 + (0.25 * 220 + 0.08 * 800 + 0.03 * 1400 + 0.012 * 3600 + 0.003 * 20000);
    expect(ev).toBeCloseTo(plainValue * plainPremium + foilValue * foilPremium, 6);
  });

  it('follows the rarity fallback of the generator', () => {
    // Sparse set (C, U, HR, SR): the rare slot's Rare → Uncommon, UR/IR → Holo, MR → SR.
    const ev = packExpectedValue(
      testPackConfig,
      sparseCards,
      balanceWith({ ...noGodPacks, ...noMisprints }),
    );
    const reverse = 0.6 * 30 + 0.4 * 50;
    const rareSlot = 0.625 * 20 + 0.36 * 220 + 0.015 * 3600;
    expect(ev).toBeCloseTo(50 + 60 + reverse + rareSlot, 6);
    expect(packExpectedValue(testPackConfig, [], defaultBalance)).toBe(0);
  });

  it('agrees with the mean value of 20,000 generated packs', () => {
    const ctx = packTestContext();
    const balance = balanceWith(noGodPacks);
    const rules = packRules(balance);
    const pool = setCardPool(alphaCards, ALPHA);
    const rng = createRng(seedStream(41, 'packs'));
    const n = 20_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      let value = 0;
      for (const card of generatePack(testPackConfig, pool, rng, rules).cards) {
        value += itemMarketValue(ctx, { cardKey: pulledCardKey(card) }) ?? 0;
      }
      sum += value;
      sumSq += value * value;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    const ev = packExpectedValue(testPackConfig, alphaCards, balance);
    expect(Math.abs(mean - ev)).toBeLessThanOrEqual((4 * sd) / Math.sqrt(n));
  });
});
