import type { ElementId, Finish, Rarity } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';
import type { Cents } from '@/core/money';
import { parseCardKey } from '@/sim/cards';
import { misprintOf } from '@/sim/packs/misprints';
import { itemMarketValue } from '@/sim/pricing';
import type { CardStacks, Collection, ViewContext } from './stock';

/** Singles tab of the Backroom (docs/05 §5.4): card stacks with filters and sorting. */

export interface SingleRow {
  /** Stack key (src/sim/cards.ts `cardKey`). */
  key: string;
  card: CardDef;
  finish: Finish;
  /** Copies in storage. */
  count: number;
  /** Market value of one copy (docs/02 §7.2, misprint premium included). */
  valueCents: Cents;
  /** First owned today (docs/01 §14.1 NEW badge). */
  isNew: boolean;
  /** This card number already has a pocket in the binder. */
  inBinder: boolean;
  misprint: string | null;
}

export const RARITY_ORDER: readonly Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'holoRare',
  'ultraRare',
  'illustrationRare',
  'secretRare',
  'mythicRare',
  'promo',
];

export function rarityRank(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function singleRows(
  stacks: CardStacks,
  collection: Collection,
  day: number,
  ctx: ViewContext,
): SingleRow[] {
  const rows: SingleRow[] = [];
  for (const [key, count] of Object.entries(stacks)) {
    if (count <= 0) continue;
    const print = parseCardKey(key);
    const card = print ? ctx.content.cards.get(print.cardId) : undefined;
    if (!print || !card) continue;
    const firstOwned = collection.owned[card.id];
    rows.push({
      key,
      card,
      finish: print.finish,
      count,
      valueCents: itemMarketValue(ctx, { cardKey: key }) ?? 0,
      isNew: firstOwned !== undefined && firstOwned >= day,
      inBinder: collection.binder[card.id] !== undefined,
      misprint: misprintOf(print.stamps),
    });
  }
  return rows;
}

export type BinderFilter = 'all' | 'in' | 'out';

export interface SinglesFilter {
  rarity: Rarity | 'all';
  element: ElementId | 'all';
  /** In the binder already, or still missing a pocket. */
  binder: BinderFilter;
  /** Case-insensitive name or card number. */
  query: string;
}

export const NO_FILTER: SinglesFilter = { rarity: 'all', element: 'all', binder: 'all', query: '' };

export function filterSingles(rows: readonly SingleRow[], filter: SinglesFilter): SingleRow[] {
  const query = filter.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.rarity !== 'all' && row.card.rarity !== filter.rarity) return false;
    if (filter.element !== 'all' && (row.card.element ?? 'neutral') !== filter.element)
      return false;
    if (filter.binder === 'in' && !row.inBinder) return false;
    if (filter.binder === 'out' && row.inBinder) return false;
    if (query) {
      const number = String(row.card.number).padStart(3, '0');
      if (!row.card.name.toLowerCase().includes(query) && !number.includes(query)) return false;
    }
    return true;
  });
}

export type SinglesSort = 'value' | 'number' | 'rarity';

function byNumber(a: SingleRow, b: SingleRow): number {
  return (
    a.card.setId.localeCompare(b.card.setId) ||
    a.card.number - b.card.number ||
    a.finish.localeCompare(b.finish) ||
    a.key.localeCompare(b.key)
  );
}

export function sortSingles(rows: readonly SingleRow[], sort: SinglesSort): SingleRow[] {
  const sorted = [...rows];
  if (sort === 'number') return sorted.sort(byNumber);
  if (sort === 'rarity') {
    return sorted.sort(
      (a, b) =>
        rarityRank(b.card.rarity) - rarityRank(a.card.rarity) ||
        b.valueCents - a.valueCents ||
        byNumber(a, b),
    );
  }
  return sorted.sort((a, b) => b.valueCents - a.valueCents || byNumber(a, b));
}

/** Which filter chips are worth showing: only rarities and elements you actually hold. */
export function presentFacets(rows: readonly SingleRow[]): {
  rarities: Rarity[];
  elements: ElementId[];
} {
  const rarities = new Set<Rarity>();
  const elements = new Set<ElementId>();
  for (const row of rows) {
    rarities.add(row.card.rarity);
    elements.add(row.card.element ?? 'neutral');
  }
  return {
    rarities: RARITY_ORDER.filter((rarity) => rarities.has(rarity)),
    elements: [...elements].sort(),
  };
}

export interface SinglesTotals {
  cards: number;
  stacks: number;
  valueCents: Cents;
}

export function singlesTotals(rows: readonly SingleRow[]): SinglesTotals {
  let cards = 0;
  let valueCents = 0;
  for (const row of rows) {
    cards += row.count;
    valueCents += row.count * row.valueCents;
  }
  return { cards, stacks: rows.length, valueCents };
}
