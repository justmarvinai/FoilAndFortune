import type { Rgb } from '../color';
import type { Mat3, Vec3 } from '../math';

/**
 * Renderer-side scene description compiled from a CreatureGenome (see genomeToScene.ts).
 * It's plain data: `sceneToGlsl` turns it into shader code, `stage.ts` uses its bounds for
 * framing. Adding a species should mostly mean writing a new genome, not touching this.
 */

/** Signed-distance primitives, in the coordinates of the group that owns them. */
export type Shape =
  | { type: 'sphere'; c: Vec3; r: number }
  /** `rot` maps shape-local → group coordinates (optional). */
  | { type: 'ellipsoid'; c: Vec3; r: Vec3; rot?: Mat3 }
  | { type: 'roundCone'; a: Vec3; b: Vec3; ra: number; rb: number }
  /**
   * Tapered round cone along local +Y (height `h`), flattened along local X by `thin` (<1) and
   * curled toward +X by `bend`. Ears, flames, gill fronds and fins.
   */
  | {
      type: 'leaf';
      c: Vec3;
      rot: Mat3;
      h: number;
      ra: number;
      rb: number;
      thin: number;
      bend: number;
    }
  /** Quadratic Bezier tube with a base/middle/tip radius profile (tails). */
  | { type: 'tube'; a: Vec3; b: Vec3; c: Vec3; r: Vec3 }
  /** Tube plus a vertical fin sheet whose height follows `fin` (axolotl tail). */
  | { type: 'finTube'; a: Vec3; b: Vec3; c: Vec3; r: Vec3; fin: Vec3; thick: number }
  /**
   * Pillowy four-point twinkle facing local +Z (spark tail tip). `pinch` < 1 is the
   * superellipse exponent: lower = thinner, more concave arms.
   */
  | { type: 'star4'; c: Vec3; rot: Mat3; r: number; pinch: number; thick: number };

/** Shading model family; mirrors the `kind` field of the GLSL `Mat` struct. */
export type SurfaceKind = 'fur' | 'glossy' | 'eye' | 'emissive' | 'fin';

export interface Surface {
  kind: SurfaceKind;
  /** Linear albedo. */
  color: Rgb;
  /** Linear emitted radiance (HDR; > 1 blooms after tone mapping). */
  emit?: Rgb;
  rough?: number;
  spec?: number;
  /** Subsurface/wrap amount 0..1 (soft vinyl look). */
  sss?: number;
  /**
   * Two-color ramp along the part: Bezier `t` for tubes, normalized height for leaves.
   * Used for flame cores and glowing tail tips.
   */
  ramp?: { color: Rgb; emit?: Rgb; from: number; to: number };
}

/** Semantic part tags so paint layers can target e.g. only legs or only the body. */
export const PART_TAGS = {
  body: 1,
  head: 2,
  muzzle: 3,
  cheek: 4,
  ear: 5,
  leg: 6,
  paw: 7,
  tail: 8,
  eye: 9,
  nose: 10,
  ruff: 11,
  tuft: 12,
  gill: 13,
  fin: 14,
  flame: 15,
  spark: 16,
} as const;
export type PartTag = keyof typeof PART_TAGS;

export interface Part {
  name: string;
  shape: Shape;
  /** Smooth-union radius against earlier parts of the group (0 = hard union). */
  blend: number;
  /** `carve` smoothly subtracts the shape (inner ears, mouths). */
  op?: 'add' | 'carve';
  surface: Surface;
  tag: PartTag;
}

/** Coordinate frame a group is authored in. `head` follows the (uniform-driven) head pose. */
export type Frame = 'body' | 'head';

export interface Group {
  name: string;
  frame: Frame;
  /** Bilateral symmetry: evaluated with |z|, so parts are authored for the +z side only. */
  mirror: boolean;
  /** Bounding sphere (group coordinates) used to skip the group cheaply when far away. */
  bound: { c: Vec3; r: number };
  /** Smooth-union radius used when merging this group into the creature. */
  blend: number;
  parts: Part[];
  /**
   * GLSL paint layers run in the material pass after the group's parts are merged. Available:
   * `q` (group coords, mirrored), `qn` (normal in group coords), `side` (±1), `mg` (Mat).
   */
  paints: string[];
}

/** A glowing element (spark tip, flame): drives the screen-space bloom and a point light. */
export interface Emitter {
  frame: Frame;
  /** Position in the emitter's frame. */
  pos: Vec3;
  color: Rgb;
  /** World-space radius of the glow halo. */
  radius: number;
  intensity: number;
  /** Strength of the point light it casts on nearby surfaces. */
  light: number;
}

/** Default head pose (radians) applied around `headCenter`; seeds jitter it per render. */
export interface HeadPose {
  /** Turn toward the viewer (positive = toward body −z, the camera side). */
  yaw: number;
  /** Nod: positive lifts the face. */
  pitch: number;
  /** Cute head tilt around the facing axis. */
  roll: number;
}

export interface CreatureScene {
  /** Stable key for program caching (derived from the genome). */
  key: string;
  groups: Group[];
  emitters: Emitter[];
  /** Head pivot in body coordinates; head-frame groups follow the head pose around it. */
  headCenter: Vec3;
  headPose: HeadPose;
  /** Head radius, used to keep the face comfortably inside the frame. */
  headRadius: number;
}
