import { describe, expect, it } from 'vitest';
import type { ArtComposition, CreatureArtRequest } from '@/art/types';
import type { CreatureGenome, GenomeExtra } from '@/content/schema/genome';
import { gkSpecies, sparkit } from '@/content/tcg/gk/species';
import { buildStickerSvg } from './renderer';

const SIZE: Record<ArtComposition, [number, number]> = { window: [640, 440], fullArt: [500, 700] };

function request(overrides: Partial<CreatureArtRequest> = {}): CreatureArtRequest {
  const composition = overrides.composition ?? 'window';
  const [width, height] = SIZE[composition];
  return {
    genome: sparkit.genome,
    element: sparkit.element,
    width,
    height,
    composition,
    seed: 7,
    ...overrides,
  };
}

function ids(svg: string): string[] {
  return [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1] ?? '');
}

function references(svg: string): string[] {
  return [
    ...[...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1] ?? ''),
    ...[...svg.matchAll(/href="#([^"]+)"/g)].map((m) => m[1] ?? ''),
  ];
}

function expectSane(svg: string): void {
  expect(svg.startsWith('<svg')).toBe(true);
  expect(svg.endsWith('</svg>')).toBe(true);
  expect(svg).not.toMatch(/NaN|Infinity|undefined|null/);
  const defined = new Set(ids(svg));
  // Every id is unique and every reference resolves inside the document.
  expect(defined.size).toBe(ids(svg).length);
  for (const ref of references(svg)) expect(defined.has(ref)).toBe(true);
}

describe('buildStickerSvg', () => {
  it('is deterministic: the same request gives the identical SVG', () => {
    for (const species of gkSpecies) {
      for (const composition of ['window', 'fullArt'] as const) {
        const req = request({ genome: species.genome, element: species.element, composition });
        const first = buildStickerSvg(req);
        expect(buildStickerSvg({ ...req })).toBe(first);
        expectSane(first);
      }
    }
  });

  it('changes the scene and particles with the seed', () => {
    const a = buildStickerSvg(request({ seed: 1 }));
    const b = buildStickerSvg(request({ seed: 2 }));
    expect(a).not.toBe(b);
  });

  it('outputs the requested size', () => {
    const svg = buildStickerSvg(request({ composition: 'fullArt', width: 250, height: 350 }));
    expect(svg).toContain('width="250" height="350" viewBox="0 0 250 350"');
  });

  it('draws no scenery for transparent backgrounds', () => {
    const scene = buildStickerSvg(request());
    const sticker = buildStickerSvg(request({ background: 'transparent' }));
    expect(scene).toContain('linearGradient');
    expect(sticker).not.toContain('linearGradient');
    expect(sticker.length).toBeLessThan(scene.length);
    expectSane(sticker);
  });

  it('prefixes ids so several SVGs can be inlined in one page', () => {
    const svg = buildStickerSvg(request(), { idPrefix: 'card7' });
    for (const id of ids(svg)) expect(id.startsWith('card7-')).toBe(true);
  });

  it('covers every biome and time of day', () => {
    for (const biome of ['storm-meadow', 'volcano-dawn', 'lagoon'] as const) {
      for (const timeOfDay of ['day', 'dusk', 'night'] as const) {
        expectSane(buildStickerSvg(request({ biome, timeOfDay, composition: 'fullArt' })));
      }
    }
  });

  it('renders any genome the schema allows, not just the spike species', () => {
    const base: CreatureGenome = sparkit.genome;
    const variants: CreatureGenome[] = [];
    const plans: CreatureGenome['plan'][] = [
      'quadruped',
      'amphibian',
      'biped',
      'bird',
      'serpent',
      'blob',
      'insect',
      'fish',
    ];
    const heads: CreatureGenome['head']['shape'][] = [
      'round',
      'fox',
      'pup',
      'axolotl',
      'feline',
      'beaked',
    ];
    const ears: CreatureGenome['ears']['shape'][] = [
      'none',
      'pointed',
      'round',
      'floppy',
      'long',
      'fin',
    ];
    const tails: CreatureGenome['tail']['shape'][] = [
      'none',
      'fluffy',
      'spark',
      'flame',
      'fin',
      'leaf',
      'curl',
      'bolt',
    ];
    const eyes: CreatureGenome['face']['eyes'][] = ['round', 'sparkle', 'sleepy', 'fierce'];
    const mouths: CreatureGenome['face']['mouth'][] = [
      'smile',
      'grin',
      'fang',
      'open',
      'beak',
      'none',
    ];
    const fx: CreatureGenome['elementFx'][] = [
      'sparks',
      'embers',
      'bubbles',
      'petals',
      'dust',
      'runes',
      'wisps',
      'snow',
      'none',
    ];
    const extras: GenomeExtra[] = [
      { kind: 'gills', count: 4, color: 'accent' },
      { kind: 'stripes', where: 'legs', count: 3, color: 'accent' },
      { kind: 'stripes', where: 'tail', count: 1, color: 'accent' },
      { kind: 'head-tuft', shape: 'leaf', color: 'glow' },
      { kind: 'head-tuft', shape: 'fluff', color: 'secondary' },
      { kind: 'forehead-mark', shape: 'bolt', color: 'glow' },
      { kind: 'forehead-mark', shape: 'star', color: 'glow' },
      { kind: 'forehead-mark', shape: 'drop', color: 'glow' },
      { kind: 'forehead-mark', shape: 'diamond', color: 'glow' },
      { kind: 'forehead-mark', shape: 'flame', color: 'glow' },
      { kind: 'socks', color: 'accent' },
      { kind: 'spots', count: 12, color: 'secondary' },
    ];
    plans.forEach((plan, i) => {
      variants.push({
        ...base,
        plan,
        head: {
          ...base.head,
          shape: heads[i % heads.length] ?? 'round',
          muzzle: i % 2 ? 'none' : 'short',
        },
        ears: { ...base.ears, shape: ears[i % ears.length] ?? 'none' },
        tail: { ...base.tail, shape: tails[i % tails.length] ?? 'none' },
        face: {
          ...base.face,
          eyes: eyes[i % eyes.length] ?? 'round',
          mouth: mouths[i % mouths.length] ?? 'smile',
          blush: true,
        },
        elementFx: fx[i % fx.length] ?? 'none',
        extras: extras.slice(i % 4, (i % 4) + 6),
      });
    });
    // Extreme proportions stay renderable.
    variants.push({ ...base, size: 1.5, proportions: { head: 1, body: 1, legs: 1, tail: 1 } });
    variants.push({ ...base, size: 0.5, proportions: { head: 0, body: 0, legs: 0, tail: 0 } });
    for (const genome of variants) {
      for (const pose of ['idle', 'happy', 'action'] as const) {
        expectSane(buildStickerSvg(request({ genome, pose })));
      }
    }
  });
});
