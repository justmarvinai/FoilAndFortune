import { describe, expect, it } from 'vitest';
import { type BarCursor, barSeconds, dueBars, eventTime, isLate } from './scheduler';

describe('lookahead scheduler math', () => {
  it('converts tempo and beats to seconds', () => {
    expect(barSeconds(120)).toBe(2);
    expect(barSeconds(60)).toBe(4);
    expect(eventTime(10, 1.5, 120)).toBe(10.75);
    expect(isLate(0.95, 1, 0.03)).toBe(true);
    expect(isLate(0.98, 1, 0.03)).toBe(false);
  });

  it('schedules every bar exactly once, in order, ahead of time, under a jittery timer', () => {
    let cursor: BarCursor = { bar: 0, time: 0.05 };
    const seen: BarCursor[] = [];
    let now = 0;
    // 30 s of wake-ups every 25–55 ms.
    for (let tick = 0; now < 30; tick++) {
      const result = dueBars(cursor, 84, now, 0.3);
      expect(result.skipped).toBe(0);
      for (const bar of result.due) {
        // Never scheduled in the past, never further ahead than the lookahead.
        expect(bar.time).toBeGreaterThanOrEqual(now - 1e-9);
        expect(bar.time).toBeLessThan(now + 0.3);
      }
      seen.push(...result.due);
      cursor = result.next;
      now += 0.025 + ((tick * 7919) % 31) / 1000;
    }
    expect(seen.map((b) => b.bar)).toEqual(seen.map((_, i) => i));
    for (const [i, b] of seen.entries()) expect(b.time).toBeCloseTo(0.05 + i * barSeconds(84), 9);
  });

  it('skips whole bars after a stall and keeps the grid', () => {
    const length = barSeconds(120);
    const result = dueBars({ bar: 3, time: 6 }, 120, 13, 0.3);
    // Bars 3 (6–8), 4 (8–10) and 5 (10–12) ended during the stall; bar 6 (12–14) is playing.
    expect(result.skipped).toBe(3);
    expect(result.due).toEqual([{ bar: 6, time: 12 }]);
    expect(result.next).toEqual({ bar: 7, time: 12 + length });
  });

  it('does nothing until the next bar enters the lookahead window', () => {
    const result = dueBars({ bar: 2, time: 10 }, 90, 9, 0.3);
    expect(result.due).toEqual([]);
    expect(result.next).toEqual({ bar: 2, time: 10 });
  });
});
