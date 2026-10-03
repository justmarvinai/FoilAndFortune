import type { GenomeExtra } from '@/content/schema/genome';
import { mixRgb, type Rgb, scaleRgb } from '../color';
import { add, deg, dirYawPitch, glf, lerp3, mirrorZ, normalize, scale, type Vec3 } from '../math';
import {
  emissive,
  finSurface,
  fur,
  glColor,
  glossy,
  leafPart,
  makeGroup,
  onEllipsoid,
  part,
} from './kit';
import type { Emitter, Group, Part } from './types';

/**
 * Species features beyond the basic head/body/tail (docs/04 §6): horns, antlers, face masks,
 * manes, an armadillo shell and shoulder wings. Builders take resolved colors and the few body
 * measurements they attach to, and return plain groups (see kit.ts). Head features are authored
 * in head coordinates (+x = face direction) on the +z side of mirrored groups.
 */

type Extra<K extends GenomeExtra['kind']> = Extract<GenomeExtra, { kind: K }>;

const WHITE: Rgb = [1, 1, 1];

/** A glowing surface ramp toward a part's tip (leaves ramp along their height). */
function tipGlow(base: Rgb, glow: Rgb, strength: number, from = 0.45): Part['surface'] {
  return fur(base, {
    rough: 0.35,
    spec: 0.5,
    sss: 0.35,
    ramp: { color: mixRgb(glow, WHITE, 0.2), emit: scaleRgb(glow, strength), from, to: 1 },
  });
}

/** The flame look shared by manes and bird plumes: a hot core cooling to the element color. */
export function flameSurface(core: Rgb, edge: Rgb, fx: number, from = 0.15): Part['surface'] {
  const hot = mixRgb(core, WHITE, 0.12);
  const tip = mixRgb(edge, [1, 0.12, 0.02], 0.3);
  return emissive(scaleRgb(hot, 0.35), scaleRgb(hot, 1.35 * fx), {
    ramp: { color: scaleRgb(tip, 0.35), emit: scaleRgb(tip, 1.15 * fx), from, to: 0.9 },
  });
}

// ---- Head features --------------------------------------------------------------------------------

/** Horns sweeping back over the head (or short nubs). */
export function buildHorns(extra: Extra<'horns'>, color: Rgb, R: number, skullR: Vec3): Group {
  const base = scale(onEllipsoid(skullR, dirYawPitch(deg(34), deg(50))), 0.9);
  const swept = extra.shape === 'swept';
  const h = R * (swept ? 0.5 + 0.6 * extra.size : 0.22 + 0.2 * extra.size);
  const surface = glossy(mixRgb(color, [0.02, 0.01, 0.02], 0.2), {
    rough: 0.32,
    spec: 0.45,
    sss: 0.15,
    ramp: { color: mixRgb(color, WHITE, 0.55), from: 0.55, to: 1 },
  });
  return makeGroup('horns', 'head', true, R * 0.05, [
    leafPart(
      'horn',
      'horn',
      base,
      swept ? [-0.5, 1, 0.3] : [0.1, 1, 0.25],
      [-1, 0, 0],
      h,
      R * 0.14,
      R * (swept ? 0.022 : 0.06),
      0.85,
      swept ? 0.5 : 0.12,
      0,
      surface,
    ),
  ]);
}

