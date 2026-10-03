import type { ArtPose } from '@/art/types';
import type { ArtProp } from '@/content/schema/genome';
import { hexToLinear, mixRgb, type Rgb, scaleRgb } from '../color';
import {
  add,
  deg,
  dirYawPitch,
  frameAlongX,
  frameAlongY,
  glf,
  IDENTITY,
  type Mat3,
  normalize,
  scale,
  sub,
  type Vec3,
} from '../math';
import { hashString } from '../rng';
import {
  type EyeSpec,
  ellipsoidNormal,
  emissive,
  frameFacingZ,
  fur,
  glColor,
  glossy,
  leafPart,
  makeGroup,
  onEllipsoid,
  paintBlush,
  paintEye,
  paintMouth,
  part,
} from './kit';
import type { CreatureScene, Emitter, Group, Part } from './types';

/**
 * Tactic-card subjects (docs/04 §6.2) as CreatureScenes, so props ride the exact same pipeline
 * as creatures (GLSL, framing, lights, particles): clay still-life props for Items and Peg-folk
 * figures for Allies. Coordinates follow genomeToScene: +x forward (the prop's "front" turns
 * toward screen-left), +y up, the camera sees the −z side, ground at y = 0, about 0.6–0.9 tall.
 */

type PropOf<K extends ArtProp['kind']> = Extract<ArtProp, { kind: K }>;

const NO_HEAD = { yaw: 0, pitch: 0, roll: 0 };
const BLUSH = hexToLinear('#FF8FA6');
const MOUTH_INSIDE = hexToLinear('#7A2335');
const TONGUE = hexToLinear('#FF7D92');

/** Stable program-cache key for a prop in a pose. */
function propKey(prop: ArtProp, pose: ArtPose): string {
  return `prop1:${hashString(JSON.stringify(prop)).toString(36)}:${pose}`;
}

function sceneOf(
  key: string,
  groups: Group[],
  emitters: Emitter[],
  head?: Pick<CreatureScene, 'headCenter' | 'headPose' | 'headRadius'>,
): CreatureScene {
  return {
    key,
    groups,
    emitters,
    headCenter: head?.headCenter ?? [0, 0, 0],
    headPose: head?.headPose ?? NO_HEAD,
    headRadius: head?.headRadius ?? 0,
  };
}

/** Frame whose local +Y points along `axis` (for tori and cylinders). */
const upAlong = (axis: Vec3): Mat3 => frameAlongY(axis, [1, 0, 0]);

// ---- Potion -------------------------------------------------------------------------------------

