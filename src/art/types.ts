import type { ElementId } from '@/content/schema/common';
import type { CreatureGenome } from '@/content/schema/genome';

/**
 * Contract between card/UI code and creature art styles (docs/04 §6). Every style module
 * (`src/art/clay`; ADR-006 chose Clay Critters for all card art) exports a `CreatureArtRenderer`.
 */

/** Background scenes. Each species has a default biome (SpeciesDef.biome). */
export type BiomeId = 'storm-meadow' | 'volcano-dawn' | 'lagoon';

export type ArtPose = 'idle' | 'happy' | 'action';

/**
 * `window` = the standard card art window (≈ 3:2 landscape).
 * `fullArt` = full-bleed card art (5:7 portrait) used by Illustration Rares and full arts.
 */
export type ArtComposition = 'window' | 'fullArt';

export interface CreatureArtRequest {
  genome: CreatureGenome;
  element: ElementId;
  /** Output size in pixels. */
  width: number;
  height: number;
  composition: ArtComposition;
  pose?: ArtPose;
  /** Draw the biome scene behind the creature, or leave it transparent. */
  background?: 'biome' | 'transparent';
  biome?: BiomeId;
  timeOfDay?: 'day' | 'dusk' | 'night';
  /** Deterministic variation (particles, small pose/lighting jitter). Same seed → same image. */
  seed?: number;
}

export interface CreatureArtRenderer {
  id: 'clay';
  /** Short display label, e.g. "Clay Critters". */
  label: string;
  /** Renders to an image Blob (PNG or WebP). Must be deterministic for a given request. */
  render(request: CreatureArtRequest): Promise<Blob>;
}
