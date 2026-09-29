import { z } from '@/core/zod';

/**
 * Player settings (docs/07 §6), stored separately from saves in localStorage. Every field has a
 * default, so a missing or partially invalid blob never breaks the game.
 */
const volume = z.number().min(0).max(1);

export const settingsSchema = z.object({
  volume: z
    .object({
      master: volume.catch(0.8),
      music: volume.catch(0.6),
      sfx: volume.catch(0.8),
      voices: volume.catch(0.7),
      ambience: volume.catch(0.5),
    })
    .catch({ master: 0.8, music: 0.6, sfx: 0.8, voices: 0.7, ambience: 0.5 }),
  quality: z.enum(['auto', 'low', 'medium', 'high']).catch('auto'),
  textScale: z.number().min(0.9).max(1.5).catch(1),
  reducedMotion: z.boolean().catch(false),
  screenShake: z.boolean().catch(true),
  colorblind: z.boolean().catch(false),
  dyslexiaFont: z.boolean().catch(false),
  pauseOnInteraction: z.boolean().catch(true),
  relaxedCustomers: z.boolean().catch(false),
  language: z.enum(['en']).catch('en'),
});
export type Settings = z.infer<typeof settingsSchema>;

const STORAGE_KEY = 'ff.settings';

export function defaultSettings(): Settings {
  return settingsSchema.parse({});
}

export function loadSettings(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): Settings {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return settingsSchema.parse(raw ? JSON.parse(raw) : {});
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(
  settings: Settings,
  storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: settings just won't persist.
  }
}