function buildPotion(prop: PropOf<'potion'>, pose: ArtPose): CreatureScene {
  const glass = hexToLinear(prop.glass);
  const liquid = hexToLinear(prop.liquid);
  const glow = hexToLinear(prop.glow);
  const stopper = hexToLinear(prop.stopper);
  const label = hexToLinear(prop.label);
  const round = prop.shape === 'round';
  // Body, neck and lip heights for the two bottle shapes.
  const bodyTop = round ? 0.4 : 0.44;
  const neckTop = bodyTop + 0.15;
  const level = round ? 0.25 : 0.3;
  const glassSurface = glossy(mixRgb(glass, liquid, 0.25), { rough: 0.07, spec: 1, sss: 0.45 });

  const parts: Part[] = round
    ? [
        part(
          'flask',
          'glass',
          { type: 'ellipsoid', c: [0, 0.205, 0], r: [0.215, 0.2, 0.215] },
          0,
          glassSurface,
        ),
      ]
    : [
        part(
          'bottle',
          'glass',
          { type: 'cylinder', c: [0, 0.21, 0], rot: IDENTITY, r: 0.16, h: 0.21, round: 0.08 },
          0,
          glassSurface,
        ),
      ];
  parts.push(
    part(
      'neck',
      'glass',
      { type: 'roundCone', a: [0, bodyTop - 0.06, 0], b: [0, neckTop, 0], ra: 0.08, rb: 0.058 },
      0.05,
      glassSurface,
    ),
    part(
      'lip',
      'glass',
      { type: 'torus', c: [0, neckTop + 0.005, 0], rot: IDENTITY, R: 0.06, r: 0.022 },
      0.015,
      glassSurface,
    ),
  );
  const cork: Part[] = [
    part(
      'stopper',
      'prop',
      {
        type: 'cylinder',
        c: [0, neckTop + 0.045, 0],
        rot: IDENTITY,
        r: 0.056,
        h: 0.05,
        round: 0.02,
      },
      0,
      fur(stopper, { rough: 0.75, spec: 0.12, sss: 0.3 }),
    ),
    // A little wax seal dripping over the stopper's rim.
    part(
      'seal',
      'prop',
      { type: 'ellipsoid', c: [0, neckTop + 0.1, 0], r: [0.05, 0.022, 0.05] },
      0.02,
      glossy(mixRgb(liquid, [0.05, 0.02, 0.04], 0.45), { rough: 0.3, spec: 0.5 }),
    ),
  ];

  // Liquid line, meniscus glow and a paper label facing the viewer (about 30° toward +x).
  const liq = glColor(liquid);
  const hot = glColor(scaleRgb(mixRgb(liquid, glow, 0.5), 0.9));
  const labelY = round ? 0.19 : 0.22;
  const paint = `if (abs(mg.tag - 26.0) < 0.5) {
    float lv = smoothstep(${glf(level + 0.006)}, ${glf(level - 0.006)}, q.y);
    float men = exp(-pow((q.y - ${glf(level)}) / 0.01, 2.0));
    mg.alb = mix(mg.alb, ${liq}, lv * 0.92);
    mg.emit += ${hot} * (lv * (0.35 + 0.25 * smoothstep(${glf(level)}, 0.0, q.y)) + men * 0.8);
    mg.sss = mix(mg.sss, 1.0, lv);
    float ang = atan(q.x, -q.z) - 0.5;
    float lab = fillMask(max(abs(ang) * ${glf(round ? 0.2 : 0.16)} - 0.075, abs(q.y - ${glf(labelY)}) - 0.052), 0.004);
    lab *= step(0.0, -q.z + 0.1);
    float mark = fillMask(sdStar4(vec2(ang * ${glf(round ? 0.2 : 0.16)}, q.y - ${glf(labelY)}), 0.036, 0.012), 0.003);
    mg.alb = mix(mg.alb, mix(${glColor(label)}, ${liq}, mark), lab);
    mg.emit *= 1.0 - lab;
    mg.rough = mix(mg.rough, 0.7, lab);
    mg.spec = mix(mg.spec, 0.15, lab);
    if (lab > 0.5) mg.kind = 0.0;
  }`;

  const lift = pose === 'action' ? 0.06 : 0;
  const lifted = lift > 0 ? parts.map((p) => liftPart(p, lift)) : parts;
  const groups: Group[] = [
    makeGroup('bottle', 'body', false, 0, lifted, [paint]),
    makeGroup('stopper', 'body', false, 0.02, lift > 0 ? cork.map((p) => liftPart(p, lift)) : cork),
  ];
  const emitters: Emitter[] = [
    {
      frame: 'body',
      pos: [0, level * 0.7 + lift, 0],
      color: mixRgb(liquid, glow, 0.6),
      radius: 0.26,
      intensity: pose === 'idle' ? 0.55 : 0.8,
      light: 0.7,
    },
  ];
  return sceneOf(propKey(prop, pose), groups, emitters);
}

/** Moves a part up by `dy` (hovering props in the action pose). */
function liftPart(p: Part, dy: number): Part {
  const up: Vec3 = [0, dy, 0];
  const s = p.shape;
  switch (s.type) {
    case 'roundCone':
      return { ...p, shape: { ...s, a: add(s.a, up), b: add(s.b, up) } };
    case 'tube':
    case 'finTube':
      return { ...p, shape: { ...s, a: add(s.a, up), b: add(s.b, up), c: add(s.c, up) } };
    default:
      return { ...p, shape: { ...s, c: add(s.c, up) } };
  }
}

// ---- Charm ----------------------------------------------------------------------------------

