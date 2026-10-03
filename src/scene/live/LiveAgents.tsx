import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { type Group, Vector3 } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { getRegistry } from '@/content/registry';
import { avatarLook, DEFAULT_AVATAR } from '@/game/newgame/avatar';
import { findTilePath, tileCenter } from '@/sim/nav';
import type { CustomerAgent, GameState } from '@/sim/state/types';
import { customerAtPaySpot } from '@/sim/systems/customers';
import { useGame, useGameStore } from '@/state/gameStore';
import { simNow } from '@/state/simClock';
import { STRIDE_METRES } from '../agents/motion';
import { createAgentMotion, PegFolk, setMotionMode } from '../agents/PegFolk';
import { clamp, damp, dampAngle, easeOutBack } from '../lib/easing';
import { cylinder, roundedBox, torus } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge } from '../lib/merge';
import { useDioramaRuntime } from '../runtime';
import { liveTones, tones } from '../scenePalette';
import {
  BUBBLE_ICON,
  bubbleShown,
  buildPath,
  expressionFor,
  placeAgent,
  poseFor,
  roundCorners,
  sampleAt,
  type WorldPath,
} from './agentMath';
import { colliderMaterial, usePickable } from './interaction';
import { gridPointToWorld, type XZ } from './layoutMath';
import {
  type AgentVisual,
  agentKey,
  ensureAgent,
  forgetAgent,
  type LiveRuntime,
  useLiveRuntime,
} from './liveRuntime';
import { ProductInstances } from './ProductInstances';
import { productRect } from './productAtlas';
import { shapeForKind } from './slotLayout';

/**
 * Customers and the shopkeeper (docs/04 §4.4, docs/06 §5.6). React renders the roster: who is
 * on stage (customers arrive and leave a few times a minute). Everything that moves is computed
 * every frame from the sim state and `simNow()` by one system (`AgentSystem`) into mutable
 * `AgentVisual`s that each Peg-folk reads in `useFrame`.
 *
 * Customers who leave the sim keep walking for a moment: at the street corner they pop away; at
 * closing time (when the sim clears the shop at once) they walk out through the door first.
 */

/** Top of a Peg-folk's head at scale 1 (hip 0.25 + neck 0.43 + head centre 0.2 + radius 0.25). */
const HEAD_TOP = 1.13;
const POP_IN = 0.35;
const POP_OUT = 0.3;
/** Walking pace of customers sent home at closing (m/s, scene time). */
const GHOST_SPEED = 1.35;
/** The west wall's line: crossing it outwards means walking out of the door. */
const DOOR_LINE_X_OFFSET = 0.05;

export interface RosterEntry {
  key: string;
  uid: number;
  archetypeId: string;
  lookSeed: number;
}

/** Who is on stage: every customer in the sim plus the ones still walking off. */
export function useRoster() {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  useEffect(() => {
    const sync = () => {
      const active = useGameStore.getState().game?.customers.active ?? [];
      setRoster((previous) => {
        const known = new Set(previous.map((entry) => entry.key));
        const added = active
          .filter((agent) => !known.has(agentKey(agent)))
          .map((agent) => ({
            key: agentKey(agent),
            uid: agent.uid,
            archetypeId: agent.archetypeId,
            lookSeed: agent.lookSeed,
          }));
        return added.length > 0 ? [...previous, ...added] : previous;
      });
    };
    sync();
    return useGameStore.subscribe((store, previous) => {
      if (store.game?.customers.active !== previous.game?.customers.active) sync();
    });
  }, []);
  const remove = (key: string) =>
    setRoster((previous) => previous.filter((entry) => entry.key !== key));
  return { roster, remove };
}

// ---------------------------------------------------------------------------------------------
// The per-frame system

/** From where a customer stands to the street corner: through the door if inside. */
function exitRoute(live: LiveRuntime, from: XZ): WorldPath | null {
  const nav = live.nav;
  if (!nav) return null;
  const { grid } = live;
  const tile = { x: Math.floor(from.x + grid.w / 2), z: Math.floor(from.z + grid.d / 2) };
  const inside = tile.x >= 0 && tile.z >= 0 && tile.x < grid.w && tile.z < grid.d;
  const points: XZ[] = [from];
  if (inside) {
    const tiles = findTilePath(nav, tile, nav.doorTile);
    if (tiles) for (const t of tiles.slice(1)) points.push(gridPointToWorld(tileCenter(t), grid));
    else points.push(gridPointToWorld(tileCenter(nav.doorTile), grid));
    points.push(gridPointToWorld(nav.outside, grid));
  }
  points.push(gridPointToWorld(nav.street, grid));
  return buildPath(roundCorners(points));
}

