import type { BiomeId, CreatureArtRequest } from '@/art/types';
import type { Box } from './core/path';
import { hashString } from './core/rng';
import { el, group, Ids, url } from './core/svg';
import { buildCreature, type CreatureArt } from './creature';
import type { DrawCtx } from './draw';
import { drawFx } from './fx';
import { drawScene, type RimLight, rimLight, type SceneFrame } from './scenes';
import { stickerStyle } from './style';

export interface StickerOptions {
  /** Prefix for SVG ids. Must be unique among SVGs inlined in one HTML document. */
  idPrefix?: string;
  /** White die-cut border around the creature (default true). */
  dieCut?: boolean;
}

const DEFAULT_BIOME: Record<string, BiomeId> = {
  volt: 'storm-meadow',
  ember: 'volcano-dawn',
  tide: 'lagoon',
};

/** Deterministic id prefix derived from the request (same request → same SVG). */
export function requestKey(req: CreatureArtRequest): string {
  const key = JSON.stringify([
    req.genome,
    req.element,
    req.width,
    req.height,
    req.composition,
    req.pose ?? 'idle',
    req.background ?? 'biome',
    req.biome ?? '',
    req.timeOfDay ?? 'day',
    req.seed ?? 0,
  ]);
  return `sp${hashString(key).toString(36)}`;
}

function ctxFor(ids: Ids, unit: number): DrawCtx {
  return {
    ids,
    lw: {
      outline: stickerStyle.outlinePx * unit,
      inner: stickerStyle.innerPx * unit,
      detail: stickerStyle.detailPx * unit,
    },
    ink: stickerStyle.ink,
    shadowTint: stickerStyle.shadowTint,
    glossAlpha: stickerStyle.glossAlpha,
    light: stickerStyle.light,
  };
}

interface Placement {
  scale: number;
  tx: number;
  ty: number;
  groundY: number;
}

/** Fit the creature: ~65% of the height in the window, ~45% in full art (docs/04 §6.2). */
function place(
  req: CreatureArtRequest,
  bounds: Box,
  ground: number,
  size: number,
  px: number,
): Placement {
  const W = req.width;
  const H = req.height;
  const full = req.composition === 'fullArt';
  const margin = (stickerStyle.dieCutPx + stickerStyle.outlinePx) * px;
  const bw = bounds.x1 - bounds.x0;
  const bh = bounds.y1 - bounds.y0;
  // Bigger species (genome.size) take a little more of the frame.
  const sizeK = 0.9 + 0.12 * size;
  const targetH = (full ? 0.46 : 0.66) * H * sizeK;
  const maxW = (full ? 0.86 : 0.8) * W;
  const scale = Math.min((targetH - 2 * margin) / bh, (maxW - 2 * margin) / bw);
  const groundY = full ? H * 0.86 : H * 0.91;
  const cx = W * (full ? 0.5 : 0.5);
  return {
    scale,
    tx: cx - scale * (bounds.x0 + bounds.x1) * 0.5,
    ty: groundY - scale * ground,
    groundY,
  };
}

