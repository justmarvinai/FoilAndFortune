import type { GameState } from '@/sim/state/types';
import { viewContext } from '../model/stock';

/**
 * Stable fallbacks for store selectors while no game is loaded: `useShallow` compares by
 * reference, so fresh `{}`/`[]` literals would re-render forever.
 */
export const NO_SEALED: GameState['inventory']['sealed'] = {};
export const NO_STACKS: GameState['inventory']['cardStacks'] = {};
export const NO_FIXTURES: GameState['shop']['fixtures'] = [];
export const NO_ORDERS: GameState['suppliers']['orders'] = [];
export const NO_PRICES: GameState['pricing']['prices'] = {};
export const NO_PERKS: GameState['progression']['perks'] = [];
export const NO_UNLOCKS: GameState['progression']['unlocked'] = {};
export const NO_COLLECTION: GameState['collection'] = { owned: {}, binder: {} };
export const NO_REP: GameState['reputation']['sub'] = {
  prices: 0,
  service: 0,
  selection: 0,
  trust: 0,
  community: 0,
};
export const NO_LANE: GameState['customers']['lane'] = [];

/** Content + balance for view models; the registry is static, so one instance serves all. */
export const VIEW = viewContext();