function updateFromSim(
  live: LiveRuntime,
  door: { kick: number },
  v: AgentVisual,
  agent: CustomerAgent,
  now: number,
  time: number,
  dt: number,
) {
  const placement = placeAgent(agent.activity, now, live.grid);
  if (!v.placed) {
    v.placed = true;
    v.x = placement.x;
    v.z = placement.z;
    v.yaw = placement.yaw ?? 0;
    v.bornAt = time;
  }
  const prevX = v.x;
  const moved = Math.hypot(placement.x - v.x, placement.z - v.z);
  v.x = placement.x;
  v.z = placement.z;
  // Paused sim: the walker freezes mid-stride, so drop to an idle stance instead.
  v.moving = placement.stance === 'walk' && moved > 0.02 * dt;
  if (v.moving) v.motion.walkPhase += (moved / STRIDE_METRES) * Math.PI * 2;
  v.yaw = dampAngle(v.yaw, placement.yaw ?? v.yaw, v.moving ? 12 : 7, dt);
  v.stance = placement.stance;
  v.pop = live.reducedMotion ? 1 : easeOutBack(clamp((time - v.bornAt) / POP_IN, 0, 1), 2.2);

  const bubble = bubbleShown(agent.bubble, now);
  if (bubble === 'angry') v.angry = true;
  const carrying = agent.basket.length > 0;
  v.motion.holding = carrying && placement.stance !== 'browse';
  setMotionMode(
    v.motion,
    poseFor({
      stance: placement.stance,
      moving: v.moving,
      browse: placement.browse,
      bubble,
      mood: v.mood,
    }),
    time,
  );
  v.motion.expression = expressionFor({
    bubble,
    stance: placement.stance,
    mood: v.mood,
    kid: v.kid,
    carrying,
  });
  v.motion.bodyYaw = v.yaw;
  v.anchor.icon = bubble && v.pop > 0.9 ? BUBBLE_ICON[bubble] : null;

  // An angry walk-out slams the door: a puff of dust on the doorstep and the bell rattles.
  const line = -live.grid.w / 2 - DOOR_LINE_X_OFFSET;
  if (v.angry && !v.slammed && prevX > line && v.x <= line) {
    v.slammed = true;
    door.kick += 9;
    live.particles.push({
      kind: 'dust',
      position: new Vector3(live.doorCenter.x - 0.25, 0.08, live.doorCenter.z),
      count: 9,
      spread: 0.5,
    });
  }
}

function updateGhost(live: LiveRuntime, v: AgentVisual, time: number, dt: number) {
  const ghost = v.ghost;
  if (!ghost) return;
  v.anchor.icon = null;
  // The visit is scored by now (`customer/left`): leave wearing how it went.
  v.motion.expression = expressionFor({
    bubble: null,
    stance: 'walk',
    mood: v.mood,
    kid: v.kid,
    carrying: v.motion.holding,
  });
  if (ghost.vanishAt === null && ghost.path) {
    ghost.along += GHOST_SPEED * dt;
    const at = sampleAt(ghost.path, ghost.along);
    const moved = Math.hypot(at.x - v.x, at.z - v.z);
    v.x = at.x;
    v.z = at.z;
    v.yaw = dampAngle(v.yaw, at.yaw, 12, dt);
    v.moving = true;
    v.motion.walkPhase += (moved / STRIDE_METRES) * Math.PI * 2;
    setMotionMode(v.motion, 'walk', time);
    v.motion.bodyYaw = v.yaw;
    if (ghost.along >= ghost.path.length) ghost.vanishAt = time;
    return;
  }
  const start = ghost.vanishAt ?? time;
  const t = live.reducedMotion ? 1 : clamp((time - start) / POP_OUT, 0, 1);
  v.moving = false;
  setMotionMode(v.motion, 'idle', time);
  v.pop = (1 - t) ** 2;
  if (t >= 1) v.done = true;
}

