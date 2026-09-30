import type { Difficulty } from '@/content/balance/difficulty';
import type { RepSub } from '@/content/balance/reputation';
import type { GameSpeed } from '@/content/balance/time';
import type { Finish } from '@/content/schema/common';
import type { Rotation } from '@/content/schema/shop';
import type { Cents } from '@/core/money';
import type { RngState } from '@/core/rng';
import type { Point } from '../nav';

/**
 * GameState (docs/07 §3). A single plain, JSON-serializable object: no classes, Maps, Sets,
 * Dates or functions. Any shape change bumps `SAVE_VERSION` and ships a migration
 * (src/save/migrations) plus a fixture test (CLAUDE.md rule 5).
 *
 * v2 (Phase 2): owner avatar, shop layout with fixture slots, card stacks, customers, supplier
 * orders, binder, unlocks and perks, reputation signals and the day log.
 */
export const SAVE_VERSION = 2;

export const RNG_STREAMS = [
  'customers',
  'market',
  'packs',
  'grading',
  'events',
  'staff',
  'misc',
] as const;
export type RngStream = (typeof RNG_STREAMS)[number];

export type Phase = 'prep' | 'open' | 'night';

export type LedgerKind = 'sale' | 'purchase' | 'rent' | 'loan' | 'wages' | 'fees' | 'debug';

export interface LedgerEntry {
  day: number;
  kind: LedgerKind;
  cents: Cents;
  ref?: string;
}

export interface DailyTotals {
  revenue: Cents;
  cogs: Cents;
  wages: Cents;
  rent: Cents;
  other: Cents;
  /** Supplier orders placed today (cash out, not a cost until sold). */
  purchases: Cents;
  /** Cost basis of sealed product opened today (docs/05 §5.17 "opened stock"). */
  opened: Cents;
  customers: number;
}

export interface SealedLot {
  qty: number;
  unitCostCents: Cents;
  acquiredDay: number;
  firstEdition?: boolean;
}

/** Owner avatar picked at New Game (indices into the Peg-folk look tables, src/scene/agents). */
export interface AvatarSpec {
  skin: number;
  hairStyle: number;
  hairColor: number;
  top: number;
  topColor: number;
}

/**
 * One fixture slot: sealed units on a shelf, or one single card in a case. A sold-out shelf slot
 * keeps `productId` and `priceCents` (Restock All refills it); only `stock/clearSlot` forgets them.
 */
export interface FixtureSlot {
  productId?: string;
  /** Stack key of a single card (src/sim/cards.ts `cardKey`). */
  cardKey?: string;
  qty: number;
  /** Total cost basis of the units in the slot (moved FIFO out of storage lots). */
  costCents: Cents;
  /** Case singles: the asking price. Shelf slots: optional override of the SKU price. */
  priceCents?: Cents;
}

export interface PlacedFixture {
  uid: string;
  fixtureId: string;
  x: number;
  z: number;
  rot: Rotation;
  slots: FixtureSlot[];
}

// ---------------------------------------------------------------------------------------------
// Customers (docs/01 §10.3, docs/06 §5.6). The sim owns the plan; the view only animates
// `activity`, `bubble` and `basket`, interpolating with the sim clock (src/state/simClock.ts).
// ---------------------------------------------------------------------------------------------

export type BubbleKind =
  | 'search' // browsing, looking for something
  | 'cart' // ready to pay (queueing)
  | 'waiting' // patience below half
  | 'angry' // patience ran out or a rip-off
  | 'delight' // left very happy
  | 'outOfStock' // wanted item missing
  | 'steal' // price reactions (docs/02 §5.3)
  | 'fair'
  | 'pricey'
  | 'ripoff';

export interface AgentBubble {
  kind: BubbleKind;
  sinceMinute: number;
  /** Absent = stays until replaced. */
  untilMinute?: number;
}

/** What the agent is doing now. Positions are grid-space points (src/sim/nav.ts). */
export type AgentActivity =
  | { kind: 'walk'; path: Point[]; startMinute: number; endMinute: number }
  | {
      kind: 'browse';
      fixtureUid: string;
      at: Point;
      facing: Point;
      startMinute: number;
      endMinute: number;
    }
  | { kind: 'queue'; laneIndex: number; at: Point; facing: Point; sinceMinute: number }
  | { kind: 'leave'; path: Point[]; startMinute: number; endMinute: number };

export interface BasketItem {
  fixtureUid: string;
  slot: number;
  productId?: string;
  cardKey?: string;
  qty: number;
  /** Unit price at pick time (prices can't change under a customer's feet). */
  priceCents: Cents;
  /** Unit cost basis moved out of the slot. */
  costCents: Cents;
}

