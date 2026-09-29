import { mix } from '../core/color';
import { type Knot, lerpPt, Path, type Pt } from '../core/path';
import { sparkle, taper } from '../core/shapes';
import { el, group, url } from '../core/svg';
import { fillPath, strokePath } from '../draw';
import { Z } from '../sheet';
import type { Build, EyeAnchor, HeadInfo, MouthAnchor } from './kit';

/**
 * Faces: the part that sells the character. Big glossy eyes with two highlights (docs/04 §6),
 * inked tapered mouth lines, a button nose and optional blush.
 */
export function drawFace(b: Build, head: HeadInfo): void {
  const parts: string[] = [];
  if (b.g.face.blush) parts.push(drawBlush(b, head));
  for (const e of head.eyes) parts.push(b.pose === 'happy' ? happyEye(b, e) : drawEye(b, e));
  parts.push(drawMouth(b, head));
  if (head.nose && b.g.head.nose !== 'none') parts.push(drawNose(b, head.nose));
  b.sheet.put(Z.face, parts.join(''));
}

function ellipsePt(e: EyeAnchor, deg: number, scale = 1): Pt {
  const a = (deg * Math.PI) / 180;
  const t = (e.tilt * Math.PI) / 180;
  const x = Math.cos(a) * e.rx * scale;
  const y = Math.sin(a) * e.ry * scale;
  return [e.c[0] + x * Math.cos(t) - y * Math.sin(t), e.c[1] + x * Math.sin(t) + y * Math.cos(t)];
}

function drawEye(b: Build, e: EyeAnchor): string {
  const { ctx, paint } = b;
  const type = b.g.face.eyes;
  const { c, rx, ry, tilt } = e;
  const eye = Path.ellipse(c[0], c[1], rx, ry, tilt);
  const clipId = ctx.ids.next('eye');
  const sparkly = type === 'sparkle';
  const iris = mix(paint.eyes, sparkly ? paint.accent : paint.primary, sparkly ? 0.55 : 0.4);
  const irisLight = mix(iris, sparkly ? paint.glow : '#FFFFFF', sparkly ? 0.5 : 0.25);
  // Outer corner sits away from the facial centerline (right for the near eye).
  const outer = e.near ? 1 : -1;
  const inside: string[] = [
    fillPath(eye, paint.eyes),
    fillPath(Path.ellipse(c[0] + rx * 0.06, c[1] + ry * 0.66, rx * 0.98, ry * 0.62, tilt), iris),
  ];
  if (sparkly) {
    inside.push(
      fillPath(
        Path.ellipse(c[0] + rx * 0.08, c[1] + ry * 0.86, rx * 0.66, ry * 0.36, tilt),
        irisLight,
      ),
    );
  }
  // Two highlights: a big one toward the key light, a small bounce opposite.
  const hi1 = Path.ellipse(c[0] - rx * 0.26, c[1] - ry * 0.34, rx * 0.4, ry * 0.3, tilt - 24);
  const hi2 = Path.circle(c[0] + rx * 0.32, c[1] + ry * 0.36, Math.min(rx, ry) * 0.17);
  inside.push(fillPath(hi1, '#FFFFFF'), fillPath(hi2, '#FFFFFF'));
  if (sparkly) {
    inside.push(
      fillPath(
        sparkle([c[0] - rx * 0.36, c[1] + ry * 0.3], rx * 0.2, { inner: 0.3, rot: -90 }),
        '#FFFFFF',
        {
          'fill-opacity': 0.9,
        },
      ),
    );
  }
  // Upper lid: a heavy tapered line hugging the top of the eye, flicking out at the outer
  // corner; fierce eyes get an angled lid, sleepy eyes a half-closed one.
  const lidKnots: Knot[] = [];
  const from = outer > 0 ? 196 : 344;
  const to = outer > 0 ? 344 : 196;
  for (let i = 0; i <= 6; i++) lidKnots.push(ellipsePt(e, from + ((to - from) * i) / 6, 1.02));
  const flickBase = ellipsePt(e, outer > 0 ? 344 : 196, 1.02);
  lidKnots.push([flickBase[0] + outer * rx * 0.34, flickBase[1] - ry * 0.2]);
  const lidWidth = ctx.lw.inner * (sparkly ? 1.9 : 1.5);
  let lid = fillPath(taper(lidKnots, lidWidth, { start: 0.35, end: 0.05, swell: 0.4 }), ctx.ink);
  const extra: string[] = [];
  if (type === 'sleepy' || type === 'fierce') {
    const lidCut =
      type === 'sleepy'
        ? Path.poly([
            ellipsePt(e, 180, 1.3),
            ellipsePt(e, 0, 1.3),
            [c[0] + rx * 1.3, c[1] - ry * 1.4],
            [c[0] - rx * 1.3, c[1] - ry * 1.4],
          ])
        : Path.poly([
            [c[0] - outer * rx * 1.3, c[1] - ry * 0.05],
            [c[0] + outer * rx * 1.3, c[1] - ry * 0.75],
            [c[0] + outer * rx * 1.3, c[1] - ry * 1.5],
            [c[0] - outer * rx * 1.3, c[1] - ry * 1.5],
          ]);
    extra.push(fillPath(lidCut, paint.primary));
    const edge =
      type === 'sleepy'
        ? [ellipsePt(e, 180, 1.05), [c[0], c[1] + ry * 0.05] as Pt, ellipsePt(e, 0, 1.05)]
        : [
            [c[0] - outer * rx * 1.05, c[1] - ry * 0.1] as Pt,
            [c[0] + outer * rx * 1.1, c[1] - ry * 0.72] as Pt,
          ];
    lid = fillPath(taper(edge, lidWidth, { start: 0.4, end: 0.3 }), ctx.ink);
  }
  return group(
    {},
    el('clipPath', { id: clipId }, el('path', { d: eye.toString() })),
    group({ 'clip-path': url(clipId) }, ...inside, ...extra),
    strokePath(ctx, eye, ctx.lw.inner * 0.7),
    lid,
  );
}

