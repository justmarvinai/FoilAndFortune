import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Color,
  type Group,
  type InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { type SceneLabels, useSceneLabels } from '../labels';
import { cachedTexture, FONTS, fitText, liveCanvasTexture, roundRectPath } from '../lib/canvas';
import { lerp } from '../lib/easing';
import { box, cylinder, lathe, plane, roundedBox, sphere, torus } from '../lib/geometry';
import { toyMaterial, vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { createRng, randRange } from '../lib/rng';
import { BoosterBoxes, type ProductItem } from '../products/InstancedProducts';
import { drawCreature } from '../products/packArt';
import { type DioramaRuntime, useDioramaRuntime } from '../runtime';
import { tones } from '../scenePalette';

/**
 * Wall-mounted decor, built in a wall's local frame (+z into the room). Wrap in `<Mounted>` so
 * it pops away with its wall.
 */

function posterTexture(labels: SceneLabels) {
  return cachedTexture(`poster:${labels.brand}:${labels.posterSubtitle}`, () =>
    liveCanvasTexture(360, 480, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h * 0.5, 10, w / 2, h * 0.5, h * 0.6);
      g.addColorStop(0, '#9FE3FF');
      g.addColorStop(1, '#3E7FE0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Sun rays.
      ctx.save();
      ctx.translate(w / 2, h * 0.52);
      for (let i = 0; i < 18; i++) {
        ctx.rotate((Math.PI * 2) / 18);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 233, 150, 0.45)' : 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-26, -h);
        ctx.lineTo(26, -h);
        ctx.fill();
      }
      ctx.restore();
      drawCreature(ctx, 'sparkit', w / 2, h * 0.55, w * 0.22);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#1E2340';
      ctx.fillStyle = '#FFC93C';
      fitText(ctx, labels.brand, w / 2, h * 0.14, w - 40, 54, FONTS.display, 'both');
      ctx.fillStyle = '#FF6F59';
      ctx.fillRect(0, h * 0.86, w, h * 0.14);
      ctx.fillStyle = '#FFF6E5';
      fitText(ctx, labels.posterSubtitle, w / 2, h * 0.93, w - 30, 30, FONTS.display);
    }),
  );
}

export function Poster({
  width = 0.6,
  height = 0.8,
  tilt = 0.03,
}: {
  width?: number;
  height?: number;
  tilt?: number;
}) {
  const labels = useSceneLabels();
  const material = useMemo(
    () => new MeshStandardMaterial({ map: posterTexture(labels), roughness: 0.55 }),
    [labels],
  );
  return (
    <group rotation-z={tilt}>
      <mesh
        geometry={roundedBox(width + 0.07, height + 0.07, 0.035, 0.015, 2)}
        material={toyMaterial(tones.woodDark)}
        position-z={0.018}
        castShadow
      />
      <mesh geometry={plane(width, height)} material={material} position-z={0.037} />
    </group>
  );
}

function neonTexture(text: string) {
  return cachedTexture(`neon:${text}`, () =>
    liveCanvasTexture(512, 224, (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const drawTube = (width: number, color: string) => {
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        fitText(ctx, text, w / 2, h * 0.5, w * 0.78, 132, FONTS.display, 'stroke');
      };
      // Tube body, then a hot white core: reads as glowing glass.
      drawTube(16, '#FF4F9A');
      drawTube(5, '#FFE3F0');
      // Teal border tube with rounded corners.
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#26E0D0';
      roundRectPath(ctx, 14, 14, w - 28, h - 28, 40);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#E6FFFC';
      roundRectPath(ctx, 14, 14, w - 28, h - 28, 40);
      ctx.stroke();
    }),
  );
}

/** Flicker when switching on: a few quick blinks, then steady with a faint buzz. */
function neonFlicker(runtime: DioramaRuntime, switchedAt = runtime.eveningSwitchedAt): number {
  const t = runtime.time - switchedAt;
  if (t < 0 || t > 1.2) return 0.97 + Math.sin(runtime.time * 43) * 0.03;
  if (t < 0.1) return 1;
  if (t < 0.22) return 0.08;
  if (t < 0.3) return 1;
  if (t < 0.5) return 0.15;
  if (t < 0.58) return 0.8;
  if (t < 0.66) return 0.2;
  return 1;
}

/**
 * Neon sign on a dark acrylic board, hung on two little chains: "OPEN" by default. The live shop
 * passes its phase: lit OPEN while trading (flickering on when the sign flips), a dark CLOSED
 * sign before opening and at night.
 */
