import type { CanvasTexture } from 'three';
import { cachedTexture, FONTS, fitText, liveCanvasTexture, roundRectPath } from '../lib/canvas';

/**
 * Procedural product art for shelf items (docs/04 §5.5, docs/06 §7 "product atlas"): booster
 * pack wrappers and booster-box fronts drawn into canvas atlases, so every pack on every shelf
 * is one instanced draw call. Creatures are simplified mascot heads in the Glimmerkin palette
 * (docs/03 §3.2, §6); in Phase 2 the real pack art from the art engine can be blitted in.
 */
export type PackCreature =
  | 'emberpup'
  | 'solaryx'
  | 'boltbuck'
  | 'masquer'
  | 'phantom'
  | 'sploot'
  | 'tidal'
  | 'sparkit';

export interface PackArt {
  set: 'EMD' | 'MNM' | 'TDB' | 'SPF';
  top: string;
  bottom: string;
  accent: string;
  creature: PackCreature;
}

/** Eight wrapper variants, grouped by set (current set first). Index = atlas cell. */
export const PACK_ARTS: readonly PackArt[] = [
  { set: 'EMD', top: '#FF9A3D', bottom: '#E3413A', accent: '#FFE08A', creature: 'emberpup' },
  { set: 'EMD', top: '#FFD04A', bottom: '#FF7A45', accent: '#FFF6E5', creature: 'solaryx' },
  { set: 'EMD', top: '#FFE36B', bottom: '#F29A2E', accent: '#FF6F59', creature: 'boltbuck' },
  { set: 'MNM', top: '#9D6BFF', bottom: '#3D3B8E', accent: '#FF8BD1', creature: 'masquer' },
  { set: 'MNM', top: '#C27BFF', bottom: '#5B1FA0', accent: '#7FF6FF', creature: 'phantom' },
  { set: 'TDB', top: '#5FC2FF', bottom: '#1F5FB5', accent: '#FFB6D5', creature: 'sploot' },
  { set: 'TDB', top: '#3DD6C8', bottom: '#1F6FB5', accent: '#FFFFFF', creature: 'tidal' },
  { set: 'SPF', top: '#FFF06B', bottom: '#43C9A0', accent: '#FFFFFF', creature: 'sparkit' },
];

export const PACK_ATLAS = { cols: 4, rows: 2, cellW: 160, cellH: 256 } as const;

const INK = '#1E2340';

function eyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, spread: number, r: number) {
  for (const side of [-1, 1]) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(cx + side * spread, cy, r * 0.8, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx + side * spread + r * 0.25, cy - r * 0.35, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 110, 140, 0.55)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * spread * 1.55, cy + r * 1.3, r * 0.7, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function outlined(ctx: CanvasRenderingContext2D, fill: string, width = 4) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Draws a mascot head centred at (cx, cy) with radius r. */
export function drawCreature(
  ctx: CanvasRenderingContext2D,
  creature: PackCreature,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.save();
  switch (creature) {
    case 'emberpup': {
      // Flame tuft, floppy ears, round orange face.
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.35, cy - r * 0.8);
      ctx.quadraticCurveTo(cx - r * 0.2, cy - r * 1.7, cx + r * 0.1, cy - r * 1.35);
      ctx.quadraticCurveTo(cx + r * 0.3, cy - r * 1.8, cx + r * 0.45, cy - r * 0.8);
      outlined(ctx, '#FFD23F');
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(
          cx + side * r * 0.95,
          cy + r * 0.05,
          r * 0.32,
          r * 0.55,
          side * 0.5,
          0,
          Math.PI * 2,
        );
        outlined(ctx, '#B8431F');
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      outlined(ctx, '#FF8A3D');
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.45, r * 0.45, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FFE3C4';
      ctx.fill();
      eyes(ctx, cx, cy - r * 0.05, r * 0.38, r * 0.2);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.3, r * 0.1, r * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'solaryx': {
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.32;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a - 0.12) * r * 0.9, cy + Math.sin(a - 0.12) * r * 0.9);
        ctx.lineTo(cx + Math.cos(a) * r * 1.55, cy + Math.sin(a) * r * 1.55);
        ctx.lineTo(cx + Math.cos(a + 0.12) * r * 0.9, cy + Math.sin(a + 0.12) * r * 0.9);
        outlined(ctx, i % 2 === 0 ? '#FF6F59' : '#FFC93C', 3);
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      outlined(ctx, '#FFD84A');
      eyes(ctx, cx, cy - r * 0.08, r * 0.36, r * 0.2);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.14, cy + r * 0.22);
      ctx.lineTo(cx + r * 0.14, cy + r * 0.22);
      ctx.lineTo(cx, cy + r * 0.45);
      ctx.closePath();
      outlined(ctx, '#FF8A3D', 3);
      break;
    }
    case 'boltbuck': {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * r * 0.35, cy - r * 0.75);
        ctx.lineTo(cx + side * r * 0.7, cy - r * 1.45);
        ctx.lineTo(cx + side * r * 0.52, cy - r * 1.15);
        ctx.lineTo(cx + side * r * 0.95, cy - r * 1.55);
        ctx.lineTo(cx + side * r * 0.62, cy - r * 0.7);
        ctx.closePath();
        outlined(ctx, '#FFE36B', 3);
        ctx.beginPath();
        ctx.ellipse(
          cx + side * r * 1.0,
          cy - r * 0.2,
          r * 0.38,
          r * 0.18,
          side * -0.4,
          0,
          Math.PI * 2,
        );
        outlined(ctx, '#C98A4A', 3);
      }
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.88, r, 0, 0, Math.PI * 2);
      outlined(ctx, '#D9A060');
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.45, r * 0.42, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FFF1DC';
      ctx.fill();
      eyes(ctx, cx, cy - r * 0.1, r * 0.34, r * 0.19);
      break;
    }
    case 'masquer': {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * r * 0.25, cy - r * 0.85);
        ctx.lineTo(cx + side * r * 0.85, cy - r * 1.35);
        ctx.lineTo(cx + side * r * 0.9, cy - r * 0.45);
        ctx.closePath();
        outlined(ctx, '#6E4BD8', 3);
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      outlined(ctx, '#8E6CF0');
      // Masquerade mask across the eyes.
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.95, cy - r * 0.25);
      ctx.quadraticCurveTo(cx - r * 0.5, cy - r * 0.55, cx, cy - r * 0.22);
      ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 0.55, cx + r * 0.95, cy - r * 0.25);
      ctx.quadraticCurveTo(cx + r * 0.6, cy + r * 0.3, cx, cy + r * 0.05);
      ctx.quadraticCurveTo(cx - r * 0.6, cy + r * 0.3, cx - r * 0.95, cy - r * 0.25);
      outlined(ctx, '#FFE08A', 3);
      eyes(ctx, cx, cy - r * 0.1, r * 0.4, r * 0.15);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy + r * 0.45);
      ctx.quadraticCurveTo(cx, cy + r * 0.62, cx + r * 0.2, cy + r * 0.45);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'phantom': {
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r * 0.2);
      ctx.bezierCurveTo(cx - r, cy - r * 1.3, cx + r, cy - r * 1.3, cx + r, cy + r * 0.2);
      for (let i = 0; i < 4; i++) {
        const x0 = cx + r - (i * 2 * r) / 4;
        ctx.quadraticCurveTo(
          x0 - r / 4,
          cy + r * (i % 2 === 0 ? 0.95 : 0.6),
          x0 - r / 2,
          cy + r * 0.75,
        );
      }
      ctx.closePath();
      outlined(ctx, '#E9DDFF');
      eyes(ctx, cx, cy - r * 0.15, r * 0.34, r * 0.2);
      ctx.beginPath();
      ctx.arc(cx + r * 0.95, cy - r * 1.05, r * 0.32, 0.6, Math.PI * 1.75);
      ctx.arc(cx + r * 1.08, cy - r * 1.12, r * 0.28, Math.PI * 1.6, 0.75, true);
      outlined(ctx, '#FFE08A', 3);
      break;
    }
    case 'sploot': {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(
            cx + side * r * 1.05,
            cy - r * 0.45 + i * r * 0.35,
            r * 0.3,
            r * 0.12,
            side * (0.5 - i * 0.4),
            0,
            Math.PI * 2,
          );
          outlined(ctx, '#FF8FB8', 3);
        }
      }
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.05, r * 0.85, 0, 0, Math.PI * 2);
      outlined(ctx, '#7FD3FF');
      eyes(ctx, cx, cy - r * 0.08, r * 0.46, r * 0.18);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.28, cy + r * 0.32);
      ctx.quadraticCurveTo(cx, cy + r * 0.55, cx + r * 0.28, cy + r * 0.32);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'tidal': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.2, cy + r * 0.8);
      ctx.bezierCurveTo(
        cx - r * 1.2,
        cy - r * 0.9,
        cx + r * 0.9,
        cy - r * 1.4,
        cx + r * 0.9,
        cy - r * 0.2,
      );
      ctx.bezierCurveTo(
        cx + r * 0.9,
        cy + r * 0.3,
        cx + r * 0.2,
        cy + r * 0.3,
        cx + r * 0.2,
        cy - r * 0.15,
      );
      ctx.bezierCurveTo(
        cx + r * 0.2,
        cy - r * 0.5,
        cx - r * 0.5,
        cy - r * 0.3,
        cx - r * 0.3,
        cy + r * 0.8,
      );
      ctx.closePath();
      outlined(ctx, '#E9FFFB');
      ctx.fillStyle = '#FFFFFF';
      for (const [dx, dy, s] of [
        [0.9, -1.0, 0.18],
        [1.15, -0.6, 0.1],
        [-0.9, -0.9, 0.12],
      ] as const) {
        ctx.beginPath();
        ctx.arc(cx + dx * r, cy + dy * r, s * r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'sparkit': {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * r * 0.2, cy - r * 0.8);
        ctx.lineTo(cx + side * r * 0.95, cy - r * 1.55);
        ctx.lineTo(cx + side * r * 0.95, cy - r * 0.35);
        ctx.closePath();
        outlined(ctx, '#FFD23F', 3);
        ctx.beginPath();
        ctx.moveTo(cx + side * r * 0.7, cy - r * 1.3);
        ctx.lineTo(cx + side * r * 0.95, cy - r * 1.55);
        ctx.lineTo(cx + side * r * 0.95, cy - r * 1.1);
        ctx.closePath();
        ctx.fillStyle = INK;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      outlined(ctx, '#FFD23F');
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.5, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FFF6E5';
      ctx.fill();
      eyes(ctx, cx, cy - r * 0.05, r * 0.38, r * 0.2);
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.95, cy - r * 0.3);
      ctx.lineTo(cx + r * 1.35, cy - r * 0.05);
      ctx.lineTo(cx + r * 1.15, cy + r * 0.02);
      ctx.lineTo(cx + r * 1.45, cy + r * 0.4);
      ctx.lineTo(cx + r * 1.0, cy + r * 0.1);
      ctx.lineTo(cx + r * 1.15, cy + r * 0.05);
      ctx.closePath();
      outlined(ctx, '#7FF6FF', 3);
      break;
    }
  }
  ctx.restore();
}

