import { describe, expect, it } from 'vitest';
import { nookStarterLayout } from '@/content/shop/layouts';
import {
  buildNavGrid,
  entrancePath,
  findTilePath,
  fixtureAccessTiles,
  gridToWorld,
  isWalkable,
  type NavFixture,
  pathLength,
  registerLane,
  tilePathPoints,
  walkMinutes,
} from './nav';
import { testContext } from './testing';

const { content, balance } = testContext();

function nookFixtures(): NavFixture[] {
  return nookStarterLayout.fixtures.flatMap((placed) => {
    const def = content.fixtures.get(placed.fixtureId);
    return def ? [{ placed, def }] : [];
  });
}

const fixtures = nookFixtures();
const nav = buildNavGrid(nookStarterLayout.grid, nookStarterLayout.door.z, fixtures);
const byUid = (uid: string) => {
  const fixture = fixtures.find((f) => f.placed.uid === uid);
  if (!fixture) throw new Error(`missing fixture ${uid}`);
  return fixture;
};

describe('Nook navigation grid', () => {
  it('blocks floor fixtures but not wall posters', () => {
    expect(isWalkable(nav, { x: 0, z: 0 })).toBe(false); // wall shelf
    expect(isWalkable(nav, { x: 4, z: 1 })).toBe(false); // register counter
    expect(isWalkable(nav, { x: 1, z: 3 })).toBe(false); // display case
    expect(isWalkable(nav, { x: 0, z: 4 })).toBe(false); // plant
    expect(isWalkable(nav, { x: 5, z: 3 })).toBe(true); // poster hangs on the wall
    expect(isWalkable(nav, { x: 0, z: 3 })).toBe(true); // door tile
    expect(isWalkable(nav, { x: -1, z: 3 })).toBe(false); // outside the grid
  });

  it('puts the pay spot in front of the register with the queue behind it', () => {
    expect(registerLane(nav, byUid('register'), 4)).toEqual([
      { x: 4, z: 2 },
      { x: 4, z: 3 },
      { x: 4, z: 4 },
    ]);
    expect(registerLane(nav, byUid('register'), 2)).toHaveLength(2);
  });

  it('reaches every browse spot and the pay spot from the door', () => {
    for (const uid of ['shelf-a', 'shelf-b', 'case-1', 'register']) {
      const spots = fixtureAccessTiles(nav, byUid(uid));
      expect(spots.length, uid).toBeGreaterThan(0);
      for (const spot of spots) {
        const path = findTilePath(nav, nav.doorTile, spot);
        expect(path, `${uid} ${spot.x},${spot.z}`).not.toBeNull();
      }
    }
  });

  it('finds shortest 4-connected paths deterministically', () => {
    const path = findTilePath(nav, nav.doorTile, { x: 4, z: 2 });
    expect(path).not.toBeNull();
    // Manhattan distance 5 (4 east, 1 north) → 6 tiles including both ends.
    expect(path).toHaveLength(6);
    for (let i = 1; i < (path?.length ?? 0); i++) {
      const a = path?.[i - 1];
      const b = path?.[i];
      expect(Math.abs((b?.x ?? 0) - (a?.x ?? 0)) + Math.abs((b?.z ?? 0) - (a?.z ?? 0))).toBe(1);
    }
    expect(findTilePath(nav, nav.doorTile, { x: 4, z: 2 })).toEqual(path);
  });

  it('returns null for blocked or unreachable targets', () => {
    expect(findTilePath(nav, nav.doorTile, { x: 0, z: 0 })).toBeNull();
    // Behind the counter is the owner's pocket: no customer path leads there.
    expect(findTilePath(nav, nav.doorTile, { x: 4, z: 0 })).toBeNull();
  });

  it('measures walks in game-minutes at the balance walking speed', () => {
    const entrance = entrancePath(nav);
    expect(pathLength(entrance)).toBeGreaterThan(1);
    const minutes = walkMinutes(entrance, balance.customers.walkMetersPerMinute);
    expect(minutes).toBe(Math.ceil(pathLength(entrance) / balance.customers.walkMetersPerMinute));
    expect(walkMinutes([{ x: 1, z: 1 }], 1)).toBe(0);
    expect(
      walkMinutes(
        [
          { x: 1, z: 1 },
          { x: 1.1, z: 1 },
        ],
        1,
      ),
    ).toBe(1);
  });

  it('converts grid space to the diorama room in world metres', () => {
    expect(gridToWorld({ x: 0, z: 0 }, nav.grid)).toEqual({ x: -3, z: -2.5 });
    expect(gridToWorld({ x: 6, z: 5 }, nav.grid)).toEqual({ x: 3, z: 2.5 });
    // The door tile centre sits just inside the diorama's west-wall door (src/scene/layout.ts).
    const [door] = tilePathPoints([nav.doorTile]);
    expect(door && gridToWorld(door, nav.grid)).toEqual({ x: -2.5, z: 1 });
  });
});
