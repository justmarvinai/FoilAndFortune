import type { GameSpeed } from '@/content/balance/time';
import type { Cents } from '@/core/money';

/**
 * Commands (docs/07 §4): the ONLY way UI, staff AI and bots change game state
 * (CLAUDE.md rule 2). Serializable, so a seed + command log replays a session.
 */
export type Command =
  // time
  | { type: 'time/setSpeed'; speed: GameSpeed }
  | { type: 'time/openShop' }
  | { type: 'time/closeShop' }
  | { type: 'time/startNextDay' }
  // stock (docs/01 §9.1)
  | {
      type: 'stock/fillSlot';
      fixtureUid: string;
      slot: number;
      /** Sealed product for shelf slots. */
      productId?: string;
      /** A single card (stack key) for case slots. */
      cardKey?: string;
      /** Units to add; default fills the slot (sealed) or 1 (single). */
      qty?: number;
    }
  | { type: 'stock/clearSlot'; fixtureUid: string; slot: number }
  | { type: 'stock/restockAll' }
  // pricing (docs/01 §9.2)
  | { type: 'pricing/setPrice'; productId: string; cents: Cents }
  | { type: 'pricing/setSlotPrice'; fixtureUid: string; slot: number; cents: Cents }
  // suppliers (docs/01 §18)
  | {
      type: 'suppliers/placeOrder';
      supplierId: string;
      lines: { productId: string; qty: number }[];
    }
  // opening (docs/01 §14): opens one unit from storage. A booster box opens all its packs at once;
  // "rip one by one" versus Quick Rip is purely how the view presents the result.
  | { type: 'open/openProduct'; productId: string }
  // customers (docs/01 §11.1): ring up the customer at the pay spot (or a specific uid)
  | { type: 'customers/checkout'; uid?: number }
  // collection (docs/01 §24)
  | { type: 'collection/addToBinder'; cardKey: string }
  | { type: 'collection/removeFromBinder'; cardId: string }
  // debug
  | { type: 'debug/grantCash'; cents: Cents }
  | { type: 'debug/grantXp'; amount: number };

export type CommandType = Command['type'];

/** Player-facing validation failures. The UI maps codes to friendly i18n messages. */
export type ErrorCode =
  | 'WRONG_PHASE'
  | 'INVALID_SPEED'
  | 'UNKNOWN_PRODUCT'
  | 'INVALID_PRICE'
  | 'INVALID_AMOUNT'
  | 'UNKNOWN_FIXTURE'
  | 'INVALID_SLOT'
  | 'SLOT_INCOMPATIBLE'
  | 'SLOT_OCCUPIED'
  | 'NOT_ENOUGH_STOCK'
  | 'LOCKED'
  | 'UNKNOWN_SUPPLIER'
  | 'EMPTY_ORDER'
  | 'BELOW_MINIMUM'
  | 'NOT_ENOUGH_CASH'
  | 'STORAGE_FULL'
  | 'NOT_OPENABLE'
  | 'NO_CUSTOMER'
  | 'UNKNOWN_CARD';

export type CommandResult =
  | { ok: true }
  | { ok: false; code: ErrorCode; params?: Record<string, string | number> };

export const ok: CommandResult = { ok: true };

export function fail(code: ErrorCode, params?: Record<string, string | number>): CommandResult {
  return params ? { ok: false, code, params } : { ok: false, code };
}
