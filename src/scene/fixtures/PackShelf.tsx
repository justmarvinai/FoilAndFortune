import { useMemo, useState } from 'react';
import { MeshStandardMaterial } from 'three';
import { useSceneLabels } from '../labels';
import { BlobShadow } from '../lib/blobShadow';
import { cylinder, plane, roundedBox, sphere } from '../lib/geometry';
import { toyMaterial, vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { createRng, randRange } from '../lib/rng';
import { BoosterBoxes, BoosterPacks, type ProductItem } from '../products/InstancedProducts';
import { PACK_ARTS } from '../products/packArt';
import { tones } from '../scenePalette';
import { signTexture } from './signs';

/**
 * Wall shelf of sealed product (docs/01 §7.3 "Shelves"): chunky wooden frame, indigo back panel
 * that makes the foil pop, price-tag lips, and five levels of product: booster boxes and tins,
 * rows of packs, open counter-display boxes, more packs, and collector boxes on top.
 *
 * Local frame: origin on the floor at the shelf's centre, back against the wall (-z), front +z.
 * Parameterised by size and level count so Build Mode can offer small and tall variants.
 */
export interface PackShelfProps {
  width?: number;
  height?: number;
  depth?: number;
  levels?: number;
  /** Seed for the product arrangement (so two shelves never look copy-pasted). */
  seed?: number;
  frameColor?: string;
  backColor?: string;
}

const BOARD = 0.045;

function levelTops(height: number, levels: number): number[] {
  const bottom = 0.14;
  const top = height - 0.12;
  const step = (top - bottom) / levels;
  return Array.from({ length: levels }, (_, i) => bottom + i * step);
}

function packRow(
  items: ProductItem[],
  rng: () => number,
  y: number,
  z: number,
  x0: number,
  x1: number,
  variants: readonly number[],
  lean: number,
): void {
  const spacing = 0.118;
  const count = Math.floor((x1 - x0) / spacing);
  const pad = (x1 - x0 - (count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const group = Math.floor((i / count) * variants.length);
    items.push({
      position: [
        x0 + pad + i * spacing + randRange(rng, -0.01, 0.01),
        y + 0.11,
        z + randRange(rng, -0.012, 0.012),
      ],
      rotation: [
        -lean + randRange(rng, -0.05, 0.05),
        randRange(rng, -0.06, 0.06),
        randRange(rng, -0.05, 0.05),
      ],
      variant: variants[group] ?? 0,
    });
  }
}

export function PackShelf({
  width = 2.3,
  height = 2.0,
  depth = 0.42,
  levels = 5,
  seed = 3,
  frameColor = tones.wood,
  backColor = tones.indigoPanel,
}: PackShelfProps) {
  const labels = useSceneLabels();
  const tops = useMemo(() => levelTops(height, levels), [height, levels]);
  const inner = width - 0.14;

  const frame = cachedMerge(
    `pack-shelf:${width}:${height}:${depth}:${levels}:${frameColor}:${backColor}`,
    () => {
      const dark = tones.woodDark;
      const parts: Part[] = [
        {
          geometry: roundedBox(0.07, height, depth, 0.028, 3),
          color: frameColor,
          position: [-width / 2 + 0.035, height / 2, 0],
        },
        {
          geometry: roundedBox(0.07, height, depth, 0.028, 3),
          color: frameColor,
          position: [width / 2 - 0.035, height / 2, 0],
        },
        {
          geometry: roundedBox(width - 0.1, height - 0.1, 0.03, 0.01, 1),
          color: backColor,
          position: [0, height / 2, -depth / 2 + 0.02],
        },
        {
          geometry: roundedBox(width - 0.08, 0.13, depth - 0.07, 0.02, 2),
          color: dark,
          position: [0, 0.065, 0.015],
        },
        {
          geometry: roundedBox(width + 0.08, 0.09, depth + 0.05, 0.035, 3),
          color: frameColor,
          position: [0, height - 0.02, 0.012],
        },
      ];
      for (const y of tops) {
        parts.push(
          {
            geometry: roundedBox(inner + 0.02, BOARD, depth - 0.05, 0.018, 2),
            color: frameColor,
            position: [0, y - BOARD / 2, 0.005],
          },
          // Price-tag lip along the front edge.
          {
            geometry: roundedBox(inner, 0.05, 0.022, 0.01, 1),
            color: tones.trim,
            position: [0, y - 0.012, depth / 2 - 0.02],
          },
        );
        for (let t = 0; t < 4; t++) {
          parts.push({
            geometry: roundedBox(0.075, 0.032, 0.008, 0.004, 1),
            color: t % 2 === 0 ? tones.sun : '#FFFFFF',
            position: [-inner / 2 + (inner * (t + 0.5)) / 4, y - 0.012, depth / 2 - 0.006],
          });
        }
      }
      // Two little gooseneck lamps on the crown, aimed at the product.
      for (const x of [-width * 0.28, width * 0.28]) {
        parts.push(
          {
            geometry: cylinder(0.012, 0.012, 0.16, 8),
            color: tones.iron,
            position: [x, height + 0.06, depth / 2 - 0.02],
          },
          {
            geometry: cylinder(0.012, 0.012, 0.2, 8),
            color: tones.iron,
            position: [x, height + 0.13, depth / 2 + 0.08],
            rotation: [Math.PI / 2, 0, 0],
          },
          {
            geometry: cylinder(0.035, 0.075, 0.09, 16, true),
            color: tones.teal,
            position: [x, height + 0.1, depth / 2 + 0.2],
          },
        );
      }
      // Tins on the bottom level: squat cylinders with contrasting lids.
      const rng = createRng(seed + 5);
      for (let i = 0; i < 4; i++) {
        const art = PACK_ARTS[(i * 3 + 1) % PACK_ARTS.length];
        if (!art) continue;
        const x = width / 2 - 0.2 - i * 0.16;
        const y = tops[0] ?? 0.14;
        parts.push(
          {
            geometry: cylinder(0.068, 0.068, 0.15, 20),
            color: art.bottom,
            position: [x, y + 0.075, 0.02 + randRange(rng, -0.03, 0.03)],
          },
          {
            geometry: cylinder(0.072, 0.072, 0.03, 20),
            color: art.top,
            position: [x, y + 0.16, 0.02],
          },
        );
      }
      // Open counter-display boxes (the packs stand inside them).
      const displayLevel = tops[2] ?? tops[0] ?? 0.9;
      for (let i = 0; i < 3; i++) {
        const art = PACK_ARTS[[0, 3, 5][i] ?? 0];
        if (!art) continue;
        const x = (i - 1) * (inner / 3);
        parts.push({
          geometry: roundedBox(inner / 3 - 0.08, 0.1, 0.24, 0.015, 1),
          color: art.bottom,
          position: [x, displayLevel + 0.05, 0.02],
        });
      }
      return parts;
    },
  );

  const products = useMemo(() => {
    const rng = createRng(seed);
    const packs: ProductItem[] = [];
    const boxes: ProductItem[] = [];
    const [l0 = 0.14, l1 = 0.5, l2 = 0.9, l3 = 1.3, l4 = 1.7] = tops;
    // Level 0: sealed booster boxes lying face-out.
    for (let i = 0; i < 3; i++) {
      boxes.push({
        position: [-inner / 2 + 0.22 + i * 0.4, l0 + 0.105, 0.0],
        rotation: [0, randRange(rng, -0.05, 0.05), 0],
        variant: [0, 1, 0][i] ?? 0,
        scale: [0.36, 0.21, 0.26],
      });
    }
    // Levels 1 and 3: two rows of standing packs grouped by set, leaning on each other.
    packRow(packs, rng, l1, -0.07, -inner / 2 + 0.02, inner / 2 - 0.02, [3, 4, 5, 6], 0.2);
    packRow(packs, rng, l1, 0.07, -inner / 2 + 0.05, inner / 2 - 0.05, [3, 4, 5, 6], 0.12);
    packRow(packs, rng, l3, -0.07, -inner / 2 + 0.02, inner / 2 - 0.02, [0, 1, 2, 7], 0.2);
    packRow(packs, rng, l3, 0.07, -inner / 2 + 0.05, inner / 2 - 0.05, [0, 1, 2, 7], 0.12);
    // Level 2: open display boxes, packs poking out, lid flap with box art behind.
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * (inner / 3);
      const setVariants = [
        [0, 1, 2],
        [3, 4],
        [5, 6],
      ][i] ?? [0];
      boxes.push({
        position: [x, l2 + 0.17, -0.1],
        rotation: [-0.25, 0, 0],
        variant: [0, 1, 2][i] ?? 0,
        scale: [inner / 3 - 0.08, 0.2, 0.015],
      });
      for (let p = 0; p < 6; p++) {
        packs.push({
          position: [
            x - 0.25 + p * 0.1 + randRange(rng, -0.01, 0.01),
            l2 + 0.13,
            0.03 + randRange(rng, -0.02, 0.02),
          ],
          rotation: [
            -0.1 + randRange(rng, -0.08, 0.08),
            randRange(rng, -0.1, 0.1),
            randRange(rng, -0.12, 0.12),
          ],
          variant: setVariants[p % setVariants.length] ?? 0,
        });
      }
    }
    // Level 4: tall collector boxes standing upright.
    for (let i = 0; i < 5; i++) {
      boxes.push({
        position: [-inner / 2 + 0.22 + i * 0.42, l4 + 0.13, -0.02],
        rotation: [0, randRange(rng, -0.08, 0.08), 0],
        variant: i % 4,
        scale: [0.24, 0.26, 0.13],
      });
    }
    return { packs, boxes };
  }, [seed, tops, inner]);

  const header = useMemo(
    () =>
      new MeshStandardMaterial({
        map: signTexture(labels.shelfHeader, tones.sun, tones.coral),
        roughness: 0.5,
      }),
    [labels.shelfHeader],
  );
  const [bulb] = useState(
    () =>
      new MeshStandardMaterial({ color: '#FFF3D6', emissive: '#FFD9A0', emissiveIntensity: 1.2 }),
  );

  return (
    <group>
      <BlobShadow radius={width * 0.55} stretch={[1, 0.3]} opacity={0.35} position={[0, 0, 0.05]} />
      <mesh
        geometry={frame}
        material={vertexColorMaterial({ roughness: 0.6 })}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={roundedBox(width * 0.56, 0.28, 0.05, 0.03, 2)}
        material={toyMaterial(tones.woodDark)}
        position={[0, height + 0.14, 0.08]}
        castShadow
      />
      <mesh
        geometry={plane(width * 0.55, 0.27)}
        material={header}
        position={[0, height + 0.14, 0.106]}
      />
      {[-width * 0.28, width * 0.28].map((x) => (
        <mesh
          key={x}
          geometry={sphere(0.03, 10, 8)}
          material={bulb}
          position={[x, height + 0.075, depth / 2 + 0.2]}
        />
      ))}
      <BoosterPacks items={products.packs} />
      <BoosterBoxes items={products.boxes} />
    </group>
  );
}
