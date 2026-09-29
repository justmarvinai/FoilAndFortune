import { weekdayOf } from '@/core/calendar';
import type { GameState } from '@/sim/state/types';
import { migrateState } from './migrations';
import {
  autosaveRing,
  looksLikeGameState,
  type SaveFile,
  type SaveSlotId,
  type SaveSummary,
  saveFileSchema,
  saveSlotIds,
  toSaveFile,
} from './saveFile';
import type { SaveStorage } from './storage';

export class SaveLoadError extends Error {
  override name = 'SaveLoadError';
}

export interface SlotInfo {
  slot: SaveSlotId;
  savedAt: string;
  summary: SaveSummary;
}

/**
 * Save slots (docs/06 §11): 3 manual slots, a ring of 3 autosaves (every prep start) and a
 * weekly autosave (every Monday) that Tycoon bankruptcy reloads.
 */
export function createSaveManager(storage: SaveStorage) {
  const keyOf = (slot: SaveSlotId) => `save:${slot}`;

  /** Parses, validates and migrates a raw stored/imported object into a SaveFile. */
  function parse(raw: unknown): SaveFile {
    const envelope = saveFileSchema.safeParse(raw);
    if (!envelope.success)
      throw new SaveLoadError('This save file is damaged or not a Foil & Fortune save.');
    const migrated = migrateState(envelope.data.state, envelope.data.saveVersion);
    if (!looksLikeGameState(migrated))
      throw new SaveLoadError('This save is missing required game data.');
    return { ...envelope.data, state: migrated } as SaveFile;
  }

  async function save(state: GameState, slot: SaveSlotId, savedAt: string): Promise<SaveFile> {
    const file = toSaveFile(state, slot, savedAt);
    await storage.set(keyOf(slot), file);
    return file;
  }

  async function load(slot: SaveSlotId): Promise<SaveFile | undefined> {
    const raw = await storage.get(keyOf(slot));
    return raw === undefined ? undefined : parse(raw);
  }

  /** Rotates auto-1 → auto-2 → auto-3, then writes the new autosave to auto-1. */
  async function autosave(state: GameState, savedAt: string): Promise<void> {
    for (let i = autosaveRing.length - 1; i > 0; i--) {
      const from = autosaveRing[i - 1];
      const to = autosaveRing[i];
      if (!from || !to) continue;
      const raw = await storage.get(keyOf(from));
      if (raw !== undefined) await storage.set(keyOf(to), { ...(raw as object), slot: to });
    }
    await save(state, 'auto-1', savedAt);
    if (weekdayOf(state.clock.day) === 'mon' && state.clock.phase === 'prep') {
      await save(state, 'auto-weekly', savedAt);
    }
  }

  async function list(): Promise<SlotInfo[]> {
    const infos: SlotInfo[] = [];
    for (const slot of saveSlotIds) {
      const raw = await storage.get(keyOf(slot));
      const envelope = saveFileSchema.safeParse(raw);
      if (envelope.success) {
        infos.push({ slot, savedAt: envelope.data.savedAt, summary: envelope.data.summary });
      }
    }
    return infos;
  }

  /** Most recently saved slot (for "Continue"). If the newest is damaged, falls back to older ones. */
  async function loadLatest(): Promise<SaveFile | undefined> {
    const infos = (await list()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    for (const info of infos) {
      try {
        const file = await load(info.slot);
        if (file) return file;
      } catch {
        // Corrupted slot: try the next newest one instead of crashing (docs/06 §11).
      }
    }
    return undefined;
  }

  return {
    parse,
    save,
    load,
    autosave,
    list,
    loadLatest,
    remove: (slot: SaveSlotId) => storage.del(keyOf(slot)),
  };
}

export type SaveManager = ReturnType<typeof createSaveManager>;
