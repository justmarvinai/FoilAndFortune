import { type Knot, mapKnot, Path, type Pt } from '../core/path';
import { taper } from '../core/shapes';
import { fillPath, form } from '../draw';
import { Z } from '../sheet';
import type { Build, HeadInfo } from './kit';

/**
 * Ears (genome.ears). Shapes are authored in an ear-local frame: x across the base (−1 inner
 * side … +1 outer side), y along the ear from the base (0) to the tip (1), then placed at the
 * head's ear anchors. The far ear is mirrored, narrower and a step darker.
 */
export function drawEars(b: Build, head: HeadInfo): void {
  switch (b.g.ears.shape) {
    case 'none':
      return;
    case 'pointed':
    case 'long':
      pointedEars(b, head, b.g.ears.shape === 'long');
      return;
    case 'round':
      roundEars(b, head);
      return;
    case 'floppy':
      floppyEars(b, head);
      return;
    case 'fin':
      finEars(b, head);
      return;
  }
}

interface EarFrame {
  base: Pt;
  /** Direction from base to tip, degrees. */
  dir: number;
  width: number;
  len: number;
  /** Mirror x so +x is always the outer side. */
  mirror: boolean;
}

function earKnots(f: EarFrame, knots: readonly Knot[]): Knot[] {
  const a = (f.dir * Math.PI) / 180;
  const d: Pt = [Math.cos(a), Math.sin(a)];
  const s: Pt = [-d[1], d[0]];
  const m = f.mirror ? -1 : 1;
  return knots.map((k) => {
    const x = k[0] * m * (f.width / 2);
    const y = k[1] * f.len;
    const p: Pt = [f.base[0] + s[0] * x + d[0] * y, f.base[1] + s[1] * x + d[1] * y];
    return k.length === 3 ? [p[0], p[1], k[2]] : p;
  });
}

function earPath(f: EarFrame, knots: readonly Knot[]): Path {
  return Path.smooth(earKnots(f, knots));
}

const POINTED: readonly Knot[] = [
  [-1.0, -0.14],
  [-0.94, 0.3],
  [-0.58, 0.72],
  [-0.08, 1.0, 0.16],
  [0.4, 0.7],
  [0.84, 0.36],
  [1.0, -0.14],
];

const POINTED_INNER: readonly Knot[] = [
  [-0.62, 0.0],
  [-0.58, 0.32],
  [-0.34, 0.68],
  [-0.1, 0.86, 0.14],
  [0.2, 0.62],
  [0.52, 0.3],
  [0.6, 0.0],
];

function pointedEars(b: Build, head: HeadInfo, long: boolean): void {
  const { paint, ctx } = b;
  const h = b.rig.head;
  const size = b.g.ears.size;
  const len = h.b * (0.55 + 0.78 * size) * (long ? 1.35 : 1);
  const width = h.a * (0.42 + 0.3 * size) * (long ? 0.8 : 1);
  const color = paint.ref(b.g.ears.color);
  const inner = paint.ref(b.g.ears.innerColor);
  const fluff = paint.secondary;
  const draw = (f: EarFrame, far: boolean) => {
    const shape = earPath(f, POINTED);
    // Turned away, the far ear shows less of its inside, shifted toward the face.
    const innerKnots = far
      ? POINTED_INNER.map((k) => mapKnot(k, (p) => [p[0] * 0.66 - 0.22, p[1] * 0.96]))
      : POINTED_INNER;
    const innerShape = earPath(f, innerKnots);
    const fur = [-0.3, 0.05, 0.36].map((x, i) =>
      fillPath(
        taper(
          earKnots(f, [
            [x * (far ? 0.66 : 1) - (far ? 0.22 : 0), -0.02],
            [x * 0.8 * (far ? 0.66 : 1) - (far ? 0.22 : 0) + 0.04, 0.2 + (i === 1 ? 0.1 : 0.04)],
            [x * 0.6 * (far ? 0.66 : 1) - (far ? 0.22 : 0) + 0.1, 0.3 + (i === 1 ? 0.12 : 0.04)],
          ]),
          width * 0.12,
          { start: 0.9, end: 0, swell: 0.6 },
        ),
        fluff,
      ),
    );
    const svg = form(ctx, {
      shape,
      fill: far ? paint.far(color) : color,
      inside: [fillPath(innerShape, far ? paint.far(inner) : inner), ...fur],
      shadow: width * 0.16,
    });
    b.sheet.put(far ? Z.farEar : Z.ear, svg, shape);
  };
  draw(
    { base: head.earBase.far, dir: -110, width: width * 0.86, len: len * 0.97, mirror: true },
    true,
  );
  draw({ base: head.earBase.near, dir: -74, width, len, mirror: false }, false);
}

