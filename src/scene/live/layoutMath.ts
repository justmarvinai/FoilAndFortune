import type { FixtureDef, Rotation } from '@/content/schema/shop';
import { frontDirection, type GridSize, rotatedSize } from '@/content/shop/geometry';
import type { Vec3, WallDef, WallOpening, WallSide } from '../layout';

/**
 * Pure placement maths for the live shop (docs/06 §7): grid tiles → world metres, fixture
 * transforms, the walls with the door where the sim's navigation expects it, and the screen-space
 * bounds the overlay anchors to. Grid space: tile (x, z) spans [x, x+1] × [z, z+1], 1 tile = 1 m,
 * and the room is centred on the origin (the same convention as `gridToWorld` in src/sim/nav.ts).
 */

export interface XZ {
  x: number;
  z: number;
}

export interface FixturePlacement {
  uid: string;
  fixtureId: string;
  x: number;
  z: number;
  rot: Rotation;
}

/** Where a placed fixture sits in the world. */
export interface FixtureFrame {
  /** Centre of the footprint, world metres. */
  center: XZ;
  /** World yaw that turns the model's local +z (its front) towards the fixture's front. */
  yaw: number;
  /** Footprint extent along world x and z (after rotation). */
  size: XZ;
  /** Unit vector of the front in world XZ. */
  front: XZ;
  /** The wall a wall-mounted fixture hangs on (its back), else null. */
  wall: WallSide | null;
}

/** Rotation quarter turns → world yaw (0 front south, 1 west, 2 north, 3 east). */
export function rotationYaw(rot: Rotation): number {
  switch (rot) {
    case 0:
      return 0;
    case 1:
      return -Math.PI / 2;
    case 2:
      return Math.PI;
    case 3:
      return Math.PI / 2;
  }
}

/** The wall behind a fixture with this rotation (its back faces away from its front). */
export function backWall(rot: Rotation): WallSide {
  switch (rot) {
    case 0:
      return 'north';
    case 1:
      return 'east';
    case 2:
      return 'south';
    case 3:
      return 'west';
  }
}

/** Grid-space point → world metres (matches `gridToWorld` in src/sim/nav.ts). */
export function gridPointToWorld(point: XZ, grid: GridSize): XZ {
  return { x: point.x - grid.w / 2, z: point.z - grid.d / 2 };
}

export function fixtureFrame(
  placed: Pick<FixturePlacement, 'x' | 'z' | 'rot'>,
  def: Pick<FixtureDef, 'footprint' | 'wallMounted'>,
  grid: GridSize,
): FixtureFrame {
  const size = rotatedSize(def, placed.rot);
  const center = gridPointToWorld({ x: placed.x + size.w / 2, z: placed.z + size.d / 2 }, grid);
  const { dx, dz } = frontDirection(placed.rot);
  return {
    center,
    yaw: rotationYaw(placed.rot),
    size: { x: size.w, z: size.d },
    front: { x: dx, z: dz },
    wall: def.wallMounted ? backWall(placed.rot) : null,
  };
}

/**
 * Where to put a model of `depth` metres (front to back) inside its footprint: centred for floor
 * fixtures, pushed back against the wall for wall-mounted ones (like a real wall shelf).
 */
export function modelOrigin(frame: FixtureFrame, footprintDepth: number, depth: number): XZ {
  if (!frame.wall) return { ...frame.center };
  const push = footprintDepth / 2 - depth / 2;
  return { x: frame.center.x - frame.front.x * push, z: frame.center.z - frame.front.z * push };
}

/** World XZ + yaw → a wall's local frame (x along the wall, z into the room; see shell/Wall). */
export function worldToWall(
  wall: Pick<WallDef, 'origin' | 'yaw'>,
  point: XZ,
  yaw: number,
): { x: number; z: number; yaw: number } {
  const dx = point.x - wall.origin[0];
  const dz = point.z - wall.origin[2];
  // Local axes in world space: x̂ = (cos θ, −sin θ), ẑ = (sin θ, cos θ) for a rotation θ about +y.
  const c = Math.cos(wall.yaw);
  const s = Math.sin(wall.yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c, yaw: yaw - wall.yaw };
}

/** World z of the door's centre line (the door tile's centre on the west wall). */
export function doorWorldZ(doorZ: number, grid: GridSize): number {
  return doorZ + 0.5 - grid.d / 2;
}

const DOOR_WIDTH = 0.95;
const DOOR_TOP = 2.05;
const WEST_WINDOW = { width: 1.5, bottom: 0.95, top: 2.05 } as const;
const SOUTH_WINDOW = { center: 3.2, width: 2.0, bottom: 0.8, top: 2.0 } as const;
/** Plaster kept between an opening and a wall end or another opening. */
const PIER = 0.3;

/**
 * The window on the door's wall goes on the longer stretch of wall beside the door, as far from
 * the street corner as the spike had it when it fits.
 */
