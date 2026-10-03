import { useFrame } from '@react-three/fiber';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Color,
  type ColorRepresentation,
  CustomBlending,
  DoubleSide,
  type Group,
  type Mesh,
  MeshLambertMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  type Vector3,
} from 'three';
import { useBlobMaterial } from '../lib/blobShadow';
import { angleDelta, clamp, damp, type SpringState, springStep } from '../lib/easing';
import {
  capsule,
  circle,
  cylinder,
  cylinderSector,
  roundedBox,
  sphere,
  sphereSection,
  torus,
} from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import type { Part } from '../lib/merge';
import { createRng, randRange } from '../lib/rng';
import { useDioramaRuntime } from '../runtime';
import { canBlink, type Expression, FACE_SECTION, faceAtlasTexture, setFaceCell } from './faces';
import type { PegLook } from './looks';
import { computePose, POSE_KEYS, type Pose, type PoseMode, restPose } from './motion';
import { pegGeometry, releasePegGeometry, retainPegGeometry } from './pegGeometry';

/**
 * Peg-folk: procedural chibi toy people (docs/04 §4.4). Capsule body, big squashed sphere head
 * (~45 % of height), stubby limbs with mitten nubs, a canvas face decal with swappable
 * expressions. Static parts are baked per look into a few vertex-coloured meshes, so a character
 * costs ~9 draw calls. All animation is procedural and runs in `useFrame` from a mutable
 * `AgentMotion` object owned by the controller (customer script, owner, later the sim bridge).
 */

/** Mutable animation input; controllers write it, `PegFolk` reads it every frame. */
export interface AgentMotion {
  mode: PoseMode;
  /** Scene time when `mode` last changed. */
  modeStartedAt: number;
  walkPhase: number;
  seed: number;
  expression: Expression;
  /** Extra head yaw (radians) to look at someone. */
  lookYaw: number;
  /** Shows whatever was passed as `heldItem` in the right mitten. */
  holding: boolean;
  /** World yaw of the body (written by the controller), for the camera glance. */
  bodyYaw: number;
}

export function createAgentMotion(seed: number, expression: Expression = 'neutral'): AgentMotion {
  return {
    mode: 'idle',
    modeStartedAt: 0,
    walkPhase: 0,
    seed,
    expression,
    lookYaw: 0,
    holding: false,
    bodyYaw: 0,
  };
}

/** Changes mode and restarts its clock (no-op if unchanged, so it's safe to call every frame). */
export function setMotionMode(motion: AgentMotion, mode: PoseMode, now: number): void {
  if (motion.mode === mode) return;
  motion.mode = mode;
  motion.modeStartedAt = now;
}

// Proportions at scale 1 (≈ 1.1 m tall). Head radius 0.25 → head ≈ 45 % of the height.
const HIP_Y = 0.25;
const TORSO_R = 0.19;
const TORSO_H = 0.46;
const TORSO_CY = 0.2; // torso centre above the hip pivot
const SHOULDER_Y = 0.35;
const SHOULDER_X = 0.2;
const NECK_Y = 0.43;
const HEAD_R = 0.25;
const HEAD_CY = 0.2; // head centre above the neck pivot
const HEAD_SCALE: [number, number, number] = [1, 0.93, 0.97];
const LEG_X = 0.085;

function shade(color: ColorRepresentation, amount: number): string {
  // Darken towards ink for pockets, flaps and seams (keeps the palette coherent).
  return `#${new Color(color).lerp(new Color('#1E2340'), amount).getHexString()}`;
}

