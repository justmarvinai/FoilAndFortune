import { type Knot, knot, Path, type Pt } from '../core/path';
import { createRng } from '../core/rng';
import { taper } from '../core/shapes';
import { el, type Ids } from '../core/svg';
import {
  contactShadow,
  flatForm,
  glow,
  gradientRect,
  hillPath,
  puffCloud,
  type Stop,
  starField,
  vignette,
} from './common';
import type { SceneFrame } from './index';

/** Ember biome: a dawn sky over a stylized volcano, lava rivulets and drifting ember specks. */

interface VolcanoPalette {
  sky: readonly Stop[];
  sun: string;
  sunGlow: string;
  ridge: string;
  ridgeLight: string;
  cone: string;
  coneShade: string;
  coneLight: string;
  lava: string;
  lavaHot: string;
  smoke: string;
  smokeShade: string;
  mid: string;
  midShade: string;
  ground: string;
  groundShade: string;
  groundLight: string;
  crack: string;
  ember: string;
  shadow: string;
  stars: boolean;
}

const PALETTES: Record<SceneFrame['timeOfDay'], VolcanoPalette> = {
  day: {
    sky: [
      [0, '#8C6FC8'],
      [0.42, '#F09CB0'],
      [0.78, '#FFC894'],
      [1, '#FFE6B0'],
    ],
    sun: '#FFF3C4',
    sunGlow: '#FFE2A0',
    ridge: '#C98AA6',
    ridgeLight: '#E0A7B6',
    cone: '#7E4D6E',
    coneShade: '#643B59',
    coneLight: '#A76B84',
    lava: '#FF7A3D',
    lavaHot: '#FFD166',
    smoke: '#EBC6D2',
    smokeShade: '#CFA2B8',
    mid: '#9C5E72',
    midShade: '#7F4A60',
    ground: '#5E3A55',
    groundShade: '#4A2C45',
    groundLight: '#7C5070',
    crack: '#FF9A4D',
    ember: '#FFB24D',
    shadow: '#1E0E1C',
    stars: false,
  },
  dusk: {
    sky: [
      [0, '#3A1F5E'],
      [0.45, '#B23B5E'],
      [0.8, '#F2744E'],
      [1, '#FFB25E'],
    ],
    sun: '#FFD08A',
    sunGlow: '#FF9E5E',
    ridge: '#8A3E62',
    ridgeLight: '#B45470',
    cone: '#4A2743',
    coneShade: '#381C33',
    coneLight: '#74385A',
    lava: '#FF6A2E',
    lavaHot: '#FFD166',
    smoke: '#A55A78',
    smokeShade: '#7E4060',
    mid: '#62304F',
    midShade: '#4C243E',
    ground: '#3E2238',
    groundShade: '#2E1829',
    groundLight: '#5C3150',
    crack: '#FF8A3D',
    ember: '#FFA040',
    shadow: '#12060F',
    stars: false,
  },
  night: {
    sky: [
      [0, '#0F0A24'],
      [0.6, '#2A1540'],
      [1, '#4E1F45'],
    ],
    sun: '#FFE9B8',
    sunGlow: '#FF7A3D',
    ridge: '#2E1A3E',
    ridgeLight: '#4A2550',
    cone: '#241530',
    coneShade: '#1A0F24',
    coneLight: '#4A2146',
    lava: '#FF6A2E',
    lavaHot: '#FFE08A',
    smoke: '#4A2A4E',
    smokeShade: '#351D3A',
    mid: '#2B1A34',
    midShade: '#211428',
    ground: '#22152B',
    groundShade: '#170E1E',
    groundLight: '#3E2140',
    crack: '#FF7A3D',
    ember: '#FF9A40',
    shadow: '#05020A',
    stars: true,
  },
};

