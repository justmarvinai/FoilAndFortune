import { type CommandResult, fail } from '../commands';
import type { SimContext } from '../context';
import type { GameState } from '../state/types';

/**
 * Opening sealed product (docs/01 §14, docs/02 §11): boosters, blisters, starter decks and
 * booster boxes. Takes one unit out of storage, puts every pulled card into the stacks and emits
 * `product/opened` with every pack, plus `card/pulled` for rare-slot hits.
 *
 * Contract with the engine (keep this signature). STUB: implemented by the packs work package.
 */
export function openProduct(
  _state: GameState,
  _ctx: SimContext,
  _productId: string,
): CommandResult {
  return fail('NOT_OPENABLE');
}

/**
 * Breaks one unit of a product whose contents are only packs (plus promos) into loose sealed
 * packs in storage, splitting its cost basis exactly; promos go to the card stacks.
 *
 * Contract with the engine (keep this signature). STUB: implemented by the packs work package.
 */
export function unboxProduct(
  _state: GameState,
  _ctx: SimContext,
  _productId: string,
): CommandResult {
  return fail('NOT_OPENABLE');
}
