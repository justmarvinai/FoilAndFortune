import type { ArtComposition, BiomeId, CreatureArtRequest } from '@/art/types';
import type { ElementId } from '@/content/schema/common';
import type { ElementFx } from '@/content/schema/genome';
import { hexToLinear, mixRgb, type Rgb, scaleRgb } from './color';
import {
  add,
  clamp,
  cross,
  deg,
  dot,
  type Mat3,
  mulMV,
  normalize,
  scale,
  sub,
  transpose,
  type Vec3,
} from './math';
import { createRng, hashString, range } from './rng';
import { headRotation } from './sdf/genomeToScene';
import { groupHull, type HullBall } from './sdf/kit';
import type { CreatureScene } from './sdf/types';

/**
 * Stage = everything around the creature for one render: camera framing per composition,
 * biome palette and time-of-day lighting, particles and glow sprites. Pure CPU math; the
 * renderer uploads the result as uniforms.
 */

export type TimeOfDay = 'day' | 'dusk' | 'night';

/** How far the body turns from profile toward the viewer (3/4 view). */
const VIEW_YAW = deg(32);

/** Shader array sizes (particles are capped in shaders/frag.ts). */
const MAX_GLOWS = 4;
const MAX_EMITTERS = 3;

/** Palette slots shared by all biome shaders (see shaders/biomes.ts). */
interface BiomePalette {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  cloudLit: string;
  cloudShade: string;
  farLand: string;
  midLand: string;
  groundA: string;
  groundB: string;
  accent: string;
  accent2: string;
  haze: string;
  sunGlow: string;
  extra: string;
}

interface Lighting {
  /** Direction toward the key light (world). */
  key: Vec3;
  keyColor: string;
  keyI: number;
  skyFill: string;
  skyI: number;
  groundFill: string;
  groundI: number;
  rim: Vec3;
  rimColor: string;
  rimI: number;
  /** Where the sun/moon glow sits in the sky (world direction). */
  skySun: Vec3;
  exposure: number;
}

interface BiomeLook {
  palette: BiomePalette;
  light: Lighting;
}

// Light directions point toward the light (world space; camera looks down −z, creatures face
// screen-left). Day and dusk keys come from the front-left so faces stay lit; dusk puts the sun
// glow on the left horizon with a warm rim from behind-left; night uses the moon plus the
// creature's own glow.
const KEY_DAY: Vec3 = [-0.55, 0.72, 0.52];
const KEY_DUSK: Vec3 = [-0.78, 0.3, 0.55];
const KEY_NIGHT: Vec3 = [-0.35, 0.75, 0.56];
const RIM_DAY: Vec3 = [0.6, 0.45, -0.66];
const RIM_DUSK: Vec3 = [-0.35, 0.3, -0.89];
const RIM_NIGHT: Vec3 = [0.5, 0.45, -0.74];
const SUN_DUSK: Vec3 = [-0.36, 0.05, -0.93];
const MOON: Vec3 = [-0.38, 0.45, -0.81];

