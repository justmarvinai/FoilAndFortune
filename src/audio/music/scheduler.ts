import { BEATS_PER_BAR } from './generator';

/**
 * Lookahead scheduling math (docs/06 §10). A timer only wakes the director; every note is placed
 * on the AudioContext clock, `lookahead` seconds ahead, so timer jitter never reaches the groove.
 */

/** The next bar to schedule and when it starts (AudioContext time, seconds). */
export interface BarCursor {
  bar: number;
  time: number;
}

export function barSeconds(bpm: number): number {
  return (BEATS_PER_BAR * 60) / bpm;
}

export function eventTime(barTime: number, beat: number, bpm: number): number {
  return barTime + (beat * 60) / bpm;
}

/** A note this late (a stalled main thread) is skipped rather than played out of time. */
export function isLate(time: number, now: number, tolerance: number): boolean {
  return time < now - tolerance;
}

/**
 * Bars to schedule on this wake-up: every bar that starts before `now + lookahead`. After a
 * stall longer than a bar, bars that already ended are skipped whole (`skipped`), keeping the
 * grid, so the music picks up in time instead of rushing through missed notes.
 */
export function dueBars(
  cursor: BarCursor,
  bpm: number,
  now: number,
  lookahead: number,
): { due: BarCursor[]; next: BarCursor; skipped: number } {
  const length = barSeconds(bpm);
  let { bar, time } = cursor;
  let skipped = 0;
  while (time + length <= now) {
    bar++;
    time += length;
    skipped++;
  }
  const due: BarCursor[] = [];
  while (time < now + lookahead) {
    due.push({ bar, time });
    bar++;
    time += length;
  }
  return { due, next: { bar, time }, skipped };
}
