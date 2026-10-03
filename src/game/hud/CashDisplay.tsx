import { Check, Coins } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { formatMoney } from '@/core/money';
import { reputationScore, reputationStars } from '@/sim/selectors';
import { useGame, useGameStore } from '@/state/gameStore';
import { MoneyCounter } from '@/ui/components/MoneyCounter';
import { StarRating } from '@/ui/components/StarRating';
import { useShellStore } from '../session/shellStore';
import { HudTip } from './HudTip';

/** `+$4.49 sale` chips dropping out of the register display (docs/05 §6 "`+$` float"). */
function CashFloats() {
  const { t } = useTranslation('shell');
  const floats = useShellStore((store) => store.floats);
  return (
    <div
      className="pointer-events-none absolute top-full right-2 flex flex-col items-end gap-1 pt-2"
      aria-hidden="true"
    >
      <AnimatePresence>
        {floats.map((float) => (
          <motion.span
            key={float.id}
            initial={{ opacity: 0, y: -14, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            className={`whitespace-nowrap rounded-full border-2 border-ink px-2 py-0.5 font-display text-sm tabular-nums shadow-[0_2px_0_var(--color-ink)] ${
              float.cents >= 0 ? 'bg-mint text-ink' : 'bg-coral text-white'
            }`}
          >
            {formatMoney(float.cents, { signed: true })}{' '}
            <span className="font-ui text-[11px] font-extrabold opacity-80">
              {t(`hud.float.${float.reason}`)}
            </span>
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Top-right of the HUD (docs/05 §3.1): the register's cash display with rolling digits that
 * pulses on every change, and the tip that breaks today's money down.
 */
export function CashDisplay() {
  const { t } = useTranslation('shell');
  const cash = useGame((game) => game.finance.cashCents, 0);
  const money = useGameStore(
    useShallow((store) => ({
      revenue: store.game?.finance.today.revenue ?? 0,
      purchases: store.game?.finance.today.purchases ?? 0,
      loan: store.game?.finance.loan.principalCents ?? 0,
    })),
  );
  // Restart the pulse on every change (not on mount).
  const [pulse, setPulse] = useState(0);
  const first = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `cash` is the trigger; the body only counts changes.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPulse((count) => count + 1);
  }, [cash]);

  return (
    <HudTip
      align="end"
      content={
        <>
          <span className="block font-display tracking-wide">{t('hud.cashTip')}</span>
          <span className="block tabular-nums">
            {t('hud.cashToday', { revenue: formatMoney(money.revenue) })}
          </span>
          {money.purchases > 0 ? (
            <span className="block tabular-nums">
              {t('hud.cashSpent', { amount: formatMoney(money.purchases) })}
            </span>
          ) : null}
          {money.loan > 0 ? (
            <span className="block tabular-nums text-coral">
              {t('hud.loan', { amount: formatMoney(money.loan) })}
            </span>
          ) : null}
        </>
      }
    >
      <div
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users reach the money breakdown.
        tabIndex={0}
        className="cash-lcd relative flex items-center gap-2 rounded-2xl border-[3px] border-ink bg-night py-1.5 pr-3 pl-2 text-mint shadow-[0_4px_0_var(--color-ink)] [@media(max-height:540px)]:py-1"
      >
        {pulse > 0 ? (
          <span
            key={pulse}
            className="cash-pulse pointer-events-none absolute -inset-[3px] rounded-2xl"
            aria-hidden="true"
          />
        ) : null}
        <span
          className="grid size-8 place-items-center rounded-full border-[3px] border-ink bg-sun text-ink [@media(max-height:540px)]:size-6"
          aria-hidden="true"
        >
          <Coins className="size-4 [@media(max-height:540px)]:size-3.5" />
        </span>
        <span className="sr-only">{t('hud.cashTip')}</span>
        <MoneyCounter
          cents={cash}
          className="text-2xl leading-none tracking-wide text-mint [@media(max-height:540px)]:text-lg"
        />
      </div>
      <CashFloats />
    </HudTip>
  );
}

/** Reputation stars; the tip gives the score and how it grows (docs/05 §1.5). */
export function ReputationChip() {
  const { t } = useTranslation('shell');
  const tc = useTranslation().t;
  const score = useGame((game) => Math.round(reputationScore(game) * 10) / 10, 0);
  const stars = reputationStars(score);
  return (
    <HudTip
      align="end"
      content={
        <>
          <span className="block font-display tracking-wide tabular-nums">
            {t('hud.repTip', { score: score.toFixed(1) })}
          </span>
          <span className="block">{t('hud.repWhy')}</span>
        </>
      }
    >
      <div
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users reach the reputation explanation.
        tabIndex={0}
        className="flex items-center rounded-full border-[3px] border-ink bg-paper px-2 py-0.5 shadow-[0_3px_0_var(--color-ink)]"
      >
        <StarRating value={stars} size={18} label={`${tc('reputation')}: ${stars} / 5`} />
      </div>
    </HudTip>
  );
}

/** A small "Saved ✓" flash after each autosave (feedback for an invisible action). */
export function SavedFlash() {
  const { t } = useTranslation('shell');
  const savedAt = useShellStore((store) => store.savedAt);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (savedAt === 0) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, [savedAt]);
  return (
    <AnimatePresence>
      {visible ? (
        <motion.span
          role="status"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="flex items-center gap-1 rounded-full border-2 border-ink bg-mintLight px-2 py-0.5 text-xs font-extrabold text-ink"
        >
          <Check className="size-3.5" aria-hidden="true" />
          {t('hud.saved')}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
