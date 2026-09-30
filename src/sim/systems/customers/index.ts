import { type CommandResult, fail } from '../../commands';
import type { SimContext } from '../../context';
import type { GameState } from '../../state/types';

/**
 * Customer agents (docs/01 §10, docs/02 §5, docs/06 §5.6): arrivals, browsing, buying at fixed
 * prices, the register lane and manual checkout.
 *
 * Contract with the engine (keep these signatures):
 * - `onShopOpened` runs when the sign flips to OPEN (schedule today's first arrival).
 * - `tickCustomers` runs once per game-minute while open, after the clock.
 * - `checkoutCustomer` rings up the customer at the pay spot (or `uid`).
 * - `onShopClosed` runs at closing, before the books close (wrap up whoever is still inside).
 *
 * STUB: implemented by the customers work package.
 */
export function onShopOpened(_state: GameState, _ctx: SimContext): void {}

export function tickCustomers(_state: GameState, _ctx: SimContext): void {}

export function checkoutCustomer(
  _state: GameState,
  _ctx: SimContext,
  _uid: number | undefined,
): CommandResult {
  return fail('NO_CUSTOMER');
}

export function onShopClosed(_state: GameState, _ctx: SimContext): void {}
