import { createNoise, midiToFreq } from '../dsp';
import type { MusicContext, MusicOptions } from '../index';
import { mixConfig } from '../mixConfig';
import { BARS_PER_PHRASE, generateBar, type MusicEvent, sectionFor } from '../music/generator';
import { type BarCursor, dueBars, eventTime, isLate } from '../music/scheduler';
import { type LeadInstrument, type MusicStyle, musicStyles, type Part } from '../music/styles';
import { dbToGain } from '../volume';

/**
 * The music director (docs/06 §10): one ContextPlayer per playing context, crossfaded, each
 * scheduling generated bars on the AudioContext clock. Instruments are short-lived Web Audio
 * nodes (an oscillator or two and an envelope per note), so nothing big is rendered up front and
 * an idle context costs nothing. Works on any BaseAudioContext, so the audio lab can render a
 * context offline to measure its loudness.
 */

const BELL = [
  [1, 1, 0.9],
  [2, 0.3, 0.35],
  [3, 0.1, 0.15],
] as const;

const PARTS: readonly Part[] = [
  'kick',
  'snare',
  'hat',
  'bass',
  'keys',
  'pad',
  'lead',
  'arp',
  'riser',
];
const PAN: Record<Part, number> = {
  kick: 0,
  snare: 0.05,
  hat: 0.25,
  bass: 0,
  keys: -0.15,
  pad: 0.1,
  lead: 0.2,
  arp: -0.25,
  riser: 0,
};

/** Buffers and waves every context shares (made once per AudioContext). */
interface Shared {
  noise: AudioBuffer;
  crackle: AudioBuffer;
  bassWave: PeriodicWave;
  fluteWave: PeriodicWave;
  reverb: ConvolverNode;
}

function makeShared(ctx: BaseAudioContext, out: AudioNode): Shared {
  const rate = ctx.sampleRate;
  const white = createNoise(17);
  const noise = ctx.createBuffer(1, rate, rate);
  const noiseData = new Float32Array(rate);
  for (let i = 0; i < rate; i++) noiseData[i] = white();
  noise.copyToChannel(noiseData, 0);

  // Vinyl: sparse clicks of random size over a faint band-limited hiss, loopable.
  const crackleLength = Math.round(rate * 4.1);
  const crackleData = new Float32Array(crackleLength);
  const hiss = createNoise(23);
  const clicks = createNoise(29);
  let lowpassed = 0;
  for (let i = 0; i < crackleLength; i++) {
    lowpassed += (hiss() - lowpassed) * 0.25;
    let sample = lowpassed * 0.05;
    if (clicks() > 1 - 14 / rate) sample += clicks() * (0.3 + 0.7 * Math.abs(clicks()) ** 3);
    crackleData[i] = sample;
  }
  const crackle = ctx.createBuffer(1, crackleLength, rate);
  crackle.copyToChannel(crackleData, 0);

  // Small warm room: stereo noise with an exponential decay that darkens as it fades.
  const seconds = mixConfig.music.reverbSeconds;
  const irLength = Math.round(rate * seconds);
  const impulse = ctx.createBuffer(2, irLength, rate);
  for (let channel = 0; channel < 2; channel++) {
    const random = createNoise(41 + channel);
    const data = new Float32Array(irLength);
    let smooth = 0;
    for (let i = 0; i < irLength; i++) {
      const t = i / rate;
      const damping = 0.6 - 0.45 * (t / seconds);
      smooth += (random() - smooth) * damping;
      data[i] = smooth * Math.exp(-t / (seconds / 6.9)) * (t < 0.012 ? 0 : 1);
    }
    impulse.copyToChannel(data, channel);
  }
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse;
  reverb.connect(out);

  return {
    noise,
    crackle,
    bassWave: ctx.createPeriodicWave(
      new Float32Array([0, 0, 0, 0, 0]),
      new Float32Array([0, 1, 0.35, 0.12, 0.05]),
    ),
    fluteWave: ctx.createPeriodicWave(
      new Float32Array([0, 0, 0, 0]),
      new Float32Array([0, 1, 0.18, 0.05]),
    ),
    reverb,
  };
}

