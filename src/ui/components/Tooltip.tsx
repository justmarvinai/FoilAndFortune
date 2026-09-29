import { type ReactNode, useId } from 'react';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

/** Speech-bubble tooltip on hover and keyboard focus (docs/05 §4). */
export function Tooltip({ content, children }: TooltipProps) {
  const id = useId();
  return (
    <span className="group relative inline-flex" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-max max-w-64 -translate-x-1/2 translate-y-1 rounded-xl border-[3px] border-ink bg-white px-3 py-1.5 text-sm text-ink opacity-0 shadow-[0_3px_0_var(--color-ink)] transition duration-150 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-300"
      >
        {content}
        <span className="absolute top-full left-1/2 -mt-[2px] size-3 -translate-x-1/2 rotate-45 border-r-[3px] border-b-[3px] border-ink bg-white" />
      </span>
    </span>
  );
}