const BIOMES: Record<BiomeId, Record<TimeOfDay, BiomeLook>> = {
  'storm-meadow': {
    day: {
      palette: {
        skyTop: '#3F3584',
        skyMid: '#7263B6',
        skyHorizon: '#F7D08C',
        cloudLit: '#BBA9EA',
        cloudShade: '#44387C',
        farLand: '#8E7FC0',
        midLand: '#B89A5A',
        groundA: '#E9BA4E',
        groundB: '#B98A33',
        accent: '#DDF3FF',
        accent2: '#FFF1B8',
        haze: '#D6C3E6',
        sunGlow: '#FFE9B8',
        extra: '#8E7AC0',
      },
      light: {
        key: KEY_DAY,
        keyColor: '#FFF7EA',
        keyI: 1.7,
        skyFill: '#B9AFEA',
        skyI: 0.5,
        groundFill: '#E8C074',
        groundI: 0.26,
        rim: RIM_DAY,
        rimColor: '#E6DCFF',
        rimI: 0.65,
        skySun: [-0.3, 0.35, -0.88],
        exposure: 1.0,
      },
    },
    dusk: {
      palette: {
        skyTop: '#1E1850',
        skyMid: '#5E3580',
        skyHorizon: '#F2878A',
        cloudLit: '#E88A9A',
        cloudShade: '#2C2258',
        farLand: '#4E3C7A',
        midLand: '#6E4A6E',
        groundA: '#D09048',
        groundB: '#6A3E48',
        accent: '#EDE6FF',
        accent2: '#FFD6A6',
        haze: '#9A6A8E',
        sunGlow: '#FFB070',
        extra: '#6A4F95',
      },
      light: {
        key: KEY_DUSK,
        keyColor: '#FFE2BE',
        keyI: 1.8,
        skyFill: '#9A80CC',
        skyI: 0.46,
        groundFill: '#D08A50',
        groundI: 0.28,
        rim: RIM_DUSK,
        rimColor: '#FFB48C',
        rimI: 1.35,
        skySun: SUN_DUSK,
        exposure: 1.05,
      },
    },
    night: {
      palette: {
        skyTop: '#0B0C2A',
        skyMid: '#1E1D4E',
        skyHorizon: '#3E3478',
        cloudLit: '#5A56A8',
        cloudShade: '#17153A',
        farLand: '#2A2860',
        midLand: '#3A3858',
        groundA: '#7A7A6A',
        groundB: '#3E3D46',
        accent: '#BFE6FF',
        accent2: '#C0D0FF',
        haze: '#2E2C62',
        sunGlow: '#C8D4FF',
        extra: '#35306E',
      },
      light: {
        key: KEY_NIGHT,
        keyColor: '#B8C8FF',
        keyI: 1.0,
        skyFill: '#6A6CB8',
        skyI: 0.55,
        groundFill: '#46447A',
        groundI: 0.22,
        rim: RIM_NIGHT,
        rimColor: '#9DB8FF',
        rimI: 1.2,
        skySun: MOON,
        exposure: 1.15,
      },
    },
  },
  'volcano-dawn': {
    day: {
      palette: {
        skyTop: '#6A5DB0',
        skyMid: '#EE9BB0',
        skyHorizon: '#FFD29C',
        cloudLit: '#FFD0B8',
        cloudShade: '#B983AE',
        farLand: '#9A7098',
        midLand: '#86585E',
        groundA: '#8E5A4A',
        groundB: '#5A3838',
        accent: '#FF7E3A',
        accent2: '#A07FA4',
        haze: '#EEB6B6',
        sunGlow: '#FFE2A6',
        extra: '#FFB066',
      },
      light: {
        key: KEY_DAY,
        keyColor: '#FFEEDC',
        keyI: 1.7,
        skyFill: '#D8B8DE',
        skyI: 0.48,
        groundFill: '#C07A60',
        groundI: 0.26,
        rim: RIM_DAY,
        rimColor: '#FFB88C',
        rimI: 0.95,
        skySun: [-0.45, 0.12, -0.88],
        exposure: 1.0,
      },
    },
    dusk: {
      palette: {
        skyTop: '#2E1F5E',
        skyMid: '#B24E7A',
        skyHorizon: '#FF8E4E',
        cloudLit: '#FF9A70',
        cloudShade: '#5E3466',
        farLand: '#6E3F6E',
        midLand: '#6A3A48',
        groundA: '#7A4438',
        groundB: '#3E2222',
        accent: '#FF6A2A',
        accent2: '#7E5A80',
        haze: '#C06A7E',
        sunGlow: '#FF8C40',
        extra: '#FF8A40',
      },
      light: {
        key: KEY_DUSK,
        keyColor: '#FFB27E',
        keyI: 1.75,
        skyFill: '#A782BE',
        skyI: 0.46,
        groundFill: '#B0604A',
        groundI: 0.3,
        rim: RIM_DUSK,
        rimColor: '#FF9A6A',
        rimI: 1.3,
        skySun: SUN_DUSK,
        exposure: 1.05,
      },
    },
    night: {
      palette: {
        skyTop: '#120B26',
        skyMid: '#2E1840',
        skyHorizon: '#6E2E3E',
        cloudLit: '#7E3E52',
        cloudShade: '#22142E',
        farLand: '#2E1A36',
        midLand: '#23142A',
        groundA: '#4A2A2A',
        groundB: '#2A1818',
        accent: '#FF6A22',
        accent2: '#5A3A55',
        haze: '#4A2238',
        sunGlow: '#FFC0A0',
        extra: '#FF7A30',
      },
      light: {
        key: KEY_NIGHT,
        keyColor: '#BCC0FF',
        keyI: 0.85,
        skyFill: '#6A5094',
        skyI: 0.5,
        groundFill: '#C85A30',
        groundI: 0.42,
        rim: [0.4, 0.2, -0.9],
        rimColor: '#FF8A5A',
        rimI: 1.3,
        skySun: MOON,
        exposure: 1.15,
      },
    },
  },
  lagoon: {
    day: {
      palette: {
        skyTop: '#3C92E8',
        skyMid: '#86C6FF',
        skyHorizon: '#DDF5FF',
        cloudLit: '#FFFFFF',
        cloudShade: '#AFCBEA',
        farLand: '#5FA592',
        midLand: '#3E8C78',
        groundA: '#F6E2B5',
        groundB: '#D9BD8C',
        accent: '#1994C4',
        accent2: '#4FE0D2',
        haze: '#CFEFFF',
        sunGlow: '#FFF7DA',
        extra: '#FFFFFF',
      },
      light: {
        key: KEY_DAY,
        keyColor: '#FFFAF0',
        keyI: 1.75,
        skyFill: '#B4DDFF',
        skyI: 0.55,
        groundFill: '#F0DDB0',
        groundI: 0.3,
        rim: RIM_DAY,
        rimColor: '#FFFFFF',
        rimI: 0.55,
        skySun: [-0.25, 0.55, -0.8],
        exposure: 0.98,
      },
    },
    dusk: {
      palette: {
        skyTop: '#34448E',
        skyMid: '#D68AAE',
        skyHorizon: '#FFC07E',
        cloudLit: '#FFC2A0',
        cloudShade: '#7E6EA6',
        farLand: '#6A6090',
        midLand: '#4A4A74',
        groundA: '#F2CFA4',
        groundB: '#C4987A',
        accent: '#2A5A8E',
        accent2: '#4AAEB4',
        haze: '#E8B8B8',
        sunGlow: '#FFB870',
        extra: '#FFE8D8',
      },
      light: {
        key: KEY_DUSK,
        keyColor: '#FFCFA2',
        keyI: 1.8,
        skyFill: '#A8A0D8',
        skyI: 0.5,
        groundFill: '#E0A888',
        groundI: 0.3,
        rim: RIM_DUSK,
        rimColor: '#FFC0A0',
        rimI: 1.25,
        skySun: SUN_DUSK,
        exposure: 1.05,
      },
    },
    night: {
      palette: {
        skyTop: '#07102E',
        skyMid: '#132A5E',
        skyHorizon: '#2E4C86',
        cloudLit: '#4A62A0',
        cloudShade: '#101C40',
        farLand: '#16284A',
        midLand: '#12223C',
        groundA: '#8C8CA0',
        groundB: '#55566A',
        accent: '#0C2A4E',
        accent2: '#2FD9C8',
        haze: '#1C2E5A',
        sunGlow: '#D8E4FF',
        extra: '#9FFFF0',
      },
      light: {
        key: KEY_NIGHT,
        keyColor: '#C0D0FF',
        keyI: 1.0,
        skyFill: '#5874BC',
        skyI: 0.55,
        groundFill: '#3A5A8A',
        groundI: 0.25,
        rim: RIM_NIGHT,
        rimColor: '#A8D8FF',
        rimI: 1.2,
        skySun: MOON,
        exposure: 1.15,
      },
    },
  },
};

