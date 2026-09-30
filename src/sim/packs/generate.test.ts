import { describe, expect, it } from 'vitest';
import type { Rarity } from '@/content/schema/common';
import type { PackConfigDef } from '@/content/schema/tcg';
import { createRng, seedStream } from '@/core/rng';
import {
  drawPack,
  type GeneratedPack,
  generatePack,
  generatePackRun,
  type PackRules,
  type PackSource,
  packRules,
  rareSlotIndex,
} from './generate';
import { buildCardPool, setCardPool } from './pool';
import { isAtLeast, isFoil, isHit, rarityRank } from './rarity';
import {
  ALPHA,
  alphaCards,
  idsOf,
  packTestContext,
  SPARSE,
  sparseCards,
  testPackConfig,
} from './testing';

const ctx = packTestContext();
const pool = setCardPool(alphaCards, ALPHA);
const rules = packRules(ctx.balance);
const { boxMapping } = ctx.balance.packs;
const source: PackSource = { config: testPackConfig, pool };
const box = (from: PackSource = source): PackSource[] => Array.from({ length: 36 }, () => from);

function withChances(godPack: number, misprint: number): PackRules {
  return {
    godPack: { ...rules.godPack, chance: godPack },
    misprint: { ...rules.misprint, chancePerCard: misprint },
  };
}
/** No god packs, no misprints: just the slot tables. */
const plain = withChances(0, 0);

const rngFor = (seed: number) => createRng(seedStream(seed, 'packs'));

/** Asserts a binomial proportion within 4σ of `p` (fixed seeds keep it deterministic). */
function expectRate(count: number, n: number, p: number): void {
  const sd = Math.sqrt((p * (1 - p)) / n);
  expect(Math.abs(count / n - p)).toBeLessThanOrEqual(4 * sd + 1e-12);
}

