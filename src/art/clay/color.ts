/**
 * Color helpers. Palettes are authored as sRGB hex (docs/04 §2); lighting math happens in linear
 * space, so every authored color goes through `hexToLinear` before it reaches a shader.
 */

export type Rgb = readonly [number, number, number];

export function hexToSrgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return [1, 0, 1];
  const n = Number.parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function hexToLinear(hex: string): Rgb {
  const [r, g, b] = hexToSrgb(hex);
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const scaleRgb = (a: Rgb, s: number): Rgb => [a[0] * s, a[1] * s, a[2] * s];

export const luminance = (c: Rgb): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Pushes a linear color away from its gray, used to derive rich "subsurface" and shade tints. */
export function saturateRgb(c: Rgb, amount: number): Rgb {
  const l = luminance(c);
  return [
    Math.max(0, l + (c[0] - l) * amount),
    Math.max(0, l + (c[1] - l) * amount),
    Math.max(0, l + (c[2] - l) * amount),
  ];
}
