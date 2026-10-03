import type { CustomerBalance } from '@/content/balance/customers';
import type { RepSub } from '@/content/balance/reputation';
import { clamp, lerp, mean } from '@/core/math';
import type { CustomerAgent } from '../../state/types';

/**
 * How a visit ended, and what it's worth: satisfaction at exit (docs/02 §5.4, clamped ±3) and the
 * reputation signals it emits (docs/02 §13).
 *
 * - `served`: rung up (manually, or by the owner at closing).
 * - `lost`: waited in line until their patience ran out.
 * - `gaveUp`: wanted to pay but the lane was full.
 * - `left`: walked out empty-handed (nothing they wanted, too pricey, or closing time).
 */
export type VisitOutcome = 'served' | 'lost' | 'gaveUp' | 'left';

type SatisfactionBalance = Pick<
  CustomerBalance,
  'queuePatienceMultiplier' | 'satisfaction' | 'signals'
>;

type Visit = Pick<
  CustomerAgent,
  'reactions' | 'missed' | 'basket' | 'waitedMinutes' | 'patienceMinutes'
>;

/** Patience in the register lane: holding items makes people wait longer (docs/02 §5.2). */
export function queuePatience(
  agent: Pick<CustomerAgent, 'patienceMinutes'>,
  balance: Pick<CustomerBalance, 'queuePatienceMultiplier'>,
): number {
  return agent.patienceMinutes * balance.queuePatienceMultiplier;
}

/** −0.1 per game-minute waited beyond 50% of (queue) patience, capped at −2 (docs/02 §5.4). */
export function waitPenalty(visit: Visit, outcome: VisitOutcome, balance: SatisfactionBalance) {
  const s = balance.satisfaction;
  // Nobody waited longer than the one who couldn't even get in line.
  if (outcome === 'gaveUp') return s.waitPenaltyCap;
  const over = visit.waitedMinutes - s.waitPenaltyAfter * queuePatience(visit, balance);
  return clamp(over * s.waitPenaltyPerMinute, 0, s.waitPenaltyCap);
}

/**
 * Satisfaction (docs/02 §5.4): price reactions averaged over every item considered, +1 for leaving
 * with what they came for, −1 if something they wanted was out of stock, minus the wait penalty.
 * Haggling (±0.5), delight moments (+1) and cashier charisma arrive with their features.
 */
export function visitSatisfaction(
  visit: Visit,
  outcome: VisitOutcome,
  balance: SatisfactionBalance,
): number {
  const s = balance.satisfaction;
  let total = 0;
  if (visit.reactions.length > 0) total += mean(visit.reactions.map((reaction) => s[reaction]));
  if (outcome === 'served' && visit.basket.length > 0) total += s.foundWanted;
  if (visit.missed > 0) total += s.outOfStock;
  total -= waitPenalty(visit, outcome, balance);
  return clamp(total, -s.clamp, s.clamp);
}

/**
 * Reputation signals (−1…+1) for the sub-scores this visit touched (docs/02 §13):
 * Prices from the reactions, Service from the wait versus patience (only for those who queued),
 * Selection = (found − missed) / (found + missed), where "found" is every want they saw in stock.
 */
export function visitSignals(
  visit: Visit,
  outcome: VisitOutcome,
  balance: SatisfactionBalance,
): Partial<Record<RepSub, number>> {
  const sig = balance.signals;
  const signals: Partial<Record<RepSub, number>> = {};
  if (visit.reactions.length > 0) {
    signals.prices = mean(visit.reactions.map((reaction) => sig.prices[reaction]));
  }
  if (outcome === 'served') {
    const used = clamp(visit.waitedMinutes / queuePatience(visit, balance), 0, 1);
    signals.service = lerp(sig.serviceInstant, sig.serviceAtPatienceEnd, used);
  } else if (outcome === 'lost' || outcome === 'gaveUp') {
    signals.service = sig.serviceLost;
  }
  const found = visit.reactions.length;
  if (found + visit.missed > 0) {
    signals.selection = (found - visit.missed) / (found + visit.missed);
  }
  return signals;
}
