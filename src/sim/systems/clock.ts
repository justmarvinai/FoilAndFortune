import type { SimContext } from '../context';
import type { GameState } from '../state/types';
import { chargeRentIfDue, emptyDailyTotals, trimLedger } from './finance';

/**
 * Day cycle (docs/01 §5.3, docs/06 §5.3): untimed prep → timed open hours → untimed night.
 * The clock only advances while the shop is open.
 */

function bumpStat(state: GameState, key: string, by = 1): void {
  state.stats[key] = (state.stats[key] ?? 0) + by;
}

export function openShop(state: GameState, ctx: SimContext): void {
  state.clock.phase = 'open';
  state.clock.minute = ctx.balance.time.openMinute;
  bumpStat(state, 'daysOpened');
  ctx.emit({ type: 'clock/phaseChanged', day: state.clock.day, from: 'prep', to: 'open' });
}

/** Night pipeline: close the books, charge rent on Sundays, then hand over to the player. */
export function closeShop(state: GameState, ctx: SimContext): void {
  state.clock.phase = 'night';
  chargeRentIfDue(state, ctx);
  trimLedger(state);
  ctx.emit({ type: 'clock/phaseChanged', day: state.clock.day, from: 'open', to: 'night' });
  ctx.emit({ type: 'day/closed', day: state.clock.day, totals: { ...state.finance.today } });
}

/** Dawn pipeline: next day's prep phase. Market, deliveries and events hook in here later. */
export function startNextDay(state: GameState, ctx: SimContext): void {
  state.clock.day += 1;
  state.clock.phase = 'prep';
  state.clock.minute = ctx.balance.time.prepMinute;
  state.finance.today = emptyDailyTotals();
  bumpStat(state, 'daysPlayed');
  ctx.emit({ type: 'clock/dayStarted', day: state.clock.day });
  ctx.emit({ type: 'clock/phaseChanged', day: state.clock.day, from: 'night', to: 'prep' });
}

/** Advances the clock by one game-minute. No-op unless the shop is open. */
export function tickClock(state: GameState, ctx: SimContext): void {
  if (state.clock.phase !== 'open') return;
  state.clock.minute += 1;
  if (state.clock.minute % 60 === 0) {
    ctx.emit({ type: 'clock/hourChanged', day: state.clock.day, hour: state.clock.minute / 60 });
  }
  if (state.clock.minute >= ctx.balance.time.closeMinute) closeShop(state, ctx);
}
