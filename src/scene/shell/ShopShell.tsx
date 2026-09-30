import { useFrame } from '@react-three/fiber';
import { type ReactNode, useRef, useState } from 'react';
import { type Group, MeshStandardMaterial } from 'three';
import { ROOM, WALLS, type WallSide } from '../layout';
import { plane, roundedBox } from '../lib/geometry';
import { toyMaterial, vertexColorMaterial } from '../lib/materials';
import { cachedMerge } from '../lib/merge';
import { woodFloorTexture } from '../lib/surfaceTextures';
import { useDioramaRuntime } from '../runtime';
import { tones } from '../scenePalette';
import { Wall } from './Wall';

const { halfX, halfZ, wallThickness: T, wallHeight: H } = ROOM;

/** Corner posts stand as tall as the taller of their two walls, so corners never look broken. */
const CORNERS: readonly { x: number; z: number; walls: [WallSide, WallSide] }[] = [
  { x: -halfX - T / 2, z: -halfZ - T / 2, walls: ['north', 'west'] },
  { x: halfX + T / 2, z: -halfZ - T / 2, walls: ['north', 'east'] },
  { x: -halfX - T / 2, z: halfZ + T / 2, walls: ['south', 'west'] },
  { x: halfX + T / 2, z: halfZ + T / 2, walls: ['south', 'east'] },
];

function CornerPost({ x, z, walls }: (typeof CORNERS)[number]) {
  const runtime = useDioramaRuntime();
  const ref = useRef<Group>(null);
  const geometry = cachedMerge('corner-post', () => [
    { geometry: roundedBox(T, H, T, 0.015, 2), color: tones.plaster, position: [0, H / 2, 0] },
    {
      geometry: roundedBox(T + 0.004, 0.02, T + 0.004, 0.006, 1),
      color: tones.wallCut,
      position: [0, H + 0.005, 0],
    },
  ]);
  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const a = runtime.walls[walls[0]].height;
    const b = runtime.walls[walls[1]].height;
    group.scale.y = Math.max(a, b);
  });
  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh
        geometry={geometry}
        material={vertexColorMaterial({ roughness: 0.8 })}
        castShadow
        receiveShadow
      />
    </group>
  );
}

interface ShopShellProps {
  /** Wall-mounted content per wall, in that wall's local frame (see shell/Wall.tsx). */
  mounts?: Partial<Record<WallSide, ReactNode>>;
}

/** Floor, cut-away walls and corner posts of the Tier-1 room. */
export function ShopShell({ mounts = {} }: ShopShellProps) {
  const [floorMaterial] = useState(() => {
    const map = woodFloorTexture();
    map.repeat.set(halfX, halfZ); // 2 m texture tile over a 6 × 5 m floor
    return new MeshStandardMaterial({ map, roughness: 0.48, envMapIntensity: 0.9 });
  });
  return (
    <group>
      <mesh
        geometry={roundedBox(halfX * 2 + T * 2, 0.14, halfZ * 2 + T * 2, 0.03, 2)}
        material={toyMaterial(tones.walnutLight, { roughness: 0.7 })}
        position={[0, -0.07, 0]}
        receiveShadow
      />
      <mesh
        geometry={plane(halfX * 2, halfZ * 2)}
        material={floorMaterial}
        rotation-x={-Math.PI / 2}
        position-y={0.001}
        receiveShadow
      />
      {WALLS.map((def) => (
        <Wall key={def.side} def={def}>
          {mounts[def.side]}
        </Wall>
      ))}
      {CORNERS.map((corner) => (
        <CornerPost key={`${corner.x}:${corner.z}`} {...corner} />
      ))}
    </group>
  );
}
