import { describe, expect, it } from 'vitest';
import { computePose, POSE_KEYS, type Pose, type PoseMode, restPose } from './motion';

const MODES: readonly PoseMode[] = [
  'idle',
  'walk',
  'lookAround',
  'browse',
  'dig',
  'reach',
  'wait',
  'cheer',
  'wave',
  'register',
];

function pose(mode: PoseMode, time: number, walkPhase = 0, modeTime = time): Pose {
  return computePose({ mode, modeTime, time, walkPhase, seed: 0.3 }, restPose());
}

describe('procedural Peg-folk poses', () => {
  it('produces finite, bounded joints for every mode over time', () => {
    for (const mode of MODES) {
      for (let t = 0; t < 6; t += 0.37) {
        const p = pose(mode, t, t * 9);
        for (const key of POSE_KEYS) {
          expect(Number.isFinite(p[key]), `${mode}.${key}`).toBe(true);
          expect(Math.abs(p[key]), `${mode}.${key}`).toBeLessThan(Math.PI);
        }
        // Squash and stretch stays gentle (volume-preserving scale in PegFolk).
        expect(p.squash).toBeGreaterThan(0.8);
        expect(p.squash).toBeLessThan(1.2);
        expect(p.hop).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('walks with opposite legs and counter-swinging arms', () => {
    const p = pose('walk', 1, Math.PI / 2);
    expect(p.legL).toBeCloseTo(-p.legR);
    expect(Math.sign(p.armLSwing)).toBe(-Math.sign(p.legL));
    expect(Math.abs(p.legL)).toBeGreaterThan(0.3);
  });

  it('cheers with both arms up and hops off the ground', () => {
    const hops = Array.from({ length: 20 }, (_, i) => pose('cheer', i * 0.05).hop);
    expect(Math.max(...hops)).toBeGreaterThan(0.1);
    const p = pose('cheer', 0.2);
    expect(p.armLRaise).toBeGreaterThan(2);
    expect(p.armRRaise).toBeGreaterThan(2);
  });

  it('keeps faces towards the high camera while digging (no deep head pitch)', () => {
    for (let t = 0; t < 3; t += 0.25) expect(pose('dig', t).headPitch).toBeLessThan(0.15);
  });

  it('never allocates a new pose object', () => {
    const out = restPose();
    const result = computePose(
      { mode: 'wave', modeTime: 0.4, time: 2, walkPhase: 0, seed: 1 },
      out,
    );
    expect(result).toBe(out);
  });
});