/** Knoll curvature (the creature stands on a gentle hilltop) and water level per biome. */
const TERRAIN: Record<BiomeId, { k: number; water: number }> = {
  'storm-meadow': { k: 0.14, water: -1e3 },
  'volcano-dawn': { k: 0.16, water: -1e3 },
  lagoon: { k: 0.12, water: -0.1 },
};

/** Default biome for an element when the caller doesn't pass one. */
const ELEMENT_BIOME: Partial<Record<ElementId, BiomeId>> = {
  volt: 'storm-meadow',
  ember: 'volcano-dawn',
  tide: 'lagoon',
  frost: 'lagoon',
  bloom: 'storm-meadow',
};

/** Ambient particles of a biome shown alone (Arena art has no subject to take them from). */
const BIOME_FX: Record<BiomeId, { fx: ElementFx; glow: string }> = {
  'storm-meadow': { fx: 'sparks', glow: '#9FE6FF' },
  'volcano-dawn': { fx: 'embers', glow: '#FFB347' },
  lagoon: { fx: 'bubbles', glow: '#BFF3FF' },
};

/**
 * Stand-in silhouette for subject-less scenes (Arenas): framing a creature-sized volume on the
 * knoll keeps the horizon, the knoll and the sky where every other card of the biome has them.
 */
