import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { type Group, MeshStandardMaterial } from 'three';
import { BlobShadow } from '../lib/blobShadow';
import { cachedTexture, liveCanvasTexture } from '../lib/canvas';
import { circle, cylinder, lathe, roundedBox, sphere, torus } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { createRng, randRange } from '../lib/rng';
import { tones } from '../scenePalette';

/**
 * Floor decor (docs/01 §7.3 "Decor: plants, posters, rugs…"): only raises Appeal and
 * personality, so it's all cheap merged meshes.
 */

function rugTexture() {
  return cachedTexture('rug', () =>
    liveCanvasTexture(512, 512, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const ring = (r: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      };
      ring(256, '#1C9C8F');
      ring(236, '#FFF1DC');
      // Zig-zag band.
      ctx.fillStyle = '#FF7A62';
      ctx.beginPath();
      const teeth = 36;
      for (let i = 0; i <= teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? 226 : 196;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ring(186, '#FFF1DC');
      ring(170, '#FFC93C');
      ring(150, '#FFF6E5');
      // The Glimmerkin spark in the middle, flanked by little diamonds.
      ctx.fillStyle = '#1FB5A6';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? 110 : 34;
        const a = -Math.PI / 2 + (i * Math.PI) / 8;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FF6F59';
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * 160, cy + Math.sin(a) * 160);
        ctx.rotate(a);
        ctx.fillStyle = i % 2 === 0 ? '#1FB5A6' : '#FF6F59';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.restore();
      }
      // Woven texture.
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#6E4323';
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
      ctx.globalAlpha = 1;
    }),
  );
}

export function Rug({ radius = 1.15 }: { radius?: number }) {
  const [material] = useState(
    () => new MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 }),
  );
  return (
    <group>
      <mesh geometry={cylinder(radius, radius + 0.01, 0.018, 64)} position-y={0.009} receiveShadow>
        <meshStandardMaterial attach="material" color="#177F75" roughness={0.95} />
      </mesh>
      <mesh
        geometry={circle(radius, 64)}
        material={material}
        rotation-x={-Math.PI / 2}
        position-y={0.0185}
        receiveShadow
      />
    </group>
  );
}

export function DoorMat() {
  const geometry = cachedMerge('door-mat', () => [
    { geometry: roundedBox(0.62, 0.02, 0.92, 0.01, 1), color: '#8C6239', position: [0, 0.01, 0] },
    { geometry: roundedBox(0.52, 0.022, 0.82, 0.01, 1), color: '#C39462', position: [0, 0.011, 0] },
    {
      geometry: roundedBox(0.4, 0.024, 0.06, 0.01, 1),
      color: tones.coral,
      position: [0, 0.012, 0.2],
    },
    {
      geometry: roundedBox(0.4, 0.024, 0.06, 0.01, 1),
      color: tones.coral,
      position: [0, 0.012, -0.2],
    },
  ]);
  return (
    <mesh geometry={geometry} material={vertexColorMaterial({ roughness: 0.95 })} receiveShadow />
  );
}

const POT_PROFILE = [
  [0.001, 0],
  [0.19, 0],
  [0.215, 0.04],
  [0.24, 0.34],
  [0.265, 0.36],
  [0.265, 0.42],
  [0.235, 0.42],
  [0.2, 0.38],
  [0.001, 0.38],
] as const;

