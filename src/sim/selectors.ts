import { defaultBalance } from '@/content/balance';
import { xpToNextLevel } from '@/content/balance/progression';
import { reputationSubs } from '@/content/balance/reputation';
import { dayToDate, type GameDate } from '@/core/calendar';
import { clamp, roundHalf } from '@/core/math';
import type { Cents } from '@/core/money';
import type { GameState } from './state/types';
import { weeklyRent } from './systems/finance';

/** Pure derived values. Safe to call from React selectors (they don't allocate much). */

export function reputationScore(state: GameState): number {
  const { weights } = defaultBalance.reputation;
  let score = 0;
  for (const sub of reputationSubs) score += weights[sub] * state.reputation.sub[sub];
  return score;
}

/** Stars shown in the HUD: round½(rep / 20), 0–5 (docs/02 §13). */
export function reputationStars(score: number): number {
  return clamp(roundHalf(score / 20), 0, 5);
}

export function gameDate(state: GameState): GameDate {
  return dayToDate(state.clock.day);
}

export function xpProgress(state: GameState): {
  level: number;
  xp: number;
  needed: number;
  ratio: number;
} {
  const needed = xpToNextLevel(state.progression.level);
  const ratio = Number.isFinite(needed) ? clamp(state.progression.xp / needed, 0, 1) : 1;
  return { level: state.progression.level, xp: state.progression.xp, needed, ratio };
}

export function sealedQuantity(state: GameState, productId: string): number {
  let total = 0;
  for (const lot of state.inventory.sealed[productId] ?? []) total += lot.qty;
  return total;
}

/** This week's rent, charged on Sunday night (docs/02 §2–3). */
export function weeklyRentDue(state: GameState): Cents {
  return weeklyRent(state, { balance: defaultBalance });
}
