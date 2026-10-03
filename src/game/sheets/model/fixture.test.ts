import { describe, expect, it } from 'vitest';
import type { GameState } from '@/sim/state/types';
import {
  casePicks,
  compatibleProducts,
  fixtureOrdinal,
  fixtureView,
  LOW_SHARE,
  slotLevel,
} from './fixture';
import {
  BLISTER,
  BOOSTER,
  BOX,
  ctx,
  levelUpTo,
  newTestGame,
  run,
  STARTER_EMBER,
  someStackKey,
} from './testing';

function viewOf(game: GameState, uid: string) {
  const fixture = game.shop.fixtures.find((entry) => entry.uid === uid);
  if (!fixture) throw new Error(`no fixture ${uid}`);
  const view = fixtureView(fixture, game.pricing.prices, game.inventory.sealed, ctx);
  if (!view) throw new Error(`no view for ${uid}`);
  return view;
}

describe('fixtureView', () => {
  it('shows an empty starter shelf with nothing to restock', () => {
    const view = viewOf(newTestGame(), 'shelf-a');
    expect(view.kind).toBe('shelf');
    expect(view.slots).toHaveLength(4);
    expect(view.slots.every((slot) => slot.level === 'empty')).toBe(true);
    expect(view.restockable).toBe(false);
  });

  it('reads counts, capacity, prices and overrides per slot', () => {
    let game = newTestGame();
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 0,
      productId: BOOSTER,
    });
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 1,
      productId: BLISTER,
      qty: 1,
    });
    game = run(game, { type: 'pricing/setSlotPrice', fixtureUid: 'shelf-a', slot: 1, cents: 1299 });
    const view = viewOf(game, 'shelf-a');
    expect(view.slots[0]).toMatchObject({
      productId: BOOSTER,
      qty: 12,
      capacity: 12,
      level: 'full',
      priceCents: 449,
      hasOverride: false,
      inStorage: 12,
      canFill: false,
    });
    expect(view.slots[1]).toMatchObject({
      productId: BLISTER,
      qty: 1,
      capacity: 4,
      level: 'low',
      priceCents: 1299,
      hasOverride: true,
      canFill: true,
    });
    expect(view.restockable).toBe(true);
    expect(view.stocked).toBe(13);
  });

  it('shows the register and the display case as their own kinds', () => {
    const game = newTestGame();
    expect(viewOf(game, 'register').kind).toBe('register');
    const display = viewOf(game, 'case-1');
    expect(display.kind).toBe('case');
    expect(display.slots.every((slot) => slot.capacity === 1 && slot.level === 'empty')).toBe(true);
  });

  it('prices a case single at market until tagged', () => {
    let game = levelUpTo(newTestGame(), 2);
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'case-1',
      slot: 0,
      cardKey: someStackKey(game),
    });
    const slot = viewOf(game, 'case-1').slots[0];
    expect(slot?.level).toBe('full');
    expect(slot?.priceCents).toBe(slot?.marketCents);
  });
});

describe('slotLevel', () => {
  it('pulses at a quarter of capacity or less', () => {
    expect(LOW_SHARE).toBe(0.25);
    expect(slotLevel(0, 12, false)).toBe('empty');
    expect(slotLevel(0, 12, true)).toBe('soldOut');
    expect(slotLevel(3, 12, true)).toBe('low');
    expect(slotLevel(4, 12, true)).toBe('ok');
    expect(slotLevel(12, 12, true)).toBe('full');
    expect(slotLevel(1, 4, true)).toBe('low');
    expect(slotLevel(1, 1, true)).toBe('full');
  });
});

describe('pickers', () => {
  it('offers closet products the shelf accepts, biggest stack first', () => {
    const game = newTestGame();
    const def = ctx.content.fixtures.get('fx.shelf.wall-small');
    if (!def) throw new Error('missing shelf');
    const picks = compatibleProducts(def, game.inventory.sealed, ctx).map(
      (pick) => pick.product.id,
    );
    expect(picks).toEqual([BOOSTER, BLISTER, STARTER_EMBER]);
    expect(picks).not.toContain(BOX);
  });

  it('lists singles for the case by value, searchable by name or number', () => {
    const game = newTestGame();
    const picks = casePicks(game.inventory.cardStacks, '', ctx);
    for (let i = 1; i < picks.length; i++) {
      expect(picks[i - 1]?.valueCents ?? 0).toBeGreaterThanOrEqual(picks[i]?.valueCents ?? 0);
    }
    const first = picks[0];
    if (!first) throw new Error('no singles');
    const found = casePicks(game.inventory.cardStacks, first.card.name.slice(0, 4), ctx);
    expect(found.some((pick) => pick.key === first.key)).toBe(true);
    expect(casePicks(game.inventory.cardStacks, 'zzzz', ctx)).toEqual([]);
  });
});

describe('fixtureOrdinal', () => {
  it('names fixtures by kind and position', () => {
    const game = newTestGame();
    expect(fixtureOrdinal(game.shop.fixtures, 'shelf-b', ctx.content)).toEqual({
      kind: 'shelf',
      ordinal: 2,
      count: 2,
    });
    expect(fixtureOrdinal(game.shop.fixtures, 'case-1', ctx.content)).toMatchObject({
      kind: 'case',
      ordinal: 1,
      count: 1,
    });
    expect(fixtureOrdinal(game.shop.fixtures, 'nope', ctx.content).kind).toBe('other');
  });
});