export function volcanoDawn(ids: Ids, f: SceneFrame): string {
  const rng = createRng(f.seed).fork('volcano-dawn');
  const pal = PALETTES[f.timeOfDay];
  const { width: W, height: H, px } = f;
  const full = f.composition === 'fullArt';
  const hz = H * (full ? 0.62 : 0.6);
  const out: string[] = [gradientRect(ids, 0, 0, W, hz + H * 0.1, pal.sky)];
  if (pal.stars) out.push(starField(rng, 0, 0, W, hz * 0.8, full ? 50 : 36, px));
  // Low sun (or, at night, the volcano's own glow) on the lit (left) side.
  const sunC: Pt = [W * (full ? 0.2 : 0.14), hz - H * (f.timeOfDay === 'dusk' ? 0.02 : 0.1)];
  const sunR = W * (full ? 0.11 : 0.07);
  if (f.timeOfDay !== 'night') {
    out.push(glow(ids, sunC, sunR * 3.2, pal.sunGlow, 0.55));
    out.push(el('circle', { cx: sunC[0], cy: sunC[1], r: sunR, fill: pal.sun }));
  } else {
    out.push(
      el('circle', { cx: W * 0.16, cy: H * 0.16, r: W * 0.035, fill: pal.sun, opacity: 0.9 }),
    );
  }
  // Distant pink ridge.
  out.push(
    flatForm(ids, hillPath(W, hz, H * 0.07, 3, H, rng), pal.ridge, {
      light: pal.ridgeLight,
      lightDepth: H * 0.01,
    }),
  );
  // The volcano: concave flanks, a notched crater, lit on the left.
  const vx = W * (full ? 0.66 : 0.76);
  const vw = W * (full ? 0.95 : 0.62);
  const top = hz - H * (full ? 0.36 : 0.3);
  const base = hz + H * 0.08;
  const crater = vw * 0.13;
  const cone = Path.smooth([
    knot([vx - vw * 0.5, base], 0),
    [vx - vw * 0.3, base - (base - top) * 0.25],
    [vx - crater * 1.5, top + (base - top) * 0.12],
    knot([vx - crater, top], 0.4),
    [vx - crater * 0.3, top + H * 0.018],
    [vx + crater * 0.4, top + H * 0.01],
    knot([vx + crater, top + H * 0.006], 0.4),
    [vx + crater * 1.6, top + (base - top) * 0.14],
    [vx + vw * 0.32, base - (base - top) * 0.25],
    knot([vx + vw * 0.5, base], 0),
  ]);
  // Smoke plume drifting away from the light.
  const puffs = full ? 5 : 4;
  for (let i = puffs - 1; i >= 0; i--) {
    const c: Pt = [vx + W * (0.02 + 0.045 * i), top - H * (0.015 + 0.075 * i)];
    const cw = W * (0.07 + 0.045 * i) * (full ? 1.3 : 1);
    out.push(
      puffCloud(
        ids,
        c,
        cw,
        cw * 0.62,
        rng,
        { base: pal.smoke, shade: pal.smokeShade },
        { puffs: 3, opacity: 1 - i * 0.12 },
      ),
    );
  }
  out.push(glow(ids, [vx, top], vw * 0.35, pal.lava, f.timeOfDay === 'night' ? 0.55 : 0.3));
  // Lava rivulets down the lit flank.
  const rivers: string[] = [];
  const riverCount = full ? 3 : 2;
  for (let i = 0; i < riverCount; i++) {
    const x0 = vx - crater * (0.6 - i * 0.55);
    const knots: Knot[] = [[x0, top + H * 0.012]];
    let x = x0;
    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      x += (i - 1) * vw * 0.04 + rng.range(-1, 1) * vw * 0.03;
      knots.push([x, top + ((base - top) * 0.75 * s) / steps]);
    }
    rivers.push(
      el('path', {
        d: taper(knots, vw * 0.035, { start: 1, end: 0.1, swell: 1 }).toString(),
        fill: pal.lava,
      }),
    );
    rivers.push(
      el('path', {
        d: taper(knots.slice(0, 3), vw * 0.014, { start: 1, end: 0.1, swell: 1 }).toString(),
        fill: pal.lavaHot,
      }),
    );
  }
  out.push(
    flatForm(ids, cone, pal.cone, {
      shade: pal.coneShade,
      shadeDepth: vw * 0.12,
      light: pal.coneLight,
      lightDepth: vw * 0.02,
    }),
  );
  out.push(...rivers);
  out.push(
    el('path', {
      d: Path.ellipse(vx, top + H * 0.008, crater * 0.9, H * 0.012).toString(),
      fill: pal.lavaHot,
    }),
  );
  // Rocky mid-ground and the dark basalt shelf the creature stands on.
  out.push(
    flatForm(ids, hillPath(W, hz + H * 0.12, H * 0.05, 3, H, rng, 1), pal.mid, {
      shade: pal.midShade,
      shadeDepth: H * 0.02,
      light: pal.coneLight,
      lightDepth: H * 0.008,
    }),
  );
  const g = f.groundY;
  const ground = Path.smooth([
    knot([-W * 0.1, H * 1.1], 0),
    [-W * 0.1, g - H * 0.04],
    [W * 0.28, g - H * 0.08],
    [W * 0.72, g - H * 0.07],
    [W * 1.1, g - H * 0.05],
    knot([W * 1.1, H * 1.1], 0),
  ]);
  out.push(
    flatForm(ids, ground, pal.ground, {
      shade: pal.groundShade,
      shadeDepth: H * 0.02,
      light: pal.groundLight,
      lightDepth: H * 0.012,
    }),
  );
  // Glowing cracks in the basalt, kept to the sides.
  for (const side of [-1, 1] as const) {
    const x0 = W * (0.5 + side * rng.range(0.3, 0.42));
    const y0 = g + H * rng.range(0.0, 0.05);
    const knots: Knot[] = [
      [x0 - side * W * 0.06, y0 - H * 0.01],
      [x0 - side * W * 0.02, y0 + H * 0.012],
      [x0 + side * W * 0.03, y0 - H * 0.004],
      [x0 + side * W * 0.08, y0 + H * 0.02],
    ];
    out.push(glow(ids, [x0, y0], W * 0.07, pal.crack, 0.35));
    out.push(
      el('path', {
        d: taper(knots, 3.2 * px, { start: 0.2, end: 0.2 }).toString(),
        fill: pal.crack,
      }),
    );
  }
  // Pebbles.
  for (let i = 0; i < 6; i++) {
    const x = W * rng.next();
    const y = g + H * rng.range(0.01, 0.08);
    if (x > f.creature.x0 && x < f.creature.x1) continue;
    const r = rng.range(3, 6) * px;
    out.push(
      el('path', {
        d: Path.ellipse(x, y, r * 1.4, r, rng.range(-10, 10)).toString(),
        fill: pal.groundLight,
      }),
    );
  }
  // Ambient ember specks rising in the sky.
  for (let i = 0; i < (full ? 14 : 9); i++) {
    const p: Pt = [W * rng.range(0.4, 1), hz * rng.range(0.1, 0.95)];
    out.push(
      el('circle', {
        cx: p[0],
        cy: p[1],
        r: rng.range(1, 2.2) * px,
        fill: pal.ember,
        opacity: rng.range(0.5, 0.95),
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
      0.45,
    ),
  );
  out.push(vignette(ids, W, H, pal.shadow, full ? 0.4 : 0.28));
  return out.join('');
}
