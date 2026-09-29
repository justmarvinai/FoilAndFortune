import type { BalanceConfig } from '@/content/balance';
import type { ContentRegistry } from '@/content/registry';
import { createRng, type Rng } from '@/core/rng';
import type { DomainEvent } from './events';
import type { GameState, RngStream } from './state/types';

/** Everything a sim function needs besides the state itself. Injected, so tests can swap it. */
export interface SimContext {
  content: ContentRegistry;
  balance: BalanceConfig;
  emit(event: DomainEvent): void;
}

/** RNG bound to a stream inside the (draft) state; drawing advances the persisted state. */
export function rngFor(state: GameState, stream: RngStream): Rng {
  return createRng(state.rng[stream]);
}
