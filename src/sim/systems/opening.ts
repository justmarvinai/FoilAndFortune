import type { ContentRegistry } from '@/content/registry';
import type { Rarity } from '@/content/schema/common';
import type { ProductDef } from '@/content/schema/tcg';
import { assertNever } from '@/core/assert';
import type { Cents } from '@/core/money';
import { createRng, type Rng, type RngState } from '@/core/rng';
import { type CommandResult, fail, ok } from '../commands';
import type { SimContext } from '../context';
import type { PackResult, PulledCard } from '../events';
import { type DrawnCard, generatePackRun, type PackSource, packRules } from '../packs/generate';
import { pulledCardKey } from '../packs/misprints';
import { type CardPool, setCardPool } from '../packs/pool';
import { defaultFinish, isHit } from '../packs/rarity';
import { itemMarketValue } from '../pricing';
import type { GameState } from '../state/types';
import { noteBestPull } from './dayLog';
import { addPulledCards, putSealed, sealedInStorage, takeSealed } from './inventory';
import { storageCapacity, storageUsed } from './orders';
import { addXp } from './progression';

/**
 * Opening sealed product (docs/01 §14, docs/02 §11): boosters, blisters, starter decks and
 * booster boxes, plus breaking a box into loose packs (docs/01 §14.4). Both commands work in any
 * phase. The pack generator lives in `src/sim/packs`.
 */

/** Progression flags of the hidden onboarding luck (docs/02 §11.1). */
export const FIRST_PACK_FLAG = 'onboarding.firstPackOpened';
export const FIRST_BOX_FLAG = 'onboarding.firstBoxOpened';

interface PromoDraw {
  cardIds: string[];
  count: number;
}

interface OpeningPlan {
  /** One entry per pack, in opening order. */
  packs: { productId: string; source: PackSource }[];
  promos: PromoDraw[];
  /** A starter deck: its fixed list, then one guaranteed holo per pool. */
  deck: { fixed: PulledCard[]; holoPools: string[][] } | null;
  /** Booster boxes get box mapping (docs/02 §11.1). */
  isBox: boolean;
}

/**
 * What opening one unit yields, or null when nothing in it can be opened (no packs, cards or
 * pools, or a pack without a known config or cards to draw from). Booster = the product's own pack
 * config; other products list their packs, fixed cards and pools in `contents`. Unknown card ids
 * in lists and pools are skipped.
 */
function planOpening(content: ContentRegistry, product: ProductDef): OpeningPlan | null {
  const pools = new Map<string, CardPool>();
  const sourceFor = (pack: ProductDef): PackSource | null => {
    const config = pack.packConfigId ? content.packConfigs.get(pack.packConfigId) : undefined;
    const setId = pack.setId ?? product.setId;
    if (!config || !setId) return null;
    let pool = pools.get(setId);
    if (!pool) {
      pool = setCardPool(content.cards.values(), setId);
      pools.set(setId, pool);
    }
    return pool.size > 0 ? { config, pool } : null;
  };

  const plan: OpeningPlan = { packs: [], promos: [], deck: null, isBox: product.kind === 'box' };
  const fixed: PulledCard[] = [];
  const holoPools: string[][] = [];
  let listsPacks = false;
  for (const entry of product.contents) {
    switch (entry.type) {
      case 'pack': {
        listsPacks = true;
        const pack = content.products.get(entry.productId);
        const source = pack ? sourceFor(pack) : null;
        if (!source) return null;
        for (let i = 0; i < entry.count; i++)
          plan.packs.push({ productId: entry.productId, source });
        break;
      }
      case 'fixedCards':
        for (const listed of entry.cards) {
          const card = content.cards.get(listed.cardId);
          if (card) fixed.push({ cardId: card.id, finish: listed.finish ?? defaultFinish(card) });
        }
        break;
      case 'promoPool': {
        const cardIds = entry.cardIds.filter((id) => content.cards.has(id));
        if (cardIds.length > 0 && entry.count > 0)
          plan.promos.push({ cardIds, count: entry.count });
        break;
      }
      case 'guaranteedHoloPool': {
        const cardIds = entry.cardIds.filter((id) => content.cards.has(id));
        if (cardIds.length > 0) holoPools.push(cardIds);
        break;
      }
      default:
        return assertNever(entry, 'content entry');
    }
  }
  if (!listsPacks && product.packConfigId) {
    const source = sourceFor(product);
    if (!source) return null;
    plan.packs.push({ productId: product.id, source });
  }
  if (fixed.length > 0 || holoPools.length > 0) plan.deck = { fixed, holoPools };
  if (plan.packs.length === 0 && plan.promos.length === 0 && !plan.deck) return null;
  return plan;
}

