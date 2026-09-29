import type { ReactNode } from 'react';
import type { Rarity } from '@/content/schema/common';
import { rarityColors } from '@/ui/palette';

const STAR = 'M12 3.4l2.5 5.3 5.8.6-4.3 3.9 1.2 5.7L12 16l-5.2 2.9 1.2-5.7-4.3-3.9 5.8-.6z';

/**
 * Rarity symbol (docs/03 §3.4): shape AND color so rarity never relies on color alone
 * (docs/04 §12). ● ◆ ★ ★(glow) ★★ gold★ gold★★★ ♛
 */
export function RarityGem({
  rarity,
  size = 18,
  title,
}: {
  rarity: Rarity;
  /** Height in pixels, or any CSS length (e.g. `3cqw` inside a card). */
  size?: number | string;
  title?: string;
}) {
  const color = rarityColors[rarity];
  const ink = 'var(--color-ink)';
  const gold = 'var(--color-sun)';
  let body: ReactNode;
  // Multi-star gems are wider than tall; widths are expressed as a ratio of the height.
  let widthRatio = 1;

  switch (rarity) {
    case 'common':
      body = <circle cx="12" cy="12" r="6" fill={ink} />;
      break;
    case 'uncommon':
      body = <path d="M12 4.5 19.5 12 12 19.5 4.5 12z" fill={ink} />;
      break;
    case 'rare':
      body = <path d={STAR} fill={ink} />;
      break;
    case 'holoRare':
      body = <path d={STAR} fill={color} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />;
      break;
    case 'ultraRare':
      widthRatio = 1.8;
      body = (
        <g stroke={ink} strokeWidth="1.6" strokeLinejoin="round" fill="#fff">
          <path d={STAR} transform="translate(-4 0)" />
          <path d={STAR} transform="translate(12 0)" />
        </g>
      );
      break;
    case 'illustrationRare':
      body = <path d={STAR} fill={gold} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />;
      break;
    case 'secretRare':
      widthRatio = 2.4;
      body = (
        <g fill={gold} stroke={ink} strokeWidth="1.6" strokeLinejoin="round">
          <path d={STAR} transform="translate(-6 0)" />
          <path d={STAR} transform="translate(10 0)" />
          <path d={STAR} transform="translate(26 0)" />
        </g>
      );
      break;
    case 'mythicRare':
      body = (
        <path
          d="M4 17.5 5.5 7.5l4.2 4.3L12 5.5l2.3 6.3 4.2-4.3 1.5 10z"
          fill={color}
          stroke={ink}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      );
      break;
    case 'promo':
      body = <path d={STAR} fill={ink} stroke={gold} strokeWidth="1.6" strokeLinejoin="round" />;
      break;
  }

  const viewWidth = 24 * widthRatio;
  const viewX = rarity === 'ultraRare' ? -4 : rarity === 'secretRare' ? -6 : 0;
  const style =
    typeof size === 'string' ? { height: size, width: `calc(${size} * ${widthRatio})` } : undefined;
  return (
    <svg
      width={typeof size === 'number' ? size * widthRatio : undefined}
      height={typeof size === 'number' ? size : undefined}
      style={style}
      viewBox={`${viewX} 0 ${viewWidth} 24`}
      role="img"
      aria-label={title ?? rarity}
      className="shrink-0"
    >
      {body}
    </svg>
  );
}