/** Closed, smiling "^" eyes for the happy pose. */
function happyEye(b: Build, e: EyeAnchor): string {
  const knots: Knot[] = [
    ellipsePt(e, 200, 0.9),
    [e.c[0], e.c[1] - e.ry * 0.55],
    ellipsePt(e, 340, 0.9),
  ];
  return fillPath(
    taper(knots, b.ctx.lw.inner * 2.2, { start: 0.5, end: 0.5, swell: 0.3 }),
    b.ctx.ink,
  );
}

function drawNose(b: Build, nose: { c: Pt; size: number }): string {
  const { c, size } = nose;
  const w = size;
  const h = size * 0.72;
  const sharp = b.g.head.nose === 'triangle';
  const shape = Path.smooth([
    [c[0] - w * 0.5, c[1] - h * 0.32],
    [c[0], c[1] - h * 0.52],
    [c[0] + w * 0.5, c[1] - h * 0.3],
    [c[0] + w * 0.08, c[1] + h * 0.5, sharp ? 0 : 0.8],
  ]);
  const shine = Path.ellipse(c[0] - w * 0.14, c[1] - h * 0.2, w * 0.18, h * 0.12, -10);
  return (
    fillPath(shape, b.paint.eyes) +
    strokePath(b.ctx, shape, b.ctx.lw.inner * 0.8) +
    fillPath(shine, '#FFFFFF', { 'fill-opacity': 0.85 })
  );
}

function drawMouth(b: Build, head: HeadInfo): string {
  const { ctx, paint } = b;
  const m = head.mouth;
  const style = b.pose === 'happy' && b.g.face.mouth === 'smile' ? 'open' : b.g.face.mouth;
  const w = ctx.lw.inner * 1.25;
  const ink = (knots: readonly Knot[], width = w) =>
    fillPath(taper(knots, width, { start: 0.45, end: 0.3, swell: 0.5 }), ctx.ink);
  const philtrum = (): string =>
    head.nose
      ? ink(
          [[head.nose.c[0] + head.nose.size * 0.05, head.nose.c[1] + head.nose.size * 0.3], m.c],
          w * 0.85,
        )
      : '';
  switch (style) {
    case 'none':
      return '';
    case 'beak':
      return fillPath(
        Path.smooth([
          m.far,
          [m.c[0], m.c[1] - m.drop * 0.3, 0],
          m.near,
          [m.c[0], m.c[1] + m.drop * 0.6, 0],
        ]),
        paint.glow,
      );
    case 'smile':
    case 'fang': {
      if (m.kind === 'wide') return wideSmile(b, m, style === 'fang');
      const near = sideCurve(m, m.near, 0.55);
      const far = sideCurve(m, m.far, 0.45);
      const fang =
        style === 'fang'
          ? fillPath(
              Path.poly([
                lerpPt(m.c, m.near, 0.45),
                lerpPt(m.c, m.near, 0.7),
                [lerpPt(m.c, m.near, 0.55)[0], m.c[1] + m.drop * 0.55],
              ]),
              '#FFFFFF',
            )
          : '';
      return philtrum() + ink(near) + ink(far) + fang;
    }
    case 'grin':
    case 'open':
      return openMouth(b, m, style === 'open') + philtrum();
  }
}

/** One side of a cat/dog "w" mouth: dips below the corner line, curls up at the corner. */
function sideCurve(m: MouthAnchor, corner: Pt, dip: number): Knot[] {
  const mid = lerpPt(m.c, corner, 0.5);
  return [m.c, [mid[0], mid[1] + m.drop * dip * 0.6], [corner[0], corner[1] - m.drop * 0.12]];
}