function buildCharm(prop: PropOf<'charm'>, pose: ArtPose): CreatureScene {
  const metal = hexToLinear(prop.metal);
  const gem = hexToLinear(prop.gem);
  const glow = hexToLinear(prop.glow);
  // It hovers: higher and a little tilted when it's "active".
  const y = pose === 'action' ? 0.5 : 0.42;
  const c: Vec3 = [0, y, 0];
  // Face the camera side (−z) with a slight turn toward the front, like the spark tail tip.
  const facing = frameFacingZ(pose === 'idle' ? [0.4, 0.1, -1] : [0.25, 0.25, -1], [0, 1, 0]);
  const gold = glossy(metal, { rough: 0.22, spec: 0.9, sss: 0.1 });
  const parts: Part[] = [];
  if (prop.shape === 'star') {
    parts.push(
      part(
        'star',
        'prop',
        { type: 'star4', c, rot: facing, r: 0.22, pinch: 0.58, thick: 0.04 },
        0,
        gold,
      ),
    );
  } else {
    parts.push(
      part(
        'disc',
        'prop',
        {
          type: 'cylinder',
          c,
          rot: frameAlongY([0.4, 0.1, -1], [1, 0, 0]),
          r: 0.14,
          h: 0.03,
          round: 0.025,
        },
        0,
        gold,
      ),
    );
    // Sun rays: eight short tapered cones around the disc, in its plane.
    const n = normalize([0.4, 0.1, -1]);
    const u = normalize(sub([0, 1, 0], scale(n, n[1])));
    const v = normalize([
      n[1] * u[2] - n[2] * u[1],
      n[2] * u[0] - n[0] * u[2],
      n[0] * u[1] - n[1] * u[0],
    ]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dir = add(scale(u, Math.cos(a)), scale(v, Math.sin(a)));
      const long = i % 2 === 0 ? 0.11 : 0.075;
      parts.push(
        part(
          `ray${i}`,
          'prop',
          {
            type: 'roundCone',
            a: add(c, scale(dir, 0.13)),
            b: add(c, scale(dir, 0.14 + long)),
            ra: 0.03,
            rb: 0.008,
          },
          0.02,
          gold,
        ),
      );
    }
  }
  // Bail ring on top, turned edge-on to the viewer like a real pendant loop.
  parts.push(
    part(
      'bail',
      'prop',
      { type: 'torus', c: add(c, [0, 0.245, 0]), rot: upAlong([0.35, 0, -1]), R: 0.034, r: 0.011 },
      0.01,
      gold,
    ),
  );
  const toward = normalize([0.4, 0.1, -1]);
  const gemParts: Part[] = [
    part(
      'gem',
      'eye',
      { type: 'ellipsoid', c: add(c, scale(toward, 0.028)), r: [0.066, 0.066, 0.066] },
      0,
      glossy(gem, { rough: 0.05, spec: 1, sss: 0.6, emit: scaleRgb(mixRgb(gem, glow, 0.5), 0.45) }),
    ),
  ];
  const groups: Group[] = [
    makeGroup('charm', 'body', false, 0, parts),
    makeGroup('gem', 'body', false, 0.008, gemParts),
  ];
  const emitters: Emitter[] = [
    {
      frame: 'body',
      pos: add(c, scale(toward, 0.05)),
      color: mixRgb(gem, glow, 0.6),
      radius: 0.2,
      intensity: pose === 'idle' ? 0.7 : 1,
      light: 0.6,
    },
  ];
  return sceneOf(propKey(prop, pose), groups, emitters);
}

// ---- Lantern ------------------------------------------------------------------------------------

