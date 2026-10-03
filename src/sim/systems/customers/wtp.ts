import type { CustomerBalance } from '@/content/balance/customers';
import { clamp } from '@/core/math';
import type { Rng } from '@/core/rng';

/**
 * Willingness to pay for fixed-price items (docs/02 §5.3):
 *   V̂ = V × (1 + (1 − k) × ε),  ε ~ N(0, σ) clipped to ±clip
 *   τ = τ_base + 0.10 × rep/100 + 0.05 × a
 *   p_max = V̂ × (1 + τ) × desire,  desire ~ U(0.8, 1.3) per customer–item match
 *   P(buy | p) = 0.95 if p ≤ p_max, else 0.95 × exp(−6 × s × (p/p_max − 1))
 */

type WtpBalance = Pick<
  CustomerBalance,
  | 'perceivedValueSigma'
  | 'perceivedValueClip'
  | 'desire'
  | 'toleranceRepBonus'
  | 'appealToleranceBonus'
  | 'buyProbabilityInside'
  | 'buyProbabilityDecay'
>;

export interface PurchaseInput {
  priceCents: number;
  /** V: MSRP for in-print sealed, market value for singles. */
  valueCents: number;
  /** k, 0–1. */
  knowledge: number;
  /** s. */
  sensitivity: number;
  /** τ. */
  tolerance: number;
}

/** τ = τ_base + 0.10 × rep/100 + 0.05 × a (docs/02 §5.3, §4.4). */
export function priceTolerance(
  toleranceBase: number,
  rep: number,
  appeal: number,
  balance: WtpBalance,
): number {
  return (
    toleranceBase + balance.toleranceRepBonus * (rep / 100) + balance.appealToleranceBonus * appeal
  );
}

/** V̂ = V × (1 + (1 − k) × ε) with ε already clipped. */
export function perceivedValue(valueCents: number, knowledge: number, epsilon: number): number {
  return valueCents * (1 + (1 - clamp(knowledge, 0, 1)) * epsilon);
}

/** P(buy | p) (docs/02 §5.3). */
export function buyProbability(
  priceCents: number,
  maxPriceCents: number,
  sensitivity: number,
  balance: WtpBalance,
): number {
  if (!(maxPriceCents > 0)) return 0;
  if (priceCents <= maxPriceCents) return balance.buyProbabilityInside;
  const over = priceCents / maxPriceCents - 1;
  return balance.buyProbabilityInside * Math.exp(-balance.buyProbabilityDecay * sensitivity * over);
}

/** Draws ε and desire for one customer–item match and returns p_max in cents. */
export function drawMaxPrice(
  rng: Rng,
  input: Pick<PurchaseInput, 'valueCents' | 'knowledge' | 'tolerance'>,
  balance: WtpBalance,
): number {
  const clip = balance.perceivedValueClip;
  const epsilon = clamp(rng.gauss(0, balance.perceivedValueSigma), -clip, clip);
  const desire = rng.float(balance.desire[0], balance.desire[1]);
  return (
    perceivedValue(input.valueCents, input.knowledge, epsilon) * (1 + input.tolerance) * desire
  );
}

/** One customer–item decision: would they buy at this price? (The budget is checked apart.) */
export function decidePurchase(
  rng: Rng,
  input: PurchaseInput,
  balance: WtpBalance,
): { buy: boolean; maxPriceCents: number; probability: number } {
  const maxPriceCents = drawMaxPrice(rng, input, balance);
  const probability = buyProbability(input.priceCents, maxPriceCents, input.sensitivity, balance);
  return { buy: rng.chance(probability), maxPriceCents, probability };
}
