/**
 * Minimal vector path toolkit for the Sticker Pop renderer. Paths are stored as absolute
 * cubic segments so they can be transformed exactly (form-shadow offsets, head tilt) and
 * measured for layout without a DOM, which keeps `buildStickerSvg` a pure string function.
 */

export type Pt = readonly [number, number];

/**
 * A knot of a smooth outline: `[x, y]` or `[x, y, k]`. `k` scales the Bézier handle length at
 * that knot: 0 makes a sharp corner (ear tips, flame tongues, fur notches), > 1 a rounder bulge.
 */
export type Knot = readonly [number, number] | readonly [number, number, number];

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Seg =
  | { readonly k: 'M'; readonly p: Pt }
  | { readonly k: 'L'; readonly p: Pt }
  | { readonly k: 'C'; readonly c1: Pt; readonly c2: Pt; readonly p: Pt }
  | { readonly k: 'Z' };

/** Handle length for a quarter-circle cubic. */
const KAPPA = 0.5522847498;
/** Default handle scale for smooth knots: ≈ circle-like curvature for evenly spaced knots. */
const TENSION = 0.36;

/** Compact, deterministic number formatting for SVG output (2 decimals, no `-0`). */
export function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) || r === 0 ? '0' : String(r);
}

/** Bounds-checked array access (the project compiles with `noUncheckedIndexedAccess`). */
export function item<T>(items: readonly T[], index: number): T {
  const value = items[index];
  if (value === undefined) throw new RangeError(`index ${index} out of range (${items.length})`);
  return value;
}

/** A knot with an explicit handle scale (0 = sharp corner). */
export function knot(p: Pt, k = 0): Knot {
  return [p[0], p[1], k];
}

/** Transform a knot's position, keeping its handle scale. */
export function mapKnot(k: Knot, f: (p: Pt) => Pt): Knot {
  const p = f([k[0], k[1]]);
  return k.length === 3 ? [p[0], p[1], k[2]] : p;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

export function add(a: Pt, b: Pt): Pt {
  return [a[0] + b[0], a[1] + b[1]];
}

export function rotatePt(p: Pt, deg: number, o: Pt): Pt {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const x = p[0] - o[0];
  const y = p[1] - o[1];
  return [o[0] + x * c - y * s, o[1] + x * s + y * c];
}

function cubicAt(p0: Pt, c1: Pt, c2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
    a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1],
  ];
}

export class Path {
  readonly segs: readonly Seg[];

  constructor(segs: readonly Seg[]) {
    this.segs = segs;
  }

  static empty(): Path {
    return new Path([]);
  }

  /** Ellipse as four cubic arcs (not an SVG arc) so it survives arbitrary transforms. */
  static ellipse(cx: number, cy: number, rx: number, ry: number, rotDeg = 0): Path {
    const kx = rx * KAPPA;
    const ky = ry * KAPPA;
    const path = new Path([
      { k: 'M', p: [cx + rx, cy] },
      { k: 'C', c1: [cx + rx, cy + ky], c2: [cx + kx, cy + ry], p: [cx, cy + ry] },
      { k: 'C', c1: [cx - kx, cy + ry], c2: [cx - rx, cy + ky], p: [cx - rx, cy] },
      { k: 'C', c1: [cx - rx, cy - ky], c2: [cx - kx, cy - ry], p: [cx, cy - ry] },
      { k: 'C', c1: [cx + kx, cy - ry], c2: [cx + rx, cy - ky], p: [cx + rx, cy] },
      { k: 'Z' },
    ]);
    return rotDeg ? path.rotate(rotDeg, [cx, cy]) : path;
  }

  static circle(cx: number, cy: number, r: number): Path {
    return Path.ellipse(cx, cy, r, r);
  }

  static poly(points: readonly Pt[], closed = true): Path {
    const segs: Seg[] = points.map((p, i) => ({ k: i === 0 ? 'M' : 'L', p }) as Seg);
    if (closed) segs.push({ k: 'Z' });
    return new Path(segs);
  }

  static rect(x: number, y: number, w: number, h: number): Path {
    return Path.poly([
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ]);
  }

