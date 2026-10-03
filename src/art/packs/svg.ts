/**
 * Tiny string helpers for the product-art composer. Everything is pure and DOM-free, so the same
 * markup can be inlined in React, turned into a data URI, or drawn onto a canvas for the 3D shelf
 * textures (docs/04 §5.5, docs/08 §4 "pack and box art composer").
 */

/** XML-escapes text and attribute values (content names end up inside the markup). */
export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Compact number for path data: at most 2 decimals, no trailing zeros, no `-0`. */
export function n(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/** 32-bit FNV-1a hash: deterministic ids and variant picks without any RNG state. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Makes element ids unique per SVG instance (inline SVGs share the document's id namespace). */
export interface IdFactory {
  (name: string): string;
  /** `url(#id)` reference for fills, clips and filters. */
  url(name: string): string;
}

export function idFactory(prefix: string): IdFactory {
  const safe = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'pa';
  const make = ((name: string) => `${safe}-${name}`) as IdFactory;
  make.url = (name: string) => `url(#${safe}-${name})`;
  return make;
}

export interface Stop {
  offset: number;
  color: string;
  opacity?: number;
}

export function linearGradient(
  id: string,
  stops: readonly Stop[],
  from: [number, number] = [0, 0],
  to: [number, number] = [0, 1],
): string {
  return `<linearGradient id="${id}" x1="${n(from[0])}" y1="${n(from[1])}" x2="${n(to[0])}" y2="${n(to[1])}">${stops
    .map(stopTag)
    .join('')}</linearGradient>`;
}

export function radialGradient(
  id: string,
  stops: readonly Stop[],
  center: [number, number] = [0.5, 0.5],
  radius = 0.5,
): string {
  return `<radialGradient id="${id}" cx="${n(center[0])}" cy="${n(center[1])}" r="${n(radius)}">${stops
    .map(stopTag)
    .join('')}</radialGradient>`;
}

function stopTag(stop: Stop): string {
  const opacity = stop.opacity === undefined ? '' : ` stop-opacity="${n(stop.opacity)}"`;
  return `<stop offset="${n(stop.offset)}" stop-color="${stop.color}"${opacity}/>`;
}

/** Rounded rectangle path (all corners share `r`). */
export function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${n(x + rr)} ${n(y)}H${n(x + w - rr)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + rr)}V${n(
    y + h - rr,
  )}Q${n(x + w)} ${n(y + h)} ${n(x + w - rr)} ${n(y + h)}H${n(x + rr)}Q${n(x)} ${n(y + h)} ${n(
    x,
  )} ${n(y + h - rr)}V${n(y + rr)}Q${n(x)} ${n(y)} ${n(x + rr)} ${n(y)}Z`;
}

/** Closed polygon path from points. */
export function poly(points: readonly (readonly [number, number])[]): string {
  return `${points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${n(x)} ${n(y)}`).join('')}Z`;
}

/**
 * A sunburst of `count` alternating wedges around (cx, cy): the "sunrise" motif behind mascots.
 * Returns one path of the lit wedges only.
 */
export function sunburst(cx: number, cy: number, radius: number, count: number, turn = 0): string {
  let d = '';
  const step = (Math.PI * 2) / count;
  for (let i = 0; i < count; i += 2) {
    const a0 = turn + i * step;
    const a1 = a0 + step;
    d += `M${n(cx)} ${n(cy)}L${n(cx + Math.cos(a0) * radius)} ${n(cy + Math.sin(a0) * radius)}L${n(
      cx + Math.cos(a1) * radius,
    )} ${n(cy + Math.sin(a1) * radius)}Z`;
  }
  return d;
}

/**
 * Estimated rendered width of display-font caps text. We can't measure without a DOM, so wide
 * labels get `textLength` to squeeze them into their band deterministically.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) {
    if (ch === ' ') em += 0.28;
    else if ('IJ1l.,:;!|'.includes(ch)) em += 0.32;
    else if ('MW'.includes(ch)) em += 0.82;
    else em += 0.6;
  }
  return em * fontSize;
}

/** Display font stack: Lilita One inline; chunky system fallbacks when drawn as an image. */
export const DISPLAY_FONT = "'Lilita One','Arial Rounded MT Bold','Arial Black',sans-serif";

export interface TextOptions {
  x: number;
  y: number;
  size: number;
  fill: string;
  /** Maximum width; wider text is squeezed with `textLength`. */
  maxWidth?: number;
  stroke?: string;
  strokeWidth?: number;
  anchor?: 'start' | 'middle' | 'end';
  letterSpacing?: number;
  opacity?: number;
}

/** A single line of display text, outlined like a sticker when `stroke` is set. */
export function textTag(text: string, o: TextOptions): string {
  const anchor = o.anchor ?? 'middle';
  const spacing = o.letterSpacing ?? 0;
  const width = estimateTextWidth(text, o.size) + spacing * Math.max(0, text.length - 1);
  const squeeze =
    o.maxWidth !== undefined && width > o.maxWidth
      ? ` textLength="${n(o.maxWidth)}" lengthAdjust="spacingAndGlyphs"`
      : '';
  const stroke = o.stroke
    ? ` stroke="${o.stroke}" stroke-width="${n(o.strokeWidth ?? 1)}" stroke-linejoin="round" paint-order="stroke"`
    : '';
  const letter = spacing ? ` letter-spacing="${n(spacing)}"` : '';
  const opacity = o.opacity === undefined ? '' : ` opacity="${n(o.opacity)}"`;
  return `<text x="${n(o.x)}" y="${n(o.y)}" font-family="${DISPLAY_FONT}" font-size="${n(
    o.size,
  )}" font-weight="700" text-anchor="${anchor}" fill="${o.fill}"${stroke}${letter}${opacity}${squeeze}>${esc(
    text,
  )}</text>`;
}
