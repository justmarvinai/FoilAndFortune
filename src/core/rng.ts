/**
 * Seeded, serializable PRNG (sfc32) with independent named streams (docs/06 §5.4).
 *
 * The generator state is a plain `[a, b, c, d]` uint32 tuple so it can live inside GameState,
 * survive JSON saves, and be advanced in place through an Immer draft. Separate streams per
 * domain (customers, market, packs, …) mean that opening a pack never shifts tomorrow's market.
 */
export type RngState = [number, number, number, number];

/** FNV-1a hash of a string into a uint32. Used to derive per-stream seeds. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** splitmix32 step: expands one seed into well-mixed state words. */
function splitmix32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
}

/** Advances the state in place and returns the next uint32. */
export function nextUint32(state: RngState): number {
  let [a, b, c, d] = state;
  a >>>= 0;
  b >>>= 0;
  c >>>= 0;
  d >>>= 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  state[0] = a >>> 0;
  state[1] = b >>> 0;
  state[2] = c >>> 0;
  state[3] = d >>> 0;
  return t >>> 0;
}

/** Creates the initial state for `stream` under a game seed. Same inputs → same sequence. */
export function seedStream(seed: number, stream: string): RngState {
  const mix = splitmix32((seed >>> 0) ^ hashString(stream));
  const state: RngState = [mix(), mix(), mix(), mix()];
  // sfc32 needs a short warm-up before its output is well distributed.
  for (let i = 0; i < 12; i++) nextUint32(state);
  return state;
}

export interface WeightedItem<T> {
  value: T;
  weight: number;
}

/** Convenience API over a mutable state tuple. All methods advance the underlying state. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** Uniformly picks one element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Picks by weight. Throws if all weights are zero. */
  weighted<T>(items: readonly WeightedItem<T>[]): T;
  /** Normal distribution (Box–Muller). */
  gauss(mean: number, sd: number): number;
  /** Gamma distribution with shape `k` and scale `theta` (mean kθ). Marsaglia–Tsang. */
  gamma(k: number, theta: number): number;
  /** Returns a shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(state: RngState): Rng {
  const next = () => nextUint32(state) / 4294967296;

  const gauss = (mean: number, sd: number): number => {
    // 1 - next() keeps u1 in (0, 1] so the log is finite.
    const u1 = 1 - next();
    const u2 = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const gamma = (k: number, theta: number): number => {
    if (k <= 0 || theta <= 0) throw new RangeError('gamma: k and theta must be > 0');
    if (k < 1) {
      // Boost small shapes: Gamma(k) = Gamma(k + 1) · U^(1/k).
      return gamma(k + 1, theta) * (1 - next()) ** (1 / k);
    }
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number;
      let v: number;
      do {
        x = gauss(0, 1);
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = 1 - next();
      if (u < 1 - 0.0331 * x ** 4) return d * v * theta;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * theta;
    }
  };

  return {
    next,
    float: (min, max) => min + (max - min) * next(),
    int: (min, max) => {
      if (max < min) throw new RangeError(`int: max (${max}) < min (${min})`);
      return min + Math.floor(next() * (max - min + 1));
    },
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new RangeError('pick: empty array');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    weighted: (items) => {
      let total = 0;
      for (const item of items) total += Math.max(0, item.weight);
      if (total <= 0) throw new RangeError('weighted: total weight must be > 0');
      let roll = next() * total;
      for (const item of items) {
        roll -= Math.max(0, item.weight);
        if (roll < 0) return item.value;
      }
      // Floating-point edge case: fall back to the last positive-weight item.
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item && item.weight > 0) return item.value;
      }
      throw new RangeError('weighted: unreachable');
    },
    gauss,
    gamma,
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = copy[i] as (typeof copy)[number];
        copy[i] = copy[j] as (typeof copy)[number];
        copy[j] = tmp;
      }
      return copy;
    },
  };
}
