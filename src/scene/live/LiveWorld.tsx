import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { type Group, MeshStandardMaterial } from 'three';
import { getRegistry } from '@/content/registry';
import type { GridSize } from '@/content/shop/geometry';
import { buildNavGrid, type NavFixture } from '@/sim/nav';
import { useGame, useGameStore } from '@/state/gameStore';
import { simNow } from '@/state/simClock';
import { DoorMat, Rug, ShopCat, SnakePlant } from '../fixtures/Decor';
import { AccentLight, PendantLamp, StringLights } from '../fixtures/Lamps';
import { signTexture } from '../fixtures/signs';
import { BoxShelf, Corkboard, NeonSign, Poster, WallClock } from '../fixtures/WallDecor';
import { useSceneLabels } from '../labels';
import { ROOM, type Vec3, type WallDef } from '../layout';
import { cylinder, plane, roundedBox, sphere } from '../lib/geometry';
import { toyMaterial, vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { Sunbeam } from '../lighting/Sunbeam';
import { OverlayProjector } from '../overlay/WorldOverlay';
import { useDioramaRuntime, useQuality } from '../runtime';
import { tones } from '../scenePalette';
import { Door } from '../shell/Door';
import { ShopShell } from '../shell/ShopShell';
import { StreetPlinth } from '../shell/StreetPlinth';
import { Mounted } from '../shell/Wall';
import { ShopWindow } from '../shell/Window';
import { eveningForClock } from './clockLight';
import { HighlightRing } from './HighlightRing';
import { useCursorReset } from './interaction';
import { LiveAgents, OwnerMat, type RosterEntry } from './LiveAgents';
import { LiveParticles } from './LiveEffects';
import { registerSpots, useFixtureNodes } from './LiveFixtures';
import { OverlayDriver } from './LiveOverlay';
import { type FixturePlacement, findOpening, parsePlacementKey, placementKey } from './layoutMath';
import { type AgentVisual, useLiveRuntime } from './liveRuntime';
import { ProductInstances } from './ProductInstances';
import { productRect } from './productAtlas';

/**
 * The live shop's 3D content (docs/06 §7 structure): the shell with the door on the layout's
 * door tile, the placed fixtures, decor that never blocks a walkable tile, the customers and the
 * shopkeeper, feedback sprites, the hover ring and the overlay drivers.
 */

/** Window-sill pot with a few blades (decor). */
function SillPlant({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh
        geometry={cylinder(0.06, 0.05, 0.09, 14)}
        material={toyMaterial(tones.coral)}
        position-y={0.045}
        castShadow
      />
      <mesh
        geometry={cylinder(0.055, 0.055, 0.012, 14)}
        material={toyMaterial(tones.walnut)}
        position-y={0.09}
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          geometry={cylinder(0.0, 0.028, 0.14, 6)}
          material={toyMaterial(i % 2 === 0 ? tones.leaf : tones.leafDark)}
          position={[Math.cos(i * 1.26) * 0.02, 0.15, Math.sin(i * 1.26) * 0.02]}
          rotation={[Math.sin(i * 1.26) * 0.35, 0, -Math.cos(i * 1.26) * 0.35]}
          scale={[1, 1, 0.4]}
        />
      ))}
    </group>
  );
}

/**
 * The shop's name board, standing on top of the door's wall like a theatre marquee (wall-local
 * frame: +z faces into the room, so the default camera reads it over the back wall). Painted on
 * both sides; it pops away with its wall when the wall is cut away.
 */
