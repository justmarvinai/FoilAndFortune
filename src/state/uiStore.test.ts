import { beforeEach, describe, expect, it } from 'vitest';
import type { DomainEventOf } from '@/sim/events';
import { isInteractionPaused, useUiStore } from './uiStore';

const opened: DomainEventOf<'product/opened'> = {
  type: 'product/opened',
  productId: 'gk.emberdawn.booster',
  packs: [],
  newCardIds: [],
};

const ui = () => useUiStore.getState();

describe('uiStore', () => {
  beforeEach(() => ui().reset());

  it('shows one sheet at a time and never alongside the popover', () => {
    ui().openFixture('shelf-a');
    ui().openSheet('inventory');
    expect(ui()).toMatchObject({ sheet: 'inventory', fixtureUid: null });
    ui().toggleSheet('crate');
    expect(ui().sheet).toBe('crate');
    ui().toggleSheet('crate');
    expect(ui().sheet).toBeNull();
    ui().openSheet('prices');
    ui().openFixture('register');
    expect(ui()).toMatchObject({ sheet: null, fixtureUid: 'register' });
  });

  it('closes the top layer first on back (docs/05 §2)', () => {
    ui().openSheet('binder');
    ui().setSummaryOpen(true);
    ui().openStage({ kind: 'opening', opened });
    ui().pushCelebration({ kind: 'levelUp', level: 2, unlockIds: [], perkIds: [] });
    const layers = [];
    while (ui().back()) {
      const { celebrations, stage, summaryOpen, sheet } = ui();
      layers.push({ celebrations: celebrations.length, stage: !!stage, summaryOpen, sheet });
    }
    expect(layers).toEqual([
      { celebrations: 1, stage: false, summaryOpen: true, sheet: 'binder' },
      { celebrations: 0, stage: false, summaryOpen: true, sheet: 'binder' },
      { celebrations: 0, stage: false, summaryOpen: false, sheet: 'binder' },
      { celebrations: 0, stage: false, summaryOpen: false, sheet: null },
    ]);
    expect(ui().back()).toBe(false);
  });

  it('queues celebrations', () => {
    ui().pushCelebration({ kind: 'levelUp', level: 2, unlockIds: ['a'], perkIds: [] });
    ui().pushCelebration({ kind: 'levelUp', level: 3, unlockIds: [], perkIds: ['p'] });
    expect(ui().celebrations.map((c) => c.level)).toEqual([2, 3]);
    ui().shiftCelebration();
    expect(ui().celebrations.map((c) => c.level)).toEqual([3]);
  });
});

describe('isInteractionPaused (docs/05 §1.7)', () => {
  const idle = { sheet: null, fixtureUid: null, stage: null, celebrations: [], summaryOpen: false };

  it('always pauses for full-screen moments', () => {
    expect(isInteractionPaused({ ...idle, stage: { kind: 'opening', opened } }, false)).toBe(true);
    expect(isInteractionPaused({ ...idle, summaryOpen: true }, false)).toBe(true);
    expect(
      isInteractionPaused(
        { ...idle, celebrations: [{ kind: 'levelUp', level: 2, unlockIds: [], perkIds: [] }] },
        false,
      ),
    ).toBe(true);
  });

  it('pauses for sheets and popovers only while the setting is on', () => {
    expect(isInteractionPaused({ ...idle, sheet: 'crate' }, true)).toBe(true);
    expect(isInteractionPaused({ ...idle, fixtureUid: 'shelf-a' }, true)).toBe(true);
    expect(isInteractionPaused({ ...idle, sheet: 'crate' }, false)).toBe(false);
    expect(isInteractionPaused(idle, true)).toBe(false);
  });
});
