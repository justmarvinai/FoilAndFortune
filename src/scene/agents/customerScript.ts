import { type Vec2, WAYPOINTS } from '../layout';
import type { BubbleIcon } from '../overlay/overlayRegistry';
import type { Expression } from './faces';
import type { PoseMode } from './motion';

/**
 * The demo customer's loop, as data (docs/01 §10.3 state machine, in miniature):
 * arrive → enter (bell) → rummage in the bargain bin → browse the pack wall → grab a pack →
 * queue at the counter (🛒) → pay and cheer (❤️) → leave. In Phase 2 the sim's customer events
 * drive the same steps.
 *
 * `expression` and `bubble` persist until a later step changes them (`bubble: null` hides it).
 */
export type ScriptStep =
  | { kind: 'spawn'; at: Vec2; yaw: number; phase: string }
  | {
      kind: 'walk';
      to: Vec2;
      speed?: number;
      phase?: string;
      expression?: Expression;
      bubble?: BubbleIcon | null;
    }
  | {
      kind: 'act';
      mode: PoseMode;
      duration: number;
      /** Turn to this yaw (radians, 0 = facing +z / the default camera). */
      face?: number;
      phase?: string;
      expression?: Expression;
      bubble?: BubbleIcon | null;
      holding?: boolean;
      /** Side effect fired when the step starts. */
      signal?: 'sale';
    }
  | { kind: 'despawn'; phase: string }
  | { kind: 'pause'; duration: number };

const NORTH = Math.PI;
const EAST = Math.PI / 2;
const SOUTH = 0;

export const CUSTOMER_SCRIPT: readonly ScriptStep[] = [
  { kind: 'spawn', at: WAYPOINTS.spawn, yaw: NORTH, phase: 'arrive' },
  { kind: 'walk', to: WAYPOINTS.outsideDoor, expression: 'happy', bubble: null },
  { kind: 'walk', to: WAYPOINTS.insideDoor, phase: 'enter' },
  {
    kind: 'act',
    mode: 'lookAround',
    duration: 1.7,
    face: EAST,
    expression: 'excited',
    bubble: 'sparkle',
  },
  { kind: 'walk', to: WAYPOINTS.bargainBin, phase: 'bin', expression: 'happy', bubble: null },
  {
    kind: 'act',
    mode: 'dig',
    duration: 3.2,
    face: SOUTH,
    expression: 'thinking',
    bubble: 'search',
  },
  {
    kind: 'act',
    mode: 'idle',
    duration: 1.0,
    face: SOUTH,
    expression: 'surprised',
    bubble: 'exclaim',
  },
  { kind: 'walk', to: WAYPOINTS.packShelf, phase: 'shelf', expression: 'happy', bubble: null },
  {
    kind: 'act',
    mode: 'browse',
    duration: 3.2,
    face: NORTH,
    expression: 'thinking',
    bubble: 'pack',
  },
  {
    kind: 'act',
    mode: 'reach',
    duration: 0.9,
    face: NORTH,
    expression: 'excited',
    bubble: null,
    holding: true,
  },
  { kind: 'walk', to: WAYPOINTS.aisle, phase: 'queue', expression: 'happy' },
  { kind: 'walk', to: WAYPOINTS.counter },
  {
    kind: 'act',
    mode: 'wait',
    duration: 2.6,
    face: NORTH,
    phase: 'checkout',
    expression: 'happy',
    bubble: 'cart',
  },
  {
    kind: 'act',
    mode: 'cheer',
    duration: 1.5,
    face: 0.5,
    phase: 'paid',
    expression: 'excited',
    bubble: 'heart',
    signal: 'sale',
  },
  { kind: 'walk', to: WAYPOINTS.insideDoor, phase: 'leave', expression: 'happy', bubble: null },
  { kind: 'walk', to: WAYPOINTS.outsideDoor },
  { kind: 'walk', to: WAYPOINTS.spawn },
  { kind: 'despawn', phase: 'gone' },
  { kind: 'pause', duration: 1.6 },
];

/** Walking speed in m/s (chibi legs, docs/04 §4.2 scale). */
export const WALK_SPEED = 1.05;
export const POP_DURATION = 0.35;
