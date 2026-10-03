import { type ReactNode, useLayoutEffect, useRef } from 'react';
import type { Group } from 'three';
import { getRegistry } from '@/content/registry';
import type { FixtureDef } from '@/content/schema/shop';
import type { GridSize } from '@/content/shop/geometry';
import { useGame } from '@/state/gameStore';
import { Counter } from '../fixtures/Counter';
import { PottedPlant } from '../fixtures/Decor';
import { Poster } from '../fixtures/WallDecor';
import type { WallDef, WallSide } from '../layout';
import { roundedBox } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge } from '../lib/merge';
import { tones } from '../scenePalette';
import { Mounted } from '../shell/Wall';
import { CASE, CaseFixture } from './CaseFixture';
import { colliderMaterial, usePickable } from './interaction';
import {
  type FixturePlacement,
  fixtureBounds,
  fixtureFrame,
  fixtureHeights,
  modelOrigin,
  parsePlacementKey,
  placementKey,
  worldToWall,
} from './layoutMath';
import { type FixtureInfo, type HoverTarget, useLiveRuntime } from './liveRuntime';
import { SHELF, WallShelf } from './WallShelf';

/**
 * Fixtures placed from `shop.fixtures` (docs/06 §7 `<Fixtures />`): each picks its procedural
 * model by kind, stands on its footprint (wall-mounted ones hang on their wall and pop away with
 * it when the wall is cut away), registers its bounds for the overlay and highlight, and carries
 * an invisible collider for picking.
 */

export const COUNTER = { width: 1.9, height: 0.74, depth: 0.62 } as const;
/** Where the cash register sits on the counter (Counter.tsx), counter-local. */
export const REGISTER_ON_COUNTER = [-0.36, COUNTER.height, -0.02] as const;

type FixtureKind = FixtureInfo['kind'];

function kindOf(def: FixtureDef): FixtureKind {
  switch (def.category) {
    case 'shelf':
    case 'rack':
    case 'pegboard':
      return 'shelf';
    case 'case':
      return 'case';
    case 'register':
      return 'register';
    default:
      return 'decor';
  }
}

/** Model depth (front to back) per kind, for wall placement and bounds. */
function modelDepth(def: FixtureDef): number {
  switch (kindOf(def)) {
    case 'shelf':
      return SHELF.depth;
    case 'case':
      return CASE.depth;
    case 'register':
      return COUNTER.depth;
    default:
      return def.wallMounted ? 0.06 : 0.6;
  }
}

/** A plain crate for fixtures without a model yet (future catalog entries). */
function Crate({ width, depth }: { width: number; depth: number }) {
  const geometry = cachedMerge(`live-crate:${width}:${depth}`, () => [
    { geometry: roundedBox(width, 0.7, depth, 0.04, 2), color: tones.wood, position: [0, 0.35, 0] },
    {
      geometry: roundedBox(width + 0.02, 0.06, depth + 0.02, 0.02, 1),
      color: tones.woodDark,
      position: [0, 0.7, 0],
    },
  ]);
  return <mesh geometry={geometry} material={vertexColorMaterial()} castShadow receiveShadow />;
}

function FixtureModel({ placement, def }: { placement: FixturePlacement; def: FixtureDef }) {
  switch (kindOf(def)) {
    case 'shelf':
      return <WallShelf uid={placement.uid} seed={placement.x * 7 + placement.z * 13 + 1} />;
    case 'case':
      return <CaseFixture uid={placement.uid} />;
    case 'register':
      return <Counter width={COUNTER.width} height={COUNTER.height} depth={COUNTER.depth} />;
    default:
      if (def.wallMounted) {
        return (
          <group position={[0, 1.5, 0]}>
            <Poster width={0.56} height={0.74} tilt={-0.03} />
          </group>
        );
      }
      if (def.id === 'fx.decor.plant') return <PottedPlant seed={placement.x + placement.z * 3} />;
      return <Crate width={def.footprint.w - 0.2} depth={def.footprint.d - 0.2} />;
  }
}

