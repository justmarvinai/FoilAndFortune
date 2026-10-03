import { describe, expect, it } from 'vitest';
import { runCommand } from '@/sim/engine';
import {
  checkCart,
  clampQty,
  maxAffordable,
  orderLines,
  pendingOrders,
  SUPPLIER_TEASERS,
  stepQty,
  supplierCatalog,
  teaserLevel,
} from './crate';
import { storageSummary } from './stock';
import { BLISTER, BOOSTER, ctx, levelUpTo, newTestGame, run, STARTER_VOLT } from './testing';

const budgetBox = ctx.content.suppliers.get('sup.budget-box');
if (!budgetBox) throw new Error('missing Budget Box Co.');

describe('supplierCatalog', () => {
  it('prices items at list cost, with a step per minimum', () => {
    const catalog = supplierCatalog(budgetBox, [], ctx.content);
    const booster = catalog.find((item) => item.product.id === BOOSTER);
    expect(booster).toMatchObject({ costCents: 325, listCostCents: 325, minQty: 12, step: 12 });
    expect(booster?.marginPct).toBeCloseTo((449 - 325) / 449, 6);
    expect(catalog.find((item) => item.product.id === STARTER_VOLT)?.step).toBe(1);
  });

  it('applies perk discounts exactly like the sim charges them', () => {
    let game = levelUpTo(newTestGame(), 5);
    game = run(game, { type: 'debug/grantCash', cents: 100_000 });
    const catalog = supplierCatalog(budgetBox, game.progression.perks, ctx.content);
    const booster = catalog.find((item) => item.product.id === BOOSTER);
    expect(booster?.costCents).toBeLessThan(booster?.listCostCents ?? 0);
    const storage = storageSummary(
      game.inventory.sealed,
      game.suppliers.orders,
      game.progression.perks,
      ctx,
    );
    const check = checkCart(
      { [BOOSTER]: 24, [BLISTER]: 4 },
      catalog,
      game.finance.cashCents,
      storage.free,
    );
    expect(check.canPlace).toBe(true);
    const { state, result } = runCommand(
      game,
      { type: 'suppliers/placeOrder', supplierId: budgetBox.id, lines: orderLines(check) },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(game.finance.cashCents - state.finance.cashCents).toBe(check.totalCents);
  });
});

describe('quantity stepper', () => {
  const pack = { minQty: 12, step: 12 };
  const deck = { minQty: 1, step: 1 };

  it('jumps to the minimum and back to zero', () => {
    expect(stepQty(pack, 0, 1)).toBe(12);
    expect(stepQty(pack, 12, 1)).toBe(24);
    expect(stepQty(pack, 24, -1)).toBe(12);
    expect(stepQty(pack, 12, -1)).toBe(0);
    expect(stepQty(pack, 0, -1)).toBe(0);
    expect(stepQty(pack, 15, -1)).toBe(12);
    expect(stepQty(deck, 0, 1)).toBe(1);
    expect(stepQty(deck, 1, -1)).toBe(0);
  });

  it('snaps typed quantities to what the supplier accepts', () => {
    expect(clampQty(pack, 5)).toBe(12);
    expect(clampQty(pack, 30.7)).toBe(30);
    expect(clampQty(pack, 0)).toBe(0);
    expect(clampQty(pack, Number.NaN)).toBe(0);
    expect(clampQty(pack, 1e9, 999)).toBe(999);
  });
});

describe('checkCart', () => {
  const catalog = supplierCatalog(budgetBox, [], ctx.content);

  it('flags an empty cart', () => {
    const check = checkCart({}, catalog, 60_000, 200);
    expect(check.canPlace).toBe(false);
    expect(check.problems).toEqual([{ kind: 'empty' }]);
  });

  it('totals money and closet space', () => {
    const check = checkCart({ [BOOSTER]: 24, [BLISTER]: 4 }, catalog, 60_000, 200);
    expect(check.totalCents).toBe(24 * 325 + 4 * 1050);
    expect(check.units).toBe(24 + 4 * 2);
    expect(check.itemCount).toBe(28);
    expect(check.cashAfterCents).toBe(60_000 - check.totalCents);
    expect(check.freeAfterUnits).toBe(200 - 32);
    expect(check.canPlace).toBe(true);
  });

  it('explains minimums, cash and space before you press the button', () => {
    const check = checkCart({ [BOOSTER]: 5, [BLISTER]: 40 }, catalog, 10_000, 20);
    expect(check.problems).toContainEqual({ kind: 'belowMinimum', productId: BOOSTER, min: 12 });
    expect(check.problems).toContainEqual({
      kind: 'cash',
      shortCents: 5 * 325 + 40 * 1050 - 10_000,
    });
    expect(check.problems).toContainEqual({ kind: 'storage', shortUnits: 5 + 80 - 20 });
    expect(check.canPlace).toBe(false);
  });

  it('knows how many more of an item fit', () => {
    const booster = catalog.find((item) => item.product.id === BOOSTER);
    if (!booster) throw new Error('missing booster');
    expect(maxAffordable(booster, {}, catalog, 3250, 200)).toBe(10);
    expect(maxAffordable(booster, { [BLISTER]: 4 }, catalog, 100_000, 20)).toBe(12);
  });
});

describe('pendingOrders', () => {
  it('lists pending deliveries with days left', () => {
    let game = run(newTestGame(), { type: 'debug/grantCash', cents: 100_000 });
    game = run(game, {
      type: 'suppliers/placeOrder',
      supplierId: budgetBox.id,
      lines: [
        { productId: BOOSTER, qty: 12 },
        { productId: STARTER_VOLT, qty: 2 },
      ],
    });
    const [order] = pendingOrders(game.suppliers.orders, game.clock.day, ctx.content);
    expect(order).toMatchObject({ daysLeft: 1, itemCount: 14, totalCents: 12 * 325 + 2 * 1000 });
    expect(order?.lines.map((line) => line.product.id)).toEqual([BOOSTER, STARTER_VOLT]);
  });
});

describe('supplier teasers', () => {
  it('reads unlock levels from content when the unlock exists', () => {
    const harbor = SUPPLIER_TEASERS.find((teaser) => teaser.key === 'harbor');
    if (!harbor) throw new Error('missing Harbor teaser');
    expect(teaserLevel(harbor, ctx.content)).toBe(4);
    expect(harbor.stars).toBe(2);
  });
});