function roundEars(b: Build, head: HeadInfo): void {
  const { paint, ctx } = b;
  const h = b.rig.head;
  const r = h.a * (0.18 + 0.18 * b.g.ears.size);
  const color = paint.ref(b.g.ears.color);
  const inner = paint.ref(b.g.ears.innerColor);
  const pairs: [Pt, boolean][] = [
    [head.earBase.far, true],
    [head.earBase.near, false],
  ];
  for (const [p, far] of pairs) {
    const shape = Path.ellipse(p[0], p[1] - r * 0.5, r * (far ? 0.85 : 1), r, far ? -12 : 12);
    const innerShape = Path.ellipse(
      p[0],
      p[1] - r * 0.4,
      r * 0.55 * (far ? 0.8 : 1),
      r * 0.6,
      far ? -12 : 12,
    );
    b.sheet.put(
      far ? Z.farEar : Z.ear,
      form(ctx, {
        shape,
        fill: far ? paint.far(color) : color,
        inside: [fillPath(innerShape, inner)],
      }),
      shape,
    );
  }
}

const FLOPPY: readonly Knot[] = [
  [-0.78, -0.06],
  [-0.62, 0.42],
  [-0.4, 0.84],
  [0.04, 1.0, 1.1],
  [0.6, 0.86],
  [0.95, 0.44],
  [0.72, -0.04],
];

function floppyEars(b: Build, head: HeadInfo): void {
  const { paint, ctx } = b;
  const h = b.rig.head;
  const size = b.g.ears.size;
  const len = h.b * (0.5 + 0.5 * size);
  const width = h.a * (0.38 + 0.2 * size);
  const color = paint.ref(b.g.ears.color);
  const draw = (f: EarFrame, far: boolean) => {
    const shape = earPath(f, FLOPPY);
    // A fold crease near the root sells the "flop".
    const crease = taper(
      earKnots(f, [
        [-0.35, 0.1],
        [-0.05, 0.3],
        [0.1, 0.52],
      ]),
      width * 0.07,
      { start: 0.1, end: 0.05 },
    );
    const svg = form(ctx, {
      shape,
      fill: far ? paint.far(color) : color,
      shadow: width * 0.22,
      over: far ? [] : [fillPath(crease, paint.line(color))],
    });
    b.sheet.put(far ? Z.farEar : Z.frontEar, svg, shape);
  };
  // Hanging ears point down, which flips the ear frame: mirror the near ear to keep +x outward.
  draw(
    { base: head.earBase.far, dir: 104, width: width * 0.85, len: len * 0.9, mirror: false },
    true,
  );
  draw({ base: head.earBase.near, dir: 78, width, len, mirror: true }, false);
}

function finEars(b: Build, head: HeadInfo): void {
  const { paint, ctx } = b;
  const h = b.rig.head;
  const len = h.b * (0.5 + 0.5 * b.g.ears.size);
  const color = paint.ref(b.g.ears.color);
  const knots: readonly Knot[] = [
    [-0.8, 0],
    [-0.6, 0.6],
    [0.0, 1.0, 0],
    [0.5, 0.55],
    [0.8, 0],
  ];
  const pairs: [EarFrame, boolean][] = [
    [{ base: head.sides.far, dir: -150, width: len * 0.8, len: len * 0.85, mirror: true }, true],
    [{ base: head.sides.near, dir: -20, width: len * 0.9, len, mirror: false }, false],
  ];
  for (const [f, far] of pairs) {
    const shape = earPath(f, knots);
    b.sheet.put(
      far ? Z.farEar : Z.ear,
      form(ctx, { shape, fill: far ? paint.far(color) : color }),
      shape,
    );
  }
}
