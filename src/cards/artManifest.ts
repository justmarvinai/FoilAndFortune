/**
 * Shape of a set's pre-rendered art manifest, `public/art/v<N>/<set>/manifest.json`
 * (docs/08 §6), written by `npm run art:render` (scripts/art/render.ts).
 */
export const MANIFEST_FORMAT = 'ff-art-manifest@1';

/** Folder version of the pre-rendered art (`public/art/v<N>`); bump to bust caches on re-render. */
export const ART_VERSION = 1;

export interface ArtManifestEntry {
  /** File name next to the manifest, e.g. `012.webp`. */
  file: string;
  composition: 'window' | 'fullArt';
  width: number;
  height: number;
  seed: number;
  /** What was drawn: `creature`, a prop kind (`potion`, `folk`…) or `scenery` (Arenas). */
  subject: string;
  /** Hash of the genome (or prop spec) the art was rendered from. */
  genomeHash: string;
  /** WebP quality the budget allowed. */
  quality: number;
  bytes: number;
  /** Renderer id and version, e.g. `clay@1.1`. */
  renderer: string;
  /** Hash of all render inputs; unchanged hash = the art is up to date. */
  hash: string;
}

export interface ArtManifest {
  format: string;
  /** Set id, e.g. `gk.emberdawn`. */
  set: string;
  renderer: { id: string; version: string; digest: string };
  cards: Record<string, ArtManifestEntry>;
}
