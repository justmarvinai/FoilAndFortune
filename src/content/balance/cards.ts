import type { Finish, Rarity } from '@/content/schema/common';
import { dollars } from '@/core/money';

/** Card value multipliers (docs/02 §7.2). */
export const cardBalance = {
  /** Reverse Holo multiplier by the card's rarity, with a value floor. */
  reverseHolo: { common: 3, uncommon: 2.5, rare: 2 } as Partial<Record<Rarity, number>>,
  reverseHoloFloorCents: dollars(0.25),
  /** Other finishes are priced into the card's own base value. */
  finishMultiplier: {} as Partial<Record<Finish, number>>,
  /** Condition multipliers; everything is Near Mint until conditions arrive (Phase 4). */
  condition: { mint: 1.2, nearMint: 1, good: 0.75, played: 0.5, damaged: 0.25 },
  /** Misprint premiums, applied from the card's `misprint.<kind>` stamp. */
  misprintMultiplier: {
    crimped: 2,
    miscut: 3,
    inkError: 4,
    missingFoil: 5,
    wrongBack: 25,
  } as Record<'miscut' | 'inkError' | 'missingFoil' | 'crimped' | 'wrongBack', number>,
  /** In-print sealed product market price as a share of MSRP (docs/02 §12.2). */
  sealedInPrintFactor: 1,
} as const;