const SCENERY_HULL: readonly HullBall[] = [
  { c: [0, 0.2, 0], r: 0.2 },
  { c: [0, 0.45, 0], r: 0.2 },
];
const NO_BOX: Vec3 = [0, -1e3, 0];

interface Framing {
  fovY: number;
  /** Fraction of the frame height the creature's silhouette should fill. */
  fill: number;
  /** Upper bound on the fraction of the frame width (long creatures are width-limited). */
  fillW: number;
  /** Extra turn toward the viewer; portrait frames favor a more frontal, compact pose. */
  yawBoost: number;
  /** Camera elevation above the creature (radians). */
  elevation: number;
  /** Where the silhouette's bounding-box center lands, in NDC (−1…1). */
  centerX: number;
  /** For window: bbox center y. For fullArt: bbox bottom y. */
  anchorY: number;
  anchor: 'center' | 'bottom';
}

const FRAMING: Record<ArtComposition, Framing> = {
  window: {
    fovY: deg(30),
    fill: 0.76,
    fillW: 0.9,
    yawBoost: 0,
    elevation: deg(2.5),
    centerX: 0.05,
    anchorY: -0.08,
    anchor: 'center',
  },
  fullArt: {
    fovY: deg(36),
    fill: 0.48,
    fillW: 0.86,
    yawBoost: deg(12),
    elevation: deg(2),
    centerX: 0.02,
    anchorY: -0.62,
    anchor: 'bottom',
  },
};

export interface Particle {
  /** Pixel position (origin bottom-left, like gl_FragCoord). */
  x: number;
  y: number;
  radius: number;
  rotation: number;
  color: Rgb;
  intensity: number;
  kind: 0 | 1 | 2 | 3;
  front: boolean;
  blur: number;
  stretch: number;
}

export interface Glow {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: Rgb;
}

