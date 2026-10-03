import { duckMusic as duck, playSfx, type SfxId, type SfxOptions } from '@/audio';
import type { Tier } from './model';

/**
 * The stage's sounds (docs/05 §6, docs/04 §11.2): one place maps moments to SFX ids, so the audio
 * package can retune them without touching the choreography. Music is the shell's job (its
 * director plays `opening` while the stage is up); stingers duck it on their own.
 */

const STINGERS: Record<Tier, SfxId | null> = {
  none: null,
  glint: 'pack.stingerRare',
  holo: 'pack.stingerHolo',
  ultra: 'pack.stingerUltra',
  illustration: 'pack.stingerIllustration',
  secret: 'pack.stingerSecret',
  mythic: 'pack.stingerMythic',
};

/** The stinger for a reveal tier; never masked by music (docs/04 §11.3). */
export function stingerFor(tier: Tier): SfxId | null {
  return STINGERS[tier];
}

export function sfx(id: SfxId, options?: SfxOptions): void {
  playSfx(id, options);
}

/** Pulls the music back for a slow-motion flip, so the stinger lands in the quiet. */
export function duckForReveal(): void {
  duck(0.45, 1600);
}

/** Mobile haptics (docs/05 §6): tear medium, Holo+ medium → heavy, Mythic a heavy pattern. */
export function haptic(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Unsupported or blocked without user activation.
  }
}

export const HAPTICS = {
  tear: 28,
  hit: [18, 40, 36],
  mythic: [60, 40, 120, 40, 220],
} as const satisfies Record<string, number | number[]>;
