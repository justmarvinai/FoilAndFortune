import type { ElementId } from '@/content/schema/common';
import type { CardDef, SetDef } from '@/content/schema/tcg';

/**
 * Basic Essences (docs/03 §3.3): the energy cards of every element. They ship in starter decks and
 * evolution packs, never in boosters, so they live in their own evergreen set instead of a main
 * set's numbering (pack pools are per set and skip basic Essences anyway). The special textured
 * Essences are Secret Rares of their main set. Neutral has no basic Essence: any Essence pays a
 * Neutral cost.
 */
export const essenceSet: SetDef = {
  id: 'gk.essence',
  brandId: 'gk',
  code: 'ESS',
  name: 'Basic Essences',
  era: 'modern',
  releaseDay: -6,
  totalMain: 8,
  theme: 'Evergreen basic Essence cards, one per element, reprinted for every starter deck.',
};

const ORDER = [
  'ember',
  'tide',
  'bloom',
  'volt',
  'terra',
  'mystic',
  'shade',
  'frost',
] as const satisfies readonly ElementId[];

const NAMES: Record<(typeof ORDER)[number], string> = {
  ember: 'Ember Essence',
  tide: 'Tide Essence',
  bloom: 'Bloom Essence',
  volt: 'Volt Essence',
  terra: 'Terra Essence',
  mystic: 'Mystic Essence',
  shade: 'Shade Essence',
  frost: 'Frost Essence',
};

export const essenceCards: readonly CardDef[] = ORDER.map((element, index) => ({
  id: `gk.essence.${String(index + 1).padStart(3, '0')}`,
  setId: 'gk.essence',
  number: index + 1,
  name: NAMES[element],
  kind: 'essence',
  rarity: 'common',
  finishes: ['normal'],
  element,
  illustrator: 'Starforge Studio',
  // Essences draw their emblem in CardView (no illustration); the spec only keeps the seed.
  art: { composition: 'window', pose: 'idle', timeOfDay: 'day', seed: 80001 + index },
  // Bulk: the bottom of the Common band (docs/02 §7.1).
  baseValueCents: 5,
  playability: 0,
}));
