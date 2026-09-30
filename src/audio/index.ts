/**
 * Audio API (docs/06 §10, docs/04 audio). Every feature plays sounds through these functions, so
 * the implementation can lazy-load, pool and mix without touching callers.
 *
 * CONTRACT STUB: the audio work package replaces the bodies (keep the exported names and types;
 * add ids freely). Until then every call is a silent no-op.
 */

/** Sound effect ids. Group prefixes: `ui.*` interface, `shop.*` world, `pack.*` opening. */
export type SfxId =
  | 'ui.pop'
  | 'ui.open'
  | 'ui.close'
  | 'ui.tab'
  | 'ui.error'
  | 'ui.stamp'
  | 'ui.receipt'
  | 'ui.levelUp'
  | 'ui.coin'
  | 'shop.doorBell'
  | 'shop.register'
  | 'shop.chaChing'
  | 'shop.restock'
  | 'shop.delivery'
  | 'shop.angry'
  | 'shop.happy'
  | 'pack.tear'
  | 'pack.slide'
  | 'pack.flip'
  | 'pack.glow'
  | 'pack.stingerHolo'
  | 'pack.stingerUltra'
  | 'pack.stingerIllustration'
  | 'pack.stingerSecret'
  | 'pack.stingerMythic'
  | 'pack.godPack';

export interface SfxOptions {
  /** 0–1 multiplier on the SFX channel. */
  volume?: number;
  /** Playback-rate multiplier (pitch variation). */
  rate?: number;
}

/** What the music director should play (docs/06 §10). */
export type MusicContext = 'title' | 'day' | 'evening' | 'night' | 'opening' | 'silent';

/** Blip-voice profile (docs/04, docs/06 §10): derived from a character's look seed. */
export interface VoiceProfile {
  seed: number;
  /** 0 = low, 1 = high. */
  pitch: number;
}

export function playSfx(_id: SfxId, _options?: SfxOptions): void {}

export function setMusic(_context: MusicContext): void {}

/** Speaks `syllables` blips in a character's voice (customer reactions, Theo). */
export function speak(_voice: VoiceProfile, _syllables: number): void {}

/** Unlocks audio on the first user gesture (Safari/iOS rule, CLAUDE.md gotchas). */
export function unlockAudio(): void {}
