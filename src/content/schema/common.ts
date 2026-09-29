import { z } from '@/core/zod';

/** `#RRGGBB` color. */
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #RRGGBB');

/** Dotted lowercase content ID, e.g. `gk.emberdawn.045` (docs/03 §1.1). */
export const contentId = z
  .string()
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'expected dotted lowercase id like gk.emberdawn.045');

export const elementIdSchema = z.enum([
  'ember',
  'tide',
  'bloom',
  'volt',
  'terra',
  'mystic',
  'shade',
  'frost',
  'neutral',
]);
export type ElementId = z.infer<typeof elementIdSchema>;

export const raritySchema = z.enum([
  'common',
  'uncommon',
  'rare',
  'holoRare',
  'ultraRare',
  'illustrationRare',
  'secretRare',
  'mythicRare',
  'promo',
]);
export type Rarity = z.infer<typeof raritySchema>;

export const finishSchema = z.enum([
  'normal',
  'reverseHolo',
  'holo',
  'fullArtTextured',
  'gold',
  'rainbow',
  'cosmos',
  'etched',
  'crystal',
]);
export type Finish = z.infer<typeof finishSchema>;