function NameBoard({ x, width = 1.75 }: { x: number; width?: number }) {
  const labels = useSceneLabels();
  const height = 0.46;
  const top = ROOM_TOP + 0.08 + height;
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        map: signTexture(labels.shopName, tones.teal, tones.paper, 640, 168),
        roughness: 0.5,
      }),
    [labels.shopName],
  );
  useEffect(() => () => material.dispose(), [material]);
  const frame = cachedMerge(`name-board:${width}`, () => {
    const parts: Part[] = [
      {
        geometry: roundedBox(width + 0.08, height + 0.08, 0.06, 0.03, 2),
        color: tones.woodDark,
        position: [0, top - height / 2, 0],
      },
      ...[-0.36, 0.36].map<Part>((f) => ({
        geometry: roundedBox(0.05, 0.12, 0.05, 0.015, 1),
        color: tones.iron,
        position: [f * width, ROOM_TOP + 0.05, 0],
      })),
      {
        geometry: sphere(0.035, 10, 8),
        color: tones.brass,
        position: [-width / 2 - 0.02, top + 0.02, 0],
      },
      {
        geometry: sphere(0.035, 10, 8),
        color: tones.brass,
        position: [width / 2 + 0.02, top + 0.02, 0],
      },
    ];
    return parts;
  });
  return (
    <group position={[x, 0, -0.1]}>
      <mesh geometry={frame} material={vertexColorMaterial({ roughness: 0.5 })} castShadow />
      {[1, -1].map((side) => (
        <mesh
          key={side}
          geometry={plane(width, height)}
          material={material}
          position={[0, top - height / 2, side * 0.032]}
          rotation={[0, side > 0 ? 0 : Math.PI, 0]}
        />
      ))}
    </group>
  );
}

/** Floating dust motes in the window light by day; they fade out at dusk. */
function DustMotes({ count }: { count: number }) {
  const runtime = useDioramaRuntime();
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = runtime.evening < 0.6;
  });
  if (count <= 0) return null;
  return (
    <group ref={ref}>
      <Sparkles
        count={count}
        scale={[1.6, 1.7, 2.4]}
        position={[-2.1, 1.25, -0.8]}
        size={2.2}
        speed={0.18}
        opacity={0.55}
        color={tones.sun}
        noise={0.6}
      />
    </group>
  );
}

/**
 * Drives the day/evening blend and the wall clock from the sim clock, and the door from the
 * agents in the doorway (runs before the lighting driver).
 */
function ClockDriver({ override }: { override: number | null }) {
  const runtime = useDioramaRuntime();
  const live = useLiveRuntime();
  useLayoutEffect(() => {
    const radius2 = 1.05 * 1.05;
    const near = (v: AgentVisual) => {
      const dx = v.x - live.doorCenter.x;
      const dz = v.z - live.doorCenter.z;
      return v.placed && v.pop > 0.2 && dx * dx + dz * dz < radius2;
    };
    runtime.door.sensor = () => {
      for (const v of live.agents.values()) if (near(v)) return true;
      return false;
    };
    // Start in the right light instead of fading in from noon.
    const clock = useGameStore.getState().game?.clock;
    const initial = override ?? (clock ? eveningForClock(clock.phase, clock.minute) : 0);
    runtime.evening = initial;
    runtime.eveningTarget = initial;
    return () => {
      runtime.door.sensor = null;
    };
  }, [runtime, live, override]);
  useFrame(() => {
    const clock = useGameStore.getState().game?.clock;
    const minute = clock?.phase === 'open' ? simNow() : (clock?.minute ?? 9 * 60);
    runtime.clockMinutes = minute;
    runtime.eveningTarget = override ?? (clock ? eveningForClock(clock.phase, minute) : 0);
  }, -9);
  return null;
}

const ROOM_TOP = ROOM.wallHeight;
const HYDRANT = [-4.36, 0, 2.35] as const;
const BOX_SHELF_WIDTH = 1.6;
/** Lower shelf of the BoxShelf (WallDecor.tsx) in its local frame. */
const BOX_SHELF_LOW = 1.24;

/** Up to three boxed products from the closet (sealed booster boxes), as `id,id,…`. */
function closetBoxesKey(sealed: Record<string, readonly { qty: number }[]>): string {
  const registry = getRegistry();
  const ids: string[] = [];
  for (const [productId, lots] of Object.entries(sealed)) {
    if (registry.products.get(productId)?.kind !== 'box') continue;
    const qty = lots.reduce((sum, lot) => sum + lot.qty, 0);
    for (let i = 0; i < qty && ids.length < 3; i++) ids.push(productId);
  }
  return ids.join(',');
}

/**
 * The wall shelf behind the counter shows the closet's sealed booster boxes, starting with Theo's
 * (docs/02 §2, "the first open or sell? choice"): open or unbox it and it leaves the shelf.
 */
