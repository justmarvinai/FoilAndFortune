import { describe, expect, it } from 'vitest';
import type { AgentActivity } from '@/sim/state/types';
import {
  BUBBLE_ICON,
  bubbleShown,
  buildPath,
  expressionFor,
  moodFor,
  placeAgent,
  poseFor,
  progress,
  roundCorners,
  sampleAt,
  worldPathFor,
  yawTowards,
} from './agentMath';

const grid = { w: 6, d: 5 };

describe('paths', () => {
  it('samples a polyline at constant speed with headings', () => {
    const path = buildPath([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 1 },
    ]);
    expect(path.length).toBeCloseTo(3);
    expect(sampleAt(path, 1)).toMatchObject({ x: 1, z: 0 });
    expect(sampleAt(path, 1).yaw).toBeCloseTo(Math.PI / 2); // walking +x
    const late = sampleAt(path, 2.5);
    expect(late.x).toBeCloseTo(2);
    expect(late.z).toBeCloseTo(0.5);
    expect(late.yaw).toBeCloseTo(0); // walking +z
    expect(sampleAt(path, 99)).toMatchObject({ x: 2, z: 1 });
    expect(sampleAt(path, -1)).toMatchObject({ x: 0, z: 0 });
  });

  it('rounds tile-path corners but keeps both ends', () => {
    const raw = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    ];
    const round = roundCorners(raw, 0.3);
    expect(round[0]).toEqual({ x: 0, z: 0 });
    expect(round[round.length - 1]).toEqual({ x: 1, z: 1 });
    expect(round.length).toBeGreaterThan(raw.length);
    // The corner is cut: no point sits on the sharp corner itself.
    expect(round.some((p) => p.x === 1 && p.z === 0)).toBe(false);
    // Smoothing only shortens the walk slightly.
    expect(buildPath(round).length).toBeLessThan(2);
    expect(buildPath(round).length).toBeGreaterThan(1.8);
  });

  it('leaves straight runs and duplicate points alone', () => {
    const straight = roundCorners([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
    ]);
    expect(straight).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
    ]);
  });

  it('clamps activity progress', () => {
    expect(progress(10, 20, 5)).toBe(0);
    expect(progress(10, 20, 15)).toBe(0.5);
    expect(progress(10, 20, 25)).toBe(1);
    expect(progress(10, 10, 10)).toBe(1);
  });

  it('caches world paths per sim path', () => {
    const path = [
      { x: 0.5, z: 0.5 },
      { x: 1.5, z: 0.5 },
    ];
    expect(worldPathFor(path, grid)).toBe(worldPathFor(path, grid));
    expect(worldPathFor(path, grid).points[0]).toEqual({ x: -2.5, z: -2 });
  });
});