function buildLantern(prop: PropOf<'lantern'>, pose: ArtPose): CreatureScene {
  const frame = hexToLinear(prop.frame);
  const glassCol = hexToLinear(prop.glass);
  const flame = hexToLinear(prop.flame);
  const metal = glossy(frame, { rough: 0.32, spec: 0.7, sss: 0.05 });
  const boost = pose === 'idle' ? 1 : 1.25;
  const parts: Part[] = [
    part(
      'base',
      'prop',
      { type: 'cylinder', c: [0, 0.035, 0], rot: IDENTITY, r: 0.14, h: 0.035, round: 0.018 },
      0,
      metal,
    ),
    part(
      'cap',
      'prop',
      { type: 'roundCone', a: [0, 0.39, 0], b: [0, 0.5, 0], ra: 0.14, rb: 0.035 },
      0.02,
      metal,
    ),
    part(
      'rim',
      'prop',
      { type: 'torus', c: [0, 0.385, 0], rot: IDENTITY, R: 0.125, r: 0.022 },
      0.01,
      metal,
    ),
    part('knob', 'prop', { type: 'sphere', c: [0, 0.515, 0], r: 0.03 }, 0.015, metal),
    part(
      'handle',
      'prop',
      { type: 'torus', c: [0, 0.585, 0], rot: upAlong([1, 0, 0.25]), R: 0.07, r: 0.013 },
      0.012,
      metal,
    ),
  ];
  // Four corner posts around the glowing glass.
  for (let i = 0; i < 4; i++) {
    const a = deg(45 + 90 * i);
    const x = Math.cos(a) * 0.118;
    const z = Math.sin(a) * 0.118;
    parts.push(
      part(
        `post${i}`,
        'prop',
        { type: 'roundCone', a: [x, 0.06, z], b: [x, 0.385, z], ra: 0.017, rb: 0.017 },
        0.012,
        metal,
      ),
    );
  }
  const glassParts: Part[] = [
    part(
      'glass',
      'glass',
      { type: 'cylinder', c: [0, 0.22, 0], rot: IDENTITY, r: 0.108, h: 0.165, round: 0.03 },
      0,
      emissive(scaleRgb(glassCol, 0.6), scaleRgb(mixRgb(glassCol, flame, 0.4), 0.7 * boost), {
        sss: 0.8,
        // Hottest around the flame, dimmer toward the caps.
        ramp: {
          color: scaleRgb(glassCol, 0.5),
          emit: scaleRgb(flame, 1.25 * boost),
          from: 0.15,
          to: 0.55,
        },
      }),
    ),
  ];
  const groups: Group[] = [
    makeGroup('lantern', 'body', false, 0, parts),
    makeGroup('glass', 'body', false, 0.01, glassParts),
  ];
  const emitters: Emitter[] = [
    {
      frame: 'body',
      pos: [0, 0.22, 0],
      color: flame,
      radius: 0.34,
      intensity: 0.85 * boost,
      light: 1.1,
    },
  ];
  return sceneOf(propKey(prop, pose), groups, emitters);
}

// ---- Peg-folk ----------------------------------------------------------------------------------

interface FolkBuild {
  scale: number;
  headR: number;
  shoulderY: number;
  hipY: number;
}

const FOLK: Record<PropOf<'folk'>['age'], FolkBuild> = {
  kid: { scale: 0.9, headR: 0.23, shoulderY: 0.36, hipY: 0.17 },
  adult: { scale: 1, headR: 0.2, shoulderY: 0.42, hipY: 0.2 },
  elder: { scale: 1, headR: 0.2, shoulderY: 0.4, hipY: 0.2 },
};

/**
 * A Peg-folk figure (docs/04 §4.4): capsule body, big round head, mitten hands, painted face.
 * Allies wave (happy) or cheer with both arms up (action).
 */
