import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import {
  Color,
  InstancedBufferAttribute,
  type InstancedMesh,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { cachedTexture, liveCanvasTexture } from '../lib/canvas';
import { liveTones } from '../scenePalette';
import { type ParticleKind, useLiveRuntime } from './liveRuntime';

/**
 * Pooled feedback sprites (docs/04 §9, docs/05 §6): hearts for delight, steam and a dust puff for
 * angry exits, sparkles for restocks, coins on a sale. One instanced, camera-facing quad mesh for
 * all of them (a single draw call); requests come in through `runtime.particles`. Reduced motion
 * turns them off entirely (the bubbles and the +$ float still say what happened).
 */
const POOL = 96;
const CELLS: Record<ParticleKind, number> = { heart: 0, dust: 1, steam: 1, sparkle: 2, coin: 3 };

interface KindSpec {
  life: number;
  size: [number, number];
  color: string;
  /** Initial velocity: outward spread, upward speed. */
  spread: number;
  rise: number;
  gravity: number;
  drag: number;
}

const SPEC: Record<ParticleKind, KindSpec> = {
  heart: {
    life: 1.3,
    size: [0.11, 0.17],
    color: liveTones.heart,
    spread: 0.35,
    rise: 0.75,
    gravity: 0,
    drag: 1.6,
  },
  dust: {
    life: 0.75,
    size: [0.14, 0.34],
    color: liveTones.dust,
    spread: 1.1,
    rise: 0.25,
    gravity: 0,
    drag: 3.2,
  },
  steam: {
    life: 0.9,
    size: [0.07, 0.2],
    color: liveTones.steam,
    spread: 0.25,
    rise: 0.7,
    gravity: 0,
    drag: 1.2,
  },
  sparkle: {
    life: 0.95,
    size: [0.05, 0.11],
    color: liveTones.sparkle,
    spread: 0.35,
    rise: 0.35,
    gravity: 0,
    drag: 2,
  },
  coin: {
    life: 0.85,
    size: [0.07, 0.08],
    color: liveTones.coin,
    spread: 0.55,
    rise: 1.9,
    gravity: 5.2,
    drag: 0.6,
  },
};

/** Sprite atlas: heart, soft puff, four-point sparkle, coin (white shapes, tinted per kind). */
function spriteTexture() {
  return cachedTexture('live-sprites', () =>
    liveCanvasTexture(512, 128, (ctx) => {
      const cell = 128;
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = '#FFFFFF';
      // Heart.
      ctx.save();
      ctx.translate(64, 70);
      ctx.beginPath();
      ctx.moveTo(0, 38);
      ctx.bezierCurveTo(-52, 4, -44, -42, 0, -18);
      ctx.bezierCurveTo(44, -42, 52, 4, 0, 38);
      ctx.fill();
      ctx.restore();
      // Soft puff.
      const puff = ctx.createRadialGradient(cell * 1.5, 64, 4, cell * 1.5, 64, 58);
      puff.addColorStop(0, 'rgba(255,255,255,1)');
      puff.addColorStop(0.55, 'rgba(255,255,255,0.75)');
      puff.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = puff;
      ctx.fillRect(cell, 0, cell, cell);
      // Sparkle.
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? 58 : 13;
        const a = -Math.PI / 2 + (i * Math.PI) / 4;
        ctx.lineTo(cell * 2.5 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      // Coin: disc with a darker rim and a shine.
      ctx.beginPath();
      ctx.arc(cell * 3.5, 64, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,110,20,0.9)';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(150,110,20,0.6)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cell * 3.5, 64, 30, 0, Math.PI * 2);
      ctx.stroke();
    }),
  );
}

const vertexShader = /* glsl */ `
attribute vec4 aSprite; // cell, alpha, rotation, size
attribute vec3 aTint;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vTint;
void main() {
  vec4 mv = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
  float c = cos(aSprite.z);
  float s = sin(aSprite.z);
  mv.xy += vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aSprite.w;
  gl_Position = projectionMatrix * mv;
  vUv = vec2((uv.x + aSprite.x) * 0.25, uv.y);
  vAlpha = aSprite.y;
  vTint = aTint;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vTint;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(t.rgb * vTint, a);
  #include <colorspace_fragment>
}
`;

interface Particle {
  kind: ParticleKind;
  alive: boolean;
  age: number;
  life: number;
  position: Vector3;
  velocity: Vector3;
  size: number;
  spin: number;
  rotation: number;
}

const tmpMatrix = new Matrix4();
const tmpColor = new Color();

export function LiveParticles() {
  const live = useLiveRuntime();
  const meshRef = useRef<InstancedMesh>(null);
  const [pool] = useState<Particle[]>(() =>
    Array.from({ length: POOL }, () => ({
      kind: 'sparkle' as ParticleKind,
      alive: false,
      age: 0,
      life: 1,
      position: new Vector3(),
      velocity: new Vector3(),
      size: 0.1,
      spin: 0,
      rotation: 0,
    })),
  );
  const [geometry] = useState(() => {
    const g = new PlaneGeometry(1, 1);
    g.setAttribute('aSprite', new InstancedBufferAttribute(new Float32Array(POOL * 4), 4));
    g.setAttribute('aTint', new InstancedBufferAttribute(new Float32Array(POOL * 3), 3));
    return g;
  });
  const [material] = useState(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uMap: { value: spriteTexture() } },
        transparent: true,
        depthWrite: false,
      }),
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const cursor = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const mesh = meshRef.current;
    if (!mesh) return;
    // Spawn requests (dropped entirely for reduced motion).
    const requests = live.particles;
    if (requests.length > 0) {
      if (!live.reducedMotion) {
        for (const request of requests) {
          const spec = SPEC[request.kind];
          const spread = request.spread ?? 0.2;
          for (let i = 0; i < request.count; i++) {
            const p = pool[cursor.current % POOL];
            cursor.current += 1;
            if (!p) continue;
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * spread;
            p.kind = request.kind;
            p.alive = true;
            p.age = -i * (request.kind === 'steam' ? 0.12 : 0.03);
            p.life = spec.life * (0.8 + Math.random() * 0.4);
            p.position.set(
              request.position.x + Math.cos(angle) * radius * 0.4,
              request.position.y + Math.random() * 0.05,
              request.position.z + Math.sin(angle) * radius * 0.4,
            );
            p.velocity.set(
              Math.cos(angle) * spec.spread * (0.4 + Math.random() * 0.6),
              spec.rise * (0.6 + Math.random() * 0.6),
              Math.sin(angle) * spec.spread * (0.4 + Math.random() * 0.6),
            );
            p.size = spec.size[0];
            p.rotation =
              request.kind === 'heart' ? (Math.random() - 0.5) * 0.5 : Math.random() * 6.28;
            p.spin =
              request.kind === 'sparkle'
                ? 3
                : request.kind === 'coin'
                  ? 0
                  : (Math.random() - 0.5) * 1.5;
          }
        }
      }
      requests.length = 0;
    }
    const sprite = geometry.getAttribute('aSprite') as InstancedBufferAttribute;
    const tint = geometry.getAttribute('aTint') as InstancedBufferAttribute;
    let count = 0;
    for (const p of pool) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age >= p.life) {
        p.alive = false;
        continue;
      }
      const spec = SPEC[p.kind];
      const t = p.age / p.life;
      p.velocity.multiplyScalar(Math.exp(-spec.drag * dt));
      p.velocity.y -= spec.gravity * dt;
      p.position.addScaledVector(p.velocity, dt);
      if (p.kind === 'heart') p.position.x += Math.sin(p.age * 6 + p.rotation * 10) * 0.12 * dt;
      p.rotation += p.spin * dt;
      const grow = spec.size[0] + (spec.size[1] - spec.size[0]) * Math.min(1, t * 1.6);
      const twinkle = p.kind === 'sparkle' ? 0.65 + 0.35 * Math.sin(p.age * 22) : 1;
      // Pop in fast, fade out over the last 40 %.
      const alpha = Math.min(1, t * 8) * Math.min(1, (1 - t) / 0.4);
      tmpMatrix.makeTranslation(p.position.x, p.position.y, p.position.z);
      mesh.setMatrixAt(count, tmpMatrix);
      sprite.setXYZW(count, CELLS[p.kind], alpha, p.rotation, grow * twinkle);
      tmpColor.set(spec.color);
      tint.setXYZ(count, tmpColor.r, tmpColor.g, tmpColor.b);
      count += 1;
    }
    mesh.count = count;
    mesh.visible = count > 0;
    if (count > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      sprite.needsUpdate = true;
      tint.needsUpdate = true;
    }
  }, -2);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, POOL]}
      frustumCulled={false}
      renderOrder={20}
      visible={false}
    />
  );
}
