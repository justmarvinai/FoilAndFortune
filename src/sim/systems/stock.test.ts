import { describe, expect, it } from 'vitest';
import { cardKey } from '../cards';
import type { Command } from '../commands';
import { runCommand } from '../engine';
import { sealedQuantity } from '../selectors';
import type { FixtureSlot, GameState } from '../state/types';
import { newTestGame, testContext } from '../testing';
import { takeFromSlot } from './stock';

const ctx = testContext();
const BOOSTER = 'gk.emberdawn.booster';
const BLISTER = 'gk.emberdawn.blister';
const BOX = 'gk.emberdawn.box';

function run(state: GameState, command: Command) {
  return runCommand(state, command, ctx);
}

function slotOf(state: GameState, uid: string, index: number): FixtureSlot {
  const slot = state.shop.fixtures.find((f) => f.uid === uid)?.slots[index];
  if (!slot) throw new Error(`no slot ${uid}#${index}`);
  return slot;
}

/** Any single in the starting stacks, e.g. one of Theo's commons. */
function someStackKey(state: GameState): string {
  const key = Object.keys(state.inventory.cardStacks)[0];
  if (!key) throw new Error('no starting singles');
  return key;
}

describe('stock/fillSlot (sealed)', () => {
  it('fills a shelf slot to capacity FIFO, carrying the cost basis', () => {
    const game = newTestGame();
    const perSlot = ctx.content.products.get(BOOSTER)?.perShelfSlot ?? 0;
    const { state, result, events } = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 0,
      productId: BOOSTER,
    });
    expect(result.ok).toBe(true);
    expect(slotOf(state, 'shelf-a', 0)).toMatchObject({
      productId: BOOSTER,
      qty: perSlot,
      costCents: perSlot * 325,
    });
    expect(sealedQuantity(state, BOOSTER)).toBe(24 - perSlot);
    expect(events).toEqual([{ type: 'stock/changed', fixtureUid: 'shelf-a', slot: 0 }]);
  });

  it('adds a partial quantity and tops up later without exceeding capacity', () => {
    const game = newTestGame();
    const perSlot = ctx.content.products.get(BLISTER)?.perShelfSlot ?? 0;
    const partial = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 1,
      productId: BLISTER,
      qty: 1,
    }).state;
    expect(slotOf(partial, 'shelf-a', 1).qty).toBe(1);
    const topped = run(partial, { type: 'stock/fillSlot', fixtureUid: 'shelf-a', slot: 1 }).state;
    // Only 4 blisters exist, so the slot holds min(capacity, 4).
    expect(slotOf(topped, 'shelf-a', 1).qty).toBe(Math.min(perSlot, 4));
  });

  it('rejects products the fixture does not accept, and mixing products in one slot', () => {
    const game = newTestGame();
    expect(
      run(game, { type: 'stock/fillSlot', fixtureUid: 'shelf-a', slot: 0, productId: BOX }).result,
    ).toMatchObject({ ok: false, code: 'SLOT_INCOMPATIBLE' });
    const filled = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 0,
      productId: BOOSTER,
    }).state;
    expect(
      run(filled, { type: 'stock/fillSlot', fixtureUid: 'shelf-a', slot: 0, productId: BLISTER })
        .result,
    ).toMatchObject({ ok: false, code: 'SLOT_OCCUPIED' });
  });

  it('validates fixtures, slots, products, amounts and stock', () => {
    const game = newTestGame();
    const fill = (command: Partial<Extract<Command, { type: 'stock/fillSlot' }>>) =>
      run(game, {
        type: 'stock/fillSlot',
        fixtureUid: 'shelf-a',
        slot: 0,
        productId: BOOSTER,
        ...command,
      }).result;
    expect(fill({ fixtureUid: 'nope' })).toMatchObject({ code: 'UNKNOWN_FIXTURE' });
    expect(fill({ slot: 99 })).toMatchObject({ code: 'INVALID_SLOT' });
    expect(fill({ slot: 0.5 })).toMatchObject({ code: 'INVALID_SLOT' });
    expect(fill({ fixtureUid: 'register' })).toMatchObject({ code: 'INVALID_SLOT' });
    expect(fill({ productId: 'gk.nope' })).toMatchObject({ code: 'UNKNOWN_PRODUCT' });
    expect(fill({ qty: -2 })).toMatchObject({ code: 'INVALID_AMOUNT' });
    expect(fill({ productId: 'gk.emberdawn.starter-volt' })).toMatchObject({
      code: 'NOT_ENOUGH_STOCK',
    });
  });

  it('forgets a price override when the slot switches product', () => {
    let game = newTestGame();
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 0,
      productId: BOOSTER,
    }).state;
    game = run(game, {
      type: 'pricing/setSlotPrice',
      fixtureUid: 'shelf-a',
      slot: 0,
      cents: 399,
    }).state;
    expect(slotOf(game, 'shelf-a', 0).priceCents).toBe(399);
    // Sell out (simulated), then put blisters in the same slot.
    const draft = structuredClone(game);
    takeFromSlot(slotOf(draft, 'shelf-a', 0), 99);
    expect(slotOf(draft, 'shelf-a', 0)).toMatchObject({ qty: 0, productId: BOOSTER });
    const switched = run(draft, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 0,
      productId: BLISTER,
    }).state;
    expect(slotOf(switched, 'shelf-a', 0)).toMatchObject({ productId: BLISTER });
    expect(slotOf(switched, 'shelf-a', 0).priceCents).toBeUndefined();
  });
});

