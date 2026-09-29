import { type Knot, knot, Path, type Pt } from '../core/path';
import type { Rng } from '../core/rng';
import { sparkle } from '../core/shapes';
import { el, group, type Ids, url } from '../core/svg';

/**
 * Scenery kit: flat, layered vector shapes without ink lines, so the outlined sticker stays
 * the focal point (docs/04 §6.2: backgrounds support, they don't compete).
 */

export type Stop = readonly [offset: number, color: string, opacity?: number];

export function linearGradient(
  ids: Ids,
  stops: readonly Stop[],
  from: Pt = [0, 0],
  to: Pt = [0, 1],
): { id: string; def: string } {
  const id = ids.next('lg');
  const def = el(
    'linearGradient',
    { id, x1: from[0], y1: from[1], x2: to[0], y2: to[1] },
    ...stops.map(([offset, color, opacity]) =>
      el('stop', { offset, 'stop-color': color, 'stop-opacity': opacity ?? 1 }),
    ),
  );
  return { id, def };
}

export function radialGradient(ids: Ids, stops: readonly Stop[]): { id: string; def: string } {
  const id = ids.next('rg');
  const def = el(
    'radialGradient',
    { id },
    ...stops.map(([offset, color, opacity]) =>
      el('stop', { offset, 'stop-color': color, 'stop-opacity': opacity ?? 1 }),
    ),
  );
  return { id, def };
}

/** Full-frame vertical gradient (sky, water). */
export function gradientRect(
  ids: Ids,
  x: number,
  y: number,
  w: number,
  h: number,
  stops: readonly Stop[],
): string {
  const g = linearGradient(ids, stops);
  return g.def + el('rect', { x, y, width: w, height: h, fill: url(g.id) });
}

/** Soft radial glow disc (sun halos, lava glow). */
export function glow(
  ids: Ids,
  c: Pt,
  r: number,
  color: string,
  alpha: number,
  falloff = 0.4,
): string {
  const g = radialGradient(ids, [
    [0, color, alpha],
    [falloff, color, alpha * 0.45],
    [1, color, 0],
  ]);
  return g.def + el('circle', { cx: c[0], cy: c[1], r, fill: url(g.id) });
}

export interface PuffColors {
  base: string;
  shade: string;
  light?: string;
  /** Flat underside band (storm shelf). */
  belly?: string;
}

/**
 * Cel-shaded cumulus: a union of circles piled into a mound with a flat base. The shade tone
 * shows on each puff's lower-right rim, a light rim on the upper-left, so it matches the
 * creatures' lighting.
 */
