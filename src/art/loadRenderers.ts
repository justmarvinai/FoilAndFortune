import type { CreatureArtRenderer, CreatureArtRequest } from '@/art/types';

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

export { artRequestFor } from './cardArt';

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
