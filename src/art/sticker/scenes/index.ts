import type { ArtComposition, BiomeId } from '@/art/types';
import type { Box } from '../core/path';
import type { Ids } from '../core/svg';
import { lagoon } from './lagoon';
import { stormMeadow } from './stormMeadow';
import { volcanoDawn } from './volcanoDawn';

/** Everything a background needs to lay itself out around the creature. */
export interface SceneFrame {
  width: number;
  height: number;
  /** Output px per reference px (line weights, particle sizes). */
  px: number;
  composition: ArtComposition;
  biome: BiomeId;
  timeOfDay: 'day' | 'dusk' | 'night';
  seed: number;
  /** Where the creature's feet touch the ground. */
  groundY: number;
  /** Creature bounds in output px. */
  creature: Box;
}

export interface RimLight {
  color: string;
  alpha: number;
}

/**
 * Light the scene bounces onto the sticker's shadow side: none by day (the sticker reads as
 * printed), warm at dusk, cool (or lava-hot) at night, so the creature sits in its scene.
 */
export function rimLight(frame: SceneFrame): RimLight | null {
  if (frame.timeOfDay === 'day') return null;
  const dusk = frame.timeOfDay === 'dusk';
  switch (frame.biome) {
    case 'storm-meadow':
      return dusk ? { color: '#FFB38A', alpha: 0.6 } : { color: '#9FE3FF', alpha: 0.55 };
    case 'volcano-dawn':
      return dusk ? { color: '#FF9A5E', alpha: 0.6 } : { color: '#FF8A4D', alpha: 0.6 };
    case 'lagoon':
      return dusk ? { color: '#FFB38A', alpha: 0.6 } : { color: '#9CC4FF', alpha: 0.55 };
  }
}

/** Biome backdrops (docs/04 §6.2), flat layered vector scenery in output pixels. */
export function drawScene(ids: Ids, frame: SceneFrame): string {
  switch (frame.biome) {
    case 'storm-meadow':
      return stormMeadow(ids, frame);
    case 'volcano-dawn':
      return volcanoDawn(ids, frame);
    case 'lagoon':
      return lagoon(ids, frame);
  }
}