function startGhost(live: LiveRuntime, v: AgentVisual, time: number) {
  if (!v.placed) {
    v.done = true;
    return;
  }
  const nav = live.nav;
  const street = nav ? gridPointToWorld(nav.street, live.grid) : null;
  const atStreet = !street || Math.hypot(v.x - street.x, v.z - street.z) < 0.7;
  const path = atStreet ? null : exitRoute(live, { x: v.x, z: v.z });
  v.ghost = { path, along: 0, vanishAt: path ? null : time };
}

const seen = new Set<number>();
const crowd: AgentVisual[] = [];
/** Customers closer than this drift apart (cosmetic: the sim allows a group on one spot). */
const PERSONAL_SPACE = 0.46;
const MAX_NUDGE = 0.32;

/**
 * Personal space: customers on the same spot (a group arriving together, someone passing the
 * line) ease apart a little. Purely cosmetic and small, so nobody leaves their tile.
 */
function separate(live: LiveRuntime, dt: number) {
  crowd.length = 0;
  for (const v of live.agents.values()) if (v.placed && !v.done) crowd.push(v);
  const push = new Map<AgentVisual, { x: number; z: number }>();
  for (let i = 0; i < crowd.length; i++) {
    const a = crowd[i] as AgentVisual;
    for (let j = i + 1; j < crowd.length; j++) {
      const b = crowd[j] as AgentVisual;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d >= PERSONAL_SPACE) continue;
      // Same spot: split along a direction picked from the pair's uids.
      const angle = (a.uid * 2.39996 + b.uid * 1.1) % (Math.PI * 2);
      const nx = d > 1e-4 ? dx / d : Math.cos(angle);
      const nz = d > 1e-4 ? dz / d : Math.sin(angle);
      const amount = (PERSONAL_SPACE - d) / 2;
      const pa = push.get(a) ?? { x: 0, z: 0 };
      const pb = push.get(b) ?? { x: 0, z: 0 };
      pa.x += nx * amount;
      pa.z += nz * amount;
      pb.x -= nx * amount;
      pb.z -= nz * amount;
      push.set(a, pa);
      push.set(b, pb);
    }
  }
  for (const v of crowd) {
    const p = push.get(v);
    const tx = p ? clamp(p.x, -MAX_NUDGE, MAX_NUDGE) : 0;
    const tz = p ? clamp(p.z, -MAX_NUDGE, MAX_NUDGE) : 0;
    v.ox = damp(v.ox, tx, 4, dt);
    v.oz = damp(v.oz, tz, 4, dt);
    v.anchor.position.set(v.x + v.ox, (HEAD_TOP + 0.14) * v.look.scale, v.z + v.oz);
  }
}

function AgentSystem({ onGone }: { onGone: (key: string) => void }) {
  const live = useLiveRuntime();
  const diorama = useDioramaRuntime();
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const time = diorama.time;
    const game = useGameStore.getState().game;
    const now = simNow();
    seen.clear();
    live.paySpotUid = null;
    if (game) {
      live.paySpotUid = customerAtPaySpot(game)?.uid ?? null;
      for (const agent of game.customers.active) {
        let v = ensureAgent(live, agent.uid, agent.archetypeId, agent.lookSeed, time);
        if (v.lookSeed !== agent.lookSeed) {
          // A new game reused this uid: drop the old visual.
          onGone(agentKey(v));
          forgetAgent(live, agent.uid);
          v = ensureAgent(live, agent.uid, agent.archetypeId, agent.lookSeed, time);
        }
        seen.add(agent.uid);
        updateFromSim(live, diorama.door, v, agent, now, time, dt);
      }
    }
    for (const v of live.agents.values()) {
      if (seen.has(v.uid) || v.done) continue;
      if (!v.ghost) startGhost(live, v, time);
      updateGhost(live, v, time, dt);
      if (v.done) {
        // Gone for good: drop the visual and its bubble, and take it off the roster.
        forgetAgent(live, v.uid);
        onGone(agentKey(v));
      }
    }
    separate(live, dt);
    // Steam over angry heads while their bubble shows.
    if (!live.reducedMotion) {
      for (const v of live.agents.values()) {
        if (v.anchor.icon === 'angry' && Math.random() < dt * 2.5) {
          live.particles.push({
            kind: 'steam',
            position: new Vector3(v.x + v.ox, v.anchor.position.y - 0.08, v.z + v.oz),
            count: 2,
            spread: 0.2,
          });
        }
      }
    }
    diorama.register.waiting = live.paySpotUid !== null;
  }, -5);
  return null;
}

