import type { Rarity } from '@/content/schema/common';
import type { AudioEngine } from './engine/engine';
import { mixConfig } from './mixConfig';

/**
 * Audio API (docs/06 §10, docs/04 §11). Every feature plays sounds through these functions, so
 * the implementation can lazy-load, pool and mix without touching callers.
 *
 * This module stays tiny on purpose: it ships in the entry chunk. `unlockAudio()` creates the
 * AudioContext inside the user's gesture (Safari/iOS rule) and then lazy-loads the engine (synth,
 * SFX renderer, music director). Until the engine runs, calls are cheap no-ops: SFX older than
 * `mixConfig.sfx.pendingTtlMs` are dropped, never queued forever; the music context is remembered
 * and starts as soon as the engine is ready. Without Web Audio (tests, old browsers) everything
 * stays a silent no-op.
 */

/** Sound effect ids. Group prefixes: `ui.*` interface, `shop.*` world, `pack.*` opening. */
export type SfxId =
  | 'ui.pop'
  | 'ui.open'
  | 'ui.close'
  | 'ui.tab'
  | 'ui.tick'
  | 'ui.toggle'
  | 'ui.error'
  | 'ui.stamp'
  | 'ui.receipt'
  | 'ui.levelUp'
  | 'ui.achievement'
  | 'ui.notify'
  | 'ui.paper'
  | 'ui.coin'
  | 'ui.coins'
  | 'shop.doorBell'
  | 'shop.register'
  | 'shop.chaChing'
  | 'shop.restock'
  | 'shop.delivery'
  | 'shop.boxOpen'
  | 'shop.priceTag'
  | 'shop.orderSent'
  | 'shop.angry'
  | 'shop.happy'
  | 'pack.tear'
  | 'pack.slide'
  | 'pack.flip'
  | 'pack.snap'
  | 'pack.glow'
  | 'pack.shimmer'
  | 'pack.newCard'
  | 'pack.stingerRare'
  | 'pack.stingerHolo'
  | 'pack.stingerUltra'
  | 'pack.stingerIllustration'
  | 'pack.stingerSecret'
  | 'pack.stingerMythic'
  | 'pack.godPack';

export interface SfxOptions {
  /** 0–1 multiplier on the SFX channel. */
  volume?: number;
  /** Playback-rate multiplier (pitch variation), on top of the preset's own random spread. */
  rate?: number;
  /** Stereo position, −1 (left) … +1 (right). */
  pan?: number;
  /** Start this many seconds from now, on the audio clock (e.g. a second register beep). */
  delay?: number;
}

/** What the music director should play (docs/06 §10). */
export type MusicContext = 'title' | 'day' | 'evening' | 'night' | 'opening' | 'silent';

export interface MusicOptions {
  /** Variation seed: the same seed plays the same arrangement (e.g. the in-game day). */
  seed?: number;
}

/** Blip-voice profile (docs/04, docs/06 §10): derived from a character's look seed. */
export interface VoiceProfile {
  seed: number;
  /** 0 = low, 1 = high. */
  pitch: number;
  /** 0 = soft and round, 1 = buzzy and bright. Derived from `seed` when absent. */
  timbre?: number;
  /** Talking speed multiplier (≈ 0.85–1.15). Derived from `seed` when absent. */
  rate?: number;
}

/** The melody of a blip phrase: how the character feels. */
export type VoiceMood = 'neutral' | 'happy' | 'grumble' | 'question' | 'excited';

export type AudioStatus = 'locked' | 'loading' | 'running' | 'unavailable';

export { voiceForSeed } from './voiceProfile';

let context: AudioContext | null = null;
let engine: AudioEngine | null = null;
let status: AudioStatus = 'locked';
let music: { context: MusicContext; options: MusicOptions } = { context: 'silent', options: {} };
const pending: { id: SfxId; options: SfxOptions | undefined; at: number }[] = [];

const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());

export function getAudioStatus(): AudioStatus {
  return status;
}

/** The running engine, for the audio lab and the reactions (null until unlocked and loaded). */
export function getAudioEngine(): AudioEngine | null {
  return engine;
}

