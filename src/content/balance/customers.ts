/**
 * Customer tunables (docs/02 §5). Archetype-specific numbers live in
 * `src/content/customers/archetypes.ts`; these are the shared curves.
 */
export const customerBalance = {
  /** Traffic λ(h) = B_tier × R(rep) × (1 + 0.5a) × W(weekday) × H(hour) (docs/02 §5.1). */
  weekdayFactor: [0.85, 0.9, 0.95, 1, 1.15, 1.4, 1.25] as const, // Mon … Sun
  hourFactor: [
    { fromHour: 9, toHour: 11, factor: 0.6 },
    { fromHour: 11, toHour: 13, factor: 1.1 },
    { fromHour: 13, toHour: 15, factor: 0.9 },
    { fromHour: 15, toHour: 17, factor: 1.3 },
    { fromHour: 17, toHour: 19, factor: 1.1 },
  ] as const,
  /** R(rep) = base + scale × (rep / 100)^exponent. */
  repFactor: { base: 0.6, scale: 0.8, exponent: 0.8 },
  /** Normalized appeal a = 1 − e^(−appeal / scale[tier]) (docs/02 §4.4). */
  appealScaleByTier: [15, 30, 50, 80, 120] as const,
  appealTrafficBonus: 0.5,
  appealPatienceBonus: 0.3,
  appealToleranceBonus: 0.05,
  /** Day 1 only: the first customer walks in this many minutes after opening. */
  firstCustomerDelayMinutes: 3,
  /** Latest arrival: nobody new walks in during the last minutes before closing. */
  lastArrivalBeforeCloseMinutes: 15,

  /** Movement: 1.05 m/s at 1× (0.6 s per game-minute), matching the diorama's walk cycle. */
  walkMetersPerMinute: 0.63,
  browseMinutes: [3, 6] as const,
  /** Fixtures browsed per visit (uniform), before deciding. */
  fixturesPerVisit: [1, 3] as const,
  /** Holding items makes customers more patient in the queue than when idly waiting. */
  queuePatienceMultiplier: 2.5,
  /** Customers in line (including the one paying). Beyond this, newcomers give up. */
  maxQueue: 4,

  /** Willingness to pay (docs/02 §5.3). */
  perceivedValueSigma: 0.35,
  perceivedValueClip: 0.6,
  desire: [0.8, 1.3] as const,
  toleranceRepBonus: 0.1,
  buyProbabilityInside: 0.95,
  buyProbabilityDecay: 6,
  /** Reaction bubbles by true price ratio p / V. */
  reaction: { steal: 0.8, fair: 1.1, pricey: 1.3 },

  /** Satisfaction at exit, clamped to ±3 (docs/02 §5.4). */
  satisfaction: {
    steal: 1,
    fair: 0.5,
    pricey: -0.5,
    ripoff: -1.5,
    foundWanted: 1,
    outOfStock: -1,
    /** Per game-minute waited beyond 50% of patience. */
    waitPenaltyPerMinute: 0.1,
    waitPenaltyCap: 2,
    delight: 1,
    clamp: 3,
  },
} as const;

export type CustomerBalance = typeof customerBalance;
