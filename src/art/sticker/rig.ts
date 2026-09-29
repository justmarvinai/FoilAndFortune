import type { CreatureGenome } from '@/content/schema/genome';
import type { Knot, Pt } from './core/path';
import type { Rng } from './core/rng';

/**
 * Skeleton anchors for a body plan, derived from the genome's proportions. Coordinates are the
 * creature's local units: a ~1000-unit box, y down, ground at `ground`. Every creature is drawn
 * in the same 3/4 view facing the viewer's left, lit from the top-left.
 */

/** Ellipse-like frame parts use for normalized coordinates (u, v ∈ about −1…1). */
export interface Frame {
  c: Pt;
  /** Half width. */
  a: number;
  /** Half height. */
  b: number;
}

export interface LegRig {
  top: Pt;
  foot: Pt;
  w: number;
  far: boolean;
  hind: boolean;
}

export type RigPlan = 'quadruped' | 'amphibian';
/** Quadrupeds either sit (fox/cat families: compact mascot pose) or stand (dogs & co). */
export type Stance = 'sit' | 'stand' | 'crawl';

export interface Rig {
  plan: RigPlan;
  stance: Stance;
  ground: number;
  head: Frame;
  /** Head tilt (degrees, + = clockwise) around `neck`. */
  tilt: number;
  neck: Pt;
  body: Frame;
  legs: LegRig[];
  /** Sitting haunch (near hind leg) for the `sit` stance. */
  haunch: Frame | null;
  tailRoot: Pt;
  /** Overall creature scale hint (genome.size), applied by the composer. */
  size: number;
}

/** Point in a frame's normalized coordinates. */
export function fp(f: Frame, u: number, v: number): Pt {
  return [f.c[0] + u * f.a, f.c[1] + v * f.b];
}

/** Knot in a frame's normalized coordinates (`k` = handle scale, 0 = corner). */
export function fk(f: Frame, u: number, v: number, k?: number): Knot {
  const x = f.c[0] + u * f.a;
  const y = f.c[1] + v * f.b;
  return k === undefined ? [x, y] : [x, y, k];
}

/** Which rig a body plan uses. Plans without a dedicated rig yet borrow the closest one. */
export function rigPlanFor(plan: CreatureGenome['plan']): RigPlan {
  switch (plan) {
    case 'amphibian':
    case 'serpent':
    case 'fish':
    case 'blob':
      return 'amphibian';
    default:
      return 'quadruped';
  }
}

const GROUND = 900;

function quadrupedSit(g: CreatureGenome, rng: Rng): Rig {
  const P = g.proportions;
  const bodyA = 128 + 70 * P.body;
  const bodyB = 150 + 50 * P.body;
  const body: Frame = { c: [520, GROUND - bodyB * 0.98], a: bodyA, b: bodyB };
  const headA = 196 + 44 * P.head;
  const headB = headA * 0.86;
  const bodyTop = body.c[1] - bodyB;
  const head: Frame = { c: [body.c[0] - bodyA * 0.62, bodyTop + 92 - headB], a: headA, b: headB };
  const bx = body.c[0];
  const by = body.c[1];
  const w = 66 + 24 * P.body;
  const legs: LegRig[] = [
    {
      top: [bx - bodyA * 0.98, by - bodyB * 0.05],
      foot: [bx - bodyA * 1.02, GROUND - 12],
      w: w * 0.9,
      far: true,
      hind: false,
    },
    {
      top: [bx - bodyA * 0.5, by + bodyB * 0.05],
      foot: [bx - bodyA * 0.6, GROUND],
      w,
      far: false,
      hind: false,
    },
  ];
  const haunchR = bodyB * (0.62 + 0.1 * P.legs);
  return {
    plan: 'quadruped',
    stance: 'sit',
    ground: GROUND,
    head,
    tilt: 6 + rng.range(-1.5, 1.5),
    neck: [head.c[0] + headA * 0.15, head.c[1] + headB * 0.75],
    body,
    legs,
    haunch: { c: [bx + bodyA * 0.32, GROUND - haunchR * 0.98], a: haunchR * 1.02, b: haunchR },
    tailRoot: [bx + bodyA * 0.7, GROUND - bodyB * 0.25],
    size: g.size,
  };
}

