import type { Settings } from '@/save/settings';
import { useSettingsStore } from '@/state/settingsStore';
import type {
  MusicContext,
  MusicOptions,
  SfxId,
  SfxOptions,
  VoiceMood,
  VoiceProfile,
} from '../index';
import { type Channel, mixConfig } from '../mixConfig';
import { SFX_IDS, sfxPresets } from '../sfx/presets';
import { renderSfx, sfxSampleRate } from '../sfx/render';
import { planUtterance } from '../voice/plan';
import { dbToGain, volumeToGain } from '../volume';
import { MusicDirector } from './music';
import { playUtterance } from './voice';

/**
 * The AudioManager (docs/06 §10), lazy-loaded by `unlockAudio()`.
 *
 *   music (director → tape wow → high-pass → duck) ─┐
 *   sfx (cached buffers) ───────────────────────────┤→ master → limiter → speakers
 *   voices (blips) ─────────────────────────────────┤
 *   ambience ───────────────────────────────────────┘
 *
 * Channel gains follow the settings store live (perceptual curve, smooth ramps). SFX render once
 * into cached AudioBuffers, in idle slices right after unlock. The tab going hidden suspends the
 * context, so a background tab costs no CPU.
 */

export interface EngineStats {
  state: AudioContextState | 'interrupted';
  sampleRate: number;
  sfxReady: number;
  sfxTotal: number;
  activeSfx: number;
  activeVoices: number;
  music: MusicContext;
  bar: number | null;
  section: string | null;
  duck: number;
}

export interface AudioEngine {
  readonly ctx: AudioContext;
  /** Post-limiter tap for meters (audio lab). */
  readonly analyser: AnalyserNode;
  playSfx(id: SfxId, options?: SfxOptions): void;
  setMusic(context: MusicContext, options?: MusicOptions): void;
  speak(voice: VoiceProfile, syllables: number, mood: VoiceMood): void;
  duck(amount: number, ms: number, at?: number): void;
  stats(): EngineStats;
  dispose(): void;
}

