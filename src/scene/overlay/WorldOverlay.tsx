import { useFrame, useThree } from '@react-three/fiber';
import { useState } from 'react';
import { Vector3 } from 'three';
import { BUBBLE_ICON_NAMES, INTENT_ICONS } from './IntentIcons';
import type { OverlayRegistry } from './overlayRegistry';

/**
 * The single DOM overlay layer for world-anchored UI (docs/06 §7 `WorldOverlay`): one absolutely
 * positioned element per anchor, moved by writing `transform` directly each frame. Bubbles are
 * plain DOM so they stay crisp, accessible and cheap (no drei <Html> per character).
 */
export function WorldOverlay({
  registry,
  ids,
  labelled = false,
}: {
  registry: OverlayRegistry;
  ids: readonly string[];
  /**
   * Bubbles carry accessible names from `registry.labels` (set by the projector as icons
   * change). Off, the whole layer is decorative.
   */
  labelled?: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden={labelled ? undefined : 'true'}
    >
      {ids.map((id) => (
        <div
          key={id}
          ref={registry.refFor(id)}
          aria-hidden={labelled ? 'true' : undefined}
          className="absolute top-0 left-0 opacity-0 transition-opacity duration-200 will-change-transform"
        >
          <div className="-translate-x-1/2 -translate-y-full pb-3">
            <div data-bubble className="relative origin-bottom">
              <div className="grid size-11 place-items-center rounded-2xl border-[3px] border-ink bg-white p-1.5 shadow-[0_3px_0_var(--color-ink)] max-sm:size-9 max-sm:p-1 [@media(max-height:500px)]:size-8 [@media(max-height:500px)]:rounded-xl [@media(max-height:500px)]:p-1">
                {BUBBLE_ICON_NAMES.map((name) => (
                  <span key={name} data-icon-name={name} className="hidden size-full">
                    {INTENT_ICONS[name]}
                  </span>
                ))}
              </div>
              {/* Speech-bubble tail. */}
              <div className="absolute -bottom-2 left-1/2 size-3.5 -translate-x-1/2 rotate-45 border-r-[3px] border-b-[3px] border-ink bg-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * Inside the Canvas: projects every anchor once per frame and writes the DOM directly. Mount it
 * after the agents so it reads this frame's head positions.
 */
export function OverlayProjector({ registry }: { registry: OverlayRegistry }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const [v] = useState(() => new Vector3());
  useFrame(() => {
    for (const anchor of registry.anchors.values()) {
      const el = registry.elements.get(anchor.id);
      if (!el) continue;
      v.copy(anchor.position).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (anchor.icon !== anchor.shownIcon) {
        const previous = anchor.shownIcon;
        anchor.shownIcon = anchor.icon;
        el.style.opacity = anchor.icon ? '1' : '0';
        const label = anchor.icon ? registry.labels?.[anchor.icon] : undefined;
        if (registry.labels) {
          // Only a visible bubble is announced; a hidden one leaves the accessibility tree.
          if (label) {
            el.setAttribute('role', 'img');
            el.setAttribute('aria-label', label);
            el.removeAttribute('aria-hidden');
          } else {
            el.removeAttribute('role');
            el.removeAttribute('aria-label');
            el.setAttribute('aria-hidden', 'true');
          }
        }
        if (anchor.icon) {
          for (const span of el.querySelectorAll<HTMLElement>('[data-icon-name]')) {
            span.style.display = span.dataset.iconName === anchor.icon ? 'block' : 'none';
          }
          const bubble = el.querySelector<HTMLElement>('[data-bubble]');
          // Pop-in "boing" on every new intent (skipped for reduced motion).
          if (
            bubble &&
            !registry.reducedMotion &&
            !reducedMotion() &&
            typeof bubble.animate === 'function'
          ) {
            bubble.animate(
              [
                { transform: 'scale(0.3)', offset: 0 },
                { transform: 'scale(1.18)', offset: 0.6 },
                { transform: 'scale(1)', offset: 1 },
              ],
              { duration: previous ? 260 : 340, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)' },
            );
          }
        }
      }
    }
  });
  return null;
}
