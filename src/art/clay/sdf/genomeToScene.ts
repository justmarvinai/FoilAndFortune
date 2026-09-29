import type { ArtPose } from '@/art/types';
import type { ColorRef, CreatureGenome, GenomeExtra } from '@/content/schema/genome';
import { hexToLinear, mixRgb, type Rgb, scaleRgb } from '../color';
import {
  add,
  deg,
  dirYawPitch,
  frameAlongX,
  frameAlongY,
  type Mat3,
  mulMM,
  mulMV,
  normalize,
  rotX,
  rotY,
  rotZ,
  scale,
  sub,
  type Vec3,
} from '../math';
import { createRng, hashString, range } from '../rng';
import {
  beadChain,
  type EyeSpec,
  ellipsoidNormal,
  emissive,
  finSurface,
  frameFacingZ,
  fur,
  glossy,
  type MouthSpec,
  makeGroup,
  onEllipsoid,
  paintBackChevrons,
  paintBelly,
  paintBlush,
  paintEye,
  paintForeheadMark,
  paintInnerEar,
  paintMouth,
  paintSocks,
  paintSpots,
  part,
} from './kit';
import type { CreatureScene, Emitter, Group, HeadPose, Part, Shape } from './types';

/**
 * Genome → CreatureScene compiler (docs/04 §6). The genome is semantic and renderer-agnostic;
 * this file decides what a "fox head", "floppy ear" or "spark tail" means in signed-distance
 * parts. Coordinates: body frame has +x forward, +y up, z sideways (the camera sees the −z
 * side), ground at y = 0 and the creature about one unit tall. Head-frame parts are authored
 * around the head center with +x = face direction.
 */

interface Palette {
  primary: Rgb;
  secondary: Rgb;
  accent: Rgb;
  belly: Rgb;
  eyes: Rgb;
  glow: Rgb;
}

type LeafShape = Extract<Shape, { type: 'leaf' }>;

const MOUTH_INSIDE = hexToLinear('#7A2335');
const TONGUE = hexToLinear('#FF7D92');
const BLUSH = hexToLinear('#FF7FA6');
const WHITE: Rgb = [1, 1, 1];

function resolvePalette(g: CreatureGenome): Palette {
  return {
    primary: hexToLinear(g.palette.primary),
    secondary: hexToLinear(g.palette.secondary),
    accent: hexToLinear(g.palette.accent),
    belly: hexToLinear(g.palette.belly),
    eyes: hexToLinear(g.palette.eyes),
    glow: hexToLinear(g.palette.glow),
  };
}

const colorOf = (pal: Palette, ref: ColorRef): Rgb => pal[ref];

