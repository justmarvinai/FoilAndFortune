import { useState } from 'react';
import { BufferAttribute, type BufferGeometry, MeshStandardMaterial, PlaneGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useSceneLabels } from '../labels';
import { PLINTH, ROOM, SPOTS } from '../layout';
import { roundedBox } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge } from '../lib/merge';
import { cobbleTexture, paverTexture } from '../lib/surfaceTextures';
import { useQuality } from '../runtime';
import { tones } from '../scenePalette';
import {
  Bench,
  brassPlaqueTexture,
  ChalkboardSign,
  Hydrant,
  LampPost,
  StreetTree,
  useBrassMaterial,
} from './StreetProps';

const { minX, maxX, minZ, maxZ, baseBottom, baseTop, sidewalkTop, roadTop, westCurb, southCurb } =
  PLINTH;

/** Horizontal rectangles merged into one plane, UVs in world metres / `tile` (seamless). */
function worldPlanes(
  rects: readonly (readonly [number, number, number, number])[],
  y: number,
  tile: number,
): BufferGeometry {
  const pieces = rects.map(([x0, x1, z0, z1]) => {
    const g = new PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const pos = g.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / tile;
      uv[i * 2 + 1] = -pos.getZ(i) / tile;
    }
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    return g;
  });
  const merged = mergeGeometries(pieces, false);
  for (const p of pieces) p.dispose();
  if (!merged) throw new Error('worldPlanes: merge failed');
  return merged;
}

/**
 * The museum-style base the shop sits on (docs/04 §4.1): a walnut plinth with a brass name
 * plate, pavements on the two street sides, a strip of cobbled road, and street furniture.
 */
export function StreetPlinth() {
  const labels = useSceneLabels();
  const quality = useQuality();
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const base = cachedMerge('plinth-base', () => [
    {
      geometry: roundedBox(width, baseTop - baseBottom - 0.04, depth, 0.1, 3),
      color: tones.walnut,
      position: [cx, (baseTop + baseBottom) / 2 - 0.02, cz],
    },
    // A lighter moulding band just under the street surface, like a display base.
    {
      geometry: roundedBox(width + 0.04, 0.07, depth + 0.04, 0.035, 2),
      color: tones.walnutLight,
      position: [cx, baseTop - 0.05, cz],
    },
    {
      geometry: roundedBox(width - 0.1, 0.05, depth - 0.1, 0.02, 1),
      color: '#3A2416',
      position: [cx, baseBottom + 0.01, cz],
    },
  ]);

  // Pavement slab (whole plinth minus road strips) and curb edge stones.
  const slab = cachedMerge('plinth-slab', () => [
    {
      geometry: roundedBox(maxX - westCurb, sidewalkTop - baseTop, southCurb - minZ, 0.02, 1),
      color: '#C8BDAA',
      position: [(maxX + westCurb) / 2, (sidewalkTop + baseTop) / 2, (southCurb + minZ) / 2],
    },
    {
      geometry: roundedBox(0.14, 0.03, southCurb - minZ, 0.012, 1),
      color: tones.curb,
      position: [westCurb + 0.07, sidewalkTop - 0.012, (southCurb + minZ) / 2],
    },
    {
      geometry: roundedBox(maxX - westCurb, 0.03, 0.14, 0.012, 1),
      color: tones.curb,
      position: [(maxX + westCurb) / 2, sidewalkTop - 0.012, southCurb - 0.07],
    },
    {
      geometry: roundedBox(westCurb - minX, roadTop - baseTop, depth, 0.02, 1),
      color: '#5B5D6C',
      position: [(westCurb + minX) / 2, (roadTop + baseTop) / 2, cz],
    },
    {
      geometry: roundedBox(maxX - westCurb, roadTop - baseTop, maxZ - southCurb, 0.02, 1),
      color: '#5B5D6C',
      position: [(maxX + westCurb) / 2, (roadTop + baseTop) / 2, (maxZ + southCurb) / 2],
    },
  ]);

  const [surfaces] = useState(() => {
    const T = ROOM.wallThickness;
    // Pavement top, skipping the shop footprint (the shop floor covers it anyway).
    const paving = worldPlanes(
      [
        [westCurb + 0.14, maxX, minZ, -ROOM.halfZ - T],
        [westCurb + 0.14, -ROOM.halfX - T, -ROOM.halfZ - T, southCurb - 0.14],
        [ROOM.halfX + T, maxX, -ROOM.halfZ - T, southCurb - 0.14],
        [-ROOM.halfX - T, ROOM.halfX + T, ROOM.halfZ + T, southCurb - 0.14],
      ],
      sidewalkTop + 0.001,
      2,
    );
    const road = worldPlanes(
      [
        [minX, westCurb, minZ, maxZ],
        [westCurb, maxX, southCurb, maxZ],
      ],
      roadTop + 0.001,
      1.5,
    );
    return { paving, road };
  });

  const [materials] = useState(() => ({
    paving: new MeshStandardMaterial({ map: paverTexture(), roughness: 0.92 }),
    road: new MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.8 }),
  }));
  const plaque = useBrassMaterial(brassPlaqueTexture(labels));

  return (
    <group>
      <mesh geometry={base} material={vertexColorMaterial({ roughness: 0.55 })} receiveShadow />
      <mesh geometry={slab} material={vertexColorMaterial({ roughness: 0.9 })} receiveShadow />
      <mesh geometry={surfaces.paving} material={materials.paving} receiveShadow />
      <mesh geometry={surfaces.road} material={materials.road} receiveShadow />
      <mesh
        geometry={roundedBox(1.9, 0.3, 0.03, 0.012, 2)}
        material={plaque}
        position={[cx - 0.6, (baseTop + baseBottom) / 2 - 0.03, maxZ + 0.035]}
      />
      <LampPost
        position={[SPOTS.lampPost.position[0], sidewalkTop, SPOTS.lampPost.position[2]]}
        withLight={quality.accentLights}
      />
      <Bench position={[SPOTS.bench.position[0], sidewalkTop, SPOTS.bench.position[2]]} />
      <Hydrant position={[SPOTS.hydrant.position[0], sidewalkTop, SPOTS.hydrant.position[2]]} />
      <group
        scale={0.82}
        position={[SPOTS.streetTree.position[0], sidewalkTop, SPOTS.streetTree.position[2]]}
      >
        <StreetTree position={[0, 0, 0]} />
      </group>
      <ChalkboardSign
        position={[SPOTS.chalkboard.position[0], sidewalkTop, SPOTS.chalkboard.position[2]]}
        rotationY={0.15}
      />
    </group>
  );
}