function BehindCounterShelf() {
  const key = useGame((game) => closetBoxesKey(game.inventory.sealed), NO_KEY);
  const units = key
    ? key.split(',').map((productId, i) => ({
        position: [-BOX_SHELF_WIDTH * 0.42 + i * 0.36, BOX_SHELF_LOW + 0.03 + 0.11, 0.15] as const,
        rotation: [0, -0.05 + i * 0.05, 0] as const,
        scale: 1.3,
        rect: productRect(productId, 0),
      }))
    : [];
  return (
    <group>
      <BoxShelf width={BOX_SHELF_WIDTH} boxes={false} />
      {units.length > 0 ? (
        <ProductInstances shape="box" units={units} capacity={3} castShadow />
      ) : null}
    </group>
  );
}

const NO_KEY = '';

/** Grid, walls, navigation and the register spots, from the current layout. */
export function useShopLayout() {
  const layoutId = useGame((game) => game.shop.layoutId, NO_KEY);
  const key = useGame((game) => placementKey(game.shop.fixtures), NO_KEY);
  const registry = getRegistry();
  const layout = registry.layouts.get(layoutId) ?? registry.layouts.values().next().value;
  const grid: GridSize = layout?.grid ?? { w: 6, d: 5 };
  const doorZ = layout?.door.z ?? 3;
  const placements = parsePlacementKey(key);
  const navFixtures: NavFixture[] = placements.flatMap((placed) => {
    const def = registry.fixtures.get(placed.fixtureId);
    return def ? [{ placed, def }] : [];
  });
  const nav = buildNavGrid(grid, doorZ, navFixtures);
  let register: { placement: FixturePlacement; spots: ReturnType<typeof registerSpots> } | null =
    null;
  for (const placement of placements) {
    const def = registry.fixtures.get(placement.fixtureId);
    if (def?.category === 'register') {
      register = { placement, spots: registerSpots(placement, def, grid) };
      break;
    }
  }
  return { grid, doorZ, nav, register, key };
}

interface LiveWorldProps {
  walls: readonly WallDef[];
  grid: GridSize;
  phase: 'prep' | 'open' | 'night';
  owner: { position: { x: number; z: number }; yaw: number } | null;
  roster: readonly RosterEntry[];
  onGone: (key: string) => void;
  eveningOverride: number | null;
}

