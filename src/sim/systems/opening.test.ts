import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { defaultBalance } from '@/content/balance';
import type { Rarity } from '@/content/schema/common';
import type { Command } from '../commands';
import { type PureContext, runCommand } from '../engine';
import type { DomainEvent, DomainEventOf, DomainEventType } from '../events';
import { pulledCardKey } from '../packs/misprints';
import { isAtLeast, isFoil, isHit } from '../packs/rarity';
import {
  alphaCards,
  HOLO_POOL,
  idsOf,
  P,
  PROMO_IDS,
  packTestContext,
  packTestGame,
  STARTER_LIST,
} from '../packs/testing';
import { itemMarketValue } from '../pricing';
import { sealedQuantity } from '../selectors';
import { type GameState, RNG_STREAMS } from '../state/types';
import { putSealed } from './inventory';
import {
  canOpenProduct,
  canUnboxProduct,
  FIRST_BOX_FLAG,
  FIRST_PACK_FLAG,
  splitCents,
} from './opening';

const ctx = packTestContext();
const xpPerPull: Partial<Record<Rarity, number>> = ctx.balance.progression.xpPerPull;

function run(state: GameState, command: Command, context: PureContext = ctx) {
  return runCommand(state, command, context);
}
const open = (state: GameState, productId: string, context: PureContext = ctx) =>
  run(state, { type: 'open/openProduct', productId }, context);
const unbox = (state: GameState, productId: string) =>
  run(state, { type: 'open/unboxProduct', productId });

function eventsOf<T extends DomainEventType>(
  events: readonly DomainEvent[],
  type: T,
): DomainEventOf<T>[] {
  return events.filter((event): event is DomainEventOf<T> => event.type === type);
}

function eventOf<T extends DomainEventType>(
  events: readonly DomainEvent[],
  type: T,
): DomainEventOf<T> {
  const [event] = eventsOf(events, type);
  if (!event) throw new Error(`no ${type} event`);
  return event;
}

function stackTotal(state: GameState): number {
  let total = 0;
  for (const count of Object.values(state.inventory.cardStacks)) total += count;
  return total;
}

const rarityOf = (cardId: string): Rarity => ctx.content.cards.get(cardId)?.rarity ?? 'common';

/** A game whose hidden onboarding luck is already spent, so openings follow the tables. */
function veteranGame(seed = 1234): GameState {
  const game = packTestGame(ctx, seed);
  game.progression.flags[FIRST_PACK_FLAG] = true;
  game.progression.flags[FIRST_BOX_FLAG] = true;
  return game;
}

