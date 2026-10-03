import { type MusicContext, setMusic, unlockAudio } from '@/audio';
import type { Phase } from '@/sim/state/types';

/**
 * Audio plumbing for the game screens (docs/06 §10): unlock on the first gesture (Safari/iOS,
 * CLAUDE.md gotchas) and pick the music by what's on screen.
 */
export function installAudioUnlock(): () => void {
  const unlock = () => {
    unlockAudio();
    remove();
  };
  const remove = () => {
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  return remove;
}

/** Evening music from 17:00, when the diorama's lamps come on (docs/04 §2.4). */
const EVENING_MINUTE = 17 * 60;

export function musicFor(input: {
  phase: Phase | null;
  minute: number;
  stageOpen: boolean;
}): MusicContext {
  if (input.stageOpen) return 'opening';
  switch (input.phase) {
    case null:
      return 'silent';
    case 'prep':
      return 'day';
    case 'open':
      return input.minute >= EVENING_MINUTE ? 'evening' : 'day';
    case 'night':
      return 'night';
  }
}

/** Calls `setMusic` only when the context actually changes. */
export function createMusicDirector(): (context: MusicContext) => void {
  let current: MusicContext | null = null;
  return (context) => {
    if (context === current) return;
    current = context;
    setMusic(context);
  };
}
