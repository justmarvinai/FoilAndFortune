import { useEffect, useRef } from 'react';

export interface RollingNumberProps {
  value: number;
  format(value: number): string;
  /** Roll from this value on mount (default 0). */
  from?: number;
  durationMs?: number;
  /** Skip the roll (reduced motion). */
  instant?: boolean;
  className?: string;
}

/**
 * A number that rolls up to its value when it appears (docs/05 §5.17 "numbers rolling up"). It
 * writes to the DOM from requestAnimationFrame, so rolling never re-renders React.
 */
export function RollingNumber({
  value,
  format,
  from = 0,
  durationMs = 520,
  instant = false,
  className = '',
}: RollingNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (instant || durationMs <= 0 || from === value) {
      node.textContent = format(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      node.textContent = format(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, from, durationMs, instant, format]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(instant ? value : from)}
    </span>
  );
}