const smoothstep01 = (lo: number, hi: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

function extrasOf<K extends GenomeExtra['kind']>(
  g: CreatureGenome,
  kind: K,
): Extract<GenomeExtra, { kind: K }>[] {
  return g.extras.filter((e): e is Extract<GenomeExtra, { kind: K }> => e.kind === kind);
}

// ---- Poses ------------------------------------------------------------------------------------

/**
 * Pose rigs: a few joint-like parameters every body plan understands. Poses change geometry,
 * so each pose is its own compiled program (cached); seeds only jitter uniforms.
 */
interface PoseRig {
  /** Chest drop for a playful pounce (body units). */
  crouch: number;
  /** Front paws reaching forward (body units). */
  reach: number;
  /** Rump lift (body units). */
  rumpLift: number;
  /** 0 = relaxed tail, 1 = held high. */
  tailLift: number;
  /** Smiles become open-mouth smiles. */
  openMouth: boolean;
  /** Element glow/flame boost. */
  fx: number;
  /** Added to the species' default head pose (degrees). */
  head: HeadPose;
}

const POSES: Record<ArtPose, PoseRig> = {
  idle: {
    crouch: 0,
    reach: 0,
    rumpLift: 0,
    tailLift: 0,
    openMouth: false,
    fx: 1,
    head: { yaw: 0, pitch: 0, roll: 0 },
  },
  happy: {
    crouch: 0,
    reach: 0,
    rumpLift: 0,
    tailLift: 0.4,
    openMouth: true,
    fx: 1.1,
    head: { yaw: 2, pitch: 7, roll: 8 },
  },
  action: {
    crouch: 0.05,
    reach: 0.08,
    rumpLift: 0.025,
    tailLift: 0.7,
    openMouth: true,
    fx: 1.3,
    head: { yaw: -3, pitch: 11, roll: 2 },
  },
};

function posedHead(base: HeadPose, rig: PoseRig): HeadPose {
  return {
    yaw: base.yaw + deg(rig.head.yaw),
    pitch: base.pitch + deg(rig.head.pitch),
    roll: base.roll + deg(rig.head.roll),
  };
}

// ---- Head -------------------------------------------------------------------------------------

type HeadShape = CreatureGenome['head']['shape'];

/** Skull radii (× head radius) per head shape. */
const SKULL: Record<HeadShape, Vec3> = {
  round: [0.94, 0.92, 1.0],
  fox: [0.9, 0.85, 0.97],
  pup: [0.94, 0.9, 1.0],
  axolotl: [0.8, 0.64, 1.02],
  feline: [0.9, 0.86, 1.0],
  beaked: [0.92, 0.92, 0.95],
};

/** Eye placement (degrees on the skull) and relative size per head shape. */
const EYE_LAYOUT: Record<HeadShape, { yaw: number; pitch: number; size: number }> = {
  round: { yaw: 30, pitch: 6, size: 1 },
  fox: { yaw: 33, pitch: 5, size: 1 },
  pup: { yaw: 31, pitch: 9, size: 1 },
  axolotl: { yaw: 45, pitch: 20, size: 0.66 },
  feline: { yaw: 33, pitch: 7, size: 1 },
  beaked: { yaw: 40, pitch: 10, size: 0.9 },
};

interface HeadBuild {
  groups: Group[];
  emitters: Emitter[];
}

function buildHead(g: CreatureGenome, pal: Palette, R: number, rig: PoseRig): HeadBuild {
  const shape = g.head.shape;
  const skullR = scale(SKULL[shape], R);
  const featureColor = shape === 'axolotl' ? pal.primary : pal.secondary;
  const ink = mixRgb(pal.eyes, [0, 0, 0], 0.15);
  const headParts: Part[] = [
    part('skull', 'head', { type: 'ellipsoid', c: [0, 0, 0], r: skullR }, 0, fur(pal.primary)),
  ];
  const paints: string[] = [];

  // Cheeks shape the silhouette: spiky fox tufts, chubby pup cheeks, a wide axolotl jaw.
  if (shape === 'fox') {
    headParts.push(
      part(
        'cheekTuft',
        'cheek',
        {
          type: 'roundCone',
          a: scale([-0.02, -0.28, 0.56], R),
          b: scale([-0.12, -0.52, 0.94], R),
          ra: 0.3 * R,
          rb: 0.1 * R,
        },
        0.12 * R,
        fur(pal.secondary),
      ),
    );
  } else if (shape === 'pup' || shape === 'round' || shape === 'feline') {
    headParts.push(
      part(
        'cheek',
        'cheek',
        { type: 'sphere', c: scale([0.26, -0.3, 0.46], R), r: 0.42 * R },
        0.25 * R,
        fur(pal.primary),
      ),
    );
  }

  // Muzzle + nose + mouth anchor.
  let mouthY = -0.42 * R;
  let noseY = Number.NaN;
  let mouthMinX = 0.6 * R;
  let mouthWidth = 0.08 * R;
  let noseC: Vec3 | null = null;
  let noseR: Vec3 = scale([0.09, 0.078, 0.115], R);
  switch (g.head.muzzle) {
    case 'pointed':
      headParts.push(
        part(
          'muzzle',
          'muzzle',
          {
            type: 'roundCone',
            a: scale([0.3, -0.29, 0], R),
            b: scale([0.97, -0.35, 0], R),
            ra: 0.37 * R,
            rb: 0.125 * R,
          },
          0.16 * R,
          fur(featureColor),
        ),
      );
      noseC = scale([1.07, -0.3, 0], R);
      noseR = scale([0.085, 0.075, 0.11], R);
      mouthY = -0.44 * R;
      mouthMinX = 0.82 * R;
      mouthWidth = 0.075 * R;
      break;
    case 'round':
      headParts.push(
        part(
          'muzzle',
          'muzzle',
          { type: 'ellipsoid', c: scale([0.6, -0.36, 0], R), r: scale([0.42, 0.33, 0.52], R) },
          0.12 * R,
          fur(featureColor),
        ),
      );
      noseC = scale([0.97, -0.2, 0], R);
      noseR = scale([0.1, 0.085, 0.14], R);
      mouthY = -0.4 * R;
      mouthMinX = 0.62 * R;
      mouthWidth = 0.2 * R;
      break;
    case 'short':
      headParts.push(
        part(
          'muzzle',
          'muzzle',
          { type: 'ellipsoid', c: scale([0.6, -0.3, 0], R), r: scale([0.36, 0.26, 0.42], R) },
          0.12 * R,
          fur(featureColor),
        ),
      );
      noseC = scale([0.92, -0.2, 0], R);
      mouthY = -0.38 * R;
      mouthMinX = 0.62 * R;
      mouthWidth = 0.1 * R;
      break;
    case 'wide':
      headParts.push(
        part(
          'jaw',
          'head',
          { type: 'ellipsoid', c: scale([0.18, -0.2, 0], R), r: scale([0.58, 0.34, 0.88], R) },
          0.22 * R,
          fur(featureColor),
        ),
      );
      noseC = null;
      mouthY = -0.24 * R;
      mouthMinX = 0.3 * R;
      mouthWidth = 0.5 * R;
      break;
    case 'none':
      break;
  }
  if (g.head.nose !== 'none' && noseC) {
    const r: Vec3 = g.head.nose === 'triangle' ? [noseR[0], noseR[1] * 0.8, noseR[2] * 1.2] : noseR;
    headParts.push(
      part('nose', 'nose', { type: 'ellipsoid', c: noseC, r }, 0.012, glossy(ink, { rough: 0.16 })),
    );
    noseY = noseC[1] - r[1] * 0.7;
  }
  if (shape === 'beaked') {
    headParts.push(
      part(
        'beak',
        'nose',
        {
          type: 'roundCone',
          a: scale([0.6, -0.12, 0], R),
          b: scale([1.15, -0.2, 0], R),
          ra: 0.26 * R,
          rb: 0.05 * R,
        },
        0.03,
        glossy(pal.accent, { rough: 0.3, spec: 0.5 }),
      ),
    );
  }

  // Mouth. Happy/action poses open closed smiles.
  const baseMouth: MouthSpec['kind'] =
    g.head.muzzle === 'wide' && g.face.mouth === 'smile'
      ? 'wide'
      : g.face.mouth === 'beak'
        ? 'none'
        : g.face.mouth;
  const mouthKind: MouthSpec['kind'] = !rig.openMouth
    ? baseMouth
    : baseMouth === 'wide'
      ? 'wideOpen'
      : baseMouth === 'smile'
        ? 'open'
        : baseMouth;
  const opened = mouthKind === 'open' && baseMouth === 'smile';
  const mouth: MouthSpec = {
    kind: mouthKind,
    y: opened ? mouthY + 0.03 * R : mouthY,
    noseY,
    width: opened ? Math.max(mouthWidth * 1.5, 0.11 * R) : mouthWidth,
    minX: opened ? mouthMinX - 0.08 * R : mouthMinX,
    line: 0.018 * R,
    lineColor: ink,
    inside: MOUTH_INSIDE,
    tongue: TONGUE,
  };
  paints.push(paintMouth(mouth));

  // Blush sits under the eyes, toward the cheeks.
  const eyeLayout = EYE_LAYOUT[shape];
  if (g.face.blush) {
    const bdir = dirYawPitch(deg(eyeLayout.yaw + 14), deg(eyeLayout.pitch - 30));
    const bc = onEllipsoid(skullR, bdir);
    paints.push(paintBlush(BLUSH, bc, 0.21 * R, 0.6));
  }
  for (const mark of extrasOf(g, 'forehead-mark')) {
    paints.push(paintForeheadMark(colorOf(pal, mark.color), mark.shape, 0.45 * R, 0.14 * R));
  }

  const groups: Group[] = [makeGroup('head', 'head', true, 0.11, headParts, paints)];
  const emitters: Emitter[] = [];

  // Eyes: glossy ellipsoids pressed into the skull along its surface normal.
  const eyeSize = R * (0.07 + 0.26 * g.face.eyeSize) * eyeLayout.size;
  const sparkle = g.face.eyes === 'sparkle';
  const eyeRadii: Vec3 = [eyeSize * 0.55, eyeSize, eyeSize * (sparkle ? 0.8 : 0.92)];
  const surf = onEllipsoid(skullR, dirYawPitch(deg(eyeLayout.yaw), deg(eyeLayout.pitch)));
  const nrm = ellipsoidNormal(skullR, surf);
  const eyeC = sub(surf, scale(nrm, eyeRadii[0] * 0.4));
  const eyeRot = frameAlongX(nrm, [0, 1, 0]);
  const styleIndex = { round: 0, sparkle: 1, sleepy: 2, fierce: 3 } as const;
  const eye: EyeSpec = {
    c: eyeC,
    r: eyeRadii,
    rot: eyeRot,
    style: styleIndex[g.face.eyes],
    base: pal.eyes,
    iris: sparkle ? mixRgb(pal.eyes, pal.glow, 0.8) : mixRgb(pal.eyes, pal.primary, 0.42),
    lid: pal.primary,
  };
  groups.push(
    makeGroup(
      'eyes',
      'head',
      true,
      0,
      [
        part('eye', 'eye', { type: 'ellipsoid', c: eyeC, r: eyeRadii, rot: eyeRot }, 0, {
          kind: 'eye',
          color: pal.eyes,
        }),
      ],
      [paintEye(eye)],
    ),
  );

  // Ears.
  const ears = buildEars(g, pal, R, skullR);
  if (ears) groups.push(ears);

  // Head tuft (flame curl, leaf, spark, fluff).
  for (const tuft of extrasOf(g, 'head-tuft')) {
    const base = scale(onEllipsoid(skullR, [0.3, 1, 0]), 0.9);
    const c = colorOf(pal, tuft.color);
    if (tuft.shape === 'flame') {
      const tip = mixRgb(pal.primary, [1, 0.12, 0.03], 0.2);
      const flame = emissive(scaleRgb(c, 0.35), scaleRgb(c, 1.3 * rig.fx), {
        ramp: {
          color: scaleRgb(tip, 0.35),
          emit: scaleRgb(tip, 1.15 * rig.fx),
          from: 0.2,
          to: 0.9,
        },
      });
      // A little three-tongue flame curling forward over the brow.
      const tuftParts: Part[] = [
        leafPart(
          'tuft',
          'tuft',
          base,
          [0.25, 1, 0],
          [1, 0, 0],
          0.62 * R,
          0.19 * R,
          0.02 * R,
          0.8,
          0.6,
          0,
          flame,
        ),
        leafPart(
          'tuftL',
          'tuft',
          add(base, scale([-0.1, -0.02, 0.1], R)),
          [-0.3, 1, 0.35],
          [1, 0, 0],
          0.36 * R,
          0.12 * R,
          0.015 * R,
          0.8,
          0.25,
          0.04 * R,
          flame,
        ),
        leafPart(
          'tuftR',
          'tuft',
          add(base, scale([-0.12, -0.02, -0.1], R)),
          [-0.35, 1, -0.3],
          [1, 0, 0],
          0.32 * R,
          0.11 * R,
          0.015 * R,
          0.8,
          0.2,
          0.04 * R,
          flame,
        ),
      ];
      groups.push(makeGroup('tuft', 'head', false, 0.03, tuftParts));
      emitters.push({
        frame: 'head',
        pos: add(base, scale([0.08, 0.28, 0], R)),
        color: mixRgb(c, pal.primary, 0.3),
        radius: 0.14,
        intensity: 0.55,
        light: 0.3,
      });
    } else {
      const tuftParts: Part[] = [
        leafPart(
          'tuft',
          'tuft',
          base,
          [0.3, 1, 0],
          [1, 0, 0],
          0.4 * R,
          0.13 * R,
          0.03 * R,
          0.6,
          0.5,
          0,
          fur(c),
        ),
      ];
      groups.push(makeGroup('tuft', 'head', false, 0.04, tuftParts));
    }
  }

  // Axolotl-style gills: fronds fanning out behind the head, each with bobbly frills.
  for (const gill of extrasOf(g, 'gills')) {
    groups.push(buildGills(gill.count, colorOf(pal, gill.color), R, skullR));
  }

  return { groups, emitters };
}

function leafPart(
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
  const shape: LeafShape = {
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

function buildEars(g: CreatureGenome, pal: Palette, R: number, skullR: Vec3): Group | null {
  const { shape, size } = g.ears;
  if (shape === 'none') return null;
  const outer = colorOf(pal, g.ears.color);
  const inner = colorOf(pal, g.ears.innerColor);
  const cfg = {
    pointed: {
      yaw: 66,
      pitch: 52,
      sink: 0.84,
      axis: [-0.16, 1, 0.44] as Vec3,
      face: [1, 0, 0.32] as Vec3,
      h: 0.45 + 0.62 * size,
      ra: 0.2 + 0.17 * size,
      rb: 0.045,
      thin: 0.42,
      bend: -0.1,
      cup: true,
    },
    round: {
      yaw: 70,
      pitch: 55,
      sink: 0.86,
      axis: [-0.1, 1, 0.5] as Vec3,
      face: [1, 0, 0.3] as Vec3,
      h: 0.3 + 0.3 * size,
      ra: 0.25,
      rb: 0.2,
      thin: 0.45,
      bend: 0,
      cup: true,
    },
    long: {
      yaw: 72,
      pitch: 58,
      sink: 0.84,
      axis: [-0.3, 1, 0.3] as Vec3,
      face: [1, 0, 0.3] as Vec3,
      h: 0.8 + 0.9 * size,
      ra: 0.2,
      rb: 0.11,
      thin: 0.4,
      bend: -0.12,
      cup: true,
    },
    floppy: {
      yaw: 70,
      pitch: 50,
      sink: 0.95,
      axis: [0.1, -1, 0.7] as Vec3,
      face: [0, 0.4, 1] as Vec3,
      h: 0.52 + 0.5 * size,
      ra: 0.26,
      rb: 0.24,
      thin: 0.34,
      bend: 0.12,
      cup: false,
    },
    fin: {
      yaw: 95,
      pitch: 20,
      sink: 0.9,
      axis: [-0.8, 0.3, 0.5] as Vec3,
      face: [0, 1, 0] as Vec3,
      h: 0.3 + 0.4 * size,
      ra: 0.25,
      rb: 0.05,
      thin: 0.25,
      bend: 0.1,
      cup: false,
    },
  }[shape];
  const base = scale(onEllipsoid(skullR, dirYawPitch(deg(cfg.yaw), deg(cfg.pitch))), cfg.sink);
  const ear = leafPart(
    'ear',
    'ear',
    base,
    cfg.axis,
    cfg.face,
    cfg.h * R,
    cfg.ra * R,
    cfg.rb * R,
    cfg.thin,
    cfg.bend,
    0,
    fur(outer),
  );
  const parts: Part[] = [ear];
  const paints: string[] = [];
  if (cfg.cup && ear.shape.type === 'leaf') {
    const s = ear.shape;
    // A slightly smaller leaf pushed toward the ear's front carves the cupped inner ear.
    const carve: LeafShape = {
      ...s,
      c: add(s.c, mulMV(s.rot, [s.ra * s.thin * 0.62, s.h * 0.1, 0])),
      h: s.h * 0.8,
      ra: s.ra * 0.62,
      rb: s.rb * 0.9,
      thin: s.thin * 0.72,
    };
    parts.push(part('earCup', 'ear', carve, 0.035 * R, fur(inner), 'carve'));
    if (inner !== outer) paints.push(paintInnerEar(inner, carve));
  }
  return makeGroup('ears', 'head', true, 0.05, parts, paints);
}

function buildGills(count: number, color: Rgb, R: number, skullR: Vec3): Group {
  const parts: Part[] = [];
  const surface = finSurface(color, { sss: 0.9, rough: 0.42, spec: 0.3 });
  const tip = mixRgb(color, WHITE, 0.25);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const pitch = 50 - 48 * t;
    const base = scale(onEllipsoid(skullR, dirYawPitch(deg(98 + 8 * t), deg(pitch))), 0.9);
    const dir = normalize([-0.5, 1.05 - 0.95 * t, 0.85]);
    const len = R * (0.64 + 0.1 * Math.sin(Math.PI * t));
    const rot = frameAlongY(dir, [0, 0, 1]);
    parts.push(
      part(
        'gill',
        'gill',
        { type: 'leaf', c: base, rot, h: len, ra: 0.1 * R, rb: 0.065 * R, thin: 0.7, bend: 0.14 },
        0.04 * R,
        { ...surface, ramp: { color: tip, from: 0.5, to: 1 } },
      ),
    );
    // Frills: little bobbles along the frond's upper/outer edge.
    const side = normalize(mulMV(rot, [1, 0, 0.35]));
    for (let j = 1; j <= 3; j++) {
      const f = j / 3.4;
      const along = add(base, mulMV(rot, [0.12 * len * f * f, len * f, 0]));
      parts.push(
        part(
          'frill',
          'gill',
          { type: 'sphere', c: add(along, scale(side, 0.085 * R)), r: (0.085 - 0.012 * j) * R },
          0.035 * R,
          surface,
        ),
      );
    }
  }
  return makeGroup('gills', 'head', true, 0.04, parts);
}

// ---- Tails -------------------------------------------------------------------------------------

interface TailBuild {
  group: Group | null;
  emitters: Emitter[];
}

/** Tail starting at `base` (body frame), sweeping back (−x) and up; `len` scales it. */
function buildTail(
  g: CreatureGenome,
  pal: Palette,
  base: Vec3,
  len: number,
  rig: PoseRig,
): TailBuild {
  const lift = rig.tailLift;
  const t = g.tail;
  const body = colorOf(pal, t.color);
  const tipC = colorOf(pal, t.tipColor);
  const emitters: Emitter[] = [];
  const parts: Part[] = [];
  const thick = 0.05 + 0.07 * t.size;
  switch (t.shape) {
    case 'none':
      return { group: null, emitters };
    case 'fluffy':
    case 'spark':
    case 'curl': {
      const curl = t.shape === 'curl' ? 0.35 : 0;
      const a = base;
      const b = add(base, [(-0.52 + 0.2 * lift) * len, (0.1 + 0.22 * lift) * len, 0.03]);
      const c = add(base, [
        (-0.22 + curl - 0.06 * lift) * len,
        (0.8 + 0.12 * lift) * len,
        0.07 + 0.05 * lift,
      ]);
      const glowTip = t.shape === 'spark';
      const tipGlow = mixRgb(tipC, WHITE, 0.2);
      parts.push(
        ...beadChain(
          a,
          b,
          c,
          [0.05, thick + 0.055, thick * 0.66],
          6,
          (u) => {
            if (!glowTip) return fur(mixRgb(body, tipC, smoothstep01(0.75, 1, u)));
            const g = smoothstep01(0.62, 1, u);
            return fur(mixRgb(body, tipGlow, g), { emit: scaleRgb(tipC, 1.4 * g * g) });
          },
          'tail',
          0.075,
        ),
      );
      if (glowTip) {
        const dir = normalize(sub(c, b));
        const starR = 0.1 + 0.05 * t.size;
        const starC = add(c, scale(dir, thick * 0.62 + starR * 0.62));
        // Face the camera side (body −z) so the twinkle reads as a clean four-point star.
        const rot = frameFacingZ([0.35, 0.12, -1], [0, 1, 0]);
        const hot = mixRgb(tipC, WHITE, 0.3);
        parts.push(
          part(
            'spark',
            'spark',
            { type: 'star4', c: starC, rot, r: starR, pinch: 0.62, thick: 0.018 },
            0.02,
            emissive(scaleRgb(hot, 0.5), scaleRgb(hot, 1.9)),
          ),
        );
        emitters.push({
          frame: 'body',
          pos: starC,
          color: tipC,
          radius: 0.2 + 0.12 * t.size,
          intensity: rig.fx,
          light: 0.9,
        });
      }
      break;
    }
    case 'flame': {
      const a = base;
      const b = add(base, [-0.1 + 0.04 * lift, 0.05 + 0.04 * lift, 0]);
      const c = add(base, [-0.13 + 0.05 * lift, 0.15 + 0.05 * lift, 0]);
      parts.push(
        part('tail', 'tail', { type: 'tube', a, b, c, r: [0.052, 0.05, 0.044] }, 0, fur(body)),
      );
      const fBase = add(c, [-0.005, 0.015, 0]);
      const h = (0.18 + 0.2 * t.size) * (0.85 + 0.15 * rig.fx);
      const hot = mixRgb(tipC, WHITE, 0.1);
      const tipCol = mixRgb(pal.primary, [1, 0.1, 0.02], 0.3);
      const flame = emissive(scaleRgb(hot, 0.35), scaleRgb(hot, 1.45 * rig.fx), {
        ramp: {
          color: scaleRgb(tipCol, 0.35),
          emit: scaleRgb(tipCol, 1.25 * rig.fx),
          from: 0.12,
          to: 0.85,
        },
      });
      parts.push(
        leafPart(
          'flame',
          'flame',
          fBase,
          [-0.4, 1, 0],
          [1, 0, 0],
          h,
          0.105,
          0.012,
          0.85,
          -0.45,
          0.03,
          flame,
        ),
        leafPart(
          'flameL',
          'flame',
          add(fBase, [0.02, 0.0, 0.045]),
          [-0.1, 1, 0.55],
          [1, 0, 0],
          h * 0.62,
          0.075,
          0.01,
          0.8,
          -0.3,
          0.035,
          flame,
        ),
        leafPart(
          'flameR',
          'flame',
          add(fBase, [-0.03, 0.0, -0.045]),
          [-0.55, 1, -0.45],
          [1, 0, 0],
          h * 0.56,
          0.07,
          0.01,
          0.8,
          -0.2,
          0.035,
          flame,
        ),
      );
      emitters.push({
        frame: 'body',
        pos: add(fBase, [-0.05, h * 0.42, 0]),
        color: mixRgb(tipC, pal.primary, 0.45),
        radius: 0.24 + 0.1 * t.size,
        intensity: 1.05 * rig.fx,
        light: 0.8,
      });
      break;
    }
    case 'fin': {
      const a = base;
      const b = add(base, [-0.3 * len, 0.04 * lift, 0.06 * len]);
      const c = add(base, [-0.44 * len, 0.1 + 0.12 * lift, -0.24 * len]);
      parts.push(
        part(
          'tail',
          'tail',
          {
            type: 'finTube',
            a,
            b,
            c,
            r: [0.08, 0.05, 0.016],
            fin: [0.012, 0.05 * (0.6 + t.size * 0.6), 0.03],
            thick: 0.011,
          },
          0,
          finSurface(body, {
            sss: 0.8,
            ramp: { color: mixRgb(body, tipC, 0.6), from: 0.72, to: 1 },
          }),
        ),
      );
      break;
    }
    case 'leaf':
      parts.push(
        leafPart(
          'tail',
          'tail',
          base,
          [-0.8, 0.6, 0],
          [0, 0, 1],
          0.35 * len + 0.15,
          0.04,
          0.12,
          0.35,
          0.2,
          0,
          fur(body, { ramp: { color: tipC, from: 0.6, to: 1 } }),
        ),
      );
      break;
    case 'bolt': {
      const p1 = add(base, [-0.12, 0.14, 0]);
      const p2 = add(base, [-0.04, 0.24, 0]);
      const p3 = add(base, [-0.2, 0.42, 0]);
      parts.push(
        part(
          'tail',
          'tail',
          { type: 'roundCone', a: base, b: p1, ra: 0.045, rb: 0.035 },
          0,
          fur(body),
        ),
        part(
          'tail2',
          'tail',
          { type: 'roundCone', a: p1, b: p2, ra: 0.035, rb: 0.05 },
          0.02,
          fur(body),
        ),
        part(
          'tail3',
          'tail',
          { type: 'roundCone', a: p2, b: p3, ra: 0.05, rb: 0.015 },
          0.02,
          fur(tipC),
        ),
      );
      break;
    }
  }
  return { group: makeGroup('tail', 'body', false, 0.06, parts), emitters };
}

// ---- Body plans --------------------------------------------------------------------------------

function spotLayout(
  g: CreatureGenome,
  count: number,
  place: (u: number, v: number) => Vec3,
  size: number,
): { c: Vec3; r: number }[] {
  // Spots are a species trait, so their layout comes from the genome, not the render seed.
  const rng = createRng(hashString(`${JSON.stringify(g.palette)}:${count}`));
  const spots: { c: Vec3; r: number }[] = [];
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count + range(rng, -0.08, 0.08);
    spots.push({ c: place(u, range(rng, -1, 1)), r: size * range(rng, 0.75, 1.15) });
  }
  return spots;
}

function sceneKey(g: CreatureGenome, pose: ArtPose): string {
  return `clay1:${hashString(JSON.stringify(g)).toString(36)}:${pose}`;
}

function buildQuadruped(g: CreatureGenome, pal: Palette, pose: ArtPose): CreatureScene {
  const rig = POSES[pose];
  const P = g.proportions;
  const legLen = 0.1 + 0.2 * P.legs;
  const bodyH = 0.125 + 0.07 * P.body;
  const bodyL = 0.17 + 0.12 * P.body;
  const bodyW = bodyH * 0.95;
  const bodyY = legLen + bodyH * 0.8;
  const R = 0.165 + 0.115 * P.head;
  const legR = 0.046 + 0.02 * P.body;
  const headCenter: Vec3 = [
    bodyL * 0.8 + rig.reach * 0.4,
    bodyY + bodyH * 0.5 + R * 0.95 - rig.crouch * 0.8,
    0,
  ];
  const coat = pal.primary;

  const bodyParts: Part[] = [
    part(
      'chest',
      'body',
      {
        type: 'ellipsoid',
        c: [bodyL * 0.3 + rig.reach * 0.12, bodyY + 0.012 - rig.crouch, 0],
        r: [bodyL * 0.68, bodyH * 1.02, bodyW],
      },
      0,
      fur(coat),
    ),
    part(
      'hips',
      'body',
      {
        type: 'ellipsoid',
        c: [-bodyL * 0.42, bodyY - 0.005 + rig.rumpLift, 0],
        r: [bodyL * 0.62, bodyH * 0.95, bodyW * 0.96],
      },
      0.1,
      fur(coat),
    ),
  ];
  // Idle stance: the near front paw steps forward a little, which reads as alert and friendly.
  const legs = [
    { x: bodyL * 0.5, z: -bodyW * 0.56, front: true, step: 0.035 },
    { x: bodyL * 0.5, z: bodyW * 0.56, front: true, step: -0.005 },
    { x: -bodyL * 0.52, z: -bodyW * 0.6, front: false, step: -0.02 },
    { x: -bodyL * 0.52, z: bodyW * 0.6, front: false, step: 0.012 },
  ];
  for (const leg of legs) {
    // Pounce: front legs follow the dipping chest and reach forward; hind legs lift the rump.
    const lift = leg.front ? -rig.crouch : rig.rumpLift;
    const top: Vec3 = [leg.x, bodyY - bodyH * 0.25 + lift, leg.z];
    const foot: Vec3 = [
      leg.x + leg.step + (leg.front ? rig.reach : 0),
      legR * 0.85,
      leg.z * (1.04 + (leg.front ? rig.reach * 1.5 : 0)),
    ];
    if (!leg.front) {
      bodyParts.push(
        part(
          'thigh',
          'leg',
          {
            type: 'ellipsoid',
            c: [leg.x - 0.01, bodyY - bodyH * 0.15 + rig.rumpLift, leg.z * 1.02],
            r: [bodyL * 0.36, bodyH * 0.78, bodyW * 0.42],
          },
          0.05,
          fur(coat),
        ),
      );
    }
    bodyParts.push(
      part(
        'leg',
        'leg',
        { type: 'roundCone', a: top, b: foot, ra: legR * 1.08, rb: legR * 0.9 },
        0.045,
        fur(coat),
      ),
      part(
        'paw',
        'paw',
        {
          type: 'ellipsoid',
          c: [foot[0] + legR * 0.4, legR * 0.72, foot[2]],
          r: [legR * 1.38, legR * 0.8, legR * 1.12],
        },
        0.03,
        fur(coat),
      ),
    );
  }

  const bodyPaints: string[] = [
    paintBelly({
      color: pal.belly,
      y: bodyY - bodyH * 0.42,
      rise: 0.9,
      fromX: bodyL * 0.05,
      soft: 0.03,
    }),
  ];
  for (const sock of extrasOf(g, 'socks')) {
    bodyPaints.push(paintSocks(colorOf(pal, sock.color), legLen * 0.5));
  }
  for (const stripe of extrasOf(g, 'stripes')) {
    if (stripe.where === 'back') {
      bodyPaints.push(
        paintBackChevrons({
          color: colorOf(pal, stripe.color),
          count: stripe.count,
          startX: bodyL * 0.22,
          spacing: bodyL * 0.5,
          spineY: bodyY,
          radius: bodyH,
          width: 0.034,
          span: bodyH * 1.45,
        }),
      );
    }
  }
  for (const spots of extrasOf(g, 'spots')) {
    bodyPaints.push(
      paintSpots(
        colorOf(pal, spots.color),
        spotLayout(
          g,
          spots.count,
          (u, v) => {
            const x = bodyL * (0.35 - 1.1 * u);
            const a = v * 1.0;
            return [x, bodyY + bodyH * Math.cos(a) * 0.98, bodyW * Math.sin(a) * 0.98];
          },
          0.028,
        ),
      ),
    );
  }

  const groups: Group[] = [makeGroup('body', 'body', false, 0, bodyParts, bodyPaints)];
  const emitters: Emitter[] = [];

  for (const ruff of extrasOf(g, 'ruff')) {
    groups.push(
      buildRuff(
        colorOf(pal, ruff.color),
        bodyL + rig.reach * 0.15,
        bodyY - rig.crouch,
        bodyH,
        bodyW,
      ),
    );
  }

  const tail = buildTail(
    g,
    pal,
    [-bodyL * 0.92, bodyY + bodyH * 0.25 + rig.rumpLift, 0],
    0.26 + 0.36 * P.tail,
    rig,
  );
  if (tail.group) groups.push(tail.group);
  emitters.push(...tail.emitters);

  const head = buildHead(g, pal, R, rig);
  groups.push(...head.groups);
  emitters.push(...head.emitters);

  return {
    key: sceneKey(g, pose),
    groups,
    emitters,
    headCenter,
    headPose: posedHead({ yaw: deg(40), pitch: deg(-4), roll: deg(10) }, rig),
    headRadius: R,
  };
}

/** Fluffy collar: overlapping puffs around the chest with a pointed bib. */
function buildRuff(color: Rgb, bodyL: number, bodyY: number, bodyH: number, bodyW: number): Group {
  const x0 = bodyL * 0.78;
  const y0 = bodyY + bodyH * 0.35;
  const s = fur(color, { sss: 0.7 });
  const parts: Part[] = [
    part(
      'bib',
      'ruff',
      {
        type: 'roundCone',
        a: [x0 + 0.02, y0 - 0.01, 0],
        b: [x0 + 0.05, y0 - 0.12, 0],
        ra: 0.075,
        rb: 0.022,
      },
      0,
      s,
    ),
    part(
      'puff1',
      'ruff',
      { type: 'sphere', c: [x0 + 0.005, y0 + 0.02, bodyW * 0.42], r: 0.072 },
      0.035,
      s,
    ),
    part(
      'puff2',
      'ruff',
      { type: 'sphere', c: [x0 - 0.05, y0 + 0.08, bodyW * 0.72], r: 0.066 },
      0.035,
      s,
    ),
    part(
      'puff3',
      'ruff',
      { type: 'sphere', c: [x0 - 0.02, y0 - 0.045, bodyW * 0.32], r: 0.056 },
      0.03,
      s,
    ),
  ];
  return makeGroup('ruff', 'body', true, 0.045, parts);
}

function buildAmphibian(g: CreatureGenome, pal: Palette, pose: ArtPose): CreatureScene {
  const rig = POSES[pose];
  const P = g.proportions;
  const bodyL = 0.17 + 0.18 * P.body;
  const bodyH = 0.095 + 0.05 * P.body;
  const bodyW = bodyH * 1.3;
  const legLen = 0.05 + 0.12 * P.legs;
  const bodyY = legLen + bodyH * 0.75;
  const R = (0.165 + 0.115 * P.head) * 0.92;
  const headCenter: Vec3 = [bodyL * 0.92, bodyY + bodyH * 0.62, 0];
  const coat = pal.primary;

  const bodyParts: Part[] = [
    part(
      'torso',
      'body',
      { type: 'ellipsoid', c: [0, bodyY, 0], r: [bodyL, bodyH, bodyW] },
      0,
      fur(coat),
    ),
    part(
      'rump',
      'body',
      {
        type: 'ellipsoid',
        c: [-bodyL * 0.62, bodyY - 0.012, 0],
        r: [bodyL * 0.55, bodyH * 0.85, bodyW * 0.78],
      },
      0.09,
      fur(coat),
    ),
    // Dorsal ridge fin running along the back into the tail.
    part(
      'ridge',
      'fin',
      {
        type: 'ellipsoid',
        c: [-bodyL * 0.42, bodyY + bodyH * 0.82, 0],
        r: [bodyL * 0.62, bodyH * 0.36, 0.012],
      },
      0.035,
      finSurface(coat, { sss: 0.8 }),
    ),
  ];
  const legR = 0.04 + 0.01 * P.body;
  const limbs = [
    { x: bodyL * 0.48, z: -1, fwd: 0.05 },
    { x: bodyL * 0.48, z: 1, fwd: 0.03 },
    { x: -bodyL * 0.5, z: -1, fwd: -0.04 },
    { x: -bodyL * 0.5, z: 1, fwd: -0.05 },
  ];
  for (const limb of limbs) {
    const top: Vec3 = [limb.x, bodyY - bodyH * 0.35, limb.z * bodyW * 0.7];
    const foot: Vec3 = [limb.x + limb.fwd, legR * 0.8, limb.z * (bodyW + 0.075)];
    bodyParts.push(
      part(
        'leg',
        'leg',
        { type: 'roundCone', a: top, b: foot, ra: legR * 1.15, rb: legR * 0.85 },
        0.04,
        fur(coat),
      ),
      part(
        'foot',
        'paw',
        {
          type: 'ellipsoid',
          c: add(foot, [0.022, -legR * 0.25, limb.z * 0.012]),
          r: [legR * 1.45, legR * 0.55, legR * 1.2],
        },
        0.025,
        fur(coat),
      ),
    );
    // Four little toe beans make the feet read as hands.
    for (let k = 0; k < 3; k++) {
      const ang = deg(-35 + 35 * k) * limb.z;
      const toe = add(foot, [
        0.022 + Math.cos(ang) * legR * 1.35,
        -legR * 0.3,
        limb.z * 0.012 + Math.sin(ang) * legR * 1.1,
      ]);
      bodyParts.push(
        part('toe', 'paw', { type: 'sphere', c: toe, r: legR * 0.36 }, 0.012, fur(coat)),
      );
    }
  }
  const bodyPaints: string[] = [
    paintBelly({ color: pal.belly, y: bodyY - bodyH * 0.35, rise: 0.25, fromX: 0, soft: 0.025 }),
  ];
  for (const spots of extrasOf(g, 'spots')) {
    bodyPaints.push(
      paintSpots(
        colorOf(pal, spots.color),
        spotLayout(
          g,
          spots.count,
          (u, v) => {
            const x = bodyL * (0.55 - 1.35 * u);
            const a = v * 0.95;
            const k = Math.sqrt(Math.max(0.05, 1 - (x / (bodyL * 1.05)) ** 2));
            return [x, bodyY + bodyH * Math.cos(a) * k, bodyW * Math.sin(a) * k];
          },
          0.026,
        ),
      ),
    );
  }
  const groups: Group[] = [makeGroup('body', 'body', false, 0, bodyParts, bodyPaints)];
  const emitters: Emitter[] = [];

  const tail = buildTail(g, pal, [-bodyL * 0.95, bodyY + 0.005, 0], 0.32 + 0.45 * P.tail, rig);
  if (tail.group) groups.push(tail.group);
  emitters.push(...tail.emitters);

  const head = buildHead(g, pal, R, rig);
  groups.push(...head.groups);
  emitters.push(...head.emitters);

  return {
    key: sceneKey(g, pose),
    groups,
    emitters,
    headCenter,
    headPose: posedHead({ yaw: deg(46), pitch: deg(6), roll: deg(-8) }, rig),
    headRadius: R,
  };
}

const sceneCache = new Map<string, CreatureScene>();

/** Compiles (and memoizes) the static scene for a genome in a pose. */
export function genomeToScene(genome: CreatureGenome, pose: ArtPose = 'idle'): CreatureScene {
  const key = sceneKey(genome, pose);
  const cached = sceneCache.get(key);
  if (cached) return cached;
  const pal = resolvePalette(genome);
  // Plans without a dedicated builder yet borrow the closest silhouette family.
  const scene =
    genome.plan === 'amphibian' || genome.plan === 'fish' || genome.plan === 'serpent'
      ? buildAmphibian(genome, pal, pose)
      : buildQuadruped(genome, pal, pose);
  sceneCache.set(key, scene);
  return scene;
}

/** Head-local → body rotation for a pose: yaw toward the viewer, then nod, then tilt. */
export function headRotation(yaw: number, pitch: number, roll: number): Mat3 {
  return mulMM(mulMM(rotY(yaw), rotZ(pitch)), rotX(roll));
}
