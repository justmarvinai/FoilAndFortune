import { motion } from 'motion/react';
import { type ReactNode, useEffect, useId, useRef } from 'react';

/**
 * A confirmation as a taped paper note over the sheet (docs/05 §4 "big irreversible actions get
 * confirmation"). Esc and the backdrop cancel; Esc stops here so the sheet stays open.
 */
export function ConfirmNote({
  title,
  children,
  actions,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onCancel(): void;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <motion.div
      className="absolute inset-0 z-30 grid place-items-center bg-night/55 p-4 backdrop-blur-[1px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <motion.div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onCancel();
          }
        }}
        className="relative max-h-full w-full max-w-md overflow-y-auto rounded-[6px_6px_18px_14px] border-[3px] border-ink bg-paper p-5 pt-7 text-ink shadow-[0_8px_0_var(--color-ink)] outline-none"
        initial={{ scale: 0.8, rotate: -4, y: 30 }}
        animate={{ scale: 1, rotate: -1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      >
        <span
          className="tape absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-2"
          aria-hidden="true"
        />
        <h3 id={titleId} className="font-display text-2xl leading-tight tracking-wide">
          {title}
        </h3>
        <div className="mt-2 space-y-3">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">{actions}</div>
      </motion.div>
    </motion.div>
  );
}
