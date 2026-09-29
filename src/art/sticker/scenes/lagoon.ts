import { type Knot, knot, Path, type Pt } from '../core/path';
import { createRng } from '../core/rng';
import { sparkle, taper } from '../core/shapes';
import { el, type Ids } from '../core/svg';
import {
  contactShadow,
  flatForm,
  glow,
  gradientRect,
  gull,
  puffCloud,
  type Stop,
  starField,
  sunRays,
  vignette,
} from './common';
import type { SceneFrame } from './index';

/** Tide biome: turquoise lagoon, a warm sand bar, sun (or moon) and simple wave lines. */

interface LagoonPalette {
  sky: readonly Stop[];
  sun: string;
  sunGlow: string;
  cloud: string;
  cloudShade: string;
  island: string;
  islandShade: string;
  palm: string;
  water: readonly Stop[];
  wave: string;
  glint: string;
  sand: string;
  sandShade: string;
  sandLight: string;
  wet: string;
  foam: string;
  shell: string;
  shadow: string;
  stars: boolean;
  moon: boolean;
}

const PALETTES: Record<SceneFrame['timeOfDay'], LagoonPalette> = {
  day: {
    sky: [
      [0, '#58C2F0'],
      [0.6, '#A6E4F8'],
      [1, '#E8FAFF'],
    ],
    sun: '#FFF4B8',
    sunGlow: '#FFF1A8',
    cloud: '#FFFFFF',
    cloudShade: '#D4EEF8',
    island: '#3FA58C',
    islandShade: '#2F8A76',
    palm: '#2C7F6C',
    water: [
      [0, '#2AA7C4'],
      [0.5, '#34BFCB'],
      [1, '#5ED8D2'],
    ],
    wave: '#E8FFFF',
    glint: '#FFFFFF',
    sand: '#F5DCA6',
    sandShade: '#E3C184',
    sandLight: '#FFEDC6',
    wet: '#E2C489',
    foam: '#FFFFFF',
    shell: '#FF9FB2',
    shadow: '#2D4A55',
    stars: false,
    moon: false,
  },
  dusk: {
    sky: [
      [0, '#5A4FA8'],
      [0.5, '#E6868E'],
      [1, '#FFD19A'],
    ],
    sun: '#FFC27A',
    sunGlow: '#FF9C6A',
    cloud: '#F2A3A8',
    cloudShade: '#C77E98',
    island: '#6A4F7E',
    islandShade: '#57406C',
    palm: '#4E3A63',
    water: [
      [0, '#7E6AA8'],
      [0.5, '#B98AA6'],
      [1, '#E2A89A'],
    ],
    wave: '#FFE0C8',
    glint: '#FFE6B0',
    sand: '#E6B48E',
    sandShade: '#CC9674',
    sandLight: '#F4C9A2',
    wet: '#C99070',
    foam: '#FFEBDD',
    shell: '#FFD6C8',
    shadow: '#3A2034',
    stars: false,
    moon: false,
  },
  night: {
    sky: [
      [0, '#0A1636'],
      [0.6, '#16336A'],
      [1, '#27558A'],
    ],
    sun: '#F4F0D6',
    sunGlow: '#BFD8FF',
    cloud: '#34507E',
    cloudShade: '#263E68',
    island: '#15344A',
    islandShade: '#0F283A',
    palm: '#0E2536',
    water: [
      [0, '#0F3A5C'],
      [0.5, '#135271'],
      [1, '#1B6E84'],
    ],
    wave: '#9FD8F0',
    glint: '#E8F6FF',
    sand: '#8C8AA6',
    sandShade: '#72708C',
    sandLight: '#A6A4C0',
    wet: '#6C6A88',
    foam: '#CFE6FF',
    shell: '#C8B8E0',
    shadow: '#050A18',
    stars: true,
    moon: true,
  },
};

function palm(base: Pt, h: number): Path {
  const trunk = taper(
    [base, [base[0] + h * 0.08, base[1] - h * 0.5], [base[0] + h * 0.22, base[1] - h]],
    h * 0.09,
    { start: 1, end: 0.6, swell: 1 },
  );
  const crown: Pt = [base[0] + h * 0.22, base[1] - h];
  let fronds = trunk;
  for (const deg of [-160, -120, -60, -20, 20, 160]) {
    const a = (deg * Math.PI) / 180;
    const len = h * 0.5;
    const tip: Pt = [crown[0] + Math.cos(a) * len, crown[1] + Math.sin(a) * len * 0.6 + len * 0.25];
    const mid: Pt = [
      crown[0] + Math.cos(a) * len * 0.55,
      crown[1] + Math.sin(a) * len * 0.55 - len * 0.08,
    ];
    fronds = fronds.add(taper([crown, mid, tip], h * 0.14, { start: 0.3, end: 0, swell: 0.7 }));
  }
  return fronds;
}

