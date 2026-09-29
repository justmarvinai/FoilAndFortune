import { knot, Path, type Pt } from '../core/path';
import { createRng } from '../core/rng';
import { bolt, sparkle } from '../core/shapes';
import { el, type Ids } from '../core/svg';
import {
  contactShadow,
  flatForm,
  glow,
  gradientRect,
  grassTuft,
  hillPath,
  puffCloud,
  type Stop,
  starField,
  vignette,
} from './common';
import type { SceneFrame } from './index';

/** Volt biome: golden grass hills under violet storm clouds, lightning glinting far away. */

interface MeadowPalette {
  sky: readonly Stop[];
  storm: string;
  stormShade: string;
  stormLight: string;
  cloud: string;
  cloudShade: string;
  far: string;
  farLight: string;
  mid: string;
  midShade: string;
  near: string;
  nearShade: string;
  nearLight: string;
  grass: string;
  bolt: string;
  glint: string;
  flower: string;
  shadow: string;
  stars: boolean;
}

const PALETTES: Record<SceneFrame['timeOfDay'], MeadowPalette> = {
  day: {
    sky: [
      [0, '#8494E8'],
      [0.55, '#BAC4F4'],
      [1, '#FFF0D2'],
    ],
    storm: '#9486DA',
    stormShade: '#7668C2',
    stormLight: '#C2B8F4',
    cloud: '#F6F3FF',
    cloudShade: '#D6D0F4',
    far: '#E3D6A4',
    farLight: '#F2E8BE',
    mid: '#E4C95E',
    midShade: '#C8A948',
    near: '#D2B14E',
    nearShade: '#B0903C',
    nearLight: '#E8CD6E',
    grass: '#A8873A',
    bolt: '#FFF6B8',
    glint: '#FFF6C8',
    flower: '#FFFFFF',
    shadow: '#4A3A1C',
    stars: false,
  },
  dusk: {
    sky: [
      [0, '#3F2E78'],
      [0.45, '#9A4F8E'],
      [0.8, '#EE8A6E'],
      [1, '#FFC690'],
    ],
    storm: '#5E4290',
    stormShade: '#452F72',
    stormLight: '#B06FA8',
    cloud: '#D58FAE',
    cloudShade: '#A46A9C',
    far: '#A77380',
    farLight: '#C98E8E',
    mid: '#B8864F',
    midShade: '#94673C',
    near: '#8C6538',
    nearShade: '#6C4B2B',
    nearLight: '#B2834A',
    grass: '#5E4226',
    bolt: '#FFE2A6',
    glint: '#FFD9A0',
    flower: '#FFE0C8',
    shadow: '#2A1422',
    stars: false,
  },
  night: {
    sky: [
      [0, '#0C1030'],
      [0.6, '#212864'],
      [1, '#3A3B82'],
    ],
    storm: '#2E2D6A',
    stormShade: '#1F1E50',
    stormLight: '#5B6CC2',
    cloud: '#3B3F80',
    cloudShade: '#2A2C62',
    far: '#2F3766',
    farLight: '#46508A',
    mid: '#4A4D6A',
    midShade: '#383A56',
    near: '#3A3D55',
    nearShade: '#2B2D42',
    nearLight: '#555B86',
    grass: '#262838',
    bolt: '#C8F6FF',
    glint: '#BFF1FF',
    flower: '#C8D2FF',
    shadow: '#05060F',
    stars: true,
  },
};

function lightning(from: Pt, to: Pt, width: number, rng: ReturnType<typeof createRng>): Path {
  const pts: Pt[] = [from];
  const segs = 4;
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const jitter = (i % 2 === 0 ? 1 : -1) * width * rng.range(1.2, 2.2);
    pts.push([from[0] + (to[0] - from[0]) * t + jitter, from[1] + (to[1] - from[1]) * t]);
  }
  pts.push(to);
  return bolt(
    pts,
    pts.map((_, i) => width * (1 - i / pts.length)),
  );
}