describe('stock/fillSlot (singles case)', () => {
  it('is locked until level 2', () => {
    const game = newTestGame();
    const result = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'case-1',
      slot: 0,
      cardKey: someStackKey(game),
    }).result;
    expect(result).toMatchObject({ ok: false, code: 'LOCKED' });
  });

  it('moves one copy from the stacks into an empty case slot', () => {
    const game = run(newTestGame(), { type: 'debug/grantXp', amount: 80 }).state;
    expect(game.progression.level).toBe(2);
    const key = someStackKey(game);
    const before = game.inventory.cardStacks[key] ?? 0;
    const { state, result } = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'case-1',
      slot: 0,
      cardKey: key,
    });
    expect(result.ok).toBe(true);
    expect(slotOf(state, 'case-1', 0)).toMatchObject({ cardKey: key, qty: 1, costCents: 0 });
    expect(state.inventory.cardStacks[key] ?? 0).toBe(before - 1);
    expect(
      run(state, { type: 'stock/fillSlot', fixtureUid: 'case-1', slot: 0, cardKey: key }).result,
    ).toMatchObject({ code: 'SLOT_OCCUPIED' });
  });

  it('rejects unknown cards and prints the player does not have', () => {
    const game = run(newTestGame(), { type: 'debug/grantXp', amount: 80 }).state;
    const fill = (key: string) =>
      run(game, { type: 'stock/fillSlot', fixtureUid: 'case-1', slot: 1, cardKey: key }).result;
    expect(fill('garbage')).toMatchObject({ code: 'UNKNOWN_CARD' });
    expect(fill(cardKey({ cardId: 'gk.nope.001', finish: 'normal' }))).toMatchObject({
      code: 'UNKNOWN_CARD',
    });
    const missing = [...ctx.content.cards.values()]
      .map((card) => cardKey({ cardId: card.id, finish: 'normal' }))
      .find((key) => !game.inventory.cardStacks[key]);
    if (missing) expect(fill(missing)).toMatchObject({ code: 'NOT_ENOUGH_STOCK' });
  });
});

describe('stock/clearSlot and stock/restockAll', () => {
  it('returns shelf units to storage at their cost and empties the slot', () => {
    let game = newTestGame();
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-b',
      slot: 2,
      productId: BOOSTER,
    }).state;
    const { state, events } = run(game, {
      type: 'stock/clearSlot',
      fixtureUid: 'shelf-b',
      slot: 2,
    });
    expect(slotOf(state, 'shelf-b', 2)).toEqual({ qty: 0, costCents: 0 });
    expect(sealedQuantity(state, BOOSTER)).toBe(24);
    const lots = state.inventory.sealed[BOOSTER] ?? [];
    expect(lots.reduce((sum, lot) => sum + lot.qty * lot.unitCostCents, 0)).toBe(24 * 325);
    expect(events).toHaveLength(1);
    // Clearing an empty slot is a harmless no-op.
    expect(run(state, { type: 'stock/clearSlot', fixtureUid: 'shelf-b', slot: 2 }).events).toEqual(
      [],
    );
  });

  it('tops up every slot that holds a product, and leaves empty slots alone', () => {
    let game = newTestGame();
    for (const slot of [0, 1]) {
      game = run(game, {
        type: 'stock/fillSlot',
        fixtureUid: 'shelf-a',
        slot,
        productId: BOOSTER,
        qty: 2,
      }).state;
    }
    const { state } = run(game, { type: 'stock/restockAll' });
    const perSlot = ctx.content.products.get(BOOSTER)?.perShelfSlot ?? 0;
    expect(slotOf(state, 'shelf-a', 0).qty).toBe(perSlot);
    expect(slotOf(state, 'shelf-a', 1).qty).toBe(Math.min(perSlot, 24 - perSlot));
    expect(slotOf(state, 'shelf-a', 2).qty).toBe(0);
    expect(slotOf(state, 'shelf-b', 0).qty).toBe(0);
  });
});

describe('takeFromSlot', () => {
  it('moves units with their share of the cost basis', () => {
    const slot: FixtureSlot = { productId: BOOSTER, qty: 3, costCents: 1000, priceCents: 449 };
    expect(takeFromSlot(slot, 1)).toEqual({ qty: 1, costCents: 333 });
    expect(takeFromSlot(slot, 5)).toEqual({ qty: 2, costCents: 667 });
    // A sold-out shelf slot keeps its product and price for Restock All.
    expect(slot).toEqual({ productId: BOOSTER, qty: 0, costCents: 0, priceCents: 449 });
    expect(takeFromSlot(slot, 1)).toEqual({ qty: 0, costCents: 0 });
  });

  it('clears a case slot once its card is gone', () => {
    const slot: FixtureSlot = { cardKey: 'gk.emberdawn.035|holo||nearMint', qty: 1, costCents: 0 };
    slot.priceCents = 1200;
    expect(takeFromSlot(slot, 1)).toEqual({ qty: 1, costCents: 0 });
    expect(slot).toEqual({ qty: 0, costCents: 0, cardKey: undefined, priceCents: undefined });
  });
});

describe('pricing/setSlotPrice', () => {
  it('sets an override and validates the amount', () => {
    const game = newTestGame();
    const set = (cents: number) =>
      run(game, { type: 'pricing/setSlotPrice', fixtureUid: 'shelf-a', slot: 0, cents });
    expect(slotOf(set(399).state, 'shelf-a', 0).priceCents).toBe(399);
    expect(set(0).result).toMatchObject({ code: 'INVALID_PRICE' });
    expect(set(1.5).result).toMatchObject({ code: 'INVALID_PRICE' });
    expect(set(Number.NaN).result).toMatchObject({ code: 'INVALID_PRICE' });
  });
});
