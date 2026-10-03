import { ChevronsRight, Moon, Pause, Sun, Sunrise } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '@/audio';
import { dayToDate } from '@/core/calendar';
import { runCommand } from '@/game/actions';
import { useGame, useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { simClock } from '@/state/simClock';
import { isInteractionPaused, useUiStore } from '@/state/uiStore';
import { SpeedControl } from '@/ui/components/SpeedControl';
import { HudTip } from './HudTip';
import { clockText, dayProgress, skyTime } from './hudTime';

/** Current game minute for display: the sim clock's smooth time when it belongs to this day. */
function displayMinute(): number {
  const clock = useGameStore.getState().game?.clock;
  if (!clock) return 0;
  const sameTick = simClock.day === clock.day && Math.floor(simClock.minute) === clock.minute;
  return sameTick ? simClock.minute + simClock.fraction : clock.minute;
}

/**
 * The time readout. It ticks every game-minute, so it writes straight to the DOM from a
 * requestAnimationFrame loop instead of re-rendering React (CLAUDE.md rule 7).
 */
/** Point on the little sky arc (a quadratic curve) for opening-hours progress `t`. */
function arcPoint(t: number): [number, number] {
  const u = 1 - t;
  return [u * u * 4 + 2 * u * t * 30 + t * t * 56, u * u * 22 + 2 * u * t * -6 + t * t * 22];
}

function LiveClock({ className }: { className: string }) {
  const timeRef = useRef<HTMLSpanElement>(null);
  const sunRef = useRef<SVGCircleElement>(null);
  useEffect(() => {
    let frame = 0;
    let shown = '';
    const loop = () => {
      const minute = displayMinute();
      const text = clockText(minute);
      if (text !== shown && timeRef.current) {
        shown = text;
        timeRef.current.textContent = text;
      }
      const [x, y] = arcPoint(dayProgress(minute));
      sunRef.current?.setAttribute('cx', x.toFixed(2));
      sunRef.current?.setAttribute('cy', y.toFixed(2));
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <span className={className}>
      <svg
        aria-hidden="true"
        viewBox="0 -6 60 34"
        className="-mb-0.5 h-[18px] w-[60px] overflow-visible [@media(max-height:540px)]:hidden"
      >
        <path
          d="M4 22 Q30 -6 56 22"
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="2"
          strokeDasharray="2 4"
          opacity="0.35"
        />
        <circle
          ref={sunRef}
          cx="4"
          cy="22"
          r="5"
          fill="var(--color-sun)"
          stroke="var(--color-ink)"
          strokeWidth="2"
        />
      </svg>
      <span
        ref={timeRef}
        role="timer"
        className="font-display text-2xl leading-none tabular-nums tracking-wide [@media(max-height:540px)]:text-lg"
      >
        {clockText(displayMinute())}
      </span>
    </span>
  );
}

function NextDayKey() {
  const { t } = useTranslation('shell');
  return (
    <button
      type="button"
      aria-label={t('hud.nextDayAria')}
      onClick={() => {
        playSfx('ui.pop');
        runCommand({ type: 'time/startNextDay' });
      }}
      className="flex h-11 items-center gap-1.5 rounded-xl border-[3px] border-ink bg-sun px-3 font-display text-base tracking-wide text-ink shadow-[inset_0_-4px_0_rgb(0_0_0/0.12),0_4px_0_var(--color-ink)] transition-[translate,box-shadow] duration-75 hover:-translate-y-px active:translate-y-[4px] active:shadow-none [@media(max-height:540px)]:h-9 [@media(max-height:540px)]:px-2 [@media(max-height:540px)]:text-sm"
    >
      <Sunrise className="size-5" aria-hidden="true" />
      {t('hud.nextDay')}
      <ChevronsRight className="size-4" aria-hidden="true" />
    </button>
  );
}

/**
 * Top-center of the HUD (docs/05 §3.1): a tear-off calendar page, the clock with a little sun
 * travelling over opening hours, and the speed keys (or "Next Day" at night).
 */
export function ClockPanel() {
  const { t } = useTranslation('shell');
  const tc = useTranslation().t;
  const day = useGame((game) => game.clock.day, 1);
  const phase = useGame((game) => game.clock.phase, 'prep');
  const speed = useGame((game) => game.clock.speed, 1);
  const pauseSetting = useSettingsStore((store) => store.settings.pauseOnInteraction);
  const interactionPaused = useUiStore((ui) => isInteractionPaused(ui, pauseSetting));
  // Selecting the derived sky (not the minute) re-renders only when it changes.
  const sky = useGame((game) => skyTime(game.clock.phase, game.clock.minute), 'dawn');
  const date = dayToDate(day);
  const SkyIcon = sky === 'night' ? Moon : sky === 'dawn' ? Sunrise : Sun;
  const paused = phase === 'open' && (speed === 0 || interactionPaused);
  const hint =
    phase === 'prep'
      ? t('hud.clockPrep')
      : phase === 'open'
        ? t('hud.clockOpen')
        : t('hud.clockNight');

  return (
    <div className="flex items-stretch gap-2 [@media(max-height:540px)]:gap-1.5">
      <HudTip
        content={
          <>
            <span className="block font-display tracking-wide">
              {tc('date', {
                weekday: tc(`weekday.${date.weekday}`),
                season: tc(`season.${date.season}`),
                day: date.dayOfSeason,
                year: date.year,
              })}
            </span>
            <span className="block">{hint}</span>
          </>
        }
      >
        <div
          // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users reach the day and phase explanation.
          tabIndex={0}
          className="flex h-full items-stretch overflow-hidden rounded-2xl border-[3px] border-ink bg-paper shadow-[0_4px_0_var(--color-ink)]"
        >
          <span
            key={day}
            className="calendar-flip flex w-14 flex-col items-center justify-center border-r-[3px] border-ink bg-white [@media(max-height:540px)]:w-11"
          >
            <span className="w-full bg-coral py-0.5 text-center font-display text-[11px] leading-none tracking-widest text-white uppercase">
              {tc(`weekday.${date.weekday}`)}
            </span>
            <span className="font-display text-2xl leading-none [@media(max-height:540px)]:text-lg">
              {date.dayOfSeason}
            </span>
            <span className="pb-0.5 text-[10px] font-extrabold tracking-wide text-ink/60 uppercase leading-none [@media(max-height:540px)]:hidden">
              {tc(`season.${date.season}`)}
            </span>
          </span>
          <span className="relative flex min-w-[104px] items-center gap-2 px-3 [@media(max-height:540px)]:min-w-0 [@media(max-height:540px)]:px-2">
            <SkyIcon
              className={`size-5 shrink-0 ${sky === 'night' ? 'text-grape' : 'text-sun'} [filter:drop-shadow(0_1px_0_var(--color-ink))]`}
              aria-hidden="true"
            />
            <LiveClock className="flex flex-col items-center" />
          </span>
        </div>
        {paused ? (
          <span className="pointer-events-none absolute top-[calc(100%-6px)] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border-2 border-ink bg-sun px-2 py-px text-[11px] font-extrabold text-ink shadow-[0_2px_0_var(--color-ink)]">
            <Pause className="size-3" aria-hidden="true" />
            {interactionPaused ? t('hud.pausedInteraction') : t('hud.pausedManual')}
          </span>
        ) : null}
      </HudTip>
      <div className="flex items-center">
        {phase === 'night' ? (
          <NextDayKey />
        ) : (
          <SpeedControl
            value={speed}
            onChange={(next) => {
              playSfx('ui.tab');
              runCommand({ type: 'time/setSpeed', speed: next });
            }}
          />
        )}
      </div>
    </div>
  );
}
