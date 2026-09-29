import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import { presentationBus } from './presentationBus';

const store = () => useGameStore.getState();
const offs: (() => void)[] = [];

beforeEach(() => {
  store().startNewGame({ seed: 42, shopName: 'Test Shop', difficulty: 'standard' });
});

afterEach(() => {
  for (const off of offs.splice(0)) off();
  store().unload();
});

describe('game store bridge', () => {
  it('starts a new game in the Day 1 prep phase', () => {
    const game = store().game;
    expect(game?.meta.shopName).toBe('Test Shop');
    expect(game?.clock).toMatchObject({ day: 1, phase: 'prep' });
  });

  it('publishes events only after the new state is committed', () => {
    const seen: string[] = [];
    offs.push(
      presentationBus.on('clock/phaseChanged', (event) => {
        // A listener must observe the world the event describes (docs/06 §6).
        seen.push(`${event.to}:${store().game?.clock.phase}`);
      }),
    );
    store().dispatch({ type: 'time/openShop' });
    store().dispatch({ type: 'time/closeShop' });
    expect(seen).toEqual(['open:open', 'night:night']);
  });

  it('returns validation errors without changing state', () => {
    const before = store().game;
    const result = store().dispatch({ type: 'time/closeShop' });
    expect(result).toEqual({ ok: false, code: 'WRONG_PHASE', params: { phase: 'prep' } });
    expect(store().game).toBe(before);
  });

  it('only advances the clock while the shop is open', () => {
    store().advance(30, 1000);
    expect(store().game?.clock.minute).toBe(8 * 60);
    expect(store().game?.meta.playTimeMs).toBe(1000);

    store().dispatch({ type: 'time/openShop' });
    store().advance(30, 0);
    expect(store().game?.clock.minute).toBe(9 * 60 + 30);
  });

  it('refuses commands when no game is loaded', () => {
    store().unload();
    expect(store().dispatch({ type: 'time/openShop' })).toEqual({ ok: false, code: 'WRONG_PHASE' });
  });
});
