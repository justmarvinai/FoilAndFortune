import type { Rarity } from '@/content/schema/common';
import { foilStops, palette, rarityColors } from '@/ui/palette';
import { shakeKeyframes } from './fxMath';
import { stageMotionNow } from './useStageMotion';

/**
 * The stage's effects director (docs/04 §9): one pooled canvas for particles (foil shards, sparks,
 * star rain, god-pack motes), plus screen shake and flash on the stage's own elements. Everything
 * runs on requestAnimationFrame and the Web Animations API, never through React state, and the
 * loop sleeps when nothing is alive. Reduced motion turns particles, shake and flash off.
 */

const POOL = 900;

const Kind = { Shard: 0, Spark: 1, Star: 2, Mote: 3 } as const;
type Kind = (typeof Kind)[keyof typeof Kind];

interface Particle {
  alive: boolean;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  ttl: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
}

const SHARD_COLORS = [...foilStops, palette.paper, palette.sun];
const STAR_COLORS = [palette.sun, palette.paper, ...foilStops];

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: readonly T[], fallback: T): T =>
  items[Math.floor(Math.random() * items.length)] ?? fallback;

export function rarityGlow(rarity: Rarity): string {
  return rarity === 'promo' ? palette.sun : rarityColors[rarity];
}

export interface Director {
  /** Wires the stage's canvas, camera (shake) and flash layer; returns the detach function. */
  attach(parts: { canvas: HTMLCanvasElement; camera: HTMLElement; flash: HTMLElement }): () => void;
  /** An element's center in stage (canvas) coordinates. */
  centerOf(element: Element): { x: number; y: number };
  shards(x: number, y: number, count: number, spreadX?: number): void;
  sparks(x: number, y: number, color: string, count: number, speed?: number): void;
  starRain(ms: number): void;
  motes(x: number, y: number, width: number, color: string, count: number): void;
  shake(intensity: number): void;
  flash(strength?: number): void;
  /** Registers an animation a tap may fast-forward (common flips). */
  track(animation: Animation): void;
  /** Finishes tracked animations; true when one was still running. */
  hurry(): boolean;
}

