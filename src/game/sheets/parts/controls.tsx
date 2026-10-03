import { motion } from 'motion/react';
import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '@/audio';

/** Round chunky close key, 44 px (docs/05 §10 touch targets). */
export function CloseKey({
  onClose,
  tone = 'light',
  className = '',
}: {
  onClose(): void;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const { t } = useTranslation('sheets');
  return (
    <button
      type="button"
      onClick={() => {
        playSfx('ui.close');
        onClose();
      }}
      aria-label={t('common.close')}
      className={`grid size-11 shrink-0 place-items-center rounded-full border-[3px] border-ink shadow-[0_3px_0_var(--color-ink)] transition-transform duration-75 hover:-translate-y-px active:translate-y-[3px] active:shadow-none ${
        tone === 'dark' ? 'bg-ink text-paper' : 'bg-paper text-ink'
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          d="M6 6l12 12M18 6 6 18"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
  badge?: ReactNode;
}

/**
 * Accessible tabs (roving focus, arrow keys, Home/End). The look comes from `tabClass`, so each
 * sheet skins them as folder tabs, tablet pills or binder tabs.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
  tabClass,
  className = '',
}: {
  tabs: readonly TabDef<T>[];
  value: T;
  onChange(id: T): void;
  label: string;
  /** Tab ids are `${idPrefix}-tab-${id}`, panels `${idPrefix}-panel-${id}`. */
  idPrefix: string;
  tabClass(active: boolean): string;
  className?: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const select = (id: T) => {
    if (id !== value) playSfx('ui.tab');
    onChange(id);
    refs.current.get(id)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    const tab = tabs[next];
    if (!tab) return;
    event.preventDefault();
    select(tab.id);
  };
  return (
    <div role="tablist" aria-label={label} className={className}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) refs.current.set(tab.id, el);
              else refs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={onKeyDown}
            className={tabClass(active)}
          >
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

/** A number that bounces when it changes (docs/05 §6: feedback within 100 ms). */
export function Bump({
  value,
  children,
  className = '',
}: {
  value: number | string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.35, y: -3 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 600, damping: 18 }}
      className={`inline-block tabular-nums ${className}`}
    >
      {children}
    </motion.span>
  );
}

/** Toggle chip for filters: a pressed key when active. 44 px tall on touch. */
export function Chip({
  active,
  onClick,
  children,
  label,
  className = '',
}: {
  active: boolean;
  onClick(): void;
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={() => {
        playSfx('ui.pop');
        onClick();
      }}
      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full border-[3px] border-ink px-2.5 font-display text-sm tracking-wide transition-[transform,box-shadow,background-color] duration-75 pointer-coarse:h-11 ${
        active
          ? 'translate-y-[2px] bg-sun text-ink shadow-[inset_0_2px_0_rgb(0_0_0/0.2)]'
          : 'bg-paper text-ink shadow-[0_2px_0_var(--color-ink)] hover:bg-white'
      } ${className}`}
    >
      {children}
    </button>
  );
}
