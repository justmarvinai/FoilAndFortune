import { describe, expect, it } from 'vitest';
import { getRegistry } from '@/content/registry';
import { artRequestFor } from './loadRenderers';

function requestFor(cardId: string, scale?: number) {
  const registry = getRegistry();
  const card = registry.cards.get(cardId);
  const species = registry.species.get(card?.art.speciesId ?? card?.speciesId ?? '');
  if (!card || !species) throw new Error(`missing test content ${cardId}`);
  return artRequestFor(card, species, scale);
}

describe('artRequestFor', () => {
  it('sizes window art to the card art box and full art to the whole card', () => {
    expect(requestFor('gk.emberdawn.035')).toMatchObject({
      width: 648,
      height: 438,
      composition: 'window',
    });
    expect(requestFor('gk.emberdawn.108')).toMatchObject({
      width: 500,
      height: 700,
      composition: 'fullArt',
    });
    expect(requestFor('gk.emberdawn.108', 2)).toMatchObject({ width: 1000, height: 1400 });
  });

  it("uses the species' home biome and the card's pose, time of day and seed", () => {
    expect(requestFor('gk.emberdawn.035')).toMatchObject({
      element: 'volt',
      biome: 'storm-meadow',
      pose: 'idle',
      timeOfDay: 'dusk',
      seed: 3501,
      background: 'biome',
    });
    expect(requestFor('gk.emberdawn.121')).toMatchObject({ biome: 'volcano-dawn', pose: 'action' });
  });

  it('is deterministic: the same card always produces the same request', () => {
    expect(requestFor('gk.emberdawn.024')).toEqual(requestFor('gk.emberdawn.024'));
  });
});
