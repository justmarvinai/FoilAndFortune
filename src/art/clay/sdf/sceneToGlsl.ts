import type { Rgb } from '../color';
import { glf, glMat3, glVec3, transpose } from '../math';
import {
  type CreatureScene,
  type Group,
  PART_TAGS,
  type Part,
  type Shape,
  type Surface,
} from './types';

/**
 * Compiles a CreatureScene into two GLSL functions:
 *  - `float mapCreature(vec3 pw)`: the distance field used for marching, shadows and AO.
 *  - `Mat creatureMaterial(vec3 pw, vec3 nw)`: surface properties at a hit point, including
 *    smooth color blending across part seams and the paint layers (markings, eyes, mouth…).
 *
 * Scene constants are baked into the code (the GPU compiler folds them), while camera, lights,
 * time of day and the seeded head jitter stay uniforms, so one compiled program serves every
 * render of a species in a given pose and biome.
 */

/**
 * Groups farther than `g_boundMargin` from the point are replaced by their bounding-sphere
 * distance (a cheap lower bound). The margin must exceed every blend radius in the scene, not
 * just the group's own: a later group smooth-blends against whatever value an earlier group
 * contributed, and blending against a bound instead of the real surface leaves a crease.
 * It's a runtime global because soft shadows and AO read absolute distances (a loose bound
 * shows up as dark streaks), so those queries raise it while primary rays keep it tight.
 */
function sceneMargin(scene: CreatureScene): number {
  return Math.max(0.06, ...scene.groups.map((g) => g.blend + 0.03));
}

const KIND_ID: Record<Surface['kind'], number> = { fur: 0, glossy: 1, eye: 2, emissive: 3, fin: 4 };

const SURFACE_DEFAULTS: Record<Surface['kind'], { rough: number; spec: number; sss: number }> = {
  fur: { rough: 0.5, spec: 0.28, sss: 0.55 },
  glossy: { rough: 0.1, spec: 1.0, sss: 0.0 },
  eye: { rough: 0.06, spec: 1.0, sss: 0.0 },
  emissive: { rough: 0.6, spec: 0.1, sss: 0.0 },
  fin: { rough: 0.35, spec: 0.35, sss: 1.0 },
};

const BLACK: Rgb = [0, 0, 0];

function rgb(c: Rgb): string {
  return `vec3(${glf(c[0])}, ${glf(c[1])}, ${glf(c[2])})`;
}

/** GLSL for the local coordinates a shape is evaluated in (rotated shapes get their own frame). */
function localCoords(s: Shape, q: string): string | null {
  switch (s.type) {
    case 'ellipsoid':
      return s.rot ? `${glMat3(transpose(s.rot))} * (${q} - ${glVec3(s.c)})` : null;
    case 'leaf':
    case 'star4':
      return `${glMat3(transpose(s.rot))} * (${q} - ${glVec3(s.c)})`;
    default:
      return null;
  }
}

/** Distance expression; for rotated shapes `lq` must already hold the local coordinates. */
function distExpr(s: Shape, q: string, lq: string): string {
  switch (s.type) {
    case 'sphere':
      return `(length(${q} - ${glVec3(s.c)}) - ${glf(s.r)})`;
    case 'ellipsoid':
      return s.rot
        ? `sdEllipsoid(${lq}, ${glVec3(s.r)})`
        : `sdEllipsoid(${q} - ${glVec3(s.c)}, ${glVec3(s.r)})`;
    case 'roundCone':
      return `sdRoundCone(${q}, ${glVec3(s.a)}, ${glVec3(s.b)}, ${glf(s.ra)}, ${glf(s.rb)})`;
    case 'leaf':
      return `sdLeaf(${lq}, ${glf(s.h)}, ${glf(s.ra)}, ${glf(s.rb)}, ${glf(s.thin)}, ${glf(s.bend)})`;
    case 'tube':
      return `sdTube(${q}, ${glVec3(s.a)}, ${glVec3(s.b)}, ${glVec3(s.c)}, ${glVec3(s.r)})`;
    case 'finTube':
      return `sdFinTube(${q}, ${glVec3(s.a)}, ${glVec3(s.b)}, ${glVec3(s.c)}, ${glVec3(s.r)}, ${glVec3(s.fin)}, ${glf(s.thick)})`;
    case 'star4':
      return `sdTwinkle3(${lq}, ${glf(s.r)}, ${glf(s.pinch)}, ${glf(s.thick)})`;
  }
}

function frameCoords(group: Group): string[] {
  const lines =
    group.frame === 'head'
      ? ['vec3 q = hq;', 'vec3 qn = hn;', 'vec3 cr = hcr;', 'vec3 cu = hcu;']
      : ['vec3 q = p;', 'vec3 qn = n;', 'vec3 cr = bcr;', 'vec3 cu = bcu;'];
  lines.push('float side = 1.0;');
  if (group.mirror) {
    lines.push(
      'side = q.z < 0.0 ? -1.0 : 1.0;',
      'q.z = abs(q.z);',
      'qn.z *= side;',
      'cr.z *= side;',
      'cu.z *= side;',
    );
  }
  return lines;
}

