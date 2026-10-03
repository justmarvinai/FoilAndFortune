import type { ProductKind } from '@/content/schema/tcg';
import { createRng, randRange } from '../lib/rng';

/**
 * Where the units of a fixture slot stand (docs/04 §4.2 "product items on shelves are real
 * little objects"). Pure: a slot's cell and capacity in, one transform per unit out, in *fill
 * order*: a slot holding `qty` units shows the first `qty`. Back rows fill first, so the front
 * row empties first as customers pick, and a picked-over shelf reads as half full.
 */

export type ProductShape = 'pack' | 'blister' | 'deck' | 'box';

/** Model size of one unit at scale 1 (metres): width, height, thickness. */
export const SHAPE_SIZE: Readonly<Record<ProductShape, { w: number; h: number; d: number }>> = {
  pack: { w: 0.13, h: 0.22, d: 0.03 },
  blister: { w: 0.19, h: 0.25, d: 0.05 },
  deck: { w: 0.12, h: 0.165, d: 0.05 },
  box: { w: 0.24, h: 0.17, d: 0.13 },
};

/** Height of the step at the back of each shelf cubby (back rows stand on it). */
export const SHELF_RISER = 0.028;

/** Horizontal gap between units and the front-to-back pitch of rows, per shape. */
const SPACING: Readonly<Record<ProductShape, { gap: number; rowPitch: number; lean: number }>> = {
  pack: { gap: 0.006, rowPitch: 0.14, lean: 0.16 },
  blister: { gap: 0.014, rowPitch: 0.16, lean: 0.12 },
  deck: { gap: 0.07, rowPitch: 0.12, lean: 0.04 },
  box: { gap: 0.03, rowPitch: 0.17, lean: 0 },
};

const SHAPE_OF: Partial<Record<ProductKind, ProductShape>> = {
  booster: 'pack',
  importBooster: 'pack',
  blister: 'blister',
  starterDeck: 'deck',
};

/** The 3D shape a product kind is drawn as (anything boxed falls back to a box). */
export function shapeForKind(kind: ProductKind): ProductShape {
  return SHAPE_OF[kind] ?? 'box';
}

/** A slot's free volume in the fixture's local frame (front faces +z). */
export interface SlotCell {
  /** Centre of the cell's floor. */
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

export interface UnitTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

/** Rows (back to front) and columns that fit `capacity` units of a shape in a cell. */
export function slotGrid(
  shape: ProductShape,
  capacity: number,
  cell: Pick<SlotCell, 'width' | 'depth' | 'height'>,
): { cols: number; rows: number; scale: number } {
  const size = SHAPE_SIZE[shape];
  const { gap, rowPitch } = SPACING[shape];
  let scale = Math.min(1, (cell.height * 0.92) / size.h);
  for (let attempt = 0; attempt < 12; attempt++) {
    const cols = Math.max(1, Math.floor((cell.width + gap * scale) / ((size.w + gap) * scale)));
    const maxRows = Math.max(1, Math.floor(cell.depth / (rowPitch * scale)));
    const rows = Math.ceil(Math.max(1, capacity) / cols);
    if (rows <= maxRows) return { cols, rows, scale };
    scale *= 0.88;
  }
  const cols = Math.max(1, Math.floor(cell.width / (size.w * scale)));
  return { cols, rows: Math.ceil(Math.max(1, capacity) / cols), scale };
}

/** A deterministic shuffle of 0…n-1 (presentation-only RNG). */
function shuffled(n: number, rng: () => number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = order[i] ?? i;
    order[i] = order[j] ?? j;
    order[j] = a;
  }
  return order;
}

/**
 * Transforms for `capacity` units of `shape` in `cell`, in fill order. Units stand on the cell
 * floor in rows, back rows a little raised (a stepped display) and leaning back; each row's
 * fill order is shuffled by `seed` so a half-empty row has natural gaps, not a tidy edge.
 */