interface UnboxPlan {
  /** Loose packs per product, in content order (the `product/unboxed` payload). */
  packs: { productId: string; qty: number }[];
  /** One product id per loose pack, for the cost split. */
  units: string[];
  storageUnits: number;
  promos: PromoDraw[];
}

/** Only products made of packs (plus optional promos) can be broken into loose packs. */
function planUnboxing(content: ContentRegistry, product: ProductDef): UnboxPlan | null {
  const plan: UnboxPlan = { packs: [], units: [], storageUnits: 0, promos: [] };
  for (const entry of product.contents) {
    if (entry.type === 'pack') {
      const pack = content.products.get(entry.productId);
      if (!pack) return null;
      const listed = plan.packs.find((line) => line.productId === pack.id);
      if (listed) listed.qty += entry.count;
      else plan.packs.push({ productId: pack.id, qty: entry.count });
      for (let i = 0; i < entry.count; i++) plan.units.push(pack.id);
      plan.storageUnits += entry.count * pack.storageUnits;
    } else if (entry.type === 'promoPool') {
      const cardIds = entry.cardIds.filter((id) => content.cards.has(id));
      if (cardIds.length > 0 && entry.count > 0) plan.promos.push({ cardIds, count: entry.count });
    } else {
      return null;
    }
  }
  return plan.units.length > 0 ? plan : null;
}

/** Whether `open/openProduct` can open this product at all (stock aside). */
export function canOpenProduct(content: ContentRegistry, productId: string): boolean {
  const product = content.products.get(productId);
  return product !== undefined && planOpening(content, product) !== null;
}

/** Whether `open/unboxProduct` can break this product into loose packs (stock aside). */
export function canUnboxProduct(content: ContentRegistry, productId: string): boolean {
  const product = content.products.get(productId);
  return product !== undefined && planUnboxing(content, product) !== null;
}

/**
 * Splits a cost basis into `parts` whole-cent shares that sum exactly to `totalCents` and differ
 * by at most one cent (the first `total mod parts` shares carry the extra cent).
 */
export function splitCents(totalCents: Cents, parts: number): Cents[] {
  if (!Number.isSafeInteger(parts) || parts <= 0) return [];
  const base = Math.floor(totalCents / parts);
  const extra = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) => (i < extra ? base + 1 : base));
}

/**
 * The packs stream, detached from the (draft) state so hundreds of draws don't each write through
 * an Immer proxy. `commit` writes the advanced stream back.
 */
function packsStream(state: GameState): { rng: Rng; commit(): void } {
  const [a, b, c, d] = state.rng.packs;
  const words: RngState = [a, b, c, d];
  return {
    rng: createRng(words),
    commit: () => {
      state.rng.packs = words;
    },
  };
}

function drawPromos(draws: readonly PromoDraw[], content: ContentRegistry, rng: Rng): PulledCard[] {
  const cards: PulledCard[] = [];
  for (const draw of draws) {
    for (let i = 0; i < draw.count; i++) {
      const card = content.cards.get(rng.pick(draw.cardIds));
      if (card) cards.push({ cardId: card.id, finish: defaultFinish(card) });
    }
  }
  return cards;
}