function torsoParts(look: PegLook): Part[] {
  const { top, bottom } = look;
  const waist = -0.07;
  const pocket = shade(top.color, 0.18);
  const colorAt = (x: number, y: number, z: number): ColorRepresentation => {
    switch (top.style) {
      case 'apron':
        if (z > 0.03 && y < 0.17) return top.accent;
        if (y > -0.055 && y < -0.02) return top.accent; // apron strings round the waist
        return y < waist ? bottom : top.color;
      case 'vest': {
        if (y < waist) return bottom;
        const opening = 0.025 + Math.max(0, y + 0.05) * 0.4;
        return z > 0 && Math.abs(x) < opening ? top.color : top.accent;
      }
      case 'hoodie':
        if (y < waist) return bottom;
        if (z > 0.12 && y > -0.06 && y < 0.04 && Math.abs(x) < 0.11) return pocket;
        return top.color;
      case 'tee':
        if (y < waist) return bottom;
        return y > 0.02 && y < 0.07 ? top.accent : top.color;
    }
  };
  const parts: Part[] = [
    { geometry: capsule(TORSO_R, TORSO_H, 8, 20, 6), color: colorAt, position: [0, TORSO_CY, 0] },
  ];
  if (top.style === 'hoodie') {
    parts.push({
      geometry: torus(0.12, 0.055, 10, 24),
      color: top.color,
      position: [0, TORSO_CY + 0.19, -0.1],
      rotation: [-1.05, 0, 0],
    });
    for (const side of [-1, 1]) {
      parts.push({
        geometry: capsule(0.012, 0.09, 3, 6),
        color: top.accent,
        position: [side * 0.045, TORSO_CY + 0.11, 0.18],
        rotation: [0.25, 0, 0],
      });
    }
  }
  const { backpack, tote } = look.accessories;
  if (backpack) {
    const dark = shade(backpack, 0.25);
    parts.push(
      {
        geometry: roundedBox(0.28, 0.3, 0.14, 0.05),
        color: backpack,
        position: [0, TORSO_CY + 0.02, -0.22],
      },
      {
        geometry: roundedBox(0.27, 0.11, 0.155, 0.045),
        color: dark,
        position: [0, TORSO_CY + 0.13, -0.22],
      },
      {
        geometry: roundedBox(0.17, 0.1, 0.05, 0.02),
        color: dark,
        position: [0, TORSO_CY - 0.05, -0.31],
      },
    );
    for (const side of [-1, 1]) {
      parts.push({
        geometry: roundedBox(0.05, 0.24, 0.035, 0.015),
        color: dark,
        position: [side * 0.1, TORSO_CY + 0.07, 0.172],
        rotation: [-0.12, 0, 0],
      });
    }
  }
  if (tote) {
    parts.push(
      {
        geometry: roundedBox(0.2, 0.22, 0.06, 0.03),
        color: tote,
        position: [-0.27, TORSO_CY - 0.12, 0.02],
      },
      {
        geometry: torus(0.14, 0.012, 6, 20, Math.PI),
        color: shade(tote, 0.2),
        position: [-0.27, TORSO_CY - 0.02, 0.02],
        rotation: [0, Math.PI / 2, 0],
      },
    );
  }
  return parts;
}

