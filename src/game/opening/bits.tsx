import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardBack } from '@/cards/CardBack';
import type { Rarity } from '@/content/schema/common';
import { type Cents, formatMoney } from '@/core/money';
import { RarityGem } from '@/ui/components/RarityGem';
import { Sticker } from '@/ui/components/Sticker';
import { type RevealCard, tierRank } from './model';

/** Small presentational pieces shared by the stage's views. */

const RARITY_VAR: Record<Rarity, string> = {
  common: 'var(--color-rarity-common)',
  uncommon: 'var(--color-rarity-uncommon)',
  rare: 'var(--color-rarity-rare)',
  holoRare: 'var(--color-rarity-holo)',
  ultraRare: 'var(--color-rarity-ultra)',
  illustrationRare: 'var(--color-rarity-illustration)',
  secretRare: 'var(--color-rarity-secret)',
  mythicRare: 'var(--color-rarity-mythic)',
  // Promos print in ink; on the night stage they glow gold instead.
  promo: 'var(--color-sun)',
};

/** `--rc`: the card's rarity color (docs/04 §2.2), for glows, beams and ribbons. */
export function rarityStyle(rarity: Rarity, extra: Record<string, string | number> = {}) {
  return { '--rc': RARITY_VAR[rarity], ...extra } as CSSProperties;
}

/** Big hits get a running foil rim on top of the edge glow. */
export function hasRim(card: Pick<RevealCard, 'tier'>): boolean {
  return tierRank(card.tier) >= tierRank('ultra');
}

export function NewSticker({ className = '' }: { className?: string }) {
  const { t } = useTranslation('opening');
  return (
    <span className={className}>
      <Sticker color="var(--color-coral)" rotate={-10}>
        {t('new')}
      </Sticker>
    </span>
  );
}

export function RarityLabel({ rarity, size = 18 }: { rarity: Rarity; size?: number }) {
  const { t } = useTranslation('cards');
  const label = t(`rarity.${rarity}`);
  return (
    <>
      <RarityGem rarity={rarity} size={size} title={label} />
      <span>{label}</span>
    </>
  );
}

/** A face-down card on the stack; the top one glows in its rarity color when it's special. */
export function FaceDown({
  card,
  depth,
  glow,
}: {
  card: RevealCard;
  depth: number;
  glow: boolean;
}) {
  return (
    <div
      className="ffo-back"
      data-glow={glow}
      data-rim={glow && hasRim(card)}
      data-tier={glow ? card.tier : undefined}
      style={rarityStyle(card.rarity, { '--k': depth, zIndex: 10 - depth })}
    >
      <CardBack width="100%" />
    </div>
  );
}

/** Cards-left pips (docs/05 §5.7); a number past 15 cards. */
export function Pips({
  total,
  left,
  hintRarity,
}: {
  total: number;
  left: number;
  /** The rare slot's pip takes the rarity hint color while it's still face-down. */
  hintRarity: Rarity | null;
}) {
  const { t } = useTranslation('opening');
  const label = t('cardsLeft', { count: left });
  if (total > 15) {
    return (
      <div className="ffo-pips" role="img" aria-label={label}>
        <span className="ffo-pips__count">{t('leftCount', { count: left })}</span>
      </div>
    );
  }
  return (
    <div
      className="ffo-pips"
      role="img"
      aria-label={label}
      style={hintRarity ? rarityStyle(hintRarity) : undefined}
    >
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length row of identical pips
        <i key={i} data-on={i < left} data-hint={hintRarity !== null && i === left - 1} />
      ))}
    </div>
  );
}

/** "Value so far": rolls to its new amount by writing the DOM directly (no per-frame renders). */
export function ValueTicker({ cents, reduced }: { cents: Cents; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(cents);
  // React renders the first amount only; afterwards the effect owns the text.
  const [initial] = useState(cents);

  useEffect(() => {
    const element = ref.current;
    const from = shown.current;
    if (!element || from === cents) return;
    if (reduced) {
      shown.current = cents;
      element.textContent = formatMoney(cents);
      return;
    }
    const start = performance.now();
    const duration = 520;
    let frame = 0;
    let text = element.textContent;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const value = Math.round(from + (cents - from) * (1 - (1 - t) ** 3));
      shown.current = value;
      // Only touch the DOM when the digits change (Quick Rip updates it many times a second).
      const next = formatMoney(value);
      if (next !== text) {
        text = next;
        element.textContent = next;
      }
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    if (element.getAnimations().length === 0) {
      element.animate([{ scale: 1.18 }, { scale: 1 }], { duration: 320, easing: 'ease-out' });
    }
    return () => cancelAnimationFrame(frame);
  }, [cents, reduced]);

  return (
    <span ref={ref} className="ffo-value__amount">
      {formatMoney(initial)}
    </span>
  );
}
