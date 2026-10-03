import { useSyncExternalStore } from 'react';
import { useSettingsStore } from '@/state/settingsStore';

/**
 * Comfort settings for the stage (docs/05 §10, docs/04 §12): reduced motion from the in-game
 * setting OR the operating system, and the screen-shake toggle.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export function systemReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

export interface StageMotion {
  reduced: boolean;
  shake: boolean;
}

export function useStageMotion(): StageMotion {
  const setting = useSettingsStore((store) => store.settings.reducedMotion);
  const shake = useSettingsStore((store) => store.settings.screenShake);
  const system = useSyncExternalStore(subscribe, systemReducedMotion, () => false);
  const reduced = setting || system;
  return { reduced, shake: shake && !reduced };
}

/** The same, read at call time (event handlers, the FX director). */
export function stageMotionNow(): StageMotion {
  const { reducedMotion, screenShake } = useSettingsStore.getState().settings;
  const reduced = reducedMotion || systemReducedMotion();
  return { reduced, shake: screenShake && !reduced };
}
