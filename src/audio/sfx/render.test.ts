import { describe, expect, it } from 'vitest';
import type { SfxId } from '../index';
import { measureLoudness } from '../loudness';
import { dbToGain } from '../volume';
import { SFX_IDS, sfxPresets } from './presets';
import { renderSfx, sfxLength, sfxSampleRate } from './render';
import { buildZzfx, zzfxLength } from './zzfx';

const allFinite = (data: Float32Array) => data.every((v) => Number.isFinite(v));

describe('ZzFX port', () => {
  const patches = [
    [1, 0, 400, 0.002, 0.01, 0.06, 0, 1, 14],
    [1, 0, 880, 0.001, 0.02, 0.04, 1, 1, 0, 0, 440, 0.03],
    [1, 0, 196, 0.005, 0.04, 0.15, 1, 1.4, -0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0.8],
    [1, 0, 420, 0, 0.01, 0.03, 5, 0.5, -4, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -700],
    // Every feature at once: noise, FM, bit crush, echo, tremolo, high-pass.
    [
      0.8, 0, 300, 0.01, 0.1, 0.2, 2, 1, 1, 0.1, 50, 0.05, 0.08, 0.3, 5, 0.2, 0.05, 0.7, 0.05, 0.4,
      900,
    ],
  ];

  it.each(patches)('renders finite samples of the expected length (%#)', (...patch) => {
    for (const rate of [22050, 44100, 48000]) {
      const samples = buildZzfx(patch, rate);
      expect(samples.length).toBe(zzfxLength(patch, rate));
      expect(samples.length).toBeGreaterThan(0);
      expect(allFinite(samples)).toBe(true);
      expect(samples.some((v) => v !== 0)).toBe(true);
    }
  });

  it('is deterministic (no Math.random) and honors the attack minimum', () => {
    const patch = [1, 0.05, 523, 0, 0, 0.1];
    expect(buildZzfx(patch, 44100)).toEqual(buildZzfx(patch, 44100));
    // attack 0 → 9 samples, as in ZzFX, so a sound never starts with a click.
    expect(zzfxLength([1, 0, 220, 0, 0, 0], 44100)).toBe(9);
  });
});

describe('SFX presets', () => {
  const rate = 22050;

  it.each(SFX_IDS)('%s renders finite, normalized samples of the expected length', (id) => {
    const preset = sfxPresets[id];
    const channels = renderSfx(preset, sfxSampleRate(preset, rate));
    expect(channels).toHaveLength(preset.stereo ? 2 : 1);
    for (const channel of channels) {
      expect(channel.length).toBe(sfxLength(preset, sfxSampleRate(preset, rate)));
      expect(allFinite(channel)).toBe(true);
    }
    let peak = 0;
    for (const channel of channels) for (const v of channel) peak = Math.max(peak, Math.abs(v));
    // Peak-normalized to −1 dBFS: loud enough to be useful, never clipping.
    expect(peak).toBeCloseTo(dbToGain(-1), 3);
    // Starts and ends at silence (edge fades): no clicks.
    for (const channel of channels) {
      expect(Math.abs(channel[0] ?? 1)).toBeLessThan(1e-3);
      expect(Math.abs(channel[channel.length - 1] ?? 1)).toBeLessThan(1e-3);
    }
  });

  it('keeps headroom: every preset gain leaves the peak at or below −6 dBFS', () => {
    for (const id of SFX_IDS) expect(sfxPresets[id].gainDb - 1, id).toBeLessThanOrEqual(-6);
  });

  it('renders different variants for sounds that need them, identical repeats otherwise', () => {
    const tear = sfxPresets['pack.tear'];
    expect(tear.variants).toBeGreaterThan(1);
    const a = renderSfx(tear, rate, 0)[0];
    const b = renderSfx(tear, rate, 1)[0];
    expect(a).not.toEqual(b);
    expect(renderSfx(tear, rate, 0)[0]).toEqual(a);
  });

  it('stingers form an ascending family in loudness and length', () => {
    const ladder: SfxId[] = [
      'pack.stingerRare',
      'pack.stingerHolo',
      'pack.stingerUltra',
      'pack.stingerIllustration',
      'pack.stingerSecret',
      'pack.stingerMythic',
      'pack.godPack',
    ];
    const reports = ladder.map((id) => {
      const preset = sfxPresets[id];
      const at = sfxSampleRate(preset, 48000);
      const channels = renderSfx(preset, at);
      return {
        loudness: measureLoudness(channels, at, dbToGain(preset.gainDb)).momentaryMax,
        seconds: (channels[0]?.length ?? 0) / at,
        duck: preset.duck?.amount ?? 0,
      };
    });
    for (let i = 1; i < reports.length; i++) {
      const [previous, current] = [reports[i - 1], reports[i]];
      if (!previous || !current) continue;
      expect(current.loudness, ladder[i]).toBeGreaterThan(previous.loudness);
      expect(current.seconds, ladder[i]).toBeGreaterThanOrEqual(previous.seconds - 0.2);
      expect(current.duck, ladder[i]).toBeGreaterThan(previous.duck);
    }
  });
});
