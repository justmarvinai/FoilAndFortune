import { describe, expect, it } from 'vitest';
import type { CustomerAgent } from '../../state/types';
import { testContext } from '../../testing';
import { queuePatience, visitSatisfaction, visitSignals, waitPenalty } from './satisfaction';

const balance = testContext().balance.customers;
const s = balance.satisfaction;

type Visit = Pick<
  CustomerAgent,
  'reactions' | 'missed' | 'basket' | 'waitedMinutes' | 'patienceMinutes'
>;

const item = {
  fixtureUid: 'shelf-a',
  slot: 0,
  productId: 'gk.emberdawn.booster',
  qty: 1,
  priceCents: 449,
  costCents: 325,
};

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    reactions: [],
    missed: 0,
    basket: [],
    waitedMinutes: 0,
    patienceMinutes: 10,
    ...overrides,
  };
}

describe('satisfaction at exit (docs/02 §5.4)', () => {
  it('adds price reactions (averaged), found-what-they-wanted and out-of-stock', () => {
    const fairAndFound = visit({ reactions: ['fair'], basket: [item] });
    expect(visitSatisfaction(fairAndFound, 'served', balance)).toBeCloseTo(s.fair + s.foundWanted);
    const mixed = visit({ reactions: ['steal', 'pricey'], basket: [item], missed: 1 });
    expect(visitSatisfaction(mixed, 'served', balance)).toBeCloseTo(
      (s.steal + s.pricey) / 2 + s.foundWanted + s.outOfStock,
    );
    // Walking out empty-handed never counts as "found what they wanted".
    expect(visitSatisfaction(visit({ reactions: ['ripoff'] }), 'left', balance)).toBeCloseTo(
      s.ripoff,
    );
    expect(visitSatisfaction(visit(), 'left', balance)).toBe(0);
  });

  it('charges 0.1 per minute waited beyond half the queue patience, capped at 2', () => {
    const patience = queuePatience(visit(), balance);
    expect(patience).toBe(10 * balance.queuePatienceMultiplier);
    const half = patience * s.waitPenaltyAfter;
    expect(waitPenalty(visit({ waitedMinutes: half }), 'served', balance)).toBe(0);
    expect(waitPenalty(visit({ waitedMinutes: half + 5 }), 'served', balance)).toBeCloseTo(0.5);
    expect(waitPenalty(visit({ waitedMinutes: 999 }), 'lost', balance)).toBe(s.waitPenaltyCap);
    // Finding the lane full is the longest wait of all.
    expect(waitPenalty(visit(), 'gaveUp', balance)).toBe(s.waitPenaltyCap);
  });

  it('clamps to ±3', () => {
    const awful = visit({ reactions: ['ripoff'], missed: 2, waitedMinutes: 999 });
    expect(visitSatisfaction(awful, 'lost', balance)).toBe(-s.clamp);
    // A generous (non-default) bonus, to reach the upper clamp.
    const lenient = {
      ...balance,
      satisfaction: { ...s, foundWanted: 5 },
    } as unknown as typeof balance;
    const great = visit({ reactions: ['steal'], basket: [item] });
    expect(visitSatisfaction(great, 'served', lenient)).toBe(s.clamp);
  });
});

describe('reputation signals per visit (docs/02 §13)', () => {
  it('averages Prices over every item considered', () => {
    const signals = visitSignals(
      visit({ reactions: ['steal', 'ripoff', 'fair'] }),
      'left',
      balance,
    );
    const p = balance.signals.prices;
    expect(signals.prices).toBeCloseTo((p.steal + p.ripoff + p.fair) / 3);
    expect(signals.service).toBeUndefined();
  });

  it('scores Service from the wait versus queue patience, and −1 for lost customers', () => {
    const patience = queuePatience(visit(), balance);
    expect(visitSignals(visit({ basket: [item] }), 'served', balance).service).toBe(1);
    expect(
      visitSignals(visit({ basket: [item], waitedMinutes: patience / 2 }), 'served', balance)
        .service,
    ).toBeCloseTo(0);
    expect(visitSignals(visit(), 'lost', balance).service).toBe(-1);
    expect(visitSignals(visit(), 'gaveUp', balance).service).toBe(-1);
  });

  it('scores Selection as (found − missed) / (found + missed)', () => {
    expect(visitSignals(visit({ reactions: ['fair'] }), 'left', balance).selection).toBe(1);
    expect(visitSignals(visit({ missed: 2 }), 'left', balance).selection).toBe(-1);
    expect(
      visitSignals(visit({ reactions: ['fair', 'fair', 'fair'], missed: 1 }), 'left', balance)
        .selection,
    ).toBeCloseTo(0.5);
    // A visitor who never looked at anything touches no sub-score.
    expect(visitSignals(visit(), 'left', balance)).toEqual({});
  });
});