describe('agent placement from activity and sim time', () => {
  const walk = {
    kind: 'walk' as const,
    path: [
      { x: 0.5, z: 3.5 },
      { x: 2.5, z: 3.5 },
    ],
    startMinute: 100,
    endMinute: 104,
  };

  it('interpolates walks between ticks', () => {
    const half = placeAgent(walk, 102, grid);
    expect(half.stance).toBe('walk');
    expect(half.x).toBeCloseTo(-1.5); // grid x 1.5 → world -1.5
    expect(half.z).toBeCloseTo(1);
    expect(half.yaw).toBeCloseTo(Math.PI / 2);
    const fraction = placeAgent(walk, 100.5, grid);
    expect(fraction.x).toBeCloseTo(-2.25);
  });

  it('stands at the end of a finished walk until the next tick', () => {
    const done = placeAgent(walk, 104.6, grid);
    expect(done.stance).toBe('stand');
    expect(done.x).toBeCloseTo(-0.5);
  });

  it('lingers at the pay spot while a future leave has not started', () => {
    const leave: AgentActivity = { ...walk, kind: 'leave', startMinute: 110, endMinute: 118 };
    const paid = placeAgent(leave, 109.5, grid);
    expect(paid.stance).toBe('paid');
    expect(paid.x).toBeCloseTo(-2.5);
    expect(paid.yaw).toBeNull();
    expect(placeAgent(leave, 114, grid).stance).toBe('walk');
  });

  it('browses facing the fixture and reaches as the browse ends', () => {
    const browse: AgentActivity = {
      kind: 'browse',
      fixtureUid: 'shelf-a',
      at: { x: 0.5, z: 1.5 },
      facing: { x: 0.5, z: 0.5 },
      startMinute: 50,
      endMinute: 55,
    };
    const early = placeAgent(browse, 51, grid);
    expect(early.stance).toBe('browse');
    expect(early.yaw).toBeCloseTo(Math.PI); // facing north (−z)
    expect(
      poseFor({ stance: 'browse', moving: false, browse: early.browse, bubble: null, mood: null }),
    ).toBe('browse');
    const late = placeAgent(browse, 54.6, grid);
    expect(
      poseFor({ stance: 'browse', moving: false, browse: late.browse, bubble: null, mood: null }),
    ).toBe('reach');
  });

  it('queues facing the register, the pay spot first', () => {
    const queue = (laneIndex: number): AgentActivity => ({
      kind: 'queue',
      laneIndex,
      at: { x: 4.5, z: 2.5 + laneIndex },
      facing: { x: 4.5, z: 1.5 + laneIndex },
      sinceMinute: 0,
    });
    expect(placeAgent(queue(0), 3, grid).stance).toBe('pay');
    expect(placeAgent(queue(1), 3, grid).stance).toBe('queue');
    expect(placeAgent(queue(0), 3, grid).yaw).toBeCloseTo(Math.PI);
  });

  it('faces points with yaw 0 towards +z', () => {
    expect(yawTowards({ x: 0, z: 0 }, { x: 0, z: 1 })).toBeCloseTo(0);
    expect(yawTowards({ x: 0, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(Math.PI / 2);
  });
});

describe('bubbles, faces and poses', () => {
  it('hides bubbles after untilMinute', () => {
    expect(bubbleShown(null, 5)).toBeNull();
    expect(bubbleShown({ kind: 'cart', sinceMinute: 1 }, 500)).toBe('cart');
    expect(bubbleShown({ kind: 'fair', sinceMinute: 1, untilMinute: 4 }, 3.9)).toBe('fair');
    expect(bubbleShown({ kind: 'fair', sinceMinute: 1, untilMinute: 4 }, 4)).toBeNull();
  });

  it('has an icon for every bubble kind', () => {
    for (const icon of Object.values(BUBBLE_ICON)) expect(icon).toBeTruthy();
  });

  it('reads moods from satisfaction', () => {
    expect(moodFor(2.5)).toBe('delighted');
    expect(moodFor(1)).toBe('happy');
    expect(moodFor(0)).toBe('neutral');
    expect(moodFor(-1)).toBe('annoyed');
    expect(moodFor(-3)).toBe('angry');
  });

  it('lets bubbles lead the face, then the mood, then the context', () => {
    const base = { bubble: null, stance: 'walk' as const, mood: null, kid: false, carrying: false };
    expect(expressionFor({ ...base, bubble: 'angry' })).toBe('angry');
    expect(expressionFor({ ...base, bubble: 'delight' })).toBe('starry');
    expect(expressionFor({ ...base, bubble: 'waiting' })).toBe('annoyed');
    expect(expressionFor({ ...base, mood: 'annoyed' })).toBe('annoyed');
    expect(expressionFor({ ...base, mood: 'happy', bubble: 'ripoff' })).toBe('angry');
    expect(expressionFor({ ...base, stance: 'browse' })).toBe('thinking');
    expect(expressionFor({ ...base, kid: true })).toBe('happy');
    expect(expressionFor(base)).toBe('neutral');
  });

  it('walks while moving and gets impatient in a slow line', () => {
    const base = { stance: 'queue' as const, moving: false, browse: 0, bubble: null, mood: null };
    expect(poseFor({ ...base, moving: true })).toBe('walk');
    expect(poseFor(base)).toBe('wait');
    expect(poseFor({ ...base, bubble: 'waiting' })).toBe('impatient');
    expect(poseFor({ ...base, stance: 'paid', bubble: 'delight' })).toBe('cheer');
    expect(poseFor({ ...base, stance: 'stand' })).toBe('idle');
  });
});