export function lagoon(ids: Ids, f: SceneFrame): string {
  const rng = createRng(f.seed).fork('lagoon');
  const pal = PALETTES[f.timeOfDay];
  const { width: W, height: H, px } = f;
  const full = f.composition === 'fullArt';
  const hz = H * (full ? 0.54 : 0.5);
  const out: string[] = [gradientRect(ids, 0, 0, W, hz + 2, pal.sky)];
  if (pal.stars) out.push(starField(rng, 0, 0, W, hz * 0.9, full ? 55 : 40, px));
  // Sun/moon on the lit (left) side; low and big at dusk.
  const sunC: Pt =
    f.timeOfDay === 'dusk'
      ? [W * 0.2, hz - H * 0.05]
      : [W * (full ? 0.2 : 0.13), H * (full ? 0.13 : 0.17)];
  const sunR = W * (f.timeOfDay === 'dusk' ? 0.09 : full ? 0.075 : 0.055);
  if (full && !pal.moon) out.push(sunRays(sunC, H * 0.9, 14, pal.sun, 0.16, rng.range(0, 25)));
  out.push(glow(ids, sunC, sunR * 3.4, pal.sunGlow, pal.moon ? 0.35 : 0.6));
  out.push(
    el('circle', { cx: sunC[0], cy: sunC[1], r: sunR * 1.45, fill: pal.sun, opacity: 0.25 }),
  );
  if (pal.moon) {
    // Crescent: the disc minus an offset disc (even-odd, clipped to the moon).
    const moon = Path.circle(sunC[0], sunC[1], sunR);
    const bite = Path.circle(sunC[0] + sunR * 0.45, sunC[1] - sunR * 0.25, sunR * 0.85);
    const clipId = ids.next('moon');
    out.push(
      el('clipPath', { id: clipId }, el('path', { d: moon.toString() })) +
        el('path', {
          d: moon.add(bite).toString(),
          fill: pal.sun,
          'fill-rule': 'evenodd',
          'clip-path': `url(#${clipId})`,
        }),
    );
  } else {
    out.push(el('circle', { cx: sunC[0], cy: sunC[1], r: sunR, fill: pal.sun }));
  }
  // Fair-weather clouds on the right.
  const clouds: Pt[] = full
    ? [
        [W * 0.72, H * 0.12],
        [W * 0.9, H * 0.3],
      ]
    : [
        [W * 0.78, H * 0.13],
        [W * 0.95, H * 0.3],
      ];
  for (const c of clouds) {
    const cw = W * rng.range(0.18, 0.24) * (full ? 1.3 : 1);
    out.push(
      puffCloud(
        ids,
        c,
        cw,
        cw * 0.36,
        rng,
        { base: pal.cloud, shade: pal.cloudShade },
        { puffs: 4 },
      ),
    );
  }
  // A couple of gulls riding the breeze (full art has room for them).
  if (full && !pal.moon) {
    const gulls: Pt[] = [
      [W * 0.5, H * 0.2],
      [W * 0.58, H * 0.25],
    ];
    for (const g of gulls)
      out.push(
        el('path', { d: gull(g, W * 0.028, 2.2 * px).toString(), fill: pal.palm, opacity: 0.8 }),
      );
  }
  // Distant island with a palm.
  const ix = W * (full ? 0.82 : 0.86);
  const island = Path.smooth([
    knot([ix - W * 0.14, hz + 1], 0),
    [ix - W * 0.07, hz - H * 0.035],
    [ix + W * 0.03, hz - H * 0.045],
    knot([ix + W * 0.14, hz + 1], 0),
  ]);
  out.push(flatForm(ids, island, pal.island, { shade: pal.islandShade, shadeDepth: W * 0.03 }));
  out.push(
    el('path', {
      d: palm([ix - W * 0.01, hz - H * 0.04], H * (full ? 0.12 : 0.14)).toString(),
      fill: pal.palm,
    }),
  );
  // Water.
  const g = f.groundY;
  out.push(gradientRect(ids, 0, hz, W, H - hz, pal.water));
  // Sun glitter path on the water.
  for (let i = 0; i < 9; i++) {
    const y = hz + (g - hz) * (0.08 + 0.1 * i) * 0.9;
    const w = W * (0.02 + 0.012 * i) * rng.range(0.6, 1.2);
    const x = sunC[0] + rng.range(-0.03, 0.03) * W;
    out.push(
      el('path', {
        d: Path.ellipse(x, y, w, 1.4 * px + i * 0.2 * px).toString(),
        fill: pal.glint,
        opacity: 0.55,
      }),
    );
  }
  // Wave lines: short smiles scattered across the water, smaller toward the horizon.
  for (let i = 0; i < (full ? 16 : 12); i++) {
    const t = rng.next();
    const y = hz + (g - hz - H * 0.06) * (0.1 + 0.9 * t);
    const x = W * rng.range(0.02, 0.98);
    const w = W * (0.02 + 0.045 * t);
    const knots: Knot[] = [
      [x - w, y],
      [x - w * 0.5, y - w * 0.18],
      [x, y],
      [x + w * 0.5, y - w * 0.18],
      [x + w, y],
    ];
    out.push(
      el('path', {
        d: taper(knots, (1.2 + 1.6 * t) * px, { start: 0.2, end: 0.2 }).toString(),
        fill: pal.wave,
        opacity: 0.75,
      }),
    );
  }
  // Sand bar with a foamy wet edge.
  const sand = Path.smooth([
    knot([-W * 0.1, H * 1.1], 0),
    [-W * 0.1, g - H * 0.05],
    [W * 0.3, g - H * 0.1],
    [W * 0.72, g - H * 0.085],
    [W * 1.1, g - H * 0.04],
    knot([W * 1.1, H * 1.1], 0),
  ]);
  const wet = sand.translate(0, -H * 0.022);
  out.push(el('path', { d: wet.toString(), fill: pal.wet }));
  const foamKnots: Knot[] = [];
  for (let i = 0; i <= 12; i++) {
    const x = -W * 0.05 + (W * 1.1 * i) / 12;
    const y = g - H * (0.05 + 0.05 * Math.sin((i / 12) * Math.PI) ** 0.8) - H * 0.03;
    foamKnots.push([x, y + (i % 2 === 0 ? 0 : H * 0.006)]);
  }
  out.push(
    el('path', {
      d: taper(foamKnots, 3 * px, { start: 0.6, end: 0.6, swell: 0.4 }).toString(),
      fill: pal.foam,
      opacity: 0.9,
    }),
  );
  out.push(
    flatForm(ids, sand, pal.sand, {
      shade: pal.sandShade,
      shadeDepth: H * 0.022,
      light: pal.sandLight,
      lightDepth: H * 0.012,
    }),
  );
  // Sand specks, a starfish and a shell near the corners.
  for (let i = 0; i < 14; i++) {
    const x = W * rng.next();
    const y = g - H * 0.04 + H * rng.range(0, 0.12);
    out.push(
      el('circle', {
        cx: x,
        cy: y,
        r: rng.range(0.8, 1.6) * px,
        fill: pal.sandShade,
        opacity: 0.8,
      }),
    );
  }
  const star: Pt = [W * (full ? 0.12 : 0.08), H * (full ? 0.95 : 0.94)];
  out.push(
    el('path', {
      d: sparkle(star, H * 0.035, { points: 5, inner: 0.45 }).toString(),
      fill: pal.shell,
      transform: `rotate(-12 ${star[0].toFixed(1)} ${star[1].toFixed(1)})`,
    }),
  );
  const shell: Pt = [W * 0.92, H * 0.95];
  out.push(
    el('path', {
      d: Path.ellipse(shell[0], shell[1], H * 0.03, H * 0.022, -8).toString(),
      fill: pal.sandLight,
    }),
  );
  out.push(
    el('path', {
      d: taper(
        [
          [shell[0] - H * 0.018, shell[1]],
          [shell[0], shell[1] - H * 0.012],
          [shell[0] + H * 0.018, shell[1]],
        ],
        1.4 * px,
      ).toString(),
      fill: pal.sandShade,
    }),
  );
  const cw = f.creature.x1 - f.creature.x0;
  out.push(
    contactShadow(ids, (f.creature.x0 + f.creature.x1) / 2, g, cw * 0.9, H * 0.07, pal.shadow, 0.3),
  );
  if (full || f.timeOfDay !== 'day') out.push(vignette(ids, W, H, pal.shadow, full ? 0.3 : 0.22));
  return out.join('');
}
