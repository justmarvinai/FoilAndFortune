import { useEffect, useState } from 'react';
import type { CardDef } from '@/content/schema/tcg';
import { artIndex } from './artIndex';
import { type CardArtSource, resolveCardArt } from './cardArt';

export interface CardArtState {
  /** Image URL to show, if any (override, pre-rendered file or rendered object URL). */
  url?: string;
  source: CardArtSource['kind'];
  status: 'ready' | 'loading' | 'error';
  /** Runtime render time (debug pages). */
  ms?: number;
}

export interface UseCardArtOptions {
  /**
   * Allow the runtime fallback (lazy-loads the Clay renderer when a card has no file). Off, a
   * card without a file shows the placeholder and the renderer is never loaded.
   */
  runtime?: boolean;
  /** Skip the files and render live (debug galleries comparing against the pre-render). */
  live?: boolean;
}

/**
 * A card's art (docs/06 §8): user override → pre-rendered WebP (from the build-time manifests)
 * → runtime render (the Clay renderer, lazy-loaded via loadRenderers + renderCached) →
 * placeholder. Pages that only show pre-rendered art never import the renderer.
 */
export function useCardArt(card: CardDef, options: UseCardArtOptions = {}): CardArtState {
  const { runtime = true, live = false } = options;
  const resolved = live
    ? ({ kind: 'runtime' } as const)
    : resolveCardArt(card, artIndex, { runtime });
  const [rendered, setRendered] = useState<{
    key: string;
    url?: string;
    ms?: number;
    error?: boolean;
  }>();
  const key = `${card.id}|${live ? 'live' : 'auto'}`;

  useEffect(() => {
    if (resolved.kind !== 'runtime') return;
    let alive = true;
    (async () => {
      try {
        const [{ loadRenderers, renderCached, artRequestFor }, { getRegistry }] = await Promise.all(
          [import('@/art/loadRenderers'), import('@/content/registry')],
        );
        const renderer = (await loadRenderers()).get('clay');
        if (!renderer) throw new Error('no art renderer');
        const species = getRegistry().species.get(card.art.speciesId ?? card.speciesId ?? '');
        const result = await renderCached(renderer, artRequestFor(card, species), card.id);
        if (alive) setRendered({ key, url: result.url, ms: result.ms });
      } catch {
        if (alive) setRendered({ key, error: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, [resolved.kind, card, key]);

  if (resolved.kind === 'override' || resolved.kind === 'prerendered') {
    return { url: resolved.url, source: resolved.kind, status: 'ready' };
  }
  if (resolved.kind !== 'runtime') return { source: resolved.kind, status: 'ready' };
  const mine = rendered?.key === key ? rendered : undefined;
  if (mine?.error) return { source: 'placeholder', status: 'error' };
  return mine?.url
    ? {
        url: mine.url,
        source: 'runtime',
        status: 'ready',
        ...(mine.ms !== undefined ? { ms: mine.ms } : {}),
      }
    : { source: 'runtime', status: 'loading' };
}
