import type { CreatureGenome } from '@/content/schema/genome';
import { mix } from './core/color';
import { type Knot, Path, type Pt } from './core/path';
import { createRng, type Rng } from './core/rng';
import { bolt, sparkle, taper } from './core/shapes';
import { el, type Ids, url } from './core/svg';
import type { SceneFrame } from './scenes';

/**
 * Element FX around the creature (genome.elementFx, docs/04 §6.2/§9): seeded particles in two
 * layers, behind the sticker and a few in front, kept clear of the face.
 */

export interface FxAnchors {
  head: { c: Pt; r: number };
  tail: Pt | null;
}

interface Particle {
  p: Pt;
  /** 0…1 size class. */
  s: number;
  front: boolean;
}

function scatter(rng: Rng, frame: SceneFrame, anchors: FxAnchors, count: number): Particle[] {
  const { width: W, height: H, creature: c } = frame;
  const x0 = Math.max(W * 0.03, c.x0 - W * 0.1);
  const x1 = Math.min(W * 0.97, c.x1 + W * 0.1);
  const y0 = Math.max(H * 0.04, c.y0 - H * 0.08);
  const y1 = frame.groundY - H * 0.04;
  const minDist = Math.sqrt(((x1 - x0) * (y1 - y0)) / count) * 0.55;
  const out: Particle[] = [];
  for (let tries = 0; tries < count * 12 && out.length < count; tries++) {
    const p: Pt = [rng.range(x0, x1), rng.range(y0, y1)];
    const dFace = Math.hypot(p[0] - anchors.head.c[0], p[1] - anchors.head.c[1]);
    if (dFace < anchors.head.r * 0.95) continue;
    if (out.some((o) => Math.hypot(o.p[0] - p[0], o.p[1] - p[1]) < minDist)) continue;
    // Particles over the creature's body go behind it; those outside may sit in front.
    const inside = p[0] > c.x0 && p[0] < c.x1 && p[1] > c.y0;
    out.push({ p, s: rng.next(), front: !inside && rng.chance(0.4) });
  }
  return out;
}