export function LiveWorld({
  walls,
  grid,
  phase,
  owner,
  roster,
  onGone,
  eveningOverride,
}: LiveWorldProps) {
  const quality = useQuality();
  const labels = useSceneLabels();
  const live = useLiveRuntime();
  useCursorReset();
  const { mounts, floor } = useFixtureNodes(walls, grid);
  const door = findOpening(walls, 'west', 'door');
  const westWindow = findOpening(walls, 'west', 'window');
  const southWindow = findOpening(walls, 'south', 'window');
  const doorZ = live.doorCenter.z;
  const halfX = grid.w / 2;
  const halfZ = grid.d / 2;

  return (
    <group>
      <ClockDriver override={eveningOverride} />
      {/* The hydrant moves to the curb: customers appear and vanish on the street corner. */}
      <StreetPlinth hydrant={HYDRANT} />
      <ShopShell
        walls={walls}
        mounts={{
          west: (
            <>
              {door ? (
                <Mounted pivot={[door.center, 1, 0]}>
                  <Door
                    opening={door}
                    triggerWorld={[live.doorCenter.x, doorZ]}
                    triggerRadius={1.05}
                    hinge="left"
                  />
                </Mounted>
              ) : null}
              {door ? (
                <Mounted pivot={[door.center, ROOM_TOP, 0]}>
                  <NameBoard x={door.center} />
                </Mounted>
              ) : null}
              {westWindow ? (
                <>
                  <Mounted pivot={[westWindow.center, 1.5, 0]}>
                    <ShopWindow
                      opening={westWindow}
                      view="west"
                      sill={
                        <>
                          <group position={[0.38, 0, 0.02]} rotation-y={-0.25}>
                            <ShopCat />
                          </group>
                          <SillPlant position={[-0.52, 0, 0.02]} />
                        </>
                      }
                    />
                  </Mounted>
                  <Mounted position={[westWindow.center, 1.63, 0.06]}>
                    <NeonSign
                      text={phase === 'open' ? labels.open : labels.closed}
                      on={phase === 'open'}
                    />
                  </Mounted>
                </>
              ) : null}
              <Mounted pivot={[grid.d / 2, 2.3, 0]}>
                <StringLights
                  from={[0.15, 2.4, 0.1]}
                  to={[grid.d - 0.15, 2.4, 0.1]}
                  sag={0.14}
                  count={17}
                />
              </Mounted>
              {mounts.west}
            </>
          ),
          north: (
            <>
              {owner ? (
                <Mounted position={[owner.position.x + halfX, 0, 0]}>
                  <BehindCounterShelf />
                </Mounted>
              ) : null}
              <Mounted position={[owner ? owner.position.x + halfX - 1.15 : 3.95, 2.06, 0]}>
                <WallClock />
              </Mounted>
              <Mounted pivot={[grid.w - 1.6, 2.3, 0]}>
                <StringLights
                  from={[grid.w - 3.05, 2.42, 0.1]}
                  to={[grid.w - 0.15, 2.42, 0.1]}
                  sag={0.1}
                  count={11}
                />
              </Mounted>
              {mounts.north}
            </>
          ),
          east: (
            <>
              <Mounted position={[1.35, 1.55, 0]}>
                <Corkboard />
              </Mounted>
              {mounts.east}
            </>
          ),
          south: (
            <>
              {southWindow ? (
                <Mounted pivot={[southWindow.center, 1.4, 0]}>
                  <ShopWindow
                    opening={southWindow}
                    view="south"
                    valanceColor={tones.teal}
                    sill={<SillPlant position={[0.6, 0, 0.02]} />}
                  />
                </Mounted>
              ) : null}
              <Mounted position={[1.1, 1.45, 0]}>
                <Poster tilt={-0.04} />
              </Mounted>
              {mounts.south}
            </>
          ),
        }}
      />
      {/* Floor decor: flat or tucked into corners, never on a tile the sim walks through. */}
      <group position={[-1, 0, -0.45]}>
        <Rug radius={0.95} />
      </group>
      <group position={[-halfX + 0.38, 0, doorZ]}>
        <DoorMat />
      </group>
      <group position={[halfX - 0.3, 0, -halfZ + 0.3]}>
        <group scale={0.82}>
          <SnakePlant />
        </group>
      </group>
      {owner ? <OwnerMat position={owner.position} /> : null}
      {floor}
      <PendantLamp
        position={[owner ? owner.position.x + 0.2 : 2, 2.2, -1]}
        shadeColor={tones.teal}
      />
      <PendantLamp position={[-1, 2.25, 0.05]} shadeColor={tones.sun} />
      {quality.accentLights ? (
        <AccentLight position={[-1, 2.15, -1.6]} intensity={6} distance={3.6} />
      ) : null}
      <DustMotes count={quality.dustMotes} />
      {westWindow ? (
        <Sunbeam
          wall="west"
          from={[
            -halfX - 0.02,
            westWindow.bottom + 0.05,
            halfZ - westWindow.center + westWindow.width / 2 - 0.06,
          ]}
          to={[
            -halfX - 0.02,
            westWindow.top - 0.05,
            halfZ - westWindow.center - westWindow.width / 2 + 0.06,
          ]}
        />
      ) : null}
      {southWindow ? (
        <Sunbeam
          wall="south"
          from={[
            halfX - southWindow.center + southWindow.width / 2 - 0.06,
            southWindow.bottom + 0.05,
            halfZ - 0.02,
          ]}
          to={[
            halfX - southWindow.center - southWindow.width / 2 + 0.06,
            southWindow.top - 0.05,
            halfZ - 0.02,
          ]}
          strength={0.4}
        />
      ) : null}
      <LiveAgents roster={roster} onGone={onGone} owner={owner} />
      <LiveParticles />
      <HighlightRing />
      <OverlayProjector registry={live.overlay} />
      <OverlayDriver />
    </group>
  );
}
