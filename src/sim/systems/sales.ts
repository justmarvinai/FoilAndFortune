import { xpForRevenue } from '@/content/balance/progression';
import type { SimContext } from '../context';
import type { SoldItem } from '../events';
import type { BasketItem, GameState } from '../state/types';
import { changeCash } from './finance';
import { addXp } from './progression';

function bumpStat(state: GameState, key: string, by = 1): void {
  state.stats[key] = (state.stats[key] ?? 0) + by;
}

/**
 * Books a completed checkout (docs/01 §11.1): cash, ledger, today's totals, XP, stats and the
 * day log. Items left the shelves when they were picked, so stock is already correct.
 */
export function completeSale(
  state: GameState,
  ctx: SimContext,
  uid: number,
  basket: readonly BasketItem[],
): void {
  if (basket.length === 0) return;
  let revenue = 0;
  let cost = 0;
  let units = 0;
  const items: SoldItem[] = [];
  for (const item of basket) {
    revenue += item.priceCents * item.qty;
    cost += item.costCents * item.qty;
    units += item.qty;
    items.push(
      item.productId
        ? { productId: item.productId, qty: item.qty, priceCents: item.priceCents }
        : { cardKey: item.cardKey, qty: item.qty, priceCents: item.priceCents },
    );
  }
  changeCash(state, ctx, revenue, 'sale', 'sale', `customer:${uid}`);
  state.finance.today.revenue += revenue;
  state.finance.today.cogs += cost;
  state.finance.today.customers += 1;
  state.dayLog.served += 1;
  state.dayLog.itemsSold += units;
  bumpStat(state, 'salesCount');
  bumpStat(state, 'unitsSold', units);
  bumpStat(state, 'revenueCents', revenue);
  ctx.emit({ type: 'sale/completed', uid, items, totalCents: revenue });
  addXp(state, ctx, xpForRevenue(revenue, state.progression.level), 'sale');
}
