import { useTranslation } from 'react-i18next';
import type { GameSpeed } from '@/content/balance/time';
import { SegmentedControl } from './SegmentedControl';

type SpeedKey = '0' | '1' | '2' | '4';
const SPEED_OF: Record<SpeedKey, GameSpeed> = { '0': 0, '1': 1, '2': 2, '4': 4 };
const KEY_OF: Record<GameSpeed, SpeedKey> = { 0: '0', 1: '1', 2: '2', 4: '4' };

/** Pause bars or 1–3 play arrows, drawn so they don't depend on font glyph coverage. */
function SpeedGlyph({ arrows }: { arrows: 0 | 1 | 2 | 3 }) {
  if (arrows === 0) {
    return (
      <svg viewBox="0 0 16 16" className="size-[1.05em]" aria-hidden="true">
        <rect x="3" y="2.5" width="3.6" height="11" rx="1.2" fill="currentColor" />
        <rect x="9.4" y="2.5" width="3.6" height="11" rx="1.2" fill="currentColor" />
      </svg>
    );
  }
  const width = arrows * 8 + 2;
  return (
    <svg
      viewBox={`0 0 ${width} 16`}
      style={{ height: '1.05em', width: `${(width / 16) * 1.05}em` }}
      aria-hidden="true"
    >
      {Array.from({ length: arrows }, (_, i) => (
        <path
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed, stateless glyph parts.
          key={i}
          d={`M${1.5 + i * 8} 3 L${9 + i * 8} 8 L${1.5 + i * 8} 13 Z`}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export interface SpeedControlProps {
  value: GameSpeed;
  onChange(speed: GameSpeed): void;
  size?: 'sm' | 'md';
}

/** Pause / 1× / 2× / 4× keys for the HUD (docs/05 §3). */
export function SpeedControl({ value, onChange, size = 'sm' }: SpeedControlProps) {
  const { t } = useTranslation();
  return (
    <SegmentedControl<SpeedKey>
      label={t('speed.label')}
      size={size}
      value={KEY_OF[value]}
      onChange={(key) => onChange(SPEED_OF[key])}
      options={[
        { value: '0', label: <SpeedGlyph arrows={0} />, ariaLabel: t('speed.pause') },
        { value: '1', label: <SpeedGlyph arrows={1} />, ariaLabel: t('speed.normal') },
        { value: '2', label: <SpeedGlyph arrows={2} />, ariaLabel: t('speed.fast') },
        { value: '4', label: <SpeedGlyph arrows={3} />, ariaLabel: t('speed.fastest') },
      ]}
    />
  );
}
