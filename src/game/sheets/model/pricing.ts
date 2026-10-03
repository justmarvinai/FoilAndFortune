import type { Finish } from '@/content/schema/common';
import type { CardDef, ProductDef } from '@/content/schema/tcg';
import type { Cents } from '@/core/money';
import { parseCardKey } from '@/sim/cards';
import { itemMarketValue, type PriceReaction, priceReaction } from '@/sim/pricing';
import {
  averageCost,
  type Fixtures,
  incomingUnits,
  lotsHolding,
  type Orders,
  type Prices,
  type Sealed,
  shelfHoldings,
  skuPrice,
  type ViewContext,
} from './stock';

/**
 * The Price Board (docs/05 §5.5, docs/01 §9.2): one row per SKU with your price, market, your
 * average cost, margin and stock-out risk, the pricing helpers, and per-slot tags for singles in
 * the display case.
 */

export type StockLevel = 'ok' | 'low' | 'shelfEmpty' | 'out';

export interface PriceRow {
  product: ProductDef;
  priceCents: Cents;
  marketCents: Cents;
  avgCostCents: Cents | null;
  /** (price − cost) / price; null without a cost basis. */
  marginPct: number | null;
  reaction: PriceReaction;
  onShelf: number;
  inStorage: number;
  incoming: number;
  stock: StockLevel;
  /** Stock-out risk icon (docs/05 §5.5). */
  atRisk: boolean;
}

export function marginPct(priceCents: Cents, costCents: Cents | null): number | null {
  if (costCents === null || priceCents <= 0) return null;
  return (priceCents - costCents) / priceCents;
}

/**
 * Stock status: nothing left anywhere, nothing on display (customers can't buy it), or less than
 * one shelf slot's worth left (docs/01 §9.3 "don't run out").
 */
export function stockLevel(onShelf: number, inStorage: number, perShelfSlot: number): StockLevel {
  if (onShelf + inStorage === 0) return 'out';
  if (onShelf === 0) return 'shelfEmpty';
  if (onShelf + inStorage < perShelfSlot) return 'low';
  return 'ok';
}

/**
 * One row per product you hold, have on order, or can order right now (so you can price ahead),
 * held products first.
 */
export function priceRows(
  prices: Prices,
  sealed: Sealed,
  fixtures: Fixtures,
  orders: Orders,
  orderable: ReadonlySet<string>,
  ctx: ViewContext,
): PriceRow[] {
  const shelves = shelfHoldings(fixtures);
  const incoming = incomingUnits(orders);
  const rows: PriceRow[] = [];
  for (const product of ctx.content.products.values()) {
    const storage = lotsHolding(sealed[product.id]);
    const shelf = shelves.get(product.id);
    const onShelf = shelf?.qty ?? 0;
    const inbound = incoming.get(product.id) ?? 0;
    const held = storage.qty + onShelf + inbound > 0;
    if (!held && !orderable.has(product.id)) continue;
    const priceCents = skuPrice(prices, product.id, ctx.content) ?? product.msrpCents;
    const marketCents = itemMarketValue(ctx, { productId: product.id }) ?? product.msrpCents;
    const avgCostCents = averageCost(storage, shelf);
    const stock = stockLevel(onShelf, storage.qty, product.perShelfSlot);
    rows.push({
      product,
      priceCents,
      marketCents,
      avgCostCents,
      marginPct: marginPct(priceCents, avgCostCents),
      reaction: priceReaction(priceCents, marketCents, ctx.balance.customers.reaction),
      onShelf,
      inStorage: storage.qty,
      incoming: inbound,
      stock,
      atRisk: held && stock !== 'ok',
    });
  }
  const heldFirst = (row: PriceRow) => (row.onShelf + row.inStorage + row.incoming > 0 ? 0 : 1);
  return rows.sort(
    (a, b) =>
      heldFirst(a) - heldFirst(b) ||
      a.product.msrpCents - b.product.msrpCents ||
      a.product.name.localeCompare(b.product.name),
  );
}

// ---------------------------------------------------------------------------------------------
// Pricing helpers (docs/01 §9.2): MSRP, Match market, Market +X%, Round .99
// ---------------------------------------------------------------------------------------------

/** Charm pricing: the nearest X.99 (under $1: the nearest .X9), ties go up; never below 9¢. */
export function roundTo99(cents: Cents): Cents {
  if (cents <= 0) return 9;
  if (cents < 100) {
    const down = Math.floor(cents / 10) * 10 - 1;
    const up = down + 10;
    const pick = down < 9 || up - cents <= cents - down ? up : down;
    return Math.min(99, Math.max(9, pick));
  }
  const down = Math.floor(cents / 100) * 100 - 1;
  const up = down + 100;
  return up - cents <= cents - down ? up : down;
}

