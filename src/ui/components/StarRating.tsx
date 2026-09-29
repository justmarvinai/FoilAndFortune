import { useId } from 'react';

const STAR = 'M12 2.6l2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.7-.7z';

export interface StarRatingProps {
  /** 0–5 in 0.5 steps. */
  value: number;
  size?: number;
  label?: string;
}

/** Reputation stars with half-star support (docs/02 §13: stars = round½(rep/20)). */
export function StarRating({ value, size = 22, label }: StarRatingProps) {
  // useId() may contain characters (e.g. «») that break SVG url(#…) references.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={label ?? `${value} of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, value - index));
        const clipId = `${id}-star-${index}`;
        return (
          <svg key={index} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width={24 * fill} height="24" />
              </clipPath>
            </defs>
            <path
              d={STAR}
              fill="var(--color-paper2)"
              stroke="var(--color-ink)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d={STAR} fill="var(--color-sun)" clipPath={`url(#${clipId})`} />
            <path
              d={STAR}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </span>
  );
}
