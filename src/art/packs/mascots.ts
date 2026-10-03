import { n, roundRect } from './svg';

/**
 * Pack-art creatures (docs/03 §4.1 "Pack art: Solaryx, Magmadillo, Boltbuck, Emberpup"; starter
 * decks feature Emberpup and Sparkit). Chunky vector silhouettes in element colors, drawn by us in
 * a 100 × 100 box (feet near y = 94, facing right). Each mascot is a list of body parts plus
 * face details, so the composer can draw a die-cut "sticker halo" from the same parts first: it
 * keeps the creature readable on any wrapper color, even at 48 px.
 */
export type MascotId =
  | 'solaryx'
  | 'magmadillo'
  | 'boltbuck'
  | 'emberpup'
  | 'sparkit'
  | 'sploot'
  | 'sprite';

export const MASCOT_IDS: readonly MascotId[] = [
  'solaryx',
  'magmadillo',
  'boltbuck',
  'emberpup',
  'sparkit',
  'sploot',
  'sprite',
];

export interface MascotPalette {
  /** Main body color (the element color). */
  body: string;
  /** Belly, muzzle and highlights. */
  light: string;
  /** Outline and darker parts (the element shade). */
  shade: string;
  /** Ears, stripes, frills. */
  accent: string;
  /** Flames, sparks, lava. */
  glow: string;
}

/** Element-flavored palettes per mascot (docs/03 §3.2, species genomes in src/content/tcg). */
export const MASCOT_PALETTES: Record<MascotId, MascotPalette> = {
  solaryx: {
    body: '#FFB23F',
    light: '#FFF1C2',
    shade: '#9A3A0B',
    accent: '#FF6F59',
    glow: '#FFE066',
  },
  magmadillo: {
    body: '#C8553A',
    light: '#FFD9B8',
    shade: '#5E1A10',
    accent: '#8A2C1C',
    glow: '#FFC93C',
  },
  boltbuck: {
    body: '#E0A060',
    light: '#FFF1DC',
    shade: '#6B3F14',
    accent: '#FFD23F',
    glow: '#FFE95C',
  },
  emberpup: {
    body: '#FF7A3D',
    light: '#FFE3C2',
    shade: '#8A2A0B',
    accent: '#4A2C35',
    glow: '#FFD166',
  },
  sparkit: {
    body: '#FFC53D',
    light: '#FFF4D6',
    shade: '#7A5600',
    accent: '#3FA9F5',
    glow: '#7FE3FF',
  },
  sploot: {
    body: '#7FD3FF',
    light: '#E3F7FF',
    shade: '#0D5A80',
    accent: '#FF8FB8',
    glow: '#FFFFFF',
  },
  sprite: {
    body: '#C9A8FF',
    light: '#F3EAFF',
    shade: '#4B2A8A',
    accent: '#FF8BD1',
    glow: '#FFE58A',
  },
};

type ColorRole = keyof MascotPalette | 'ink' | 'white' | 'blush';

interface Part {
  d: string;
  fill: ColorRole;
  transform?: string;
}

interface Detail {
  d: string;
  fill?: ColorRole;
  stroke?: ColorRole;
  width?: number;
  opacity?: number;
  transform?: string;
}

interface MascotShape {
  /** Drawn behind everything and excluded from the halo (e.g. Solaryx's sun disc). */
  back?: Detail[];
  parts: Part[];
  details: Detail[];
}

const INK = '#1E2340';
const BLUSH = '#FF7A9A';

