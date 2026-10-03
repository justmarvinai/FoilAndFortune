import { describe, expect, it } from 'vitest';
import { breakExtraUnits, loosePackId, sealedRows, shelfTargets } from './inventory';
import {
  BLISTER,
  BOOSTER,
  BOX,
  ctx,
  newTestGame,
  run,
  STARTER_EMBER,
  STARTER_VOLT,
} from './testing';

describe('sealedRows', () => {
  it("lists Theo's starting stock smallest first, with open and break options", () => {
    const game = newTestGame();
    const rows = sealedRows(
      game.inventory.sealed,
      game.shop.fixtures,
      game.suppliers.orders,
      ctx.content,
    );
    expect(rows.map((row) => row.product.id)).toEqual([BOOSTER, BLISTER, STARTER_EMBER, BOX]);
    const box = rows.find((row) => row.product.id === BOX);
    expect(box).toMatchObject({
      inStorage: 1,
      onShelf: 0,
      incoming: 0,
      avgCostCents: 10400,
      storageUnits: 18,
      canOpen: true,
      canBreak: true,
      packsInside: 36,
    });
    // A blister is sold (or ripped) as-is; only displays break into loose packs.
    expect(rows.find((row) => row.product.id === BLISTER)?.canBreak).toBe(false);
    expect(rows.find((row) => row.product.id === BOOSTER)?.canOpen).toBe(true);
  });

  it('tracks shelf units, incoming orders and the blended average cost', () => {
    let game = newTestGame();
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 0,
      productId: BOOSTER,
    });
    game = run(game, { type: 'debug/grantCash', cents: 100_000 });
    game = run(game, {
      type: 'suppliers/placeOrder',
      supplierId: 'sup.budget-box',
      lines: [{ productId: STARTER_VOLT, qty: 2 }],
    });
    const rows = sealedRows(
      game.inventory.sealed,
      game.shop.fixtures,
      game.suppliers.orders,
      ctx.content,
    );
    expect(rows.find((row) => row.product.id === BOOSTER)).toMatchObject({
      inStorage: 12,
      onShelf: 12,
      avgCostCents: 325,
    });
    // Nothing in hand yet, but it's on its way: the row shows so you can plan for it.
    expect(rows.find((row) => row.product.id === STARTER_VOLT)).toMatchObject({
      inStorage: 0,
      onShelf: 0,
      incoming: 2,
      avgCostCents: null,
    });
  });

  it('drops products you no longer hold', () => {
    const game = newTestGame();
    const sealed = { ...game.inventory.sealed };
    delete sealed[BOX];
    const rows = sealedRows(sealed, game.shop.fixtures, game.suppliers.orders, ctx.content);
    expect(rows.some((row) => row.product.id === BOX)).toBe(false);
  });
});

describe('breaking a box', () => {
  it('needs the extra closet space of 36 loose packs over the 18 SU box', () => {
    const box = ctx.content.products.get(BOX);
    if (!box) throw new Error('missing box');
    expect(breakExtraUnits(box, ctx.content)).toBe(18);
    expect(loosePackId(box)).toBe(BOOSTER);
  });
});

describe('shelfTargets', () => {
  it('offers top-ups first, then empty slots, then sold-out slots of other products', () => {
    let game = newTestGame();
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 1,
      productId: BOOSTER,
      qty: 5,
    });
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 0,
      productId: BLISTER,
    });
    // Sell out the blister slot: the slot keeps remembering its product.
    const fixtures = game.shop.fixtures.map((fixture) =>
      fixture.uid === 'shelf-a'
        ? {
            ...fixture,
            slots: fixture.slots.map((slot, i) =>
              i === 0 ? { ...slot, qty: 0, costCents: 0 } : slot,
            ),
          }
        : fixture,
    );
    const targets = shelfTargets(BOOSTER, fixtures, ctx.content);
    expect(targets[0]).toMatchObject({ fixtureUid: 'shelf-a', slot: 1, qty: 5, capacity: 12 });
    expect(targets.at(-1)).toMatchObject({ fixtureUid: 'shelf-a', slot: 0, replaces: BLISTER });
    // Both wall shelves (1 top-up, 6 empty, 1 sold out); the display case takes singles only.
    expect(targets.every((target) => target.fixtureUid !== 'case-1')).toBe(true);
    expect(targets).toHaveLength(8);
  });

  it("never offers a slot for a product the fixture doesn't accept", () => {
    const game = newTestGame();
    // Booster boxes don't fit the small wall shelf (docs/02 §4.2).
    expect(shelfTargets(BOX, game.shop.fixtures, ctx.content)).toEqual([]);
  });
});

describe('restockPreview', () => {
  it('counts what Restock All will move, per fixture or overall', async () => {
    const { restockPreview } = await import('./inventory');
    let game = newTestGame();
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 0,
      productId: BOOSTER,
      qty: 2,
    });
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-b',
      slot: 0,
      productId: BOOSTER,
      qty: 1,
    });
    // 21 boosters left in the closet: 10 top up shelf A, 11 top up shelf B.
    expect(restockPreview(game.shop.fixtures, game.inventory.sealed, ctx.content)).toBe(21);
    expect(restockPreview(game.shop.fixtures, game.inventory.sealed, ctx.content, 'shelf-a')).toBe(
      10,
    );
    const after = run(game, { type: 'stock/restockAll' });
    expect(restockPreview(after.shop.fixtures, after.inventory.sealed, ctx.content)).toBe(0);
    expect(after.inventory.sealed[BOOSTER]).toBeUndefined();
  });
});
