import type { ReactNode } from 'react';

/**
 * Game-concept icons drawn by us (docs/04 §8 "custom SVG game-icon set"): ink outlines and token
 * fills, so they match the chunky UI on every platform (no emoji).
 */
const INK = 'var(--color-ink)';

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      strokeLinejoin="round"
      strokeLinecap="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

interface IconProps {
  size?: number;
}

/** A cardboard box: units in the closet. */
export function BoxIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path
        d="M3 8.5 12 4l9 4.5v9L12 22l-9-4.5z"
        fill="var(--color-wood)"
        stroke={INK}
        strokeWidth="2"
      />
      <path d="M3 8.5 12 13l9-4.5M12 13v9" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M7.5 6.3 16.5 10.8" stroke="var(--color-sunLight)" strokeWidth="2.2" />
    </Icon>
  );
}

/** A shelf with items: units on display. */
export function ShelfIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <rect
        x="4"
        y="5"
        width="5"
        height="9"
        rx="1"
        fill="var(--color-coral)"
        stroke={INK}
        strokeWidth="1.8"
      />
      <rect
        x="10"
        y="7"
        width="4.5"
        height="7"
        rx="1"
        fill="var(--color-sky)"
        stroke={INK}
        strokeWidth="1.8"
      />
      <rect
        x="15.5"
        y="4"
        width="4.5"
        height="10"
        rx="1"
        fill="var(--color-sun)"
        stroke={INK}
        strokeWidth="1.8"
      />
      <path d="M2 15h20v3H2z" fill="var(--color-wood)" stroke={INK} strokeWidth="1.8" />
    </Icon>
  );
}

/** A delivery truck: incoming orders. */
export function TruckIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M2 6h12v10H2z" fill="var(--color-sun)" stroke={INK} strokeWidth="1.9" />
      <path d="M14 9h4l3 3.5V16h-7z" fill="var(--color-teal)" stroke={INK} strokeWidth="1.9" />
      <path d="M15.8 10.6h2l1.4 1.8h-3.4z" fill="var(--color-paper)" />
      <circle cx="6" cy="17" r="2.2" fill="var(--color-paper)" stroke={INK} strokeWidth="1.9" />
      <circle cx="17" cy="17" r="2.2" fill="var(--color-paper)" stroke={INK} strokeWidth="1.9" />
    </Icon>
  );
}

export function LockIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10" fill="none" stroke={INK} strokeWidth="2.4" />
      <rect
        x="4.5"
        y="10"
        width="15"
        height="11"
        rx="2.5"
        fill="var(--color-sun)"
        stroke={INK}
        strokeWidth="2"
      />
      <circle cx="12" cy="15" r="1.7" fill={INK} />
      <path d="M12 15.5v2.5" stroke={INK} strokeWidth="2" />
    </Icon>
  );
}

/** A ring binder. */
export function BinderIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="2.5"
        fill="var(--color-grape)"
        stroke={INK}
        strokeWidth="2"
      />
      <path d="M8 3v18" stroke={INK} strokeWidth="1.8" />
      <circle cx="8" cy="8" r="1.6" fill="var(--color-paper)" stroke={INK} strokeWidth="1.3" />
      <circle cx="8" cy="16" r="1.6" fill="var(--color-paper)" stroke={INK} strokeWidth="1.3" />
      <path
        d="m14 9.3.9 1.9 2.1.3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.4 2.1-.3z"
        fill="var(--color-sun)"
      />
    </Icon>
  );
}

/** A glass display case. */
export function CaseIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M3 9h18v11H3z" fill="var(--color-wood)" stroke={INK} strokeWidth="1.9" />
      <path d="M4 4h16l1 5H3z" fill="var(--color-mintLight)" stroke={INK} strokeWidth="1.9" />
      <rect
        x="7"
        y="11.5"
        width="4"
        height="5.5"
        rx="0.8"
        fill="var(--color-paper)"
        stroke={INK}
        strokeWidth="1.5"
      />
      <rect
        x="13"
        y="11.5"
        width="4"
        height="5.5"
        rx="0.8"
        fill="var(--color-sun)"
        stroke={INK}
        strokeWidth="1.5"
      />
    </Icon>
  );
}

