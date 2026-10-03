import { createContext, useContext } from 'react';
import { type Group, Vector3 } from 'three';
import type { GridSize } from '@/content/shop/geometry';
import { formatMoney } from '@/core/money';
import type { NavGrid } from '@/sim/nav';
import type { PegLook } from '../agents/looks';
import { type AgentMotion, createAgentMotion } from '../agents/PegFolk';
import type { WallSide } from '../layout';
import type { OverlayAnchor, OverlayRegistry } from '../overlay/overlayRegistry';
import type { Mood, Stance, WorldPath } from './agentMath';
import type { Box3, XZ } from './layoutMath';
import { customerLook, isKid } from './liveLooks';

/**
 * Mutable per-frame state of the live shop (CLAUDE.md rule 7): agent visuals, hover and
 * selection, fixture bounds for anchoring, pending effects. Written and read in `useFrame` and
 * the overlay projector, never React state. React only renders the roster (who is on stage) and
 * the fixtures' stock, both of which change at sim-tick pace at most.
 */

export type HoverTarget =
  | { kind: 'fixture'; uid: string }
  | { kind: 'register'; uid: string }
  | { kind: 'customer'; uid: number };

/** What a customer carries: a product from the basket, a single card, or a paid-for bag. */
export type HeldItem = { kind: 'product'; productId: string } | { kind: 'card' } | { kind: 'bag' };

export interface Ghost {
  /** Exit route walked in scene time once the sim has let go (closing time), or null to vanish. */
  path: WorldPath | null;
  along: number;
  /** Scene time the pop-out started (null while still walking). */
  vanishAt: number | null;
}

export interface AgentVisual {
  uid: number;
  /** The sim's look seed (with the uid, identifies this customer across a new game). */
  lookSeed: number;
  archetypeId: string;
  look: PegLook;
  kid: boolean;
  motion: AgentMotion;
  /** Where the sim puts the customer (world XZ). */
  x: number;
  z: number;
  /** Cosmetic personal-space offset (a group walking in together spreads out a little). */
  ox: number;
  oz: number;
  yaw: number;
  /** Spawn / vanish scale, 0…1. */
  pop: number;
  bornAt: number;
  /** Has been placed from sim state at least once. */
  placed: boolean;
  stance: Stance;
  moving: boolean;
  anchor: OverlayAnchor;
  /** How the visit went, from `customer/left` (the sim's satisfaction is private). */
  mood: Mood | null;
  /** Rung up (`sale/completed`): carries a paper bag out. */
  paid: boolean;
  held: HeldItem | null;
  /** Left angry: steam on the way out and a door slam with a dust puff. */
  angry: boolean;
  slammed: boolean;
  ghost: Ghost | null;
  /** Gone for good (ghost finished); the roster drops it. */
  done: boolean;
}

export interface FixtureInfo {
  uid: string;
  kind: 'shelf' | 'case' | 'register' | 'decor';
  bounds: Box3;
  wall: WallSide | null;
  /** The model's group, scaled a touch when hovered (a toy-like "pick me" lift). */
  lift: Group | null;
}

export type ParticleKind = 'heart' | 'dust' | 'steam' | 'sparkle' | 'coin';

export interface ParticleRequest {
  kind: ParticleKind;
  position: Vector3;
  count: number;
  /** Spread radius (m). */
  spread?: number;
}

export interface MoneyFloat {
  cents: number;
  at: Vector3;
  /** Scene time it was queued. */
  time: number;
}

/** DOM nodes of the overlay layer, written by the overlay projector every frame. */
export interface OverlayDom {
  /** Container of the anchored content (the Fixture Popover) and its measured size. */
  anchored: HTMLElement | null;
  anchoredSize: { width: number; height: number };
  anchoredUid: string | null;
  placement: 'above' | 'below' | null;
  ringUp: HTMLElement | null;
  ringUpShown: boolean;
  floats: (HTMLElement | null)[];
  /** Screen areas covered by the HUD, dock and sheets (px). */
  insets: { top: number; right: number; bottom: number; left: number };
  /** World point above the cash register (sale floats, the ring-up chip). */
  registerTop: Vector3;
  /** Formats a sale amount for the float ("+$4.49", i18n). */
  formatSale: (cents: number) => string;
}

export interface LiveRuntime {
  grid: GridSize;
  nav: NavGrid | null;
  doorCenter: XZ;
  agents: Map<number, AgentVisual>;
  hover: HoverTarget | null;
  /** The fixture whose popover is open. */
  selected: string | null;
  fixtures: Map<string, FixtureInfo>;
  /** The customer standing at the pay spot (the only one who can be rung up). */
  paySpotUid: number | null;
  /** Scene time the owner last rang up a sale (scan animation). */
  scanAt: number;
  particles: ParticleRequest[];
  floats: MoneyFloat[];
  reducedMotion: boolean;
  /** Touch-first device: bigger colliders for fingers. */
  coarsePointer: boolean;
  overlay: OverlayRegistry;
  dom: OverlayDom;
}

export function createLiveRuntime(
  overlay: OverlayRegistry,
  grid: GridSize,
  doorCenter: XZ,
): LiveRuntime {
  return {
    grid,
    nav: null,
    doorCenter,
    agents: new Map(),
    hover: null,
    selected: null,
    fixtures: new Map(),
    paySpotUid: null,
    scanAt: -100,
    particles: [],
    floats: [],
    reducedMotion: false,
    coarsePointer: false,
    overlay,
    dom: {
      anchored: null,
      anchoredSize: { width: 0, height: 0 },
      anchoredUid: null,
      placement: null,
      ringUp: null,
      ringUpShown: false,
      floats: [],
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      registerTop: new Vector3(),
      formatSale: (cents) => formatMoney(cents, { signed: true }),
    },
  };
}

/** Roster key of a customer (uids restart with a new game; the look seed tells them apart). */
export function agentKey(agent: { uid: number; lookSeed: number }): string {
  return `${agent.uid}:${agent.lookSeed}`;
}

export function agentAnchorId(uid: number): string {
  return `agent-${uid}`;
}

/** The visual for a customer, created on first sight. */
export function ensureAgent(
  runtime: LiveRuntime,
  uid: number,
  archetypeId: string,
  lookSeed: number,
  time: number,
): AgentVisual {
  let visual = runtime.agents.get(uid);
  if (!visual) {
    const look = customerLook(lookSeed, archetypeId);
    visual = {
      uid,
      lookSeed,
      archetypeId,
      look,
      kid: isKid(archetypeId),
      motion: createAgentMotion((lookSeed % 997) / 97, 'happy'),
      x: 0,
      z: 0,
      ox: 0,
      oz: 0,
      yaw: 0,
      pop: 0,
      bornAt: time,
      placed: false,
      stance: 'walk',
      moving: false,
      anchor: runtime.overlay.anchor(agentAnchorId(uid)),
      mood: null,
      paid: false,
      held: null,
      angry: false,
      slammed: false,
      ghost: null,
      done: false,
    };
    runtime.agents.set(uid, visual);
  }
  return visual;
}

export function forgetAgent(runtime: LiveRuntime, uid: number): void {
  runtime.agents.delete(uid);
  runtime.overlay.remove(agentAnchorId(uid));
  if (runtime.hover?.kind === 'customer' && runtime.hover.uid === uid) runtime.hover = null;
}

export const LiveRuntimeContext = createContext<LiveRuntime | null>(null);

export function useLiveRuntime(): LiveRuntime {
  const runtime = useContext(LiveRuntimeContext);
  if (!runtime) throw new Error('useLiveRuntime must be used inside <LiveShopScene>');
  return runtime;
}
