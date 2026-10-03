import { useFrame, useThree } from '@react-three/fiber';
import { BellRing } from 'lucide-react';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { useGameStore } from '@/state/gameStore';
import { WorldOverlay } from '../overlay/WorldOverlay';
import { placeAnchored, screenBounds } from './anchor';
import { type LiveRuntime, useLiveRuntime } from './liveRuntime';

/**
 * The live shop's single DOM overlay (docs/06 §7 `WorldOverlay`): customer bubbles, the anchored
 * Fixture Popover, the ring-up chip over the register and the `+$` sale floats. React renders the
 * elements once; `OverlayDriver` (inside the Canvas) projects their world anchors every frame and
 * writes `transform` and `opacity` straight to the DOM (no React render per frame).
 */

const FLOATS = 4;
const FLOAT_SECONDS = 1.5;

interface LiveOverlayProps {
  live: LiveRuntime;
  /** Bubble anchor ids of everyone on stage. */
  bubbleIds: readonly string[];
  anchored: { fixtureUid: string; content: ReactNode } | null;
  ringUpLabel: string;
  ringUpAria: string;
  onRingUp(): void;
  children?: ReactNode;
}

export function LiveOverlay({
  live,
  bubbleIds,
  anchored,
  ringUpLabel,
  ringUpAria,
  onRingUp,
  children,
}: LiveOverlayProps) {
  const anchoredRef = useRef<HTMLDivElement>(null);
  const anchoredUid = anchored?.fixtureUid ?? null;

  // Measure the anchored panel (its size decides above/below and the clamping). A layout effect,
  // so the panel is hidden before the first paint until the projector has placed it.
  useLayoutEffect(() => {
    const el = anchoredRef.current;
    live.dom.anchored = el;
    live.dom.anchoredUid = anchoredUid;
    live.dom.placement = null;
    if (!el) return;
    el.style.visibility = 'hidden';
    const measure = () => {
      live.dom.anchoredSize = { width: el.offsetWidth, height: el.offsetHeight };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (live.dom.anchored === el) live.dom.anchored = null;
    };
  }, [live, anchoredUid]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <WorldOverlay registry={live.overlay} ids={bubbleIds} labelled />
      {Array.from({ length: FLOATS }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed pool of identical float slots
          key={i}
          ref={(el) => {
            live.dom.floats[i] = el;
          }}
          aria-hidden="true"
          className="absolute top-0 left-0 font-display text-2xl text-sun opacity-0 [paint-order:stroke] [-webkit-text-stroke:5px_var(--color-ink)] [text-shadow:0_3px_0_var(--color-ink)] will-change-transform max-sm:text-xl"
        />
      ))}
      <button
        ref={(el) => {
          live.dom.ringUp = el;
        }}
        type="button"
        aria-label={ringUpAria}
        tabIndex={-1}
        onClick={onRingUp}
        className="ring-up absolute top-0 left-0 flex items-center gap-1.5 rounded-full border-[3px] border-ink bg-sun px-3 py-1 font-display text-base tracking-wide text-ink opacity-0 shadow-[0_3px_0_var(--color-ink)] transition-opacity duration-200 will-change-transform active:translate-y-[2px] active:shadow-none pointer-coarse:px-4 pointer-coarse:py-2"
        style={{ pointerEvents: 'none' }}
      >
        <BellRing className="ring-up-bell size-4" strokeWidth={2.8} aria-hidden="true" />
        {ringUpLabel}
      </button>
      {children}
      {anchored ? (
        <div
          key={anchored.fixtureUid}
          ref={anchoredRef}
          className="pointer-events-none absolute top-0 left-0 origin-top-left will-change-transform"
        >
          {anchored.content}
        </div>
      ) : null}
    </div>
  );
}

const corners = Array.from({ length: 8 }, () => new Vector3());
const projected = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
const tmp = new Vector3();

