import type { ReactNode } from 'react';
import type { HairStyle, PegLook, TopStyle } from '@/scene/agents/looks';
import type { AvatarSpec } from '@/sim/state/types';
import { avatarLook } from './avatar';

/**
 * A 2D sticker portrait of a Peg-folk (docs/04 §4.4): the same squashed round head, capsule body,
 * mitten-free bust and face decals as the 3D shopkeeper, drawn as flat SVG with the UI's thick
 * ink outline. No three.js, so it is safe on the title route.
 */
export type PortraitExpression = 'neutral' | 'happy' | 'excited';

export interface AvatarPortraitProps {
  spec: AvatarSpec;
  expression?: PortraitExpression;
  /** Accessible name; decorative (hidden) when omitted. */
  title?: string;
  className?: string;
  /** Draw only the head and shoulders centered for tiny badges. */
  crop?: 'bust' | 'head';
  /** Placement when nested inside another SVG (e.g. the title's shop window). */
  svgProps?: { x: number; y: number; width: number; height: number };
}

const INK = 'var(--color-ink)';
const STROKE = 3;

function Hair({ style, color, back }: { style: HairStyle; color: string; back: boolean }) {
  const common = {
    fill: color,
    stroke: INK,
    strokeWidth: STROKE,
    strokeLinejoin: 'round' as const,
  };
  // Parts behind the head (drawn first): ponytail, bob length, bun.
  if (back) {
    switch (style) {
      case 'ponytail':
        return <path d="M84 40 Q104 44 100 70 Q98 84 88 90 Q92 74 86 60 Z" {...common} />;
      case 'bob':
        return (
          <path
            d="M27 56 Q25 22 60 21 Q95 22 93 56 L93 74 Q86 78 80 74 L40 74 Q34 78 27 74 Z"
            {...common}
          />
        );
      case 'bun':
        return <circle cx="60" cy="19" r="11" {...common} />;
      default:
        return null;
    }
  }
  switch (style) {
    case 'bob':
      return (
        <path
          d="M30 60 Q28 27 60 25 Q92 27 90 60 Q86 48 76 44 Q66 50 54 44 Q44 50 38 46 Q32 52 30 60 Z"
          {...common}
        />
      );
    case 'bun':
      return <path d="M31 54 Q30 27 60 26 Q90 27 89 54 Q82 42 60 40 Q38 42 31 54 Z" {...common} />;
    case 'spiky':
      return (
        <path
          d="M30 56 L27 34 L38 38 L40 20 L50 32 L58 14 L64 30 L76 16 L78 34 L92 30 L90 56 Q84 44 60 42 Q36 44 30 56 Z"
          {...common}
        />
      );
    case 'ponytail':
      return (
        <path
          d="M31 55 Q30 27 60 26 Q90 27 89 55 Q80 40 64 42 Q66 36 58 34 Q46 44 31 55 Z"
          {...common}
        />
      );
    case 'curls':
      return (
        <path
          d="M30 58 Q22 50 28 42 Q24 32 34 28 Q36 18 48 20 Q54 12 64 18 Q74 12 80 22 Q92 22 90 34 Q98 42 90 50 Q92 56 88 58 Q80 46 60 44 Q40 46 30 58 Z"
          {...common}
        />
      );
    case 'buzz':
      return (
        <path
          d="M32 50 Q32 27 60 26 Q88 27 88 50 Q78 38 60 37 Q42 38 32 50 Z"
          {...common}
          fillOpacity={0.85}
        />
      );
  }
}

