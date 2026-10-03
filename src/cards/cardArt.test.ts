import { describe, expect, it } from 'vitest';
import { buildArtIndex, resolveCardArt } from './cardArt';

const manifest = (cards: Record<string, { file: string }>) => ({
  format: 'ff-art-manifest@1',
  set: 'gk.emberdawn',
  renderer: { id: 'clay', version: '1.1', digest: 'x' },
  cards: Object.fromEntries(
    Object.entries(cards).map(([id, { file }]) => [id, { file, width: 560, height: 378 }]),
  ),
});

const index = buildArtIndex(
  {
    '/public/art/v1/emberdawn/manifest.json': manifest({
      'gk.emberdawn.012': { file: '012.webp' },
      'gk.emberdawn.035': { file: '035.webp' },
    }),
    '/public/art/v2/emberdawn/manifest.json': manifest({
      'gk.emberdawn.035': { file: '035.webp' },
    }),
    '/public/art/v1/broken/manifest.json': { nope: true },
  },
  ['/public/art/overrides/cards/gk.emberdawn.012.webp', '/public/art/overrides/cards/readme.txt'],
);

const creature = (id: string) => ({ id, kind: 'creature' as const });

describe('card art resolution (docs/06 §8)', () => {
  it('prefers a user override over the pre-rendered file', () => {
    expect(resolveCardArt(creature('gk.emberdawn.012'), index, { runtime: true })).toEqual({
      kind: 'override',
      url: '/art/overrides/cards/gk.emberdawn.012.webp',
    });
  });

  it('serves pre-rendered art from the newest versioned folder', () => {
    expect(resolveCardArt(creature('gk.emberdawn.035'), index, { runtime: true })).toEqual({
      kind: 'prerendered',
      url: '/art/v2/emberdawn/035.webp',
      width: 560,
      height: 378,
    });
  });

  it('falls back to a runtime render, or the placeholder when runtime rendering is off', () => {
    expect(resolveCardArt(creature('gk.emberdawn.099'), index, { runtime: true })).toEqual({
      kind: 'runtime',
    });
    expect(resolveCardArt(creature('gk.emberdawn.099'), index, { runtime: false })).toEqual({
      kind: 'placeholder',
    });
  });

  it('gives basic Essences no illustration (they draw an emblem) unless overridden', () => {
    expect(
      resolveCardArt({ id: 'gk.essence.001', kind: 'essence' }, index, { runtime: true }),
    ).toEqual({
      kind: 'none',
    });
  });

  it('ignores malformed manifests and non-webp override files', () => {
    expect(index.prerendered.size).toBe(2);
    expect([...index.overrides]).toEqual(['gk.emberdawn.012']);
  });
});
