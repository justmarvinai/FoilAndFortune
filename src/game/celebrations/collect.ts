import type { DomainEvent } from '@/sim/events';
import { presentationBus } from '@/state/presentationBus';
import type { Celebration } from '@/state/uiStore';

/**
 * Level-up celebrations (docs/05 §6): each `level/up` collects the `unlock/granted` events that
 * follow it in the same dispatch or tick. Unbuilt features grant a placeholder perk instead
 * (docs/02 §9.3), so those unlocks are shown as their perk.
 */
export function levelUpsFrom(events: readonly DomainEvent[]): Celebration[] {
  const out: Celebration[] = [];
  let current: Celebration | null = null;
  for (const event of events) {
    if (event.type === 'level/up') {
      current = { kind: 'levelUp', level: event.level, unlockIds: [], perkIds: [] };
      out.push(current);
    } else if (event.type === 'unlock/granted' && current) {
      if (event.perkId) current.perkIds.push(event.perkId);
      else current.unlockIds.push(event.unlockId);
    }
  }
  return out;
}

/**
 * Listens to the presentation bus and hands finished celebrations to `push`. The store publishes
 * a dispatch's (or a frame's ticks') events synchronously in one go, so a microtask later the
 * batch is complete. Unlocks granted without a level-up (save backfills at dawn) are ignored.
 */
export function installLevelUpCollector(push: (celebration: Celebration) => void): () => void {
  let buffer: DomainEvent[] = [];
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const batch = buffer;
    buffer = [];
    for (const celebration of levelUpsFrom(batch)) push(celebration);
  };
  const collect = (event: DomainEvent) => {
    buffer.push(event);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  };
  const offs = [
    presentationBus.on('level/up', collect),
    presentationBus.on('unlock/granted', collect),
  ];
  return () => {
    for (const off of offs) off();
    buffer = [];
  };
}
