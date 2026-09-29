import type { SpeciesDef } from './schema/species';
import type { BrandDef, CardDef, PackConfigDef, ProductDef, SetDef } from './schema/tcg';
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
}

export interface ContentSource {
  brands: readonly BrandDef[];
  species: readonly SpeciesDef[];
  sets: readonly SetDef[];
  cards: readonly CardDef[];
  packConfigs: readonly PackConfigDef[];
  products: readonly ProductDef[];
}

export const defaultContentSource: ContentSource = {
  brands: [glimmerkin],
  species: gkSpecies,
  sets: [emberdawn],
  cards: emberdawnCards,
  packConfigs: [gkModernBooster],
  products: emberdawnProducts,
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
  };
}

let cached: ContentRegistry | undefined;

/** The app-wide registry built from the default content. */
export function getRegistry(): ContentRegistry {
  cached ??= buildRegistry();
  return cached;
}
