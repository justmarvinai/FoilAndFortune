import { type CommandResult, fail, ok } from '../commands';
import type { SimContext } from '../context';
import type { GameState, OrderLine } from '../state/types';
import { changeCash } from './finance';
import { putSealed, storageUnitsUsed } from './inventory';
import { perkStorageUnits, perkSupplierDiscount } from './progression';

/**
 * Supplier orders (docs/01 §18, docs/02 §10). Phase 2: Budget Box Co. only. Orders are paid when
 * placed and arrive at dawn `deliveryDays` later. Cash can't go negative for orders, and
 * incoming stock must fit the closet (no depot yet).
 */

export function storageCapacity(state: GameState, ctx: SimContext): number {
  return ctx.balance.storage.closet.storageUnits + perkStorageUnits(state, ctx.content);
}

export function storageUsed(state: GameState, ctx: SimContext): number {
  const unitsOf = (productId: string) => ctx.content.products.get(productId)?.storageUnits ?? 0;
  let used = storageUnitsUsed(state, unitsOf);
  for (const order of state.suppliers.orders) {
    if (order.status !== 'pending') continue;
    for (const line of order.lines) used += line.qty * unitsOf(line.productId);
  }
  return used;
}

export function placeOrder(
  state: GameState,
  ctx: SimContext,
  command: { supplierId: string; lines: { productId: string; qty: number }[] },
): CommandResult {
  const supplier = ctx.content.suppliers.get(command.supplierId);
  if (!supplier) return fail('UNKNOWN_SUPPLIER', { supplierId: command.supplierId });
  if (state.progression.level < supplier.unlockLevel) return fail('LOCKED');

  const discount = perkSupplierDiscount(state, ctx.content);
  const lines: OrderLine[] = [];
  let total = 0;
  let units = 0;
  for (const requested of command.lines) {
    if (requested.qty === 0) continue;
    if (!Number.isSafeInteger(requested.qty) || requested.qty < 0) return fail('INVALID_AMOUNT');
    const item = supplier.items.find((entry) => entry.productId === requested.productId);
    const product = ctx.content.products.get(requested.productId);
    if (!item || !product) return fail('UNKNOWN_PRODUCT', { productId: requested.productId });
    if (requested.qty < item.minQty) {
      return fail('BELOW_MINIMUM', { productId: requested.productId, min: item.minQty });
    }
    const unitCostCents = Math.round(item.costCents * (1 - discount));
    lines.push({ productId: requested.productId, qty: requested.qty, unitCostCents });
    total += unitCostCents * requested.qty;
    units += product.storageUnits * requested.qty;
  }
  if (lines.length === 0) return fail('EMPTY_ORDER');
  if (total > state.finance.cashCents) return fail('NOT_ENOUGH_CASH', { cents: total });
  const free = storageCapacity(state, ctx) - storageUsed(state, ctx);
  if (units > free) return fail('STORAGE_FULL', { needed: units, free });

  const uid = `ord-${state.suppliers.nextOrderUid++}`;
  const etaDay = state.clock.day + supplier.deliveryDays;
  state.suppliers.orders.push({
    uid,
    supplierId: supplier.id,
    lines,
    totalCents: total,
    placedDay: state.clock.day,
    etaDay,
    status: 'pending',
  });
  changeCash(state, ctx, -total, 'purchase', 'purchase', uid);
  state.finance.today.purchases += total;
  ctx.emit({
    type: 'order/placed',
    orderUid: uid,
    supplierId: supplier.id,
    totalCents: total,
    etaDay,
  });
  return ok;
}

/** Dawn pipeline: receive everything due today (docs/06 §5.3). Keeps the last 30 orders. */
export function deliverOrders(state: GameState, ctx: SimContext): void {
  for (const order of state.suppliers.orders) {
    if (order.status !== 'pending' || order.etaDay > state.clock.day) continue;
    for (const line of order.lines) {
      putSealed(state, line.productId, line.qty, line.unitCostCents, state.clock.day);
    }
    order.status = 'delivered';
    ctx.emit({ type: 'order/delivered', orderUid: order.uid, supplierId: order.supplierId });
  }
  const pending = state.suppliers.orders.filter((order) => order.status === 'pending');
  const delivered = state.suppliers.orders.filter((order) => order.status !== 'pending');
  state.suppliers.orders = [...delivered.slice(-30), ...pending];
}
