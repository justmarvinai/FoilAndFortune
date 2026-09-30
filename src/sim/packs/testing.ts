import { type BalanceConfig, defaultBalance } from '@/content/balance';
import { buildRegistry, type ContentSource, defaultContentSource } from '@/content/registry';
import type { Finish, Rarity } from '@/content/schema/common';
import type { CardDef, PackConfigDef, ProductDef, SetDef } from '@/content/schema/tcg';
import type { Cents } from '@/core/money';
import type { PureContext } from '../engine';
import { createNewGame } from '../state/createNewGame';
import type { GameState } from '../state/types';
import { putSealed } from '../systems/inventory';

/**
 * Synthetic pack content for tests (never imported by production code): a set with every rarity
 * at the typical values of docs/02 §7.1, a copy of the modern booster config (docs/02 §11.1) and
 * one product of each openable kind. It doesn't depend on the real Emberdawn list, which is still
 * being authored.
 */

export const ALPHA = 'test.alpha';
export const SPARSE = 'test.sparse';

export const P = {
  booster: 'test.alpha.booster',
  blister: 'test.alpha.blister',
  bundle: 'test.alpha.bundle',
  box: 'test.alpha.box',
  starter: 'test.alpha.starter',
  sparseBooster: 'test.sparse.booster',
  emptyBooster: 'test.empty.booster',
  misconfigured: 'test.alpha.misconfigured',
  sleeves: 'test.sleeves',
} as const;

/** Typical NM base values per rarity (docs/02 §7.1). */
export const TYPICAL_CENTS: Record<Rarity, Cents> = {
  common: 10,
  uncommon: 20,
  rare: 60,
  holoRare: 220,
  ultraRare: 800,
  illustrationRare: 1400,
  secretRare: 3600,
  mythicRare: 20000,
  promo: 400,
};

const FINISHES: Record<Rarity, Finish[]> = {
  common: ['normal', 'reverseHolo'],
  uncommon: ['normal', 'reverseHolo'],
  rare: ['normal', 'reverseHolo'],
  holoRare: ['holo'],
  ultraRare: ['fullArtTextured'],
  illustrationRare: ['fullArtTextured'],
  secretRare: ['gold', 'rainbow'],
  mythicRare: ['cosmos'],
  promo: ['holo'],
};

export function testCard(
  setId: string,
  number: number,
  rarity: Rarity,
  overrides: Partial<CardDef> = {},
): CardDef {
  return {
    id: `${setId}.${String(number).padStart(3, '0')}`,
    setId,
    number,
    name: `Test ${rarity} ${number}`,
    kind: 'tactic',
    tacticType: 'item',
    rarity,
    finishes: FINISHES[rarity],
    illustrator: 'Test Artist',
    art: { composition: 'window', pose: 'idle', timeOfDay: 'day', seed: number },
    baseValueCents: TYPICAL_CENTS[rarity],
    playability: 0,
    ...overrides,
  };
}

function setCards(setId: string, counts: readonly [Rarity, number][]): CardDef[] {
  const cards: CardDef[] = [];
  let number = 1;
  for (const [rarity, count] of counts) {
    for (let i = 0; i < count; i++) cards.push(testCard(setId, number++, rarity));
  }
  return cards;
}

/** The alpha set: every rarity, plus a basic Essence (starter decks only) and two promos. */
export const alphaCards: readonly CardDef[] = [
  ...setCards(ALPHA, [
    ['common', 10],
    ['uncommon', 8],
    ['rare', 6],
    ['holoRare', 5],
    ['ultraRare', 4],
    ['illustrationRare', 4],
    ['secretRare', 3],
    ['mythicRare', 2],
  ]),
  testCard(ALPHA, 90, 'common', { kind: 'essence', tacticType: undefined, finishes: ['normal'] }),
  testCard(ALPHA, 201, 'promo'),
  testCard(ALPHA, 202, 'promo'),
];

/** The sparse set: only Common, Uncommon, Holo Rare and Secret Rare (rarity fallback). */
export const sparseCards: readonly CardDef[] = setCards(SPARSE, [
  ['common', 3],
  ['uncommon', 2],
  ['holoRare', 2],
  ['secretRare', 1],
]);

export function idsOf(cards: readonly CardDef[], rarity: Rarity): string[] {
  return cards.filter((card) => card.rarity === rarity && card.kind !== 'essence').map((c) => c.id);
}

export const ESSENCE_ID = `${ALPHA}.090`;
export const PROMO_IDS = [`${ALPHA}.201`, `${ALPHA}.202`];

