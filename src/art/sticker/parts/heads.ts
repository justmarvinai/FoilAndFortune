import { Path } from '../core/path';
import { arcStroke, fillPath, form, shadowPaint, tuft } from '../draw';
import { fk, fp } from '../rig';
import { Z } from '../sheet';
import { headMarkings } from './extras';
import type { Build, HeadInfo } from './kit';

/**
 * Head shapes (genome.head.shape). Coordinates are normalized to the rig's head frame
 * (u across, v down, ±1 ≈ the head's half size) and drawn in a 3/4 view facing the viewer's
 * left: the facial centerline sits left of center, the far eye is narrower and the muzzle
 * breaks the left contour.
 */
export function drawHead(b: Build): HeadInfo {
  switch (b.g.head.shape) {
    case 'fox':
    case 'feline':
      return foxHead(b);
    case 'axolotl':
      return axolotlHead(b);
    case 'pup':
    case 'round':
    case 'beaked':
      return pupHead(b);
  }
}

function eyeSize(b: Build): number {
  return 0.19 + 0.21 * b.g.face.eyeSize;
}

function foxHead(b: Build): HeadInfo {
  const { paint, ctx } = b;
  const h = b.rig.head;
  const K = (u: number, v: number, k?: number) => fk(h, u, v, k);
  const P = (u: number, v: number) => fp(h, u, v);
  const shape = Path.smooth([
    K(-0.64, -0.82),
    K(-0.2, -0.99),
    K(0.02, -1.08, 0),
    K(0.12, -0.98, 0.5),
    K(0.36, -0.97),
    K(0.74, -0.82),
    K(0.98, -0.44),
    K(1.05, 0.02),
    // Near cheek fluff: three tufts sweeping out and down (the fox read).
    K(1.2, 0.33, 0),
    K(0.99, 0.4, 0.35),
    K(1.1, 0.64, 0),
    K(0.86, 0.68, 0.35),
    K(0.84, 0.93, 0),
    K(0.46, 0.99),
    K(0.02, 0.97),
    K(-0.46, 0.87),
    K(-0.84, 0.54),
    K(-1.0, 0.04),
  ]);
  // Cream lower face: cheeks and chin (fox mask), dipping under each eye.
  const mask = Path.smooth([
    K(-1.6, 0.3, 0),
    K(-0.82, 0.36),
    K(-0.56, 0.44),
    K(-0.32, 0.32),
    K(-0.02, 0.46),
    K(0.3, 0.55),
    K(0.62, 0.44),
    K(0.94, 0.2),
    K(1.6, 0.08, 0),
    K(1.6, 1.6, 0),
    K(-1.6, 1.6, 0),
  ]);
  const hasMuzzle = b.g.head.muzzle !== 'none';
  const snout = b.g.head.muzzle === 'short' || b.g.head.shape === 'feline' ? 0.75 : 1;
  const muzzle = Path.smooth([
    K(-0.2, 0.14),
    K(-0.66, 0.15),
    K(-0.66 - 0.42 * snout, 0.31),
    K(-0.7 - 0.44 * snout, 0.45, 0.8),
    K(-0.64 - 0.38 * snout, 0.59),
    K(-0.7, 0.73),
    K(-0.3, 0.71),
    K(-0.08, 0.44),
  ]);
  const cheekFur = [
    tuft(P(0.66, 0.5), 40, h.a * 0.16, ctx.lw.detail * 0.9, -30),
    tuft(P(0.8, 0.36), 20, h.a * 0.13, ctx.lw.detail * 0.8, -30),
  ].map((t) => fillPath(t, paint.line(paint.secondary)));
  const headSvg = form(ctx, {
    shape,
    fill: paint.primary,
    inside: [fillPath(mask, paint.secondary), ...headMarkings(b, shape)],
    shadow: h.b * 0.13,
    gloss: [arcStroke(P(0.02, 0.06), h.a * 0.84, h.b * 0.86, 197, 247, h.a * 0.085)],
    over: cheekFur,
  });
  const muzzleSvg = hasMuzzle
    ? form(ctx, {
        shape: muzzle,
        fill: paint.secondary,
        shadow: h.b * 0.1,
        // Only the snout's top/front edge is inked; the back melts into the cream cheek.
        lineClip: Path.poly([P(-2, -1), P(-0.3, -1), P(-0.3, 0.3), P(-0.62, 0.62), P(-2, 1.2)]),
      })
    : '';
  b.sheet.put(Z.head, headSvg + muzzleSvg, shape, ...(hasMuzzle ? [muzzle] : []));
  const es = eyeSize(b) * h.b;
  const noseX = -0.62 - 0.42 * snout;
  return {
    shape,
    eyes: [
      { c: P(-0.5, 0.05), rx: es * 0.6, ry: es * 0.96, tilt: 6, near: false },
      { c: P(0.3, 0.1), rx: es * 0.8, ry: es, tilt: -4, near: true },
    ],
    nose: hasMuzzle ? { c: P(noseX - 0.01, 0.33), size: h.a * 0.15 } : null,
    mouth: {
      c: P(noseX + 0.05, 0.53),
      far: P(noseX - 0.06, 0.57),
      near: P(noseX + 0.42, 0.6),
      drop: h.b * 0.26,
      kind: 'muzzle',
    },
    cheeks: [
      { c: P(0.5, 0.52), r: h.a * 0.13 },
      { c: P(-0.74, 0.52), r: h.a * 0.09 },
    ],
    crown: { p: P(0.06, -1.0), deg: -95 },
    forehead: P(-0.12, -0.55),
    earBase: { near: P(0.44, -0.76), far: P(-0.5, -0.7) },
    sides: { near: P(0.96, -0.1), far: P(-0.6, -0.72) },
  };
}

