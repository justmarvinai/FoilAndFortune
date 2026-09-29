/** Reputation model v2 (docs/02 §13). */
export const reputationSubs = ['prices', 'service', 'selection', 'trust', 'community'] as const;
export type RepSub = (typeof reputationSubs)[number];

export const reputationBalance = {
  weights: { prices: 0.25, service: 0.2, selection: 0.2, trust: 0.25, community: 0.1 },
  start: { prices: 20, service: 20, selection: 20, trust: 20, community: 20 },
  /** Max daily change per sub-score at a perfect average signal. */
  maxDailyGain: { prices: 10, service: 10, selection: 10, trust: 8, community: 5 },
  /** Signals needed for full daily volume. */
  fullVolumeSignals: 15,
  /** Daily decay toward this baseline… */
  baseline: 20,
  /** …at this rate. */
  dailyDecay: 0.01,
} as const satisfies {
  weights: Record<RepSub, number>;
  start: Record<RepSub, number>;
  maxDailyGain: Record<RepSub, number>;
  fullVolumeSignals: number;
  baseline: number;
  dailyDecay: number;
};
