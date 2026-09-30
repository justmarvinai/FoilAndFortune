import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import {
  type Group,
  type InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { BlobShadow } from '../lib/blobShadow';
import { cachedTexture, liveCanvasTexture } from '../lib/canvas';
import { clamp, easeOutBack, lerp } from '../lib/easing';
import { cylinder, lathe, plane, roundedBox, sphere } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { useDioramaRuntime } from '../runtime';
import { tones } from '../scenePalette';

/**
 * Register counter (docs/01 §7.3) with a chunky retro cash register, card reader and a candy
 * jar. The register reacts to sales: the drawer shoots out with a bounce and coins pop.
 *
 * Local frame: origin on the floor at the counter's centre; customers stand on the +z side,
 * the shopkeeper on the -z side.
 */
export interface CounterProps {
  width?: number;
  height?: number;
  depth?: number;
  bodyColor?: string;
  panelColor?: string;
  topColor?: string;
}

function registerScreenTexture() {
  return cachedTexture('register-screen', () =>
    liveCanvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = '#10302C';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#7CFFB2';
      ctx.font = '700 38px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('4.99', w / 2, h / 2 + 2);
    }),
  );
}

const rotX = (p: readonly [number, number, number], a: number): [number, number, number] => [
  p[0],
  p[1] * Math.cos(a) - p[2] * Math.sin(a),
  p[1] * Math.sin(a) + p[2] * Math.cos(a),
];

function CashRegister() {
  const runtime = useDioramaRuntime();
  const drawerRef = useRef<Group>(null);
  const coinsRef = useRef<InstancedMesh>(null);
  const tilt = -0.32;
  const body = cachedMerge('register', () => {
    const shell = tones.coral;
    const dark = '#C94B38';
    const keypadCenter: [number, number, number] = [0, 0.16, -0.05];
    const parts: Part[] = [
      { geometry: roundedBox(0.46, 0.08, 0.38, 0.03, 2), color: dark, position: [0, 0.04, 0] },
      { geometry: roundedBox(0.44, 0.1, 0.3, 0.035, 3), color: shell, position: [0, 0.12, 0.03] },
      {
        geometry: roundedBox(0.42, 0.1, 0.24, 0.04, 3),
        color: shell,
        position: keypadCenter,
        rotation: [tilt, 0, 0],
      },
      // Customer-facing display tower.
      {
        geometry: cylinder(0.022, 0.028, 0.14, 12),
        color: tones.iron,
        position: [0.08, 0.24, 0.12],
      },
      {
        geometry: roundedBox(0.19, 0.1, 0.07, 0.025, 2),
        color: shell,
        position: [0.08, 0.34, 0.12],
      },
      // Receipt roll and paper tongue.
      {
        geometry: cylinder(0.04, 0.04, 0.09, 14),
        color: '#FFFFFF',
        position: [-0.25, 0.14, 0.02],
        rotation: [0, 0, Math.PI / 2],
      },
      {
        geometry: roundedBox(0.07, 0.005, 0.12, 0.002, 1),
        color: '#FFFDF6',
        position: [-0.25, 0.19, 0.1],
        rotation: [0.5, 0, 0],
      },
    ];
    // Keys sit on the slanted keypad: lay them out in its frame, then rotate into place.
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const local: [number, number, number] = [-0.13 + col * 0.085, 0.055, -0.07 + row * 0.07];
        const [x, y, z] = rotX(local, tilt);
        const special = row === 0 && col === 3;
        parts.push({
          geometry: cylinder(0.026, 0.028, 0.03, 12),
          color: special ? tones.sun : row === 2 ? tones.teal : tones.trim,
          position: [x + keypadCenter[0], y + keypadCenter[1], z + keypadCenter[2]],
          rotation: [tilt, 0, 0],
        });
      }
    }
    return parts;
  });
  const drawer = cachedMerge('register-drawer', () => [
    { geometry: roundedBox(0.4, 0.06, 0.3, 0.02, 2), color: '#E8604A', position: [0, 0, 0] },
    {
      geometry: roundedBox(0.12, 0.02, 0.02, 0.008, 1),
      color: tones.brass,
      position: [0, 0, -0.155],
    },
  ]);
  const [screen] = useState(
    () =>
      new MeshStandardMaterial({
        map: registerScreenTexture(),
        emissive: '#FFFFFF',
        emissiveMap: registerScreenTexture(),
        emissiveIntensity: 0.6,
        roughness: 0.3,
      }),
  );
  const [coinMaterial] = useState(
    () =>
      new MeshStandardMaterial({
        color: tones.sun,
        metalness: 0.85,
        roughness: 0.25,
        emissive: '#7A5200',
        emissiveIntensity: 0.25,
      }),
  );
  const anim = useRef({ lastSales: 0, since: 10 });
  const [tmp] = useState(() => ({
    m: new Matrix4(),
    p: new Vector3(),
    q: new Quaternion(),
    s: new Vector3(),
  }));

  useFrame((_, delta) => {
    const a = anim.current;
    if (runtime.register.sales !== a.lastSales) {
      a.lastSales = runtime.register.sales;
      a.since = 0;
    }
    a.since += Math.min(delta, 0.1);
    // Drawer: shoots out towards the shopkeeper, lingers, slides back.
    const out =
      a.since < 0.35
        ? easeOutBack(a.since / 0.35, 2.4)
        : a.since < 1.6
          ? 1
          : 1 - clamp((a.since - 1.6) / 0.4, 0, 1);
    if (drawerRef.current) drawerRef.current.position.z = -out * 0.17;
    screen.emissiveIntensity = lerp(0.5, 2.2, runtime.evening) + (a.since < 1.6 ? 0.8 : 0);
    const coins = coinsRef.current;
    if (coins) {
      const t = a.since;
      for (let i = 0; i < 5; i++) {
        const life = clamp((t - i * 0.05) / 0.85, 0, 1);
        const angle = i * 1.26 + 0.4;
        const r = life * 0.28;
        const y = 0.3 + Math.sin(life * Math.PI) * 0.35;
        const s = life > 0 && life < 1 ? 1 - life * 0.6 : 0.0001;
        tmp.p.set(Math.cos(angle) * r, y, Math.sin(angle) * r * 0.6);
        tmp.q.setFromAxisAngle(tmp.s.set(1, 0.4, 0).normalize(), t * 14 + i);
        tmp.s.setScalar(s);
        coins.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      }
      coins.instanceMatrix.needsUpdate = true;
      coins.visible = t < 1.2;
    }
  });

  return (
    <group>
      <mesh geometry={body} material={vertexColorMaterial({ roughness: 0.42 })} castShadow />
      <group ref={drawerRef} position={[0, 0.045, 0]}>
        <mesh geometry={drawer} material={vertexColorMaterial({ roughness: 0.42 })} />
      </group>
      <mesh geometry={plane(0.16, 0.07)} material={screen} position={[0.08, 0.34, 0.157]} />
      <instancedMesh
        ref={coinsRef}
        args={[cylinder(0.035, 0.035, 0.012, 14), coinMaterial, 5]}
        frustumCulled={false}
      />
    </group>
  );
}

