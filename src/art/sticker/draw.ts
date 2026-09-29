import type { Knot, Path, Pt } from './core/path';
import { taper } from './core/shapes';
import { el, group, type Ids, url } from './core/svg';

/**
 * Drawing primitives of the Sticker Pop look: flat fills, one multiply shadow tone and one
 * gloss shape per form (cel shading), ink lines. All geometry is in the creature's local units.
 */

export interface LineWeights {
  /** Silhouette ink, measured beyond the fill edge. */
  outline: number;
  /** Structural inner lines (stroke width, centered on the edge). */
  inner: number;
  /** Max width of tapered detail strokes. */
  detail: number;
}

export interface DrawCtx {
  ids: Ids;
  lw: LineWeights;
  ink: string;
  shadowTint: string;
  glossAlpha: number;
  /** Unit vector toward the key light. */
  light: Pt;
}

export interface FormSpec {
  shape: Path;
  fill: string;
  /**
   * Depth of the form-shadow crescent in local units (the lit copy of the shape is offset this
   * far toward the light; what it no longer covers is in shadow). `null` = no shadow.
   * Default: 13% of the form's smaller side.
   */
  shadow?: number | null;
  /** Explicit shadow region instead of the crescent (still clipped to the form). */
  shadowShape?: Path;
  /** Gloss shapes (painted white, clipped to the form). */
  gloss?: readonly Path[];
  /** Markings painted inside the form, below the shading (clipped). */
  inside?: readonly string[];
  /** Details painted above the shading (clipped), e.g. fur tufts. */
  over?: readonly string[];
  /** Lines: stroke the whole outline, nothing, or specific (open) paths. */
  line?: 'shape' | 'none' | readonly Path[];
  lineWidth?: number;
  lineColor?: string;
  /** Only draw lines inside this region (e.g. a muzzle outline that fades into the cheek). */
  lineClip?: Path;
}

/** Shadow crescent for `shape`: the shape plus its copy shifted toward the light, even-odd. */
export function crescent(ctx: DrawCtx, shape: Path, depth: number): Path {
  return shape.add(shape.translate(ctx.light[0] * depth, ctx.light[1] * depth));
}

export function shadowPaint(ctx: DrawCtx, region: Path, evenOdd: boolean): string {
  return el('path', {
    d: region.toString(),
    fill: ctx.shadowTint,
    'fill-rule': evenOdd ? 'evenodd' : undefined,
    // The base fill is painted inside the same clipped group, so multiply blends correctly
    // whether or not the renderer isolates clipped groups.
    style: 'mix-blend-mode:multiply',
  });
}

export function glossPaint(ctx: DrawCtx, shapes: readonly Path[], alpha = ctx.glossAlpha): string {
  if (!shapes.length) return '';
  return el('path', {
    d: shapes.map((s) => s.toString()).join(''),
    fill: '#FFFFFF',
    'fill-opacity': alpha,
  });
}

export function strokePath(
  ctx: DrawCtx,
  path: Path,
  width = ctx.lw.inner,
  color = ctx.ink,
): string {
  return el('path', {
    d: path.toString(),
    fill: 'none',
    stroke: color,
    'stroke-width': width,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
}

export function fillPath(
  path: Path,
  fill: string,
  extra: Record<string, string | number> = {},
): string {
  return el('path', { d: path.toString(), fill, ...extra });
}

/** Soft radial glow (spark tips, flames). */
export function glowDisc(ctx: DrawCtx, c: Pt, r: number, color: string, alpha: number): string {
  const id = ctx.ids.next('glow');
  return (
    el(
      'radialGradient',
      { id },
      el('stop', { offset: 0, 'stop-color': color, 'stop-opacity': alpha }),
      el('stop', { offset: 0.4, 'stop-color': color, 'stop-opacity': alpha * 0.42 }),
      el('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }),
    ) + el('circle', { cx: c[0], cy: c[1], r, fill: url(id) })
  );
}

/** One cel-shaded form: fill, markings, shadow tone, gloss, lines. */
export function form(ctx: DrawCtx, f: FormSpec): string {
  const d = f.shape.toString();
  const clipId = ctx.ids.next('c');
  const b = f.shape.bounds();
  const depth =
    f.shadow === undefined ? Math.min(b.x1 - b.x0, b.y1 - b.y0) * 0.13 : (f.shadow ?? 0);
  let shadow = '';
  if (f.shadowShape) shadow = shadowPaint(ctx, f.shadowShape, false);
  else if (depth > 0) shadow = shadowPaint(ctx, crescent(ctx, f.shape, depth), true);
  const lineColor = f.lineColor ?? ctx.ink;
  const lineWidth = f.lineWidth ?? ctx.lw.inner;
  let lines = '';
  if (f.line === undefined || f.line === 'shape') {
    lines = el('path', {
      d,
      fill: 'none',
      stroke: lineColor,
      'stroke-width': lineWidth,
      'stroke-linejoin': 'round',
    });
  } else if (f.line !== 'none') {
    lines = f.line.map((p) => strokePath(ctx, p, lineWidth, lineColor)).join('');
  }
  if (lines && f.lineClip) {
    const lineClipId = ctx.ids.next('lc');
    lines =
      el('clipPath', { id: lineClipId }, el('path', { d: f.lineClip.toString() })) +
      group({ 'clip-path': url(lineClipId) }, lines);
  }
  return group(
    {},
    el('clipPath', { id: clipId }, el('path', { d })),
    group(
      { 'clip-path': url(clipId) },
      el('path', { d, fill: f.fill }),
      ...(f.inside ?? []),
      shadow,
      glossPaint(ctx, f.gloss ?? []),
      ...(f.over ?? []),
    ),
    lines,
  );
}

/** A tapered brush stroke along an elliptical arc (gloss streaks, contour lines). */
export function arcStroke(
  c: Pt,
  rx: number,
  ry: number,
  fromDeg: number,
  toDeg: number,
  width: number,
  rotDeg = 0,
): Path {
  const knots: Knot[] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
    knots.push([c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry]);
  }
  const path = taper(knots, width, { start: 0.05, end: 0.05, swell: 0.7 });
  return rotDeg ? path.rotate(rotDeg, c) : path;
}

/** Small curved fur tuft: a tapered hook starting at `p` heading `deg`, bending by `bend`. */
export function tuft(p: Pt, deg: number, len: number, width: number, bend = 25): Path {
  const a0 = (deg * Math.PI) / 180;
  const a1 = ((deg + bend) * Math.PI) / 180;
  const mid: Pt = [p[0] + Math.cos(a0) * len * 0.55, p[1] + Math.sin(a0) * len * 0.55];
  const end: Pt = [mid[0] + Math.cos(a1) * len * 0.45, mid[1] + Math.sin(a1) * len * 0.45];
  return taper([p, mid, end], width, { start: 0.55, end: 0, swell: 0.8, samples: 16 });
}
