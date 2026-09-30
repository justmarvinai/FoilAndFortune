import { dollars } from '@/core/money';
import type { FixtureDef } from '../schema/shop';

/**
 * Fixture catalog (docs/02 §4.2). Phase 2 ships the Tier-1 starting set; Build Mode (Phase 3)
 * adds the rest of the catalog.
 */
export const smallWallShelf: FixtureDef = {
  id: 'fx.shelf.wall-small',
  name: 'Small Wall Shelf',
  category: 'shelf',
  footprint: { w: 2, d: 1 },
  wallMounted: true,
  blocksFloor: true,
  slots: {
    count: 4,
    accepts: {
      kind: 'sealed',
      productKinds: [
        'booster',
        'blister',
        'tin',
        'starterDeck',
        'bundle',
        'collection',
        'eliteBox',
        'posterCollection',
        'mysteryBox',
      ],
    },
  },
  appeal: 1,
  costCents: dollars(150),
  unlockLevel: 1,
};

export const smallDisplayCase: FixtureDef = {
  id: 'fx.case.small',
  name: 'Small Display Case',
  category: 'case',
  footprint: { w: 2, d: 1 },
  wallMounted: false,
  blocksFloor: true,
  slots: { count: 6, accepts: { kind: 'singles' } },
  appeal: 2,
  costCents: dollars(300),
  unlockLevel: 2,
};

export const registerCounter: FixtureDef = {
  id: 'fx.register.counter',
  name: 'Register Counter',
  category: 'register',
  footprint: { w: 2, d: 1 },
  wallMounted: false,
  blocksFloor: true,
  slots: { count: 0, accepts: { kind: 'none' } },
  appeal: 1,
  costCents: dollars(800),
  unlockLevel: 1,
};

export const pottedPlant: FixtureDef = {
  id: 'fx.decor.plant',
  name: 'Potted Plant',
  category: 'decor',
  footprint: { w: 1, d: 1 },
  wallMounted: false,
  blocksFloor: true,
  slots: { count: 0, accepts: { kind: 'none' } },
  appeal: 0.5,
  costCents: dollars(25),
  unlockLevel: 1,
};

export const originsPoster: FixtureDef = {
  id: 'fx.decor.poster-origins',
  name: '"Origins" Poster',
  category: 'decor',
  footprint: { w: 1, d: 1 },
  wallMounted: true,
  blocksFloor: false,
  slots: { count: 0, accepts: { kind: 'none' } },
  appeal: 0.5,
  costCents: dollars(40),
  unlockLevel: 1,
};

export const fixtureCatalog: readonly FixtureDef[] = [
  smallWallShelf,
  smallDisplayCase,
  registerCounter,
  pottedPlant,
  originsPoster,
];
