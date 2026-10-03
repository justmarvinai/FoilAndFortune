import { type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '@/audio';
import { defaultBalance } from '@/content/balance';
import { type Cents, formatMoney } from '@/core/money';
import type { PriceReaction } from '@/sim/pricing';
import { meterPosition, parsePrice, reactionZones, stepPrice } from '../model/pricing';

/**
 * Price tags, the price editor and the customer-reaction preview (docs/05 §5.3, §5.5, docs/01
 * §9.2 "customer feedback teaches pricing").
 */

type TagSize = 'sm' | 'md' | 'lg';

const TAG_TEXT: Record<TagSize, string> = {
  sm: 'text-lg leading-none',
  md: 'text-2xl leading-none',
  lg: 'text-3xl leading-none',
};

const TAG_PAD: Record<TagSize, string> = {
  sm: 'min-w-14 py-0.5 pr-2 pl-4',
  md: 'min-w-20 py-1 pr-3 pl-5',
  lg: 'min-w-24 py-1.5 pr-3.5 pl-6',
};

/** A handwritten paper price tag on a string (docs/04 §8 "price tags, handwritten Caveat"). */
export function PriceTag({
  cents,
  size = 'md',
  tone = 'paper',
  swing,
  className = '',
}: {
  cents: Cents | null;
  size?: TagSize;
  tone?: 'paper' | 'sun';
  /** Changing this replays the swing animation. */
  swing?: string | number;
  className?: string;
}) {
  return (
    <span
      key={swing}
      className={`tag-swing relative inline-flex items-center justify-center font-hand font-bold text-ink tabular-nums ${TAG_PAD[size]} ${TAG_TEXT[size]} ${className}`}
    >
      <svg
        className="absolute inset-0 -z-0 size-full overflow-visible"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M14 1H97a2 2 0 0 1 2 2v34a2 2 0 0 1-2 2H14L1 20z"
          fill={tone === 'sun' ? 'var(--color-sun)' : 'var(--color-paper)'}
          stroke="var(--color-ink)"
          strokeWidth="2.6"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute top-1/2 left-[7px] size-[7px] -translate-y-1/2 rounded-full border-2 border-ink bg-woodDark"
        aria-hidden="true"
      />
      <span className="relative">{cents === null ? '–' : formatMoney(cents)}</span>
    </span>
  );
}

/**
 * Price editing: − / + on a price-gun grid, or click the tag to type. The sim validates
 * (`INVALID_PRICE` comes back as a toast); this only parses.
 */
export function PriceEditor({
  cents,
  onChange,
  label,
  size = 'md',
  tone = 'paper',
}: {
  cents: Cents;
  onChange(cents: Cents): void;
  /** Accessible name of the item being priced. */
  label: string;
  size?: 'sm' | 'md';
  tone?: 'paper' | 'sun';
}) {
  const { t } = useTranslation('sheets');
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState(0);
  const commit = (text: string) => {
    setDraft(null);
    const parsed = parsePrice(text);
    if (parsed === null) {
      setBad((value) => value + 1);
      playSfx('ui.error');
      return;
    }
    if (parsed !== cents) onChange(parsed);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      // Cancel typing without closing the sheet.
      event.stopPropagation();
      setDraft(null);
    }
  };
  const step = (dir: 1 | -1) => {
    playSfx('ui.coin', { rate: dir === 1 ? 1.1 : 0.9 });
    onChange(stepPrice(cents, dir));
  };
  const key = size === 'sm' ? 'size-10 pointer-coarse:size-11' : 'size-11';
  const stepClass = `grid ${key} shrink-0 place-items-center rounded-xl border-[3px] border-ink bg-white font-display text-xl text-ink shadow-[0_3px_0_var(--color-ink)] transition-transform duration-75 hover:-translate-y-px active:translate-y-[3px] active:shadow-none`;
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        className={stepClass}
        aria-label={t('price.lower', { name: label })}
        onClick={() => step(-1)}
      >
        −
      </button>
      {draft === null ? (
        <button
          type="button"
          className="rounded-lg"
          aria-label={t('price.edit', { name: label, price: formatMoney(cents) })}
          onClick={() => setDraft((cents / 100).toFixed(2))}
        >
          <PriceTag cents={cents} size={size === 'sm' ? 'sm' : 'md'} tone={tone} swing={cents} />
        </button>
      ) : (
        <input
          // biome-ignore lint/a11y/noAutofocus: typing starts where the player clicked the tag.
          autoFocus
          key={bad}
          inputMode="decimal"
          aria-label={t('price.type', { name: label })}
          className={`bonk w-24 rounded-lg border-[3px] border-ink bg-white px-2 py-1 text-center font-hand font-bold text-ink tabular-nums outline-none focus:border-teal ${
            size === 'sm' ? 'text-lg' : 'text-2xl'
          }`}
          value={draft}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
      )}
      <button
        type="button"
        className={stepClass}
        aria-label={t('price.raise', { name: label })}
        onClick={() => step(1)}
      >
        +
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

const FACE_FILL: Record<PriceReaction, string> = {
  steal: 'var(--color-mint)',
  fair: 'var(--color-sky)',
  pricey: 'var(--color-sun)',
  ripoff: 'var(--color-coral)',
};

/** A customer's face for a price reaction (steal · fair · pricey · rip-off). */
export function ReactionFace({ reaction, size = 40 }: { reaction: PriceReaction; size?: number }) {
  const ink = 'var(--color-ink)';
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <circle cx="20" cy="20" r="17" fill={FACE_FILL[reaction]} stroke={ink} strokeWidth="3" />
      {reaction === 'steal' ? (
        <>
          <path
            d="m13 11.5 1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4zm14 0 1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z"
            fill="white"
            stroke={ink}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M11.5 23.5q8.5 10 17 0z" fill={ink} />
          <path d="M15 27.5q5 3 10 0" fill="none" stroke="var(--color-coral)" strokeWidth="2.4" />
        </>
      ) : null}
      {reaction === 'fair' ? (
        <>
          <circle cx="14" cy="17" r="2.3" fill={ink} />
          <circle cx="26" cy="17" r="2.3" fill={ink} />
          <path
            d="M13.5 24q6.5 6 13 0"
            fill="none"
            stroke={ink}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {reaction === 'pricey' ? (
        <>
          <circle cx="14" cy="18" r="2.3" fill={ink} />
          <circle cx="26" cy="18" r="2.3" fill={ink} />
          <path
            d="M10.5 12.5 16 14M29.5 12.5 24 14"
            stroke={ink}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path d="M14.5 27h11" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
          <path
            d="M32 9q2.6 4 0 6q-2.6-2 0-6z"
            fill="var(--color-sky)"
            stroke={ink}
            strokeWidth="1.4"
          />
        </>
      ) : null}
      {reaction === 'ripoff' ? (
        <>
          <path
            d="M10.5 13 17 16M29.5 13 23 16"
            stroke={ink}
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <circle cx="14.5" cy="19" r="2.2" fill={ink} />
          <circle cx="25.5" cy="19" r="2.2" fill={ink} />
          <path
            d="M13.5 29q6.5-6 13 0"
            fill="none"
            stroke={ink}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </>
      ) : null}
    </svg>
  );
}

/** What a customer would think at this price, as a speech bubble (docs/02 §5.3). */
export function ReactionBubble({
  reaction,
  compact = false,
}: {
  reaction: PriceReaction;
  compact?: boolean;
}) {
  const { t } = useTranslation('sheets');
  return (
    <span className="inline-flex items-center gap-1.5" role="status">
      <ReactionFace reaction={reaction} size={compact ? 28 : 38} />
      <span
        className={`relative rounded-xl border-[3px] border-ink bg-white font-display tracking-wide whitespace-nowrap text-ink shadow-[0_2px_0_var(--color-ink)] ${
          compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
        }`}
      >
        <span
          className="absolute top-1/2 -left-[7px] size-3 -translate-y-1/2 rotate-45 border-b-[3px] border-l-[3px] border-ink bg-white"
          aria-hidden="true"
        />
        <span className="relative">{t(`reaction.${reaction}`)}</span>
      </span>
    </span>
  );
}

const ZONE_CLASS: Record<PriceReaction, string> = {
  steal: 'bg-mint',
  fair: 'bg-sky',
  pricey: 'bg-sun',
  ripoff: 'bg-coral',
};

/** Where a price sits between steal and rip-off, with a pin at your price (docs/05 §1.5 "why"). */
export function ReactionMeter({
  priceCents,
  marketCents,
  className = '',
}: {
  priceCents: Cents;
  marketCents: Cents;
  className?: string;
}) {
  const { t } = useTranslation('sheets');
  const zones = reactionZones(defaultBalance.customers.reaction);
  const first = zones[0]?.from ?? 0;
  const last = zones[zones.length - 1]?.to ?? 1;
  const span = last - first;
  const pin = meterPosition(priceCents, marketCents, zones);
  const market = (1 - first) / span;
  const ratio = marketCents > 0 ? Math.round((priceCents / marketCents) * 100) : 0;
  return (
    <div className={`w-full ${className}`}>
      <div className="relative pt-4">
        <div
          className="absolute top-0 -translate-x-1/2 transition-[left] duration-300"
          style={{ left: `${pin * 100}%` }}
          aria-hidden="true"
        >
          <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
            <path d="M2 2h12L8 12z" fill="var(--color-ink)" stroke="white" strokeWidth="1.5" />
          </svg>
        </div>
        <div
          className="flex h-3.5 overflow-hidden rounded-full border-[3px] border-ink"
          role="img"
          aria-label={t('price.meterAria', { pct: ratio })}
        >
          {zones.map((zone) => (
            <div
              key={zone.reaction}
              className={ZONE_CLASS[zone.reaction]}
              style={{ width: `${((zone.to - zone.from) / span) * 100}%` }}
            />
          ))}
        </div>
        <div
          className="absolute top-3 bottom-[-4px] w-0.5 bg-ink/70"
          style={{ left: `${market * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-1 flex text-[11px] font-bold tracking-wide text-ink/70 uppercase">
        {zones.map((zone) => (
          <span
            key={zone.reaction}
            className="truncate text-center"
            style={{ width: `${((zone.to - zone.from) / span) * 100}%` }}
          >
            {t(`zone.${zone.reaction}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
