import type { ReactNode } from 'react';

export interface StickerProps {
  children: ReactNode;
  color?: string;
  rotate?: number;
  className?: string;
}

/** Die-cut sticker label ("NEW!", "HOT", "1st ED"). */
export function Sticker({
  children,
  color = 'var(--color-coral)',
  rotate = -6,
  className = '',
}: StickerProps) {
  return (
    <span
      className={`inline-block rounded-lg border-[3px] border-ink px-2 py-0.5 font-display text-sm tracking-wider text-white shadow-[0_3px_0_var(--color-ink),0_0_0_3px_white] ${className}`}
      style={{ background: color, transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}
