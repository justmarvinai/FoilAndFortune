import type { GameSpeed } from '@/content/balance/time';
import type { Cents } from '@/core/money';

/**
 * Commands (docs/07 §4): the ONLY way UI, staff AI and bots change game state
 * (CLAUDE.md rule 2). Serializable, so a seed + command log replays a session.
 */
export type Command =
  | { type: 'time/setSpeed'; speed: GameSpeed }
  | { type: 'time/openShop' }
  | { type: 'time/closeShop' }
  | { type: 'time/startNextDay' }
  | { type: 'pricing/setPrice'; productId: string; cents: Cents }
  | { type: 'debug/grantCash'; cents: Cents }
  | { type: 'debug/grantXp'; amount: number };

export type CommandType = Command['type'];

/** Player-facing validation failures. The UI maps codes to friendly i18n messages. */
export type ErrorCode =
  | 'WRONG_PHASE'
  | 'INVALID_SPEED'
  | 'UNKNOWN_PRODUCT'
  | 'INVALID_PRICE'
  | 'INVALID_AMOUNT';

export type CommandResult =
  | { ok: true }
  | { ok: false; code: ErrorCode; params?: Record<string, string | number> };

export const ok: CommandResult = { ok: true };

export function fail(code: ErrorCode, params?: Record<string, string | number>): CommandResult {
  return params ? { ok: false, code, params } : { ok: false, code };
}
