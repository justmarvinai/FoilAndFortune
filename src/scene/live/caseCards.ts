import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import { getRegistry } from '@/content/registry';
import type { ElementId } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';
import { elements } from '@/content/tcg/gk/elements';
import { parseCardKey } from '@/sim/cards';
import { foilStops, rarityColors } from '@/ui/palette';
import { createCanvas, roundRectPath } from '../lib/canvas';
import { drawCreature, type PackCreature } from '../products/packArt';
import { liveTones, tones } from '../scenePalette';

/**
 * Card faces for a display case's singles (docs/04 §5.2, simplified for diorama scale): rarity
 * frame, the card's real illustration when a pre-rendered file exists (src/cards, loaded lazily
 * and only from our own origin), else a drawn creature in its element's colours, plus a foil
 * sheen for holo finishes. One small canvas atlas per case; a cell is redrawn when its card
 * changes.
 */
export const CASE_ATLAS = { cols: 3, rows: 2, cellW: 128, cellH: 180 } as const;

const CREATURE_OF: Partial<Record<ElementId, PackCreature>> = {
  ember: 'emberpup',
  volt: 'sparkit',
  tide: 'sploot',
  mystic: 'masquer',
  shade: 'phantom',
  terra: 'boltbuck',
};

type ArtUrl = (card: CardDef) => string | null;
let artUrlLoader: Promise<ArtUrl> | null = null;

/** Pre-rendered art URLs via the card package, loaded on demand; never a runtime render. */
function artUrls(): Promise<ArtUrl> {
  artUrlLoader ??= Promise.all([import('@/cards/cardArt'), import('@/cards/artIndex')])
    .then(([{ resolveCardArt }, { artIndex }]): ArtUrl => {
      return (card) => {
        const source = resolveCardArt(card, artIndex, { runtime: false });
        return source.kind === 'override' || source.kind === 'prerendered' ? source.url : null;
      };
    })
    .catch((): ArtUrl => () => null);
  return artUrlLoader;
}

const images = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(url: string): Promise<HTMLImageElement | null> {
  let hit = images.get(url);
  if (!hit) {
    hit = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
    images.set(url, hit);
  }
  return hit;
}

export interface CaseAtlas {
  texture: CanvasTexture;
  /** Shows `cardKey` in cell `index` (null = empty). Redraws only on change. */
  setCard(index: number, cardKey: string | null): void;
  dispose(): void;
}

function isHolo(finish: string): boolean {
  return finish !== 'normal' && finish !== 'reverseHolo';
}

export function createCaseAtlas(): CaseAtlas {
  const { cols, rows, cellW, cellH } = CASE_ATLAS;
  const { canvas, ctx } = createCanvas(cols * cellW, rows * cellH);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  const shown = new Map<number, string | null>();
  let disposed = false;

  const cellOrigin = (index: number) => ({
    x: (index % cols) * cellW,
    y: Math.floor(index / cols) * cellH,
  });

  function drawFrame(index: number, card: CardDef, finish: string, art: HTMLImageElement | null) {
    const { x, y } = cellOrigin(index);
    const w = cellW;
    const h = cellH;
    const element = card.element ? elements[card.element] : undefined;
    ctx.save();
    ctx.translate(x, y);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = tones.ink;
    roundRectPath(ctx, 0, 0, w, h, 12);
    ctx.fill();
    ctx.fillStyle = rarityColors[card.rarity] ?? rarityColors.common;
    roundRectPath(ctx, 4, 4, w - 8, h - 8, 9);
    ctx.fill();
    if (finish === 'reverseHolo') {
      // Reverse holo: the foil is on the frame, not the art.
      const g = ctx.createLinearGradient(0, 0, w, h);
      foilStops.forEach((stop, i) => {
        g.addColorStop(i / (foilStops.length - 1), stop);
      });
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = g;
      roundRectPath(ctx, 4, 4, w - 8, h - 8, 9);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Name bar in the element's colour (the cream of a real card washes out at this scale).
    ctx.fillStyle = element?.color ?? tones.paper;
    roundRectPath(ctx, 9, 9, w - 18, 18, 6);
    ctx.fill();
    ctx.fillStyle = tones.ink;
    roundRectPath(ctx, 15, 15, w * 0.42, 6, 3);
    ctx.fill();
    // Art window: most of the card, as players see it from across the shop.
    const ax = 9;
    const ay = 30;
    const aw = w - 18;
    const ah = h * 0.58;
    ctx.save();
    roundRectPath(ctx, ax, ay, aw, ah, 6);
    ctx.clip();
    ctx.fillStyle = element?.tint ?? tones.paper2;
    ctx.fillRect(ax, ay, aw, ah);
    if (art) {
      // Cover-fit the illustration into the window.
      const scale = Math.max(aw / art.width, ah / art.height);
      const dw = art.width * scale;
      const dh = art.height * scale;
      ctx.drawImage(art, ax + (aw - dw) / 2, ay + (ah - dh) / 2, dw, dh);
    } else {
      const creature = (card.element && CREATURE_OF[card.element]) || 'solaryx';
      drawCreature(ctx, creature, w / 2, ay + ah * 0.55, ah * 0.3);
    }
    if (isHolo(finish)) {
      const g = ctx.createLinearGradient(ax, ay, ax + aw, ay + ah);
      foilStops.forEach((stop, i) => {
        g.addColorStop(i / (foilStops.length - 1), stop);
      });
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = g;
      ctx.fillRect(ax, ay, aw, ah);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // Text box, tinted, with a few scribbles standing in for the rules text.
    ctx.fillStyle = element?.tint ?? tones.paper;
    roundRectPath(ctx, 9, ay + ah + 5, w - 18, h - (ay + ah + 5) - 9, 6);
    ctx.fill();
    ctx.fillStyle = element?.shade ?? tones.ink;
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 2; i++) {
      roundRectPath(ctx, 17, ay + ah + 15 + i * 13, (w - 34) * (i === 1 ? 0.6 : 1), 6, 3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawEmpty(index: number) {
    const { x, y } = cellOrigin(index);
    ctx.save();
    ctx.translate(x, y);
    ctx.clearRect(0, 0, cellW, cellH);
    ctx.fillStyle = liveTones.cardBack;
    roundRectPath(ctx, 0, 0, cellW, cellH, 12);
    ctx.fill();
    ctx.restore();
  }

  return {
    texture,
    setCard(index, cardKey) {
      if (shown.has(index) && shown.get(index) === cardKey) return;
      shown.set(index, cardKey);
      const print = cardKey ? parseCardKey(cardKey) : null;
      const card = print ? getRegistry().cards.get(print.cardId) : undefined;
      if (!print || !card) {
        drawEmpty(index);
        texture.needsUpdate = true;
        return;
      }
      drawFrame(index, card, print.finish, null);
      texture.needsUpdate = true;
      void artUrls().then(async (urlOf) => {
        const url = urlOf(card);
        const image = url ? await loadImage(url) : null;
        // Still showing the same card? (the slot may have sold in the meantime)
        if (!image || disposed || shown.get(index) !== cardKey) return;
        drawFrame(index, card, print.finish, image);
        texture.needsUpdate = true;
      });
    },
    dispose() {
      disposed = true;
      texture.dispose();
    },
  };
}

/** UV offset of a cell (flipY: canvas row 0 is the top). */
export function caseCellRect(index: number): readonly [number, number, number, number] {
  const { cols, rows } = CASE_ATLAS;
  const col = index % cols;
  const row = Math.floor(index / cols) % rows;
  return [col / cols, 1 - (row + 1) / rows, 1 / cols, 1 / rows];
}
