import type { Finish, Rarity } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';
import { isAtLeast, RARITY_LADDER, rarityRank } from './rarity';

/**
 * The cards a set's boosters can contain, grouped by rarity (docs/02 §11). Built per opening from
 * the content registry; pure and read-only once built.
 */
export interface CardPool {
  /** Number of booster-eligible cards. */
  readonly size: number;
  get(cardId: string): CardDef | undefined;
  hasRarity(rarity: Rarity): boolean;
  /**
   * The cards of exactly `rarity`, in content order. With a finish, only the cards printed in that
   * finish, unless none are (then all of them: an explicit table finish always wins).
   */
  cardsOf(rarity: Rarity, finish?: Finish): readonly CardDef[];
  /**
   * The rarity actually drawn when a table asks for `rarity`: itself if the pool has any, else the
   * nearest *lower* rarity that exists, else the nearest higher one; null for an empty pool.
   * The Phase 2 Emberdawn subset (~40 cards) lacks some rarities, and a pull that falls back
   * lower keeps pack EV from inflating (docs/02 §11.3).
   */
  resolve(rarity: Rarity): Rarity | null;
}

/**
 * Booster packs never contain promos (they come from promo pools) or basic Essences, which ship in
 * starter decks and evolution packs; the special textured Essences are Secret Rares and do appear
 * (docs/03 §3.3).
 */
export function isBoosterEligible(card: Pick<CardDef, 'rarity' | 'kind'>): boolean {
  if (card.rarity === 'promo') return false;
  if (card.kind === 'essence') return isAtLeast(card.rarity, 'secretRare');
  return true;
}

const EMPTY: readonly CardDef[] = [];

/** Builds a pool from a set's cards (ineligible cards are skipped). */
export function buildCardPool(cards: Iterable<CardDef>): CardPool {
  const byId = new Map<string, CardDef>();
  const byRarity = new Map<Rarity, CardDef[]>();
  for (const card of cards) {
    if (!isBoosterEligible(card) || byId.has(card.id)) continue;
    byId.set(card.id, card);
    const list = byRarity.get(card.rarity);
    if (list) list.push(card);
    else byRarity.set(card.rarity, [card]);
  }

  const withFinish = new Map<string, readonly CardDef[]>();
  const resolved = new Map<Rarity, Rarity | null>();

  const cardsOf = (rarity: Rarity, finish?: Finish): readonly CardDef[] => {
    const all = byRarity.get(rarity) ?? EMPTY;
    if (!finish) return all;
    const key = `${rarity}|${finish}`;
    let list = withFinish.get(key);
    if (!list) {
      const printed = all.filter((card) => card.finishes.includes(finish));
      list = printed.length > 0 ? printed : all;
      withFinish.set(key, list);
    }
    return list;
  };

  const resolve = (rarity: Rarity): Rarity | null => {
    const cached = resolved.get(rarity);
    if (cached !== undefined) return cached;
    let found: Rarity | null = byRarity.has(rarity) ? rarity : null;
    const rank = rarityRank(rarity);
    for (let r = rank - 1; found === null && r >= 0; r--) {
      const lower = RARITY_LADDER[r];
      if (lower && byRarity.has(lower)) found = lower;
    }
    for (let r = rank + 1; found === null && r < RARITY_LADDER.length; r++) {
      const higher = RARITY_LADDER[r];
      if (higher && byRarity.has(higher)) found = higher;
    }
    resolved.set(rarity, found);
    return found;
  };

  return {
    size: byId.size,
    get: (cardId) => byId.get(cardId),
    hasRarity: (rarity) => byRarity.has(rarity),
    cardsOf,
    resolve,
  };
}

/** The booster pool of one set. */
export function setCardPool(cards: Iterable<CardDef>, setId: string): CardPool {
  const inSet: CardDef[] = [];
  for (const card of cards) if (card.setId === setId) inSet.push(card);
  return buildCardPool(inSet);
}