function buildFolk(prop: PropOf<'folk'>, pose: ArtPose): CreatureScene {
  const build = FOLK[prop.age];
  const R = build.headR;
  const skin = hexToLinear(prop.skin);
  const hair = hexToLinear(prop.hair);
  const top = hexToLinear(prop.top);
  const bottom = hexToLinear(prop.bottom);
  const accent = hexToLinear(prop.accent);
  const shoe = mixRgb(bottom, [0.05, 0.04, 0.06], 0.65);
  const skinS = fur(skin, { sss: 0.75, rough: 0.55, spec: 0.22 });
  const cloth = (c: Rgb) => fur(c, { sss: 0.35, rough: 0.72, spec: 0.14 });
  const { shoulderY, hipY } = build;
  const bodyR = 0.13 * (prop.age === 'kid' ? 0.9 : 1);

  const body: Part[] = [
    part(
      'torso',
      'cloth',
      {
        type: 'roundCone',
        a: [0, hipY + 0.02, 0],
        b: [0, shoulderY - 0.02, 0],
        ra: bodyR * 1.04,
        rb: bodyR * 0.92,
      },
      0,
      cloth(top),
    ),
  ];
  // Legs and shoes.
  for (const side of [-1, 1]) {
    const z = side * bodyR * 0.46;
    body.push(
      part(
        'leg',
        'cloth',
        {
          type: 'roundCone',
          a: [0, hipY + 0.01, z],
          b: [0.005, 0.05, z * 1.08],
          ra: 0.052,
          rb: 0.046,
        },
        0.035,
        cloth(bottom),
      ),
      part(
        'shoe',
        'cloth',
        { type: 'ellipsoid', c: [0.03, 0.034, z * 1.1], r: [0.068, 0.036, 0.048] },
        0.02,
        glossy(shoe, { rough: 0.35, spec: 0.5 }),
      ),
    );
  }
  // Arms: relaxed (idle), a wave with the near arm (happy) or both arms up (action).
  const arms: { side: number; hand: Vec3 }[] = [
    { side: -1, hand: [0.04, hipY + 0.05, -bodyR * 1.45] },
    { side: 1, hand: [0.04, hipY + 0.05, bodyR * 1.45] },
  ];
  if (pose === 'happy' && arms[0]) arms[0].hand = [0.05, shoulderY + 0.22, -bodyR * 2.1];
  if (pose === 'action') {
    for (const arm of arms) arm.hand = [0.03, shoulderY + 0.26, arm.side * bodyR * 1.95];
  }
  for (const arm of arms) {
    const shoulder: Vec3 = [0, shoulderY - 0.035, arm.side * bodyR * 0.95];
    body.push(
      part(
        'arm',
        'cloth',
        { type: 'roundCone', a: shoulder, b: arm.hand, ra: 0.046, rb: 0.04 },
        0.03,
        cloth(top),
      ),
      part('hand', 'paw', { type: 'sphere', c: arm.hand, r: 0.047 }, 0.012, skinS),
    );
  }
  // Belt line and outfit details (the lower torso is the "bottom" color).
  const bodyPaints = [
    `if (abs(mg.tag - 24.0) < 0.5 && mg.kind < 0.5) {
      paintMix(mg, ${glColor(bottom)}, smoothstep(${glf(hipY + 0.07)}, ${glf(hipY + 0.055)}, q.y));
    }`,
  ];
  if (prop.age === 'elder') {
    // Cardigan buttons down the front.
    bodyPaints.push(`if (abs(mg.tag - 24.0) < 0.5 && q.x > 0.0) {
      float bt = 0.0;
      for (int i = 0; i < 3; i++) {
        vec2 bp = vec2(q.z, q.y - ${glf(hipY + 0.1)} - float(i) * 0.06);
        bt = max(bt, fillMask(length(bp) - 0.012, 0.003));
      }
      paintMix(mg, ${glColor(accent)}, bt * smoothstep(0.5, 0.8, qn.x));
    }`);
  }
  const groups: Group[] = [makeGroup('body', 'body', false, 0, body, bodyPaints)];

  // Neckerchief (ranger) or scarf collar in the accent color.
  const neckY = shoulderY + 0.005;
  if (prop.hat === 'ranger' || prop.age !== 'elder') {
    groups.push(
      makeGroup('scarf', 'body', false, 0.02, [
        part(
          'scarf',
          'cloth',
          { type: 'torus', c: [0, neckY, 0], rot: IDENTITY, R: bodyR * 0.62, r: 0.032 },
          0,
          cloth(accent),
        ),
        leafPart(
          'knot',
          'cloth',
          [bodyR * 0.62, neckY - 0.01, 0],
          [0.25, -1, 0],
          [1, 0, 0],
          0.09,
          0.05,
          0.012,
          0.4,
          0.1,
          0.02,
          cloth(accent),
        ),
      ]),
    );
  }

  // ---- Head ----
  const headCenter: Vec3 = [0, shoulderY + R * 0.9, 0];
  const skull: Vec3 = [R * 0.97, R * 0.93, R];
  const headParts: Part[] = [
    part('skull', 'head', { type: 'ellipsoid', c: [0, 0, 0], r: skull }, 0, skinS),
    part(
      'nose',
      'muzzle',
      { type: 'sphere', c: [R * 0.95, -R * 0.12, 0], r: R * 0.075 },
      0.02,
      fur(mixRgb(skin, BLUSH, 0.15), { sss: 0.75 }),
    ),
  ];
  // Little round ears (the head group is mirrored, so one makes a pair).
  headParts.push(
    part('ear', 'cheek', { type: 'sphere', c: [0, -R * 0.08, R * 0.95], r: R * 0.16 }, 0.03, skinS),
  );
  const eyeDir = dirYawPitch(deg(24), deg(2));
  const eyeSurf = onEllipsoid(skull, eyeDir);
  const eyeN = ellipsoidNormal(skull, eyeSurf);
  const eyeSize = R * (prop.age === 'kid' ? 0.15 : 0.13);
  const eyeR: Vec3 = [eyeSize * 0.5, eyeSize, eyeSize * 0.78];
  const eyeC = sub(eyeSurf, scale(eyeN, eyeR[0] * 0.35));
  const ink = mixRgb(hair, [0.04, 0.03, 0.05], 0.7);
  const eye: EyeSpec = {
    c: eyeC,
    r: eyeR,
    rot: frameAlongX(eyeN, [0, 1, 0]),
    style: 0,
    base: [0.03, 0.025, 0.04],
    iris: mixRgb([0.03, 0.025, 0.04], hair, 0.4),
    lid: skin,
  };
  const open = pose !== 'idle';
  const headPaints = [
    paintMouth({
      kind: open ? 'wideOpen' : 'wide',
      y: -R * 0.36,
      noseY: Number.NaN,
      width: R * (open ? 0.24 : 0.2),
      minX: R * 0.55,
      line: R * 0.03,
      lineColor: ink,
      inside: MOUTH_INSIDE,
      tongue: TONGUE,
    }),
    paintBlush(BLUSH, onEllipsoid(skull, dirYawPitch(deg(40), deg(-22))), R * 0.2, 0.5),
    // Brows: short soft strokes above the eyes, in the hair color.
    `if (mg.kind < 0.5 && abs(mg.tag - 2.0) < 0.5) {
      vec2 fp = vec2(q.z, q.y);
      float br = sdSegment2(fp, vec2(${glf(eyeC[2] - R * 0.1)}, ${glf(eyeC[1] + R * 0.2)}), vec2(${glf(eyeC[2] + R * 0.1)}, ${glf(eyeC[1] + R * (open ? 0.25 : 0.22))}));
      paintMix(mg, ${glColor(mixRgb(hair, ink, 0.3))}, fillMask(br - ${glf(R * 0.028)}, ${glf(R * 0.012)}) * smoothstep(0.2, 0.45, qn.x));
    }`,
  ];
  groups.push(
    makeGroup('head', 'head', true, 0.06, headParts, headPaints),
    makeGroup(
      'eyes',
      'head',
      true,
      0,
      [
        part('eye', 'eye', { type: 'ellipsoid', c: eyeC, r: eyeR, rot: eye.rot }, 0, {
          kind: 'eye',
          color: eye.base,
        }),
      ],
      [paintEye(eye)],
    ),
  );
  const hairGroup = buildHair(prop, R, skull, hair);
  if (hairGroup) groups.push(hairGroup);
  const hat = buildHat(prop, R, hexToLinear(prop.hair), accent, top);
  if (hat) groups.push(hat);
  if (prop.glasses) groups.push(buildGlasses(R, eyeC, eyeSize, ink));

  const headPose =
    pose === 'idle'
      ? { yaw: deg(30), pitch: deg(2), roll: deg(-6) }
      : pose === 'happy'
        ? { yaw: deg(32), pitch: deg(8), roll: deg(9) }
        : { yaw: deg(28), pitch: deg(12), roll: deg(-4) };
  return sceneOf(propKey(prop, pose), groups, [], { headCenter, headPose, headRadius: R });
}