export function stormMeadow(ids: Ids, f: SceneFrame): string {
  const rng = createRng(f.seed).fork('storm-meadow');
  const pal = PALETTES[f.timeOfDay];
  const { width: W, height: H, px } = f;
  const full = f.composition === 'fullArt';
  const hz = H * (full ? 0.6 : 0.58);
  const out: string[] = [gradientRect(ids, 0, 0, W, hz + H * 0.1, pal.sky)];
  if (pal.stars) out.push(starField(rng, 0, 0, W, hz * 0.85, full ? 60 : 44, px));
  // High fluffy clouds in the corners, clear of the creature's head.
  const corners: Pt[] = full
    ? [
        [W * 0.16, H * 0.14],
        [W * 0.86, H * 0.24],
      ]
    : [
        [W * 0.12, H * 0.2],
        [W * 0.9, H * 0.14],
      ];
  for (const c of corners) {
    const cw = W * rng.range(0.2, 0.26) * (full ? 1.3 : 1);
    out.push(
      puffCloud(
        ids,
        c,
        cw,
        cw * 0.34,
        rng,
        { base: pal.cloud, shade: pal.cloudShade, light: '#FFFFFF' },
        { puffs: 4 },
      ),
    );
  }
  // The storm: a violet cloud bank sitting on the horizon, towering higher in full art.
  // The bank floats above the horizon so its lightning can be seen striking the far hills.
  const bankY = hz - H * (full ? 0.1 : 0.075);
  const bankCount = full ? 3 : 4;
  const bank: string[] = [];
  const strikeXs: number[] = [];
  for (let i = 0; i < bankCount; i++) {
    const cx = W * (-0.08 + (1.16 * (i + 0.5)) / bankCount) + rng.range(-0.03, 0.03) * W;
    const tall = full ? i !== 1 : i === 0 || i === bankCount - 1;
    const cw = W * rng.range(0.25, 0.31) * (full ? 1.35 : 1);
    const ch = cw * (tall ? 0.48 : 0.34);
    // Staggered bases, so the bank reads as separate storm cells rather than a wall.
    const y = bankY + H * (tall ? -0.02 : 0.03) + rng.range(-0.012, 0.012) * H;
    bank.push(
      puffCloud(
        ids,
        [cx, y],
        cw,
        ch,
        rng,
        { base: pal.storm, shade: pal.stormShade, light: pal.stormLight },
        { puffs: tall ? 5 : 4 },
      ),
    );
    if (tall)
      strikeXs.push(Math.min(W * 0.85, Math.max(W * 0.15, cx + cw * (cx < W / 2 ? 0.25 : -0.25))));
  }
  // Lightning forks from under the bank down to the far hills (drawn first: hills cover the end).
  for (const x of strikeXs.slice(0, full ? 2 : 1)) {
    const from: Pt = [x, bankY - H * 0.03];
    const to: Pt = [x + W * rng.range(-0.04, 0.04), hz + H * 0.04];
    out.push(
      glow(
        ids,
        [x, (from[1] + to[1]) / 2],
        H * 0.14,
        pal.bolt,
        f.timeOfDay === 'night' ? 0.65 : 0.5,
      ),
    );
    out.push(el('path', { d: lightning(from, to, 6.5 * px, rng).toString(), fill: pal.bolt }));
  }
  out.push(...bank);
  // Glints twinkling in the sky.
  for (let i = 0; i < (full ? 6 : 4); i++) {
    const p: Pt = [W * rng.range(0.05, 0.95), hz * rng.range(0.1, 0.8)];
    if (p[0] > f.creature.x0 && p[0] < f.creature.x1 && p[1] > f.creature.y0) continue;
    out.push(
      el('path', {
        d: sparkle(p, rng.range(4, 7) * px, { inner: 0.24 }).toString(),
        fill: pal.glint,
        opacity: 0.9,
      }),
    );
  }
  // Hills: far (hazy), mid (golden), near (the ground the creature stands on).
  const far = hillPath(W, hz + H * 0.02, H * 0.06, 2, H, rng);
  out.push(flatForm(ids, far, pal.far, { light: pal.farLight, lightDepth: H * 0.012 }));
  const mid = hillPath(W, hz + H * 0.1, H * 0.06, 2, H, rng, 1);
  out.push(
    flatForm(ids, mid, pal.mid, {
      shade: pal.midShade,
      shadeDepth: H * 0.03,
      light: pal.nearLight,
      lightDepth: H * 0.01,
    }),
  );
  for (let i = 0; i < 7; i++) {
    const x = W * (0.05 + 0.9 * rng.next());
    const y = hz + H * (0.1 + rng.range(0.02, 0.07));
    out.push(
      el('path', {
        d: grassTuft([x, y], H * 0.025, 3, rng.range(-0.4, 0.4), rng).toString(),
        fill: pal.midShade,
      }),
    );
  }
  const g = f.groundY;
  const near = Path.smooth([
    knot([-W * 0.1, H * 1.1], 0),
    [-W * 0.1, g - H * 0.05],
    [W * 0.3, g - H * 0.085],
    [W * 0.7, g - H * 0.075],
    [W * 1.1, g - H * 0.03],
    knot([W * 1.1, H * 1.1], 0),
  ]);
  out.push(
    flatForm(ids, near, pal.near, {
      shade: pal.nearShade,
      shadeDepth: H * 0.02,
      light: pal.nearLight,
      lightDepth: H * 0.012,
    }),
  );
  // Meadow dots and grass on the near ground.
  for (let i = 0; i < (full ? 16 : 12); i++) {
    const x = W * rng.next();
    const y = g - H * 0.06 + H * rng.range(0, 0.14);
    if (x > f.creature.x0 && x < f.creature.x1 && y < g + H * 0.02) continue;
    out.push(
      el('circle', { cx: x, cy: y, r: rng.range(1.4, 2.4) * px, fill: pal.flower, opacity: 0.85 }),
    );
  }
  const tufts: Pt[] = [
    [W * 0.05, H * 0.99],
    [W * 0.14, H * 1.0],
    [W * 0.9, H * 0.99],
    [W * 0.97, H * 1.0],
  ];
  for (const t of tufts) {
    out.push(
      el('path', {
        d: grassTuft(t, H * (full ? 0.08 : 0.1), 4, t[0] < W / 2 ? 0.5 : -0.5, rng).toString(),
        fill: pal.grass,
      }),
    );
  }
  const cw = f.creature.x1 - f.creature.x0;
  out.push(
    contactShadow(
      ids,
      (f.creature.x0 + f.creature.x1) / 2,
      g,
      cw * 0.9,
      H * 0.07,
      pal.shadow,
      0.35,
    ),
  );
  if (full || f.timeOfDay !== 'day') out.push(vignette(ids, W, H, pal.shadow, full ? 0.35 : 0.25));
  return out.join('');
}
