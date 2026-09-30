import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
import { clamp, dampAngle, easeOutBack } from '../lib/easing';
import type { BubbleIcon } from '../overlay/overlayRegistry';
import { BoosterPacks } from '../products/InstancedProducts';
import { useDioramaRuntime } from '../runtime';
import { CUSTOMER_SCRIPT, POP_DURATION, type ScriptStep, WALK_SPEED } from './customerScript';
import type { Expression } from './faces';
import { KID_LOOK, type PegLook } from './looks';
import { STRIDE_METRES } from './motion';
import { createAgentMotion, PegFolk, setMotionMode } from './PegFolk';

interface CustomerProps {
  look?: PegLook;
  script?: readonly ScriptStep[];
  /** Fast-forward the loop by this many seconds on mount (QA screenshots). */
  startTime?: number;
  /** Overlay anchor id for the intent bubble. */
  id?: string;
  /** Hold the script at `startTime` (poses still animate): deterministic QA screenshots. */
  frozen?: boolean;
  /** Fast-forward to the first step with this phase (then `startTime` more seconds). */
  startPhase?: string;
}

interface CustomerState {
  index: number;
  stepTime: number;
  x: number;
  z: number;
  yaw: number;
  pop: number;
  visible: boolean;
  expression: Expression;
  bubble: BubbleIcon | null;
  started: boolean;
}

const HELD_PACK = [
  { position: [0, -0.02, 0.02] as const, rotation: [0.35, 0.2, 0.15] as const, variant: 0 },
];

/**
 * The demo customer: a Peg-folk kid driven by `CUSTOMER_SCRIPT`. All motion lives in a mutable
 * state object advanced in `useFrame` (CLAUDE.md rule 7); React renders it once.
 */
export function Customer({
  look = KID_LOOK,
  script = CUSTOMER_SCRIPT,
  startTime = 0,
  id = 'customer',
  frozen = false,
  startPhase,
}: CustomerProps) {
  const runtime = useDioramaRuntime();
  const rootRef = useRef<Group>(null);
  const [motion] = useState(() => createAgentMotion(1.7, 'happy'));
  const [anchor] = useState(() => runtime.overlay.anchor(id));
  const state = useRef<CustomerState>({
    index: 0,
    stepTime: 0,
    x: 0,
    z: 0,
    yaw: 0,
    pop: 0,
    visible: false,
    expression: 'happy',
    bubble: null,
    started: false,
  });

  function enterStep(s: CustomerState, step: ScriptStep, now: number) {
    s.stepTime = 0;
    if (step.kind === 'walk' || step.kind === 'act') {
      if (step.expression) s.expression = step.expression;
      if (step.bubble !== undefined) s.bubble = step.bubble;
      if (step.phase) runtime.customer.phase = step.phase;
    }
    if (step.kind === 'act') {
      setMotionMode(motion, step.mode, now);
      if (step.holding !== undefined) motion.holding = step.holding;
      if (step.signal === 'sale') {
        runtime.register.sales += 1;
        runtime.register.lastSaleAt = now;
      }
    }
    if (step.kind === 'spawn') {
      s.x = step.at[0];
      s.z = step.at[1];
      s.yaw = step.yaw;
      s.visible = true;
      s.pop = 0;
      s.bubble = null;
      motion.holding = false;
      runtime.customer.phase = step.phase;
    }
    if (step.kind === 'despawn') runtime.customer.phase = step.phase;
  }

  function advance(s: CustomerState, dt: number, now: number) {
    let step = script[s.index];
    if (!step) return;
    if (!s.started) {
      s.started = true;
      enterStep(s, step, now);
    }
    s.stepTime += dt;
    let done = false;
    switch (step.kind) {
      case 'spawn':
        s.pop = easeOutBack(clamp(s.stepTime / POP_DURATION, 0, 1), 2.2);
        setMotionMode(motion, 'idle', now);
        done = s.stepTime >= POP_DURATION;
        break;
      case 'walk': {
        const dx = step.to[0] - s.x;
        const dz = step.to[1] - s.z;
        const dist = Math.hypot(dx, dz);
        const speed = (step.speed ?? WALK_SPEED) * Math.min(1, 0.45 + s.stepTime * 3);
        const move = Math.min(dist, speed * dt);
        if (dist > 1e-4) {
          s.x += (dx / dist) * move;
          s.z += (dz / dist) * move;
          s.yaw = dampAngle(s.yaw, Math.atan2(dx, dz), 12, dt);
        }
        motion.walkPhase += (move / STRIDE_METRES) * Math.PI * 2;
        setMotionMode(motion, 'walk', now);
        done = dist - move < 0.005;
        break;
      }
      case 'act':
        if (step.face !== undefined) s.yaw = dampAngle(s.yaw, step.face, 9, dt);
        done = s.stepTime >= step.duration;
        break;
      case 'despawn':
        s.pop = 1 - clamp(s.stepTime / (POP_DURATION * 0.8), 0, 1) ** 2;
        s.bubble = null;
        done = s.stepTime >= POP_DURATION * 0.8;
        if (done) s.visible = false;
        break;
      case 'pause':
        s.visible = false;
        done = s.stepTime >= step.duration;
        break;
    }
    if (done) {
      s.index = (s.index + 1) % script.length;
      step = script[s.index];
      if (step) enterStep(s, step, now);
    }
  }

  useFrame((_, delta) => {
    const s = state.current;
    const now = runtime.time;
    if (!s.started && (startTime > 0 || startPhase)) {
      // Fast-forward deterministically in small steps (bounded to one loop for a phase).
      if (startPhase) {
        for (let i = 0; i < 30 * 90 && runtime.customer.phase !== startPhase; i++)
          advance(s, 1 / 30, now);
      }
      for (let t = 0; t < startTime; t += 1 / 30) advance(s, 1 / 30, now);
    }
    advance(s, frozen ? 0 : Math.min(delta, 0.1), now);

    const root = rootRef.current;
    if (root) {
      root.position.set(s.x, 0, s.z);
      root.rotation.y = s.yaw;
      root.scale.setScalar(Math.max(0.0001, s.pop));
      root.visible = s.visible && s.pop > 0.01;
    }
    motion.expression = runtime.customerExpressionOverride ?? s.expression;
    motion.bodyYaw = s.yaw;
    runtime.customer.position.set(s.x, 0, s.z);
    runtime.customer.visible = s.visible;
    // Only show intent while inside the shop and fully popped in.
    anchor.icon = s.visible && s.pop > 0.9 ? s.bubble : null;
  });

  return (
    <group ref={rootRef} visible={false}>
      <PegFolk
        look={look}
        motion={motion}
        headAnchor={anchor.position}
        heldItem={<BoosterPacks items={HELD_PACK} />}
      />
    </group>
  );
}
