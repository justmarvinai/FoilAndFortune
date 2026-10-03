import { create } from 'zustand';
import type { GameSpeed } from '@/content/balance/time';
import { createBus } from '@/core/bus';
import type { Cents } from '@/core/money';
import type { CashReason } from '@/sim/events';

/**
 * UI-only state of the play shell (never saved, never read by the sim): dock badges, the cash
 * floats, the activity log, the "Saved" flash and the door sign's confirm bubble. Game-wide UI
 * coordination (sheets, stage, celebrations, summary) stays in `src/state/uiStore.ts`.
 */

export type FeedKind =
  | 'sale'
  | 'leftHappy'
  | 'leftEmpty'
  | 'delivery'
  | 'order'
  | 'levelUp'
  | 'opened'
  | 'rent'
  | 'shopOpened'
  | 'shopClosed';

export interface FeedEntry {
  id: number;
  kind: FeedKind;
  /** Game minute of day when it happened. */
  minute: number;
  params: Record<string, string | number>;
}

export interface CashFloat {
  id: number;
  cents: Cents;
  reason: CashReason;
}

const MAX_FEED = 40;
const FLOAT_MS = 1600;

let nextId = 1;

export interface ShellStore {
  /** Deliveries received since the Stock sheet was last opened (dock badge). */
  deliveriesUnseen: number;
  /** Never-owned cards pulled since the Binder was last opened (dock badge). */
  newCardsUnseen: number;
  /** `performance.now()` of the last successful save, for the "Saved" flash. */
  savedAt: number;
  feed: FeedEntry[];
  feedOpen: boolean;
  floats: CashFloat[];
  /** Speed to restore when Space un-pauses. */
  resumeSpeed: Exclude<GameSpeed, 0>;
  /** The door sign's "Close early?" bubble. */
  confirmClose: boolean;
  /** Day of the first sale today (so the "first sale" toast fires once per day). */
  firstSaleDay: number;

  addDeliveries(count: number): void;
  addNewCards(count: number): void;
  seeDeliveries(): void;
  seeNewCards(): void;
  noteSaved(): void;
  log(kind: FeedKind, minute: number, params?: Record<string, string | number>): void;
  clearFeed(): void;
  setFeedOpen(open: boolean): void;
  pushFloat(cents: Cents, reason: CashReason): void;
  setResumeSpeed(speed: Exclude<GameSpeed, 0>): void;
  setConfirmClose(open: boolean): void;
  setFirstSaleDay(day: number): void;
  reset(): void;
}

const initial = {
  deliveriesUnseen: 0,
  newCardsUnseen: 0,
  savedAt: 0,
  feed: [],
  feedOpen: true,
  floats: [],
  resumeSpeed: 1,
  confirmClose: false,
  firstSaleDay: 0,
} satisfies Partial<ShellStore>;

export const useShellStore = create<ShellStore>()((set, get) => ({
  ...initial,
  addDeliveries: (count) => set((s) => ({ deliveriesUnseen: s.deliveriesUnseen + count })),
  addNewCards: (count) => set((s) => ({ newCardsUnseen: s.newCardsUnseen + count })),
  seeDeliveries: () => set({ deliveriesUnseen: 0 }),
  seeNewCards: () => set({ newCardsUnseen: 0 }),
  noteSaved: () => set({ savedAt: performance.now() }),
  log: (kind, minute, params = {}) =>
    set((s) => ({ feed: [{ id: nextId++, kind, minute, params }, ...s.feed].slice(0, MAX_FEED) })),
  clearFeed: () => set({ feed: [] }),
  setFeedOpen: (open) => set({ feedOpen: open }),
  pushFloat(cents, reason) {
    const id = nextId++;
    set((s) => ({ floats: [...s.floats, { id, cents, reason }].slice(-6) }));
    window.setTimeout(() => set({ floats: get().floats.filter((f) => f.id !== id) }), FLOAT_MS);
  },
  setResumeSpeed: (speed) => set({ resumeSpeed: speed }),
  setConfirmClose: (open) => set({ confirmClose: open }),
  setFirstSaleDay: (day) => set({ firstSaleDay: day }),
  reset: () => set(initial),
}));

/** Fire-and-forget signals between shell parts (e.g. the keyboard asking to skip a celebration). */
export const shellSignals = createBus<{ skipCelebration: undefined }>();
