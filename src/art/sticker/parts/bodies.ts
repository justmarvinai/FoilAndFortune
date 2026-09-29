import { luminance } from '../core/color';
import { type Knot, knot, lerp, Path } from '../core/path';
import { taper } from '../core/shapes';
import { fillPath, form, shadowPaint } from '../draw';
import { type Frame, fk, fp, type LegRig } from '../rig';
import { Z } from '../sheet';
import { bodyMarkings, chevrons, legMarkings } from './extras';
import type { Build, HeadInfo } from './kit';

/** Torso and legs per body plan (genome.plan via the rig). */
export function drawBody(b: Build, head: HeadInfo): void {
  if (b.rig.plan === 'amphibian') amphibianBody(b, head);
  else quadrupedBody(b, head);
}

/** The head's shadow falling on the chest/back: sells that the head sits in front. */
function headCast(b: Build, head: HeadInfo): string {
  const f = b.rig.body;
  const shape = head.shape.rotate(b.rig.tilt, b.rig.neck).translate(f.a * 0.04, f.b * 0.2);
  return shadowPaint(b.ctx, shape, false);
}

function quadrupedBody(b: Build, head: HeadInfo): void {
  const { paint, ctx } = b;
  const f = b.rig.body;
  const K = (u: number, v: number, k?: number) => fk(f, u, v, k);
  const sit = b.rig.stance === 'sit';
  const shape = sit
    ? Path.smooth([
        K(-0.78, -0.8),
        K(-0.1, -1.0),
        K(0.55, -0.8),
        K(0.92, -0.14),
        K(1.0, 0.52),
        K(0.74, 0.97),
        K(-0.2, 1.0),
        K(-0.8, 0.64),
        K(-0.99, -0.06),
      ])
    : Path.smooth([
        K(-0.98, 0.04),
        K(-0.76, -0.7),
        K(-0.16, -0.99),
        K(0.5, -0.94),
        K(0.95, -0.4, 1.1),
        K(0.96, 0.44),
        K(0.5, 0.96),
        K(-0.3, 1.0),
        K(-0.86, 0.68),
      ]);
  // Pale chest-and-belly patch: the chest shows under the chin, the belly between the legs.
  const bellyC = sit ? fp(f, -0.62, 0.3) : fp(f, -0.42, 0.62);
  const belly = sit
    ? Path.ellipse(bellyC[0], bellyC[1], f.a * 0.5, f.b * 0.72, 8)
    : Path.ellipse(bellyC[0], bellyC[1], f.a * 0.62, f.b * 0.62, 12);
  const svg = form(ctx, {
    shape,
    fill: paint.primary,
    inside: [fillPath(belly, paint.belly), ...bodyMarkings(b), headCast(b, head)],
    shadow: f.b * (sit ? 0.22 : 0.26),
  });
  b.sheet.put(Z.body, svg, shape);
  for (const leg of b.rig.legs) drawLeg(b, leg);
  if (b.rig.haunch) drawHaunch(b, b.rig.haunch);
}

/** Sitting haunch: a round thigh on the flank with the hind paw resting forward on the ground. */
function drawHaunch(b: Build, h: Frame): void {
  const { paint, ctx } = b;
  const ground = b.rig.ground;
  const pawH = h.b * 0.36;
  const K = (u: number, v: number, k?: number) => fk(h, u, v, k);
  const shape = Path.smooth([
    K(-0.9, -0.1),
    K(-0.55, -0.84),
    K(0.18, -1.0),
    K(0.84, -0.58),
    K(1.0, 0.16),
    K(0.72, 0.86),
    [h.c[0] + h.a * 0.2, ground, 0.8],
    [h.c[0] - h.a * 0.5, ground, 0.8],
    [h.c[0] - h.a * 0.76, ground - pawH * 0.55],
    [h.c[0] - h.a * 0.6, ground - pawH * 1.1],
    [h.c[0] - h.a * 0.34, ground - pawH * 1.35],
  ]);
  const toes = [-0.52, -0.32].map((u) =>
    fillPath(
      taper(
        [
          [h.c[0] + h.a * u, ground - pawH * 0.62],
          [h.c[0] + h.a * (u - 0.02), ground - pawH * 0.08],
        ],
        ctx.lw.detail * 0.9,
        { start: 0.3, end: 0.5 },
      ),
      toeColor(b, false),
    ),
  );
  const leg: LegRig = {
    top: h.c,
    foot: [h.c[0] - h.a * 0.8, ground],
    w: h.a * 0.6,
    far: false,
    hind: true,
  };
  const svg = form(ctx, {
    shape,
    fill: paint.primary,
    inside: [...chevrons(b, h, -0.1, 0.45, 0.8), ...legMarkings(b, leg)],
    shadow: h.b * 0.3,
    gloss: [
      taper([fp(h, -0.62, -0.5), fp(h, -0.2, -0.86), fp(h, 0.3, -0.86)], h.b * 0.1, {
        start: 0.1,
        end: 0.1,
      }),
    ],
    over: toes,
  });
  b.sheet.put(Z.nearHind, svg, shape);
}

