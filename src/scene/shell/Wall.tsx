import { useFrame } from '@react-three/fiber';
import { createContext, type ReactNode, useContext, useRef, useState } from 'react';
import {
  BufferAttribute,
  type BufferGeometry,
  type Group,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOM, type WallDef, type WallOpening } from '../layout';
import { damp, easeInOutCubic } from '../lib/easing';
import { roundedBox } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { wallpaperTexture } from '../lib/surfaceTextures';
import { useDioramaRuntime, type WallState } from '../runtime';
import { tones } from '../scenePalette';

/**
 * A cut-away wall (docs/04 §4.1): full height when it's a back wall, dropped to a low "stub"
 * showing its section when it faces the camera, dollhouse style. Wall-mounted items (door,
 * window, posters, wall fixtures) pop away with it via `<Mounted>`.
 *
 * Local frame: x runs along the wall (0 … length, left to right seen from inside), y is up,
 * +z points into the room; the inner face is at z = 0 and the wall extends to z = -thickness.
 */

const T = ROOM.wallThickness;
const H = ROOM.wallHeight;
const STUB = ROOM.stubHeight;
const WAINSCOT_TOP = 0.92;
const RAIL_H = 0.06;
const BASE_H = 0.13;
const CROWN_H = 0.08;

interface Span {
  from: number;
  to: number;
}

/** Horizontal intervals of the wall that are solid between `y0` and `y1`. */
function solidSpans(def: WallDef, y0: number, y1: number): Span[] {
  const cuts = def.openings
    .filter((o) => o.bottom < y1 && o.top > y0)
    .map((o) => ({ from: o.center - o.width / 2, to: o.center + o.width / 2 }))
    .sort((a, b) => a.from - b.from);
  const spans: Span[] = [];
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.from > cursor) spans.push({ from: cursor, to: cut.from });
    cursor = Math.max(cursor, cut.to);
  }
  if (cursor < def.length) spans.push({ from: cursor, to: def.length });
  return spans.filter((s) => s.to - s.from > 0.005);
}

/** Axis-aligned solid block of the wall core between x0…x1, y0…y1. */
function coreBlock(x0: number, x1: number, y0: number, y1: number, inset = 0): Part {
  return {
    geometry: roundedBox(x1 - x0, y1 - y0, T - inset * 2, 0.012, 1),
    color: tones.plaster,
    position: [(x0 + x1) / 2, (y0 + y1) / 2, -T / 2],
  };
}

function strip(
  spans: Span[],
  y0: number,
  y1: number,
  depth: number,
  color: string,
  radius = 0.012,
): Part[] {
  return spans.map((s) => ({
    geometry: roundedBox(s.to - s.from, y1 - y0, depth, radius, 2),
    color,
    position: [(s.from + s.to) / 2, (y0 + y1) / 2, depth / 2],
  }));
}

function coreParts(def: WallDef, top: number, inset: number): Part[] {
  const parts: Part[] = [];
  // Vertical bands: split the wall at every opening edge, then fill each band's solid rows.
  const edges = new Set<number>([0, def.length]);
  for (const o of def.openings) {
    edges.add(Math.max(0, o.center - o.width / 2));
    edges.add(Math.min(def.length, o.center + o.width / 2));
  }
  const xs = [...edges].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i] ?? 0;
    const x1 = xs[i + 1] ?? 0;
    const mid = (x0 + x1) / 2;
    const opening = def.openings.find((o) => Math.abs(o.center - mid) < o.width / 2);
    if (!opening) {
      parts.push(coreBlock(x0, x1, 0, top, inset));
      continue;
    }
    if (opening.bottom > 0.001)
      parts.push(coreBlock(x0, x1, 0, Math.min(opening.bottom, top), inset));
    if (opening.top < top) parts.push(coreBlock(x0, x1, opening.top, top, inset));
  }
  return parts;
}

