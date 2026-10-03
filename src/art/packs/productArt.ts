import type { ProductDef, ProductKind, SetDef } from '@/content/schema/tcg';
import { foilStops, palette } from '@/ui/palette';
import { mascotSvg } from './mascots';
import {
  type DeckTheme,
  deckTheme,
  type SetArtStyle,
  setArtStyle,
  wrapperVariant,
} from './setStyles';
import {
  esc,
  hashString,
  type IdFactory,
  idFactory,
  linearGradient,
  n,
  poly,
  radialGradient,
  roundRect,
  sunburst,
  textTag,
} from './svg';

/**
 * Sealed-product art composer (docs/04 §5.5, docs/08 §4): booster wrappers with crimped foil
 * ends, the 3-pack blister, the starter deck box and the booster box, as self-contained SVG
 * strings. Pure and deterministic (same inputs, same string; no DOM, no RNG), so the UI inlines
 * it through `ProductArt` and the 3D scene can rasterize the very same markup for shelf
 * textures. Printed text is language-neutral: proper nouns from content (brand, set, deck name)
 * and numbers with pictograms ("10 ▯" cards, "36 ▭" packs), so nothing needs translating.
 */

export type ProductArtProduct = Pick<ProductDef, 'id' | 'kind' | 'name' | 'contents'>;
export type ProductArtSet = Pick<SetDef, 'id' | 'code' | 'name'>;

export type ArtShape = 'pack' | 'blister' | 'deck' | 'box';

export interface ProductArtOptions {
  /** Wrapper variant (boosters rotate through the set's mascots). Default 0. */
  variant?: number;
  /**
   * Prefix for element ids (gradients, clips). Inline SVGs share the page's id namespace, so every
   * inline instance needs its own; standalone images can keep the deterministic default.
   */
  idPrefix?: string;
  /** Brand wordmark printed on the product (e.g. `Glimmerkin`). */
  brandName?: string;
  /** Cards per booster, printed on the wrapper ("10" + card pictogram). */
  cardsPerPack?: number;
  /** Accessible `<title>`. */
  title?: string;
  /** `icon` drops fine print for tiny renders (≤ 72 px); `full` is the default. */
  detail?: 'full' | 'icon';
}

const INK = palette.ink;
const WHITE = '#FFFFFF';

const SHAPE_OF: Partial<Record<ProductKind, ArtShape>> = {
  booster: 'pack',
  importBooster: 'pack',
  blister: 'blister',
  starterDeck: 'deck',
  box: 'box',
  importBox: 'box',
};

export function artShape(kind: ProductKind): ArtShape {
  return SHAPE_OF[kind] ?? 'box';
}

/** The art's viewBox size per shape (width × height in art units). */
export const ART_BOX: Record<ArtShape, { width: number; height: number }> = {
  pack: { width: 100, height: 160 },
  blister: { width: 120, height: 160 },
  deck: { width: 110, height: 150 },
  box: { width: 160, height: 120 },
};

/** Packs inside a product (booster box 36, blister 3), from its content entries. */
export function packsInside(product: Pick<ProductDef, 'contents'>): number {
  let packs = 0;
  for (const entry of product.contents) if (entry.type === 'pack') packs += entry.count;
  return packs;
}

/** Fixed cards in a product (a starter deck's list plus its guaranteed holo), if listed. */
function fixedCardsInside(product: Pick<ProductDef, 'contents'>): number {
  let cards = 0;
  for (const entry of product.contents) {
    if (entry.type === 'fixedCards') cards += entry.cards.length;
    if (entry.type === 'guaranteedHoloPool') cards += 1;
  }
  return cards;
}

interface Ctx {
  ids: IdFactory;
  style: SetArtStyle;
  brand: string;
  /** Cards per booster for the wrapper's count badge (0 = no badge). */
  cardsPerPack: number;
  icon: boolean;
  defs: Map<string, string>;
}

function def(ctx: Ctx, name: string, build: (id: string) => string): string {
  const id = ctx.ids(name);
  if (!ctx.defs.has(id)) ctx.defs.set(id, build(id));
  return ctx.ids.url(name);
}

// ---------------------------------------------------------------------------------------------
// Shared motifs
// ---------------------------------------------------------------------------------------------

