import { palette } from '@/ui/palette';

/**
 * Scene material tones. UI tokens (docs/04 §2.1, `src/ui/palette.ts`) plus the in-between
 * shades a lit 3D world needs (plaster, grout, cobbles). Kept in one place so the diorama's
 * colour harmony can be tuned without hunting through fixtures.
 */
export const tones = {
  ink: palette.ink,
  paper: palette.paper,
  paper2: palette.paper2,
  wood: palette.wood,
  woodDark: palette.woodDark,
  woodLight: '#E2B27A',
  maple: '#EBC693',
  walnut: '#5A3824',
  walnutLight: '#7C5236',
  teal: palette.teal,
  coral: palette.coral,
  sun: palette.sun,
  sky: palette.sky,
  grape: palette.grape,
  mint: palette.mint,
  night: palette.night,

  plaster: '#F7E7CD',
  plasterOuter: '#EFD9B8',
  wallCut: '#8B6B55',
  wainscot: '#3FA597',
  wainscotBatten: '#57B8AA',
  trim: '#FFF3DF',
  baseboard: '#6E4323',
  floor: '#C98E57',

  paver: '#D9D0C1',
  curb: '#E7E0D2',
  cobble: '#8D8F9D',
  iron: '#2E3A4B',
  leaf: '#43B06A',
  leafDark: '#2E8A55',
  terracotta: '#D9774B',
  brass: '#D9A441',
  velvet: '#28306A',
  indigoPanel: '#2B3163',
} as const;

/**
 * Customer outfits (docs/04 §4.4 "color-blocked tops and bottoms"), sampled per customer from its
 * look seed (live/liveLooks.ts). Kids get the brightest tops; small, fixed tables also keep the
 * number of distinct baked Peg-folk meshes bounded.
 */
export const pegColors = {
  kidTops: [palette.coral, palette.sun, palette.sky, palette.mint, palette.grape, '#FF8BD1'],
  adultTops: [
    palette.teal,
    palette.sky,
    palette.grape,
    palette.coral,
    '#5C6BC0',
    '#F6E7CB',
    '#3A3350',
    '#7C9A5E',
  ],
  accents: [palette.paper, palette.sun, palette.ink],
  bottoms: ['#2F3A6B', '#3A3350', '#4A4E63', '#6E4323', '#1E2340'],
  shoes: ['#FF6F59', '#FFF6E5', '#2B2230', '#FFC93C', '#4DA8FF'],
  caps: [palette.sun, palette.coral, palette.sky, palette.mint],
  bags: ['#FF6F59', '#43D17A', '#8E5CF7', '#FFC93C'],
  frames: ['#1E2340', '#A86B3C', '#D9A441'],
  headphones: ['#FF6F59', '#1E2340', '#43D17A'],
} as const;

/** Live-shop accents: hover and selection rings, effect sprites (live/*). */
export const liveTones = {
  hover: '#FFF6E5',
  select: palette.sun,
  heart: '#FF5C7A',
  dust: '#D8C7AE',
  steam: '#FFFFFF',
  sparkle: '#FFE58A',
  coin: palette.sun,
  kraft: '#C9A26B',
  kraftDark: '#A57E4C',
  cardGlow: '#FFFFFF',
  cardBack: '#2B3163',
} as const;
