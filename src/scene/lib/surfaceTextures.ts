import type { CanvasTexture } from 'three';
import { tones } from '../scenePalette';
import { cachedTexture, liveCanvasTexture, roundRectPath } from './canvas';
import { createRng, type Rng, randRange } from './rng';

/**
 * Procedural surface textures (docs/04 §8 "subtle grain … generated with canvas noise, never
 * heavy images"). Each is deterministic (seeded) and tiles seamlessly.
 */

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
}

function speckle(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  w: number,
  h: number,
  count: number,
  alpha: number,
) {
  for (let i = 0; i < count; i++) {
    const light = rng() > 0.5;
    ctx.fillStyle = light ? `rgba(255,255,255,${alpha})` : `rgba(40,30,20,${alpha})`;
    const size = 1 + rng() * 2;
    ctx.fillRect(rng() * w, rng() * h, size, size);
  }
}

/**
 * Honey-toned floor planks, 2 m × 2 m per tile (planks run along U). Staggered joints, per-plank
 * tone shifts, wavy grain and a soft highlight on each plank edge for a varnished-toy look.
 */
export function woodFloorTexture(): CanvasTexture {
  return cachedTexture('wood-floor', () =>
    liveCanvasTexture(
      1024,
      1024,
      (ctx, w, h) => {
        const rng = createRng(12);
        const plankH = h / 12; // ≈ 16.7 cm planks
        for (let row = 0; row < 12; row++) {
          const y = row * plankH;
          let x = -rng() * w * 0.5;
          while (x < w) {
            const len = randRange(rng, 0.38, 0.9) * w;
            const hue = randRange(rng, 26, 34);
            const light = randRange(rng, 52, 62);
            const base = hsl(hue, randRange(rng, 34, 44), light);
            // Draw twice when wrapping so the tile stays seamless horizontally.
            for (const offset of [0, w, -w]) {
              const px = x + offset;
              if (px > w || px + len < 0) continue;
              ctx.fillStyle = base;
              ctx.fillRect(px, y, len, plankH);
              // Grain: long wavy streaks, slightly darker.
              const grainRng = createRng(Math.floor(hue * 1000 + light * 10 + row));
              for (let g = 0; g < 7; g++) {
                const gy = y + randRange(grainRng, 0.12, 0.88) * plankH;
                const amp = randRange(grainRng, 1, 4);
                const freq = randRange(grainRng, 0.004, 0.012);
                ctx.strokeStyle = `rgba(110, 60, 25, ${randRange(grainRng, 0.06, 0.14)})`;
                ctx.lineWidth = randRange(grainRng, 1, 2.6);
                ctx.beginPath();
                for (let sx = 0; sx <= len; sx += 12) {
                  const yy = gy + Math.sin((px + sx) * freq + g) * amp;
                  if (sx === 0) ctx.moveTo(px + sx, yy);
                  else ctx.lineTo(px + sx, yy);
                }
                ctx.stroke();
              }
              if (grainRng() > 0.7) {
                // A small knot.
                const kx = px + randRange(grainRng, 0.2, 0.8) * len;
                const ky = y + plankH * randRange(grainRng, 0.3, 0.7);
                ctx.fillStyle = 'rgba(100, 55, 25, 0.35)';
                ctx.beginPath();
                ctx.ellipse(kx, ky, 9, 5, 0, 0, Math.PI * 2);
                ctx.fill();
              }
              // Bevel: light top edge, dark seam at the bottom and the end joint.
              ctx.fillStyle = 'rgba(255, 236, 205, 0.35)';
              ctx.fillRect(px, y + 2, len, 3);
              ctx.fillStyle = 'rgba(70, 38, 18, 0.42)';
              ctx.fillRect(px, y + plankH - 3, len, 3);
              ctx.fillRect(px + len - 3, y, 3, plankH);
            }
            x += len;
          }
        }
        speckle(ctx, rng, w, h, 2500, 0.05);
      },
      { repeat: true, anisotropy: 8 },
    ),
  );
}

