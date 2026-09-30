import { dollars } from '@/core/money';
import type { SupplierDef } from '../schema/shop';

/**
 * Budget Box Co. (docs/01 §18, docs/02 §10.1): the cash-and-carry wholesaler available from day
 * one. Small minimums, higher prices, next-morning delivery.
 */
export const budgetBoxCo: SupplierDef = {
  id: 'sup.budget-box',
  name: 'Budget Box Co.',
  unlockLevel: 1,
  deliveryDays: 1,
  items: [
    { productId: 'gk.emberdawn.booster', costCents: dollars(3.25), minQty: 12 },
    { productId: 'gk.emberdawn.blister', costCents: dollars(10.5), minQty: 4 },
    { productId: 'gk.emberdawn.starter-ember', costCents: dollars(10), minQty: 1 },
    { productId: 'gk.emberdawn.starter-volt', costCents: dollars(10), minQty: 1 },
  ],
};

export const supplierCatalog: readonly SupplierDef[] = [budgetBoxCo];
