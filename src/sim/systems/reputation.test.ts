import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../events';
import { reputationScore } from '../selectors';
import { newTestGame, testContext } from '../testing';
import { addRepSignal, applyDailyReputation } from './reputation';

const ctx = testContext();
const balance = ctx.balance.reputation;

function nightUpdate(game: ReturnType<typeof newTestGame>): DomainEvent[] {
  const events: DomainEvent[] = [];
  applyDailyReputation(game, { ...ctx, emit: (event) => events.push(event) });
  return events;
}

describe('reputation (docs/02 §13)', () => {
  it('clamps signals to ±1 and weights them by influence', () => {
    const game = newTestGame();
    addRepSignal(game, 'prices', 5);
    addRepSignal(game, 'prices', -0.5, 2);
    expect(game.reputation.signals.prices).toEqual({ sum: 1 - 1, weight: 3, count: 2 });
  });

  it('applies Δ = G × S̄ × volume × headroom, then drifts toward the baseline', () => {
    const game = newTestGame();
    for (let i = 0; i < balance.fullVolumeSignals; i++) addRepSignal(game, 'service', 1);
    const start = game.reputation.sub.service;
    const events = nightUpdate(game);
    const gained = start + balance.maxDailyGain.service * 1 * 1 * (1 - start / 110);
    const expected = gained + (balance.baseline - gained) * balance.dailyDecay;
    expect(game.reputation.sub.service).toBeCloseTo(expected, 10);
    // Untouched subs only drift (and sit on the baseline at the start).
    expect(game.reputation.sub.trust).toBe(balance.start.trust);
    expect(game.reputation.signals.service).toEqual({ sum: 0, weight: 0, count: 0 });
    expect(events).toEqual([
      { type: 'reputation/changed', before: 20, after: reputationScore(game) },
    ]);
  });

  it('scales a quiet day by its signal volume', () => {
    const busy = newTestGame();
    const quiet = newTestGame();
    for (let i = 0; i < balance.fullVolumeSignals; i++) addRepSignal(busy, 'prices', -1);
    addRepSignal(quiet, 'prices', -1);
    nightUpdate(busy);
    nightUpdate(quiet);
    const start = balance.start.prices;
    expect(start - busy.reputation.sub.prices).toBeGreaterThan(
      (start - quiet.reputation.sub.prices) * 10,
    );
  });

  it('keeps sub-scores within 0–100 and history to 60 days', () => {
    const game = newTestGame();
    game.reputation.sub.prices = 0.5;
    for (let day = 0; day < 70; day++) {
      for (let i = 0; i < 20; i++) addRepSignal(game, 'prices', -1);
      nightUpdate(game);
    }
    expect(game.reputation.sub.prices).toBeGreaterThanOrEqual(0);
    expect(game.reputation.history).toHaveLength(60);
  });
});
