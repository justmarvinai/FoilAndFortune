import type { GenomeExtra } from '@/content/schema/genome';
import { item, type Knot, knot, mapKnot, Path, type Pt } from '../core/path';
import { bolt, frames, offset, sparkle, taper } from '../core/shapes';
import { fillPath, form } from '../draw';
import { type Frame, fk, fp, type LegRig } from '../rig';
import { Z } from '../sheet';
import type { Build, HeadInfo } from './kit';

/**
 * Genome extras (genome.extras). Markings (stripes, spots, socks, forehead marks) are painted
 * inside their host form so they pick up its shading; appendages (ruff, head tuft, gills) are
 * separate pieces that join the silhouette.
 */

type ExtraOf<K extends GenomeExtra['kind']> = Extract<GenomeExtra, { kind: K }>;

function extrasOf<K extends GenomeExtra['kind']>(b: Build, kind: K): ExtraOf<K>[] {
  return b.g.extras.filter((x): x is ExtraOf<K> => x.kind === kind);
}

// Fixed spot layouts (species look must not change with the art seed).
const BODY_SPOTS: readonly [number, number, number][] = [
  [0.05, -0.66, 1],
  [0.4, -0.72, 0.8],
  [0.66, -0.42, 0.95],
  [0.24, -0.34, 0.62],
  [0.84, -0.12, 0.7],
  [-0.2, -0.3, 0.55],
];
const HEAD_SPOTS: readonly [number, number, number][] = [
  [0.4, -0.7, 0.9],
  [0.66, -0.42, 0.7],
  [0.08, -0.82, 0.6],
];

function spotShapes(
  f: Frame,
  layout: readonly [number, number, number][],
  count: number,
  r: number,
): Path[] {
  return layout.slice(0, count).map(([u, v, s], i) => {
    const c = fp(f, u, v);
    return Path.ellipse(c[0], c[1], r * s * 1.15, r * s * 0.85, i * 23 - 20);
  });
}

function spotSplit(count: number): { head: number; body: number } {
  const head = Math.min(HEAD_SPOTS.length, Math.round(count * 0.4));
  return { head, body: Math.min(BODY_SPOTS.length, count - head) };
}

export function headMarkings(b: Build, _shape: Path): string[] {
  const out: string[] = [];
  const h = b.rig.head;
  for (const x of extrasOf(b, 'spots')) {
    const spots = spotShapes(h, HEAD_SPOTS, spotSplit(x.count).head, h.b * 0.13);
    out.push(...spots.map((s) => fillPath(s, b.paint.ref(x.color))));
  }
  for (const x of extrasOf(b, 'forehead-mark')) {
    out.push(fillPath(foreheadMark(fp(h, -0.14, -0.62), h.b * 0.2, x.shape), b.paint.ref(x.color)));
  }
  return out;
}

function foreheadMark(c: Pt, r: number, shape: ExtraOf<'forehead-mark'>['shape']): Path {
  switch (shape) {
    case 'star':
      return sparkle(c, r, { points: 5, inner: 0.5 });
    case 'diamond':
      return Path.smooth([
        knot([c[0], c[1] - r]),
        knot([c[0] + r * 0.6, c[1]]),
        knot([c[0], c[1] + r]),
        knot([c[0] - r * 0.6, c[1]]),
      ]);
    case 'drop':
      return Path.smooth([
        knot([c[0], c[1] - r]),
        [c[0] + r * 0.55, c[1] + r * 0.3],
        [c[0], c[1] + r * 0.75],
        [c[0] - r * 0.55, c[1] + r * 0.3],
      ]);
    case 'flame':
      return Path.smooth([
        knot([c[0] - r * 0.1, c[1] - r]),
        [c[0] + r * 0.5, c[1]],
        [c[0], c[1] + r * 0.7],
        [c[0] - r * 0.5, c[1] + r * 0.1],
      ]);
    case 'bolt':
      return bolt(
        [
          [c[0] + r * 0.3, c[1] - r],
          [c[0] - r * 0.25, c[1] + r * 0.05],
          [c[0] + r * 0.25, c[1] - r * 0.05],
          [c[0] - r * 0.3, c[1] + r],
        ],
        [r * 0.5, r * 0.45, r * 0.45, 0],
      );
  }
}

/** Lightning chevrons across a form, starting at `u0`…`u1` (normalized frame coords). */
export function chevrons(b: Build, f: Frame, u0: number, u1: number, scale = 1): string[] {
  const out: string[] = [];
  for (const x of extrasOf(b, 'stripes')) {
    if (x.where === 'legs') continue;
    const color = b.paint.ref(x.color);
    const n = x.count;
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? (u0 + u1) / 2 : u0 + ((u1 - u0) * i) / (n - 1);
      const pts: Pt[] = [
        fp(f, u + 0.2 * scale, -1.35),
        fp(f, u - 0.05 * scale, -0.56),
        fp(f, u + 0.13 * scale, -0.47),
        fp(f, u - 0.05 * scale, 0.14),
      ];
      const w = f.a * scale;
      out.push(fillPath(bolt(pts, [w * 0.22, w * 0.19, w * 0.17, 0]), color));
    }
  }
  return out;
}

