import type { GridSize } from '@/content/shop/geometry';
import type { Point } from '@/sim/nav';
import type { AgentActivity, AgentBubble, BubbleKind } from '@/sim/state/types';
import type { Expression } from '../agents/faces';
import type { PoseMode } from '../agents/motion';
import type { BubbleIcon } from '../overlay/overlayRegistry';
import { gridPointToWorld, type XZ } from './layoutMath';

/**
 * Pure customer animation maths (docs/06 §5.6 "the view animates the agent along the same path,
 * interpolating between sim ticks"). Everything is a function of the agent's activity and the
 * continuous sim time (`simNow()`, game-minutes), so it needs no per-frame React state and is
 * unit-tested here.
 */

// ---------------------------------------------------------------------------------------------
// Paths

/** A polyline in world metres with cumulative lengths, for constant-speed sampling. */
export interface WorldPath {
  points: XZ[];
  /** `cumulative[i]` = distance from the start to `points[i]`. */
  cumulative: number[];
  length: number;
}

export function buildPath(points: readonly XZ[]): WorldPath {
  const cumulative: number[] = [];
  let length = 0;
  points.forEach((point, i) => {
    const prev = points[i - 1];
    if (prev) length += Math.hypot(point.x - prev.x, point.z - prev.z);
    cumulative.push(length);
  });
  return { points: [...points], cumulative, length };
}

/**
 * Rounds the corners of a tile path (4-connected zigzags) with quadratic arcs of up to `radius`,
 * so walkers turn smoothly instead of pivoting on the spot. Start and end points are kept, so
 * the walk still begins and ends exactly where the sim says.
 */
export function roundCorners(points: readonly XZ[], radius = 0.32, steps = 5): XZ[] {
  // Drop zero-length steps first (a path may repeat a point).
  const clean: XZ[] = [];
  for (const p of points) {
    const last = clean[clean.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 1e-6) clean.push({ x: p.x, z: p.z });
  }
  if (clean.length < 3) return clean;
  const out: XZ[] = [clean[0] as XZ];
  for (let i = 1; i < clean.length - 1; i++) {
    const a = clean[i - 1] as XZ;
    const b = clean[i] as XZ;
    const c = clean[i + 1] as XZ;
    const inLen = Math.hypot(b.x - a.x, b.z - a.z);
    const outLen = Math.hypot(c.x - b.x, c.z - b.z);
    const din = { x: (b.x - a.x) / inLen, z: (b.z - a.z) / inLen };
    const dout = { x: (c.x - b.x) / outLen, z: (c.z - b.z) / outLen };
    const straight =
      Math.abs(din.x * dout.z - din.z * dout.x) < 1e-6 && din.x * dout.x + din.z * dout.z > 0;
    if (straight) {
      out.push(b);
      continue;
    }
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const p0 = { x: b.x - din.x * r, z: b.z - din.z * r };
    const p2 = { x: b.x + dout.x * r, z: b.z + dout.z * r };
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      out.push({
        x: u * u * p0.x + 2 * u * t * b.x + t * t * p2.x,
        z: u * u * p0.z + 2 * u * t * b.z + t * t * p2.z,
      });
    }
  }
  out.push(clean[clean.length - 1] as XZ);
  return out;
}

/** Point and heading (yaw, radians; 0 faces +z) at `distance` along a path. */
export function sampleAt(path: WorldPath, distance: number): { x: number; z: number; yaw: number } {
  const { points, cumulative, length } = path;
  const first = points[0];
  if (!first) return { x: 0, z: 0, yaw: 0 };
  if (points.length === 1) return { x: first.x, z: first.z, yaw: 0 };
  const d = Math.min(Math.max(distance, 0), length);
  // Binary search for the segment containing d.
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((cumulative[mid] ?? 0) <= d) lo = mid;
    else hi = mid;
  }
  const a = points[lo] as XZ;
  const b = points[hi] as XZ;
  const segment = (cumulative[hi] ?? 0) - (cumulative[lo] ?? 0);
  const t = segment > 1e-9 ? (d - (cumulative[lo] ?? 0)) / segment : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    yaw: Math.atan2(b.x - a.x, b.z - a.z),
  };
}

/** Linear progress of a timed activity, clamped to 0…1. */
export function progress(startMinute: number, endMinute: number, now: number): number {
  const span = endMinute - startMinute;
  if (span <= 0) return now >= startMinute ? 1 : 0;
  return Math.min(1, Math.max(0, (now - startMinute) / span));
}

/** Yaw that faces from `from` to `to` (0 = +z). */
export function yawTowards(from: XZ, to: XZ): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

const pathCache = new WeakMap<readonly Point[], WorldPath>();

/**
 * The smoothed world path of a sim path (grid points), cached per path array: Immer keeps the
 * same array while the activity is unchanged, so this runs once per walk.
 */
export function worldPathFor(path: readonly Point[], grid: GridSize): WorldPath {
  const hit = pathCache.get(path);
  if (hit) return hit;
  const built = buildPath(roundCorners(path.map((p) => gridPointToWorld(p, grid))));
  pathCache.set(path, built);
  return built;
}

// ---------------------------------------------------------------------------------------------
// Placement

/**
 * What the body is doing, independent of mood: walking, standing at a fixture, in line, at the
 * pay spot, lingering after paying, or just standing (a walk that finished before the next tick).
 */
export type Stance = 'walk' | 'browse' | 'queue' | 'pay' | 'paid' | 'stand';

