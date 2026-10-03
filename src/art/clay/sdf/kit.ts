import type { Rgb } from '../color';
import {
  add,
  cross,
  frameAlongX,
  frameAlongY,
  fromAxes,
  glf,
  glMat3,
  glVec3,
  length,
  lerp3,
  type Mat3,
  mirrorZ,
  mulMV,
  normalize,
  scale,
  sub,
  transpose,
  type Vec3,
} from '../math';
import { type Frame, type Group, PART_TAGS, type Part, type Shape, type Surface } from './types';

/**
 * The "part kit": small builders shared by all body plans (surfaces, bounds, paint layers).
 * Everything returns plain data or GLSL snippets with baked constants.
 */

// ---- Surfaces -----------------------------------------------------------------------------

export const fur = (color: Rgb, extra: Partial<Surface> = {}): Surface => ({
  kind: 'fur',
  color,
  ...extra,
});
export const glossy = (color: Rgb, extra: Partial<Surface> = {}): Surface => ({
  kind: 'glossy',
  color,
  ...extra,
});
export const emissive = (color: Rgb, emit: Rgb, extra: Partial<Surface> = {}): Surface => ({
  kind: 'emissive',
  color,
  emit,
  ...extra,
});
export const finSurface = (color: Rgb, extra: Partial<Surface> = {}): Surface => ({
  kind: 'fin',
  color,
  ...extra,
});

export function part(
  name: string,
  tag: Part['tag'],
  shape: Shape,
  blend: number,
  surface: Surface,
  op: Part['op'] = 'add',
): Part {
  return { name, tag, shape, blend, surface, op };
}

/**
 * A tapered "leaf" (ears, flames, feathers, fins) growing from `base` along `axis`; its flat side
 * faces `faceHint` (local +X), and `bend` curls it toward that side.
 */
export function leafPart(
  name: string,
  tag: Part['tag'],
  base: Vec3,
  axis: Vec3,
  faceHint: Vec3,
  h: number,
  ra: number,
  rb: number,
  thin: number,
  bend: number,
  blend: number,
  surface: Part['surface'],
): Part {
  const shape: Extract<Shape, { type: 'leaf' }> = {
    type: 'leaf',
    c: base,
    rot: frameAlongY(axis, faceHint),
    h,
    ra,
    rb,
    thin,
    bend,
  };
  return part(name, tag, shape, blend, surface);
}

// ---- Orientation helpers --------------------------------------------------------------------

/** Frame (local → parent) whose local +Z faces `normal` and local +Y leans toward `upHint`. */
export function frameFacingZ(normal: Vec3, upHint: Vec3): Mat3 {
  const z = normalize(normal);
  let y = sub(upHint, scale(z, upHint[0] * z[0] + upHint[1] * z[1] + upHint[2] * z[2]));
  if (length(y) < 1e-5) y = [0, 1, 0];
  y = normalize(y);
  const x = cross(y, z);
  return fromAxes(x, y, z);
}

/** Point on an axis-aligned ellipsoid surface (radii `r`) in direction `dir`. */
export function onEllipsoid(r: Vec3, dir: Vec3): Vec3 {
  const d = normalize(dir);
  const k = 1 / Math.sqrt((d[0] / r[0]) ** 2 + (d[1] / r[1]) ** 2 + (d[2] / r[2]) ** 2);
  return scale(d, k);
}

/** Outward normal of an axis-aligned ellipsoid at surface point `p`. */
export function ellipsoidNormal(r: Vec3, p: Vec3): Vec3 {
  return normalize([p[0] / (r[0] * r[0]), p[1] / (r[1] * r[1]), p[2] / (r[2] * r[2])]);
}

// ---- Bounds ---------------------------------------------------------------------------------

interface Ball {
  c: Vec3;
  r: number;
}

export function bezierTangent(a: Vec3, b: Vec3, c: Vec3, t: number): Vec3 {
  return normalize(lerp3(sub(b, a), sub(c, b), t));
}

export function bezierPoint(a: Vec3, b: Vec3, c: Vec3, t: number): Vec3 {
  return lerp3(lerp3(a, b, t), lerp3(b, c, t), t);
}

export function tubeRadius(r: Vec3, t: number): number {
  const s = (x: number) => x * x * (3 - 2 * x);
  return t < 0.5 ? r[0] + (r[1] - r[0]) * s(t * 2) : r[1] + (r[2] - r[1]) * s((t - 0.5) * 2);
}

