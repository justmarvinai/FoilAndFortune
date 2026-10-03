/**
 * Small pure helpers behind the stage's motion (docs/04 §9): the torn edge of a wrapper, screen
 * shake and the card flip. Pure so they're unit-tested and cheap to call from event handlers.
 */

/** The tear runs just below the top crimp (the crimp is 11/160 of the wrapper art). */
export const TEAR_Y = 0.085;

/** Deterministic 0–1 noise (no Math.random: the same pack always tears the same way). */
function noise(i: number, seed: number): number {
  const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A jagged tear line across the wrapper as [x, y] fractions, left to right. */
export function tearLine(teeth = 16, amplitude = 0.011, seed = 7): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= teeth; i++) {
    const x = i / teeth;
    const zig = i % 2 === 0 ? -amplitude : amplitude;
    const jitter = (noise(i, seed) - 0.5) * amplitude;
    points.push([x, TEAR_Y + zig + jitter]);
  }
  return points;
}

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

/**
 * Complementary `clip-path` polygons for the strip that tears off and the body that stays. Both
 * share the same jagged line, so the sealed pack looks whole. The outer edges overshoot a little
 * so the crimp's teeth and the outline stroke are never cut.
 */
export function tearClipPaths(line: readonly [number, number][]): { top: string; body: string } {
  const along = line.map(([x, y]) => `${pct(x === 0 ? -0.04 : x === 1 ? 1.04 : x)} ${pct(y)}`);
  const top = `polygon(-4% -4%, 104% -4%, ${[...along].reverse().join(', ')})`;
  const body = `polygon(${along.join(', ')}, 104% 104%, -4% 104%)`;
  return { top, body };
}

const SHAKE: readonly [number, number][] = [
  [1, -0.6],
  [-0.9, 0.8],
  [0.75, -1],
  [-0.6, 0.55],
  [0.42, -0.4],
  [-0.26, 0.3],
  [0.12, -0.12],
  [0, 0],
];

/** A short decaying screen shake (big hits only; off with reduced motion or the setting). */
export function shakeKeyframes(intensity: number, maxPx = 14): Keyframe[] {
  const amp = Math.max(0, Math.min(1, intensity)) * maxPx;
  return [
    { transform: 'translate(0px, 0px) rotate(0deg)' },
    ...SHAKE.map(([x, y]) => ({
      transform: `translate(${(x * amp).toFixed(1)}px, ${(y * amp).toFixed(1)}px) rotate(${(
        x * amp * 0.07
      ).toFixed(2)}deg)`,
    })),
  ];
}

export interface FlipFrom {
  /** Offset from the landing spot to where the card starts (the stack), in px. */
  dx: number;
  dy: number;
  /** Start scale relative to the landing size. */
  scale: number;
}

const t = (dx: number, dy: number, scale: number, rotate: number) =>
  `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(3)}) rotateY(${rotate}deg)`;

/**
 * The card flies from the stack to the spotlight while flipping face-up. Slow motion (Illustration
 * Rare and up) charges on the stack, trembles, then hangs edge-on before snapping face-up.
 */
export function flipKeyframes(from: FlipFrom, slowMo: boolean): Keyframe[] {
  const { dx, dy, scale } = from;
  const mid = (scale + 1) / 2;
  if (!slowMo) {
    return [
      { offset: 0, transform: t(dx, dy, scale, 180), easing: 'cubic-bezier(.3,.7,.4,1)' },
      { offset: 0.5, transform: t(dx * 0.3, dy * 0.3 - 28, mid * 1.06, 92) },
      { offset: 1, transform: t(0, 0, 1, 0), easing: 'ease-out' },
    ];
  }
  return [
    { offset: 0, transform: t(dx, dy, scale, 180) },
    { offset: 0.1, transform: t(dx, dy - 10, scale * 1.06, 180) },
    { offset: 0.15, transform: t(dx + 4, dy - 12, scale * 1.06, 180) },
    { offset: 0.2, transform: t(dx - 4, dy - 9, scale * 1.06, 180) },
    { offset: 0.25, transform: t(dx + 2, dy - 11, scale * 1.07, 180), easing: 'ease-in' },
    { offset: 0.46, transform: t(dx * 0.15, dy * 0.15 - 36, 1.08, 100), easing: 'linear' },
    { offset: 0.8, transform: t(0, -30, 1.1, 82), easing: 'cubic-bezier(.2,1.5,.4,1)' },
    { offset: 1, transform: t(0, 0, 1, 0) },
  ];
}