/** A gain envelope: linear attack to `peak`, exponential decay (τ) and an optional release. */
function envelope(
  ctx: BaseAudioContext,
  destination: AudioNode,
  t: number,
  peak: number,
  attack: number,
  decay: number | null,
  release?: { at: number; tau: number },
): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  if (decay !== null) gain.gain.setTargetAtTime(0, t + attack, decay);
  if (release) gain.gain.setTargetAtTime(0, Math.max(release.at, t + attack), release.tau);
  gain.connect(destination);
  return gain;
}

class ContextPlayer {
  readonly bus: GainNode;
  private readonly parts = new Map<Part, GainNode>();
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private cursor: BarCursor;
  private endTime = Number.POSITIVE_INFINITY;
  private noiseOffset = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    readonly context: Exclude<MusicContext, 'silent'>,
    private readonly style: MusicStyle,
    private readonly seed: number,
    private readonly shared: Shared,
    out: AudioNode,
    start: number,
    fadeIn: number,
    startBar = 0,
  ) {
    this.cursor = { bar: startBar, time: start };
    this.bus = ctx.createGain();
    this.bus.gain.setValueAtTime(fadeIn > 0 ? 0 : dbToGain(style.mix.gain), start);
    if (fadeIn > 0) this.bus.gain.linearRampToValueAtTime(dbToGain(style.mix.gain), start + fadeIn);
    const tape = ctx.createBiquadFilter();
    tape.type = 'lowpass';
    tape.frequency.value = style.mix.lowpass;
    tape.Q.value = 0.5;
    tape.connect(this.bus);
    this.bus.connect(out);
    // Post-fader send: the room fades out with the context during a crossfade.
    const send = ctx.createGain();
    send.gain.value = style.mix.reverb;
    this.bus.connect(send);
    send.connect(shared.reverb);
    this.nodes.push(tape, send);

    for (const part of PARTS) {
      const level = style.mix[part];
      if (level === undefined) continue;
      const gain = ctx.createGain();
      gain.gain.value = dbToGain(level);
      const panner = ctx.createStereoPanner();
      panner.pan.value = PAN[part];
      gain.connect(panner);
      panner.connect(tape);
      this.parts.set(part, gain);
      this.nodes.push(gain, panner);
    }

    // Rhodes-style tremolo on the keys, and the vinyl crackle under everything.
    const keys = this.parts.get('keys');
    if (keys) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.5;
      const depth = ctx.createGain();
      depth.gain.value = keys.gain.value * 0.12;
      lfo.connect(depth);
      depth.connect(keys.gain);
      lfo.start(start);
      this.sources.push(lfo);
      this.nodes.push(depth);
    }
    const crackle = ctx.createBufferSource();
    crackle.buffer = shared.crackle;
    crackle.loop = true;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = dbToGain(style.mix.crackle);
    crackle.connect(crackleGain);
    crackleGain.connect(this.bus);
    crackle.start(start, (seed % 40) / 10);
    this.sources.push(crackle);
    this.nodes.push(crackleGain);
  }

  /** The bar being heard and its section (audio lab). */
  position(now: number): { bar: number; section: string } {
    const length = (4 * 60) / this.style.bpm;
    const bar = Math.max(0, this.cursor.bar - Math.ceil((this.cursor.time - now) / length));
    return { bar, section: sectionFor(this.style, Math.floor(bar / BARS_PER_PHRASE)) };
  }

  get finishedAt(): number {
    return this.endTime;
  }

  schedule(now: number, lookahead: number): void {
    if (this.cursor.time >= this.endTime) return;
    const { due, next } = dueBars(this.cursor, this.style.bpm, now, lookahead);
    this.cursor = next;
    for (const { bar, time } of due) {
      if (time >= this.endTime) break;
      for (const event of generateBar(this.style, this.seed, bar)) {
        const at = eventTime(time, event.beat, this.style.bpm);
        if (isLate(at, now, mixConfig.music.lateToleranceSeconds) || at >= this.endTime) continue;
        this.play(event, Math.max(at, now));
      }
    }
  }

  fadeOut(at: number, seconds: number): void {
    const gain = this.bus.gain;
    gain.cancelScheduledValues(at);
    gain.setValueAtTime(gain.value, at);
    gain.linearRampToValueAtTime(0, at + seconds);
    this.endTime = at + seconds;
  }

  dispose(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    for (const node of this.nodes) node.disconnect();
    this.bus.disconnect();
  }

  private play(event: MusicEvent, t: number): void {
    const out = this.parts.get(event.part);
    if (!out) return;
    const spb = 60 / this.style.bpm;
    const dur = event.dur * spb;
    const { vel } = event;
    const midi = event.notes[0] ?? 60;
    switch (event.part) {
      case 'kick':
        this.kick(out, t, vel);
        return;
      case 'snare':
        this.style.drums.rim ? this.rim(out, t, vel) : this.snare(out, t, vel);
        return;
      case 'hat':
        this.noiseHit(out, t, vel, 'highpass', 7000, 0.7, event.dur >= 0.5 ? 0.12 : 0.022);
        return;
      case 'bass':
        this.bass(out, t, dur, midi, vel);
        return;
      case 'keys':
        this.keys(out, t, dur, event.notes, vel);
        return;
      case 'pad':
        this.pad(out, t, dur, event.notes, vel);
        return;
      case 'lead':
        this.lead(out, this.style.lead.instrument, t, dur, midi, vel);
        return;
      case 'arp':
        this.bell(out, t, midi, vel, 0.45, 2);
        return;
      case 'riser':
        this.riser(out, t, dur, vel);
        return;
    }
  }

  private start(source: AudioScheduledSourceNode, t: number, stop: number): void {
    source.start(t);
    source.stop(stop);
  }

  private startBuffer(
    source: AudioBufferSourceNode,
    t: number,
    stop: number,
    offset: number,
  ): void {
    source.start(t, offset);
    source.stop(stop);
  }

  private noiseSource(): { source: AudioBufferSourceNode; offset: number } {
    const source = this.ctx.createBufferSource();
    source.buffer = this.shared.noise;
    source.loop = true;
    this.noiseOffset = (this.noiseOffset + 0.137) % 0.9;
    return { source, offset: this.noiseOffset };
  }

  private noiseHit(
    out: AudioNode,
    t: number,
    vel: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    decay: number,
  ): void {
    const { source, offset } = this.noiseSource();
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    source.connect(filter);
    filter.connect(envelope(this.ctx, out, t, vel, 0.001, decay));
    this.startBuffer(source, t, t + decay * 7, offset);
  }

  private kick(out: AudioNode, t: number, vel: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    osc.connect(envelope(this.ctx, out, t, vel, 0.002, 0.12));
    this.start(osc, t, t + 0.7);
  }

  private snare(out: AudioNode, t: number, vel: number): void {
    this.noiseHit(out, t, vel * 0.9, 'bandpass', 1800, 0.7, 0.07);
    const body = this.ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.value = 185;
    body.connect(envelope(this.ctx, out, t, vel * 0.5, 0.001, 0.045));
    this.start(body, t, t + 0.3);
  }

  private rim(out: AudioNode, t: number, vel: number): void {
    this.noiseHit(out, t, vel * 1.2, 'bandpass', 2600, 4, 0.012);
    const knock = this.ctx.createOscillator();
    knock.frequency.value = 820;
    knock.connect(envelope(this.ctx, out, t, vel * 0.5, 0.0005, 0.02));
    this.start(knock, t, t + 0.15);
  }

  private bass(out: AudioNode, t: number, dur: number, midi: number, vel: number): void {
    const osc = this.ctx.createOscillator();
    osc.setPeriodicWave(this.shared.bassWave);
    osc.frequency.value = midiToFreq(midi);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.setTargetAtTime(600, t, 0.15);
    // Pluck: quick attack, settle to a sustain, short release at the note's end.
    const amp = envelope(this.ctx, out, t, vel, 0.008, null);
    amp.gain.setTargetAtTime(vel * 0.55, t + 0.008, 0.12);
    amp.gain.setTargetAtTime(0, t + dur, 0.05);
    osc.connect(filter);
    filter.connect(amp);
    this.start(osc, t, t + dur + 0.4);
  }

  /** Two-operator FM electric piano per note, slightly strummed. */
  private keys(
    out: AudioNode,
    t: number,
    dur: number,
    notes: readonly number[],
    vel: number,
  ): void {
    const level = vel / Math.sqrt(notes.length);
    notes.forEach((midi, i) => {
      const start = t + i * 0.008;
      const freq = midiToFreq(midi);
      const carrier = this.ctx.createOscillator();
      carrier.frequency.value = freq;
      const modulator = this.ctx.createOscillator();
      modulator.frequency.value = freq;
      const index = this.ctx.createGain();
      index.gain.setValueAtTime(freq * (0.25 + 1.4 * vel), start);
      index.gain.setTargetAtTime(freq * 0.25, start, 0.35);
      modulator.connect(index);
      index.connect(carrier.frequency);
      const tau = 1.1 * (220 / freq) ** 0.25;
      carrier.connect(envelope(this.ctx, out, start, level, 0.004, tau, { at: t + dur, tau: 0.1 }));
      this.start(carrier, start, t + dur + 0.6);
      this.start(modulator, start, t + dur + 0.6);
    });
  }

  /** Warm pad: two detuned saws per note through one low-pass, slow attack and release. */
  private pad(out: AudioNode, t: number, dur: number, notes: readonly number[], vel: number): void {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900 + 500 * vel;
    filter.Q.value = 0.7;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(vel / Math.sqrt(notes.length * 2), t + 0.6);
    amp.gain.setTargetAtTime(0, t + dur, 0.3);
    filter.connect(amp);
    amp.connect(out);
    for (const midi of notes) {
      for (const cents of [-8, 8]) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiToFreq(midi);
        osc.detune.value = cents;
        osc.connect(filter);
        this.start(osc, t, t + dur + 1.5);
      }
    }
  }

  /** Music-box bell; `length` scales the ring, `partials` trims the work for fast arpeggios. */
  private bell(
    out: AudioNode,
    t: number,
    midi: number,
    vel: number,
    length = 1,
    partials = 3,
  ): void {
    const freq = midiToFreq(midi);
    for (const [ratio, amp, tau] of BELL.slice(0, partials)) {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = freq * ratio;
      osc.connect(envelope(this.ctx, out, t, vel * amp, 0.0015, tau * length));
      // Five time constants is −43 dB: stop there, so fast passages keep few live nodes.
      this.start(osc, t, t + tau * length * 5);
    }
  }

  private lead(
    out: AudioNode,
    kind: LeadInstrument,
    t: number,
    dur: number,
    midi: number,
    vel: number,
  ): void {
    const freq = midiToFreq(midi);
    if (kind === 'bell') {
      this.bell(out, t, midi, vel);
      return;
    }
    if (kind === 'mallet') {
      for (const [ratio, amp, tau] of [
        [1, 1, 1],
        [4, 0.25, 0.12],
      ] as const) {
        const osc = this.ctx.createOscillator();
        osc.frequency.value = freq * ratio;
        osc.connect(envelope(this.ctx, out, t, vel * amp, 0.002, tau));
        this.start(osc, t, t + tau * 5);
      }
      return;
    }
    const osc = this.ctx.createOscillator();
    osc.frequency.value = freq;
    if (kind === 'pluck') {
      osc.type = 'triangle';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2600, t);
      filter.frequency.setTargetAtTime(500, t, 0.12);
      osc.connect(filter);
      filter.connect(
        envelope(this.ctx, out, t, vel, 0.003, 0.35, { at: t + dur + 0.2, tau: 0.06 }),
      );
      this.start(osc, t, t + dur + 0.6);
      return;
    }
    // Flute: soft harmonics, breathy attack, vibrato that blooms after a moment.
    osc.setPeriodicWave(this.shared.fluteWave);
    const vibrato = this.ctx.createOscillator();
    vibrato.frequency.value = 5;
    const depth = this.ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(freq * 0.006, t + Math.min(0.4, dur));
    vibrato.connect(depth);
    depth.connect(osc.frequency);
    osc.connect(envelope(this.ctx, out, t, vel, 0.06, null, { at: t + dur, tau: 0.08 }));
    this.start(osc, t, t + dur + 0.5);
    this.start(vibrato, t, t + dur + 0.5);
  }

  /** Filtered-noise riser over two bars: tension before the next phrase. */
  private riser(out: AudioNode, t: number, dur: number, vel: number): void {
    const { source, offset } = this.noiseSource();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(vel, t + dur * 0.95);
    amp.gain.linearRampToValueAtTime(0, t + dur);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(out);
    this.startBuffer(source, t, t + dur + 0.05, offset);
  }
}

