import { type Cents, dollars } from '@/core/money';

export type Difficulty = 'cozy' | 'standard' | 'tycoon';

export interface DifficultyBalance {
  startingCash: Cents;
  /** Daily rent at Tier 1; charged weekly on Sunday night (docs/02 §2, §3). */
  tier1DailyRent: Cents;
  /** Multiplier applied to every tier's rent. */
  rentMultiplier: number;
  loanWeeklyRate: number;
  customerKnowledgeModifier: number;
  fakeFrequency: number;
  damagedShipmentChance: number;
  cardWearAndShoplifting: boolean;
  bankruptcy: boolean;
}

/** Starting state per difficulty (docs/02 §2). */
export const difficultyBalance: Record<Difficulty, DifficultyBalance> = {
  cozy: {
    startingCash: dollars(1000),
    tier1DailyRent: 0,
    rentMultiplier: 0,
    loanWeeklyRate: 0,
    customerKnowledgeModifier: -0.1,
    fakeFrequency: 0.25,
    damagedShipmentChance: 0.015,
    cardWearAndShoplifting: false,
    bankruptcy: false,
  },
  standard: {
    startingCash: dollars(600),
    tier1DailyRent: dollars(35),
    rentMultiplier: 1,
    loanWeeklyRate: 0.01,
    customerKnowledgeModifier: 0,
    fakeFrequency: 1,
    damagedShipmentChance: 0.03,
    cardWearAndShoplifting: false,
    bankruptcy: false,
  },
  tycoon: {
    startingCash: dollars(400),
    tier1DailyRent: dollars(50),
    rentMultiplier: 50 / 35,
    loanWeeklyRate: 0.03,
    customerKnowledgeModifier: 0.15,
    fakeFrequency: 1.5,
    damagedShipmentChance: 0.05,
    cardWearAndShoplifting: true,
    bankruptcy: true,
  },
};
