import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Euler,
  type Group,
  InstancedBufferAttribute,
  type InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { FixtureSlot } from '@/sim/state/types';
import { useGame } from '@/state/gameStore';
import { CASE_BASE_HEIGHT, DisplayCase } from '../fixtures/DisplayCase';
import { plane, roundedBox } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { liveTones, tones } from '../scenePalette';
import { caseCellRect, createCaseAtlas } from './caseCards';
import { useLiveRuntime } from './liveRuntime';
import { caseSlotSpots } from './slotLayout';

/**
 * The Small Display Case (`fx.case.small`) with its singles: one card per slot, lying almost flat
 * on the velvet so the faces read from any camera angle; an empty slot leaves a bare stand. Cards
 * are one instanced draw call over a per-case card-face atlas (live/caseCards.ts).
 *
 * Local frame: origin on the floor at the centre; customers look in from +z.
 */
export const CASE = { length: 1.8, depth: 0.6, height: 0.95 } as const;

const CARD_W = 0.17;
const CARD_H = 0.238;
const BED_Y = CASE_BASE_HEIGHT + 0.035;
const NO_SLOTS: readonly FixtureSlot[] = [];

function standsGeometry(count: number) {
  return cachedMerge(`live-case-stands:${count}`, () =>
    caseSlotSpots(count, CASE.length, CASE.depth, BED_Y).map<Part>((spot) => ({
      geometry: roundedBox(CARD_W + 0.02, 0.016, CARD_H * 0.5, 0.006, 1),
      color: tones.walnut,
      position: [spot.position[0], spot.position[1] - 0.035, spot.position[2]],
    })),
  );
}

const tmp = {
  m: new Matrix4(),
  p: new Vector3(),
  q: new Quaternion(),
  s: new Vector3(1, 1, 1),
  e: new Euler(),
};

export function CaseFixture({ uid }: { uid: string }) {
  const live = useLiveRuntime();
  const slots = useGame<readonly FixtureSlot[]>(
    (game) => game.shop.fixtures.find((f) => f.uid === uid)?.slots ?? NO_SLOTS,
    NO_SLOTS,
  );
  const count = Math.max(1, slots.length);
  const [atlas] = useState(createCaseAtlas);
  const [material] = useState(() => {
    // A little self-light keeps the faces bright and saturated under the glass top.
    const m = new MeshStandardMaterial({
      map: atlas.texture,
      emissiveMap: atlas.texture,
      emissive: liveTones.cardGlow,
      emissiveIntensity: 0.32,
      roughness: 0.42,
      metalness: 0.05,
    });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aRect;')
        .replace(
          '#include <uv_vertex>',
          '#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv = uv * aRect.zw + aRect.xy;\n#endif',
        );
    };
    m.customProgramCacheKey = () => 'card-rect';
    return m;
  });
  const [geometry] = useState(() => {
    const g = plane(CARD_W, CARD_H).clone();
    g.setAttribute('aRect', new InstancedBufferAttribute(new Float32Array(count * 4), 4));
    return g;
  });
  useEffect(
    () => () => {
      atlas.dispose();
      material.dispose();
      geometry.dispose();
    },
    [atlas, material, geometry],
  );

  const meshRef = useRef<InstancedMesh>(null);
  const groupRef = useRef<Group>(null);
  const previous = useRef<number[] | null>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const spots = caseSlotSpots(count, CASE.length, CASE.depth, BED_Y);
    const rects = geometry.getAttribute('aRect') as InstancedBufferAttribute;
    let shown = 0;
    slots.forEach((slot, index) => {
      atlas.setCard(index, slot.cardKey ?? null);
      const spot = spots[index];
      if (!slot.cardKey || slot.qty <= 0 || !spot) return;
      const [x, y, z] = spot.position;
      tmp.p.set(x, y, z);
      // Tip the card back from upright by `tilt`, with a hint of hand-placed wobble.
      tmp.q.setFromEuler(tmp.e.set(-spot.tilt, ((index * 37) % 7) * 0.012 - 0.036, 0));
      mesh.setMatrixAt(shown, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      const rect = caseCellRect(index);
      rects.setXYZW(shown, rect[0], rect[1], rect[2], rect[3]);
      shown += 1;
    });
    mesh.count = shown;
    mesh.instanceMatrix.needsUpdate = true;
    rects.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [slots, atlas, geometry, count]);

  // A sparkle when a card goes in (not on first mount).
  useEffect(() => {
    const before = previous.current;
    previous.current = slots.map((slot) => slot.qty);
    const group = groupRef.current;
    if (!before || !group || live.reducedMotion) return;
    const spots = caseSlotSpots(count, CASE.length, CASE.depth, BED_Y);
    slots.forEach((slot, index) => {
      const spot = spots[index];
      if (!spot || slot.qty <= (before[index] ?? 0)) return;
      const at = group.localToWorld(
        new Vector3(spot.position[0], spot.position[1] + 0.2, spot.position[2]),
      );
      live.particles.push({ kind: 'sparkle', position: at, count: 6, spread: 0.18 });
    });
  }, [slots, live, count]);

  return (
    <group ref={groupRef}>
      <DisplayCase length={CASE.length} depth={CASE.depth} height={CASE.height} contents="none">
        <mesh geometry={standsGeometry(count)} material={vertexColorMaterial({ roughness: 0.6 })} />
        <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} />
      </DisplayCase>
    </group>
  );
}