/** Hair: a shell over the skull with the face cut out, plus the style's own shapes. */
function buildHair(prop: PropOf<'folk'>, R: number, skull: Vec3, color: Rgb): Group | null {
  const s = fur(color, { sss: 0.4, rough: 0.45, spec: 0.35 });
  const parts: Part[] = [];
  const shell = (drop: number): Part =>
    part(
      'shell',
      'hair',
      {
        type: 'ellipsoid',
        c: [-R * 0.06, R * (0.1 - drop * 0.1), 0],
        r: [skull[0] * 1.08, skull[1] * (1.05 + drop * 0.12), skull[2] * 1.08],
      },
      0,
      s,
    );
  // The carve removes the shell over the face (a big sphere in front, low).
  const faceCut = (y: number): Part =>
    part(
      'face',
      'hair',
      { type: 'sphere', c: [R * 1.05, y, 0], r: R * 1.02 },
      R * 0.08,
      s,
      'carve',
    );
  const underCut = (y: number): Part =>
    part(
      'under',
      'hair',
      { type: 'sphere', c: [0, y - R * 1.5, 0], r: R * 1.5 },
      R * 0.06,
      s,
      'carve',
    );
  switch (prop.hairStyle) {
    case 'short':
      parts.push(shell(0), faceCut(-R * 0.18), underCut(R * 0.08));
      break;
    case 'bob':
      parts.push(shell(0.6), faceCut(-R * 0.3), underCut(-R * 0.42));
      break;
    case 'bun':
      parts.push(
        shell(0.1),
        faceCut(-R * 0.2),
        underCut(R * 0.02),
        part(
          'bun',
          'hair',
          { type: 'sphere', c: [-R * 0.45, R * 0.92, 0], r: R * 0.36 },
          R * 0.12,
          s,
        ),
      );
      break;
    case 'spiky':
      parts.push(shell(0), faceCut(-R * 0.12), underCut(R * 0.12));
      for (let i = 0; i < 5; i++) {
        const a = deg(-40 + i * 32);
        const base: Vec3 = [
          Math.cos(a + deg(90)) * R * 0.2 - R * 0.15,
          R * 0.75,
          Math.sin(a) * R * 0.45,
        ];
        parts.push(
          leafPart(
            `spike${i}`,
            'hair',
            base,
            [-0.3, 1, Math.sin(a) * 0.6],
            [1, 0, 0],
            R * 0.55,
            R * 0.2,
            R * 0.03,
            0.8,
            -0.2,
            R * 0.08,
            s,
          ),
        );
      }
      break;
    case 'tufts':
      // Balding elder: fluffy tufts over the ears and a wisp at the back.
      for (const [x, y, z, r] of [
        [-R * 0.15, R * 0.25, R * 0.82, R * 0.3],
        [-R * 0.5, R * 0.3, R * 0.62, R * 0.32],
        [-R * 0.72, R * 0.1, R * 0.3, R * 0.3],
      ] as const) {
        parts.push(part('tuft', 'hair', { type: 'sphere', c: [x, y, z], r }, R * 0.12, s));
      }
      break;
  }
  if (parts.length === 0) return null;
  return makeGroup('hair', 'head', true, R * 0.03, parts);
}