/** Sad empty shelf: a stock-out (docs/05 §5.3). */
export function StockOutIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path
        d="M3 8.5 12 4l9 4.5v9L12 22l-9-4.5z"
        fill="var(--color-paper)"
        stroke={INK}
        strokeWidth="2"
      />
      <circle cx="9" cy="12.5" r="1.1" fill={INK} />
      <circle cx="15" cy="12.5" r="1.1" fill={INK} />
      <path d="M9.3 17.2q2.7-2.2 5.4 0" fill="none" stroke={INK} strokeWidth="1.8" />
    </Icon>
  );
}

/** A warning triangle for stock-out risk. */
export function RiskIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M12 3 22 20H2z" fill="var(--color-coral)" stroke={INK} strokeWidth="2" />
      <path d="M12 9v5" stroke="white" strokeWidth="2.6" />
      <circle cx="12" cy="17" r="1.4" fill="white" />
    </Icon>
  );
}

/** Scissors along a dotted line: open (rip) a product. */
export function RipIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path
        d="M2 12h3m3 0h3m3 0h3m3 0h2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeDasharray="0"
      />
      <path d="M6 6.5 18 15" stroke="currentColor" strokeWidth="2.2" />
      <path d="M6 17.5 18 9" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="5" cy="5.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="5" cy="18.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
    </Icon>
  );
}

/** A crowbar prying a box: break it into loose packs. */
export function BreakIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M3 10h12v10H3z" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <path d="m3 10 3-4h12l-3 4M15 20l3-4V6" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <path d="M8.5 3.5 10 6M13 2.5l-.5 3M17.5 4l-2 2" stroke="currentColor" strokeWidth="2" />
    </Icon>
  );
}

/** An arrow onto a shelf: stock it. */
export function StockIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M12 3v9m-4-4 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2.3" />
      <path d="M3 15h18v4H3z" fill="none" stroke="currentColor" strokeWidth="2.1" />
    </Icon>
  );
}

/** The Crate app logo: a slatted shipping crate. */
export function CrateLogo({ size = 28 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M3 7h18v13H3z" fill="var(--color-wood)" stroke={INK} strokeWidth="1.9" />
      <path d="M3 11.3h18M3 15.6h18" stroke={INK} strokeWidth="1.5" />
      <path
        d="M3 7 21 20M21 7 3 20"
        stroke="var(--color-woodDark)"
        strokeWidth="1.4"
        opacity="0.7"
      />
      <path d="M6 7l2-3h8l2 3" fill="var(--color-sun)" stroke={INK} strokeWidth="1.8" />
    </Icon>
  );
}

/** Supplier mark for Budget Box Co.: a box with a price tag. */
export function BudgetBoxMark({ size = 36 }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="11" fill="var(--color-sun)" stroke={INK} strokeWidth="1.6" />
      <path
        d="M6 10l6-3 6 3v6.5l-6 3-6-3z"
        fill="var(--color-wood)"
        stroke={INK}
        strokeWidth="1.5"
      />
      <path d="M6 10l6 3 6-3M12 13v6.5" fill="none" stroke={INK} strokeWidth="1.4" />
      <path
        d="M14.5 5.5h4.3v3.2l-2.1 1.6-2.2-1.6z"
        fill="var(--color-coral)"
        stroke={INK}
        strokeWidth="1.2"
      />
    </Icon>
  );
}

/** Teaser marks for suppliers that aren't open yet. */
export function TeaserMark({ kind, size = 36 }: IconProps & { kind: string }) {
  const fill =
    kind === 'harbor'
      ? 'var(--color-sky)'
      : kind === 'kaze'
        ? 'var(--color-coral)'
        : kind === 'foilmarket'
          ? 'var(--color-grape)'
          : 'var(--color-teal)';
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="11" fill={fill} stroke={INK} strokeWidth="1.6" />
      {kind === 'harbor' ? (
        <path
          d="M12 5.5v12M8.5 8h7M6.5 13.5a5.5 5.5 0 0 0 11 0"
          fill="none"
          stroke="white"
          strokeWidth="2"
        />
      ) : kind === 'kaze' ? (
        <path d="M6 7h5.5v10H6zM12.5 7H18v10h-5.5z" fill="white" stroke={INK} strokeWidth="1.2" />
      ) : kind === 'foilmarket' ? (
        <path d="M5 15l4-4 3 3 6-6M14 8h4v4" fill="none" stroke="white" strokeWidth="2.2" />
      ) : (
        <path
          d="M12 4.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L4.8 9.7l5-.6z"
          fill="white"
          stroke={INK}
          strokeWidth="1.2"
        />
      )}
    </Icon>
  );
}