/** Markings on the torso (quadruped/amphibian share the body frame). */
export function bodyMarkings(b: Build): string[] {
  const out: string[] = [];
  const f = b.rig.body;
  // Chevrons start right of the head so the pattern stays visible in 3/4 view; a sitting
  // body hides its back behind the head, so the haunch carries them instead.
  if (b.rig.stance !== 'sit') out.push(...chevrons(b, f, 0.32, 0.76));
  for (const x of extrasOf(b, 'spots')) {
    const spots = spotShapes(f, BODY_SPOTS, spotSplit(x.count).body, f.b * 0.2);
    out.push(...spots.map((s) => fillPath(s, b.paint.ref(x.color))));
  }
  return out;
}

export function legMarkings(b: Build, leg: LegRig): string[] {
  const out: string[] = [];
  for (const x of extrasOf(b, 'socks')) {
    const color = leg.far ? b.paint.far(b.paint.ref(x.color)) : b.paint.ref(x.color);
    const top = leg.foot[1] - leg.w * (leg.hind ? 1.05 : 1.15);
    const cx = leg.foot[0];
    const w = leg.w * 2;
    // Furry top edge.
    const knots: Knot[] = [knot([cx - w, top + leg.w * 0.1])];
    for (let i = 0; i <= 4; i++) {
      knots.push(
        knot(
          [cx - w * 0.5 + (w * i) / 4, top + (i % 2 === 0 ? 0 : -leg.w * 0.14)],
          i % 2 === 0 ? 0.5 : 0,
        ),
      );
    }
    knots.push(
      knot([cx + w, top + leg.w * 0.1]),
      knot([cx + w, leg.foot[1] + 50]),
      knot([cx - w, leg.foot[1] + 50]),
    );
    out.push(fillPath(Path.smooth(knots), color));
  }
  for (const x of extrasOf(b, 'stripes')) {
    if (x.where !== 'legs') continue;
    for (let i = 0; i < Math.min(3, x.count); i++) {
      const y = leg.foot[1] - leg.w * (1.4 + i * 0.5);
      out.push(
        fillPath(
          bolt(
            [
              [leg.foot[0] - leg.w, y],
              [leg.foot[0] + leg.w, y - leg.w * 0.2],
            ],
            [leg.w * 0.2, leg.w * 0.05],
          ),
          b.paint.ref(x.color),
        ),
      );
    }
  }
  return out;
}

/** Appendage extras: chest ruff, head tuft, gills. Head-attached ones go in the tilted group. */
export function drawBodyExtras(b: Build): void {
  for (const x of extrasOf(b, 'ruff')) drawRuff(b, b.paint.ref(x.color));
}

export function drawHeadExtras(b: Build, head: HeadInfo): void {
  for (const x of extrasOf(b, 'head-tuft')) drawTuft(b, head, x.shape, b.paint.ref(x.color));
  for (const x of extrasOf(b, 'gills')) drawGills(b, head, x.count, b.paint.ref(x.color));
}

function drawRuff(b: Build, color: string): void {
  const h = b.rig.head;
  const K = (u: number, v: number, k?: number) => fk(h, u, v, k);
  // Fluffy bib: hidden top under the chin, three soft tufts along the bottom.
  const shape = Path.smooth([
    K(-0.46, 0.55),
    K(0.5, 0.55),
    K(0.6, 0.9),
    K(0.46, 1.2, 0),
    K(0.3, 1.08, 0.55),
    K(0.12, 1.36, 0),
    K(-0.06, 1.12, 0.55),
    K(-0.24, 1.26, 0),
    K(-0.42, 1.0),
  ]);
  const fur = [
    [0.34, 0.98],
    [-0.02, 1.04],
  ].map(([u, v]) =>
    fillPath(
      taper(
        [
          fp(h, u ?? 0, (v ?? 0) - 0.16),
          fp(h, (u ?? 0) - 0.02, (v ?? 0) - 0.02),
          fp(h, (u ?? 0) - 0.07, (v ?? 0) + 0.06),
        ],
        b.ctx.lw.detail,
        {
          start: 0.6,
          end: 0,
        },
      ),
      b.paint.line(color),
    ),
  );
  b.sheet.put(Z.ruff, form(b.ctx, { shape, fill: color, shadow: h.b * 0.09, over: fur }), shape);
}

