import { describe, expect, it } from 'vitest';
import { voiceForSeed } from '../voiceProfile';
import { planUtterance, voiceBaseHz } from './plan';

describe('voice profiles', () => {
  it('maps a look seed to a stable voice inside the ranges', () => {
    for (let seed = 0; seed < 500; seed++) {
      const voice = voiceForSeed(seed * 7919);
      expect(voiceForSeed(seed * 7919)).toEqual(voice);
      expect(voice.pitch).toBeGreaterThanOrEqual(0.12);
      expect(voice.pitch).toBeLessThanOrEqual(0.88);
      expect(voice.timbre).toBeGreaterThanOrEqual(0);
      expect(voice.timbre).toBeLessThan(1);
      expect(voice.rate).toBeGreaterThanOrEqual(0.85);
      expect(voice.rate).toBeLessThanOrEqual(1.15);
    }
  });

  it('spreads pitches over the range, mostly mid-range', () => {
    const pitches = Array.from({ length: 2000 }, (_, i) => voiceForSeed(i).pitch);
    const mean = pitches.reduce((s, p) => s + p, 0) / pitches.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    const low = pitches.filter((p) => p < 0.3).length / pitches.length;
    const high = pitches.filter((p) => p > 0.7).length / pitches.length;
    expect(low).toBeGreaterThan(0.03);
    expect(high).toBeGreaterThan(0.03);
    expect(pitches.filter((p) => p > 0.35 && p < 0.65).length / pitches.length).toBeGreaterThan(
      0.45,
    );
  });

  it('a pitch bias (kids) raises the voice, clamped to 1', () => {
    for (let seed = 1; seed < 50; seed++) {
      const adult = voiceForSeed(seed);
      const kid = voiceForSeed(seed, { pitchBias: 0.25 });
      expect(kid.pitch).toBeGreaterThan(adult.pitch);
      expect(kid.pitch).toBeLessThanOrEqual(1);
      expect(kid.timbre).toBe(adult.timbre);
    }
  });

  it('base pitch runs from 150 Hz to 600 Hz', () => {
    expect(voiceBaseHz(0)).toBe(150);
    expect(voiceBaseHz(0.5)).toBe(300);
    expect(voiceBaseHz(1)).toBe(600);
  });
});

describe('blip utterances', () => {
  const voice = voiceForSeed(1234);

  it('plans one blip per syllable, in order, without overlaps', () => {
    for (const count of [1, 3, 7]) {
      const plan = planUtterance(voice, count, 'neutral', 0);
      expect(plan.syllables).toHaveLength(count);
      plan.syllables.forEach((syllable, i) => {
        const next = plan.syllables[i + 1];
        expect(syllable.dur).toBeGreaterThan(0.04);
        expect(syllable.dur).toBeLessThan(0.3);
        if (next) expect(syllable.start + syllable.dur).toBeLessThanOrEqual(next.start);
        for (const hz of [syllable.from, syllable.to]) {
          expect(hz).toBeGreaterThan(70);
          expect(hz).toBeLessThan(1500);
        }
      });
      const last = plan.syllables[count - 1];
      expect(plan.duration).toBeGreaterThanOrEqual((last?.start ?? 0) + (last?.dur ?? 0));
    }
  });

  it('sounds happy high and rising, grumbly low and falling', () => {
    const mean = (mood: 'happy' | 'grumble') => {
      let sum = 0;
      let n = 0;
      for (let nonce = 0; nonce < 40; nonce++) {
        for (const s of planUtterance(voice, 3, mood, nonce).syllables) {
          sum += s.from;
          n++;
        }
      }
      return sum / n;
    };
    expect(mean('happy')).toBeGreaterThan(mean('grumble') * 1.5);
    const happy = planUtterance(voice, 3, 'happy', 1).syllables.at(-1);
    const grumble = planUtterance(voice, 3, 'grumble', 1).syllables.at(-1);
    expect(happy && happy.to > happy.from).toBe(true);
    expect(grumble && grumble.to < grumble.from).toBe(true);
    expect(planUtterance(voice, 2, 'grumble', 0).wave).toBe('sawtooth');
  });

  it('is deterministic per voice and nonce, and clamps the syllable count', () => {
    expect(planUtterance(voice, 3, 'question', 5)).toEqual(planUtterance(voice, 3, 'question', 5));
    expect(planUtterance(voice, 3, 'question', 5)).not.toEqual(
      planUtterance(voice, 3, 'question', 6),
    );
    expect(planUtterance(voice, 0, 'neutral').syllables).toHaveLength(1);
    expect(planUtterance(voice, 99, 'neutral').syllables).toHaveLength(12);
  });
});
