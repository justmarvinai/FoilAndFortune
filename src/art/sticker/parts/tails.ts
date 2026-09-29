import { item, type Knot, knot, mapKnot, Path, type Pt } from '../core/path';
import { type Frame, frames, offset, sparkle, taper } from '../core/shapes';
import { fillPath, form, glowDisc } from '../draw';
import { Z } from '../sheet';
import type { Build } from './kit';

/** Where a tail ended up, so the composer can aim element FX at it. */
export interface TailInfo {
  tip: Pt;
  glow: { c: Pt; r: number; color: string } | null;
}

/** Tails (genome.tail). Every tail grows from `rig.tailRoot`, behind the body. */
export function drawTail(b: Build): TailInfo | null {
  switch (b.g.tail.shape) {
    case 'none':
      return null;
    case 'spark':
    case 'bolt':
      return plumeTail(b, true);
    case 'fluffy':
    case 'curl':
      return plumeTail(b, false);
    case 'flame':
      return flameTail(b);
    case 'fin':
    case 'leaf':
      return finTail(b);
  }
}

function rel(root: Pt, len: number, pts: readonly Knot[]): Knot[] {
  return pts.map((k) => mapKnot(k, (p) => [root[0] + p[0] * len, root[1] + p[1] * len]));
}

/** Big fluffy fox-style plume; `spark` swaps the cream tip for a glowing 4-point star. */
function plumeTail(b: Build, spark: boolean): TailInfo {
  const { paint, ctx } = b;
  const root = b.rig.tailRoot;
  const size = b.g.tail.size;
  const sit = b.rig.stance === 'sit';
  const len = (sit ? b.rig.body.b * 2.45 : b.rig.body.b * 2.6) * (0.75 + 0.5 * size);
  const W = len * 0.4;
  // Line of action: sweeps out behind the body, rises, and flicks the tip back over.
  const center = rel(
    root,
    len,
    sit
      ? [
          [0, 0],
          [0.2, -0.08],
          [0.33, -0.3],
          [0.36, -0.58],
          [0.46, -0.86],
        ]
      : [
          [0, 0],
          [0.2, -0.16],
          [0.3, -0.44],
          [0.22, -0.7],
          [0.04, -0.86],
        ],
  );
  const n = 17;
  const fr = frames(center, n);
  // Teardrop plume: slim at the root, swelling into a big round bulb near the tip.
  // A spark tail narrows to a point that disappears inside the star's waist.
  const widthAt = spark
    ? (u: number) => W * (0.22 + 0.78 * Math.sin(Math.PI * Math.min(1, 0.08 + u * 0.92)) ** 0.7)
    : (u: number) => W * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, 0.08 + u * 0.74)) ** 0.75);
  const outerTufts = new Set(spark ? [5, 9] : [8, 12]);
  const innerTufts = new Set<number>(spark ? [] : [12]);
  const left: Knot[] = [];
  const right: Knot[] = [];
  fr.forEach((f, i) => {
    if (i === n - 1) return;
    const w = widthAt(f.u) / 2;
    if (innerTufts.has(i)) {
      left.push(
        knot(offset(f, len * 0.06, w + W * 0.14), 0),
        knot(offset(f, len * 0.075, w * 0.82), 0.45),
      );
    } else {
      left.push(offset(f, 0, w));
    }
    // Soft fur clumps along the outer (convex) edge, sweeping toward the tip.
    if (outerTufts.has(i)) {
      right.push(
        knot(offset(f, len * 0.065, -w - W * 0.16), 0),
        knot(offset(f, len * 0.08, -w * 0.8), 0.45),
      );
    } else {
      right.push(offset(f, 0, -w));
    }
  });
  const last = item(fr, n - 1);
  const tip = offset(last, W * 0.12, 0);
  const rootBack = offset(item(fr, 0), -W * 0.4, 0);
  // Blunt, fluffy end: the tip is a rounded knot flanked by two small tufts.
  const tipW = widthAt(1) / 2;
  const shape = Path.smooth([
    rootBack,
    ...left,
    knot(offset(last, W * 0.02, tipW * 0.9), 0),
    knot(offset(last, W * 0.06, tipW * 0.4), 0.5),
    knot(tip, 0),
    knot(offset(last, W * 0.06, -tipW * 0.4), 0.5),
    knot(offset(last, W * 0.02, -tipW * 0.9), 0),
    ...right.reverse(),
  ]);
  const tipColor = paint.ref(b.g.tail.tipColor);
  const band = tipBand(fr, spark ? 0.8 : 0.78, W, len);
  const color = paint.ref(b.g.tail.color);
  // Fur strands inside the plume, following the flow.
  const strands = [0.28, 0.44, 0.58].map((u, i) => {
    const f = frameAt(fr, u);
    const w = widthAt(u) / 2;
    const side = [-0.45, 0.25, -0.1][i] ?? 0;
    return fillPath(
      taper(
        [
          offset(f, -len * 0.06, w * side),
          offset(f, len * 0.02, w * (side - 0.08)),
          offset(f, len * 0.07, w * (side - 0.28)),
        ],
        ctx.lw.detail,
        {
          start: 0.7,
          end: 0,
        },
      ),
      paint.line(color),
    );
  });
  const glossLine = [0.22, 0.4, 0.58].map((u) => {
    const f = frameAt(fr, u);
    return offset(f, 0, widthAt(u) * 0.3);
  });
  const svg = form(ctx, {
    shape,
    fill: color,
    inside: [fillPath(band, tipColor)],
    shadow: W * 0.2,
    gloss: [taper(glossLine, W * 0.08, { start: 0.1, end: 0.1 })],
    over: strands,
  });
  b.sheet.put(Z.tail, svg, shape);
  if (!spark) return { tip, glow: null };
  // The spark: a fat 4-point star bursting from the tip, glowing.
  const dir = (Math.atan2(last.t[1], last.t[0]) * 180) / Math.PI;
  const r = W * 0.64;
  const c = offset(last, r * 0.12, 0);
  const star = sparkle(c, r, { inner: 0.34, rot: dir + 8 });
  const starCore = sparkle(c, r * 0.5, { inner: 0.32, rot: dir + 8 });
  const starSvg = form(ctx, {
    shape: star,
    fill: paint.glow,
    inside: [fillPath(starCore, '#FFFFFF')],
    shadow: r * 0.14,
  });
  b.sheet.put(Z.tail - 2, glowDisc(ctx, c, r * 2.2, paint.glow, 0.8));
  b.sheet.put(Z.tail + 1, starSvg, star);
  return { tip: c, glow: { c, r: r * 2.2, color: paint.glow } };
}