/** Ellipse as a path (optionally rotated around its center). */
function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(rx * 2)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(
    -rx * 2,
  )} 0Z`;
}

function circle(cx: number, cy: number, r: number): string {
  return ellipse(cx, cy, r, r);
}

function rot(deg: number, cx: number, cy: number): string {
  return `rotate(${n(deg)} ${n(cx)} ${n(cy)})`;
}

/** Big glossy toy eye: ink ellipse with two glints. */
function eye(cx: number, cy: number, rx: number, ry: number): Detail[] {
  return [
    { d: ellipse(cx, cy, rx, ry), fill: 'ink' },
    { d: circle(cx + rx * 0.35, cy - ry * 0.4, Math.max(0.8, rx * 0.42)), fill: 'white' },
    { d: circle(cx - rx * 0.3, cy + ry * 0.35, Math.max(0.5, rx * 0.2)), fill: 'white' },
  ];
}

function blush(cx: number, cy: number): Detail {
  return { d: ellipse(cx, cy, 3.4, 1.9), fill: 'blush', opacity: 0.55 };
}

const SHAPES: Record<MascotId, MascotShape> = {
  emberpup: {
    parts: [
      {
        // Flame tail, wagging up behind the body.
        d: 'M34 80C20 80 10 68 13 52C15 58 19 61 22 60C17 48 21 36 30 29C30 38 33 43 37 45C37 56 40 66 44 72Z',
        fill: 'glow',
      },
      { d: ellipse(47, 73, 21, 19), fill: 'body' },
      { d: ellipse(33, 87, 9, 6.5), fill: 'body' },
      { d: roundRect(43, 74, 9.5, 20, 4.7), fill: 'body' },
      { d: roundRect(56, 74, 9.5, 20, 4.7), fill: 'body' },
      { d: ellipse(40, 39, 7.5, 15), fill: 'accent', transform: rot(24, 40, 39) },
      { d: circle(58, 42, 21), fill: 'body' },
      { d: ellipse(77.5, 37, 7.2, 14), fill: 'accent', transform: rot(-28, 77.5, 37) },
      { d: ellipse(64, 51.5, 11.5, 8.5), fill: 'light' },
      { d: 'M52 24C49 17 53 10 58 5C58 11 61 14 64 12C66 17 65 21 63 24Z', fill: 'glow' },
    ],
    details: [
      {
        d: 'M31 74C24 72 19 64 21 55C24 59 27 60 29 58C27 50 29 44 33 40C34 48 37 52 39 54Z',
        fill: 'body',
        opacity: 0.9,
      },
      { d: ellipse(50, 78, 10.5, 11), fill: 'light', opacity: 0.9 },
      { d: roundRect(43, 88, 9.5, 6, 3), fill: 'accent' },
      { d: roundRect(56, 88, 9.5, 6, 3), fill: 'accent' },
      ...eye(52.5, 40, 3.1, 3.9),
      ...eye(66.5, 38.5, 2.9, 3.7),
      { d: ellipse(70.5, 47, 3.4, 2.5), fill: 'ink' },
      { d: 'M64.5 54.5Q67.5 58 71 54.5', stroke: 'ink', width: 1.6 },
      blush(49, 48),
      blush(74, 45.5),
    ],
  },

  sparkit: {
    parts: [
      {
        // Lightning-bolt tail.
        d: 'M34 80L15 64L25 61L8 41L27 47L21 29L42 57L32 59L41 74Z',
        fill: 'body',
      },
      { d: ellipse(48, 73, 19.5, 18), fill: 'body' },
      { d: roundRect(43, 76, 9, 18, 4.5), fill: 'body' },
      { d: roundRect(55, 76, 9, 18, 4.5), fill: 'body' },
      { d: 'M45 36L38 7L60 27Z', fill: 'body' },
      { d: circle(60, 45, 19.5), fill: 'body' },
      { d: 'M67 28L82 5L81 37Z', fill: 'body' },
      {
        // Cheek ruff.
        d: 'M44 50L48 60L52 56L56 64L60 58L65 65L68 58L74 62L76 53Z',
        fill: 'light',
      },
      { d: ellipse(69, 52, 10.5, 7), fill: 'light' },
    ],
    details: [
      { d: 'M46 31L42 14L55 27Z', fill: 'accent' },
      { d: 'M70 28L79 13L78.5 31Z', fill: 'accent' },
      { d: 'M21 29L27 38L24 39Z', fill: 'glow' },
      { d: 'M8 41L19 46L15 47Z', fill: 'glow' },
      { d: 'M36 60Q40 56 44 60', stroke: 'accent', width: 2.4 },
      { d: 'M34 67Q38 63 42 67', stroke: 'accent', width: 2.4 },
      ...eye(54, 42, 3.4, 4.3),
      ...eye(68.5, 40.5, 3.1, 4),
      { d: ellipse(77.5, 49, 2.6, 2), fill: 'ink' },
      { d: 'M70 55.5Q73 58.5 76 55.5', stroke: 'ink', width: 1.5 },
    ],
  },

  solaryx: {
    back: [{ d: circle(50, 36, 26), fill: 'glow', opacity: 0.45 }],
    parts: [
      {
        // Tail flames.
        d: 'M50 70C43 80 41 90 45 99C47 92 49 89 50 88C51 89 53 92 55 99C59 90 57 80 50 70Z',
        fill: 'glow',
      },
      {
        d: 'M46 72C38 78 32 86 30 96C35 91 38 89 41 88C41 83 43 78 46 72Z',
        fill: 'accent',
      },
      {
        d: 'M54 72C62 78 68 86 70 96C65 91 62 89 59 88C59 83 57 78 54 72Z',
        fill: 'accent',
      },
      {
        // Left wing, sweeping up.
        d: 'M46 50C36 40 22 30 3 13C7 26 10 32 15 36C11 38 9 40 7 45C15 45 19 47 23 49C21 53 21 56 21 60C29 57 37 59 46 63Z',
        fill: 'body',
      },
      {
        d: 'M54 50C64 40 78 30 97 13C93 26 90 32 85 36C89 38 91 40 93 45C85 45 81 47 77 49C79 53 79 56 79 60C71 57 63 59 54 63Z',
        fill: 'body',
      },
      { d: ellipse(50, 60, 13.5, 18), fill: 'body' },
      {
        // Crest of sun rays.
        d: 'M43 26C40 19 41 12 44 6C46 12 48 14 50 15C50 9 52 4 56 0C56 7 57 12 58 16C60 13 62 12 66 11C64 17 61 23 57 26Z',
        fill: 'glow',
      },
      { d: circle(50, 34, 12.5), fill: 'body' },
    ],
    details: [
      { d: 'M14 23C22 32 32 40 42 48', stroke: 'shade', width: 1.4, opacity: 0.55 },
      { d: 'M86 23C78 32 68 40 58 48', stroke: 'shade', width: 1.4, opacity: 0.55 },
      { d: 'M13 42C22 44 32 48 42 54', stroke: 'shade', width: 1.4, opacity: 0.55 },
      { d: 'M87 42C78 44 68 48 58 54', stroke: 'shade', width: 1.4, opacity: 0.55 },
      { d: ellipse(50, 64, 8, 11), fill: 'light', opacity: 0.9 },
      ...eye(45, 33, 2.6, 3.3),
      ...eye(55, 33, 2.6, 3.3),
      { d: 'M47.5 38.5L52.5 38.5L50 43Z', fill: 'accent' },
      blush(41, 38.5),
      blush(59, 38.5),
    ],
  },

  magmadillo: {
    parts: [
      { d: 'M22 80L5 87L22 87Z', fill: 'shade' },
      { d: roundRect(25, 79, 10, 14, 5), fill: 'accent' },
      { d: roundRect(39, 81, 10, 12, 5), fill: 'accent' },
      { d: 'M15 83C15 52 33 36 54 36C73 36 85 51 85 70L85 83Z', fill: 'body' },
      { d: roundRect(66, 79, 10, 14, 5), fill: 'accent' },
      { d: ellipse(84, 70, 12, 10.5), fill: 'light' },
      { d: 'M89 64C96 64 100 69 98 74C95 77 90 77 88 74Z', fill: 'light' },
      { d: ellipse(79.5, 58, 4, 6.5), fill: 'light', transform: rot(-15, 79.5, 58) },
    ],
    details: [
      { d: 'M26 83C25 60 36 46 49 40', stroke: 'shade', width: 1.8, opacity: 0.7 },
      { d: 'M40 83C40 62 48 48 59 41', stroke: 'shade', width: 1.8, opacity: 0.7 },
      { d: 'M55 83C56 64 63 52 71 46', stroke: 'shade', width: 1.8, opacity: 0.7 },
      { d: 'M31 58L36 62L33 67L38 72', stroke: 'glow', width: 2.2 },
      { d: 'M49 50L53 55L49 60L54 66', stroke: 'glow', width: 2.2 },
      { d: 'M66 52L69 57L66 62', stroke: 'glow', width: 2.2 },
      { d: 'M19 72C24 66 30 64 36 66', stroke: 'glow', width: 1.6, opacity: 0.8 },
      ...eye(85, 66, 2.3, 2.9),
      { d: ellipse(97.5, 70.5, 1.8, 1.5), fill: 'ink' },
      blush(81, 73),
    ],
  },

  boltbuck: {
    parts: [
      {
        // Back antler: a zigzag lightning bolt.
        d: 'M63 25L54 15L58 14L49 2L66 12L62 13L70 23Z',
        fill: 'glow',
      },
      { d: roundRect(27, 70, 7, 24, 3.5), fill: 'body' },
      { d: roundRect(37, 72, 7, 22, 3.5), fill: 'body' },
      { d: 'M21 60C17 55 18 50 22 50C24 54 25 57 25 60Z', fill: 'light' },
      { d: ellipse(44, 65, 24, 13), fill: 'body' },
      { d: roundRect(53, 72, 7, 22, 3.5), fill: 'body' },
      { d: roundRect(62, 70, 7, 24, 3.5), fill: 'body' },
      { d: 'M55 62C57 50 61 42 65 35L78 40C74 48 70 56 68 66Z', fill: 'body' },
      { d: ellipse(63, 29, 6.5, 3.2), fill: 'body', transform: rot(-30, 63, 29) },
      { d: ellipse(72, 34, 11.5, 9), fill: 'body', transform: rot(-14, 72, 34) },
      { d: ellipse(81.5, 38.5, 6.5, 4.8), fill: 'light' },
      {
        // Front antler.
        d: 'M74 27L80 16L76 15L87 2L81 14L87 14L79 29Z',
        fill: 'glow',
      },
    ],
    details: [
      { d: ellipse(40, 71, 15, 5), fill: 'light', opacity: 0.85 },
      { d: circle(33, 60, 1.8), fill: 'light' },
      { d: circle(40, 57, 1.5), fill: 'light' },
      { d: circle(47, 59, 1.8), fill: 'light' },
      { d: roundRect(27, 90, 7, 4, 2), fill: 'shade' },
      { d: roundRect(37, 90, 7, 4, 2), fill: 'shade' },
      { d: roundRect(53, 90, 7, 4, 2), fill: 'shade' },
      { d: roundRect(62, 90, 7, 4, 2), fill: 'shade' },
      ...eye(73, 32, 2.5, 3.1),
      { d: ellipse(86.5, 37, 1.9, 1.5), fill: 'ink' },
      blush(76, 38),
    ],
  },

  sploot: {
    parts: [
      { d: 'M24 74C12 72 4 62 6 52C12 59 19 62 28 64Z', fill: 'body' },
      { d: ellipse(34, 85, 7, 5), fill: 'body' },
      { d: ellipse(44, 72, 24, 14), fill: 'body' },
      { d: ellipse(56, 86, 7, 5), fill: 'body' },
      { d: ellipse(45, 38, 10, 4), fill: 'accent', transform: rot(-35, 45, 38) },
      { d: ellipse(43, 48, 10, 4), fill: 'accent', transform: rot(-5, 43, 48) },
      { d: ellipse(46, 58, 9, 3.6), fill: 'accent', transform: rot(25, 46, 58) },
      { d: ellipse(64, 50, 22, 18), fill: 'body' },
      { d: ellipse(84, 36, 10, 4), fill: 'accent', transform: rot(-50, 84, 36) },
      { d: ellipse(88, 46, 10, 4), fill: 'accent', transform: rot(-15, 88, 46) },
      { d: ellipse(86, 57, 9, 3.6), fill: 'accent', transform: rot(20, 86, 57) },
    ],
    details: [
      { d: ellipse(46, 77, 15, 6), fill: 'light', opacity: 0.8 },
      ...eye(58, 46, 3.2, 3.8),
      ...eye(73, 45, 3, 3.6),
      { d: 'M60 56Q66 62 72 56', stroke: 'ink', width: 1.7 },
      blush(54, 54),
      blush(78, 53),
    ],
  },

  sprite: {
    back: [{ d: circle(50, 56, 34), fill: 'glow', opacity: 0.35 }],
    parts: [
      { d: 'M50 10L57 34L82 30L63 48L76 72L50 60L24 72L37 48L18 30L43 34Z', fill: 'accent' },
      { d: ellipse(50, 62, 24, 22), fill: 'body' },
    ],
    details: [
      { d: ellipse(50, 70, 13, 10), fill: 'light', opacity: 0.85 },
      ...eye(42, 58, 3, 3.8),
      ...eye(58, 58, 3, 3.8),
      { d: 'M45 67Q50 71 55 67', stroke: 'ink', width: 1.6 },
      blush(36, 65),
      blush(64, 65),
    ],
  },
};

export interface MascotRenderOptions {
  palette?: MascotPalette;
  /** Die-cut sticker halo color behind the silhouette (none when omitted). */
  halo?: string;
  /** Halo thickness in mascot units. */
  haloWidth?: number;
  /** Outline width in mascot units. */
  outline?: number;
}

function color(role: ColorRole, palette: MascotPalette): string {
  if (role === 'ink') return INK;
  if (role === 'white') return '#FFFFFF';
  if (role === 'blush') return BLUSH;
  return palette[role];
}

function detailTag(detail: Detail, palette: MascotPalette): string {
  const fill = detail.fill ? color(detail.fill, palette) : 'none';
  const stroke = detail.stroke
    ? ` stroke="${color(detail.stroke, palette)}" stroke-width="${n(detail.width ?? 1.5)}" stroke-linecap="round" stroke-linejoin="round"`
    : '';
  const opacity = detail.opacity === undefined ? '' : ` opacity="${n(detail.opacity)}"`;
  const transform = detail.transform ? ` transform="${detail.transform}"` : '';
  return `<path d="${detail.d}" fill="${fill}"${stroke}${opacity}${transform}/>`;
}

/**
 * The mascot's markup in its 100 × 100 box. Place it with a `<g transform>`; it only uses plain
 * fills and strokes (no ids), so any number of copies can share one SVG.
 */
export function mascotSvg(id: MascotId, options: MascotRenderOptions = {}): string {
  const shape = SHAPES[id];
  const palette = options.palette ?? MASCOT_PALETTES[id];
  const outline = options.outline ?? 2.2;
  let out = '';
  for (const detail of shape.back ?? []) out += detailTag(detail, palette);
  if (options.halo) {
    const width = n(outline + (options.haloWidth ?? 7));
    out += `<g fill="${options.halo}" stroke="${options.halo}" stroke-width="${width}" stroke-linejoin="round">`;
    for (const part of shape.parts) {
      out += `<path d="${part.d}"${part.transform ? ` transform="${part.transform}"` : ''}/>`;
    }
    out += '</g>';
  }
  out += `<g stroke="${palette.shade}" stroke-width="${n(outline)}" stroke-linejoin="round">`;
  for (const part of shape.parts) {
    const transform = part.transform ? ` transform="${part.transform}"` : '';
    out += `<path d="${part.d}" fill="${color(part.fill, palette)}"${transform}/>`;
  }
  out += '</g>';
  for (const detail of shape.details) out += detailTag(detail, palette);
  return out;
}