export function puffCloud(
  ids: Ids,
  c: Pt,
  w: number,
  h: number,
  rng: Rng,
  colors: PuffColors,
  opts: { puffs?: number; opacity?: number } = {},
): string {
  const n = opts.puffs ?? 5;
  const circles: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const hump = Math.sin(Math.PI * (0.15 + 0.7 * t));
    const r = h * (0.32 + 0.4 * hump) * rng.range(0.85, 1.1);
    const x = c[0] - w / 2 + r * 0.8 + (w - r * 1.6) * t;
    circles.push([x, c[1] - r * 0.55 - h * 0.28 * hump, r]);
  }
  // A couple of crown puffs on top of the pile.
  const crown = Math.max(1, Math.round(n / 3));
  for (let i = 0; i < crown; i++) {
    const t = (i + 1) / (crown + 1);
    const r = h * rng.range(0.34, 0.46);
    circles.push([c[0] - w * 0.3 + w * 0.6 * t + rng.range(-0.05, 0.05) * w, c[1] - h * 0.62, r]);
  }
  const copy = (dx: number, dy: number) =>
    circles.map(([x, y, r]) => el('circle', { cx: x + dx, cy: y + dy, r }));
  const d = h * 0.13;
  const e = h * 0.05;
  const unionId = ids.next('cu');
  const litId = ids.next('cl');
  const top = Math.min(...circles.map(([, y, r]) => y - r)) - d - 2;
  const left = Math.min(...circles.map(([x, , r]) => x - r)) - d - 2;
  const right = Math.max(...circles.map(([x, , r]) => x + r)) + d + 2;
  const baseId = ids.next('cb');
  // shade everywhere → lit copy (shifted toward the light) → base = lit ∩ (copy shifted away
  // from the light), leaving a light rim upper-left and a shade rim lower-right.
  const body = colors.light
    ? group(
        {},
        group({ fill: colors.light }, ...copy(-d * 0.6, -d * 0.8)),
        group({ 'clip-path': url(litId) }, group({ fill: colors.base }, ...copy(e * 0.6, e * 0.8))),
      )
    : group({ fill: colors.base }, ...copy(-d * 0.6, -d * 0.8));
  return group(
    { opacity: opts.opacity },
    el('clipPath', { id: unionId }, ...copy(0, 0)),
    el('clipPath', { id: litId }, ...copy(-d * 0.6, -d * 0.8)),
    el(
      'clipPath',
      { id: baseId },
      el('rect', { x: left, y: top, width: right - left, height: c[1] - top }),
    ),
    group(
      { 'clip-path': url(baseId) },
      group(
        { 'clip-path': url(unionId) },
        el('rect', {
          x: left,
          y: top,
          width: right - left,
          height: c[1] - top,
          fill: colors.shade,
        }),
        body,
        colors.belly
          ? el('rect', {
              x: left,
              y: c[1] - h * 0.16,
              width: right - left,
              height: h * 0.16,
              fill: colors.belly,
            })
          : '',
      ),
    ),
  );
}

/** Rolling hill band across the frame, from `y` (crest baseline) down to `bottom`. */
export function hillPath(
  W: number,
  y: number,
  amp: number,
  crests: number,
  bottom: number,
  rng: Rng,
  phase = 0,
): Path {
  const knots: Knot[] = [knot([-W * 0.1, bottom], 0)];
  const n = crests * 2 + 1;
  for (let i = 0; i <= n; i++) {
    const x = -W * 0.1 + (W * 1.2 * i) / n;
    const up = (i + phase) % 2 === 1;
    knots.push([x, y - (up ? amp * rng.range(0.7, 1.1) : amp * rng.range(0, 0.25))]);
  }
  knots.push(knot([W * 1.1, bottom], 0));
  return Path.smooth(knots);
}

/**
 * A scenery form: base fill, a shade band on the side away from the light and a light rim on
 * the lit side (no outlines).
 */
export function flatForm(
  ids: Ids,
  shape: Path,
  fill: string,
  opts: { shade?: string; shadeDepth?: number; light?: string; lightDepth?: number; dir?: Pt } = {},
): string {
  const d = shape.toString();
  const dir = opts.dir ?? [-0.6, -0.8];
  const parts: string[] = [el('path', { d, fill })];
  const clipId = ids.next('sc');
  if (opts.shade && opts.shadeDepth) {
    const lit = shape.translate(dir[0] * opts.shadeDepth, dir[1] * opts.shadeDepth);
    parts.push(el('path', { d: d + lit.toString(), fill: opts.shade, 'fill-rule': 'evenodd' }));
  }
  if (opts.light && opts.lightDepth) {
    const off = shape.translate(-dir[0] * opts.lightDepth, -dir[1] * opts.lightDepth);
    parts.push(el('path', { d: d + off.toString(), fill: opts.light, 'fill-rule': 'evenodd' }));
  }
  return group(
    {},
    el('clipPath', { id: clipId }, el('path', { d })),
    group({ 'clip-path': url(clipId) }, ...parts),
  );
}