// ---------------------------------------------------------------------------------------------
// Customers

/** What a customer carries, from the sim: the first basket item, or a bag once paid. */
function heldKeyOf(game: GameState, uid: number): string {
  const agent = game.customers.active.find((entry) => entry.uid === uid);
  const first = agent?.basket[0];
  if (!agent || !first) return '';
  // Only paid customers leave with a basket (lost ones put everything back first).
  if (agent.activity.kind === 'leave') return 'bag';
  return first.productId ? `product:${first.productId}` : 'card';
}

function bagGeometry() {
  return cachedMerge('live-bag', () => [
    {
      geometry: roundedBox(0.17, 0.2, 0.09, 0.02, 2),
      color: liveTones.kraft,
      position: [0, -0.1, 0],
    },
    {
      geometry: roundedBox(0.175, 0.03, 0.095, 0.01, 1),
      color: liveTones.kraftDark,
      position: [0, -0.015, 0],
    },
    {
      geometry: torus(0.045, 0.008, 6, 14, Math.PI),
      color: liveTones.kraftDark,
      position: [0, 0.0, 0],
      rotation: [0, 0, 0],
    },
  ]);
}

function cardGeometry() {
  return cachedMerge('live-held-card', () => [
    { geometry: roundedBox(0.09, 0.125, 0.012, 0.006, 1), color: tones.paper, position: [0, 0, 0] },
    { geometry: roundedBox(0.07, 0.1, 0.014, 0.004, 1), color: tones.sky, position: [0, 0, 0] },
  ]);
}

function HeldItemModel({ heldKey }: { heldKey: string }) {
  if (heldKey === 'bag') {
    return (
      <group position={[0, 0.02, 0.02]}>
        <mesh
          geometry={bagGeometry()}
          material={vertexColorMaterial({ roughness: 0.8 })}
          castShadow
        />
      </group>
    );
  }
  if (heldKey === 'card') {
    return (
      <mesh
        geometry={cardGeometry()}
        material={vertexColorMaterial({ roughness: 0.4 })}
        position={[0, -0.03, 0.03]}
        rotation={[0.3, 0.2, 0.1]}
      />
    );
  }
  const productId = heldKey.slice('product:'.length);
  const product = getRegistry().products.get(productId);
  if (!product) return null;
  const shape = shapeForKind(product.kind);
  return (
    <ProductInstances
      shape={shape}
      capacity={1}
      units={[
        {
          position: [0, -0.02, 0.03],
          rotation: [0.35, 0.2, 0.15],
          scale: shape === 'pack' ? 0.9 : 0.75,
          rect: productRect(productId, 0),
        },
      ]}
    />
  );
}

function CustomerCollider({ uid, scale }: { uid: number; scale: number }) {
  const live = useLiveRuntime();
  const handlers = usePickable({ kind: 'customer', uid });
  const big = live.coarsePointer ? 1.3 : 1;
  return (
    <mesh
      geometry={roundedBox(0.6 * big, 1.25 * scale * big, 0.55 * big, 0.05, 1)}
      material={colliderMaterial}
      position={[0, 0.62 * scale, 0]}
      {...handlers}
    />
  );
}

