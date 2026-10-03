/** Progression constants (docs/02 §9). */
export const progressionBalance = {
  levelCap: 50,
  /** XP to go from level L to L+1 = round(80 · L^1.55). */
  xpCurveBase: 80,
  xpCurveExponent: 1.55,
  /** XP per revenue dollar = 1 · f(L), with f(L) = 1 / (1 + 0.08 L) (balance-sim tuned, docs/02 §9). */
  xpPerRevenueDollar: 1,
  xpRevenueLevelFalloff: 0.08,
  /** Other XP sources (docs/02 §9.1). */
  xpPerSatisfiedCustomer: 1,
  xpPerPackOpened: 2,
  xpPerNewCard: 1,
  xpPerPull: { holoRare: 3, ultraRare: 10, illustrationRare: 15, secretRare: 30, mythicRare: 100 },
} as const;

/** XP for a sale: revenue$ × 1 × f(L), f(L) = 1 / (1 + 0.08 L) (docs/02 §9.1). */
export function xpForRevenue(revenueCents: number, level: number): number {
  const dollarsEarned = revenueCents / 100;
  return (
    (dollarsEarned * progressionBalance.xpPerRevenueDollar) /
    (1 + progressionBalance.xpRevenueLevelFalloff * level)
  );
}

export function xpToNextLevel(level: number): number {
  if (level >= progressionBalance.levelCap) return Number.POSITIVE_INFINITY;
  return Math.round(progressionBalance.xpCurveBase * level ** progressionBalance.xpCurveExponent);
}