function quadrupedStand(g: CreatureGenome, rng: Rng): Rig {
  const P = g.proportions;
  const legLen = 40 + 56 * P.legs;
  const bodyA = 176 + 80 * P.body;
  const bodyB = 112 + 50 * P.body;
  const body: Frame = { c: [590, GROUND - legLen - bodyB], a: bodyA, b: bodyB };
  const headA = 190 + 50 * P.head;
  const headB = headA * 0.88;
  const bodyTop = body.c[1] - bodyB;
  const head: Frame = { c: [body.c[0] - bodyA * 0.74, bodyTop + 100 - headB], a: headA, b: headB };
  const bx = body.c[0];
  const by = body.c[1];
  const w = 80 + 30 * P.body;
  const legs: LegRig[] = [
    {
      top: [bx - bodyA * 0.8, by + bodyB * 0.35],
      foot: [bx - bodyA * 0.86, GROUND - 14],
      w: w * 0.9,
      far: true,
      hind: false,
    },
    {
      top: [bx + bodyA * 0.34, by + bodyB * 0.35],
      foot: [bx + bodyA * 0.32, GROUND - 14],
      w: w * 0.9,
      far: true,
      hind: true,
    },
    {
      top: [bx - bodyA * 0.46, by + bodyB * 0.45],
      foot: [bx - bodyA * 0.5, GROUND],
      w,
      far: false,
      hind: false,
    },
    {
      top: [bx + bodyA * 0.62, by + bodyB * 0.2],
      foot: [bx + bodyA * 0.66, GROUND],
      w,
      far: false,
      hind: true,
    },
  ];
  return {
    plan: 'quadruped',
    stance: 'stand',
    ground: GROUND,
    head,
    tilt: 5 + rng.range(-1.5, 1.5),
    neck: [head.c[0] + headA * 0.15, head.c[1] + headB * 0.8],
    body,
    legs,
    haunch: null,
    tailRoot: [bx + bodyA * 0.84, by - bodyB * 0.45],
    size: g.size,
  };
}

function amphibian(g: CreatureGenome, rng: Rng): Rig {
  const P = g.proportions;
  const legLen = 34 + 90 * P.legs;
  const bodyA = 160 + 90 * P.body;
  const bodyB = 92 + 44 * P.body;
  const body: Frame = { c: [580, GROUND - legLen - bodyB * 0.9], a: bodyA, b: bodyB };
  const headA = 206 + 70 * P.head;
  const headB = headA * 0.62;
  const head: Frame = {
    c: [body.c[0] - bodyA * 0.82, body.c[1] - bodyB * 0.62 - headB * 0.3],
    a: headA,
    b: headB,
  };
  const bx = body.c[0];
  const by = body.c[1];
  const w = 60 + 22 * P.body;
  const legs: LegRig[] = [
    {
      top: [bx - bodyA * 0.72, by + bodyB * 0.3],
      foot: [bx - bodyA * 0.98, GROUND - 16],
      w: w * 0.88,
      far: true,
      hind: false,
    },
    {
      top: [bx + bodyA * 0.3, by + bodyB * 0.35],
      foot: [bx + bodyA * 0.2, GROUND - 16],
      w: w * 0.88,
      far: true,
      hind: true,
    },
    {
      top: [bx - bodyA * 0.38, by + bodyB * 0.5],
      foot: [bx - bodyA * 0.56, GROUND],
      w,
      far: false,
      hind: false,
    },
    {
      top: [bx + bodyA * 0.58, by + bodyB * 0.45],
      foot: [bx + bodyA * 0.5, GROUND],
      w,
      far: false,
      hind: true,
    },
  ];
  return {
    plan: 'amphibian',
    stance: 'crawl',
    ground: GROUND,
    head,
    tilt: -4 + rng.range(-1.5, 1.5),
    neck: [head.c[0] + headA * 0.35, head.c[1] + headB * 0.6],
    body,
    legs,
    haunch: null,
    tailRoot: [bx + bodyA * 0.84, by - bodyB * 0.05],
    size: g.size,
  };
}

export function buildRig(g: CreatureGenome, rng: Rng): Rig {
  if (rigPlanFor(g.plan) === 'amphibian') return amphibian(g, rng);
  const sits = g.head.shape === 'fox' || g.head.shape === 'feline';
  return sits ? quadrupedSit(g, rng) : quadrupedStand(g, rng);
}
