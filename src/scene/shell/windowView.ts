import type { CanvasTexture } from 'three';
import { cachedTexture, liveCanvasTexture, roundRectPath } from '../lib/canvas';
import { createRng, type Rng, randRange } from '../lib/rng';

/**
 * The painted street seen through the shop windows: a diorama-style backdrop card (sky, the
 * townhouses across Lantern Lane, a lamp post, a hint of street). An orthographic camera looking
 * down can never see the sky through a window, so like a museum diorama we paint it.
 */
export type ViewTime = 'day' | 'evening';

const FACADES = ['#9CC5A1', '#F6D98B', '#E9A3A0', '#A7C7E7', '#C4B0E0', '#F2B98C'];

function sky(ctx: CanvasRenderingContext2D, w: number, h: number, time: ViewTime, rng: Rng) {
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.8);
  if (time === 'day') {
    g.addColorStop(0, '#7FC0F0');
    g.addColorStop(0.55, '#C9E8FF');
    g.addColorStop(1, '#FFF0D8');
  } else {
    g.addColorStop(0, '#171C4E');
    g.addColorStop(0.5, '#4A3A7C');
    g.addColorStop(0.85, '#C46A8A');
    g.addColorStop(1, '#FF9E6B');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (time === 'day') {
    const sun = ctx.createRadialGradient(w * 0.78, h * 0.14, 4, w * 0.78, h * 0.14, h * 0.2);
    sun.addColorStop(0, 'rgba(255, 250, 225, 1)');
    sun.addColorStop(0.25, 'rgba(255, 240, 190, 0.8)');
    sun.addColorStop(1, 'rgba(255, 240, 190, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (let c = 0; c < 3; c++) {
      const cx = randRange(rng, 0.1, 0.8) * w;
      const cy = randRange(rng, 0.08, 0.32) * h;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(
          cx + (i - 2) * 16,
          cy - Math.sin((i / 4) * Math.PI) * 12,
          18 + Math.sin((i / 4) * Math.PI) * 10,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  } else {
    ctx.fillStyle = '#FFF6D6';
    for (let i = 0; i < 40; i++) {
      const r = rng() * 1.6 + 0.4;
      ctx.globalAlpha = 0.4 + rng() * 0.6;
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h * 0.45, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Crescent moon.
    ctx.fillStyle = '#FFF1C2';
    ctx.beginPath();
    ctx.arc(w * 0.76, h * 0.15, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(w * 0.76 + 10, h * 0.15 - 6, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function townhouses(ctx: CanvasRenderingContext2D, w: number, h: number, time: ViewTime, rng: Rng) {
  const ground = h * 0.74;
  let x = -randRange(rng, 10, 40);
  let i = Math.floor(rng() * FACADES.length);
  while (x < w) {
    const bw = randRange(rng, 0.2, 0.3) * w;
    const bh = randRange(rng, 0.3, 0.46) * h;
    const color = FACADES[i % FACADES.length] ?? '#F6D98B';
    i++;
    const top = ground - bh;
    ctx.fillStyle = color;
    ctx.fillRect(x, top, bw, bh);
    if (time === 'evening') {
      ctx.fillStyle = 'rgba(40, 30, 90, 0.45)';
      ctx.fillRect(x, top, bw, bh);
    }
    // Roof: gable or cornice.
    ctx.fillStyle = time === 'day' ? '#B5654A' : '#5A3450';
    if (rng() > 0.45) {
      ctx.beginPath();
      ctx.moveTo(x - 6, top + 2);
      ctx.lineTo(x + bw / 2, top - bh * 0.28);
      ctx.lineTo(x + bw + 6, top + 2);
      ctx.fill();
    } else {
      ctx.fillRect(x - 5, top - 10, bw + 10, 12);
    }
    // Windows: two or three columns, a few rows.
    const cols = bw > w * 0.25 ? 3 : 2;
    const rows = Math.max(2, Math.floor(bh / 62));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ww = bw / (cols * 2);
        const wx = x + (c + 0.5) * (bw / cols) - ww / 2;
        const wy = top + 16 + r * 58;
        if (wy + 36 > ground - 40) continue;
        const lit = time === 'evening' && rng() > 0.35;
        ctx.fillStyle = time === 'day' ? '#DDF0FF' : lit ? '#FFD27A' : '#2B2F55';
        roundRectPath(ctx, wx, wy, ww, 34, 6);
        ctx.fill();
        if (time === 'day') {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillRect(wx + 4, wy + 4, ww * 0.25, 10);
        }
        ctx.strokeStyle = 'rgba(30,35,64,0.35)';
        ctx.lineWidth = 2;
        roundRectPath(ctx, wx, wy, ww, 34, 6);
        ctx.stroke();
      }
    }
    // Ground-floor shopfront with a striped awning on some houses.
    if (rng() > 0.4) {
      const aw = bw * 0.8;
      const ax = x + bw * 0.1;
      const ay = ground - 58;
      for (let s = 0; s < 6; s++) {
        ctx.fillStyle = s % 2 === 0 ? '#FF6F59' : '#FFF6E5';
        ctx.fillRect(ax + (s * aw) / 6, ay, aw / 6 + 1, 16);
      }
      ctx.fillStyle = time === 'day' ? '#BFE3F7' : '#FFC46B';
      ctx.fillRect(ax + 6, ay + 18, aw - 12, 34);
    } else {
      ctx.fillStyle = time === 'day' ? '#7A5234' : '#3E2A3E';
      roundRectPath(ctx, x + bw * 0.4, ground - 50, bw * 0.2, 50, 8);
      ctx.fill();
    }
    x += bw + randRange(rng, -2, 10);
  }
}

function street(ctx: CanvasRenderingContext2D, w: number, h: number, time: ViewTime) {
  const ground = h * 0.74;
  ctx.fillStyle = time === 'day' ? '#D9D0C1' : '#6E6A86';
  ctx.fillRect(0, ground, w, h * 0.06);
  ctx.fillStyle = time === 'day' ? '#EDE6DA' : '#8A86A0';
  ctx.fillRect(0, ground + h * 0.06, w, 5);
  ctx.fillStyle = time === 'day' ? '#8D8F9D' : '#3A3C58';
  ctx.fillRect(0, ground + h * 0.06 + 5, w, h);
  ctx.fillStyle = time === 'day' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)';
  for (let y = ground + h * 0.08; y < h; y += 14) {
    for (let x = (y % 28) / 2; x < w; x += 28) ctx.fillRect(x, y, 20, 8);
  }
}

function lampPost(ctx: CanvasRenderingContext2D, x: number, h: number, time: ViewTime) {
  const ground = h * 0.8;
  if (time === 'evening') {
    const glow = ctx.createRadialGradient(x, h * 0.36, 2, x, h * 0.36, 70);
    glow.addColorStop(0, 'rgba(255, 214, 140, 0.9)');
    glow.addColorStop(1, 'rgba(255, 214, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 80, h * 0.36 - 80, 160, 160);
  }
  ctx.fillStyle = '#2E3A4B';
  ctx.fillRect(x - 4, h * 0.38, 8, ground - h * 0.38);
  ctx.fillRect(x - 12, ground - 10, 24, 10);
  ctx.fillStyle = time === 'day' ? '#FFF1CF' : '#FFD68A';
  roundRectPath(ctx, x - 13, h * 0.33, 26, 30, 5);
  ctx.fill();
  ctx.strokeStyle = '#2E3A4B';
  ctx.lineWidth = 4;
  roundRectPath(ctx, x - 13, h * 0.33, 26, 30, 5);
  ctx.stroke();
  ctx.fillStyle = '#2E3A4B';
  ctx.beginPath();
  ctx.moveTo(x - 17, h * 0.33 + 2);
  ctx.lineTo(x, h * 0.3);
  ctx.lineTo(x + 17, h * 0.33 + 2);
  ctx.fill();
}

function tree(ctx: CanvasRenderingContext2D, x: number, h: number, time: ViewTime) {
  const ground = h * 0.8;
  ctx.fillStyle = time === 'day' ? '#7A5234' : '#3E2A34';
  ctx.fillRect(x - 5, ground - 90, 10, 90);
  ctx.fillStyle = time === 'day' ? '#56B870' : '#2E5A56';
  for (const [dx, dy, r] of [
    [0, -120, 42],
    [-28, -100, 30],
    [28, -98, 32],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx, ground + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function windowViewTexture(variant: 'west' | 'south', time: ViewTime): CanvasTexture {
  return cachedTexture(`window-view:${variant}:${time}`, () =>
    liveCanvasTexture(512, 448, (ctx, w, h) => {
      const seed = variant === 'west' ? 101 : 202;
      sky(ctx, w, h, time, createRng(seed));
      townhouses(ctx, w, h, time, createRng(seed + 1));
      street(ctx, w, h, time);
      if (variant === 'west') {
        lampPost(ctx, w * 0.3, h, time);
        tree(ctx, w * 0.82, h, time);
      } else {
        tree(ctx, w * 0.2, h, time);
        lampPost(ctx, w * 0.66, h, time);
      }
    }),
  );
}
