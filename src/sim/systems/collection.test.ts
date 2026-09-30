import { describe, expect, it } from 'vitest';
import { cardKey } from '../cards';
import type { Command } from '../commands';
import { runCommand } from '../engine';
import type { GameState } from '../state/types';
import { newTestGame, testContext } from '../testing';

const ctx = testContext();

function run(state: GameState, command: Command) {
  return runCommand(state, command, ctx);
}

/** A starting game with two prints of the same card in the stacks. */
function gameWithTwoPrints(): { game: GameState; cardId: string; a: string; b: string } {
  const game = newTestGame();
  const cardId = 'gk.emberdawn.012';
  const a = cardKey({ cardId, finish: 'normal' });
  const b = cardKey({ cardId, finish: 'reverseHolo' });
  game.inventory.cardStacks[a] = 2;
  game.inventory.cardStacks[b] = 1;
  return { game, cardId, a, b };
}

describe('binder (docs/01 §24)', () => {
  it('moves one copy out of the shop stacks into the pocket', () => {
    const { game, cardId, a } = gameWithTwoPrints();
    const { state, result, events } = run(game, { type: 'collection/addToBinder', cardKey: a });
    expect(result.ok).toBe(true);
    expect(state.collection.binder[cardId]).toEqual({ cardKey: a, addedDay: 1 });
    expect(state.inventory.cardStacks[a]).toBe(1);
    expect(events).toEqual([{ type: 'binder/changed', cardId }]);
  });

  it('swaps a better print in and returns the old copy to the stacks', () => {
    const { game, cardId, a, b } = gameWithTwoPrints();
    const first = run(game, { type: 'collection/addToBinder', cardKey: a }).state;
    const swapped = run(first, { type: 'collection/addToBinder', cardKey: b }).state;
    expect(swapped.collection.binder[cardId]?.cardKey).toBe(b);
    expect(swapped.inventory.cardStacks[a]).toBe(2);
    expect(swapped.inventory.cardStacks[b]).toBeUndefined();
  });

  it('returns the copy to the stacks when removed', () => {
    const { game, cardId, a } = gameWithTwoPrints();
    const added = run(game, { type: 'collection/addToBinder', cardKey: a }).state;
    const removed = run(added, { type: 'collection/removeFromBinder', cardId });
    expect(removed.result.ok).toBe(true);
    expect(removed.state.collection.binder[cardId]).toBeUndefined();
    expect(removed.state.inventory.cardStacks[a]).toBe(2);
  });

  it('rejects unknown cards, missing copies and empty pockets', () => {
    const { game, cardId } = gameWithTwoPrints();
    expect(run(game, { type: 'collection/addToBinder', cardKey: 'junk' }).result).toMatchObject({
      code: 'UNKNOWN_CARD',
    });
    expect(
      run(game, {
        type: 'collection/addToBinder',
        cardKey: cardKey({ cardId, finish: 'normal', condition: 'played' }),
      }).result,
    ).toMatchObject({ code: 'NOT_ENOUGH_STOCK' });
    expect(run(game, { type: 'collection/removeFromBinder', cardId }).result).toMatchObject({
      code: 'UNKNOWN_CARD',
    });
  });
});