describe('open/openProduct: boosters', () => {
  it('takes one unit FIFO, books its cost as opened stock and stacks its 10 cards', () => {
    const game = veteranGame();
    game.inventory.sealed[P.booster] = [
      { qty: 1, unitCostCents: 300, acquiredDay: 0 },
      { qty: 5, unitCostCents: 350, acquiredDay: 0 },
    ];
    const first = open(game, P.booster);
    expect(first.result).toEqual({ ok: true });
    expect(first.state.finance.today.opened).toBe(300);
    expect(first.state.finance.cashCents).toBe(game.finance.cashCents);
    expect(sealedQuantity(first.state, P.booster)).toBe(5);
    expect(open(first.state, P.booster).state.finance.today.opened).toBe(650);

    const opened = eventOf(first.events, 'product/opened');
    expect(opened).toMatchObject({ productId: P.booster, costCents: 300 });
    expect(opened.packs).toHaveLength(1);
    const [pack] = opened.packs;
    expect(pack).toMatchObject({ productId: P.booster, kind: 'pack' });
    expect(pack?.cards).toHaveLength(10);
    expect(stackTotal(first.state) - stackTotal(game)).toBe(10);
    for (const card of pack?.cards ?? []) {
      expect(first.state.inventory.cardStacks[pulledCardKey(card)]).toBeGreaterThan(0);
    }
  });

  it('records first ownership, NEW cards, XP (docs/02 §9.1), the day log and stats', () => {
    const game = veteranGame();
    const { state, events } = open(game, P.booster);
    const opened = eventOf(events, 'product/opened');
    const cards = opened.packs.flatMap((pack) => pack.cards);
    const unique = [...new Set(cards.map((card) => card.cardId))];
    expect(opened.newCardIds).toEqual(unique);
    for (const id of unique) expect(state.collection.owned[id]).toBe(state.clock.day);

    const pullXp = cards.reduce((sum, card) => sum + (xpPerPull[rarityOf(card.cardId)] ?? 0), 0);
    const opening = { type: 'xp/gained', amount: 2 + unique.length, source: 'opening' };
    const pulls = pullXp > 0 ? [{ type: 'xp/gained', amount: pullXp, source: 'pull' }] : [];
    expect(eventsOf(events, 'xp/gained')).toEqual([opening, ...pulls]);

    const values = cards.map((card) => itemMarketValue(ctx, { cardKey: pulledCardKey(card) }) ?? 0);
    const best = values.indexOf(Math.max(...values));
    expect(state.dayLog).toMatchObject({
      packsOpened: 1,
      newCards: unique.length,
      xpGained: 2 + unique.length + pullXp,
      bestPull: {
        cardId: cards[best]?.cardId,
        finish: cards[best]?.finish,
        valueCents: values[best],
      },
    });
    expect(state.stats).toMatchObject({ productsOpened: 1, packsOpened: 1, cardsPulled: 10 });
  });

  it('emits card/pulled for every Holo Rare or better; NEW only for the first copy', () => {
    const once = open(veteranGame(7), P.box).state;
    const ownedBefore = new Set(Object.keys(once.collection.owned));
    const { events } = open(once, P.box);
    const cards = eventOf(events, 'product/opened').packs.flatMap((pack) => pack.cards);
    const seen = new Set(ownedBefore);
    const expected = [];
    for (const card of cards) {
      const isNew = !seen.has(card.cardId);
      seen.add(card.cardId);
      const rarity = rarityOf(card.cardId);
      if (isHit(rarity)) {
        expected.push({
          type: 'card/pulled',
          cardId: card.cardId,
          finish: card.finish,
          rarity,
          isNew,
        });
      }
    }
    expect(expected.length).toBeGreaterThanOrEqual(8);
    expect(eventsOf(events, 'card/pulled')).toEqual(expected);
  });

  it('rolls god packs and misprints from the balance, misprints as stack-key stamps', () => {
    const godPacks = packTestContext({ godPack: { ...defaultBalance.packs.godPack, chance: 1 } });
    const god = open(veteranGame(), P.booster, godPacks);
    expect(eventOf(god.events, 'product/opened').packs[0]?.godPack).toBe(true);
    expect(eventsOf(god.events, 'card/pulled')).toHaveLength(10);
    expect(god.state.stats.godPacks).toBe(1);

    const misprints = packTestContext({
      misprint: { ...defaultBalance.packs.misprint, chancePerCard: 1 },
    });
    const { state, events } = open(veteranGame(), P.booster, misprints);
    const cards = eventOf(events, 'product/opened').packs[0]?.cards ?? [];
    expect(cards.every((card) => card.misprint !== undefined)).toBe(true);
    expect(cards.some((card) => card.misprint === 'missingFoil' && !isFoil(card.finish))).toBe(
      false,
    );
    expect(state.stats.misprints).toBe(10);
    for (const card of cards) {
      const key = pulledCardKey(card);
      expect(key).toContain(`|misprint.${card.misprint}|`);
      expect(state.inventory.cardStacks[key]).toBeGreaterThan(0);
    }
  });
});

