import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';

/**
 * Canvas helpers for procedural textures (wood grain, pack wrappers, faces, signs). Everything
 * is drawn at load time in code: zero image downloads (CLAUDE.md rule 10, docs/08).
 */

/** Self-hosted font stacks (src/styles/fonts.ts). Canvas text only renders them once loaded. */
export const FONTS = {
  display: '"Lilita One", "Nunito Variable", system-ui, sans-serif',
  ui: '"Nunito Variable", system-ui, sans-serif',
  hand: '"Caveat Variable", "Nunito Variable", cursive',
  card: '"Barlow Condensed", "Barlow", system-ui, sans-serif',
} as const;

export interface Canvas2D {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function createCanvas(width: number, height: number): Canvas2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { canvas, ctx };
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Draws text shrunk to fit `maxWidth`, so labels never overflow whatever the locale. */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  sizePx: number,
  family: string,
  mode: 'fill' | 'stroke' | 'both' = 'fill',
): void {
  let size = sizePx;
  ctx.font = `${size}px ${family}`;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth) {
    size = Math.max(6, Math.floor((size * maxWidth) / measured));
    ctx.font = `${size}px ${family}`;
  }
  if (mode === 'stroke' || mode === 'both') ctx.strokeText(text, x, y);
  if (mode === 'fill' || mode === 'both') ctx.fillText(text, x, y);
}

let fontsPromise: Promise<void> | null = null;

/** Resolves once the display and handwriting fonts are usable by canvas (loads them if needed). */
export function whenFontsReady(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  if (typeof document === 'undefined' || !('fonts' in document)) {
    fontsPromise = Promise.resolve();
    return fontsPromise;
  }
  const loads = [
    '64px "Lilita One"',
    '48px "Caveat Variable"',
    '700 32px "Nunito Variable"',
    '600 32px "Barlow Condensed"',
  ].map((spec) => document.fonts.load(spec).catch(() => []));
  fontsPromise = Promise.all(loads).then(() => undefined);
  return fontsPromise;
}

export interface TextureOptions {
  repeat?: boolean;
  anisotropy?: number;
  /** Colour data (default) vs. data maps such as roughness. */
  srgb?: boolean;
}

export function toTexture(canvas: HTMLCanvasElement, options: TextureOptions = {}): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  if (options.srgb !== false) texture.colorSpace = SRGBColorSpace;
  const wrap = options.repeat ? RepeatWrapping : ClampToEdgeWrapping;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = options.anisotropy ?? 4;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A canvas texture drawn now *and* redrawn once web fonts are ready, so text never ships in a
 * fallback font even if the scene mounts before the fonts arrive.
 */
export function liveCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  options: TextureOptions = {},
): CanvasTexture {
  const { canvas, ctx } = createCanvas(width, height);
  draw(ctx, width, height);
  const texture = toTexture(canvas, options);
  void whenFontsReady().then(() => {
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
    texture.needsUpdate = true;
  });
  return texture;
}

const textureCache = new Map<string, Texture>();

/** Module-level texture cache: procedural textures are deterministic, so build each once. */
export function cachedTexture<T extends Texture>(key: string, make: () => T): T {
  const hit = textureCache.get(key);
  if (hit) return hit as T;
  const texture = make();
  textureCache.set(key, texture);
  return texture;
}
