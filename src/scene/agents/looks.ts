/**
 * Peg-folk look descriptions (docs/04 §4.4). A look is plain data, so customer archetypes can
 * map to looks later (`content/customers` → `scene/agents/looks.ts`, docs/06 §11) and the New
 * Game avatar editor can build one for the owner.
 */
export type HairStyle = 'bob' | 'spiky' | 'bun' | 'ponytail' | 'curls' | 'buzz';
export type TopStyle = 'tee' | 'hoodie' | 'vest' | 'apron';

export interface PegLook {
  /** Overall scale: adults ≈ 1.0 (1.1 m), kids ≈ 0.78 (docs/04 §4.2). */
  scale: number;
  skin: string;
  hair: { style: HairStyle; color: string };
  top: { style: TopStyle; color: string; accent: string };
  bottom: string;
  shoes: string;
  accessories: {
    cap?: string;
    backpack?: string;
    glasses?: string;
    headphones?: string;
    tote?: string;
  };
}

/** A wide, inclusive skin palette (docs/04 §4.4). */
export const SKIN_TONES = [
  '#FFE0C7',
  '#F6C9A0',
  '#E3A77A',
  '#C68757',
  '#9A6340',
  '#6E4430',
] as const;

export const HAIR_COLORS = [
  '#2B2230',
  '#4A2F24',
  '#8A5A32',
  '#E0A94A',
  '#C4502E',
  '#6B5BD6',
] as const;

/** The demo customer: a kid with a cap and backpack, on the way to the bargain bin. */
export const KID_LOOK: PegLook = {
  scale: 0.86,
  skin: '#F6C9A0',
  hair: { style: 'curls', color: '#4A2F24' },
  top: { style: 'hoodie', color: '#4DA8FF', accent: '#FFF6E5' },
  bottom: '#2F3A6B',
  shoes: '#FF6F59',
  accessories: { cap: '#FFC93C', backpack: '#FF6F59' },
};

/** The shopkeeper (player avatar default): teal apron, glasses, hair in a bun. */
export const OWNER_LOOK: PegLook = {
  scale: 1,
  skin: '#C68757',
  hair: { style: 'bun', color: '#2B2230' },
  top: { style: 'apron', color: '#FFF6E5', accent: '#1FB5A6' },
  bottom: '#3A3350',
  shoes: '#6E4323',
  accessories: { glasses: '#1E2340' },
};

/** A few extra looks, handy for the Phase 2 crowd and for eyeballing variety. */
export const SAMPLE_LOOKS: readonly PegLook[] = [
  KID_LOOK,
  OWNER_LOOK,
  {
    scale: 1,
    skin: '#FFE0C7',
    hair: { style: 'ponytail', color: '#C4502E' },
    top: { style: 'tee', color: '#8E5CF7', accent: '#FFC93C' },
    bottom: '#1E2340',
    shoes: '#FFF6E5',
    accessories: { headphones: '#FF6F59', tote: '#43D17A' },
  },
  {
    scale: 1.02,
    skin: '#6E4430',
    hair: { style: 'buzz', color: '#2B2230' },
    top: { style: 'vest', color: '#F6E7CB', accent: '#6E4323' },
    bottom: '#4A4E63',
    shoes: '#2B2230',
    accessories: { glasses: '#A86B3C' },
  },
];
