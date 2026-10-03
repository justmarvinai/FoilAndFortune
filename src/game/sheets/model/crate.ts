import type { ContentRegistry } from '@/content/registry';
import type { SupplierDef } from '@/content/schema/shop';
import type { ProductDef } from '@/content/schema/tcg';
import type { Cents } from '@/core/money';
import { type Orders, supplierDiscountOf } from './stock';

/**
 * Crate, the supplier app (docs/05 §5.6, docs/01 §18, docs/02 §10). Validates the cart the same
 * way `suppliers/placeOrder` will (minimums, cash, closet space) so the player sees the problem
 * before pressing the button, and error toasts rarely fire.
 */

export interface CatalogItem {
  product: ProductDef;
  /** Unit cost after perk discounts (what the order will charge). */
  costCents: Cents;
  /** List cost before discounts (shown struck through when a perk applies). */
  listCostCents: Cents;
  msrpCents: Cents;
  minQty: number;
  /** ± step of the quantity stepper. */
  step: number;
  /** Margin at MSRP: (MSRP − cost) / MSRP. */
  marginPct: number;
}

/** Big minimums step by whole cases (12 packs, 4 blisters); single-unit items step by 1. */
export function stepFor(minQty: number): number {
  return minQty >= 4 ? minQty : 1;
}

export function supplierCatalog(
  supplier: SupplierDef,
  perks: readonly string[],
  content: ContentRegistry,
): CatalogItem[] {
  const discount = supplierDiscountOf(perks, content);
  const items: CatalogItem[] = [];
  for (const item of supplier.items) {
    const product = content.products.get(item.productId);
    if (!product) continue;
    const costCents = Math.round(item.costCents * (1 - discount));
    items.push({
      product,
      costCents,
      listCostCents: item.costCents,
      msrpCents: product.msrpCents,
      minQty: item.minQty,
      step: stepFor(item.minQty),
      marginPct: product.msrpCents > 0 ? (product.msrpCents - costCents) / product.msrpCents : 0,
    });
  }
  return items;
}

/** Product id → quantity in the cart. */
export type Cart = Readonly<Record<string, number>>;

/**
 * The next stepper value. Up from 0 jumps to the minimum; down from the minimum drops to 0, so the
 * cart never holds a quantity the supplier would refuse.
 */
export function stepQty(
  item: Pick<CatalogItem, 'minQty' | 'step'>,
  qty: number,
  dir: 1 | -1,
): number {
  if (dir === 1) return qty < item.minQty ? item.minQty : qty + item.step;
  if (qty <= item.minQty) return 0;
  return Math.max(item.minQty, qty - item.step);
}

/** A typed quantity snapped to what the supplier accepts (0, or at least the minimum). */
export function clampQty(item: Pick<CatalogItem, 'minQty'>, qty: number, max = 9999): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.min(max, Math.max(item.minQty, Math.floor(qty)));
}

export type CartProblem =
  | { kind: 'empty' }
  | { kind: 'belowMinimum'; productId: string; min: number }
  | { kind: 'cash'; shortCents: Cents }
  | { kind: 'storage'; shortUnits: number };

export interface CartLine {
  item: CatalogItem;
  qty: number;
  lineCents: Cents;
  units: number;
}

export interface CartCheck {
  lines: CartLine[];
  itemCount: number;
  totalCents: Cents;
  /** Closet space the delivery will need (SU). */
  units: number;
  cashAfterCents: Cents;
  freeAfterUnits: number;
  problems: CartProblem[];
  canPlace: boolean;
}