/** Antlers: zig-zag lightning (`bolt`) or tined (`branch`). Glowing tips cast light. */
export function buildAntlers(
  extra: Extra<'antlers'>,
  color: Rgb,
  glow: Rgb,
  R: number,
  skullR: Vec3,
  fx: number,
): { group: Group; emitters: Emitter[] } {
  const s = R * (1.15 + 0.9 * extra.size);
  const p0 = scale(onEllipsoid(skullR, dirYawPitch(deg(52), deg(60))), 0.9);
  const solid = fur(color, { rough: 0.38, spec: 0.45, sss: 0.3 });
  const lit = extra.glow ? tipGlow(color, glow, 1.1 * fx) : solid;
  const parts: Part[] = [];
  const seg = (
    name: string,
    a: Vec3,
    b: Vec3,
    ra: number,
    rb: number,
    surface: Part['surface'],
  ) => {
    const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    parts.push(
      leafPart(
        name,
        'horn',
        a,
        d,
        [1, 0, 0],
        len,
        ra,
        rb,
        1,
        0,
        parts.length ? R * 0.015 : 0,
        surface,
      ),
    );
  };
  const tips: Vec3[] = [];
  if (extra.shape === 'bolt') {
    const p1 = add(p0, scale([-0.06, 0.42, 0.2], s));
    const p2 = add(p1, scale([0.24, 0.15, 0.07], s));
    const p3 = add(p2, scale([-0.1, 0.48, 0.2], s));
    const t1 = add(p2, scale([-0.3, 0.22, 0.1], s));
    seg('beam0', p0, p1, R * 0.13, R * 0.1, solid);
    seg('beam1', p1, p2, R * 0.1, R * 0.09, solid);
    seg('beam2', p2, p3, R * 0.09, R * 0.035, lit);
    seg('tine', add(p2, scale([-0.02, 0.02, 0], s)), t1, R * 0.075, R * 0.028, lit);
    tips.push(p3, t1);
  } else {
    const p1 = add(p0, scale([-0.22, 0.42, 0.26], s));
    const p2 = add(p1, scale([-0.12, 0.42, 0.1], s));
    seg('beam0', p0, p1, R * 0.08, R * 0.06, solid);
    seg('beam1', p1, p2, R * 0.06, R * 0.03, lit);
    const t1 = add(p1, scale([0.28, 0.3, 0.02], s));
    const t2 = add(lerp3(p1, p2, 0.55), scale([0.24, 0.24, 0.04], s));
    seg('tineA', add(p0, scale([-0.1, 0.2, 0.12], s)), t1, R * 0.05, R * 0.02, lit);
    seg('tineB', lerp3(p1, p2, 0.45), t2, R * 0.045, R * 0.018, lit);
    tips.push(p2, t1);
  }
  const emitters: Emitter[] = extra.glow
    ? tips.slice(0, 1).flatMap((tip) => [
        // The near-side antler (the viewer sees body −z) and its mirror twin.
        {
          frame: 'head',
          pos: mirrorZ(tip),
          color: glow,
          radius: 0.1,
          intensity: 0.5 * fx,
          light: 0.35,
        },
      ])
    : [];
  return { group: makeGroup('antlers', 'head', true, R * 0.04, parts), emitters };
}

/** Face mask paint: a bandit band across the eyes, or round panda patches around them. */
export function paintMask(
  extra: Extra<'mask'>,
  color: Rgb,
  R: number,
  eye: { c: Vec3; size: number },
): string {
  const [, ey, ez] = eye.c;
  const e = eye.size;
  const guard = 'mg.kind < 0.5 && (abs(mg.tag - 2.0) < 0.5 || abs(mg.tag - 4.0) < 0.5)';
  const front = `smoothstep(${glf(-0.15 * R)}, ${glf(0.3 * R)}, q.x)`;
  if (extra.shape === 'patches') {
    // Tilted ovals, a little lower and wider than the eyes.
    return `if (${guard}) {
    vec2 pp = vec2(q.z - ${glf(ez + 0.12 * e)}, q.y - ${glf(ey - 0.15 * e)});
    pp = mat2(0.906, 0.423, -0.423, 0.906) * pp;
    float dm = (length(pp / vec2(${glf(1.4 * e)}, ${glf(1.7 * e)})) - 1.0) * ${glf(e)};
    paintMix(mg, ${glColor(color)}, fillMask(dm, ${glf(0.12 * e)}) * ${front});
  }`;
  }
  // Bandit: a band from beside the nose bridge to past the eye, dipping at the outer end.
  return `if (${guard}) {
    float t = smoothstep(${glf(ez)}, ${glf(ez + 1.7 * e)}, q.z);
    float cy = ${glf(ey + 0.05 * e)} - t * ${glf(0.45 * e)};
    float hh = ${glf(1.08 * e)} * (1.0 - 0.3 * t);
    float dm = max(abs(q.y - cy) - hh, max(${glf(0.1 * R)} - q.z, q.z - ${glf(ez + 1.85 * e)}));
    paintMix(mg, ${glColor(color)}, fillMask(dm, ${glf(0.1 * e)}) * ${front});
  }`;
}