function Customer({ entry }: { entry: RosterEntry }) {
  const live = useLiveRuntime();
  const diorama = useDioramaRuntime();
  const [visual] = useState(() =>
    ensureAgent(live, entry.uid, entry.archetypeId, entry.lookSeed, diorama.time),
  );
  const groupRef = useRef<Group>(null);
  const simHeld = useGame((game) => heldKeyOf(game, entry.uid), '');
  const present = useGame(
    (game) => game.customers.active.some((agent) => agent.uid === entry.uid),
    false,
  );
  // Customers walking off keep what they carried (served at closing: a bag).
  const lastHeld = useRef('');
  if (simHeld) lastHeld.current = simHeld;
  const heldKey = present ? simHeld : visual.paid && lastHeld.current ? 'bag' : lastHeld.current;

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    group.position.set(visual.x + visual.ox, 0, visual.z + visual.oz);
    group.rotation.y = visual.yaw;
    group.scale.setScalar(Math.max(0.0001, visual.pop));
    group.visible = visual.placed && visual.pop > 0.01;
  }, -4);

  return (
    <group ref={groupRef} visible={false}>
      <PegFolk
        look={visual.look}
        motion={visual.motion}
        limbShadows={false}
        heldItem={heldKey ? <HeldItemModel heldKey={heldKey} /> : null}
      />
      <CustomerCollider uid={entry.uid} scale={visual.look.scale} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// The shopkeeper

const OWNER_CYCLE = 11;

function Owner({ position, yaw }: { position: XZ; yaw: number }) {
  const live = useLiveRuntime();
  const diorama = useDioramaRuntime();
  const spec = useGameStore(useShallow((store) => store.game?.meta.owner ?? DEFAULT_AVATAR));
  const look = avatarLook(spec);
  const [motion] = useState(() => createAgentMotion(4.2, 'happy'));
  const [state] = useState(() => ({
    lookYaw: 0,
    greetedUid: null as number | null,
    greetAt: -100,
  }));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const now = diorama.time;
    const phase = useGameStore.getState().game?.clock.phase ?? 'prep';
    const payer = live.paySpotUid === null ? null : live.agents.get(live.paySpotUid);
    if (payer && state.greetedUid !== payer.uid) {
      state.greetedUid = payer.uid;
      state.greetAt = now;
    }
    const sinceScan = now - live.scanAt;
    let look = 0;
    const toward = (x: number, z: number) => Math.atan2(x - position.x, z - position.z) - yaw;
    if (sinceScan < 1.4) {
      setMotionMode(motion, 'register', now);
      motion.expression = 'happy';
      if (payer) look = toward(payer.x, payer.z) * 0.6;
    } else if (sinceScan < 2.8) {
      setMotionMode(motion, 'wave', now);
      motion.expression = 'excited';
    } else if (payer) {
      // Someone's waiting: a quick hello, then attentive.
      setMotionMode(motion, now - state.greetAt < 1.1 ? 'wave' : 'idle', now);
      motion.expression = 'happy';
      look = toward(payer.x, payer.z);
    } else {
      const cycle = now % OWNER_CYCLE;
      setMotionMode(motion, cycle > 7.5 ? 'lookAround' : 'idle', now);
      motion.expression =
        phase === 'night' && cycle > 4 && cycle < 6
          ? 'sleepy'
          : cycle > 9.4 && cycle < 10.6
            ? 'thinking'
            : 'happy';
      // Keep half an eye on the nearest customer inside.
      let best = Number.POSITIVE_INFINITY;
      for (const v of live.agents.values()) {
        if (v.ghost || !v.placed) continue;
        const d = Math.hypot(v.x - position.x, v.z - position.z);
        if (d < best && d < 4.5 && v.x > -live.grid.w / 2) {
          best = d;
          look = toward(v.x, v.z) * 0.55;
        }
      }
      if (cycle >= 7.5) look = 0;
    }
    state.lookYaw = damp(
      state.lookYaw,
      clamp(Math.atan2(Math.sin(look), Math.cos(look)), -1.1, 1.1),
      4,
      dt,
    );
    motion.lookYaw = state.lookYaw;
    motion.bodyYaw = yaw;
    diorama.owner.position.set(position.x, 0, position.z);
  });

  return (
    <group position={[position.x, 0, position.z]} rotation-y={yaw}>
      <PegFolk look={look} motion={motion} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------

export function LiveAgents({
  roster,
  onGone,
  owner,
}: {
  roster: readonly RosterEntry[];
  onGone: (key: string) => void;
  owner: { position: XZ; yaw: number } | null;
}) {
  return (
    <>
      <AgentSystem onGone={onGone} />
      {roster.map((entry) => (
        <Customer key={entry.key} entry={entry} />
      ))}
      {owner ? <Owner position={owner.position} yaw={owner.yaw} /> : null}
    </>
  );
}

/** A little stool behind the counter so the owner's spot reads as "staff only". */
export function OwnerMat({ position }: { position: XZ }) {
  const geometry = cachedMerge('live-owner-mat', () => [
    { geometry: cylinder(0.32, 0.32, 0.012, 28), color: tones.teal, position: [0, 0.006, 0] },
    {
      geometry: torus(0.3, 0.012, 6, 28),
      color: tones.trim,
      position: [0, 0.012, 0],
      rotation: [Math.PI / 2, 0, 0],
    },
  ]);
  return (
    <mesh
      geometry={geometry}
      material={vertexColorMaterial({ roughness: 0.85 })}
      position={[position.x, 0.002, position.z]}
      receiveShadow
    />
  );
}
