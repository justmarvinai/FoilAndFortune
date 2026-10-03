import { type ArtIndex, buildArtIndex } from './cardArt';

/**
 * The art index, built at build time: every pre-rendered set manifest is bundled (they're small)
 * and override files are only listed, never imported, so nothing loads until a card shows.
 */
const manifests = import.meta.glob('/public/art/v*/*/manifest.json', {
  eager: true,
  import: 'default',
});
const overrides = Object.keys(
  import.meta.glob('/public/art/overrides/cards/*.webp', { query: '?url', import: 'default' }),
);

export const artIndex: ArtIndex = buildArtIndex(manifests, overrides);
