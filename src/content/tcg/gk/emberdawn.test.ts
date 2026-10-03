import { describe, expect, it } from 'vitest';
import { getRegistry } from '@/content/registry';
import type { Rarity } from '@/content/schema/common';
import type { CardDef, ProductDef } from '@/content/schema/tcg';
import { emberdawnCards } from './sets/emberdawn';
import { emberdawnPlan } from './sets/emberdawnPlan';
import { essenceCards } from './sets/essence';
import { promoCards } from './sets/promo';

/** docs/02 §7.1 value bands (min/max, in cents). */
const BANDS: Record<Rarity, [number, number]> = {
  common: [5, 25],
  uncommon: [10, 50],
  rare: [30, 150],
  holoRare: [100, 600],
  ultraRare: [400, 2500],
  illustrationRare: [800, 6000],
  secretRare: [2000, 12000],
  mythicRare: [15000, 60000],
  promo: [100, 4000],
};

/** docs/03 §3.3 HP ranges per stage. */
const HP: Record<string, [number, number]> = {
  basic: [40, 90],
  stage1: [80, 130],
  stage2: [120, 180],
  nova: [200, 280],
  legend: [130, 220],
};

const registry = getRegistry();
const product = (id: string): ProductDef => {
  const found = registry.products.get(id);
  if (!found) throw new Error(`missing product ${id}`);
  return found;
};

const countBy = (cards: readonly CardDef[]) =>
  cards.reduce<Partial<Record<Rarity, number>>>((acc, card) => {
    acc[card.rarity] = (acc[card.rarity] ?? 0) + 1;
    return acc;
  }, {});

describe('Emberdawn numbering plan (docs/03 Appendix A)', () => {
  it('plans 130 cards: 100 main (C40 U30 R14 HR10 UR6) + 30 secret (IR16 SR10 MR4)', () => {
    expect(emberdawnPlan.map((p) => p.number)).toEqual(
      Array.from({ length: 130 }, (_, i) => i + 1),
    );
    expect(countBy(emberdawnPlan as unknown as CardDef[])).toEqual({
      common: 40,
      uncommon: 30,
      rare: 14,
      holoRare: 10,
      ultraRare: 6,
      illustrationRare: 16,
      secretRare: 10,
      mythicRare: 4,
    });
  });

  it('keeps the released IDs and their meaning', () => {
    const at = (n: number) => emberdawnPlan[n - 1];
    expect(at(12)).toMatchObject({ name: 'Emberpup', rarity: 'common' });
    expect(at(24)).toMatchObject({ name: 'Sploot', rarity: 'uncommon' });
    expect(at(35)).toMatchObject({ name: 'Sparkit', rarity: 'holoRare' });
    expect(at(108)).toMatchObject({ name: 'Sploot', rarity: 'illustrationRare' });
    expect(at(121)).toMatchObject({ name: 'Emberpup', rarity: 'secretRare' });
    expect(registry.cards.get('gk.emberdawn.035')?.rarity).toBe('holoRare');
  });

  it('every authored card matches its planned number, name, kind, rarity and species', () => {
    for (const card of emberdawnCards) {
      const plan = emberdawnPlan[card.number - 1];
      expect(plan, card.id).toBeDefined();
      expect({ name: card.name, kind: card.kind, rarity: card.rarity }, card.id).toEqual({
        name: plan?.name,
        kind: plan?.kind,
        rarity: plan?.rarity,
      });
      if (plan?.species) expect(card.speciesId, card.id).toBe(`gk.species.${plan.species}`);
      if (plan?.tacticType) expect(card.tacticType, card.id).toBe(plan.tacticType);
      expect(plan?.phase, card.id).toBe(2);
    }
    expect(emberdawnPlan.filter((p) => p.phase === 2)).toHaveLength(emberdawnCards.length);
  });
});

