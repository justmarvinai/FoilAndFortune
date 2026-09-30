import type { FixtureDef, LayoutFixture, Tile } from '@/content/schema/shop';
import {
  accessTiles,
  footprintTiles,
  frontDirection,
  type GridSize,
  inGrid,
  tileKey,
} from '@/content/shop/geometry';

/**
 * Shop navigation (docs/06 §5.6, §7): a 4-connected tile grid shared by the sim (walking
 * minutes) and the view (animation paths), so both always agree. Pure and deterministic.
 *
 * Points are in continuous grid space: tile (x, z) spans [x, x+1] × [z, z+1] (1 unit = 1 m). The
 * view converts to world metres with `gridToWorld`.
 */

export interface Point {
  x: number;
  z: number;
}

export interface NavGrid {
  grid: GridSize;
  /** `walkable[z * w + x]`. */
  walkable: readonly boolean[];
  /** The first floor tile inside the (west-wall) door. */
  doorTile: Tile;
  /** Just outside the door, and the street corner where customers appear and leave. */
  outside: Point;
  street: Point;
}

export interface NavFixture {
  placed: LayoutFixture;
  def: FixtureDef;
}

export function tileCenter(tile: Tile): Point {
  return { x: tile.x + 0.5, z: tile.z + 0.5 };
}

/** Grid space → world metres (the room is centred on the origin, docs/src/scene/layout.ts). */
export function gridToWorld(point: Point, grid: GridSize): Point {
  return { x: point.x - grid.w / 2, z: point.z - grid.d / 2 };
}

export function buildNavGrid(
  grid: GridSize,
  doorZ: number,
  fixtures: readonly NavFixture[],
): NavGrid {
  const walkable = new Array<boolean>(grid.w * grid.d).fill(true);
  for (const { placed, def } of fixtures) {
    if (!def.blocksFloor) continue;
    for (const tile of footprintTiles(placed, def)) {
      if (inGrid(tile, grid)) walkable[tile.z * grid.w + tile.x] = false;
    }
  }
  return {
    grid,
    walkable,
    doorTile: { x: 0, z: doorZ },
    outside: { x: -0.6, z: doorZ + 0.5 },
    // South-west street corner of the diorama plinth (world ≈ (−3.9, 3.85) for the Nook).
    street: { x: -0.9, z: grid.d + 1.35 },
  };
}

export function isWalkable(nav: NavGrid, tile: Tile): boolean {
  return inGrid(tile, nav.grid) && nav.walkable[tile.z * nav.grid.w + tile.x] === true;
}

const STEPS: readonly Tile[] = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
];

/**
 * Shortest 4-connected tile path from `from` to `to`, both inclusive. Deterministic: neighbours
 * are always expanded in the same order. Returns null when unreachable.
 */
export function findTilePath(nav: NavGrid, from: Tile, to: Tile): Tile[] | null {
  if (!isWalkable(nav, from) || !isWalkable(nav, to)) return null;
  const cameFrom = new Map<string, Tile | null>([[tileKey(from), null]]);
  const queue: Tile[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (!current) break;
    if (current.x === to.x && current.z === to.z) {
      const path: Tile[] = [];
      for (let step: Tile | null | undefined = current; step; step = cameFrom.get(tileKey(step))) {
        path.push(step);
      }
      return path.reverse();
    }
    for (const step of STEPS) {
      const next = { x: current.x + step.x, z: current.z + step.z };
      if (!isWalkable(nav, next) || cameFrom.has(tileKey(next))) continue;
      cameFrom.set(tileKey(next), current);
      queue.push(next);
    }
  }
  return null;
}

/** Walkable access tiles of a fixture (where customers stand to browse or pay). */
export function fixtureAccessTiles(nav: NavGrid, fixture: NavFixture): Tile[] {
  return accessTiles(fixture.placed, fixture.def).filter((tile) => isWalkable(nav, tile));
}

/**
 * Register lane: the pay spot is the counter's first walkable access tile, and the queue steps
 * straight out from the counter along its facing. Returns [paySpot, queue1, queue2, …].
 */
export function registerLane(nav: NavGrid, register: NavFixture, maxLength: number): Tile[] {
  const pay = fixtureAccessTiles(nav, register)[0];
  if (!pay) return [];
  const { dx, dz } = frontDirection(register.placed.rot);
  const lane: Tile[] = [pay];
  for (let i = 1; lane.length < maxLength; i++) {
    const next = { x: pay.x + dx * i, z: pay.z + dz * i };
    if (!isWalkable(nav, next)) break;
    lane.push(next);
  }
  return lane;
}

/** Polyline length in grid units (= metres). */
export function pathLength(points: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) length += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return length;
}

/** Game-minutes to walk a path at `metersPerMinute` (at least one minute for any move). */
export function walkMinutes(points: readonly Point[], metersPerMinute: number): number {
  const length = pathLength(points);
  return length === 0 ? 0 : Math.max(1, Math.ceil(length / metersPerMinute));
}

/** Street → outside the door → the door tile. */
export function entrancePath(nav: NavGrid): Point[] {
  return [nav.street, nav.outside, tileCenter(nav.doorTile)];
}

/** Tile path as points, optionally prefixed by an off-grid approach (e.g. the entrance). */
export function tilePathPoints(tiles: readonly Tile[]): Point[] {
  return tiles.map(tileCenter);
}
