import type { BalanceConfig } from '@/content/balance';
import type { Finish } from '@/content/schema/common';
import type { CardDef, ProductDef } from '@/content/schema/tcg';
import type { Cents } from '@/core/money';

/**
 * Card prints and market reference values. Phase 2 has no daily market yet (Phase 3, docs/02
 * §12): sealed product is worth its MSRP while in print, singles their base value × finish.
 */

export type Condition = 'mint' | 'nearMint' | 'good' | 'played' | 'damaged';

export interface CardPrint {
  cardId: string;
  finish: Finish;
  /** Stamps like 1st Edition (docs/03 §3.4), sorted. */
  stamps: string[];
  condition: Condition;
}

const CONDITIONS: readonly Condition[] = ['mint', 'nearMint', 'good', 'played', 'damaged'];

/**
 * Stack key `${cardId}|${finish}|${stamps}|${condition}` (docs/07 §3 `cardStacks`). Everything
 * is Near Mint and unstamped until conditions and 1st Edition waves arrive. Misprints are stamps
 * too, named `misprint.<kind>` (e.g. `misprint.miscut`), so they stack separately and keep their
 * premium (docs/02 §7.2).
 */
export function cardKey(print: {
  cardId: string;
  finish: Finish;
  stamps?: readonly string[];
  condition?: Condition;
}): string {
  const stamps = [...(print.stamps ?? [])].sort().join('+');
  return `${print.cardId}|${print.finish}|${stamps}|${print.condition ?? 'nearMint'}`;
}

export function parseCardKey(key: string): CardPrint | null {
  const [cardId, finish, stamps, condition] = key.split('|');
  if (!cardId || !finish || stamps === undefined || !condition) return null;
  if (!CONDITIONS.includes(condition as Condition)) return null;
  return {
    cardId,
    finish: finish as Finish,
    stamps: stamps ? stamps.split('+') : [],
    condition: condition as Condition,
  };
}

/** Market value of one Near Mint copy in the given finish (docs/02 §7.2). */
export function cardMarketValue(
  card: Pick<CardDef, 'rarity' | 'baseValueCents'>,
  finish: Finish,
  balance: Pick<BalanceConfig, 'cards'>,
): Cents {
  if (finish === 'reverseHolo') {
    const multiplier = balance.cards.reverseHolo[card.rarity] ?? 1;
    return Math.max(
      balance.cards.reverseHoloFloorCents,
      Math.round(card.baseValueCents * multiplier),
    );
  }
  const multiplier = balance.cards.finishMultiplier[finish] ?? 1;
  return Math.round(card.baseValueCents * multiplier);
}

/** Market value of a sealed product in print (docs/02 §12.2). */
export function productMarketValue(
  product: Pick<ProductDef, 'msrpCents'>,
  balance: Pick<BalanceConfig, 'cards'>,
): Cents {
  return Math.round(product.msrpCents * balance.cards.sealedInPrintFactor);
}
