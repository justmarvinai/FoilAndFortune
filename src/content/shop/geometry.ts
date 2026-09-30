import type { FixtureDef, LayoutFixture, Rotation, Tile } from '../schema/shop';

/**
 * Pure tile geometry for shop layouts, shared by content validation, the sim's navigation
 * (src/sim/nav.ts) and the 3D view (src/scene). Grid space: tile (x, z) spans [x, x+1] × [z, z+1];
 * x runs east from the west wall, z runs south from the north wall; 1 tile = 1 metre.
 */

export interface GridSize {
  w: number;
  d: number;
}

/** Unit vector the fixture's front faces: 0 south, 1 west, 2 north, 3 east. */
export function frontDirection(rot: Rotation): { dx: number; dz: number } {
  switch (rot) {
    case 0:
      return { dx: 0, dz: 1 };
    case 1:
      return { dx: -1, dz: 0 };
    case 2:
      return { dx: 0, dz: -1 };
    case 3:
      return { dx: 1, dz: 0 };
  }
}

/** Footprint size on the grid after rotation (quarter turns swap width and depth). */
export function rotatedSize(def: Pick<FixtureDef, 'footprint'>, rot: Rotation): GridSize {
  const { w, d } = def.footprint;
  return rot === 0 || rot === 2 ? { w, d } : { w: d, d: w };
}

/** Every tile the fixture's footprint covers. */
export function footprintTiles(placed: LayoutFixture, def: Pick<FixtureDef, 'footprint'>): Tile[] {
  const size = rotatedSize(def, placed.rot);
  const tiles: Tile[] = [];
  for (let dz = 0; dz < size.d; dz++) {
    for (let dx = 0; dx < size.w; dx++) tiles.push({ x: placed.x + dx, z: placed.z + dz });
  }
  return tiles;
}

/** Tiles directly in front of the fixture, where a customer stands to use it. */
export function accessTiles(placed: LayoutFixture, def: Pick<FixtureDef, 'footprint'>): Tile[] {
  const size = rotatedSize(def, placed.rot);
  const { x, z } = placed;
  switch (placed.rot) {
    case 0:
      return range(size.w).map((i) => ({ x: x + i, z: z + size.d }));
    case 2:
      return range(size.w).map((i) => ({ x: x + i, z: z - 1 }));
    case 1:
      return range(size.d).map((i) => ({ x: x - 1, z: z + i }));
    case 3:
      return range(size.d).map((i) => ({ x: x + size.w, z: z + i }));
  }
}

/** For wall-mounted fixtures: does the back edge touch the wall behind it? */
export function backTouchesWall(
  placed: LayoutFixture,
  def: Pick<FixtureDef, 'footprint'>,
  grid: GridSize,
): boolean {
  const size = rotatedSize(def, placed.rot);
  switch (placed.rot) {
    case 0:
      return placed.z === 0;
    case 2:
      return placed.z + size.d === grid.d;
    case 1:
      return placed.x + size.w === grid.w;
    case 3:
      return placed.x === 0;
  }
}

export function inGrid(tile: Tile, grid: GridSize): boolean {
  return tile.x >= 0 && tile.z >= 0 && tile.x < grid.w && tile.z < grid.d;
}

export function tileKey(tile: Tile): string {
  return `${tile.x},${tile.z}`;
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}
