import { describe, expect, it } from 'vitest';
import { eveningForClock, OPEN_EVENING_MAX } from './clockLight';

describe('time-of-day lighting from the sim clock', () => {
  it('is day before opening and through the afternoon', () => {
    expect(eveningForClock('prep', 8 * 60)).toBe(0);
    expect(eveningForClock('open', 9 * 60)).toBe(0);
    expect(eveningForClock('open', 16 * 60 + 59)).toBe(0);
  });

  it('blends towards evening from 17:00 and never goes back while open', () => {
    let last = 0;
    for (let minute = 17 * 60; minute <= 19 * 60; minute += 5) {
      const value = eveningForClock('open', minute);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
    expect(eveningForClock('open', 18 * 60)).toBeGreaterThan(0.2);
    expect(eveningForClock('open', 19 * 60)).toBeLessThanOrEqual(OPEN_EVENING_MAX);
    expect(eveningForClock('open', 19 * 60)).toBeGreaterThan(0.6);
  });

  it('is full evening at night', () => {
    expect(eveningForClock('night', 19 * 60)).toBe(1);
  });
});
