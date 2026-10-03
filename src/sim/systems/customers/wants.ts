import type { ArchetypeDef, Preference } from '@/content/schema/customers';
import type { Cents } from '@/core/money';
import type { Rng } from '@/core/rng';
import type { SimContext } from '../../context';
import { itemMarketValue } from '../../pricing';
import type { FixtureSlot, GameState, PlacedFixture } from '../../state/types';
import { hasUnlock } from '../progression';
import { SINGLES_CASE_UNLOCK } from '../stock';

/**
 * What customers want (docs/02 §5.2): a want list drawn from the archetype preferences, and how
 * it matches what's on display.
 */

type WantContext = Pick<SimContext, 'content' | 'balance'>;

/**
 * Preferences this shop could ever satisfy today: sealed kinds that exist in the catalog and fit
 * some placed fixture, and singles once a case exists and the case is unlocked (Lv 2). Nobody asks
 * for things the player can't stock yet, so progression gates never cost Selection reputation.
 */
export function offeredPreferences(
  state: GameState,
  ctx: WantContext,
  archetype: ArchetypeDef,
): Preference[] {
  const kinds = new Set<string>();
  for (const product of ctx.content.products.values()) kinds.add(product.kind);
  const accepts = state.shop.fixtures.flatMap((fixture) => {
    const def = ctx.content.fixtures.get(fixture.fixtureId);
    return def && def.slots.count > 0 ? [def.slots.accepts] : [];
  });
  const singlesOpen = hasUnlock(state, SINGLES_CASE_UNLOCK);
  return archetype.preferences.filter((pref) => {
    if (pref.kind === 'singles') return singlesOpen && accepts.some((a) => a.kind === 'singles');
    return (
      kinds.has(pref.productKind) &&
      accepts.some((a) => a.kind === 'sealed' && a.productKinds.includes(pref.productKind))
    );
  });
}

/** Basket size ~ Poisson(basketMean), at least 1, each unit drawn by preference weight. */
export function drawWants(
  state: GameState,
  ctx: WantContext,
  rng: Rng,
  archetype: ArchetypeDef,
): Preference[] {
  const offered = offeredPreferences(state, ctx, archetype);
  if (offered.length === 0) return [];
  const count = Math.max(1, rng.poisson(archetype.basketMean));
  const table = offered.map((pref) => ({ value: pref, weight: pref.weight }));
  // Copies: state must never alias content objects (saves, Immer freezing).
  return Array.from({ length: count }, () => ({ ...rng.weighted(table) }));
}

/** Does this slot hold at least one unit that satisfies the want? */
export function slotMatches(ctx: WantContext, slot: FixtureSlot, want: Preference): boolean {
  if (slot.qty <= 0) return false;
  if (want.kind === 'sealed') {
    if (!slot.productId || slot.cardKey) return false;
    return ctx.content.products.get(slot.productId)?.kind === want.productKind;
  }
  if (!slot.cardKey) return false;
  if (want.maxValueCents === undefined) return true;
  const value = itemMarketValue(ctx, { cardKey: slot.cardKey });
  return value !== null && value <= want.maxValueCents;
}

export function fixtureDisplays(ctx: WantContext, fixture: PlacedFixture, want: Preference) {
  return fixture.slots.some((slot) => slotMatches(ctx, slot, want));
}

/** "Wanted but nowhere in stock" (docs/01 §9.3): no fixture in the shop displays a match. */
export function inStockAnywhere(state: GameState, ctx: WantContext, want: Preference): boolean {
  return state.shop.fixtures.some((fixture) => fixtureDisplays(ctx, fixture, want));
}

/**
 * The value customers judge a price against (docs/02 §5.3): in-print sealed product anchors to
 * its MSRP (the sticker price); singles to their market value. Null when unknown.
 */
export function referenceValue(
  ctx: WantContext,
  item: { productId?: string; cardKey?: string },
): Cents | null {
  if (item.cardKey) return itemMarketValue(ctx, { cardKey: item.cardKey });
  const product = item.productId ? ctx.content.products.get(item.productId) : undefined;
  return product ? product.msrpCents : null;
}
