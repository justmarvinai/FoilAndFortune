import { z } from '@/core/zod';
import { hexColor } from './common';

/**
 * Creature genome: a renderer-agnostic, semantic description of a species' look (docs/04 §6,
 * docs/07 §2.6). Every art style (today: Clay Critters SDF, ADR-006) interprets the same
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
  /**
   * Small curl/tuft on top of the head (e.g., a flame curl). `flower` is a blossom crown,
   * `crest` a fan of swept-back crest feathers (birds).
   */
  z.object({
    kind: z.literal('head-tuft'),
    shape: z.enum(['flame', 'leaf', 'spark', 'fluff', 'flower', 'crest']),
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
  /** Stag antlers: `bolt` = zig-zag lightning antlers, `branch` = classic tined antlers. */
  z.object({
    kind: z.literal('antlers'),
    shape: z.enum(['bolt', 'branch']),
    size: unit,
    color: colorRefSchema,
    /** Glowing tips (they light the scene a little). */
    glow: z.boolean(),
  }),
  /** Horns sweeping back from the brow (`swept`) or short nubs. */
  z.object({
    kind: z.literal('horns'),
    shape: z.enum(['swept', 'nub']),
    size: unit,
    color: colorRefSchema,
  }),
  /**
   * Wings. Birds always have wings (a default pair when this is missing); other plans grow
   * small ones from the shoulders (`dragon`). `flame` wings burn toward the feather tips.
   */
  z.object({
    kind: z.literal('wings'),
    style: z.enum(['feather', 'flame', 'stubby', 'dragon']),
    size: unit,
    color: colorRefSchema,
    tipColor: colorRefSchema,
  }),
  /** Armored back shell of overlapping bands (armadillo); `glowSeams` makes the seams glow. */
  z.object({
    kind: z.literal('shell'),
    bands: z.number().int().min(2).max(7),
    color: colorRefSchema,
    seamColor: colorRefSchema,
    glowSeams: z.boolean(),
  }),
  /** Mane around the neck: flame tongues, crackling spikes or a fluffy collar. */
  z.object({
    kind: z.literal('mane'),
    style: z.enum(['flame', 'spark', 'fluff']),
    color: colorRefSchema,
    tipColor: colorRefSchema,
  }),
  /** Face markings: a bandit mask band across the eyes, or panda eye patches. */
  z.object({
    kind: z.literal('mask'),
    shape: z.enum(['bandit', 'patches']),
    color: colorRefSchema,
  }),
]);
export type GenomeExtra = z.infer<typeof genomeExtraSchema>;

/** Ambient element effect around the subject in art (particles). */
export const elementFxSchema = z.enum([
  'sparks',
  'embers',
  'bubbles',
  'petals',
  'dust',
  'runes',
  'wisps',
  'snow',
  'none',
]);
export type ElementFx = z.infer<typeof elementFxSchema>;

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
  elementFx: elementFxSchema,
});
export type CreatureGenome = z.infer<typeof creatureGenomeSchema>;

/**
 * Still-life subjects for tactic-card art (docs/04 §6.2): a clay prop for Items, a Peg-folk
 * figure for Allies. Like the creature genome it's semantic and renderer-agnostic: each art style
 * decides what a "round potion" or a "ranger hat" looks like. Arenas need no prop (the biome
 * alone is the picture).
 */
const propBase = {
  /** Particles around the prop (same effects as creatures). */
  fx: elementFxSchema,
  /** Glow color of the prop's magic (particles, halo, the light it casts). */
  glow: hexColor,
};

export const artPropSchema = z.discriminatedUnion('kind', [
  /** A stoppered flask of glowing liquid. */
  z.object({
    kind: z.literal('potion'),
    ...propBase,
    shape: z.enum(['round', 'tall']),
    glass: hexColor,
    liquid: hexColor,
    stopper: hexColor,
    /** Paper label band color. */
    label: hexColor,
  }),
  /** A floating pendant: a four-point star or a round sun disc around a gem. */
  z.object({
    kind: z.literal('charm'),
    ...propBase,
    shape: z.enum(['star', 'sun']),
    metal: hexColor,
    gem: hexColor,
  }),
  /** A little carry lantern with a live flame. */
  z.object({
    kind: z.literal('lantern'),
    ...propBase,
    frame: hexColor,
    glass: hexColor,
    flame: hexColor,
  }),
  /** A Peg-folk character (docs/04 §4.4), the same toy family as the shop's customers. */
  z.object({
    kind: z.literal('folk'),
    ...propBase,
    age: z.enum(['kid', 'adult', 'elder']),
    skin: hexColor,
    hair: hexColor,
    hairStyle: z.enum(['bob', 'bun', 'spiky', 'tufts', 'short']),
    top: hexColor,
    bottom: hexColor,
    /** Neckerchief, buttons, hat band. */
    accent: hexColor,
    hat: z.enum(['none', 'ranger', 'cap']),
    glasses: z.boolean(),
  }),
]);
export type ArtProp = z.infer<typeof artPropSchema>;
