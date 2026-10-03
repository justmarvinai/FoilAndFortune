import { AnimatePresence, motion } from 'motion/react';
import {
  type ComponentType,
  type LazyExoticComponent,
  lazy,
  Suspense,
  useEffect,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { SheetProps } from '@/game/sheets/types';
import { type SheetId, useUiStore } from '@/state/uiStore';
import { useReducedMotion } from '../session/useApplySettings';
import { LoadingDots } from './LoadingDots';

/** Sheets load on first open, so the play screen starts fast (docs/06 §17). */
const SHEETS: Record<SheetId, LazyExoticComponent<ComponentType<SheetProps>>> = {
  inventory: lazy(() => import('@/game/sheets/InventorySheet')),
  prices: lazy(() => import('@/game/sheets/PriceBoardSheet')),
  crate: lazy(() => import('@/game/sheets/CrateSheet')),
  binder: lazy(() => import('@/game/sheets/BinderSheet')),
  settings: lazy(() => import('./settings/SettingsSheet')),
};

function SheetLoading() {
  const { t } = useTranslation('shell');
  return (
    <div className="grid h-full place-items-center rounded-[22px] border-[3px] border-ink bg-paper text-ink shadow-[0_6px_0_var(--color-ink)]">
      <p className="flex flex-col items-center gap-3 font-display text-xl tracking-wide">
        <LoadingDots />
        {t('sheet.loading')}
      </p>
    </div>
  );
}

/**
 * Layer 2 of the play screen (docs/05 §2): one sheet at a time, sliding in from the right
 * (480–720 px on desktop, 60 % on tablets, full screen on phones). The host owns placement, the
 * slide, backdrop close and focus; each sheet owns its skin, header and content (SheetProps).
 * Esc is handled by the session's `ui.back()`.
 */
export function SheetHost() {
  const { t } = useTranslation('shell');
  const sheet = useUiStore((ui) => ui.sheet);
  const close = useUiStore((ui) => ui.closeSheet);
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Focus moves into the sheet and back to whatever opened it when it closes.
  useEffect(() => {
    if (sheet) {
      if (!returnFocus.current && document.activeElement instanceof HTMLElement) {
        returnFocus.current = document.activeElement;
      }
      panelRef.current?.focus({ preventScroll: true });
    } else if (returnFocus.current) {
      if (returnFocus.current.isConnected) returnFocus.current.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [sheet]);

  const Sheet = sheet ? SHEETS[sheet] : null;
  const slide = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { x: '108%' }, animate: { x: 0 }, exit: { x: '108%' } };

  return (
    <>
      <AnimatePresence>
        {sheet ? (
          <motion.div
            key="sheet-backdrop"
            className="fixed inset-0 z-[5] bg-night/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={() => close()}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {sheet && Sheet ? (
          <motion.div
            key="sheet-panel"
            ref={panelRef}
            role="dialog"
            aria-label={t(`sheet.name.${sheet}`)}
            tabIndex={-1}
            data-sheet={sheet}
            className="sheet-host fixed z-20 flex flex-col outline-none"
            {...slide}
            transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }}
          >
            {/* Switching sheets keeps the panel and swaps the page inside it. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={sheet}
                className="flex min-h-0 flex-1 flex-col"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, rotate: 0.8 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
              >
                <Suspense fallback={<SheetLoading />}>
                  <Sheet onClose={close} />
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
