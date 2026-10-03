import { createNoise, midiToFreq, polyBlep, Svf, seconds } from '../dsp';

/**
 * Pitched instruments for jingles, stingers and fanfares, rendered offline into mono buffers.
 * They share their recipes (partials, envelopes) with the live music instruments, so a stinger
 * sounds like it belongs to the soundtrack.
 */
export type Instrument = 'bell' | 'mallet' | 'pluck' | 'brass' | 'pad' | 'ep' | 'timpani';

/** [frequency ratio, amplitude, decay time constant in seconds]. */
export type PartialSpec = readonly [number, number, number];

export const BELL_PARTIALS: readonly PartialSpec[] = [
  [1, 1, 1.1],
  [2, 0.3, 0.4],
  [3, 0.1, 0.18],
  [4.2, 0.05, 0.08],
];
const MALLET_PARTIALS: readonly PartialSpec[] = [
  [1, 1, 0.9],
  [4, 0.25, 0.12],
  [10, 0.05, 0.03],
];

/** Seconds a note of `dur` occupies, including its natural tail. */
export function instrumentLength(instrument: Instrument, dur: number): number {
  switch (instrument) {
    case 'bell':
      return 1.8;
    case 'mallet':
      return 1.4;
    case 'timpani':
      return 1.8;
    case 'pluck':
      return Math.max(dur, 1.6);
    case 'brass':
      return dur + 0.25;
    case 'pad':
      return dur + 0.7;
    case 'ep':
      return Math.max(dur + 0.4, 1.8);
  }
}

/**
 * Sum of exponentially decaying sine partials with a 1.5 ms strike. Each partial runs as a
 * recursive oscillator (two multiply-adds per sample, no Math.sin in the loop).
 */
export function renderPartials(
  freq: number,
  partials: readonly PartialSpec[],
  durSeconds: number,
  sampleRate: number,
  amp = 1,
): Float32Array {
  const n = seconds(sampleRate, durSeconds);
  const out = new Float32Array(n);
  const attack = Math.max(1, seconds(sampleRate, 0.0015));
  for (const [ratio, level, tau] of partials) {
    const f = freq * ratio;
    if (f >= sampleRate * 0.45) continue; // above Nyquist: would alias
    const w = (2 * Math.PI * f) / sampleRate;
    const k = 2 * Math.cos(w);
    const decay = Math.exp(-1 / (tau * sampleRate));
    // y[n] = k·y[n−1] − y[n−2] generates sin(w·n).
    let y1 = 0;
    let y2 = -Math.sin(w);
    let env = level * amp;
    // Stop once the partial is inaudible (−100 dB): saves most of the work on long tails.
    const end = Math.min(n, Math.ceil(tau * sampleRate * 11.5));
    for (let i = 0; i < end; i++) {
      const y = k * y1 - y2;
      y2 = y1;
      y1 = y;
      out[i] = (out[i] ?? 0) + y2 * env * (i < attack ? i / attack : 1);
      env *= decay;
    }
  }
  return out;
}

export function renderNote(
  instrument: Instrument,
  midi: number,
  dur: number,
  vel: number,
  sampleRate: number,
  seed: number,
): Float32Array {
  const freq = midiToFreq(midi);
  const length = instrumentLength(instrument, dur);
  switch (instrument) {
    case 'bell':
      return renderPartials(freq, BELL_PARTIALS, length, sampleRate, vel);
    case 'mallet':
      return renderPartials(freq, MALLET_PARTIALS, length, sampleRate, vel);
    case 'timpani':
      return renderTimpani(freq, length, vel, sampleRate, seed);
    case 'pluck':
      return renderPluck(freq, length, vel, sampleRate, seed);
    case 'brass':
      return renderSaws(freq, dur, length, vel, sampleRate, seed, 'brass');
    case 'pad':
      return renderSaws(freq, dur, length, vel, sampleRate, seed, 'pad');
    case 'ep':
      return renderEp(freq, dur, length, vel, sampleRate);
  }
}

/** Two-operator FM electric piano (1:1 ratio, index decays: a bright "tine" attack, warm body). */
function renderEp(freq: number, dur: number, length: number, vel: number, sampleRate: number) {
  const n = seconds(sampleRate, length);
  const out = new Float32Array(n);
  const w = (2 * Math.PI * freq) / sampleRate;
  const releaseAt = seconds(sampleRate, dur);
  const tau = 1.1 * (220 / freq) ** 0.25;
  const bodyDecay = Math.exp(-1 / (tau * sampleRate));
  const indexDecay = Math.exp(-1 / (0.35 * sampleRate));
  const releaseDecay = Math.exp(-1 / (0.12 * sampleRate));
  const attack = Math.max(1, seconds(sampleRate, 0.003));
  const tremoloW = (2 * Math.PI * 4.5) / sampleRate;
  let body = vel;
  let index = 1.4 * vel;
  let release = 1;
  for (let i = 0; i < n; i++) {
    const phase = w * i;
    const tremolo = 0.92 + 0.08 * Math.sin(tremoloW * i);
    out[i] =
      Math.sin(phase + (0.25 + index) * Math.sin(phase)) *
      body *
      release *
      tremolo *
      (i < attack ? i / attack : 1);
    body *= bodyDecay;
    index *= indexDecay;
    if (i > releaseAt) release *= releaseDecay;
  }
  return out;
}