/** Set emblem in a `size` box centered at (cx, cy). */
function emblem(ctx: Ctx, cx: number, cy: number, size: number): string {
  const s = size / 20;
  const t = `translate(${n(cx - 10 * s)} ${n(cy - 10 * s)}) scale(${n(s)})`;
  if (ctx.style.emblem === 'sunrise') {
    // A sun rising behind the volcano, with three rays (Emberdawn).
    return `<g transform="${t}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"><path d="M10 1.5V4.5M3.2 4.6 5.3 6.7M16.8 4.6 14.7 6.7" stroke="${ctx.style.bandText}" stroke-width="1.8" stroke-linecap="round"/><path d="M3 13a7 7 0 0 1 14 0Z" fill="${ctx.style.bandText}"/><path d="M1 18.5 7 11.5 9 13 11 11.5 13 13 19 18.5Z" fill="#6B2E4A"/><path d="M7 11.5 9 13 11 11.5 13 13" fill="none" stroke="#FF6F59" stroke-width="1.2"/></g>`;
  }
  return `<g transform="${t}"><path d="M10 1.5 12.6 7.4 19 8 14.1 12.2 15.6 18.5 10 15.2 4.4 18.5 5.9 12.2 1 8 7.4 7.4Z" fill="${ctx.style.bandText}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/></g>`;
}

/** Banner ribbon with notched ends, the emblem and the set name. */
function setBand(ctx: Ctx, x: number, y: number, w: number, h: number, withName = true): string {
  const notch = h * 0.35;
  const shape = poly([
    [x, y],
    [x + w, y],
    [x + w - notch, y + h / 2],
    [x + w, y + h],
    [x, y + h],
    [x + notch, y + h / 2],
  ]);
  let out = `<path d="${shape}" fill="${ctx.style.band}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
  out += `<path d="M${n(x + notch + 1)} ${n(y + 1.8)}H${n(x + w - notch - 1)}" stroke="${WHITE}" stroke-opacity="0.22" stroke-width="1.1"/>`;
  const emblemSize = h * 0.9;
  const name = ctx.style.name.toUpperCase();
  if (!withName || ctx.icon || name.length === 0) {
    return out + emblem(ctx, x + w / 2, y + h / 2, emblemSize);
  }
  const ex = x + notch + emblemSize * 0.55;
  out += emblem(ctx, ex, y + h / 2, emblemSize);
  const textLeft = ex + emblemSize * 0.55;
  const textRight = x + w - notch - 1;
  out += textTag(name, {
    x: (textLeft + textRight) / 2,
    y: y + h * 0.74,
    size: h * 0.66,
    fill: ctx.style.bandText,
    maxWidth: textRight - textLeft,
    letterSpacing: 0.3,
  });
  return out;
}

/** "GLIMMERKIN ✦" sticker-style wordmark. */
function wordmark(ctx: Ctx, cx: number, y: number, size: number, maxWidth: number): string {
  if (ctx.icon || !ctx.brand) return '';
  const text = ctx.brand.toUpperCase();
  return `${textTag(text, {
    x: cx,
    y,
    size,
    fill: WHITE,
    stroke: INK,
    strokeWidth: size * 0.3,
    maxWidth,
    letterSpacing: size * 0.06,
  })}${spark(cx + Math.min(maxWidth, text.length * size * 0.62) / 2 + size * 0.55, y - size * 0.75, size * 0.42)}`;
}

function spark(cx: number, cy: number, r: number): string {
  const i = r * 0.32;
  return `<path d="M${n(cx)} ${n(cy - r)}L${n(cx + i)} ${n(cy - i)}L${n(cx + r)} ${n(cy)}L${n(cx + i)} ${n(
    cy + i,
  )}L${n(cx)} ${n(cy + r)}L${n(cx - i)} ${n(cy + i)}L${n(cx - r)} ${n(cy)}L${n(cx - i)} ${n(
    cy - i,
  )}Z" fill="${palette.sun}" stroke="${INK}" stroke-width="${n(r * 0.28)}" stroke-linejoin="round"/>`;
}

