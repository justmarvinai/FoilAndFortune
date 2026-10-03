import { createRng, seedStream } from '@/core/rng';
import type { VoiceMood, VoiceProfile } from '../index';
import { hash01 } from '../voiceProfile';

/**
 * Blip speech (docs/04 §11.2): no recorded voice, just short pitched blips with vowel-like
 * formants, one per syllable. This module plans an utterance (pure, testable); the engine plays
 * the plan with an oscillator and two band-pass formant filters.
 */

/** Vowel formants (F1, F2 in Hz), roughly a, e, i, o, u. */
export const VOWELS: readonly (readonly [number, number])[] = [
  [800, 1200],
  [450, 1900],
  [320, 2300],
  [500, 900],
  [350, 750],
];

export interface Syllable {
  /** Seconds from the utterance start. */
  start: number;
  dur: number;
  /** Pitch glide over the syllable (Hz). */
  from: number;
  to: number;
  formants: readonly [number, number];
  amp: number;
}

export interface UtterancePlan {
  wave: 'triangle' | 'sawtooth';
  syllables: Syllable[];
  duration: number;
}

/** Base pitch of a voice: 0 → 150 Hz (low) … 1 → 600 Hz (a squeaky kid), log-spaced. */
export function voiceBaseHz(pitch: number): number {
  return 150 * 2 ** (2 * Math.min(1, Math.max(0, pitch)));
}

const MOODS: Record<VoiceMood, { shift: number; step: number; speed: number; last: number }> = {
  // shift: semitones up/down · step: contour per syllable · speed: syllable length · last: final glide
  neutral: { shift: 0, step: 0, speed: 1, last: -2 },
  happy: { shift: 4, step: 1.5, speed: 0.9, last: 5 },
  excited: { shift: 6, step: 0, speed: 0.75, last: 4 },
  question: { shift: 1, step: 0, speed: 1, last: 7 },
  grumble: { shift: -6, step: -1.5, speed: 1.3, last: -4 },
};

export function planUtterance(
  voice: VoiceProfile,
  syllableCount: number,
  mood: VoiceMood,
  nonce = 0,
): UtterancePlan {
  const rng = createRng(seedStream(voice.seed, `blip:${nonce}`));
  const count = Math.max(1, Math.min(12, Math.round(syllableCount)));
  const timbre = voice.timbre ?? hash01(voice.seed, 3);
  const rate = voice.rate ?? 0.85 + 0.3 * hash01(voice.seed, 4);
  const shape = MOODS[mood];
  const base = voiceBaseHz(voice.pitch);
  // Higher voices have shorter vocal tracts: formants move up with pitch (kids sound small).
  const formantScale = 0.9 + 0.35 * voice.pitch;
  const syllables: Syllable[] = [];
  let time = 0;
  for (let i = 0; i < count; i++) {
    const last = i === count - 1;
    const bounce = mood === 'excited' ? (i % 2 === 0 ? 3 : -1) : rng.float(-2, 2);
    const semis = shape.shift + shape.step * i + bounce;
    const from = base * 2 ** (semis / 12);
    const to = from * 2 ** ((last ? shape.last : rng.float(-1, 1)) / 12);
    const dur = ((0.075 + rng.float(0, 0.05)) * shape.speed * (last ? 1.4 : 1)) / rate;
    const [f1, f2] = rng.pick(VOWELS);
    syllables.push({
      start: time,
      dur,
      from,
      to,
      formants: [f1 * formantScale, f2 * formantScale],
      amp: (last ? 0.85 : 1) * rng.float(0.8, 1),
    });
    time += dur + rng.float(0.025, 0.05) / rate;
  }
  return {
    wave: mood === 'grumble' || timbre > 0.5 ? 'sawtooth' : 'triangle',
    syllables,
    duration: time,
  };
}
