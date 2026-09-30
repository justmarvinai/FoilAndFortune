import { dollars } from '@/core/money';
import type { ArchetypeDef } from '../schema/customers';

/**
 * Customer archetypes (docs/01 §10.1, numbers from docs/02 §5.2). Phase 2 ships Kid and Casual
 * Collector; the rest arrive with their features (Phase 3+).
 */
export const kid: ArchetypeDef = {
  id: 'arch.kid',
  budgetCents: [dollars(5), dollars(25)],
  knowledge: [0.1, 0.3],
  priceSensitivity: 1.3,
  toleranceBase: 0.1,
  patienceMinutes: [8, 15],
  haggleStyles: [
    { style: 'pushover', weight: 70 },
    { style: 'fair', weight: 30 },
  ],
  minRepStars: 0,
  mixWeight: 22,
  basketMean: 1.3,
  // docs/02 §5.2: packs 50, blisters 20, bargain bin 20 (Phase 3), cheap holos 10.
  preferences: [
    { kind: 'sealed', productKind: 'booster', weight: 50 },
    { kind: 'sealed', productKind: 'blister', weight: 20 },
    { kind: 'sealed', productKind: 'starterDeck', weight: 10 },
    { kind: 'singles', maxValueCents: dollars(6), weight: 10 },
  ],
  sellIntentChance: 0.03,
};

export const casualCollector: ArchetypeDef = {
  id: 'arch.casual',
  budgetCents: [dollars(10), dollars(70)],
  knowledge: [0.3, 0.6],
  priceSensitivity: 1.1,
  toleranceBase: 0.1,
  patienceMinutes: [10, 20],
  haggleStyles: [
    { style: 'pushover', weight: 30 },
    { style: 'fair', weight: 60 },
    { style: 'tough', weight: 10 },
  ],
  minRepStars: 0,
  mixWeight: 28,
  basketMean: 2,
  preferences: [
    { kind: 'sealed', productKind: 'booster', weight: 35 },
    { kind: 'sealed', productKind: 'blister', weight: 20 },
    { kind: 'sealed', productKind: 'starterDeck', weight: 15 },
    { kind: 'sealed', productKind: 'collection', weight: 10 },
    { kind: 'singles', maxValueCents: dollars(40), weight: 20 },
  ],
  sellIntentChance: 0.1,
};

export const archetypeCatalog: readonly ArchetypeDef[] = [kid, casualCollector];
