import { createBus } from '@/core/bus';
import type { DomainEvent, DomainEventOf } from '@/sim/events';

/**
 * Domain events leave the sim through this bus AFTER the store has committed the new state, so
 * listeners (sounds, VFX, toasts, autosave) always observe a consistent world (docs/06 §6).
 */
export type PresentationEvents = { [K in DomainEvent['type']]: DomainEventOf<K> };

export const presentationBus = createBus<PresentationEvents>();

export function publish(events: readonly DomainEvent[]): void {
  for (const event of events) {
    // The union member always matches its own `type` key; TS can't correlate that on its own.
    presentationBus.emit(event.type, event as never);
  }
}
