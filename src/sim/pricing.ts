import type { BalanceConfig } from '@/content/balance';
import type { ContentRegistry } from '@/content/registry';
import type { Cents } from '@/core/money';
import { cardMarketValue, parseCardKey, productMarketValue } from './cards';
import { misprintOf } from './packs/misprints';
import type { FixtureSlot, GameState } from './state/types';

/**
 * Prices and market references for what sits in a fixture slot (docs/01 §9.2, docs/02 §5.3).
 * Pure reads, shared by customers (willingness to pay, reaction bubbles), the fixture popover and
 * the Price Board.
 */

type PricingContext = { content: ContentRegistry; balance: Pick<BalanceConfig, 'cards'> };

export type PriceReaction = 'steal' | 'fair' | 'pricey' | 'ripoff';

/**
 * Market value of one unit of a sealed product or a single card print, or null if unknown.
 * Singles: base value × finish × condition × misprint premium (docs/02 §7.2).
 */
export function itemMarketValue(
  ctx: PricingContext,
  item: { productId?: string; cardKey?: string },
): Cents | null {
  if (item.cardKey) {
    const print = parseCardKey(item.cardKey);
    const card = print ? ctx.content.cards.get(print.cardId) : undefined;
    if (!print || !card) return null;
    const condition = ctx.balance.cards.condition[print.condition];
    const misprint = misprintOf(print.stamps);
    const premium = misprint ? ctx.balance.cards.misprintMultiplier[misprint] : 1;
    return Math.round(cardMarketValue(card, print.finish, ctx.balance) * condition * premium);
  }
  const product = item.productId ? ctx.content.products.get(item.productId) : undefined;
  return product ? productMarketValue(product, ctx.balance) : null;
}

/**
 * The asking price of one unit in a slot: the slot's override, else the SKU price (sealed), else
 * MSRP. Singles without a price track their market value ("Match market").
 */
export function askingPrice(
  state: GameState,
  ctx: PricingContext,
  slot: Pick<FixtureSlot, 'productId' | 'cardKey' | 'priceCents'>,
): Cents | null {
  if (slot.priceCents !== undefined) return slot.priceCents;
  if (slot.cardKey) return itemMarketValue(ctx, slot);
  if (!slot.productId) return null;
  const sku = state.pricing.prices[slot.productId];
  if (sku !== undefined) return sku;
  return ctx.content.products.get(slot.productId)?.msrpCents ?? null;
}

/** Reaction bucket for a price against the true market value (docs/02 §5.3, docs/01 §9.2). */
export function priceReaction(
  priceCents: Cents,
  marketCents: Cents,
  thresholds: { steal: number; fair: number; pricey: number },
): PriceReaction {
  if (marketCents <= 0) return 'ripoff';
  const ratio = priceCents / marketCents;
  if (ratio <= thresholds.steal) return 'steal';
  if (ratio <= thresholds.fair) return 'fair';
  if (ratio <= thresholds.pricey) return 'pricey';
  return 'ripoff';
}
