import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'gold' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-teal text-white [text-shadow:0_2px_0_rgb(30_35_64/0.45)]',
  secondary: 'bg-white text-ink',
  gold: 'bg-sun text-ink',
  danger: 'bg-coral text-white [text-shadow:0_2px_0_rgb(30_35_64/0.45)]',
  ghost: 'border-transparent bg-transparent text-current shadow-none',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-9 gap-1.5 px-3 text-sm',
  md: 'h-11 gap-2 px-4 text-base',
  lg: 'h-14 gap-2.5 px-6 text-xl',
};

/**
 * Chunky physical key (docs/04 §8): thick outline, hard offset shadow, presses down on click.
 * Feedback is instant CSS, so it stays under the 100 ms rule (docs/05 §1).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const pressable =
    variant === 'ghost'
      ? 'hover:bg-black/5 active:scale-95'
      : 'shadow-[inset_0_-4px_0_rgb(0_0_0/0.12),0_4px_0_var(--color-ink)] hover:-translate-y-px hover:brightness-105 active:translate-y-[4px] active:shadow-[inset_0_-2px_0_rgb(0_0_0/0.12),0_0_0_var(--color-ink)]';
  return (
    <button
      type={type}
      className={`inline-flex select-none items-center justify-center rounded-[var(--radius-button)] border-[3px] border-ink font-display tracking-wide whitespace-nowrap transition-[transform,box-shadow,filter] duration-75 disabled:pointer-events-none disabled:opacity-45 ${variantClass[variant]} ${sizeClass[size]} ${pressable} ${className}`}
      {...rest}
    >
      {icon ? <span className="grid place-items-center [&>svg]:size-[1.1em]">{icon}</span> : null}
      {children}
    </button>
  );
}
