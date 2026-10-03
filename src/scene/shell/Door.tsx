import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { type Group, MeshStandardMaterial } from 'three';
import { ROOM, type WallOpening } from '../layout';
import { damp, type SpringState, springStep } from '../lib/easing';
import { cylinder, lathe, plane, roundedBox, sphere, torus } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { useDioramaRuntime } from '../runtime';
import { tones } from '../scenePalette';

/**
 * Shop entrance (wall-local frame, +z into the room): a half-glazed door that swings inwards
 * when a customer comes near, and a little brass bell on a curly bracket that swings and rings
 * (docs/01 §7.1 "the door bell jingles").
 */
interface DoorProps {
  opening: WallOpening;
  /** World XZ of the doorway, for proximity checks. */
  triggerWorld: readonly [number, number];
  triggerRadius: number;
  /** Which jamb carries the hinges, seen from inside. */
  hinge?: 'left' | 'right';
  color?: string;
}

const T = ROOM.wallThickness;
const BELL_PROFILE = [
  [0.001, 0.07],
  [0.012, 0.068],
  [0.022, 0.05],
  [0.03, 0.02],
  [0.045, 0.0],
  [0.04, -0.004],
  [0.001, 0.0],
] as const;

export function Door({
  opening,
  triggerWorld,
  triggerRadius,
  hinge = 'left',
  color = '#E8553F',
}: DoorProps) {
  const runtime = useDioramaRuntime();
  const leafRef = useRef<Group>(null);
  const bellRef = useRef<Group>(null);
  const { center, width, top } = opening;
  const leafW = width - 0.05;
  const leafH = top - 0.04;
  const dir = hinge === 'left' ? 1 : -1;
  const hingeX = center - (dir * width) / 2 + dir * 0.02;

  const casing = cachedMerge(`door-casing:${center}:${width}:${top}`, () => {
    const f = 0.09;
    return [
      {
        geometry: roundedBox(f, top + f, 0.055, 0.02, 2),
        color: tones.trim,
        position: [center - width / 2 - f / 2, (top + f) / 2, 0.022],
      },
      {
        geometry: roundedBox(f, top + f, 0.055, 0.02, 2),
        color: tones.trim,
        position: [center + width / 2 + f / 2, (top + f) / 2, 0.022],
      },
      {
        geometry: roundedBox(width + f * 2 + 0.05, f + 0.02, 0.065, 0.025, 2),
        color: tones.trim,
        position: [center, top + f / 2, 0.027],
      },
      // Threshold.
      {
        geometry: roundedBox(width, 0.02, T + 0.04, 0.008, 1),
        color: tones.brass,
        position: [center, 0.01, -T / 2],
      },
      // Bell bracket: a curl on a short arm.
      {
        geometry: roundedBox(0.03, 0.03, 0.14, 0.01, 1),
        color: tones.iron,
        position: [center + dir * width * 0.28, top + 0.12, 0.09],
      },
      {
        geometry: torus(0.035, 0.009, 6, 16, Math.PI * 1.5),
        color: tones.iron,
        position: [center + dir * width * 0.28, top + 0.14, 0.17],
        rotation: [0, Math.PI / 2, 0],
      },
    ] satisfies Part[];
  });

  const leaf = cachedMerge(`door-leaf:${leafW}:${leafH}:${color}:${dir}`, () => {
    const s = 0.11; // stile width
    const x0 = dir * (leafW / 2); // leaf centre relative to the hinge
    const parts: Part[] = [
      {
        geometry: roundedBox(s, leafH, 0.055, 0.02, 2),
        color,
        position: [x0 - (leafW / 2 - s / 2), leafH / 2, 0],
      },
      {
        geometry: roundedBox(s, leafH, 0.055, 0.02, 2),
        color,
        position: [x0 + (leafW / 2 - s / 2), leafH / 2, 0],
      },
      {
        geometry: roundedBox(leafW - s * 2 + 0.02, 0.13, 0.055, 0.02, 2),
        color,
        position: [x0, leafH - 0.065, 0],
      },
      {
        geometry: roundedBox(leafW - s * 2 + 0.02, 0.1, 0.055, 0.02, 2),
        color,
        position: [x0, leafH * 0.52, 0],
      },
      {
        geometry: roundedBox(leafW - s * 2 + 0.02, leafH * 0.47, 0.05, 0.02, 2),
        color,
        position: [x0, leafH * 0.235 + 0.005, 0],
      },
      // Raised lower panel and a brass kick plate.
      {
        geometry: roundedBox(leafW - s * 2 - 0.06, leafH * 0.3, 0.07, 0.025, 2),
        color: '#F06A55',
        position: [x0, leafH * 0.3, 0],
      },
      {
        geometry: roundedBox(leafW - 0.06, 0.1, 0.064, 0.012, 1),
        color: tones.brass,
        position: [x0, 0.07, 0],
      },
      // Handle: backplate and knob on both faces.
      {
        geometry: roundedBox(0.05, 0.16, 0.07, 0.02, 1),
        color: tones.brass,
        position: [x0 + dir * (leafW / 2 - 0.08), leafH * 0.48, 0],
      },
      {
        geometry: sphere(0.035, 12, 10),
        color: tones.brass,
        position: [x0 + dir * (leafW / 2 - 0.08), leafH * 0.48, 0.06],
      },
      {
        geometry: sphere(0.035, 12, 10),
        color: tones.brass,
        position: [x0 + dir * (leafW / 2 - 0.08), leafH * 0.48, -0.06],
      },
    ];
    return parts;
  });

  const [glass] = useState(
    () =>
      new MeshStandardMaterial({
        color: '#CFEFFF',
        transparent: true,
        opacity: 0.28,
        roughness: 0.05,
        metalness: 0.2,
        envMapIntensity: 2,
        depthWrite: false,
      }),
  );
  const [bellMaterial] = useState(
    () => new MeshStandardMaterial({ color: tones.sun, metalness: 0.85, roughness: 0.25 }),
  );

  const anim = useRef({ bell: { value: 0, velocity: 0 } as SpringState, lastOpen: 0 });
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const door = runtime.door;
    let near: boolean;
    if (door.sensor) near = door.sensor();
    else {
      const c = runtime.customer;
      const dx = c.position.x - triggerWorld[0];
      const dz = c.position.z - triggerWorld[1];
      near = c.visible && dx * dx + dz * dz < triggerRadius * triggerRadius;
    }
    door.open = damp(door.open, near ? 1 : 0, near ? 7 : 3.5, dt);
    if (leafRef.current) leafRef.current.rotation.y = -dir * door.open * 1.35;
    // The bell gets a kick from the door's movement and rings out on a spring.
    const a = anim.current;
    a.bell.velocity += (door.open - a.lastOpen) * 6 + door.kick;
    door.kick = 0;
    a.lastOpen = door.open;
    springStep(a.bell, 0, 90, 2.2, dt);
    if (bellRef.current) bellRef.current.rotation.x = a.bell.value;
  });

  return (
    <group>
      <mesh
        geometry={casing}
        material={vertexColorMaterial({ roughness: 0.45 })}
        castShadow
        receiveShadow
      />
      <group ref={leafRef} position={[hingeX, 0.02, -T / 2 + 0.03]}>
        <mesh geometry={leaf} material={vertexColorMaterial({ roughness: 0.4 })} castShadow />
        <mesh
          geometry={plane(leafW - 0.26, leafH * 0.4)}
          material={glass}
          position={[dir * (leafW / 2), leafH * 0.765, 0]}
          renderOrder={5}
        />
      </group>
      <group ref={bellRef} position={[center + dir * width * 0.28, top + 0.1, 0.19]}>
        <mesh
          geometry={cylinder(0.004, 0.004, 0.06, 4)}
          material={bellMaterial}
          position-y={-0.03}
        />
        <mesh
          geometry={lathe('door-bell', BELL_PROFILE, 16)}
          material={bellMaterial}
          position-y={-0.13}
          castShadow
        />
        <mesh geometry={sphere(0.012, 8, 6)} material={bellMaterial} position-y={-0.14} />
      </group>
    </group>
  );
}
