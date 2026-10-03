import { NotebookPen } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/state/uiStore';
import { type FeedEntry, useShellStore } from '../session/shellStore';
import { clockText } from './hudTime';

const DOT: Record<FeedEntry['kind'], string> = {
  sale: 'bg-mint',
  leftHappy: 'bg-sun',
  leftEmpty: 'bg-coral',
  delivery: 'bg-sky',
  order: 'bg-sky',
  levelUp: 'bg-grape',
  opened: 'bg-grape',
  rent: 'bg-coral',
  shopOpened: 'bg-teal',
  shopClosed: 'bg-ink',
};

/**
 * The collapsible activity log on the right (docs/05 §3.1, §7): a running, handwritten notepad
 * of today's sales, deliveries and moments. Desktop only; phones keep the scene clear.
 */
export function ActivityFeed() {
  const { t } = useTranslation('shell');
  const feed = useShellStore((store) => store.feed);
  const open = useShellStore((store) => store.feedOpen);
  const setOpen = useShellStore((store) => store.setFeedOpen);
  // A sheet covers the right side; the log steps aside instead of peeking over it.
  const sheetOpen = useUiStore((ui) => ui.sheet !== null);
  const recent = feed.slice(0, 7);
  if (sheetOpen) return null;

  return (
    <div className="pointer-events-auto flex w-60 flex-col items-end [@media(max-height:540px)]:hidden [@media(max-width:1099px)]:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? t('feed.hide') : t('feed.show')}
        className="relative z-10 -mb-[3px] flex items-center gap-1.5 rounded-t-xl border-[3px] border-b-0 border-ink bg-sun px-3 py-1 font-display text-sm tracking-wide text-ink"
      >
        <NotebookPen className="size-4" aria-hidden="true" />
        {t('feed.title')}
        {!open && feed.length > 0 ? (
          <span className="ml-1 rounded-full bg-ink px-1.5 text-[11px] leading-4 text-paper">
            {feed.length}
          </span>
        ) : null}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            aria-live="polite"
            className="w-full overflow-hidden rounded-xl rounded-tr-none border-[3px] border-ink bg-paper shadow-[0_4px_0_var(--color-ink)] [background-image:repeating-linear-gradient(transparent_0_25px,rgb(77_168_255/0.22)_25px_26px)]"
          >
            {recent.length === 0 ? (
              <li className="px-3 py-2 font-hand text-lg text-ink/60">{t('feed.empty')}</li>
            ) : (
              recent.map((entry) => (
                <motion.li
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex h-[26px] items-center gap-2 px-3 font-hand text-lg leading-none text-ink"
                >
                  <span
                    className={`size-2 shrink-0 rounded-full border border-ink ${DOT[entry.kind]}`}
                    aria-hidden="true"
                  />
                  <span className="shrink-0 font-ui text-[11px] font-bold tabular-nums text-ink/50">
                    {clockText(entry.minute)}
                  </span>
                  <span className="truncate">{t(`feed.${entry.kind}`, entry.params)}</span>
                </motion.li>
              ))
            )}
          </motion.ol>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
