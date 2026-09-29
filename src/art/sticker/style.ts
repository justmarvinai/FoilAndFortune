import { palette } from '@/ui/palette';

/**
 * Sticker Pop style tunables (docs/04 §6.1 style B, §8 "thick outlines, sticker motif").
 * Line weights are in output pixels at the reference composition size and scale with the
 * requested size, so every species gets the same visual line weight on a card.
 */
export const stickerStyle = {
  /** Structural line color: the UI ink (docs/04 §2.1) ties creatures to the chunky UI. */
  ink: palette.ink,
  /** Die-cut border color. */
  paper: '#FFFFFF',
  /** How far the silhouette outline extends beyond the fills (px @ reference size). */
  outlinePx: 3.1,
  /** Inner structural lines (head over body, front legs). Centered on edges. */
  innerPx: 2.5,
  /** Max width of tapered detail strokes (fur tufts, creases). */
  detailPx: 2.3,
  /** Width of the scene-colored rim light on the shadow side (dusk/night). */
  rimPx: 3.2,
  /** White die-cut border around the silhouette. */
  dieCutPx: 9,
  /** Multiply tint for the single cel-shadow tone: cool lavender → hue-shifted warm shadows. */
  shadowTint: '#D2C8EA',
  /** Opacity of the white gloss shapes. */
  glossAlpha: 0.55,
  /** Unit vector pointing toward the key light (top-left, like the shop lighting). */
  light: [-0.6, -0.8] as const,
  /** Reference output sizes; line weights are specified for these. */
  reference: {
    window: [640, 440] as const,
    fullArt: [500, 700] as const,
  },
} as const;
