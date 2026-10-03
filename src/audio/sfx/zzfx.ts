/*
 * TypeScript port of the ZzFX sample generator (`ZZFX.buildSamples`).
 *
 * ZzFX - Zuper Zmall Zound Zynth v1.3.2 by Frank Force
 * https://github.com/KilledByAPixel/ZzFX · npm `zzfx` 1.3.2
 *
 * MIT License · Copyright (c) 2019 - Frank Force
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Why a port instead of `import { ZZFX } from 'zzfx'`: the package's module creates an
 * AudioContext at import time (it throws in Node tests and would open a second context in the
 * browser). Changes: typed, renders into a Float32Array at any sample rate, no global 0.3 volume,
 * and the frequency randomness takes an injectable random source (default: none), so renders are
 * deterministic. The synthesis itself is unchanged, so presets from the ZzFX designer transfer.
 */

/**
 * Positional ZzFX parameters, exactly as the ZzFX designer exports them: [volume, randomness,
 * frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide, pitchJump,
 * pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo,
 * filter]. Holes and `undefined` take the defaults.
 */
export type ZzfxParams = readonly (number | undefined)[];

const DEFAULTS = [1, 0.05, 220, 0, 0, 0.1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] as const;

/** Sample count ZzFX produces for `params` (attack has a 9-sample minimum against pops). */
export function zzfxLength(params: ZzfxParams, sampleRate: number): number {
  const p = (index: number) => params[index] ?? DEFAULTS[index] ?? 0;
  // Same terms in the same order as the generator below, so float rounding matches exactly.
  const attack = p(3) * sampleRate || 9;
  return (
    (attack + p(18) * sampleRate + p(4) * sampleRate + p(5) * sampleRate + p(16) * sampleRate) | 0
  );
}

export function buildZzfx(
  params: ZzfxParams,
  sampleRate: number,
  random: () => number = () => 0.5,
): Float32Array {
  const p = (index: number) => params[index] ?? DEFAULTS[index] ?? 0;
  const volume = p(0);
  const randomness = p(1);
  let frequency = p(2);
  let attack = p(3);
  let sustain = p(4);
  let release = p(5);
  const shape = p(6);
  const shapeCurve = p(7);
  let slide = p(8);
  let deltaSlide = p(9);
  let pitchJump = p(10);
  let pitchJumpTime = p(11);
  let repeatTime = p(12);
  const noise = p(13);
  let modulation = p(14);
  const bitCrush = p(15);
  let delay = p(16);
  const sustainVolume = p(17);
  let decay = p(18);
  const tremolo = p(19);
  const filter = p(20);

  const PI2 = Math.PI * 2;
  const sign = (v: number) => (v < 0 ? -1 : 1);
  slide *= (500 * PI2) / sampleRate / sampleRate;
  const startSlide = slide;
  frequency *= ((1 + randomness * 2 * random() - randomness) * PI2) / sampleRate;
  let startFrequency = frequency;

  // Biquad LP/HP filter (positive `filter` = high-pass, negative = low-pass).
  const quality = 2;
  const w = (PI2 * Math.abs(filter) * 2) / sampleRate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / 2 / quality;
  const a0 = 1 + alpha;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  const b0 = (1 + sign(filter) * cos) / 2 / a0;
  const b1 = -(sign(filter) + cos) / a0;
  const b2 = b0;
  let x2 = 0;
  let x1 = 0;
  let y2 = 0;
  let y1 = 0;

  attack = attack * sampleRate || 9;
  decay *= sampleRate;
  sustain *= sampleRate;
  release *= sampleRate;
  delay *= sampleRate;
  deltaSlide *= (500 * PI2) / sampleRate ** 3;
  modulation *= PI2 / sampleRate;
  pitchJump *= PI2 / sampleRate;
  pitchJumpTime *= sampleRate;
  repeatTime = (repeatTime * sampleRate) | 0;

  const length = (attack + decay + sustain + release + delay) | 0;
  const out = new Float32Array(length);
  const crushEvery = (bitCrush * 100) | 0;
  let modOffset = 0;
  let repeat = 0;
  let crush = 0;
  let jump = 1;
  let t = 0;
  let s = 0;

  for (let i = 0; i < length; i++) {
    crush++;
    if (crushEvery === 0 || crush % crushEvery === 0) {
      s =
        shape > 4
          ? ((t / PI2) % 1 < shapeCurve / 2 ? 1 : 0) * 2 - 1
          : shape > 3
            ? Math.sin(t ** 3)
            : shape > 2
              ? Math.max(Math.min(Math.tan(t), 1), -1)
              : shape > 1
                ? 1 - (((((2 * t) / PI2) % 2) + 2) % 2)
                : shape > 0
                  ? 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2)
                  : Math.sin(t);

      const envelope =
        i < attack
          ? i / attack
          : i < attack + decay
            ? 1 - ((i - attack) / decay) * (1 - sustainVolume)
            : i < attack + decay + sustain
              ? sustainVolume
              : i < length - delay
                ? ((length - i - delay) / release) * sustainVolume
                : 0;
      s =
        (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) *
        (shape > 4 ? s : sign(s) * Math.abs(s) ** shapeCurve) *
        envelope;

      if (delay) {
        const echo =
          delay > i
            ? 0
            : ((i < length - delay ? 1 : (length - i) / delay) * (out[(i - delay) | 0] ?? 0)) /
              2 /
              (volume || 1);
        s = s / 2 + echo;
      }

      if (filter) {
        const y = b2 * x2 + b1 * x1 + b0 * s - a2 * y2 - a1 * y1;
        x2 = x1;
        x1 = s;
        y2 = y1;
        y1 = y;
        s = y;
      }
    }

    slide += deltaSlide;
    frequency += slide;
    const f = frequency * Math.cos(modulation * modOffset++);
    t += f + f * noise * Math.sin(i ** 5);

    if (jump && ++jump > pitchJumpTime) {
      frequency += pitchJump;
      startFrequency += pitchJump;
      jump = 0;
    }
    if (repeatTime && !(++repeat % repeatTime)) {
      frequency = startFrequency;
      slide = startSlide;
      jump ||= 1;
    }
    out[i] = s * volume;
  }
  return out;
}
