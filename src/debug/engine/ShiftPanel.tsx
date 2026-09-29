import { Moon, Store, Sunrise } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { defaultBalance } from '@/content/balance';
import { formatClock, weekdayIndex } from '@/core/calendar';
import { formatMoney } from '@/core/money';
import { weeklyRentDue } from '@/sim/selectors';
import { useGameStore } from '@/state/gameStore';
import { useCommand } from '@/state/useCommand';
import { Button, Panel, ProgressBar } from '@/ui/components';

// Debug page: exempt from i18n (CLAUDE.md).

const { openMinute, closeMinute } = defaultBalance.time;

function hoursLeft(minute: number): string {
  const left = Math.max(0, closeMinute - minute);
  return `${Math.floor(left / 60)}h ${String(left % 60).padStart(2, '0')}m left`;
}

/** The day-cycle clipboard: prep → open → night, with the phase's main action. */
export function ShiftPanel() {
  const run = useCommand();
  const shift = useGameStore(
    useShallow((store) => {
      const game = store.game;
      if (!game) return null;
      return {
        day: game.clock.day,
        minute: game.clock.minute,
        phase: game.clock.phase,
        rent: weeklyRentDue(game),
        rentToday: game.finance.today.rent,
        daysOpened: game.stats.daysOpened ?? 0,
      };
    }),
  );
  if (!shift) return null;

  const daysToSunday = 6 - weekdayIndex(shift.day);
  const rentLine =
    shift.rent <= 0
      ? 'No rent on this difficulty.'
      : `Rent ${formatMoney(shift.rent)} / week, charged Sunday night${
          daysToSunday === 0
            ? ' (tonight!)'
            : ` (in ${daysToSunday} day${daysToSunday === 1 ? '' : 's'})`
        }.`;

  return (
    <Panel theme="clipboard" title="Today's shift">
      {shift.phase === 'prep' ? (
        <div className="space-y-4">
          <p className="font-display text-2xl tracking-wide">Morning prep</p>
          <p className="text-ink/75">
            Take your time: the clock is paused until you flip the sign. Restocking, pricing and
            deliveries happen here once they exist (Phase 2).
          </p>
          <Button
            variant="gold"
            size="lg"
            icon={<Store />}
            onClick={() => run({ type: 'time/openShop' })}
          >
            Open shop
          </Button>
        </div>
      ) : null}

      {shift.phase === 'open' ? (
        <div className="space-y-4">
          <p className="font-display text-2xl tracking-wide">Open for business</p>
          <ProgressBar
            value={(shift.minute - openMinute) / (closeMinute - openMinute)}
            color="var(--color-teal)"
            label={`${formatClock(openMinute)} → ${formatClock(closeMinute)} · ${hoursLeft(shift.minute)}`}
          />
          <p className="text-ink/75">
            One open day lasts about six real minutes at ▶. Customers arrive in Phase 2; use the dev
            panel to skip ahead.
          </p>
          <Button
            variant="secondary"
            icon={<Moon />}
            onClick={() => run({ type: 'time/closeShop' })}
          >
            Close early
          </Button>
        </div>
      ) : null}

      {shift.phase === 'night' ? (
        <div className="space-y-4">
          <p className="font-display text-2xl tracking-wide">After hours</p>
          <p className="text-ink/75">
            The books are closed.
            {shift.rentToday > 0
              ? ` Rent of ${formatMoney(shift.rentToday)} was paid tonight.`
              : ''}
          </p>
          <Button size="lg" icon={<Sunrise />} onClick={() => run({ type: 'time/startNextDay' })}>
            Start next day
          </Button>
        </div>
      ) : null}

      <p className="mt-5 border-t-2 border-dashed border-ink/25 pt-3 font-hand text-xl leading-snug text-ink/80">
        {rentLine} Days opened so far: {shift.daysOpened}.
      </p>
    </Panel>
  );
}
