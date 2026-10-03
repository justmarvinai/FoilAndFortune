import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@/content/registry';
import type { ProductDef, ProductKind } from '@/content/schema/tcg';
import { MASCOT_IDS, mascotSvg } from './mascots';
import { ART_BOX, artShape, packsInside, productArtSvg } from './productArt';
import { setArtStyle, wrapperVariant } from './setStyles';
import { esc, estimateTextWidth, hashString, n } from './svg';

const content = buildRegistry();
const emberdawn = content.sets.get('gk.emberdawn');
const products = [...content.products.values()];

/** Minimal well-formedness check: every opened tag is closed in order (no DOM in node tests). */
function assertBalanced(svg: string): void {
  const stack: string[] = [];
  const tags = svg.match(/<\/?[a-zA-Z][^>]*>/g) ?? [];
  for (const tag of tags) {
    if (tag.endsWith('/>')) continue;
    const name = /^<\/?([a-zA-Z]+)/.exec(tag)?.[1] ?? '';
    if (tag.startsWith('</')) expect(stack.pop()).toBe(name);
    else stack.push(name);
  }
  expect(stack).toEqual([]);
}

function ids(svg: string): string[] {
  return [...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1] ?? '');
}

describe('productArtSvg', () => {
  it('renders every Emberdawn product as balanced, self-contained SVG', () => {
    expect(products.length).toBeGreaterThan(0);
    for (const product of products) {
      const svg = productArtSvg(product, emberdawn, { brandName: 'Glimmerkin', cardsPerPack: 10 });
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      assertBalanced(svg);
      // Every url(#…) reference resolves to an id defined in the same SVG.
      const defined = new Set(ids(svg));
      for (const ref of svg.matchAll(/url\(#([^)]+)\)/g))
        expect(defined.has(ref[1] ?? '')).toBe(true);
      // No external resources: the 3D scene may rasterize this string offline.
      expect(svg).not.toMatch(/href="http|@import/);
    }
  });

  it('is deterministic and pure', () => {
    for (const product of products) {
      const a = productArtSvg(product, emberdawn, { variant: 2, brandName: 'Glimmerkin' });
      const b = productArtSvg(product, emberdawn, { variant: 2, brandName: 'Glimmerkin' });
      expect(a).toBe(b);
    }
  });

  it('namespaces every id with the prefix, so inline copies never collide', () => {
    const booster = content.products.get('gk.emberdawn.booster') as ProductDef;
    const one = productArtSvg(booster, emberdawn, { idPrefix: 'one' });
    const two = productArtSvg(booster, emberdawn, { idPrefix: 'two' });
    expect(ids(one).length).toBeGreaterThan(0);
    expect(ids(one).every((id) => id.startsWith('one-'))).toBe(true);
    expect(ids(two).every((id) => id.startsWith('two-'))).toBe(true);
    expect(new Set(ids(one)).size).toBe(ids(one).length);
  });

  it('rotates booster wrappers through the set creatures', () => {
    const booster = content.products.get('gk.emberdawn.booster') as ProductDef;
    const variants = [0, 1, 2, 3].map((variant) =>
      productArtSvg(booster, emberdawn, { variant, idPrefix: 'x' }),
    );
    expect(new Set(variants).size).toBe(4);
    expect(productArtSvg(booster, emberdawn, { variant: 4, idPrefix: 'x' })).toBe(variants[0]);
    const style = setArtStyle(emberdawn);
    expect(style.variants.map((variant) => variant.mascot)).toEqual([
      'solaryx',
      'magmadillo',
      'boltbuck',
      'emberpup',
    ]);
    expect(wrapperVariant(style, -1)).toBe(style.variants[3]);
  });

  it('prints language-neutral text only: content names and numbers', () => {
    const box = content.products.get('gk.emberdawn.box') as ProductDef;
    const svg = productArtSvg(box, emberdawn, { brandName: 'Glimmerkin' });
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);
    expect(texts).toContain('EMBERDAWN');
    expect(texts).toContain('GLIMMERKIN');
    expect(texts).toContain('36');
    for (const text of texts) expect(text).toMatch(/^[A-Z0-9 ?'&;:.!-]*$/);
  });

  it('drops fine print at icon size', () => {
    const booster = content.products.get('gk.emberdawn.booster') as ProductDef;
    const icon = productArtSvg(booster, emberdawn, {
      detail: 'icon',
      brandName: 'Glimmerkin',
      cardsPerPack: 10,
    });
    expect(icon).not.toContain('<text');
    const full = productArtSvg(booster, emberdawn, { brandName: 'Glimmerkin', cardsPerPack: 10 });
    expect(full).toContain('>10<');
  });

  it('escapes names from content and squeezes long ones into their band', () => {
    const starter = content.products.get('gk.emberdawn.starter-ember') as ProductDef;
    const svg = productArtSvg(
      { ...starter, name: 'Starter Deck: <Tom & "Jerry"> Extravaganza Deluxe' },
      { ...(emberdawn ?? { id: 'x', code: 'XXX' }), name: 'A Very Long Set Name Indeed' },
    );
    assertBalanced(svg);
    expect(svg).toContain('&lt;TOM &amp; &quot;JERRY&quot;&gt;');
    expect(svg).toContain('lengthAdjust="spacingAndGlyphs"');
  });

  it('never renders blank for unknown sets or product kinds', () => {
    const kinds: ProductKind[] = ['tin', 'bundle', 'eliteBox', 'mysteryBox', 'collection'];
    for (const kind of kinds) {
      const product = {
        id: `gk.future.${kind}`,
        kind,
        name: 'Future Thing',
        contents: [{ type: 'pack' as const, productId: 'gk.future.booster', count: 6 }],
      };
      const svg = productArtSvg(product, { id: 'gk.future', code: 'FUT', name: 'Future' });
      assertBalanced(svg);
      expect(svg).toContain(`viewBox="0 0 ${ART_BOX.box.width} ${ART_BOX.box.height}"`);
      expect(svg).toContain('>6<');
    }
    expect(productArtSvg(products[0] as ProductDef, undefined)).toContain('<svg');
  });

  it('maps kinds to shapes and counts packs inside', () => {
    expect(artShape('booster')).toBe('pack');
    expect(artShape('blister')).toBe('blister');
    expect(artShape('starterDeck')).toBe('deck');
    expect(artShape('box')).toBe('box');
    expect(artShape('tin')).toBe('box');
    expect(packsInside(content.products.get('gk.emberdawn.box') as ProductDef)).toBe(36);
    expect(packsInside(content.products.get('gk.emberdawn.blister') as ProductDef)).toBe(3);
  });
});

describe('mascots', () => {
  it('draws every creature with and without a halo', () => {
    for (const id of MASCOT_IDS) {
      const plain = mascotSvg(id);
      const halo = mascotSvg(id, { halo: '#FFFFFF' });
      expect(plain).not.toMatch(/NaN|undefined/);
      expect(halo.length).toBeGreaterThan(plain.length);
      assertBalanced(`<g>${halo}</g>`);
    }
  });
});

describe('svg helpers', () => {
  it('escapes XML, formats numbers compactly and hashes deterministically', () => {
    expect(esc(`<a & 'b' "c">`)).toBe('&lt;a &amp; &apos;b&apos; &quot;c&quot;&gt;');
    expect(n(1.005)).toBe('1');
    expect(n(-0.001)).toBe('0');
    expect(n(12.3456)).toBe('12.35');
    expect(hashString('emberdawn')).toBe(hashString('emberdawn'));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(estimateTextWidth('MW', 10)).toBeGreaterThan(estimateTextWidth('II', 10));
  });
});