export interface AgentPlacement {
  x: number;
  z: number;
  /** Target yaw, or null to keep the current one. */
  yaw: number | null;
  stance: Stance;
  /** Progress through a browse (0…1), for the reach at the end; 0 otherwise. */
  browse: number;
  /** World path being walked (walk/leave), for door checks and ghosts. */
  path: WorldPath | null;
  /** Distance along `path`. */
  along: number;
}

/** Where an agent is and what it's doing at sim time `now` (game-minutes). */
export function placeAgent(activity: AgentActivity, now: number, grid: GridSize): AgentPlacement {
  switch (activity.kind) {
    case 'walk':
    case 'leave': {
      const path = worldPathFor(activity.path, grid);
      if (activity.kind === 'leave' && now < activity.startMinute) {
        // Paid and lingering at the pay spot while the owner bags the items (docs/02 §14).
        const at = sampleAt(path, 0);
        return { x: at.x, z: at.z, yaw: null, stance: 'paid', browse: 0, path, along: 0 };
      }
      const p = progress(activity.startMinute, activity.endMinute, now);
      const along = p * path.length;
      const at = sampleAt(path, along);
      return {
        x: at.x,
        z: at.z,
        yaw: path.length > 1e-6 ? at.yaw : null,
        stance: p >= 1 ? 'stand' : 'walk',
        browse: 0,
        path,
        along,
      };
    }
    case 'browse': {
      const at = gridPointToWorld(activity.at, grid);
      return {
        x: at.x,
        z: at.z,
        yaw: yawTowards(at, gridPointToWorld(activity.facing, grid)),
        stance: 'browse',
        browse: progress(activity.startMinute, activity.endMinute, now),
        path: null,
        along: 0,
      };
    }
    case 'queue': {
      const at = gridPointToWorld(activity.at, grid);
      return {
        x: at.x,
        z: at.z,
        yaw: yawTowards(at, gridPointToWorld(activity.facing, grid)),
        stance: activity.laneIndex === 0 ? 'pay' : 'queue',
        browse: 0,
        path: null,
        along: 0,
      };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Bubbles, faces and poses

/** A bubble shows from when it's set until `untilMinute` (if any). */
export function bubbleShown(bubble: AgentBubble | null, now: number): BubbleKind | null {
  if (!bubble) return null;
  if (bubble.untilMinute !== undefined && now >= bubble.untilMinute) return null;
  return bubble.kind;
}

/** The intent icon drawn for each sim bubble (overlay/IntentIcons.tsx). */
export const BUBBLE_ICON: Readonly<Record<BubbleKind, BubbleIcon>> = {
  search: 'search',
  cart: 'cart',
  waiting: 'wait',
  angry: 'angry',
  delight: 'heart',
  outOfStock: 'empty',
  steal: 'steal',
  fair: 'fair',
  pricey: 'pricey',
  ripoff: 'ripoff',
};

/** How a visit went, from `customer/left` (satisfaction is −3…+3, docs/02 §5.4). */
export type Mood = 'delighted' | 'happy' | 'neutral' | 'annoyed' | 'angry';

export function moodFor(satisfaction: number): Mood {
  if (satisfaction >= 2) return 'delighted';
  if (satisfaction >= 0.75) return 'happy';
  if (satisfaction > -0.75) return 'neutral';
  if (satisfaction > -2) return 'annoyed';
  return 'angry';
}

const BUBBLE_FACE: Readonly<Record<BubbleKind, Expression>> = {
  search: 'thinking',
  cart: 'happy',
  waiting: 'annoyed',
  angry: 'angry',
  delight: 'starry',
  outOfStock: 'surprised',
  steal: 'excited',
  fair: 'happy',
  pricey: 'annoyed',
  ripoff: 'angry',
};

const MOOD_FACE: Readonly<Record<Mood, Expression>> = {
  delighted: 'excited',
  happy: 'happy',
  neutral: 'neutral',
  annoyed: 'annoyed',
  angry: 'angry',
};

export interface FaceInput {
  bubble: BubbleKind | null;
  stance: Stance;
  /** Set once the visit is scored (`customer/left`). */
  mood: Mood | null;
  kid: boolean;
  carrying: boolean;
}

/** The face for the moment: the bubble speaks loudest, then how the visit went, then context. */
export function expressionFor(input: FaceInput): Expression {
  if (input.bubble) return BUBBLE_FACE[input.bubble];
  if (input.mood) return MOOD_FACE[input.mood];
  switch (input.stance) {
    case 'browse':
      return 'thinking';
    case 'pay':
    case 'paid':
      return 'happy';
    case 'queue':
      return input.carrying ? 'happy' : 'neutral';
    default:
      return input.kid || input.carrying ? 'happy' : 'neutral';
  }
}

export interface PoseInput {
  stance: Stance;
  moving: boolean;
  browse: number;
  bubble: BubbleKind | null;
  mood: Mood | null;
}

/** The procedural pose (agents/motion.ts) for a stance and mood. */
export function poseFor(input: PoseInput): PoseMode {
  if (input.moving) return 'walk';
  switch (input.stance) {
    case 'browse':
      // Picking happens as the browse ends: reach for the shelf in its last stretch.
      return input.browse > 0.84 ? 'reach' : 'browse';
    case 'queue':
    case 'pay':
      return input.bubble === 'waiting' || input.bubble === 'angry' ? 'impatient' : 'wait';
    case 'paid':
      return input.bubble === 'delight' || input.mood === 'delighted' ? 'cheer' : 'wait';
    default:
      return input.bubble === 'angry' || input.bubble === 'ripoff' ? 'impatient' : 'idle';
  }
}
