import { describe, expect, it } from 'vitest';
import {
  binderPockets,
  completion,
  copiesOf,
  POCKETS_PER_PAGE,
  paginate,
  spreadCount,
  spreadOfPocket,
  spreadPages,
} from './binder';
import { ctx, newTestGame, run } from './testing';

const SET = 'gk.emberdawn';

function pocketsOf(game = newTestGame()) {
  return binderPockets(SET, game.collection, game.inventory.cardStacks, ctx);
}

describe('binderPockets', () => {
  it('has one pocket per authored card, in card-number order', () => {
    const pockets = pocketsOf();
    const authored = [...ctx.content.cards.values()].filter((card) => card.setId === SET);
    expect(pockets).toHaveLength(authored.length);
    for (let i = 1; i < pockets.length; i++) {
      expect(pockets[i - 1]?.card.number ?? 0).toBeLessThan(pockets[i]?.card.number ?? 0);
    }
  });

  it('starts empty: pockets are available where singles exist, missing elsewhere', () => {
    const game = newTestGame();
    const pockets = pocketsOf(game);
    expect(pockets.some((pocket) => pocket.state === 'filled')).toBe(false);
    for (const pocket of pockets) {
      const held = Object.keys(game.inventory.cardStacks).some((key) =>
        key.startsWith(`${pocket.card.id}|`),
      );
      expect(pocket.state).toBe(held ? 'available' : 'missing');
      expect(pocket.seen).toBe(game.collection.owned[pocket.card.id] !== undefined);
    }
  });

  it('fills a pocket with the chosen copy and keeps the copies most valuable first', () => {
    let game = newTestGame();
    const target = pocketsOf(game).find((pocket) => pocket.state === 'available');
    const copy = target?.copies[0];
    if (!target || !copy) throw new Error('nothing to add');
    game = run(game, { type: 'collection/addToBinder', cardKey: copy.key });
    const pocket = pocketsOf(game).find((entry) => entry.card.id === target.card.id);
    expect(pocket).toMatchObject({
      state: 'filled',
      binderKey: copy.key,
      binderFinish: copy.finish,
    });
    for (const list of pocketsOf(game).map((entry) => entry.copies)) {
      for (let i = 1; i < list.length; i++) {
        expect(list[i - 1]?.valueCents ?? 0).toBeGreaterThanOrEqual(list[i]?.valueCents ?? 0);
      }
    }
    expect(copiesOf(target.card.id, game.inventory.cardStacks, ctx)).toEqual(pocket?.copies);
  });
});

describe('pagination', () => {
  it('splits pockets into 3 × 3 pages', () => {
    const items = Array.from({ length: 40 }, (_, i) => i);
    const pages = paginate(items);
    expect(pages.map((page) => page.length)).toEqual([9, 9, 9, 9, 4]);
    expect(paginate([])).toEqual([[]]);
    expect(POCKETS_PER_PAGE).toBe(9);
  });

  it('pairs pages into spreads', () => {
    expect(spreadCount(5)).toBe(3);
    expect(spreadCount(1)).toBe(1);
    expect(spreadCount(0)).toBe(1);
    expect(spreadPages(0, 5)).toEqual([0, 1]);
    expect(spreadPages(2, 5)).toEqual([4, null]);
    expect(spreadOfPocket(0)).toBe(0);
    expect(spreadOfPocket(17)).toBe(0);
    expect(spreadOfPocket(18)).toBe(1);
  });
});

describe('completion', () => {
  it('counts filled and fillable pockets', () => {
    let game = newTestGame();
    const before = completion(pocketsOf(game));
    expect(before.filled).toBe(0);
    expect(before.ratio).toBe(0);
    const copy = pocketsOf(game).find((pocket) => pocket.state === 'available')?.copies[0];
    if (!copy) throw new Error('nothing to add');
    game = run(game, { type: 'collection/addToBinder', cardKey: copy.key });
    const after = completion(pocketsOf(game));
    expect(after.filled).toBe(1);
    expect(after.ratio).toBeCloseTo(1 / after.total, 6);
    expect(completion([])).toEqual({ filled: 0, total: 0, ratio: 0, available: 0 });
  });
});