/** Inside the Canvas: projects the overlay's anchors once per frame (after agents, priority −1). */
export function OverlayDriver() {
  const live = useLiveRuntime();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const [floats] = useState(() =>
    Array.from({ length: FLOATS }, () => ({ start: -100, at: new Vector3() })),
  );
  const next = useRef(0);
  const clock = useRef(0);

  const toScreen = (v: Vector3, out: { x: number; y: number }) => {
    tmp.copy(v).project(camera);
    out.x = (tmp.x * 0.5 + 0.5) * size.width;
    out.y = (-tmp.y * 0.5 + 0.5) * size.height;
    return out;
  };

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.1);
    const now = clock.current;
    const dom = live.dom;

    // Anchored panel: above the fixture if it fits, else below; inside the free viewport.
    const el = dom.anchored;
    const info = dom.anchoredUid ? live.fixtures.get(dom.anchoredUid) : undefined;
    if (el && info && dom.anchoredSize.width > 0) {
      const { min, max } = info.bounds;
      let i = 0;
      for (const x of [min[0], max[0]]) {
        for (const y of [min[1], max[1]]) {
          for (const z of [min[2], max[2]]) {
            const corner = corners[i];
            const point = projected[i];
            if (corner && point) toScreen(corner.set(x, y, z), point);
            i += 1;
          }
        }
      }
      const target = screenBounds(projected);
      if (target) {
        const placed = placeAnchored({
          target,
          size: dom.anchoredSize,
          viewport: { width: size.width, height: size.height },
          insets: dom.insets,
          previous: dom.placement,
        });
        dom.placement = placed.placement;
        el.style.transform =
          placed.scale < 1
            ? `translate3d(${placed.x}px, ${placed.y}px, 0) scale(${placed.scale})`
            : `translate3d(${placed.x}px, ${placed.y}px, 0)`;
        if (el.style.visibility !== 'visible') el.style.visibility = 'visible';
      }
    }

    // Ring-up chip over the register while someone waits at the pay spot (shop open).
    const chip = dom.ringUp;
    if (chip) {
      const open = useGameStore.getState().game?.clock.phase === 'open';
      // The register's own popover has a ring-up button: no chip while it's open.
      const registerOpen = live.selected
        ? live.fixtures.get(live.selected)?.kind === 'register'
        : false;
      const show = open && live.paySpotUid !== null && !registerOpen;
      if (show !== dom.ringUpShown) {
        dom.ringUpShown = show;
        chip.style.opacity = show ? '1' : '0';
        chip.style.pointerEvents = show ? 'auto' : 'none';
        chip.tabIndex = show ? 0 : -1;
      }
      if (show) {
        const p = toScreen(dom.registerTop, { x: 0, y: 0 });
        const bob = live.reducedMotion ? 0 : Math.sin(now * 4) * 3;
        chip.style.transform = `translate3d(${p.x.toFixed(1)}px, ${(p.y + bob).toFixed(1)}px, 0) translate(-50%, -100%)`;
      }
    }

    // Sale floats: rise and fade from the register.
    for (const request of live.floats) {
      const index = next.current % FLOATS;
      next.current += 1;
      const slot = floats[index];
      if (!slot) continue;
      slot.start = now;
      slot.at.copy(request.at);
      const node = dom.floats[index];
      if (node) node.textContent = dom.formatSale(request.cents);
    }
    live.floats.length = 0;
    floats.forEach((slot, index) => {
      const node = dom.floats[index];
      if (!node) return;
      const t = (now - slot.start) / FLOAT_SECONDS;
      if (t < 0 || t > 1) {
        if (node.style.opacity !== '0') node.style.opacity = '0';
        return;
      }
      const p = toScreen(slot.at, { x: 0, y: 0 });
      const rise = live.reducedMotion ? 0 : (1 - (1 - t) ** 3) * 56;
      const pop = live.reducedMotion
        ? 1
        : t < 0.12
          ? 0.6 + (t / 0.12) * 0.5
          : t < 0.2
            ? 1.1 - ((t - 0.12) / 0.08) * 0.1
            : 1;
      node.style.opacity = String(t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
      node.style.transform = `translate3d(${p.x.toFixed(1)}px, ${(p.y - rise).toFixed(1)}px, 0) translate(-50%, -100%) scale(${pop.toFixed(3)})`;
    });
  }, -1);
  return null;
}
