import { createSaveManager, type SaveManager } from '@/save/saveManager';
import { createIdbStorage, requestPersistentStorage } from '@/save/storage';
import type { GameState } from '@/sim/state/types';
import { presentationBus } from './presentationBus';

let manager: SaveManager | undefined;

/** The app-wide save manager backed by IndexedDB. */
export function getSaveManager(): SaveManager {
  if (!manager) {
    manager = createSaveManager(createIdbStorage());
    void requestPersistentStorage();
  }
  return manager;
}

export interface AutosaveOptions {
  saves?: SaveManager;
  /** ISO timestamp source (injectable for tests). */
  now?: () => string;
  /** Called after each autosave is written, e.g. to refresh a slot list. */
  onSaved?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * Autosaves at the start of every day's prep phase, plus the weekly slot on Mondays
 * (docs/06 §11). Saves run one at a time so a fast-forward can't interleave two ring
 * rotations. Returns an unsubscribe function.
 */
export function installAutosave(
  getGame: () => GameState | null,
  options: AutosaveOptions = {},
): () => void {
  const {
    saves = getSaveManager(),
    now = () => new Date().toISOString(),
    onSaved,
    onError = (error: unknown) => console.error('Autosave failed', error),
  } = options;
  let chain: Promise<void> = Promise.resolve();

  return presentationBus.on('clock/dayStarted', () => {
    const game = getGame();
    if (!game) return;
    const savedAt = now();
    chain = chain.then(() => saves.autosave(game, savedAt).then(onSaved, onError));
  });
}