export function NeonSign({
  width = 0.72,
  height = 0.32,
  text,
  on = true,
}: {
  width?: number;
  height?: number;
  text?: string;
  on?: boolean;
}) {
  const runtime = useDioramaRuntime();
  const labels = useSceneLabels();
  const shown = text ?? labels.open;
  const material = useMemo(() => {
    const map = neonTexture(shown);
    return new MeshStandardMaterial({
      map,
      emissiveMap: map,
      emissive: '#FFFFFF',
      emissiveIntensity: 0.4,
      roughness: 0.4,
      transparent: false,
    });
  }, [shown]);
  const switched = useRef({ on, at: -100 });
  useFrame(() => {
    const s = switched.current;
    if (s.on !== on) {
      s.on = on;
      s.at = runtime.time;
    }
    if (!on) {
      material.emissiveIntensity = 0.08;
      return;
    }
    const evening = runtime.evening;
    const flicker =
      runtime.time - s.at < 1.2
        ? neonFlicker(runtime, s.at)
        : evening > 0.5
          ? neonFlicker(runtime)
          : 1;
    material.emissiveIntensity = lerp(0.9, 6, evening) * flicker;
  });
  const frame = cachedMerge(`neon-frame:${width}:${height}`, () => [
    {
      geometry: roundedBox(width + 0.05, height + 0.05, 0.03, 0.025, 2),
      color: '#171A33',
      position: [0, 0, 0.015],
    },
    {
      geometry: cylinder(0.006, 0.006, 0.28, 6),
      color: tones.iron,
      position: [-width * 0.35, height / 2 + 0.14, 0.02],
    },
    {
      geometry: cylinder(0.006, 0.006, 0.28, 6),
      color: tones.iron,
      position: [width * 0.35, height / 2 + 0.14, 0.02],
    },
  ]);
  return (
    <group>
      <mesh geometry={frame} material={vertexColorMaterial({ roughness: 0.35 })} castShadow />
      <mesh geometry={plane(width, height)} material={material} position-z={0.032} />
    </group>
  );
}

function clockFaceTexture() {
  return cachedTexture('clock-face', () =>
    liveCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#FFF6E5';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1E2340';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = i % 3 === 0 ? 10 : 5;
        ctx.beginPath();
        ctx.arc(w / 2 + Math.sin(a) * 100, h / 2 - Math.cos(a) * 100, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FF6F59';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 + 50, 14, 0, Math.PI * 2);
      ctx.fill();
    }),
  );
}

/**
 * Round wall clock. Its hands follow `runtime.clockMinutes` (the shop's sim clock) when set, else
 * they sweep with scene time (a minute per real minute).
 */
export function WallClock({ radius = 0.2 }: { radius?: number }) {
  const minuteRef = useRef<Group>(null);
  const hourRef = useRef<Group>(null);
  const runtime = useDioramaRuntime();
  const [face] = useState(
    () => new MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.5 }),
  );
  useFrame(() => {
    const minutes = runtime.clockMinutes ?? 9 * 60 + 41 + runtime.time / 60;
    if (minuteRef.current) minuteRef.current.rotation.z = -((minutes % 60) / 60) * Math.PI * 2;
    if (hourRef.current) hourRef.current.rotation.z = -(((minutes / 60) % 12) / 12) * Math.PI * 2;
  });
  return (
    <group>
      <mesh
        geometry={torus(radius, 0.035, 10, 32)}
        material={toyMaterial(tones.teal, { roughness: 0.4 })}
        position-z={0.04}
        castShadow
      />
      <mesh
        geometry={cylinder(radius, radius, 0.03, 32)}
        material={face}
        rotation-x={Math.PI / 2}
        position-z={0.03}
      />
      <group ref={hourRef} position-z={0.05}>
        <mesh
          geometry={roundedBox(0.022, radius * 0.55, 0.01, 0.005, 1)}
          material={toyMaterial(tones.ink)}
          position-y={radius * 0.22}
        />
      </group>
      <group ref={minuteRef} position-z={0.056}>
        <mesh
          geometry={roundedBox(0.016, radius * 0.8, 0.01, 0.005, 1)}
          material={toyMaterial(tones.ink)}
          position-y={radius * 0.36}
        />
      </group>
      <mesh geometry={sphere(0.018, 8, 6)} material={toyMaterial(tones.coral)} position-z={0.065} />
    </group>
  );
}