/** Conservative ball samples covering a shape (in group coordinates). */
export function shapeBalls(s: Shape): Ball[] {
  switch (s.type) {
    case 'sphere':
      return [{ c: s.c, r: s.r }];
    case 'ellipsoid':
      return [{ c: s.c, r: Math.max(s.r[0], s.r[1], s.r[2]) }];
    case 'roundCone':
      return [
        { c: s.a, r: s.ra },
        { c: lerp3(s.a, s.b, 0.5), r: (s.ra + s.rb) / 2 },
        { c: s.b, r: s.rb },
      ];
    case 'leaf': {
      const balls: Ball[] = [];
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const local: Vec3 = [s.bend * s.h * t * t, s.h * t, 0];
        balls.push({ c: add(s.c, mulMV(s.rot, local)), r: s.ra + (s.rb - s.ra) * t });
      }
      return balls;
    }
    case 'tube':
    case 'finTube': {
      const extra = s.type === 'finTube' ? Math.max(s.fin[0], s.fin[1], s.fin[2]) : 0;
      const balls: Ball[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        balls.push({ c: bezierPoint(s.a, s.b, s.c, t), r: tubeRadius(s.r, t) + extra });
      }
      return balls;
    }
    case 'star4':
      return [{ c: s.c, r: s.r + s.thick }];
    case 'torus': {
      const balls: Ball[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const local: Vec3 = [Math.cos(a) * s.R, 0, Math.sin(a) * s.R];
        balls.push({ c: add(s.c, mulMV(s.rot, local)), r: s.r * 1.1 + s.R * 0.4 });
      }
      return balls;
    }
    case 'cylinder': {
      // Short fat cylinders fit one ball; tall ones get a ball every radius along the axis, each
      // big enough to reach the rim halfway to its neighbors.
      const along = Math.max(0, s.h - s.r);
      if (along === 0) return [{ c: s.c, r: Math.hypot(s.r, s.h) }];
      const n = Math.ceil((2 * along) / s.r);
      const step = (2 * along) / n;
      const reach = Math.hypot(s.r, Math.max(step / 2, s.h - along));
      return Array.from({ length: n + 1 }, (_, i) => ({
        c: add(s.c, mulMV(s.rot, [0, -along + i * step, 0])),
        r: reach,
      }));
    }
  }
}

/** Bounding sphere of a group's additive parts (group coordinates). */
export function groupBound(parts: readonly Part[], pad = 0.01): Ball {
  const balls = parts.filter((p) => p.op !== 'carve').flatMap((p) => shapeBalls(p.shape));
  if (balls.length === 0) return { c: [0, 0, 0], r: 0.01 };
  const lo: [number, number, number] = [Infinity, Infinity, Infinity];
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const b of balls) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i] ?? 0, (b.c[i] ?? 0) - b.r);
      hi[i] = Math.max(hi[i] ?? 0, (b.c[i] ?? 0) + b.r);
    }
  }
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  let r = 0;
  for (const b of balls) r = Math.max(r, length(sub(b.c, c)) + b.r);
  return { c, r: r + pad };
}

export function makeGroup(
  name: string,
  frame: Frame,
  mirror: boolean,
  blend: number,
  parts: Part[],
  paints: string[] = [],
): Group {
  return { name, frame, mirror, blend, parts, paints, bound: groupBound(parts) };
}

/** A bounding ball in body coordinates (center + radius). */
export interface HullBall {
  c: Vec3;
  r: number;
}

/**
 * Silhouette hull as balls in body coordinates, for camera framing and the march box. Balls
 * (not axis-extreme points) keep extents exact under any rotation.
 */
export function groupHull(group: Group, headCenter: Vec3, headRot: Mat3): HullBall[] {
  const balls: HullBall[] = [];
  const toBody = (p: Vec3): Vec3 =>
    group.frame === 'head' ? add(headCenter, mulMV(headRot, p)) : p;
  for (const part of group.parts) {
    if (part.op === 'carve') continue;
    for (const ball of shapeBalls(part.shape)) {
      const centers = group.mirror ? [ball.c, mirrorZ(ball.c)] : [ball.c];
      for (const c of centers) balls.push({ c: toBody(c), r: ball.r });
    }
  }
  return balls;
}