/** The deck list in order, with the guaranteed holo(s) last so the reveal ends on them. */
function deckCards(
  deck: NonNullable<OpeningPlan['deck']>,
  content: ContentRegistry,
  rng: Rng,
): PulledCard[] {
  const cards = [...deck.fixed];
  for (const pool of deck.holoPools) {
    const card = content.cards.get(rng.pick(pool));
    if (!card) continue;
    cards.push({
      cardId: card.id,
      finish: card.finishes.includes('holo') ? 'holo' : defaultFinish(card),
    });
  }
  return cards;
}

function pulledCard(card: DrawnCard): PulledCard {
  return card.misprint
    ? { cardId: card.cardId, finish: card.finish, misprint: card.misprint }
    : { cardId: card.cardId, finish: card.finish };
}

function bumpStat(state: GameState, key: string, by = 1): void {
  if (by > 0) state.stats[key] = (state.stats[key] ?? 0) + by;
}

/**
 * Books cards that just went into the stacks (after the product event): `card/pulled` for every
 * hit, the day's best pull, the day log, lifetime stats and XP (docs/02 §9.1: +2 per booster
 * pack, +1 per NEW card, pull XP for Holo Rare and better).
 */
function creditCards(
  state: GameState,
  ctx: SimContext,
  cards: readonly PulledCard[],
  newCardIds: readonly string[],
  packsOpened: number,
): void {
  const { progression } = ctx.balance;
  const pullXpTable: Partial<Record<Rarity, number>> = progression.xpPerPull;
  const unseen = new Set(newCardIds);
  let pullXp = 0;
  let misprints = 0;
  let best: { card: PulledCard; valueCents: Cents } | null = null;

  for (const card of cards) {
    const isNew = unseen.delete(card.cardId);
    if (card.misprint) misprints += 1;
    const valueCents = itemMarketValue(ctx, { cardKey: pulledCardKey(card) }) ?? 0;
    if (!best || valueCents > best.valueCents) best = { card, valueCents };
    const rarity = ctx.content.cards.get(card.cardId)?.rarity;
    if (!rarity || !isHit(rarity)) continue;
    pullXp += pullXpTable[rarity] ?? 0;
    bumpStat(state, `pulls.${rarity}`);
    ctx.emit({ type: 'card/pulled', cardId: card.cardId, finish: card.finish, rarity, isNew });
  }

  if (best) noteBestPull(state, best.card.cardId, best.card.finish, best.valueCents);
  state.dayLog.packsOpened += packsOpened;
  state.dayLog.newCards += newCardIds.length;
  bumpStat(state, 'packsOpened', packsOpened);
  bumpStat(state, 'cardsPulled', cards.length);
  bumpStat(state, 'misprints', misprints);
  addXp(
    state,
    ctx,
    packsOpened * progression.xpPerPackOpened + newCardIds.length * progression.xpPerNewCard,
    'opening',
  );
  addXp(state, ctx, pullXp, 'pull');
}

/**
 * Opens one unit from storage (docs/01 §14, docs/02 §11): takes it FIFO (its cost basis goes to
 * today's "opened stock"), generates every pack, promo and deck card, puts them in the stacks and
 * emits `product/opened` with all results in reveal order, then `card/pulled` per hit.
 *
 * Contract with the engine (keep this signature).
 */
