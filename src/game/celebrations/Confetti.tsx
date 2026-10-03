import { useEffect, useRef } from 'react';
import { foilStops, palette } from '@/ui/palette';

const COLORS = [
  palette.sun,
  palette.coral,
  palette.teal,
  palette.sky,
  palette.grape,
  palette.mint,
  ...foilStops,
];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  w: number;
  h: number;
  color: string;
}

/**
 * A one-shot confetti burst on a canvas (docs/05 §6). Cosmetic randomness only, so it uses
 * `Math.random` in the view, never in the sim (CLAUDE.md rule 1).
 */
export function Confetti({
  pieces = 140,
  durationMs = 3200,
}: {
  pieces?: number;
  durationMs?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const burst: Piece[] = Array.from({ length: pieces }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9;
      const speed = 9 + Math.random() * 10;
      return {
        x: fromLeft ? w * 0.18 : w * 0.82,
        y: h * 0.62,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: (Math.random() - 0.5) * 0.4,
        angle: Math.random() * Math.PI,
        w: 7 + Math.random() * 7,
        h: 4 + Math.random() * 5,
        color: COLORS[i % COLORS.length] ?? palette.sun,
      };
    });
    const start = performance.now();
    let last = start;
    let frame = 0;
    const step = (now: number) => {
      const dt = Math.min(2.5, (now - last) / 16.7);
      last = now;
      const fade = Math.max(
        0,
        1 - Math.max(0, now - start - durationMs * 0.6) / (durationMs * 0.4),
      );
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = fade;
      for (const p of burst) {
        p.vy += 0.32 * dt;
        p.vx *= 0.992;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.scale(1, Math.cos(p.angle * 2));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (now - start < durationMs) frame = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, w, h);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [pieces, durationMs]);
  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden="true">
      <canvas ref={ref} className="size-full" />
    </div>
  );
}
