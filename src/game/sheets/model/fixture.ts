import type { Finish } from '@/content/schema/common';
import type { FixtureDef } from '@/content/schema/shop';
import type { CardDef, ProductDef } from '@/content/schema/tcg';
import type { Cents } from '@/core/money';
import { parseCardKey } from '@/sim/cards';
import { itemMarketValue } from '@/sim/pricing';
import type { PlacedFixture } from '@/sim/state/types';
import {
  type CardStacks,
  type Fixtures,
  lotsHolding,
  type Prices,
  type Sealed,
  slotAskingPrice,
  type ViewContext,
} from './stock';

/** The Fixture Popover (docs/05 §5.3, docs/01 §9.1): slots, counts, capacity and price tags. */

export type FixtureKind = 'shelf' | 'case' | 'register' | 'other';

/** empty: nothing assigned · soldOut: its product sold out · low: ≤ LOW_SHARE of capacity. */
export type SlotLevel = 'empty' | 'soldOut' | 'low' | 'ok' | 'full';

/** A slot pulses as "low" at or below this share of its capacity (docs/05 §5.3). */
export const LOW_SHARE = 0.25;

export interface SlotView {
  index: number;
  productId?: string;
  cardKey?: string;
  qty: number;
  /** Units the slot holds when full (a case slot holds one card). */
  capacity: number;
  level: SlotLevel;
  priceCents: Cents | null;
  marketCents: Cents | null;
  /** A per-slot price overrides the SKU price. */
  hasOverride: boolean;
  /** Units of the slot's product waiting in the closet. */
  inStorage: number;
  /** Fill would add something right now. */
  canFill: boolean;
}

export interface FixtureView {
  fixture: PlacedFixture;
  def: FixtureDef;
  kind: FixtureKind;
  slots: SlotView[];
  /** "Restock this fixture" would move at least one unit. */
  restockable: boolean;
  /** Units on display / total capacity of the slots that hold something. */
  stocked: number;
}

export function fixtureKind(def: FixtureDef): FixtureKind {
  if (def.category === 'register') return 'register';
  if (def.slots.accepts.kind === 'singles') return 'case';
  if (def.slots.accepts.kind === 'sealed') return 'shelf';
  return 'other';
}

export function slotLevel(qty: number, capacity: number, assigned: boolean): SlotLevel {
  if (qty <= 0) return assigned ? 'soldOut' : 'empty';
  if (qty >= capacity) return 'full';
  if (qty <= Math.max(1, Math.floor(capacity * LOW_SHARE))) return 'low';
  return 'ok';
}

export function fixtureView(
  fixture: PlacedFixture,
  prices: Prices,
  sealed: Sealed,
  ctx: ViewContext,
): FixtureView | null {
  const def = ctx.content.fixtures.get(fixture.fixtureId);
  if (!def) return null;
  const kind = fixtureKind(def);
  const marketOf = (item: { productId?: string; cardKey?: string }) => itemMarketValue(ctx, item);
  let restockable = false;
  let stocked = 0;
  const slots = fixture.slots.map((slot, index): SlotView => {
    const product = slot.productId ? ctx.content.products.get(slot.productId) : undefined;
    const capacity = kind === 'case' ? 1 : (product?.perShelfSlot ?? 0);
    const inStorage = slot.productId ? lotsHolding(sealed[slot.productId]).qty : 0;
    const canFill = kind === 'shelf' && !!product && inStorage > 0 && slot.qty < capacity;
    if (canFill) restockable = true;
    stocked += slot.qty;
    const assigned = kind === 'shelf' ? slot.productId !== undefined : slot.cardKey !== undefined;
    return {
      index,
      productId: slot.productId,
      cardKey: slot.cardKey,
      qty: slot.qty,
      capacity: Math.max(capacity, 1),
      level: slotLevel(slot.qty, Math.max(capacity, 1), assigned),
      priceCents: slotAskingPrice(prices, slot, marketOf, ctx.content),
      marketCents: slot.productId || slot.cardKey ? marketOf(slot) : null,
      hasOverride: slot.priceCents !== undefined,
      inStorage,
      canFill,
    };
  });
  return { fixture, def, kind, slots, restockable, stocked };
}

/** Sealed products in the closet that this fixture's slots accept, biggest stack first. */
export function compatibleProducts(
  def: FixtureDef,
  sealed: Sealed,
  ctx: ViewContext,
): { product: ProductDef; inStorage: number }[] {
  if (def.slots.accepts.kind !== 'sealed') return [];
  const kinds = def.slots.accepts.productKinds;
  const out: { product: ProductDef; inStorage: number }[] = [];
  for (const [productId, lots] of Object.entries(sealed)) {
    const product = ctx.content.products.get(productId);
    const qty = lotsHolding(lots).qty;
    if (!product || qty === 0 || !kinds.includes(product.kind)) continue;
    out.push({ product, inStorage: qty });
  }
  return out.sort(
    (a, b) => b.inStorage - a.inStorage || a.product.name.localeCompare(b.product.name),
  );
}

export interface CasePick {
  key: string;
  card: CardDef;
  finish: Finish;
  count: number;
  valueCents: Cents;
}

/** Singles you could put in a case slot: searchable, most valuable first (docs/05 §5.3). */
export function casePicks(stacks: CardStacks, query: string, ctx: ViewContext): CasePick[] {
  const q = query.trim().toLowerCase();
  const out: CasePick[] = [];
  for (const [key, count] of Object.entries(stacks)) {
    if (count <= 0) continue;
    const print = parseCardKey(key);
    const card = print ? ctx.content.cards.get(print.cardId) : undefined;
    if (!print || !card) continue;
    if (q) {
      const number = String(card.number).padStart(3, '0');
      if (!card.name.toLowerCase().includes(q) && !number.includes(q)) continue;
    }
    out.push({
      key,
      card,
      finish: print.finish,
      count,
      valueCents: itemMarketValue(ctx, { cardKey: key }) ?? 0,
    });
  }
  return out.sort(
    (a, b) =>
      b.valueCents - a.valueCents || a.card.number - b.card.number || a.key.localeCompare(b.key),
  );
}

/**
 * A friendly ordinal per fixture category ("Shelf 2", "Display case"): the layout uids are
 * stable ids, not names.
 */
export function fixtureOrdinal(
  fixtures: Fixtures,
  uid: string,
  content: ViewContext['content'],
): {
  kind: FixtureKind;
  ordinal: number;
  count: number;
} {
  const target = fixtures.find((fixture) => fixture.uid === uid);
  const def = target ? content.fixtures.get(target.fixtureId) : undefined;
  if (!target || !def) return { kind: 'other', ordinal: 1, count: 1 };
  const kind = fixtureKind(def);
  const same = fixtures.filter((fixture) => {
    const other = content.fixtures.get(fixture.fixtureId);
    return other !== undefined && fixtureKind(other) === kind;
  });
  return {
    kind,
    ordinal: same.findIndex((fixture) => fixture.uid === uid) + 1,
    count: same.length,
  };
}
