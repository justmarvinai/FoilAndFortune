import { archetypeCatalog } from './customers/archetypes';
import { perkCatalog, unlockCatalog } from './progression/unlocks';
import type { ArchetypeDef, PerkDef, UnlockDef } from './schema/customers';
import type { FixtureDef, LayoutDef, SupplierDef } from './schema/shop';
import type { SpeciesDef } from './schema/species';
import type { BrandDef, CardDef, PackConfigDef, ProductDef, SetDef } from './schema/tcg';
import { fixtureCatalog } from './shop/fixtures';
import { layoutCatalog } from './shop/layouts';
import { supplierCatalog } from './suppliers/budgetBox';
import { glimmerkin } from './tcg/gk/brand';
import {
  emberdawn,
  emberdawnCards,
  emberdawnProducts,
  gkModernBooster,
} from './tcg/gk/sets/emberdawn';
import { gkSpecies } from './tcg/gk/species';

/**
 * Read-only lookup maps over all content (docs/06 §12). Built once at startup; the sim receives
 * it through its context so tests can inject custom content.
 */
export interface ContentRegistry {
  brands: ReadonlyMap<string, BrandDef>;
  species: ReadonlyMap<string, SpeciesDef>;
  sets: ReadonlyMap<string, SetDef>;
  cards: ReadonlyMap<string, CardDef>;
  packConfigs: ReadonlyMap<string, PackConfigDef>;
  products: ReadonlyMap<string, ProductDef>;
  fixtures: ReadonlyMap<string, FixtureDef>;
  layouts: ReadonlyMap<string, LayoutDef>;
  suppliers: ReadonlyMap<string, SupplierDef>;
  archetypes: ReadonlyMap<string, ArchetypeDef>;
  unlocks: ReadonlyMap<string, UnlockDef>;
  perks: ReadonlyMap<string, PerkDef>;
}

export interface ContentSource {
  brands: readonly BrandDef[];
  species: readonly SpeciesDef[];
  sets: readonly SetDef[];
  cards: readonly CardDef[];
  packConfigs: readonly PackConfigDef[];
  products: readonly ProductDef[];
  fixtures: readonly FixtureDef[];
  layouts: readonly LayoutDef[];
  suppliers: readonly SupplierDef[];
  archetypes: readonly ArchetypeDef[];
  unlocks: readonly UnlockDef[];
  perks: readonly PerkDef[];
}

export const defaultContentSource: ContentSource = {
  brands: [glimmerkin],
  species: gkSpecies,
  sets: [emberdawn],
  cards: emberdawnCards,
  packConfigs: [gkModernBooster],
  products: emberdawnProducts,
  fixtures: fixtureCatalog,
  layouts: layoutCatalog,
  suppliers: supplierCatalog,
  archetypes: archetypeCatalog,
  unlocks: unlockCatalog,
  perks: perkCatalog,
};

function indexById<T extends { id: string }>(items: readonly T[], kind: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) throw new Error(`Duplicate ${kind} id: ${item.id}`);
    map.set(item.id, item);
  }
  return map;
}

export function buildRegistry(source: ContentSource = defaultContentSource): ContentRegistry {
  return {
    brands: indexById(source.brands, 'brand'),
    species: indexById(source.species, 'species'),
    sets: indexById(source.sets, 'set'),
    cards: indexById(source.cards, 'card'),
    packConfigs: indexById(source.packConfigs, 'pack config'),
    products: indexById(source.products, 'product'),
    fixtures: indexById(source.fixtures, 'fixture'),
    layouts: indexById(source.layouts, 'layout'),
    suppliers: indexById(source.suppliers, 'supplier'),
    archetypes: indexById(source.archetypes, 'archetype'),
    unlocks: indexById(source.unlocks, 'unlock'),
    perks: indexById(source.perks, 'perk'),
  };
}

let cached: ContentRegistry | undefined;

/** The app-wide registry built from the default content. */
export function getRegistry(): ContentRegistry {
  cached ??= buildRegistry();
  return cached;
}
