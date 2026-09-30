/**
 * Tiny seeded PRNG (mulberry32) for *presentation-only* procedural dressing: pack jitter, wood
 * grain, bargain-bin clutter. Seeded so the diorama looks identical on every load and in
 * screenshots. The sim has its own RNG streams (CLAUDE.md rule 1); never use this there.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function randPick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('randPick: empty list');
  return item;
}
