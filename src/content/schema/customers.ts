import { z } from '@/core/zod';
import { contentId } from './common';
import { productKindSchema } from './tcg';

/** Customer archetypes (docs/01 §10.1, docs/02 §5.2, docs/07 §2.3). */

/**
 * What a customer can want. `sealed` targets product kinds on shelves; `singles` targets cards in
 * display cases, optionally only up to a rarity tier (kids love cheap holos).
 */
export const preferenceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('sealed'),
    productKind: productKindSchema,
    weight: z.number().positive(),
  }),
  z.object({
    kind: z.literal('singles'),
    /** Only singles whose market value is at most this (e.g. "cheap holos"). */
    maxValueCents: z.number().int().positive().optional(),
    weight: z.number().positive(),
  }),
]);
export type Preference = z.infer<typeof preferenceSchema>;

export const haggleStyleSchema = z.enum(['pushover', 'fair', 'tough', 'chaotic']);

export const archetypeSchema = z.object({
  id: contentId,
  /** Budget range in cents; one value is drawn per visit. */
  budgetCents: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  /** How well they know market prices, 0–1 (docs/02 §5.3). */
  knowledge: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
  /** Price sensitivity `s` in the buy-probability curve. */
  priceSensitivity: z.number().positive(),
  /** Base price tolerance `τ_base`. */
  toleranceBase: z.number().min(0),
  /** Patience in game-minutes, drawn per visit. */
  patienceMinutes: z.tuple([z.number().positive(), z.number().positive()]),
  haggleStyles: z.array(z.object({ style: haggleStyleSchema, weight: z.number().positive() })),
  /** Minimum reputation stars before this archetype visits. */
  minRepStars: z.number().min(0).max(5),
  /** Base weight in the arrival mix (docs/02 §5.2). */
  mixWeight: z.number().positive(),
  /** Mean basket size (Poisson), at least 1 item is attempted. */
  basketMean: z.number().positive(),
  preferences: z.array(preferenceSchema).min(1),
  /** Chance this visitor wants to sell instead of buy (Phase 3 buy offers). */
  sellIntentChance: z.number().min(0).max(1),
});
export type ArchetypeDef = z.infer<typeof archetypeSchema>;

/** Progression unlocks (docs/02 §9.3). `built: false` grants a placeholder perk until built. */
export const unlockSchema = z.object({
  id: contentId,
  level: z.number().int().min(1),
  /** The feature exists in this build; otherwise the level grants `perkId` instead. */
  built: z.boolean(),
  perkId: contentId.optional(),
});
export type UnlockDef = z.infer<typeof unlockSchema>;

export const perkSchema = z.object({
  id: contentId,
  effect: z.discriminatedUnion('type', [
    z.object({ type: z.literal('storageUnits'), amount: z.number().int().positive() }),
    z.object({ type: z.literal('supplierDiscount'), pct: z.number().positive().max(0.5) }),
  ]),
});
export type PerkDef = z.infer<typeof perkSchema>;
