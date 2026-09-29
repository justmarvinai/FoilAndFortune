/** Progression constants (docs/02 §9). */
export const progressionBalance = {
  levelCap: 50,
  /** XP to go from level L to L+1 = round(80 · L^1.55). */
  xpCurveBase: 80,
  xpCurveExponent: 1.55,
  /** XP per revenue dollar = 0.5 · f(L), with f(L) = 1 / (1 + 0.08 L). */
  xpPerRevenueDollar: 0.5,
  xpRevenueLevelFalloff: 0.08,
} as const;

export function xpToNextLevel(level: number): number {
  if (level >= progressionBalance.levelCap) return Number.POSITIVE_INFINITY;
  return Math.round(progressionBalance.xpCurveBase * level ** progressionBalance.xpCurveExponent);
}