function hairParts(look: PegLook): Part[] {
  const { style, color } = look.hair;
  // Under a cap only the hair below the cap line shows; skip the crown so nothing pokes through.
  const capped = look.accessories.cap !== undefined;
  const r = HEAD_R;
  const cap = (scale: number, thetaEnd: number): Part => ({
    geometry: sphereSection(r * scale, 0, Math.PI * 2, 0, thetaEnd, 28, 12),
    color,
  });
  // The back half reaches lower than the fringe, framing the face like a helmet of hair.
  const back = (scale: number, thetaEnd: number): Part => ({
    geometry: sphereSection(r * scale, Math.PI, Math.PI, 0, thetaEnd, 20, 14),
    color,
  });
  switch (style) {
    case 'bob':
      return [
        cap(1.07, Math.PI * 0.37),
        back(1.07, Math.PI * 0.7),
        ...[-1, 1].map<Part>((side) => ({
          geometry: capsule(0.075, 0.24, 5, 12),
          color,
          position: [side * 0.225, -0.05, 0.02],
          rotation: [0, 0, side * 0.12],
        })),
      ];
    case 'spiky': {
      const parts: Part[] = [cap(1.05, Math.PI * 0.36), back(1.05, Math.PI * 0.56)];
      const rng = createRng(7);
      for (let i = 0; i < 8; i++) {
        const phi = (i / 8) * Math.PI * 2 + 0.3;
        const theta = randRange(rng, 0.18, 0.42);
        const dir: [number, number, number] = [
          Math.sin(theta) * Math.cos(phi),
          Math.cos(theta),
          Math.sin(theta) * Math.sin(phi) * (Math.sin(phi) > 0 ? 0.6 : 1),
        ];
        parts.push({
          geometry: cylinder(0.0, 0.07, 0.16, 8),
          color,
          position: [dir[0] * r * 1.02, dir[1] * r * 1.02, dir[2] * r * 1.02],
          rotation: [Math.atan2(dir[2], dir[1]), 0, -Math.atan2(dir[0], dir[1])],
        });
      }
      return parts;
    }
    case 'bun':
      return [
        cap(1.045, Math.PI * 0.36),
        back(1.045, Math.PI * 0.62),
        { geometry: sphere(0.105, 16, 12), color, position: [0, r * 0.86, -r * 0.42] },
        {
          geometry: torus(0.07, 0.02, 8, 18),
          color: shade(color, 0.35),
          position: [0, r * 0.74, -r * 0.34],
          rotation: [-0.9, 0, 0],
        },
      ];
    case 'ponytail':
      return [
        cap(1.05, Math.PI * 0.36),
        back(1.05, Math.PI * 0.6),
        { geometry: sphere(0.045, 10, 8), color: '#FF6F59', position: [0, r * 0.35, -r * 1.02] },
        {
          geometry: capsule(0.068, 0.32, 5, 12),
          color,
          position: [0, r * 0.02, -r * 1.2],
          rotation: [0.42, 0, 0],
        },
      ];
    case 'curls': {
      const parts: Part[] = [cap(1.02, Math.PI * 0.35), back(1.02, Math.PI * 0.6)];
      // Golden-angle spiral of little curls over the crown and back of the head.
      const count = 30;
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const theta = Math.acos(1 - t * 1.3);
        const phi = i * 2.39996;
        const front = Math.sin(phi) > 0.3;
        if (front && theta > Math.PI * 0.3) continue; // keep the face clear
        if (capped && theta < Math.PI * 0.3) continue;
        const dist = r * 1.03;
        parts.push({
          geometry: sphere(0.05, 10, 8),
          color,
          position: [
            Math.sin(theta) * Math.cos(phi) * dist,
            Math.cos(theta) * dist,
            Math.sin(theta) * Math.sin(phi) * dist,
          ],
        });
      }
      return parts;
    }
    case 'buzz':
      return [cap(1.02, Math.PI * 0.4), back(1.02, Math.PI * 0.55)];
  }
}

function headwearParts(look: PegLook): Part[] {
  const parts: Part[] = hairParts(look);
  const { cap, glasses, headphones } = look.accessories;
  const r = HEAD_R;
  if (cap) {
    parts.push(
      { geometry: sphereSection(r * 1.1, 0, Math.PI * 2, 0, Math.PI * 0.33, 28, 10), color: cap },
      {
        geometry: torus(r * 1.08 * Math.sin(Math.PI * 0.33), 0.018, 6, 28),
        color: shade(cap, 0.2),
        position: [0, r * 1.08 * Math.cos(Math.PI * 0.33), 0],
        rotation: [Math.PI / 2, 0, 0],
      },
      // Worn backwards, kid-style: a forward brim would hide the eyes from the high camera.
      {
        geometry: cylinderSector(0.17, 0.022, Math.PI / 2, Math.PI, 20),
        color: cap,
        position: [0, r * 0.5, -r * 0.62],
        rotation: [-0.25, 0, 0],
      },
      { geometry: sphere(0.025, 8, 6), color: shade(cap, 0.2), position: [0, r * 1.1, 0] },
      // A round badge on the front of the cap.
      {
        geometry: cylinder(0.055, 0.055, 0.02, 16),
        color: '#FF6F59',
        position: [0, r * 0.82, r * 0.72],
        rotation: [Math.PI / 2 - 0.85, 0, 0],
      },
    );
  }
  if (headphones) {
    parts.push({ geometry: torus(r * 1.12, 0.022, 8, 28, Math.PI), color: headphones });
    for (const side of [-1, 1]) {
      parts.push({
        geometry: cylinder(0.075, 0.075, 0.07, 18),
        color: shade(headphones, 0.1),
        position: [side * r * 1.05, 0, 0],
        rotation: [0, 0, Math.PI / 2],
      });
    }
  }
  if (glasses) {
    // Eye centres from the face atlas layout: ±20° across, ~5° below the equator.
    const yaw = 0.4;
    const tilt = -0.02;
    const d = r + 0.02;
    for (const side of [-1, 1]) {
      parts.push({
        geometry: torus(0.056, 0.01, 8, 24),
        color: glasses,
        position: [side * Math.sin(yaw) * d, -Math.sin(tilt) * d, Math.cos(yaw) * d],
        rotation: [0, side * yaw, 0],
      });
      parts.push({
        geometry: roundedBox(0.012, 0.012, 0.16, 0.005),
        color: glasses,
        position: [side * 0.2, -0.02, 0.1],
        rotation: [0, side * 0.45, 0],
      });
    }
    parts.push({
      geometry: capsule(0.008, 0.07, 3, 6),
      color: glasses,
      position: [0, -0.015, d * 1.01],
      rotation: [0, 0, Math.PI / 2],
    });
  }
  return parts;
}

