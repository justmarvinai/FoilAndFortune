import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import cards from './locales/en/cards.json';
import common from './locales/en/common.json';
import errors from './locales/en/errors.json';

/**
 * i18n setup (docs/06 §13). English ships first; German is planned before v1.0 (Q4).
 * No user-facing string literals in game components (CLAUDE.md rule 8). Debug pages are exempt.
 */
export const defaultNS = 'common';
export const resources = { en: { common, errors, cards } } as const;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['en'];
  }
}

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'errors', 'cards'],
  defaultNS,
  resources,
  interpolation: { escapeValue: false },
});

export default i18n;
