import { useTranslation } from 'react-i18next';
import type { StorageSummary } from '../model/stock';
import { BoxIcon } from './icons';

/**
 * The closet meter in storage units (docs/05 §5.4 "a storage capacity bar is always visible"):
 * stock in the closet, plus pending deliveries as a caution-taped segment, against capacity.
 */
export function StorageMeter({
  summary,
  extra = 0,
  tone = 'dark',
  className = '',
}: {
  summary: StorageSummary;
  /** A preview of more units (e.g. the Crate cart), drawn as a pale segment. */
  extra?: number;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const { t } = useTranslation('sheets');
  const cap = Math.max(1, summary.capacity);
  const pct = (units: number) => `${Math.min(100, Math.max(0, (units / cap) * 100))}%`;
  const total = summary.used + summary.incoming + extra;
  const over = total > summary.capacity;
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <BoxIcon size={22} />
      <div className="min-w-0 flex-1">
        <div
          className={`flex items-baseline justify-between gap-2 font-display text-xs tracking-wide ${
            tone === 'dark' ? 'text-paper' : 'text-ink'
          }`}
        >
          <span>{t('storage.label')}</span>
          <span className={`tabular-nums ${over ? 'text-coral' : ''}`}>
            {t('storage.meter', { used: total, capacity: summary.capacity })}
          </span>
        </div>
        <meter
          className="sr-only"
          min={0}
          max={summary.capacity}
          value={Math.min(total, summary.capacity)}
          aria-label={t('storage.aria', {
            used: summary.used,
            capacity: summary.capacity,
            incoming: summary.incoming,
          })}
        />
        <div
          aria-hidden="true"
          className="relative mt-0.5 h-4 overflow-hidden rounded-full border-[3px] border-ink bg-paper2"
        >
          <div
            className="absolute inset-y-0 left-0 bg-teal transition-[width] duration-500"
            style={{ width: pct(summary.used) }}
          />
          <div
            className="hatch-incoming absolute inset-y-0 border-l-2 border-ink/40 transition-[left,width] duration-500"
            style={{ left: pct(summary.used), width: pct(summary.incoming) }}
          />
          {extra > 0 ? (
            <div
              className={`absolute inset-y-0 border-l-2 border-ink/40 transition-[left,width] duration-300 ${
                over ? 'bg-coral' : 'bg-sky/70'
              }`}
              style={{ left: pct(summary.used + summary.incoming), width: pct(extra) }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