function drawLeg(b: Build, leg: LegRig): void {
  const { paint, ctx } = b;
  const color = leg.far ? paint.far(paint.primary) : paint.primary;
  const amphibian = b.rig.plan === 'amphibian';
  const shape = amphibian ? stubbyLeg(leg) : leg.hind && !leg.far ? haunchLeg(leg) : columnLeg(leg);
  const toes = amphibian ? [] : toeLines(b, leg);
  const z = leg.far ? Z.farLeg : leg.hind ? Z.nearHind : Z.nearFront;
  // Near legs overlap the torso: ink only their lower part so they grow out of the body.
  const lineClip = leg.far
    ? undefined
    : Path.rect(
        leg.foot[0] - leg.w * 4,
        leg.top[1] + leg.w * (leg.hind ? -0.1 : 0.55),
        leg.w * 8,
        leg.w * 8,
      );
  const svg = form(ctx, {
    shape,
    fill: color,
    inside: legMarkings(b, leg),
    shadow: leg.w * 0.3,
    over: toes,
    lineClip,
  });
  b.sheet.put(z, svg, shape);
}

function columnLeg(leg: LegRig): Path {
  const { top, foot, w } = leg;
  const pawW = w * 1.2;
  const pawH = w * 0.44;
  return Path.smooth([
    [top[0] - w * 0.5, top[1] - w * 0.4],
    [lerp(top[0], foot[0], 0.5) - w * 0.5, lerp(top[1], foot[1], 0.5)],
    [foot[0] - w * 0.47, foot[1] - pawH * 1.25],
    [foot[0] - pawW * 0.64, foot[1] - pawH * 0.42],
    [foot[0] - pawW * 0.38, foot[1], 0.9],
    [foot[0] + pawW * 0.3, foot[1], 0.9],
    [foot[0] + pawW * 0.5, foot[1] - pawH * 0.5],
    [foot[0] + w * 0.47, foot[1] - pawH * 1.3],
    [lerp(top[0], foot[0], 0.45) + w * 0.5, lerp(top[1], foot[1], 0.45)],
    [top[0] + w * 0.5, top[1] - w * 0.4],
  ]);
}

/** Near hind leg: a round haunch on the flank tapering into a short hock and paw. */
function haunchLeg(leg: LegRig): Path {
  const { top, foot, w } = leg;
  const pawW = w * 1.2;
  const pawH = w * 0.44;
  return Path.smooth([
    [top[0] - w * 0.95, top[1] + w * 0.25],
    [top[0] - w * 0.6, top[1] - w * 0.55],
    [top[0] + w * 0.35, top[1] - w * 0.75],
    [top[0] + w * 0.98, top[1] + w * 0.05],
    [foot[0] + w * 0.52, foot[1] - pawH * 1.5],
    [foot[0] + pawW * 0.5, foot[1] - pawH * 0.5],
    [foot[0] + pawW * 0.3, foot[1], 0.9],
    [foot[0] - pawW * 0.4, foot[1], 0.9],
    [foot[0] - pawW * 0.64, foot[1] - pawH * 0.42],
    [foot[0] - w * 0.45, foot[1] - pawH * 1.25],
    [top[0] - w * 0.42, top[1] + w * 1.1],
  ]);
}

