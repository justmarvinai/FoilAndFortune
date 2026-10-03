import type { Settings } from '@/save/settings';
import type { QualityLevel } from '@/scene/quality';

/**
 * Picks the diorama's render tier (docs/06 §7 "Auto-detect runs on first launch, and the player
 * can override it"). A `?quality=` URL parameter wins, for playtests and E2E runs on software
 * WebGL.
 */
export interface DeviceHints {
  /** `?quality=` from the URL, if any. */
  override: string | null;
  /** Touch-first device (phones, tablets). */
  coarsePointer: boolean;
  /** `navigator.hardwareConcurrency` (0 when unknown). */
  cores: number;
  /** `navigator.deviceMemory` in GB, when the browser reports it. */
  memoryGb?: number;
}

const LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];

function isLevel(value: string | null): value is QualityLevel {
  return value !== null && (LEVELS as readonly string[]).includes(value);
}

export function resolveQuality(setting: Settings['quality'], hints: DeviceHints): QualityLevel {
  if (isLevel(hints.override)) return hints.override;
  if (setting !== 'auto') return setting;
  // Phones and small machines get the light tier (≥ 30 fps target, docs/06 §17).
  if (hints.coarsePointer) return 'low';
  if (hints.memoryGb !== undefined && hints.memoryGb <= 4) return 'low';
  if (hints.cores > 0 && hints.cores <= 4) return 'low';
  if (hints.cores >= 12 && (hints.memoryGb === undefined || hints.memoryGb >= 8)) return 'high';
  return 'medium';
}

/** Reads the hints from the browser. */
export function browserHints(): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    override: new URLSearchParams(window.location.search).get('quality'),
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    cores: nav.hardwareConcurrency ?? 0,
    memoryGb: nav.deviceMemory,
  };
}