export function openProduct(state: GameState, ctx: SimContext, productId: string): CommandResult {
  const product = ctx.content.products.get(productId);
  if (!product) return fail('UNKNOWN_PRODUCT', { productId });
  const plan = planOpening(ctx.content, product);
  if (!plan) return fail('NOT_OPENABLE', { productId });
  if (sealedInStorage(state, productId) < 1) return fail('NOT_ENOUGH_STOCK', { productId });

  const { costCents } = takeSealed(state, productId, 1);
  state.finance.today.opened += costCents;

  // Hidden onboarding luck (docs/02 §11.1): the first pack ever and the first box ever.
  const { flags } = state.progression;
  const { onboarding, boxMapping } = ctx.balance.packs;
  const firstPack = plan.packs.length > 0 && !flags[FIRST_PACK_FLAG];
  const firstBox = plan.isBox && !flags[FIRST_BOX_FLAG];
  if (firstPack) flags[FIRST_PACK_FLAG] = true;
  if (firstBox) flags[FIRST_BOX_FLAG] = true;

  const stream = packsStream(state);
  const generated = generatePackRun(
    plan.packs.map((pack) => pack.source),
    stream.rng,
    packRules(ctx.balance),
    {
      boxMapping: plan.isBox ? boxMapping : null,
      firstPackCardId: firstPack ? onboarding.firstPackCardId : null,
      minRarity: firstBox ? onboarding.firstBoxMinRarity : null,
    },
  );
  const promos = drawPromos(plan.promos, ctx.content, stream.rng);
  const deck = plan.deck ? deckCards(plan.deck, ctx.content, stream.rng) : null;
  stream.commit();

  // Reveal order: the outer product's promos, then the deck, then the packs (docs/01 §14.2).
  const results: PackResult[] = [];
  if (promos.length > 0) results.push({ productId, kind: 'promo', cards: promos });
  if (deck) results.push({ productId, kind: 'deck', cards: deck });
  generated.forEach((pack, i) => {
    const result: PackResult = {
      productId: plan.packs[i]?.productId ?? productId,
      kind: 'pack',
      cards: pack.cards.map(pulledCard),
    };
    if (pack.godPack) result.godPack = true;
    results.push(result);
  });

  const cards = results.flatMap((result) => result.cards);
  const newCardIds = addPulledCards(state, cards);
  ctx.emit({ type: 'product/opened', productId, packs: results, newCardIds, costCents });

  bumpStat(state, 'productsOpened');
  if (plan.isBox) bumpStat(state, 'boxesOpened');
  bumpStat(state, 'godPacks', generated.filter((pack) => pack.godPack).length);
  creditCards(state, ctx, cards, newCardIds, generated.length);
  return ok;
}

/**
 * Breaks one unit of a product whose contents are only packs (plus promos) into loose sealed
 * packs in storage, splitting its cost basis exactly; promos go to the card stacks. The loose
 * packs must fit in storage.
 *
 * Contract with the engine (keep this signature).
 */
export function unboxProduct(state: GameState, ctx: SimContext, productId: string): CommandResult {
  const product = ctx.content.products.get(productId);
  if (!product) return fail('UNKNOWN_PRODUCT', { productId });
  const plan = planUnboxing(ctx.content, product);
  if (!plan) return fail('NOT_OPENABLE', { productId });
  if (sealedInStorage(state, productId) < 1) return fail('NOT_ENOUGH_STOCK', { productId });
  const needed = plan.storageUnits - product.storageUnits;
  if (needed > 0) {
    const free = storageCapacity(state, ctx) - storageUsed(state, ctx);
    if (needed > free) return fail('STORAGE_FULL', { needed, free: Math.max(0, free) });
  }

  const { costCents } = takeSealed(state, productId, 1);
  const shares = splitCents(costCents, plan.units.length);
  const lots: { productId: string; qty: number; unitCostCents: Cents }[] = [];
  plan.units.forEach((unitProductId, i) => {
    const unitCostCents = shares[i] ?? 0;
    const last = lots[lots.length - 1];
    if (last && last.productId === unitProductId && last.unitCostCents === unitCostCents) {
      last.qty += 1;
    } else {
      lots.push({ productId: unitProductId, qty: 1, unitCostCents });
    }
  });
  for (const lot of lots) {
    putSealed(state, lot.productId, lot.qty, lot.unitCostCents, state.clock.day);
  }

  let promos: PulledCard[] = [];
  if (plan.promos.length > 0) {
    const stream = packsStream(state);
    promos = drawPromos(plan.promos, ctx.content, stream.rng);
    stream.commit();
  }
  const newCardIds = addPulledCards(state, promos);
  ctx.emit(
    promos.length > 0
      ? { type: 'product/unboxed', productId, packs: plan.packs, promos }
      : { type: 'product/unboxed', productId, packs: plan.packs },
  );
  bumpStat(state, 'productsUnboxed');
  creditCards(state, ctx, promos, newCardIds, 0);
  return ok;
}
