import { describe, expect, it } from 'vitest';
import { cardKey } from './cards';
import { type MisprintKind, pulledCardKey } from './packs/misprints';
import { ALPHA, packTestContext } from './packs/testing';
import { askingPrice, itemMarketValue, priceReaction } from './pricing';
import { newTestGame, testContext } from './testing';

const ctx = testContext();
const BOOSTER = 'gk.emberdawn.booster';
const thresholds = ctx.balance.customers.reaction;

function anyCard(rarity: string) {
  const card = [...ctx.content.cards.values()].find((c) => c.rarity === rarity);
  if (!card) throw new Error(`no ${rarity} card in content`);
  return card;
}

describe('itemMarketValue', () => {
  it('values sealed product at MSRP while in print (docs/02 §12.2)', () => {
    expect(itemMarketValue(ctx, { productId: BOOSTER })).toBe(
      ctx.content.products.get(BOOSTER)?.msrpCents,
    );
    expect(itemMarketValue(ctx, { productId: 'gk.nope' })).toBeNull();
    expect(itemMarketValue(ctx, {})).toBeNull();
  });

  it('values singles by finish and condition (docs/02 §7.2)', () => {
    const common = anyCard('common');
    const normal = itemMarketValue(ctx, {
      cardKey: cardKey({ cardId: common.id, finish: 'normal' }),
    });
    expect(normal).toBe(common.baseValueCents);
    const reverse = itemMarketValue(ctx, {
      cardKey: cardKey({ cardId: common.id, finish: 'reverseHolo' }),
    });
    expect(reverse).toBe(
      Math.max(ctx.balance.cards.reverseHoloFloorCents, Math.round(common.baseValueCents * 3)),
    );
    const played = itemMarketValue(ctx, {
      cardKey: cardKey({ cardId: common.id, finish: 'normal', condition: 'played' }),
    });
    expect(played).toBe(Math.round(common.baseValueCents * 0.5));
    expect(itemMarketValue(ctx, { cardKey: 'nonsense' })).toBeNull();
  });

  it('applies the misprint premium from the misprint.<kind> stamp (docs/02 §7.2)', () => {
    const packCtx = packTestContext();
    const holoId = `${ALPHA}.025`; // a Holo Rare at the typical $2.20
    const holo = packCtx.content.cards.get(holoId);
    expect(holo?.rarity).toBe('holoRare');
    const premiums: [MisprintKind, number][] = [
      ['crimped', 2],
      ['miscut', 3],
      ['inkError', 4],
      ['missingFoil', 5],
      ['wrongBack', 25],
    ];
    for (const [kind, premium] of premiums) {
      const key = cardKey({ cardId: holoId, finish: 'holo', stamps: [`misprint.${kind}`] });
      expect(key).toBe(pulledCardKey({ cardId: holoId, finish: 'holo', misprint: kind }));
      expect(itemMarketValue(packCtx, { cardKey: key })).toBe(220 * premium);
    }
    // Reverse holo floor first, then the premium; condition multiplies too.
    const common = cardKey({
      cardId: `${ALPHA}.001`,
      finish: 'reverseHolo',
      stamps: ['misprint.miscut'],
      condition: 'played',
    });
    expect(itemMarketValue(packCtx, { cardKey: common })).toBe(Math.round(30 * 0.5 * 3));
    // Unknown misprint kinds carry no premium.
    const odd = cardKey({ cardId: holoId, finish: 'holo', stamps: ['misprint.upsideDown'] });
    expect(itemMarketValue(packCtx, { cardKey: odd })).toBe(220);
  });
});

describe('askingPrice', () => {
  it('uses the slot override, then the SKU price, then MSRP', () => {
    const game = newTestGame();
    game.pricing.prices[BOOSTER] = 499;
    expect(askingPrice(game, ctx, { productId: BOOSTER, priceCents: 399 })).toBe(399);
    expect(askingPrice(game, ctx, { productId: BOOSTER })).toBe(499);
    delete game.pricing.prices[BOOSTER];
    expect(askingPrice(game, ctx, { productId: BOOSTER })).toBe(
      ctx.content.products.get(BOOSTER)?.msrpCents,
    );
    expect(askingPrice(game, ctx, {})).toBeNull();
  });

  it('lets unpriced singles match the market', () => {
    const game = newTestGame();
    const holo = anyCard('holoRare');
    const key = cardKey({ cardId: holo.id, finish: 'holo' });
    expect(askingPrice(game, ctx, { cardKey: key })).toBe(holo.baseValueCents);
    expect(askingPrice(game, ctx, { cardKey: key, priceCents: 1 })).toBe(1);
  });
});

describe('priceReaction (docs/02 §5.3)', () => {
  it('buckets the price-to-market ratio at the documented thresholds', () => {
    expect(priceReaction(80, 100, thresholds)).toBe('steal');
    expect(priceReaction(81, 100, thresholds)).toBe('fair');
    expect(priceReaction(110, 100, thresholds)).toBe('fair');
    expect(priceReaction(111, 100, thresholds)).toBe('pricey');
    expect(priceReaction(130, 100, thresholds)).toBe('pricey');
    expect(priceReaction(131, 100, thresholds)).toBe('ripoff');
    expect(priceReaction(1, 0, thresholds)).toBe('ripoff');
  });
});