function tally(values: Iterable<string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function countRarity(packs: readonly GeneratedPack[], test: (rarity: Rarity) => boolean): number {
  let total = 0;
  for (const pack of packs) for (const card of pack.cards) if (test(card.rarity)) total++;
  return total;
}

const EXPECTED_FINISH: Partial<Record<Rarity, string>> = {
  rare: 'normal',
  holoRare: 'holo',
  ultraRare: 'fullArtTextured',
  illustrationRare: 'fullArtTextured',
  secretRare: 'gold',
  mythicRare: 'cosmos',
};

describe('pack structure (docs/02 §11.1)', () => {
  it('finds the rare slot: the slot that reaches the highest rarity', () => {
    expect(rareSlotIndex(testPackConfig)).toBe(3);
    expect(rareSlotIndex({ slots: [{ count: 5, table: [{ rarity: 'common', weight: 1 }] }] })).toBe(
      -1,
    );
  });

  it('draws 5 commons, 3 uncommons, a reverse holo and the rare slot last', () => {
    const rng = rngFor(1);
    for (let i = 0; i < 500; i++) {
      const pack = generatePack(testPackConfig, pool, rng, plain);
      expect(pack.cards).toHaveLength(10);
      expect(pack.godPack).toBe(false);
      expect(pack.rareSlot).toEqual([9]);
      pack.cards.slice(0, 5).forEach((card) => {
        expect(card).toMatchObject({ rarity: 'common', finish: 'normal' });
      });
      pack.cards.slice(5, 8).forEach((card) => {
        expect(card).toMatchObject({ rarity: 'uncommon', finish: 'normal' });
      });
      expect(pack.cards[8]?.finish).toBe('reverseHolo');
      const rare = pack.cards[9];
      expect(rare && isAtLeast(rare.rarity, 'rare')).toBe(true);
      expect(rare?.finish).toBe(EXPECTED_FINISH[rare?.rarity ?? 'rare']);
      expect(pack.cards.every((card) => pool.get(card.cardId)?.rarity === card.rarity)).toBe(true);
    }
  });

  it('matches the rare-slot and reverse-slot tables over 20,000 packs', () => {
    const rng = rngFor(11);
    const n = 20_000;
    const rareSlot: string[] = [];
    const reverseSlot: string[] = [];
    for (let i = 0; i < n; i++) {
      const pack = drawPack(testPackConfig, pool, rng, plain);
      rareSlot.push(pack.cards[9]?.rarity ?? '');
      reverseSlot.push(pack.cards[8]?.rarity ?? '');
      expect(pack.cards[8]?.finish).toBe('reverseHolo');
    }
    const rare = tally(rareSlot);
    for (const entry of testPackConfig.slots[3]?.table ?? []) {
      expectRate(rare[entry.rarity] ?? 0, n, entry.weight / 100);
    }
    const reverse = tally(reverseSlot);
    expectRate(reverse.common ?? 0, n, 0.6);
    expectRate(reverse.uncommon ?? 0, n, 0.3);
    expectRate(reverse.rare ?? 0, n, 0.1);
  });

  it('draws god packs at the balance chance, all cards from the god-pack table, best last', () => {
    const boosted = withChances(0.05, 0);
    const rng = rngFor(12);
    const n = 20_000;
    let godPacks = 0;
    const godCards: string[] = [];
    for (let i = 0; i < n; i++) {
      const pack = drawPack(testPackConfig, pool, rng, boosted);
      if (!pack.godPack) continue;
      godPacks++;
      expect(pack.cards).toHaveLength(testPackConfig.cardsPerPack);
      expect(pack.rareSlot).toEqual([]);
      const ranks = pack.cards.map((card) => rarityRank(card.rarity));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      godCards.push(...pack.cards.map((card) => card.rarity));
    }
    expectRate(godPacks, n, 0.05);
    const mix = tally(godCards);
    expect(Object.keys(mix).sort()).toEqual(['illustrationRare', 'mythicRare', 'secretRare']);
    expectRate(mix.illustrationRare ?? 0, godCards.length, 0.75);
    expectRate(mix.secretRare ?? 0, godCards.length, 0.2);
    expectRate(mix.mythicRare ?? 0, godCards.length, 0.05);
  });

  it('misprints cards at the balance chance; Missing Foil only on foil cards', () => {
    const boosted = withChances(0, 0.01);
    const rng = rngFor(13);
    const n = 20_000;
    let cards = 0;
    const foil: string[] = [];
    const plainKinds: string[] = [];
    for (let i = 0; i < n; i++) {
      for (const card of generatePack(testPackConfig, pool, rng, boosted).cards) {
        cards++;
        if (!card.misprint) continue;
        (isFoil(card.finish) ? foil : plainKinds).push(card.misprint);
      }
    }
    expectRate(foil.length + plainKinds.length, cards, 0.01);
    const plainMix = tally(plainKinds);
    expect(plainMix.missingFoil).toBeUndefined();
    // Missing Foil re-rolls on non-foil cards: the other kinds share its weight (45/25/14/1 of 85).
    expectRate(plainMix.miscut ?? 0, plainKinds.length, 45 / 85);
    expectRate(plainMix.inkError ?? 0, plainKinds.length, 25 / 85);
    expectRate(plainMix.crimped ?? 0, plainKinds.length, 14 / 85);
    expectRate(tally(foil).missingFoil ?? 0, foil.length, 0.15);
  });

  it('is deterministic per seed', () => {
    const packsFor = (seed: number) => {
      const rng = rngFor(seed);
      return Array.from({ length: 50 }, () => generatePack(testPackConfig, pool, rng, rules));
    };
    expect(packsFor(7)).toEqual(packsFor(7));
    expect(packsFor(7)).not.toEqual(packsFor(8));
  });
});

describe('rarity fallback (the Phase 2 subset lacks some rarities)', () => {
  it('draws the nearest lower rarity the set has, then higher', () => {
    const sparse = setCardPool(sparseCards, SPARSE); // C, U, HR, SR only
    const rng = rngFor(14);
    const n = 20_000;
    const rareSlot: string[] = [];
    const reverseSlot: string[] = [];
    let foreign = 0;
    for (let i = 0; i < n; i++) {
      const pack = drawPack(testPackConfig, sparse, rng, plain);
      for (const card of pack.cards) if (!sparse.get(card.cardId)) foreign++;
      rareSlot.push(pack.cards[9]?.rarity ?? '');
      reverseSlot.push(pack.cards[8]?.rarity ?? '');
    }
    expect(foreign).toBe(0);
    const rare = tally(rareSlot);
    // Rare → Uncommon; Ultra and Illustration → Holo Rare; Mythic → Secret Rare.
    expectRate(rare.uncommon ?? 0, n, 0.625);
    expectRate(rare.holoRare ?? 0, n, 0.25 + 0.08 + 0.03);
    expectRate(rare.secretRare ?? 0, n, 0.012 + 0.003);
    const reverse = tally(reverseSlot);
    expectRate(reverse.uncommon ?? 0, n, 0.3 + 0.1);
  });

  it('keeps the explicit reverse-holo finish on fallback cards', () => {
    const sparse = setCardPool(sparseCards, SPARSE);
    const rng = rngFor(15);
    for (let i = 0; i < 300; i++) {
      expect(drawPack(testPackConfig, sparse, rng, plain).cards[8]?.finish).toBe('reverseHolo');
    }
  });
});

describe('box mapping (docs/02 §11.1)', () => {
  it('always holds ≥ 6 Holo Rares and ≥ 2 Ultra Rares or better per box', () => {
    const rng = rngFor(21);
    for (let b = 0; b < 1000; b++) {
      const packs = generatePackRun(box(), rng, rules, { boxMapping });
      expect(packs).toHaveLength(36);
      expect(countRarity(packs, (r) => r === 'holoRare')).toBeGreaterThanOrEqual(6);
      expect(countRarity(packs, (r) => isAtLeast(r, 'ultraRare'))).toBeGreaterThanOrEqual(2);
    }
  });

  it('only upgrades rare slots of the last packs and never forces a Mythic', () => {
    let adjusted = 0;
    for (let seed = 0; seed < 400; seed++) {
      // Same seed: the natural draws are identical, mapping only changes what it upgrades.
      const natural = generatePackRun(box(), rngFor(seed), plain);
      const mapped = generatePackRun(box(), rngFor(seed), plain, { boxMapping });
      let firstChanged = -1;
      natural.forEach((pack, p) => {
        pack.cards.forEach((card, i) => {
          const after = mapped[p]?.cards[i];
          if (!after || after.cardId === card.cardId) return;
          if (firstChanged < 0) firstChanged = p;
          expect(i).toBe(9);
          expect(after.rarity).not.toBe('mythicRare');
          expect(rarityRank(after.rarity)).toBeGreaterThan(rarityRank(card.rarity));
        });
      });
      const mythics = (packs: GeneratedPack[]) => countRarity(packs, (r) => r === 'mythicRare');
      expect(mythics(mapped)).toBe(mythics(natural));
      if (firstChanged < 0) continue;
      adjusted++;
      for (let p = firstChanged; p < 36; p++)
        expect(isHit(mapped[p]?.cards[9]?.rarity ?? 'common')).toBe(true);
    }
    // P(box needs mapping) ≈ 15%: the test exercises plenty of adjusted boxes.
    expect(adjusted).toBeGreaterThan(20);
  });

  it('gives up gracefully when the set has no forceable Ultra-or-better rarity', () => {
    const noUltras = buildCardPool(
      alphaCards.filter(
        (card) => !['ultraRare', 'illustrationRare', 'secretRare'].includes(card.rarity),
      ),
    );
    const rng = rngFor(22);
    for (let b = 0; b < 50; b++) {
      const packs = generatePackRun(box({ config: testPackConfig, pool: noUltras }), rng, plain, {
        boxMapping,
      });
      expect(countRarity(packs, (r) => r === 'holoRare')).toBeGreaterThanOrEqual(6);
    }
  });

  it('trades surplus Holo Rares in a run too small for both guarantees, never a locked card', () => {
    const holoHeavy: PackConfigDef = {
      ...testPackConfig,
      id: 'test.pack.holo-heavy',
      slots: [
        ...testPackConfig.slots.slice(0, 3),
        {
          count: 1,
          table: [
            { rarity: 'holoRare', weight: 1 },
            { rarity: 'ultraRare', weight: 1e-9 },
          ],
        },
      ],
    };
    const heavy = { config: holoHeavy, pool };
    const traded = generatePackRun([heavy, heavy, heavy], rngFor(23), plain, {
      boxMapping: { minHoloRare: 1, minUltraPlus: 2 },
    });
    expect(traded.map((pack) => pack.cards[9]?.rarity)).toEqual([
      'holoRare',
      'ultraRare',
      'ultraRare',
    ]);

    const onboardingHolo = idsOf(alphaCards, 'holoRare')[4] ?? '';
    const locked = generatePackRun([heavy, heavy, heavy], rngFor(23), plain, {
      boxMapping: { minHoloRare: 0, minUltraPlus: 3 },
      firstPackCardId: onboardingHolo,
    });
    expect(locked[0]?.cards[9]?.cardId).toBe(onboardingHolo);
    expect(locked.slice(1).map((pack) => pack.cards[9]?.rarity)).toEqual([
      'ultraRare',
      'ultraRare',
    ]);
  });
});

describe('onboarding luck (docs/02 §11.1)', () => {
  const sparkit = idsOf(alphaCards, 'holoRare')[0] ?? '';

  it("puts the first-pack card in the first pack's rare slot, which is never a god pack", () => {
    const [first, second] = generatePackRun([source, source], rngFor(31), withChances(1, 0), {
      firstPackCardId: sparkit,
    });
    expect(first?.godPack).toBe(false);
    expect(first?.cards[9]).toEqual({ cardId: sparkit, rarity: 'holoRare', finish: 'holo' });
    expect(second?.godPack).toBe(true);
  });

  it('skips a first-pack card that is not in the pack pool', () => {
    const [first] = generatePackRun([source], rngFor(32), withChances(1, 0), {
      firstPackCardId: 'gk.emberdawn.035',
    });
    expect(first?.godPack).toBe(true);
  });

  it('upgrades one random rare slot when a run lacks the minimum rarity (never to a Mythic)', () => {
    let rescued = 0;
    for (let seed = 0; seed < 300; seed++) {
      const natural = generatePackRun(box(), rngFor(seed), plain);
      const lucky = generatePackRun(box(), rngFor(seed), plain, { minRarity: 'illustrationRare' });
      expect(countRarity(lucky, (r) => isAtLeast(r, 'illustrationRare'))).toBeGreaterThanOrEqual(1);
      const changed = lucky.flatMap((pack, p) =>
        pack.cards.filter((card, i) => card.cardId !== natural[p]?.cards[i]?.cardId),
      );
      if (countRarity(natural, (r) => isAtLeast(r, 'illustrationRare')) > 0) {
        expect(changed).toEqual([]);
        continue;
      }
      rescued++;
      expect(changed).toHaveLength(1);
      expect(['illustrationRare', 'secretRare']).toContain(changed[0]?.rarity);
    }
    // P(no IR+ in 36 natural rare slots) = 0.955^36 ≈ 19%.
    expect(rescued).toBeGreaterThan(20);
  });
});
