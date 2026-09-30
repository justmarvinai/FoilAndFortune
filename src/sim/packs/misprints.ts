import { cardKey } from '../cards';
import type { PulledCard } from '../events';

/** Factory misprints (docs/03 §3.4, docs/02 §11.1). */
export type MisprintKind = NonNullable<PulledCard['misprint']>;

export const MISPRINT_KINDS: readonly MisprintKind[] = [
  'miscut',
  'inkError',
  'missingFoil',
  'crimped',
  'wrongBack',
];

const STAMP_PREFIX = 'misprint.';

/**
 * A misprint travels as a stamp named `misprint.<kind>` in the card's stack key (src/sim/cards.ts),
 * so misprinted copies stack separately and keep their premium (docs/02 §7.2).
 */
export function misprintStamp(kind: MisprintKind): string {
  return `${STAMP_PREFIX}${kind}`;
}

/** The misprint recorded in a print's stamps, if any (unknown kinds are ignored). */
export function misprintOf(stamps: readonly string[]): MisprintKind | null {
  for (const stamp of stamps) {
    if (!stamp.startsWith(STAMP_PREFIX)) continue;
    const kind = stamp.slice(STAMP_PREFIX.length) as MisprintKind;
    if (MISPRINT_KINDS.includes(kind)) return kind;
  }
  return null;
}

/**
 * The stack key a pulled card is stored under: Near Mint, no stamps except its misprint. Use it
 * with `itemMarketValue` to show a pulled card's value.
 */
export function pulledCardKey(card: PulledCard): string {
  return cardKey({
    cardId: card.cardId,
    finish: card.finish,
    stamps: card.misprint ? [misprintStamp(card.misprint)] : [],
  });
}
