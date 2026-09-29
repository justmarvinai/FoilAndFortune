import { z } from '@/core/zod';
import type { GameState } from '@/sim/state/types';

/** Save file envelope (docs/07 §6). */
export const SAVE_FORMAT = 'ff-save';

export const saveSlotIds = [
  'slot-1',
  'slot-2',
  'slot-3',
  'auto-1',
  'auto-2',
  'auto-3',
  'auto-weekly',
] as const;
export type SaveSlotId = (typeof saveSlotIds)[number];
export const manualSlots = ['slot-1', 'slot-2', 'slot-3'] as const satisfies readonly SaveSlotId[];
export const autosaveRing = ['auto-1', 'auto-2', 'auto-3'] as const satisfies readonly SaveSlotId[];

export const saveSummarySchema = z.object({
  shopName: z.string(),
  day: z.number().int(),
  level: z.number().int(),
  cashCents: z.number().int(),
  playTimeMs: z.number().nonnegative(),
});
export type SaveSummary = z.infer<typeof saveSummarySchema>;

/**
 * The envelope is validated strictly; the inner state is validated structurally here and then
 * migrated. A full GameState schema would duplicate the TypeScript types for little gain; the
 * structural check plus migrations and fixture tests protect loading.
 */
export const saveFileSchema = z.object({
  format: z.literal(SAVE_FORMAT),
  saveVersion: z.number().int().nonnegative(),
  gameVersion: z.string(),
  savedAt: z.string(),
  slot: z.enum(saveSlotIds),
  summary: saveSummarySchema,
  state: z.record(z.string(), z.unknown()),
});

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  saveVersion: number;
  gameVersion: string;
  savedAt: string;
  slot: SaveSlotId;
  summary: SaveSummary;
  state: GameState;
}

export function summarize(state: GameState): SaveSummary {
  return {
    shopName: state.meta.shopName,
    day: state.clock.day,
    level: state.progression.level,
    cashCents: state.finance.cashCents,
    playTimeMs: state.meta.playTimeMs,
  };
}

export function toSaveFile(state: GameState, slot: SaveSlotId, savedAt: string): SaveFile {
  return {
    format: SAVE_FORMAT,
    saveVersion: state.meta.saveVersion,
    gameVersion: state.meta.gameVersion,
    savedAt,
    slot,
    summary: summarize(state),
    state,
  };
}

/** Minimal structural check that a migrated object looks like a GameState. */
export function looksLikeGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<Record<keyof GameState, unknown>>;
  const clock = state.clock as Partial<GameState['clock']> | undefined;
  const finance = state.finance as Partial<GameState['finance']> | undefined;
  return (
    typeof state.meta === 'object' &&
    typeof state.rng === 'object' &&
    typeof clock?.day === 'number' &&
    typeof clock.phase === 'string' &&
    Number.isSafeInteger(finance?.cashCents) &&
    typeof state.progression === 'object' &&
    typeof state.inventory === 'object'
  );
}
