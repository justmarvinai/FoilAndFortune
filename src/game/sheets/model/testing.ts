import { xpToNextLevel } from '@/content/balance/progression';
import type { Command } from '@/sim/commands';
import type { SimContext } from '@/sim/context';
import { runCommand } from '@/sim/engine';
import type { GameState } from '@/sim/state/types';
import { newTestGame, testContext } from '@/sim/testing';
import type { ViewContext } from './stock';

/** Test helpers for the sheet view models. Not imported by production code. */

export const ctx: ViewContext = testContext();
export const simCtx: SimContext = { ...ctx, emit: () => undefined };

export const BOOSTER = 'gk.emberdawn.booster';
export const BLISTER = 'gk.emberdawn.blister';
export const STARTER_EMBER = 'gk.emberdawn.starter-ember';
export const STARTER_VOLT = 'gk.emberdawn.starter-volt';
export const BOX = 'gk.emberdawn.box';

export { newTestGame };

/** Applies a command and fails the test on a rejection. */
export function run(state: GameState, command: Command): GameState {
  const { state: next, result } = runCommand(state, command, ctx);
  if (!result.ok) throw new Error(`${command.type} failed: ${result.code}`);
  return next;
}

export function levelUpTo(state: GameState, level: number): GameState {
  let game = state;
  while (game.progression.level < level) {
    const needed = xpToNextLevel(game.progression.level) - game.progression.xp;
    game = run(game, { type: 'debug/grantXp', amount: Math.max(1, needed) });
  }
  return game;
}

/** Any single in the starting stacks. */
export function someStackKey(state: GameState): string {
  const key = Object.keys(state.inventory.cardStacks)[0];
  if (!key) throw new Error('no starting singles');
  return key;
}
