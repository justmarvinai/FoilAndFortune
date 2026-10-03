import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import {
  type BufferGeometry,
  type Mesh,
  MeshBasicMaterial,
  Path,
  RingGeometry,
  Shape,
  ShapeGeometry,
} from 'three';
import { type SpringState, springStep } from '../lib/easing';
import { liveTones } from '../scenePalette';
import { useLiveRuntime } from './liveRuntime';

/**
 * Hover and selection feedback on the floor (docs/06 §7 "hover … emissive highlight"): a soft
 * rounded outline around the fixture under the pointer (or a ring under a customer), and a sun
 * outline around the fixture whose popover is open. Two meshes, moved every frame; no React.
 */

function roundedRect(path: Path | Shape, w: number, d: number, r: number) {
  const x = -w / 2;
  const y = -d / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + d - r);
  path.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  path.lineTo(x + r, y + d);
  path.quadraticCurveTo(x, y + d, x, y + d - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
}

const outlines = new Map<string, BufferGeometry>();

/** A flat rounded-rectangle outline (XZ plane) of the given outer size. */
function outline(width: number, depth: number, thickness = 0.06): BufferGeometry {
  const key = `${width.toFixed(2)}x${depth.toFixed(2)}`;
  let geometry = outlines.get(key);
  if (!geometry) {
    const r = Math.min(0.18, width / 2, depth / 2);
    const shape = new Shape();
    roundedRect(shape, width, depth, r);
    const hole = new Path();
    roundedRect(hole, width - thickness * 2, depth - thickness * 2, Math.max(0.02, r - thickness));
    shape.holes.push(hole);
    geometry = new ShapeGeometry(shape, 6);
    geometry.rotateX(-Math.PI / 2);
    outlines.set(key, geometry);
  }
  return geometry;
}

const circleRing = new RingGeometry(0.3, 0.37, 36);
circleRing.rotateX(-Math.PI / 2);

function useRingMaterial(color: string) {
  const [material] = useState(
    () =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
      }),
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

export function HighlightRing() {
  const live = useLiveRuntime();
  const hoverRef = useRef<Mesh>(null);
  const selectRef = useRef<Mesh>(null);
  const hoverMaterial = useRingMaterial(liveTones.hover);
  const selectMaterial = useRingMaterial(liveTones.select);
  const clock = useRef(0);
  const springs = useRef(new Map<string, SpringState>());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    clock.current += dt;
    const t = clock.current;

    // Hovered fixtures lift a touch with a springy "boing" (none for reduced motion).
    for (const info of live.fixtures.values()) {
      if (!info.lift) continue;
      const hovered = live.hover?.kind !== 'customer' && live.hover?.uid === info.uid;
      let spring = springs.current.get(info.uid);
      if (!spring) {
        spring = { value: 0, velocity: 0 };
        springs.current.set(info.uid, spring);
      }
      const target = hovered && !live.reducedMotion ? 1 : 0;
      if (target === 0 && Math.abs(spring.value) < 1e-4 && Math.abs(spring.velocity) < 1e-4) {
        if (info.lift.scale.x !== 1) info.lift.scale.setScalar(1);
        continue;
      }
      springStep(spring, target, 260, 11, dt);
      const s = 1 + spring.value * 0.018;
      info.lift.scale.set(s, 1 + spring.value * 0.03, s);
    }
    const pulse = live.reducedMotion ? 0.8 : 0.62 + Math.sin(t * 5) * 0.18;

    const hover = hoverRef.current;
    if (hover) {
      const target = live.hover;
      let shown = false;
      if (target?.kind === 'customer') {
        const v = live.agents.get(target.uid);
        if (v?.placed && !v.ghost) {
          hover.geometry = circleRing;
          hover.position.set(v.x + v.ox, 0.02, v.z + v.oz);
          hover.scale.setScalar(v.look.scale);
          shown = true;
        }
      } else if (target && target.uid !== live.selected) {
        const info = live.fixtures.get(target.uid);
        if (info) {
          const { min, max } = info.bounds;
          const width = max[0] - min[0] + 0.22;
          const depth = max[2] - min[2] + 0.22;
          hover.geometry = outline(width, depth);
          hover.position.set((min[0] + max[0]) / 2, 0.02, (min[2] + max[2]) / 2);
          hover.scale.setScalar(1);
          shown = true;
        }
      }
      hover.visible = shown;
      hoverMaterial.opacity = shown ? pulse : 0;
    }

    const select = selectRef.current;
    if (select) {
      const info = live.selected ? live.fixtures.get(live.selected) : undefined;
      if (info) {
        const { min, max } = info.bounds;
        select.geometry = outline(max[0] - min[0] + 0.26, max[2] - min[2] + 0.26, 0.075);
        select.position.set((min[0] + max[0]) / 2, 0.021, (min[2] + max[2]) / 2);
      }
      select.visible = Boolean(info);
      selectMaterial.opacity = info ? 0.85 : 0;
    }
  }, -3);

  return (
    <>
      <mesh
        ref={hoverRef}
        geometry={circleRing}
        material={hoverMaterial}
        visible={false}
        renderOrder={3}
      />
      <mesh
        ref={selectRef}
        geometry={circleRing}
        material={selectMaterial}
        visible={false}
        renderOrder={3}
      />
    </>
  );
}
