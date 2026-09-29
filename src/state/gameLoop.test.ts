import { describe, expect, it } from 'vitest';
import { computeTicks } from './gameLoop';

const MS_PER_MINUTE = 600; // 0.6 s real time per game-minute at 1×

describe('computeTicks', () => {
  it('converts real time to whole game-minutes and keeps the remainder', () => {
    expect(computeTicks(0, 1000, 1, MS_PER_MINUTE, 20)).toEqual({ ticks: 1, accumulatorMs: 400 });
    expect(computeTicks(400, 200, 1, MS_PER_MINUTE, 20)).toEqual({ ticks: 1, accumulatorMs: 0 });
  });

  it('scales with speed', () => {
    expect(computeTicks(0, 600, 4, MS_PER_MINUTE, 20).ticks).toBe(4);
    expect(computeTicks(0, 600, 2, MS_PER_MINUTE, 20).ticks).toBe(2);
  });

  it('does nothing while paused and keeps the accumulator', () => {
    expect(computeTicks(123, 1000, 0, MS_PER_MINUTE, 20)).toEqual({ ticks: 0, accumulatorMs: 123 });
  });

  it('drops the backlog beyond maxTicks', () => {
    expect(computeTicks(0, 60_000, 4, MS_PER_MINUTE, 20)).toEqual({ ticks: 20, accumulatorMs: 0 });
  });

  it('a full day at 1× takes about six real minutes (docs/02 §1)', () => {
    let acc = 0;
    let ticks = 0;
    for (let frame = 0; frame < 6 * 60 * 60; frame++) {
      const result = computeTicks(acc, 1000 / 60, 1, MS_PER_MINUTE, 20);
      acc = result.accumulatorMs;
      ticks += result.ticks;
    }
    expect(ticks).toBe(600); // 10 open hours
  });
});
