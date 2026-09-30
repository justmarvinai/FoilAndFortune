/**
 * World lighting palettes (docs/04 §2.4): day = warm sun through the window with a hemisphere
 * fill; evening = dusky blue outside, warm lamps inside, neon on. The lighting driver blends
 * between two presets continuously, so adding "morning" or "late afternoon" later is just data.
 */
export type TimeOfDay = 'day' | 'evening';

export interface LightingPreset {
  background: { top: string; bottom: string; glow: string; stars: number };
  hemisphere: { sky: string; ground: string; intensity: number };
  sun: { color: string; intensity: number; shadowIntensity: number };
  /** `scene.environmentIntensity` for the Lightformer environment. */
  environment: number;
  /** 0 … 1: how "on" interior lamps, neon and street lights are. */
  lamps: number;
  /** Opacity of the fake volumetric sunbeam through the window. */
  sunbeam: number;
}

export const lightingPresets: Record<TimeOfDay, LightingPreset> = {
  day: {
    background: { top: '#A9D6F5', bottom: '#FFE6CC', glow: '#FFF4E2', stars: 0 },
    hemisphere: { sky: '#FFF3E0', ground: '#9E785C', intensity: 1.15 },
    sun: { color: '#FFE0B5', intensity: 3.1, shadowIntensity: 0.82 },
    environment: 0.75,
    lamps: 0,
    sunbeam: 1,
  },
  evening: {
    background: { top: '#10153A', bottom: '#33285A', glow: '#58427F', stars: 1 },
    hemisphere: { sky: '#5663AE', ground: '#3B2838', intensity: 0.42 },
    sun: { color: '#8E9CFF', intensity: 0.5, shadowIntensity: 0.55 },
    environment: 0.3,
    lamps: 1,
    sunbeam: 0,
  },
};

/** Direction *towards* the sun (normalised in the driver): from the street corner, high. */
export const SUN_DIRECTION: readonly [number, number, number] = [-0.46, 0.8, 0.38];

/** Centre and half-size of the sun's shadow frustum: covers the whole plinth. */
export const SHADOW_FRUSTUM = { center: [-0.95, 0, 0.9] as const, halfSize: 6.4, distance: 18 };

/** Seconds (time constant) for the day ↔ evening blend. */
export const TIME_OF_DAY_BLEND = 0.55;