function glowDot(ids: Ids, p: Pt, r: number, color: string, alpha: number): string {
  const id = ids.next('fxg');
  return (
    el(
      'radialGradient',
      { id },
      el('stop', { offset: 0, 'stop-color': color, 'stop-opacity': alpha }),
      el('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }),
    ) + el('circle', { cx: p[0], cy: p[1], r, fill: url(id) })
  );
}

export function drawFx(
  ids: Ids,
  genome: CreatureGenome,
  frame: SceneFrame,
  anchors: FxAnchors,
): { back: string; front: string } {
  const kind = genome.elementFx;
  if (kind === 'none') return { back: '', front: '' };
  const rng = createRng(frame.seed).fork(`fx-${kind}`);
  const full = frame.composition === 'fullArt';
  const px = frame.px;
  const night = frame.timeOfDay === 'night';
  const list = scatter(rng, frame, anchors, full ? 16 : 12);
  // Extra glints clustered around a glowing tail tip.
  if (anchors.tail && kind === 'sparks') {
    for (let i = 0; i < 3; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(26, 46) * px;
      list.push({
        p: [anchors.tail[0] + Math.cos(a) * d, anchors.tail[1] + Math.sin(a) * d],
        s: rng.range(0.1, 0.5),
        front: true,
      });
    }
  }
  const pal = genome.palette;
  const back: string[] = [];
  const front: string[] = [];
  for (const pt of list) {
    const out = pt.front ? front : back;
    const { p, s } = pt;
    switch (kind) {
      case 'sparks': {
        if (s < 0.28 && !pt.front) {
          // Tiny zigzag bolt.
          const len = (10 + 10 * s) * px;
          const a = rng.range(-0.6, 0.6);
          const pts: Pt[] = [
            [p[0] - Math.sin(a) * len * 0.5, p[1] - Math.cos(a) * len * 0.5],
            [p[0] + len * 0.18, p[1] - len * 0.05],
            [p[0] - len * 0.18, p[1] + len * 0.05],
            [p[0] + Math.sin(a) * len * 0.5, p[1] + Math.cos(a) * len * 0.5],
          ];
          out.push(
            el('path', {
              d: bolt(pts, [3 * px, 2.6 * px, 2.2 * px, 0]).toString(),
              fill: pal.glow,
            }),
          );
        } else {
          const r = (5 + 9 * s) * px * (pt.front ? 0.8 : 1);
          if (night || s > 0.6) out.push(glowDot(ids, p, r * 2.2, pal.glow, night ? 0.55 : 0.35));
          out.push(
            el('path', {
              d: sparkle(p, r, { inner: 0.26, rot: rng.range(-100, -80) }).toString(),
              fill: s > 0.5 ? '#FFFFFF' : pal.glow,
            }),
          );
          if (s > 0.5)
            out.push(
              el('path', {
                d: sparkle(p, r * 0.55, { inner: 0.3 }).toString(),
                fill: pal.glow,
                opacity: 0.8,
              }),
            );
        }
        break;
      }
      case 'embers': {
        const r = (1.6 + 3.2 * s) * px;
        out.push(glowDot(ids, p, r * 3.2, pal.glow, night ? 0.65 : 0.45));
        if (s > 0.55) {
          // A little rising flame lick.
          const h = r * 3.2;
          const lick = Path.smooth([
            [p[0], p[1] - h, 0],
            [p[0] + r * 0.9, p[1] - h * 0.1],
            [p[0], p[1] + r],
            [p[0] - r * 0.9, p[1] - h * 0.1],
          ]);
          out.push(el('path', { d: lick.toString(), fill: pal.primary }));
          out.push(
            el('path', {
              d: lick.scale(0.5, 0.5, [p[0], p[1] + r * 0.5]).toString(),
              fill: pal.glow,
            }),
          );
        } else {
          out.push(
            el('circle', {
              cx: p[0],
              cy: p[1],
              r,
              fill: s > 0.3 ? pal.glow : mix(pal.primary, pal.glow, 0.5),
            }),
          );
        }
        break;
      }
      case 'bubbles': {
        const r = (3.5 + 9 * s) * px;
        out.push(
          el('circle', {
            cx: p[0],
            cy: p[1],
            r,
            fill: pal.glow,
            'fill-opacity': 0.22,
            stroke: '#FFFFFF',
            'stroke-opacity': 0.9,
            'stroke-width': Math.max(1, 1.3 * px),
          }),
        );
        const hl: Knot[] = [
          [p[0] - r * 0.62, p[1] - r * 0.05],
          [p[0] - r * 0.45, p[1] - r * 0.48],
          [p[0] - r * 0.05, p[1] - r * 0.64],
        ];
        out.push(
          el('path', {
            d: taper(hl, Math.max(1.2, r * 0.22), { start: 0.3, end: 0.3 }).toString(),
            fill: '#FFFFFF',
            opacity: 0.9,
          }),
        );
        break;
      }
      case 'snow':
        out.push(
          el('path', {
            d: sparkle(p, (3 + 5 * s) * px, { points: 6, inner: 0.35 }).toString(),
            fill: '#FFFFFF',
            opacity: 0.9,
          }),
        );
        break;
      case 'petals':
        out.push(
          el('path', {
            d: Path.ellipse(
              p[0],
              p[1],
              (3 + 4 * s) * px,
              (1.8 + 2 * s) * px,
              rng.range(0, 180),
            ).toString(),
            fill: mix(pal.accent, '#FFFFFF', 0.3),
          }),
        );
        break;
      case 'dust':
        out.push(
          el('circle', {
            cx: p[0],
            cy: p[1],
            r: (1.5 + 3 * s) * px,
            fill: mix(pal.primary, '#FFFFFF', 0.4),
            opacity: 0.7,
          }),
        );
        break;
      case 'runes':
      case 'wisps':
        out.push(glowDot(ids, p, (6 + 8 * s) * px, pal.glow, 0.5));
        out.push(el('circle', { cx: p[0], cy: p[1], r: (1.4 + 2 * s) * px, fill: '#FFFFFF' }));
        break;
    }
  }
  return { back: back.join(''), front: front.join('') };
}
