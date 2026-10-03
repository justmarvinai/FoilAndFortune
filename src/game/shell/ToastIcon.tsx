import type { ReactNode } from 'react';

type Tone = 'teal' | 'sun' | 'coral' | 'sky' | 'grape' | 'mint';

const toneClass: Record<Tone, string> = {
  teal: 'bg-teal text-white',
  sun: 'bg-sun text-ink',
  coral: 'bg-coral text-white',
  sky: 'bg-sky text-white',
  grape: 'bg-grape text-white',
  mint: 'bg-mint text-ink',
};

/** A chunky icon chip for toasts and log lines (docs/04 §8 "stickers and stamps"). */
export function ToastIcon({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`grid size-9 shrink-0 -rotate-6 place-items-center rounded-xl border-[3px] border-ink shadow-[0_2px_0_var(--color-ink)] [&>svg]:size-5 ${toneClass[tone]}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
