import { shopTier } from '@/content/balance/shop';
import { weekdayOf } from '@/core/calendar';
import { type Cents, scaleCents } from '@/core/money';
import type { SimContext } from '../context';
import type { CashReason } from '../events';
import type { DailyTotals, GameState, LedgerKind } from '../state/types';

/** How many days of ledger history we keep (docs/07 §3). */
const LEDGER_DAYS = 60;

export function emptyDailyTotals(): DailyTotals {
  return {
    revenue: 0,
    cogs: 0,
    wages: 0,
    rent: 0,
    other: 0,
    purchases: 0,
    opened: 0,
    customers: 0,
  };
}

/** Adds (or with a negative amount removes) cash and records it in the ledger. */
export function changeCash(
  state: GameState,
  ctx: SimContext,
  deltaCents: Cents,
  kind: LedgerKind,
  reason: CashReason,
  ref?: string,
): void {
  if (deltaCents === 0) return;
  state.finance.cashCents += deltaCents;
  state.finance.ledger.push(
    ref
      ? { day: state.clock.day, kind, cents: deltaCents, ref }
      : { day: state.clock.day, kind, cents: deltaCents },
  );
  ctx.emit({ type: 'cash/changed', deltaCents, reason });
}

export function trimLedger(state: GameState): void {
  const oldest = state.clock.day - LEDGER_DAYS;
  if (state.finance.ledger.length > 0 && (state.finance.ledger[0]?.day ?? oldest) < oldest) {
    state.finance.ledger = state.finance.ledger.filter((entry) => entry.day >= oldest);
  }
}

/** Weekly rent = 7 × tier daily rent × difficulty multiplier (docs/02 §2–3). */
export function weeklyRent(state: GameState, ctx: Pick<SimContext, 'balance'>): Cents {
  const difficulty = ctx.balance.difficulty[state.meta.difficulty];
  return scaleCents(shopTier(state.shop.tier).dailyRent * 7, difficulty.rentMultiplier);
}

/**
 * Night pipeline step: on Sunday night, charge the week's rent. If cash doesn't cover it, the
 * shortfall becomes an automatic bank loan (docs/02 §3). Interest, limits and bankruptcy arrive
 * with the full finance system in Phase 3.
 */
export function chargeRentIfDue(state: GameState, ctx: SimContext): void {
  if (weekdayOf(state.clock.day) !== 'sun') return;
  const rent = weeklyRent(state, ctx);
  if (rent <= 0) return;

  const shortfall = Math.max(0, rent - state.finance.cashCents);
  if (shortfall > 0) {
    state.finance.loan.principalCents += shortfall;
    changeCash(state, ctx, shortfall, 'loan', 'loan');
    ctx.emit({ type: 'loan/changed', principalCents: state.finance.loan.principalCents });
  }
  changeCash(state, ctx, -rent, 'rent', 'rent');
  state.finance.today.rent += rent;
  ctx.emit({ type: 'rent/charged', day: state.clock.day, cents: rent });
}