function buildHat(
  prop: PropOf<'folk'>,
  R: number,
  _hair: Rgb,
  accent: Rgb,
  top: Rgb,
): Group | null {
  if (prop.hat === 'none') return null;
  const felt = fur(mixRgb(top, [0.72, 0.6, 0.38], 0.55), { sss: 0.3, rough: 0.78, spec: 0.1 });
  if (prop.hat === 'ranger') {
    const tilt = frameAlongY([-0.12, 1, 0], [1, 0, 0]);
    return makeGroup('hat', 'head', false, R * 0.02, [
      part(
        'brim',
        'cloth',
        {
          type: 'cylinder',
          c: [0, R * 0.62, 0],
          rot: tilt,
          r: R * 1.32,
          h: R * 0.045,
          round: R * 0.04,
        },
        0,
        felt,
      ),
      part(
        'crown',
        'cloth',
        {
          type: 'cylinder',
          c: [-R * 0.03, R * 0.9, 0],
          rot: tilt,
          r: R * 0.74,
          h: R * 0.28,
          round: R * 0.22,
        },
        R * 0.06,
        felt,
      ),
      // A pinched "dent" on top of the crown.
      part(
        'dent',
        'cloth',
        { type: 'ellipsoid', c: [-R * 0.06, R * 1.22, 0], r: [R * 0.5, R * 0.12, R * 0.16] },
        R * 0.06,
        felt,
        'carve',
      ),
      part(
        'band',
        'cloth',
        { type: 'torus', c: [-R * 0.02, R * 0.72, 0], rot: tilt, R: R * 0.75, r: R * 0.07 },
        R * 0.02,
        fur(accent, { rough: 0.6 }),
      ),
    ]);
  }
  return makeGroup('hat', 'head', false, R * 0.02, [
    part(
      'dome',
      'cloth',
      { type: 'ellipsoid', c: [-R * 0.05, R * 0.38, 0], r: [R * 1.02, R * 0.7, R * 1.04] },
      0,
      fur(accent, { rough: 0.7 }),
    ),
    part(
      'cut',
      'cloth',
      { type: 'sphere', c: [0, -R * 0.45, 0], r: R * 1.0 },
      R * 0.04,
      fur(accent),
      'carve',
    ),
    part(
      'visor',
      'cloth',
      { type: 'ellipsoid', c: [R * 0.9, R * 0.42, 0], r: [R * 0.55, R * 0.06, R * 0.62] },
      R * 0.05,
      fur(accent, { rough: 0.7 }),
    ),
  ]);
}