// ---- Paint layers (GLSL snippets) --------------------------------------------------------------

const tagId = (tag: keyof typeof PART_TAGS) => glf(PART_TAGS[tag]);
const col = (c: Rgb) => `vec3(${glf(c[0])}, ${glf(c[1])}, ${glf(c[2])})`;

/** Only paint on matte "fur" (kind 0) surfaces with one of the given tags. */
function tagGuard(tags: readonly (keyof typeof PART_TAGS)[]): string {
  const t = tags.map((tag) => `abs(mg.tag - ${tagId(tag)}) < 0.5`).join(' || ');
  return `mg.kind < 0.5 && (${t})`;
}

/** Lower-body belly patch whose top edge rises toward the chest. */
export function paintBelly(opts: {
  color: Rgb;
  y: number;
  rise: number;
  fromX: number;
  soft: number;
  tags?: readonly (keyof typeof PART_TAGS)[];
}): string {
  return `if (${tagGuard(opts.tags ?? ['body'])}) {
    float by = q.y - (${glf(opts.y)} + max(q.x - ${glf(opts.fromX)}, 0.0) * ${glf(opts.rise)});
    paintMix(mg, ${col(opts.color)}, smoothstep(${glf(opts.soft)}, ${glf(-opts.soft)}, by));
  }`;
}

/** Colored paws below height `h`. */
export function paintSocks(color: Rgb, h: number): string {
  return `if (${tagGuard(['leg', 'paw'])}) {
    paintMix(mg, ${col(color)}, smoothstep(${glf(h + 0.012)}, ${glf(h - 0.012)}, q.y));
  }`;
}

/**
 * Lightning chevrons across the back: V shapes pointing forward, measured along the spine (x)
 * and around it (arc length from the top), with a small zigzag notch so they read as "bolts".
 */
export function paintBackChevrons(opts: {
  color: Rgb;
  count: number;
  startX: number;
  spacing: number;
  spineY: number;
  radius: number;
  width: number;
  span: number;
}): string {
  const lines: string[] = [];
  for (let i = 0; i < opts.count; i++) {
    const x0 = opts.startX - i * opts.spacing;
    const w = opts.width * (1 - i * 0.12);
    lines.push(`{
      float u = q.x - ${glf(x0)} + s * 0.95 - 0.018 * sin(s * 58.0);
      float wv = ${glf(w)} * (1.0 - smoothstep(0.0, ${glf(opts.span)}, s) * 0.8);
      chev = max(chev, smoothstep(0.004, -0.004, abs(u) - wv) * step(s, ${glf(opts.span)}));
    }`);
  }
  return `if (${tagGuard(['body'])} && q.y > ${glf(opts.spineY - opts.radius * 0.2)}) {
    float s = abs(atan(q.z, q.y - ${glf(opts.spineY)})) * ${glf(opts.radius)};
    float chev = 0.0;
    ${lines.join('\n    ')}
    paintMix(mg, ${col(opts.color)}, chev);
  }`;
}

/** Round spots at fixed positions (group coordinates). */
export function paintSpots(color: Rgb, spots: readonly { c: Vec3; r: number }[]): string {
  const lines = spots.map(
    (sp) =>
      `spot = max(spot, fillMask(length(q - ${glVec3(sp.c)}) - ${glf(sp.r)}, ${glf(sp.r * 0.18)}));`,
  );
  return `if (${tagGuard(['body', 'head', 'tail'])}) {
    float spot = 0.0;
    ${lines.join('\n    ')}
    paintMix(mg, ${col(color)}, spot * 0.92);
  }`;
}

/** Soft blush ellipse on the cheek (mirrored head group). */
export function paintBlush(color: Rgb, c: Vec3, r: number, strength: number): string {
  return `if (${tagGuard(['head', 'cheek', 'muzzle'])}) {
    float bl = 1.0 - smoothstep(${glf(r * 0.25)}, ${glf(r)}, length((q - ${glVec3(c)}) * vec3(1.6, 1.25, 1.0)));
    paintMix(mg, ${col(color)}, bl * ${glf(strength)});
  }`;
}

