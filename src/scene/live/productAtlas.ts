import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import { ART_BOX, artShape, productArtSvg } from '@/art/packs/productArt';
import { setArtStyle, wrapperVariant } from '@/art/packs/setStyles';
import { getRegistry } from '@/content/registry';
import type { ProductDef } from '@/content/schema/tcg';
import { createCanvas } from '../lib/canvas';
import type { ProductShape } from './slotLayout';

/**
 * The shelf product atlas (docs/06 §7 "a generated product atlas, canvas-rendered from pack art
 * at load time"): every product face on the shelves is the very same SVG the UI shows
 * (src/art/packs), rasterised once into one shared canvas texture. Cells are allocated on first
 * use and drawn asynchronously (SVG → image → canvas); until then a cell shows the wrapper's
 * main colour, so nothing ever flashes black.
 *
 * Shelf scale uses the `icon` detail level: no fine print, so the display font (which an SVG
 * drawn as an image can't load) is never needed.
 */
export const ATLAS_SIZE = 1024;
const PADDING = 4;

/** UV rectangle of a cell (flipY applied): u, v of the bottom-left corner, width, height. */
export type AtlasRect = readonly [number, number, number, number];

/** The front face of each shape inside its art box (art units), and its cell size in pixels. */
const FACE: Record<ProductShape, { crop: [number, number, number, number]; px: [number, number] }> =
  {
    pack: { crop: [0, 0, 100, 160], px: [120, 192] },
    blister: { crop: [4, 2, 112, 156], px: [128, 178] },
    deck: { crop: [6, 24, 80, 122], px: [104, 158] },
    box: { crop: [8, 46, 116, 68], px: [174, 102] },
  };

interface Cell {
  rect: AtlasRect;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AtlasState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;
  cells: Map<string, Cell>;
  cursor: { x: number; y: number; row: number };
}

let atlas: AtlasState | null = null;

function state(): AtlasState {
  if (atlas) return atlas;
  const { canvas, ctx } = createCanvas(ATLAS_SIZE, ATLAS_SIZE);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  atlas = { canvas, ctx, texture, cells: new Map(), cursor: { x: 0, y: 0, row: 0 } };
  return atlas;
}

export function productAtlasTexture(): CanvasTexture {
  return state().texture;
}

/** The variant a unit shows: boosters cycle through their set's wrapper arts. */
export function unitVariant(shape: ProductShape, index: number): number {
  return shape === 'pack' ? index % 4 : 0;
}

function allocate(s: AtlasState, w: number, h: number): Cell | null {
  const c = s.cursor;
  if (c.x + w + PADDING > ATLAS_SIZE) {
    c.x = 0;
    c.y += c.row + PADDING;
    c.row = 0;
  }
  if (c.y + h + PADDING > ATLAS_SIZE) return null;
  const x = c.x + PADDING;
  const y = c.y + PADDING;
  c.x += w + PADDING;
  c.row = Math.max(c.row, h);
  // Inset the UVs half a texel so mipmaps don't bleed in the neighbours.
  const rect: AtlasRect = [
    (x + 0.5) / ATLAS_SIZE,
    1 - (y + h - 0.5) / ATLAS_SIZE,
    (w - 1) / ATLAS_SIZE,
    (h - 1) / ATLAS_SIZE,
  ];
  return { rect, x, y, w, h };
}

const FALLBACK: AtlasRect = [0, 0, 1 / ATLAS_SIZE, 1 / ATLAS_SIZE];

/**
 * The atlas cell of a product's face (allocating and drawing it on first use). Unknown products
 * or a full atlas get a 1-texel cell.
 */
export function productRect(productId: string, variant: number): AtlasRect {
  const s = state();
  const key = `${productId}#${variant}`;
  const hit = s.cells.get(key);
  if (hit) return hit.rect;
  const registry = getRegistry();
  const product = registry.products.get(productId);
  if (!product) return FALLBACK;
  const shape = artShape(product.kind);
  const face = FACE[shape];
  const cell = allocate(s, face.px[0], face.px[1]);
  if (!cell) return FALLBACK;
  s.cells.set(key, cell);
  const set = product.setId ? registry.sets.get(product.setId) : undefined;
  // Placeholder: the wrapper's main colour until the art is drawn.
  s.ctx.fillStyle = wrapperVariant(setArtStyle(set), variant).mid;
  s.ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
  s.texture.needsUpdate = true;
  void drawProduct(s, cell, product, set, variant, shape);
  return cell.rect;
}

async function drawProduct(
  s: AtlasState,
  cell: Cell,
  product: ProductDef,
  set: Parameters<typeof productArtSvg>[1],
  variant: number,
  shape: ProductShape,
): Promise<void> {
  const box = ART_BOX[shape];
  const face = FACE[shape];
  // Render the whole art at the cell's scale, then copy the front face out of it.
  const scale = cell.w / face.crop[2];
  const width = Math.round(box.width * scale);
  const height = Math.round(box.height * scale);
  const svg = productArtSvg(product, set, { variant, detail: 'icon', idPrefix: `atlas${variant}` })
    .replace('width="100%"', `width="${width}"`)
    .replace('height="100%"', `height="${height}"`);
  const image = new Image(width, height);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    await image.decode();
  } catch {
    return; // keep the colour placeholder
  }
  const [cx, cy, cw, ch] = face.crop;
  // Drawn over the colour placeholder, which fills the art's transparent corners and crimps
  // (the material is opaque: transparent texels would turn black).
  s.ctx.drawImage(
    image,
    cx * scale,
    cy * scale,
    cw * scale,
    ch * scale,
    cell.x,
    cell.y,
    cell.w,
    cell.h,
  );
  s.texture.needsUpdate = true;
}
