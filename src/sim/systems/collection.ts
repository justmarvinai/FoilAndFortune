import { parseCardKey } from '../cards';
import { type CommandResult, fail, ok } from '../commands';
import type { SimContext } from '../context';
import type { GameState } from '../state/types';
import { addCardStack, takeCardStack } from './inventory';

/**
 * The personal binder (docs/01 §24): one pocket per card number. Cards in the binder leave the
 * shop inventory, so they are never sold by accident.
 */

export function addToBinder(
  state: GameState,
  ctx: SimContext,
  command: { cardKey: string },
): CommandResult {
  const print = parseCardKey(command.cardKey);
  if (!print || !ctx.content.cards.has(print.cardId)) return fail('UNKNOWN_CARD');
  if (takeCardStack(state, command.cardKey, 1) !== 1) return fail('NOT_ENOUGH_STOCK');
  const previous = state.collection.binder[print.cardId];
  if (previous) addCardStack(state, previous.cardKey, 1);
  state.collection.binder[print.cardId] = { cardKey: command.cardKey, addedDay: state.clock.day };
  ctx.emit({ type: 'binder/changed', cardId: print.cardId });
  return ok;
}

export function removeFromBinder(
  state: GameState,
  ctx: SimContext,
  command: { cardId: string },
): CommandResult {
  const pocket = state.collection.binder[command.cardId];
  if (!pocket) return fail('UNKNOWN_CARD');
  addCardStack(state, pocket.cardKey, 1);
  delete state.collection.binder[command.cardId];
  ctx.emit({ type: 'binder/changed', cardId: command.cardId });
  return ok;
}
