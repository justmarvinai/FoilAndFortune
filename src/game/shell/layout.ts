/**
 * Play-screen layout rules (docs/05 §9 "Responsive & Input"), shared by the CSS-driven shell and
 * the scene insets. Pure so the breakpoints are unit-tested.
 *
 * | Viewport                        | Sheets              | Dock                 |
 * |---------------------------------|---------------------|----------------------|
 * | ≥ 1280 px                       | right, 480–720 px   | bottom, centered     |
 * | 900–1279 px                     | right, 60 % width   | bottom, centered     |
 * | < 900 px wide or ≤ 540 px tall  | full screen         | icon rail, right     |
 */
export const COMPACT_MAX_WIDTH = 899;
export const COMPACT_MAX_HEIGHT = 540;
/** Gap between the sheet and the screen edge on desktop. */
export const SHEET_MARGIN = 12;

export function isCompact(width: number, height: number): boolean {
  return width <= COMPACT_MAX_WIDTH || height <= COMPACT_MAX_HEIGHT;
}

/** Sheet width in px for a viewport (full width on phones). */
export function sheetWidth(width: number, height: number): number {
  if (isCompact(width, height)) return width;
  if (width >= 1280) return Math.min(720, Math.max(480, Math.round(width * 0.42)));
  return Math.round(width * 0.6);
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface InsetInput {
  width: number;
  height: number;
  /** Bottom edge of the HUD's top bar, px from the top. */
  hudBottom: number;
  /** The dock's size: height (bottom dock) or width (phone rail). */
  dock: { width: number; height: number };
  sheetOpen: boolean;
}

/** Screen areas the HUD, dock and an open sheet cover, so the shop frames itself in the rest. */
export function sceneInsets(input: InsetInput): Insets {
  const { width, height, hudBottom, dock, sheetOpen } = input;
  const compact = isCompact(width, height);
  const gap = 8;
  const right = compact
    ? dock.width + gap * 2
    : sheetOpen
      ? sheetWidth(width, height) + SHEET_MARGIN * 2
      : 0;
  return {
    top: Math.max(0, Math.round(hudBottom + gap)),
    right: Math.round(right),
    bottom: compact ? 0 : Math.round(dock.height + gap * 2),
    left: 0,
  };
}
