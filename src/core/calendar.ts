/**
 * Game calendar (docs/02 §1): 7-day weeks, 28-day seasons, 112-day years.
 * Day 1 = Spring 8, Year 1, a Monday. Days ≤ 0 lie before the game starts. Because a season is
 * exactly four weeks, every season starts on a Monday.
 */
export const DAYS_PER_WEEK = 7;
export const DAYS_PER_SEASON = 28;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export type Season = (typeof SEASONS)[number];
export type Weekday = (typeof WEEKDAYS)[number];

export interface GameDate {
  year: number;
  season: Season;
  /** 1–28 */
  dayOfSeason: number;
  weekday: Weekday;
}

/** Day 1 is Spring 8 of Year 1, i.e. index 7 counted from Spring 1, Year 1. */
const DAY_ONE_INDEX = 7;

function floorMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function weekdayIndex(day: number): number {
  return floorMod(day - 1, DAYS_PER_WEEK);
}

export function weekdayOf(day: number): Weekday {
  return WEEKDAYS[weekdayIndex(day)] as Weekday;
}

export function dayToDate(day: number): GameDate {
  const index = day - 1 + DAY_ONE_INDEX;
  const year = Math.floor(index / DAYS_PER_YEAR) + 1;
  const dayOfYear = floorMod(index, DAYS_PER_YEAR);
  const season = SEASONS[Math.floor(dayOfYear / DAYS_PER_SEASON)] as Season;
  return { year, season, dayOfSeason: (dayOfYear % DAYS_PER_SEASON) + 1, weekday: weekdayOf(day) };
}

export function dateToDay(year: number, season: Season, dayOfSeason: number): number {
  const index =
    (year - 1) * DAYS_PER_YEAR + SEASONS.indexOf(season) * DAYS_PER_SEASON + (dayOfSeason - 1);
  return index - DAY_ONE_INDEX + 1;
}

/** Minute of day → "HH:MM". */
export function formatClock(minuteOfDay: number): string {
  const minute = floorMod(Math.floor(minuteOfDay), 24 * 60);
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
