import { afterEach, describe, expect, it } from 'vitest';
import { perkCatalog, unlockCatalog } from '@/content/progression/unlocks';
import shell from '@/i18n/locales/en/shell.json';
import type { DomainEvent } from '@/sim/events';
import { publish } from '@/state/presentationBus';
import type { Celebration } from '@/state/uiStore';
import { installLevelUpCollector, levelUpsFrom } from './collect';
import { perkVisual, rewardCards, unlockVisual } from './unlockInfo';

function lookup(path: string): unknown {
  let node: unknown = shell;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe('levelUpsFrom', () => {
  it('attaches the unlocks that follow each level-up, perks for unbuilt features', () => {
    const events: DomainEvent[] = [
      { type: 'xp/gained', amount: 900, source: 'debug' },
      { type: 'level/up', level: 2 },
      { type: 'unlock/granted', unlockId: 'unlock.feature.singles-case' },
      { type: 'level/up', level: 3 },
      { type: 'unlock/granted', unlockId: 'unlock.fixture.gondola', perkId: 'perk.storage-10' },
      { type: 'unlock/granted', unlockId: 'unlock.app.foiltrack', perkId: 'perk.supplier-2' },
    ];
    expect(levelUpsFrom(events)).toEqual([
      { kind: 'levelUp', level: 2, unlockIds: ['unlock.feature.singles-case'], perkIds: [] },
      {
        kind: 'levelUp',
        level: 3,
        unlockIds: [],
        perkIds: ['perk.storage-10', 'perk.supplier-2'],
      },
    ]);
  });

  it('ignores unlocks granted without a level-up (dawn backfill)', () => {
    expect(levelUpsFrom([{ type: 'unlock/granted', unlockId: 'unlock.feature.binder' }])).toEqual(
      [],
    );
  });
});

describe('installLevelUpCollector', () => {
  let stop: (() => void) | undefined;
  afterEach(() => stop?.());

  it('batches one publish into one celebration per level', async () => {
    const seen: Celebration[] = [];
    stop = installLevelUpCollector((celebration) => seen.push(celebration));
    publish([
      { type: 'level/up', level: 2 },
      { type: 'unlock/granted', unlockId: 'unlock.feature.singles-case' },
    ]);
    expect(seen).toEqual([]); // flushed a microtask later, once the batch is complete
    await Promise.resolve();
    expect(seen).toEqual([
      { kind: 'levelUp', level: 2, unlockIds: ['unlock.feature.singles-case'], perkIds: [] },
    ]);
  });
});

describe('unlock and perk cards', () => {
  it('every unlock and perk in the catalog has a name, a blurb and its own icon', () => {
    for (const unlock of unlockCatalog) {
      expect(lookup(`${unlock.id}.name`), unlock.id).toEqual(expect.any(String));
      expect(lookup(`${unlock.id}.blurb`), unlock.id).toEqual(expect.any(String));
      expect(unlockVisual(unlock.id).icon, unlock.id).not.toBe('sparkle');
    }
    for (const perk of perkCatalog) {
      expect(lookup(`${perk.id}.name`), perk.id).toEqual(expect.any(String));
      expect(lookup(`${perk.id}.blurb`), perk.id).toEqual(expect.any(String));
      expect(perkVisual(perk.id).icon, perk.id).not.toBe('sparkle');
    }
  });

  it('falls back gracefully for unknown ids and orders unlocks before perks', () => {
    expect(unlockVisual('unlock.future.thing')).toMatchObject({ icon: 'sparkle', dock: null });
    expect(rewardCards(['unlock.feature.binder'], ['perk.storage-10']).map((c) => c.kind)).toEqual([
      'unlock',
      'perk',
    ]);
  });
});
