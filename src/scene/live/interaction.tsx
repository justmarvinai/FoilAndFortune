import type { ThreeEvent } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import { createContext, type RefObject, useContext, useEffect } from 'react';
import { MeshBasicMaterial } from 'three';
import { type HoverTarget, type LiveRuntime, useLiveRuntime } from './liveRuntime';
import type { LiveShopSceneProps } from './types';

/**
 * Picking (docs/06 §7 "R3F pointer events on simplified collider meshes"): invisible boxes over
 * fixtures and capsules on customers report hover (highlight ring + pointer cursor on desktop)
 * and clicks to the play screen's callbacks. Drags (camera panning) never count as clicks.
 */

export type LiveCallbacks = Pick<
  LiveShopSceneProps,
  'onFixtureClick' | 'onRegisterClick' | 'onCustomerClick' | 'onBackgroundClick'
>;

/** The latest callbacks, read at click time (props change identity on every parent render). */
export const LiveCallbacksContext = createContext<RefObject<LiveCallbacks> | null>(null);

/** Pointer travel (px) beyond which a press is a drag, not a click (fingers wobble). */
const CLICK_SLOP = 8;

/** Invisible but raycastable: three skips drawing `visible: false` materials, picking doesn't. */
export const colliderMaterial = new MeshBasicMaterial({ visible: false });

function sameTarget(a: HoverTarget | null, b: HoverTarget): boolean {
  if (!a || a.kind !== b.kind) return false;
  return a.uid === b.uid;
}

/** Activates a target as if clicked (register rings up the customer at the pay spot). */
export function activate(runtime: LiveRuntime, callbacks: LiveCallbacks, target: HoverTarget) {
  switch (target.kind) {
    case 'customer':
      callbacks.onCustomerClick?.(target.uid);
      break;
    case 'register':
      // With someone at the pay spot the register rings them up; otherwise it opens the
      // register's popover (queue and hints) like any fixture.
      if (runtime.paySpotUid !== null && callbacks.onRegisterClick) callbacks.onRegisterClick();
      else callbacks.onFixtureClick?.(target.uid);
      break;
    case 'fixture':
      callbacks.onFixtureClick?.(target.uid);
      break;
  }
}

/** Pointer handlers for one pickable target. */
export function usePickable(target: HoverTarget) {
  const runtime = useLiveRuntime();
  const callbacks = useContext(LiveCallbacksContext);
  const gl = useThree((s) => s.gl);
  return {
    onPointerOver(event: ThreeEvent<PointerEvent>) {
      event.stopPropagation();
      runtime.hover = target;
      if (event.pointerType === 'mouse') gl.domElement.style.cursor = 'pointer';
    },
    onPointerOut() {
      if (sameTarget(runtime.hover, target)) runtime.hover = null;
      gl.domElement.style.cursor = '';
    },
    onClick(event: ThreeEvent<MouseEvent>) {
      event.stopPropagation();
      if (event.delta > CLICK_SLOP || !callbacks?.current) return;
      activate(runtime, callbacks.current, target);
    },
  };
}

/** Clears the cursor and hover if the scene unmounts mid-hover. */
export function useCursorReset() {
  const gl = useThree((s) => s.gl);
  const runtime = useLiveRuntime();
  useEffect(
    () => () => {
      gl.domElement.style.cursor = '';
      runtime.hover = null;
    },
    [gl, runtime],
  );
}
