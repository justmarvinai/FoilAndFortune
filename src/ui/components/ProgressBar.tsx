export interface ProgressBarProps {
  /** 0–1 */
  value: number;
  label?: string;
  color?: string;
  className?: string;
}

/** Chunky progress bar with a moving shimmer (XP, storage, completion). */
export function ProgressBar({
  value,
  label,
  color = 'var(--color-sun)',
  className = '',
}: ProgressBarProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className={`relative h-6 overflow-hidden rounded-full border-[3px] border-ink bg-paper2 ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <div
        className="progress-shimmer h-full rounded-full border-r-[3px] border-ink transition-[width] duration-500 ease-out"
        style={{
          width: `${pct}%`,
          backgroundColor: color,
          borderRightWidth: pct === 0 || pct === 100 ? 0 : 3,
        }}
      />
      {label ? (
        <span className="absolute inset-0 grid place-items-center font-display text-xs tracking-wide text-ink">
          {label}
        </span>
      ) : null}
    </div>
  );
}