  /**
   * Smooth curve through knots (cardinal spline with chord-length handles, which avoids the
   * overshoot plain Catmull-Rom shows on unevenly spaced knots).
   */
  static smooth(knots: readonly Knot[], closed = true, tension = TENSION): Path {
    const n = knots.length;
    if (n < 2) return Path.empty();
    const at = (i: number): Knot =>
      item(knots, closed ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i)));
    const hIn: Pt[] = [];
    const hOut: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const p = at(i);
      const prev = at(i - 1);
      const next = at(i + 1);
      const k = (p.length === 3 ? p[2] : 1) * tension;
      let tx = next[0] - prev[0];
      let ty = next[1] - prev[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const dIn = Math.hypot(p[0] - prev[0], p[1] - prev[1]) * k;
      const dOut = Math.hypot(next[0] - p[0], next[1] - p[1]) * k;
      hIn.push([p[0] - tx * dIn, p[1] - ty * dIn]);
      hOut.push([p[0] + tx * dOut, p[1] + ty * dOut]);
    }
    const first = at(0);
    const segs: Seg[] = [{ k: 'M', p: [first[0], first[1]] }];
    const count = closed ? n : n - 1;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % n;
      const p = at(j);
      segs.push({ k: 'C', c1: item(hOut, i), c2: item(hIn, j), p: [p[0], p[1]] });
    }
    if (closed) segs.push({ k: 'Z' });
    return new Path(segs);
  }

  /** Concatenate subpaths (for even-odd tricks and compound shapes). */
  add(...others: readonly Path[]): Path {
    return new Path([...this.segs, ...others.flatMap((o) => o.segs)]);
  }

  map(f: (p: Pt) => Pt): Path {
    return new Path(
      this.segs.map((s): Seg => {
        switch (s.k) {
          case 'Z':
            return s;
          case 'C':
            return { k: 'C', c1: f(s.c1), c2: f(s.c2), p: f(s.p) };
          default:
            return { k: s.k, p: f(s.p) };
        }
      }),
    );
  }

  translate(dx: number, dy: number): Path {
    return this.map((p) => [p[0] + dx, p[1] + dy]);
  }

  scale(sx: number, sy = sx, o: Pt = [0, 0]): Path {
    return this.map((p) => [o[0] + (p[0] - o[0]) * sx, o[1] + (p[1] - o[1]) * sy]);
  }

  rotate(deg: number, o: Pt): Path {
    return this.map((p) => rotatePt(p, deg, o));
  }

  /** Mirror horizontally around x = `ox`. Reverses winding, which even-odd fills don't mind. */
  mirrorX(ox: number): Path {
    return this.map((p) => [2 * ox - p[0], p[1]]);
  }

  /** Conservative bounds (Bézier curves stay inside their control polygon). */
  bounds(): Box {
    const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const grow = (p: Pt) => {
      box.x0 = Math.min(box.x0, p[0]);
      box.y0 = Math.min(box.y0, p[1]);
      box.x1 = Math.max(box.x1, p[0]);
      box.y1 = Math.max(box.y1, p[1]);
    };
    for (const s of this.segs) {
      if (s.k === 'Z') continue;
      if (s.k === 'C') {
        grow(s.c1);
        grow(s.c2);
      }
      grow(s.p);
    }
    return box;
  }

  center(): Pt {
    const b = this.bounds();
    return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  }

  /** Points along the path (per subpath), `perSeg` samples per segment. */
  sample(perSeg = 12): Pt[][] {
    const out: Pt[][] = [];
    let current: Pt[] = [];
    let cursor: Pt = [0, 0];
    let start: Pt = [0, 0];
    for (const s of this.segs) {
      if (s.k === 'M') {
        if (current.length) out.push(current);
        current = [s.p];
        cursor = s.p;
        start = s.p;
      } else if (s.k === 'L') {
        current.push(s.p);
        cursor = s.p;
      } else if (s.k === 'C') {
        for (let i = 1; i <= perSeg; i++)
          current.push(cubicAt(cursor, s.c1, s.c2, s.p, i / perSeg));
        cursor = s.p;
      } else {
        cursor = start;
      }
    }
    if (current.length) out.push(current);
    return out;
  }

  toString(): string {
    let d = '';
    for (const s of this.segs) {
      switch (s.k) {
        case 'M':
          d += `M${fmt(s.p[0])} ${fmt(s.p[1])}`;
          break;
        case 'L':
          d += `L${fmt(s.p[0])} ${fmt(s.p[1])}`;
          break;
        case 'C':
          d += `C${fmt(s.c1[0])} ${fmt(s.c1[1])} ${fmt(s.c2[0])} ${fmt(s.c2[1])} ${fmt(s.p[0])} ${fmt(s.p[1])}`;
          break;
        case 'Z':
          d += 'Z';
          break;
      }
    }
    return d;
  }
}

export function unionBox(boxes: readonly Box[]): Box {
  const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const b of boxes) {
    box.x0 = Math.min(box.x0, b.x0);
    box.y0 = Math.min(box.y0, b.y0);
    box.x1 = Math.max(box.x1, b.x1);
    box.y1 = Math.max(box.y1, b.y1);
  }
  return box;
}