/** Round reading glasses: two rings in front of the eyes and a bridge. */
function buildGlasses(R: number, eyeC: Vec3, eyeSize: number, color: Rgb): Group {
  const metal = glossy(mixRgb(color, [0.85, 0.7, 0.35], 0.5), { rough: 0.25, spec: 0.8 });
  const c: Vec3 = [eyeC[0] + R * 0.12, eyeC[1], eyeC[2] * 0.92];
  return makeGroup('glasses', 'head', true, 0, [
    part(
      'rim',
      'prop',
      { type: 'torus', c, rot: upAlong(normalize([1, 0, 0.35])), R: eyeSize * 1.55, r: R * 0.028 },
      0,
      metal,
    ),
    part(
      'bridge',
      'prop',
      {
        type: 'roundCone',
        a: [c[0] + R * 0.02, c[1] + R * 0.02, c[2] - eyeSize * 1.5],
        b: [c[0] + R * 0.05, c[1] + R * 0.03, 0],
        ra: R * 0.022,
        rb: R * 0.022,
      },
      R * 0.01,
      metal,
    ),
    part(
      'arm',
      'prop',
      {
        type: 'roundCone',
        a: [c[0] - R * 0.05, c[1] + R * 0.02, c[2] + eyeSize * 1.45],
        b: [-R * 0.2, c[1] + R * 0.06, R * 0.98],
        ra: R * 0.02,
        rb: R * 0.02,
      },
      R * 0.01,
      metal,
    ),
  ]);
}

// ---- Entry point ----------------------------------------------------------------------------------

const cache = new Map<string, CreatureScene>();

/** Compiles (and memoizes) the scene for a tactic prop in a pose. */
export function propToScene(prop: ArtProp, pose: ArtPose = 'idle'): CreatureScene {
  const key = propKey(prop, pose);
  const cached = cache.get(key);
  if (cached) return cached;
  let scene: CreatureScene;
  switch (prop.kind) {
    case 'potion':
      scene = buildPotion(prop, pose);
      break;
    case 'charm':
      scene = buildCharm(prop, pose);
      break;
    case 'lantern':
      scene = buildLantern(prop, pose);
      break;
    case 'folk':
      scene = buildFolk(prop, pose);
      break;
  }
  cache.set(key, scene);
  return scene;
}

/** Arenas: nothing on the knoll, just the biome. */
export const SCENERY_SCENE: CreatureScene = sceneOf('scenery1', [], []);
