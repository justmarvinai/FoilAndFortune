import { defaultBalance } from '@/content/balance';
import type { Cents } from '@/core/money';
import { useGameStore } from '@/state/gameStore';

/**
 * Debug-only time warps and grants for the engine sandbox (docs/06 §19). Everything goes
 * through the store's real `dispatch`/`advance`, so the sim runs its normal pipelines: nothing
 * pokes state directly.
 */

/** Mutable tuning read by the sandbox GameLoop every frame (kept out of React, rule 7). */
export const sandboxTuning = {
  minuteMs: defaultBalance.time.realSecondsPerGameMinute * 1000,
};

const store = () => useGameStore.getState();

/** Fast-forwards open hours through the normal tick pipeline. */
export function skipMinutes(minutes: number): void {
  const game = store().game;
  if (game?.clock.phase !== 'open') return;
  store().advance(Math.min(minutes, defaultBalance.time.closeMinute - game.clock.minute), 0);
}

export function skipToClose(): void {
  skipMinutes(Number.POSITIVE_INFINITY);
}

/** Plays whole days: open the shop, run to closing time, start the next morning. */
export function playDays(days: number): void {
  for (let i = 0; i < days; i++) {
    if (store().game?.clock.phase === 'prep') store().dispatch({ type: 'time/openShop' });
    skipToClose();
    if (store().game?.clock.phase === 'night') store().dispatch({ type: 'time/startNextDay' });
  }
}

export function grantCash(cents: Cents): void {
  store().dispatch({ type: 'debug/grantCash', cents });
}

export function grantXp(amount: number): void {
  store().dispatch({ type: 'debug/grantXp', amount });
}
