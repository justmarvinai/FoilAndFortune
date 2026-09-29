/** Time constants (docs/02 §1). */
export const timeBalance = {
  /** Real seconds per game-minute at 1× speed → one open day ≈ 6 minutes. */
  realSecondsPerGameMinute: 0.6,
  /** 09:00 */
  openMinute: 9 * 60,
  /** 19:00 */
  closeMinute: 19 * 60,
  /** Clock shown during the untimed prep phase. */
  prepMinute: 8 * 60,
  speeds: [0, 1, 2, 4] as const,
  /** Catch-up cap so a background tab or a hitch never simulates a huge burst at once. */
  maxTicksPerFrame: 20,
} as const;

export type GameSpeed = (typeof timeBalance.speeds)[number];