function battens(spans: Span[]): Part[] {
  const parts: Part[] = [];
  for (const span of spans) {
    const count = Math.max(1, Math.round((span.to - span.from) / 0.55));
    const step = (span.to - span.from) / count;
    for (let i = 1; i < count; i++) {
      parts.push({
        geometry: roundedBox(0.045, WAINSCOT_TOP - BASE_H, 0.018, 0.008, 1),
        color: tones.wainscotBatten,
        position: [span.from + i * step, (WAINSCOT_TOP + BASE_H) / 2, 0.032],
      });
    }
  }
  return parts;
}

function fullWallParts(def: WallDef): Part[] {
  const lowSpans = solidSpans(def, 0.02, WAINSCOT_TOP);
  const railSpans = solidSpans(def, WAINSCOT_TOP, WAINSCOT_TOP + RAIL_H);
  return [
    ...coreParts(def, H, 0),
    // Cross-section cap along the top: reads as "the ceiling was lifted off".
    {
      geometry: roundedBox(def.length + 0.001, 0.02, T + 0.004, 0.006, 1),
      color: tones.wallCut,
      position: [def.length / 2, H + 0.005, -T / 2],
    },
    ...strip(lowSpans, BASE_H - 0.01, WAINSCOT_TOP, 0.026, tones.wainscot, 0.006),
    ...battens(lowSpans),
    ...strip(railSpans, WAINSCOT_TOP - 0.01, WAINSCOT_TOP + RAIL_H, 0.05, tones.trim, 0.018),
    ...strip(solidSpans(def, 0, BASE_H), 0, BASE_H, 0.045, tones.baseboard, 0.015),
    ...strip(solidSpans(def, H - CROWN_H, H), H - CROWN_H, H, 0.05, tones.trim, 0.02),
  ];
}

function stubParts(def: WallDef): Part[] {
  const lowSpans = solidSpans(def, 0.02, STUB);
  const inset = 0.003;
  return [
    ...coreParts(def, STUB, inset),
    ...lowSpans.map<Part>((s) => ({
      geometry: roundedBox(s.to - s.from, 0.03, T + 0.03, 0.01, 1),
      color: tones.wallCut,
      position: [(s.from + s.to) / 2, STUB, -T / 2 + 0.015],
    })),
    ...strip(solidSpans(def, 0, BASE_H), 0, BASE_H, 0.045, tones.baseboard, 0.015),
    ...strip(
      solidSpans(def, BASE_H, STUB),
      BASE_H - 0.01,
      STUB - 0.01,
      0.026,
      tones.wainscot,
      0.006,
    ),
  ];
}

const wallpaperCache = new Map<string, BufferGeometry>();

/**
 * Cache key for a wall's baked meshes: its side, length and openings, so walls with the door in
 * a different place (the live shop's layout vs. the spike's) never share geometry.
 */
function wallKey(def: WallDef): string {
  const openings = def.openings
    .map((o) => `${o.kind}@${o.center.toFixed(3)}/${o.width}/${o.bottom}/${o.top}`)
    .join(',');
  return `${def.side}:${def.length}:${openings}`;
}

/** Wallpaper panels between chair rail and crown, with UVs in metres for a seamless pattern. */
function wallpaperGeometry(def: WallDef): BufferGeometry {
  const key = wallKey(def);
  const hit = wallpaperCache.get(key);
  if (hit) return hit;
  const y0 = WAINSCOT_TOP + RAIL_H;
  const y1 = H - CROWN_H;
  const pieces: BufferGeometry[] = [];
  const tile = 0.9;
  const addRect = (x0: number, x1: number, a: number, b: number) => {
    if (x1 - x0 < 0.005 || b - a < 0.005) return;
    const g = new PlaneGeometry(x1 - x0, b - a);
    g.translate((x0 + x1) / 2, (a + b) / 2, 0.003);
    const pos = g.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / tile;
      uv[i * 2 + 1] = pos.getY(i) / tile;
    }
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    pieces.push(g);
  };
  const edges = new Set<number>([0, def.length]);
  for (const o of def.openings) {
    edges.add(o.center - o.width / 2);
    edges.add(o.center + o.width / 2);
  }
  const xs = [...edges].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i] ?? 0;
    const x1 = xs[i + 1] ?? 0;
    const mid = (x0 + x1) / 2;
    const opening: WallOpening | undefined = def.openings.find(
      (o) => Math.abs(o.center - mid) < o.width / 2,
    );
    if (!opening) {
      addRect(x0, x1, y0, y1);
      continue;
    }
    addRect(x0, x1, y0, Math.min(y1, opening.bottom));
    addRect(x0, x1, Math.max(y0, opening.top), y1);
  }
  const merged = mergeGeometries(pieces, false);
  for (const p of pieces) p.dispose();
  if (!merged) throw new Error('wallpaper: merge failed');
  wallpaperCache.set(key, merged);
  return merged;
}