export function checkCart(
  cart: Cart,
  catalog: readonly CatalogItem[],
  cashCents: Cents,
  freeUnits: number,
): CartCheck {
  const lines: CartLine[] = [];
  const problems: CartProblem[] = [];
  let totalCents = 0;
  let units = 0;
  let itemCount = 0;
  for (const item of catalog) {
    const qty = cart[item.product.id] ?? 0;
    if (qty <= 0) continue;
    if (qty < item.minQty) {
      problems.push({ kind: 'belowMinimum', productId: item.product.id, min: item.minQty });
    }
    const lineCents = item.costCents * qty;
    const lineUnits = item.product.storageUnits * qty;
    lines.push({ item, qty, lineCents, units: lineUnits });
    totalCents += lineCents;
    units += lineUnits;
    itemCount += qty;
  }
  if (lines.length === 0) problems.push({ kind: 'empty' });
  if (totalCents > cashCents) problems.push({ kind: 'cash', shortCents: totalCents - cashCents });
  if (units > freeUnits) problems.push({ kind: 'storage', shortUnits: units - freeUnits });
  return {
    lines,
    itemCount,
    totalCents,
    units,
    cashAfterCents: cashCents - totalCents,
    freeAfterUnits: freeUnits - units,
    problems,
    canPlace: problems.length === 0,
  };
}

/** The order lines to dispatch (`suppliers/placeOrder`). */
export function orderLines(check: CartCheck): { productId: string; qty: number }[] {
  return check.lines.map((line) => ({ productId: line.item.product.id, qty: line.qty }));
}

/** How many of an item still fit in the closet and the wallet on top of the rest of the cart. */
export function maxAffordable(
  item: CatalogItem,
  cart: Cart,
  catalog: readonly CatalogItem[],
  cashCents: Cents,
  freeUnits: number,
): number {
  const rest = checkCart({ ...cart, [item.product.id]: 0 }, catalog, cashCents, freeUnits);
  const byCash = Math.floor((cashCents - rest.totalCents) / Math.max(1, item.costCents));
  const byRoom = Math.floor((freeUnits - rest.units) / Math.max(0.0001, item.product.storageUnits));
  return Math.max(0, Math.min(byCash, byRoom));
}

export interface PendingOrderView {
  uid: string;
  supplierId: string;
  totalCents: Cents;
  etaDay: number;
  /** Days until it arrives (1 = tomorrow at dawn). */
  daysLeft: number;
  lines: { product: ProductDef; qty: number }[];
  itemCount: number;
}

export function pendingOrders(
  orders: Orders,
  today: number,
  content: ContentRegistry,
): PendingOrderView[] {
  const views: PendingOrderView[] = [];
  for (const order of orders) {
    if (order.status !== 'pending') continue;
    const lines: PendingOrderView['lines'] = [];
    let itemCount = 0;
    for (const line of order.lines) {
      const product = content.products.get(line.productId);
      if (!product) continue;
      lines.push({ product, qty: line.qty });
      itemCount += line.qty;
    }
    views.push({
      uid: order.uid,
      supplierId: order.supplierId,
      totalCents: order.totalCents,
      etaDay: order.etaDay,
      daysLeft: Math.max(0, order.etaDay - today),
      lines,
      itemCount,
    });
  }
  return views.sort((a, b) => a.etaDay - b.etaDay || a.uid.localeCompare(b.uid));
}

/**
 * Suppliers that aren't in the game yet, shown as locked teasers with their requirements
 * (docs/01 §18, docs/02 §9.3 unlock table). Names are i18n keys under `sheets:crate.teasers`.
 * The level comes from the unlock catalog when the unlock exists (`teaserLevel`).
 */
export interface SupplierTeaser {
  key: 'harbor' | 'kaze' | 'foilmarket' | 'starforge';
  unlockId?: string;
  level: number;
  stars?: number;
}

export const SUPPLIER_TEASERS: readonly SupplierTeaser[] = [
  { key: 'harbor', unlockId: 'unlock.supplier.harbor-hobby', level: 4, stars: 2 },
  { key: 'kaze', unlockId: 'unlock.category.manga', level: 5 },
  { key: 'foilmarket', level: 8 },
  { key: 'starforge', level: 10, stars: 3 },
];

export function teaserLevel(teaser: SupplierTeaser, content: ContentRegistry): number {
  return (
    (teaser.unlockId ? content.unlocks.get(teaser.unlockId)?.level : undefined) ?? teaser.level
  );
}
