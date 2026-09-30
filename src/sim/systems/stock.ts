import type { FixtureDef } from '@/content/schema/shop';
import { cardKey, parseCardKey } from '../cards';
import { type CommandResult, fail, ok } from '../commands';
import type { SimContext } from '../context';
import type { FixtureSlot, GameState, PlacedFixture } from '../state/types';
import { addCardStack, putSealed, sealedInStorage, takeCardStack, takeSealed } from './inventory';
import { hasUnlock } from './progression';

/**
 * Stocking (docs/01 §9.1): moving product between storage and fixture slots. Shelf slots hold
 * one product each, up to `perShelfSlot` units; case slots hold one single card.
 */

export const SINGLES_CASE_UNLOCK = 'unlock.feature.singles-case';

interface SlotRef {
  fixture: PlacedFixture;
  def: FixtureDef;
  slot: FixtureSlot;
}

function findSlot(
  state: GameState,
  ctx: SimContext,
  fixtureUid: string,
  index: number,
): SlotRef | CommandResult {
  const fixture = state.shop.fixtures.find((f) => f.uid === fixtureUid);
  if (!fixture) return fail('UNKNOWN_FIXTURE', { fixtureUid });
  const def = ctx.content.fixtures.get(fixture.fixtureId);
  const slot = fixture.slots[index];
  if (!def || !slot || !Number.isInteger(index))
    return fail('INVALID_SLOT', { fixtureUid, slot: index });
  return { fixture, def, slot };
}

function isRef(value: SlotRef | CommandResult): value is SlotRef {
  return 'fixture' in value;
}

/** How many units of a product fit in one slot of a fixture (0 = not accepted). */
export function slotCapacity(ctx: SimContext, def: FixtureDef, productId: string): number {
  const product = ctx.content.products.get(productId);
  if (!product || def.slots.accepts.kind !== 'sealed') return 0;
  if (!def.slots.accepts.productKinds.includes(product.kind)) return 0;
  return product.perShelfSlot;
}

function emitChanged(ctx: SimContext, fixtureUid: string, slot: number): void {
  ctx.emit({ type: 'stock/changed', fixtureUid, slot });
}

export function fillSlot(
  state: GameState,
  ctx: SimContext,
  command: { fixtureUid: string; slot: number; productId?: string; cardKey?: string; qty?: number },
): CommandResult {
  const ref = findSlot(state, ctx, command.fixtureUid, command.slot);
  if (!isRef(ref)) return ref;
  const { def, slot } = ref;

  if (def.slots.accepts.kind === 'singles') {
    if (!hasUnlock(state, SINGLES_CASE_UNLOCK))
      return fail('LOCKED', { unlockId: SINGLES_CASE_UNLOCK });
    const key = command.cardKey;
    const print = key ? parseCardKey(key) : null;
    const card = print ? ctx.content.cards.get(print.cardId) : undefined;
    if (!key || !print || !card) return fail('UNKNOWN_CARD');
    if (slot.qty > 0) return fail('SLOT_OCCUPIED');
    if (takeCardStack(state, key, 1) !== 1) return fail('NOT_ENOUGH_STOCK');
    slot.cardKey = cardKey(print);
    slot.productId = undefined;
    slot.qty = 1;
    slot.costCents = 0; // singles' cost was recognized when their pack was opened
    emitChanged(ctx, command.fixtureUid, command.slot);
    return ok;
  }

  const productId = command.productId ?? slot.productId;
  if (!productId || !ctx.content.products.has(productId)) return fail('UNKNOWN_PRODUCT');
  const capacity = slotCapacity(ctx, def, productId);
  if (capacity === 0) return fail('SLOT_INCOMPATIBLE', { productId });
  if (slot.qty > 0 && slot.productId !== productId) return fail('SLOT_OCCUPIED');
  const wanted = Math.min(command.qty ?? capacity, capacity - slot.qty);
  if (!Number.isInteger(wanted) || wanted <= 0) {
    return wanted === 0 ? ok : fail('INVALID_AMOUNT');
  }
  if (sealedInStorage(state, productId) === 0) return fail('NOT_ENOUGH_STOCK', { productId });
  const taken = takeSealed(state, productId, wanted);
  if (slot.productId !== productId) slot.priceCents = undefined; // an override belongs to its SKU
  slot.productId = productId;
  slot.cardKey = undefined;
  slot.qty += taken.qty;
  slot.costCents += taken.costCents;
  emitChanged(ctx, command.fixtureUid, command.slot);
  return ok;
}

/**
 * Returns a slot's contents to storage (sealed lots at their average cost, singles to stacks).
 * Never blocked by closet space: an over-full closet only stops new orders (docs/02 §4.3).
 */
export function clearSlot(
  state: GameState,
  ctx: SimContext,
  command: { fixtureUid: string; slot: number },
): CommandResult {
  const ref = findSlot(state, ctx, command.fixtureUid, command.slot);
  if (!isRef(ref)) return ref;
  const { slot } = ref;
  if (slot.qty === 0) return ok;
  if (slot.cardKey) addCardStack(state, slot.cardKey, slot.qty);
  else if (slot.productId) {
    const unitCost = Math.round(slot.costCents / slot.qty);
    putSealed(state, slot.productId, slot.qty, unitCost, state.clock.day);
  }
  slot.qty = 0;
  slot.costCents = 0;
  slot.productId = undefined;
  slot.cardKey = undefined;
  slot.priceCents = undefined;
  emitChanged(ctx, command.fixtureUid, command.slot);
  return ok;
}

/**
 * Takes up to `qty` units off a slot (a customer's pick) and returns them with their share of the
 * slot's cost basis. An emptied shelf slot keeps its product and price so Restock All can refill
 * it; an emptied case slot is cleared, because that card is gone.
 */
export function takeFromSlot(slot: FixtureSlot, qty: number): { qty: number; costCents: number } {
  const take = Math.max(0, Math.min(Math.floor(qty), slot.qty));
  if (take === 0) return { qty: 0, costCents: 0 };
  const costCents =
    take === slot.qty ? slot.costCents : Math.round((slot.costCents / slot.qty) * take);
  slot.qty -= take;
  slot.costCents -= costCents;
  if (slot.qty === 0) {
    slot.costCents = 0;
    if (slot.cardKey) {
      slot.cardKey = undefined;
      slot.priceCents = undefined;
    }
  }
  return { qty: take, costCents };
}

/** Tops up every shelf slot that holds a product from storage (docs/01 §9.1 "Restock All"). */
export function restockAll(state: GameState, ctx: SimContext): CommandResult {
  for (const fixture of state.shop.fixtures) {
    fixture.slots.forEach((slot, index) => {
      if (!slot.productId || sealedInStorage(state, slot.productId) === 0) return;
      fillSlot(state, ctx, { fixtureUid: fixture.uid, slot: index });
    });
  }
  return ok;
}

export function setSlotPrice(
  state: GameState,
  ctx: SimContext,
  command: { fixtureUid: string; slot: number; cents: number },
  maxPriceCents: number,
): CommandResult {
  const ref = findSlot(state, ctx, command.fixtureUid, command.slot);
  if (!isRef(ref)) return ref;
  if (!Number.isSafeInteger(command.cents) || command.cents <= 0 || command.cents > maxPriceCents) {
    return fail('INVALID_PRICE');
  }
  ref.slot.priceCents = command.cents;
  emitChanged(ctx, command.fixtureUid, command.slot);
  return ok;
}