function CandyJar() {
  const [glass] = useState(
    () =>
      new MeshStandardMaterial({
        color: '#DDF3FF',
        transparent: true,
        opacity: 0.32,
        roughness: 0.06,
        metalness: 0,
        envMapIntensity: 1.6,
        depthWrite: false,
      }),
  );
  const candy = cachedMerge('candy', () => {
    const colors = [tones.coral, tones.sun, tones.mint, tones.sky, tones.grape, '#FF8BD1'];
    const parts: Part[] = [];
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4;
      const r = 0.035 + (i % 3) * 0.015;
      parts.push({
        geometry: sphere(0.022, 8, 6),
        color: colors[i % colors.length] ?? tones.coral,
        position: [Math.cos(a) * r, 0.03 + Math.floor(i / 6) * 0.035, Math.sin(a) * r],
      });
    }
    parts.push({
      geometry: cylinder(0.075, 0.075, 0.03, 18),
      color: tones.coral,
      position: [0, 0.2, 0],
    });
    return parts;
  });
  return (
    <group>
      <mesh geometry={candy} material={vertexColorMaterial({ roughness: 0.3 })} />
      <mesh
        geometry={lathe(
          'candy-jar',
          [
            [0.001, 0],
            [0.07, 0.005],
            [0.085, 0.05],
            [0.085, 0.15],
            [0.07, 0.185],
            [0.001, 0.19],
          ],
          20,
        )}
        material={glass}
        renderOrder={3}
      />
    </group>
  );
}