function wideSmile(b: Build, m: MouthAnchor, fang: boolean): string {
  const { ctx } = b;
  const dip = m.drop * 0.55;
  const knots: Knot[] = [
    [m.far[0] + (m.c[0] - m.far[0]) * 0.02, m.far[1] - m.drop * 0.18],
    [m.far[0] + (m.c[0] - m.far[0]) * 0.35, m.far[1] + dip * 0.55],
    [m.c[0], m.c[1] + dip * 0.35],
    [m.c[0] + (m.near[0] - m.c[0]) * 0.55, m.c[1] + dip * 0.12],
    [m.near[0], m.near[1] - m.drop * 0.2],
  ];
  const line = fillPath(
    taper(knots, ctx.lw.inner * 1.5, { start: 0.45, end: 0.45, swell: 0.35 }),
    ctx.ink,
  );
  // Little upturned curls at the corners make the smile read at card size.
  const curl = (p: Pt, dir: 1 | -1) =>
    fillPath(
      taper(
        [
          [p[0] - dir * m.drop * 0.05, p[1] + m.drop * 0.1],
          [p[0] + dir * m.drop * 0.18, p[1] - m.drop * 0.02],
        ],
        ctx.lw.inner * 1.1,
        {
          start: 0.6,
          end: 0.2,
        },
      ),
      ctx.ink,
    );
  const tooth = fang
    ? fillPath(
        Path.poly([
          [m.c[0], m.c[1] + dip * 0.3],
          [m.c[0] + m.drop * 0.3, m.c[1] + dip * 0.28],
          [m.c[0] + m.drop * 0.14, m.c[1] + dip * 1.1],
        ]),
        '#FFFFFF',
      )
    : '';
  return line + curl(knots[0] as Pt, -1) + curl(knots[knots.length - 1] as Pt, 1) + tooth;
}

function openMouth(b: Build, m: MouthAnchor, round: boolean): string {
  const { ctx, paint } = b;
  const drop = m.drop * (round ? 1.1 : 1);
  const nearMid = lerpPt(m.c, m.near, 0.5);
  const farMid = lerpPt(m.c, m.far, 0.5);
  const shape = Path.smooth([
    [m.far[0], m.far[1] - drop * 0.08, 0],
    [farMid[0], farMid[1] + drop * 0.08],
    [m.c[0], m.c[1] - drop * 0.02, 0.6],
    [nearMid[0], nearMid[1] + drop * 0.02],
    [m.near[0], m.near[1] - drop * 0.18, 0],
    [m.near[0] - (m.near[0] - m.c[0]) * 0.2, m.near[1] + drop * 0.55],
    [m.c[0] + (m.near[0] - m.c[0]) * 0.25, m.c[1] + drop * 1.0],
    [m.c[0] - (m.c[0] - m.far[0]) * 0.4, m.c[1] + drop * 0.72],
  ]);
  const clipId = ctx.ids.next('mouth');
  const tongue = Path.ellipse(
    m.c[0] + (m.near[0] - m.c[0]) * 0.22,
    m.c[1] + drop * 1.02,
    (m.near[0] - m.far[0]) * 0.36,
    drop * 0.46,
    -6,
  );
  const tongueLine = taper(
    [
      [m.c[0] + (m.near[0] - m.c[0]) * 0.2, m.c[1] + drop * 0.72],
      [m.c[0] + (m.near[0] - m.c[0]) * 0.24, m.c[1] + drop * 0.95],
    ],
    ctx.lw.inner * 0.7,
    { start: 0.4, end: 0.1 },
  );
  return group(
    {},
    el('clipPath', { id: clipId }, el('path', { d: shape.toString() })),
    group(
      { 'clip-path': url(clipId) },
      fillPath(shape, paint.mouth),
      fillPath(tongue, paint.tongue),
      fillPath(tongueLine, mix(paint.tongue, paint.mouth, 0.55)),
    ),
    strokePath(ctx, shape, ctx.lw.inner * 1.1),
  );
}

function drawBlush(b: Build, head: HeadInfo): string {
  const { paint, ctx } = b;
  return head.cheeks
    .map((cheek, i) => {
      const r = cheek.r;
      const oval = Path.ellipse(cheek.c[0], cheek.c[1], r * (i === 0 ? 1.25 : 0.8), r * 0.72, -6);
      const hatch = [-0.4, 0, 0.4].slice(i === 0 ? 0 : 1).map((dx) =>
        fillPath(
          taper(
            [
              [cheek.c[0] + dx * r + r * 0.12, cheek.c[1] - r * 0.28],
              [cheek.c[0] + dx * r - r * 0.12, cheek.c[1] + r * 0.28],
            ],
            ctx.lw.detail * 0.7,
            { start: 0.3, end: 0.3 },
          ),
          '#FFFFFF',
          { 'fill-opacity': 0.75 },
        ),
      );
      return fillPath(oval, paint.blush, { 'fill-opacity': 0.72 }) + hatch.join('');
    })
    .join('');
}