/** Number + pictogram pill ("10" + card, "36" + pack). */
function countBadge(
  cx: number,
  cy: number,
  count: number,
  kind: 'card' | 'pack',
  height: number,
  fill: string = INK,
): string {
  const label = String(count);
  const size = height * 0.72;
  const iconW = height * 0.5;
  const textW = label.length * size * 0.58;
  const w = textW + iconW + height * 0.9;
  const x = cx - w / 2;
  const y = cy - height / 2;
  let out = `<path d="${roundRect(x, y, w, height, height / 2)}" fill="${fill}" stroke="${WHITE}" stroke-width="${n(
    height * 0.1,
  )}"/>`;
  out += textTag(label, {
    x: x + height * 0.42 + textW / 2,
    y: cy + size * 0.36,
    size,
    fill: WHITE,
  });
  const ix = x + height * 0.42 + textW + height * 0.12;
  const ih = height * 0.62;
  const iy = cy - ih / 2;
  if (kind === 'card') {
    out += `<path d="${roundRect(ix + iconW * 0.18, iy - ih * 0.06, iconW * 0.72, ih, ih * 0.14)}" fill="none" stroke="${WHITE}" stroke-width="${n(height * 0.08)}" opacity="0.6"/>`;
    out += `<path d="${roundRect(ix, iy + ih * 0.06, iconW * 0.72, ih, ih * 0.14)}" fill="${palette.sun}" stroke="${WHITE}" stroke-width="${n(height * 0.08)}"/>`;
  } else {
    const zig = (yy: number, dir: number) => {
      let d = '';
      const teeth = 4;
      for (let t = 0; t <= teeth; t++) {
        const px = ix + (iconW * t) / teeth;
        d += `L${n(px)} ${n(yy + (t % 2 === 0 ? 0 : dir * ih * 0.08))}`;
      }
      return d;
    };
    out += `<path d="M${n(ix)} ${n(iy)}${zig(iy, 1)}L${n(ix + iconW)} ${n(iy + ih)}L${n(ix)} ${n(
      iy + ih,
    )}Z" fill="${palette.coral}" stroke="${WHITE}" stroke-width="${n(height * 0.08)}" stroke-linejoin="round"/>`;
  }
  return out;
}

/** Horizontal edge shading: gives flat faces a pillowy, printed-foil volume. */
function edgeShade(ctx: Ctx, name = 'edge'): string {
  return def(ctx, name, (id) =>
    linearGradient(
      id,
      [
        { offset: 0, color: INK, opacity: 0.3 },
        { offset: 0.1, color: INK, opacity: 0 },
        { offset: 0.2, color: WHITE, opacity: 0.18 },
        { offset: 0.3, color: WHITE, opacity: 0 },
        { offset: 0.86, color: INK, opacity: 0 },
        { offset: 1, color: INK, opacity: 0.34 },
      ],
      [0, 0],
      [1, 0],
    ),
  );
}