function frameAt(fr: readonly Frame[], u: number): Frame {
  const i = Math.min(fr.length - 1, Math.max(0, Math.round(u * (fr.length - 1))));
  return item(fr, i);
}

/** Region covering the tail from `u` to the tip, with a furry zigzag edge. */
function tipBand(fr: readonly Frame[], u: number, W: number, len: number): Path {
  const f = frameAt(fr, u);
  const tip = item(fr, fr.length - 1);
  const zig: Knot[] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const side = W * (0.75 - (1.5 * i) / steps);
    const tooth = i % 2 === 1;
    zig.push(knot(offset(f, tooth ? -len * 0.07 : len * 0.01, side), tooth ? 0 : 0.6));
  }
  return Path.smooth([
    knot(offset(f, len * 0.1, W * 2), 0),
    ...zig,
    knot(offset(f, len * 0.1, -W * 2), 0),
    knot(offset(tip, len * 0.5, -W * 2), 0),
    knot(offset(tip, len * 0.5, W * 2), 0),
  ]);
}

const FLAME: readonly Knot[] = [
  [0.0, -0.06],
  [-0.36, 0.06],
  [-0.5, 0.28],
  [-0.46, 0.52],
  [-0.52, 0.72],
  [-0.46, 0.9],
  [-0.3, 1.04, 0],
  [-0.25, 0.87],
  [-0.14, 0.74, 0.6],
  [-0.03, 0.84],
  [0.04, 0.94, 0],
  [0.1, 0.8],
  [0.14, 0.62, 0.6],
  [0.27, 0.66],
  [0.38, 0.74, 0],
  [0.4, 0.57],
  [0.37, 0.4],
  [0.4, 0.2],
  [0.3, 0.04],
];

/** Flame tail: orange tongues around a yellow core (Emberpup). */
function flameTail(b: Build): TailInfo {
  const { paint, ctx } = b;
  const root = b.rig.tailRoot;
  const size = b.g.tail.size;
  const H = b.rig.body.b * (1.35 + 1.5 * size);
  const W = H * 0.72;
  const lean = (-60 * Math.PI) / 180;
  const up: Pt = [Math.cos(lean), Math.sin(lean)];
  const across: Pt = [-up[1], up[0]];
  const map = (p: Pt): Pt => {
    // Tongues curl back toward the body, like a flame licking in a breeze.
    const x = p[0] - 0.42 * p[1] * p[1] + 0.08 * Math.sin(p[1] * Math.PI * 1.5);
    return [
      root[0] + up[0] * p[1] * H + across[0] * x * W,
      root[1] + up[1] * p[1] * H + across[1] * x * W,
    ];
  };
  const layer = (s: number, dy: number) =>
    Path.smooth(
      FLAME.map((k) => mapKnot(k, (p) => map([p[0] * s, dy + (p[1] + 0.08) * s - 0.08]))),
    );
  const outer = layer(1, 0);
  const mid = layer(0.72, 0.02);
  const core = layer(0.46, 0.04);
  const heart = layer(0.24, 0.06);
  const outerColor = paint.ref(b.g.tail.color);
  const tipColor = paint.ref(b.g.tail.tipColor);
  const svg = form(ctx, {
    shape: outer,
    fill: outerColor,
    inside: [
      fillPath(mid, paint.mix(outerColor, tipColor, 0.5)),
      fillPath(core, tipColor),
      fillPath(heart, paint.light(tipColor, 0.12)),
    ],
    shadow: W * 0.1,
  });
  const center = map([0, 0.45]);
  b.sheet.put(Z.tail - 2, glowDisc(ctx, center, H * 0.75, tipColor, 0.55));
  b.sheet.put(Z.tail, svg, outer);
  return { tip: map([-0.26, 1]), glow: { c: center, r: H * 0.75, color: tipColor } };
}

