import type { Finish } from '@/content/schema/common';
import type { Cents } from '@/core/money';
import type { DayLog, GameState } from '../state/types';

/** Today's highlights for the Day Summary receipt (docs/05 §5.17). */
export function emptyDayLog(repStart: number): DayLog {
  return {
    served: 0,
    lost: 0,
    itemsSold: 0,
    packsOpened: 0,
    newCards: 0,
    xpGained: 0,
    repStart,
    bestPull: null,
  };
}

/** Keeps the most valuable pull of the day ("⭐ Best pull", docs/05 §5.17). */
export function noteBestPull(
  state: GameState,
  cardId: string,
  finish: Finish,
  valueCents: Cents,
): void {
  const best = state.dayLog.bestPull;
  if (!best || valueCents > best.valueCents) state.dayLog.bestPull = { cardId, finish, valueCents };
}
