import type { Finish, Rarity } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';

/**
 * The rarity ladder from Common to Mythic Rare (docs/03 §3.4). Promos sit outside the ladder:
 * they come from promo pools, never from pull tables.
 */
export const RARITY_LADDER = [
  'common',
  'uncommon',
  'rare',
  'holoRare',
  'ultraRare',
  'illustrationRare',
  'secretRare',
  'mythicRare',
] as const satisfies readonly Rarity[];

const LADDER: readonly Rarity[] = RARITY_LADDER;

/** Position on the ladder (Common = 0), or -1 for off-ladder rarities (Promo). */
export function rarityRank(rarity: Rarity): number {
  return LADDER.indexOf(rarity);
}

/** True when `rarity` is on the ladder at `min` or above. */
export function isAtLeast(rarity: Rarity, min: Rarity): boolean {
  const rank = rarityRank(rarity);
  return rank >= 0 && rank >= rarityRank(min);
}

/**
 * "Holo Rare or better": the hits that emit `card/pulled`, earn pull XP (docs/02 §9.1) and star
 * in the Quick Rip highlights reel (docs/01 §14.2).
 */
export function isHit(rarity: Rarity): boolean {
  return isAtLeast(rarity, 'holoRare');
}

/** Every finish except Normal has foil layers, which a Missing Foil misprint needs (docs/02 §11.1). */
export function isFoil(finish: Finish): boolean {
  return finish !== 'normal';
}

/**
 * The finish of a card drawn without an explicit finish in its pull table: Holo Rare → Holo,
 * Common/Uncommon/Rare → Normal, higher rarities (and promos) → the card's first listed finish
 * (docs/03 §3.4). A card that isn't printed in the rule's finish falls back to its first listed
 * finish too, so the sim never invents a print that doesn't exist.
 */
export function defaultFinish(card: Pick<CardDef, 'rarity' | 'finishes'>): Finish {
  let preferred: Finish | undefined;
  if (card.rarity === 'holoRare') preferred = 'holo';
  else if (rarityRank(card.rarity) >= 0 && !isAtLeast(card.rarity, 'holoRare')) {
    preferred = 'normal';
  }
  if (preferred && card.finishes.includes(preferred)) return preferred;
  return card.finishes[0] ?? 'normal';
}
