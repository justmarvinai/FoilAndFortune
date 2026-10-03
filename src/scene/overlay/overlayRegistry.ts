import { Vector3 } from 'three';

/**
 * Registry behind the single `WorldOverlay` DOM layer (docs/06 §7): agents write a world anchor
 * and an intent icon; the projector inside the Canvas projects anchors once per frame and writes
 * `transform` straight onto the DOM nodes. No React render per frame, no drei <Html> per agent.
 */
export type BubbleIcon =
  | 'cart'
  | 'chat'
  | 'heart'
  | 'search'
  | 'pack'
  | 'exclaim'
  | 'sparkle'
  | 'wait'
  | 'angry'
  /** Wanted item out of stock (an empty box). */
  | 'empty'
  /** Price reactions (docs/02 §5.3): a bargain, fair, pricey, a rip-off. */
  | 'steal'
  | 'fair'
  | 'pricey'
  | 'ripoff';

export interface OverlayAnchor {
  id: string;
  /** World-space anchor (e.g. just above a head), updated by its owner every frame. */
  position: Vector3;
  icon: BubbleIcon | null;
  /** What the DOM currently shows, so the projector only touches attributes on change. */
  shownIcon: BubbleIcon | null;
}

export interface OverlayRegistry {
  anchors: Map<string, OverlayAnchor>;
  elements: Map<string, HTMLElement>;
  /**
   * Accessible names per icon (i18n, `scene` namespace). When set, a shown bubble gets
   * `role="img"` and its label; without labels the layer stays decorative (`aria-hidden`).
   */
  labels: Partial<Record<BubbleIcon, string>> | null;
  /** Skip the pop-in "boing" (reduced motion), on top of the OS preference. */
  reducedMotion: boolean;
  anchor(id: string): OverlayAnchor;
  /** Forgets an anchor whose owner is gone (dynamic agents). */
  remove(id: string): void;
  bindElement(id: string, element: HTMLElement | null): void;
  /**
   * A stable ref callback per anchor id. A fresh callback on every render would make React
   * detach and re-attach the element each time, and the projector would lose track of what the
   * DOM shows (a bubble could stay up after its owner's intent cleared).
   */
  refFor(id: string): (element: HTMLElement | null) => void;
}

export function createOverlayRegistry(): OverlayRegistry {
  const anchors = new Map<string, OverlayAnchor>();
  const elements = new Map<string, HTMLElement>();
  const refs = new Map<string, (element: HTMLElement | null) => void>();
  const registry: OverlayRegistry = {
    anchors,
    elements,
    labels: null,
    reducedMotion: false,
    anchor(id) {
      let entry = anchors.get(id);
      if (!entry) {
        entry = { id, position: new Vector3(), icon: null, shownIcon: null };
        anchors.set(id, entry);
      }
      return entry;
    },
    remove(id) {
      anchors.delete(id);
      refs.delete(id);
    },
    bindElement(id, element) {
      if (element) elements.set(id, element);
      else elements.delete(id);
      const entry = anchors.get(id);
      // A freshly mounted element shows nothing yet; force the projector to sync it.
      if (entry) entry.shownIcon = null;
    },
    refFor(id) {
      let ref = refs.get(id);
      if (!ref) {
        ref = (element) => registry.bindElement(id, element);
        refs.set(id, ref);
      }
      return ref;
    },
  };
  return registry;
}