/**
 * Floating wall shelf behind the counter: booster boxes on display, a little trophy, binders and
 * a trailing plant. Local frame: centred on the wall at floor level.
 */
const SHELF_LOW = 1.24;
const SHELF_HIGH = 1.66;

export function BoxShelf({ width = 1.7, boxes = true }: { width?: number; boxes?: boolean }) {
  const frame = cachedMerge(`box-shelf:${width}`, () => {
    const parts: Part[] = [];
    for (const y of [SHELF_LOW, SHELF_HIGH]) {
      parts.push({
        geometry: roundedBox(width, 0.045, 0.3, 0.018, 2),
        color: tones.wood,
        position: [0, y, 0.15],
      });
      for (const x of [-width * 0.38, width * 0.38]) {
        parts.push({
          geometry: roundedBox(0.04, 0.14, 0.2, 0.012, 1),
          color: tones.iron,
          position: [x, y - 0.09, 0.1],
        });
      }
    }
    // Trophy (gold cup) on the top shelf.
    parts.push(
      {
        geometry: roundedBox(0.1, 0.05, 0.1, 0.012, 1),
        color: tones.walnut,
        position: [width * 0.36, SHELF_HIGH + 0.047, 0.15],
      },
      {
        geometry: lathe(
          'trophy-cup',
          [
            [0.001, 0],
            [0.02, 0],
            [0.02, 0.06],
            [0.07, 0.12],
            [0.075, 0.2],
            [0.065, 0.2],
            [0.001, 0.13],
          ],
          18,
        ),
        color: tones.sun,
        position: [width * 0.36, SHELF_HIGH + 0.07, 0.15],
      },
    );
    // Binders on the lower shelf.
    const binders = [tones.grape, tones.coral, tones.teal, tones.sky];
    binders.forEach((c, i) => {
      parts.push({
        geometry: roundedBox(0.07, 0.3, 0.24, 0.015, 2),
        color: c,
        position: [width * 0.3 + i * 0.075, SHELF_LOW + 0.172, 0.15],
        rotation: [0, 0, i === 3 ? -0.18 : 0],
      });
    });
    // Trailing pothos on the top shelf, left end.
    parts.push({
      geometry: cylinder(0.08, 0.065, 0.12, 16),
      color: tones.paper2,
      position: [-width * 0.4, SHELF_HIGH + 0.08, 0.15],
    });
    const rng = createRng(21);
    for (let i = 0; i < 14; i++) {
      const drop = i * 0.035;
      parts.push({
        geometry: sphere(0.045, 8, 6),
        color: i % 3 === 0 ? tones.leafDark : tones.leaf,
        position: [
          -width * 0.4 + randRange(rng, -0.1, 0.1),
          SHELF_HIGH + 0.13 - drop,
          0.22 + randRange(rng, -0.04, 0.06),
        ],
        scale: [1, 0.45, 0.8],
      });
    }
    return parts;
  });
  const boxItems = useMemo<ProductItem[]>(() => {
    const items: ProductItem[] = [];
    const low = SHELF_LOW;
    const high = SHELF_HIGH;
    for (let i = 0; i < 3; i++) {
      items.push({
        position: [-width * 0.42 + i * 0.36, low + 0.13, 0.15],
        rotation: [0, -0.05 + i * 0.05, 0],
        variant: i % 3,
        scale: [0.32, 0.2, 0.24],
      });
    }
    items.push({
      position: [-width * 0.08, high + 0.13, 0.15],
      rotation: [0, 0.08, 0],
      variant: 1,
      scale: [0.32, 0.2, 0.24],
    });
    items.push({
      position: [width * 0.15, high + 0.13, 0.15],
      rotation: [0, -0.06, 0],
      variant: 3,
      scale: [0.24, 0.2, 0.2],
    });
    return items;
  }, [width]);
  return (
    <group>
      <mesh
        geometry={frame}
        material={vertexColorMaterial({ roughness: 0.5 })}
        castShadow
        receiveShadow
      />
      {boxes ? <BoosterBoxes items={boxItems} /> : null}
    </group>
  );
}

