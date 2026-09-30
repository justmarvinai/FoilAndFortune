import { useFrame } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import type { WallSide } from '../layout';
import { cachedTexture, liveCanvasTexture } from '../lib/canvas';
import { useDioramaRuntime } from '../runtime';
import { lightingPresets, SUN_DIRECTION } from './presets';

/**
 * Fake volumetric sunbeam through a window (docs/04 §4.3 "warm sun through the window"): a
 * prism from the window opening down to where the real sun lands on the floor, drawn additively
 * with soft edges. One draw call; it sells "lovingly lit" far more than its cost suggests.
 */
function beamTexture() {
  return cachedTexture('sunbeam', () =>
    liveCanvasTexture(64, 64, (ctx, w, h) => {
      const image = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        const v = y / (h - 1); // 0 at the window, 1 at the floor
        const along = Math.min(1, v / 0.08) * (1 - v) ** 0.8;
        for (let x = 0; x < w; x++) {
          const u = x / (w - 1);
          const across = Math.sin(Math.PI * u) ** 1.6;
          const value = Math.round(255 * along * across);
          const i = (y * w + x) * 4;
          image.data[i] = value;
          image.data[i + 1] = value;
          image.data[i + 2] = value;
          image.data[i + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    }),
  );
}

interface SunbeamProps {
  /** Window opening corners in world space: [min corner, max corner] of the glass rectangle. */
  from: readonly [number, number, number];
  to: readonly [number, number, number];
  /** Wall the window belongs to: the beam fades out when that wall is cut away. */
  wall: WallSide;
  strength?: number;
}

function buildBeam(from: SunbeamProps['from'], to: SunbeamProps['to']): BufferGeometry {
  const light = new Vector3(...SUN_DIRECTION).normalize().negate();
  // Window rectangle (lies in a vertical plane): walk its perimeter.
  const [x0, y0, z0] = from;
  const [x1, y1, z1] = to;
  const pane = [
    new Vector3(x0, y0, z0),
    new Vector3(x1, y0, z1),
    new Vector3(x1, y1, z1),
    new Vector3(x0, y1, z0),
  ];
  // Follow the light down to the floor (y = 0) from each corner of the glass.
  const floor = pane.map((p) => p.clone().addScaledVector(light, p.y / -light.y));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = pane[i];
    const b = pane[(i + 1) % 4];
    const c = floor[(i + 1) % 4];
    const d = floor[i];
    if (!a || !b || !c || !d) continue;
    const base = positions.length / 3;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
    uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function Sunbeam({ from, to, wall, strength = 0.5 }: SunbeamProps) {
  const runtime = useDioramaRuntime();
  const [geometry] = useState(() => buildBeam(from, to));
  const [material] = useState(
    () =>
      new MeshBasicMaterial({
        color: '#FFE0A6',
        map: beamTexture(),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const day = lightingPresets.day.sunbeam;
    const eve = lightingPresets.evening.sunbeam;
    const t = runtime.evening;
    const visible = (day + (eve - day) * t) * (1 - runtime.walls[wall].hide);
    material.opacity = strength * visible;
    material.visible = material.opacity > 0.002;
  });
  return <mesh geometry={geometry} material={material} renderOrder={6} frustumCulled={false} />;
}
