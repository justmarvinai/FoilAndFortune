import type { Finish } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';
import type { Cents } from '@/core/money';
import { parseCardKey } from '@/sim/cards';
import { itemMarketValue } from '@/sim/pricing';
import type { CardStacks, Collection, ViewContext } from './stock';

/**
 * The binder (docs/05 §5.9, docs/01 §24): 3 × 3 pocket pages in card-number order, one pocket per
 * authored card of the set. Missing cards show a silhouette with their number.
 */

export const POCKETS_PER_PAGE = 9;
export const PAGES_PER_SPREAD = 2;

/** Filled: in its pocket. Available: not in the binder, but copies sit in your singles. */
export type PocketState = 'filled' | 'available' | 'missing';

export interface CardCopy {
  key: string;
  finish: Finish;
  count: number;
  valueCents: Cents;
}

export interface Pocket {
  card: CardDef;
  state: PocketState;
  /** The copy in the pocket (filled pockets). */
  binderKey?: string;
  binderFinish?: Finish;
  /** Copies in your singles, most valuable first. */
  copies: CardCopy[];
  /** Ever owned (docs/01 §24 silhouettes): the name shows even while the pocket is empty. */
  seen: boolean;
}

/** Copies of one card in the stacks, most valuable first. */
export function copiesOf(cardId: string, stacks: CardStacks, ctx: ViewContext): CardCopy[] {
  const copies: CardCopy[] = [];
  for (const [key, count] of Object.entries(stacks)) {
    if (count <= 0) continue;
    const print = parseCardKey(key);
    if (!print || print.cardId !== cardId) continue;
    copies.push({
      key,
      finish: print.finish,
      count,
      valueCents: itemMarketValue(ctx, { cardKey: key }) ?? 0,
    });
  }
  return copies.sort((a, b) => b.valueCents - a.valueCents || a.key.localeCompare(b.key));
}

/** One pocket per authored card of the set, in card-number order. */
export function binderPockets(
  setId: string,
  collection: Collection,
  stacks: CardStacks,
  ctx: ViewContext,
): Pocket[] {
  const cards = [...ctx.content.cards.values()]
    .filter((card) => card.setId === setId)
    .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
  const copiesByCard = new Map<string, CardCopy[]>();
  for (const card of cards) copiesByCard.set(card.id, []);
  for (const [key, count] of Object.entries(stacks)) {
    if (count <= 0) continue;
    const print = parseCardKey(key);
    const list = print ? copiesByCard.get(print.cardId) : undefined;
    if (!print || !list) continue;
    list.push({
      key,
      finish: print.finish,
      count,
      valueCents: itemMarketValue(ctx, { cardKey: key }) ?? 0,
    });
  }
  return cards.map((card) => {
    const pocket = collection.binder[card.id];
    const copies = (copiesByCard.get(card.id) ?? []).sort(
      (a, b) => b.valueCents - a.valueCents || a.key.localeCompare(b.key),
    );
    const binderFinish = pocket ? parseCardKey(pocket.cardKey)?.finish : undefined;
    return {
      card,
      state: pocket ? 'filled' : copies.length > 0 ? 'available' : 'missing',
      binderKey: pocket?.cardKey,
      binderFinish,
      copies,
      seen: collection.owned[card.id] !== undefined || pocket !== undefined,
    };
  });
}

export function paginate<T>(items: readonly T[], perPage = POCKETS_PER_PAGE): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages.length > 0 ? pages : [[]];
}

/** Spreads of two facing pages; the last one may have an empty right page. */
export function spreadCount(pageCount: number): number {
  return Math.max(1, Math.ceil(pageCount / PAGES_PER_SPREAD));
}

/** The page indices shown on a spread (right is null past the last page). */
export function spreadPages(spread: number, pageCount: number): [number, number | null] {
  const left = spread * PAGES_PER_SPREAD;
  const right = left + 1;
  return [left, right < pageCount ? right : null];
}

/** The spread that holds a given pocket index. */
export function spreadOfPocket(index: number): number {
  return Math.floor(index / (POCKETS_PER_PAGE * PAGES_PER_SPREAD));
}

export interface Completion {
  filled: number;
  total: number;
  ratio: number;
  /** Pockets you could fill right now from your singles. */
  available: number;
}

export function completion(pockets: readonly Pocket[]): Completion {
  let filled = 0;
  let available = 0;
  for (const pocket of pockets) {
    if (pocket.state === 'filled') filled += 1;
    else if (pocket.state === 'available') available += 1;
  }
  const total = pockets.length;
  return { filled, total, ratio: total > 0 ? filled / total : 0, available };
}