// ---- Body features --------------------------------------------------------------------------------

/** Where a mane attaches: from the back of the head down the nape to the shoulders (body frame). */
export interface NapeLine {
  from: Vec3;
  to: Vec3;
  /** Size reference (the head radius). */
  R: number;
}

/** Flame tongues or crackling spikes along the nape and around the neck. */
export function buildMane(
  extra: Extra<'mane'>,
  color: Rgb,
  tip: Rgb,
  nape: NapeLine,
  fx: number,
): { group: Group; emitters: Emitter[] } {
  const { R } = nape;
  const parts: Part[] = [];
  const flame = extra.style === 'flame';
  const surface = flame
    ? flameSurface(tip, color, fx)
    : fur(color, {
        rough: 0.4,
        spec: 0.4,
        sss: 0.5,
        ramp: { color: mixRgb(tip, WHITE, 0.3), emit: scaleRgb(tip, 1.3 * fx), from: 0.4, to: 1 },
      });
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const bump = Math.sin(Math.PI * (0.25 + 0.75 * t));
    const base = add(lerp3(nape.from, nape.to, t), [0, 0, R * (0.08 + 0.18 * bump)]);
    const axis: Vec3 = [-0.75 + 0.25 * t, 1, 0.3 + 0.2 * t];
    const h = R * (flame ? 0.62 + 0.3 * bump : 0.55 + 0.2 * bump);
    parts.push(
      leafPart(
        `tongue${i}`,
        'mane',
        base,
        axis,
        [-1, 0, 0],
        h,
        R * (flame ? 0.2 : 0.12),
        R * 0.012,
        flame ? 0.75 : 0.45,
        flame ? 0.45 : 0.25,
        R * 0.06,
        surface,
      ),
    );
  }
  // Two cheek tongues flaring back from the jaw line.
  const jaw = add(nape.from, [R * 0.55, -R * 0.55, R * 0.55]);
  parts.push(
    leafPart(
      'cheekA',
      'mane',
      jaw,
      [-1, 0.45, 0.55],
      [0, 1, 0],
      R * 0.55,
      R * 0.16,
      R * 0.012,
      0.6,
      0.3,
      R * 0.05,
      surface,
    ),
    leafPart(
      'cheekB',
      'mane',
      add(jaw, [-R * 0.25, -R * 0.2, 0]),
      [-1, 0.1, 0.5],
      [0, 1, 0],
      R * 0.45,
      R * 0.14,
      R * 0.012,
      0.6,
      0.2,
      R * 0.05,
      surface,
    ),
  );
  const mid = lerp3(nape.from, nape.to, 0.35);
  const emitters: Emitter[] = flame
    ? [
        {
          frame: 'body',
          pos: add(mid, [0, R * 0.5, -R * 0.2]),
          color: mixRgb(tip, color, 0.4),
          radius: 0.2,
          intensity: 0.6 * fx,
          light: 0.45,
        },
      ]
    : [];
  return { group: makeGroup('mane', 'body', true, R * 0.08, parts), emitters };
}

/** Body measurements the shell and wings attach to (quadruped body frame). */
export interface TorsoFrame {
  bodyL: number;
  bodyH: number;
  bodyW: number;
  bodyY: number;
  /** Chest drop and rump lift from the pose. */
  crouch: number;
  rumpLift: number;
}

/**
 * Armadillo shell: overlapping domed bands over the back, cut flat above the belly, with the
 * seams (and the lower rim) painted as glowing lava cracks when `glowSeams` is on.
 */
