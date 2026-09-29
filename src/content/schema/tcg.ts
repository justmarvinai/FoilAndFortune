import { z } from '@/core/zod';
import { contentId, elementIdSchema, finishSchema, hexColor, raritySchema } from './common';

/** TCG content schemas (docs/07 §2.1). Types are inferred from the schemas. */

export const brandSchema = z.object({
  id: z.string().regex(/^[a-z]{2,4}$/),
  name: z.string(),
  publisher: z.string(),
  tagline: z.string(),
  elements: z.array(elementIdSchema).min(1),
  /** Level required to stock this brand (flagship: 1). */
  unlockLevel: z.number().int().min(1),
  /** Card-back artwork colors (docs/04 §5.2). */
  cardBack: z.object({
    glow: hexColor,
    goldLight: hexColor,
    gold: hexColor,
    goldDark: hexColor,
    outline: hexColor,
    core: hexColor,
  }),
});
export type BrandDef = z.infer<typeof brandSchema>;

export const attackSchema = z.object({
  name: z.string(),
  cost: z.array(elementIdSchema),
  damage: z.string().optional(),
  text: z.string().optional(),
});

export const cardArtSpecSchema = z.object({
  composition: z.enum(['window', 'fullArt']),
  speciesId: contentId.optional(),
  pose: z.enum(['idle', 'happy', 'action']).default('idle'),
  biome: z.string().optional(),
  timeOfDay: z.enum(['day', 'dusk', 'night']).default('day'),
  seed: z.number().int(),
});
export type CardArtSpec = z.infer<typeof cardArtSpecSchema>;

export const cardSchema = z.object({
  id: contentId,
  setId: contentId,
  number: z.number().int().positive(),
  name: z.string(),
  kind: z.enum(['creature', 'tactic', 'essence']),
  rarity: raritySchema,
  finishes: z.array(finishSchema).min(1),
  speciesId: contentId.optional(),
  element: elementIdSchema.optional(),
  stage: z.enum(['basic', 'stage1', 'stage2', 'nova', 'legend']).optional(),
  hp: z.number().int().positive().optional(),
  ability: z.object({ name: z.string(), text: z.string() }).optional(),
  attacks: z.array(attackSchema).max(3).optional(),
  weakness: elementIdSchema.optional(),
  resistance: elementIdSchema.optional(),
  retreat: z.number().int().min(0).max(5).optional(),
  tacticType: z.enum(['item', 'ally', 'arena']).optional(),
  rulesText: z.string().optional(),
  flavor: z.string().optional(),
  illustrator: z.string(),
  art: cardArtSpecSchema,
  /** NM market value at release, in cents (docs/02 §7.1). */
  baseValueCents: z.number().int().positive(),
  /** 0–1 competitive relevance. */
  playability: z.number().min(0).max(1),
});
export type CardDef = z.infer<typeof cardSchema>;

export const packSlotSchema = z.object({
  count: z.number().int().positive(),
  table: z
    .array(
      z.object({
        rarity: raritySchema,
        finish: finishSchema.optional(),
        weight: z.number().positive(),
      }),
    )
    .min(1),
});

export const packConfigSchema = z.object({
  id: contentId,
  cardsPerPack: z.number().int().positive(),
  slots: z.array(packSlotSchema).min(1),
  godPack: z
    .object({
      chance: z.number().min(0).max(1),
      table: z.array(z.object({ rarity: raritySchema, weight: z.number().positive() })),
    })
    .optional(),
  misprintChancePerCard: z.number().min(0).max(1),
});
export type PackConfigDef = z.infer<typeof packConfigSchema>;

export const productKindSchema = z.enum([
  'booster',
  'blister',
  'bundle',
  'box',
  'eliteBox',
  'collection',
  'tin',
  'starterDeck',
  'prereleaseKit',
  'posterCollection',
  'promoKit',
  'mysteryBox',
  'accessory',
  'mangaVolume',
  'mangaDeluxe',
  'mangaBoxSet',
  'importBooster',
  'importBox',
]);
export type ProductKind = z.infer<typeof productKindSchema>;

export const contentEntrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pack'), productId: contentId, count: z.number().int().positive() }),
  z.object({
    type: z.literal('fixedCards'),
    cards: z.array(z.object({ cardId: contentId, finish: finishSchema.optional() })),
  }),
  z.object({ type: z.literal('promoPool'), cardIds: z.array(contentId), count: z.number().int() }),
  z.object({ type: z.literal('guaranteedHoloPool'), cardIds: z.array(contentId) }),
]);

export const productSchema = z.object({
  id: contentId,
  kind: productKindSchema,
  name: z.string(),
  brandId: z.string().optional(),
  setId: contentId.optional(),
  msrpCents: z.number().int().positive(),
  /** Backroom storage units (docs/02 §4.3). */
  storageUnits: z.number().positive(),
  /** How many of this product fit in one shelf slot (docs/02 §4.2). */
  perShelfSlot: z.number().int().positive(),
  packConfigId: contentId.optional(),
  contents: z.array(contentEntrySchema),
});
export type ProductDef = z.infer<typeof productSchema>;

export const setSchema = z.object({
  id: contentId,
  brandId: z.string(),
  code: z.string().regex(/^[A-Z0-9]{3}$/),
  name: z.string(),
  era: z.enum(['vintage', 'classic', 'modern', 'special', 'future', 'generated']),
  releaseDay: z.number().int(),
  totalMain: z.number().int().positive(),
  theme: z.string(),
});
export type SetDef = z.infer<typeof setSchema>;
