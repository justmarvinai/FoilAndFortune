import { describe, expect, it } from 'vitest';
import {
  applyHelper,
  caseTagRows,
  marginPct,
  marketPlus,
  meterPosition,
  parsePrice,
  priceRows,
  reactionZones,
  roundTo99,
  stepPrice,
  stockLevel,
} from './pricing';
import {
  BLISTER,
  BOOSTER,
  BOX,
  ctx,
  levelUpTo,
  newTestGame,
  run,
  STARTER_EMBER,
  STARTER_VOLT,
  someStackKey,
} from './testing';

const ORDERABLE = new Set([BOOSTER, BLISTER, STARTER_EMBER, STARTER_VOLT]);
const THRESHOLDS = ctx.balance.customers.reaction;

function rowsOf(game = newTestGame(), orderable: ReadonlySet<string> = ORDERABLE) {
  return priceRows(
    game.pricing.prices,
    game.inventory.sealed,
    game.shop.fixtures,
    game.suppliers.orders,
    orderable,
    ctx,
  );
}

describe('priceRows', () => {
  it('lists held products first (cheapest first), then orderable ones', () => {
    const rows = rowsOf();
    expect(rows.map((row) => row.product.id)).toEqual([
      BOOSTER,
      BLISTER,
      STARTER_EMBER,
      BOX,
      STARTER_VOLT,
    ]);
    expect(rowsOf(newTestGame(), new Set()).some((row) => row.product.id === STARTER_VOLT)).toBe(
      false,
    );
  });

  it('shows price, market, cost and margin at MSRP on day one', () => {
    const booster = rowsOf().find((row) => row.product.id === BOOSTER);
    expect(booster).toMatchObject({
      priceCents: 449,
      marketCents: 449,
      avgCostCents: 325,
      reaction: 'fair',
      stock: 'shelfEmpty',
      atRisk: true,
    });
    expect(booster?.marginPct).toBeCloseTo((449 - 325) / 449, 6);
  });

  it('follows SKU price changes and shelf stock', () => {
    let game = newTestGame();
    game = run(game, { type: 'pricing/setPrice', productId: BOOSTER, cents: 699 });
    game = run(game, {
      type: 'stock/fillSlot',
      fixtureUid: 'shelf-a',
      slot: 0,
      productId: BOOSTER,
    });
    const booster = rowsOf(game).find((row) => row.product.id === BOOSTER);
    expect(booster).toMatchObject({
      priceCents: 699,
      reaction: 'ripoff',
      stock: 'ok',
      atRisk: false,
    });
  });
});

describe('stockLevel', () => {
  it('distinguishes sold out, nothing on display, low and fine', () => {
    expect(stockLevel(0, 0, 12)).toBe('out');
    expect(stockLevel(0, 5, 12)).toBe('shelfEmpty');
    expect(stockLevel(3, 2, 12)).toBe('low');
    expect(stockLevel(12, 0, 12)).toBe('ok');
  });
});

describe('pricing helpers', () => {
  it('rounds to the nearest .99 (ties up), and to .X9 under a dollar', () => {
    expect(roundTo99(449)).toBe(499);
    expect(roundTo99(500)).toBe(499);
    expect(roundTo99(1220)).toBe(1199);
    expect(roundTo99(1260)).toBe(1299);
    expect(roundTo99(199)).toBe(199);
    expect(roundTo99(100)).toBe(99);
    expect(roundTo99(95)).toBe(99);
    expect(roundTo99(24)).toBe(29);
    expect(roundTo99(15)).toBe(19);
    expect(roundTo99(5)).toBe(9);
    expect(roundTo99(0)).toBe(9);
  });

  it('applies MSRP, match market and market +X%', () => {
    const row = { priceCents: 520, marketCents: 449, msrpCents: 449 };
    expect(applyHelper('msrp', row, 10)).toBe(449);
    expect(applyHelper('market', row, 10)).toBe(449);
    expect(applyHelper('marketPlus', row, 10)).toBe(494);
    expect(applyHelper('round99', row, 10)).toBe(499);
    expect(marketPlus(15, -50)).toBe(8);
    expect(marketPlus(1, -100)).toBe(1);
  });

  it('steps prices on a price-gun grid', () => {
    expect(stepPrice(449, 1)).toBe(450);
    expect(stepPrice(450, 1)).toBe(460);
    expect(stepPrice(449, -1)).toBe(440);
    expect(stepPrice(100, -1)).toBe(95);
    expect(stepPrice(1499, 1)).toBe(1500);
    expect(stepPrice(16164, 1)).toBe(16200);
    expect(stepPrice(5, -1)).toBe(1);
  });

  it('parses typed prices and rejects nonsense', () => {
    expect(parsePrice('4.49')).toBe(449);
    expect(parsePrice('$12')).toBe(1200);
    expect(parsePrice('1,299.00')).toBe(129900);
    expect(parsePrice('.5')).toBe(50);
    expect(parsePrice(' 7 ')).toBe(700);
    expect(parsePrice('0')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('4.499')).toBeNull();
    expect(parsePrice('-3')).toBeNull();
  });

  it('computes margins against the average cost', () => {
    expect(marginPct(449, 325)).toBeCloseTo(0.2762, 3);
    expect(marginPct(300, 325)).toBeLessThan(0);
    expect(marginPct(449, null)).toBeNull();
  });
});

describe('reaction meter', () => {
  const zones = reactionZones(THRESHOLDS);

  it('orders the four zones from steal to rip-off without gaps', () => {
    expect(zones.map((zone) => zone.reaction)).toEqual(['steal', 'fair', 'pricey', 'ripoff']);
    for (let i = 1; i < zones.length; i++) expect(zones[i]?.from).toBe(zones[i - 1]?.to);
  });

  it('places prices on the meter, clamped to its ends', () => {
    expect(meterPosition(100, 100, zones)).toBeCloseTo((1 - 0.4) / (1.6 - 0.4), 6);
    expect(meterPosition(10, 100, zones)).toBe(0);
    expect(meterPosition(1000, 100, zones)).toBe(1);
    expect(meterPosition(100, 0, zones)).toBe(1);
  });
});

describe('caseTagRows', () => {
  it('tracks market until a per-slot tag is set', () => {
    let game = levelUpTo(newTestGame(), 2);
    const key = someStackKey(game);
    game = run(game, { type: 'stock/fillSlot', fixtureUid: 'case-1', slot: 3, cardKey: key });
    const [tag] = caseTagRows(game.shop.fixtures, ctx);
    expect(tag).toMatchObject({ fixtureUid: 'case-1', slot: 3, cardKey: key, hasOverride: false });
    expect(tag?.priceCents).toBe(tag?.marketCents);
    expect(tag?.reaction).toBe('fair');
    game = run(game, { type: 'pricing/setSlotPrice', fixtureUid: 'case-1', slot: 3, cents: 5 });
    expect(caseTagRows(game.shop.fixtures, ctx)[0]).toMatchObject({
      priceCents: 5,
      hasOverride: true,
    });
  });
});