/**
 * Cache keys per baked part. Each key holds only what shapes or colours that part, so looks that
 * differ elsewhere (say, hair) still share their bodies, arms and legs.
 */
function lookKeys(look: PegLook) {
  const { accessories: a } = look;
  return {
    body: `peg-body:${JSON.stringify([look.top, look.bottom, a.backpack ?? null, a.tote ?? null])}`,
    head: `peg-head:${look.skin}`,
    headwear: `peg-headwear:${JSON.stringify([look.hair, a.cap ?? null, a.glasses ?? null, a.headphones ?? null])}`,
    arm: `peg-arm:${look.top.color}:${look.skin}`,
    leg: `peg-leg:${look.bottom}:${look.shoes}`,
  };
}

/** Baked geometries for a look (shared and reference-counted, see pegGeometry.ts). */
function lookGeometries(look: PegLook, keys: ReturnType<typeof lookKeys>) {
  const skin = look.skin;
  return {
    body: pegGeometry(keys.body, () => torsoParts(look)),
    head: pegGeometry(keys.head, () => [
      { geometry: sphere(HEAD_R, 32, 24), color: skin },
      {
        geometry: sphere(0.055, 12, 10),
        color: skin,
        position: [HEAD_R * 0.96, -0.01, 0],
        scale: [0.6, 1, 1],
      },
      {
        geometry: sphere(0.055, 12, 10),
        color: skin,
        position: [-HEAD_R * 0.96, -0.01, 0],
        scale: [0.6, 1, 1],
      },
    ]),
    headwear: pegGeometry(keys.headwear, () => headwearParts(look)),
    arm: pegGeometry(keys.arm, () => [
      { geometry: capsule(0.058, 0.22, 5, 12), color: look.top.color, position: [0, -0.09, 0] },
      { geometry: sphere(0.07, 14, 10), color: skin, position: [0, -0.2, 0.005] },
    ]),
    leg: pegGeometry(keys.leg, () => [
      { geometry: capsule(0.066, 0.24, 5, 12), color: look.bottom, position: [0, -0.1, 0] },
      {
        geometry: sphere(0.08, 16, 10),
        color: look.shoes,
        position: [0, -0.2, 0.028],
        scale: [1, 0.62, 1.38],
      },
    ]),
  };
}

interface PegFolkProps {
  look: PegLook;
  motion: AgentMotion;
  castShadow?: boolean;
  /**
   * Whether arms and legs cast shadows too. A crowd can drop them: the torso and head carry the
   * silhouette, and each limb costs a shadow-pass draw call per character.
   */
  limbShadows?: boolean;
  /** Written every frame with a world position just above the head (for intent bubbles). */
  headAnchor?: Vector3;
  /** Rendered in the right mitten while `motion.holding` is true. */
  heldItem?: ReactNode;
}

/** How strongly each pose turns the head towards the camera (0 = not at all). */
const CAMERA_GLANCE: Partial<Record<PoseMode, number>> = {
  idle: 0.6,
  wait: 0.55,
  cheer: 0.7,
  lookAround: 0.25,
  dig: 0.35,
};

const HEAD_PULSE_STIFFNESS = 520;
const HEAD_PULSE_DAMPING = 16;

