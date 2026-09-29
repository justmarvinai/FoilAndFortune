import type { Cents } from '@/core/money';
import type { DailyTotals, Phase } from './state/types';

/**
 * Domain events (docs/07 §5): IDs and numbers only, never display strings. The presentation
 * layer maps them to i18n text, sounds and VFX; in-sim listeners (stats, achievements) use them
 * too.
 */
export type DomainEvent =
  | { type: 'clock/phaseChanged'; day: number; from: Phase; to: Phase }
  | { type: 'clock/dayStarted'; day: number }
  | { type: 'clock/hourChanged'; day: number; hour: number }
  | { type: 'day/closed'; day: number; totals: DailyTotals }
  | { type: 'cash/changed'; deltaCents: Cents; reason: CashReason }
  | { type: 'rent/charged'; day: number; cents: Cents }
  | { type: 'loan/changed'; principalCents: Cents }
  | { type: 'xp/gained'; amount: number; source: XpSource }
  | { type: 'level/up'; level: number }
  | { type: 'pricing/changed'; productId: string; cents: Cents };

export type CashReason = 'rent' | 'loan' | 'sale' | 'purchase' | 'debug';
export type XpSource = 'sale' | 'opening' | 'deal' | 'story' | 'debug';

export type DomainEventType = DomainEvent['type'];
export type DomainEventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;