function westWindow(length: number, door: WallOpening): WallOpening | null {
  const half = WEST_WINDOW.width / 2;
  const doorFrom = door.center - door.width / 2;
  const doorTo = door.center + door.width / 2;
  const after = { from: doorTo + PIER + half, to: length - PIER - half };
  const before = { from: PIER + half, to: doorFrom - PIER - half };
  const preferred = 3.35;
  const pick = (span: { from: number; to: number }) =>
    span.to >= span.from ? Math.min(span.to, Math.max(span.from, preferred)) : null;
  const center = pick(after) ?? pick(before);
  return center === null ? null : { kind: 'window', center, ...WEST_WINDOW };
}

/**
 * The shop walls for a grid and door row: the west wall carries the door on the door tile (so
 * customers walk through the doorway the sim's navigation uses) and a window beside it; the
 * south wall has the big street window. Same frames as the spike's `WALLS` (src/scene/layout.ts).
 */
export function shopWalls(grid: GridSize, doorZ: number): WallDef[] {
  const halfX = grid.w / 2;
  const halfZ = grid.d / 2;
  // West wall local x runs from the street corner (world z = +halfZ) inwards: x = halfZ − z.
  const door: WallOpening = {
    kind: 'door',
    center: halfZ - doorWorldZ(doorZ, grid),
    width: DOOR_WIDTH,
    bottom: 0,
    top: DOOR_TOP,
  };
  const window = westWindow(grid.d, door);
  const southWindow: WallOpening = {
    kind: 'window',
    ...SOUTH_WINDOW,
    center: Math.min(grid.w - PIER - SOUTH_WINDOW.width / 2, SOUTH_WINDOW.center),
  };
  return [
    {
      side: 'north',
      length: grid.w,
      origin: [-halfX, 0, -halfZ],
      yaw: 0,
      normal: [0, -1],
      openings: [],
    },
    {
      side: 'west',
      length: grid.d,
      origin: [-halfX, 0, halfZ],
      yaw: Math.PI / 2,
      normal: [-1, 0],
      openings: window ? [door, window] : [door],
    },
    {
      side: 'south',
      length: grid.w,
      origin: [halfX, 0, halfZ],
      yaw: Math.PI,
      normal: [0, 1],
      openings: [southWindow],
    },
    {
      side: 'east',
      length: grid.d,
      origin: [halfX, 0, -halfZ],
      yaw: -Math.PI / 2,
      normal: [1, 0],
      openings: [],
    },
  ];
}

export function findOpening(walls: readonly WallDef[], side: WallSide, kind: WallOpening['kind']) {
  return walls.find((wall) => wall.side === side)?.openings.find((o) => o.kind === kind) ?? null;
}

/** Axis-aligned world box. */
export interface Box3 {
  min: Vec3;
  max: Vec3;
}

/** Visual height (and floor clearance) per fixture kind, for anchoring and colliders. */
export function fixtureHeights(def: Pick<FixtureDef, 'category' | 'wallMounted'>): {
  bottom: number;
  top: number;
} {
  switch (def.category) {
    case 'shelf':
      return { bottom: 0, top: 1.6 };
    case 'case':
      return { bottom: 0, top: 1.0 };
    case 'register':
      return { bottom: 0, top: 1.16 };
    default:
      return def.wallMounted ? { bottom: 1.05, top: 1.95 } : { bottom: 0, top: 1.25 };
  }
}

/**
 * World bounds of a fixture's model: its footprint (only the model depth for wall-mounted ones)
 * between its floor clearance and its top.
 */
export function fixtureBounds(
  frame: FixtureFrame,
  def: Pick<FixtureDef, 'category' | 'wallMounted' | 'footprint'>,
  depth: number,
): Box3 {
  const { bottom, top } = fixtureHeights(def);
  const origin = modelOrigin(frame, def.footprint.d, depth);
  const alongFront = frame.wall ? depth : def.footprint.d;
  // Extent across the front (the footprint width) and along it (depth), in world axes.
  const across = def.footprint.w;
  const ex = frame.front.x !== 0 ? alongFront : across;
  const ez = frame.front.z !== 0 ? alongFront : across;
  return {
    min: [origin.x - ex / 2, bottom, origin.z - ez / 2],
    max: [origin.x + ex / 2, top, origin.z + ez / 2],
  };
}

/** A stable string for a fixture list's placement (not its stock), to memoise on. */
export function placementKey(fixtures: readonly FixturePlacement[]): string {
  return fixtures.map((f) => `${f.uid}:${f.fixtureId}:${f.x}:${f.z}:${f.rot}`).join('|');
}

export function parsePlacementKey(key: string): FixturePlacement[] {
  if (!key) return [];
  return key.split('|').flatMap((entry) => {
    const [uid, fixtureId, x, z, rot] = entry.split(':');
    const r = Number(rot);
    if (!uid || !fixtureId || (r !== 0 && r !== 1 && r !== 2 && r !== 3)) return [];
    return [{ uid, fixtureId, x: Number(x), z: Number(z), rot: r }];
  });
}
