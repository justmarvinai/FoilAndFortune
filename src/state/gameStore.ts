import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { defaultBalance } from '@/content/balance';
import { getRegistry } from '@/content/registry';
import { type Command, type CommandResult, ok } from '@/sim/commands';
import type { SimContext } from '@/sim/context';
import { addPlayTime, dispatch as simDispatch, tick } from '@/sim/engine';
import type { DomainEvent } from '@/sim/events';
import { createNewGame, type NewGameOptions } from '@/sim/state/createNewGame';
import type { GameState } from '@/sim/state/types';
import { publish } from './presentationBus';

/**
 * Bridge between React and the pure simulation (docs/06 §6). `game` is the persisted
 * GameState; UI-only state lives in separate stores and is never saved.
 */
export interface GameStore {
  game: GameState | null;
  startNewGame(options: Omit<NewGameOptions, 'createdAt' | 'gameVersion'>): void;
  loadGame(state: GameState): void;
  /** The single way the UI changes the game (CLAUDE.md rule 2). */
  dispatch(command: Command): CommandResult;
  /** Called by the GameLoop: simulate `ticks` game-minutes and account `realMs` of play time. */
  advance(ticks: number, realMs: number): void;
  unload(): void;
}

const pureContext = () => ({ content: getRegistry(), balance: defaultBalance });

export const useGameStore = create<GameStore>()(
  immer((set, get) => {
    /** Runs `mutate` inside one Immer transaction, then publishes the collected events. */
    const transact = (mutate: (game: GameState, ctx: SimContext) => void) => {
      const events: DomainEvent[] = [];
      const ctx: SimContext = { ...pureContext(), emit: (event) => events.push(event) };
      set((draft) => {
        if (draft.game) mutate(draft.game, ctx);
      });
      if (events.length > 0) publish(events);
    };

    return {
      game: null,

      startNewGame(options) {
        const game = createNewGame(
          { ...options, createdAt: new Date().toISOString(), gameVersion: __APP_VERSION__ },
          pureContext(),
        );
        set({ game });
      },

      loadGame(state) {
        set({ game: state });
      },

      dispatch(command) {
        if (!get().game) return { ok: false, code: 'WRONG_PHASE' };
        let result: CommandResult = ok;
        transact((game, ctx) => {
          result = simDispatch(game, command, ctx);
        });
        return result;
      },

      advance(ticks, realMs) {
        if (!get().game) return;
        transact((game, ctx) => {
          addPlayTime(game, realMs);
          for (let i = 0; i < ticks; i++) tick(game, ctx);
        });
      },

      unload() {
        set({ game: null });
      },
    };
  }),
);

/** Selects from the current game; returns `fallback` when no game is loaded. */
export function useGame<T>(selector: (game: GameState) => T, fallback: T): T {
  return useGameStore((store) => (store.game ? selector(store.game) : fallback));
}
