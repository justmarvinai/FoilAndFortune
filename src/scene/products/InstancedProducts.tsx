import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  type CanvasTexture,
  Euler,
  InstancedBufferAttribute,
  type InstancedMesh,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector2,
  Vector3,
} from 'three';
import { useSceneLabels } from '../labels';
import { roundedBox } from '../lib/geometry';
import { useQuality } from '../runtime';
import {
  BOX_ATLAS,
  boxAtlasTexture,
  boxCellOffset,
  PACK_ATLAS,
  packAtlasTexture,
  packCellOffset,
} from './packArt';

/**
 * Instanced shelf products (docs/06 §7 "Instancing and atlases"): every booster pack in the shop
 * is one InstancedMesh draw call, with a per-instance UV offset into the generated wrapper
 * atlas; booster boxes likewise.
 */
type Vec3 = readonly [number, number, number];

export interface ProductItem {
  position: Vec3;
  rotation?: Vec3;
  /** Atlas cell (pack wrapper or box set). */
  variant: number;
  scale?: Vec3 | number;
}

/**
 * A booster pack: a pillow-shaped foil pouch with flat crimped seals at both ends
 * (docs/04 §4.2 "packs (thin crimped boxes with pack-art textures)").
 */
function createPackGeometry(
  width = 0.13,
  height = 0.22,
  bulge = 0.013,
  crimp = 0.075,
): BufferGeometry {
  // Coarse on purpose: ~100 packs share this mesh, and at diorama scale the pillow reads fine.
  const nx = 5;
  const ny = 10;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const bulgeAt = (u: number, v: number) => {
    if (v < crimp || v > 1 - crimp) return 0.0015;
    const vv = (v - crimp) / (1 - 2 * crimp);
    return 0.0015 + bulge * Math.sin(Math.PI * u) ** 0.6 * Math.sin(Math.PI * vv) ** 0.4;
  };
  for (const side of [1, -1]) {
    const base = positions.length / 3;
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const u = i / nx;
        const v = j / ny;
        positions.push((u - 0.5) * width, (v - 0.5) * height, side * bulgeAt(u, v));
        uvs.push(side === 1 ? u : 1 - u, v);
      }
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = base + j * (nx + 1) + i;
        const b = a + 1;
        const d = a + nx + 1;
        const c = d + 1;
        if (side === 1) indices.push(a, b, d, b, c, d);
        else indices.push(a, d, b, b, d, c);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

let packGeometry: BufferGeometry | null = null;
/** The shared pillow-pack geometry (clone it to add per-instance attributes). */
export function basePackGeometry(): BufferGeometry {
  packGeometry ??= createPackGeometry();
  return packGeometry;
}

/**
 * Patches a lit material to read its map from an atlas cell given per instance (`aAtlas`).
 * Works for Standard and Physical materials (both use the `uv_vertex` chunk).
 */
function patchAtlas<M extends MeshStandardMaterial>(material: M, cols: number, rows: number): M {
  const scale = new Vector2(1 / cols, 1 / rows);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uAtlasScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec2 aAtlas;\nuniform vec2 uAtlasScale;',
      )
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv = uv * uAtlasScale + aAtlas;\n#endif',
      );
  };
  material.customProgramCacheKey = () => `atlas:${cols}x${rows}`;
  return material;
}

const tmpMatrix = new Matrix4();
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpEuler = new Euler();

function useInstances(
  mesh: RefObject<InstancedMesh | null>,
  geometry: BufferGeometry,
  items: readonly ProductItem[],
  offsetOf: (variant: number) => [number, number],
) {
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const offsets = new Float32Array(items.length * 2);
    items.forEach((item, i) => {
      const [x, y, z] = item.position;
      const [rx, ry, rz] = item.rotation ?? [0, 0, 0];
      const s = item.scale ?? 1;
      if (typeof s === 'number') tmpScale.setScalar(s);
      else tmpScale.set(s[0], s[1], s[2]);
      tmpPos.set(x, y, z);
      tmpQuat.setFromEuler(tmpEuler.set(rx, ry, rz));
      m.setMatrixAt(i, tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
      const [u, v] = offsetOf(item.variant);
      offsets[i * 2] = u;
      offsets[i * 2 + 1] = v;
    });
    geometry.setAttribute('aAtlas', new InstancedBufferAttribute(offsets, 2));
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [mesh, geometry, items, offsetOf]);
}

interface ProductsProps {
  items: readonly ProductItem[];
  castShadow?: boolean;
}

/** Booster packs: foil sheen (iridescent on High quality) from the procedural environment. */
export function BoosterPacks({ items, castShadow = false }: ProductsProps) {
  const labels = useSceneLabels();
  const quality = useQuality();
  const ref = useRef<InstancedMesh>(null);
  // Own geometry copy: the per-instance atlas attribute is specific to this mesh.
  const [geometry] = useState(() => basePackGeometry().clone());
  const material = useMemo(() => {
    const map: CanvasTexture = packAtlasTexture(labels.brand, labels.packCount);
    const foil = { map, roughness: 0.32, metalness: 0.35, envMapIntensity: 1.25 };
    // Iridescence needs the (heavier) physical shader: High quality only.
    const m = quality.iridescentFoil
      ? new MeshPhysicalMaterial({
          ...foil,
          iridescence: 0.55,
          iridescenceIOR: 1.35,
          iridescenceThicknessRange: [180, 520],
        })
      : new MeshStandardMaterial(foil);
    return patchAtlas(m, PACK_ATLAS.cols, PACK_ATLAS.rows);
  }, [labels.brand, labels.packCount, quality.iridescentFoil]);
  useInstances(ref, geometry, items, packCellOffset);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, Math.max(1, items.length)]}
      castShadow={castShadow}
      receiveShadow
    />
  );
}

/** Sealed booster boxes (box art on the faces). */
export function BoosterBoxes({ items, castShadow = true }: ProductsProps) {
  const labels = useSceneLabels();
  const ref = useRef<InstancedMesh>(null);
  const [geometry] = useState(() => roundedBox(1, 1, 1, 0.06, 2).clone());
  const material = useMemo(() => {
    const m = new MeshPhysicalMaterial({
      map: boxAtlasTexture(labels.brand),
      roughness: 0.4,
      metalness: 0.05,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
    });
    return patchAtlas(m, BOX_ATLAS.cols, BOX_ATLAS.rows);
  }, [labels.brand]);
  useInstances(ref, geometry, items, boxCellOffset);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, Math.max(1, items.length)]}
      castShadow={castShadow}
      receiveShadow
    />
  );
}
