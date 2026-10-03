import type { ContentRegistry } from '@/content/registry';
import type { ProductDef, ProductKind } from '@/content/schema/tcg';
import type { Cents } from '@/core/money';
import { canOpenProduct, canUnboxProduct } from '@/sim/systems/opening';
import {
  averageCost,
  type Fixtures,
  incomingUnits,
  lotsHolding,
  type Orders,
  type Sealed,
  shelfHoldings,
} from './stock';

/** Sealed tab of the Backroom (docs/05 §5.4, docs/01 §9.3, §14.4). */

export interface SealedRow {
  product: ProductDef;
  inStorage: number;
  onShelf: number;
  incoming: number;
  /** Average unit cost of everything you hold (closet + shelves); null when you hold none. */
  avgCostCents: Cents | null;
  /** Closet space the stored units take (SU). */
  storageUnits: number;
  /** Rip it open (docs/01 §14). */
  canOpen: boolean;
  /** Break it into loose packs (docs/01 §14.4): booster boxes, not retail blisters. */
  canBreak: boolean;
  /** Loose packs it breaks into. */
  packsInside: number;
}

/** Display order on the shelves of the Backroom: smallest item first. */
const KIND_ORDER: readonly ProductKind[] = [
  'booster',
  'blister',
  'starterDeck',
  'tin',
  'collection',
  'bundle',
  'eliteBox',
  'box',
];

/** Multi-pack displays you'd break to sell packs singly (docs/01 §14.4). */
const BREAKABLE_KINDS: ReadonlySet<ProductKind> = new Set(['box', 'bundle', 'importBox']);

function kindRank(kind: ProductKind): number {
  const index = KIND_ORDER.indexOf(kind);
  return index === -1 ? KIND_ORDER.length : index;
}

export function packCount(product: Pick<ProductDef, 'contents'>): number {
  let packs = 0;
  for (const entry of product.contents) if (entry.type === 'pack') packs += entry.count;
  return packs;
}

/** Every product you hold or have on order, smallest first. */
export function sealedRows(
  sealed: Sealed,
  fixtures: Fixtures,
  orders: Orders,
  content: ContentRegistry,
): SealedRow[] {
  const shelves = shelfHoldings(fixtures);
  const incoming = incomingUnits(orders);
  const ids = new Set([...Object.keys(sealed), ...shelves.keys(), ...incoming.keys()]);
  const rows: SealedRow[] = [];
  for (const productId of ids) {
    const product = content.products.get(productId);
    if (!product) continue;
    const storage = lotsHolding(sealed[productId]);
    const shelf = shelves.get(productId);
    const row: SealedRow = {
      product,
      inStorage: storage.qty,
      onShelf: shelf?.qty ?? 0,
      incoming: incoming.get(productId) ?? 0,
      avgCostCents: averageCost(storage, shelf),
      storageUnits: storage.qty * product.storageUnits,
      canOpen: canOpenProduct(content, productId),
      canBreak: BREAKABLE_KINDS.has(product.kind) && canUnboxProduct(content, productId),
      packsInside: packCount(product),
    };
    if (row.inStorage + row.onShelf + row.incoming > 0) rows.push(row);
  }
  return rows.sort(
    (a, b) =>
      kindRank(a.product.kind) - kindRank(b.product.kind) ||
      a.product.name.localeCompare(b.product.name),
  );
}

/**
 * Closet space a break needs on top of what the box frees (docs/02 §4.3: 36 packs × 1 SU replace
 * an 18 SU box). Mirrors the check in `unboxProduct` (src/sim/systems/opening).
 */
export function breakExtraUnits(product: ProductDef, content: ContentRegistry): number {
  let units = 0;
  for (const entry of product.contents) {
    if (entry.type !== 'pack') continue;
    units += entry.count * (content.products.get(entry.productId)?.storageUnits ?? 0);
  }
  return Math.max(0, units - product.storageUnits);
}

/** The loose pack a breakable product turns into (for the confirmation art). */
export function loosePackId(product: ProductDef): string | null {
  for (const entry of product.contents) if (entry.type === 'pack') return entry.productId;
  return null;
}

export interface ShelfTarget {
  fixtureUid: string;
  slot: number;
  /** Units the slot already holds of this product (0 = empty slot). */
  qty: number;
  capacity: number;
  /** A sold-out slot remembering another product (Restock All would refill that one). */
  replaces?: string;
}

/**
 * Shelf slots a product can go to from the Backroom ("Stock a shelf"): slots already holding it
 * that have room, then empty slots, then sold-out slots of other products. Singles-only and full
 * slots are skipped.
 */
export function shelfTargets(
  productId: string,
  fixtures: Fixtures,
  content: ContentRegistry,
): ShelfTarget[] {
  const product = content.products.get(productId);
  if (!product) return [];
  const topUps: ShelfTarget[] = [];
  const empties: ShelfTarget[] = [];
  const soldOut: ShelfTarget[] = [];
  for (const fixture of fixtures) {
    const def = content.fixtures.get(fixture.fixtureId);
    if (def?.slots.accepts.kind !== 'sealed') continue;
    if (!def.slots.accepts.productKinds.includes(product.kind)) continue;
    fixture.slots.forEach((slot, index) => {
      const target: ShelfTarget = {
        fixtureUid: fixture.uid,
        slot: index,
        qty: slot.productId === productId ? slot.qty : 0,
        capacity: product.perShelfSlot,
      };
      if (slot.productId === productId) {
        if (slot.qty < product.perShelfSlot) topUps.push(target);
      } else if (slot.qty === 0) {
        if (slot.productId === undefined) empties.push(target);
        else soldOut.push({ ...target, replaces: slot.productId });
      }
    });
  }
  return [...topUps, ...empties, ...soldOut];
}

/**
 * Units "Restock All" would move from the closet to the shelves right now: every slot that holds
 * a product is topped up FIFO in layout order, like `restockAll` (src/sim/systems/stock).
 */
export function restockPreview(
  fixtures: Fixtures,
  sealed: Sealed,
  content: ContentRegistry,
  only?: string,
): number {
  const remaining = new Map<string, number>();
  let moved = 0;
  for (const fixture of fixtures) {
    if (only !== undefined && fixture.uid !== only) continue;
    const def = content.fixtures.get(fixture.fixtureId);
    if (def?.slots.accepts.kind !== 'sealed') continue;
    for (const slot of fixture.slots) {
      if (!slot.productId) continue;
      const product = content.products.get(slot.productId);
      if (!product || !def.slots.accepts.productKinds.includes(product.kind)) continue;
      const left = remaining.get(slot.productId) ?? lotsHolding(sealed[slot.productId]).qty;
      const take = Math.max(0, Math.min(product.perShelfSlot - slot.qty, left));
      remaining.set(slot.productId, left - take);
      moved += take;
    }
  }
  return moved;
}
