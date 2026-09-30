import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { Color, type DirectionalLight, type HemisphereLight, Object3D, Vector3 } from 'three';
import { damp, lerp } from '../lib/easing';
import { useDioramaRuntime } from '../runtime';
import { lightingPresets, SHADOW_FRUSTUM, SUN_DIRECTION, TIME_OF_DAY_BLEND } from './presets';

const day = lightingPresets.day;
const eve = lightingPresets.evening;

/** Pre-parsed preset colours (linear), so the per-frame blend allocates nothing. */
const C = {
  hemiSkyDay: new Color(day.hemisphere.sky),
  hemiSkyEve: new Color(eve.hemisphere.sky),
  hemiGroundDay: new Color(day.hemisphere.ground),
  hemiGroundEve: new Color(eve.hemisphere.ground),
  sunDay: new Color(day.sun.color),
  sunEve: new Color(eve.sun.color),
};

interface LightingProps {
  shadows: boolean;
  shadowMapSize: number;
  shadowRadius: number;
}

/**
 * Time-of-day driven key and fill lights. Also owns the day ↔ evening blend (`runtime.evening`)
 * that every lamp, sign and window reads, so everything fades in lockstep.
 */
export function Lighting({ shadows, shadowMapSize, shadowRadius }: LightingProps) {
  const runtime = useDioramaRuntime();
  const sunRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const [target] = useState(() => {
    const o = new Object3D();
    o.position.set(...SHADOW_FRUSTUM.center);
    return o;
  });
  const [sunPosition] = useState(() => {
    const dir = new Vector3(...SUN_DIRECTION).normalize();
    return new Vector3(...SHADOW_FRUSTUM.center).addScaledVector(dir, SHADOW_FRUSTUM.distance);
  });

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const before = runtime.evening;
    runtime.evening = damp(runtime.evening, runtime.eveningTarget, 1 / TIME_OF_DAY_BLEND, dt);
    if (Math.abs(runtime.evening - runtime.eveningTarget) < 0.001)
      runtime.evening = runtime.eveningTarget;
    if (before < 0.5 && runtime.evening >= 0.5) runtime.eveningSwitchedAt = runtime.time;
    const t = runtime.evening;

    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.lerpColors(C.hemiSkyDay, C.hemiSkyEve, t);
      hemi.groundColor.lerpColors(C.hemiGroundDay, C.hemiGroundEve, t);
      hemi.intensity = lerp(day.hemisphere.intensity, eve.hemisphere.intensity, t);
    }
    const sun = sunRef.current;
    if (sun) {
      sun.color.lerpColors(C.sunDay, C.sunEve, t);
      sun.intensity = lerp(day.sun.intensity, eve.sun.intensity, t);
      sun.shadow.intensity = lerp(day.sun.shadowIntensity, eve.sun.shadowIntensity, t);
    }
    state.scene.environmentIntensity = lerp(day.environment, eve.environment, t);
  }, -8);

  const s = SHADOW_FRUSTUM.halfSize;
  return (
    <>
      <primitive object={target} />
      <hemisphereLight
        ref={hemiRef}
        args={[day.hemisphere.sky, day.hemisphere.ground, day.hemisphere.intensity]}
      />
      <directionalLight
        ref={sunRef}
        position={sunPosition}
        target={target}
        intensity={day.sun.intensity}
        color={day.sun.color}
        castShadow={shadows}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-radius={shadowRadius}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-camera-left={-s}
        shadow-camera-right={s}
        shadow-camera-top={s}
        shadow-camera-bottom={-s}
        shadow-camera-near={1}
        shadow-camera-far={SHADOW_FRUSTUM.distance * 2 + 4}
      />
    </>
  );
}