describe('Emberdawn Phase 2 subset', () => {
  it('has every rarity the pack tables can pull (C12 U9 R5 HR6 UR3 IR4 SR2 MR1)', () => {
    expect(countBy(emberdawnCards)).toEqual({
      common: 12,
      uncommon: 9,
      rare: 5,
      holoRare: 6,
      ultraRare: 3,
      illustrationRare: 4,
      secretRare: 2,
      mythicRare: 1,
    });
  });

  it('includes both starter lines, the new species and every tactic type', () => {
    const species = new Set(emberdawnCards.map((card) => card.speciesId));
    for (const slug of [
      'emberpup',
      'blazehound',
      'infernox',
      'sparkit',
      'voltail',
      'thundervixen',
      'magmadillo',
      'boltbuck',
      'solaryx',
    ]) {
      expect(species.has(`gk.species.${slug}`), slug).toBe(true);
    }
    const mythic = emberdawnCards.find((card) => card.rarity === 'mythicRare');
    expect(mythic?.speciesId).toBe('gk.species.solaryx');
    const tactics = new Set(emberdawnCards.map((card) => card.tacticType).filter(Boolean));
    expect([...tactics].sort()).toEqual(['ally', 'arena', 'item']);
  });

  it('fills the face data: HP in its stage range, attacks with costs, weakness, illustrator', () => {
    for (const card of [...emberdawnCards, ...promoCards]) {
      expect(card.illustrator.length, card.id).toBeGreaterThan(2);
      if (card.kind !== 'creature') continue;
      const [lo, hi] = HP[card.stage ?? 'basic'] ?? [0, 0];
      expect(card.hp, card.id).toBeGreaterThanOrEqual(lo);
      expect(card.hp, card.id).toBeLessThanOrEqual(hi);
      expect(card.attacks?.length, card.id).toBeGreaterThan(0);
      for (const attack of card.attacks ?? [])
        expect(attack.cost.length, card.id).toBeGreaterThan(0);
      expect(card.weakness, card.id).toBeDefined();
      expect(card.flavor, card.id).toBeTruthy();
      const species = registry.species.get(card.speciesId ?? '');
      expect(species?.genome, card.id).toBeDefined();
      expect(card.art.speciesId, card.id).toBe(card.speciesId);
    }
  });

  it('gives tactics rules text and art: props for Items and Allies, a biome alone for Arenas', () => {
    for (const card of emberdawnCards.filter((c) => c.kind === 'tactic')) {
      expect(card.rulesText, card.id).toBeTruthy();
      expect(card.art.biome, card.id).toBeDefined();
      expect(card.art.speciesId, card.id).toBeUndefined();
      if (card.tacticType === 'arena') expect(card.art.prop, card.id).toBeUndefined();
      else if (card.tacticType === 'ally') expect(card.art.prop?.kind, card.id).toBe('folk');
      else expect(['potion', 'charm', 'lantern'], card.id).toContain(card.art.prop?.kind);
    }
  });

  it('uses full art for IR/SR/MR and a unique art seed per card', () => {
    for (const card of emberdawnCards) {
      const full = ['illustrationRare', 'secretRare', 'mythicRare'].includes(card.rarity);
      expect(card.art.composition, card.id).toBe(full ? 'fullArt' : 'window');
    }
    const seeds = [...registry.cards.values()].map((card) => card.art.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('keeps every base value inside its docs/02 §7.1 band', () => {
    for (const card of registry.cards.values()) {
      const [lo, hi] = BANDS[card.rarity];
      expect(card.baseValueCents, card.id).toBeGreaterThanOrEqual(lo);
      expect(card.baseValueCents, card.id).toBeLessThanOrEqual(hi);
    }
  });

  it('prices a booster near MSRP (docs/02 §11.3: market 0.85–1.10, realizable 0.66–0.80)', () => {
    const avg = (rarity: Rarity, value: (card: CardDef) => number = (c) => c.baseValueCents) => {
      const cards = emberdawnCards.filter((card) => card.rarity === rarity);
      return cards.reduce((sum, card) => sum + value(card), 0) / cards.length;
    };
    const reverse = (multiplier: number) => (card: CardDef) =>
      Math.max(25, card.baseValueCents * multiplier);
    const reverseSlot =
      0.6 * avg('common', reverse(3)) +
      0.3 * avg('uncommon', reverse(2.5)) +
      0.1 * avg('rare', reverse(2));
    const rareSlot =
      0.625 * avg('rare') +
      0.25 * avg('holoRare') +
      0.08 * avg('ultraRare') +
      0.03 * avg('illustrationRare') +
      0.012 * avg('secretRare') +
      0.003 * avg('mythicRare');
    const msrp = product('gk.emberdawn.booster').msrpCents;
    const market = 5 * avg('common') + 3 * avg('uncommon') + reverseSlot + rareSlot;
    const realizable = 8 * 2 + 0.85 * (reverseSlot + rareSlot);
    expect(market / msrp).toBeGreaterThan(0.85);
    expect(market / msrp).toBeLessThan(1.06);
    expect(realizable / msrp).toBeGreaterThan(0.66);
    expect(realizable / msrp).toBeLessThan(0.8);
  });
});

describe('Emberdawn products', () => {
  const fixed = (deck: ProductDef) =>
    deck.contents.flatMap((entry) => (entry.type === 'fixedCards' ? entry.cards : []));
  const pool = (deck: ProductDef) =>
    deck.contents.flatMap((entry) => (entry.type === 'guaranteedHoloPool' ? entry.cardIds : []));

  for (const [id, element] of [
    ['gk.emberdawn.starter-ember', 'ember'],
    ['gk.emberdawn.starter-volt', 'volt'],
  ] as const) {
    it(`${id}: 59 fixed cards + 1 guaranteed holo from 3 = 60, all valid`, () => {
      const deck = product(id);
      const cards = fixed(deck);
      expect(cards).toHaveLength(59);
      expect(pool(deck)).toHaveLength(3);
      for (const { cardId } of cards) {
        const card = registry.cards.get(cardId);
        expect(card, cardId).toBeDefined();
        // Decks hold commons to rares of the set plus basic Essences of the deck's element.
        if (card?.kind === 'essence') expect(card.element, cardId).toBe(element);
        else expect(['common', 'uncommon', 'rare'], cardId).toContain(card?.rarity);
      }
      for (const cardId of pool(deck)) {
        const card = registry.cards.get(cardId);
        expect(card?.rarity, cardId).toBe('holoRare');
        expect(card?.element, cardId).toBe(element);
      }
      // Starter decks follow their line: 4 basics, 3 Stage 1s, 2 Stage 2s (docs/03 §4.1).
      const stages = cards
        .map(({ cardId }) => registry.cards.get(cardId))
        .filter((card) => card?.element === element && card.kind === 'creature');
      expect(stages.some((card) => card?.stage === 'stage2')).toBe(true);
      const counts = new Map<string, number>();
      for (const { cardId } of cards) counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
      for (const [cardId, copies] of counts) {
        const card = registry.cards.get(cardId);
        if (card?.kind !== 'essence') expect(copies, cardId).toBeLessThanOrEqual(4);
      }
    });
  }

  it('the 3-Pack Blister holds 3 boosters and 1 promo from its promo pool', () => {
    const blister = product('gk.emberdawn.blister');
    const packs = blister.contents.find((entry) => entry.type === 'pack');
    expect(packs).toMatchObject({ productId: 'gk.emberdawn.booster', count: 3 });
    const promos = blister.contents.find((entry) => entry.type === 'promoPool');
    if (promos?.type !== 'promoPool') throw new Error('blister has no promo pool');
    expect(promos.count).toBe(1);
    expect(promos.cardIds.length).toBeGreaterThan(0);
    for (const cardId of promos.cardIds) {
      expect(registry.cards.get(cardId)?.rarity, cardId).toBe('promo');
      expect(registry.cards.get(cardId)?.setId, cardId).toBe('gk.promo');
    }
  });

  it('keeps the released product IDs', () => {
    for (const id of [
      'gk.emberdawn.booster',
      'gk.emberdawn.blister',
      'gk.emberdawn.starter-ember',
      'gk.emberdawn.starter-volt',
      'gk.emberdawn.box',
    ]) {
      expect(registry.products.has(id), id).toBe(true);
    }
  });
});

describe('evergreen sets', () => {
  it('has one basic Essence per element except Neutral, never booster-eligible', () => {
    expect(essenceCards.map((card) => card.element)).toEqual([
      'ember',
      'tide',
      'bloom',
      'volt',
      'terra',
      'mystic',
      'shade',
      'frost',
    ]);
    for (const card of essenceCards) {
      expect(card).toMatchObject({ kind: 'essence', setId: 'gk.essence' });
    }
  });

  it('numbers promos in the black-star series', () => {
    for (const card of promoCards) {
      expect(card.id).toBe(`gk.promo.${String(card.number).padStart(3, '0')}`);
      expect(card.rarity).toBe('promo');
    }
  });
});
