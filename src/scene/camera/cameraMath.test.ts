import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  angleIndex,
  azimuthForStep,
  BASE_AZIMUTH,
  boxCorners,
  type Extents,
  fitZoom,
  ISO_ELEVATION,
  NO_INSETS,
  projectExtents,
  screenAxes,
  viewDirection,
} from './cameraMath';

describe('isometric camera maths', () => {
  it('steps in quarter turns from the 45° base azimuth', () => {
    expect(azimuthForStep(0)).toBeCloseTo(BASE_AZIMUTH);
    expect(azimuthForStep(2) - azimuthForStep(0)).toBeCloseTo(Math.PI);
    expect(azimuthForStep(-1)).toBeCloseTo(BASE_AZIMUTH - Math.PI / 2);
  });

  it('normalises any step to a 0–3 angle index', () => {
    expect(angleIndex(0)).toBe(0);
    expect(angleIndex(5)).toBe(1);
    expect(angleIndex(-1)).toBe(3);
    expect(angleIndex(-6)).toBe(2);
  });

  it('views from ~35° above the horizon', () => {
    const dir = viewDirection(azimuthForStep(0), ISO_ELEVATION);
    expect(dir.length()).toBeCloseTo(1);
    expect(Math.asin(dir.y)).toBeCloseTo((35 * Math.PI) / 180);
    // Step 0 looks from the south-east (+x, +z) corner of the shop.
    expect(dir.x).toBeGreaterThan(0);
    expect(dir.z).toBeGreaterThan(0);
  });

  it('builds an orthonormal screen basis', () => {
    const dir = viewDirection(1.1, ISO_ELEVATION);
    const right = new Vector3();
    const up = new Vector3();
    screenAxes(dir, right, up);
    expect(right.length()).toBeCloseTo(1);
    expect(up.length()).toBeCloseTo(1);
    expect(right.dot(up)).toBeCloseTo(0);
    expect(right.dot(dir)).toBeCloseTo(0);
    expect(right.y).toBeCloseTo(0); // no roll: horizon stays level
    expect(up.y).toBeGreaterThan(0);
  });

  it('fits projected extents and respects UI insets', () => {
    const dir = viewDirection(azimuthForStep(0), ISO_ELEVATION);
    const right = new Vector3();
    const up = new Vector3();
    screenAxes(dir, right, up);
    const extents: Extents = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    projectExtents(boxCorners([-3, 0, -2.5], [3, 2.5, 2.5]), new Vector3(), right, up, extents);
    expect(extents.maxX).toBeGreaterThan(0);
    expect(extents.minX).toBeCloseTo(-extents.maxX);
    const free = fitZoom(extents, 1440, 900, NO_INSETS, 0);
    const withHeader = fitZoom(extents, 1440, 900, { ...NO_INSETS, top: 90 }, 0);
    expect(withHeader).toBeLessThan(free);
    // The fitted content never exceeds the free viewport.
    expect((extents.maxY - extents.minY) * withHeader).toBeLessThanOrEqual(810 + 1e-6);
    expect((extents.maxX - extents.minX) * withHeader).toBeLessThanOrEqual(1440 + 1e-6);
  });
});
