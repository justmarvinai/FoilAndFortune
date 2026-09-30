import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Color,
  Euler,
  type InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { useSceneLabels } from '../labels';
import { BlobShadow } from '../lib/blobShadow';
import { box, cylinder, plane, roundedBox } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { createRng, randRange } from '../lib/rng';
import { tones } from '../scenePalette';
import { priceTagTexture } from './signs';

/**
 * Bargain bin (docs/01 §7.3: "bulk cards at cents each. Kids love it."): a slatted crate on
 * stubby legs, packed with rows of cards standing on edge (one instanced draw call) and a
 * handwritten price tag on a stick.
 *
 * Local frame: origin on the floor at the centre; long axis x.
 */
export interface BargainBinProps {
  width?: number;
  depth?: number;
  height?: number;
  color?: string;
  seed?: number;
}

const CARD_BACK = '#1B1F4B';
const EDGE_COLORS = ['#FFF6E5', '#FFFFFF', '#FF6B35', '#2EA7E0', '#4CB944', '#FFD23F', '#B15EFF'];

export function BargainBin({
  width = 1.0,
  depth = 0.56,
  height = 0.62,
  color = tones.sun,
  seed = 9,
}: BargainBinProps) {
  const labels = useSceneLabels();
  const crateBottom = 0.16;
  const crate = cachedMerge(`bargain-bin:${width}:${depth}:${height}:${color}`, () => {
    const dark = '#E0A21E';
    const parts: Part[] = [];
    for (const x of [-width / 2 + 0.06, width / 2 - 0.06]) {
      for (const z of [-depth / 2 + 0.06, depth / 2 - 0.06]) {
        parts.push({
          geometry: roundedBox(0.07, crateBottom + 0.05, 0.07, 0.025, 2),
          color: tones.woodDark,
          position: [x, (crateBottom + 0.05) / 2, z],
        });
      }
    }
    parts.push({
      geometry: roundedBox(width - 0.02, 0.04, depth - 0.02, 0.015, 1),
      color: dark,
      position: [0, crateBottom + 0.02, 0],
    });
    // Slatted walls: three chunky boards per side with small gaps.
    const wallH = height - crateBottom;
    const slatH = wallH / 3 - 0.012;
    for (let i = 0; i < 3; i++) {
      const y = crateBottom + 0.04 + slatH / 2 + i * (slatH + 0.012);
      const c = i % 2 === 0 ? color : dark;
      parts.push(
        {
          geometry: roundedBox(width, slatH, 0.04, 0.015, 2),
          color: c,
          position: [0, y, depth / 2 - 0.02],
        },
        {
          geometry: roundedBox(width, slatH, 0.04, 0.015, 2),
          color: c,
          position: [0, y, -depth / 2 + 0.02],
        },
        {
          geometry: roundedBox(0.04, slatH, depth - 0.06, 0.015, 2),
          color: c,
          position: [width / 2 - 0.02, y, 0],
        },
        {
          geometry: roundedBox(0.04, slatH, depth - 0.06, 0.015, 2),
          color: c,
          position: [-width / 2 + 0.02, y, 0],
        },
      );
    }
    // Corner posts and the price-tag stick.
    for (const x of [-width / 2 + 0.02, width / 2 - 0.02]) {
      for (const z of [-depth / 2 + 0.02, depth / 2 - 0.02]) {
        parts.push({
          geometry: roundedBox(0.055, wallH + 0.06, 0.055, 0.02, 2),
          color: tones.woodDark,
          position: [x, crateBottom + wallH / 2 + 0.02, z],
        });
      }
    }
    parts.push({
      geometry: cylinder(0.012, 0.012, 0.42, 8),
      color: tones.woodDark,
      position: [width / 2 - 0.1, height + 0.12, 0.05],
    });
    return parts;
  });

  const cardsRef = useRef<InstancedMesh>(null);
  const cardLayout = useMemo(() => {
    const rng = createRng(seed);
    const items: { p: [number, number, number]; r: [number, number, number]; c: string }[] = [];
    const rows = 3;
    const perRow = Math.floor((width - 0.1) / 0.016);
    for (let row = 0; row < rows; row++) {
      const z = -depth / 2 + 0.09 + row * ((depth - 0.18) / (rows - 1));
      for (let i = 0; i < perRow; i += 1) {
        const x = -width / 2 + 0.06 + i * 0.016;
        const divider = i % 17 === 8;
        const lean = randRange(rng, -0.35, 0.35);
        items.push({
          p: [
            x,
            height - 0.1 + (divider ? 0.05 : randRange(rng, -0.015, 0.02)),
            z + randRange(rng, -0.01, 0.01),
          ],
          r: [0, Math.PI / 2 + randRange(rng, -0.08, 0.08), lean * 0.25],
          c: divider
            ? (EDGE_COLORS[(i + row) % EDGE_COLORS.length] ?? CARD_BACK)
            : rng() > 0.72
              ? (EDGE_COLORS[Math.floor(rng() * 2)] ?? CARD_BACK)
              : CARD_BACK,
        });
      }
    }
    return items;
  }, [width, depth, height, seed]);

  const [cardMaterial] = useState(() => new MeshStandardMaterial({ roughness: 0.55 }));
  useLayoutEffect(() => {
    const mesh = cardsRef.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    const s = new Vector3(1, 1, 1);
    const p = new Vector3();
    const c = new Color();
    cardLayout.forEach((card, i) => {
      p.set(...card.p);
      // ZYX: turn the card edge-on first, then lean it along the row like a real card file.
      q.setFromEuler(e.set(card.r[0], card.r[1], card.r[2], 'ZYX'));
      mesh.setMatrixAt(i, m.compose(p, q, s));
      mesh.setColorAt(i, c.set(card.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [cardLayout]);

  const tag = useMemo(
    () =>
      new MeshStandardMaterial({
        map: priceTagTexture(labels.bargainBin, labels.bargainPrice),
        roughness: 0.7,
      }),
    [labels.bargainBin, labels.bargainPrice],
  );

  return (
    <group>
      <BlobShadow radius={width * 0.62} stretch={[1, 0.6]} opacity={0.38} />
      <mesh
        geometry={crate}
        material={vertexColorMaterial({ roughness: 0.55 })}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={cardsRef}
        args={[box(0.14, 0.2, 0.006), cardMaterial, cardLayout.length]}
        receiveShadow
      />
      <group position={[width / 2 - 0.1, height + 0.36, 0.062]} rotation={[0, 0, 0.08]}>
        <mesh geometry={roundedBox(0.3, 0.225, 0.012, 0.03, 2)} castShadow>
          <meshStandardMaterial attach="material" color={tones.ink} roughness={0.6} />
        </mesh>
        <mesh geometry={plane(0.29, 0.215)} material={tag} position={[0, 0, 0.0065]} />
      </group>
    </group>
  );
}