/** Axolotl-style paddle: muscular tail with a lighter fin membrane and a colored tip. */
function finTail(b: Build): TailInfo {
  const { paint, ctx } = b;
  const root = b.rig.tailRoot;
  const size = b.g.tail.size;
  const len = b.rig.body.a * (0.6 + 0.7 * size);
  const baseW = b.rig.body.b * 1.1;
  const center = rel(root, len, [
    [-0.05, 0.02],
    [0.34, -0.02],
    [0.66, -0.18],
    [0.88, -0.44],
    [0.94, -0.74],
  ]);
  const n = 14;
  const fr = frames(center, n);
  const bodyW = (u: number) => baseW * (1 - 0.78 * u) * 0.5;
  // Fins swell toward the end into a rounded paddle.
  const finTop = (u: number) =>
    bodyW(u) + baseW * (0.06 + 0.5 * Math.sin(Math.PI * Math.min(1, 0.1 + u * 0.75)) ** 1.2);
  const finBottom = (u: number) =>
    bodyW(u) + baseW * 0.4 * Math.sin(Math.PI * Math.min(1, 0.05 + u * 0.8)) ** 1.5;
  const top: Knot[] = [];
  const bottom: Knot[] = [];
  for (const f of fr) {
    // Soft ripples on the fin edge.
    const ripple = 1 + 0.06 * Math.sin(f.u * Math.PI * 7);
    top.push(offset(f, 0, finTop(f.u) * ripple));
    bottom.push(offset(f, 0, -finBottom(f.u) * ripple));
  }
  const last = item(fr, n - 1);
  const tipPt = offset(last, baseW * 0.42, 0);
  const fin = Path.smooth([...top, [tipPt[0], tipPt[1], 1.6], ...bottom.reverse()]);
  const muscle = Path.smooth([
    ...fr.slice(0, n - 2).map((f) => offset(f, 0, bodyW(f.u))),
    offset(item(fr, n - 2), baseW * 0.1, 0),
    ...fr
      .slice(0, n - 2)
      .reverse()
      .map((f) => offset(f, 0, -bodyW(f.u))),
  ]);
  const membrane = paint.mix(paint.ref(b.g.tail.color), paint.glow, 0.6);
  const tipColor = paint.ref(b.g.tail.tipColor);
  const tipRegion = Path.smooth([
    knot(offset(frameAt(fr, 0.62), 0, baseW * 2), 0),
    offset(frameAt(fr, 0.66), 0, baseW * 0.4),
    offset(frameAt(fr, 0.78), 0, 0),
    offset(frameAt(fr, 0.66), 0, -baseW * 0.4),
    knot(offset(frameAt(fr, 0.62), 0, -baseW * 2), 0),
    knot(offset(last, len, -baseW * 2), 0),
    knot(offset(last, len, baseW * 2), 0),
  ]);
  // Short fin rays near the edge hint at a soft, translucent membrane.
  const rays = [0.3, 0.46, 0.62].flatMap((u) => {
    const f = frameAt(fr, u);
    const ray = (a: number, b2: number, sign: 1 | -1) =>
      fillPath(
        taper([offset(f, 0, sign * a), offset(f, len * 0.05, sign * b2)], ctx.lw.detail * 0.9, {
          start: 0.2,
          end: 0.6,
        }),
        paint.line(membrane),
        { 'fill-opacity': 0.55 },
      );
    return [
      ray(finTop(u) * 0.55, finTop(u) * 0.85, 1),
      ray(finBottom(u) * 0.6, finBottom(u) * 0.86, -1),
    ];
  });
  const finSvg = form(ctx, {
    shape: fin,
    fill: membrane,
    inside: [fillPath(tipRegion, paint.mix(tipColor, membrane, 0.15))],
    over: rays,
    shadow: baseW * 0.14,
  });
  const muscleSvg = form(ctx, {
    shape: muscle,
    fill: paint.ref(b.g.tail.color),
    inside: [fillPath(tipRegion, tipColor)],
    shadow: baseW * 0.16,
    line: 'none',
  });
  b.sheet.put(Z.tail, finSvg + muscleSvg, fin);
  return { tip: tipPt, glow: null };
}
