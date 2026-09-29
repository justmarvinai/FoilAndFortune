import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warning' | 'celebrate';

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
  icon?: ReactNode;
}

interface ToastStore {
  toasts: Toast[];
  push(toast: Omit<Toast, 'id'>): void;
  dismiss(id: number): void;
}

let nextId = 1;
const MAX_TOASTS = 3;
const TOAST_MS = 4000;

/** UI-only store (never saved). Toast rules: max 3, ~4 s, bottom-left (docs/05 §7). */
export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push(toast) {
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...toast, id }].slice(-MAX_TOASTS) });
    window.setTimeout(() => get().dismiss(id), TOAST_MS);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
  },
}));

const toneClass: Record<ToastTone, string> = {
  info: 'bg-white',
  success: 'bg-mintLight',
  warning: 'bg-sunLight',
  celebrate: 'bg-sun',
};

export function ToastViewport() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            type="button"
            key={toast.id}
            layout
            initial={{ opacity: 0, x: -40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -30, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            onClick={() => dismiss(toast.id)}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border-[3px] border-ink p-3 text-left text-ink shadow-[0_4px_0_var(--color-ink)] ${toneClass[toast.tone]}`}
          >
            {toast.icon ? <span className="text-2xl leading-none">{toast.icon}</span> : null}
            <span>
              <span className="block font-display tracking-wide">{toast.title}</span>
              {toast.body ? <span className="block text-sm text-ink/75">{toast.body}</span> : null}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
