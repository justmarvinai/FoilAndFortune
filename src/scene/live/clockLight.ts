import type { Phase } from '@/sim/state/types';
import { smoothstep } from '../lib/easing';

/**
 * Time-of-day lighting from the sim clock (docs/04 §2.4, §4.3 "lighting animates through the
 * day"): daylight through the morning and afternoon, a dusk blend from 17:00 towards closing at
 * 19:00, full evening once the sign flips to CLOSED at night. Prep (before opening) is morning.
 * Returns the `runtime.eveningTarget` blend, 0 = day … 1 = evening.
 */
export const DUSK_START_MINUTE = 17 * 60;
export const DUSK_END_MINUTE = 19 * 60 + 30;
/** How far into evening the shop gets while still open (lamps on, sky dusky). */
export const OPEN_EVENING_MAX = 0.85;

export function eveningForClock(phase: Phase, minute: number): number {
  if (phase === 'night') return 1;
  if (phase === 'prep') return 0;
  return smoothstep(DUSK_START_MINUTE, DUSK_END_MINUTE, minute) * OPEN_EVENING_MAX;
}