describe('open/openProduct: other products', () => {
  it('opens a blister: its promo first, then three packs', () => {
    const game = veteranGame();
    const { state, events } = open(game, P.blister);
    const opened = eventOf(events, 'product/opened');
    expect(opened.packs.map((pack) => [pack.kind, pack.productId])).toEqual([
      ['promo', P.blister],
      ['pack', P.booster],
      ['pack', P.booster],
      ['pack', P.booster],
    ]);
    const promo = opened.packs[0]?.cards ?? [];
    expect(promo).toHaveLength(1);
    expect(PROMO_IDS).toContain(promo[0]?.cardId);
    expect(promo[0]?.finish).toBe('holo');
    expect(stackTotal(state) - stackTotal(game)).toBe(31);
    expect(state.dayLog.packsOpened).toBe(3);
    expect(eventsOf(events, 'xp/gained')[0]).toEqual({
      type: 'xp/gained',
      amount: 3 * 2 + opened.newCardIds.length,
      source: 'opening',
    });
  });

  it('opens a starter deck: the list in order with the guaranteed holo last, no pack XP', () => {
    const { state, events } = open(veteranGame(), P.starter);
    const opened = eventOf(events, 'product/opened');
    expect(opened.packs).toHaveLength(1);
    const [deck] = opened.packs;
    expect(deck).toMatchObject({ productId: P.starter, kind: 'deck' });
    const cards = deck?.cards ?? [];
    expect(cards.slice(0, -1)).toEqual(
      STARTER_LIST.map(({ cardId, finish }) => ({ cardId, finish: finish ?? 'normal' })),
    );
    const holo = cards.at(-1);
    expect(HOLO_POOL).toContain(holo?.cardId);
    expect(holo?.finish).toBe('holo');
    expect(state.dayLog.packsOpened).toBe(0);
    expect(state.stats.packsOpened).toBeUndefined();
    expect(eventsOf(events, 'xp/gained')).toEqual([
      { type: 'xp/gained', amount: opened.newCardIds.length, source: 'opening' },
      { type: 'xp/gained', amount: xpPerPull.holoRare, source: 'pull' },
    ]);
    expect(eventsOf(events, 'card/pulled')).toEqual([
      {
        type: 'card/pulled',
        cardId: holo?.cardId,
        finish: 'holo',
        rarity: 'holoRare',
        isNew: true,
      },
    ]);
  });

  it('opens a booster box: 36 packs with box mapping', () => {
    const { state, events } = open(veteranGame(), P.box);
    const opened = eventOf(events, 'product/opened');
    expect(opened.packs).toHaveLength(36);
    expect(opened.costCents).toBe(10400);
    const rarities = opened.packs.flatMap((pack) => pack.cards.map((c) => rarityOf(c.cardId)));
    expect(rarities.filter((r) => r === 'holoRare').length).toBeGreaterThanOrEqual(6);
    expect(rarities.filter((r) => isAtLeast(r, 'ultraRare')).length).toBeGreaterThanOrEqual(2);
    expect(state.stats).toMatchObject({ boxesOpened: 1, packsOpened: 36, cardsPulled: 360 });
    expect(state.dayLog.packsOpened).toBe(36);
    expect(state.finance.today.opened).toBe(10400);
  });

  it('works in every phase', () => {
    for (const phase of ['prep', 'open', 'night'] as const) {
      const game = veteranGame();
      game.clock.phase = phase;
      expect(open(game, P.booster).result).toEqual({ ok: true });
    }
  });
});

describe('onboarding luck (docs/02 §11.1)', () => {
  const sparkit = idsOf(alphaCards, 'holoRare')[4] ?? '';
  const lucky = packTestContext({
    onboarding: { ...defaultBalance.packs.onboarding, firstPackCardId: sparkit },
  });

  it("puts the first-pack card in the very first pack's rare slot, once", () => {
    const first = open(packTestGame(lucky), P.booster, lucky);
    expect(eventOf(first.events, 'product/opened').packs[0]?.cards[9]).toMatchObject({
      cardId: sparkit,
      finish: 'holo',
    });
    expect(first.state.progression.flags[FIRST_PACK_FLAG]).toBe(true);

    let state = first.state;
    let forced = 0;
    for (let i = 0; i < 30; i++) {
      const next = open(state, P.booster, lucky);
      state = next.state;
      if (eventOf(next.events, 'product/opened').packs[0]?.cards[9]?.cardId === sparkit) forced++;
    }
    // Naturally 25% × 1/5 = 5% of rare slots.
    expect(forced).toBeLessThan(8);
  });

  it('skips starter decks and applies to the first pack of a blister', () => {
    const deck = open(packTestGame(lucky), P.starter, lucky);
    expect(deck.state.progression.flags[FIRST_PACK_FLAG]).toBeUndefined();
    const blister = open(deck.state, P.blister, lucky);
    const packs = eventOf(blister.events, 'product/opened').packs.filter((p) => p.kind === 'pack');
    expect(packs[0]?.cards[9]).toMatchObject({ cardId: sparkit, finish: 'holo' });
  });

  it('spends the first-pack luck even when its card is missing from the content', () => {
    // The default balance names an Emberdawn card the synthetic set doesn't have.
    const { state, result } = open(packTestGame(ctx), P.booster);
    expect(result.ok).toBe(true);
    expect(state.progression.flags[FIRST_PACK_FLAG]).toBe(true);
  });

  it('gives the first box an Illustration Rare or better, on top of box mapping', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { state, events } = open(packTestGame(ctx, seed), P.box);
      const opened = eventOf(events, 'product/opened');
      const rarities = opened.packs.flatMap((pack) => pack.cards.map((c) => rarityOf(c.cardId)));
      expect(rarities.some((rarity) => isAtLeast(rarity, 'illustrationRare'))).toBe(true);
      expect(rarities.filter((r) => r === 'holoRare').length).toBeGreaterThanOrEqual(6);
      expect(rarities.filter((r) => isAtLeast(r, 'ultraRare')).length).toBeGreaterThanOrEqual(2);
      expect(state.progression.flags).toMatchObject({
        [FIRST_PACK_FLAG]: true,
        [FIRST_BOX_FLAG]: true,
      });
    }
  });
});

