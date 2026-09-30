import type { CanvasTexture } from 'three';
import { cachedTexture, liveCanvasTexture } from '../lib/canvas';

/**
 * Peg-folk face decals (docs/04 §4.4): eyes, brows, mouth and blush drawn into one shared canvas
 * atlas. Every expression also has a "blink" twin (same brows and mouth, eyes shut), so blinking
 * never flashes a different mouth. Characters switch faces by moving their texture offset: no
 * texture upload, no React render.
 *
 * The atlas cell maps onto a sphere section (see `FACE_SECTION`), so drawing coordinates are in
 * "face space": x across the face (0 = viewer's left), y from brow line down to chin.
 */
export const EXPRESSIONS = [
  'neutral',
  'happy',
  'excited',
  'thinking',
  'annoyed',
  'angry',
  'surprised',
  'sleepy',
  'starry',
] as const;

export type Expression = (typeof EXPRESSIONS)[number];

/** Sphere section (radians) that the face texture covers; see agents/PegFolk.tsx. */
export const FACE_SECTION = {
  phiLength: (Math.PI * 2) / 3,
  thetaStart: Math.PI * 0.32,
  thetaLength: Math.PI * 0.43,
} as const;

const CELL_W = 256;
const CELL_H = 160;
const COLS = EXPRESSIONS.length;
const ROWS = 2; // row 0: eyes open, row 1: blink twin

const INK = '#1E2340';
const MOUTH = '#8A2436';
const TONGUE = '#FF8FA3';
const BLUSH = 'rgba(255, 112, 138, 0.42)';

type EyeStyle =
  | 'oval'
  | 'big-sparkle'
  | 'look-up'
  | 'half-lid'
  | 'narrow'
  | 'round'
  | 'arch'
  | 'sleepy'
  | 'star'
  | 'closed';

interface FaceSpec {
  eyes: EyeStyle;
  brows: 'none' | 'soft' | 'raised' | 'one-up' | 'annoyed' | 'angry';
  mouth: 'smile' | 'open-smile' | 'grin' | 'hmm' | 'flat' | 'frown' | 'o' | 'small-o';
  blush: number;
  extra?: 'sparkles' | 'vein' | 'zzz' | 'sweat';
}

const SPECS: Record<Expression, FaceSpec> = {
  neutral: { eyes: 'oval', brows: 'none', mouth: 'smile', blush: 0.8 },
  happy: { eyes: 'arch', brows: 'soft', mouth: 'open-smile', blush: 1 },
  excited: { eyes: 'big-sparkle', brows: 'raised', mouth: 'grin', blush: 1.15, extra: 'sparkles' },
  thinking: { eyes: 'look-up', brows: 'one-up', mouth: 'hmm', blush: 0.4 },
  annoyed: { eyes: 'half-lid', brows: 'annoyed', mouth: 'flat', blush: 0, extra: 'sweat' },
  angry: { eyes: 'narrow', brows: 'angry', mouth: 'frown', blush: 0, extra: 'vein' },
  surprised: { eyes: 'round', brows: 'raised', mouth: 'o', blush: 0.5 },
  sleepy: { eyes: 'sleepy', brows: 'none', mouth: 'small-o', blush: 0.6, extra: 'zzz' },
  starry: { eyes: 'star', brows: 'soft', mouth: 'grin', blush: 1.1, extra: 'sparkles' },
};

/** Eyes that are already closed or stylised don't blink. */
export function canBlink(expression: Expression): boolean {
  const eyes = SPECS[expression].eyes;
  return eyes !== 'arch' && eyes !== 'sleepy' && eyes !== 'star';
}

function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  starPath(ctx, cx, cy, r, r * 0.28, 4);
  ctx.fill();
}

