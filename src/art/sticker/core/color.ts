/**
 * Color math for derived tones. Shading steps are taken in OKLCH so a shadow on yellow and a
 * shadow on aqua feel equally deep (docs/04 §2.3), with a small hue shift toward violet for
 * shadows and toward yellow for highlights, the classic painterly trick that keeps cel
 * shading from looking muddy.
 */

export interface Oklch {
  l: number;
  c: number;
  /** Degrees. */
  h: number;
}

type Rgb = readonly [number, number, number];

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const body = m?.[1] ?? '000000';
  const n = Number.parseInt(body, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(rgb: Rgb): string {
  const to = (v: number) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`.toUpperCase();
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklab(rgb: Rgb): Rgb {
  const r = toLinear(rgb[0]);
  const g = toLinear(rgb[1]);
  const b = toLinear(rgb[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb(lab: Rgb): Rgb {
  const l = (lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2]) ** 3;
  const m = (lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2]) ** 3;
  const s = (lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2]) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function toOklch(hex: string): Oklch {
  const [l, a, b] = rgbToOklab(hexToRgb(hex));
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

function inGamut(rgb: Rgb): boolean {
  return rgb.every((v) => v >= -0.0005 && v <= 1.0005);
}

/** OKLCH → hex, reducing chroma until the color fits sRGB (keeps lightness and hue). */
export function fromOklch({ l, c, h }: Oklch): string {
  const rad = (h * Math.PI) / 180;
  const at = (chroma: number): Rgb =>
    oklabToRgb([clamp01(l), chroma * Math.cos(rad), chroma * Math.sin(rad)]);
  let rgb = at(c);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(at(mid))) lo = mid;
      else hi = mid;
    }
    rgb = at(lo);
  }
  return rgbToHex(rgb);
}

function hueToward(h: number, target: number, amount: number): number {
  const delta = ((target - h + 540) % 360) - 180;
  return (h + Math.sign(delta) * Math.min(Math.abs(delta), amount) + 360) % 360;
}

export interface Adjust {
  /** Lightness delta (OKLCH L, 0–1). */
  l?: number;
  /** Chroma multiplier. */
  c?: number;
  /** Rotate hue this many degrees toward `toward` (default: none). */
  shift?: number;
  toward?: number;
}

export function adjust(hex: string, a: Adjust): string {
  const o = toOklch(hex);
  const h = a.shift && a.toward !== undefined ? hueToward(o.h, a.toward, a.shift) : o.h;
  return fromOklch({ l: clamp01(o.l + (a.l ?? 0)), c: o.c * (a.c ?? 1), h });
}

/** Perceptual mix in OKLab. */
export function mix(a: string, b: string, t: number): string {
  const la = rgbToOklab(hexToRgb(a));
  const lb = rgbToOklab(hexToRgb(b));
  const k = clamp01(t);
  return rgbToHex(
    oklabToRgb([
      la[0] + (lb[0] - la[0]) * k,
      la[1] + (lb[1] - la[1]) * k,
      la[2] + (lb[2] - la[2]) * k,
    ]),
  );
}

/** Hue (deg) of violet-blue: shadows lean here. */
export const SHADOW_HUE = 285;
/** Hue (deg) of warm yellow: highlights lean here. */
export const LIGHT_HUE = 95;

/** Darker, cooler tone of a fill (for far-side limbs and colored detail lines). */
export function shade(hex: string, depth = 0.12): string {
  return adjust(hex, { l: -depth, c: 1.05, shift: depth * 110, toward: SHADOW_HUE });
}

/** Lighter, warmer tone of a fill. */
export function light(hex: string, lift = 0.08): string {
  return adjust(hex, { l: lift, c: 0.9, shift: lift * 80, toward: LIGHT_HUE });
}

/** A dark line color in the same hue family (for fur tufts and inner creases). */
export function lineOf(hex: string): string {
  const o = toOklch(hex);
  return fromOklch({ l: 0.42, c: Math.min(0.14, o.c * 0.9 + 0.02), h: hueToward(o.h, 20, 12) });
}

export function luminance(hex: string): number {
  return toOklch(hex).l;
}
