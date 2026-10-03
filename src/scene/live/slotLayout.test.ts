import { describe, expect, it } from 'vitest';
import {
  caseSlotSpots,
  type ProductShape,
  SHAPE_SIZE,
  type SlotCell,
  shapeForKind,
  shelfSlotCells,
  slotGrid,
  slotUnits,
  visibleUnits,
} from './slotLayout';

const CUBBY: SlotCell = { x: 0, y: 0.2, z: 0, width: 0.82, depth: 0.36, height: 0.5 };

describe('slot unit layout', () => {
  it('maps product kinds to shapes', () => {
    expect(shapeForKind('booster')).toBe('pack');
    expect(shapeForKind('blister')).toBe('blister');
    expect(shapeForKind('starterDeck')).toBe('deck');
    expect(shapeForKind('box')).toBe('box');
    expect(shapeForKind('tin')).toBe('box');
  });

  it('places one transform per unit of capacity', () => {
    for (const [shape, capacity] of [
      ['pack', 12],
      ['blister', 4],
      ['deck', 4],
      ['box', 1],
      ['pack', 30],
    ] as [ProductShape, number][]) {
      expect(slotUnits(shape, capacity, CUBBY, 7)).toHaveLength(capacity);
    }
    expect(slotUnits('pack', 0, CUBBY, 7)).toEqual([]);
  });

  it('keeps every unit inside its cell', () => {
    for (const shape of ['pack', 'blister', 'deck', 'box'] as ProductShape[]) {
      for (const capacity of [1, 4, 12, 24]) {
        const units = slotUnits(shape, capacity, CUBBY, 3);
        for (const unit of units) {
          const halfW = (SHAPE_SIZE[shape].w * unit.scale) / 2;
          const [x, y, z] = unit.position;
          expect(x - halfW).toBeGreaterThan(CUBBY.x - CUBBY.width / 2 - 0.02);
          expect(x + halfW).toBeLessThan(CUBBY.x + CUBBY.width / 2 + 0.02);
          expect(Math.abs(z - CUBBY.z)).toBeLessThan(CUBBY.depth / 2);
          expect(y + (SHAPE_SIZE[shape].h * unit.scale) / 2).toBeLessThan(
            CUBBY.y + CUBBY.height + 0.06,
          );
        }
      }
    }
  });

  it('fills back rows first, so the front row empties first', () => {
    const units = slotUnits('pack', 12, CUBBY, 11);
    const { cols, rows } = slotGrid('pack', 12, CUBBY);
    expect(rows).toBe(2);
    const back = units.slice(0, cols).map((u) => u.position[2]);
    const front = units.slice(cols).map((u) => u.position[2]);
    expect(Math.max(...back)).toBeLessThan(Math.min(...front));
    // Back rows stand a little higher (a stepped display).
    expect(units[0]?.position[1]).toBeGreaterThan(units[units.length - 1]?.position[1] ?? 0);
  });

  it('is deterministic per seed and shuffles the row order between seeds', () => {
    expect(slotUnits('pack', 12, CUBBY, 5)).toEqual(slotUnits('pack', 12, CUBBY, 5));
    const xs = (seed: number) => slotUnits('pack', 12, CUBBY, seed).map((u) => u.position[0]);
    expect(xs(5)).not.toEqual(xs(6));
  });

  it('shrinks units that cannot fit at full size', () => {
    expect(slotGrid('pack', 12, CUBBY).scale).toBe(1);
    expect(slotGrid('pack', 60, CUBBY).scale).toBeLessThan(1);
  });

  it('shows the first qty units, capped by capacity', () => {
    expect(visibleUnits(5, 12)).toBe(5);
    expect(visibleUnits(15, 12)).toBe(12);
    expect(visibleUnits(-1, 12)).toBe(0);
  });
});

describe('fixture slot cells', () => {
  const levels = [0.17, 0.74];
  const cells = shelfSlotCells(4, { width: 1.76, depth: 0.38, frontZ: 0.2 }, levels, 0.5);

  it('mirrors the Fixture Popover grid: two columns, slot 0 top-left', () => {
    expect(cells).toHaveLength(4);
    const [s0, s1, s2, s3] = cells;
    expect(s0?.y).toBe(0.74);
    expect(s1?.y).toBe(0.74);
    expect(s2?.y).toBe(0.17);
    expect(s0?.x).toBeLessThan(0);
    expect(s1?.x).toBeGreaterThan(0);
    expect(s3?.x).toBeCloseTo(s1?.x ?? 0);
  });

  it('keeps cells apart', () => {
    const [s0, s1] = cells;
    if (!s0 || !s1) throw new Error('cells');
    expect(s0.x + s0.width / 2).toBeLessThan(s1.x - s1.width / 2);
  });

  it('lays out case cards in two tiers of three', () => {
    const spots = caseSlotSpots(6, 1.8, 0.6, 0.45);
    expect(spots).toHaveLength(6);
    expect(spots[0]?.position[2]).toBeLessThan(spots[3]?.position[2] ?? 0);
    expect(spots[0]?.position[1]).toBeGreaterThan(spots[3]?.position[1] ?? 0);
    expect(spots[0]?.position[0]).toBeLessThan(spots[2]?.position[0] ?? 0);
  });
});
