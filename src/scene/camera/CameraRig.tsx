import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { clamp, damp } from '../lib/easing';
import { useDioramaRuntime } from '../runtime';
import {
  azimuthForStep,
  type Extents,
  fitZoom,
  type Insets,
  ISO_ELEVATION,
  projectExtents,
  screenAxes,
  viewDirection,
} from './cameraMath';

const CAMERA_DISTANCE = 40;
const tmpFollow = new Vector3();
/** Gesture/button zoom limits relative to the auto-fit framing ("zoom with limits"). */
export const ZOOM_MIN = 0.85;
export const ZOOM_MAX = 3.2;

/** Imperative hooks into the rig for on-screen buttons (zoom steps keep the wheel's level). */
export interface CameraApi {
  /** Multiplies the current zoom, within the rig's limits. */
  zoomBy(factor: number): void;
  /** Current zoom over the fit framing. */
  zoom(): number;
}

interface CameraRigProps {
  /** Rotation step; each step is a 90° turn. Any integer (not wrapped) so turns animate. */
  step: number;
  /** Zoom multiplier over the auto-fit framing, from UI buttons. */
  zoom: number;
  /** Screen areas covered by UI (px), so the diorama frames inside the free space. */
  insets: Insets;
  /** Points that must stay in frame (plinth corners, wall tops, lamp post…) for auto-framing. */
  framing: readonly Vector3[];
  /** Wheel/pinch zoom and drag panning. */
  interactive?: boolean;
  /** Keep an agent centred (debug close-ups; later "follow customer" in the game). */
  follow?: 'customer' | 'owner' | null;
  /** Turns and zooms snap instead of easing (reduced motion, docs/05 §10). */
  reducedMotion?: boolean;
  /** Filled in by the rig with imperative controls (see `CameraApi`). */
  api?: { current: CameraApi | null };
}

/**
 * Orthographic isometric camera rig: animated 90° turns, auto-framing that respects UI insets,
 * wheel/pinch zoom within limits and gentle drag panning. Publishes its view direction to the
 * runtime so cut-away walls can react (they run after this, priority -9 < 0).
 */
