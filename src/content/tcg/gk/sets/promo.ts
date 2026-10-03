import type { CardDef, SetDef } from '@/content/schema/tcg';
import { dollars } from '@/core/money';

/**
 * Black-star promos (docs/03 §1.1: `gk.promo.<nnn>`, printed as GK-P001). One open-ended,
 * evergreen series shared by every product and event; `totalMain` is just the numbering cap.
 * Values: Promo band, typical × relative popularity within the series (docs/02 §7.1).
 */
export const promoSet: SetDef = {
  id: 'gk.promo',
  brandId: 'gk',
  code: 'GKP',
  name: 'Glimmerkin Promos',
  era: 'modern',
  releaseDay: -6,
  totalMain: 999,
  theme: 'Black-star promos from blisters, collections, events and leagues.',
};

export const promoCards: readonly CardDef[] = [
  {
    id: 'gk.promo.001',
    setId: 'gk.promo',
    number: 1,
    name: 'Magmadillo',
    kind: 'creature',
    rarity: 'promo',
    finishes: ['cosmos'],
    speciesId: 'gk.species.magmadillo',
    element: 'ember',
    stage: 'basic',
    hp: 80,
    attacks: [
      { name: 'Warm Hug', cost: ['ember'], text: 'Heal 20 damage from 1 of your creatures.' },
      { name: 'Ember Roll', cost: ['ember', 'neutral'], damage: '40' },
    ],
    weakness: 'tide',
    retreat: 2,
    flavor: 'Emberdawn 3-Pack Blister promo. Handle with oven mitts.',
    illustrator: 'Bo Strand',
    art: {
      composition: 'window',
      speciesId: 'gk.species.magmadillo',
      pose: 'action',
      timeOfDay: 'night',
      seed: 90001,
    },
    baseValueCents: dollars(3.71),
    playability: 0.2,
  },
  {
    id: 'gk.promo.002',
    setId: 'gk.promo',
    number: 2,
    name: 'Boltbuck',
    kind: 'creature',
    rarity: 'promo',
    finishes: ['cosmos'],
    speciesId: 'gk.species.boltbuck',
    element: 'volt',
    stage: 'basic',
    hp: 90,
    attacks: [
      { name: 'Storm Call', cost: ['volt'], text: 'Draw 2 cards.' },
      { name: 'Antler Arc', cost: ['volt', 'volt'], damage: '50' },
    ],
    weakness: 'terra',
    retreat: 2,
    flavor: 'Emberdawn 3-Pack Blister promo. Static included at no extra cost.',
    illustrator: 'Maren Solberg',
    art: {
      composition: 'window',
      speciesId: 'gk.species.boltbuck',
      pose: 'happy',
      timeOfDay: 'dusk',
      seed: 90002,
    },
    baseValueCents: dollars(4.29),
    playability: 0.2,
  },
];