function pupHead(b: Build): HeadInfo {
  const { paint, ctx } = b;
  const h = b.rig.head;
  const K = (u: number, v: number, k?: number) => fk(h, u, v, k);
  const P = (u: number, v: number) => fp(h, u, v);
  const shape = Path.smooth([
    K(-0.56, -0.86),
    K(0.04, -1.0),
    K(0.6, -0.88),
    K(0.95, -0.44),
    K(1.02, 0.1),
    K(0.87, 0.62),
    K(0.46, 0.94),
    K(-0.08, 0.99),
    K(-0.56, 0.87),
    K(-0.9, 0.46),
    K(-1.0, -0.16),
  ]);
  const hasMuzzle = b.g.head.muzzle !== 'none';
  const muzzle = Path.smooth([
    K(-0.14, 0.22),
    K(-0.52, 0.06),
    K(-0.94, 0.13),
    K(-1.13, 0.42, 1.1),
    K(-0.97, 0.74),
    K(-0.54, 0.88),
    K(-0.13, 0.7),
  ]);
  const muzzleCast = shadowPaint(ctx, muzzle.translate(h.a * 0.05, h.b * 0.1), false);
  const headSvg = form(ctx, {
    shape,
    fill: paint.primary,
    inside: [...headMarkings(b, shape), hasMuzzle ? muzzleCast : ''],
    shadow: h.b * 0.17,
    gloss: [arcStroke(P(0.02, 0.04), h.a * 0.84, h.b * 0.85, 198, 250, h.a * 0.085)],
  });
  const muzzleSvg = hasMuzzle
    ? form(ctx, {
        shape: muzzle,
        fill: paint.secondary,
        shadow: h.b * 0.12,
        gloss: [arcStroke(P(-0.55, 0.45), h.a * 0.36, h.b * 0.3, 205, 250, h.a * 0.05)],
      })
    : '';
  b.sheet.put(Z.head, headSvg + muzzleSvg, shape, ...(hasMuzzle ? [muzzle] : []));
  const es = eyeSize(b) * h.b;
  return {
    shape,
    eyes: [
      { c: P(-0.52, -0.12), rx: es * 0.64, ry: es * 0.94, tilt: 4, near: false },
      { c: P(0.25, -0.1), rx: es * 0.84, ry: es, tilt: -3, near: true },
    ],
    nose: hasMuzzle ? { c: P(-0.84, 0.22), size: h.a * 0.17 } : null,
    mouth: {
      c: P(-0.8, 0.44),
      far: P(-1.0, 0.46),
      near: P(-0.36, 0.5),
      drop: h.b * 0.3,
      kind: 'muzzle',
    },
    cheeks: [
      { c: P(0.5, 0.4), r: h.a * 0.14 },
      { c: P(-0.93, 0.02), r: h.a * 0.08 },
    ],
    crown: { p: P(-0.06, -0.99), deg: -95 },
    forehead: P(-0.1, -0.6),
    earBase: { near: P(0.8, -0.58), far: P(-0.8, -0.58) },
    sides: { near: P(0.96, -0.1), far: P(-0.7, -0.66) },
  };
}

function axolotlHead(b: Build): HeadInfo {
  const { paint, ctx } = b;
  const h = b.rig.head;
  const K = (u: number, v: number, k?: number) => fk(h, u, v, k);
  const P = (u: number, v: number) => fp(h, u, v);
  // Wide, flat, friendly: a rounded wedge whose broad front faces the viewer's left.
  const shape = Path.smooth([
    K(-0.66, -0.8),
    K(-0.12, -0.99),
    K(0.5, -0.94),
    K(0.93, -0.52),
    K(1.02, 0.06),
    K(0.84, 0.6),
    K(0.36, 0.93),
    K(-0.26, 0.99),
    K(-0.76, 0.8),
    K(-1.0, 0.36),
    K(-1.03, -0.22),
  ]);
  const mouth = {
    c: P(-0.42, 0.5),
    far: P(-0.93, 0.28),
    near: P(0.46, 0.38),
    drop: h.b * 0.4,
    kind: 'wide' as const,
  };
  const headSvg = form(ctx, {
    shape,
    fill: paint.primary,
    inside: headMarkings(b, shape),
    shadow: h.b * 0.2,
    gloss: [arcStroke(P(0.0, 0.08), h.a * 0.86, h.b * 0.86, 196, 250, h.b * 0.13)],
  });
  b.sheet.put(Z.head, headSvg, shape);
  const es = eyeSize(b) * h.b;
  return {
    shape,
    eyes: [
      { c: P(-0.7, -0.3), rx: es * 0.62, ry: es * 0.86, tilt: 0, near: false },
      { c: P(0.16, -0.28), rx: es * 0.8, ry: es * 0.92, tilt: 0, near: true },
    ],
    nose: null,
    mouth,
    cheeks: [
      { c: P(0.36, 0.14), r: h.a * 0.11 },
      { c: P(-0.86, 0.1), r: h.a * 0.07 },
    ],
    crown: { p: P(-0.1, -0.99), deg: -95 },
    forehead: P(-0.2, -0.6),
    earBase: { near: P(0.5, -0.8), far: P(-0.6, -0.76) },
    sides: { near: P(0.8, -0.36), far: P(-0.36, -0.86) },
  };
}