export interface Stage {
  width: number;
  height: number;
  biome: BiomeId;
  transparent: boolean;
  camPos: Vec3;
  camRight: Vec3;
  camUp: Vec3;
  camFwd: Vec3;
  tanHalf: number;
  shift: [number, number];
  toLocal: Mat3;
  crPos: Vec3;
  headRotInv: Mat3;
  boxMin: Vec3;
  boxMax: Vec3;
  keyDir: Vec3;
  keyCol: Rgb;
  skyFill: Rgb;
  groundFill: Rgb;
  rimDir: Vec3;
  rimCol: Rgb;
  skySun: Vec3;
  palette: Rgb[];
  tod: Vec3;
  seed: number;
  groundK: number;
  waterY: number;
  hazeDensity: number;
  exposure: number;
  vignette: number;
  shadowRadius: number;
  emitters: { pos: Vec3; color: Rgb; range: number }[];
  particles: Particle[];
  glows: Glow[];
}

const PALETTE_ORDER: (keyof BiomePalette)[] = [
  'skyTop',
  'skyMid',
  'skyHorizon',
  'cloudLit',
  'cloudShade',
  'farLand',
  'midLand',
  'groundA',
  'groundB',
  'accent',
  'accent2',
  'haze',
  'sunGlow',
  'extra',
];

export function resolveBiome(request: CreatureArtRequest): BiomeId {
  return request.biome ?? ELEMENT_BIOME[request.element] ?? 'storm-meadow';
}

