import { afterEach, describe, expect, it } from 'vitest';
import { dollars } from '@/core/money';
import { useGameStore } from '@/state/gameStore';
import { presentationBus } from '@/state/presentationBus';
import { grantCash, playDays, skipMinutes, skipToClose } from './cheats';

const store = () => useGameStore.getState();

afterEach(() => store().unload());

describe('sandbox cheats', () => {
  it('play a full week through the real pipelines: rent on Sunday, next Monday prep', () => {
    store().startNewGame({ seed: 7, shopName: 'Cheat Shop', difficulty: 'standard' });
    const rents: number[] = [];
    const off = presentationBus.on('rent/charged', (event) => rents.push(event.cents));

    playDays(7);
    off();

    const game = store().game;
    expect(game?.clock).toMatchObject({ day: 8, phase: 'prep' });
    expect(rents).toEqual([dollars(245)]);
    expect(game?.finance.cashCents).toBe(dollars(600 - 245));
    expect(game?.stats.daysOpened).toBe(7);
  });

  it('skips never run past closing time and only work while open', () => {
    store().startNewGame({ seed: 7, shopName: 'Cheat Shop', difficulty: 'cozy' });
    skipMinutes(60);
    expect(store().game?.clock).toMatchObject({ phase: 'prep', minute: 8 * 60 });

    store().dispatch({ type: 'time/openShop' });
    skipMinutes(60);
    expect(store().game?.clock.minute).toBe(10 * 60);
    skipToClose();
    expect(store().game?.clock).toMatchObject({ phase: 'night', minute: 19 * 60 });
  });

  it('grants go through the ledger', () => {
    store().startNewGame({ seed: 7, shopName: 'Cheat Shop', difficulty: 'cozy' });
    grantCash(dollars(-50));
    expect(store().game?.finance.cashCents).toBe(dollars(950));
    expect(store().game?.finance.ledger.at(-1)).toMatchObject({
      kind: 'debug',
      cents: dollars(-50),
    });
  });
});