export interface MouthSpec {
  kind: 'smile' | 'grin' | 'fang' | 'open' | 'wide' | 'wideOpen' | 'none';
  /** Face-plane anchor under the nose (head coordinates: z sideways, y up). */
  y: number;
  /** Nose bottom height, for the philtrum line (NaN = none). */
  noseY: number;
  width: number;
  /** Paint only where head x exceeds this (front of the face). */
  minX: number;
  line: number;
  lineColor: Rgb;
  inside: Rgb;
  tongue: Rgb;
}

/** Mouth strokes painted in the head's front view (z, y). */
export function paintMouth(m: MouthSpec): string {
  if (m.kind === 'none') return '';
  const front = `smoothstep(${glf(m.minX)}, ${glf(m.minX + 0.02)}, q.x) * smoothstep(0.05, 0.3, qn.x)`;
  const philtrum = Number.isNaN(m.noseY)
    ? '1e5'
    : `sdSegment2(fp, vec2(0.0, ${glf(m.noseY)}), vec2(0.0, ${glf(m.y)}))`;
  if (m.kind === 'smile') {
    // "ω" mouth: two small lower arcs meeting under the nose.
    return `{
    vec2 fp = vec2(q.z, q.y);
    float dm = min(sdArcLower(fp, vec2(${glf(m.width)}, ${glf(m.y)}), ${glf(m.width)}), ${philtrum});
    paintMix(mg, ${col(m.lineColor)}, fillMask(dm - ${glf(m.line)}, ${glf(m.line * 0.6)}) * ${front});
  }`;
  }
  if (m.kind === 'wide') {
    // Wide axolotl smile: a shallow U across the whole face, curling up at the corners.
    return `{
    float zz = q.z / ${glf(m.width)};
    float cy = ${glf(m.y)} + ${glf(m.width * 0.3)} * zz * zz * zz * zz + ${glf(m.width * 0.08)} * zz * zz;
    float dm = abs(q.y - cy) + max(zz - 1.0, 0.0) * 4.0;
    float lw = ${glf(m.line)} * (1.15 - 0.45 * zz * zz);
    paintMix(mg, ${col(m.lineColor)}, fillMask(dm - lw, ${glf(m.line * 0.6)}) * ${front});
  }`;
  }
  if (m.kind === 'wideOpen') {
    // Big happy axolotl grin: the smile curve becomes the top lip of a crescent-shaped mouth.
    return `{
    float zz = q.z / ${glf(m.width)};
    float top = ${glf(m.y)} + ${glf(m.width * 0.3)} * zz * zz * zz * zz + ${glf(m.width * 0.08)} * zz * zz;
    float depthM = ${glf(m.width * 0.26)} * max(1.0 - zz * zz, 0.0);
    float dOpen = max(max(q.y - top, top - depthM - q.y), q.z - ${glf(m.width * 0.92)});
    float inside = fillMask(dOpen, 0.003) * ${front};
    float tongue = fillMask(length((vec2(q.z, q.y) - vec2(0.0, top - depthM * 0.95)) / vec2(${glf(m.width * 0.45)}, ${glf(m.width * 0.16)})) - 1.0, 0.1);
    paintMix(mg, mix(${col(m.inside)}, ${col(m.tongue)}, tongue), inside);
    float rim = fillMask(abs(dOpen) - ${glf(m.line * 0.6)}, ${glf(m.line * 0.5)}) * ${front};
    paintMix(mg, ${col(m.lineColor)}, rim * 0.9);
    mg.rough = mix(mg.rough, 0.3, inside);
  }`;
  }
  // Open/grin/fang: a D-shaped open mouth with a tongue, plus the philtrum line.
  const h = m.width * 0.8;
  const fang =
    m.kind === 'fang'
      ? `float fg = fillMask(sdSegment2(fp, vec2(${glf(m.width * 0.55)}, ${glf(m.y)}), vec2(${glf(m.width * 0.5)}, ${glf(m.y - h * 0.35)})) - ${glf(m.line * 1.2)}, 0.002);
    paintMix(mg, vec3(0.95), fg * inside);`
      : '';
  return `{
    vec2 fp = vec2(q.z, q.y);
    vec2 mo = (fp - vec2(0.0, ${glf(m.y)})) / vec2(${glf(m.width)}, ${glf(h)});
    float dOpen = fp.y > ${glf(m.y)} ? (fp.y - ${glf(m.y)}) : (length(mo) - 1.0) * ${glf(h)};
    dOpen = max(dOpen, abs(fp.x) - ${glf(m.width)});
    float inside = fillMask(dOpen, 0.004) * ${front};
    float tongue = fillMask(length((fp - vec2(0.0, ${glf(m.y - h * 0.95)})) / vec2(${glf(m.width * 0.72)}, ${glf(h * 0.62)})) - 1.0, 0.08);
    paintMix(mg, mix(${col(m.inside)}, ${col(m.tongue)}, tongue), inside);
    ${fang}
    float rim = fillMask(abs(dOpen) - ${glf(m.line * 0.7)}, ${glf(m.line * 0.5)}) * ${front};
    float ph = fillMask(${philtrum} - ${glf(m.line)}, ${glf(m.line * 0.6)}) * ${front};
    paintMix(mg, ${col(m.lineColor)}, max(rim * 0.9, ph));
    mg.rough = mix(mg.rough, 0.3, inside);
  }`;
}

