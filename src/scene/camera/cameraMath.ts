import { Vector3 } from 'three';

/**
 * Pure maths for the isometric diorama camera (docs/04 §4.1): orthographic, ≈35° elevation,
 * 45° azimuth, rotating in 90° steps, auto-framed to the diorama's bounds.
 */
export const ISO_ELEVATION = (35 * Math.PI) / 180;
export const BASE_AZIMUTH = Math.PI / 4;
export const QUARTER_TURN = Math.PI / 2;

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Azimuth for a rotation step. Steps are unbounded integers so animations take the short way. */
export function azimuthForStep(step: number): number {
  return BASE_AZIMUTH + step * QUARTER_TURN;
}

/** Normalises any integer step to the 0–3 camera angle. */
export function angleIndex(step: number): 0 | 1 | 2 | 3 {
  const i = ((Math.round(step) % 4) + 4) % 4;
  return i as 0 | 1 | 2 | 3;
}

/** Unit vector from the look-at point towards the camera. */
export function viewDirection(azimuth: number, elevation: number, out = new Vector3()): Vector3 {
  const c = Math.cos(elevation);
  return out.set(Math.sin(azimuth) * c, Math.sin(elevation), Math.cos(azimuth) * c);
}

const WORLD_UP = new Vector3(0, 1, 0);

/** Screen-right and screen-up axes (world space) for a camera looking along -direction. */
export function screenAxes(direction: Vector3, right: Vector3, up: Vector3): void {
  right.crossVectors(WORLD_UP, direction).normalize();
  up.crossVectors(direction, right).normalize();
}

export interface Extents {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const tmp = new Vector3();

/** Bounds of `points` projected onto the screen axes, relative to `origin`, in world units. */
export function projectExtents(
  points: readonly Vector3[],
  origin: Vector3,
  right: Vector3,
  up: Vector3,
  out: Extents,
): Extents {
  out.minX = Number.POSITIVE_INFINITY;
  out.maxX = Number.NEGATIVE_INFINITY;
  out.minY = Number.POSITIVE_INFINITY;
  out.maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    tmp.subVectors(p, origin);
    const x = tmp.dot(right);
    const y = tmp.dot(up);
    out.minX = Math.min(out.minX, x);
    out.maxX = Math.max(out.maxX, x);
    out.minY = Math.min(out.minY, y);
    out.maxY = Math.max(out.maxY, y);
  }
  return out;
}

/** Orthographic zoom (pixels per world unit) that fits `extents` in the free viewport. */
export function fitZoom(
  extents: Extents,
  width: number,
  height: number,
  insets: Insets,
  margin: number,
): number {
  const freeW = Math.max(40, width - insets.left - insets.right);
  const freeH = Math.max(40, height - insets.top - insets.bottom);
  const extW = Math.max(0.01, extents.maxX - extents.minX) * (1 + margin);
  const extH = Math.max(0.01, extents.maxY - extents.minY) * (1 + margin);
  return Math.min(freeW / extW, freeH / extH);
}

/** The eight corners of an axis-aligned box. */
export function boxCorners(
  min: readonly [number, number, number],
  max: readonly [number, number, number],
): Vector3[] {
  const corners: Vector3[] = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) corners.push(new Vector3(x, y, z));
    }
  }
  return corners;
}
