/**
 * Procedural Peg-folk animation (docs/04 §4.4: "procedural, no rigs needed"). Pure functions
 * from (mode, time) to a target pose; `PegFolk` damps its joints towards the target every frame,
 * which gives smooth blends between modes for free.
 *
 * Joint conventions (character faces +z): negative `swing` moves a limb forward; `raise` lifts
 * an arm outwards to its own side; positive `lean` tips the body forward.
 */
export type PoseMode =
  | 'idle'
  | 'walk'
  | 'lookAround'
  | 'browse'
  | 'dig'
  | 'reach'
  | 'wait'
  | 'cheer'
  | 'wave'
  | 'register'
  /** Waiting too long: arms folded, foot tapping, a sigh of the shoulders. */
  | 'impatient';

export interface Pose {
  hop: number;
  lean: number;
  roll: number;
  twist: number;
  /** Vertical body scale (volume-preserving squash and stretch). */
  squash: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  armLSwing: number;
  armLRaise: number;
  armRSwing: number;
  armRRaise: number;
  legL: number;
  legR: number;
}

export const POSE_KEYS = [
  'hop',
  'lean',
  'roll',
  'twist',
  'squash',
  'headYaw',
  'headPitch',
  'headRoll',
  'armLSwing',
  'armLRaise',
  'armRSwing',
  'armRRaise',
  'legL',
  'legR',
] as const satisfies readonly (keyof Pose)[];

export function restPose(): Pose {
  return {
    hop: 0,
    lean: 0,
    roll: 0,
    twist: 0,
    squash: 1,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    armLSwing: 0,
    armLRaise: 0.12,
    armRSwing: 0,
    armRRaise: 0.12,
    legL: 0,
    legR: 0,
  };
}

export interface PoseInput {
  mode: PoseMode;
  /** Seconds since the mode started. */
  modeTime: number;
  /** Scene time in seconds (continuous, for idle loops). */
  time: number;
  /** Walk cycle phase in radians, advanced by distance so feet don't skate. */
  walkPhase: number;
  /** Per-character offset so a crowd doesn't breathe in sync. */
  seed: number;
  /**
   * Holding something in the right mitten (docs/04 §4.4 "carry"): while walking that arm stays
   * forward with a little bob instead of swinging, so the item doesn't fly around.
   */
  carrying?: boolean;
}

/** Walk step length: one full cycle (two steps) per this many metres. */
export const STRIDE_METRES = 0.62;

const REST: Readonly<Pose> = restPose();