export function buildStage(request: CreatureArtRequest, scene: CreatureScene): Stage {
  const width = Math.max(8, Math.round(request.width));
  const height = Math.max(8, Math.round(request.height));
  const aspect = width / height;
  const biome = resolveBiome(request);
  const tod: TimeOfDay = request.timeOfDay ?? 'day';
  const look = BIOMES[biome][tod];
  const transparent = request.background === 'transparent';
  const seed = (request.seed ?? 1) >>> 0;
  const rng = createRng(seed ^ hashString(scene.key));
  const framing = FRAMING[request.composition];
  const fullArt = request.composition === 'fullArt';

  // Pose: species default plus a little seeded variation, so a set's cards don't look cloned.
  const pose = scene.headPose;
  const headRot = headRotation(
    pose.yaw + deg(range(rng, -4, 4)),
    pose.pitch + deg(range(rng, -2.5, 2.5)),
    pose.roll + deg(range(rng, -3, 3)),
  );

  // Creature orientation: body turned 3/4 toward the viewer, facing screen-left.
  const bodyYaw = VIEW_YAW + framing.yawBoost + deg(range(rng, -3, 3));
  const X: Vec3 = [-Math.cos(bodyYaw), 0, Math.sin(bodyYaw)];
  const Y: Vec3 = [0, 1, 0];
  const Z = cross(X, Y);
  const toLocal: Mat3 = [X[0], X[1], X[2], Y[0], Y[1], Y[2], Z[0], Z[1], Z[2]];
  const toWorld = transpose(toLocal);
  const crPos: Vec3 = [0, 0, 0];
  const worldOf = (p: Vec3): Vec3 => add(crPos, mulMV(toWorld, p));

  const subjectHull: HullBall[] = scene.groups
    .flatMap((g) => groupHull(g, scene.headCenter, headRot))
    .map((b) => ({ c: worldOf(b.c), r: b.r }));
  // A scene without parts (an Arena) frames a stand-in volume and marches nothing.
  const scenery = subjectHull.length === 0;
  const hull: readonly HullBall[] = scenery ? SCENERY_HULL : subjectHull;
  const lo: [number, number, number] = [Infinity, Infinity, Infinity];
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const b of hull) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i] ?? 0, (b.c[i] ?? 0) - b.r);
      hi[i] = Math.max(hi[i] ?? 0, (b.c[i] ?? 0) + b.r);
    }
  }
  lo[1] = Math.max(lo[1], 0);
  // A zero-size box deep underground is never entered (boxHit needs entry < exit), so primary
  // rays and shadow rays skip the creature pass entirely.
  const boxMin: Vec3 = scenery ? NO_BOX : [lo[0] - 0.03, lo[1] - 0.03, lo[2] - 0.03];
  const boxMax: Vec3 = scenery ? NO_BOX : [hi[0] + 0.03, hi[1] + 0.03, hi[2] + 0.03];
  const center: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];

  // ---- Camera: fit the silhouette (height target, width cap), then lens-shift it into place -----
  const tanHalf = Math.tan(framing.fovY / 2);
  const camDir: Vec3 = [0, Math.sin(framing.elevation), Math.cos(framing.elevation)];
  let dist = (hi[1] - lo[1]) / framing.fill / (2 * tanHalf) + 0.5;
  let basis = cameraBasis(center, camDir, dist);
  for (let iter = 0; iter < 5; iter++) {
    const b = projectBounds(hull, basis, tanHalf, aspect);
    const h = (b.maxY - b.minY) / 2;
    const w = (b.maxX - b.minX) / 2;
    dist *= Math.max(h / framing.fill, w / framing.fillW);
    basis = cameraBasis(center, camDir, dist);
  }
  const bounds = projectBounds(hull, basis, tanHalf, aspect);
  const bcx = (bounds.minX + bounds.maxX) / 2;
  const anchorNow = framing.anchor === 'center' ? (bounds.minY + bounds.maxY) / 2 : bounds.minY;
  // Lens shift (in tan units) moves the image without tilting verticals.
  const shift: [number, number] = [
    (bcx - framing.centerX) * tanHalf * aspect,
    (anchorNow - framing.anchorY) * tanHalf,
  ];

  // ---- Lighting -----------------------------------------------------------------------------------
  const L = look.light;
  const keyBoost = fullArt ? 1.05 : 1;
  const palette = PALETTE_ORDER.map((k) => hexToLinear(look.palette[k]));
  const terrain = TERRAIN[biome];

  const stage: Stage = {
    width,
    height,
    biome,
    transparent,
    camPos: basis.pos,
    camRight: basis.right,
    camUp: basis.up,
    camFwd: basis.fwd,
    tanHalf,
    shift,
    toLocal,
    crPos,
    headRotInv: transpose(headRot),
    boxMin,
    boxMax,
    keyDir: normalize(L.key),
    keyCol: scaleRgb(hexToLinear(L.keyColor), L.keyI * keyBoost),
    skyFill: scaleRgb(hexToLinear(L.skyFill), L.skyI),
    groundFill: scaleRgb(hexToLinear(L.groundFill), L.groundI),
    rimDir: normalize(L.rim),
    rimCol: scaleRgb(hexToLinear(L.rimColor), L.rimI * (fullArt ? 1.35 : 1)),
    skySun: normalize(L.skySun),
    palette,
    tod: tod === 'day' ? [1, 0, 0] : tod === 'dusk' ? [0, 1, 0] : [0, 0, 1],
    seed: (seed % 997) / 997,
    groundK: transparent ? 0 : terrain.k,
    waterY: transparent ? -1e3 : terrain.water,
    hazeDensity: fullArt ? 0.05 : 0.06,
    exposure: L.exposure,
    vignette: transparent ? 0 : fullArt ? 0.55 : 0.35,
    shadowRadius: Math.max(hi[0] - lo[0], hi[2] - lo[2]) * 0.8 + 0.5,
    emitters: [],
    particles: [],
    glows: [],
  };

  // ---- Emitters: glow sprites + point lights ---------------------------------------------------
  const project = (p: Vec3) => projectPoint(p, basis, tanHalf, aspect, shift, width, height);
  for (const e of scene.emitters.slice(0, MAX_EMITTERS)) {
    const body = e.frame === 'head' ? add(scene.headCenter, mulMV(headRot, e.pos)) : e.pos;
    const world = worldOf(body);
    const glowBoost = tod === 'night' ? 1.6 : tod === 'dusk' ? 1.25 : 1;
    stage.emitters.push({
      pos: world,
      color: scaleRgb(e.color, e.light * glowBoost),
      range: e.radius * 2.2,
    });
    const sp = project(world);
    if (sp && stage.glows.length < MAX_GLOWS) {
      stage.glows.push({
        x: sp.x,
        y: sp.y,
        radius: (e.radius / sp.depth / tanHalf) * (height / 2),
        intensity: e.intensity * glowBoost,
        color: e.color,
      });
    }
  }

  // ---- Particles (element FX) -------------------------------------------------------------------
  const { fx, glow: glowHex } = particleSource(request, biome);
  if (fx !== 'none') {
    const headWorld = worldOf(scene.headCenter);
    const headScreen = scene.headRadius > 0 ? project(headWorld) : null;
    const headPx =
      (scene.headRadius / Math.max(0.1, headScreen?.depth ?? 1) / tanHalf) * (height / 2);
    const centerDepth = dot(sub(center, basis.pos), basis.fwd);
    const creatureBox = screenBox(hull.map((b) => project(b.c)));
    const want = Math.round((fullArt ? 22 : 12) * (request.pose === 'action' ? 1.35 : 1));
    const span = Math.max(hi[0] - lo[0], 0.8);
    for (let tries = 0; tries < 400 && stage.particles.length < want; tries++) {
      const wp: Vec3 = [
        center[0] + range(rng, -0.85, 0.85) * span * (fullArt ? 1.4 : 1.15),
        range(rng, 0.04, hi[1] + (fullArt ? 0.9 : 0.35)),
        range(rng, -1.1, 0.9),
      ];
      const sp = project(wp);
      if (!sp) continue;
      if (sp.x < -20 || sp.x > width + 20 || sp.y < -20 || sp.y > height + 20) continue;
      const rel = sp.depth - centerDepth;
      if (Math.abs(rel) < 0.3) continue;
      const front = rel < 0;
      if (
        front &&
        headScreen &&
        Math.hypot(sp.x - headScreen.x, sp.y - headScreen.y) < headPx * 1.5
      ) {
        continue;
      }
      if (front && !scenery && insideBox(sp, creatureBox, 0.35)) continue;
      const p = makeParticle(fx, rng, glowHex, tod);
      const pxPerUnit = (1 / sp.depth / tanHalf) * (height / 2);
      const near = front ? clamp(-rel / 1.2, 0, 1) : 0;
      stage.particles.push({
        ...p,
        x: sp.x,
        y: sp.y,
        radius: p.radius * pxPerUnit * (1 + near * 0.8),
        blur: clamp(p.blur + near * 0.6 + (front ? 0 : 0.15), 0, 1),
        intensity: p.intensity * (front ? 1 - near * 0.45 : 0.8),
        front,
      });
    }
  }
  return stage;
}