/** Invisible pick box over the model (local frame), a bit larger for fingers. */
function Collider({
  target,
  width,
  depth,
  bottom,
  top,
}: {
  target: HoverTarget;
  width: number;
  depth: number;
  bottom: number;
  top: number;
}) {
  const runtime = useLiveRuntime();
  const handlers = usePickable(target);
  const pad = runtime.coarsePointer ? 0.12 : 0.04;
  return (
    <mesh
      geometry={roundedBox(width + pad * 2, top - bottom + pad, depth + pad * 2, 0.01, 1)}
      material={colliderMaterial}
      position={[0, (top + bottom) / 2, 0]}
      {...handlers}
    />
  );
}

interface PlacedProps {
  placement: FixturePlacement;
  def: FixtureDef;
  grid: GridSize;
  wall: WallDef | null;
}

function PlacedFixture({ placement, def, grid, wall }: PlacedProps) {
  const runtime = useLiveRuntime();
  const frame = fixtureFrame(placement, def, grid);
  const depth = modelDepth(def);
  const origin = modelOrigin(frame, def.footprint.d, depth);
  const kind = kindOf(def);
  // Bounds for anchoring the popover and placing the hover ring.
  const bounds = fixtureBounds(frame, def, depth);
  const liftRef = useRef<Group>(null);
  useLayoutEffect(() => {
    runtime.fixtures.set(placement.uid, {
      uid: placement.uid,
      kind,
      bounds,
      wall: frame.wall,
      lift: liftRef.current,
    });
    return () => {
      runtime.fixtures.delete(placement.uid);
    };
  }, [runtime, placement.uid, kind, bounds, frame.wall]);
  const heights = fixtureHeights(def);
  const target: HoverTarget =
    kind === 'register'
      ? { kind: 'register', uid: placement.uid }
      : { kind: 'fixture', uid: placement.uid };
  const width = def.footprint.w - (frame.wall ? 0.1 : 0.08);
  const content: ReactNode = (
    <group ref={liftRef}>
      <FixtureModel placement={placement} def={def} />
      <Collider
        target={target}
        width={width}
        depth={frame.wall ? depth : Math.min(def.footprint.d - 0.1, depth + 0.1)}
        bottom={heights.bottom}
        top={heights.top}
      />
    </group>
  );
  if (wall) {
    const local = worldToWall(wall, origin, frame.yaw);
    return (
      <Mounted position={[local.x, 0, local.z]} rotation={[0, local.yaw, 0]}>
        {content}
      </Mounted>
    );
  }
  return (
    <group position={[origin.x, 0, origin.z]} rotation-y={frame.yaw}>
      {content}
    </group>
  );
}

const NO_KEY = '';

/** The placed fixtures, split into wall mounts (per wall) and floor fixtures. */
export function useFixtureNodes(walls: readonly WallDef[], grid: GridSize) {
  const key = useGame((game) => placementKey(game.shop.fixtures), NO_KEY);
  const registry = getRegistry();
  const placements = parsePlacementKey(key);
  const mounts: Partial<Record<WallSide, ReactNode[]>> = {};
  const floor: ReactNode[] = [];
  for (const placement of placements) {
    const def = registry.fixtures.get(placement.fixtureId);
    if (!def) continue;
    const frame = fixtureFrame(placement, def, grid);
    const wall = frame.wall ? (walls.find((w) => w.side === frame.wall) ?? null) : null;
    const node = (
      <PlacedFixture key={placement.uid} placement={placement} def={def} grid={grid} wall={wall} />
    );
    if (wall) {
      const list = mounts[wall.side] ?? [];
      list.push(node);
      mounts[wall.side] = list;
    } else floor.push(node);
  }
  return { mounts, floor, placements };
}

/** World position of the counter's cash register top and where the owner stands. */
export function registerSpots(placement: FixturePlacement, def: FixtureDef, grid: GridSize) {
  const frame = fixtureFrame(placement, def, grid);
  const origin = modelOrigin(frame, def.footprint.d, COUNTER.depth);
  const c = Math.cos(frame.yaw);
  const s = Math.sin(frame.yaw);
  // Counter-local → world (rotation about +y).
  const toWorld = (x: number, z: number) => ({
    x: origin.x + x * c + z * s,
    z: origin.z - x * s + z * c,
  });
  const register = toWorld(REGISTER_ON_COUNTER[0], REGISTER_ON_COUNTER[2]);
  const owner = toWorld(REGISTER_ON_COUNTER[0] + 0.12, -(COUNTER.depth / 2 + 0.36));
  return { register, owner, yaw: frame.yaw };
}
