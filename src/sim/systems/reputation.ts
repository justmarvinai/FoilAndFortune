import { type RepSub, reputationSubs } from '@/content/balance/reputation';
import { clamp } from '@/core/math';
import type { SimContext } from '../context';
import { reputationScore } from '../selectors';
import type { GameState, RepSignalBucket } from '../state/types';

/** Reputation signals and the nightly update (docs/02 §13). */

export function emptySignals(): Record<RepSub, RepSignalBucket> {
  const signals = {} as Record<RepSub, RepSignalBucket>;
  for (const sub of reputationSubs) signals[sub] = { sum: 0, weight: 0, count: 0 };
  return signals;
}

/** Records one visit's signal (−1…+1) for a sub-score. Influence: normal 1, regular 2, … */
export function addRepSignal(state: GameState, sub: RepSub, value: number, weight = 1): void {
  const bucket = state.reputation.signals[sub];
  bucket.sum += clamp(value, -1, 1) * weight;
  bucket.weight += weight;
  bucket.count += 1;
}

/**
 * Night update: Δ_k = G_k × S̄_k × min(1, n_k / 15) × H, with H = 1 − sub/110 for gains and
 * 0.5 + sub/200 for losses, then a 1% daily drift toward the baseline (docs/02 §13).
 */
export function applyDailyReputation(state: GameState, ctx: SimContext): void {
  const before = reputationScore(state);
  const balance = ctx.balance.reputation;
  for (const sub of reputationSubs) {
    const bucket = state.reputation.signals[sub];
    let value = state.reputation.sub[sub];
    if (bucket.weight > 0) {
      const average = bucket.sum / bucket.weight;
      const volume = Math.min(1, bucket.count / balance.fullVolumeSignals);
      const headroom = average >= 0 ? 1 - value / 110 : 0.5 + value / 200;
      value += balance.maxDailyGain[sub] * average * volume * headroom;
    }
    value += (balance.baseline - value) * balance.dailyDecay;
    state.reputation.sub[sub] = clamp(value, 0, 100);
  }
  state.reputation.signals = emptySignals();
  const after = reputationScore(state);
  state.reputation.history.push(Math.round(after * 10) / 10);
  if (state.reputation.history.length > 60) state.reputation.history.shift();
  ctx.emit({ type: 'reputation/changed', before, after });
}
