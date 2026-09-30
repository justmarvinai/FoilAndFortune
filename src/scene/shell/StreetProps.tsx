import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { type CanvasTexture, MeshStandardMaterial, type PointLight } from 'three';
import { type SceneLabels, useSceneLabels } from '../labels';
import { BlobShadow } from '../lib/blobShadow';
import { cachedTexture, FONTS, fitText, liveCanvasTexture, roundRectPath } from '../lib/canvas';
import { lerp } from '../lib/easing';
import { cylinder, lathe, plane, roundedBox, sphere, torus } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { useDioramaRuntime } from '../runtime';
import { tones } from '../scenePalette';

/**
 * Street furniture for the plinth (docs/04 §4.1: "sidewalk, lamp post, bench"). Old Town flavour:
 * a lantern post, a slatted bench, a chunky hydrant, a lollipop street tree and an A-frame
 * chalkboard. Each is one or two merged meshes.
 */

type Vec3 = readonly [number, number, number];

export function LampPost({ position, withLight = true }: { position: Vec3; withLight?: boolean }) {
  const runtime = useDioramaRuntime();
  const lightRef = useRef<PointLight>(null);
  const frame = cachedMerge('lamp-post', () => {
    const iron = tones.iron;
    const parts: Part[] = [
      { geometry: cylinder(0.13, 0.16, 0.2, 18), color: iron, position: [0, 0.1, 0] },
      {
        geometry: torus(0.12, 0.025, 8, 20),
        color: iron,
        position: [0, 0.22, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
      { geometry: cylinder(0.045, 0.058, 2.2, 14), color: iron, position: [0, 1.3, 0] },
      {
        geometry: torus(0.07, 0.022, 8, 18),
        color: iron,
        position: [0, 1.05, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
      { geometry: cylinder(0.09, 0.06, 0.08, 14), color: iron, position: [0, 2.42, 0] },
      // Lantern cage: base plate, four corner posts, pyramid roof, finial.
      { geometry: roundedBox(0.3, 0.05, 0.3, 0.02), color: iron, position: [0, 2.48, 0] },
      {
        geometry: cylinder(0.02, 0.24, 0.16, 4),
        color: iron,
        position: [0, 2.9, 0],
        rotation: [0, Math.PI / 4, 0],
      },
      { geometry: sphere(0.035, 10, 8), color: tones.brass, position: [0, 3.0, 0] },
    ];
    for (const [x, z] of [
      [0.12, 0.12],
      [-0.12, 0.12],
      [0.12, -0.12],
      [-0.12, -0.12],
    ] as const) {
      parts.push({
        geometry: roundedBox(0.03, 0.34, 0.03, 0.01),
        color: iron,
        position: [x, 2.66, z],
      });
    }
    return parts;
  });
  const [glass] = useState(
    () =>
      new MeshStandardMaterial({
        color: '#FFF1CF',
        emissive: '#FFC766',
        emissiveIntensity: 0.1,
        roughness: 0.25,
      }),
  );
  useFrame(() => {
    const t = runtime.evening;
    glass.emissiveIntensity = lerp(0.08, 4.5, t);
    if (lightRef.current) lightRef.current.intensity = lerp(0, 6, t);
  });
  return (
    <group position={position}>
      <BlobShadow radius={0.28} opacity={0.4} />
      <mesh
        geometry={frame}
        material={vertexColorMaterial({ roughness: 0.45, metalness: 0.3 })}
        castShadow
      />
      <mesh geometry={roundedBox(0.22, 0.3, 0.22, 0.03)} material={glass} position={[0, 2.66, 0]} />
      {withLight ? (
        <pointLight
          ref={lightRef}
          position={[0, 2.62, 0.05]}
          color="#FFB45E"
          intensity={0}
          distance={6}
          decay={2}
        />
      ) : null}
    </group>
  );
}

export function Bench({ position, rotationY = 0 }: { position: Vec3; rotationY?: number }) {
  const geometry = cachedMerge('bench', () => {
    const slat = tones.maple;
    const iron = tones.iron;
    const parts: Part[] = [];
    for (let i = 0; i < 3; i++) {
      parts.push({
        geometry: roundedBox(1.3, 0.04, 0.1, 0.018),
        color: slat,
        position: [0, 0.42, -0.12 + i * 0.12],
      });
    }
    for (let i = 0; i < 2; i++) {
      parts.push({
        geometry: roundedBox(1.3, 0.1, 0.035, 0.016),
        color: slat,
        position: [0, 0.62 + i * 0.14, -0.21 - i * 0.03],
        rotation: [-0.2, 0, 0],
      });
    }
    for (const x of [-0.55, 0.55]) {
      parts.push(
        { geometry: roundedBox(0.05, 0.42, 0.05, 0.018), color: iron, position: [x, 0.21, 0.1] },
        {
          geometry: roundedBox(0.05, 0.85, 0.05, 0.018),
          color: iron,
          position: [x, 0.42, -0.2],
          rotation: [-0.12, 0, 0],
        },
        { geometry: roundedBox(0.06, 0.05, 0.42, 0.02), color: iron, position: [x, 0.58, -0.02] },
      );
    }
    return parts;
  });
  return (
    <group position={position} rotation-y={rotationY}>
      <BlobShadow radius={0.5} stretch={[1.5, 0.6]} opacity={0.3} />
      <mesh
        geometry={geometry}
        material={vertexColorMaterial({ roughness: 0.6 })}
        castShadow
        receiveShadow
      />
    </group>
  );
}

export function Hydrant({ position }: { position: Vec3 }) {
  const geometry = cachedMerge('hydrant', () => {
    const red = '#E8553F';
    const dark = '#B8392A';
    return [
      { geometry: cylinder(0.15, 0.17, 0.06, 18), color: dark, position: [0, 0.03, 0] },
      { geometry: cylinder(0.11, 0.12, 0.42, 18), color: red, position: [0, 0.27, 0] },
      {
        geometry: torus(0.115, 0.025, 8, 20),
        color: dark,
        position: [0, 0.44, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
      {
        geometry: lathe(
          'hydrant-dome',
          [
            [0.12, 0],
            [0.12, 0.03],
            [0.1, 0.08],
            [0.06, 0.12],
            [0.03, 0.14],
            [0, 0.145],
          ],
          18,
        ),
        color: red,
        position: [0, 0.46, 0],
      },
      { geometry: cylinder(0.03, 0.03, 0.05, 8), color: dark, position: [0, 0.62, 0] },
      {
        geometry: cylinder(0.05, 0.05, 0.1, 12),
        color: red,
        position: [0.13, 0.3, 0],
        rotation: [0, 0, Math.PI / 2],
      },
      {
        geometry: cylinder(0.05, 0.05, 0.1, 12),
        color: red,
        position: [-0.13, 0.3, 0],
        rotation: [0, 0, Math.PI / 2],
      },
      {
        geometry: cylinder(0.065, 0.065, 0.1, 12),
        color: dark,
        position: [0, 0.3, 0.12],
        rotation: [Math.PI / 2, 0, 0],
      },
    ] satisfies Part[];
  });
  return (
    <group position={position}>
      <BlobShadow radius={0.24} opacity={0.35} />
      <mesh geometry={geometry} material={vertexColorMaterial({ roughness: 0.4 })} castShadow />
    </group>
  );
}

export function StreetTree({ position }: { position: Vec3 }) {
  const geometry = cachedMerge('street-tree', () => [
    { geometry: cylinder(0.34, 0.3, 0.34, 24), color: '#C9B8A0', position: [0, 0.17, 0] },
    {
      geometry: torus(0.33, 0.035, 8, 28),
      color: '#DCCDB6',
      position: [0, 0.34, 0],
      rotation: [Math.PI / 2, 0, 0],
    },
    { geometry: cylinder(0.3, 0.3, 0.02, 24), color: '#6B4A32', position: [0, 0.33, 0] },
    { geometry: cylinder(0.045, 0.06, 0.95, 10), color: '#7A5234', position: [0, 0.8, 0] },
    { geometry: sphere(0.42, 20, 16), color: tones.leaf, position: [0, 1.5, 0] },
    { geometry: sphere(0.3, 16, 12), color: '#58C07A', position: [0.22, 1.72, 0.12] },
    { geometry: sphere(0.28, 16, 12), color: tones.leafDark, position: [-0.24, 1.38, -0.1] },
    { geometry: sphere(0.24, 16, 12), color: '#4FB872', position: [0.05, 1.3, 0.28] },
  ]);
  return (
    <group position={position}>
      <BlobShadow radius={0.5} opacity={0.35} />
      <mesh
        geometry={geometry}
        material={vertexColorMaterial({ roughness: 0.75 })}
        castShadow
        receiveShadow
      />
    </group>
  );
}

function chalkboardTexture(labels: SceneLabels): CanvasTexture {
  const key = `chalkboard:${labels.chalkboardTitle}:${labels.chalkboardLines.join('|')}`;
  return cachedTexture(key, () =>
    liveCanvasTexture(256, 340, (ctx, w, h) => {
      ctx.fillStyle = '#2E3B3C';
      ctx.fillRect(0, 0, w, h);
      // Chalk dust smudges.
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.02 + (i % 5) * 0.008})`;
        ctx.beginPath();
        ctx.ellipse((i * 67) % w, (i * 113) % h, 40, 14, (i % 7) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFC93C';
      fitText(ctx, labels.chalkboardTitle, w / 2, 58, w - 40, 64, FONTS.display);
      // A little booster-pack doodle.
      ctx.save();
      ctx.translate(w / 2, 158);
      ctx.rotate(-0.12);
      ctx.strokeStyle = '#FF8B7A';
      ctx.lineWidth = 5;
      roundRectPath(ctx, -34, -48, 68, 96, 10);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) ctx.lineTo(-34 + i * 8.5, -48 - (i % 2) * 7);
      ctx.stroke();
      ctx.fillStyle = '#7FF6FF';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#F4F1E8';
      fitText(ctx, labels.chalkboardLines[0], w / 2, 250, w - 30, 44, FONTS.hand);
      fitText(ctx, labels.chalkboardLines[1], w / 2, 292, w - 30, 36, FONTS.hand);
    }),
  );
}

export function ChalkboardSign({
  position,
  rotationY = 0,
}: {
  position: Vec3;
  rotationY?: number;
}) {
  const labels = useSceneLabels();
  const frame = cachedMerge('chalkboard-frame', () => {
    const wood = tones.wood;
    const parts: Part[] = [];
    for (const side of [1, -1]) {
      // Both panels lean in towards the hinge at the top: an A-frame.
      const tilt = -side * 0.2;
      const z = side * 0.1;
      parts.push(
        {
          geometry: roundedBox(0.54, 0.05, 0.035, 0.015),
          color: wood,
          position: [0, 0.86, z * 0.2],
          rotation: [tilt, 0, 0],
        },
        {
          geometry: roundedBox(0.05, 0.84, 0.035, 0.015),
          color: wood,
          position: [-0.25, 0.43, z],
          rotation: [tilt, 0, 0],
        },
        {
          geometry: roundedBox(0.05, 0.84, 0.035, 0.015),
          color: wood,
          position: [0.25, 0.43, z],
          rotation: [tilt, 0, 0],
        },
        {
          geometry: roundedBox(0.54, 0.05, 0.035, 0.015),
          color: wood,
          position: [0, 0.1, z * 1.75],
          rotation: [tilt, 0, 0],
        },
        {
          geometry: roundedBox(0.46, 0.72, 0.02, 0.01),
          color: '#2E3B3C',
          position: [0, 0.47, z * 0.95],
          rotation: [tilt, 0, 0],
        },
      );
    }
    return parts;
  });
  const board = useMemo(
    () => new MeshStandardMaterial({ map: chalkboardTexture(labels), roughness: 0.9 }),
    [labels],
  );
  return (
    <group position={position} rotation-y={rotationY}>
      <BlobShadow radius={0.3} stretch={[1, 0.8]} opacity={0.3} />
      <mesh geometry={frame} material={vertexColorMaterial({ roughness: 0.7 })} castShadow />
      <mesh
        geometry={plane(0.42, 0.6)}
        material={board}
        position={[0, 0.48, 0.118]}
        rotation={[-0.2, 0, 0]}
      />
    </group>
  );
}

export function useBrassMaterial(map: CanvasTexture): MeshStandardMaterial {
  return useMemo(
    () => new MeshStandardMaterial({ map, metalness: 0.75, roughness: 0.32, color: '#FFFFFF' }),
    [map],
  );
}

export function brassPlaqueTexture(labels: SceneLabels): CanvasTexture {
  return cachedTexture(`plaque:${labels.shopName}:${labels.address}`, () =>
    liveCanvasTexture(640, 128, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#F2C66A');
      g.addColorStop(0.5, '#D9A441');
      g.addColorStop(1, '#B98428');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(90, 58, 18, 0.7)';
      ctx.lineWidth = 4;
      roundRectPath(ctx, 10, 10, w - 20, h - 20, 12);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4A2E0E';
      fitText(ctx, labels.shopName, w / 2, h * 0.42, w - 80, 54, FONTS.display);
      ctx.fillStyle = 'rgba(74, 46, 14, 0.85)';
      fitText(ctx, labels.address, w / 2, h * 0.77, w - 80, 22, FONTS.ui);
      for (const x of [34, w - 34]) {
        ctx.fillStyle = '#8A6420';
        ctx.beginPath();
        ctx.arc(x, h / 2, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }),
  );
}
