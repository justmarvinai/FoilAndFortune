import { StatsGl } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { type ReactNode, useEffect, useState } from 'react';
import { NeutralToneMapping, type Vector3 } from 'three';
import { type CameraApi, CameraRig } from './camera/CameraRig';
import type { Insets } from './camera/cameraMath';
import { Effects } from './effects/Effects';
import { type SceneLabels, SceneLabelsContext } from './labels';
import { Background } from './lighting/Background';
import { Lighting } from './lighting/Lighting';
import { ProceduralEnvironment } from './lighting/ProceduralEnvironment';
import { type QualityLevel, qualityPresets } from './quality';
import { type DioramaRuntime, DioramaRuntimeContext, QualityContext } from './runtime';

export interface RenderInfo {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  /** Average frame time over the sample window, ms (render loop, not the GPU). */
  frameMs: number;
  /** Average main-thread time per frame in `useFrame` callbacks (scene logic), ms. */
  logicMs: number;
  /** Average main-thread time per frame inside `renderer.render` (submission), ms. */
  renderMs: number;
}

/** Keeps the runtime clock ticking first thing every frame (negative priority = before others). */
function RuntimeClock({ runtime }: { runtime: DioramaRuntime }) {
  useFrame((_, delta) => {
    runtime.time += Math.min(delta, 0.1);
  }, -10);
  return null;
}

/**
 * Debug readout sampled twice a second: draw calls and memory from `renderer.info`, plus the
 * main-thread cost per frame split into scene logic (`useFrame` callbacks: from this probe, the
 * first, to the frame's first render call) and render submission (time in `renderer.render`).
 */
function RenderInfoProbe({ onSample }: { onSample: (info: RenderInfo) => void }) {
  const gl = useThree((s) => s.gl);
  const [state] = useState(() => ({
    last: 0,
    frames: 0,
    frameStart: 0,
    rendered: false,
    logic: 0,
    render: 0,
  }));
  useEffect(() => {
    const original = gl.render.bind(gl);
    gl.render = (scene, camera) => {
      const t = performance.now();
      // The frame's first render call closes the logic window (every useFrame has run).
      if (!state.rendered) {
        state.rendered = true;
        state.logic += t - state.frameStart;
      }
      original(scene, camera);
      state.render += performance.now() - t;
    };
    return () => {
      gl.render = original;
    };
  }, [gl, state]);
  useFrame(({ clock }) => {
    state.frameStart = performance.now();
    state.rendered = false;
    // Read last frame's totals before resetting (autoReset is off so post passes accumulate).
    gl.info.autoReset = false;
    const now = clock.elapsedTime;
    state.frames += 1;
    if (now - state.last > 0.5) {
      const span = now - state.last;
      const frames = Math.max(1, state.frames);
      state.last = now;
      onSample({
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        frameMs: (span * 1000) / frames,
        logicMs: state.logic / frames,
        renderMs: state.render / frames,
      });
      state.frames = 0;
      state.logic = 0;
      state.render = 0;
    }
    gl.info.reset();
  }, -100);
  return null;
}

export interface DioramaStageProps {
  runtime: DioramaRuntime;
  quality: QualityLevel;
  /** Camera rotation step (0–3 are the four 90° views; any integer animates the short way). */
  cameraStep: number;
  zoom: number;
  insets: Insets;
  /** Points kept in frame by the auto-fit. */
  framing: readonly Vector3[];
  labels: SceneLabels;
  follow?: 'customer' | 'owner' | null;
  reducedMotion?: boolean;
  cameraApi?: { current: CameraApi | null };
  showStats?: boolean;
  onRenderInfo?: (info: RenderInfo) => void;
  /** A click that hit nothing interactive (R3F `onPointerMissed`). */
  onPointerMissed?: (event: MouseEvent) => void;
  /** Stops the render loop (the canvas keeps its last frame), e.g. under a full-screen overlay. */
  paused?: boolean;
  /** Scene content, inside the Canvas and the diorama contexts. */
  children: ReactNode;
  /** DOM layered over the canvas (world overlay, controls). */
  overlay?: ReactNode;
  className?: string;
}

/**
 * The shared diorama stage (docs/06 §7): Canvas, camera rig, sky, procedural environment,
 * time-of-day lighting and post effects per quality tier. The art spike (`ShopDiorama`) and the
 * live shop (`live/LiveShopScene`) put their own scene content and overlay in it.
 */
export function DioramaStage({
  runtime,
  quality,
  cameraStep,
  zoom,
  insets,
  framing,
  labels,
  follow = null,
  reducedMotion = false,
  cameraApi,
  showStats = false,
  onRenderInfo,
  onPointerMissed,
  paused = false,
  children,
  overlay,
  className,
}: DioramaStageProps) {
  const preset = qualityPresets[quality];
  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <Canvas
        key={quality}
        orthographic
        frameloop={paused ? 'never' : 'always'}
        shadows={preset.shadows ? 'percentage' : false}
        dpr={preset.dpr}
        gl={{ antialias: preset.antialias, powerPreference: 'high-performance', stencil: false }}
        camera={{ position: [30, 30, 30], zoom: 60, near: 0.1, far: 200 }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
        }}
        onPointerMissed={onPointerMissed}
      >
        <DioramaRuntimeContext value={runtime}>
          <QualityContext value={preset}>
            <SceneLabelsContext value={labels}>
              <RuntimeClock runtime={runtime} />
              <CameraRig
                step={cameraStep}
                zoom={zoom}
                insets={insets}
                framing={framing}
                follow={follow}
                reducedMotion={reducedMotion}
                api={cameraApi}
              />
              <Background />
              <ProceduralEnvironment resolution={preset.envResolution} />
              <Lighting
                shadows={preset.shadows}
                shadowMapSize={preset.shadowMapSize}
                shadowRadius={preset.shadowRadius}
              />
              {children}
              <Effects quality={preset} />
              {onRenderInfo ? <RenderInfoProbe onSample={onRenderInfo} /> : null}
              {showStats ? <StatsGl className="!left-auto !right-2 !top-2" /> : null}
            </SceneLabelsContext>
          </QualityContext>
        </DioramaRuntimeContext>
      </Canvas>
      {overlay}
    </div>
  );
}
