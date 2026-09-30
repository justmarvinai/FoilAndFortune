import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import audio from './locales/en/audio.json';
import cards from './locales/en/cards.json';
import common from './locales/en/common.json';
import errors from './locales/en/errors.json';
import opening from './locales/en/opening.json';
import scene from './locales/en/scene.json';
import sheets from './locales/en/sheets.json';
import shell from './locales/en/shell.json';

/**
 * i18n setup (docs/06 §13). English ships first; German is planned before v1.0 (Q4).
 * No user-facing string literals in game components (CLAUDE.md rule 8). Debug pages are exempt.
 *
 * One namespace per UI area: `shell` (title, new game, HUD, dock, day summary, celebrations,
 * settings), `sheets` (inventory, price board, Crate, binder, fixture popover), `opening` (the
 * pack-opening stage), `scene` (the shop world and bubbles) and `audio` (sound settings).
 */
export const defaultNS = 'common';
export const namespaces = [
  'common',
  'errors',
  'cards',
  'shell',
  'sheets',
  'opening',
  'scene',
  'audio',
] as const;
export const resources = {
  en: { common, errors, cards, shell, sheets, opening, scene, audio },
} as const;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['en'];
  }
}

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: [...namespaces],
  defaultNS,
  resources,
  interpolation: { escapeValue: false },
});

export default i18n;
