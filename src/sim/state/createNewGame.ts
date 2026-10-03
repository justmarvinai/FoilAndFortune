import type { Difficulty } from '@/content/balance/difficulty';
import type { ContentRegistry } from '@/content/registry';
import type { Rarity } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';
import { createRng, type Rng, seedStream } from '@/core/rng';
import { cardKey } from '../cards';
import type { SimContext } from '../context';
import { reputationScore } from '../selectors';
import { emptyDayLog } from '../systems/dayLog';
import { emptyDailyTotals } from '../systems/finance';
import { takeSealed } from '../systems/inventory';
import { grantUnlocks } from '../systems/progression';
import { emptySignals } from '../systems/reputation';
import {
  type AvatarSpec,
  type GameState,
  type PlacedFixture,
  RNG_STREAMS,
  type RngStream,
  SAVE_VERSION,
} from './types';

export interface NewGameOptions {
  seed: number;
  shopName: string;
  difficulty: Difficulty;
  /** Owner avatar from the New Game form; a friendly default otherwise. */
  owner?: AvatarSpec;
  /** ISO timestamp from the caller; the sim never reads the wall clock. */
  createdAt: string;
  gameVersion: string;
  /**
   * Theo leaves the first wall shelf stocked (default on), so Day 1 opens on a lively shop and
   * restocking is the first lesson. Unit tests turn it off for an empty, predictable layout.
   */
  starterShelves?: boolean;
}

export const DEFAULT_OWNER: AvatarSpec = {
  skin: 2,
  hairStyle: 1,
  hairColor: 0,
  top: 3,
  topColor: 2,
};

/** The layout every new shop starts with (docs/02 §2 starting fixtures). */
export const STARTER_LAYOUT_ID = 'layout.nook.starter';
/** Theo's set: the current set at game start (docs/03 §4). */
export const STARTER_SET_ID = 'gk.emberdawn';

/** Starting sealed stock (docs/02 §2), including Theo's last booster box. */
const STARTING_SEALED: readonly { productId: string; qty: number; unitCostCents: number }[] = [
  { productId: 'gk.emberdawn.booster', qty: 24, unitCostCents: 325 },
  { productId: 'gk.emberdawn.blister', qty: 4, unitCostCents: 1050 },
  { productId: 'gk.emberdawn.starter-ember', qty: 2, unitCostCents: 1000 },
  { productId: 'gk.emberdawn.box', qty: 1, unitCostCents: 10400 },
];

/** What Theo left on the shelves (docs/02 §2); the rest of the starting stock is in the closet. */
const STARTER_SHELVES: readonly {
  fixtureUid: string;
  slot: number;
  productId: string;
  qty: number;
}[] = [
  { fixtureUid: 'shelf-a', slot: 0, productId: 'gk.emberdawn.booster', qty: 12 },
  { fixtureUid: 'shelf-a', slot: 1, productId: 'gk.emberdawn.blister', qty: 4 },
  { fixtureUid: 'shelf-a', slot: 2, productId: 'gk.emberdawn.starter-ember', qty: 2 },
];

/** Theo's Binder (30 mixed singles) and the Bulk Shoebox (200 commons/uncommons), docs/02 §2. */
const THEO_BINDER = { commonsUncommons: 20, rares: 6, holoRares: 2, reverseHolos: 2 };
const BULK_SHOEBOX = 200;

function byRarity(cards: readonly CardDef[], rarities: readonly Rarity[]): CardDef[] {
  return cards.filter((card) => rarities.includes(card.rarity));
}

/** Deterministic starting singles drawn from the starter set's cards (misc stream). */
function starterSingles(cards: readonly CardDef[], rng: Rng): Record<string, number> {
  const stacks: Record<string, number> = {};
  const add = (card: CardDef | undefined, finish: CardDef['finishes'][number]) => {
    if (!card) return;
    const key = cardKey({ cardId: card.id, finish });
    stacks[key] = (stacks[key] ?? 0) + 1;
  };
  const cu = byRarity(cards, ['common', 'uncommon']);
  const rares = byRarity(cards, ['rare']);
  const holos = byRarity(cards, ['holoRare']);
  const reversible = cu.filter((card) => card.finishes.includes('reverseHolo'));

  if (cu.length > 0) {
    for (let i = 0; i < THEO_BINDER.commonsUncommons; i++) add(rng.pick(cu), 'normal');
    for (let i = 0; i < BULK_SHOEBOX; i++) add(rng.pick(cu), 'normal');
  }
  if (rares.length > 0) for (let i = 0; i < THEO_BINDER.rares; i++) add(rng.pick(rares), 'normal');
  if (holos.length > 0)
    for (let i = 0; i < THEO_BINDER.holoRares; i++) add(rng.pick(holos), 'holo');
  if (reversible.length > 0) {
    for (let i = 0; i < THEO_BINDER.reverseHolos; i++) add(rng.pick(reversible), 'reverseHolo');
  }
  return stacks;
}

