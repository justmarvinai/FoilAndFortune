import { describe, expect, it } from 'vitest';
import { askingPrice, itemMarketValue } from '@/sim/pricing';
import { storageCapacity, storageUsed } from '@/sim/systems/orders';
import { perkSupplierDiscount } from '@/sim/systems/progression';
import {
  averageCost,
  incomingUnits,
  shelfHoldings,
  slotAskingPrice,
  storageCapacityOf,
  storageSummary,
  supplierDiscountOf,
} from './stock';
import {
  BLISTER,
  BOOSTER,
  ctx,
  levelUpTo,
  newTestGame,
  run,
  simCtx,
  someStackKey,
} from './testing';

describe('mirrors of sim helpers (parity)', () => {
  it('storage capacity and usage match the sim, with perks and pending orders', () => {
    let game = newTestGame();
    const check = () => {
      const summary = storageSummary(
        game.inventory.sealed,
        game.suppliers.orders,
        game.progression.perks,
        ctx,
      );
      expect(summary.capacity).toBe(storageCapacity(game, simCtx));
      expect(summary.used + summary.incoming).toBe(storageUsed(game, simCtx));
      expect(storageCapacityOf(game.progression.perks, ctx)).toBe(storageCapacity(game, simCtx));
    };
    check();
    game = run(game, { type: 'debug/grantCash', cents: 100_000 });
    game = run(game, {
      type: 'suppliers/placeOrder',
      supplierId: 'sup.budget-box',
      lines: [{ productId: BOOSTER, qty: 12 }],
    });
    check();
    game = levelUpTo(game, 5); // levels 3–5 grant storage and supplier perks
    expect(game.progression.perks.length).toBeGreaterThan(0);
    check();
    expect(supplierDiscountOf(game.progression.perks, ctx.content)).toBe(
      perkSupplierDiscount(game, ctx.content),
    );
  });

  it('slot asking prices match askingPrice for SKUs, overrides and singles', () => {
    let game = newTestGame();
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 0,
      productId: BOOSTER,
    });
    game = run(game, { type: 'pricing/setPrice', productId: BOOSTER, cents: 499 });
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 1,
      productId: BLISTER,
    });
    game = run(game, { type: 'pricing/setSlotPrice', fixtureUid: 'shelf-a', slot: 1, cents: 1399 });
    game = levelUpTo(game, 2);
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'case-1',
      slot: 0,
      cardKey: someStackKey(game),
    });
    const marketOf = (item: { productId?: string; cardKey?: string }) => itemMarketValue(ctx, item);
    for (const fixture of game.shop.fixtures) {
      for (const slot of fixture.slots) {
        expect(slotAskingPrice(game.pricing.prices, slot, marketOf, ctx.content)).toBe(
          askingPrice(game, ctx, slot),
        );
      }
    }
  });
});

describe('holdings', () => {
  it('sums shelf units and cost per product', () => {
    let game = newTestGame();
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 0,
      productId: BOOSTER,
    });
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-b',
      slot: 2,
      productId: BOOSTER,
      qty: 5,
    });
    const shelf = shelfHoldings(game.shop.fixtures).get(BOOSTER);
    expect(shelf).toEqual({ qty: 17, costCents: 17 * 325, slots: 2 });
  });

  it('counts only pending order lines as incoming', () => {
    let game = run(newTestGame(), { type: 'debug/grantCash', cents: 100_000 });
    game = run(game, {
      type: 'suppliers/placeOrder',
      supplierId: 'sup.budget-box',
      lines: [
        { productId: BOOSTER, qty: 24 },
        { productId: BLISTER, qty: 4 },
      ],
    });
    const incoming = incomingUnits(game.suppliers.orders);
    expect(incoming.get(BOOSTER)).toBe(24);
    expect(incoming.get(BLISTER)).toBe(4);
    const delivered = game.suppliers.orders.map((order) => ({
      ...order,
      status: 'delivered' as const,
    }));
    expect(incomingUnits(delivered).size).toBe(0);
  });

  it('averages cost across closet and shelves', () => {
    expect(averageCost({ qty: 0, costCents: 0 }, undefined)).toBeNull();
    expect(averageCost({ qty: 2, costCents: 600 }, { qty: 1, costCents: 450 })).toBe(350);
    expect(averageCost({ qty: 0, costCents: 0 }, { qty: 3, costCents: 1000 })).toBe(333);
  });
});
