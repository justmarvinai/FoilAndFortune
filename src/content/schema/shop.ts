import { z } from '@/core/zod';
import { contentId } from './common';
import { productKindSchema } from './tcg';

/** Shop content schemas (docs/07 §2.2): fixtures, layouts and suppliers. */

/** What a fixture's slots can hold: sealed product kinds, raw singles, or nothing (decor). */
export const slotAcceptsSchema = z.union([
  z.object({ kind: z.literal('sealed'), productKinds: z.array(productKindSchema).min(1) }),
  z.object({ kind: z.literal('singles') }),
  z.object({ kind: z.literal('none') }),
]);
export type SlotAccepts = z.infer<typeof slotAcceptsSchema>;

export const fixtureSchema = z.object({
  id: contentId,
  name: z.string(),
  category: z.enum([
    'shelf',
    'case',
    'rack',
    'manga',
    'bin',
    'pegboard',
    'vending',
    'register',
    'table',
    'service',
    'decor',
  ]),
  /** Footprint in tiles before rotation: `w` along the fixture's front, `d` into the room. */
  footprint: z.object({ w: z.number().int().positive(), d: z.number().int().positive() }),
  /** Hangs on a wall (its back must touch a wall edge). */
  wallMounted: z.boolean(),
  /** Occupies its floor tiles (shelves, counters). Posters and wall art don't. */
  blocksFloor: z.boolean(),
  slots: z.object({ count: z.number().int().min(0), accepts: slotAcceptsSchema }),
  /** Appeal contribution (docs/02 §4.4). */
  appeal: z.number(),
  costCents: z.number().int().min(0),
  unlockLevel: z.number().int().min(1),
});
export type FixtureDef = z.infer<typeof fixtureSchema>;

/** Integer tile coordinate on the shop grid: `x` east (0 = west wall), `z` south (0 = north wall). */
export const tileSchema = z.object({ x: z.number().int().min(0), z: z.number().int().min(0) });
export type Tile = z.infer<typeof tileSchema>;

/**
 * Rotation in quarter turns. 0 = the fixture's front faces south (+z), 1 = west, 2 = north,
 * 3 = east. The footprint is anchored at `(x, z)`, its top-left tile after rotation.
 */
export const rotationSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type Rotation = z.infer<typeof rotationSchema>;

export const layoutFixtureSchema = z.object({
  /** Stable per-layout uid, referenced by GameState slots and customer plans. */
  uid: z.string().regex(/^[a-z0-9-]+$/),
  fixtureId: contentId,
  x: z.number().int().min(0),
  z: z.number().int().min(0),
  rot: rotationSchema,
});
export type LayoutFixture = z.infer<typeof layoutFixtureSchema>;

/**
 * A shop layout on the tier grid (docs/01 §7.5). The door sits on the west wall at `door.z`;
 * customers spawn on the street and walk in through it. Phase 2 ships the fixed Tier-1 starter
 * layout; Build Mode (Phase 3) edits a copy stored in GameState.
 */
export const layoutSchema = z.object({
  id: contentId,
  tier: z.number().int().min(1).max(5),
  grid: z.object({ w: z.number().int().positive(), d: z.number().int().positive() }),
  door: z.object({ z: z.number().int().min(0) }),
  fixtures: z.array(layoutFixtureSchema),
});
export type LayoutDef = z.infer<typeof layoutSchema>;

export const supplierItemSchema = z.object({
  productId: contentId,
  costCents: z.number().int().positive(),
  minQty: z.number().int().positive(),
});
export type SupplierItem = z.infer<typeof supplierItemSchema>;

export const supplierSchema = z.object({
  id: contentId,
  name: z.string(),
  unlockLevel: z.number().int().min(1),
  /** Deliveries arrive at dawn this many days after the order day. */
  deliveryDays: z.number().int().min(1),
  items: z.array(supplierItemSchema).min(1),
});
export type SupplierDef = z.infer<typeof supplierSchema>;
