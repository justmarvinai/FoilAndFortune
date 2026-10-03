import {
  addRoom,
  type Channels,
  createNoise,
  createRandom,
  type FilterType,
  fadeEdges,
  mixPanned,
  normalizePeak,
  polyBlep,
  Svf,
  seconds,
} from '../dsp';
import { mixConfig } from '../mixConfig';
import {
  type Instrument,
  instrumentLength,
  type PartialSpec,
  renderNote,
  renderPartials,
} from './instruments';
import { buildZzfx, type ZzfxParams, zzfxLength } from './zzfx';

/**
 * SFX recipes → sample buffers (docs/06 §10: "generated at startup into cached AudioBuffers").
 * A preset is a list of layers mixed at time offsets, then room, peak normalization and edge
 * fades. Pure: the browser engine and the Node level script render the very same samples.
 */

interface LayerBase {
  /** Start time in seconds. */
  at?: number;
  /** Linear layer gain (before the preset's final normalization). */
  gain?: number;
  /** −1 left … +1 right (stereo presets only). */
  pan?: number;
}

export type Wave = 'sine' | 'triangle' | 'square' | 'saw';

/** One note or chord: [start s, midi or chord, duration s, velocity 0–1]. */
export type NoteSpec = readonly [number, number | readonly number[], number, number?];

export type SfxLayer =
  | (LayerBase & { kind: 'zzfx'; params: ZzfxParams })
  | (LayerBase & {
      kind: 'tone';
      wave?: Wave;
      freq: number;
      /** Glides exponentially toward `to` with time constant `glide` (s). */
      to?: number;
      glide?: number;
      attack?: number;
      /** Exponential decay time constant (s) after the attack; ≥ 10 means flat. */
      decay: number;
      dur: number;
      /** One-pole low-pass cutoff (Hz) to tame bright waves. */
      lp?: number;
      /** Tremolo [rate Hz, depth 0–1]. */
      trem?: readonly [number, number];
      /** Vibrato [rate Hz, depth cents]. */
      vib?: readonly [number, number];
      /** Linear fade over the last seconds (default 6 ms). */
      release?: number;
    })
  | (LayerBase & {
      kind: 'noise';
      filter: FilterType;
      freq: number;
      /** Sweeps the filter exponentially from `freq` to `to` over `dur`. */
      to?: number;
      q?: number;
      attack?: number;
      decay: number;
      dur: number;
      /** Random amplitude modulation rate (Hz): the "rrrip" grain of tearing and rustling. */
      am?: number;
      /** Impulse rate (per second) instead of continuous noise: foil crinkles, crackles. */
      crackle?: number;
      /** Linear fade over the last seconds (default 6 ms). */
      release?: number;
    })
  | (LayerBase & {
      kind: 'bell';
      freq: number;
      partials?: readonly PartialSpec[];
      dur: number;
      /** Re-strikes [time s, amplitude]: a swinging shop bell rings several times. */
      strikes?: readonly (readonly [number, number])[];
      /** Random timing spread (s) of strikes per variant. */
      humanize?: number;
    })
  | (LayerBase & {
      kind: 'notes';
      instrument: Instrument;
      notes: readonly NoteSpec[];
      /** Pans notes across ±spread in order (arpeggios that travel across the stereo field). */
      spread?: number;
    })
  | (LayerBase & {
      kind: 'sparkle';
      dur: number;
      /** Grains per second. */
      rate: number;
      lo: number;
      hi: number;
      /** Grain density over time. */
      shape?: 'flat' | 'in' | 'out';
    });

export interface SfxPreset {
  layers: readonly SfxLayer[];
  /** Playback gain (dB) applied to the peak-normalized buffer: the loudness balance knob. */
  gainDb: number;
  /** Random playback-rate spread per play (±), so repeats never sound machine-gunned. */
  jitter?: number;
  /** Pre-rendered variants (different noise seeds and strike timings), picked at random. */
  variants?: number;
  /** The engine drops a repeat of this sound within this many ms (e.g. two code paths, one sale). */
  minIntervalMs?: number;
  maxVoices?: number;
  /** Duck the music under this sound (big reveals; rarity stingers are never masked). */
  duck?: { amount: number; ms: number };
  stereo?: boolean;
  /** Baked room reverb (wet level). */
  room?: number;
  /** Extra seconds after the last layer (room tails). */
  tail?: number;
  /**
   * Render at half the output rate: long tonal sounds (jingles, stingers, fanfares) have nothing
   * above ~10 kHz, so this halves their render time and memory; playback resamples.
   */
  halfRate?: boolean;
}

/** The sample rate a preset renders at, given the output (AudioContext) rate. */
export function sfxSampleRate(preset: SfxPreset, outputRate: number): number {
  return preset.halfRate ? outputRate / 2 : outputRate;
}