/** Night sky dots and twinkles. */
export function starField(
  rng: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  px: number,
  color = '#FFFFFF',
): string {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const p: Pt = [x + rng.next() * w, y + rng.next() ** 1.3 * h];
    const big = rng.chance(0.18);
    if (big) {
      out.push(
        el('path', {
          d: sparkle(p, rng.range(3, 5.5) * px, { inner: 0.22 }).toString(),
          fill: color,
          opacity: rng.range(0.7, 1),
        }),
      );
    } else {
      out.push(
        el('circle', {
          cx: p[0],
          cy: p[1],
          r: rng.range(0.6, 1.5) * px,
          fill: color,
          opacity: rng.range(0.4, 0.9),
        }),
      );
    }
  }
  return out.join('');
}

/** Edge darkening that pulls the eye toward the creature. */
export function vignette(ids: Ids, W: number, H: number, color: string, alpha: number): string {
  const g = radialGradient(ids, [
    [0.55, color, 0],
    [1, color, alpha],
  ]);
  return g.def + el('rect', { x: 0, y: 0, width: W, height: H, fill: url(g.id) });
}

/** Soft contact shadow where the creature meets the ground. */
export function contactShadow(
  ids: Ids,
  cx: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha: number,
): string {
  const g = radialGradient(ids, [
    [0, color, alpha],
    [0.6, color, alpha * 0.55],
    [1, color, 0],
  ]);
  return g.def + el('ellipse', { cx, cy: y, rx: w / 2, ry: h / 2, fill: url(g.id) });
}

/** Short grass blades (tapered spikes) along a baseline. */
export function grassTuft(base: Pt, h: number, blades: number, lean: number, rng: Rng): Path {
  let path = Path.empty();
  for (let i = 0; i < blades; i++) {
    const x = base[0] + (i - (blades - 1) / 2) * h * 0.22;
    const hh = h * rng.range(0.65, 1.05);
    const tipX = x + lean * hh * rng.range(0.2, 0.5) + (i - (blades - 1) / 2) * h * 0.12;
    const w = h * 0.1;
    path = path.add(
      Path.smooth([
        knot([x - w, base[1]], 0),
        [x - w * 0.4 + (tipX - x) * 0.4, base[1] - hh * 0.55],
        knot([tipX, base[1] - hh], 0),
        [x + w * 0.5 + (tipX - x) * 0.3, base[1] - hh * 0.5],
        knot([x + w, base[1]], 0),
      ]),
    );
  }
  return path;
}

/** Soft sun rays: alternating wedges fanning out from the sun (drama for full art). */
export function sunRays(
  c: Pt,
  radius: number,
  count: number,
  color: string,
  alpha: number,
  rotDeg = 0,
): string {
  let path = Path.empty();
  const step = 360 / count;
  for (let i = 0; i < count; i++) {
    const a0 = ((rotDeg + i * step) * Math.PI) / 180;
    const a1 = ((rotDeg + i * step + step * 0.45) * Math.PI) / 180;
    path = path.add(
      Path.poly([
        c,
        [c[0] + Math.cos(a0) * radius, c[1] + Math.sin(a0) * radius],
        [c[0] + Math.cos(a1) * radius, c[1] + Math.sin(a1) * radius],
      ]),
    );
  }
  return el('path', { d: path.toString(), fill: color, opacity: alpha });
}

/** A distant gull: two shallow arcs meeting at the body. */
export function gull(c: Pt, span: number, width: number): Path {
  return Path.smooth(
    [
      knot([c[0] - span, c[1] - span * 0.1], 0),
      [c[0] - span * 0.5, c[1] - span * 0.42],
      knot([c[0], c[1]], 0),
      [c[0] + span * 0.5, c[1] - span * 0.42],
      knot([c[0] + span, c[1] - span * 0.1], 0),
      [c[0] + span * 0.5, c[1] - span * 0.42 + width],
      knot([c[0], c[1] + width], 0),
      [c[0] - span * 0.5, c[1] - span * 0.42 + width],
    ],
    true,
  );
}