export function slotUnits(
  shape: ProductShape,
  capacity: number,
  cell: SlotCell,
  seed: number,
): UnitTransform[] {
  const count = Math.max(0, Math.floor(capacity));
  if (count === 0) return [];
  const size = SHAPE_SIZE[shape];
  const { gap, rowPitch, lean } = SPACING[shape];
  const { cols, rows, scale } = slotGrid(shape, count, cell);
  const rng = createRng(seed);
  const units: UnitTransform[] = [];
  const pitchX = (size.w + gap) * scale;
  const pitchZ = rowPitch * scale;
  // Matches the shelves' back risers (live/WallShelf.tsx).
  const rise = SHELF_RISER;
  let left = count;
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(cols, left);
    left -= inRow;
    // Row 0 is the back row; rows step forward and down.
    const z = cell.z - ((rows - 1) * pitchZ) / 2 + row * pitchZ;
    const y = cell.y + (rows - 1 - row) * rise;
    const rowLean = rows > 1 && row < rows - 1 ? lean * 1.25 : lean;
    const x0 = cell.x - ((inRow - 1) * pitchX) / 2;
    for (const i of shuffled(inRow, rng)) {
      const jitter = shape === 'pack' ? 1 : 0.5;
      units.push({
        position: [
          x0 + i * pitchX + randRange(rng, -0.006, 0.006) * jitter,
          y + (size.h * scale) / 2,
          z + randRange(rng, -0.008, 0.008) * jitter,
        ],
        rotation: [
          -rowLean + randRange(rng, -0.04, 0.04) * jitter,
          randRange(rng, -0.07, 0.07) * jitter,
          randRange(rng, -0.04, 0.04) * jitter,
        ],
        scale,
      });
    }
  }
  return units;
}

/** Which units of a slot are visible: the first `qty`, capped at the layout's size. */
export function visibleUnits(qty: number, capacity: number): number {
  return Math.max(0, Math.min(Math.floor(qty), Math.floor(capacity)));
}

/**
 * Slot cells of a wall shelf with `count` slots, laid out like the Fixture Popover's grid (two
 * columns; slot 0 top-left as seen from the front). Local frame: origin on the floor at the
 * shelf's centre, front +z. `levels` are the heights of the shelf boards' tops, bottom first.
 */
export function shelfSlotCells(
  count: number,
  inner: { width: number; depth: number; frontZ: number },
  levels: readonly number[],
  levelHeight: number,
): SlotCell[] {
  const columns = count <= 1 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(count / columns));
  const divider = columns > 1 ? 0.05 : 0;
  const width = (inner.width - divider * (columns - 1)) / columns;
  const cells: SlotCell[] = [];
  for (let index = 0; index < count; index++) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    // Row 0 is the top level.
    const level = levels[Math.max(0, levels.length - rows) + (rows - 1 - row)] ?? levels[0] ?? 0;
    cells.push({
      x: -inner.width / 2 + width / 2 + col * (width + divider),
      y: level,
      z: inner.frontZ - inner.depth / 2,
      width: width - 0.04,
      depth: inner.depth - 0.03,
      height: levelHeight,
    });
  }
  return cells;
}

/**
 * Card positions in a display case with `count` slots: two tiers (back raised), three across,
 * in the Fixture Popover's order (slot 0 back-left as seen by a customer at the front).
 */
export function caseSlotSpots(
  count: number,
  length: number,
  depth: number,
  bedY: number,
): { position: [number, number, number]; tilt: number }[] {
  const perRow = Math.max(1, Math.ceil(count / 2));
  const rows = count > perRow ? 2 : 1;
  const spots: { position: [number, number, number]; tilt: number }[] = [];
  const pitch = Math.min(0.3, (length - 0.2) / perRow);
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    const back = rows === 2 && row === 0;
    spots.push({
      position: [
        (col - (perRow - 1) / 2) * pitch,
        bedY + (back ? 0.12 : 0.05),
        back ? -depth * 0.225 : depth * 0.22,
      ],
      // Nearly flat under the glass, so the faces read from any camera angle (the diorama camera
      // usually sees a case from behind or the side).
      tilt: back ? 1.18 : 1.42,
    });
  }
  return spots;
}