/** Fills `out` with the target pose for the input. Allocation-free for per-frame use. */
export function computePose(input: PoseInput, out: Pose): Pose {
  const { mode, modeTime, walkPhase, seed } = input;
  const t = input.time + seed * 7.31;
  Object.assign(out, REST);

  // Idle breathing runs underneath every mode, so nobody ever freezes completely.
  const breath = Math.sin(t * 2.1);
  out.squash = 1 + breath * 0.014;
  out.armLRaise = 0.13 + breath * 0.025;
  out.armRRaise = 0.13 + breath * 0.025;
  out.headPitch = breath * 0.02;

  switch (mode) {
    case 'idle':
      out.headYaw = Math.sin(t * 0.37) * 0.12;
      break;
    case 'walk': {
      const s = Math.sin(walkPhase);
      out.legL = s * 0.62;
      out.legR = -s * 0.62;
      out.armLSwing = -s * 0.55;
      out.armRSwing = s * 0.55;
      out.hop = Math.abs(Math.cos(walkPhase)) * 0.035;
      out.roll = s * 0.06;
      out.lean = 0.07;
      out.headRoll = -s * 0.04;
      out.squash = 1 + Math.abs(Math.cos(walkPhase)) * 0.02;
      break;
    }
    case 'lookAround':
      // Slow scan with a little pause at each side: sin of a sin eases the ends.
      out.headYaw = Math.sin(Math.sin(t * 0.8) * 1.4) * 0.62;
      out.headPitch = -0.08;
      out.headRoll = Math.sin(t * 0.8) * 0.06;
      break;
    case 'browse':
      out.lean = 0.16;
      out.headPitch = -0.16 + Math.sin(t * 0.6) * 0.05;
      out.headYaw = Math.sin(t * 0.55) * 0.38;
      out.headRoll = 0.14 + Math.sin(t * 0.45) * 0.05;
      // Hand-to-chin "hmm" pose on the right arm.
      out.armRSwing = -2.15;
      out.armRRaise = 0.42;
      out.armLSwing = -0.2;
      break;
    case 'dig': {
      // Lean into the bin but keep the face up: the camera looks down from 35°.
      out.lean = 0.3;
      out.headPitch = 0.02;
      out.headYaw = Math.sin(t * 0.9) * 0.15;
      const rummage = Math.sin(t * 7.5);
      out.armLSwing = -0.95 + rummage * 0.35;
      out.armRSwing = -0.95 - rummage * 0.35;
      out.armLRaise = 0.25;
      out.armRRaise = 0.25;
      out.roll = rummage * 0.03;
      break;
    }
    case 'reach': {
      const up = Math.min(1, modeTime / 0.35);
      out.armRSwing = -2.75 * up;
      out.armRRaise = 0.18;
      out.armLSwing = -0.25;
      out.hop = 0.035 * up;
      out.squash = 1.05;
      out.headPitch = -0.38 * up;
      out.lean = -0.04;
      break;
    }
    case 'wait':
      // Happy weight-shifting while the owner rings things up.
      out.roll = Math.sin(t * 2.4) * 0.055;
      out.headRoll = -Math.sin(t * 2.4) * 0.07;
      out.hop = Math.max(0, Math.sin(t * 4.8)) * 0.012;
      out.armLSwing = 0.18;
      out.armRSwing = 0.18;
      break;
    case 'cheer': {
      // Hops every 0.5 s with anticipation squash before take-off and a stretch in the air.
      const period = 0.5;
      const p = (modeTime % period) / period;
      const air = Math.sin(p * Math.PI);
      out.hop = air * 0.2;
      out.squash = p < 0.12 || p > 0.92 ? 0.9 : 1 + air * 0.07;
      out.armLRaise = 2.55 + Math.sin(t * 16) * 0.12;
      out.armRRaise = 2.55 - Math.sin(t * 16) * 0.12;
      out.armLSwing = -0.2;
      out.armRSwing = -0.2;
      out.headPitch = -0.18;
      out.legL = -air * 0.3;
      out.legR = -air * 0.3;
      break;
    }
    case 'wave':
      out.armRRaise = 2.45 + Math.sin(t * 9) * 0.32;
      out.armRSwing = -0.25;
      out.headRoll = 0.1;
      out.headPitch = -0.05;
      break;
    case 'impatient': {
      // Arms folded over the tummy, a foot tapping twice a second, the odd huff.
      const tap = Math.max(0, Math.sin(t * 12.5));
      // Negative raise turns the arms inwards: folded across the tummy.
      out.armLSwing = -1.2;
      out.armRSwing = -1.25;
      out.armLRaise = -0.4;
      out.armRRaise = -0.4;
      out.legR = -tap * 0.22;
      out.hop = tap * 0.006;
      out.headRoll = Math.sin(t * 0.9) * 0.08;
      out.headPitch = -0.06 + Math.max(0, Math.sin(t * 0.7)) * 0.08;
      out.squash = 1 - Math.max(0, Math.sin(t * 0.7)) * 0.025;
      break;
    }
    case 'register': {
      const tap = Math.sin(t * 11);
      out.lean = 0.1;
      // A glance down at the keys, but mostly chatting with the customer.
      out.headPitch = 0.08 + Math.max(0, Math.sin(t * 1.3)) * 0.12;
      out.armLSwing = -1.05 + tap * 0.12;
      out.armRSwing = -1.05 - tap * 0.12;
      out.armLRaise = 0.3;
      out.armRRaise = 0.3;
      break;
    }
  }
  if (input.carrying && mode === 'walk') {
    // Carry: the right arm holds the item out front, bobbing with the steps.
    out.armRSwing = -0.95 + Math.abs(Math.cos(walkPhase)) * 0.08;
    out.armRRaise = 0.16;
  }
  return out;
}