export function marketPlus(marketCents: Cents, pct: number): Cents {
  return Math.max(1, Math.round(marketCents * (1 + pct / 100)));
}

export type PriceHelper = 'msrp' | 'market' | 'marketPlus' | 'round99';

export function applyHelper(
  helper: PriceHelper,
  row: { priceCents: Cents; marketCents: Cents; msrpCents?: Cents },
  pct: number,
): Cents {
  switch (helper) {
    case 'msrp':
      return row.msrpCents ?? row.marketCents;
    case 'market':
      return row.marketCents;
    case 'marketPlus':
      return marketPlus(row.marketCents, pct);
    case 'round99':
      return roundTo99(row.priceCents);
  }
}

/** Price steps for the ± buttons: coarser for pricier items, like a real price gun. */
export function priceStep(cents: Cents): Cents {
  if (cents < 200) return 5;
  if (cents < 1000) return 10;
  if (cents < 5000) return 50;
  if (cents < 20000) return 100;
  return 500;
}

export function stepPrice(cents: Cents, direction: 1 | -1): Cents {
  const step = priceStep(direction === 1 ? cents : Math.max(1, cents - 1));
  const next =
    direction === 1
      ? Math.floor(cents / step) * step + step
      : Math.ceil(cents / step) * step - step;
  return Math.max(1, next);
}

/** Parses a typed price ("4.49", "$12", "1,299.00") into cents, or null. */
export function parsePrice(text: string): Cents | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(cleaned)) return null;
  const cents = Math.round(Number.parseFloat(cleaned) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

// ---------------------------------------------------------------------------------------------
// Reaction preview (docs/02 §5.3): where a price sits against market
// ---------------------------------------------------------------------------------------------

export interface ReactionZone {
  reaction: PriceReaction;
  /** Price ratio bounds (price / market). */
  from: number;
  to: number;
}

/** Zones for the reaction meter, with the rip-off zone capped at `max`. */
export function reactionZones(
  thresholds: { steal: number; fair: number; pricey: number },
  max = 1.6,
): ReactionZone[] {
  return [
    { reaction: 'steal', from: 0.4, to: thresholds.steal },
    { reaction: 'fair', from: thresholds.steal, to: thresholds.fair },
    { reaction: 'pricey', from: thresholds.fair, to: thresholds.pricey },
    { reaction: 'ripoff', from: thresholds.pricey, to: max },
  ];
}

/** 0–1 position of a price on the reaction meter (clamped to the meter's ends). */
export function meterPosition(
  priceCents: Cents,
  marketCents: Cents,
  zones: ReactionZone[],
): number {
  const first = zones[0];
  const last = zones[zones.length - 1];
  if (!first || !last || marketCents <= 0) return 1;
  const ratio = priceCents / marketCents;
  return Math.min(1, Math.max(0, (ratio - first.from) / (last.to - first.from)));
}

// ---------------------------------------------------------------------------------------------
// Display-case tags (per-slot prices, `pricing/setSlotPrice`)
// ---------------------------------------------------------------------------------------------

export interface CaseTagRow {
  fixtureUid: string;
  slot: number;
  cardKey: string;
  card: CardDef;
  finish: Finish;
  priceCents: Cents;
  marketCents: Cents;
  /** False while the tag just tracks market value. */
  hasOverride: boolean;
  reaction: PriceReaction;
}

export function caseTagRows(fixtures: Fixtures, ctx: ViewContext): CaseTagRow[] {
  const rows: CaseTagRow[] = [];
  for (const fixture of fixtures) {
    fixture.slots.forEach((slot, index) => {
      if (!slot.cardKey || slot.qty === 0) return;
      const print = parseCardKey(slot.cardKey);
      const card = print ? ctx.content.cards.get(print.cardId) : undefined;
      if (!print || !card) return;
      const marketCents = itemMarketValue(ctx, { cardKey: slot.cardKey }) ?? 0;
      const priceCents = slot.priceCents ?? marketCents;
      rows.push({
        fixtureUid: fixture.uid,
        slot: index,
        cardKey: slot.cardKey,
        card,
        finish: print.finish,
        priceCents,
        marketCents,
        hasOverride: slot.priceCents !== undefined,
        reaction: priceReaction(priceCents, marketCents, ctx.balance.customers.reaction),
      });
    });
  }
  return rows;
}