/** A copy of the modern Glimmerkin booster (docs/02 §11.1). */
export const testPackConfig: PackConfigDef = {
  id: 'test.pack.modern',
  cardsPerPack: 10,
  slots: [
    { count: 5, table: [{ rarity: 'common', weight: 1 }] },
    { count: 3, table: [{ rarity: 'uncommon', weight: 1 }] },
    {
      count: 1,
      table: [
        { rarity: 'common', finish: 'reverseHolo', weight: 60 },
        { rarity: 'uncommon', finish: 'reverseHolo', weight: 30 },
        { rarity: 'rare', finish: 'reverseHolo', weight: 10 },
      ],
    },
    {
      count: 1,
      table: [
        { rarity: 'rare', weight: 62.5 },
        { rarity: 'holoRare', weight: 25 },
        { rarity: 'ultraRare', weight: 8 },
        { rarity: 'illustrationRare', weight: 3 },
        { rarity: 'secretRare', weight: 1.2 },
        { rarity: 'mythicRare', weight: 0.3 },
      ],
    },
  ],
  misprintChancePerCard: 1 / 5000,
};

/** The starter deck's guaranteed-holo pool (docs/02 §11.2: one holo from a pool of 3). */
export const HOLO_POOL = idsOf(alphaCards, 'holoRare').slice(0, 3);

/** The starter deck's list: 8 basic Essences, 11 commons and one explicit reverse holo. */
export const STARTER_LIST: { cardId: string; finish?: Finish }[] = [
  ...Array.from({ length: 8 }, () => ({ cardId: ESSENCE_ID })),
  ...idsOf(alphaCards, 'common').map((cardId) => ({ cardId })),
  { cardId: `${ALPHA}.001` },
  { cardId: `${ALPHA}.011`, finish: 'reverseHolo' },
];

function product(
  id: string,
  kind: ProductDef['kind'],
  msrpCents: Cents,
  storageUnits: number,
  rest: Partial<ProductDef> = {},
): ProductDef {
  return { id, kind, name: id, msrpCents, storageUnits, perShelfSlot: 4, contents: [], ...rest };
}

export const testProducts: readonly ProductDef[] = [
  product(P.booster, 'booster', 449, 1, { setId: ALPHA, packConfigId: testPackConfig.id }),
  product(P.blister, 'blister', 1499, 2, {
    setId: ALPHA,
    contents: [
      { type: 'pack', productId: P.booster, count: 3 },
      { type: 'promoPool', cardIds: PROMO_IDS, count: 1 },
    ],
  }),
  product(P.bundle, 'bundle', 2699, 3, {
    setId: ALPHA,
    contents: [{ type: 'pack', productId: P.booster, count: 6 }],
  }),
  product(P.box, 'box', 16164, 18, {
    setId: ALPHA,
    contents: [{ type: 'pack', productId: P.booster, count: 36 }],
  }),
  product(P.starter, 'starterDeck', 1499, 2, {
    setId: ALPHA,
    contents: [
      { type: 'fixedCards', cards: STARTER_LIST },
      { type: 'guaranteedHoloPool', cardIds: HOLO_POOL },
    ],
  }),
  product(P.sparseBooster, 'booster', 449, 1, { setId: SPARSE, packConfigId: testPackConfig.id }),
  product(P.emptyBooster, 'booster', 449, 1, {
    setId: 'test.empty',
    packConfigId: testPackConfig.id,
  }),
  product(P.misconfigured, 'booster', 449, 1, { setId: ALPHA, packConfigId: 'test.pack.nope' }),
  product(P.sleeves, 'accessory', 999, 1),
];

function testSet(id: string, code: string): SetDef {
  return {
    id,
    brandId: 'gk',
    code,
    name: id,
    era: 'modern',
    releaseDay: 0,
    totalMain: 100,
    theme: 'Test content',
  };
}

export function packTestSource(): ContentSource {
  return {
    ...defaultContentSource,
    sets: [testSet(ALPHA, 'TAL'), testSet(SPARSE, 'TSP')],
    cards: [...alphaCards, ...sparseCards],
    packConfigs: [testPackConfig],
    products: testProducts,
  };
}

const registry = buildRegistry(packTestSource());

/** The synthetic content with the default balance, or with pack rules overridden. */
export function packTestContext(packs: Partial<BalanceConfig['packs']> = {}): PureContext {
  return {
    content: registry,
    balance: { ...defaultBalance, packs: { ...defaultBalance.packs, ...packs } },
  };
}

/** Sealed stock of every test product: [productId, qty, unit cost]. */
export const TEST_STOCK: readonly [string, number, Cents][] = [
  [P.booster, 40, 325],
  [P.blister, 6, 1050],
  [P.bundle, 2, 1750],
  [P.box, 3, 10400],
  [P.starter, 4, 1000],
  [P.sparseBooster, 20, 325],
  [P.emptyBooster, 2, 325],
  [P.misconfigured, 2, 325],
  [P.sleeves, 2, 450],
];

/** A fresh game (no singles, nothing owned) with `stock` in storage. */
export function packTestGame(
  ctx: PureContext,
  seed = 1234,
  stock: readonly [string, number, Cents][] = TEST_STOCK,
): GameState {
  const game = createNewGame(
    {
      seed,
      shopName: 'Pack Lab',
      difficulty: 'standard',
      createdAt: '2026-09-30T12:00:00.000Z',
      gameVersion: 'test',
    },
    ctx,
  );
  for (const [productId, qty, unitCostCents] of stock) {
    putSealed(game, productId, qty, unitCostCents, 0);
  }
  return game;
}
