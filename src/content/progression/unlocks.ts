import type { PerkDef, UnlockDef } from '../schema/customers';

/**
 * Level unlocks 1–5 (docs/02 §9.3). Features that aren't built yet grant a placeholder perk so no
 * level is ever empty ("During development" rule, docs/02 §9.3).
 */
export const unlockCatalog: readonly UnlockDef[] = [
  { id: 'unlock.supplier.budget-box', level: 1, built: true },
  { id: 'unlock.fixture.wall-shelf-small', level: 1, built: true },
  { id: 'unlock.feature.pricing', level: 1, built: true },
  { id: 'unlock.feature.pack-opening', level: 1, built: true },
  { id: 'unlock.feature.binder', level: 1, built: true },
  { id: 'unlock.feature.singles-case', level: 2, built: true },
  { id: 'unlock.fixture.gondola', level: 3, built: false, perkId: 'perk.storage-10' },
  { id: 'unlock.app.foiltrack', level: 3, built: false, perkId: 'perk.supplier-2' },
  { id: 'unlock.supplier.harbor-hobby', level: 4, built: false, perkId: 'perk.storage-10' },
  { id: 'unlock.fixture.bargain-bin', level: 4, built: false, perkId: 'perk.supplier-2' },
  { id: 'unlock.category.manga', level: 5, built: false, perkId: 'perk.storage-10' },
];

export const perkCatalog: readonly PerkDef[] = [
  { id: 'perk.storage-10', effect: { type: 'storageUnits', amount: 10 } },
  { id: 'perk.supplier-2', effect: { type: 'supplierDiscount', pct: 0.02 } },
];
