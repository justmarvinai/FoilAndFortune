import type { CardDef } from '@/content/schema/tcg';
import type { ArtManifest } from './artManifest';

/**
 * Card art resolution (docs/06 §8): user override → pre-rendered → runtime render → placeholder.
 * Pure functions over a build-time index, so the order is unit-tested without a browser.
 */

export interface PrerenderedArt {
  url: string;
  width: number;
  height: number;
}

export interface ArtIndex {
  /** Card IDs with a user override at `/art/overrides/cards/<cardId>.webp` (docs/08 §4). */
  overrides: ReadonlySet<string>;
  /** Pre-rendered art by card ID (newest `v<N>` folder wins). */
  prerendered: ReadonlyMap<string, PrerenderedArt>;
}

export type CardArtSource =
  | { kind: 'override'; url: string }
  | { kind: 'prerendered'; url: string; width: number; height: number }
  /** No file: render with the Clay renderer at runtime (lazy-loaded). */
  | { kind: 'runtime' }
  /** Element-tinted placeholder (runtime rendering off or unavailable). */
  | { kind: 'placeholder' }
  /** Basic Essences draw their emblem; they have no illustration. */
  | { kind: 'none' };

export const OVERRIDE_DIR = '/art/overrides/cards/';

/**
 * Builds the index from manifest modules keyed by path (`/public/art/v1/emberdawn/manifest.json`)
 * and override file paths (`/public/art/overrides/cards/gk.emberdawn.012.webp`), as
 * `import.meta.glob` returns them.
 */
export function buildArtIndex(
  manifests: Readonly<Record<string, unknown>>,
  overrideFiles: readonly string[],
): ArtIndex {
  const prerendered = new Map<string, PrerenderedArt & { version: number }>();
  for (const [path, value] of Object.entries(manifests)) {
    const match = /\/art\/v(\d+)\/([^/]+)\/manifest\.json$/.exec(path);
    const manifest = value as Partial<ArtManifest> | undefined;
    if (!match || !manifest?.cards) continue;
    const version = Number(match[1]);
    const base = `/art/v${match[1]}/${match[2]}/`;
    for (const [cardId, entry] of Object.entries(manifest.cards)) {
      const existing = prerendered.get(cardId);
      if (existing && existing.version >= version) continue;
      prerendered.set(cardId, {
        url: `${base}${entry.file}`,
        width: entry.width,
        height: entry.height,
        version,
      });
    }
  }
  const overrides = new Set<string>();
  for (const file of overrideFiles) {
    const match = /\/art\/overrides\/cards\/([^/]+)\.webp$/.exec(file);
    if (match?.[1]) overrides.add(match[1]);
  }
  return {
    overrides,
    prerendered: new Map(
      [...prerendered].map(([id, { url, width, height }]) => [id, { url, width, height }]),
    ),
  };
}

/** Where a card's art comes from. `runtime: false` stops at pre-rendered art (no renderer). */
export function resolveCardArt(
  card: Pick<CardDef, 'id' | 'kind'>,
  index: ArtIndex,
  options: { runtime: boolean },
): CardArtSource {
  if (index.overrides.has(card.id))
    return { kind: 'override', url: `${OVERRIDE_DIR}${card.id}.webp` };
  if (card.kind === 'essence') return { kind: 'none' };
  const pre = index.prerendered.get(card.id);
  if (pre) return { kind: 'prerendered', ...pre };
  return options.runtime ? { kind: 'runtime' } : { kind: 'placeholder' };
}
