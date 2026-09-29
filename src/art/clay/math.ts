/**
 * Tiny vector/matrix kit for the Clay renderer's CPU side (scene building, camera framing,
 * particle projection). Kept dependency-free so the renderer doesn't pull in three.js.
 */

export type Vec3 = readonly [number, number, number];
/** Row-major 3×3 matrix: `m[row * 3 + col]`. */
export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const vec3 = (x: number, y: number, z: number): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const mul = (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l > 1e-9 ? scale(a, 1 / l) : [0, 0, 0];
};
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const mirrorZ = (a: Vec3): Vec3 => [a[0], a[1], -a[2]];

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
export const deg = (d: number): number => (d * Math.PI) / 180;

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mulMV(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function mulMM(a: Mat3, b: Mat3): Mat3 {
  const r: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r.push(
        (a[i * 3] ?? 0) * (b[j] ?? 0) +
          (a[i * 3 + 1] ?? 0) * (b[3 + j] ?? 0) +
          (a[i * 3 + 2] ?? 0) * (b[6 + j] ?? 0),
      );
    }
  }
  return r as unknown as Mat3;
}

export function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/** Right-handed rotations (angle in radians). */
export function rotX(a: number): Mat3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
export function rotY(a: number): Mat3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
export function rotZ(a: number): Mat3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** Matrix whose columns are the given axes (maps local → parent). */
export function fromAxes(x: Vec3, y: Vec3, z: Vec3): Mat3 {
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

/**
 * Orthonormal frame (local → parent) whose local +Y points along `dir`, with local +X as close
 * as possible to `hintX`. Used to orient ears, flames and fins along a direction.
 */
export function frameAlongY(dir: Vec3, hintX: Vec3): Mat3 {
  const y = normalize(dir);
  let x = sub(hintX, scale(y, dot(hintX, y)));
  if (length(x) < 1e-5) x = Math.abs(y[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  x = normalize(x);
  const z = cross(x, y);
  return fromAxes(x, y, z);
}

/** Frame (local → parent) whose local +X points along `dir`, with +Y close to `hintY`. */
export function frameAlongX(dir: Vec3, hintY: Vec3): Mat3 {
  const x = normalize(dir);
  let y = sub(hintY, scale(x, dot(hintY, x)));
  if (length(y) < 1e-5) y = [0, 1, 0];
  y = normalize(y);
  const z = cross(x, y);
  return fromAxes(x, y, z);
}

/** Point on a unit sphere from yaw (around +Y, toward −Z for positive yaw) and pitch. */
export function dirYawPitch(yaw: number, pitch: number): Vec3 {
  return [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw)];
}

// ---------------------------------------------------------------------------------------------
// GLSL literal formatting. Generated shader code bakes scene constants, so numbers must always
// be valid GLSL float literals (a decimal point, no exponent, no "-0").

export function glf(n: number): string {
  if (!Number.isFinite(n)) return '0.0';
  const rounded = Math.round(n * 1e5) / 1e5;
  if (Object.is(rounded, -0) || rounded === 0) return '0.0';
  const s = rounded.toFixed(5).replace(/0+$/, '');
  return s.endsWith('.') ? `${s}0` : s;
}

export function glVec3(v: Vec3): string {
  return `vec3(${glf(v[0])}, ${glf(v[1])}, ${glf(v[2])})`;
}

/** GLSL `mat3` literal equal to the row-major matrix `m` (GLSL constructors are column-major). */
export function glMat3(m: Mat3): string {
  const c = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]].map(glf).join(', ');
  return `mat3(${c})`;
}

/** Column-major Float32Array for `uniformMatrix3fv`. */
export function mat3Uniform(m: Mat3): Float32Array {
  return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
}
