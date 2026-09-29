import { useEffect, useRef, useState } from 'react';
import { type Cents, formatMoney } from '@/core/money';

export interface MoneyCounterProps {
  cents: Cents;
  compact?: boolean;
  className?: string;
}

/**
 * Cash display that rolls to its new value and flashes green/red (docs/05 §6: "cash counter
 * pulses and rolls up"). The animation writes straight to the DOM to avoid per-frame renders.
 */
export function MoneyCounter({ cents, compact = false, className = '' }: MoneyCounterProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef(cents);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const from = shownRef.current;
    const to = cents;
    if (from === to) return;
    setFlash(to > from ? 'up' : 'down');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : 650;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const value = Math.round(from + (to - from) * eased);
      shownRef.current = value;
      if (textRef.current) textRef.current.textContent = formatMoney(value, { compact });
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    const timer = window.setTimeout(() => setFlash(null), 700);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [cents, compact]);

  const flashClass = flash === 'up' ? 'text-mint scale-110' : flash === 'down' ? 'text-coral' : '';
  return (
    <span
      ref={textRef}
      className={`inline-block font-display tabular-nums transition-[transform,color] duration-200 ${flashClass} ${className}`}
    >
      {formatMoney(shownRef.current, { compact })}
    </span>
  );
}
