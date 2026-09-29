/**
 * Design tokens as TypeScript values, for places CSS can't reach (three.js materials, canvas,
 * SVG generators). `src/ui/tokens.css` mirrors these for Tailwind/CSS; a unit test keeps them in
 * sync. Source of truth for the palette: docs/04_ART_DIRECTION.md §2.
 */
export const palette = {
  ink: '#1E2340',
  paper: '#FFF6E5',
  paper2: '#F6E7CB',
  wood: '#A86B3C',
  woodDark: '#6E4323',
  teal: '#1FB5A6',
  coral: '#FF6F59',
  sun: '#FFC93C',
  sky: '#4DA8FF',
  grape: '#8E5CF7',
  mint: '#43D17A',
  night: '#121634',
  /** Shop-tablet screen and bezel (docs/05 §1 diegetic panels). */
  tablet: '#20264F',
  tabletBezel: '#10142E',
  /** Pale toast/paper tints. */
  mintLight: '#DFF7E8',
  sunLight: '#FFF0D6',
} as const;

/** Rarity colors (docs/04 §2.2). Always pair with a shape, never color alone. */
export const rarityColors = {
  common: '#9AA3B2',
  uncommon: '#43D17A',
  rare: '#4DA8FF',
  holoRare: '#1FB5A6',
  ultraRare: '#8E5CF7',
  illustrationRare: '#FF7BC0',
  secretRare: '#FFC93C',
  mythicRare: '#FF3D6E',
  promo: '#1E2340',
} as const;

/** Foil gradient stops used for shimmering accents (docs/04 §2.1). */
export const foilStops = ['#7FF6FF', '#B78BFF', '#FF8BD1', '#FFE58A', '#8BFFB0'] as const;

export type PaletteToken = keyof typeof palette;