function burst(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 === 0 ? r : r * 0.7;
    const a = (i * Math.PI) / n;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawWrapper(
  ctx: CanvasRenderingContext2D,
  art: PackArt,
  w: number,
  h: number,
  brand: string,
  count: string,
) {
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, art.top);
  g.addColorStop(1, art.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Foil streaks.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#FFFFFF';
  for (let i = -2; i < 6; i++) {
    ctx.beginPath();
    const x = i * 38;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 14, 0);
    ctx.lineTo(x + 14 + h * 0.4, h);
    ctx.lineTo(x + h * 0.4, h);
    ctx.fill();
  }
  ctx.restore();
  burst(ctx, w / 2, h * 0.52, w * 0.42, `${art.accent}66`);
  drawCreature(ctx, art.creature, w / 2, h * 0.54, w * 0.22);
  // Crimped seals top and bottom.
  const crimp = h * 0.075;
  for (const y0 of [0, h - crimp]) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(0, y0, w, crimp);
    ctx.fillStyle = 'rgba(30, 35, 64, 0.22)';
    for (let x = 2; x < w; x += 5) ctx.fillRect(x, y0 + 2, 2, crimp - 4);
  }
  // Brand banner.
  ctx.fillStyle = INK;
  roundRectPath(ctx, w * 0.1, h * 0.1, w * 0.8, h * 0.13, 10);
  ctx.fill();
  ctx.fillStyle = art.accent;
  roundRectPath(ctx, w * 0.12, h * 0.108, w * 0.76, h * 0.114, 8);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, brand, w / 2, h * 0.167, w * 0.7, 22, FONTS.display);
  // Card count strip.
  ctx.fillStyle = 'rgba(30, 35, 64, 0.75)';
  roundRectPath(ctx, w * 0.25, h * 0.8, w * 0.5, h * 0.07, 6);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  fitText(ctx, count, w / 2, h * 0.837, w * 0.46, 14, FONTS.display);
}

