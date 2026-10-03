import { autosaveRing, manualSlots, type SaveSlotId } from '@/save/saveFile';
import type { SlotInfo } from '@/save/saveManager';

/**
 * Save-slot helpers for the title screen's Continue card and Load panel (docs/05 §5.1, §5.19).
 * Pure: they only read slot metadata (`SaveFile.summary`), never the game state.
 */

/** The most recently written save (what "Continue" loads). */
export function latestSlot(infos: readonly SlotInfo[]): SlotInfo | null {
  let latest: SlotInfo | null = null;
  for (const info of infos) if (!latest || info.savedAt > latest.savedAt) latest = info;
  return latest;
}

/** Manual slots in order (empty ones as `null`), then the autosaves that exist, newest first. */
export function groupSlots(infos: readonly SlotInfo[]): {
  manual: { slot: SaveSlotId; info: SlotInfo | null }[];
  auto: SlotInfo[];
} {
  const bySlot = new Map(infos.map((info) => [info.slot, info]));
  const autoIds: readonly SaveSlotId[] = [...autosaveRing, 'auto-weekly'];
  return {
    manual: manualSlots.map((slot) => ({ slot, info: bySlot.get(slot) ?? null })),
    auto: autoIds
      .map((slot) => bySlot.get(slot))
      .filter((info): info is SlotInfo => info !== undefined)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
  };
}

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
];

/** "5 minutes ago", "yesterday"… in the player's language (Intl does the wording). */
export function relativeAgo(savedAtIso: string, nowMs: number, locale = 'en'): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const seconds = Math.round((Date.parse(savedAtIso) - nowMs) / 1000);
  if (!Number.isFinite(seconds)) return '';
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'second');
}

/** Real play time split for "2h 05m played". */
export function playTimeParts(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

export function isSaveSlotId(value: string | null): value is SaveSlotId {
  return (
    value !== null &&
    ([...manualSlots, ...autosaveRing, 'auto-weekly'] as readonly string[]).includes(value)
  );
}
