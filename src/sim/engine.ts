import { produce } from 'immer';
import { assertNever } from '@/core/assert';
import { isCents } from '@/core/money';
import { type Command, type CommandResult, fail, ok } from './commands';
import type { SimContext } from './context';
import type { DomainEvent } from './events';
import type { GameState } from './state/types';
import { closeShop, openShop, startNextDay, tickClock } from './systems/clock';
import { changeCash } from './systems/finance';
import { addXp } from './systems/progression';

/**
 * Simulation entry points (docs/06 §5.2). Everything here mutates a *draft* GameState: callers
 * wrap it in Immer (`runCommand`, the Zustand store) or pass a disposable clone in tests.
 */

const MAX_PRICE_CENTS = 10_000_000; // $100k: anything above is surely a typo

export function dispatch(state: GameState, command: Command, ctx: SimContext): CommandResult {
  switch (command.type) {
    case 'time/setSpeed': {
      if (!ctx.balance.time.speeds.includes(command.speed)) return fail('INVALID_SPEED');
      state.clock.speed = command.speed;
      return ok;
    }
    case 'time/openShop': {
      if (state.clock.phase !== 'prep') return fail('WRONG_PHASE', { phase: state.clock.phase });
      openShop(state, ctx);
      return ok;
    }
    case 'time/closeShop': {
      if (state.clock.phase !== 'open') return fail('WRONG_PHASE', { phase: state.clock.phase });
      closeShop(state, ctx);
      return ok;
    }
    case 'time/startNextDay': {
      if (state.clock.phase !== 'night') return fail('WRONG_PHASE', { phase: state.clock.phase });
      startNextDay(state, ctx);
      return ok;
    }
    case 'pricing/setPrice': {
      if (!ctx.content.products.has(command.productId)) {
        return fail('UNKNOWN_PRODUCT', { productId: command.productId });
      }
      if (!isCents(command.cents) || command.cents <= 0 || command.cents > MAX_PRICE_CENTS) {
        return fail('INVALID_PRICE');
      }
      state.pricing.prices[command.productId] = command.cents;
      ctx.emit({ type: 'pricing/changed', productId: command.productId, cents: command.cents });
      return ok;
    }
    case 'debug/grantCash': {
      if (!isCents(command.cents) || command.cents === 0) return fail('INVALID_AMOUNT');
      changeCash(state, ctx, command.cents, 'debug', 'debug');
      return ok;
    }
    case 'debug/grantXp': {
      if (!Number.isFinite(command.amount) || command.amount <= 0) return fail('INVALID_AMOUNT');
      addXp(state, ctx, command.amount, 'debug');
      return ok;
    }
    default:
      return assertNever(command, 'command');
  }
}

/** Advances the simulation by one game-minute (docs/06 §5.3 tick order). */
export function tick(state: GameState, ctx: SimContext): void {
  tickClock(state, ctx);
  // Phase 2+: customer spawn, agents, staff automation, checkout, reputation signals.
}

/** Adds real play time (tracked for the save summary). */
export function addPlayTime(state: GameState, ms: number): void {
  if (ms > 0 && Number.isFinite(ms)) state.meta.playTimeMs += Math.round(ms);
}

export type PureContext = Omit<SimContext, 'emit'>;

/** Immutable convenience wrapper: applies a command and returns the new state and events. */
export function runCommand(
  state: GameState,
  command: Command,
  ctx: PureContext,
): { state: GameState; result: CommandResult; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  let result: CommandResult = ok;
  const next = produce(state, (draft) => {
    result = dispatch(draft, command, { ...ctx, emit: (event) => events.push(event) });
  });
  return { state: next, result, events };
}

/** Immutable convenience wrapper: runs `count` ticks. */
export function runTicks(
  state: GameState,
  count: number,
  ctx: PureContext,
): { state: GameState; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  const next = produce(state, (draft) => {
    const simCtx: SimContext = { ...ctx, emit: (event) => events.push(event) };
    for (let i = 0; i < count; i++) tick(draft, simCtx);
  });
  return { state: next, events };
}
