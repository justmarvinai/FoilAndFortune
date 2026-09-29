import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { dayToDate, formatClock } from '@/core/calendar';
import { formatMoney } from '@/core/money';
import { reputationScore, reputationStars, xpProgress } from '@/sim/selectors';
import { useGameStore } from '@/state/gameStore';
import { useCommand } from '@/state/useCommand';
import { MoneyCounter, ProgressBar, SpeedControl, StarRating } from '@/ui/components';

// Debug page: exempt from i18n (CLAUDE.md), but the HUD uses the real keys to exercise them.

const chip = 'rounded-xl border-[3px] border-ink shadow-[0_3px_0_var(--color-ink)]';

/** Prototype of the in-game HUD strip: calendar, sign, register, reputation, level, speed. */
export function SandboxHud() {
  const { t } = useTranslation();
  const run = useCommand();
  const hud = useGameStore(
    useShallow((store) => {
      const game = store.game;
      if (!game) return null;
      const xp = xpProgress(game);
      return {
        day: game.clock.day,
        minute: game.clock.minute,
        phase: game.clock.phase,
        speed: game.clock.speed,
        cash: game.finance.cashCents,
        loan: game.finance.loan.principalCents,
        stars: reputationStars(reputationScore(game)),
        level: xp.level,
        xp: xp.xp,
        needed: xp.needed,
        ratio: xp.ratio,
      };
    }),
  );
  if (!hud) return null;

  const date = dayToDate(hud.day);
  const open = hud.phase === 'open';
  return (
    <div className="border-b-[3px] border-ink bg-wood px-4 py-3 shadow-[inset_0_-6px_0_var(--color-woodDark)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <div className={`${chip} bg-paper px-3 py-1`}>
          <p className="font-display text-sm tracking-wide text-ink/70">
            {t('date', {
              weekday: t(`weekday.${date.weekday}`),
              season: t(`season.${date.season}`),
              day: date.dayOfSeason,
              year: date.year,
            })}
          </p>
          <p className="font-display text-2xl leading-tight tabular-nums">
            {formatClock(hud.minute)}{' '}
            <span className="text-sm tracking-wide text-ink/60">{t(`phase.${hud.phase}`)}</span>
          </p>
        </div>

        <div
          className={`${chip} -rotate-3 px-3 py-1 font-display text-lg tracking-[0.2em] text-white [text-shadow:0_2px_0_rgb(30_35_64/0.45)] ${
            open ? 'bg-mint' : 'bg-coral'
          }`}
        >
          {open ? t('sign.open') : t('sign.closed')}
        </div>

        <div className={`${chip} bg-night px-3 py-1 text-mint`}>
          <MoneyCounter cents={hud.cash} className="text-2xl" />
          {hud.loan > 0 ? (
            <p className="text-xs font-semibold text-coral">loan {formatMoney(hud.loan)}</p>
          ) : null}
        </div>

        <div className={`${chip} flex items-center gap-3 bg-paper px-3 py-1.5`}>
          <StarRating value={hud.stars} size={20} label={t('reputation')} />
          <div className="w-28 xl:w-40">
            <p className="font-display text-sm leading-tight">{t('level', { level: hud.level })}</p>
            <ProgressBar
              className="h-5"
              value={hud.ratio}
              label={t('xp', { xp: hud.xp, needed: hud.needed })}
            />
          </div>
        </div>

        <div className="ml-auto">
          <SpeedControl
            value={hud.speed}
            onChange={(speed) => run({ type: 'time/setSpeed', speed })}
          />
        </div>
      </div>
    </div>
  );
}
