import type { CreatureArtRenderer, CreatureArtRequest } from '@/art/types';
import { composeSticker, type StickerOptions } from './compose';

/**
 * Style B, "Sticker Pop" (docs/04 §6.1): bold-outline, cel-shaded vector creatures built from a
 * data-driven SVG part kit that interprets the renderer-agnostic creature genome.
 *
 *   const svg = buildStickerSvg({ genome, element, width: 640, height: 440, composition: 'window' });
 *   const png = await stickerRenderer.render({ ...same request });
 */

export type { StickerOptions };

/** Crisp vector output for places that can use SVG directly. Pure and deterministic. */
export function buildStickerSvg(request: CreatureArtRequest, options?: StickerOptions): string {
  return composeSticker(request, options);
}

/** Rasterize an SVG string to a PNG Blob of exactly `width`×`height` (browser only). */
export async function rasterizeSvg(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image(width, height);
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('2D canvas unavailable');
    g.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))),
        'image/png',
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const stickerRenderer: CreatureArtRenderer = {
  id: 'sticker',
  label: 'Sticker Pop',
  render(request) {
    const width = Math.max(16, Math.round(request.width));
    const height = Math.max(16, Math.round(request.height));
    return rasterizeSvg(buildStickerSvg({ ...request, width, height }), width, height);
  },
};
