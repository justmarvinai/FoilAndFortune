import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  clamp01,
  damp,
  dampAngle,
  easeOutBack,
  smoothstep,
  springStep,
} from './easing';

describe('easing helpers', () => {
  it('damp converges on the target and is frame-rate independent', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 10, 5, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = damp(b, 10, 5, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
    expect(a).toBeGreaterThan(9.9);
  });

  it('angleDelta takes the short way round', () => {
    expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angleDelta(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
    expect(angleDelta(-3, 3)).toBeCloseTo(6 - Math.PI * 2);
    expect(Math.abs(angleDelta(1, 1 + Math.PI * 6))).toBeLessThan(1e-9);
  });

  it('dampAngle never spins the long way', () => {
    const next = dampAngle(Math.PI - 0.05, -Math.PI + 0.05, 10, 0.05);
    expect(next).toBeGreaterThan(Math.PI - 0.05);
  });

  it('smoothstep and clamp01 stay within [0, 1]', () => {
    for (const x of [-5, 0, 0.3, 0.5, 1, 7]) {
      expect(clamp01(x)).toBeGreaterThanOrEqual(0);
      expect(clamp01(x)).toBeLessThanOrEqual(1);
      expect(smoothstep(0, 1, x)).toBeGreaterThanOrEqual(0);
      expect(smoothstep(0, 1, x)).toBeLessThanOrEqual(1);
    }
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it('easeOutBack overshoots then lands on 1', () => {
    expect(easeOutBack(0)).toBeCloseTo(0);
    expect(easeOutBack(1)).toBeCloseTo(1);
    const peak = Math.max(...Array.from({ length: 50 }, (_, i) => easeOutBack(i / 49)));
    expect(peak).toBeGreaterThan(1);
  });

  it('springStep settles even with huge frame gaps', () => {
    const s = { value: 1, velocity: 0 };
    for (let i = 0; i < 20; i++) springStep(s, 0, 90, 12, 0.5);
    expect(Math.abs(s.value)).toBeLessThan(1e-3);
    expect(Number.isFinite(s.velocity)).toBe(true);
  });
});
