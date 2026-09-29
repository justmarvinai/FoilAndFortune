import { type ReactNode, useId } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name, required when `label` is an icon. */
  ariaLabel?: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange(value: T): void;
  label?: string;
  size?: 'sm' | 'md';
}

/**
 * Row of chunky toggle keys; the active one is pressed in. Built on native radio inputs, so
 * arrow keys, focus and screen readers behave like a real radio group.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: SegmentedControlProps<T>) {
  const name = useId();
  const pad = size === 'sm' ? 'h-8 px-2.5 text-sm' : 'h-10 px-3.5';
  return (
    <fieldset className="inline-flex gap-1 rounded-2xl border-[3px] border-ink bg-paper2 p-1">
      {label ? <legend className="sr-only">{label}</legend> : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <label
            key={option.value}
            title={option.ariaLabel}
            className={`inline-flex cursor-pointer select-none items-center justify-center rounded-xl font-display tracking-wide transition-[transform,box-shadow,background-color] duration-75 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-sky has-[:focus-visible]:outline-offset-2 ${pad} ${
              active
                ? 'translate-y-[2px] bg-teal text-white shadow-[inset_0_2px_0_rgb(0_0_0/0.25)]'
                : 'text-ink hover:bg-white/70'
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={active}
              aria-label={option.ariaLabel}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}
