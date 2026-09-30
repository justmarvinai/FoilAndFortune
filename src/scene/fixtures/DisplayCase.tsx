import { useFrame } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import { type Material, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { BlobShadow } from '../lib/blobShadow';
import { lerp } from '../lib/easing';
import { plane, roundedBox } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { cardFaceTexture } from '../products/cardArt';
import { useDioramaRuntime, useQuality } from '../runtime';
import { tones } from '../scenePalette';

/**
 * Small glass display case for singles and graded slabs (docs/01 §7.3, docs/04 §5.4). Physical
 * glass (transmission) on High, cheap fake glass otherwise (docs/04 §4.3). A warm LED strip
 * lights the velvet at night.
 *
 * Local frame: origin on the floor at the centre; long axis x; customers look in from +z.
 */
export interface DisplayCaseProps {
  length?: number;
  depth?: number;
  height?: number;
  baseColor?: string;
}

const CARD_W = 0.13;
const CARD_H = 0.182;

export function useGlassMaterial(): Material {
  const quality = useQuality();
  return useMemo(() => {
    if (quality.physicalGlass) {
      return new MeshPhysicalMaterial({
        color: '#FFFFFF',
        transmission: 1,
        thickness: 0.01,
        roughness: 0.04,
        ior: 1.45,
        envMapIntensity: 1.4,
        specularIntensity: 1,
      });
    }
    return new MeshStandardMaterial({
      color: '#E6F6FF',
      transparent: true,
      opacity: 0.16,
      roughness: 0.04,
      metalness: 0.1,
      envMapIntensity: 1.8,
      depthWrite: false,
    });
  }, [quality.physicalGlass]);
}

export function DisplayCase({
  length = 1.2,
  depth = 0.6,
  height = 0.95,
  baseColor = tones.woodDark,
}: DisplayCaseProps) {
  const runtime = useDioramaRuntime();
  const baseH = 0.42;
  const glassH = height - baseH - 0.02;
  const frame = cachedMerge(`display-case:${length}:${depth}:${height}:${baseColor}`, () => {
    const parts: Part[] = [
      {
        geometry: roundedBox(length - 0.06, 0.08, depth - 0.08, 0.02, 2),
        color: tones.walnut,
        position: [0, 0.04, 0],
      },
      {
        geometry: roundedBox(length, baseH - 0.06, depth, 0.03, 3),
        color: baseColor,
        position: [0, 0.08 + (baseH - 0.08) / 2, 0],
      },
      {
        geometry: roundedBox(length + 0.03, 0.03, depth + 0.03, 0.012, 2),
        color: tones.brass,
        position: [0, baseH, 0],
      },
      // Velvet bed and a back riser for the slabs.
      {
        geometry: roundedBox(length - 0.06, 0.03, depth - 0.06, 0.01, 1),
        color: tones.velvet,
        position: [0, baseH + 0.02, 0],
      },
      {
        geometry: roundedBox(length - 0.12, 0.1, 0.2, 0.02, 2),
        color: tones.velvet,
        position: [0, baseH + 0.08, -depth / 2 + 0.15],
      },
      // Frame posts and top rim.
      {
        geometry: roundedBox(length + 0.02, 0.035, 0.035, 0.012, 1),
        color: tones.brass,
        position: [0, height, depth / 2],
      },
      {
        geometry: roundedBox(length + 0.02, 0.035, 0.035, 0.012, 1),
        color: tones.brass,
        position: [0, height, -depth / 2],
      },
      {
        geometry: roundedBox(0.035, 0.035, depth, 0.012, 1),
        color: tones.brass,
        position: [length / 2, height, 0],
      },
      {
        geometry: roundedBox(0.035, 0.035, depth, 0.012, 1),
        color: tones.brass,
        position: [-length / 2, height, 0],
      },
      // Owner-side sliding-door handles.
      {
        geometry: roundedBox(0.08, 0.02, 0.02, 0.008, 1),
        color: tones.brass,
        position: [-0.2, baseH + 0.2, -depth / 2 - 0.01],
      },
      {
        geometry: roundedBox(0.08, 0.02, 0.02, 0.008, 1),
        color: tones.brass,
        position: [0.2, baseH + 0.2, -depth / 2 - 0.01],
      },
    ];
    for (const x of [-length / 2, length / 2]) {
      for (const z of [-depth / 2, depth / 2]) {
        parts.push({
          geometry: roundedBox(0.035, glassH, 0.035, 0.012, 1),
          color: tones.brass,
          position: [x, baseH + glassH / 2, z],
        });
      }
    }
    // Card stands on the front tier.
    for (let i = 0; i < 4; i++) {
      parts.push({
        geometry: roundedBox(0.1, 0.05, 0.05, 0.01, 1),
        color: '#E9E3F5',
        position: [(-1.5 + i) * (length / 4.2), baseH + 0.05, 0.04],
        rotation: [0.5, 0, 0],
      });
    }
    return parts;
  });
  const glassGeometry = cachedMerge(`display-glass:${length}:${depth}:${height}`, () => [
    {
      geometry: roundedBox(length, glassH, 0.008, 0.003, 1),
      color: '#FFFFFF',
      position: [0, baseH + glassH / 2, depth / 2],
    },
    {
      geometry: roundedBox(length, glassH, 0.008, 0.003, 1),
      color: '#FFFFFF',
      position: [0, baseH + glassH / 2, -depth / 2],
    },
    {
      geometry: roundedBox(0.008, glassH, depth, 0.003, 1),
      color: '#FFFFFF',
      position: [length / 2, baseH + glassH / 2, 0],
    },
    {
      geometry: roundedBox(0.008, glassH, depth, 0.003, 1),
      color: '#FFFFFF',
      position: [-length / 2, baseH + glassH / 2, 0],
    },
    {
      geometry: roundedBox(length, 0.008, depth, 0.003, 1),
      color: '#FFFFFF',
      position: [0, height - 0.005, 0],
    },
  ]);
  const glass = useGlassMaterial();
  const [cards] = useState(() =>
    [0, 1, 3, 4].map(
      (i) => new MeshStandardMaterial({ map: cardFaceTexture(i), roughness: 0.35, metalness: 0.1 }),
    ),
  );
  const [slabCards] = useState(() =>
    [2, 0].map((i) => new MeshStandardMaterial({ map: cardFaceTexture(i), roughness: 0.3 })),
  );
  const [slabShell] = useState(
    () =>
      new MeshStandardMaterial({
        color: '#F4FBFF',
        transparent: true,
        opacity: 0.35,
        roughness: 0.08,
        envMapIntensity: 1.6,
        depthWrite: false,
      }),
  );
  const [led] = useState(
    () =>
      new MeshStandardMaterial({ color: '#FFF4DE', emissive: '#FFE2B0', emissiveIntensity: 0.4 }),
  );
  useFrame(() => {
    led.emissiveIntensity = lerp(0.35, 3.2, runtime.evening);
  });

  return (
    <group>
      <BlobShadow radius={length * 0.62} stretch={[1, 0.55]} opacity={0.35} />
      <mesh
        geometry={frame}
        material={vertexColorMaterial({ roughness: 0.5 })}
        castShadow
        receiveShadow
      />
      {cards.map((material, i) => (
        <mesh
          key={material.uuid}
          geometry={plane(CARD_W, CARD_H)}
          material={material}
          position={[(-1.5 + i) * (length / 4.2), baseH + 0.1, 0.06]}
          rotation={[-0.95, 0, (i - 1.5) * 0.04]}
        />
      ))}
      {slabCards.map((material, i) => {
        const x = (i === 0 ? -1 : 1) * length * 0.22;
        const y = baseH + 0.13 + 0.14;
        return (
          <group key={material.uuid} position={[x, y, -depth / 2 + 0.15]} rotation={[-0.12, 0, 0]}>
            <mesh
              geometry={roundedBox(0.18, 0.28, 0.03, 0.012, 2)}
              material={slabShell}
              renderOrder={2}
            />
            <mesh geometry={plane(0.14, 0.196)} material={material} position={[0, -0.025, 0.004]} />
            <mesh geometry={roundedBox(0.15, 0.045, 0.012, 0.005, 1)} position={[0, 0.105, 0]}>
              <meshStandardMaterial
                attach="material"
                color={i === 0 ? '#FFFFFF' : '#2B6FD6'}
                roughness={0.5}
              />
            </mesh>
            <mesh geometry={roundedBox(0.05, 0.03, 0.014, 0.004, 1)} position={[0.04, 0.105, 0]}>
              <meshStandardMaterial
                attach="material"
                color={i === 0 ? '#E3413A' : '#FFFFFF'}
                roughness={0.5}
              />
            </mesh>
          </group>
        );
      })}
      <mesh
        geometry={roundedBox(length - 0.1, 0.012, 0.02, 0.005, 1)}
        material={led}
        position={[0, height - 0.03, depth / 2 - 0.04]}
      />
      <mesh geometry={glassGeometry} material={glass} renderOrder={4} />
    </group>
  );
}
