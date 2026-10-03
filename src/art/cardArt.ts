import { BIOME_IDS, type BiomeId, type CreatureArtRequest } from '@/art/types';
import type { SpeciesDef } from '@/content/schema/species';
import type { CardDef } from '@/content/schema/tcg';

/**
 * Card → art request, shared by the runtime renderer and the build-time render
 * (scripts/art/render.ts). Pure and DOM-free so Node can import it.
 */

/** Runtime render size at scale 1: the card art box (≈ 1.48:1, see cards.css) and the 5:7 card. */
export const RUNTIME_ART_SIZE = {
  window: { width: 648, height: 438 },
  fullArt: { width: 500, height: 700 },
} as const;

/**
 * Pre-rendered WebP size: crisp on a ~300 px card at DPR 2 (the art box is ≈ 259 × 175 CSS px,
 * the full card 300 × 420) while fitting the docs/08 §5 budgets.
 */
export const PRERENDER_ART = {
  window: { width: 560, height: 378, budgetBytes: 30 * 1024 },
  fullArt: { width: 600, height: 840, budgetBytes: 70 * 1024 },
} as const;

function asBiome(value: string | undefined): BiomeId | undefined {
  return BIOME_IDS.find((biome) => biome === value);
}

/** Cards that carry an illustration (basic Essences draw an emblem instead). */
export function hasIllustration(card: Pick<CardDef, 'kind'>): boolean {
  return card.kind !== 'essence';
}

/**
 * The render request for a card: its species' genome, or for tactics the art spec's prop
 * (Items, Allies) or nothing at all (Arenas: the biome alone). `size` overrides the runtime size.
 */
export function artRequestFor(
  card: CardDef,
  species: SpeciesDef | undefined,
  scale = 1,
  size?: { width: number; height: number },
): CreatureArtRequest {
  const composition = card.art.composition;
  const base = size ?? RUNTIME_ART_SIZE[composition];
  const biome = asBiome(card.art.biome ?? species?.biome);
  const subject = species
    ? { genome: species.genome }
    : card.art.prop
      ? { prop: card.art.prop }
      : {};
  return {
    ...subject,
    element: species?.element ?? card.element ?? 'neutral',
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale),
    composition,
    pose: card.art.pose,
    background: 'biome',
    ...(biome ? { biome } : {}),
    timeOfDay: card.art.timeOfDay,
    seed: card.art.seed,
  };
}

/** The species a card's art shows (art spec first, then the card's own species). */
export function artSpeciesId(card: Pick<CardDef, 'art' | 'speciesId'>): string | undefined {
  return card.art.speciesId ?? card.speciesId;
}

/** `gk.emberdawn` → `emberdawn`: the folder of a set's pre-rendered art (docs/08 §6). */
export function setSlug(setId: string): string {
  return setId.split('.').slice(1).join('-') || setId;
}

/** `gk.emberdawn.012` → `012.webp`. */
export function artFileName(card: Pick<CardDef, 'number'>): string {
  return `${String(card.number).padStart(3, '0')}.webp`;
}
