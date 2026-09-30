import { create } from 'zustand';
import { loadSettings, type Settings, saveSettings } from '@/save/settings';

/**
 * Player settings as a reactive store (docs/07 §6). Loaded once from localStorage and written
 * back on every change. Audio, quality and accessibility code subscribe to the slices they need.
 */
export interface SettingsStore {
  settings: Settings;
  update(patch: Partial<Settings>): void;
  setVolume(channel: keyof Settings['volume'], value: number): void;
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  settings: loadSettings(),
  update(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    saveSettings(settings);
  },
  setVolume(channel, value) {
    const { settings } = get();
    const volume = { ...settings.volume, [channel]: Math.min(1, Math.max(0, value)) };
    get().update({ volume });
  },
}));
