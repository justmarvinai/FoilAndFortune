import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { xpToNextLevel } from '@/content/balance/progression';
import { dollars } from '@/core/money';
import type { Command } from './commands';
import { runCommand, runTicks } from './engine';
import type { DomainEvent } from './events';
import { reputationScore, reputationStars, sealedQuantity } from './selectors';
import type { GameState } from './state/types';
import { newTestGame, testContext } from './testing';

const ctx = testContext();
const OPEN_MINUTES = ctx.balance.time.closeMinute - ctx.balance.time.openMinute;

function run(state: GameState, command: Command) {
  return runCommand(state, command, ctx);
}

/** Plays one full day from prep: open → tick until close → next day. */
function playDay(state: GameState): { state: GameState; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  let s = run(state, { type: 'time/openShop' });
  events.push(...s.events);
  const ticked = runTicks(s.state, OPEN_MINUTES, ctx);
  events.push(...ticked.events);
  s = run(ticked.state, { type: 'time/startNextDay' });
  events.push(...s.events);
  return { state: s.state, events };
}

describe('new game', () => {
  it('starts on Day 1 in the prep phase with the difficulty cash', () => {
    const game = newTestGame('standard');
    expect(game.clock).toMatchObject({
      day: 1,
      phase: 'prep',
      minute: ctx.balance.time.prepMinute,
    });
    expect(game.finance.cashCents).toBe(dollars(600));
    expect(newTestGame('cozy').finance.cashCents).toBe(dollars(1000));
    expect(newTestGame('tycoon').finance.cashCents).toBe(dollars(400));
  });

  it('starts at exactly 1★ reputation (rep 20, docs/02 §13)', () => {
    const game = newTestGame();
    expect(reputationScore(game)).toBeCloseTo(20);
    expect(reputationStars(reputationScore(game))).toBe(1);
  });

  it('includes the starting sealed stock priced at MSRP (docs/02 §2)', () => {
    const game = newTestGame();
    expect(sealedQuantity(game, 'gk.emberdawn.booster')).toBe(24);
    expect(sealedQuantity(game, 'gk.emberdawn.box')).toBe(1);
    expect(game.pricing.prices['gk.emberdawn.booster']).toBe(dollars(4.49));
  });

  it('is fully JSON-serializable', () => {
    const game = newTestGame();
    expect(JSON.parse(JSON.stringify(game))).toEqual(game);
  });
});

describe('day cycle', () => {
  it('only opens from prep, closes from open, and starts the next day from night', () => {
    const game = newTestGame();
    expect(run(game, { type: 'time/closeShop' }).result).toMatchObject({
      ok: false,
      code: 'WRONG_PHASE',
    });
    expect(run(game, { type: 'time/startNextDay' }).result).toMatchObject({
      ok: false,
      code: 'WRONG_PHASE',
    });
    const opened = run(game, { type: 'time/openShop' });
    expect(opened.result.ok).toBe(true);
    expect(opened.state.clock).toMatchObject({
      phase: 'open',
      minute: ctx.balance.time.openMinute,
    });
    expect(run(opened.state, { type: 'time/openShop' }).result.ok).toBe(false);
  });

  it('ticks do nothing outside open hours', () => {
    const game = newTestGame();
    expect(runTicks(game, 100, ctx).state).toEqual(game);
  });

  it('auto-closes at 19:00 and emits hour chimes', () => {
    const opened = run(newTestGame(), { type: 'time/openShop' }).state;
    const { state, events } = runTicks(opened, OPEN_MINUTES + 50, ctx);
    expect(state.clock.phase).toBe('night');
    expect(state.clock.minute).toBe(ctx.balance.time.closeMinute);
    expect(events.filter((e) => e.type === 'clock/hourChanged')).toHaveLength(10);
    expect(events.some((e) => e.type === 'day/closed')).toBe(true);
  });

  it('advances the day and resets daily totals', () => {
    const { state, events } = playDay(newTestGame());
    expect(state.clock).toMatchObject({ day: 2, phase: 'prep' });
    expect(events).toContainEqual({ type: 'clock/dayStarted', day: 2 });
    expect(state.stats.daysPlayed).toBe(1);
  });
});

describe('rent (docs/02 §2–3)', () => {
  function playWeek(state: GameState) {
    let current = state;
    const events: DomainEvent[] = [];
    for (let i = 0; i < 7; i++) {
      const day = playDay(current);
      current = day.state;
      events.push(...day.events);
    }
    return { state: current, events };
  }

  it('charges 7 × $35 on the first Sunday night in Standard', () => {
    const { state, events } = playWeek(newTestGame('standard'));
    expect(events).toContainEqual({ type: 'rent/charged', day: 7, cents: dollars(245) });
    expect(state.finance.cashCents).toBe(dollars(600 - 245));
    expect(state.finance.ledger.filter((entry) => entry.kind === 'rent')).toHaveLength(1);
  });

  it('charges no rent in Cozy and $350 in Tycoon', () => {
    expect(playWeek(newTestGame('cozy')).events.some((e) => e.type === 'rent/charged')).toBe(false);
    expect(playWeek(newTestGame('tycoon')).events).toContainEqual({
      type: 'rent/charged',
      day: 7,
      cents: dollars(350),
    });
  });

  it('turns a rent shortfall into an automatic loan instead of negative cash', () => {
    const poor = run(newTestGame('tycoon'), {
      type: 'debug/grantCash',
      cents: -dollars(300),
    }).state;
    const { state } = playWeek(poor);
    expect(state.finance.cashCents).toBe(0);
    expect(state.finance.loan.principalCents).toBe(dollars(250));
  });
});