const CHANNELS: readonly Exclude<Channel, 'master'>[] = ['music', 'sfx', 'voices', 'ambience'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function createEngine(
  ctx: AudioContext,
  initial: { context: MusicContext; options: MusicOptions },
): AudioEngine {
  // ---- Mixer graph
  const limiter = ctx.createDynamicsCompressor();
  const { threshold, knee, ratio, attack, release } = mixConfig.limiter;
  limiter.threshold.value = threshold;
  limiter.knee.value = knee;
  limiter.ratio.value = ratio;
  limiter.attack.value = attack;
  limiter.release.value = release;
  limiter.connect(ctx.destination);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  limiter.connect(analyser);
  const master = ctx.createGain();
  master.connect(limiter);
  const channels = {} as Record<Exclude<Channel, 'master'>, GainNode>;
  for (const channel of CHANNELS) {
    const gain = ctx.createGain();
    gain.connect(master);
    channels[channel] = gain;
  }

  const applyVolumes = (volume: Settings['volume'], smooth: boolean) => {
    const set = (param: AudioParam, channel: Channel) => {
      const value = volumeToGain(volume[channel]) * dbToGain(mixConfig.trimDb[channel]);
      if (smooth) param.setTargetAtTime(value, ctx.currentTime, mixConfig.volumeSmoothing);
      else param.value = value;
    };
    set(master.gain, 'master');
    for (const channel of CHANNELS) set(channels[channel].gain, channel);
  };
  applyVolumes(useSettingsStore.getState().settings.volume, false);
  const offSettings = useSettingsStore.subscribe((state, previous) => {
    if (state.settings.volume !== previous.settings.volume)
      applyVolumes(state.settings.volume, true);
  });

  // ---- Music: director → tape wow/flutter (modulated delay) → high-pass → duck → music channel
  const duckGain = ctx.createGain();
  duckGain.connect(channels.music);
  const highPass = ctx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 35;
  highPass.connect(duckGain);
  const wow = ctx.createDelay(0.05);
  wow.delayTime.value = 0.006;
  wow.connect(highPass);
  const lfos: OscillatorNode[] = [];
  for (const [rate, depth] of [mixConfig.music.wow, mixConfig.music.flutter]) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const amount = ctx.createGain();
    amount.gain.value = depth;
    lfo.connect(amount);
    amount.connect(wow.delayTime);
    lfo.start();
    lfos.push(lfo);
  }
  const director = new MusicDirector(ctx, wow);
  director.set(initial.context, initial.options);
  const timer = setInterval(() => {
    if (ctx.state === 'running') director.tick(ctx.currentTime);
  }, mixConfig.music.tickMs);

  let duckUntil = 0;
  let duckDepth = 0;
  const duck = (amount: number, ms: number, at = ctx.currentTime) => {
    const now = ctx.currentTime;
    const start = Math.max(now, at);
    const end = start + Math.max(0, ms) / 1000;
    const depth = clamp(amount, 0, 0.95);
    const active = now < duckUntil;
    duckDepth = active ? Math.max(duckDepth, depth) : depth;
    duckUntil = active ? Math.max(duckUntil, end) : end;
    const param = duckGain.gain;
    param.cancelScheduledValues(start);
    param.setTargetAtTime(1 - duckDepth, start, mixConfig.duck.attack);
    param.setTargetAtTime(1, duckUntil, mixConfig.duck.release);
  };

  // ---- SFX: render once into AudioBuffers, idle slices after unlock, on demand if needed sooner
  const buffers = new Map<string, AudioBuffer>();
  const queue: [SfxId, number][] = SFX_IDS.flatMap((id) =>
    Array.from(
      { length: sfxPresets[id].variants ?? 1 },
      (_, variant) => [id, variant] as [SfxId, number],
    ),
  );
  const sfxTotal = queue.length;
  const bufferFor = (id: SfxId, variant: number): AudioBuffer => {
    const key = `${id}#${variant}`;
    const cached = buffers.get(key);
    if (cached) return cached;
    const preset = sfxPresets[id];
    const rate = sfxSampleRate(preset, ctx.sampleRate);
    const data = renderSfx(preset, rate, variant);
    const buffer = ctx.createBuffer(data.length, data[0]?.length ?? 1, rate);
    for (const [index, channel] of data.entries()) buffer.copyToChannel(channel, index);
    buffers.set(key, buffer);
    return buffer;
  };
  let disposed = false;
  const idle = (callback: () => void) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(callback, { timeout: 250 });
    else setTimeout(callback, 16);
  };
  const pump = () => {
    if (disposed) return;
    const until = performance.now() + mixConfig.sfx.renderSliceMs;
    do {
      const next = queue.shift();
      if (next) bufferFor(next[0], next[1]);
    } while (queue.length > 0 && performance.now() < until);
    if (queue.length > 0) idle(pump);
  };
  idle(pump);

  const lastPlayed = new Map<SfxId, number>();
  const activeSfx = new Set<AudioBufferSourceNode>();
  const playSfx = (id: SfxId, options: SfxOptions = {}) => {
    const preset = sfxPresets[id];
    if (!preset || activeSfx.size >= mixConfig.sfx.maxVoices) return;
    const nowMs = performance.now();
    if (
      preset.minIntervalMs &&
      nowMs - (lastPlayed.get(id) ?? Number.NEGATIVE_INFINITY) < preset.minIntervalMs
    ) {
      return;
    }
    lastPlayed.set(id, nowMs);
    const variants = preset.variants ?? 1;
    const buffer = bufferFor(id, variants > 1 ? Math.floor(Math.random() * variants) : 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const jitter = preset.jitter ?? 0;
    source.playbackRate.value = (options.rate ?? 1) * (1 + (Math.random() * 2 - 1) * jitter);
    const gain = ctx.createGain();
    gain.gain.value = dbToGain(preset.gainDb) * clamp(options.volume ?? 1, 0, 1);
    source.connect(gain);
    let tail: AudioNode = gain;
    if (options.pan) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(options.pan, -1, 1);
      gain.connect(panner);
      tail = panner;
    }
    tail.connect(channels.sfx);
    const when = ctx.currentTime + Math.max(0, options.delay ?? 0);
    source.start(when);
    activeSfx.add(source);
    source.onended = () => {
      activeSfx.delete(source);
      source.disconnect();
      tail.disconnect();
      if (tail !== gain) gain.disconnect();
    };
    if (preset.duck) duck(preset.duck.amount, preset.duck.ms, when);
  };

  // ---- Voices: blip speech (voice.ts), a few at a time
  let activeVoices = 0;
  let utterances = 0;
  const speak = (voice: VoiceProfile, syllables: number, mood: VoiceMood) => {
    if (activeVoices >= mixConfig.voices.maxConcurrent) return;
    const plan = planUtterance(voice, syllables, mood, utterances++);
    const source = playUtterance(ctx, channels.voices, plan, ctx.currentTime + 0.01);
    activeVoices++;
    source.onended = () => {
      activeVoices--;
    };
  };

  // ---- Lifecycle: background tabs suspend; any later gesture resumes (iOS interruptions too)
  const onVisibility = () => {
    if (document.hidden) ctx.suspend().catch(() => undefined);
    else ctx.resume().catch(() => undefined);
  };
  const onGesture = () => {
    if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => undefined);
  };
  document.addEventListener('visibilitychange', onVisibility);
  for (const type of ['pointerdown', 'keydown', 'touchend'] as const) {
    window.addEventListener(type, onGesture, { capture: true, passive: true });
  }

  return {
    ctx,
    analyser,
    playSfx,
    setMusic: (context, options) => director.set(context, options),
    speak,
    duck,
    stats: () => {
      const position = director.position();
      return {
        state: ctx.state,
        sampleRate: ctx.sampleRate,
        sfxReady: sfxTotal - queue.length,
        sfxTotal,
        activeSfx: activeSfx.size,
        activeVoices,
        music: director.context,
        bar: position?.bar ?? null,
        section: position?.section ?? null,
        duck: duckGain.gain.value,
      };
    },
    dispose: () => {
      disposed = true;
      clearInterval(timer);
      offSettings();
      document.removeEventListener('visibilitychange', onVisibility);
      for (const type of ['pointerdown', 'keydown', 'touchend'] as const) {
        window.removeEventListener(type, onGesture, { capture: true });
      }
      director.dispose();
      for (const lfo of lfos) lfo.stop();
      ctx.close().catch(() => undefined);
    },
  };
}
