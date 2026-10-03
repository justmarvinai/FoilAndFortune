import type { Channels } from './dsp';

/**
 * Loudness metering after ITU-R BS.1770-4 (K-weighting, 400 ms blocks, gating), for the level
 * checks in `scripts/audio/levels.ts` and the audio lab. A mono buffer counts as played on both
 * speakers, which is how the mixer upmixes it.
 */

interface Biquad {
  b: [number, number, number];
  a: [number, number];
}

/** The two K-weighting stages at any sample rate (coefficients as in pyloudnorm). */
function kWeighting(sampleRate: number): Biquad[] {
  const shelf = (() => {
    const gain = 3.99984385397;
    const q = 0.7071752369554193;
    const fc = 1681.974450955533;
    const A = 10 ** (gain / 40);
    const w0 = (2 * Math.PI * fc) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cos = Math.cos(w0);
    const a0 = A + 1 - (A - 1) * cos + 2 * Math.sqrt(A) * alpha;
    return {
      b: [
        (A * (A + 1 + (A - 1) * cos + 2 * Math.sqrt(A) * alpha)) / a0,
        (-2 * A * (A - 1 + (A + 1) * cos)) / a0,
        (A * (A + 1 + (A - 1) * cos - 2 * Math.sqrt(A) * alpha)) / a0,
      ],
      a: [
        (2 * (A - 1 - (A + 1) * cos)) / a0,
        (A + 1 - (A - 1) * cos - 2 * Math.sqrt(A) * alpha) / a0,
      ],
    } satisfies Biquad;
  })();
  const highPass = (() => {
    const q = 0.5003270373253953;
    const fc = 38.13547087613982;
    const w0 = (2 * Math.PI * fc) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cos = Math.cos(w0);
    const a0 = 1 + alpha;
    return {
      b: [(1 + cos) / 2 / a0, -(1 + cos) / a0, (1 + cos) / 2 / a0],
      a: [(-2 * cos) / a0, (1 - alpha) / a0],
    } satisfies Biquad;
  })();
  return [shelf, highPass];
}

function filter(input: Float32Array, stages: Biquad[]): Float32Array {
  let x = input;
  for (const { b, a } of stages) {
    const y = new Float32Array(x.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const xi = x[i] ?? 0;
      const yi = b[0] * xi + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
      x2 = x1;
      x1 = xi;
      y2 = y1;
      y1 = yi;
      y[i] = yi;
    }
    x = y;
  }
  return x;
}

export interface LoudnessReport {
  /** Sample peak, dBFS. */
  peakDb: number;
  /** RMS over the whole buffer, dBFS (mono-equivalent). */
  rmsDb: number;
  /** Loudest 400 ms window, LUFS. */
  momentaryMax: number;
  /** Gated integrated loudness, LUFS (−Infinity for silence). */
  integrated: number;
}

const toDb = (x: number) => (x > 0 ? 20 * Math.log10(x) : Number.NEGATIVE_INFINITY);

export function measureLoudness(channels: Channels, sampleRate: number, gain = 1): LoudnessReport {
  const stages = kWeighting(sampleRate);
  // Mono plays on both speakers: weight its power twice.
  const weighted = channels.map((channel) => filter(channel, stages));
  const channelWeight = channels.length === 1 ? 2 : 1;
  const length = channels[0]?.length ?? 0;
  const block = Math.round(0.4 * sampleRate);
  const step = Math.round(0.1 * sampleRate);
  const blocks: number[] = [];
  for (let start = 0; start === 0 || start + block <= length; start += step) {
    const end = Math.min(length, start + block);
    let power = 0;
    for (const z of weighted) {
      let sum = 0;
      for (let i = start; i < end; i++) sum += (z[i] ?? 0) ** 2;
      power += (sum / block) * channelWeight;
    }
    blocks.push(power * gain * gain);
    if (end >= length) break;
  }
  const lufs = (power: number) =>
    power > 0 ? -0.691 + 10 * Math.log10(power) : Number.NEGATIVE_INFINITY;
  const momentaryMax = lufs(Math.max(0, ...blocks));
  const absolute = blocks.filter((power) => lufs(power) > -70);
  const mean = (values: number[]) =>
    values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
  const relativeGate = lufs(mean(absolute)) - 10;
  const gated = absolute.filter((power) => lufs(power) > relativeGate);
  let peak = 0;
  let sumSquares = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const v = (channel[i] ?? 0) * gain;
      peak = Math.max(peak, Math.abs(v));
      sumSquares += v * v;
    }
  }
  return {
    peakDb: toDb(peak),
    rmsDb: toDb(Math.sqrt(sumSquares / Math.max(1, length * channels.length))),
    momentaryMax,
    integrated: gated.length > 0 ? lufs(mean(gated)) : Number.NEGATIVE_INFINITY,
  };
}
