import type { ZodType } from '@/core/zod';
import type { ContentSource } from './registry';
import { speciesSchema } from './schema/species';
import { brandSchema, cardSchema, packConfigSchema, productSchema, setSchema } from './schema/tcg';

/**
 * Content validation (docs/06 §12): schemas, unique IDs, cross-references, card numbering
 * rules and a name blocklist. Used by `npm run content:validate` and by unit tests.
 */

/** Well-known franchise names we must never reuse (fictional brands only, CLAUDE.md rule 11). */
const NAME_BLOCKLIST = [
  'pokemon',
  'pokémon',
  'pikachu',
  'charizard',
  'eevee',
  'magic: the gathering',
  'yu-gi-oh',
  'lorcana',
  'digimon',
  'psa',
  'beckett',
];

/** Rarities numbered past the set total ("secret" numbering, docs/03 §1.1). */
const SECRET_NUMBERED = new Set(['illustrationRare', 'secretRare', 'mythicRare']);

export interface ValidationIssue {
  where: string;
  message: string;
}

export function validateContent(source: ContentSource): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (where: string, message: string) => issues.push({ where, message });

  const check = <T>(schema: ZodType<T>, items: readonly { id: string }[], kind: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      const result = schema.safeParse(item);
      if (!result.success) {
        for (const issue of result.error.issues) {
          add(`${kind} ${item.id}`, `${issue.path.join('.')}: ${issue.message}`);
        }
      }
      if (seen.has(item.id)) add(`${kind} ${item.id}`, 'duplicate id');
      seen.add(item.id);
    }
    return seen;
  };

  const brandIds = check(brandSchema, source.brands, 'brand');
  const speciesIds = check(speciesSchema, source.species, 'species');
  const setIds = check(setSchema, source.sets, 'set');
  check(cardSchema, source.cards, 'card');
  const packIds = check(packConfigSchema, source.packConfigs, 'pack');
  const productIds = check(productSchema, source.products, 'product');

  const setsById = new Map(source.sets.map((set) => [set.id, set]));

  for (const species of source.species) {
    if (!brandIds.has(species.brandId))
      add(`species ${species.id}`, `unknown brand ${species.brandId}`);
    if (species.evolvesFrom && !speciesIds.has(species.evolvesFrom)) {
      add(`species ${species.id}`, `unknown evolvesFrom ${species.evolvesFrom}`);
    }
  }

  for (const set of source.sets) {
    if (!brandIds.has(set.brandId)) add(`set ${set.id}`, `unknown brand ${set.brandId}`);
  }

  for (const card of source.cards) {
    const where = `card ${card.id}`;
    const set = setsById.get(card.setId);
    if (!set) {
      add(where, `unknown set ${card.setId}`);
    } else {
      const expectedId = `${card.setId}.${String(card.number).padStart(3, '0')}`;
      if (card.id !== expectedId) add(where, `id should be ${expectedId}`);
      const secret = SECRET_NUMBERED.has(card.rarity);
      if (secret && card.number <= set.totalMain)
        add(where, `${card.rarity} must be numbered past ${set.totalMain}`);
      if (!secret && card.number > set.totalMain)
        add(where, `${card.rarity} must be numbered ≤ ${set.totalMain}`);
    }
    if (card.speciesId && !speciesIds.has(card.speciesId))
      add(where, `unknown species ${card.speciesId}`);
    if (card.art.speciesId && !speciesIds.has(card.art.speciesId)) {
      add(where, `unknown art species ${card.art.speciesId}`);
    }
    if (card.kind === 'creature' && (!card.hp || !card.element))
      add(where, 'creatures need hp and element');
  }

  for (const product of source.products) {
    const where = `product ${product.id}`;
    if (product.setId && !setIds.has(product.setId)) add(where, `unknown set ${product.setId}`);
    if (product.packConfigId && !packIds.has(product.packConfigId)) {
      add(where, `unknown pack config ${product.packConfigId}`);
    }
    for (const entry of product.contents) {
      if (entry.type === 'pack' && !productIds.has(entry.productId)) {
        add(where, `contents reference unknown product ${entry.productId}`);
      }
    }
  }

  const names = [
    ...source.species.map((s) => ({ where: `species ${s.id}`, name: s.name })),
    ...source.cards.map((c) => ({ where: `card ${c.id}`, name: c.name })),
    ...source.sets.map((s) => ({ where: `set ${s.id}`, name: s.name })),
    ...source.brands.map((b) => ({ where: `brand ${b.id}`, name: `${b.name} ${b.publisher}` })),
  ];
  for (const { where, name } of names) {
    const lower = name.toLowerCase();
    const hit = NAME_BLOCKLIST.find((blocked) => lower.includes(blocked));
    if (hit) add(where, `name "${name}" contains blocked franchise term "${hit}"`);
  }

  return issues;
}
