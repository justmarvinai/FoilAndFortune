import type { CanvasTexture } from 'three';
import { rarityColors } from '@/ui/palette';
import { cachedTexture, liveCanvasTexture, roundRectPath } from '../lib/canvas';
import { drawCreature, type PackCreature } from './packArt';

/**
 * Tiny card faces for the display case and slabs (docs/04 §5.2 layout, heavily simplified:
 * at diorama scale a card is a handful of pixels, so only frame colour, art window, name bar
 * and a foil sheen survive). Cell order: see `CARD_FACES`.
 */
export interface CardFace {
  creature: PackCreature;
  frame: string;
  art: string;
  holo: boolean;
}

export const CARD_FACES: readonly CardFace[] = [
  { creature: 'sparkit', frame: rarityColors.secretRare, art: '#FFF1B8', holo: true },
  { creature: 'emberpup', frame: rarityColors.holoRare, art: '#FFD9C4', holo: true },
  { creature: 'sploot', frame: rarityColors.rare, art: '#CFEFFF', holo: false },
  { creature: 'masquer', frame: rarityColors.ultraRare, art: '#E9DDFF', holo: true },
  { creature: 'solaryx', frame: rarityColors.illustrationRare, art: '#FFE9B0', holo: true },
  { creature: 'boltbuck', frame: rarityColors.uncommon, art: '#FFF4CC', holo: false },
];

export const CARD_ATLAS = { cols: 3, rows: 2, cellW: 200, cellH: 280 } as const;

function drawCard(ctx: CanvasRenderingContext2D, face: CardFace, w: number, h: number) {
  ctx.fillStyle = '#1E2340';
  roundRectPath(ctx, 0, 0, w, h, 16);
  ctx.fill();
  ctx.fillStyle = face.frame;
  roundRectPath(ctx, 5, 5, w - 10, h - 10, 12);
  ctx.fill();
  ctx.fillStyle = '#FFF6E5';
  roundRectPath(ctx, 14, 14, w - 28, 26, 8);
  ctx.fill();
  ctx.fillStyle = '#1E2340';
  roundRectPath(ctx, 22, 22, w * 0.45, 10, 5);
  ctx.fill();
  ctx.fillStyle = face.art;
  roundRectPath(ctx, 14, 46, w - 28, h * 0.46, 8);
  ctx.fill();
  ctx.save();
  roundRectPath(ctx, 14, 46, w - 28, h * 0.46, 8);
  ctx.clip();
  drawCreature(ctx, face.creature, w / 2, 46 + h * 0.25, h * 0.12);
  if (face.holo) {
    const g = ctx.createLinearGradient(0, 46, w, 46 + h * 0.46);
    g.addColorStop(0, 'rgba(127,246,255,0.35)');
    g.addColorStop(0.3, 'rgba(183,139,255,0.25)');
    g.addColorStop(0.55, 'rgba(255,139,209,0.3)');
    g.addColorStop(0.8, 'rgba(255,229,138,0.3)');
    g.addColorStop(1, 'rgba(139,255,176,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  ctx.fillStyle = '#FFF6E5';
  roundRectPath(ctx, 14, 58 + h * 0.46, w - 28, h * 0.3, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,35,64,0.35)';
  for (let i = 0; i < 3; i++) {
    roundRectPath(ctx, 24, 70 + h * 0.46 + i * 20, (w - 60) * (i === 2 ? 0.6 : 1), 8, 4);
    ctx.fill();
  }
}

export function cardAtlasTexture(): CanvasTexture {
  const { cols, rows, cellW, cellH } = CARD_ATLAS;
  return cachedTexture('card-atlas', () =>
    liveCanvasTexture(cols * cellW, rows * cellH, (ctx) => {
      CARD_FACES.forEach((face, i) => {
        ctx.save();
        ctx.translate((i % cols) * cellW, Math.floor(i / cols) * cellH);
        drawCard(ctx, face, cellW, cellH);
        ctx.restore();
      });
    }),
  );
}

/** A texture that shows one card of the atlas (shares the GPU upload with the atlas). */
export function cardFaceTexture(index: number): CanvasTexture {
  const { cols, rows } = CARD_ATLAS;
  return cachedTexture(`card-face:${index}`, () => {
    const t = cardAtlasTexture().clone();
    const i = index % CARD_FACES.length;
    t.repeat.set(1 / cols, 1 / rows);
    t.offset.set((i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows);
    t.needsUpdate = true;
    return t;
  });
}