export function playSfx(id: SfxId, options?: SfxOptions): void {
  if (engine) {
    engine.playSfx(id, options);
  } else if (status === 'loading' && pending.length < 8) {
    pending.push({ id, options, at: now() });
  }
}

export function setMusic(next: MusicContext, options: MusicOptions = {}): void {
  music = { context: next, options };
  engine?.setMusic(next, options);
}

/** Speaks `syllables` blips in a character's voice (customer reactions, Theo). */
export function speak(voice: VoiceProfile, syllables: number, mood: VoiceMood = 'neutral'): void {
  engine?.speak(voice, syllables, mood);
}

/** Lowers the music by `amount` (0–1) for `ms`, e.g. under a big reveal; overlapping calls merge. */
export function duckMusic(amount: number, ms: number): void {
  engine?.duck(amount, ms);
}

/** The rarity stinger for a pulled card (an ascending family, docs/05 §6), or null for none. */
export function stingerForRarity(rarity: Rarity): SfxId | null {
  switch (rarity) {
    case 'rare':
      return 'pack.stingerRare';
    case 'holoRare':
      return 'pack.stingerHolo';
    case 'ultraRare':
      return 'pack.stingerUltra';
    case 'illustrationRare':
      return 'pack.stingerIllustration';
    case 'secretRare':
      return 'pack.stingerSecret';
    case 'mythicRare':
      return 'pack.stingerMythic';
    default:
      return null;
  }
}

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

/**
 * Unlocks audio on the first user gesture (Safari/iOS rule, CLAUDE.md gotchas). Idempotent: later
 * calls only resume a context the browser suspended or interrupted (tab switch, phone call).
 */
export function unlockAudio(): void {
  if (status === 'unavailable') return;
  if (context) {
    if (context.state !== 'running' && context.state !== 'closed') {
      context.resume().catch(() => undefined);
    }
    return;
  }
  const scope = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) {
    status = 'unavailable';
    return;
  }
  let created: AudioContext;
  try {
    created = new Ctor({ latencyHint: 'interactive' });
  } catch {
    status = 'unavailable';
    return;
  }
  context = created;
  created.resume().catch(() => undefined);
  // iOS only opens the output once a sound starts inside the gesture: one silent sample does it.
  try {
    const source = created.createBufferSource();
    source.buffer = created.createBuffer(1, 1, created.sampleRate);
    source.connect(created.destination);
    source.start();
  } catch {
    // Not fatal: the context still resumes on the next gesture.
  }
  status = 'loading';
  import('./engine/engine').then(
    ({ createEngine }) => {
      engine = createEngine(created, music);
      status = 'running';
      const cutoff = now() - mixConfig.sfx.pendingTtlMs;
      for (const call of pending.splice(0))
        if (call.at >= cutoff) engine.playSfx(call.id, call.options);
    },
    (error: unknown) => {
      status = 'unavailable';
      pending.length = 0;
      console.warn('Audio engine failed to load', error);
    },
  );
}

let reactionRefs = 0;
let reactionsOff: (() => void) | null = null;
let reactionsLoading = false;

/**
 * Plays the sounds that belong to sim events (docs/05 §6): the door bell, register beeps and the
 * customers' happy or grumbly blips. Lazy and reference-counted, so it is safe to call from an
 * effect (StrictMode mounts twice); every returned disposer releases one reference.
 */
export function installAudioReactions(): () => void {
  reactionRefs++;
  if (!reactionsOff && !reactionsLoading) {
    reactionsLoading = true;
    import('./reactions/install').then(
      ({ installReactions }) => {
        reactionsLoading = false;
        if (reactionRefs > 0 && !reactionsOff) reactionsOff = installReactions();
      },
      (error: unknown) => {
        reactionsLoading = false;
        console.warn('Audio reactions failed to load', error);
      },
    );
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    reactionRefs--;
    if (reactionRefs === 0 && reactionsOff) {
      reactionsOff();
      reactionsOff = null;
    }
  };
}
