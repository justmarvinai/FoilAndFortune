import type { ReactNode } from 'react';
import type { BubbleIcon } from './overlayRegistry';

/**
 * Chunky intent icons for customer bubbles (docs/01 §10.3: 🛒 ready to pay, 💬 wants to talk,
 * ❤️ delighted…). Drawn as our own SVGs (docs/04 §8 "custom SVG game-icon set") rather than
 * emoji, so they look identical on every platform and match the ink-outline UI.
 */
const INK = 'var(--color-ink)';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-full w-full"
      aria-hidden="true"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {children}
    </svg>
  );
}

/** A price tag (point left, string hole) for the price-reaction bubbles (docs/02 §5.3). */
function PriceTag({ fill, children }: { fill: string; children: ReactNode }) {
  return (
    <Svg>
      <path
        d="M3 16 11 6h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H11z"
        fill={fill}
        stroke={INK}
        strokeWidth="2.6"
      />
      <circle cx="9.5" cy="16" r="2.2" fill="var(--color-paper)" stroke={INK} strokeWidth="1.8" />
      {children}
    </Svg>
  );
}

export const INTENT_ICONS: Record<BubbleIcon, ReactNode> = {
  cart: (
    <Svg>
      <path d="M3 6h4l3 14h14l3-10H9" fill="none" stroke={INK} strokeWidth="3" />
      <path d="M10 10h16l-2.3 7.5H11.6z" fill="var(--color-sun)" stroke={INK} strokeWidth="2.5" />
      <circle cx="12" cy="25.5" r="2.6" fill="var(--color-coral)" stroke={INK} strokeWidth="2.2" />
      <circle cx="22" cy="25.5" r="2.6" fill="var(--color-coral)" stroke={INK} strokeWidth="2.2" />
    </Svg>
  ),
  chat: (
    <Svg>
      <path
        d="M5 7h22a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14l-6 5v-5H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
        fill="var(--color-sky)"
        stroke={INK}
        strokeWidth="2.6"
      />
      <circle cx="10" cy="14.5" r="2" fill={INK} />
      <circle cx="16" cy="14.5" r="2" fill={INK} />
      <circle cx="22" cy="14.5" r="2" fill={INK} />
    </Svg>
  ),
  heart: (
    <Svg>
      <path
        d="M16 27S4 19.5 4 11.5A6.5 6.5 0 0 1 16 8a6.5 6.5 0 0 1 12 3.5C28 19.5 16 27 16 27z"
        fill="var(--color-coral)"
        stroke={INK}
        strokeWidth="2.6"
      />
      <path d="M9 11.5a3 3 0 0 1 3-3" fill="none" stroke="#fff" strokeWidth="2.2" />
    </Svg>
  ),
  search: (
    <Svg>
      <circle cx="13.5" cy="13.5" r="8" fill="#BDEFFF" stroke={INK} strokeWidth="2.8" />
      <path d="M19.5 19.5 27 27" stroke={INK} strokeWidth="4" />
      <path d="M10 11a4 4 0 0 1 3.5-2.5" fill="none" stroke="#fff" strokeWidth="2.2" />
    </Svg>
  ),
  pack: (
    <Svg>
      <path
        d="M8 5l2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2v22l-2-2-2 2-2-2-2 2-2-2-2 2-2-2-2 2z"
        fill="var(--color-coral)"
        stroke={INK}
        strokeWidth="2.4"
      />
      <circle cx="16" cy="16" r="4.5" fill="var(--color-sun)" stroke={INK} strokeWidth="2" />
      <path d="M11 9.5h10" stroke="#fff" strokeWidth="2" />
    </Svg>
  ),
  exclaim: (
    <Svg>
      <path d="M13 4h6l-1 15h-4z" fill="var(--color-sun)" stroke={INK} strokeWidth="2.6" />
      <circle cx="16" cy="25" r="3" fill="var(--color-sun)" stroke={INK} strokeWidth="2.6" />
    </Svg>
  ),
  sparkle: (
    <Svg>
      <path
        d="M14 3l2.6 8.4L25 14l-8.4 2.6L14 25l-2.6-8.4L3 14l8.4-2.6z"
        fill="var(--color-sun)"
        stroke={INK}
        strokeWidth="2.4"
      />
      <path
        d="M25 20l1.2 3.3 3.3 1.2-3.3 1.2L25 29l-1.2-3.3-3.3-1.2 3.3-1.2z"
        fill="var(--color-teal)"
        stroke={INK}
        strokeWidth="1.8"
      />
    </Svg>
  ),
  wait: (
    <Svg>
      <path
        d="M8 4h16M8 28h16M10 4c0 7 12 7 12 12s-12 5-12 12M22 4c0 7-12 7-12 12s12 5 12 12"
        fill="none"
        stroke={INK}
        strokeWidth="2.6"
      />
      <path d="M12 26c1-3 7-3 8 0z" fill="var(--color-sun)" />
    </Svg>
  ),
  empty: (
    <Svg>
      <path d="M5 13h22l-2 14H7z" fill="var(--color-wood)" stroke={INK} strokeWidth="2.6" />
      <path
        d="M5 13 2 8h10l2 5M27 13l3-5H20l-2 5"
        fill="var(--color-paper2)"
        stroke={INK}
        strokeWidth="2.2"
      />
      <path d="M12.5 16.5l7 7m0-7-7 7" stroke="var(--color-coral)" strokeWidth="3.2" />
    </Svg>
  ),
  steal: (
    <PriceTag fill="var(--color-mint)">
      <path
        d="M20 9.5v11M15.5 16 20 20.5l4.5-4.5"
        fill="none"
        stroke="var(--color-paper)"
        strokeWidth="3"
      />
    </PriceTag>
  ),
  fair: (
    <PriceTag fill="var(--color-sky)">
      <path d="M14.5 16.5 18 20l7-7" fill="none" stroke="var(--color-paper)" strokeWidth="3.2" />
    </PriceTag>
  ),
  pricey: (
    <PriceTag fill="var(--color-sun)">
      <path d="M20 22V11m-4.5 4.5L20 11l4.5 4.5" fill="none" stroke={INK} strokeWidth="2.8" />
    </PriceTag>
  ),
  ripoff: (
    <PriceTag fill="var(--color-coral)">
      <path
        d="M15 16.5l5-5 5 5M15 22.5l5-5 5 5"
        fill="none"
        stroke="var(--color-paper)"
        strokeWidth="2.8"
      />
    </PriceTag>
  ),
  angry: (
    <Svg>
      <path
        d="M6 11c4 0 5-1 5-5M26 11c-4 0-5-1-5-5M6 21c4 0 5 1 5 5M26 21c-4 0-5 1-5 5"
        fill="none"
        stroke="var(--color-coral)"
        strokeWidth="4"
      />
    </Svg>
  ),
};

export const BUBBLE_ICON_NAMES = Object.keys(INTENT_ICONS) as BubbleIcon[];