export function Counter({
  width = 1.9,
  height = 0.74,
  depth = 0.62,
  bodyColor = tones.wood,
  panelColor = tones.teal,
  topColor = tones.maple,
}: CounterProps) {
  const geometry = cachedMerge(
    `counter:${width}:${height}:${depth}:${bodyColor}:${panelColor}:${topColor}`,
    () => {
      const bodyH = height - 0.15;
      const parts: Part[] = [
        {
          geometry: roundedBox(width - 0.1, 0.09, depth - 0.12, 0.02, 2),
          color: tones.woodDark,
          position: [0, 0.045, 0],
        },
        {
          geometry: roundedBox(width - 0.04, bodyH, depth - 0.06, 0.035, 3),
          color: bodyColor,
          position: [0, 0.08 + bodyH / 2, 0],
        },
        {
          geometry: roundedBox(width + 0.08, 0.075, depth + 0.06, 0.035, 3),
          color: topColor,
          position: [0, height - 0.037, 0.01],
        },
        {
          geometry: roundedBox(width - 0.02, 0.04, depth - 0.04, 0.015, 2),
          color: tones.trim,
          position: [0, height - 0.09, 0],
        },
      ];
      // Two raised panels on the customer side, with a cream frame.
      const panelW = (width - 0.28) / 2;
      for (const side of [-1, 1]) {
        const x = side * (panelW / 2 + 0.05);
        parts.push(
          {
            geometry: roundedBox(panelW + 0.06, bodyH - 0.12, 0.02, 0.012, 2),
            color: tones.trim,
            position: [x, 0.08 + bodyH / 2, depth / 2 - 0.025],
          },
          {
            geometry: roundedBox(panelW, bodyH - 0.18, 0.03, 0.02, 2),
            color: panelColor,
            position: [x, 0.08 + bodyH / 2, depth / 2 - 0.018],
          },
        );
      }
      // Shopkeeper side: open cubbies with paper bags.
      parts.push({
        geometry: roundedBox(width - 0.2, bodyH - 0.2, 0.02, 0.01, 1),
        color: tones.walnut,
        position: [0, 0.08 + bodyH / 2, -depth / 2 + 0.02],
      });
      for (let i = 0; i < 3; i++) {
        parts.push({
          geometry: roundedBox(0.16, 0.22, 0.1, 0.01, 1),
          color: i === 1 ? '#E9D6B6' : '#D8BE94',
          position: [-width / 2 + 0.35 + i * 0.2, 0.08 + 0.13, -depth / 2 + 0.04],
        });
      }
      // Card reader + a little stand of business cards on top.
      parts.push(
        {
          geometry: roundedBox(0.09, 0.03, 0.14, 0.012, 2),
          color: '#2B2F45',
          position: [0.16, height + 0.015, 0.12],
          rotation: [0.25, -0.3, 0],
        },
        {
          geometry: roundedBox(0.06, 0.004, 0.05, 0.002, 1),
          color: '#7FF6FF',
          position: [0.157, height + 0.034, 0.1],
          rotation: [0.25, -0.3, 0],
        },
        {
          geometry: roundedBox(0.1, 0.05, 0.05, 0.01, 1),
          color: tones.walnut,
          position: [0.42, height + 0.025, 0.15],
        },
        {
          geometry: roundedBox(0.09, 0.05, 0.004, 0.002, 1),
          color: '#FFFFFF',
          position: [0.42, height + 0.07, 0.15],
          rotation: [-0.2, 0, 0],
        },
        // A tiny cactus in a pot, because every counter needs one.
        {
          geometry: cylinder(0.045, 0.035, 0.07, 14),
          color: tones.terracotta,
          position: [0.78, height + 0.035, -0.16],
        },
        {
          geometry: sphere(0.04, 12, 10),
          color: tones.leaf,
          position: [0.78, height + 0.1, -0.16],
          scale: [1, 1.5, 1],
        },
        {
          geometry: sphere(0.018, 8, 6),
          color: '#FF8BD1',
          position: [0.78, height + 0.165, -0.16],
        },
      );
      return parts;
    },
  );
  return (
    <group>
      <BlobShadow radius={width * 0.62} stretch={[1, 0.45]} opacity={0.4} />
      <mesh
        geometry={geometry}
        material={vertexColorMaterial({ roughness: 0.55 })}
        castShadow
        receiveShadow
      />
      <group position={[-0.36, height, -0.02]}>
        <CashRegister />
      </group>
      <group position={[0.66, height, 0.02]}>
        <CandyJar />
      </group>
    </group>
  );
}