export function packAtlasTexture(brand: string, count: string): CanvasTexture {
  const { cols, rows, cellW, cellH } = PACK_ATLAS;
  return cachedTexture(`pack-atlas:${brand}:${count}`, () =>
    liveCanvasTexture(cols * cellW, rows * cellH, (ctx) => {
      PACK_ARTS.forEach((art, i) => {
        ctx.save();
        ctx.translate((i % cols) * cellW, Math.floor(i / cols) * cellH);
        ctx.beginPath();
        ctx.rect(0, 0, cellW, cellH);
        ctx.clip();
        drawWrapper(ctx, art, cellW, cellH, brand, count);
        ctx.restore();
      });
    }),
  );
}

/** UV offset of a pack variant's cell (flipY: canvas row 0 is the top). */
export function packCellOffset(variant: number): [number, number] {
  const { cols, rows } = PACK_ATLAS;
  const i = ((variant % PACK_ARTS.length) + PACK_ARTS.length) % PACK_ARTS.length;
  return [(i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows];
}

/** Booster-box fronts: one cell per set (EMD, MNM, TDB, SPF). */
export const BOX_ATLAS = { cols: 2, rows: 2, cellW: 256, cellH: 160 } as const;

export function boxAtlasTexture(brand: string): CanvasTexture {
  const { cols, cellW, cellH } = BOX_ATLAS;
  const sets = [PACK_ARTS[0], PACK_ARTS[3], PACK_ARTS[5], PACK_ARTS[7]];
  return cachedTexture(`box-atlas:${brand}`, () =>
    liveCanvasTexture(cols * cellW, 2 * cellH, (ctx) => {
      sets.forEach((art, i) => {
        if (!art) return;
        ctx.save();
        ctx.translate((i % cols) * cellW, Math.floor(i / cols) * cellH);
        const w = cellW;
        const h = cellH;
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, art.top);
        g.addColorStop(1, art.bottom);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        burst(ctx, w * 0.3, h * 0.55, h * 0.5, `${art.accent}55`);
        drawCreature(ctx, art.creature, w * 0.3, h * 0.58, h * 0.2);
        ctx.fillStyle = INK;
        roundRectPath(ctx, w * 0.52, h * 0.18, w * 0.42, h * 0.3, 10);
        ctx.fill();
        ctx.fillStyle = art.accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(ctx, brand, w * 0.73, h * 0.33, w * 0.38, 24, FONTS.display);
        ctx.fillStyle = '#FFFFFF';
        fitText(ctx, art.set, w * 0.73, h * 0.66, w * 0.38, 40, FONTS.display);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.restore();
      });
    }),
  );
}

export function boxCellOffset(index: number): [number, number] {
  const { cols, rows } = BOX_ATLAS;
  const i = ((index % 4) + 4) % 4;
  return [(i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows];
}
