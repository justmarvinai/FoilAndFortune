import type { Migration } from './index';

/**
 * v1 → v2 (Phase 2 "One Day at the Nook"): owner avatar, shop layout with fixture slots, card
 * stacks, customers, supplier orders, binder, unlocks/perks, reputation signals and the day
 * log. Operates on plain JSON and hardcodes the v2 starter layout on purpose: migrations must not
 * change when content does. Unlocks are backfilled by the sim at the next dawn.
 */

type Json = Record<string, unknown>;

function obj(parent: Json, key: string): Json {
  const value = parent[key];
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Json;
  const created: Json = {};
  parent[key] = created;
  return created;
}

const SUBS = ['prices', 'service', 'selection', 'trust', 'community'] as const;

function emptySlots(count: number): Json[] {
  return Array.from({ length: count }, () => ({ qty: 0, costCents: 0 }));
}

/** Frozen copy of the v2 Nook starter layout (content: layout.nook.starter). */
function starterFixtures(): Json[] {
  return [
    { uid: 'shelf-a', fixtureId: 'fx.shelf.wall-small', x: 0, z: 0, rot: 0, slots: emptySlots(4) },
    { uid: 'shelf-b', fixtureId: 'fx.shelf.wall-small', x: 2, z: 0, rot: 0, slots: emptySlots(4) },
    { uid: 'register', fixtureId: 'fx.register.counter', x: 4, z: 1, rot: 0, slots: [] },
    { uid: 'case-1', fixtureId: 'fx.case.small', x: 1, z: 3, rot: 2, slots: emptySlots(6) },
    { uid: 'plant-1', fixtureId: 'fx.decor.plant', x: 0, z: 4, rot: 0, slots: [] },
    { uid: 'poster-1', fixtureId: 'fx.decor.poster-origins', x: 5, z: 3, rot: 1, slots: [] },
  ];
}

export const migrateV1toV2: Migration = (state) => {
  const meta = obj(state, 'meta');
  meta.owner ??= { skin: 2, hairStyle: 1, hairColor: 0, top: 3, topColor: 2 };

  const today = obj(obj(state, 'finance'), 'today');
  today.purchases ??= 0;
  today.opened ??= 0;

  const progression = obj(state, 'progression');
  progression.unlocked ??= {};
  progression.perks ??= [];
  progression.flags ??= {};

  const reputation = obj(state, 'reputation');
  if (reputation.signals === undefined) {
    const signals: Json = {};
    for (const sub of SUBS) signals[sub] = { sum: 0, weight: 0, count: 0 };
    reputation.signals = signals;
  }
  reputation.history ??= [];

  const shop = obj(state, 'shop');
  shop.layoutId ??= 'layout.nook.starter';
  shop.fixtures ??= starterFixtures();

  obj(state, 'inventory').cardStacks ??= {};
  state.customers ??= { active: [], lane: [], nextUid: 1, nextArrivalMinute: null };
  state.suppliers ??= { orders: [], nextOrderUid: 1 };
  state.collection ??= { owned: {}, binder: {} };
  state.dayLog ??= {
    served: 0,
    lost: 0,
    itemsSold: 0,
    packsOpened: 0,
    newCards: 0,
    xpGained: 0,
    repStart: 20,
    bestPull: null,
  };
  return state;
};