/** Which particles float around the subject: the creature's, the prop's, or the biome's own. */
function particleSource(
  request: CreatureArtRequest,
  biome: BiomeId,
): { fx: ElementFx; glow: string } {
  if (request.genome) return { fx: request.genome.elementFx, glow: request.genome.palette.glow };
  if (request.prop) return { fx: request.prop.fx, glow: request.prop.glow };
  return BIOME_FX[biome];
}

function makeParticle(
  fx: ElementFx,
  rng: () => number,
  glowHex: string,
  tod: TimeOfDay,
): Omit<Particle, 'x' | 'y' | 'front'> {
  const night = tod === 'night' ? 1.4 : 1;
  switch (fx) {
    case 'sparks': {
      const colors = [hexToLinear(glowHex), [1, 1, 1] as Rgb, hexToLinear('#FFF3A6')];
      return {
        radius: range(rng, 0.018, 0.04),
        rotation: range(rng, 0, Math.PI / 4),
        color: colors[Math.floor(rng() * colors.length)] ?? colors[0] ?? [1, 1, 1],
        intensity: range(rng, 1.2, 2.6) * night,
        kind: 0,
        blur: range(rng, 0, 0.25),
        stretch: 1,
      };
    }
    case 'embers': {
      const colors = ['#FFB347', '#FF7A3D', '#FFD166'].map(hexToLinear);
      return {
        radius: range(rng, 0.006, 0.014),
        rotation: range(rng, -0.4, 0.4),
        color: colors[Math.floor(rng() * colors.length)] ?? [1, 0.5, 0.2],
        intensity: range(rng, 1.4, 3.0) * night,
        kind: 1,
        blur: range(rng, 0, 0.3),
        stretch: range(rng, 1.3, 2.3),
      };
    }
    case 'bubbles':
      return {
        radius: range(rng, 0.018, 0.05),
        rotation: 0,
        color: mixRgb(hexToLinear(glowHex), [1, 1, 1], 0.4),
        intensity: range(rng, 0.7, 1.1) * (tod === 'night' ? 0.8 : 1),
        kind: 2,
        blur: range(rng, 0, 0.2),
        stretch: 1,
      };
    default:
      return {
        radius: range(rng, 0.012, 0.03),
        rotation: 0,
        color: mixRgb(hexToLinear(glowHex), [1, 1, 1], 0.5),
        intensity: range(rng, 0.6, 1.2) * night,
        kind: 3,
        blur: range(rng, 0.2, 0.6),
        stretch: 1,
      };
  }
}

