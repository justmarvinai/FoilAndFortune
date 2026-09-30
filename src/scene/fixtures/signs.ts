import type { CanvasTexture } from 'three';
import { cachedTexture, FONTS, fitText, liveCanvasTexture, roundRectPath } from '../lib/canvas';

/** Chunky painted shop signs: rounded plate, ink outline, display font (docs/04 §8 stickers). */
export function signTexture(
  text: string,
  background: string,
  foreground: string,
  width = 512,
  height = 128,
): CanvasTexture {
  return cachedTexture(`sign:${text}:${background}:${foreground}:${width}x${height}`, () =>
    liveCanvasTexture(width, height, (ctx, w, h) => {
      ctx.fillStyle = '#1E2340';
      roundRectPath(ctx, 0, 0, w, h, h * 0.28);
      ctx.fill();
      ctx.fillStyle = background;
      roundRectPath(ctx, 6, 6, w - 12, h - 12, h * 0.24);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      roundRectPath(ctx, 16, 12, w - 32, h * 0.18, h * 0.09);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = h * 0.08;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1E2340';
      ctx.fillStyle = foreground;
      fitText(ctx, text, w / 2, h * 0.55, w * 0.86, h * 0.62, FONTS.display, 'both');
    }),
  );
}

/** Handwritten price tag on a coral card (Caveat, docs/04 §3 "price tags"). */
export function priceTagTexture(title: string, price: string): CanvasTexture {
  return cachedTexture(`tag:${title}:${price}`, () =>
    liveCanvasTexture(256, 192, (ctx, w, h) => {
      ctx.fillStyle = '#1E2340';
      roundRectPath(ctx, 0, 0, w, h, 26);
      ctx.fill();
      ctx.fillStyle = '#FF6F59';
      roundRectPath(ctx, 6, 6, w - 12, h - 12, 22);
      ctx.fill();
      ctx.fillStyle = '#FFF6E5';
      ctx.beginPath();
      ctx.arc(w / 2, 26, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFF6E5';
      fitText(ctx, title, w / 2, 70, w - 36, 34, FONTS.display);
      ctx.fillStyle = '#FFE58A';
      fitText(ctx, price, w / 2, 132, w - 30, 62, FONTS.hand);
    }),
  );
}
