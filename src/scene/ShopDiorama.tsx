import { StatsGl } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { NeutralToneMapping, Vector3 } from 'three';
import type { Expression } from './agents/faces';
import { CameraRig } from './camera/CameraRig';
import { type Insets, NO_INSETS } from './camera/cameraMath';
import { Effects } from './effects/Effects';
import { DEFAULT_SCENE_LABELS, type SceneLabels, SceneLabelsContext } from './labels';
import { PLINTH, ROOM, SPOTS } from './layout';
import { Background } from './lighting/Background';
import { Lighting } from './lighting/Lighting';
import { ProceduralEnvironment } from './lighting/ProceduralEnvironment';
import type { TimeOfDay } from './lighting/presets';
import { NookScene } from './NookScene';
import { OverlayProjector, WorldOverlay } from './overlay/WorldOverlay';
import { type QualityLevel, qualityPresets } from './quality';
import {
  createDioramaRuntime,
  type DioramaRuntime,
  DioramaRuntimeContext,
  QualityContext,
} from './runtime';

export interface RenderInfo {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export interface ShopDioramaProps {
  timeOfDay?: TimeOfDay;
  quality?: QualityLevel;
  /** Camera rotation step: 0–3 are the four 90° views; any integer works (animates the short way). */
  cameraAngle?: number;
  /** Zoom over the auto-fit framing (1 = whole diorama); clamped to the rig's limits. */
  zoom?: number;
  /** Force the customer's face, or `'auto'` to let the demo script pick expressions. */
  customerExpression?: Expression | 'auto';
  /** drei <StatsGl> overlay (FPS/CPU/GPU). */
  showStats?: boolean;
  /** Screen areas covered by UI, in px, so the diorama frames itself in the free space. */
  insets?: Partial<Insets>;
  /** In-world sign text (i18n / shop name hook). */
  labels?: Partial<SceneLabels>;
  /** Start the customer loop this many seconds in (handy for QA screenshots). */
  customerStartTime?: number;
  /** Keep the camera centred on an agent (debug close-ups). */
  follow?: 'customer' | 'owner' | null;
  /** Freeze the customer's script at `customerStartTime` (poses keep animating). */
  freezeCustomer?: boolean;
  /** Fast-forward the customer to a script phase first (e.g. 'checkout', 'paid'). */
  customerStartPhase?: string;
  /** Sampled about twice a second (draw calls etc.) for debug readouts. */
  onRenderInfo?: (info: RenderInfo) => void;
  className?: string;
  children?: ReactNode;
}

const OVERLAY_IDS = ['customer'] as const;

/**
 * What must stay in frame: the plinth's corners (top and bottom), the tops of the walls and the
 * tall street props. Tighter than a bounding box, which would reserve sky above the plinth's
 * empty corners (it matters on phones).
 */
const FRAMING_POINTS: readonly Vector3[] = (() => {
  const points: Vector3[] = [];
  for (const x of [PLINTH.minX, PLINTH.maxX]) {
    for (const z of [PLINTH.minZ, PLINTH.maxZ]) {
      points.push(new Vector3(x, PLINTH.baseBottom, z), new Vector3(x, 0, z));
    }
  }
  const wx = ROOM.halfX + ROOM.wallThickness;
  const wz = ROOM.halfZ + ROOM.wallThickness;
  for (const x of [-wx, wx]) {
    for (const z of [-wz, wz]) points.push(new Vector3(x, ROOM.wallHeight + 0.05, z));
  }
  const lamp = SPOTS.lampPost.position;
  points.push(new Vector3(lamp[0], 3.05, lamp[2]));
  return points;
})();

/** Keeps the runtime clock ticking first thing every frame (negative priority = before others). */
function RuntimeClock({ runtime }: { runtime: DioramaRuntime }) {
  useFrame((_, delta) => {
    runtime.time += Math.min(delta, 0.1);
  }, -10);
  return null;
}

function RenderInfoProbe({ onSample }: { onSample: (info: RenderInfo) => void }) {
  const [state] = useState(() => ({ last: 0 }));
  useFrame(({ gl, clock }) => {
    // Read last frame's totals before resetting (autoReset is off so post passes accumulate).
    gl.info.autoReset = false;
    const now = clock.elapsedTime;
    if (now - state.last > 0.5) {
      state.last = now;
      onSample({
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      });
    }
    gl.info.reset();
  }, -100);
  return null;
}

/**
 * The 3D toy-diorama shop (docs/04 §4, docs/06 §7): the Tier-1 shop "The Nook" on a street
 * plinth, with procedural fixtures, Peg-folk and time-of-day lighting.
 */
export function ShopDiorama({
  timeOfDay = 'day',
  quality = 'medium',
  cameraAngle = 0,
  zoom = 1,
  customerExpression = 'auto',
  showStats = false,
  insets,
  labels,
  customerStartTime = 0,
  follow = null,
  freezeCustomer = false,
  customerStartPhase,
  onRenderInfo,
  className,
  children,
}: ShopDioramaProps) {
  const preset = qualityPresets[quality];
  const [runtime] = useState(() => {
    const r = createDioramaRuntime();
    // Start already in the requested lighting instead of fading in from day.
    r.evening = timeOfDay === 'evening' ? 1 : 0;
    r.eveningTarget = r.evening;
    return r;
  });
  useEffect(() => {
    runtime.eveningTarget = timeOfDay === 'evening' ? 1 : 0;
  }, [runtime, timeOfDay]);
  useEffect(() => {
    runtime.customerExpressionOverride = customerExpression === 'auto' ? null : customerExpression;
  }, [runtime, customerExpression]);

  // Identity matters here (not speed): label-derived canvas textures and materials are rebuilt
  // when this object changes, so it must only change when the labels do.
  const mergedLabels = useMemo(() => ({ ...DEFAULT_SCENE_LABELS, ...labels }), [labels]);
  const mergedInsets = useMemo(() => ({ ...NO_INSETS, ...insets }), [insets]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <Canvas
        key={quality}
        orthographic
        shadows={preset.shadows ? 'percentage' : false}
        dpr={preset.dpr}
        gl={{ antialias: preset.antialias, powerPreference: 'high-performance', stencil: false }}
        camera={{ position: [30, 30, 30], zoom: 60, near: 0.1, far: 200 }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
        }}
      >
        <DioramaRuntimeContext value={runtime}>
          <QualityContext value={preset}>
            <SceneLabelsContext value={mergedLabels}>
              <RuntimeClock runtime={runtime} />
              <CameraRig
                step={cameraAngle}
                zoom={zoom}
                insets={mergedInsets}
                framing={FRAMING_POINTS}
                follow={follow}
              />
              <Background />
              <ProceduralEnvironment resolution={preset.envResolution} />
              <Lighting
                shadows={preset.shadows}
                shadowMapSize={preset.shadowMapSize}
                shadowRadius={preset.shadowRadius}
              />
              <NookScene
                customerStartTime={customerStartTime}
                customerStartPhase={customerStartPhase}
                freezeCustomer={freezeCustomer}
              />
              {children}
              <OverlayProjector registry={runtime.overlay} />
              <Effects quality={preset} />
              {onRenderInfo ? <RenderInfoProbe onSample={onRenderInfo} /> : null}
              {showStats ? <StatsGl className="!left-auto !right-2 !top-2" /> : null}
            </SceneLabelsContext>
          </QualityContext>
        </DioramaRuntimeContext>
      </Canvas>
      <WorldOverlay registry={runtime.overlay} ids={OVERLAY_IDS} />
    </div>
  );
}