export function createNewGame(
  options: NewGameOptions,
  ctx: Pick<SimContext, 'balance' | 'content'>,
): GameState {
  const { balance, content } = ctx;
  const difficulty = balance.difficulty[options.difficulty];

  const rng = {} as Record<RngStream, GameState['rng'][RngStream]>;
  for (const stream of RNG_STREAMS) rng[stream] = seedStream(options.seed, stream);

  const sealed: GameState['inventory']['sealed'] = {};
  for (const item of STARTING_SEALED) {
    if (!content.products.has(item.productId)) continue; // test content may omit starter products
    sealed[item.productId] = [{ qty: item.qty, unitCostCents: item.unitCostCents, acquiredDay: 0 }];
  }

  // Every product starts at MSRP (docs/01 §9.2 "MSRP" helper is the default).
  const prices: GameState['pricing']['prices'] = {};
  for (const product of content.products.values()) prices[product.id] = product.msrpCents;

  const layout = content.layouts.get(STARTER_LAYOUT_ID);
  const fixtures: PlacedFixture[] = (layout?.fixtures ?? []).map((placed) => ({
    uid: placed.uid,
    fixtureId: placed.fixtureId,
    x: placed.x,
    z: placed.z,
    rot: placed.rot,
    slots: Array.from({ length: content.fixtures.get(placed.fixtureId)?.slots.count ?? 0 }, () => ({
      qty: 0,
      costCents: 0,
    })),
  }));

  const starterCards = [...content.cards.values()].filter((card) => card.setId === STARTER_SET_ID);
  const cardStacks = starterSingles(starterCards, createRng(rng.misc));
  const owned: Record<string, number> = {};
  for (const key of Object.keys(cardStacks)) owned[key.split('|')[0] ?? key] = 0;

  const state: GameState = {
    meta: {
      saveVersion: SAVE_VERSION,
      gameVersion: options.gameVersion,
      seed: options.seed,
      createdAt: options.createdAt,
      playTimeMs: 0,
      difficulty: options.difficulty,
      shopName: options.shopName,
      owner: options.owner ?? DEFAULT_OWNER,
    },
    rng,
    clock: { day: 1, minute: balance.time.prepMinute, phase: 'prep', speed: 1 },
    finance: {
      cashCents: difficulty.startingCash,
      loan: { principalCents: 0 },
      ledger: [],
      today: emptyDailyTotals(),
    },
    progression: { level: 1, xp: 0, unlocked: {}, perks: [], flags: {} },
    reputation: {
      sub: { ...balance.reputation.start },
      signals: emptySignals(),
      history: [],
    },
    shop: { tier: 1, layoutId: layout?.id ?? STARTER_LAYOUT_ID, fixtures },
    inventory: { sealed, cardStacks },
    pricing: { prices },
    customers: { active: [], lane: [], nextUid: 1, nextArrivalMinute: null },
    suppliers: { orders: [], nextOrderUid: 1 },
    collection: { owned, binder: {} },
    dayLog: emptyDayLog(0),
    stats: {},
  };
  state.dayLog.repStart = reputationScore(state);
  grantUnlocks(state, { content, emit: () => undefined });
  if (options.starterShelves ?? true) stockStarterShelves(state, content);
  return state;
}

/** Moves Theo's shelf stock out of the closet onto the first wall shelf (FIFO cost basis). */
function stockStarterShelves(state: GameState, content: ContentRegistry): void {
  for (const plan of STARTER_SHELVES) {
    const fixture = state.shop.fixtures.find((f) => f.uid === plan.fixtureUid);
    const slot = fixture?.slots[plan.slot];
    const product = content.products.get(plan.productId);
    if (!slot || !product || slot.qty > 0) continue; // test content may differ
    const taken = takeSealed(state, plan.productId, Math.min(plan.qty, product.perShelfSlot));
    if (taken.qty === 0) continue;
    slot.productId = plan.productId;
    slot.qty = taken.qty;
    slot.costCents = taken.costCents;
  }
}
