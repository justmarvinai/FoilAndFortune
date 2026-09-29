export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Rounds to the nearest 0.5, ties up: `floor(2x + 0.5) / 2` (docs/02 §8.1 notation). */
export function roundHalf(value: number): number {
  return Math.floor(value * 2 + 0.5) / 2;
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}
