import type { HTMLAttributes, ReactNode } from 'react';

type PanelTheme = 'paper' | 'clipboard' | 'tablet' | 'receipt';

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  theme?: PanelTheme;
  /** Ribbon title on the top edge. */
  title?: ReactNode;
  children: ReactNode;
}

const shadow = 'shadow-[0_6px_0_var(--color-ink)]';

const surfaceClass: Record<PanelTheme, string> = {
  paper: `bg-paper text-ink ${shadow}`,
  clipboard: `bg-paper text-ink border-t-[14px] border-t-wood ${shadow}`,
  tablet: `bg-tablet text-paper outline outline-[6px] outline-tabletBezel ${shadow}`,
  receipt: 'panel-receipt rounded-b-none bg-white text-ink',
};

/**
 * The receipt's zigzag edge is a CSS mask, which would also clip a box-shadow and the ribbon, so
 * the ribbon sits outside the surface and the receipt's shadow is a drop-shadow on the wrapper.
 */
const wrapperClass: Record<PanelTheme, string> = {
  paper: '',
  clipboard: '',
  tablet: '',
  receipt: 'drop-shadow-[0_5px_0_var(--color-ink)]',
};

/**
 * Themed surface (docs/05 §1, "diegetic metaphors"): paper, clipboard, tablet app or receipt.
 */
export function Panel({ theme = 'paper', title, className = '', children, ...rest }: PanelProps) {
  return (
    <section className={`relative ${wrapperClass[theme]} ${className}`} {...rest}>
      <div
        className={`h-full rounded-[var(--radius-panel)] border-[3px] border-ink p-5 ${
          title ? 'pt-8' : ''
        } ${surfaceClass[theme]}`}
      >
        {children}
      </div>
      {title ? (
        <h2 className="absolute -top-4 left-4 -rotate-1 rounded-lg border-[3px] border-ink bg-sun px-3 py-0.5 font-display text-sm tracking-wide text-ink shadow-[0_3px_0_var(--color-ink)]">
          {title}
        </h2>
      ) : null}
    </section>
  );
}
