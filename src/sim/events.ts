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
  /**
   * What this group of cards is (always set by the sim; absent means `pack`), listed in reveal
   * order (docs/01 §14.2):
   * - `promo`: the outer product's promo cards, revealed first; `productId` is the outer product.
   * - `deck`: a starter deck's list in order, the guaranteed holo last; `productId` is the deck.
   * - `pack`: one booster, cards in slot order with the rare slot last (a god pack sorts best last).
   */
  kind?: 'pack' | 'deck' | 'promo';
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
      /** Cost basis of the opened unit, for "value vs cost" in the summary (docs/01 §14.1). */
      costCents?: Cents;
    }
  /** A multi-pack product broken into loose sealed packs in storage (docs/01 §14.4). */
  | {
      type: 'product/unboxed';
      productId: string;
      packs: { productId: string; qty: number }[];
      /** Promo cards that came with it, now in the card stacks. */
      promos?: PulledCard[];
    }
  /**
   * Hits (Holo Rare and better, in reveal order), for XP toasts, highlights and stingers.
   * `isNew` marks the first copy of a card the player had never owned.
   */
  | { type: 'card/pulled'; cardId: string; finish: Finish; rarity: Rarity; isNew: boolean }
  | { type: 'customer/arrived'; uid: number; archetypeId: string }
  /** Emitted on the tick nearest the moment the agent crosses the door line (door bell). */
  | { type: 'customer/entered'; uid: number }
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
