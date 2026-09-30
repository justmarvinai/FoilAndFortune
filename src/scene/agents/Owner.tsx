import { useFrame } from '@react-three/fiber';
import { useState } from 'react';
import type { Vec3 } from '../layout';
import { clamp, damp } from '../lib/easing';
import { useDioramaRuntime } from '../runtime';
import { OWNER_LOOK, type PegLook } from './looks';
import { createAgentMotion, PegFolk, setMotionMode } from './PegFolk';

interface OwnerProps {
  position: Vec3;
  yaw?: number;
  look?: PegLook;
}

/**
 * The shopkeeper behind the counter (docs/04 §4.4 "The owner avatar … appears behind the
 * counter"): breathes, looks around, keeps half an eye on customers, rings up sales and waves
 * goodbye. Reacts to the customer's script phase via the runtime.
 */
export function Owner({ position, yaw = 0, look = OWNER_LOOK }: OwnerProps) {
  const runtime = useDioramaRuntime();
  const [motion] = useState(() => createAgentMotion(4.2, 'happy'));
  const [state] = useState(() => ({ lookYaw: 0, phase: '', phaseAt: 0 }));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const now = runtime.time;
    const c = runtime.customer;
    if (c.phase !== state.phase) {
      state.phase = c.phase;
      state.phaseAt = now;
    }
    const inPhase = now - state.phaseAt;
    // Where is the customer relative to where I'm facing?
    const toCustomer = Math.atan2(c.position.x - position[0], c.position.z - position[2]) - yaw;
    const customerInside = c.visible && Math.abs(c.position.x) < 3 && Math.abs(c.position.z) < 2.5;
    let look = 0;
    if (c.phase === 'checkout') {
      setMotionMode(motion, inPhase < 1.9 ? 'register' : 'idle', now);
      motion.expression = 'happy';
      look = toCustomer;
    } else if (c.phase === 'paid' || (c.phase === 'leave' && inPhase < 1.8)) {
      setMotionMode(motion, 'wave', now);
      motion.expression = 'excited';
      look = toCustomer * 0.7;
    } else {
      // Idle loop: mostly relaxed, now and then a slow look around the shop.
      const cycle = now % 11;
      setMotionMode(motion, cycle > 7.5 ? 'lookAround' : 'idle', now);
      motion.expression = cycle > 9.4 && cycle < 10.6 ? 'thinking' : 'happy';
      if (customerInside && cycle < 7.5) look = toCustomer * 0.55;
    }
    state.lookYaw = damp(state.lookYaw, clamp(look, -1.1, 1.1), 4, dt);
    motion.lookYaw = state.lookYaw;
    motion.bodyYaw = yaw;
    runtime.owner.position.set(position[0], position[1], position[2]);
  });

  return (
    <group position={position} rotation-y={yaw}>
      <PegFolk look={look} motion={motion} />
    </group>
  );
}
