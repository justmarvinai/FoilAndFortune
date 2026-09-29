import type { ReactNode } from 'react';
import { Link } from '@/app/router';

interface DebugShellProps {
  title: string;
  subtitle?: string;
  /** Extra controls rendered on the right side of the header. */
  actions?: ReactNode;
  /** `dark` for stage-like pages (art, scene). */
  tone?: 'light' | 'dark';
  children: ReactNode;
}

/** Shared frame for Phase 1 debug/spike pages: header with back link, title and actions. */
export function DebugShell({
  title,
  subtitle,
  actions,
  tone = 'light',
  children,
}: DebugShellProps) {
  const dark = tone === 'dark';
  return (
    <div className={dark ? 'min-h-full bg-night text-paper' : 'min-h-full bg-paper text-ink'}>
      <header
        className={`sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b-[3px] px-4 py-3 ${
          dark ? 'border-black/40 bg-night/90 backdrop-blur' : 'border-ink bg-paper2'
        }`}
      >
        <Link
          to="/"
          className={`rounded-xl border-[3px] px-3 py-1 font-display text-sm tracking-wide shadow-[0_3px_0_var(--color-ink)] transition active:translate-y-[3px] active:shadow-none ${
            dark ? 'border-ink bg-sun text-ink' : 'border-ink bg-white text-ink'
          }`}
        >
          ← Hub
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl leading-tight tracking-wide sm:text-2xl">
            {title}
          </h1>
          {subtitle ? <p className="truncate text-sm opacity-75">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <main>{children}</main>
    </div>
  );
}

/** Placeholder body used while a page is being built. */
export function ComingSoon({ what }: { what: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center p-8 text-center">
      <p className="font-display text-2xl opacity-70">{what} is under construction 🔨</p>
    </div>
  );
}
