/**
 * Frame-rate independent smoothing and easing helpers for procedural animation. Pure functions,
 * no three.js, so they are trivially unit-testable.
 */

/** Exponential smoothing towards `target`. `lambda` ≈ 1 / time-constant (higher = snappier). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Shortest signed angle from `a` to `b` in radians, in (-π, π]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Like `damp`, but takes the short way round the circle. */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + angleDelta(current, target) * (1 - Math.exp(-lambda * dt));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Overshoots slightly past 1 before settling: the "toy pop" feel. */
export function easeOutBack(t: number, overshoot = 1.70158): number {
  const c3 = overshoot + 1;
  return 1 + c3 * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

/**
 * Critically damped spring step. Mutates and returns `state` so callers can keep one object per
 * animated value without allocating per frame. Used for bouncy things (bell, hops, squash).
 */
export interface SpringState {
  value: number;
  velocity: number;
}

export function springStep(
  state: SpringState,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): SpringState {
  // Semi-implicit Euler, sub-stepped so large frame gaps (tab switch, slow SwiftShader) stay stable.
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const force = (target - state.value) * stiffness - state.velocity * damping;
    state.velocity += force * h;
    state.value += state.velocity * h;
  }
  return state;
}
