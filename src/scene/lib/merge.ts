import {
  BufferAttribute,
  type BufferGeometry,
  Color,
  type ColorRepresentation,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * One piece of a static, merged model. Fixtures are described as lists of parts and baked into
 * a single vertex-coloured geometry, so a whole counter or shelf costs one draw call (plus one
 * per shadow pass) instead of dozens. Parts are built from the cached primitives in
 * `geometry.ts`.
 */
export type PartColor =
  | ColorRepresentation
  | ((x: number, y: number, z: number) => ColorRepresentation);

export interface Part {
  geometry: BufferGeometry;
  /** A flat colour, or a function of the part's *local* vertex position (colour blocking). */
  color: PartColor;
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number];
}

export type Vec3 = readonly [number, number, number];

const tmpColor = new Color();
const tmpMatrix = new Matrix4();
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpEuler = new Euler();

const KEEP = new Set(['position', 'normal', 'uv']);

function preparePart(part: Part, forceNonIndexed: boolean): BufferGeometry {
  let geometry = part.geometry.clone();
  for (const name of Object.keys(geometry.attributes)) {
    if (!KEEP.has(name)) geometry.deleteAttribute(name);
  }
  if (forceNonIndexed && geometry.index) {
    const flat = geometry.toNonIndexed();
    geometry.dispose();
    geometry = flat;
  }
  const position = geometry.getAttribute('position');
  if (!geometry.getAttribute('uv')) {
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(position.count * 2), 2));
  }
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();

  // Colours go in as linear working-space values, which is what the shader expects for
  // `vertexColors` (three converts the hex/CSS input from sRGB for us). Evaluated in local
  // space, before the part's transform, so colour-blocking functions stay simple.
  const colors = new Float32Array(position.count * 3);
  const colorOf = part.color;
  if (typeof colorOf === 'function') {
    for (let i = 0; i < position.count; i++) {
      tmpColor.set(colorOf(position.getX(i), position.getY(i), position.getZ(i)));
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
  } else {
    tmpColor.set(colorOf);
    for (let i = 0; i < position.count; i++) {
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));

  const [px, py, pz] = part.position ?? [0, 0, 0];
  const [rx, ry, rz] = part.rotation ?? [0, 0, 0];
  const [sx, sy, sz] = part.scale ?? [1, 1, 1];
  tmpPos.set(px, py, pz);
  tmpQuat.setFromEuler(tmpEuler.set(rx, ry, rz));
  tmpScale.set(sx, sy, sz);
  geometry.applyMatrix4(tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
  return geometry;
}

/** Bakes parts into one geometry with a `color` attribute. Caller owns (and disposes) it. */
export function mergeParts(parts: readonly Part[]): BufferGeometry {
  if (parts.length === 0) throw new Error('mergeParts: no parts');
  const mixedIndexing = parts.some((p) => p.geometry.index === null);
  const prepared = parts.map((part) => preparePart(part, mixedIndexing));
  const merged = mergeGeometries(prepared, false);
  for (const geometry of prepared) geometry.dispose();
  if (!merged) throw new Error('mergeParts: incompatible geometries');
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

const mergedCache = new Map<string, BufferGeometry>();

/**
 * Cached `mergeParts`: static fixtures and character looks are deterministic, so each distinct
 * key is baked once and shared (also across StrictMode double-mounts and remounts).
 */
export function cachedMerge(key: string, build: () => readonly Part[]): BufferGeometry {
  const hit = mergedCache.get(key);
  if (hit) return hit;
  const geometry = mergeParts(build());
  mergedCache.set(key, geometry);
  return geometry;
}