describe('open/openProduct: validation and determinism', () => {
  it('validates the product and the stock; failures are atomic', () => {
    const game = veteranGame();
    const failures: [string, string][] = [
      ['gk.nope', 'UNKNOWN_PRODUCT'],
      [P.sleeves, 'NOT_OPENABLE'],
      [P.misconfigured, 'NOT_OPENABLE'],
      [P.emptyBooster, 'NOT_OPENABLE'],
    ];
    for (const [productId, code] of failures) {
      const outcome = open(game, productId);
      expect(outcome.result).toEqual({ ok: false, code, params: { productId } });
      expect(outcome.state).toBe(game);
      expect(outcome.events).toEqual([]);
    }
    const noBundles = veteranGame();
    delete noBundles.inventory.sealed[P.bundle];
    const outcome = open(noBundles, P.bundle);
    expect(outcome.result).toEqual({
      ok: false,
      code: 'NOT_ENOUGH_STOCK',
      params: { productId: P.bundle },
    });
    expect(outcome.state).toBe(noBundles);
  });

  it('tells the UI what can be opened or broken into packs', () => {
    const openable = [P.booster, P.blister, P.bundle, P.box, P.starter, P.sparseBooster];
    for (const id of openable) expect(canOpenProduct(ctx.content, id)).toBe(true);
    for (const id of [P.sleeves, P.misconfigured, P.emptyBooster, 'gk.nope']) {
      expect(canOpenProduct(ctx.content, id)).toBe(false);
    }
    for (const id of [P.box, P.blister, P.bundle])
      expect(canUnboxProduct(ctx.content, id)).toBe(true);
    for (const id of [P.booster, P.starter, P.sleeves, 'gk.nope']) {
      expect(canUnboxProduct(ctx.content, id)).toBe(false);
    }
  });

  it('is deterministic per seed and only advances the packs stream', () => {
    const game = veteranGame(99);
    const a = open(game, P.box);
    const b = open(veteranGame(99), P.box);
    expect(a.events).toEqual(b.events);
    expect(a.state).toEqual(b.state);
    const c = open(veteranGame(100), P.box);
    expect(eventOf(c.events, 'product/opened')).not.toEqual(eventOf(a.events, 'product/opened'));
    for (const stream of RNG_STREAMS) {
      if (stream === 'packs') expect(a.state.rng[stream]).not.toEqual(game.rng[stream]);
      else expect(a.state.rng[stream]).toEqual(game.rng[stream]);
    }
  });

  it('adds exactly the cards it reveals (property)', () => {
    const sizes: Record<string, number> = {
      [P.booster]: 10,
      [P.blister]: 31,
      [P.bundle]: 60,
      [P.box]: 360,
      [P.starter]: STARTER_LIST.length + 1,
    };
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0x7fffffff }),
        fc.constantFrom(P.booster, P.blister, P.bundle, P.box, P.starter),
        fc.boolean(),
        (seed, productId, veteran) => {
          const game = veteran ? veteranGame(seed) : packTestGame(ctx, seed);
          const { state, events, result } = open(game, productId);
          expect(result.ok).toBe(true);
          const opened = eventOf(events, 'product/opened');
          const revealed = opened.packs.reduce((total, pack) => total + pack.cards.length, 0);
          expect(revealed).toBe(sizes[productId]);
          expect(stackTotal(state) - stackTotal(game)).toBe(revealed);
          expect(state.stats.cardsPulled).toBe(revealed);
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe('open/unboxProduct', () => {
  it('breaks a booster box into 36 loose packs, splitting its cost basis exactly', () => {
    const game = veteranGame();
    const { state, events, result } = unbox(game, P.box);
    expect(result).toEqual({ ok: true });
    expect(sealedQuantity(state, P.box)).toBe(2);
    expect(sealedQuantity(state, P.booster)).toBe(40 + 36);
    const loose = state.inventory.sealed[P.booster]?.slice(1) ?? [];
    expect(loose).toEqual([
      { qty: 32, unitCostCents: 289, acquiredDay: 1 },
      { qty: 4, unitCostCents: 288, acquiredDay: 1 },
    ]);
    expect(loose.reduce((sum, lot) => sum + lot.qty * lot.unitCostCents, 0)).toBe(10400);
    expect(events).toEqual([
      { type: 'product/unboxed', productId: P.box, packs: [{ productId: P.booster, qty: 36 }] },
    ]);
    expect(state.finance.today.opened).toBe(0);
    expect(state.stats.productsUnboxed).toBe(1);
    expect(state.rng.packs).toEqual(game.rng.packs);
    expect(stackTotal(state)).toBe(stackTotal(game));
  });

  it('sends a blister promo to the card stacks', () => {
    const { state, events } = unbox(veteranGame(), P.blister);
    expect(state.inventory.sealed[P.booster]?.at(-1)).toEqual({
      qty: 3,
      unitCostCents: 350,
      acquiredDay: 1,
    });
    const unboxed = eventOf(events, 'product/unboxed');
    expect(unboxed.packs).toEqual([{ productId: P.booster, qty: 3 }]);
    expect(unboxed.promos).toHaveLength(1);
    const promo = unboxed.promos?.[0];
    if (!promo) throw new Error('no promo');
    expect(PROMO_IDS).toContain(promo.cardId);
    expect(state.inventory.cardStacks[pulledCardKey(promo)]).toBe(1);
    expect(state.collection.owned[promo.cardId]).toBe(1);
    expect(state.dayLog).toMatchObject({ newCards: 1, packsOpened: 0 });
    expect(eventsOf(events, 'xp/gained')).toEqual([
      { type: 'xp/gained', amount: 1, source: 'opening' },
    ]);
  });

  it('only breaks products made of packs, and checks stock and storage room', () => {
    const game = veteranGame();
    const failures: [string, string][] = [
      ['gk.nope', 'UNKNOWN_PRODUCT'],
      [P.booster, 'NOT_OPENABLE'],
      [P.starter, 'NOT_OPENABLE'],
      [P.sleeves, 'NOT_OPENABLE'],
    ];
    for (const [productId, code] of failures) {
      const outcome = unbox(game, productId);
      expect(outcome.result).toEqual({ ok: false, code, params: { productId } });
      expect(outcome.state).toBe(game);
      expect(outcome.events).toEqual([]);
    }
    const noBundles = veteranGame();
    delete noBundles.inventory.sealed[P.bundle];
    expect(unbox(noBundles, P.bundle).result).toMatchObject({ code: 'NOT_ENOUGH_STOCK' });

    // 146 SU of test stock + 50 packs = 196 of the closet's 200 SU. The box nets +18 SU.
    const crowded = veteranGame();
    putSealed(crowded, P.booster, 50, 325, 0);
    expect(unbox(crowded, P.box).result).toEqual({
      ok: false,
      code: 'STORAGE_FULL',
      params: { needed: 18, free: 4 },
    });
    expect(unbox(crowded, P.blister).result).toEqual({ ok: true });
  });
});

describe('splitCents', () => {
  it('splits a cost basis exactly into shares a cent apart at most (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 1, max: 500 }),
        (total, parts) => {
          const shares = splitCents(total, parts);
          expect(shares).toHaveLength(parts);
          expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total);
          expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
          expect(shares.every((share) => Number.isSafeInteger(share))).toBe(true);
        },
      ),
    );
    expect(splitCents(10400, 36).filter((share) => share === 289)).toHaveLength(32);
    expect(splitCents(100, 0)).toEqual([]);
  });
});
