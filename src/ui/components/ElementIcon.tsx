import type { ElementId } from '@/content/schema/common';
import { elements } from '@/content/tcg/gk/elements';

/** Element symbols (docs/03 §3.2): white glyph on the element color, ink outline. */
const glyphs: Record<ElementId, { fill?: string; stroke?: string }> = {
  ember: {
    fill: 'M12 3.2c1.4 3.2 4.8 5.2 4.8 9.4a4.8 4.8 0 0 1-9.6 0c0-1.9 1-3.4 1.9-4.3.2 1.5 1 2.5 1.9 2.9 0-3 .4-5.2 1-8z',
  },
  tide: {
    stroke:
      'M4.5 10.5c1.8-1.8 3.7-1.8 5.5 0s3.7 1.8 5.5 0 3.7-1.8 4.5-.9M4.5 15.5c1.8-1.8 3.7-1.8 5.5 0s3.7 1.8 5.5 0 3.7-1.8 4.5-.9',
  },
  bloom: {
    fill: 'M11.2 20.5v-6.4C7.6 14.2 5 11.8 5 7.6c3.9 0 6.3 2.1 6.9 5.3.5-4.2 3.3-7 7.1-7 0 4.8-3 8-6.3 8.3v6.3z',
  },
  volt: { fill: 'M13.2 2.8 5.6 13.4h5.6l-1.4 7.8 8.1-11h-5.7z' },
  terra: {
    fill: 'M5 18.5c0-2 1.6-3 3.6-3h6.8c2 0 3.6 1 3.6 3v.7H5zM7 13.8c0-1.7 1.4-2.7 3.1-2.7h3.8c1.7 0 3.1 1 3.1 2.7v.3H7zM9 9.4C9 8 10.1 7 11.4 7h1.2C13.9 7 15 8 15 9.4v.3H9z',
  },
  mystic: {
    fill: 'M12 6.5c4.6 0 8 5.5 8 5.5s-3.4 5.5-8 5.5-8-5.5-8-5.5 3.4-5.5 8-5.5zm0 2.7-.9 1.9-2 .3 1.5 1.4-.4 2 1.8-1 1.8 1-.4-2 1.5-1.4-2-.3z',
  },
  shade: { fill: 'M15.5 4a8 8 0 1 0 4.7 12.9A6.6 6.6 0 0 1 15.5 4z' },
  frost: {
    stroke:
      'M12 3.5v17M4.6 7.75l14.8 8.5M4.6 16.25l14.8-8.5M12 6.5 10 4.8M12 6.5l2-1.7M12 17.5l-2 1.7M12 17.5l2 1.7',
  },
  neutral: { fill: 'M12 5.2 13.6 10.4 18.8 12 13.6 13.6 12 18.8 10.4 13.6 5.2 12 10.4 10.4z' },
};

export interface ElementIconProps {
  element: ElementId;
  /** Pixels, or any CSS length (e.g. `4cqw` inside a card). */
  size?: number | string;
  title?: string;
}

export function ElementIcon({ element, size = 24, title }: ElementIconProps) {
  const def = elements[element];
  const glyph = glyphs[element];
  return (
    <svg
      width={typeof size === 'number' ? size : undefined}
      height={typeof size === 'number' ? size : undefined}
      style={typeof size === 'string' ? { width: size, height: size } : undefined}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title ?? element}
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="10.5" fill={def.color} stroke="var(--color-ink)" strokeWidth="2" />
      {glyph.fill ? (
        <path
          d={glyph.fill}
          fill="#fff"
          stroke="var(--color-ink)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      ) : null}
      {glyph.stroke ? (
        <path
          d={glyph.stroke}
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}