export function PegFolk({
  look,
  motion,
  castShadow = true,
  limbShadows = true,
  headAnchor,
  heldItem,
}: PegFolkProps) {
  const runtime = useDioramaRuntime();
  const keys = lookKeys(look);
  const geometries = lookGeometries(look, keys);
  const keyList = `${keys.body}|${keys.head}|${keys.headwear}|${keys.arm}|${keys.leg}`;
  useEffect(() => {
    const held = keyList.split('|');
    retainPegGeometry(held);
    return () => releasePegGeometry(held);
  }, [keyList]);
  const limbShadow = castShadow && limbShadows;

  const bodyMaterial = vertexColorMaterial({ roughness: 0.66 });
  const [hairMaterial] = useState(() => {
    const m = vertexColorMaterial({ roughness: 0.72 }).clone();
    // Hair shells are open at the bottom; render their inside in hair colour too.
    m.side = DoubleSide;
    return m;
  });
  const skinMaterial = vertexColorMaterial({ roughness: 0.55 });

  const [faceTexture] = useState(() => {
    const t = faceAtlasTexture().clone();
    t.needsUpdate = true;
    return t;
  });
  const faceMaterial = useMemo(
    () =>
      new MeshLambertMaterial({
        map: faceTexture,
        transparent: true,
        depthWrite: false,
        // The atlas is premultiplied (soft blush without dark fringes), so blend accordingly.
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcAlphaFactor,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: OneMinusSrcAlphaFactor,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [faceTexture],
  );
  useEffect(
    () => () => {
      faceMaterial.dispose();
      faceTexture.dispose();
      hairMaterial.dispose();
    },
    [faceMaterial, faceTexture, hairMaterial],
  );

  const blobMaterial = useBlobMaterial(0.32);

  const hopRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const headShapeRef = useRef<Group>(null);
  const armLRef = useRef<Group>(null);
  const armRRef = useRef<Group>(null);
  const legLRef = useRef<Group>(null);
  const legRRef = useRef<Group>(null);
  const heldRef = useRef<Group>(null);
  const blobRef = useRef<Mesh>(null);

  const anim = useRef({
    current: restPose(),
    target: restPose(),
    shownExpression: null as Expression | null,
    blinkUntil: 0,
    nextBlinkAt: 1 + (motion.seed % 3),
    pulse: { value: 0, velocity: 0 } as SpringState,
    time: 0,
    glance: 0,
  });

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const a = anim.current;
    a.time += dt;
    const now = a.time;
    const t = state.clock.elapsedTime;
    computePose(
      {
        mode: motion.mode,
        modeTime: now - motion.modeStartedAt,
        time: t,
        walkPhase: motion.walkPhase,
        seed: motion.seed,
        carrying: motion.holding,
      },
      a.target,
    );
    const fast = motion.mode === 'walk' || motion.mode === 'cheer' ? 26 : 12;
    for (const k of POSE_KEYS) {
      a.current[k] = damp(
        a.current[k],
        a.target[k],
        k === 'hop' || k === 'squash' ? fast * 1.4 : fast,
        dt,
      );
    }
    // "Play to the camera": in relaxed poses the head drifts a little towards the viewer, so
    // faces stay readable from every camera angle (a classic diorama/Animal Crossing trick).
    const bias = CAMERA_GLANCE[motion.mode] ?? 0;
    const toCamera = clamp(
      angleDelta(motion.bodyYaw + motion.lookYaw, runtime.camera.azimuth),
      -0.75,
      0.75,
    );
    a.glance = damp(a.glance, toCamera * bias, 3, dt);
    applyPose(a.current, motion.lookYaw + a.glance);

    // Expression changes get a quick "boing" on the head; blinks every few seconds.
    if (a.shownExpression !== motion.expression) {
      if (a.shownExpression !== null) a.pulse.velocity += 2.2;
      a.shownExpression = motion.expression;
    }
    springStep(a.pulse, 0, HEAD_PULSE_STIFFNESS, HEAD_PULSE_DAMPING, dt);
    if (now >= a.nextBlinkAt) {
      a.blinkUntil = now + 0.13;
      // Occasional double-blink feels alive.
      a.nextBlinkAt =
        now + (Math.sin(now * 12.9898 + motion.seed) > 0.6 ? 0.28 : 2.2 + ((now * 7.3) % 2.6));
    }
    const blinking = now < a.blinkUntil && canBlink(motion.expression);
    setFaceCell(faceTexture, motion.expression, blinking);

    const headShape = headShapeRef.current;
    if (headShape) {
      const p = a.pulse.value * 0.06;
      headShape.scale.set(
        HEAD_SCALE[0] * (1 + p),
        HEAD_SCALE[1] * (1 - p * 0.8),
        HEAD_SCALE[2] * (1 + p),
      );
    }
    if (heldRef.current) heldRef.current.visible = motion.holding;
    const blob = blobRef.current;
    if (blob) {
      const s = 1 - Math.min(0.45, a.current.hop * 2.2);
      blob.scale.set(0.3 * s, 0.3 * s, 1);
    }
    if (headAnchor && headRef.current) {
      headRef.current.getWorldPosition(headAnchor);
      headAnchor.y += (HEAD_CY + HEAD_R + 0.12) * look.scale;
    }
  });

  function applyPose(p: Pose, lookYaw: number) {
    const hop = hopRef.current;
    const body = bodyRef.current;
    const head = headRef.current;
    const armL = armLRef.current;
    const armR = armRRef.current;
    const legL = legLRef.current;
    const legR = legRRef.current;
    if (!hop || !body || !head || !armL || !armR || !legL || !legR) return;
    hop.position.y = p.hop;
    body.rotation.set(p.lean, p.twist, p.roll);
    const side = 1 / Math.sqrt(p.squash);
    body.scale.set(side, p.squash, side);
    head.rotation.set(p.headPitch, p.headYaw + lookYaw, p.headRoll, 'YXZ');
    armL.rotation.set(p.armLSwing, 0, p.armLRaise);
    armR.rotation.set(p.armRSwing, 0, -p.armRRaise);
    legL.rotation.x = p.legL;
    legR.rotation.x = p.legR;
  }

  const phiStart = Math.PI / 2 - FACE_SECTION.phiLength / 2;
  return (
    <group scale={look.scale}>
      <mesh
        ref={blobRef}
        geometry={circle(1, 32)}
        material={blobMaterial}
        rotation-x={-Math.PI / 2}
        position-y={0.008}
        renderOrder={1}
      />
      <group ref={hopRef}>
        <group ref={legLRef} position={[LEG_X, HIP_Y, 0]}>
          <mesh geometry={geometries.leg} material={bodyMaterial} castShadow={limbShadow} />
        </group>
        <group ref={legRRef} position={[-LEG_X, HIP_Y, 0]}>
          <mesh geometry={geometries.leg} material={bodyMaterial} castShadow={limbShadow} />
        </group>
        <group ref={bodyRef} position={[0, HIP_Y, 0]}>
          <mesh geometry={geometries.body} material={bodyMaterial} castShadow={castShadow} />
          <group ref={armLRef} position={[SHOULDER_X, SHOULDER_Y, 0]}>
            <mesh geometry={geometries.arm} material={bodyMaterial} castShadow={limbShadow} />
          </group>
          <group ref={armRRef} position={[-SHOULDER_X, SHOULDER_Y, 0]}>
            <mesh geometry={geometries.arm} material={bodyMaterial} castShadow={limbShadow} />
            <group ref={heldRef} position={[0, -0.25, 0.07]} visible={false}>
              {heldItem}
            </group>
          </group>
          <group ref={headRef} position={[0, NECK_Y, 0]}>
            <group ref={headShapeRef} position={[0, HEAD_CY, 0]} scale={HEAD_SCALE}>
              <mesh geometry={geometries.head} material={skinMaterial} castShadow={castShadow} />
              <mesh
                geometry={sphereSection(
                  HEAD_R * 1.012,
                  phiStart,
                  FACE_SECTION.phiLength,
                  FACE_SECTION.thetaStart,
                  FACE_SECTION.thetaLength,
                  32,
                  16,
                )}
                material={faceMaterial}
                renderOrder={2}
              />
              <mesh
                geometry={geometries.headwear}
                material={hairMaterial}
                castShadow={castShadow}
              />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