export class MusicDirector {
  private current: ContextPlayer | null = null;
  private readonly fading: ContextPlayer[] = [];
  private readonly shared: Shared;
  private readonly input: GainNode;

  constructor(
    private readonly ctx: BaseAudioContext,
    output: AudioNode,
  ) {
    this.input = ctx.createGain();
    this.input.connect(output);
    this.shared = makeShared(ctx, this.input);
  }

  get context(): MusicContext {
    return this.current?.context ?? 'silent';
  }

  set(
    context: MusicContext,
    options: MusicOptions = {},
    fadeIn: number = mixConfig.music.crossfadeSeconds,
    startBar = 0,
  ): void {
    if (context === this.context) return;
    const now = this.ctx.currentTime;
    if (this.current) {
      this.current.fadeOut(now, context === 'silent' ? mixConfig.music.fadeOutSeconds : fadeIn);
      this.fading.push(this.current);
      this.current = null;
    }
    if (context === 'silent') return;
    this.current = new ContextPlayer(
      this.ctx,
      context,
      musicStyles[context],
      options.seed ?? 1,
      this.shared,
      this.input,
      now + 0.05,
      fadeIn,
      startBar,
    );
    this.tick(now);
  }

  /** Called by the engine's timer: schedules what's due and retires faded players. */
  tick(now: number, lookahead: number = mixConfig.music.lookaheadSeconds): void {
    this.current?.schedule(now, lookahead);
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const player = this.fading[i];
      if (!player) continue;
      player.schedule(now, lookahead);
      if (now > player.finishedAt + 2) {
        player.dispose();
        this.fading.splice(i, 1);
      }
    }
  }

  position(): { bar: number; section: string } | null {
    return this.current?.position(this.ctx.currentTime) ?? null;
  }

  dispose(): void {
    this.current?.dispose();
    for (const player of this.fading) player.dispose();
    this.fading.length = 0;
    this.current = null;
    this.input.disconnect();
  }
}

/**
 * Renders `seconds` of a context offline (no fade-in) from `startBar` for the audio lab's
 * loudness check; bar 8 skips the intro phrase, so it measures the main loop.
 */
export async function renderMusicOffline(
  context: Exclude<MusicContext, 'silent'>,
  seconds: number,
  { sampleRate = 22050, startBar = BARS_PER_PHRASE, seed = 7 } = {},
): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(2, Math.round(seconds * sampleRate), sampleRate);
  const director = new MusicDirector(offline, offline.destination);
  director.set(context, { seed }, 0, startBar);
  director.tick(0, seconds);
  return offline.startRendering();
}
