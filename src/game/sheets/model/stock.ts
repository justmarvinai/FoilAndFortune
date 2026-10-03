import { type BalanceConfig, defaultBalance } from '@/content/balance';
import { type ContentRegistry, getRegistry } from '@/content/registry';
import type { Cents } from '@/core/money';
import type { GameState, SealedLot } from '@/sim/state/types';

/**
 * Shared stock math for the sheets and the Fixture Popover, computed from narrow store slices
 * (CLAUDE.md: select narrow slices) rather than the whole GameState. A few functions mirror sim
 * helpers that take a full state (`storageCapacity`, `storageUsed`, `perkSupplierDiscount`,
 * `askingPrice`); `stock.test.ts` pins them to the sim so they can't drift apart.
 */

export type Sealed = GameState['inventory']['sealed'];
export type CardStacks = GameState['inventory']['cardStacks'];
export type Fixtures = GameState['shop']['fixtures'];
export type Orders = GameState['suppliers']['orders'];
export type Prices = GameState['pricing']['prices'];
export type Collection = GameState['collection'];

/** Content and balance for pure view reads (the sim's `PureContext` without the engine). */
export interface ViewContext {
  content: ContentRegistry;
  balance: BalanceConfig;
}

export function viewContext(): ViewContext {
  return { content: getRegistry(), balance: defaultBalance };
}

export interface Holding {
  qty: number;
  /** Total cost basis of those units. */
  costCents: Cents;
}

export function lotsHolding(lots: readonly SealedLot[] | undefined): Holding {
  let qty = 0;
  let costCents = 0;
  for (const lot of lots ?? []) {
    qty += lot.qty;
    costCents += lot.qty * lot.unitCostCents;
  }
  return { qty, costCents };
}

/** Sealed units on display per product (all shelf slots together). */
export function shelfHoldings(fixtures: Fixtures): Map<string, Holding & { slots: number }> {
  const out = new Map<string, Holding & { slots: number }>();
  for (const fixture of fixtures) {
    for (const slot of fixture.slots) {
      if (!slot.productId) continue;
      const entry = out.get(slot.productId) ?? { qty: 0, costCents: 0, slots: 0 };
      entry.qty += slot.qty;
      entry.costCents += slot.costCents;
      entry.slots += 1;
      out.set(slot.productId, entry);
    }
  }
  return out;
}

/** Units on their way from suppliers, per product. */
export function incomingUnits(orders: Orders): Map<string, number> {
  const out = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== 'pending') continue;
    for (const line of order.lines)
      out.set(line.productId, (out.get(line.productId) ?? 0) + line.qty);
  }
  return out;
}

/** Average unit cost across storage and shelves; null when nothing is held. */
export function averageCost(storage: Holding, shelf: Holding | undefined): Cents | null {
  const qty = storage.qty + (shelf?.qty ?? 0);
  if (qty === 0) return null;
  return Math.round((storage.costCents + (shelf?.costCents ?? 0)) / qty);
}

/** Extra on-site storage from perks. Mirrors `perkStorageUnits` (src/sim/systems/progression). */
function perkStorage(perks: readonly string[], content: ContentRegistry): number {
  let total = 0;
  for (const perkId of perks) {
    const effect = content.perks.get(perkId)?.effect;
    if (effect?.type === 'storageUnits') total += effect.amount;
  }
  return total;
}

/** Closet capacity in SU. Mirrors `storageCapacity` (src/sim/systems/orders). */
export function storageCapacityOf(perks: readonly string[], ctx: ViewContext): number {
  return ctx.balance.storage.closet.storageUnits + perkStorage(perks, ctx.content);
}

/** Supplier discount from perks (0–0.5). Mirrors `perkSupplierDiscount`. */
export function supplierDiscountOf(perks: readonly string[], content: ContentRegistry): number {
  let pct = 0;
  for (const perkId of perks) {
    const effect = content.perks.get(perkId)?.effect;
    if (effect?.type === 'supplierDiscount') pct += effect.pct;
  }
  return Math.min(pct, 0.5);
}

export interface StorageSummary {
  /** SU used by sealed product in the closet (shelved units don't count, docs/02 §4.3). */
  used: number;
  /** SU reserved by pending deliveries. */
  incoming: number;
  capacity: number;
  /** capacity − used − incoming (never below 0). */
  free: number;
}

/** The closet meter (docs/05 §5.4). `used + incoming` mirrors `storageUsed` (src/sim/systems/orders). */
export function storageSummary(
  sealed: Sealed,
  orders: Orders,
  perks: readonly string[],
  ctx: ViewContext,
): StorageSummary {
  const unitsOf = (productId: string) => ctx.content.products.get(productId)?.storageUnits ?? 0;
  let used = 0;
  for (const [productId, lots] of Object.entries(sealed))
    used += lotsHolding(lots).qty * unitsOf(productId);
  let incoming = 0;
  for (const [productId, qty] of incomingUnits(orders)) incoming += qty * unitsOf(productId);
  const capacity = storageCapacityOf(perks, ctx);
  return { used, incoming, capacity, free: Math.max(0, capacity - used - incoming) };
}

/**
 * The asking price of one unit in a slot: the slot's override, else the SKU price, else MSRP;
 * singles track their market value. Mirrors `askingPrice` (src/sim/pricing).
 */
export function slotAskingPrice(
  prices: Prices,
  slot: { productId?: string; cardKey?: string; priceCents?: Cents },
  marketOf: (item: { productId?: string; cardKey?: string }) => Cents | null,
  content: ContentRegistry,
): Cents | null {
  if (slot.priceCents !== undefined) return slot.priceCents;
  if (slot.cardKey) return marketOf(slot);
  if (!slot.productId) return null;
  return prices[slot.productId] ?? content.products.get(slot.productId)?.msrpCents ?? null;
}

/** The SKU price a product sells at when no slot overrides it (the Price Board value). */
export function skuPrice(
  prices: Prices,
  productId: string,
  content: ContentRegistry,
): Cents | null {
  return prices[productId] ?? content.products.get(productId)?.msrpCents ?? null;
}