function drawTuft(
  b: Build,
  head: HeadInfo,
  kind: ExtraOf<'head-tuft'>['shape'],
  color: string,
): void {
  const h = b.rig.head;
  const base = head.crown.p;
  const s = h.b * (kind === 'flame' ? 0.72 : 0.55);
  // Authored pointing up with x across; tongues curl back (to the right).
  const knots: readonly Knot[] =
    kind === 'leaf'
      ? [
          [-0.28, 0.05],
          [-0.3, 0.5],
          [0.1, 1.0, 0],
          [0.34, 0.45],
          [0.26, 0.05],
        ]
      : kind === 'fluff'
        ? [
            [-0.3, 0.05],
            [-0.36, 0.5, 0],
            [-0.1, 0.4],
            [0.02, 0.86, 0],
            [0.12, 0.42],
            [0.36, 0.62, 0],
            [0.3, 0.05],
          ]
        : [
            [-0.3, 0.0],
            [-0.42, 0.32],
            [-0.26, 0.6],
            [-0.3, 0.84],
            [-0.1, 1.04, 0],
            [0.02, 0.72, 0.5],
            [0.24, 0.86, 0],
            [0.26, 0.52, 0.5],
            [0.44, 0.52, 0],
            [0.36, 0.22],
            [0.28, 0.0],
          ];
  const place = (p: Pt): Pt => {
    const x = p[0] + 0.22 * p[1] * p[1];
    return [base[0] + x * s, base[1] - p[1] * s];
  };
  const shape = Path.smooth(knots.map((k) => mapKnot(k, place)));
  const inner =
    kind === 'flame' || kind === 'spark'
      ? Path.smooth(knots.map((k) => mapKnot(k, (p) => place([p[0] * 0.5 + 0.03, p[1] * 0.55]))))
      : null;
  const svg = form(b.ctx, {
    shape,
    fill: color,
    inside: inner ? [fillPath(inner, b.paint.light(color, 0.12))] : [],
    shadow: s * 0.1,
  });
  b.sheet.put(Z.ear, svg, shape);
}

/** Frilly axolotl gills: stalks fanning out from the back of the head, scalloped edges. */
function drawGills(b: Build, head: HeadInfo, count: number, color: string): void {
  const h = b.rig.head;
  const len = h.a * 0.68;
  const near: number[] = [];
  const far: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    near.push(-62 + t * 72);
    far.push(-150 + t * 48);
  }
  const spine = (base: Pt, deg: number, l: number): Knot[] => {
    const a0 = (deg * Math.PI) / 180;
    const a1 = ((deg - 20) * Math.PI) / 180;
    const mid: Pt = [base[0] + Math.cos(a0) * l * 0.5, base[1] + Math.sin(a0) * l * 0.5];
    return [base, mid, [mid[0] + Math.cos(a1) * l * 0.5, mid[1] + Math.sin(a1) * l * 0.5]];
  };
  // A soft, feathery frond: rounded frills along both edges (no leaf-like midrib).
  const frond = (base: Pt, deg: number, l: number): { shape: Path; barbs: Path[] } => {
    const fr = frames(spine(base, deg, l), 13);
    const width = (u: number) =>
      l * (0.1 + 0.13 * Math.sin(Math.PI * Math.min(1, 0.12 + 0.88 * u)));
    const top: Knot[] = [];
    const under: Knot[] = [];
    fr.forEach((f, i) => {
      if (i === 0 || i === fr.length - 1) return;
      const w = width(f.u);
      const bump = i % 2 === 0;
      top.push(knot(offset(f, 0, bump ? w * 1.16 : w * 0.92), bump ? 1.7 : 0.8));
      under.push(knot(offset(f, 0, -(bump ? w * 0.9 : w * 1.1)), bump ? 0.8 : 1.7));
    });
    const tip = offset(item(fr, fr.length - 1), l * 0.08, 0);
    const shape = Path.smooth([
      offset(item(fr, 0), -l * 0.05, 0),
      ...top,
      knot(tip, 1.5),
      ...under.reverse(),
    ]);
    return { shape, barbs: [] };
  };
  const stalk = (base: Pt, deg: number, l: number): Path =>
    taper(spine(base, deg, l * 0.45), l * 0.07, { start: 0.9, end: 0 });
  const draw = (base: Pt, angles: readonly number[], l: number, far: boolean) => {
    const fill = far ? b.paint.far(color) : color;
    const lineColor = b.paint.mix(fill, b.paint.line(fill), 0.55);
    angles.forEach((deg, i) => {
      const len2 = l * (i === 1 ? 1.08 : 0.94);
      const { shape, barbs } = frond(base, deg, len2);
      const svg = form(b.ctx, {
        shape,
        fill,
        shadow: len2 * 0.08,
        over: [
          fillPath(stalk(base, deg, len2), lineColor),
          ...barbs.map((p) => fillPath(p, lineColor)),
        ],
      });
      b.sheet.put(far ? Z.farEar : Z.gill, svg, shape);
    });
  };
  draw(head.sides.far, far, len * 0.82, true);
  draw(head.sides.near, near, len, false);
}
