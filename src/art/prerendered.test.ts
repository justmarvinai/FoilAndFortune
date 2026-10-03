import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ArtManifest } from '@/cards/artManifest';
import { getRegistry } from '@/content/registry';
import { artFileName, hasIllustration, PRERENDER_ART, setSlug } from './cardArt';

/** Committed pre-rendered art (npm run art:render): files exist and fit docs/08 §5 budgets. */
const ART = join(process.cwd(), 'public/art');
const manifests = existsSync(ART)
  ? readdirSync(ART)
      .filter((dir) => /^v\d+$/.test(dir))
      .flatMap((version) =>
        readdirSync(join(ART, version)).map((slug) => join(ART, version, slug, 'manifest.json')),
      )
      .filter((path) => existsSync(path))
  : [];

describe('pre-rendered card art', () => {
  it('has a manifest for Emberdawn', () => {
    expect(manifests.some((path) => path.endsWith(join('emberdawn', 'manifest.json')))).toBe(true);
  });

  for (const path of manifests) {
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as ArtManifest;
    it(`${manifest.set}: every entry's file exists and fits its size budget`, () => {
      const dir = join(path, '..');
      for (const [cardId, entry] of Object.entries(manifest.cards)) {
        const file = join(dir, entry.file);
        expect(existsSync(file), cardId).toBe(true);
        const bytes = statSync(file).size;
        expect(bytes, cardId).toBe(entry.bytes);
        expect(bytes, cardId).toBeLessThanOrEqual(PRERENDER_ART[entry.composition].budgetBytes);
        expect([entry.width, entry.height], cardId).toEqual([
          PRERENDER_ART[entry.composition].width,
          PRERENDER_ART[entry.composition].height,
        ]);
        expect(entry.renderer, cardId).toMatch(/^clay@/);
      }
    });

    it(`${manifest.set}: covers every illustrated card of the set`, () => {
      const cards = [...getRegistry().cards.values()].filter(
        (card) => card.setId === manifest.set && hasIllustration(card),
      );
      for (const card of cards) {
        expect(manifest.cards[card.id]?.file, card.id).toBe(artFileName(card));
      }
      expect(path).toContain(join(setSlug(manifest.set), 'manifest.json'));
    });
  }
});
