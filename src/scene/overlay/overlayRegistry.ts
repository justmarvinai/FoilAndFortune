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
  | 'angry';

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
  anchor(id: string): OverlayAnchor;
  bindElement(id: string, element: HTMLElement | null): void;
}

export function createOverlayRegistry(): OverlayRegistry {
  const anchors = new Map<string, OverlayAnchor>();
  const elements = new Map<string, HTMLElement>();
  return {
    anchors,
    elements,
    anchor(id) {
      let entry = anchors.get(id);
      if (!entry) {
        entry = { id, position: new Vector3(), icon: null, shownIcon: null };
        anchors.set(id, entry);
      }
      return entry;
    },
    bindElement(id, element) {
      if (element) elements.set(id, element);
      else elements.delete(id);
      const entry = anchors.get(id);
      // A freshly mounted element shows nothing yet; force the projector to sync it.
      if (entry) entry.shownIcon = null;
    },
  };
}
