import {
  BookOpen,
  ChartLine,
  Library,
  type LucideIcon,
  Package,
  PackageOpen,
  Percent,
  Sparkles,
  Store,
  Tags,
  Truck,
  Warehouse,
} from 'lucide-react';
import { AnimatePresence, animate, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '@/audio';
import { type Celebration, useUiStore } from '@/state/uiStore';
import { shellSignals } from '../session/shellStore';
import { useReducedMotion } from '../session/useApplySettings';
import { Confetti } from './Confetti';
import { type RewardCard, rewardCards, type UnlockIcon } from './unlockInfo';
import './celebrations.css';

const ICONS: Record<UnlockIcon, LucideIcon> = {
  truck: Truck,
  shelf: Store,
  tag: Tags,
  pack: PackageOpen,
  binder: BookOpen,
  case: Package,
  chart: ChartLine,
  manga: Library,
  storage: Warehouse,
  discount: Percent,
  sparkle: Sparkles,
};

const TONE: Record<RewardCard['visual']['tone'], string> = {
  teal: 'bg-teal text-white',
  sun: 'bg-sun text-ink',
  coral: 'bg-coral text-white',
  sky: 'bg-sky text-white',
  grape: 'bg-grape text-white',
  mint: 'bg-mint text-ink',
};

/** Auto-dismiss after this long (docs/05 §2 "celebrations auto-dismiss"). */
const AUTO_DISMISS_MS = 7000;

function RewardCardView({
  card,
  index,
  cardRef,
}: {
  card: RewardCard;
  index: number;
  cardRef(node: HTMLElement | null): void;
}) {
  const { t } = useTranslation('shell');
  const Icon = ICONS[card.visual.icon];
  const fallback = card.kind === 'unlock' ? 'unlockFallback' : 'perkFallback';
  return (
    <motion.li
      ref={cardRef}
      initial={{ opacity: 0, y: 80, rotate: index % 2 ? 14 : -14, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, rotate: (index - 0.5) * 3, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.55 + index * 0.18 }}
      className="relative flex w-40 flex-col items-center gap-2 rounded-2xl border-[3px] border-ink bg-paper p-3 pt-4 text-center text-ink shadow-[0_6px_0_var(--color-ink)] [@media(max-height:540px)]:w-36 [@media(max-height:540px)]:gap-1 [@media(max-height:540px)]:p-2"
    >
      <span className="absolute -top-3 rounded-full border-2 border-ink bg-white px-2 font-display text-[11px] tracking-widest uppercase">
        {card.kind === 'unlock' ? t('levelUp.unlocked') : t('levelUp.perk')}
      </span>
      <span
        className={`grid size-14 place-items-center rounded-2xl border-[3px] border-ink shadow-[0_3px_0_var(--color-ink)] [@media(max-height:540px)]:size-10 ${TONE[card.visual.tone]}`}
        aria-hidden="true"
      >
        <Icon className="size-7 [@media(max-height:540px)]:size-5" strokeWidth={2.4} />
      </span>
      <span className="font-display text-lg leading-tight tracking-wide">
        {t(`${card.id}.name`, { defaultValue: t(`${fallback}.name`) })}
      </span>
      <span className="text-[13px] leading-snug text-ink/75 [@media(max-height:540px)]:hidden">
        {t(`${card.id}.blurb`, { defaultValue: t(`${fallback}.blurb`) })}
      </span>
    </motion.li>
  );
}

/** Center of the dock key a card flies into, or the HUD level badge. */
function targetOf(card: RewardCard): HTMLElement | null {
  const dock = card.visual.dock
    ? document.querySelector<HTMLElement>(`[data-dock-target="${card.visual.dock}"]`)
    : null;
  return dock ?? document.querySelector<HTMLElement>('[data-level-badge]');
}

function LevelUp({ celebration }: { celebration: Celebration }) {
  const { t } = useTranslation('shell');
  const reduced = useReducedMotion();
  const cards = rewardCards(celebration.unlockIds, celebration.perkIds);
  const cardNodes = useRef<(HTMLElement | null)[]>([]);
  const leaving = useRef(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const [flying, setFlying] = useState(false);

  // Cards fly into the dock key they belong to, then the next celebration (if any) plays.
  const dismiss = async () => {
    if (leaving.current) return;
    leaving.current = true;
    if (!reduced) {
      setFlying(true);
      await Promise.all(
        cards.map((card, index) => {
          const node = cardNodes.current[index];
          const target = targetOf(card);
          if (!node || !target) return Promise.resolve();
          const from = node.getBoundingClientRect();
          const to = target.getBoundingClientRect();
          target.classList.remove('is-receiving');
          window.setTimeout(
            () => {
              target.classList.add('is-receiving');
              window.setTimeout(() => target.classList.remove('is-receiving'), 650);
            },
            480 + index * 90,
          );
          return animate(
            node,
            {
              x: to.left + to.width / 2 - (from.left + from.width / 2),
              y: to.top + to.height / 2 - (from.top + from.height / 2),
              scale: 0.18,
              rotate: 25,
              opacity: 0.4,
            },
            { duration: 0.55, delay: index * 0.09, ease: [0.55, 0, 0.8, 0.3] },
          ).then(() => undefined);
        }),
      );
    }
    useUiStore.getState().shiftCelebration();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per celebration; `dismiss` guards itself.
  useEffect(() => {
    playSfx('ui.levelUp');
    continueRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => void dismiss(), AUTO_DISMISS_MS);
    const off = shellSignals.on('skipCelebration', () => void dismiss());
    return () => {
      window.clearTimeout(timer);
      off();
    };
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-up-title"
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-night/75 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      onClick={() => void dismiss()}
    >
      {reduced ? null : (
        <div className="celebration-rays pointer-events-none absolute top-1/2 left-1/2 size-[160vmax] -translate-1/2" />
      )}
      {reduced ? null : <Confetti />}
      <div className="relative flex flex-col items-center gap-5 [@media(max-height:540px)]:gap-2">
        <motion.div
          className="relative flex flex-col items-center"
          initial={reduced ? { opacity: 0 } : { scale: 0.3, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: flying ? 0.6 : 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 15 }}
        >
          <span
            className="celebration-medal grid size-28 place-items-center rounded-full border-[4px] border-ink font-display text-6xl leading-none text-ink shadow-[0_6px_0_var(--color-ink),inset_0_-6px_0_rgb(0_0_0/0.12)] [@media(max-height:540px)]:size-16 [@media(max-height:540px)]:text-4xl"
            aria-hidden="true"
          >
            {celebration.level}
          </span>
          <h2
            id="level-up-title"
            className="celebration-ribbon relative -mt-4 rounded-lg border-[3px] border-ink bg-coral px-8 py-1.5 font-display text-4xl tracking-wider text-white uppercase shadow-[0_4px_0_var(--color-ink)] [text-shadow:0_3px_0_var(--color-ink)] [@media(max-height:540px)]:text-2xl"
          >
            {t('levelUp.title')}
          </h2>
          <p className="mt-3 font-display text-xl tracking-wide text-paper [@media(max-height:540px)]:mt-1 [@media(max-height:540px)]:text-base">
            {t('levelUp.reached', { level: celebration.level })}
          </p>
        </motion.div>
        {cards.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-4 [@media(max-height:540px)]:gap-3">
            {cards.map((card, index) => (
              <RewardCardView
                key={`${card.kind}-${card.id}`}
                card={card}
                index={index}
                cardRef={(node) => {
                  cardNodes.current[index] = node;
                }}
              />
            ))}
          </ul>
        ) : (
          <p className="max-w-sm text-center font-hand text-2xl text-paper">
            {t('levelUp.keepGoing')}
          </p>
        )}
        <button
          ref={continueRef}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void dismiss();
          }}
          className="mt-1 h-12 rounded-[14px] border-[3px] border-ink bg-sun px-6 font-display text-xl tracking-wide text-ink shadow-[inset_0_-4px_0_rgb(0_0_0/0.12),0_4px_0_var(--color-ink)] transition-[translate,box-shadow] duration-75 hover:-translate-y-px active:translate-y-[4px] active:shadow-none [@media(max-height:540px)]:h-10 [@media(max-height:540px)]:text-lg"
        >
          {t('levelUp.continue')}
        </button>
        <p className="celebration-hint text-sm font-bold text-paper/70 [@media(max-height:540px)]:hidden">
          {t('levelUp.tapHint')}
        </p>
      </div>
    </motion.div>
  );
}

/**
 * Layer 4 (docs/05 §2, §6): celebrations play one at a time from `ui.celebrations`; they pause
 * the clock (isInteractionPaused), are skippable and dismiss themselves.
 */
export function CelebrationHost() {
  const current = useUiStore((ui) => ui.celebrations[0] ?? null);
  return (
    <AnimatePresence>
      {current ? <LevelUp key={`level-${current.level}`} celebration={current} /> : null}
    </AnimatePresence>
  );
}
