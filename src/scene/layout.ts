/**
 * Layout of the Tier-1 shop "The Nook" (docs/01 §7.2): a 6 × 5 tile corner shop, 1 tile = 1 m.
 * Pure data, so Phase 2 can swap this for the player's Build Mode layout.
 *
 * World axes: +x east, +z south, +y up. The room interior spans x ∈ [-3, 3], z ∈ [-2.5, 2.5];
 * the street corner is on the west and south sides (Lantern Lane, Old Town, docs/03 §2).
 */
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export const ROOM = {
  halfX: 3,
  halfZ: 2.5,
  wallHeight: 2.5,
  wallThickness: 0.2,
  /** Height of a cut-away wall ("walls down"), showing its section like a dollhouse. */
  stubHeight: 0.3,
} as const;

export type WallSide = 'north' | 'east' | 'south' | 'west';

export interface WallOpening {
  kind: 'door' | 'window';
  /** Centre along the wall, in metres from the wall's left end as seen from inside. */
  center: number;
  width: number;
  bottom: number;
  top: number;
}

export interface WallDef {
  side: WallSide;
  /** Interior length of the wall. */
  length: number;
  /** World position of the wall's local origin: left end, floor level, inner face. */
  origin: Vec3;
  /** Rotation about Y mapping local +z (into the room) to world. */
  yaw: number;
  /** Outward normal in world XZ; the wall hides when this faces the camera. */
  normal: Vec2;
  openings: readonly WallOpening[];
}

const { halfX, halfZ } = ROOM;

export const WALLS: readonly WallDef[] = [
  {
    side: 'north',
    length: halfX * 2,
    origin: [-halfX, 0, -halfZ],
    yaw: 0,
    normal: [0, -1],
    openings: [],
  },
  {
    side: 'west',
    length: halfZ * 2,
    origin: [-halfX, 0, halfZ],
    yaw: Math.PI / 2,
    normal: [-1, 0],
    openings: [
      // Door near the street corner, window further in (world z = 2.5 - local x).
      { kind: 'door', center: 1.15, width: 0.95, bottom: 0, top: 2.05 },
      { kind: 'window', center: 3.35, width: 1.5, bottom: 0.95, top: 2.05 },
    ],
  },
  {
    side: 'south',
    length: halfX * 2,
    origin: [halfX, 0, halfZ],
    yaw: Math.PI,
    normal: [0, 1],
    openings: [{ kind: 'window', center: 3.2, width: 2.0, bottom: 0.8, top: 2.0 }],
  },
  {
    side: 'east',
    length: halfZ * 2,
    origin: [halfX, 0, -halfZ],
    yaw: -Math.PI / 2,
    normal: [1, 0],
    openings: [],
  },
];

/** Street plinth (diorama base) footprint and levels. */
export const PLINTH = {
  minX: -5.4,
  maxX: 3.5,
  minZ: -3.0,
  maxZ: 4.8,
  /** Bottom of the wooden base block. */
  baseBottom: -0.62,
  /** Top of the base block; roads and pavements sit on it. */
  baseTop: -0.14,
  sidewalkTop: -0.02,
  roadTop: -0.11,
  /** West pavement spans x ∈ [westCurb, -3.2]; road beyond it. */
  westCurb: -4.6,
  /** South pavement spans z ∈ [2.7, southCurb]; road beyond it. */
  southCurb: 4.0,
} as const;

/** Anchor positions for fixtures and props. */
export const SPOTS = {
  packShelf: { position: [-1.3, 0, -2.29] as Vec3, width: 2.3, height: 2.0, depth: 0.42 },
  counter: { position: [1.55, 0, -1.45] as Vec3, width: 1.9, height: 0.74, depth: 0.62 },
  displayCase: { position: [2.25, 0, -0.5] as Vec3, length: 1.2, width: 0.6, height: 0.95 },
  bargainBin: { position: [-0.3, 0, 1.45] as Vec3 },
  rug: { position: [0.05, 0, -0.15] as Vec3, radius: 1.15 },
  bigPlant: { position: [-2.62, 0, 2.18] as Vec3 },
  snakePlant: { position: [0.24, 0, -2.18] as Vec3 },
  doorMat: { position: [-2.62, 0, 1.35] as Vec3 },
  pendantCounter: { position: [1.45, 2.2, -1.45] as Vec3 },
  pendantCenter: { position: [-0.75, 2.25, 0.05] as Vec3 },
  owner: { position: [1.3, 0, -2.08] as Vec3, yaw: 0 },
  lampPost: { position: [-4.3, 0, 3.7] as Vec3 },
  bench: { position: [-0.6, 0, 3.55] as Vec3 },
  hydrant: { position: [-3.5, 0, 3.72] as Vec3 },
  streetTree: { position: [2.95, 0, 3.45] as Vec3 },
  chalkboard: { position: [-2.3, 0, 3.25] as Vec3 },
} as const;

/** The west-wall door, in world space (hinge on the street-corner side). */
export const DOOR = {
  center: [-3.1, 0, 1.35] as Vec3,
  width: 0.95,
  height: 2.05,
  /** Agents closer than this to the door centre make it swing open. */
  triggerRadius: 1.05,
} as const;

/** Waypoints for the demo customer loop (see agents/customerScript.ts). */
export const WAYPOINTS = {
  spawn: [-3.9, 3.85] as Vec2,
  outsideDoor: [-3.9, 1.35] as Vec2,
  insideDoor: [-2.3, 1.35] as Vec2,
  bargainBin: [-0.3, 0.72] as Vec2,
  packShelf: [-1.25, -1.6] as Vec2,
  aisle: [0.25, -0.62] as Vec2,
  counter: [1.25, -0.66] as Vec2,
} as const;
