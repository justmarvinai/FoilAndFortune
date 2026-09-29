import type { Difficulty } from '@/content/balance/difficulty';
import type { RepSub } from '@/content/balance/reputation';
import type { GameSpeed } from '@/content/balance/time';
import type { Cents } from '@/core/money';
import type { RngState } from '@/core/rng';

/**
 * GameState (docs/07 §3). A single plain, JSON-serializable object: no classes, Maps, Sets,
 * Dates or functions. Any shape change bumps `SAVE_VERSION` and ships a migration
 * (src/save/migrations) plus a fixture test (CLAUDE.md rule 5).
 *
 * Phase 1 contains the foundation slices; later phases add customers, market, grading, staff…
 */
export const SAVE_VERSION = 1;

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
  customers: number;
}

export interface SealedLot {
  qty: number;
  unitCostCents: Cents;
  acquiredDay: number;
  firstEdition?: boolean;
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
  };
  reputation: {
    sub: Record<RepSub, number>;
  };
  shop: {
    tier: 1 | 2 | 3 | 4 | 5;
  };
  inventory: {
    sealed: Record<string, SealedLot[]>;
  };
  pricing: {
    prices: Record<string, Cents>;
  };
  /** Lifetime counters (achievements, summaries). */
  stats: Record<string, number>;
}
