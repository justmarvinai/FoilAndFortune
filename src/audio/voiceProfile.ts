import type { VoiceProfile } from './index';

/**
 * Blip-voice profiles (docs/04 §11.2): every character's pitch, timbre and talking speed come
 * from their look seed, so the same customer always sounds the same. Pure and tiny: it ships in
 * the entry chunk with `@/audio`.
 */

/** Stable hash of a seed and a salt into [0, 1). */
export function hash01(seed: number, salt: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Pitch spread: most voices sit mid-range, a few go quite high or low. */
const PITCH_RANGE = [0.12, 0.88] as const;

export function voiceForSeed(seed: number, options: { pitchBias?: number } = {}): VoiceProfile {
  // Average of two uniforms: a soft bell curve, so very high or very low voices stay rare.
  const spread = (hash01(seed, 1) + hash01(seed, 2)) / 2;
  const [lo, hi] = PITCH_RANGE;
  const pitch = Math.min(1, Math.max(0, lo + (hi - lo) * spread + (options.pitchBias ?? 0)));
  return {
    seed,
    pitch,
    timbre: hash01(seed, 3),
    rate: 0.85 + 0.3 * hash01(seed, 4),
  };
}
