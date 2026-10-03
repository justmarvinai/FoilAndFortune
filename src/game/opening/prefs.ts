import { create } from 'zustand';
import type { OpeningPrefs } from './model';

/**
 * "Auto-reveal commons" and "Skip commons" are remembered per browser (docs/05 §5.7). They're a
 * viewing preference, not game state, so they live in localStorage behind try/catch (private
 * windows and blocked storage just forget them).
 */

export const DEFAULT_PREFS: OpeningPrefs = { autoReveal: false, skipCommons: false };

const STORAGE_KEY = 'ff.opening';

/** Parses a stored blob; anything unreadable falls back field by field to the defaults. */
export function parsePrefs(raw: string | null | undefined): OpeningPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return { ...DEFAULT_PREFS };
    const record = value as Record<string, unknown>;
    return {
      autoReveal:
        typeof record.autoReveal === 'boolean' ? record.autoReveal : DEFAULT_PREFS.autoReveal,
      skipCommons:
        typeof record.skipCommons === 'boolean' ? record.skipCommons : DEFAULT_PREFS.skipCommons,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function load(): OpeningPrefs {
  try {
    return parsePrefs(globalThis.localStorage?.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function save(prefs: OpeningPrefs): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the toggles still work for this session.
  }
}

interface PrefsStore {
  prefs: OpeningPrefs;
  update(patch: Partial<OpeningPrefs>): void;
}

export const useOpeningPrefs = create<PrefsStore>()((set, get) => ({
  prefs: load(),
  update(patch) {
    const prefs = { ...get().prefs, ...patch };
    set({ prefs });
    save(prefs);
  },
}));
