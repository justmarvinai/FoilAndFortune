import type { Cents } from '@/core/money';
import { cardKey } from '../cards';
import type { PulledCard } from '../events';
import type { GameState } from '../state/types';

/**
 * Storage bookkeeping (docs/07 §3 InventoryState). Sealed product is kept in cost lots and moved
 * FIFO; singles are counted stacks. These helpers never emit events; callers do.
 */

export function sealedInStorage(state: GameState, productId: string): number {
  let total = 0;
  for (const lot of state.inventory.sealed[productId] ?? []) total += lot.qty;
  return total;
}

/**
 * Removes up to `qty` units FIFO from storage lots. Returns what was actually taken and its total
 * cost basis.
 */
export function takeSealed(
  state: GameState,
  productId: string,
  qty: number,
): { qty: number; costCents: Cents } {
  const lots = state.inventory.sealed[productId] ?? [];
  let remaining = qty;
  let costCents = 0;
  while (remaining > 0 && lots.length > 0) {
    const lot = lots[0];
    if (!lot) break;
    const take = Math.min(lot.qty, remaining);
    lot.qty -= take;
    remaining -= take;
    costCents += take * lot.unitCostCents;
    if (lot.qty === 0) lots.shift();
  }
  if (lots.length === 0) delete state.inventory.sealed[productId];
  else state.inventory.sealed[productId] = lots;
  return { qty: qty - remaining, costCents };
}

/** Adds units to storage as a new lot (or merges into a lot with the same cost and day). */
export function putSealed(
  state: GameState,
  productId: string,
  qty: number,
  unitCostCents: Cents,
  day: number,
): void {
  if (qty <= 0) return;
  const lots = state.inventory.sealed[productId] ?? [];
  const last = lots[lots.length - 1];
  if (last && last.unitCostCents === unitCostCents && last.acquiredDay === day) last.qty += qty;
  else lots.push({ qty, unitCostCents, acquiredDay: day });
  state.inventory.sealed[productId] = lots;
}

export function cardsInStorage(state: GameState, key: string): number {
  return state.inventory.cardStacks[key] ?? 0;
}

export function addCardStack(state: GameState, key: string, count: number): void {
  if (count <= 0) return;
  state.inventory.cardStacks[key] = (state.inventory.cardStacks[key] ?? 0) + count;
}

/** Removes up to `count` copies; returns how many were removed. */
export function takeCardStack(state: GameState, key: string, count: number): number {
  const have = state.inventory.cardStacks[key] ?? 0;
  const take = Math.min(have, count);
  if (have - take === 0) delete state.inventory.cardStacks[key];
  else state.inventory.cardStacks[key] = have - take;
  return take;
}

/**
 * Puts pulled cards into storage and records first ownership. Returns the card ids the player
 * had never owned before (NEW badges, docs/01 §14.1), in pull order without duplicates.
 */
export function addPulledCards(state: GameState, cards: readonly PulledCard[]): string[] {
  const fresh: string[] = [];
  for (const card of cards) {
    addCardStack(state, cardKey({ cardId: card.cardId, finish: card.finish }), 1);
    if (state.collection.owned[card.cardId] === undefined) {
      state.collection.owned[card.cardId] = state.clock.day;
      fresh.push(card.cardId);
    }
  }
  return fresh;
}

/** Storage units used by sealed product in storage (shelved units don't count, docs/02 §4.3). */
export function storageUnitsUsed(state: GameState, unitsOf: (productId: string) => number): number {
  let used = 0;
  for (const [productId, lots] of Object.entries(state.inventory.sealed)) {
    let qty = 0;
    for (const lot of lots) qty += lot.qty;
    used += qty * unitsOf(productId);
  }
  return used;
}
