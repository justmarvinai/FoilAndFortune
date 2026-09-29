import type { BrandDef } from '@/content/schema/tcg';

/** Glimmerkin, the flagship in-world TCG (docs/03 §3). */
export const glimmerkin: BrandDef = {
  id: 'gk',
  name: 'Glimmerkin',
  publisher: 'Starforge Games',
  tagline: 'Find your spark.',
  elements: ['ember', 'tide', 'bloom', 'volt', 'terra', 'mystic', 'shade', 'frost', 'neutral'],
  unlockLevel: 1,
  cardBack: {
    glow: '#FFE58A',
    goldLight: '#FFF4C2',
    gold: '#FFC93C',
    goldDark: '#B8860B',
    outline: '#7A5A12',
    core: '#FFF8DC',
  },
};
