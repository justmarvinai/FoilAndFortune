import { timeBalance } from '@/content/balance/time';
import { dayToDate, type GameDate } from '@/core/calendar';

import type { Phase } from '@/sim/state/types';

/**
 * Pure helpers for the HUD calendar and clock (docs/05 §3.1). The HUD reads the continuous sim
 * time (`simClock`) every frame and only re-renders React on phase or day changes.
 */

/** Where the sun (or moon) sits over the day, for the little sky arc next to the clock. */
export type SkyTime = 'dawn' | 'day' | 'dusk' | 'night';

/** Opening-hours progress: 0 at opening, 1 at closing, clamped. */
export function dayProgress(
  minute: number,
  openMinute: number = timeBalance.openMinute,
  closeMinute: number = timeBalance.closeMinute,
): number {
  const span = closeMinute - openMinute;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (minute - openMinute) / span));
}

/** Sky state for the clock face: prep is dawn, the last two open hours are dusk. */
export function skyTime(
  phase: Phase,
  minute: number,
  closeMinute: number = timeBalance.closeMinute,
): SkyTime {
  if (phase === 'prep') return 'dawn';
  if (phase === 'night') return 'night';
  return minute >= closeMinute - 120 ? 'dusk' : 'day';
}

/** Minute of day → "HH:MM" for a fractional minute (the view interpolates between ticks). */
export function clockText(minute: number): string {
  const whole = ((Math.floor(minute) % 1440) + 1440) % 1440;
  const hours = Math.floor(whole / 60);
  const minutes = whole % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Minutes left until closing (0 when closed or past closing). */
export function minutesUntilClose(
  minute: number,
  closeMinute: number = timeBalance.closeMinute,
): number {
  return Math.max(0, Math.ceil(closeMinute - minute));
}

/** i18n params for `common:date` ("Mon · Spring 8 · Y1") and the short HUD date. */
export function dateParts(day: number): GameDate {
  return dayToDate(day);
}
