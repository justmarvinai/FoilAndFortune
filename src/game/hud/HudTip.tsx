import { type ReactNode, useId } from 'react';

export interface HudTipProps {
  /** The "why" behind a number (docs/05 §1.5). */
  content: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

const alignClass = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
} as const;

const arrowClass = {
  start: 'left-6',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-6',
} as const;

/**
 * Speech-bubble tip that drops BELOW a top-bar element on hover (300 ms, docs/05 §4) or keyboard
 * focus. The kit's Tooltip opens upwards, which would leave the screen from the HUD.
 */
export function HudTip({ content, children, align = 'center', className = '' }: HudTipProps) {
  const id = useId();
  return (
    <div className={`group/tip relative ${className}`} aria-describedby={id}>
      {children}
      <div
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute top-[calc(100%+12px)] z-30 w-max max-w-72 -translate-y-1 rounded-xl border-[3px] border-ink bg-white px-3 py-2 text-left text-sm leading-snug text-ink opacity-0 shadow-[0_3px_0_var(--color-ink)] transition duration-150 group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-hover/tip:delay-300 [@media(hover:none)]:hidden ${alignClass[align]}`}
      >
        <span
          className={`absolute bottom-full -mb-[2px] size-3 translate-y-1/2 rotate-45 border-t-[3px] border-l-[3px] border-ink bg-white ${arrowClass[align]}`}
        />
        {content}
      </div>
    </div>
  );
}
