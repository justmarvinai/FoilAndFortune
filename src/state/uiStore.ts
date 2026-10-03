import { create } from 'zustand';
import type { DomainEventOf } from '@/sim/events';

/**
 * Transient UI state for the play screen (docs/05 §2 layers, docs/06 §6). Never persisted and
 * never read by the sim. Feature-specific UI state lives in the feature's own store; this one
 * only holds what several features coordinate on.
 */

/** Sheets (layer 2): only one at a time (docs/05 §2). */
export type SheetId = 'inventory' | 'prices' | 'crate' | 'binder' | 'settings';

/** Full-screen modes. Phase 2 has the pack-opening stage (docs/05 §5.7). */
export type StageState = { kind: 'opening'; opened: DomainEventOf<'product/opened'> };

/** Celebrations (layer 4), queued and shown one at a time. */
export type Celebration = {
  kind: 'levelUp';
  level: number;
  unlockIds: string[];
  perkIds: string[];
};

export interface UiStore {
  sheet: SheetId | null;
  /** Target of the Fixture Popover (docs/05 §5.3). */
  fixtureUid: string | null;
  stage: StageState | null;
  celebrations: Celebration[];
  /** The Day Summary receipt (docs/05 §5.17), shown at night until dismissed. */
  summaryOpen: boolean;

  openSheet(id: SheetId): void;
  toggleSheet(id: SheetId): void;
  closeSheet(): void;
  openFixture(uid: string): void;
  closeFixture(): void;
  openStage(stage: StageState): void;
  closeStage(): void;
  pushCelebration(celebration: Celebration): void;
  /** Dismisses the celebration on screen. */
  shiftCelebration(): void;
  setSummaryOpen(open: boolean): void;
  /** Esc or the back gesture: closes the top layer. Returns false when nothing was open. */
  back(): boolean;
  reset(): void;
}

const initial = {
  sheet: null,
  fixtureUid: null,
  stage: null,
  celebrations: [],
  summaryOpen: false,
} satisfies Partial<UiStore>;

export const useUiStore = create<UiStore>()((set, get) => ({
  ...initial,

  // A sheet and the popover never share the screen: opening one closes the other.
  openSheet: (id) => set({ sheet: id, fixtureUid: null }),
  toggleSheet: (id) => set((ui) => ({ sheet: ui.sheet === id ? null : id, fixtureUid: null })),
  closeSheet: () => set({ sheet: null }),
  openFixture: (uid) => set({ fixtureUid: uid, sheet: null }),
  closeFixture: () => set({ fixtureUid: null }),
  openStage: (stage) => set({ stage, fixtureUid: null }),
  closeStage: () => set({ stage: null }),
  pushCelebration: (celebration) =>
    set((ui) => ({ celebrations: [...ui.celebrations, celebration] })),
  shiftCelebration: () => set((ui) => ({ celebrations: ui.celebrations.slice(1) })),
  setSummaryOpen: (open) => set({ summaryOpen: open }),

  back() {
    const ui = get();
    // Top layer first: stage → celebration → summary → popover → sheet (docs/05 §2). Celebrations
    // wait behind the pack-opening stage (CelebrationHost), so the stage is on top while it's up.
    if (ui.stage) ui.closeStage();
    else if (ui.celebrations.length > 0) ui.shiftCelebration();
    else if (ui.summaryOpen) ui.setSummaryOpen(false);
    else if (ui.fixtureUid) ui.closeFixture();
    else if (ui.sheet) ui.closeSheet();
    else return false;
    return true;
  },

  reset: () => set(initial),
}));

/**
 * Interaction pause (docs/05 §1.7, §10): full-screen moments always stop the clock; sheets and the
 * Fixture Popover do too while the "pause on interaction" setting is on (the default).
 */
export function isInteractionPaused(
  ui: Pick<UiStore, 'sheet' | 'fixtureUid' | 'stage' | 'celebrations' | 'summaryOpen'>,
  pauseOnInteraction: boolean,
): boolean {
  if (ui.stage || ui.celebrations.length > 0 || ui.summaryOpen) return true;
  return pauseOnInteraction && (ui.sheet !== null || ui.fixtureUid !== null);
}
