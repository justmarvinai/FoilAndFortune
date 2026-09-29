import { describe, expect, it } from 'vitest';
import { dateToDay, dayToDate, formatClock, weekdayOf } from './calendar';

describe('calendar (docs/02 §1, docs/03 §4)', () => {
  it('Day 1 is Spring 8, Year 1, a Monday', () => {
    expect(dayToDate(1)).toEqual({ year: 1, season: 'spring', dayOfSeason: 8, weekday: 'mon' });
  });

  it('Day 7 is the first Sunday (rent day)', () => {
    expect(weekdayOf(7)).toBe('sun');
  });

  it('matches the release calendar anchors in the content bible', () => {
    expect(dayToDate(8)).toMatchObject({ season: 'spring', dayOfSeason: 15, year: 1 }); // SPF
    expect(dayToDate(22)).toMatchObject({ season: 'summer', dayOfSeason: 1, year: 1 }); // SNK
    expect(dayToDate(50)).toMatchObject({ season: 'autumn', dayOfSeason: 1, year: 1 }); // HOS
    expect(dayToDate(64)).toMatchObject({ season: 'autumn', dayOfSeason: 15, year: 1 }); // O25
    expect(dayToDate(78)).toMatchObject({ season: 'winter', dayOfSeason: 1, year: 1 }); // FBK
    expect(dayToDate(106)).toMatchObject({ season: 'spring', dayOfSeason: 1, year: 2 }); // NEC
    expect(dayToDate(134)).toMatchObject({ season: 'summer', dayOfSeason: 1, year: 2 }); // SFO
  });

  it('handles days before the game starts (Year 0)', () => {
    expect(dayToDate(-6)).toMatchObject({ year: 1, season: 'spring', dayOfSeason: 1 }); // EMD
    expect(dayToDate(-34)).toMatchObject({ year: 0, season: 'winter', dayOfSeason: 1 }); // MNM
    expect(dayToDate(-62)).toMatchObject({ year: 0, season: 'autumn', dayOfSeason: 1 }); // TDB
  });

  it('every season starts on a Monday', () => {
    for (const day of [-62, -34, -6, 22, 50, 78, 106]) expect(weekdayOf(day)).toBe('mon');
  });

  it('dateToDay inverts dayToDate', () => {
    for (let day = -300; day <= 300; day += 7) {
      const { year, season, dayOfSeason } = dayToDate(day);
      expect(dateToDay(year, season, dayOfSeason)).toBe(day);
    }
  });

  it('formats clock times', () => {
    expect(formatClock(540)).toBe('09:00');
    expect(formatClock(1140)).toBe('19:00');
    expect(formatClock(875)).toBe('14:35');
  });
});
