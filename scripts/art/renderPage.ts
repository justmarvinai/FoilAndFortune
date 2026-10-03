/**
 * Browser half of `npm run art:render` (scripts/art/render.ts): renders one request with the Clay
 * renderer and encodes it to WebP on a canvas, stepping the quality down until the file fits its
 * budget (docs/08 §5). Loaded by scripts/art/render.html through the Vite dev server.
 */
import { clayDeviceInfo, renderClayArt } from '@/art/clay/renderer';
import type { CreatureArtRequest } from '@/art/types';

export interface EncodedArt {
  base64: string;
  bytes: number;
  quality: number;
  renderMs: number;
  type: string;
}

declare global {
  interface Window {
    __renderArt?: (
      request: CreatureArtRequest,
      quality: 'draft' | 'final',
      budgetBytes: number,
    ) => Promise<EncodedArt>;
    __renderDevice?: () => string;
  }
}

const START_QUALITY = 0.86;
const MIN_QUALITY = 0.5;

function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(text);
}

window.__renderArt = async (request, quality, budgetBytes) => {
  const { blob, ms } = await renderClayArt(request, { quality });
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(bitmap, 0, 0);
  let q = START_QUALITY;
  let webp = await canvas.convertToBlob({ type: 'image/webp', quality: q });
  while (webp.size > budgetBytes && q > MIN_QUALITY) {
    q = Math.max(MIN_QUALITY, q - 0.04);
    webp = await canvas.convertToBlob({ type: 'image/webp', quality: q });
  }
  const bytes = new Uint8Array(await webp.arrayBuffer());
  return {
    base64: toBase64(bytes),
    bytes: bytes.length,
    quality: q,
    renderMs: ms,
    type: webp.type,
  };
};
window.__renderDevice = () => clayDeviceInfo().renderer;
