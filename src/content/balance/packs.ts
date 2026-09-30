import type { Rarity } from '@/content/schema/common';

/** Pack-opening rules that sit on top of the per-set pack configs (docs/02 §11). */
export const packBalance = {
  /** Booster box guarantees, applied by adjusting the last packs if needed. */
  boxMapping: { minHoloRare: 6, minUltraPlus: 2 } as { minHoloRare: number; minUltraPlus: number },
  godPack: {
    chance: 1 / 2000,
    table: [
      { rarity: 'illustrationRare', weight: 75 },
      { rarity: 'secretRare', weight: 20 },
      { rarity: 'mythicRare', weight: 5 },
    ] as { rarity: Rarity; weight: number }[],
  },
  misprint: {
    chancePerCard: 1 / 5000,
    table: [
      { kind: 'miscut', weight: 45 },
      { kind: 'inkError', weight: 25 },
      { kind: 'missingFoil', weight: 15 },
      { kind: 'crimped', weight: 14 },
      { kind: 'wrongBack', weight: 1 },
    ] as {
      kind: 'miscut' | 'inkError' | 'missingFoil' | 'crimped' | 'wrongBack';
      weight: number;
    }[],
  },
  /** Hidden onboarding luck (docs/02 §11.1). */
  onboarding: {
    /** The very first pack a player opens contains this Holo Rare (Sparkit). */
    firstPackCardId: 'gk.emberdawn.035' as string,
    /** The first box opened holds at least one card of this rarity or better. */
    firstBoxMinRarity: 'illustrationRare' as Rarity,
  },
} as const;
