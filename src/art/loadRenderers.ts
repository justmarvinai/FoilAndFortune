import type { BiomeId, CreatureArtRenderer, CreatureArtRequest } from '@/art/types';
import type { SpeciesDef } from '@/content/schema/species';
import type { CardDef } from '@/content/schema/tcg';

/**
 * Discovers art-style modules (`src/art/<style>/renderer.ts`) at build time. Styles are optional
 * and pluggable: a missing module simply isn't offered.
 */
const loaders = import.meta.glob<Record<string, unknown>>('./*/renderer.ts');

function isRenderer(value: unknown): value is CreatureArtRenderer {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CreatureArtRenderer>;
  return typeof candidate.render === 'function' && typeof candidate.id === 'string';
}

let pending: Promise<Map<string, CreatureArtRenderer>> | undefined;

export function loadRenderers(): Promise<Map<string, CreatureArtRenderer>> {
  pending ??= (async () => {
    const found = new Map<string, CreatureArtRenderer>();
    for (const [path, load] of Object.entries(loaders)) {
      try {
        const module = await load();
        for (const value of Object.values(module))
          if (isRenderer(value)) found.set(value.id, value);
      } catch (error) {
        console.error(`Failed to load art renderer ${path}`, error);
      }
    }
    return found;
  })();
  return pending;
}

const BIOMES: readonly BiomeId[] = ['storm-meadow', 'volcano-dawn', 'lagoon'];

function asBiome(value: string): BiomeId | undefined {
  return BIOMES.find((biome) => biome === value);
}

/** Card art window ≈ 1.48:1 (see cards.css); full art is the whole 5:7 card. */
export function artRequestFor(card: CardDef, species: SpeciesDef, scale = 1): CreatureArtRequest {
  const full = card.art.composition === 'fullArt';
  const biome = asBiome(card.art.biome ?? species.biome);
  return {
    genome: species.genome,
    element: species.element,
    width: Math.round((full ? 500 : 648) * scale),
    height: Math.round((full ? 700 : 438) * scale),
    composition: card.art.composition,
    pose: card.art.pose,
    background: 'biome',
    ...(biome ? { biome } : {}),
    timeOfDay: card.art.timeOfDay,
    seed: card.art.seed,
  };
}

/** Sequential render queue: art styles may share one GPU context, and serial is kinder to it. */
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<{ url: string; ms: number }>>();

export function renderCached(
  renderer: CreatureArtRenderer,
  request: CreatureArtRequest,
  key: string,
): Promise<{ url: string; ms: number }> {
  const cacheKey = `${renderer.id}|${key}`;
  let result = cache.get(cacheKey);
  if (!result) {
    result = queue.then(async () => {
      const start = performance.now();
      const blob = await renderer.render(request);
      return { url: URL.createObjectURL(blob), ms: Math.round(performance.now() - start) };
    });
    queue = result.catch(() => undefined);
    cache.set(cacheKey, result);
  }
  return result;
}
