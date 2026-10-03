import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Vector3 } from 'three';
import { getRegistry } from '@/content/registry';
import { formatMoney } from '@/core/money';
import { useGame } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import type { CameraApi } from '../camera/CameraRig';
import { DioramaStage, type RenderInfo } from '../DioramaStage';
import { DEFAULT_SCENE_LABELS, type SceneLabels } from '../labels';
import { PLINTH, ROOM, SPOTS } from '../layout';
import type { BubbleIcon } from '../overlay/overlayRegistry';
import { createDioramaRuntime } from '../runtime';
import { BUBBLE_ICON } from './agentMath';
import { activate, type LiveCallbacks, LiveCallbacksContext } from './interaction';
import { useRoster } from './LiveAgents';
import { CameraControls, FixtureKeys, ShopStatus, ZOOM_STEP } from './LiveControls';
import { LiveEvents } from './LiveEvents';
import { LiveOverlay } from './LiveOverlay';
import { LiveWorld, useShopLayout } from './LiveWorld';
import { doorWorldZ, shopWalls } from './layoutMath';
import { agentAnchorId, createLiveRuntime, LiveRuntimeContext } from './liveRuntime';
import type { LiveShopSceneProps } from './types';
import './live.css';

/**
 * The live, state-driven shop (docs/06 §7, roadmap Phase 2 "Tier-1 shop scene"): the art spike's
 * toy diorama, built from the game state. Fixtures and their stock come from `shop.fixtures`,
 * customers from `customers.active` (animated from `simNow()` every frame), lighting and the
 * OPEN sign from the clock, the shopkeeper from `meta.owner`. Clicks go back to the play screen
 * through the callbacks; the scene never dispatches commands itself.
 */

/** Debug-only extras (the /debug/live playground); the play screen doesn't pass them. */
export interface LiveSceneDebugProps {
  /** Force the day/evening blend (0…1) instead of following the sim clock. */
  eveningOverride?: number | null;
  showStats?: boolean;
  onRenderInfo?: (info: RenderInfo) => void;
}

const BUBBLE_KINDS = Object.keys(BUBBLE_ICON) as (keyof typeof BUBBLE_ICON)[];
/** Joins the sign texts into one memo key (a character no translation contains). */
const LABEL_SEPARATOR = '\u0001';

/** The whole plinth: the classic diorama view, for roomy screens. */
const FULL_FRAMING: readonly Vector3[] = (() => {
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

/**
 * Just the shop and its doorstep: on short screens (phone landscape) the room fills the free
 * space instead of shrinking to fit the street corners.
 */
const SHOP_FRAMING: readonly Vector3[] = (() => {
  const points: Vector3[] = [];
  const wx = ROOM.halfX + ROOM.wallThickness;
  const wz = ROOM.halfZ + ROOM.wallThickness;
  for (const x of [-wx - 0.7, wx]) {
    for (const z of [-wz, wz + 0.2]) {
      points.push(new Vector3(x, 0, z), new Vector3(x, ROOM.wallHeight * 0.8, z));
    }
  }
  return points;
})();

const COARSE_QUERY = '(pointer: coarse)';
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  };
}
const subscribeCoarse = subscribeMedia(COARSE_QUERY);
const subscribeMotion = subscribeMedia(MOTION_QUERY);

