import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runCommand, runTicks } from '@/sim/engine';
import { type GameState, SAVE_VERSION } from '@/sim/state/types';
import { newTestGame, testContext } from '@/sim/testing';
import { decodeSave, exportSave, SaveImportError } from './exportImport';
import { migrateState, SaveVersionError } from './migrations';
import { toSaveFile } from './saveFile';
import { createSaveManager, SaveLoadError } from './saveManager';
import { defaultSettings, loadSettings } from './settings';
import { createIdbStorage, createMemoryStorage } from './storage';

const ctx = testContext();

function advanceToDay(state: GameState, day: number): GameState {
  let current = state;
  const openMinutes = ctx.balance.time.closeMinute - ctx.balance.time.openMinute;
  while (current.clock.day < day) {
    current = runCommand(current, { type: 'time/openShop' }, ctx).state;
    current = runTicks(current, openMinutes, ctx).state;
    current = runCommand(current, { type: 'time/startNextDay' }, ctx).state;
  }
  return current;
}

describe('save manager', () => {
  it('round-trips a game through IndexedDB', async () => {
    const manager = createSaveManager(createIdbStorage('ff-test-roundtrip'));
    const game = newTestGame();
    await manager.save(game, 'slot-1', '2026-09-29T10:00:00.000Z');
    const loaded = await manager.load('slot-1');
    expect(loaded?.state).toEqual(game);
    expect(loaded?.summary).toMatchObject({ shopName: 'Foil & Fortune', day: 1, level: 1 });
  });

  it('rotates the autosave ring and writes the weekly slot on Mondays', async () => {
    const manager = createSaveManager(createMemoryStorage());
    const day1 = newTestGame(); // Day 1 is a Monday, in prep
    await manager.autosave(day1, '2026-09-29T10:00:01.000Z');
    const day2 = advanceToDay(day1, 2);
    await manager.autosave(day2, '2026-09-29T10:00:02.000Z');
    const day3 = advanceToDay(day2, 3);
    await manager.autosave(day3, '2026-09-29T10:00:03.000Z');
    const day4 = advanceToDay(day3, 4);
    await manager.autosave(day4, '2026-09-29T10:00:04.000Z');

    const slots = Object.fromEntries(
      (await manager.list()).map((info) => [info.slot, info.summary.day]),
    );
    expect(slots).toMatchObject({ 'auto-1': 4, 'auto-2': 3, 'auto-3': 2, 'auto-weekly': 1 });
    expect((await manager.loadLatest())?.summary.day).toBe(4);
  });

  it('falls back to an older slot when the newest one is corrupted', async () => {
    const storage = createMemoryStorage();
    const manager = createSaveManager(storage);
    await manager.save(newTestGame(), 'slot-1', '2026-09-29T10:00:00.000Z');
    await storage.set('save:slot-2', {
      ...toSaveFile(newTestGame(), 'slot-2', '2026-09-29T11:00:00.000Z'),
      state: { broken: true },
    });
    await expect(manager.load('slot-2')).rejects.toBeInstanceOf(SaveLoadError);
    expect((await manager.loadLatest())?.slot).toBe('slot-1');
  });

  it('loads the committed v1 fixture save (guards future migrations)', () => {
    const manager = createSaveManager(createMemoryStorage());
    const raw = JSON.parse(
      readFileSync(new URL('../../tests/fixtures/saves/v1-new-game.json', import.meta.url), 'utf8'),
    ) as unknown;
    const file = manager.parse(raw);
    expect(file.state.clock.day).toBe(1);
    // Migrated to the current format, with every v2 slice present.
    expect(file.state.meta.saveVersion).toBe(SAVE_VERSION);
    expect(file.state.shop.fixtures.map((f) => f.uid)).toContain('register');
    expect(file.state.customers).toEqual({
      active: [],
      lane: [],
      nextUid: 1,
      nextArrivalMinute: null,
    });
    expect(file.state.reputation.signals.prices).toEqual({ sum: 0, weight: 0, count: 0 });
    expect(file.state.inventory.cardStacks).toEqual({});
  });
});

describe('v2 fixture', () => {
  it('loads the committed v2 Day-2 save (guards future migrations)', () => {
    const manager = createSaveManager(createMemoryStorage());
    const raw = JSON.parse(
      readFileSync(new URL('../../tests/fixtures/saves/v2-day-two.json', import.meta.url), 'utf8'),
    ) as unknown;
    const file = manager.parse(raw);
    const { state } = file;
    expect(state.meta.saveVersion).toBe(SAVE_VERSION);
    expect(state.clock).toMatchObject({ day: 2, phase: 'prep' });
    // A lived-in Day 1: sales, XP, a delivered order, a ripped pack and a binder pocket.
    expect(state.stats.salesCount).toBeGreaterThan(0);
    expect(state.progression.level).toBeGreaterThanOrEqual(2);
    expect(state.suppliers.orders.some((order) => order.status === 'delivered')).toBe(true);
    expect(state.stats.packsOpened).toBe(1);
    expect(Object.keys(state.collection.binder)).toHaveLength(1);
    expect(state.customers.active).toEqual([]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('export / import', () => {
  it('round-trips through the .ffsave text format', () => {
    const manager = createSaveManager(createMemoryStorage());
    const file = toSaveFile(newTestGame(), 'slot-1', '2026-09-29T10:00:00.000Z');
    const text = exportSave(file);
    expect(text.startsWith('FOIL-AND-FORTUNE-SAVE 1\n')).toBe(true);
    expect(manager.parse(decodeSave(text))).toEqual(file);
  });

  it('rejects foreign, damaged and oversized input', () => {
    expect(() => decodeSave('hello world')).toThrow(SaveImportError);
    expect(() => decodeSave('FOIL-AND-FORTUNE-SAVE 1\n!!!not-base64!!!')).toThrow(SaveImportError);
    expect(() => decodeSave(`FOIL-AND-FORTUNE-SAVE 1\n${'A'.repeat(9 * 1024 * 1024)}`)).toThrow(
      SaveImportError,
    );
    const manager = createSaveManager(createMemoryStorage());
    expect(() => manager.parse({ format: 'something-else' })).toThrow(SaveLoadError);
  });
});

describe('migrations', () => {
  it('applies migrations in order and stamps the version', () => {
    const registry = {
      1: (s: Record<string, unknown>) => ({ ...s, addedInV2: true }),
      2: (s: Record<string, unknown>) => ({ ...s, addedInV3: 'yes' }),
    };
    const migrated = migrateState({ meta: { saveVersion: 1 } }, 1, 3, registry);
    expect(migrated).toMatchObject({ addedInV2: true, addedInV3: 'yes', meta: { saveVersion: 3 } });
  });

  it('refuses saves from a newer game and gaps in the migration chain', () => {
    expect(() => migrateState({}, 5, 1)).toThrow(SaveVersionError);
    expect(() => migrateState({}, 1, 3, { 1: (s) => s })).toThrow(SaveVersionError);
  });
});

describe('settings', () => {
  it('fills defaults for missing or invalid fields', () => {
    const fake = {
      getItem: () => JSON.stringify({ quality: 'ultra', textScale: 1.2, volume: { music: 3 } }),
    };
    const settings = loadSettings(fake);
    expect(settings.quality).toBe('auto');
    expect(settings.textScale).toBe(1.2);
    expect(settings.volume.music).toBe(0.6);
    expect(loadSettings({ getItem: () => '{not json' })).toEqual(defaultSettings());
  });
});
