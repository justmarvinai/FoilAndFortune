import { describe, expect, it } from 'vitest';
import { cardKey } from '@/sim/cards';
import {
  filterSingles,
  NO_FILTER,
  presentFacets,
  rarityRank,
  singleRows,
  singlesTotals,
  sortSingles,
} from './singles';
import { ctx, newTestGame, run } from './testing';

function rowsOf(game = newTestGame()) {
  return singleRows(game.inventory.cardStacks, game.collection, game.clock.day, ctx);
}

describe('singleRows', () => {
  it("covers every starting stack of Theo's binder and the bulk shoebox", () => {
    const game = newTestGame();
    const rows = rowsOf(game);
    const copies = Object.values(game.inventory.cardStacks).reduce((sum, count) => sum + count, 0);
    expect(singlesTotals(rows).cards).toBe(copies);
    expect(rows.every((row) => row.valueCents > 0)).toBe(true);
    // Theo's cards were owned before Day 1: nothing is NEW yet.
    expect(rows.some((row) => row.isNew)).toBe(false);
  });

  it('marks cards first owned today as NEW', () => {
    const game = newTestGame();
    const [first] = rowsOf(game);
    if (!first) throw new Error('no rows');
    const collection = {
      ...game.collection,
      owned: { ...game.collection.owned, [first.card.id]: game.clock.day },
    };
    const rows = singleRows(game.inventory.cardStacks, collection, game.clock.day, ctx);
    expect(rows.find((row) => row.key === first.key)?.isNew).toBe(true);
  });

  it('flags cards whose number already has a binder pocket', () => {
    let game = newTestGame();
    const [first] = rowsOf(game);
    if (!first) throw new Error('no rows');
    game = run(game, { type: 'collection/addToBinder', cardKey: first.key });
    const rows = rowsOf(game);
    expect(rows.filter((row) => row.card.id === first.card.id).every((row) => row.inBinder)).toBe(
      true,
    );
  });

  it('reads misprint stamps and applies their premium', () => {
    const game = newTestGame();
    const [first] = rowsOf(game);
    if (!first) throw new Error('no rows');
    const misprinted = cardKey({
      cardId: first.card.id,
      finish: first.finish,
      stamps: ['misprint.inkError'],
    });
    const rows = singleRows({ [misprinted]: 1 }, game.collection, game.clock.day, ctx);
    expect(rows[0]?.misprint).toBe('inkError');
    expect(rows[0]?.valueCents).toBeGreaterThan(first.valueCents);
  });

  it('skips unknown cards and empty stacks', () => {
    const game = newTestGame();
    const rows = singleRows(
      { 'gk.nope.001|normal||nearMint': 3, [Object.keys(game.inventory.cardStacks)[0] ?? '']: 0 },
      game.collection,
      1,
      ctx,
    );
    expect(rows).toEqual([]);
  });
});

describe('filters and sorting', () => {
  const rows = rowsOf();

  it('filters by rarity, element, binder state and query', () => {
    const facets = presentFacets(rows);
    expect(facets.rarities.length).toBeGreaterThan(0);
    for (const rarity of facets.rarities) {
      const only = filterSingles(rows, { ...NO_FILTER, rarity });
      expect(only.length).toBeGreaterThan(0);
      expect(only.every((row) => row.card.rarity === rarity)).toBe(true);
    }
    for (const element of facets.elements) {
      const only = filterSingles(rows, { ...NO_FILTER, element });
      expect(only.every((row) => (row.card.element ?? 'neutral') === element)).toBe(true);
    }
    expect(filterSingles(rows, { ...NO_FILTER, binder: 'in' })).toEqual([]);
    expect(filterSingles(rows, { ...NO_FILTER, binder: 'out' })).toHaveLength(rows.length);
    const [first] = rows;
    if (!first) throw new Error('no rows');
    const byName = filterSingles(rows, { ...NO_FILTER, query: first.card.name.toUpperCase() });
    expect(byName.every((row) => row.card.name === first.card.name)).toBe(true);
    const number = String(first.card.number).padStart(3, '0');
    expect(filterSingles(rows, { ...NO_FILTER, query: number }).length).toBeGreaterThan(0);
  });

  it('sorts by value (desc), number (asc) and rarity (desc)', () => {
    const byValue = sortSingles(rows, 'value');
    for (let i = 1; i < byValue.length; i++) {
      expect(byValue[i - 1]?.valueCents ?? 0).toBeGreaterThanOrEqual(byValue[i]?.valueCents ?? 0);
    }
    const byNumber = sortSingles(rows, 'number');
    for (let i = 1; i < byNumber.length; i++) {
      expect(byNumber[i - 1]?.card.number ?? 0).toBeLessThanOrEqual(byNumber[i]?.card.number ?? 0);
    }
    const byRarity = sortSingles(rows, 'rarity');
    for (let i = 1; i < byRarity.length; i++) {
      const a = byRarity[i - 1];
      const b = byRarity[i];
      if (!a || !b) continue;
      expect(rarityRank(a.card.rarity)).toBeGreaterThanOrEqual(rarityRank(b.card.rarity));
    }
    // Sorting never mutates its input.
    expect(sortSingles(rows, 'value')).not.toBe(rows);
  });
});
