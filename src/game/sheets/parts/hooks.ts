import { useSyncExternalStore } from 'react';
import { useCardArt } from '@/cards/useCardArt';
import type { CardDef } from '@/content/schema/tcg';
import { useSettingsStore } from '@/state/settingsStore';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * Reduced motion from the in-game setting OR the operating system (docs/05 §10: instant page
 * turns, no pulses or shakes). The play shell mirrors the setting as `data-reduced-motion` on
 * <html> for CSS; this hook is for Motion props and JS animations.
 */
export function useReducedMotion(): boolean {
  const setting = useSettingsStore((store) => store.settings.reducedMotion);
  const system = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
  return setting || system;
}

/**
 * Card art for sheet grids, pockets and close-ups (src/cards/useCardArt.ts): pre-rendered files
 * only. The runtime Clay renderer stays off here, so a binder page or a singles grid never pulls
 * the renderer in; cards without a file show CardView's element placeholder.
 */
export function useSheetCardArt(card: CardDef): string | undefined {
  return useCardArt(card).url;
}
