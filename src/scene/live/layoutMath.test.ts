import { describe, expect, it } from 'vitest';
import { getRegistry } from '@/content/registry';
import { nookStarterLayout } from '@/content/shop/layouts';
import { buildNavGrid, entrancePath, gridToWorld } from '@/sim/nav';
import {
  doorWorldZ,
  findOpening,
  fixtureBounds,
  fixtureFrame,
  modelOrigin,
  parsePlacementKey,
  placementKey,
  rotationYaw,
  shopWalls,
  worldToWall,
} from './layoutMath';

const grid = nookStarterLayout.grid;
const registry = getRegistry();

function placed(uid: string) {
  const fixture = nookStarterLayout.fixtures.find((f) => f.uid === uid);
  const def = fixture ? registry.fixtures.get(fixture.fixtureId) : undefined;
  if (!fixture || !def) throw new Error(`no ${uid}`);
  return { fixture, def };
}

describe('fixture transforms (grid → world)', () => {
  it('turns rotations into yaws that point the model front the right way', () => {
    // Local +z rotated by yaw θ about +y is (sin θ, cos θ) in world XZ.
    const front = (rot: 0 | 1 | 2 | 3) => {
      const yaw = rotationYaw(rot);
      return [Math.round(Math.sin(yaw)), Math.round(Math.cos(yaw))];
    };
    expect(front(0)).toEqual([0, 1]); // south
    expect(front(1)).toEqual([-1, 0]); // west
    expect(front(2)).toEqual([0, -1]); // north
    expect(front(3)).toEqual([1, 0]); // east
  });

  it('centres fixtures on their footprint in the room-centred world', () => {
    const { fixture, def } = placed('register');
    const frame = fixtureFrame(fixture, def, grid);
    // Tiles (4,1)-(5,1) → x ∈ [1, 3], z ∈ [-1.5, -0.5].
    expect(frame.center).toEqual({ x: 2, z: -1 });
    expect(frame.size).toEqual({ x: 2, z: 1 });
    expect(frame.wall).toBeNull();
    const shelf = placed('shelf-a');
    const shelfFrame = fixtureFrame(shelf.fixture, shelf.def, grid);
    expect(shelfFrame.center).toEqual({ x: -2, z: -2 });
    expect(shelfFrame.wall).toBe('north');
  });

  it('agrees with the sim navigation grid on tile centres', () => {
    const { fixture, def } = placed('case-1');
    const frame = fixtureFrame(fixture, def, grid);
    const viaNav = gridToWorld({ x: fixture.x + 1, z: fixture.z + 0.5 }, grid);
    expect(frame.center).toEqual(viaNav);
    expect(frame.front).toEqual({ x: 0, z: -1 });
  });

  it('pushes wall-mounted models back against their wall', () => {
    const { fixture, def } = placed('shelf-b');
    const frame = fixtureFrame(fixture, def, grid);
    const origin = modelOrigin(frame, def.footprint.d, 0.42);
    // North wall inner face at z = -2.5; a 0.42 m deep shelf is centred 0.21 m in front of it.
    expect(origin.x).toBeCloseTo(0);
    expect(origin.z).toBeCloseTo(-2.29);
    const poster = placed('poster-1');
    const posterFrame = fixtureFrame(poster.fixture, poster.def, grid);
    expect(posterFrame.wall).toBe('east');
    const posterOrigin = modelOrigin(posterFrame, poster.def.footprint.d, 0.06);
    expect(posterOrigin.x).toBeCloseTo(2.97);
    expect(posterOrigin.z).toBeCloseTo(1);
  });

  it('maps world points into a wall frame', () => {
    const walls = shopWalls(grid, nookStarterLayout.door.z);
    const north = walls.find((w) => w.side === 'north');
    const east = walls.find((w) => w.side === 'east');
    if (!north || !east) throw new Error('walls');
    expect(worldToWall(north, { x: -2, z: -2.29 }, 0)).toMatchObject({ x: 1, yaw: 0 });
    expect(worldToWall(north, { x: -2, z: -2.29 }, 0).z).toBeCloseTo(0.21);
    const local = worldToWall(east, { x: 2.97, z: 1 }, rotationYaw(1));
    expect(local.x).toBeCloseTo(3.5);
    expect(local.z).toBeCloseTo(0.03);
    expect(local.yaw).toBeCloseTo(0);
  });

  it('bounds fixtures between the floor and their top', () => {
    const { fixture, def } = placed('register');
    const box = fixtureBounds(fixtureFrame(fixture, def, grid), def, 0.62);
    expect(box.min).toEqual([1, 0, -1.5]);
    expect(box.max[0]).toBe(3);
    expect(box.max[1]).toBeGreaterThan(1);
  });

  it('round-trips the placement key', () => {
    const fixtures = nookStarterLayout.fixtures;
    expect(parsePlacementKey(placementKey(fixtures))).toEqual(fixtures);
    expect(parsePlacementKey('')).toEqual([]);
  });
});

describe('the door lines up with the navigation door tile', () => {
  const walls = shopWalls(grid, nookStarterLayout.door.z);
  const door = findOpening(walls, 'west', 'door');

  it('puts the door opening on the door tile', () => {
    expect(door).not.toBeNull();
    // West wall local x = halfZ − world z; the door tile (0, 3) is centred on world z = 1.
    expect(doorWorldZ(nookStarterLayout.door.z, grid)).toBe(1);
    expect(door?.center).toBeCloseTo(1.5);
  });

  it('lets the entrance path pass through the doorway', () => {
    const fixtures = nookStarterLayout.fixtures.flatMap((f) => {
      const def = registry.fixtures.get(f.fixtureId);
      return def ? [{ placed: f, def }] : [];
    });
    const nav = buildNavGrid(grid, nookStarterLayout.door.z, fixtures);
    const [, outside, inside] = entrancePath(nav).map((p) => gridToWorld(p, grid));
    if (!outside || !inside || !door) throw new Error('path');
    // The last leg crosses the wall line (x = -3) at the door's centre line, within its width.
    expect(outside.x).toBeLessThan(-3.2);
    expect(inside.x).toBeGreaterThan(-3);
    const crossingZ =
      outside.z + ((inside.z - outside.z) * (-3 - outside.x)) / (inside.x - outside.x);
    const doorZ = grid.d / 2 - door.center;
    expect(Math.abs(crossingZ - doorZ)).toBeLessThan(door.width / 2 - 0.25);
  });

  it('keeps the window beside the door without overlapping it', () => {
    const window = findOpening(walls, 'west', 'window');
    if (!window || !door) throw new Error('openings');
    const gap = window.center - window.width / 2 - (door.center + door.width / 2);
    expect(gap).toBeGreaterThan(0.25);
    expect(window.center + window.width / 2).toBeLessThanOrEqual(grid.d);
  });

  it('moves the door with the layout', () => {
    const near = findOpening(shopWalls(grid, 1), 'west', 'door');
    expect(near?.center).toBeCloseTo(3.5);
    const window = findOpening(shopWalls(grid, 1), 'west', 'window');
    // No room after the door: the window moves to the street-corner side.
    expect(window?.center ?? 0).toBeLessThan(3.5);
  });
});
