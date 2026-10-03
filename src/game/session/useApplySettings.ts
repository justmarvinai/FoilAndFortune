import { useEffect, useSyncExternalStore } from 'react';
import { useSettingsStore } from '@/state/settingsStore';

/**
 * Applies the comfort settings to the document (docs/05 §10): text size scales the root font
 * (every rem-based size follows, docs/04 §3), reduced motion and the dyslexia-friendly font are
 * attributes that `src/game/shell/shell.css` reacts to. Used by the title and play screens.
 */
export function useApplySettings(): void {
  const textScale = useSettingsStore((store) => store.settings.textScale);
  const reducedMotion = useSettingsStore((store) => store.settings.reducedMotion);
  const legibleFont = useSettingsStore((store) => store.settings.dyslexiaFont);

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = textScale === 1 ? '' : `${Math.round(textScale * 100)}%`;
    root.toggleAttribute('data-reduced-motion', reducedMotion);
    root.toggleAttribute('data-legible-font', legibleFont);
    return () => {
      root.style.fontSize = '';
      root.removeAttribute('data-reduced-motion');
      root.removeAttribute('data-legible-font');
    };
  }, [textScale, reducedMotion, legibleFont]);
}

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribeSystem(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** Reduced motion from the in-game setting OR the operating system (docs/04 §12). */
export function useReducedMotion(): boolean {
  const setting = useSettingsStore((store) => store.settings.reducedMotion);
  const system = useSyncExternalStore(
    subscribeSystem,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
  return setting || system;
}

/** Non-React variant for event handlers. */
export function prefersReducedMotion(): boolean {
  return useSettingsStore.getState().settings.reducedMotion || window.matchMedia(QUERY).matches;
}
