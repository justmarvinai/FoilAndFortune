import { describe, expect, it } from 'vitest';
import { dollars } from '@/core/money';
import { reputationStars, weeklyRentDue, xpProgress } from './selectors';
import { newTestGame } from './testing';

describe('selectors', () => {
  it('weekly rent follows difficulty (docs/02 §2–3)', () => {
    expect(weeklyRentDue(newTestGame('cozy'))).toBe(0);
    expect(weeklyRentDue(newTestGame('standard'))).toBe(dollars(245));
    expect(weeklyRentDue(newTestGame('tycoon'))).toBe(dollars(350));
  });

  it('stars round to halves and clamp to 0–5', () => {
    expect(reputationStars(0)).toBe(0);
    expect(reputationStars(20)).toBe(1);
    expect(reputationStars(25)).toBe(1.5);
    expect(reputationStars(140)).toBe(5);
  });

  it('xp progress reports the next level threshold', () => {
    expect(xpProgress(newTestGame())).toEqual({ level: 1, xp: 0, needed: 80, ratio: 0 });
  });
});