function highlight(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(x + 5 * s, y - 8 * s, 6.5 * s, 6.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 6 * s, y + 8 * s, 3 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  style: EyeStyle,
  x: number,
  y: number,
  s: number,
  mirror: number,
) {
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (style) {
    case 'oval':
      ctx.beginPath();
      ctx.ellipse(x, y, 13 * s, 18 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      highlight(ctx, x, y, s);
      break;
    case 'big-sparkle':
      ctx.beginPath();
      ctx.ellipse(x, y, 15.5 * s, 21 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      sparkle(ctx, x + 5 * s, y - 8 * s, 10 * s, '#FFFFFF');
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x - 6 * s, y + 9 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'look-up':
      ctx.beginPath();
      ctx.ellipse(x, y, 12.5 * s, 17 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Highlights pushed up and to the side: reads as gazing upwards, "hmm…".
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x + 4 * s, y - 10 * s, 6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 3 * s, y - 1 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'half-lid': {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 20 * s, y - 4 * s, 40 * s, 30 * s);
      ctx.clip();
      ctx.beginPath();
      ctx.ellipse(x, y, 13 * s, 17 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x + 4 * s, y + 2 * s, 4.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(x - 16 * s, y - 4 * s);
      ctx.lineTo(x + 16 * s, y - 4 * s);
      ctx.stroke();
      break;
    }
    case 'narrow': {
      ctx.save();
      ctx.beginPath();
      // Lid slants down towards the nose.
      ctx.moveTo(x - 20 * s * mirror, y - 12 * s);
      ctx.lineTo(x + 20 * s * mirror, y - 2 * s);
      ctx.lineTo(x + 20 * s * mirror, y + 30 * s);
      ctx.lineTo(x - 20 * s * mirror, y + 30 * s);
      ctx.closePath();
      ctx.clip();
      ctx.beginPath();
      ctx.ellipse(x, y + 2 * s, 12 * s, 15 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x - 2 * s * mirror, y + 6 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'round':
      ctx.beginPath();
      ctx.arc(x, y, 14 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, 9 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x, y + 1 * s, 5.5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'arch':
      ctx.lineWidth = 7 * s;
      ctx.beginPath();
      ctx.moveTo(x - 14 * s, y + 6 * s);
      ctx.quadraticCurveTo(x, y - 16 * s, x + 14 * s, y + 6 * s);
      ctx.stroke();
      break;
    case 'sleepy':
      ctx.lineWidth = 6 * s;
      ctx.beginPath();
      ctx.moveTo(x - 14 * s, y + 2 * s);
      ctx.quadraticCurveTo(x, y + 12 * s, x + 14 * s, y + 2 * s);
      ctx.stroke();
      break;
    case 'star':
      starPath(ctx, x, y, 20 * s, 9 * s, 5);
      ctx.fillStyle = '#FFC93C';
      ctx.fill();
      ctx.lineWidth = 4.5 * s;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x - 4 * s, y - 4 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'closed':
      ctx.lineWidth = 6 * s;
      ctx.beginPath();
      ctx.moveTo(x - 14 * s, y + 1 * s);
      ctx.quadraticCurveTo(x, y + 9 * s, x + 14 * s, y + 1 * s);
      ctx.stroke();
      break;
  }
}

function drawBrow(
  ctx: CanvasRenderingContext2D,
  spec: FaceSpec['brows'],
  x: number,
  y: number,
  s: number,
  mirror: number,
  isLeft: boolean,
) {
  if (spec === 'none') return;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineWidth = 5.5 * s;
  ctx.beginPath();
  const inner = mirror; // +1 means the nose is towards +x for this eye
  switch (spec) {
    case 'soft':
      ctx.moveTo(x - 11 * s, y - 28 * s);
      ctx.quadraticCurveTo(x, y - 33 * s, x + 11 * s, y - 28 * s);
      break;
    case 'raised':
      ctx.moveTo(x - 12 * s, y - 33 * s);
      ctx.quadraticCurveTo(x, y - 41 * s, x + 12 * s, y - 33 * s);
      break;
    case 'one-up': {
      const lift = isLeft ? 9 : 0;
      ctx.moveTo(x - 11 * s, y - (28 + lift) * s + inner * 2 * s);
      ctx.quadraticCurveTo(x, y - (33 + lift) * s, x + 11 * s, y - (28 + lift) * s - inner * 2 * s);
      break;
    }
    case 'annoyed':
      ctx.moveTo(x - 12 * s * inner, y - 31 * s);
      ctx.lineTo(x + 12 * s * inner, y - 25 * s);
      break;
    case 'angry':
      ctx.lineWidth = 7 * s;
      ctx.moveTo(x - 13 * s * inner, y - 34 * s);
      ctx.lineTo(x + 12 * s * inner, y - 21 * s);
      break;
  }
  ctx.stroke();
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  style: FaceSpec['mouth'],
  x: number,
  y: number,
  s: number,
) {
  ctx.strokeStyle = INK;
  ctx.fillStyle = MOUTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5 * s;
  switch (style) {
    case 'smile':
      ctx.beginPath();
      ctx.moveTo(x - 11 * s, y - 2 * s);
      ctx.quadraticCurveTo(x, y + 9 * s, x + 11 * s, y - 2 * s);
      ctx.stroke();
      break;
    case 'open-smile':
    case 'grin': {
      const w = style === 'grin' ? 20 : 16;
      const h = style === 'grin' ? 22 : 17;
      ctx.beginPath();
      ctx.moveTo(x - w * s, y - 4 * s);
      ctx.quadraticCurveTo(x, y - 7 * s, x + w * s, y - 4 * s);
      ctx.quadraticCurveTo(x + w * 0.9 * s, y + h * s, x, y + h * s);
      ctx.quadraticCurveTo(x - w * 0.9 * s, y + h * s, x - w * s, y - 4 * s);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = TONGUE;
      ctx.beginPath();
      ctx.ellipse(x, y + h * s, w * 0.62 * s, h * 0.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 4.5 * s;
      ctx.stroke();
      break;
    }
    case 'hmm':
      ctx.beginPath();
      ctx.moveTo(x - 6 * s, y + 2 * s);
      ctx.quadraticCurveTo(x + 4 * s, y - 2 * s, x + 12 * s, y + 3 * s);
      ctx.stroke();
      break;
    case 'flat':
      ctx.beginPath();
      ctx.moveTo(x - 10 * s, y + 2 * s);
      ctx.quadraticCurveTo(x, y - 2 * s, x + 10 * s, y + 3 * s);
      ctx.stroke();
      break;
    case 'frown':
      ctx.beginPath();
      ctx.moveTo(x - 14 * s, y + 8 * s);
      ctx.quadraticCurveTo(x, y - 8 * s, x + 14 * s, y + 8 * s);
      ctx.quadraticCurveTo(x, y + 2 * s, x - 14 * s, y + 8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'o':
      ctx.beginPath();
      ctx.ellipse(x, y + 4 * s, 8.5 * s, 11 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 4.5 * s;
      ctx.stroke();
      break;
    case 'small-o':
      ctx.beginPath();
      ctx.ellipse(x, y + 3 * s, 5 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 4 * s;
      ctx.stroke();
      break;
  }
}

function drawExtra(
  ctx: CanvasRenderingContext2D,
  extra: FaceSpec['extra'],
  w: number,
  h: number,
  s: number,
) {
  switch (extra) {
    case 'sparkles':
      sparkle(ctx, w * 0.1, h * 0.3, 10 * s, '#FFC93C');
      sparkle(ctx, w * 0.9, h * 0.27, 8 * s, '#FFC93C');
      sparkle(ctx, w * 0.93, h * 0.47, 5 * s, '#FFFFFF');
      break;
    case 'vein': {
      // The classic anime "anger mark": four curved ticks in coral red.
      const cx = w * 0.84;
      const cy = h * 0.28;
      ctx.strokeStyle = '#FF3D6E';
      ctx.lineWidth = 5 * s;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(a) * 13 * s,
          cy + Math.sin(a) * 13 * s,
          7 * s,
          a + Math.PI * 0.6,
          a + Math.PI * 1.4,
        );
        ctx.stroke();
      }
      break;
    }
    case 'zzz':
      ctx.fillStyle = '#4DA8FF';
      // Generic bold font on purpose: the atlas is cloned per character, so it must not depend
      // on a web font arriving later.
      ctx.font = `900 ${Math.round(26 * s)}px system-ui, sans-serif`;
      ctx.fillText('z', w * 0.8, h * 0.34);
      ctx.font = `900 ${Math.round(18 * s)}px system-ui, sans-serif`;
      ctx.fillText('z', w * 0.89, h * 0.23);
      break;
    case 'sweat':
      ctx.fillStyle = '#7FD3FF';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(w * 0.86, h * 0.2);
      ctx.quadraticCurveTo(w * 0.9, h * 0.34, w * 0.86, h * 0.38);
      ctx.quadraticCurveTo(w * 0.82, h * 0.34, w * 0.86, h * 0.2);
      ctx.fill();
      ctx.stroke();
      break;
    case undefined:
      break;
  }
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  spec: FaceSpec,
  blink: boolean,
  w: number,
  h: number,
) {
  // Features are drawn ~30 % larger than "realistic": the camera looks down at 35° and a
  // character's head is often < 60 px tall, so chibi eyes must carry the expression.
  const s = (w / 256) * 1.6;
  const eyeY = h * 0.45;
  const eyeDx = w * 0.19;
  const mouthY = h * 0.76;
  // Blush first so eyes and mouth sit on top of it.
  if (spec.blush > 0) {
    ctx.fillStyle = BLUSH;
    ctx.globalAlpha = Math.min(1, spec.blush);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(w / 2 + side * w * 0.31, h * 0.66, 13 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const eyeStyle: EyeStyle = blink ? 'closed' : spec.eyes;
  // Left eye (viewer's left) has the nose to its right (+x): mirror = +1.
  drawEye(ctx, eyeStyle, w / 2 - eyeDx, eyeY, s, 1);
  drawEye(ctx, eyeStyle, w / 2 + eyeDx, eyeY, s, -1);
  drawBrow(ctx, spec.brows, w / 2 - eyeDx, eyeY, s, 1, true);
  drawBrow(ctx, spec.brows, w / 2 + eyeDx, eyeY, s, -1, false);
  drawMouth(ctx, spec.mouth, w / 2, mouthY, s);
  drawExtra(ctx, spec.extra, w, h, s);
}

/**
 * The shared face atlas (premultiplied alpha, so soft blush edges filter without dark fringes).
 * Characters use `texture.clone()`, which shares the GPU upload but keeps its own offset.
 */
export function faceAtlasTexture(): CanvasTexture {
  return cachedTexture('peg-face-atlas', () => {
    const texture = liveCanvasTexture(CELL_W * COLS, CELL_H * ROWS, (ctx) => {
      EXPRESSIONS.forEach((expression, col) => {
        for (let row = 0; row < ROWS; row++) {
          ctx.save();
          ctx.translate(col * CELL_W, row * CELL_H);
          ctx.beginPath();
          ctx.rect(0, 0, CELL_W, CELL_H);
          ctx.clip();
          drawFace(ctx, SPECS[expression], row === 1, CELL_W, CELL_H);
          ctx.restore();
        }
      });
    });
    texture.premultiplyAlpha = true;
    texture.repeat.set(1 / COLS, 1 / ROWS);
    return texture;
  });
}

/** Sets a face texture's UV window to one expression (optionally its blink twin). */
export function setFaceCell(texture: CanvasTexture, expression: Expression, blink: boolean): void {
  const col = EXPRESSIONS.indexOf(expression);
  const row = blink ? 1 : 0;
  // flipY: canvas row 0 is the top of the texture (v = 1).
  texture.offset.set(col / COLS, 1 - (row + 1) / ROWS);
}