export interface CustomerAgent {
  uid: number;
  archetypeId: string;
  /** Deterministic seed for looks and voice in the view. */
  lookSeed: number;
  activity: AgentActivity;
  bubble: AgentBubble | null;
  basket: BasketItem[];
  // --- sim-private (the view must not rely on these) ---
  budgetCents: Cents;
  knowledge: number;
  /** Patience budget in game-minutes and how much of it is used. */
  patienceMinutes: number;
  waitedMinutes: number;
  /** Fixture uids still to browse this visit, in order. */
  toBrowse: string[];
  /** Items wanted but not found (out of stock), for satisfaction and Selection signals. */
  missed: number;
  /** Running satisfaction contributions (docs/02 §5.4). */
  satisfaction: number;
  /** Reputation signals collected this visit, −1…+1 per touched sub-score. */
  signals: Partial<Record<RepSub, number>>;
}

export interface CustomersState {
  active: CustomerAgent[];
  /** Uids in the register lane, pay spot first. */
  lane: number[];
  nextUid: number;
  /** Game-minute of the next arrival today, or null when none is scheduled. */
  nextArrivalMinute: number | null;
}

// ---------------------------------------------------------------------------------------------

export interface OrderLine {
  productId: string;
  qty: number;
  unitCostCents: Cents;
}

export interface Order {
  uid: string;
  supplierId: string;
  lines: OrderLine[];
  totalCents: Cents;
  placedDay: number;
  /** Delivered at dawn of this day. */
  etaDay: number;
  status: 'pending' | 'delivered';
}

export interface BinderPocket {
  /** The card copy in the pocket (moved out of the stacks, never sold). */
  cardKey: string;
  addedDay: number;
}

export interface RepSignalBucket {
  /** Influence-weighted sum of signals today. */
  sum: number;
  weight: number;
  count: number;
}

/** Today's highlights for the Day Summary receipt (docs/05 §5.17). */
export interface DayLog {
  served: number;
  lost: number;
  itemsSold: number;
  packsOpened: number;
  newCards: number;
  xpGained: number;
  /** Reputation score at the start of the day. */
  repStart: number;
  bestPull: { cardId: string; finish: Finish; valueCents: Cents } | null;
}

export interface GameState {
  meta: {
    saveVersion: number;
    gameVersion: string;
    seed: number;
    /** ISO timestamp supplied by the caller (the sim never reads the wall clock). */
    createdAt: string;
    playTimeMs: number;
    difficulty: Difficulty;
    shopName: string;
    owner: AvatarSpec;
  };
  rng: Record<RngStream, RngState>;
  clock: {
    day: number;
    /** Minute of day, 0–1439. */
    minute: number;
    phase: Phase;
    speed: GameSpeed;
  };
  finance: {
    cashCents: Cents;
    loan: { principalCents: Cents };
    /** Rolling ledger of the last ~60 days. */
    ledger: LedgerEntry[];
    today: DailyTotals;
  };
  progression: {
    level: number;
    /** XP accumulated toward the next level. */
    xp: number;
    /** Unlock id → day granted. */
    unlocked: Record<string, number>;
    /** Placeholder perks granted for unbuilt unlocks (docs/02 §9.3), in grant order. */
    perks: string[];
    flags: Record<string, boolean | number>;
  };
  reputation: {
    sub: Record<RepSub, number>;
    /** Today's signals per sub-score, applied at night (docs/02 §13). */
    signals: Record<RepSub, RepSignalBucket>;
    /** Reputation score at the end of each day, oldest first (last ~60 days). */
    history: number[];
  };
  shop: {
    tier: 1 | 2 | 3 | 4 | 5;
    layoutId: string;
    fixtures: PlacedFixture[];
  };
  inventory: {
    /** Sealed product in storage (on shelves counts separately, in fixture slots). */
    sealed: Record<string, SealedLot[]>;
    /** Raw singles in storage: `cardKey` → count (docs/06 §5.5). */
    cardStacks: Record<string, number>;
  };
  pricing: {
    prices: Record<string, Cents>;
  };
  customers: CustomersState;
  suppliers: {
    orders: Order[];
    nextOrderUid: number;
  };
  collection: {
    /** Card id → first day the player ever owned it (NEW badges, binder silhouettes). */
    owned: Record<string, number>;
    /** Card id → the copy in its binder pocket. */
    binder: Record<string, BinderPocket>;
  };
  dayLog: DayLog;
  /** Lifetime counters (achievements, summaries). */
  stats: Record<string, number>;
}
