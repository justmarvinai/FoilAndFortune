import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { Customer } from './agents/Customer';
import { Owner } from './agents/Owner';
import { BargainBin } from './fixtures/BargainBin';
import { Counter } from './fixtures/Counter';
import { DoorMat, PottedPlant, Rug, ShopCat, SnakePlant } from './fixtures/Decor';
import { DisplayCase } from './fixtures/DisplayCase';
import { AccentLight, PendantLamp, StringLights } from './fixtures/Lamps';
import { PackShelf } from './fixtures/PackShelf';
import { BoxShelf, Corkboard, MangaShelf, NeonSign, Poster, WallClock } from './fixtures/WallDecor';
import { DOOR, SPOTS, type Vec3, WALLS } from './layout';
import { cylinder } from './lib/geometry';
import { toyMaterial } from './lib/materials';
import { Sunbeam } from './lighting/Sunbeam';
import { useDioramaRuntime, useQuality } from './runtime';
import { tones } from './scenePalette';
import { Door } from './shell/Door';
import { ShopShell } from './shell/ShopShell';
import { StreetPlinth } from './shell/StreetPlinth';
import { Mounted } from './shell/Wall';
import { ShopWindow } from './shell/Window';

/**
 * The Tier-1 shop "The Nook" dressed for the art spike: the fixed starter layout from
 * `layout.ts` (Phase 2 replaces this with the player's Build Mode layout).
 */
function opening(side: 'west' | 'south', kind: 'door' | 'window') {
  const wall = WALLS.find((w) => w.side === side);
  const found = wall?.openings.find((o) => o.kind === kind);
  if (!found) throw new Error(`layout: no ${kind} on the ${side} wall`);
  return found;
}

const WEST_DOOR = opening('west', 'door');
const WEST_WINDOW = opening('west', 'window');
const SOUTH_WINDOW = opening('south', 'window');

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
        color="#FFE7B8"
        noise={0.6}
      />
    </group>
  );
}

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
        material={toyMaterial('#5B3A26')}
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

interface NookSceneProps {
  customerStartTime?: number;
  customerStartPhase?: string;
  freezeCustomer?: boolean;
}

export function NookScene({
  customerStartTime = 0,
  customerStartPhase,
  freezeCustomer = false,
}: NookSceneProps) {
  const quality = useQuality();
  return (
    <group>
      <StreetPlinth />
      <ShopShell
        mounts={{
          west: (
            <>
              <Mounted pivot={[WEST_DOOR.center, 1, 0]}>
                <Door
                  opening={WEST_DOOR}
                  triggerWorld={[DOOR.center[0], DOOR.center[2]]}
                  triggerRadius={DOOR.triggerRadius}
                  hinge="left"
                />
              </Mounted>
              <Mounted pivot={[WEST_WINDOW.center, 1.5, 0]}>
                <ShopWindow
                  opening={WEST_WINDOW}
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
              <Mounted position={[WEST_WINDOW.center, 1.63, 0.06]}>
                <NeonSign />
              </Mounted>
              <Mounted position={[2.11, 1.5, 0]}>
                <Poster />
              </Mounted>
              <Mounted pivot={[2.5, 2.3, 0]}>
                <StringLights from={[0.15, 2.4, 0.1]} to={[4.85, 2.4, 0.1]} sag={0.14} count={17} />
              </Mounted>
            </>
          ),
          north: (
            <>
              <Mounted position={[SPOTS.packShelf.position[0] + 3, 0, 0.21]}>
                <PackShelf
                  width={SPOTS.packShelf.width}
                  height={SPOTS.packShelf.height}
                  depth={SPOTS.packShelf.depth}
                />
              </Mounted>
              <Mounted position={[SPOTS.counter.position[0] + 3, 0, 0]}>
                <BoxShelf />
              </Mounted>
              <Mounted position={[3.24, 2.02, 0]}>
                <WallClock />
              </Mounted>
              <Mounted pivot={[4.4, 2.3, 0]}>
                <StringLights
                  from={[2.95, 2.42, 0.1]}
                  to={[5.85, 2.42, 0.1]}
                  sag={0.1}
                  count={11}
                />
              </Mounted>
            </>
          ),
          east: (
            <>
              <Mounted position={[1.4, 1.55, 0]}>
                <Corkboard />
              </Mounted>
              <Mounted position={[3.4, 0, 0]}>
                <MangaShelf />
              </Mounted>
            </>
          ),
          south: (
            <>
              <Mounted pivot={[SOUTH_WINDOW.center, 1.4, 0]}>
                <ShopWindow
                  opening={SOUTH_WINDOW}
                  view="south"
                  valanceColor={tones.teal}
                  sill={<SillPlant position={[0.6, 0, 0.02]} />}
                />
              </Mounted>
              <Mounted position={[1.1, 1.45, 0]}>
                <Poster tilt={-0.04} />
              </Mounted>
            </>
          ),
        }}
      />

      <group position={SPOTS.rug.position}>
        <Rug radius={SPOTS.rug.radius} />
      </group>
      <group position={SPOTS.doorMat.position}>
        <DoorMat />
      </group>
      <group position={SPOTS.counter.position}>
        <Counter
          width={SPOTS.counter.width}
          height={SPOTS.counter.height}
          depth={SPOTS.counter.depth}
        />
      </group>
      <group position={SPOTS.displayCase.position} rotation-y={-Math.PI / 2}>
        <DisplayCase
          length={SPOTS.displayCase.length}
          depth={SPOTS.displayCase.width}
          height={SPOTS.displayCase.height}
        />
      </group>
      <group position={SPOTS.bargainBin.position}>
        <BargainBin />
      </group>
      <group position={SPOTS.bigPlant.position}>
        <PottedPlant />
      </group>
      <group position={SPOTS.snakePlant.position}>
        <SnakePlant />
      </group>
      <PendantLamp position={SPOTS.pendantCounter.position} shadeColor={tones.teal} />
      <PendantLamp position={SPOTS.pendantCenter.position} shadeColor={tones.sun} />
      {quality.accentLights ? (
        <AccentLight
          position={[SPOTS.packShelf.position[0], 2.15, SPOTS.packShelf.position[2] + 0.75]}
          intensity={5}
          distance={3.2}
        />
      ) : null}
      <DustMotes count={quality.dustMotes} />
      <Sunbeam wall="west" from={[-3.02, 1.0, -0.16]} to={[-3.02, 2.0, -1.54]} />
      <Sunbeam wall="south" from={[0.74, 0.85, 2.48]} to={[-1.14, 1.95, 2.48]} strength={0.4} />

      <Owner position={SPOTS.owner.position} yaw={SPOTS.owner.yaw} />
      <Customer
        startTime={customerStartTime}
        startPhase={customerStartPhase}
        frozen={freezeCustomer}
      />
    </group>
  );
}