export function CameraRig({
  step,
  zoom,
  insets,
  framing,
  interactive = true,
  follow = null,
  reducedMotion = false,
  api,
}: CameraRigProps) {
  const runtime = useDioramaRuntime();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  // Any fixed reference point works: framing re-centres on the projected extents every frame.
  const [focus] = useState(() => new Vector3(0, 0.6, 0));

  const state = useRef({
    azimuth: azimuthForStep(step),
    zoom: zoom,
    pan: { x: 0, y: 0 },
    currentZoom: 0,
    initialized: false,
    dir: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
    lookAt: new Vector3(),
    extents: { minX: 0, maxX: 0, minY: 0, maxY: 0 } as Extents,
    followPoint: new Vector3(),
    followBlend: 0,
    lastStep: step,
  });

  // Buttons set the zoom level; wheel/pinch refine it within limits.
  useEffect(() => {
    state.current.zoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
  }, [zoom]);

  useEffect(() => {
    if (!api) return;
    api.current = {
      zoomBy(factor) {
        const s = state.current;
        s.zoom = clamp(s.zoom * factor, ZOOM_MIN, ZOOM_MAX);
        // Back at the fit framing there is nothing to pan to: re-centre.
        if (s.zoom <= 1.0001) {
          s.pan.x = 0;
          s.pan.y = 0;
        }
      },
      zoom: () => state.current.zoom,
    };
    return () => {
      api.current = null;
    };
  }, [api]);

  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    el.style.touchAction = 'none';
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const s = state.current;
      s.zoom = clamp(s.zoom * Math.exp(-event.deltaY * 0.0013), ZOOM_MIN, ZOOM_MAX);
    };
    const distance = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const onDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      el.setPointerCapture(event.pointerId);
      if (pointers.size === 2) pinchDistance = distance();
    };
    const onMove = (event: PointerEvent) => {
      const prev = pointers.get(event.pointerId);
      if (!prev) return;
      const s = state.current;
      const dx = event.clientX - prev.x;
      const dy = event.clientY - prev.y;
      prev.x = event.clientX;
      prev.y = event.clientY;
      if (pointers.size === 1) {
        const z = Math.max(1, s.currentZoom);
        // Only allow panning once zoomed in: at fit zoom the whole diorama is already framed.
        const room = Math.max(0, s.zoom - 0.95) * 3.2;
        s.pan.x = clamp(s.pan.x - dx / z, -room, room);
        s.pan.y = clamp(s.pan.y + dy / z, -room * 0.7, room * 0.7);
      } else if (pointers.size === 2) {
        const d = distance();
        if (pinchDistance > 0 && d > 0)
          s.zoom = clamp(s.zoom * (d / pinchDistance), ZOOM_MIN, ZOOM_MAX);
        pinchDistance = d;
      }
    };
    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      pinchDistance = pointers.size === 2 ? distance() : 0;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [gl, interactive]);

  useFrame((three, delta) => {
    const s = state.current;
    const dt = Math.min(delta, 0.1);
    // A new camera angle re-centres the framing.
    if (s.lastStep !== step) {
      s.lastStep = step;
      s.pan.x = 0;
      s.pan.y = 0;
    }
    const targetAzimuth = azimuthForStep(step);
    if (!s.initialized || reducedMotion) s.azimuth = targetAzimuth;
    else s.azimuth = damp(s.azimuth, targetAzimuth, 5.5, dt);
    if (Math.abs(s.azimuth - targetAzimuth) < 1e-4) s.azimuth = targetAzimuth;

    viewDirection(s.azimuth, ISO_ELEVATION, s.dir);
    screenAxes(s.dir, s.right, s.up);
    projectExtents(framing, focus, s.right, s.up, s.extents);
    const { width, height } = three.size;
    const fit = fitZoom(s.extents, width, height, insets, 0.04);
    const targetZoom = fit * s.zoom;
    s.currentZoom =
      s.initialized && !reducedMotion ? damp(s.currentZoom, targetZoom, 8, dt) : targetZoom;
    s.initialized = true;

    // Centre the projected bounds in the free viewport, then apply the user's pan.
    const cx = (s.extents.minX + s.extents.maxX) / 2;
    const cy = (s.extents.minY + s.extents.maxY) / 2;
    const shiftX = (insets.left - insets.right) / 2 / s.currentZoom;
    const shiftY = (insets.top - insets.bottom) / 2 / s.currentZoom;
    s.lookAt
      .copy(focus)
      .addScaledVector(s.right, cx - shiftX + s.pan.x)
      .addScaledVector(s.up, cy + shiftY + s.pan.y);
    // Optional follow: blend the look-at towards the agent (still honouring the insets).
    const followed =
      follow === 'customer'
        ? runtime.customer.position
        : follow === 'owner'
          ? runtime.owner.position
          : null;
    s.followBlend = damp(s.followBlend, followed ? 1 : 0, 3, dt);
    if (followed) s.followPoint.lerp(followed, s.initialized ? 1 - Math.exp(-6 * dt) : 1);
    if (s.followBlend > 0.001) {
      const target = tmpFollow
        .copy(s.followPoint)
        .setY(0.75)
        .addScaledVector(s.right, -shiftX)
        .addScaledVector(s.up, shiftY);
      s.lookAt.lerp(target, s.followBlend);
    }

    camera.position.copy(s.lookAt).addScaledVector(s.dir, CAMERA_DISTANCE);
    camera.up.set(0, 1, 0);
    camera.lookAt(s.lookAt);
    if (Math.abs(camera.zoom - s.currentZoom) > 1e-4) {
      camera.zoom = s.currentZoom;
      camera.updateProjectionMatrix();
    }
    runtime.camera.azimuth = s.azimuth;
    runtime.camera.direction.copy(s.dir);
  }, -9);

  return null;
}
