import type { LayoutDef } from '../schema/shop';

/**
 * The Nook's fixed starter layout (docs/02 §2 starting fixtures) on the 6 × 5 Tier-1 grid.
 * Tile (x, z): x runs east from the west wall (door side), z runs south from the north wall.
 *
 *        x=0   1   2   3   4   5
 *   z=0 [ shelf-a][ shelf-b][ owner ]    wall shelves on the north wall; owner behind counter
 *   z=1   .   .   .   .  [register]      register counter, front faces south
 *   z=2   .  [c]  [c]  .  pay  .         pay spot in front of the register; case viewed from here
 *   z=3  door [case-1]  .  q1   .        display case (front faces north); queue runs south
 *   z=4 plant  .   .   .  q2   .
 *
 * The 3D view (src/scene) and the sim's navigation (src/sim/nav.ts) both read this data.
 */
export const nookStarterLayout: LayoutDef = {
  id: 'layout.nook.starter',
  tier: 1,
  grid: { w: 6, d: 5 },
  door: { z: 3 },
  fixtures: [
    { uid: 'shelf-a', fixtureId: 'fx.shelf.wall-small', x: 0, z: 0, rot: 0 },
    { uid: 'shelf-b', fixtureId: 'fx.shelf.wall-small', x: 2, z: 0, rot: 0 },
    { uid: 'register', fixtureId: 'fx.register.counter', x: 4, z: 1, rot: 0 },
    { uid: 'case-1', fixtureId: 'fx.case.small', x: 1, z: 3, rot: 2 },
    { uid: 'plant-1', fixtureId: 'fx.decor.plant', x: 0, z: 4, rot: 0 },
    { uid: 'poster-1', fixtureId: 'fx.decor.poster-origins', x: 5, z: 3, rot: 1 },
  ],
};

export const layoutCatalog: readonly LayoutDef[] = [nookStarterLayout];
