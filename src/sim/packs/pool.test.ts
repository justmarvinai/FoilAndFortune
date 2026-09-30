import { describe, expect, it } from 'vitest';
import { buildCardPool, isBoosterEligible, setCardPool } from './pool';
import { defaultFinish, isAtLeast, isHit, rarityRank } from './rarity';
import { ALPHA, alphaCards, ESSENCE_ID, PROMO_IDS, SPARSE, sparseCards, testCard } from './testing';

describe('booster pools', () => {
  it('leave out promos and basic Essences but keep Secret Rare Essences (docs/03 §3.3)', () => {
    const pool = setCardPool(alphaCards, ALPHA);
    expect(pool.get(ESSENCE_ID)).toBeUndefined();
    for (const id of PROMO_IDS) expect(pool.get(id)).toBeUndefined();
    expect(pool.size).toBe(alphaCards.length - 3);

    const textured = testCard(ALPHA, 150, 'secretRare', { kind: 'essence' });
    expect(isBoosterEligible(textured)).toBe(true);
    expect(buildCardPool([textured]).cardsOf('secretRare')).toEqual([textured]);
  });

  it('only hold cards of the requested set', () => {
    const pool = setCardPool([...alphaCards, ...sparseCards], SPARSE);
    expect(pool.size).toBe(sparseCards.length);
    expect(pool.get(`${ALPHA}.001`)).toBeUndefined();
  });

  it('fall back to the nearest lower rarity, then the nearest higher one', () => {
    const sparse = setCardPool(sparseCards, SPARSE); // C, U, HR, SR only
    expect(sparse.resolve('common')).toBe('common');
    expect(sparse.resolve('rare')).toBe('uncommon');
    expect(sparse.resolve('ultraRare')).toBe('holoRare');
    expect(sparse.resolve('illustrationRare')).toBe('holoRare');
    expect(sparse.resolve('mythicRare')).toBe('secretRare');

    const noCommons = buildCardPool(sparseCards.filter((card) => card.rarity !== 'common'));
    expect(noCommons.resolve('common')).toBe('uncommon');
    expect(buildCardPool([]).resolve('rare')).toBeNull();
  });

  it('prefer cards printed in an explicit finish, else keep every card of the rarity', () => {
    const plainOnly = testCard(ALPHA, 1, 'common', { finishes: ['normal'] });
    const reversible = testCard(ALPHA, 2, 'common');
    const pool = buildCardPool([plainOnly, reversible]);
    expect(pool.cardsOf('common', 'reverseHolo')).toEqual([reversible]);
    expect(pool.cardsOf('common', 'gold')).toEqual([plainOnly, reversible]);
    expect(pool.cardsOf('common')).toEqual([plainOnly, reversible]);
    expect(pool.cardsOf('rare')).toEqual([]);
  });
});

describe('rarity rules', () => {
  it('rank the ladder and keep promos off it', () => {
    expect(rarityRank('common')).toBe(0);
    expect(rarityRank('mythicRare')).toBe(7);
    expect(rarityRank('promo')).toBe(-1);
    expect(isAtLeast('secretRare', 'illustrationRare')).toBe(true);
    expect(isAtLeast('promo', 'common')).toBe(false);
    expect(isHit('holoRare')).toBe(true);
    expect(isHit('rare')).toBe(false);
    expect(isHit('promo')).toBe(false);
  });

  it('pick default finishes: Holo Rare → holo, C/U/R → normal, higher → first listed', () => {
    expect(defaultFinish(testCard(ALPHA, 1, 'common'))).toBe('normal');
    expect(defaultFinish(testCard(ALPHA, 2, 'rare'))).toBe('normal');
    expect(defaultFinish(testCard(ALPHA, 3, 'holoRare'))).toBe('holo');
    expect(defaultFinish(testCard(ALPHA, 4, 'ultraRare'))).toBe('fullArtTextured');
    expect(defaultFinish(testCard(ALPHA, 5, 'secretRare'))).toBe('gold');
    expect(defaultFinish(testCard(ALPHA, 6, 'promo'))).toBe('holo');
    // Never a print that doesn't exist: fall back to the first listed finish.
    expect(defaultFinish(testCard(ALPHA, 7, 'holoRare', { finishes: ['etched'] }))).toBe('etched');
  });
});