/** Colors the carved front cup of an ear (distance to the carve leaf ≈ 0). */
export function paintInnerEar(color: Rgb, carve: Extract<Shape, { type: 'leaf' }>): string {
  return `if (abs(mg.tag - ${tagId('ear')}) < 0.5) {
    vec3 il = ${glMat3(transpose(carve.rot))} * (q - ${glVec3(carve.c)});
    float di = sdLeaf(il, ${glf(carve.h)}, ${glf(carve.ra)}, ${glf(carve.rb)}, ${glf(carve.thin)}, ${glf(carve.bend)});
    paintMix(mg, ${col(color)}, 1.0 - smoothstep(0.004, 0.018, di));
  }`;
}

/** Forehead mark (bolt/flame/star/drop/diamond) painted in the head's front view. */
export function paintForeheadMark(
  color: Rgb,
  shape: 'bolt' | 'flame' | 'star' | 'drop' | 'diamond',
  y: number,
  size: number,
): string {
  const d =
    shape === 'star'
      ? `sdStar4(fp, ${glf(size)}, ${glf(size * 0.35)})`
      : shape === 'diamond'
        ? `(abs(fp.x) + abs(fp.y) * 0.7 - ${glf(size * 0.7)})`
        : `(length(fp * vec2(1.0, 0.7)) - ${glf(size * 0.6)})`;
  return `if (${tagGuard(['head'])}) {
    vec2 fp = vec2(q.z, q.y - ${glf(y)});
    paintMix(mg, ${col(color)}, fillMask(${d}, 0.004) * smoothstep(0.0, 0.3, qn.x));
  }`;
}

export interface EyeSpec {
  c: Vec3;
  /** Radii: depth (along the face normal), height, width. */
  r: Vec3;
  rot: Mat3;
  style: 0 | 1 | 2 | 3;
  base: Rgb;
  iris: Rgb;
  lid: Rgb;
}

/** Eye paint: camera-facing uv in eye-height units, then the shared `eyePaint` helper. */
export function paintEye(e: EyeSpec): string {
  return `if (abs(mg.kind - 2.0) < 0.5) {
    vec3 ev = q - ${glVec3(e.c)};
    vec2 euv = vec2(dot(ev, normalize(cr)), dot(ev, normalize(cu))) / ${glf(e.r[1])};
    eyePaint(mg, euv, ${glf(e.style)}, ${col(e.base)}, ${col(e.iris)}, ${col(e.lid)});
  }`;
}

export const glColor = col;

/**
 * A plump tail as a chain of overlapping ellipsoids stretched along a Bezier path. More robust
 * than one thick Bezier tube, whose distance field breaks down on the inside of tight bends.
 */
export function beadChain(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  radii: Vec3,
  count: number,
  surfaceAt: (t: number) => Surface,
  tag: Part['tag'],
  blend: number,
): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const center = bezierPoint(a, b, c, t);
    const r = tubeRadius(radii, t);
    const step = length(sub(bezierPoint(a, b, c, Math.min(1, t + 0.5 / count)), center)) * 2;
    const rot = frameAlongX(bezierTangent(a, b, c, t), [0, 1, 0]);
    parts.push(
      part(
        `bead${i}`,
        tag,
        { type: 'ellipsoid', c: center, r: [Math.max(r * 1.25, step * 0.75), r, r * 0.96], rot },
        i === 0 ? 0 : blend,
        surfaceAt(t),
      ),
    );
  }
  return parts;
}