function mapGroup(group: Group, margin: number): string {
  const q = 'q';
  const body: string[] = ['float g = 1e5;'];
  group.parts.forEach((part, i) => {
    const lq = localCoords(part.shape, q);
    const lqName = `lq${i}`;
    if (lq) body.push(`vec3 ${lqName} = ${lq};`);
    let expr = distExpr(part.shape, q, lqName);
    if (part.shape.type === 'tube' || part.shape.type === 'finTube') expr = `${expr}.x`;
    if (part.op === 'carve') body.push(`g = smax(g, -(${expr}), ${glf(part.blend)});`);
    else body.push(`g = smin(g, ${expr}, ${glf(part.blend)});`);
  });
  const coords = group.frame === 'head' ? 'hq' : 'p';
  return `
  // group: ${group.name}
  {
    vec3 q = ${coords};
    ${group.mirror ? 'q.z = abs(q.z);' : ''}
    float bd = length(q - ${glVec3(group.bound.c)}) - ${glf(group.bound.r)};
    if (bd < max(g_boundMargin, ${glf(margin)})) {
      ${body.join('\n      ')}
      d = smin(d, g, ${glf(group.blend)});
    } else {
      d = smin(d, bd, ${glf(group.blend)});
    }
  }`;
}

function surfaceExpr(part: Part, rampParam: string | null): string {
  const s = part.surface;
  const def = SURFACE_DEFAULTS[s.kind];
  const emit = s.emit ?? BLACK;
  let alb = rgb(s.color);
  let em = rgb(emit);
  if (s.ramp && rampParam) {
    const r = `smoothstep(${glf(s.ramp.from)}, ${glf(s.ramp.to)}, ${rampParam})`;
    alb = `mix(${alb}, ${rgb(s.ramp.color)}, ${r})`;
    em = `mix(${em}, ${rgb(s.ramp.emit ?? emit)}, ${r})`;
  }
  return `matOf(${alb}, ${em}, ${glf(s.rough ?? def.rough)}, ${glf(s.spec ?? def.spec)}, ${glf(
    s.sss ?? def.sss,
  )}, ${glf(KIND_ID[s.kind])}, ${glf(PART_TAGS[part.tag])})`;
}

function materialGroup(group: Group, margin: number): string {
  const q = 'q';
  const body: string[] = ['float g = 1e5;', 'Mat mg = m;'];
  group.parts.forEach((part, i) => {
    const s = part.shape;
    const lq = localCoords(s, q);
    const lqName = `lq${i}`;
    if (lq) body.push(`vec3 ${lqName} = ${lq};`);
    const dist = distExpr(s, q, lqName);
    let dd: string;
    let ramp: string | null = null;
    if (s.type === 'tube') {
      body.push(`vec2 tb${i} = ${dist};`);
      dd = `tb${i}.x`;
      ramp = `tb${i}.y`;
    } else if (s.type === 'finTube') {
      body.push(`vec3 tb${i} = ${dist};`);
      dd = `tb${i}.x`;
      ramp = `tb${i}.z`;
    } else {
      dd = dist;
      if (s.type === 'leaf') ramp = `clamp(${lqName}.y / ${glf(s.h)}, 0.0, 1.0)`;
    }
    if (part.op === 'carve') body.push(`g = smax(g, -(${dd}), ${glf(part.blend)});`);
    else body.push(`opMat(g, mg, ${dd}, ${surfaceExpr(part, ramp)}, ${glf(part.blend)});`);
  });
  for (const paint of group.paints) body.push(paint.trim());
  return `
  // group: ${group.name}
  {
    ${frameCoords(group).join('\n    ')}
    float bd = length(q - ${glVec3(group.bound.c)}) - ${glf(group.bound.r)};
    if (bd < ${glf(margin)}) {
      ${body.join('\n      ')}
      opMat(d, m, g, mg, ${glf(group.blend)});
    }
  }`;
}

export function sceneToGlsl(scene: CreatureScene): string {
  const hc = glVec3(scene.headCenter);
  const margin = sceneMargin(scene);
  const map = `
float g_boundMargin = 0.06;

float mapCreature(vec3 pw) {
  vec3 p = u_toLocal * (pw - u_crPos);
  vec3 hq = u_headRot * (p - ${hc});
  float d = 1e5;
  ${scene.groups.map((g) => mapGroup(g, margin)).join('\n')}
  return d;
}`;
  const material = `
Mat creatureMaterial(vec3 pw, vec3 nw) {
  vec3 p = u_toLocal * (pw - u_crPos);
  vec3 n = u_toLocal * nw;
  vec3 hq = u_headRot * (p - ${hc});
  vec3 hn = u_headRot * n;
  vec3 bcr = u_toLocal * u_camRight;
  vec3 bcu = u_toLocal * u_camUp;
  vec3 hcr = u_headRot * bcr;
  vec3 hcu = u_headRot * bcu;
  float d = 1e5;
  Mat m = matOf(vec3(0.5), vec3(0.0), 0.5, 0.3, 0.5, 0.0, 0.0);
  ${scene.groups.map((g) => materialGroup(g, margin)).join('\n')}
  return m;
}`;
  return `${map}\n${material}\n`;
}
