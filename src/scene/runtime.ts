import { createContext, useContext } from 'react';
import { Vector3 } from 'three';
import type { Expression } from './agents/faces';
import type { WallSide } from './layout';
import { createOverlayRegistry, type OverlayRegistry } from './overlay/overlayRegistry';
import { type QualityPreset, qualityPresets } from './quality';

/**
 * Mutable per-diorama runtime shared by scene components through context. Per-frame data lives
 * here (read and written in `useFrame`), never in React state (CLAUDE.md rule 7): React only
 * sees props that change on user input (time of day, quality, camera step).
 */
export interface DioramaRuntime {
  /** 0 = day … 1 = evening, eased towards `eveningTarget` by the lighting driver. */
  evening: number;
  eveningTarget: number;
  /** Seconds since the evening blend last crossed 0.5 (drives the neon flicker-on). */
  eveningSwitchedAt: number;
  /** Scene clock in seconds (clamped deltas, so it never jumps after a tab switch). */
  time: number;
  camera: {
    /** Current (animated) azimuth in radians. */
    azimuth: number;
    /** Unit vector from the look-at target towards the camera. */
    direction: Vector3;
  };
  customer: {
    position: Vector3;
    /** Current script step name (for the owner's reactions and debugging). */
    phase: string;
    visible: boolean;
  };
  owner: { position: Vector3 };
  /**
   * Door swing 0 (closed) … 1 (open). `kick` is an impulse the door spends on its bell (a slam);
   * `sensor`, when set, says whether anyone is in the doorway (the live scene's agents),
   * replacing the demo customer's proximity check.
   */
  door: { open: number; kick: number; sensor: (() => boolean) | null };
  /** Shop clock in minutes of the day for the wall clock, or null for the demo's running time. */
  clockMinutes: number | null;
  /**
   * Cut-away state per wall: `hide` eases 0 (standing) → 1 (cut down to a stub) when the wall
   * faces the camera; `height` is the resulting height factor, read by corner posts.
   */
  walls: Record<WallSide, WallState>;
  /**
   * Increments each time the register rings up a sale (register drawer + coin burst). `waiting`
   * is true while a customer stands at the pay spot (the register screen blinks).
   */
  register: { sales: number; lastSaleAt: number; waiting: boolean };
  /** Expression forced on the customer from outside (playground), or null for scripted. */
  customerExpressionOverride: Expression | null;
  overlay: OverlayRegistry;
}

export interface WallState {
  hide: number;
  height: number;
}

export function createDioramaRuntime(): DioramaRuntime {
  return {
    evening: 0,
    eveningTarget: 0,
    eveningSwitchedAt: -100,
    time: 0,
    camera: { azimuth: Math.PI / 4, direction: new Vector3(1, 1, 1).normalize() },
    customer: { position: new Vector3(), phase: 'spawn', visible: false },
    owner: { position: new Vector3() },
    door: { open: 0, kick: 0, sensor: null },
    clockMinutes: null,
    walls: {
      north: { hide: 0, height: 1 },
      east: { hide: 1, height: 0 },
      south: { hide: 1, height: 0 },
      west: { hide: 0, height: 1 },
    },
    register: { sales: 0, lastSaleAt: -100, waiting: false },
    customerExpressionOverride: null,
    overlay: createOverlayRegistry(),
  };
}

export const DioramaRuntimeContext = createContext<DioramaRuntime | null>(null);

export function useDioramaRuntime(): DioramaRuntime {
  const runtime = useContext(DioramaRuntimeContext);
  if (!runtime) throw new Error('useDioramaRuntime must be used inside <ShopDiorama>');
  return runtime;
}

/** Render quality preset, as React context so a tier change re-renders what depends on it. */
export const QualityContext = createContext<QualityPreset>(qualityPresets.medium);

export function useQuality(): QualityPreset {
  return useContext(QualityContext);
}
