import { describe, expect, it } from 'vitest';
import type { SlotInfo } from '@/save/saveManager';
import { groupSlots, isSaveSlotId, latestSlot, playTimeParts, relativeAgo } from './saveSlots';

const info = (slot: SlotInfo['slot'], savedAt: string, day = 1): SlotInfo => ({
  slot,
  savedAt,
  summary: { shopName: 'Nook', day, level: 1, cashCents: 60_000, playTimeMs: 0 },
});

describe('save slot helpers', () => {
  it('finds the latest save for Continue', () => {
    const infos = [
      info('auto-2', '2026-09-29T10:00:00.000Z', 2),
      info('slot-1', '2026-09-30T09:00:00.000Z', 5),
      info('auto-1', '2026-09-30T08:00:00.000Z', 3),
    ];
    expect(latestSlot(infos)?.slot).toBe('slot-1');
    expect(latestSlot([])).toBeNull();
  });

  it('groups manual slots in order and autosaves newest first', () => {
    const grouped = groupSlots([
      info('auto-weekly', '2026-09-28T10:00:00.000Z'),
      info('slot-2', '2026-09-29T10:00:00.000Z'),
      info('auto-1', '2026-09-30T10:00:00.000Z'),
      info('auto-2', '2026-09-29T11:00:00.000Z'),
    ]);
    expect(grouped.manual.map((entry) => [entry.slot, entry.info?.slot ?? null])).toEqual([
      ['slot-1', null],
      ['slot-2', 'slot-2'],
      ['slot-3', null],
    ]);
    expect(grouped.auto.map((entry) => entry.slot)).toEqual(['auto-1', 'auto-2', 'auto-weekly']);
  });

  it('describes save age in words', () => {
    const now = Date.parse('2026-09-30T12:00:00.000Z');
    expect(relativeAgo('2026-09-30T11:59:40.000Z', now)).toBe('now');
    expect(relativeAgo('2026-09-30T11:55:00.000Z', now)).toBe('5 minutes ago');
    expect(relativeAgo('2026-09-30T09:00:00.000Z', now)).toBe('3 hours ago');
    expect(relativeAgo('2026-09-29T12:00:00.000Z', now)).toBe('yesterday');
    expect(relativeAgo('not a date', now)).toBe('');
  });

  it('splits play time into hours and minutes', () => {
    expect(playTimeParts(0)).toEqual({ hours: 0, minutes: 0 });
    expect(playTimeParts(59_999)).toEqual({ hours: 0, minutes: 0 });
    expect(playTimeParts(2 * 3_600_000 + 5 * 60_000 + 30_000)).toEqual({ hours: 2, minutes: 5 });
    expect(playTimeParts(-5)).toEqual({ hours: 0, minutes: 0 });
  });

  it('validates slot ids from the URL', () => {
    expect(isSaveSlotId('slot-3')).toBe(true);
    expect(isSaveSlotId('auto-weekly')).toBe(true);
    expect(isSaveSlotId('slot-9')).toBe(false);
    expect(isSaveSlotId(null)).toBe(false);
  });
});
