/**
 * Small, pure DSP toolkit for offline rendering (SFX buffers, tests, level checks). No Web Audio
 * here: everything works on Float32Arrays, so the same code runs in the browser and in Node.
 */

export type Channels = Float32Array<ArrayBuffer>[];

/** Seeded white noise in [-1, 1) (xorshift32): fast enough for per-sample use. */
export function createNoise(seed: number): () => number {
  let state = (seed | 0) ^ 0x2545f491 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 2147483648 - 1;
  };
}

/** Seeded uniform [0, 1) for decisions (grain times, strike jitter). */
export function createRandom(seed: number): () => number {
  const noise = createNoise(seed ^ 0x51ed270b);
  return () => (noise() + 1) / 2;
}

export type FilterType = 'lp' | 'hp' | 'bp';

/**
 * Topology-preserving state-variable filter (Zavalishin/Simper). Stays stable while its cutoff
 * moves every sample, which the swept noise layers (tears, whooshes, risers) rely on. The band
 * output is scaled by 1/Q so a band-pass has unity gain at its center.
 */
export class Svf {
  private ic1 = 0;
  private ic2 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private k = 1;

  constructor(
    private readonly type: FilterType,
    private readonly sampleRate: number,
    freq: number,
    q = Math.SQRT1_2,
  ) {
    this.set(freq, q);
  }

  set(freq: number, q = Math.SQRT1_2): void {
    const nyquistSafe = Math.min(Math.max(freq, 10), this.sampleRate * 0.45);
    const g = Math.tan((Math.PI * nyquistSafe) / this.sampleRate);
    this.k = 1 / Math.max(q, 0.05);
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }

  process(x: number): number {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    if (this.type === 'lp') return v2;
    if (this.type === 'bp') return v1 * this.k;
    return x - this.k * v1 - v2;
  }
}

/** PolyBLEP correction for band-limited saw/square steps (phase and increment in cycles). */
export function polyBlep(phase: number, dt: number): number {
  if (phase < dt) {
    const t = phase / dt;
    return t + t - t * t - 1;
  }
  if (phase > 1 - dt) {
    const t = (phase - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function seconds(sampleRate: number, s: number): number {
  return Math.max(0, Math.round(s * sampleRate));
}

/** Adds `src × gain` into `dst` starting at sample `offset` (clipped to `dst`). */
export function mixInto(dst: Float32Array, src: Float32Array, offset: number, gain = 1): void {
  const start = Math.max(0, offset);
  const end = Math.min(dst.length, offset + src.length);
  for (let i = start; i < end; i++) dst[i] = (dst[i] ?? 0) + (src[i - offset] ?? 0) * gain;
}

/** Equal-power pan of a mono layer into stereo channels. `pan` −1 (left) … +1 (right). */
export function mixPanned(
  dst: Channels,
  src: Float32Array,
  offset: number,
  gain: number,
  pan: number,
) {
  if (dst.length === 1) {
    const [mono] = dst;
    if (mono) mixInto(mono, src, offset, gain);
    return;
  }
  const angle = ((Math.min(1, Math.max(-1, pan)) + 1) * Math.PI) / 4;
  const [left, right] = dst;
  // Scaled by √2 so a centered layer keeps the level it would have in a mono buffer.
  if (left) mixInto(left, src, offset, gain * Math.cos(angle) * Math.SQRT2);
  if (right) mixInto(right, src, offset, gain * Math.sin(angle) * Math.SQRT2);
}

export function peakOf(channels: Channels): number {
  let peak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i] ?? 0));
  }
  return peak;
}

export function rmsOf(channels: Channels): number {
  let sum = 0;
  let count = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) sum += (channel[i] ?? 0) ** 2;
    count += channel.length;
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

/** Scales all channels so the loudest sample sits at `peakDb` dBFS (silence stays silent). */
export function normalizePeak(channels: Channels, peakDb: number): void {
  const peak = peakOf(channels);
  if (peak <= 1e-9) return;
  const scale = 10 ** (peakDb / 20) / peak;
  for (const channel of channels)
    for (let i = 0; i < channel.length; i++) channel[i] = (channel[i] ?? 0) * scale;
}

/** Short linear fades at both ends so a buffer never starts or stops with a click. */
export function fadeEdges(channels: Channels, sampleRate: number, inMs = 1, outMs = 6): void {
  const fadeIn = seconds(sampleRate, inMs / 1000);
  const fadeOut = seconds(sampleRate, outMs / 1000);
  for (const channel of channels) {
    const n = channel.length;
    for (let i = 0; i < Math.min(fadeIn, n); i++) channel[i] = (channel[i] ?? 0) * (i / fadeIn);
    for (let i = 0; i < Math.min(fadeOut, n); i++) {
      const index = n - 1 - i;
      channel[index] = (channel[index] ?? 0) * (i / fadeOut);
    }
  }
}

/**
 * Small Schroeder room (4 damped combs + 2 allpasses per side, slightly different delays left and
 * right for width). Used to bake a touch of space into SFX, so playback needs no reverb node.
 */
export function addRoom(channels: Channels, sampleRate: number, wet: number, size = 1): void {
  if (wet <= 0) return;
  const length = channels[0]?.length ?? 0;
  const dry = new Float32Array(length);
  for (const channel of channels) mixInto(dry, channel, 0, 1 / channels.length);
  const sides = channels.length === 1 ? [0] : [0, 23];
  sides.forEach((spread, side) => {
    const out = channels[side];
    if (!out) return;
    const combs = [1116, 1188, 1277, 1356].map((d) =>
      Math.round(((d + spread) * size * sampleRate) / 44100),
    );
    const allpasses = [556, 341].map((d) => Math.round(((d + spread) * sampleRate) / 44100));
    const wetBuf = new Float32Array(length);
    for (const delay of combs) {
      const line = new Float32Array(delay);
      let index = 0;
      let store = 0;
      for (let i = 0; i < length; i++) {
        const y = line[index] ?? 0;
        store = y * 0.6 + store * 0.4; // damping: highs die first, like a soft-furnished shop
        line[index] = (dry[i] ?? 0) + store * 0.78;
        if (++index === delay) index = 0;
        wetBuf[i] = (wetBuf[i] ?? 0) + y * 0.25;
      }
    }
    for (const delay of allpasses) {
      const line = new Float32Array(delay);
      let index = 0;
      for (let i = 0; i < length; i++) {
        const buffered = line[index] ?? 0;
        const x = wetBuf[i] ?? 0;
        line[index] = x + buffered * 0.5;
        wetBuf[i] = buffered - x;
        if (++index === delay) index = 0;
      }
    }
    mixInto(out, wetBuf, 0, wet);
  });
}
