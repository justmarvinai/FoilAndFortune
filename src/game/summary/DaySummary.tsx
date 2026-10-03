import { ChevronsRight, House, Package, Sparkles, Sunrise, Truck, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '@/audio';
import { getRegistry } from '@/content/registry';
import { formatMoney } from '@/core/money';
import { runCommand } from '@/game/actions';
import { useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { RarityGem } from '@/ui/components/RarityGem';
import { Stamp } from '@/ui/components/Stamp';
import { StarRating } from '@/ui/components/StarRating';
import { clockText } from '../hud/hudTime';
import { useReducedMotion } from '../session/useApplySettings';
import { RollingNumber } from './RollingNumber';
import { buildDaySummary, type DaySummary as Summary, type TomorrowItem } from './summaryModel';
import './summary.css';

// Stable formatters: RollingNumber restarts when its `format` changes.
const whole = (value: number) => String(Math.round(value));
const money = (value: number) => formatMoney(Math.round(value));
const cost = (value: number) => formatMoney(-Math.round(value));
const signedMoney = (value: number) => formatMoney(Math.round(value), { signed: true });
const signedXp = (value: number) => `+${Math.round(value)}`;

/** Milliseconds between printed lines (the thermal printer's rhythm). */
const LINE_MS = 170;

function Row({
  label,
  children,
  strong = false,
}: {
  label: ReactNode;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${strong ? 'text-[26px] leading-tight' : 'text-lg leading-snug'}`}
    >
      <span className={strong ? 'font-display tracking-wider' : 'uppercase tracking-wide'}>
        {label}
      </span>
      <span className={`text-right font-semibold ${strong ? 'font-display' : ''}`}>{children}</span>
    </div>
  );
}

const TEASER_ICON: Record<TomorrowItem['kind'], ReactNode> = {
  delivery: <Truck className="size-4" />,
  busy: <Users className="size-4" />,
  rent: <House className="size-4" />,
  emptySlots: <Package className="size-4" />,
  fresh: <Sunrise className="size-4" />,
};

function useTeaserText() {
  const { t } = useTranslation('shell');
  const tc = useTranslation().t;
  return (item: TomorrowItem): string => {
    switch (item.kind) {
      case 'delivery':
        return t('summary.teaser.delivery', { count: item.orders, units: item.units });
      case 'busy':
        return t('summary.teaser.busy', { weekday: tc(`weekday.${item.weekday}`), pct: item.pct });
      case 'rent':
        return t('summary.teaser.rent', { amount: formatMoney(item.cents) });
      case 'emptySlots':
        return t('summary.teaser.emptySlots', { count: item.count });
      case 'fresh':
        return t('summary.teaser.fresh');
    }
  };
}

/** Every line of the receipt, in print order (docs/05 §5.17). */
function useReceiptLines(summary: Summary, instant: boolean): { key: string; node: ReactNode }[] {
  const { t } = useTranslation('shell');
  const tc = useTranslation('cards').t;
  const tcommon = useTranslation().t;
  const teaser = useTeaserText();
  const rule = (key: string, double = false) => ({
    key,
    node: (
      <hr
        className={double ? 'receipt-rule--double my-1 border-0' : 'receipt-rule my-1 border-0'}
      />
    ),
  });
  const lines: { key: string; node: ReactNode }[] = [
    {
      key: 'served',
      node: (
        <Row label={t('summary.served')}>
          <RollingNumber value={summary.served} format={whole} instant={instant} />
        </Row>
      ),
    },
  ];
  if (summary.lost > 0) {
    lines.push({
      key: 'lost',
      node: (
        <Row label={t('summary.lost')}>
          <RollingNumber value={summary.lost} format={whole} instant={instant} />
        </Row>
      ),
    });
  }
  lines.push(rule('rule-1'));
  lines.push({
    key: 'revenue',
    node: (
      <Row label={t('summary.revenue')}>
        <RollingNumber value={summary.revenue} format={money} instant={instant} />
      </Row>
    ),
  });
  // Cost of goods always prints; the other costs only when they happened.
  const costs: { key: string; label: string; cents: number; always?: boolean }[] = [
    { key: 'cogs', label: t('summary.cogs'), cents: summary.cogs, always: true },
    { key: 'opened', label: t('summary.opened'), cents: summary.opened },
    { key: 'rent', label: t('summary.rent'), cents: summary.rent },
    { key: 'wages', label: t('summary.wages'), cents: summary.wages },
    { key: 'other', label: t('summary.other'), cents: summary.other },
  ];
  for (const { key, label, cents, always } of costs) {
    if (cents <= 0 && !always) continue;
    lines.push({
      key,
      node: (
        <Row label={label}>
          <span className="text-coral">
            <RollingNumber value={cents} format={cost} instant={instant} />
          </span>
        </Row>
      ),
    });
  }
  lines.push(rule('rule-2', true));
  lines.push({
    key: 'profit',
    node: (
      <Row label={t('summary.profit')} strong>
        <span className={summary.profit >= 0 ? 'text-teal' : 'text-coral'}>
          <RollingNumber
            value={summary.profit}
            format={signedMoney}
            instant={instant}
            durationMs={900}
          />
        </span>
      </Row>
    ),
  });
  if (summary.purchases > 0) {
    lines.push({
      key: 'purchases',
      node: (
        <p className="text-right text-sm text-ink/60 italic">
          {t('summary.purchasesNote', { amount: formatMoney(summary.purchases) })}
        </p>
      ),
    });
  }
  lines.push(rule('rule-3'));
  const delta = summary.reputation.delta;
  lines.push({
    key: 'rep',
    node: (
      <Row label={t('summary.reputation')}>
        <span className="inline-flex items-center gap-2">
          <StarRating
            value={summary.reputation.stars}
            size={18}
            label={`${summary.reputation.stars} / 5`}
          />
          <span className={delta > 0 ? 'text-teal' : delta < 0 ? 'text-coral' : 'text-ink/50'}>
            ({delta > 0 ? '+' : ''}
            {delta.toFixed(1)})
          </span>
        </span>
      </Row>
    ),
  });
  lines.push({
    key: 'xp',
    node: (
      <div className="flex items-center gap-3 text-lg">
        <span className="uppercase tracking-wide">{t('summary.xp')}</span>
        <span className="font-semibold text-grape">
          <RollingNumber value={summary.xp.gained} format={signedXp} instant={instant} />
        </span>
        <ProgressBar
          className="h-5 flex-1"
          value={summary.xp.ratio}
          label={t('summary.level', { level: summary.xp.level })}
        />
      </div>
    ),
  });
  if (summary.bestPull) {
    const pull = summary.bestPull;
    const finish = t(`summary.finish.${pull.finish}`);
    lines.push(rule('rule-4'));
    lines.push({
      key: 'pull',
      node: (
        <Row
          label={
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-4 text-grape" aria-hidden="true" />
              {t('summary.bestPull')}
            </span>
          }
        >
          <span className="inline-flex items-center gap-1.5">
            {pull.rarity ? (
              <RarityGem rarity={pull.rarity} size={16} title={tc(`rarity.${pull.rarity}`)} />
            ) : null}
            <span>
              {pull.name}
              {finish ? ` · ${finish}` : ''}
            </span>
            <span className="text-ink/60">{formatMoney(pull.valueCents)}</span>
          </span>
        </Row>
      ),
    });
  }
  lines.push(rule('rule-5'));
  lines.push({
    key: 'tomorrow',
    node: (
      <div>
        <p className="font-display text-lg tracking-wider">
          {t('summary.tomorrow', { weekday: tcommon(`weekday.${summary.tomorrow.weekday}`) })}
        </p>
        <ul className="mt-1 space-y-1">
          {summary.tomorrow.items.map((item) => (
            <li key={item.kind} className="flex items-center gap-2 text-base leading-tight">
              <span
                className="grid size-6 shrink-0 place-items-center rounded-md border-2 border-ink bg-sunLight"
                aria-hidden="true"
              >
                {TEASER_ICON[item.kind]}
              </span>
              {teaser(item)}
            </li>
          ))}
        </ul>
      </div>
    ),
  });
  lines.push(rule('rule-6'));
  lines.push({
    key: 'thanks',
    node: (
      <div className="flex flex-col items-center gap-2 pt-1">
        <p className="font-hand text-2xl leading-none font-bold">{t('summary.thanks')}</p>
        <span className="receipt-barcode block h-9 w-48" aria-hidden="true" />
      </div>
    ),
  });
  return lines;
}

function Receipt({ summary, onPrinted }: { summary: Summary; onPrinted(): void }) {
  const { t } = useTranslation('shell');
  const tc = useTranslation().t;
  const reduced = useReducedMotion();
  const lines = useReceiptLines(summary, reduced);
  const [printed, setPrinted] = useState(reduced ? lines.length : 0);
  const done = printed >= lines.length;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (done) return;
    const timer = window.setTimeout(
      () => {
        setPrinted((count) => count + 1);
        playSfx('ui.receipt', { rate: 0.95 + (printed % 3) * 0.05 });
      },
      printed === 0 ? 420 : LINE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [printed, done]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `printed` is the trigger to follow the printer.
  useEffect(() => {
    if (done) {
      onPrinted();
      return;
    }
    // Long receipts on short screens follow the printer.
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [printed, done, onPrinted]);

  const date = summary.date;
  return (
    <div className="relative flex min-h-0 w-[min(400px,calc(100vw-2rem))] flex-col">
      {/* The printer the paper comes out of. */}
      <div className="relative z-10 mx-[-14px] h-7 rounded-xl border-[3px] border-ink bg-tablet shadow-[0_4px_0_var(--color-ink)]">
        <span className="absolute inset-x-6 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-night" />
        <span className="absolute top-1.5 right-3 size-2 rounded-full bg-mint shadow-[0_0_6px_var(--color-mint)]" />
      </div>
      <div
        ref={scrollRef}
        className="-mt-2 min-h-0 overflow-y-auto overscroll-contain drop-shadow-[0_5px_0_var(--color-ink)] [scrollbar-width:none]"
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: a tap skips the printing; keyboard users get the "Show all" key below. */}
        <div
          onClick={() => setPrinted(lines.length)}
          className="receipt-paper panel-receipt w-full border-x-[3px] border-ink px-5 pt-5 text-left font-card text-ink"
        >
          <header className="text-center">
            <p className="font-display text-[28px] leading-none tracking-wide">
              {summary.shopName}
            </p>
            <p className="mt-1 text-sm tracking-wider text-ink/60 uppercase">
              {t('title.address')}
            </p>
            <div className="mt-2 flex justify-between text-sm tracking-wide uppercase">
              <span>
                {tc('date', {
                  weekday: tc(`weekday.${date.weekday}`),
                  season: tc(`season.${date.season}`),
                  day: date.dayOfSeason,
                  year: date.year,
                })}
              </span>
              <span>{t('summary.receiptNo', { day: summary.day })}</span>
            </div>
            <p className="text-left text-sm tracking-wide text-ink/60 uppercase">
              {t('summary.closedAt', { time: clockText(summary.closedMinute) })}
            </p>
          </header>
          <hr className="receipt-rule--double my-2 border-0" />
          <div className="space-y-1 pb-2">
            {lines.slice(0, printed).map((line) => (
              <div key={line.key} className={reduced ? '' : 'receipt-line'}>
                {line.node}
              </div>
            ))}
          </div>
          {done ? null : (
            <button
              type="button"
              onClick={() => setPrinted(lines.length)}
              className="mx-auto mb-2 block rounded-full px-3 py-1 text-sm font-bold tracking-wide text-ink/50 uppercase hover:text-ink"
            >
              {t('summary.skip')}
            </button>
          )}
        </div>
      </div>
      {done ? (
        <div className="pointer-events-none absolute top-[34%] right-1 rotate-[-14deg] opacity-90">
          <Stamp
            text={
              summary.profit >= 0 && summary.served > 0
                ? t('summary.stampGood')
                : t('summary.stampSlow')
            }
            color={
              summary.profit >= 0 && summary.served > 0 ? 'var(--color-teal)' : 'var(--color-sky)'
            }
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The Day Summary (docs/05 §5.17): opens on its own at night, prints line by line with rolling
 * numbers, always ends with a "Tomorrow" teaser, and offers Next Day. It can be tucked away for
 * night tasks; the HUD keeps a Next Day key and the door sign brings the receipt back.
 */
export function DaySummary() {
  const { t } = useTranslation('shell');
  const open = useUiStore((ui) => ui.summaryOpen);
  const game = useGameStore((store) => store.game);
  const [printed, setPrinted] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const visible = open && game?.clock.phase === 'night';

  useEffect(() => {
    if (!visible) setPrinted(false);
  }, [visible]);

  useEffect(() => {
    if (!printed) return;
    playSfx('ui.stamp');
    nextRef.current?.focus({ preventScroll: true });
  }, [printed]);

  const summary = visible && game ? buildDaySummary(game, getRegistry()) : null;

  return (
    <AnimatePresence>
      {summary ? (
        <motion.div
          key="day-summary"
          role="dialog"
          aria-modal="true"
          aria-label={t('summary.title')}
          className="night-sky fixed inset-0 z-30 flex items-center justify-center gap-6 overflow-hidden p-4 [@media(max-height:540px)]:justify-center [@media(max-height:540px)]:gap-4 [@media(max-height:540px)]:p-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex max-h-full min-h-0 flex-col items-center gap-5 [@media(max-height:540px)]:flex-row [@media(max-height:540px)]:items-stretch"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <Receipt key={summary.day} summary={summary} onPrinted={() => setPrinted(true)} />
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 [@media(max-height:540px)]:w-44 [@media(max-height:540px)]:flex-col [@media(max-height:540px)]:flex-nowrap [@media(max-height:540px)]:justify-end">
              <button
                type="button"
                onClick={() => {
                  playSfx('ui.close');
                  useUiStore.getState().setSummaryOpen(false);
                }}
                title={t('summary.nightTasksHint')}
                className="h-12 rounded-[14px] border-[3px] border-ink bg-white px-4 font-display text-lg tracking-wide text-ink shadow-[inset_0_-4px_0_rgb(0_0_0/0.12),0_4px_0_var(--color-ink)] transition-[translate,box-shadow] duration-75 hover:-translate-y-px active:translate-y-[4px] active:shadow-none [@media(max-height:540px)]:w-full"
              >
                {t('summary.nightTasks')}
              </button>
              <button
                ref={nextRef}
                type="button"
                onClick={() => {
                  playSfx('ui.pop');
                  runCommand({ type: 'time/startNextDay' });
                }}
                className={`flex h-14 items-center gap-2 rounded-[14px] border-[3px] border-ink bg-sun px-6 font-display text-2xl tracking-wide text-ink shadow-[inset_0_-4px_0_rgb(0_0_0/0.12),0_4px_0_var(--color-ink)] transition-[translate,box-shadow] duration-75 hover:-translate-y-px active:translate-y-[4px] active:shadow-none [@media(max-height:540px)]:w-full [@media(max-height:540px)]:justify-center [@media(max-height:540px)]:px-3 [@media(max-height:540px)]:text-xl ${printed ? 'next-day-glow' : ''}`}
              >
                <Sunrise className="size-6" aria-hidden="true" />
                {t('summary.nextDay')}
                <ChevronsRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