function creatureLayers(
  art: CreatureArt,
  ids: Ids,
  p: Placement,
  px: number,
  dieCut: boolean,
  transparent: boolean,
  rim: RimLight | null,
): string {
  const s = p.scale;
  const silId = ids.next('sil');
  const outline = (stickerStyle.outlinePx * px) / s;
  const border = outline + (dieCut ? (stickerStyle.dieCutPx * px) / s : 0);
  const silPaths = art.silhouette.map((path) => el('path', { d: path.toString() }));
  const blurId = ids.next('blur');
  const shadowOffset = ((transparent ? 5 : 3.5) * px) / s;
  const layers = [el('defs', {}, el('g', { id: silId }, ...silPaths))];
  if (transparent) {
    // Soft drop shadow: a loose sticker lifted a hair off the page.
    layers.push(
      el(
        'filter',
        { id: blurId, x: '-20%', y: '-20%', width: '140%', height: '140%' },
        el('feGaussianBlur', { stdDeviation: (4 * px) / s }),
      ),
      el('use', {
        href: `#${silId}`,
        fill: stickerStyle.ink,
        stroke: stickerStyle.ink,
        'stroke-width': border * 2,
        'stroke-linejoin': 'round',
        opacity: 0.34,
        transform: `translate(0 ${shadowOffset.toFixed(2)})`,
        filter: url(blurId),
      }),
    );
  } else {
    // In a scene: a crisp offset shadow, the same hard "chunky" shadow the UI panels use
    // (docs/04 §8), and much cheaper to rasterize than a blur.
    layers.push(
      el('use', {
        href: `#${silId}`,
        fill: stickerStyle.ink,
        stroke: stickerStyle.ink,
        'stroke-width': border * 2,
        'stroke-linejoin': 'round',
        opacity: 0.3,
        transform: `translate(${(shadowOffset * 0.35).toFixed(2)} ${shadowOffset.toFixed(2)})`,
      }),
    );
  }
  if (dieCut) {
    layers.push(
      // Faint cut line so the white border reads on pale backgrounds too.
      el('use', {
        href: `#${silId}`,
        fill: 'none',
        stroke: stickerStyle.ink,
        'stroke-opacity': 0.22,
        'stroke-width': border * 2 + (2 * px) / s,
        'stroke-linejoin': 'round',
      }),
      el('use', {
        href: `#${silId}`,
        fill: stickerStyle.paper,
        stroke: stickerStyle.paper,
        'stroke-width': border * 2,
        'stroke-linejoin': 'round',
      }),
    );
  }
  const ink = {
    href: `#${silId}`,
    fill: stickerStyle.ink,
    stroke: stickerStyle.ink,
    'stroke-width': outline * 2,
    'stroke-linejoin': 'round',
  };
  layers.push(
    el('use', ink),
    // Weighted line: a second, offset pass thickens the outline on the shadow side
    // (bottom-right), the way an inker leans on the brush away from the light.
    el('use', {
      ...ink,
      transform: `translate(${(-stickerStyle.light[0] * outline * 0.55).toFixed(2)} ${(-stickerStyle.light[1] * outline * 0.55).toFixed(2)})`,
    }),
    art.svg,
  );
  if (rim) {
    // Reflected light from the scene along the shadow-side silhouette: the union minus a copy
    // shifted toward the key light leaves a thin crescent on the lower-right edges.
    const maskId = ids.next('rim');
    const r = (stickerStyle.rimPx * px) / s;
    const b = art.bounds;
    const box = {
      x: b.x0 - r,
      y: b.y0 - r,
      width: b.x1 - b.x0 + 2 * r,
      height: b.y1 - b.y0 + 2 * r,
    };
    layers.push(
      el(
        'mask',
        { id: maskId, maskUnits: 'userSpaceOnUse', ...box },
        el('use', { href: `#${silId}`, fill: '#FFFFFF' }),
        el('use', {
          href: `#${silId}`,
          fill: '#000000',
          transform: `translate(${(stickerStyle.light[0] * r).toFixed(2)} ${(stickerStyle.light[1] * r).toFixed(2)})`,
        }),
      ),
      el('rect', { ...box, fill: rim.color, opacity: rim.alpha, mask: url(maskId) }),
    );
  }
  return group(
    { transform: `translate(${p.tx.toFixed(2)} ${p.ty.toFixed(2)}) scale(${s.toFixed(5)})` },
    ...layers,
  );
}

/** Full art SVG for a request: scene, creature sticker and element FX. */
export function composeSticker(req: CreatureArtRequest, opts: StickerOptions = {}): string {
  const W = Math.max(16, Math.round(req.width));
  const H = Math.max(16, Math.round(req.height));
  const request = { ...req, width: W, height: H };
  const ref = stickerStyle.reference[req.composition];
  // Output px per reference px: line weights scale with the image.
  const px = Math.sqrt((W * H) / (ref[0] * ref[1]));
  const seed = req.seed ?? 0;
  const pose = req.pose ?? 'idle';
  const transparent = req.background === 'transparent';
  const dieCut = opts.dieCut ?? true;
  const ids = new Ids(opts.idPrefix ?? requestKey(request));
  // Measure once (geometry doesn't depend on line weights), then draw with weights in local
  // units so every species gets identical pixel line widths.
  const probe = buildCreature(req.genome, ctxFor(new Ids('probe'), 1), seed, pose);
  const placement = place(request, probe.bounds, probe.ground, probe.size, px);
  const art = buildCreature(req.genome, ctxFor(ids, px / placement.scale), seed, pose);
  const frame: SceneFrame = {
    width: W,
    height: H,
    px,
    composition: req.composition,
    biome: req.biome ?? DEFAULT_BIOME[req.element] ?? 'storm-meadow',
    timeOfDay: req.timeOfDay ?? 'day',
    seed,
    groundY: placement.groundY,
    creature: {
      x0: placement.tx + art.bounds.x0 * placement.scale,
      x1: placement.tx + art.bounds.x1 * placement.scale,
      y0: placement.ty + art.bounds.y0 * placement.scale,
      y1: placement.ty + art.bounds.y1 * placement.scale,
    },
  };
  const toScreen = (p: readonly [number, number]): [number, number] => [
    placement.tx + p[0] * placement.scale,
    placement.ty + p[1] * placement.scale,
  ];
  const fx = drawFx(ids, req.genome, frame, {
    head: { c: toScreen(art.head.c), r: art.head.r * placement.scale },
    tail: art.tail ? toScreen(art.tail.tip) : null,
  });
  const body = [
    transparent ? '' : drawScene(ids, frame),
    fx.back,
    creatureLayers(
      art,
      ids,
      placement,
      px,
      dieCut,
      transparent,
      transparent ? null : rimLight(frame),
    ),
    fx.front,
  ];
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: W,
      height: H,
      viewBox: `0 0 ${W} ${H}`,
      role: 'img',
    },
    ...body,
  );
}