const NOTE_STRUM = 0.008;

function layerSeconds(layer: SfxLayer, sampleRate: number): number {
  switch (layer.kind) {
    case 'zzfx':
      return zzfxLength(layer.params, sampleRate) / sampleRate;
    case 'tone':
    case 'noise':
    case 'bell':
      return layer.dur;
    case 'notes': {
      let end = 0;
      for (const [at, midi, dur] of layer.notes) {
        const strum = typeof midi === 'number' ? 0 : (midi.length - 1) * NOTE_STRUM;
        end = Math.max(end, at + strum + instrumentLength(layer.instrument, dur));
      }
      return end;
    }
    case 'sparkle':
      return layer.dur + 0.45;
  }
}

/** Total length in samples a preset renders to. */
export function sfxLength(preset: SfxPreset, sampleRate: number): number {
  let end = 0;
  for (const layer of preset.layers)
    end = Math.max(end, (layer.at ?? 0) + layerSeconds(layer, sampleRate));
  return seconds(sampleRate, end + (preset.tail ?? 0));
}

export function renderSfx(preset: SfxPreset, sampleRate: number, variant = 0): Channels {
  const length = sfxLength(preset, sampleRate);
  const channels: Channels = preset.stereo
    ? [new Float32Array(length), new Float32Array(length)]
    : [new Float32Array(length)];
  preset.layers.forEach((layer, index) => {
    const seed = (variant + 1) * 7919 + index * 104729;
    const offset = seconds(sampleRate, layer.at ?? 0);
    renderLayerInto(channels, layer, sampleRate, seed, offset);
  });
  addRoom(channels, sampleRate, preset.room ?? 0);
  normalizePeak(channels, mixConfig.sfx.peakDb);
  fadeEdges(channels, sampleRate);
  return channels;
}

function renderLayerInto(
  out: Channels,
  layer: SfxLayer,
  sampleRate: number,
  seed: number,
  offset: number,
): void {
  const gain = layer.gain ?? 1;
  const pan = layer.pan ?? 0;
  switch (layer.kind) {
    case 'zzfx':
      mixPanned(out, buildZzfx(layer.params, sampleRate), offset, gain, pan);
      return;
    case 'tone':
      mixPanned(out, renderTone(layer, sampleRate), offset, gain, pan);
      return;
    case 'noise':
      mixPanned(out, renderNoise(layer, sampleRate, seed), offset, gain, pan);
      return;
    case 'bell': {
      const random = createRandom(seed);
      const strikes = layer.strikes ?? [[0, 1]];
      for (const [time, amp] of strikes) {
        const jitter = (random() - 0.5) * 2 * (layer.humanize ?? 0);
        const level = amp * (1 + (random() - 0.5) * 2 * Math.min(0.3, (layer.humanize ?? 0) * 8));
        const start = Math.max(0, time + (time > 0 ? jitter : 0));
        const ring = renderPartials(
          layer.freq,
          layer.partials ?? [[1, 1, 0.6]],
          layer.dur - start,
          sampleRate,
        );
        mixPanned(out, ring, offset + seconds(sampleRate, start), gain * level, pan);
      }
      return;
    }
    case 'notes': {
      const count = layer.notes.length;
      layer.notes.forEach(([at, midi, dur, vel = 0.8], index) => {
        const notePan =
          count > 1 && layer.spread
            ? -layer.spread + (2 * layer.spread * index) / (count - 1)
            : pan;
        const chord = typeof midi === 'number' ? [midi] : midi;
        chord.forEach((pitch, voice) => {
          const buffer = renderNote(
            layer.instrument,
            pitch,
            dur,
            vel,
            sampleRate,
            seed + index * 31 + voice,
          );
          const start = offset + seconds(sampleRate, at + voice * NOTE_STRUM);
          mixPanned(out, buffer, start, gain / Math.sqrt(chord.length), notePan);
        });
      });
      return;
    }
    case 'sparkle':
      renderSparkle(out, layer, sampleRate, seed, offset, gain);
      return;
  }
}

