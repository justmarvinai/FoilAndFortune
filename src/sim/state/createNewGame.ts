import type { Difficulty } from '@/content/balance/difficulty';
import { seedStream } from '@/core/rng';
import type { SimContext } from '../context';
import { emptyDailyTotals } from '../systems/finance';
import { type GameState, RNG_STREAMS, type RngStream, SAVE_VERSION } from './types';

export interface NewGameOptions {
  seed: number;
  shopName: string;
  difficulty: Difficulty;
  /** ISO timestamp from the caller; the sim never reads the wall clock. */
  createdAt: string;
  gameVersion: string;
}

/** Starting sealed stock (docs/02 §2). Theo's binder and bulk shoebox arrive with cards in Phase 2. */
const STARTING_SEALED: readonly { productId: string; qty: number; unitCostCents: number }[] = [
  { productId: 'gk.emberdawn.booster', qty: 24, unitCostCents: 325 },
  { productId: 'gk.emberdawn.blister', qty: 4, unitCostCents: 1050 },
  { productId: 'gk.emberdawn.starter-ember', qty: 2, unitCostCents: 1000 },
  { productId: 'gk.emberdawn.box', qty: 1, unitCostCents: 10400 },
];

export function createNewGame(
  options: NewGameOptions,
  ctx: Pick<SimContext, 'balance' | 'content'>,
): GameState {
  const { balance, content } = ctx;
  const difficulty = balance.difficulty[options.difficulty];

  const rng = {} as Record<RngStream, GameState['rng'][RngStream]>;
  for (const stream of RNG_STREAMS) rng[stream] = seedStream(options.seed, stream);

  const sealed: GameState['inventory']['sealed'] = {};
  const prices: GameState['pricing']['prices'] = {};
  for (const item of STARTING_SEALED) {
    const product = content.products.get(item.productId);
    if (!product) continue; // content packs may omit starter products in tests
    sealed[item.productId] = [{ qty: item.qty, unitCostCents: item.unitCostCents, acquiredDay: 0 }];
    prices[item.productId] = product.msrpCents;
  }

  return {
    meta: {
      saveVersion: SAVE_VERSION,
      gameVersion: options.gameVersion,
      seed: options.seed,
      createdAt: options.createdAt,
      playTimeMs: 0,
      difficulty: options.difficulty,
      shopName: options.shopName,
    },
    rng,
    clock: { day: 1, minute: balance.time.prepMinute, phase: 'prep', speed: 1 },
    finance: {
      cashCents: difficulty.startingCash,
      loan: { principalCents: 0 },
      ledger: [],
      today: emptyDailyTotals(),
    },
    progression: { level: 1, xp: 0 },
    reputation: { sub: { ...balance.reputation.start } },
    shop: { tier: 1 },
    inventory: { sealed },
    pricing: { prices },
    stats: {},
  };
}