interface ScreenBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function screenBox(points: readonly ({ x: number; y: number } | null)[]): ScreenBox {
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const p of points) {
    if (!p) continue;
    box.minX = Math.min(box.minX, p.x);
    box.maxX = Math.max(box.maxX, p.x);
    box.minY = Math.min(box.minY, p.y);
    box.maxY = Math.max(box.maxY, p.y);
  }
  return box;
}

/** Inside the box shrunk by `inset` (fraction of its size) on every side. */
function insideBox(p: { x: number; y: number }, b: ScreenBox, inset: number): boolean {
  const ix = (b.maxX - b.minX) * inset * 0.5;
  const iy = (b.maxY - b.minY) * inset * 0.5;
  return p.x > b.minX + ix && p.x < b.maxX - ix && p.y > b.minY + iy && p.y < b.maxY - iy;
}

interface Basis {
  pos: Vec3;
  fwd: Vec3;
  right: Vec3;
  up: Vec3;
}

function cameraBasis(target: Vec3, dir: Vec3, dist: number): Basis {
  const pos = add(target, scale(dir, dist));
  const fwd = normalize(sub(target, pos));
  const right = normalize(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  return { pos, fwd, right, up };
}

/** NDC bounds (without lens shift) of a set of balls; each ball projects to about r/z. */
function projectBounds(balls: readonly HullBall[], b: Basis, tanHalf: number, aspect: number) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ball of balls) {
    const v = sub(ball.c, b.pos);
    const z = dot(v, b.fwd);
    const x = dot(v, b.right) / z;
    const y = dot(v, b.up) / z;
    const r = ball.r / z;
    minX = Math.min(minX, (x - r) / (tanHalf * aspect));
    maxX = Math.max(maxX, (x + r) / (tanHalf * aspect));
    minY = Math.min(minY, (y - r) / tanHalf);
    maxY = Math.max(maxY, (y + r) / tanHalf);
  }
  return { minX, maxX, minY, maxY };
}

function projectPoint(
  p: Vec3,
  b: Basis,
  tanHalf: number,
  aspect: number,
  shift: readonly [number, number],
  width: number,
  height: number,
): { x: number; y: number; depth: number } | null {
  const v = sub(p, b.pos);
  const z = dot(v, b.fwd);
  if (z < 0.05) return null;
  const ndcX = (dot(v, b.right) / z - shift[0]) / (tanHalf * aspect);
  const ndcY = (dot(v, b.up) / z - shift[1]) / tanHalf;
  return { x: (ndcX * 0.5 + 0.5) * width, y: (ndcY * 0.5 + 0.5) * height, depth: z };
}