function renderTone(layer: Extract<SfxLayer, { kind: 'tone' }>, sampleRate: number): Float32Array {
  const n = seconds(sampleRate, layer.dur);
  const out = new Float32Array(n);
  const attack = Math.max(layer.attack ?? 0.002, 1 / sampleRate);
  const flat = layer.decay >= 10;
  const lpCoeff = layer.lp ? 1 - Math.exp((-2 * Math.PI * layer.lp) / sampleRate) : 1;
  const releaseSamples = Math.max(1, Math.min(n, seconds(sampleRate, layer.release ?? 0.006)));
  let phase = 0;
  let smoothed = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let freq =
      layer.to === undefined
        ? layer.freq
        : layer.to + (layer.freq - layer.to) * Math.exp(-t / (layer.glide ?? 0.05));
    if (layer.vib) freq *= 2 ** ((layer.vib[1] * Math.sin(2 * Math.PI * layer.vib[0] * t)) / 1200);
    const dt = freq / sampleRate;
    phase += dt;
    if (phase >= 1) phase -= 1;
    let s: number;
    switch (layer.wave ?? 'sine') {
      case 'sine':
        s = Math.sin(2 * Math.PI * phase);
        break;
      case 'triangle':
        s = 1 - 4 * Math.abs(phase - 0.5);
        break;
      case 'square':
        s = (phase < 0.5 ? 1 : -1) + polyBlep(phase, dt) - polyBlep((phase + 0.5) % 1, dt);
        break;
      case 'saw':
        s = 2 * phase - 1 - polyBlep(phase, dt);
        break;
    }
    smoothed += (s - smoothed) * lpCoeff;
    const env =
      t < attack ? t / attack : flat ? 1 : Math.exp(-(t - attack) / Math.max(layer.decay, 0.001));
    const trem = layer.trem
      ? 1 - layer.trem[1] + layer.trem[1] * Math.sin(2 * Math.PI * layer.trem[0] * t)
      : 1;
    const release = i >= n - releaseSamples ? (n - i) / releaseSamples : 1;
    out[i] = smoothed * env * trem * release;
  }
  return out;
}

function renderNoise(
  layer: Extract<SfxLayer, { kind: 'noise' }>,
  sampleRate: number,
  seed: number,
): Float32Array {
  const n = seconds(sampleRate, layer.dur);
  const out = new Float32Array(n);
  const noise = createNoise(seed);
  const random = createRandom(seed + 1);
  const q = layer.q ?? (layer.filter === 'bp' ? 1 : Math.SQRT1_2);
  const filter = new Svf(layer.filter, sampleRate, layer.freq, q);
  const attack = Math.max(layer.attack ?? 0.001, 1 / sampleRate);
  const flat = layer.decay >= 10;
  const releaseSamples = Math.max(1, Math.min(n, seconds(sampleRate, layer.release ?? 0.006)));
  // Random AM: a smoothed random walk between targets drawn `am` times per second.
  const amStep = layer.am ? Math.max(1, Math.round(sampleRate / layer.am)) : 0;
  let amFrom = 1;
  let amTo = 1;
  // Crackle: Poisson impulses, each a 0.3–1.5 ms burst.
  const crackleChance = layer.crackle ? layer.crackle / sampleRate : 0;
  let burst = 0;
  let burstAmp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    if (layer.to !== undefined && i % 16 === 0) {
      filter.set(layer.freq * (layer.to / layer.freq) ** (t / layer.dur), q);
    }
    let source: number;
    if (crackleChance > 0) {
      if (burst <= 0 && random() < crackleChance) {
        burst = seconds(sampleRate, 0.0003 + random() * 0.0012);
        burstAmp = 0.25 + random() ** 2 * 0.75;
      }
      source = burst > 0 ? noise() * burstAmp : 0;
      burst--;
    } else {
      source = noise();
    }
    let am = 1;
    if (amStep) {
      if (i % amStep === 0) {
        amFrom = amTo;
        amTo = 0.2 + 0.8 * random();
      }
      am = amFrom + (amTo - amFrom) * ((i % amStep) / amStep);
    }
    const env =
      t < attack ? t / attack : flat ? 1 : Math.exp(-(t - attack) / Math.max(layer.decay, 0.001));
    const release = i >= n - releaseSamples ? (n - i) / releaseSamples : 1;
    out[i] = filter.process(source) * env * am * release;
  }
  return out;
}

/** Star sparkle: short, high, randomly panned bell grains. */
function renderSparkle(
  out: Channels,
  layer: Extract<SfxLayer, { kind: 'sparkle' }>,
  sampleRate: number,
  seed: number,
  offset: number,
  gain: number,
): void {
  const random = createRandom(seed);
  const count = Math.max(1, Math.round(layer.rate * layer.dur));
  for (let k = 0; k < count; k++) {
    const u = random();
    const shape = layer.shape ?? 'flat';
    const time =
      layer.dur * (shape === 'in' ? Math.sqrt(u) : shape === 'out' ? 1 - Math.sqrt(u) : u);
    const freq = layer.lo * (layer.hi / layer.lo) ** random();
    const tau = 0.03 + random() * 0.06;
    const grain = renderPartials(
      freq,
      [
        [1, 1, tau],
        [2, 0.2, tau / 2],
      ],
      tau * 5,
      sampleRate,
      0.3 + 0.7 * random(),
    );
    mixPanned(out, grain, offset + seconds(sampleRate, time), gain, (random() - 0.5) * 1.6);
  }
}