/** Cream wallpaper with soft stripes and tiny sparkle motifs (a wink at card shine). */
export function wallpaperTexture(): CanvasTexture {
  return cachedTexture('wallpaper', () =>
    liveCanvasTexture(
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = tones.plaster;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(214, 170, 120, 0.16)';
        for (let i = 0; i < 4; i++) ctx.fillRect(i * (w / 4) + w / 16, 0, w / 8, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        for (let i = 0; i < 4; i++) ctx.fillRect(i * (w / 4) + w / 16 - 2, 0, 2, h);
        // Four-point sparkles in the plain bands, alternating rows.
        const star = (cx: number, cy: number, r: number) => {
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const rr = k % 2 === 0 ? r : r * 0.3;
            const a = -Math.PI / 2 + (k * Math.PI) / 4;
            const x = cx + Math.cos(a) * rr;
            const y = cy + Math.sin(a) * rr;
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        };
        ctx.fillStyle = 'rgba(255, 111, 89, 0.28)';
        for (let i = 0; i < 4; i++) star(i * (w / 4) + w / 4 - 2, h * 0.25, 7);
        ctx.fillStyle = 'rgba(31, 181, 166, 0.26)';
        for (let i = 0; i < 4; i++) star(i * (w / 4) + w / 4 - 2, h * 0.75, 7);
      },
      { repeat: true },
    ),
  );
}

/** Square concrete pavers with grout lines, 2 m × 2 m per tile. */
export function paverTexture(): CanvasTexture {
  return cachedTexture('pavers', () =>
    liveCanvasTexture(
      512,
      512,
      (ctx, w, h) => {
        const rng = createRng(33);
        ctx.fillStyle = '#B9AE9C';
        ctx.fillRect(0, 0, w, h);
        const n = 4;
        const cell = w / n;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const l = randRange(rng, 80, 86);
            ctx.fillStyle = hsl(randRange(rng, 32, 40), randRange(rng, 10, 18), l);
            roundRectPath(ctx, i * cell + 3, j * cell + 3, cell - 6, cell - 6, 8);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(i * cell + 8, j * cell + 5, cell - 16, 3);
          }
        }
        speckle(ctx, rng, w, h, 3000, 0.07);
      },
      { repeat: true, anisotropy: 8 },
    ),
  );
}

/** Old Town cobblestones (docs/03 §2 "Lantern Lane: cobblestones, string lights"), 1.5 m tile. */
export function cobbleTexture(): CanvasTexture {
  return cachedTexture('cobbles', () =>
    liveCanvasTexture(
      512,
      512,
      (ctx, w, h) => {
        const rng = createRng(51);
        ctx.fillStyle = '#4E4F5E';
        ctx.fillRect(0, 0, w, h);
        const rows = 10;
        const rowH = h / rows;
        for (let r = 0; r < rows; r++) {
          const stones = 7;
          const sw = w / stones;
          const offset = r % 2 === 0 ? 0 : sw / 2;
          for (let s = -1; s < stones; s++) {
            const x = s * sw + offset + randRange(rng, -3, 3);
            const y = r * rowH;
            const hue = randRange(rng, 215, 250);
            const sat = randRange(rng, 6, 16);
            const light = randRange(rng, 48, 60);
            for (const wrap of [0, w]) {
              ctx.fillStyle = hsl(hue, sat, light);
              roundRectPath(ctx, x + 3 - wrap, y + 3, sw - 6, rowH - 6, 12);
              ctx.fill();
              ctx.strokeStyle = 'rgba(255,255,255,0.22)';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(x + 10 - wrap, y + 7);
              ctx.lineTo(x + sw - 14 - wrap, y + 7);
              ctx.stroke();
            }
          }
        }
        speckle(ctx, rng, w, h, 2500, 0.06);
      },
      { repeat: true, anisotropy: 8 },
    ),
  );
}
