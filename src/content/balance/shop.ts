import { type Cents, dollars } from '@/core/money';

export interface ShopTierBalance {
  tier: 1 | 2 | 3 | 4 | 5;
  grid: { w: number; d: number };
  unlockLevel: number;
  upgradeCost: Cents;
  /** Standard-difficulty daily rent; difficulty applies `rentMultiplier`. */
  dailyRent: Cents;
  /** Base customers per open hour at R(rep) = 1 (docs/02 §5.1). */
  baseTraffic: number;
  staffCap: number;
}

/** Shop tiers (docs/02 §4.1). */
export const shopTiers: readonly ShopTierBalance[] = [
  {
    tier: 1,
    grid: { w: 6, d: 5 },
    unlockLevel: 1,
    upgradeCost: 0,
    dailyRent: dollars(35),
    baseTraffic: 2.5,
    staffCap: 1,
  },
  {
    tier: 2,
    grid: { w: 9, d: 7 },
    unlockLevel: 7,
    upgradeCost: dollars(6000),
    dailyRent: dollars(70),
    baseTraffic: 4,
    staffCap: 3,
  },
  {
    tier: 3,
    grid: { w: 12, d: 9 },
    unlockLevel: 15,
    upgradeCost: dollars(25000),
    dailyRent: dollars(140),
    baseTraffic: 6,
    staffCap: 5,
  },
  {
    tier: 4,
    grid: { w: 16, d: 11 },
    unlockLevel: 25,
    upgradeCost: dollars(90000),
    dailyRent: dollars(280),
    baseTraffic: 9,
    staffCap: 8,
  },
  {
    tier: 5,
    grid: { w: 20, d: 14 },
    unlockLevel: 35,
    upgradeCost: dollars(300000),
    dailyRent: dollars(550),
    baseTraffic: 13,
    staffCap: 12,
  },
];

export function shopTier(tier: number): ShopTierBalance {
  const found = shopTiers.find((entry) => entry.tier === tier);
  if (!found) throw new RangeError(`unknown shop tier ${tier}`);
  return found;
}