function useMedia(query: string, subscribe: (onChange: () => void) => () => void): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tracks the scene box so the framing can switch for short screens. */
function useBoxHeight(ref: RefObject<HTMLDivElement | null>): number {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    setHeight(el.clientHeight);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

/** The doorway's centre in world XZ (middle of the west wall's thickness, on the door tile). */
function doorCenter(layout: { grid: { w: number; d: number }; doorZ: number }) {
  return {
    x: -layout.grid.w / 2 - ROOM.wallThickness / 2,
    z: doorWorldZ(layout.doorZ, layout.grid),
  };
}

export default function LiveShopScene({
  quality,
  insets,
  anchored = null,
  shopName,
  onFixtureClick,
  onRegisterClick,
  onCustomerClick,
  onBackgroundClick,
  paused = false,
  className = '',
  eveningOverride = null,
  showStats = false,
  onRenderInfo,
}: LiveShopSceneProps & LiveSceneDebugProps) {
  const { t } = useTranslation('scene');
  const layout = useShopLayout();
  const phase = useGame((game) => game.clock.phase, 'prep');
  const walls = shopWalls(layout.grid, layout.doorZ);
  const [diorama] = useState(createDioramaRuntime);
  const [live] = useState(() =>
    createLiveRuntime(diorama.overlay, layout.grid, doorCenter(layout)),
  );

  // Comfort settings and device.
  const reducedSetting = useSettingsStore((store) => store.settings.reducedMotion);
  const reducedSystem = useMedia(MOTION_QUERY, subscribeMotion);
  const reduced = reducedSetting || reducedSystem;
  const coarse = useMedia(COARSE_QUERY, subscribeCoarse);

  // Insets by value: the play screen passes a fresh object on every layout pass.
  const { top = 0, right = 0, bottom = 0, left = 0 } = insets ?? {};
  const stableInsets = useMemo(() => ({ top, right, bottom, left }), [top, right, bottom, left]);

  // The latest callbacks, read when a click happens.
  const callbacks = useRef<LiveCallbacks>({});

  // Per-frame readers see this render's values (written after render, before paint).
  useLayoutEffect(() => {
    callbacks.current = { onFixtureClick, onRegisterClick, onCustomerClick, onBackgroundClick };
    live.grid = layout.grid;
    live.nav = layout.nav;
    live.doorCenter = doorCenter(layout);
    live.selected = anchored?.fixtureUid ?? null;
    live.reducedMotion = reduced;
    live.coarsePointer = coarse;
    live.dom.insets = stableInsets;
    live.dom.formatSale = (cents) => t('saleFloat', { amount: formatMoney(cents) });
    if (layout.register) {
      const r = layout.register.spots.register;
      live.dom.registerTop.set(r.x, 1.32, r.z);
    }
    diorama.overlay.reducedMotion = reduced;
    // Accessible bubble names (i18n).
    const labels: Partial<Record<BubbleIcon, string>> = {};
    for (const kind of BUBBLE_KINDS) labels[BUBBLE_ICON[kind]] = t(`bubble.${kind}`);
    diorama.overlay.labels = labels;
  });

  // Dev builds: expose the runtime for QA scripts and the console.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const target = globalThis as { __liveRuntime?: unknown };
    target.__liveRuntime = live;
    return () => {
      if (target.__liveRuntime === live) target.__liveRuntime = undefined;
    };
  }, [live]);

  // In-world signs: i18n copy, the player's shop name and the brand from content. Identity
  // matters (sign textures rebuild when the object changes), so it only changes with the text.
  const brand = getRegistry().brands.values().next().value?.name ?? DEFAULT_SCENE_LABELS.brand;
  const name = shopName?.trim() || t('labels.defaultShop');
  const labelStrings = [
    name.toUpperCase(),
    t('labels.address'),
    t('labels.open'),
    t('labels.closed'),
    t('labels.shelfHeader'),
    t('labels.bargainBin'),
    t('labels.bargainPrice'),
    t('labels.chalkboardTitle'),
    t('labels.chalkboardLine1'),
    t('labels.chalkboardLine2'),
    brand.toUpperCase(),
    t('labels.posterSubtitle'),
    t('labels.packCount'),
  ] as const;
  const labelsKey = labelStrings.join(LABEL_SEPARATOR);
  const labels = useMemo((): SceneLabels => {
    const [
      shop = '',
      address = '',
      open = '',
      closed = '',
      shelfHeader = '',
      bargainBin = '',
      bargainPrice = '',
      title = '',
      l1 = '',
      l2 = '',
      b = '',
      poster = '',
      count = '',
    ] = labelsKey.split(LABEL_SEPARATOR);
    return {
      shopName: shop,
      address,
      open,
      closed,
      shelfHeader,
      bargainBin,
      bargainPrice,
      chalkboardTitle: title,
      chalkboardLines: [l1, l2],
      brand: b,
      posterSubtitle: poster,
      packCount: count,
    };
  }, [labelsKey]);

  // Camera: quarter turns, zoom steps (the rig keeps wheel/pinch zoom between steps).
  const [cameraStep, setCameraStep] = useState(0);
  const cameraApi = useRef<CameraApi | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const boxHeight = useBoxHeight(boxRef);
  const freeHeight = boxHeight - stableInsets.top - stableInsets.bottom;
  const framing = freeHeight < 380 ? SHOP_FRAMING : FULL_FRAMING;

  const { roster, remove } = useRoster();
  const bubbleIds = roster.map((entry) => agentAnchorId(entry.uid));
  const owner = layout.register
    ? { position: layout.register.spots.owner, yaw: layout.register.spots.yaw }
    : null;

  return (
    <div ref={boxRef} className={`h-full w-full overflow-hidden bg-night ${className}`}>
      <LiveRuntimeContext value={live}>
        <LiveCallbacksContext value={callbacks}>
          <DioramaStage
            runtime={diorama}
            quality={quality}
            cameraStep={cameraStep}
            zoom={1}
            insets={stableInsets}
            framing={framing}
            labels={labels}
            reducedMotion={reduced}
            cameraApi={cameraApi}
            showStats={showStats}
            onRenderInfo={onRenderInfo}
            onPointerMissed={() => callbacks.current.onBackgroundClick?.()}
            paused={paused}
            overlay={
              <LiveOverlay
                live={live}
                bubbleIds={bubbleIds}
                anchored={anchored}
                ringUpLabel={t('ringUp')}
                ringUpAria={t('ringUpAria')}
                onRingUp={() => {
                  const register = layout.register?.placement.uid;
                  if (register)
                    activate(live, callbacks.current, { kind: 'register', uid: register });
                }}
              >
                <CameraControls
                  insets={stableInsets}
                  onRotate={(direction) => setCameraStep((step) => step + direction)}
                  onZoom={(direction) =>
                    cameraApi.current?.zoomBy(direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP)
                  }
                />
                <FixtureKeys
                  insets={stableInsets}
                  onFixture={(uid) => callbacks.current.onFixtureClick?.(uid)}
                  onRegister={(uid) => activate(live, callbacks.current, { kind: 'register', uid })}
                />
                <ShopStatus />
              </LiveOverlay>
            }
          >
            {/* Provided again inside the Canvas: a separate React renderer. */}
            <LiveRuntimeContext value={live}>
              <LiveCallbacksContext value={callbacks}>
                <LiveEvents />
                <LiveWorld
                  walls={walls}
                  grid={layout.grid}
                  phase={phase}
                  owner={owner}
                  roster={roster}
                  onGone={remove}
                  eveningOverride={eveningOverride}
                />
              </LiveCallbacksContext>
            </LiveRuntimeContext>
          </DioramaStage>
        </LiveCallbacksContext>
      </LiveRuntimeContext>
    </div>
  );
}
