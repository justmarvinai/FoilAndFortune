import type { Insets } from '../camera/cameraMath';

/**
 * Placement of world-anchored panels (the Fixture Popover, docs/05 §5.3) in the overlay: above
 * the fixture when it fits, else below, always inside the viewport minus the HUD/dock insets.
 * Pure, so the rules are unit-tested; the overlay projector calls it every frame with the
 * fixture's projected screen bounds.
 */

export type Placement = 'above' | 'below';

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface AnchorInput {
  /** Screen bounds of the anchored object (px). */
  target: ScreenRect;
  /** Size of the panel (px). */
  size: { width: number; height: number };
  viewport: { width: number; height: number };
  insets: Insets;
  /** Space between the object and the panel. */
  gap?: number;
  /** Minimum distance to the free area's edges. */
  margin?: number;
  /** Last frame's placement: kept while it still fits, so the panel doesn't flip-flop. */
  previous?: Placement | null;
}

export interface AnchorResult {
  /** Panel's top-left corner (px). */
  x: number;
  y: number;
  placement: Placement;
  /** Uniform scale for a panel bigger than the free area (applied from its top-left corner). */
  scale: number;
}

/** Panels never shrink below this; past it they may cover the HUD instead. */
export const MIN_ANCHOR_SCALE = 0.72;

export function placeAnchored(input: AnchorInput): AnchorResult {
  const { target, viewport, gap = 10, margin = 8, previous = null } = input;
  const freeHeight = viewport.height - input.insets.top - input.insets.bottom - margin * 2;
  const freeWidth = viewport.width - input.insets.left - input.insets.right - margin * 2;
  // A panel bigger than the free area (phone landscape: a 320 × 400 popover under a 60 px HUD)
  // shrinks to fit, down to a still readable size…
  const scale = Math.max(
    MIN_ANCHOR_SCALE,
    Math.min(1, freeHeight / input.size.height, freeWidth / input.size.width),
  );
  const size = { width: input.size.width * scale, height: input.size.height * scale };
  // …and past that it may cover the HUD and dock rather than run off the screen.
  const insets = {
    top: size.height > freeHeight + 0.5 ? 0 : input.insets.top,
    bottom: size.height > freeHeight + 0.5 ? 0 : input.insets.bottom,
    left: size.width > freeWidth + 0.5 ? 0 : input.insets.left,
    right: size.width > freeWidth + 0.5 ? 0 : input.insets.right,
  };
  const area = {
    left: insets.left + margin,
    top: insets.top + margin,
    right: viewport.width - insets.right - margin,
    bottom: viewport.height - insets.bottom - margin,
  };
  const roomAbove = target.top - gap - area.top;
  const roomBelow = area.bottom - (target.bottom + gap);
  const fits = { above: roomAbove >= size.height, below: roomBelow >= size.height };
  let placement: Placement;
  if (previous && fits[previous]) placement = previous;
  else if (fits.above) placement = 'above';
  else if (fits.below) placement = 'below';
  else placement = roomAbove >= roomBelow ? 'above' : 'below';

  const wantY = placement === 'above' ? target.top - gap - size.height : target.bottom + gap;
  const maxY = area.bottom - size.height;
  const y = maxY < area.top ? area.top : Math.min(maxY, Math.max(area.top, wantY));

  const centerX = (target.left + target.right) / 2;
  const maxX = area.right - size.width;
  const wantX = centerX - size.width / 2;
  const x = maxX < area.left ? area.left : Math.min(maxX, Math.max(area.left, wantX));
  // Whole pixels, rounded towards the top-left so the panel never pokes past the free area.
  return { x: Math.floor(x), y: Math.floor(y), placement, scale: Math.floor(scale * 1000) / 1000 };
}

/** Screen bounds of projected points (px), or null when there are none. */
export function screenBounds(points: readonly { x: number; y: number }[]): ScreenRect | null {
  if (points.length === 0) return null;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    left = Math.min(left, p.x);
    right = Math.max(right, p.x);
    top = Math.min(top, p.y);
    bottom = Math.max(bottom, p.y);
  }
  return { left, top, right, bottom };
}

/** Insets with every side filled in (props may pass a partial set). */
export function fullInsets(partial: Partial<Insets> | undefined): Insets {
  return {
    top: partial?.top ?? 0,
    right: partial?.right ?? 0,
    bottom: partial?.bottom ?? 0,
    left: partial?.left ?? 0,
  };
}

/** Value equality for insets (the play screen passes a fresh object on every layout change). */
export function sameInsets(a: Insets, b: Insets): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}
