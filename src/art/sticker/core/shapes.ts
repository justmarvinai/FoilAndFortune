import { item, type Knot, Path, type Pt } from './path';

/** Higher-level shape generators shared by the part kit. */

export interface Frame {
  /** Point on the centerline. */
  p: Pt;
  /** Unit tangent (direction of travel). */
  t: Pt;
  /** Unit normal, pointing to the left of travel (screen space, y down). */
  n: Pt;
  /** Arc-length parameter 0…1. */
  u: number;
}

/** Evenly spaced (by arc length) frames along a smooth open curve through `knots`. */
export function frames(knots: readonly Knot[], count: number): Frame[] {
  const dense = Path.smooth(knots, false).sample(24)[0] ?? [];
  if (dense.length < 2) return [];
  const lengths = [0];
  for (let i = 1; i < dense.length; i++) {
    const a = item(dense, i - 1);
    const b = item(dense, i);
    lengths.push(item(lengths, i - 1) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = item(lengths, lengths.length - 1) || 1;
  const out: Frame[] = [];
  let j = 1;
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0 : i / (count - 1);
    const target = u * total;
    while (j < dense.length - 1 && item(lengths, j) < target) j++;
    const a = item(dense, j - 1);
    const b = item(dense, j);
    const la = item(lengths, j - 1);
    const lb = item(lengths, j);
    const f = lb > la ? (target - la) / (lb - la) : 0;
    const p: Pt = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t: Pt = [(b[0] - a[0]) / tl, (b[1] - a[1]) / tl];
    out.push({ p, t, n: [t[1], -t[0]], u });
  }
  return out;
}

export function offset(f: Frame, along: number, side: number): Pt {
  return [f.p[0] + f.t[0] * along + f.n[0] * side, f.p[1] + f.t[1] * along + f.n[1] * side];
}

export interface TaperOptions {
  /** Width at the start / end as a fraction of `width` (0 = pointed). */
  start?: number;
  end?: number;
  /** Exponent of the swell profile: < 1 fuller, > 1 thinner. */
  swell?: number;
  samples?: number;
}

/**
 * A filled brush stroke along a smooth curve, swelling in the middle and tapering at the ends.
 * Used for fur tufts, lids and mouths so interior lines look inked rather than plotted.
 */
export function taper(knots: readonly Knot[], width: number, opts: TaperOptions = {}): Path {
  // Sample density follows curve complexity: short flicks need few points, and every point
  // costs raster time (hundreds of strokes per card).
  const count = opts.samples ?? Math.min(26, 8 + 5 * (knots.length - 1));
  const fr = frames(knots, count);
  if (fr.length < 2) return Path.empty();
  const start = opts.start ?? 0.2;
  const end = opts.end ?? 0.2;
  const swell = opts.swell ?? 0.6;
  const widthAt = (u: number) =>
    width * Math.max(start + (end - start) * u, Math.sin(Math.PI * u) ** swell);
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (const f of fr) {
    const w = widthAt(f.u) / 2;
    left.push(offset(f, 0, w));
    right.push(offset(f, 0, -w));
  }
  const cap = (f: Frame, w: number, dir: 1 | -1): Pt[] => {
    // Semicircle from the left edge around the tip to the right edge.
    const pts: Pt[] = [];
    for (let i = 1; i < 6; i++) {
      const a = (Math.PI * i) / 6;
      const along = Math.sin(a) * w * dir;
      const side = Math.cos(a) * w * dir;
      pts.push(offset(f, along, side));
    }
    return pts;
  };
  const first = item(fr, 0);
  const last = item(fr, fr.length - 1);
  const poly: Pt[] = [
    ...left,
    ...cap(last, widthAt(1) / 2, 1),
    ...right.reverse(),
    ...cap(first, widthAt(0) / 2, -1),
  ];
  return Path.poly(poly);
}

/**
 * Concave-sided star (the "sparkle" glint). `points` = 4 gives the classic twinkle; `inner`
 * is the waist radius as a fraction of `r`.
 */
export function sparkle(
  c: Pt,
  r: number,
  opts: { points?: number; inner?: number; rot?: number } = {},
): Path {
  const n = opts.points ?? 4;
  const inner = opts.inner ?? 0.28;
  const rot = opts.rot ?? -90;
  const knots: Knot[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 === 0 ? r : r * inner;
    knots.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, i % 2 === 0 ? 0 : 1.1]);
  }
  return Path.smooth(knots, true);
}

/** Zigzag band with crisp corners (lightning chevrons and bolts). `widths` per vertex. */
export function bolt(points: readonly Pt[], widths: readonly number[]): Path {
  const left: Pt[] = [];
  const right: Pt[] = [];
  points.forEach((p, i) => {
    const prev = item(points, Math.max(0, i - 1));
    const next = item(points, Math.min(points.length - 1, i + 1));
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const l = Math.hypot(dx, dy) || 1;
    const w = item(widths, i) / 2;
    left.push([p[0] + (dy / l) * w, p[1] - (dx / l) * w]);
    right.push([p[0] - (dy / l) * w, p[1] + (dx / l) * w]);
  });
  return Path.poly([...left, ...right.reverse()]);
}