describe('commands', () => {
  it('validates prices', () => {
    const game = newTestGame();
    expect(
      run(game, { type: 'pricing/setPrice', productId: 'nope', cents: 100 }).result,
    ).toMatchObject({
      ok: false,
      code: 'UNKNOWN_PRODUCT',
    });
    expect(
      run(game, { type: 'pricing/setPrice', productId: 'gk.emberdawn.booster', cents: 0 }).result
        .ok,
    ).toBe(false);
    expect(
      run(game, { type: 'pricing/setPrice', productId: 'gk.emberdawn.booster', cents: 4.5 }).result
        .ok,
    ).toBe(false);
    const set = run(game, {
      type: 'pricing/setPrice',
      productId: 'gk.emberdawn.booster',
      cents: 499,
    });
    expect(set.state.pricing.prices['gk.emberdawn.booster']).toBe(499);
    expect(set.events).toContainEqual({
      type: 'pricing/changed',
      productId: 'gk.emberdawn.booster',
      cents: 499,
    });
  });

  it('rejects unknown speeds', () => {
    // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid input
    const bad = { type: 'time/setSpeed', speed: 3 } as any as Command;
    expect(run(newTestGame(), bad).result).toMatchObject({ ok: false, code: 'INVALID_SPEED' });
  });

  it('levels up exactly on the XP curve (docs/02 §9.2)', () => {
    const game = newTestGame();
    const once = run(game, { type: 'debug/grantXp', amount: xpToNextLevel(1) });
    expect(once.state.progression).toEqual({ level: 2, xp: 0 });
    const many = run(game, { type: 'debug/grantXp', amount: 80 + 234 + 439 + 5 });
    expect(many.state.progression).toEqual({ level: 4, xp: 5 });
    expect(many.events.filter((e) => e.type === 'level/up').map((e) => e.type)).toHaveLength(3);
  });
});

describe('determinism & invariants', () => {
  const commandArb: fc.Arbitrary<Command | { type: 'tick'; count: number }> = fc.oneof(
    fc.constant<Command>({ type: 'time/openShop' }),
    fc.constant<Command>({ type: 'time/closeShop' }),
    fc.constant<Command>({ type: 'time/startNextDay' }),
    fc.constantFrom<Command>(
      { type: 'time/setSpeed', speed: 0 },
      { type: 'time/setSpeed', speed: 2 },
      { type: 'time/setSpeed', speed: 4 },
    ),
    fc
      .integer({ min: -100_000, max: 100_000 })
      .map<Command>((cents) => ({ type: 'debug/grantCash', cents })),
    fc.integer({ min: 1, max: 5000 }).map<Command>((amount) => ({ type: 'debug/grantXp', amount })),
    fc.integer({ min: 1, max: 20_000 }).map<Command>((cents) => ({
      type: 'pricing/setPrice',
      productId: 'gk.emberdawn.booster',
      cents,
    })),
    fc.integer({ min: 1, max: 700 }).map((count) => ({ type: 'tick' as const, count })),
  );

  function apply(state: GameState, step: Command | { type: 'tick'; count: number }): GameState {
    return step.type === 'tick' ? runTicks(state, step.count, ctx).state : run(state, step).state;
  }

  it('same seed + same commands → identical state', () => {
    fc.assert(
      fc.property(fc.array(commandArb, { maxLength: 30 }), (steps) => {
        const a = steps.reduce(apply, newTestGame('standard', 99));
        const b = steps.reduce(apply, newTestGame('standard', 99));
        expect(a).toEqual(b);
      }),
      { numRuns: 60 },
    );
  });

  it('never breaks core invariants', () => {
    fc.assert(
      fc.property(fc.array(commandArb, { maxLength: 40 }), (steps) => {
        const state = steps.reduce(apply, newTestGame());
        expect(Number.isSafeInteger(state.finance.cashCents)).toBe(true);
        expect(state.clock.minute).toBeGreaterThanOrEqual(0);
        expect(state.clock.minute).toBeLessThan(24 * 60);
        expect(['prep', 'open', 'night']).toContain(state.clock.phase);
        expect(state.progression.level).toBeGreaterThanOrEqual(1);
        expect(state.progression.xp).toBeGreaterThanOrEqual(0);
        expect(state.finance.loan.principalCents).toBeGreaterThanOrEqual(0);
        expect(JSON.parse(JSON.stringify(state))).toEqual(state);
      }),
      { numRuns: 80 },
    );
  });
});