/** A leafy fiddle-leaf fig in a terracotta pot. */
export function PottedPlant({ seed = 4, scale = 1 }: { seed?: number; scale?: number }) {
  const geometry = cachedMerge(`plant-fig:${seed}`, () => {
    const rng = createRng(seed);
    const parts: Part[] = [
      { geometry: lathe('pot', POT_PROFILE, 28), color: tones.terracotta },
      {
        geometry: torus(0.25, 0.022, 8, 28),
        color: '#E88A5E',
        position: [0, 0.39, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
      { geometry: cylinder(0.22, 0.22, 0.02, 24), color: '#5B3A26', position: [0, 0.385, 0] },
    ];
    const greens = [tones.leaf, tones.leafDark, '#5CC27F', '#3A9E62'];
    for (let s = 0; s < 3; s++) {
      const a = (s / 3) * Math.PI * 2 + 0.4;
      const lean = 0.12;
      const height = 0.75 + s * 0.12;
      parts.push({
        geometry: cylinder(0.018, 0.024, height, 8),
        color: '#6B4A32',
        position: [Math.cos(a) * 0.05, 0.38 + height / 2, Math.sin(a) * 0.05],
        rotation: [Math.sin(a) * lean, 0, -Math.cos(a) * lean],
      });
      for (let l = 0; l < 6; l++) {
        const t = 0.35 + l * 0.13;
        const la = a + randRange(rng, -1.2, 1.2) + l * 2.1;
        const y = 0.38 + height * t;
        const out = 0.1 + randRange(rng, 0, 0.08);
        parts.push({
          geometry: sphere(0.13, 12, 8),
          color: greens[(l + s) % greens.length] ?? tones.leaf,
          position: [
            Math.cos(a) * 0.05 + Math.cos(la) * out,
            y,
            Math.sin(a) * 0.05 + Math.sin(la) * out,
          ],
          rotation: [randRange(rng, -0.5, 0.5), -la, 0.6 + randRange(rng, -0.2, 0.2)],
          scale: [1.05, 0.22, 0.72],
        });
      }
    }
    return parts;
  });
  return (
    <group scale={scale}>
      <BlobShadow radius={0.34} opacity={0.4} />
      <mesh
        geometry={geometry}
        material={vertexColorMaterial({ roughness: 0.62 })}
        castShadow
        receiveShadow
      />
    </group>
  );
}

/** A tall snake plant with banded blades in a sunny pot. */
export function SnakePlant({ potColor = tones.sun }: { potColor?: string }) {
  const geometry = cachedMerge(`plant-snake:${potColor}`, () => {
    const parts: Part[] = [
      { geometry: cylinder(0.17, 0.14, 0.34, 24), color: potColor, position: [0, 0.17, 0] },
      {
        geometry: torus(0.165, 0.02, 8, 24),
        color: '#F2B21E',
        position: [0, 0.34, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
      { geometry: cylinder(0.15, 0.15, 0.02, 20), color: '#5B3A26', position: [0, 0.335, 0] },
    ];
    const bands = (_x: number, y: number) => (Math.sin(y * 38) > 0.35 ? '#7DCB6E' : '#2F7D4A');
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const h = 0.55 + ((i * 37) % 5) * 0.07;
      parts.push({
        geometry: cylinder(0.004, 0.055, h, 10),
        color: bands,
        position: [Math.cos(a) * 0.06, 0.34 + h / 2, Math.sin(a) * 0.06],
        rotation: [Math.sin(a) * 0.18, a, -Math.cos(a) * 0.18],
        scale: [1, 1, 0.32],
      });
    }
    return parts;
  });
  return (
    <group>
      <BlobShadow radius={0.24} opacity={0.4} />
      <mesh
        geometry={geometry}
        material={vertexColorMaterial({ roughness: 0.6 })}
        castShadow
        receiveShadow
      />
    </group>
  );
}

/** An orange tabby loaf, asleep on the windowsill. Breathes. */
export function ShopCat() {
  const ref = useRef<Group>(null);
  const geometry = cachedMerge('shop-cat', () => {
    const fur = (x: number, y: number) =>
      y > 0.02 && Math.sin(x * 70) > 0.45 ? '#D9803A' : '#F2A65A';
    return [
      { geometry: sphere(0.12, 20, 14), color: fur, scale: [1.45, 0.72, 0.95] },
      {
        geometry: sphere(0.09, 16, 12),
        color: '#F2A65A',
        position: [0.16, 0.035, 0.02],
        scale: [1, 0.92, 1],
      },
      {
        geometry: sphere(0.05, 10, 8),
        color: '#FFF1DC',
        position: [0.22, 0.015, 0.05],
        scale: [1, 0.7, 1],
      },
      {
        geometry: cylinder(0, 0.035, 0.06, 4),
        color: '#D9803A',
        position: [0.15, 0.12, -0.03],
        rotation: [0.2, 0, 0.25],
      },
      {
        geometry: cylinder(0, 0.035, 0.06, 4),
        color: '#D9803A',
        position: [0.19, 0.12, 0.06],
        rotation: [-0.2, 0, -0.1],
      },
      {
        geometry: torus(0.14, 0.028, 8, 20, Math.PI * 1.1),
        color: '#D9803A',
        position: [-0.02, -0.055, 0.02],
        rotation: [Math.PI / 2, 0, 0.6],
      },
      {
        geometry: torus(0.012, 0.004, 4, 8, Math.PI),
        color: tones.ink,
        position: [0.235, 0.05, 0.0],
        rotation: [0, Math.PI / 2, Math.PI],
      },
      {
        geometry: torus(0.012, 0.004, 4, 8, Math.PI),
        color: tones.ink,
        position: [0.235, 0.05, 0.06],
        rotation: [0, Math.PI / 2, Math.PI],
      },
    ] satisfies Part[];
  });
  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    const b = Math.sin(clock.elapsedTime * 2.2) * 0.035;
    group.scale.set(1 - b * 0.3, 1 + b, 1 - b * 0.3);
  });
  return (
    <group ref={ref}>
      <mesh
        geometry={geometry}
        material={vertexColorMaterial({ roughness: 0.8 })}
        castShadow
        position-y={0.085}
      />
    </group>
  );
}
