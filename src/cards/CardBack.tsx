import { useId } from 'react';
import type { ElementId } from '@/content/schema/common';
import { glimmerkin } from '@/content/tcg/gk/brand';
import { elements } from '@/content/tcg/gk/elements';
import './cards.css';

const RING: readonly ElementId[] = [
  'ember',
  'tide',
  'bloom',
  'volt',
  'terra',
  'mystic',
  'shade',
  'frost',
  'neutral',
];

/**
 * Glimmerkin card back (docs/04 §5.2): deep indigo, golden spark burst, ring of the nine element
 * gems and the wordmark. Iconic on purpose; it's what customers see in every pack.
 */
export function CardBack({ width = 300 }: { width?: number | string }) {
  const colors = glimmerkin.cardBack;
  // Unique per instance: many backs share a page. useId() characters can break url(#…) refs.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const glowId = `${uid}-back-glow`;
  const goldId = `${uid}-back-gold`;
  return (
    <div className="gk-card" style={{ width }} role="img" aria-label="Glimmerkin card back">
      <div className="gk-card__tilt">
        <div className="gk-card-back">
          <svg viewBox="0 0 100 140" className="absolute inset-0 size-full" aria-hidden="true">
            <defs>
              <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor={colors.glow} stopOpacity="0.55" />
                <stop offset="1" stopColor={colors.glow} stopOpacity="0" />
              </radialGradient>
              <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={colors.goldLight} />
                <stop offset="0.5" stopColor={colors.gold} />
                <stop offset="1" stopColor={colors.goldDark} />
              </linearGradient>
            </defs>
            <circle cx="46.7" cy="63.3" r="34" fill={`url(#${glowId})`} />
            {RING.map((id, index) => {
              const angle = (index / RING.length) * Math.PI * 2 - Math.PI / 2;
              return (
                <circle
                  key={id}
                  cx={46.7 + Math.cos(angle) * 25}
                  cy={63.3 + Math.sin(angle) * 25}
                  r="3.6"
                  fill={elements[id].color}
                  stroke={colors.glow}
                  strokeWidth="0.8"
                />
              );
            })}
            <path
              d="M46.7 38 51.4 58.6 72 63.3 51.4 68 46.7 88.6 42 68 21.4 63.3 42 58.6z"
              fill={`url(#${goldId})`}
              stroke={colors.outline}
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
            <circle
              cx="46.7"
              cy="63.3"
              r="4.5"
              fill={colors.core}
              stroke={colors.outline}
              strokeWidth="0.8"
            />
            <text
              x="46.7"
              y="120"
              textAnchor="middle"
              fontFamily="Lilita One, sans-serif"
              fontSize="10"
              letterSpacing="0.8"
              fill={`url(#${goldId})`}
              stroke={colors.outline}
              strokeWidth="0.35"
            >
              GLIMMERKIN
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
