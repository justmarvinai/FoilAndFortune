import type { FixtureDef, Tile } from '@/content/schema/shop';
import { frontDirection, inGrid } from '@/content/shop/geometry';
import type { SimContext } from '../../context';
import {
  buildNavGrid,
  findTilePath,
  type NavFixture,
  type NavGrid,
  type Point,
  pathLength,
  registerLane,
  tileCenter,
  tilePathPoints,
} from '../../nav';
import type { AgentActivity, GameState, PlacedFixture } from '../../state/types';

/**
 * The shop as customers see it this tick: the navigation grid, fixtures by uid and the register
 * lane (docs/06 §5.6). Rebuilt on demand from state, never stored, so it can't go stale.
 */

export interface WorldFixture {
  placed: PlacedFixture;
  def: FixtureDef;
  nav: NavFixture;
}

export interface ShopWorld {
  nav: NavGrid;
  fixtures: ReadonlyMap<string, WorldFixture>;
  /** Fixtures with slots that customers browse, in layout order. */
  browsable: readonly string[];
  /** Register lane tiles, pay spot first. Empty without a reachable register. */
  lane: readonly Tile[];
  register: WorldFixture | null;
}

export function buildShopWorld(
  state: GameState,
  ctx: Pick<SimContext, 'content' | 'balance'>,
): ShopWorld | null {
  const layout = ctx.content.layouts.get(state.shop.layoutId);
  if (!layout) return null;
  const fixtures = new Map<string, WorldFixture>();
  for (const placed of state.shop.fixtures) {
    const def = ctx.content.fixtures.get(placed.fixtureId);
    if (def) fixtures.set(placed.uid, { placed, def, nav: { placed, def } });
  }
  const all = [...fixtures.values()];
  const nav = buildNavGrid(
    layout.grid,
    layout.door.z,
    all.map((fixture) => fixture.nav),
  );
  const register = all.find((fixture) => fixture.def.category === 'register') ?? null;
  const lane = register ? registerLane(nav, register.nav, ctx.balance.customers.maxQueue) : [];
  const browsable = all
    .filter((fixture) => fixture.def.slots.count > 0 && fixture.def.slots.accepts.kind !== 'none')
    .map((fixture) => fixture.placed.uid);
  return { nav, fixtures, browsable, lane, register };
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.z === b.z;
}

export function pointTile(point: Point): Tile {
  return { x: Math.floor(point.x), z: Math.floor(point.z) };
}

export function laneIndexOf(world: ShopWorld, tile: Tile): number {
  return world.lane.findIndex((laneTile) => sameTile(laneTile, tile));
}

/**
 * Shortest tile path that steps around `avoid` (e.g. people standing in line), falling back to
 * the plain shortest path when there's no way around.
 */
export function pathAvoiding(
  nav: NavGrid,
  from: Tile,
  to: Tile,
  avoid: readonly Tile[],
): Tile[] | null {
  const blocked = avoid.filter(
    (tile) => inGrid(tile, nav.grid) && !sameTile(tile, from) && !sameTile(tile, to),
  );
  if (blocked.length > 0) {
    const walkable = [...nav.walkable];
    for (const tile of blocked) walkable[tile.z * nav.grid.w + tile.x] = false;
    const detour = findTilePath({ ...nav, walkable }, from, to);
    if (detour) return detour;
  }
  return findTilePath(nav, from, to);
}

/** From a tile to the street corner: through the door, outside, and away (docs/06 §5.6). */
export function exitPath(world: ShopWorld, from: Tile): Point[] {
  const door = world.nav.doorTile;
  const tiles = pathAvoiding(world.nav, from, door, world.lane);
  const points = tilePathPoints(tiles ?? [from]);
  if (!tiles) points.push(tileCenter(door));
  points.push(world.nav.outside, world.nav.street);
  return points;
}

/** Where a browsing customer looks: the fixture tile right behind their access tile. */
export function browseFacing(fixture: WorldFixture, tile: Tile): Point {
  const { dx, dz } = frontDirection(fixture.placed.rot);
  return tileCenter({ x: tile.x - dx, z: tile.z - dz });
}

/** Where someone in line looks: the register from the pay spot, else the back of the one ahead. */
export function laneFacing(world: ShopWorld, index: number): Point {
  const ahead = world.lane[index - 1];
  if (ahead) return tileCenter(ahead);
  const pay = world.lane[0];
  if (!pay || !world.register) return tileCenter(pay ?? world.nav.doorTile);
  const { dx, dz } = frontDirection(world.register.placed.rot);
  return tileCenter({ x: pay.x - dx, z: pay.z - dz });
}

/** A walk that starts off the grid is the way in from the street. */
export function isEntranceWalk(activity: AgentActivity): boolean {
  return activity.kind === 'walk' && (activity.path[0]?.x ?? 0) < 0;
}

/**
 * The tick nearest the moment a walk crosses the door line (x = 0) from outside, for the door
 * bell. The view moves agents at constant speed along the path, so this is exact up to rounding.
 */
export function doorCrossingMinute(activity: AgentActivity): number | null {
  if (activity.kind !== 'walk') return null;
  const total = pathLength(activity.path);
  if (total <= 0) return null;
  let before = 0;
  for (let i = 1; i < activity.path.length; i++) {
    const a = activity.path[i - 1];
    const b = activity.path[i];
    if (!a || !b) continue;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (a.x < 0 && b.x >= 0) {
      const along = before + length * ((0 - a.x) / (b.x - a.x));
      const duration = activity.endMinute - activity.startMinute;
      return activity.startMinute + Math.round((along / total) * duration);
    }
    before += length;
  }
  return null;
}
