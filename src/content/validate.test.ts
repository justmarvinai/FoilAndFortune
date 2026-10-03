import { describe, expect, it } from 'vitest';
import { defaultContentSource } from './registry';
import { validateContent } from './validate';

describe('content validation', () => {
  it('default content is valid', () => {
    expect(validateContent(defaultContentSource)).toEqual([]);
  });

  it('pack slot tables have positive total weight', () => {
    for (const pack of defaultContentSource.packConfigs) {
      for (const slot of pack.slots) {
        expect(slot.table.reduce((sum, row) => sum + row.weight, 0)).toBeGreaterThan(0);
      }
    }
  });

  it('flags product contents that list unknown cards', () => {
    const [product] = defaultContentSource.products;
    if (!product) throw new Error('fixture needs at least one product');
    const issues = validateContent({
      ...defaultContentSource,
      products: [
        ...defaultContentSource.products.filter((p) => p.id !== product.id),
        {
          ...product,
          contents: [
            { type: 'fixedCards', cards: [{ cardId: 'gk.emberdawn.998' }] },
            { type: 'promoPool', cardIds: ['gk.promo.999'], count: 1 },
            { type: 'guaranteedHoloPool', cardIds: ['gk.emberdawn.997'] },
          ],
        },
      ],
    });
    const text = issues.map((issue) => issue.message).join('\n');
    for (const id of ['gk.emberdawn.998', 'gk.promo.999', 'gk.emberdawn.997'])
      expect(text).toContain(`contents reference unknown card ${id}`);
  });

  it('flags bad references, numbering and blocked names', () => {
    const [card] = defaultContentSource.cards;
    if (!card) throw new Error('fixture needs at least one card');
    const issues = validateContent({
      ...defaultContentSource,
      cards: [
        { ...card, id: 'gk.emberdawn.999', number: 999, speciesId: 'gk.species.nope' },
        { ...card, id: 'gk.emberdawn.013', number: 13, name: 'Pikachu Knockoff' },
      ],
    });
    const text = issues.map((issue) => issue.message).join('\n');
    expect(text).toContain('unknown species gk.species.nope');
    expect(text).toContain('must be numbered ≤ 100');
    expect(text).toContain('blocked franchise term');
  });
});
