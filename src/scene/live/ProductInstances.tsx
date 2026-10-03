import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BoxGeometry,
  type BufferGeometry,
  Euler,
  InstancedBufferAttribute,
  type InstancedMesh,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { basePackGeometry } from '../products/InstancedProducts';
import { useQuality } from '../runtime';
import { type AtlasRect, productAtlasTexture } from './productAtlas';
import { type ProductShape, SHAPE_SIZE } from './slotLayout';

/**
 * Instanced shelf products drawn from the shared product atlas (docs/06 §7 "instancing and
 * atlases"): one draw call per shape per fixture, with a per-instance UV rectangle (`aRect`)
 * picking each unit's face out of the atlas.
 */
export interface ProductUnit {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: number;
  rect: AtlasRect;
}

/**
 * A box whose front and back faces show the whole atlas cell, while the four edges sample a
 * thin strip just inside the art's left edge (the wrapper colour), like printed card stock.
 */
function cardboardGeometry(w: number, h: number, d: number): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d);
  const uv = geometry.getAttribute('uv');
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; four vertices each (1 segment).
  const strip = (face: number) => {
    for (let i = 0; i < 4; i++) {
      const k = face * 4 + i;
      uv.setXY(k, 0.03 + (i % 2) * 0.02, uv.getY(k));
    }
  };
  strip(0);
  strip(1);
  strip(2);
  strip(3);
  // Back face: mirror so the art isn't printed back to front.
  for (let i = 0; i < 4; i++) {
    const k = 5 * 4 + i;
    uv.setXY(k, 1 - uv.getX(k), uv.getY(k));
  }
  uv.needsUpdate = true;
  return geometry;
}

const baseGeometries = new Map<ProductShape, BufferGeometry>();

function baseGeometry(shape: ProductShape): BufferGeometry {
  let geometry = baseGeometries.get(shape);
  if (!geometry) {
    const size = SHAPE_SIZE[shape];
    geometry = shape === 'pack' ? basePackGeometry() : cardboardGeometry(size.w, size.h, size.d);
    baseGeometries.set(shape, geometry);
  }
  return geometry;
}

/** Reads the map through the instance's atlas rectangle. */
function patchRect<M extends MeshStandardMaterial>(material: M): M {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aRect;')
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv = uv * aRect.zw + aRect.xy;\n#endif',
      );
  };
  material.customProgramCacheKey = () => 'product-rect';
  return material;
}

const materials = new Map<string, MeshStandardMaterial>();

function productMaterial(shape: ProductShape, iridescent: boolean): MeshStandardMaterial {
  const key = `${shape}:${iridescent}`;
  const hit = materials.get(key);
  if (hit) return hit;
  const map = productAtlasTexture();
  let material: MeshStandardMaterial;
  if (shape === 'pack') {
    // Foil wrappers: shiny, iridescent on High (the heavier physical shader).
    const foil = { map, roughness: 0.32, metalness: 0.35, envMapIntensity: 1.25 };
    material = iridescent
      ? new MeshPhysicalMaterial({
          ...foil,
          iridescence: 0.55,
          iridescenceIOR: 1.35,
          iridescenceThicknessRange: [180, 520],
        })
      : new MeshStandardMaterial(foil);
  } else if (shape === 'blister') {
    material = new MeshStandardMaterial({ map, roughness: 0.28, metalness: 0.1 });
  } else {
    material = new MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.04 });
  }
  materials.set(key, patchRect(material));
  return materials.get(key) as MeshStandardMaterial;
}

const tmpMatrix = new Matrix4();
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpEuler = new Euler();

interface ProductInstancesProps {
  shape: ProductShape;
  units: readonly ProductUnit[];
  /** Instances allocated up front, so stock changes never rebuild the mesh. */
  capacity: number;
  castShadow?: boolean;
}

export function ProductInstances({
  shape,
  units,
  capacity,
  castShadow = false,
}: ProductInstancesProps) {
  const quality = useQuality();
  const ref = useRef<InstancedMesh>(null);
  const [geometry] = useState(() => {
    const g = baseGeometry(shape).clone();
    g.setAttribute('aRect', new InstancedBufferAttribute(new Float32Array(capacity * 4), 4));
    return g;
  });
  const material = productMaterial(shape, shape === 'pack' && quality.iridescentFoil);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rects = geometry.getAttribute('aRect') as InstancedBufferAttribute;
    const count = Math.min(units.length, capacity);
    for (let i = 0; i < count; i++) {
      const unit = units[i];
      if (!unit) continue;
      const [x, y, z] = unit.position;
      const [rx, ry, rz] = unit.rotation;
      tmpPos.set(x, y, z);
      tmpQuat.setFromEuler(tmpEuler.set(rx, ry, rz));
      tmpScale.setScalar(unit.scale);
      mesh.setMatrixAt(i, tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
      rects.setXYZW(i, unit.rect[0], unit.rect[1], unit.rect[2], unit.rect[3]);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    rects.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [units, capacity, geometry]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, Math.max(1, capacity)]}
      castShadow={castShadow}
      receiveShadow
    />
  );
}
