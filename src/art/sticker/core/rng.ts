/**
 * Seeded randomness for art variation. Card art must be reproducible (same request → same
 * image, docs/04 §6.3), so nothing here touches `Math.random()`. Separate named streams keep
 * the background stable when, say, the particle count changes.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Independent stream derived from this seed and a label. */
  fork(label: string): Rng;
}

/** FNV-1a 32-bit hash. */
export function hashString(text: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  const base = seed >>> 0;
  let state = base;
  const next = (): number => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, maxInclusive) => min + Math.floor(next() * (maxInclusive - min + 1)),
    chance: (p) => next() < p,
    pick<T>(items: readonly T[]): T {
      const value = items[Math.floor(next() * items.length)];
      if (value === undefined) throw new RangeError('pick() from an empty list');
      return value;
    },
    fork: (label) => createRng(hashString(label, base ^ 0x9e3779b9)),
  };
}
