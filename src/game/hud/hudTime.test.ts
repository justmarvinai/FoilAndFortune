import { describe, expect, it } from 'vitest';
import { clockText, dateParts, dayProgress, minutesUntilClose, skyTime } from './hudTime';

describe('HUD clock helpers', () => {
  it('formats fractional minutes as HH:MM without rounding up early', () => {
    expect(clockText(9 * 60)).toBe('09:00');
    expect(clockText(9 * 60 + 35.99)).toBe('09:35');
    expect(clockText(19 * 60)).toBe('19:00');
    expect(clockText(24 * 60 + 5)).toBe('00:05');
    expect(clockText(-1)).toBe('23:59');
  });

  it('maps opening hours onto 0–1', () => {
    expect(dayProgress(8 * 60)).toBe(0);
    expect(dayProgress(9 * 60)).toBe(0);
    expect(dayProgress(14 * 60)).toBe(0.5);
    expect(dayProgress(19 * 60)).toBe(1);
    expect(dayProgress(23 * 60)).toBe(1);
    expect(dayProgress(600, 600, 600)).toBe(0);
  });

  it('picks the sky: dawn in prep, dusk in the last two hours, night after closing', () => {
    expect(skyTime('prep', 8 * 60)).toBe('dawn');
    expect(skyTime('open', 12 * 60)).toBe('day');
    expect(skyTime('open', 17 * 60)).toBe('dusk');
    expect(skyTime('night', 19 * 60)).toBe('night');
  });

  it('counts down to closing', () => {
    expect(minutesUntilClose(18 * 60 + 0.5)).toBe(60);
    expect(minutesUntilClose(19 * 60 + 3)).toBe(0);
  });

  it('dates Day 1 as Monday, Spring 8, Year 1 (docs/02 §1)', () => {
    expect(dateParts(1)).toEqual({ year: 1, season: 'spring', dayOfSeason: 8, weekday: 'mon' });
    expect(dateParts(22)).toMatchObject({ season: 'summer', dayOfSeason: 1, weekday: 'mon' });
  });
});