const WallStateContext = createContext<WallState | null>(null);

interface MountedProps {
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  /**
   * Point (in the wall frame) the pop animation scales around, for children laid out in
   * absolute wall coordinates (doors, windows). Defaults to `position`.
   */
  pivot?: readonly [number, number, number];
  children: ReactNode;
}

/**
 * Wall-mounted item: pops away (scales to zero around its own origin) when its wall is cut
 * away, and back with a little overshoot when the wall returns.
 */
export function Mounted({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  pivot,
  children,
}: MountedProps) {
  const wall = useContext(WallStateContext);
  const ref = useRef<Group>(null);
  useFrame(() => {
    const group = ref.current;
    if (!group || !wall) return;
    const h = wall.hide;
    const s = h <= 0.001 ? 1 : 1 - easeInOutCubic(Math.min(1, h * 1.25));
    group.scale.setScalar(Math.max(0.0001, s));
    group.visible = s > 0.002;
  });
  if (pivot) {
    return (
      <group ref={ref} position={pivot}>
        <group
          position={[position[0] - pivot[0], position[1] - pivot[1], position[2] - pivot[2]]}
          rotation={rotation}
        >
          {children}
        </group>
      </group>
    );
  }
  return (
    <group ref={ref} position={position} rotation={rotation}>
      {children}
    </group>
  );
}

interface WallProps {
  def: WallDef;
  children?: ReactNode;
}

export function Wall({ def, children }: WallProps) {
  const runtime = useDioramaRuntime();
  const state = runtime.walls[def.side];
  const fullRef = useRef<Group>(null);
  const stubRef = useRef<Group>(null);
  const initialized = useRef(false);

  const key = wallKey(def);
  const fullGeometry = cachedMerge(`wall-full:${key}`, () => fullWallParts(def));
  const stubGeometry = cachedMerge(`wall-stub:${key}`, () => stubParts(def));
  const paper = wallpaperGeometry(def);
  const [paperMaterial] = useState(
    () => new MeshStandardMaterial({ map: wallpaperTexture(), roughness: 0.85 }),
  );

  useFrame((_, delta) => {
    const dir = runtime.camera.direction;
    // The wall hides when its outward normal faces the camera (it would block the view).
    const facing = def.normal[0] * dir.x + def.normal[1] * dir.z;
    const target = facing > 0.02 ? 1 : 0;
    if (!initialized.current) {
      state.hide = target;
      initialized.current = true;
    } else {
      state.hide = damp(state.hide, target, 7, Math.min(delta, 0.1));
      if (Math.abs(state.hide - target) < 0.002) state.hide = target;
    }
    const drop = easeInOutCubic(state.hide);
    state.height = 1 - drop * (1 - STUB / H);
    const full = fullRef.current;
    const stub = stubRef.current;
    if (full) {
      full.scale.y = Math.max(0.001, 1 - drop);
      full.visible = state.hide < 0.999;
    }
    if (stub) stub.visible = state.hide > 0.001;
  });

  const material = vertexColorMaterial({ roughness: 0.8 });
  return (
    <group position={def.origin} rotation-y={def.yaw}>
      <group ref={fullRef}>
        <mesh geometry={fullGeometry} material={material} castShadow receiveShadow />
        <mesh geometry={paper} material={paperMaterial} receiveShadow />
      </group>
      <group ref={stubRef}>
        <mesh geometry={stubGeometry} material={material} castShadow receiveShadow />
      </group>
      <WallStateContext value={state}>{children}</WallStateContext>
    </group>
  );
}
