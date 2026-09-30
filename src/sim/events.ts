import type { Finish, Rarity } from '@/content/schema/common';
import type { Cents } from '@/core/money';
import type { BubbleKind, DailyTotals, Phase } from './state/types';

/**
 * Domain events (docs/07 §5): IDs and numbers only, never display strings. The presentation
 * layer maps them to i18n text, sounds and VFX; in-sim listeners (stats, achievements) use them
 * too.
 */

export interface PulledCard {
  cardId: string;
  finish: Finish;
  misprint?: 'miscut' | 'inkError' | 'missingFoil' | 'crimped' | 'wrongBack';
}

export interface PackResult {
  /** The pack product that was opened (e.g. a booster inside a blister). */
  productId: string;
  cards: PulledCard[];
  godPack?: boolean;
}

export interface SoldItem {
  productId?: string;
  cardKey?: string;
  qty: number;
  priceCents: Cents;
}

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
  | { type: 'unlock/granted'; unlockId: string; perkId?: string }
  | { type: 'pricing/changed'; productId: string; cents: Cents }
  | { type: 'stock/changed'; fixtureUid: string; slot: number }
  | {
      type: 'order/placed';
      orderUid: string;
      supplierId: string;
      totalCents: Cents;
      etaDay: number;
    }
  | { type: 'order/delivered'; orderUid: string; supplierId: string }
  | {
      type: 'product/opened';
      productId: string;
      packs: PackResult[];
      /** Card ids the player had never owned before this opening. */
      newCardIds: string[];
    }
  /** Rare-slot hits (Holo Rare and better), for XP toasts, highlights and stingers. */
  | { type: 'card/pulled'; cardId: string; finish: Finish; rarity: Rarity; isNew: boolean }
  | { type: 'customer/arrived'; uid: number; archetypeId: string }
  | { type: 'customer/bubble'; uid: number; bubble: BubbleKind }
  | { type: 'customer/queued'; uid: number }
  | { type: 'customer/left'; uid: number; satisfaction: number; bought: boolean }
  | { type: 'sale/completed'; uid: number; items: SoldItem[]; totalCents: Cents }
  | { type: 'reputation/changed'; before: number; after: number }
  | { type: 'binder/changed'; cardId: string };

export type CashReason = 'rent' | 'loan' | 'sale' | 'purchase' | 'debug';
export type XpSource = 'sale' | 'customer' | 'opening' | 'pull' | 'deal' | 'story' | 'debug';

export type DomainEventType = DomainEvent['type'];
export type DomainEventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;
