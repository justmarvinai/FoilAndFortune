/**
 * Volume math (docs/04 §11.3). Settings store slider positions (0–1); the mixer turns them into
 * linear gains with a perceptual taper so "half" sounds about half as loud, not barely quieter.
 */

/** Slider exponent: x² is roughly a 40 dB taper (0.5 → −12 dB, 0.1 → −40 dB). */
export const VOLUME_CURVE_EXPONENT = 2;

/** Slider position (0–1) → linear gain. Monotonic, 0 → silence, 1 → unity; NaN counts as 0. */
export function volumeToGain(volume: number): number {
  if (!(volume > 0)) return 0;
  if (volume >= 1) return 1;
  return volume ** VOLUME_CURVE_EXPONENT;
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

export function gainToDb(gain: number): number {
  return gain > 0 ? 20 * Math.log10(gain) : Number.NEGATIVE_INFINITY;
}