export function buildShell(extra: Extra<'shell'>, color: Rgb, seam: Rgb, t: TorsoFrame): Group {
  const { bodyL, bodyH, bodyW, bodyY } = t;
  const x0 = bodyL * 0.95;
  const x1 = -bodyL * 1.02;
  const n = extra.bands;
  const len = (x0 - x1) / n;
  const plate = glossy(color, { rough: 0.55, spec: 0.35, sss: 0.1 });
  const parts: Part[] = [];
  const seams: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 - len * (i + 0.5);
    const f = (x - x1) / (x0 - x1);
    // Follow the pose: the front sinks with the chest, the back rises with the rump.
    const dy = -t.crouch * f + t.rumpLift * (1 - f);
    const swell = 1 + 0.08 * Math.sin((Math.PI * (i + 0.5)) / n);
    parts.push(
      part(
        `band${i}`,
        'shell',
        {
          type: 'ellipsoid',
          c: [x, bodyY + bodyH * 0.18 + dy, 0],
          r: [len * 0.74, bodyH * 1.08 * swell, bodyW * 1.14 * swell],
        },
        i === 0 ? 0 : bodyH * 0.06,
        plate,
      ),
    );
    if (i > 0) seams.push(x0 - len * i);
  }
  const rimY = bodyY - bodyH * 0.58;
  parts.push(
    part(
      'belly-cut',
      'shell',
      { type: 'ellipsoid', c: [0, rimY - 2, 0], r: [4, 2, 4] },
      bodyH * 0.08,
      plate,
      'carve',
    ),
  );
  const glowAmt = extra.glowSeams ? 1 : 0;
  const lines = seams.map(
    (xb) => `sm = max(sm, 1.0 - smoothstep(0.003, 0.011, abs(q.x - ${glf(xb)})));`,
  );
  const paint = `if (abs(mg.tag - 17.0) < 0.5) {
    float sm = 0.0;
    ${lines.join('\n    ')}
    sm = max(sm, (1.0 - smoothstep(0.0, 0.03, q.y - ${glf(rimY)})) * 0.85);
    // Pitted basalt: faint mottling so the plates don't look like plastic.
    float pit = vnoise(q.xz * 60.0 + q.y * 17.0);
    mg.alb *= 0.9 + 0.2 * pit;
    mg.alb = mix(mg.alb, ${glColor(scaleRgb(seam, 0.55))}, sm * 0.8);
    mg.emit += ${glColor(scaleRgb(seam, 1.3 * glowAmt))} * sm;
  }`;
  return makeGroup('shell', 'body', false, bodyH * 0.05, parts, [paint]);
}

/** Small wings on the shoulders of a four-legged creature (a dragon's, or feathered ones). */
export function buildShoulderWings(
  extra: Extra<'wings'>,
  color: Rgb,
  tip: Rgb,
  t: TorsoFrame,
  fx: number,
): Group {
  const s = 0.75 + 0.7 * extra.size;
  const base: Vec3 = [t.bodyL * 0.22, t.bodyY + t.bodyH * 0.72 - t.crouch * 0.5, t.bodyW * 0.42];
  const normal = normalize([0.35, -0.36, 0.87]);
  const parts: Part[] = [];
  const bone = fur(mixRgb(color, [0.02, 0.01, 0.02], 0.25), { rough: 0.5, spec: 0.3 });
  const membrane =
    extra.style === 'flame'
      ? flameSurface(tip, color, fx, 0.35)
      : finSurface(color, { sss: 1, rough: 0.45, ramp: { color: tip, from: 0.55, to: 1 } });
  const fingers: [Vec3, number][] = [
    [[-0.35, 1, 0.55], 0.36],
    [[-0.8, 0.75, 0.55], 0.32],
    [[-1, 0.25, 0.5], 0.26],
  ];
  fingers.forEach(([axis, len], i) => {
    parts.push(
      leafPart(
        `finger${i}`,
        'wing',
        base,
        axis,
        normal,
        len * s * 0.62,
        0.022 * s,
        0.008 * s,
        0.7,
        0.12,
        i ? 0.01 : 0,
        bone,
      ),
    );
  });
  parts.push(
    leafPart(
      'membrane',
      'wing',
      add(base, [-0.02, 0.01, 0.005]),
      [-0.72, 0.72, 0.55],
      normal,
      0.3 * s * 0.62,
      0.12 * s * 0.62,
      0.035 * s * 0.62,
      0.16,
      0.25,
      0.015,
      membrane,
    ),
  );
  return makeGroup('wings', 'body', true, 0.02, parts);
}
