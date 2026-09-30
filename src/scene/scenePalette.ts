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