/** Axolotl legs: short, splayed, with little round fingers. */
function stubbyLeg(leg: LegRig): Path {
  const { top, foot, w } = leg;
  const f = w * 0.3;
  const knots: Knot[] = [
    [top[0] - w * 0.5, top[1] - w * 0.3],
    [lerp(top[0], foot[0], 0.55) - w * 0.46, lerp(top[1], foot[1], 0.55)],
    [foot[0] - w * 0.55, foot[1] - f * 1.4],
    // Fingers: rounded bumps along the front of the hand.
    [foot[0] - w * 0.98, foot[1] - f * 0.9, 0.9],
    knot([foot[0] - w * 0.72, foot[1] - f * 0.35], 0.2),
    [foot[0] - w * 0.78, foot[1] + f * 0.08, 0.9],
    knot([foot[0] - w * 0.42, foot[1] - f * 0.05], 0.2),
    [foot[0] - w * 0.3, foot[1] + f * 0.2, 0.9],
    knot([foot[0] - w * 0.02, foot[1] - f * 0.02], 0.2),
    [foot[0] + w * 0.16, foot[1] + f * 0.12, 0.9],
    [foot[0] + w * 0.5, foot[1] - f * 0.3],
    [foot[0] + w * 0.45, foot[1] - f * 1.6],
    [lerp(top[0], foot[0], 0.5) + w * 0.5, lerp(top[1], foot[1], 0.5)],
    [top[0] + w * 0.5, top[1] - w * 0.3],
  ];
  return Path.smooth(knots);
}

/** Toe creases, in a tone that reads on the paw's actual color (dark socks get light lines). */
export function toeColor(b: Build, far: boolean): string {
  const socks = b.g.extras.find((x) => x.kind === 'socks');
  const paw = socks ? b.paint.ref(socks.color) : b.paint.primary;
  const base = far ? b.paint.far(paw) : paw;
  return luminance(base) < 0.45 ? b.paint.light(base, 0.2) : b.paint.line(base);
}

function toeLines(b: Build, leg: LegRig): string[] {
  const { foot, w } = leg;
  const pawH = w * 0.44;
  const color = toeColor(b, leg.far);
  return [-0.3, 0.06].map((dx) =>
    fillPath(
      taper(
        [
          [foot[0] + dx * w - w * 0.04, foot[1] - pawH * 0.62],
          [foot[0] + dx * w - w * 0.06, foot[1] - pawH * 0.08],
        ],
        b.ctx.lw.detail * 0.9,
        { start: 0.3, end: 0.5 },
      ),
      color,
    ),
  );
}

function amphibianBody(b: Build, head: HeadInfo): void {
  const { paint, ctx } = b;
  const f = b.rig.body;
  const K = (u: number, v: number, k?: number) => fk(f, u, v, k);
  const shape = Path.smooth([
    K(-1.0, -0.08),
    K(-0.62, -0.88),
    K(0.08, -1.0),
    K(0.66, -0.8),
    K(1.0, -0.22),
    K(0.88, 0.5),
    K(0.3, 0.94),
    K(-0.42, 1.0),
    K(-0.9, 0.62),
  ]);
  const belly = Path.smooth([
    K(-1.4, 0.36, 0),
    K(-0.6, 0.44),
    K(0.2, 0.5),
    K(0.8, 0.36),
    K(1.4, 0.2, 0),
    K(1.4, 1.4, 0),
    K(-1.4, 1.4, 0),
  ]);
  if (b.g.tail.shape === 'fin') drawCrest(b);
  const svg = form(ctx, {
    shape,
    fill: paint.primary,
    inside: [fillPath(belly, paint.belly), ...bodyMarkings(b), headCast(b, head)],
    shadow: f.b * 0.32,
    gloss: [
      taper([fp(f, -0.2, -0.8), fp(f, 0.2, -0.9), fp(f, 0.55, -0.78)], f.b * 0.12, {
        start: 0.1,
        end: 0.1,
      }),
    ],
  });
  b.sheet.put(Z.body, svg, shape);
  for (const leg of b.rig.legs) drawLeg(b, leg);
}

/** Low dorsal fin along the back, flowing into the tail fin. */
function drawCrest(b: Build): void {
  const { paint, ctx } = b;
  const f = b.rig.body;
  const membrane = paint.mix(paint.primary, paint.glow, 0.6);
  const top: Knot[] = [];
  const inner: Knot[] = [];
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const u = -0.25 + (1.2 * i) / steps;
    const v = -Math.sqrt(Math.max(0, 1 - Math.min(0.99, u * u))) * 0.98;
    const rise = f.b * (0.2 + 0.1 * Math.sin((i / steps) * Math.PI)) * (i % 2 === 0 ? 1 : 0.86);
    const p = fp(f, u, v);
    top.push([p[0], p[1] - rise]);
    inner.push([p[0], p[1] + f.b * 0.3]);
  }
  const shape = Path.smooth([...top, ...inner.reverse()]);
  b.sheet.put(Z.body - 1, form(ctx, { shape, fill: membrane, shadow: f.b * 0.06 }), shape);
}
