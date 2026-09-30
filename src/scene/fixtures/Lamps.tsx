import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Color,
  type InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  type PointLight,
  QuadraticBezierCurve3,
  Quaternion,
  TubeGeometry,
  Vector3,
} from 'three';
import { lerp } from '../lib/easing';
import { cylinder, lathe, sphere } from '../lib/geometry';
import { toyMaterial } from '../lib/materials';
import { useDioramaRuntime } from '../runtime';
import { tones } from '../scenePalette';

type Vec3 = readonly [number, number, number];

const SHADE = [
  [0.001, 0.2],
  [0.045, 0.2],
  [0.06, 0.175],
  [0.11, 0.1],
  [0.19, 0.02],
  [0.2, 0.0],
  [0.19, -0.005],
] as const;

interface PendantLampProps {
  /** Where the shade hangs (world or parent frame). */
  position: Vec3;
  /** Cord length up to the ceiling canopy. */
  cord?: number;
  shadeColor?: string;
  /** Peak point-light intensity at evening. */
  intensity?: number;
}

/**
 * Pendant lamp: dome shade, glowing bulb and a warm point light that fades up at evening
 * (docs/04 §4.3 "warm interior lamps at evening"). The light always exists (intensity 0 by day)
 * so switching time of day never changes the light count, which would recompile shaders.
 */
export function PendantLamp({
  position,
  cord = 0.55,
  shadeColor = tones.sun,
  intensity = 12,
}: PendantLampProps) {
  const runtime = useDioramaRuntime();
  const lightRef = useRef<PointLight>(null);
  const [bulb] = useState(
    () =>
      new MeshStandardMaterial({ color: '#FFF8E8', emissive: '#FFD9A0', emissiveIntensity: 0.6 }),
  );
  const shade = toyMaterial(shadeColor, { roughness: 0.45, doubleSide: true });
  useFrame(() => {
    const t = runtime.evening;
    bulb.emissiveIntensity = lerp(0.5, 7, t);
    if (lightRef.current) lightRef.current.intensity = lerp(0, intensity, t);
  });
  return (
    <group position={position}>
      <mesh
        geometry={cylinder(0.008, 0.008, cord, 6)}
        material={toyMaterial(tones.ink)}
        position-y={0.2 + cord / 2}
      />
      <mesh
        geometry={cylinder(0.07, 0.07, 0.03, 16)}
        material={toyMaterial(tones.ink)}
        position-y={0.2 + cord}
      />
      <mesh geometry={lathe('pendant-shade', SHADE, 28)} material={shade} castShadow />
      <mesh geometry={sphere(0.055, 14, 10)} material={bulb} position-y={0.02} />
      <pointLight
        ref={lightRef}
        position={[0, -0.06, 0]}
        color="#FFB86B"
        intensity={0}
        distance={8}
        decay={2}
      />
    </group>
  );
}

interface StringLightsProps {
  from: Vec3;
  to: Vec3;
  sag?: number;
  count?: number;
}

const BULB_COLORS = ['#FFE7B0', '#FF8B7A', '#FFD23F', '#7FF6FF', '#FFB0E0'];

/**
 * Fairy-light garland (docs/03 §2: Lantern Lane has string lights). Bulbs are one instanced
 * mesh; emissive is tinted per bulb by patching the shader to multiply by the instance colour.
 */
export function StringLights({ from, to, sag = 0.18, count = 16 }: StringLightsProps) {
  const runtime = useDioramaRuntime();
  const ref = useRef<InstancedMesh>(null);
  const { curve, wire } = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y -= sag * 2;
    const c = new QuadraticBezierCurve3(a, mid, b);
    return { curve: c, wire: new TubeGeometry(c, 48, 0.006, 5, false) };
  }, [from, to, sag]);
  const [material] = useState(() => {
    const m = new MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#FFFFFF',
      emissiveIntensity: 0.3,
      roughness: 0.35,
    });
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        '#ifdef USE_COLOR\n\tvec3 totalEmissiveRadiance = emissive * vColor.rgb;\n#else\n\tvec3 totalEmissiveRadiance = emissive;\n#endif',
      );
    };
    m.customProgramCacheKey = () => 'emissive-by-instance-color';
    return m;
  });
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3(1, 1.25, 1);
    const p = new Vector3();
    const c = new Color();
    for (let i = 0; i < count; i++) {
      curve.getPoint((i + 0.5) / count, p);
      p.y -= 0.035;
      mesh.setMatrixAt(i, m.compose(p, q, s));
      mesh.setColorAt(i, c.set(BULB_COLORS[i % BULB_COLORS.length] ?? '#FFFFFF'));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [curve, count]);
  useFrame(() => {
    material.emissiveIntensity =
      lerp(0.25, 3.2, runtime.evening) * (0.92 + Math.sin(runtime.time * 3) * 0.08);
  });
  return (
    <group>
      <mesh geometry={wire} material={toyMaterial(tones.ink)} />
      <instancedMesh ref={ref} args={[sphere(0.03, 10, 8), material, count]} />
    </group>
  );
}

/**
 * An evening-only fill light (shelf spots, window glow). Lives outside wall `<Mounted>` groups on
 * purpose: hiding a light changes the light count, which would recompile every shader mid-turn.
 */
export function AccentLight({
  position,
  intensity = 4,
  distance = 3,
  color = '#FFC47A',
}: {
  position: Vec3;
  intensity?: number;
  distance?: number;
  color?: string;
}) {
  const runtime = useDioramaRuntime();
  const ref = useRef<PointLight>(null);
  useFrame(() => {
    if (ref.current) ref.current.intensity = lerp(0, intensity, runtime.evening);
  });
  return (
    <pointLight
      ref={ref}
      position={position}
      color={color}
      intensity={0}
      distance={distance}
      decay={2}
    />
  );
}
