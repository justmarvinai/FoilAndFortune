import { z } from '@/core/zod';
import { hexColor } from './common';

/**
 * Creature genome: a renderer-agnostic, semantic description of a species' look (docs/04 §6,
 * docs/07 §2.6). Every art style (Clay Critters SDF, Sticker Pop SVG, …) interprets the same
 * genome, so one species definition drives all card art, and evolutions can derive from their
 * parent's genome.
 */

/** Which palette slot a part is painted with. */
export const colorRefSchema = z.enum(['primary', 'secondary', 'accent', 'belly', 'glow']);
export type ColorRef = z.infer<typeof colorRefSchema>;

const unit = z.number().min(0).max(1);

export const genomeExtraSchema = z.discriminatedUnion('kind', [
  /** Frilly external gills on both sides of the head (axolotl-like). */
  z.object({
    kind: z.literal('gills'),
    count: z.number().int().min(1).max(4),
    color: colorRefSchema,
  }),
  /** Chevron/lightning stripes. */
  z.object({
    kind: z.literal('stripes'),
    where: z.enum(['back', 'tail', 'legs']),
    count: z.number().int().min(1).max(5),
    color: colorRefSchema,
  }),
  /** Fluffy fur collar on the chest. */
  z.object({ kind: z.literal('ruff'), color: colorRefSchema }),
  /** Small curl/tuft on top of the head (e.g., a flame curl). */
  z.object({
    kind: z.literal('head-tuft'),
    shape: z.enum(['flame', 'leaf', 'spark', 'fluff']),
    color: colorRefSchema,
  }),
  /** Mark on the forehead. */
  z.object({
    kind: z.literal('forehead-mark'),
    shape: z.enum(['bolt', 'flame', 'star', 'drop', 'diamond']),
    color: colorRefSchema,
  }),
  /** Colored paws ("socks"). */
  z.object({ kind: z.literal('socks'), color: colorRefSchema }),
  /** Scattered spots on the body. */
  z.object({
    kind: z.literal('spots'),
    count: z.number().int().min(1).max(12),
    color: colorRefSchema,
  }),
]);
export type GenomeExtra = z.infer<typeof genomeExtraSchema>;

export const creatureGenomeSchema = z.object({
  version: z.literal(1),
  /** Body plan: decides skeleton/silhouette family. */
  plan: z.enum(['quadruped', 'amphibian', 'biped', 'bird', 'serpent', 'blob', 'insect', 'fish']),
  /** Overall scale hint: baby forms ≈ 0.8, final evolutions ≈ 1.2. */
  size: z.number().min(0.5).max(1.5),
  proportions: z.object({
    /** Head size relative to body. 1 = very chibi. */
    head: unit,
    /** Body length/bulk. */
    body: unit,
    /** Leg length. */
    legs: unit,
    /** Tail size. */
    tail: unit,
  }),
  palette: z.object({
    primary: hexColor,
    secondary: hexColor,
    accent: hexColor,
    belly: hexColor,
    eyes: hexColor,
    glow: hexColor,
  }),
  head: z.object({
    shape: z.enum(['round', 'fox', 'pup', 'axolotl', 'feline', 'beaked']),
    muzzle: z.enum(['none', 'short', 'pointed', 'round', 'wide']),
    nose: z.enum(['none', 'button', 'triangle']),
  }),
  face: z.object({
    eyes: z.enum(['round', 'sparkle', 'sleepy', 'fierce']),
    eyeSize: unit,
    mouth: z.enum(['smile', 'grin', 'fang', 'open', 'beak', 'none']),
    blush: z.boolean(),
  }),
  ears: z.object({
    shape: z.enum(['none', 'pointed', 'round', 'floppy', 'long', 'fin']),
    size: unit,
    color: colorRefSchema,
    innerColor: colorRefSchema,
  }),
  tail: z.object({
    shape: z.enum(['none', 'fluffy', 'spark', 'flame', 'fin', 'leaf', 'curl', 'bolt']),
    size: unit,
    color: colorRefSchema,
    tipColor: colorRefSchema,
  }),
  extras: z.array(genomeExtraSchema),
  /** Ambient element effect around the creature in art. */
  elementFx: z.enum([
    'sparks',
    'embers',
    'bubbles',
    'petals',
    'dust',
    'runes',
    'wisps',
    'snow',
    'none',
  ]),
});
export type CreatureGenome = z.infer<typeof creatureGenomeSchema>;