function Top({ look }: { look: PegLook }) {
  const { style, color, accent } = look.top;
  const body = 'M22 124 L22 104 Q22 86 42 83 L78 83 Q98 86 98 104 L98 124 Z';
  const outline = { stroke: INK, strokeWidth: STROKE, strokeLinejoin: 'round' as const };
  const details: Record<TopStyle, ReactNode> = {
    tee: (
      <>
        <path d="M48 83 Q60 96 72 83" fill={accent} {...outline} />
        <path d="M24 108 L96 108" stroke={accent} strokeWidth={4} opacity={0.9} />
      </>
    ),
    hoodie: (
      <>
        <path d="M40 84 Q60 104 80 84 Q72 80 60 90 Q48 80 40 84 Z" fill={color} {...outline} />
        <path
          d="M54 92 L53 106 M66 92 L67 106"
          stroke={accent}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx="53" cy="107" r="2" fill={accent} />
        <circle cx="67" cy="107" r="2" fill={accent} />
        <path d="M44 124 L46 114 Q60 110 74 114 L76 124" fill="none" {...outline} />
      </>
    ),
    vest: (
      <>
        <path
          d="M42 83 L58 116 L58 124 L22 124 L22 104 Q22 86 42 83 Z"
          fill={accent}
          {...outline}
        />
        <path
          d="M78 83 L62 116 L62 124 L98 124 L98 104 Q98 86 78 83 Z"
          fill={accent}
          {...outline}
        />
        <circle cx="60" cy="104" r="1.8" fill={INK} />
        <circle cx="60" cy="114" r="1.8" fill={INK} />
      </>
    ),
    apron: (
      <>
        <path d="M44 84 L48 124 M76 84 L72 124" stroke={accent} strokeWidth={5} />
        <path d="M42 98 Q60 94 78 98 L80 124 L40 124 Z" fill={accent} {...outline} />
        <path d="M50 108 L70 108 L69 118 L51 118 Z" fill="none" {...outline} strokeWidth={2.2} />
      </>
    ),
  };
  return (
    <g>
      <path d={body} fill={color} {...outline} />
      {details[style]}
    </g>
  );
}

function Face({ expression }: { expression: PortraitExpression }) {
  const eyes =
    expression === 'happy' ? (
      <g fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round">
        <path d="M44 58 Q49 51 54 58" />
        <path d="M66 58 Q71 51 76 58" />
      </g>
    ) : (
      <g>
        {[49, 71].map((x) => (
          <g key={x}>
            <ellipse
              cx={x}
              cy="56"
              rx={expression === 'excited' ? 5 : 4.2}
              ry={expression === 'excited' ? 6.6 : 5.6}
              fill={INK}
            />
            <circle cx={x + 1.5} cy="53.5" r={expression === 'excited' ? 2 : 1.6} fill="white" />
            <circle cx={x - 1.4} cy="58.6" r="0.9" fill="white" />
          </g>
        ))}
      </g>
    );
  const mouth =
    expression === 'neutral' ? (
      <path
        d="M54 66 Q60 71 66 66"
        fill="none"
        stroke={INK}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    ) : (
      <g>
        <path
          d={expression === 'excited' ? 'M51 64 Q60 78 69 64 Z' : 'M53 65 Q60 74 67 65 Z'}
          fill={INK}
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <ellipse
          cx="60"
          cy={expression === 'excited' ? 71 : 69.5}
          rx="3.6"
          ry="2.2"
          fill="var(--color-coral)"
        />
      </g>
    );
  return (
    <g>
      <ellipse cx="41" cy="64" rx="5" ry="3" fill="var(--color-coral)" opacity={0.4} />
      <ellipse cx="79" cy="64" rx="5" ry="3" fill="var(--color-coral)" opacity={0.4} />
      {eyes}
      {mouth}
    </g>
  );
}

export function AvatarPortrait({
  spec,
  expression = 'neutral',
  title,
  className = '',
  crop = 'bust',
  svgProps,
}: AvatarPortraitProps) {
  const look = avatarLook(spec);
  const viewBox = crop === 'head' ? '18 8 84 84' : '0 0 120 120';
  return (
    <svg
      viewBox={viewBox}
      {...svgProps}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <Hair style={look.hair.style} color={look.hair.color} back />
      <Top look={look} />
      <rect
        x="52"
        y="72"
        width="16"
        height="14"
        rx="4"
        fill={look.skin}
        stroke={INK}
        strokeWidth={STROKE}
      />
      <ellipse cx="60" cy="54" rx="30" ry="28" fill={look.skin} stroke={INK} strokeWidth={STROKE} />
      {/* Vinyl-toy sheen on the head. */}
      <path
        d="M40 40 Q46 32 56 30"
        fill="none"
        stroke="white"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.35}
      />
      <Face expression={expression} />
      <Hair style={look.hair.style} color={look.hair.color} back={false} />
    </svg>
  );
}
