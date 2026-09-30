import { describe, expect, it } from 'vitest';
import { dollars } from '@/core/money';
import type { Command } from '../commands';
import { runCommand, runTicks } from '../engine';
import { sealedQuantity } from '../selectors';
import type { GameState } from '../state/types';
import { newTestGame, testContext } from '../testing';
import { storageCapacity, storageUsed } from './orders';

const ctx = testContext();
const SUPPLIER = 'sup.budget-box';
const BOOSTER = 'gk.emberdawn.booster';
const VOLT = 'gk.emberdawn.starter-volt';
const OPEN_MINUTES = ctx.balance.time.closeMinute - ctx.balance.time.openMinute;

function run(state: GameState, command: Command) {
  return runCommand(state, command, ctx);
}

function order(state: GameState, lines: { productId: string; qty: number }[]) {
  return run(state, { type: 'suppliers/placeOrder', supplierId: SUPPLIER, lines });
}

/** Prep → open → close → next dawn. */
function toNextDawn(state: GameState) {
  let s = run(state, { type: 'time/openShop' }).state;
  s = runTicks(s, OPEN_MINUTES, ctx).state;
  const next = run(s, { type: 'time/startNextDay' });
  return next;
}

describe('suppliers/placeOrder', () => {
  it('pays up front, records the purchase and schedules delivery', () => {
    const game = newTestGame();
    const { state, result, events } = order(game, [
      { productId: BOOSTER, qty: 12 },
      { productId: VOLT, qty: 1 },
    ]);
    expect(result.ok).toBe(true);
    const total = 12 * dollars(3.25) + dollars(10);
    expect(state.finance.cashCents).toBe(game.finance.cashCents - total);
    expect(state.finance.today.purchases).toBe(total);
    expect(state.suppliers.orders).toEqual([
      {
        uid: 'ord-1',
        supplierId: SUPPLIER,
        lines: [
          { productId: BOOSTER, qty: 12, unitCostCents: dollars(3.25) },
          { productId: VOLT, qty: 1, unitCostCents: dollars(10) },
        ],
        totalCents: total,
        placedDay: 1,
        etaDay: 2,
        status: 'pending',
      },
    ]);
    expect(events).toContainEqual({
      type: 'order/placed',
      orderUid: 'ord-1',
      supplierId: SUPPLIER,
      totalCents: total,
      etaDay: 2,
    });
    expect(events.some((e) => e.type === 'cash/changed')).toBe(true);
  });

  it('delivers at the next dawn, into storage at the order cost', () => {
    const game = order(newTestGame(), [{ productId: VOLT, qty: 2 }]).state;
    expect(sealedQuantity(game, VOLT)).toBe(0);
    const { state, events } = toNextDawn(game);
    expect(state.clock.day).toBe(2);
    expect(sealedQuantity(state, VOLT)).toBe(2);
    expect(state.inventory.sealed[VOLT]).toEqual([
      { qty: 2, unitCostCents: dollars(10), acquiredDay: 2 },
    ]);
    expect(state.suppliers.orders[0]?.status).toBe('delivered');
    expect(events).toContainEqual({
      type: 'order/delivered',
      orderUid: 'ord-1',
      supplierId: SUPPLIER,
    });
  });

  it('can be placed at night for the next morning', () => {
    let game = run(newTestGame(), { type: 'time/openShop' }).state;
    game = run(game, { type: 'time/closeShop' }).state;
    game = order(game, [{ productId: VOLT, qty: 1 }]).state;
    const next = run(game, { type: 'time/startNextDay' }).state;
    expect(sealedQuantity(next, VOLT)).toBe(1);
  });

  it('validates the supplier, products, quantities and minimums', () => {
    const game = newTestGame();
    expect(
      run(game, { type: 'suppliers/placeOrder', supplierId: 'sup.nope', lines: [] }).result,
    ).toMatchObject({ code: 'UNKNOWN_SUPPLIER' });
    expect(order(game, []).result).toMatchObject({ code: 'EMPTY_ORDER' });
    expect(order(game, [{ productId: VOLT, qty: 0 }]).result).toMatchObject({
      code: 'EMPTY_ORDER',
    });
    expect(order(game, [{ productId: VOLT, qty: -1 }]).result).toMatchObject({
      code: 'INVALID_AMOUNT',
    });
    expect(order(game, [{ productId: VOLT, qty: 1.5 }]).result).toMatchObject({
      code: 'INVALID_AMOUNT',
    });
    expect(order(game, [{ productId: 'gk.emberdawn.box', qty: 1 }]).result).toMatchObject({
      code: 'UNKNOWN_PRODUCT',
    });
    expect(order(game, [{ productId: BOOSTER, qty: 11 }]).result).toMatchObject({
      code: 'BELOW_MINIMUM',
      params: { productId: BOOSTER, min: 12 },
    });
  });

  it('refuses orders the shop cannot pay for, atomically', () => {
    const game = newTestGame();
    const { state, result, events } = order(game, [{ productId: BOOSTER, qty: 1200 }]);
    expect(result).toMatchObject({ ok: false, code: 'NOT_ENOUGH_CASH' });
    expect(state).toBe(game);
    expect(events).toEqual([]);
  });

  it('refuses orders that would overflow the closet, counting pending deliveries', () => {
    const game = run(newTestGame(), { type: 'debug/grantCash', cents: dollars(10_000) }).state;
    const free =
      storageCapacity(game, { ...ctx, emit: () => undefined }) -
      storageUsed(game, { ...ctx, emit: () => undefined });
    expect(free).toBeGreaterThan(0);
    // Boosters take 1 storage unit each.
    const fits = order(game, [{ productId: BOOSTER, qty: free }]);
    expect(fits.result.ok).toBe(true);
    expect(order(fits.state, [{ productId: BOOSTER, qty: 12 }]).result).toMatchObject({
      code: 'STORAGE_FULL',
      params: { needed: 12, free: 0 },
    });
  });

  it('applies placeholder supplier-discount perks (docs/02 §9.3)', () => {
    const game = newTestGame();
    game.progression.perks.push('perk.supplier-2');
    const { state } = order(game, [{ productId: VOLT, qty: 1 }]);
    expect(state.suppliers.orders[0]?.lines[0]?.unitCostCents).toBe(Math.round(dollars(10) * 0.98));
  });
});