function foilGradient(ctx: Ctx): string {
  return def(ctx, 'foil', (id) =>
    linearGradient(
      id,
      foilStops.map((color, i) => ({ offset: i / (foilStops.length - 1), color })),
      [0, 0],
      [1, 1],
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// Booster pack (100 × 160)
// ---------------------------------------------------------------------------------------------

const PACK_W = 100;
const PACK_H = 160;
const CRIMP = 11;

function packOutline(): string {
  const teeth = 24;
  const step = (PACK_W - 4) / teeth;
  let d = `M2 2.6`;
  for (let i = 0; i < teeth; i++) {
    d += `L${n(2 + step * (i + 0.5))} 0L${n(2 + step * (i + 1))} 2.6`;
  }
  d += `L${PACK_W - 2} ${PACK_H - 2.6}`;
  for (let i = teeth; i > 0; i--) {
    d += `L${n(2 + step * (i - 0.5))} ${PACK_H}L${n(2 + step * (i - 1))} ${n(PACK_H - 2.6)}`;
  }
  return `${d}Z`;
}

const PACK_OUTLINE = packOutline();

/** One booster wrapper in its own 100 × 160 box. `mini` drops text for packs inside products. */
function packWrapper(ctx: Ctx, variantIndex: number, mini: boolean): string {
  const v = wrapperVariant(ctx.style, variantIndex);
  const key = `v${ctx.style.variants.indexOf(v)}`;
  const body = def(ctx, `pack-${key}`, (id) =>
    linearGradient(id, [
      { offset: 0, color: v.top },
      { offset: 0.5, color: v.mid },
      { offset: 1, color: v.bottom },
    ]),
  );
  const glow = def(ctx, `glow-${key}`, (id) =>
    radialGradient(id, [
      { offset: 0, color: v.burst, opacity: 0.95 },
      { offset: 0.55, color: v.burst, opacity: 0.35 },
      { offset: 1, color: v.burst, opacity: 0 },
    ]),
  );
  const clip = def(
    ctx,
    'pack-clip',
    (id) => `<clipPath id="${id}"><path d="${PACK_OUTLINE}"/></clipPath>`,
  );
  const crimpFill = def(ctx, 'crimp', (id) =>
    linearGradient(id, [
      { offset: 0, color: WHITE, opacity: 0.55 },
      { offset: 1, color: WHITE, opacity: 0.12 },
    ]),
  );
  const ridges = def(
    ctx,
    'ridges',
    (id) =>
      `<pattern id="${id}" width="2.6" height="10" patternUnits="userSpaceOnUse"><rect width="1.1" height="10" fill="${INK}" fill-opacity="0.2"/></pattern>`,
  );
  const mascotScale = ctx.icon || mini ? 0.8 : 0.72;
  const mascotCx = 50;
  const mascotCy = ctx.icon || mini ? 96 : 97;

  let out = `<g clip-path="${clip}">`;
  out += `<rect width="${PACK_W}" height="${PACK_H}" fill="${body}"/>`;
  out += `<path d="${sunburst(mascotCx, mascotCy, 120, 20, -Math.PI / 2)}" fill="${v.burst}" opacity="0.28"/>`;
  out += `<circle cx="${mascotCx}" cy="${mascotCy}" r="44" fill="${glow}"/>`;
  out += `<g transform="translate(${n(mascotCx - 50 * mascotScale)} ${n(mascotCy - 52 * mascotScale)}) scale(${n(mascotScale)})">${mascotSvg(
    v.mascot,
    { halo: v.burst, haloWidth: 6 },
  )}</g>`;
  // Diagonal foil sheen bands, one of them iridescent.
  out += `<path d="M-10 70 60 0H82L-10 92Z" fill="${WHITE}" opacity="0.16"/><path d="M40 160 110 90V104L54 160Z" fill="${WHITE}" opacity="0.12"/>`;
  out += `<path d="M-10 118 110 20V34L-10 132Z" fill="${foilGradient(ctx)}" opacity="0.22"/>`;
  out += `<rect width="${PACK_W}" height="${PACK_H}" fill="${edgeShade(ctx)}"/>`;
  // Crimped seals.
  for (const y of [0, PACK_H - CRIMP]) {
    out += `<rect y="${y}" width="${PACK_W}" height="${CRIMP}" fill="${crimpFill}"/><rect y="${y}" width="${PACK_W}" height="${CRIMP}" fill="${ridges}"/>`;
  }
  out += `<path d="M0 ${CRIMP}H${PACK_W}M0 ${PACK_H - CRIMP}H${PACK_W}" stroke="${INK}" stroke-opacity="0.35" stroke-width="1"/>`;
  out += '</g>';
  // Glimmer rail: the thin iridescent inner line (docs/04 §5.2 trade dress).
  out += `<path d="M5 ${CRIMP + 2}V${PACK_H - CRIMP - 2}M95 ${CRIMP + 2}V${PACK_H - CRIMP - 2}" stroke="${foilGradient(ctx)}" stroke-width="1.6" opacity="0.85"/>`;
  if (!mini) {
    out += wordmark(ctx, 50, 23.5, 8.2, 70);
    out += setBand(ctx, 6, ctx.icon ? 16 : 28, 88, ctx.icon ? 22 : 18);
    if (!ctx.icon && ctx.cardsPerPack > 0) out += countBadge(50, 139, ctx.cardsPerPack, 'card', 11);
  } else {
    out += setBand(ctx, 8, 18, 84, 22, false);
  }
  out += `<path d="${PACK_OUTLINE}" fill="none" stroke="${INK}" stroke-width="${mini ? 3.4 : 2.6}" stroke-linejoin="round"/>`;
  return out;
}

// ---------------------------------------------------------------------------------------------
// 3-pack blister (120 × 160)
// ---------------------------------------------------------------------------------------------

function blister(ctx: Ctx, variant: number, packs: number): string {
  const v = wrapperVariant(ctx.style, variant);
  const card = def(ctx, 'blister-card', (id) =>
    linearGradient(id, [
      { offset: 0, color: v.top },
      { offset: 0.55, color: v.mid },
      { offset: 1, color: v.bottom },
    ]),
  );
  const cardPath = `${roundRect(4, 2, 112, 156, 10)}${roundRect(47, 8, 26, 7.5, 3.75)}`;
  const clip = def(
    ctx,
    'blister-clip',
    (id) => `<clipPath id="${id}"><path d="${roundRect(4, 2, 112, 156, 10)}"/></clipPath>`,
  );
  const bubbleGloss = def(ctx, 'bubble-gloss', (id) =>
    linearGradient(
      id,
      [
        { offset: 0, color: WHITE, opacity: 0.5 },
        { offset: 0.45, color: WHITE, opacity: 0.08 },
        { offset: 1, color: WHITE, opacity: 0.22 },
      ],
      [0, 0],
      [1, 1],
    ),
  );

  let out = `<g clip-path="${clip}"><rect x="4" y="2" width="112" height="156" fill="${card}"/>`;
  out += `<path d="${sunburst(60, 96, 130, 22, -Math.PI / 2)}" fill="${v.burst}" opacity="0.3"/>`;
  out += `<rect x="4" y="2" width="112" height="156" fill="${edgeShade(ctx)}" opacity="0.7"/></g>`;
  out += `<path d="${cardPath}" fill="none" stroke="${INK}" stroke-width="2.4" fill-rule="evenodd"/>`;
  // Hang hole (drawn over the card as a dark slot).
  out += `<path d="${roundRect(47, 8, 26, 7.5, 3.75)}" fill="${INK}" fill-opacity="0.55" stroke="${INK}" stroke-width="1.6"/>`;
  out += setBand(ctx, 10, 20, 100, ctx.icon ? 22 : 17);
  // Bubble with three fanned packs.
  out += `<path d="${roundRect(13, 42, 94, 106, 16)}" fill="${WHITE}" fill-opacity="0.2" stroke="${INK}" stroke-width="1.8"/>`;
  const shown = Math.max(1, Math.min(3, packs));
  const slots =
    shown === 3
      ? [
          { x: 37, y: 96, r: -12, v: variant + 1 },
          { x: 83, y: 96, r: 12, v: variant + 2 },
          { x: 60, y: 94, r: 0, v: variant },
        ]
      : [{ x: 60, y: 94, r: 0, v: variant }];
  for (const slot of slots) {
    const s = 0.42;
    out += `<g transform="translate(${n(slot.x)} ${n(slot.y)}) rotate(${slot.r}) translate(${n(-50 * s)} ${n(
      -80 * s,
    )}) scale(${s})">${packWrapper(ctx, slot.v, true)}</g>`;
  }
  out += `<path d="${roundRect(13, 42, 94, 106, 16)}" fill="${bubbleGloss}"/>`;
  out += `<path d="M22 60C22 52 26 48 34 48" fill="none" stroke="${WHITE}" stroke-width="3.2" stroke-linecap="round" opacity="0.85"/>`;
  out += `<path d="M18 128 86 46H98L26 138Z" fill="${WHITE}" opacity="0.14"/>`;
  out += `<path d="${roundRect(15.5, 44.5, 89, 101, 14)}" fill="none" stroke="${WHITE}" stroke-width="1.6" opacity="0.7"/>`;
  if (!ctx.icon) out += countBadge(92, 148, packs, 'pack', 12);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Starter deck box (110 × 150)
// ---------------------------------------------------------------------------------------------

function deckName(product: ProductArtProduct): string {
  const [, subtitle] = product.name.split(/:\s*/);
  return subtitle?.trim() ?? '';
}

function deck(ctx: Ctx, product: ProductArtProduct, theme: DeckTheme): string {
  const front = def(ctx, 'deck-front', (id) =>
    linearGradient(id, [
      { offset: 0, color: theme.tint },
      { offset: 0.35, color: theme.color },
      { offset: 1, color: theme.shade },
    ]),
  );
  const glow = def(ctx, 'deck-glow', (id) =>
    radialGradient(id, [
      { offset: 0, color: WHITE, opacity: 0.95 },
      { offset: 0.6, color: theme.tint, opacity: 0.6 },
      { offset: 1, color: theme.tint, opacity: 0 },
    ]),
  );
  const frontClip = def(
    ctx,
    'deck-clip',
    (id) => `<clipPath id="${id}"><path d="${roundRect(6, 24, 80, 122, 4)}"/></clipPath>`,
  );
  let out = '';
  // Side and top faces.
  out += `<path d="${poly([
    [86, 24],
    [102, 11],
    [102, 133],
    [86, 146],
  ])}" fill="${theme.shade}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  out += `<path d="M90 30V138M95 26V134" stroke="${WHITE}" stroke-opacity="0.18" stroke-width="2"/>`;
  out += `<path d="${poly([
    [6, 24],
    [22, 11],
    [102, 11],
    [86, 24],
  ])}" fill="${theme.tint}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  out += `<path d="M38 24Q46 17 54 24" fill="${theme.shade}" fill-opacity="0.35" stroke="${INK}" stroke-width="1.4"/>`;
  // Front face.
  out += `<g clip-path="${frontClip}"><rect x="6" y="24" width="80" height="122" fill="${front}"/>`;
  out += `<path d="${sunburst(46, 88, 90, 18, -Math.PI / 2)}" fill="${WHITE}" opacity="0.14"/>`;
  out += `<circle cx="46" cy="88" r="34" fill="${glow}"/>`;
  out += `<g transform="translate(${n(46 - 50 * 0.62)} ${n(88 - 54 * 0.62)}) scale(0.62)">${mascotSvg(
    theme.mascot,
    {
      halo: WHITE,
      haloWidth: 6,
    },
  )}</g>`;
  out += `<rect x="6" y="24" width="80" height="122" fill="${edgeShade(ctx, 'deck-edge')}" opacity="0.8"/></g>`;
  out += `<path d="${roundRect(10, 28, 72, 114, 3)}" fill="none" stroke="${WHITE}" stroke-opacity="0.55" stroke-width="1.2"/>`;
  out += setBand(ctx, 10, ctx.icon ? 30 : 32, 72, ctx.icon ? 20 : 15);
  const name = deckName(product);
  if (!ctx.icon && name) {
    out += `<path d="${roundRect(12, 120, 68, 16, 5)}" fill="${INK}" stroke="${WHITE}" stroke-width="1.2"/>`;
    out += textTag(name.toUpperCase(), {
      x: 46,
      y: 131.8,
      size: 9.5,
      fill: WHITE,
      maxWidth: 60,
      letterSpacing: 0.3,
    });
  }
  const cards = fixedCardsInside(product);
  if (!ctx.icon && cards > 0) out += countBadge(70, 54, cards, 'card', 11);
  out += `<path d="${roundRect(6, 24, 80, 122, 4)}" fill="none" stroke="${INK}" stroke-width="2.4"/>`;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Booster box / display (160 × 120), also the fallback for other boxed products
// ---------------------------------------------------------------------------------------------

function box(ctx: Ctx, product: ProductArtProduct, variant: number): string {
  const hero = ctx.style.variants.find((entry) => entry.mascot === ctx.style.hero);
  const v = hero ?? wrapperVariant(ctx.style, variant);
  const front = def(ctx, 'box-front', (id) =>
    linearGradient(
      id,
      [
        { offset: 0, color: v.top },
        { offset: 0.5, color: v.mid },
        { offset: 1, color: v.bottom },
      ],
      [0, 0],
      [0.35, 1],
    ),
  );
  const lid = def(ctx, 'box-lid', (id) =>
    linearGradient(
      id,
      [
        { offset: 0, color: v.mid },
        { offset: 1, color: v.top },
      ],
      [0, 1],
      [0, 0],
    ),
  );
  const glow = def(ctx, 'box-glow', (id) =>
    radialGradient(id, [
      { offset: 0, color: v.burst, opacity: 0.95 },
      { offset: 0.6, color: v.burst, opacity: 0.3 },
      { offset: 1, color: v.burst, opacity: 0 },
    ]),
  );
  const frontClip = def(
    ctx,
    'box-clip',
    (id) => `<clipPath id="${id}"><rect x="8" y="46" width="116" height="68"/></clipPath>`,
  );
  const packs = packsInside(product);
  let out = '';
  // Right side.
  out += `<path d="${poly([
    [124, 46],
    [152, 24],
    [152, 92],
    [124, 114],
  ])}" fill="${v.bottom}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  out += `<path d="${poly([
    [124, 46],
    [152, 24],
    [152, 30],
    [124, 52],
  ])}" fill="${INK}" opacity="0.25"/>`;
  if (!ctx.icon) {
    out += `<g transform="matrix(1 ${n(-22 / 28)} 0 1 124 46)">${textTag(ctx.style.code, {
      x: 14,
      y: 42,
      size: 12,
      fill: WHITE,
      stroke: INK,
      strokeWidth: 2.4,
      maxWidth: 22,
    })}</g>`;
  }
  // Lid (top face), with a foil sheen and the wordmark printed in perspective.
  out += `<path d="${poly([
    [8, 46],
    [32, 24],
    [152, 24],
    [124, 46],
  ])}" fill="${lid}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  out += `<path d="${poly([
    [58, 46],
    [82, 24],
    [98, 24],
    [74, 46],
  ])}" fill="${WHITE}" opacity="0.25"/>`;
  if (!ctx.icon && ctx.brand) {
    out += `<g transform="matrix(1 0 ${n(-24 / 22)} 1 32 24)">${textTag(ctx.brand.toUpperCase(), {
      x: 62,
      y: 15.5,
      size: 10,
      fill: WHITE,
      stroke: INK,
      strokeWidth: 2.6,
      maxWidth: 80,
      letterSpacing: 0.6,
    })}</g>`;
  }
  // Front face: hero creature on a sunrise, the set band and the pack count.
  out += `<g clip-path="${frontClip}"><rect x="8" y="46" width="116" height="68" fill="${front}"/>`;
  out += `<path d="${sunburst(40, 104, 110, 22, -Math.PI / 2)}" fill="${v.burst}" opacity="0.3"/>`;
  out += `<circle cx="40" cy="92" r="36" fill="${glow}"/>`;
  const s = ctx.icon ? 0.72 : 0.64;
  out += `<g transform="translate(${n(40 - 50 * s)} ${n(90 - 52 * s)}) scale(${n(s)})">${mascotSvg(
    v.mascot,
    {
      halo: v.burst,
      haloWidth: 6,
    },
  )}</g>`;
  out += `<path d="M84 114 124 60V74L100 114Z" fill="${WHITE}" opacity="0.14"/>`;
  out += `<rect x="8" y="46" width="116" height="68" fill="${edgeShade(ctx, 'box-edge')}" opacity="0.6"/>`;
  out += `<rect x="8" y="46" width="116" height="6" fill="${INK}" opacity="0.28"/></g>`;
  out += setBand(ctx, 66, ctx.icon ? 60 : 62, 56, ctx.icon ? 22 : 16);
  if (!ctx.icon && packs > 0) out += countBadge(96, 99, packs, 'pack', 13);
  if (product.kind === 'mysteryBox') {
    out += textTag('?', { x: 96, y: 104, size: 28, fill: WHITE, stroke: INK, strokeWidth: 3 });
  }
  out += `<rect x="8" y="46" width="116" height="68" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;
  out += `<path d="M8 52H124" stroke="${INK}" stroke-width="1.4" opacity="0.6"/>`;
  return out;
}

// ---------------------------------------------------------------------------------------------

/**
 * Composes the SVG for a sealed product. The root has a `viewBox` of `ART_BOX[shape]` and
 * `width`/`height` of 100%, so it scales to whatever box the caller gives it.
 */
export function productArtSvg(
  product: ProductArtProduct,
  set: ProductArtSet | undefined,
  options: ProductArtOptions = {},
): string {
  const shape = artShape(product.kind);
  const variant = options.variant ?? 0;
  const prefix =
    options.idPrefix ?? `pa${hashString(`${product.id}|${set?.id ?? ''}|${variant}|${shape}`)}`;
  const ctx: Ctx = {
    ids: idFactory(prefix),
    style: setArtStyle(set),
    brand: options.brandName ?? '',
    cardsPerPack: options.cardsPerPack ?? 0,
    icon: options.detail === 'icon',
    defs: new Map(),
  };

  let body: string;
  switch (shape) {
    case 'pack':
      body = packWrapper(ctx, variant, false);
      break;
    case 'blister':
      body = blister(ctx, variant, packsInside(product) || 3);
      break;
    case 'deck':
      body = deck(ctx, product, deckTheme(product));
      break;
    case 'box':
      body = box(ctx, product, variant);
      break;
  }
  const { width, height } = ART_BOX[shape];
  const title = options.title ? `<title>${esc(options.title)}</title>` : '';
  const defs = ctx.defs.size > 0 ? `<defs>${[...ctx.defs.values()].join('')}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" data-shape="${shape}">${title}${defs}${body}</svg>`;
}
