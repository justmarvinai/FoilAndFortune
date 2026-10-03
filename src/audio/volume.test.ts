import { describe, expect, it } from 'vitest';
import { dbToGain, gainToDb, volumeToGain } from './volume';

describe('volume → gain (perceptual curve)', () => {
  it('maps the ends exactly and treats junk as silence', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(1)).toBe(1);
    expect(volumeToGain(-0.5)).toBe(0);
    expect(volumeToGain(2)).toBe(1);
    expect(volumeToGain(Number.NaN)).toBe(0);
  });

  it('is monotonic and tapers like loudness: half the slider ≈ −12 dB', () => {
    let previous = -1;
    for (let v = 0; v <= 1.0001; v += 0.01) {
      const gain = volumeToGain(v);
      expect(gain).toBeGreaterThanOrEqual(previous);
      previous = gain;
    }
    expect(gainToDb(volumeToGain(0.5))).toBeCloseTo(-12.04, 1);
    expect(gainToDb(volumeToGain(0.1))).toBeCloseTo(-40, 0);
    // The settings defaults: music 0.6 sits about 9 dB under unity.
    expect(gainToDb(volumeToGain(0.6))).toBeCloseTo(-8.9, 1);
  });

  it('converts decibels both ways', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(gainToDb(dbToGain(-17.5))).toBeCloseTo(-17.5, 9);
    expect(gainToDb(0)).toBe(Number.NEGATIVE_INFINITY);
  });
});