/** Cork board with flyers (League Night, want lists…). */
export function Corkboard({ width = 1.1, height = 0.75 }: { width?: number; height?: number }) {
  const geometry = cachedMerge(`corkboard:${width}:${height}`, () => {
    const parts: Part[] = [
      {
        geometry: roundedBox(width + 0.08, height + 0.08, 0.04, 0.02, 2),
        color: tones.wood,
        position: [0, 0, 0.02],
      },
      {
        geometry: roundedBox(width, height, 0.03, 0.01, 1),
        color: '#C9965E',
        position: [0, 0, 0.03],
      },
    ];
    const flyers = [
      [tones.paper, -0.3, 0.12, 0.05, 0.3, 0.38],
      [tones.sun, 0.05, 0.16, -0.08, 0.26, 0.3],
      ['#BDE7FF', 0.33, 0.05, 0.1, 0.28, 0.36],
      [tones.paper, 0.02, -0.19, 0.04, 0.34, 0.22],
      ['#FFD1DC', -0.36, -0.2, -0.06, 0.2, 0.24],
    ] as const;
    for (const [color, x, y, rot, w, h] of flyers) {
      parts.push(
        {
          geometry: roundedBox(w, h, 0.006, 0.004, 1),
          color,
          position: [x * width, y * height * 1.4, 0.05],
          rotation: [0, 0, rot],
        },
        {
          geometry: sphere(0.016, 8, 6),
          color: tones.coral,
          position: [x * width, y * height * 1.4 + h * 0.4, 0.058],
        },
      );
    }
    return parts;
  });
  return <mesh geometry={geometry} material={vertexColorMaterial({ roughness: 0.8 })} castShadow />;
}

const MANGA_SHELVES = [0.12, 0.5, 0.88, 1.26] as const;

/** A small bookcase of manga volumes, spine-out (docs/04 §7): one instanced draw call. */
export function MangaShelf({
  width = 1.1,
  height = 1.55,
  depth = 0.34,
}: {
  width?: number;
  height?: number;
  depth?: number;
}) {
  const frame = cachedMerge(`manga-shelf:${width}:${height}:${depth}`, () => {
    const parts: Part[] = [
      {
        geometry: roundedBox(0.05, height, depth, 0.02, 2),
        color: tones.maple,
        position: [-width / 2 + 0.025, height / 2, depth / 2],
      },
      {
        geometry: roundedBox(0.05, height, depth, 0.02, 2),
        color: tones.maple,
        position: [width / 2 - 0.025, height / 2, depth / 2],
      },
      {
        geometry: roundedBox(width, 0.05, depth + 0.02, 0.02, 2),
        color: tones.maple,
        position: [0, height, depth / 2],
      },
      {
        geometry: roundedBox(width - 0.06, height - 0.05, 0.02, 0.01, 1),
        color: tones.coral,
        position: [0, height / 2, 0.02],
      },
    ];
    for (const y of MANGA_SHELVES) {
      parts.push({
        geometry: roundedBox(width - 0.08, 0.035, depth - 0.02, 0.012, 1),
        color: tones.maple,
        position: [0, y, depth / 2],
      });
    }
    return parts;
  });
  const ref = useRef<InstancedMesh>(null);
  const books = useMemo(() => {
    const rng = createRng(77);
    const spineColors = [
      tones.coral,
      tones.sky,
      tones.sun,
      tones.grape,
      tones.mint,
      '#FF8BD1',
      tones.paper,
      tones.ink,
    ];
    const items: { x: number; y: number; h: number; c: string; lean: number }[] = [];
    for (const y of MANGA_SHELVES.slice(0, 3)) {
      let x = -width / 2 + 0.07;
      while (x < width / 2 - 0.08) {
        const run = spineColors[Math.floor(rng() * spineColors.length)] ?? tones.coral;
        const count = 3 + Math.floor(rng() * 5);
        for (let i = 0; i < count && x < width / 2 - 0.08; i++) {
          const h = randRange(rng, 0.24, 0.27);
          items.push({ x, y: y + 0.0175 + h / 2, h, c: run, lean: 0 });
          x += 0.042;
        }
        x += 0.012;
      }
    }
    return items;
  }, [width]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const c = new Color();
    books.forEach((b, i) => {
      p.set(b.x, b.y, depth / 2 + 0.02);
      s.set(1, b.h / 0.26, 1);
      mesh.setMatrixAt(i, m.compose(p, q, s));
      mesh.setColorAt(i, c.set(b.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [books, depth]);
  const [bookMaterial] = useState(() => new MeshStandardMaterial({ roughness: 0.6 }));
  return (
    <group>
      <mesh
        geometry={frame}
        material={vertexColorMaterial({ roughness: 0.6 })}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={ref}
        args={[box(0.038, 0.26, 0.2), bookMaterial, books.length]}
        castShadow
      />
    </group>
  );
}