export function createDirector(): Director {
  const pool: Particle[] = Array.from({ length: POOL }, () => ({
    alive: false,
    kind: Kind.Spark,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    gravity: 0,
    drag: 0,
    life: 0,
    ttl: 1,
    size: 1,
    rot: 0,
    vr: 0,
    color: palette.paper,
  }));
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let camera: HTMLElement | null = null;
  let flashLayer: HTMLElement | null = null;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let cursor = 0;
  let frame = 0;
  let last = 0;
  let rainUntil = 0;
  let rainCarry = 0;
  const tracked = new Set<Animation>();

  const off = () => stageMotionNow().reduced || !g;

  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
  }

  function spawn(): Particle | null {
    for (let i = 0; i < POOL; i++) {
      const particle = pool[(cursor + i) % POOL];
      if (particle && !particle.alive) {
        cursor = (cursor + i + 1) % POOL;
        particle.alive = true;
        particle.life = 0;
        return particle;
      }
    }
    return null;
  }

  function wake() {
    if (frame || !g) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function spawnStar() {
    const p = spawn();
    if (!p) return;
    p.kind = Kind.Star;
    p.x = rand(0, width);
    p.y = rand(-40, -8);
    p.vx = rand(-30, 30);
    p.vy = rand(160, 320);
    p.gravity = 40;
    p.drag = 0.2;
    p.ttl = rand(1.6, 2.6);
    p.size = rand(5, 11);
    p.rot = rand(0, Math.PI);
    p.vr = rand(-3, 3);
    p.color = pick(STAR_COLORS, palette.sun);
  }

  function draw(p: Particle) {
    if (!g) return;
    const t = p.life / p.ttl;
    const fade = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
    if (p.kind === Kind.Shard) {
      // Foil flutter: the shard's apparent width and brightness follow its spin.
      const cos = Math.cos(p.rot);
      const sin = Math.sin(p.rot);
      const flutter = Math.cos(p.rot * 1.7);
      g.setTransform(
        dpr * cos,
        dpr * sin,
        -dpr * sin * flutter,
        dpr * cos * flutter,
        dpr * p.x,
        dpr * p.y,
      );
      g.globalAlpha = fade * (0.5 + 0.5 * Math.abs(Math.sin(p.rot * 2)));
      g.fillStyle = p.color;
      const s = p.size;
      g.beginPath();
      g.moveTo(-s, -s * 0.4);
      g.lineTo(s * 0.8, -s * 0.6);
      g.lineTo(s * 0.5, s * 0.7);
      g.lineTo(-s * 0.7, s * 0.45);
      g.closePath();
      g.fill();
      return;
    }
    g.setTransform(dpr, 0, 0, dpr, dpr * p.x, dpr * p.y);
    g.fillStyle = p.color;
    if (p.kind === Kind.Star) {
      g.globalAlpha = fade * (0.65 + 0.35 * Math.sin(p.life * 18 + p.size));
      const r = p.size;
      const i = r * 0.3;
      g.rotate(p.rot);
      g.beginPath();
      g.moveTo(0, -r);
      g.lineTo(i, -i);
      g.lineTo(r, 0);
      g.lineTo(i, i);
      g.lineTo(0, r);
      g.lineTo(-i, i);
      g.lineTo(-r, 0);
      g.lineTo(-i, -i);
      g.closePath();
      g.fill();
      return;
    }
    const radius =
      p.kind === Kind.Mote ? p.size * (0.6 + 0.4 * Math.sin(p.life * 6)) : p.size * (1 - t * 0.7);
    g.globalAlpha = p.kind === Kind.Mote ? fade * 0.8 * Math.min(1, t * 4) : fade;
    g.beginPath();
    g.arc(0, 0, Math.max(0.3, radius), 0, Math.PI * 2);
    g.fill();
  }

  function tick(now: number) {
    frame = 0;
    if (!g) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (now < rainUntil) {
      rainCarry += dt * 70;
      while (rainCarry >= 1) {
        rainCarry -= 1;
        spawnStar();
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, width * dpr, height * dpr);
    let alive = 0;
    // Pass 1: shards (normal blending). Pass 2: light (additive).
    for (const blend of ['source-over', 'lighter'] as const) {
      g.globalCompositeOperation = blend;
      for (const p of pool) {
        if (!p.alive || (blend === 'source-over') !== (p.kind === Kind.Shard)) continue;
        p.life += dt;
        if (p.life >= p.ttl) {
          p.alive = false;
          continue;
        }
        alive += 1;
        const damp = Math.max(0, 1 - p.drag * dt);
        p.vx *= damp;
        p.vy = p.vy * damp + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        draw(p);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (alive > 0 || now < rainUntil) frame = requestAnimationFrame(tick);
    else {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, width * dpr, height * dpr);
    }
  }

  return {
    attach(parts) {
      canvas = parts.canvas;
      g = canvas.getContext('2d');
      camera = parts.camera;
      flashLayer = parts.flash;
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        frame = 0;
        for (const p of pool) p.alive = false;
        for (const animation of tracked) animation.cancel();
        tracked.clear();
        g = null;
        canvas = null;
        camera = null;
        flashLayer = null;
      };
    },

    centerOf(element) {
      const rect = element.getBoundingClientRect();
      const origin = canvas?.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - (origin?.left ?? 0),
        y: rect.top + rect.height / 2 - (origin?.top ?? 0),
      };
    },

    shards(x, y, count, spreadX = 0) {
      if (off()) return;
      for (let i = 0; i < count; i++) {
        const p = spawn();
        if (!p) break;
        p.kind = Kind.Shard;
        p.x = x + rand(-spreadX / 2, spreadX / 2);
        p.y = y + rand(-4, 4);
        p.vx = rand(-260, 260);
        p.vy = rand(-420, -80);
        p.gravity = 900;
        p.drag = 1.2;
        p.ttl = rand(0.7, 1.3);
        p.size = rand(3, 7);
        p.rot = rand(0, Math.PI * 2);
        p.vr = rand(-14, 14);
        p.color = pick(SHARD_COLORS, palette.paper);
      }
      wake();
    },

    sparks(x, y, color, count, speed = 1) {
      if (off()) return;
      for (let i = 0; i < count; i++) {
        const p = spawn();
        if (!p) break;
        const angle = rand(0, Math.PI * 2);
        const v = rand(180, 620) * speed;
        p.kind = Kind.Spark;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * v;
        p.vy = Math.sin(angle) * v;
        p.gravity = 260;
        p.drag = 2.4;
        p.ttl = rand(0.5, 1.1);
        p.size = rand(1.6, 4.2);
        p.color = i % 3 === 0 ? palette.paper : color;
      }
      wake();
    },

    starRain(ms) {
      if (off()) return;
      rainUntil = Math.max(rainUntil, performance.now() + ms);
      wake();
    },

    motes(x, y, w, color, count) {
      if (off()) return;
      for (let i = 0; i < count; i++) {
        const p = spawn();
        if (!p) break;
        p.kind = Kind.Mote;
        p.x = x + rand(-w / 2, w / 2);
        p.y = y + rand(-10, 10);
        p.vx = rand(-12, 12);
        p.vy = rand(-90, -40);
        p.gravity = 0;
        p.drag = 0.4;
        p.ttl = rand(1.2, 2.2);
        p.size = rand(1.5, 3.5);
        p.color = i % 4 === 0 ? palette.paper : color;
      }
      wake();
    },

    shake(intensity) {
      const motion = stageMotionNow();
      if (!camera || !motion.shake || intensity <= 0) return;
      camera.animate(shakeKeyframes(intensity), {
        duration: 260 + intensity * 260,
        easing: 'linear',
      });
    },

    flash(strength = 0.65) {
      if (!flashLayer || stageMotionNow().reduced) return;
      flashLayer.animate([{ opacity: 0 }, { opacity: strength, offset: 0.18 }, { opacity: 0 }], {
        duration: 520,
        easing: 'ease-out',
      });
    },

    track(animation) {
      tracked.add(animation);
      const forget = () => tracked.delete(animation);
      animation.finished.then(forget, forget);
    },

    hurry() {
      let hurried = false;
      for (const animation of tracked) {
        if (animation.playState === 'running' || animation.playState === 'paused') {
          animation.finish();
          hurried = true;
        }
      }
      return hurried;
    },
  };
}
