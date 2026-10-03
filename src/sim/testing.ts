import { defaultBalance } from '@/content/balance';
import type { Difficulty } from '@/content/balance/difficulty';
import { buildRegistry } from '@/content/registry';
import type { PureContext } from './engine';
import { createNewGame } from './state/createNewGame';
import type { GameState } from './state/types';

/** Test helpers shared by sim/save tests. Not imported by production code. */
export function testContext(): PureContext {
  return { content: buildRegistry(), balance: defaultBalance };
}

export function newTestGame(difficulty: Difficulty = 'standard', seed = 1234): GameState {
  return createNewGame(
    {
      seed,
      shopName: 'Foil & Fortune',
      difficulty,
      createdAt: '2026-09-29T12:00:00.000Z',
      gameVersion: 'test',
      starterShelves: false,
    },
    testContext(),
  );
}