/** Detuned band-limited saws through a resonant low-pass: brass (bright, scooped) or pad (soft). */
function renderSaws(
  freq: number,
  dur: number,
  length: number,
  vel: number,
  sampleRate: number,
  seed: number,
  kind: 'brass' | 'pad',
) {
  const n = seconds(sampleRate, length);
  const out = new Float32Array(n);
  const brass = kind === 'brass';
  const q = brass ? 1.1 : 0.7;
  const filter = new Svf('lp', sampleRate, 800, q);
  const noise = createNoise(seed);
  // Brass: two saws ±6 cents; pad: three saws −8/0/+8 cents.
  const ratios = brass
    ? [2 ** (-6 / 1200), 2 ** (6 / 1200)]
    : [2 ** (-8 / 1200), 1, 2 ** (8 / 1200)];
  const voices = ratios.length;
  let p0 = (noise() + 1) / 2;
  let p1 = (noise() + 1) / 2;
  let p2 = (noise() + 1) / 2;
  const attack = brass ? 0.03 : 0.35;
  const releaseTau = (brass ? 0.12 : 0.55) / 3;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    // Brass "scoops" into pitch from 25 cents flat, like a player's lip.
    const scoop = brass && t < 0.2 ? 2 ** ((-25 * Math.exp(-t / 0.03)) / 1200) : 1;
    const base = (freq * scoop) / sampleRate;
    const d0 = base * (ratios[0] ?? 1);
    const d1 = base * (ratios[1] ?? 1);
    p0 += d0;
    if (p0 >= 1) p0 -= 1;
    p1 += d1;
    if (p1 >= 1) p1 -= 1;
    let s = 2 * p0 - 1 - polyBlep(p0, d0) + (2 * p1 - 1 - polyBlep(p1, d1));
    if (voices === 3) {
      const d2 = base * (ratios[2] ?? 1);
      p2 += d2;
      if (p2 >= 1) p2 -= 1;
      s += 2 * p2 - 1 - polyBlep(p2, d2);
    }
    s /= voices;
    if (i % 32 === 0) {
      const cutoff = brass
        ? 1300 + 1700 * vel * Math.exp(-t / 0.18) + 500 * Math.min(1, t / 0.05)
        : 900 + 500 * vel;
      filter.set(cutoff, q);
    }
    const env = Math.min(1, t / attack) * (t > dur ? Math.exp(-(t - dur) / releaseTau) : 1);
    out[i] = filter.process(s) * env * vel;
  }
  return out;
}

/** Karplus–Strong string (harp/guitar) with a fractional delay for exact pitch. */
function renderPluck(freq: number, length: number, vel: number, sampleRate: number, seed: number) {
  const n = seconds(sampleRate, length);
  const out = new Float32Array(n);
  // The two-point average in the loop adds half a sample of delay.
  const period = sampleRate / freq - 0.5;
  const size = Math.ceil(period) + 2;
  const line = new Float32Array(size);
  const noise = createNoise(seed);
  const soften = new Svf('lp', sampleRate, 2500 + 3000 * vel);
  for (let i = 0; i < size; i++) line[i] = soften.process(noise()) * vel;
  let write = 0;
  let previous = 0;
  const feedback = 0.996;
  for (let i = 0; i < n; i++) {
    const readPos = write - period;
    const base = Math.floor(readPos);
    const frac = readPos - base;
    const a = line[((base % size) + size) % size] ?? 0;
    const b = line[(((base + 1) % size) + size) % size] ?? 0;
    const delayed = a + (b - a) * frac;
    const y = (delayed + previous) * 0.5 * feedback;
    previous = delayed;
    line[write % size] = y;
    write++;
    out[i] = y;
  }
  return out;
}

function renderTimpani(
  freq: number,
  length: number,
  vel: number,
  sampleRate: number,
  seed: number,
) {
  const n = seconds(sampleRate, length);
  const out = new Float32Array(n);
  const noise = createNoise(seed);
  const thump = new Svf('lp', sampleRate, 300);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const f = freq * (1 + 0.12 * Math.exp(-t / 0.05));
    phase += (2 * Math.PI * f) / sampleRate;
    const body = Math.sin(phase) * Math.exp(-t / 0.7);
    const mallet = thump.process(noise()) * Math.exp(-t / 0.03) * 0.8;
    out[i] = (body + mallet) * Math.min(1, t / 0.002) * vel;
  }
  return out;
}
