/**
 * Deterministic randomness for art: the same request seed must always produce the same image
 * (CreatureArtRequest.seed), so nothing here touches Math.random().
 */

/** mulberry32: small, fast, good-enough PRNG for placing particles and jitter. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash, used to derive stable per-species seeds (e.g., spot layouts). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const range = (rng: () => number, lo: number, hi: number): number => lo + (hi - lo) * rng();
