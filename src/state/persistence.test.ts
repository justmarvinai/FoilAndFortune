import { afterEach, describe, expect, it } from 'vitest';
import { createSaveManager } from '@/save/saveManager';
import { createMemoryStorage } from '@/save/storage';
import { runCommand, runTicks } from '@/sim/engine';
import type { GameState } from '@/sim/state/types';
import { newTestGame, testContext } from '@/sim/testing';
import { installAutosave } from './persistence';
import { publish } from './presentationBus';

const ctx = testContext();
const openMinutes = ctx.balance.time.closeMinute - ctx.balance.time.openMinute;

/** Mirrors the store: commit each step's new state first, then publish its events. */
function playDay(world: { game: GameState | null }, start: GameState): void {
  const opened = runCommand(start, { type: 'time/openShop' }, ctx);
  const closed = runTicks(opened.state, openMinutes, ctx);
  const next = runCommand(closed.state, { type: 'time/startNextDay' }, ctx);
  world.game = next.state;
  publish([...opened.events, ...closed.events, ...next.events]);
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
});

describe('installAutosave', () => {
  it('autosaves every new day and rotates the ring in order', async () => {
    const saves = createSaveManager(createMemoryStorage());
    const world: { game: GameState | null } = { game: newTestGame() };
    let written = 0;
    let stamp = 0;
    uninstall = installAutosave(() => world.game, {
      saves,
      now: () => `2026-09-29T10:00:0${stamp++}.000Z`,
      onSaved: () => {
        written++;
      },
    });

    // Three days back to back, faster than the async writes complete.
    for (let i = 0; i < 3; i++) if (world.game) playDay(world, world.game);
    await expect.poll(() => written).toBe(3);

    const slots = await saves.list();
    const byId = new Map(slots.map((slot) => [slot.slot, slot.summary.day]));
    expect(byId.get('auto-1')).toBe(4);
    expect(byId.get('auto-2')).toBe(3);
    expect(byId.get('auto-3')).toBe(2);
  });

  it('skips days when no game is loaded', async () => {
    const saves = createSaveManager(createMemoryStorage());
    uninstall = installAutosave(() => null, { saves, now: () => '2026-09-29T10:00:00.000Z' });
    playDay({ game: null }, newTestGame());
    await settle();
    expect(await saves.list()).toEqual([]);
  });

  it('stops saving once uninstalled', async () => {
    const saves = createSaveManager(createMemoryStorage());
    const world: { game: GameState | null } = { game: newTestGame() };
    const stop = installAutosave(() => world.game, {
      saves,
      now: () => '2026-09-29T10:00:00.000Z',
    });
    stop();
    playDay(world, newTestGame());
    await settle();
    expect(await saves.list()).toEqual([]);
  });
});
