/**
 * Continuous sim time for animation (docs/06 §5.6): the sim ticks once per game-minute, the view
 * interpolates agents at `minute + fraction`. Written by the GameLoop every frame; plain mutable
 * object outside React (CLAUDE.md rule 7).
 */
export const simClock = {
  day: 1,
  /** Current game-minute (integer, from GameState.clock). */
  minute: 0,
  /** Progress toward the next tick, 0–1. Stays put while paused or closed. */
  fraction: 0,
  /** Effective speed this frame (0 when paused or not open). */
  speed: 0,
};

/** Game time for interpolation: minute + fraction. */
export function simNow(): number {
  return simClock.minute + simClock.fraction;
}
