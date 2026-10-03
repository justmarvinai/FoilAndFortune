import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { playSfx } from '@/audio';
import { CardBack } from '@/cards/CardBack';
import { CardView } from '@/cards/CardView';
import { runCommand } from '@/game/actions';
import { STARTER_SET_ID } from '@/sim/state/createNewGame';
import { useGameStore } from '@/state/gameStore';
import { Button } from '@/ui/components/Button';
import { ElementIcon } from '@/ui/components/ElementIcon';
import { RarityGem } from '@/ui/components/RarityGem';
import {
  binderPockets,
  completion,
  type Pocket,
  paginate,
  spreadCount,
  spreadPages,
} from './model/binder';
import { CardThumb } from './parts/CardThumb';
import { CloseKey } from './parts/controls';
import { NO_COLLECTION, NO_STACKS, VIEW } from './parts/empty';
import { useReducedMotion, useSheetCardArt } from './parts/hooks';
import { PriceTag } from './parts/price';
import type { SheetProps } from './types';
import './sheets.css';

interface Turn {
  from: number;
  to: number;
  dir: 1 | -1;
}

/**
 * The leather binder (docs/05 §5.9, docs/01 §24): 3 × 3 pocket pages in card-number order with
 * silhouettes for missing cards, a completion ring, CSS 3D page turns (instant with reduced
 * motion) and a close-up with tilt and foil to fill or empty a pocket.
 */
export default function BinderSheet({ onClose }: SheetProps) {
  const { t } = useTranslation('sheets');
  const reduced = useReducedMotion();
  const titleId = useId();
  const game = useGameStore(
    useShallow((store) => ({
      collection: store.game?.collection ?? NO_COLLECTION,
      stacks: store.game?.inventory.cardStacks ?? NO_STACKS,
    })),
  );
  const set = VIEW.content.sets.get(STARTER_SET_ID);
  const pockets = binderPockets(STARTER_SET_ID, game.collection, game.stacks, VIEW);
  const pages = paginate(pockets);
  const spreads = spreadCount(pages.length);
  const [spread, setSpread] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const done = completion(pockets);
  const current = Math.min(spread, spreads - 1);
  const open = openId ? (pockets.find((pocket) => pocket.card.id === openId) ?? null) : null;

  const go = (dir: 1 | -1) => {
    const to = current + dir;
    if (to < 0 || to >= spreads || turn) return;
    playSfx('pack.flip');
    if (reduced) setSpread(to);
    else setTurn({ from: current, to, dir });
  };

  const [left, right] = spreadPages(current, pages.length);
  const shownLeft = turn ? (turn.dir === 1 ? left : spreadPages(turn.to, pages.length)[0]) : left;
  const shownRight = turn
    ? turn.dir === 1
      ? spreadPages(turn.to, pages.length)[1]
      : right
    : right;
  const page = (index: number | null) =>
    index === null ? null : <PageGrid pockets={pages[index] ?? []} onOpen={setOpenId} />;

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <section
        aria-labelledby={titleId}
        className="ff-sheet skin-desk relative flex h-full flex-col overflow-hidden text-paper"
        onKeyDown={(event) => {
          if (open) return;
          if (event.key === 'ArrowRight') go(1);
          if (event.key === 'ArrowLeft') go(-1);
        }}
      >
        <header className="flex items-center gap-3 px-4 pt-3 pb-2 [@media(max-height:500px)]:py-1.5">
          <span className="leather stitch rounded-t-xl rounded-b-sm border-[3px] border-ink px-4 py-1.5 shadow-[0_3px_0_var(--color-ink)]">
            <h2
              id={titleId}
              className="font-display text-xl tracking-wide text-sun [text-shadow:0_2px_0_var(--color-ink)]"
            >
              {t('binder.title')} · {set?.name ?? ''}
            </h2>
          </span>
          <CompletionRing filled={done.filled} total={done.total} />
          <p className="hidden min-w-0 flex-1 truncate text-sm font-bold text-paper/75 sm:block">
            {done.available > 0 ? t('binder.available', { count: done.available }) : null}
          </p>
          <span className="flex-1 sm:hidden" />
          <p
            className="shrink-0 font-display text-sm tracking-wide tabular-nums"
            aria-live="polite"
          >
            {right === null
              ? t('binder.page', { from: (left ?? 0) + 1, count: pages.length })
              : t('binder.pages', { from: (left ?? 0) + 1, to: right + 1, count: pages.length })}
          </p>
          <CloseKey onClose={onClose} />
        </header>

        <div className="relative flex min-h-0 flex-1 items-center gap-2 px-2 pb-3">
          <PageArrow dir={-1} disabled={current === 0} onClick={() => go(-1)} />
          <div className="relative h-full min-w-0 flex-1" style={{ containerType: 'size' }}>
            <div
              className="leather relative mx-auto grid aspect-[3/2] grid-cols-[1fr_auto_1fr] rounded-[22px] border-[3px] border-ink p-[1.2cqmin] shadow-[0_8px_0_var(--color-ink),0_30px_60px_-20px_black]"
              style={{ width: 'min(100cqw, 150cqh)', perspective: '2200px' }}
            >
              <div className="relative">{page(shownLeft)}</div>
              <div
                className="flex flex-col items-center justify-around px-[0.8cqmin]"
                aria-hidden="true"
              >
                {[0, 1, 2].map((ring) => (
                  <span
                    key={ring}
                    className="ring h-[3.2cqmin] w-[4.4cqmin] rounded-full border-2 border-ink"
                  />
                ))}
              </div>
              <div className="relative">{page(shownRight)}</div>
              {turn ? (
                <motion.div
                  className="page-leaf absolute top-[1.2cqmin] bottom-[1.2cqmin] z-10"
                  style={
                    turn.dir === 1
                      ? {
                          right: '1.2cqmin',
                          width: 'calc(50% - 3.4cqmin)',
                          transformOrigin: 'left center',
                        }
                      : {
                          left: '1.2cqmin',
                          width: 'calc(50% - 3.4cqmin)',
                          transformOrigin: 'right center',
                        }
                  }
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: turn.dir === 1 ? -180 : 180 }}
                  transition={{ duration: 0.62, ease: [0.45, 0.05, 0.25, 1] }}
                  onAnimationComplete={() => {
                    setSpread(turn.to);
                    setTurn(null);
                  }}
                >
                  <div className="page-face">{page(turn.dir === 1 ? right : left)}</div>
                  <div className="page-face page-face--back">
                    {page(
                      turn.dir === 1
                        ? spreadPages(turn.to, pages.length)[0]
                        : spreadPages(turn.to, pages.length)[1],
                    )}
                  </div>
                </motion.div>
              ) : null}
            </div>
          </div>
          <PageArrow dir={1} disabled={current >= spreads - 1} onClick={() => go(1)} />
        </div>

        <AnimatePresence>
          {open ? (
            <PocketDetail key={open.card.id} pocket={open} onClose={() => setOpenId(null)} />
          ) : null}
        </AnimatePresence>
      </section>
    </MotionConfig>
  );
}

function PageArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: 1 | -1;
  disabled: boolean;
  onClick(): void;
}) {
  const { t } = useTranslation('sheets');
  return (
    <button
      type="button"
      aria-label={dir === 1 ? t('binder.next') : t('binder.prev')}
      disabled={disabled}
      onClick={onClick}
      className="grid size-12 shrink-0 place-items-center rounded-full border-[3px] border-ink bg-paper font-display text-xl text-ink shadow-[0_4px_0_var(--color-ink)] transition-transform duration-75 active:translate-y-[4px] active:shadow-none disabled:opacity-30"
    >
      {dir === 1 ? '▶' : '◀'}
    </button>
  );
}

function CompletionRing({ filled, total }: { filled: number; total: number }) {
  const { t } = useTranslation('sheets');
  const ratio = total > 0 ? filled / total : 0;
  const r = 19;
  const c = 2 * Math.PI * r;
  return (
    <span
      className="relative grid size-12 shrink-0 place-items-center"
      role="img"
      aria-label={t('binder.completionAria', { filled, total })}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="var(--color-ink)"
          stroke="var(--color-paper2)"
          strokeOpacity="0.25"
          strokeWidth="6"
        />
        <motion.circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--color-sun)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </svg>
      <span className="relative font-display text-xs text-sun tabular-nums">
        {t('binder.completion', { filled, total })}
      </span>
    </span>
  );
}

function PageGrid({
  pockets,
  onOpen,
}: {
  pockets: readonly Pocket[];
  onOpen(cardId: string): void;
}) {
  return (
    <div className="binder-page grid h-full grid-cols-3 grid-rows-3 gap-[1.2cqmin] rounded-lg border-2 border-ink/60 p-[1.4cqmin]">
      {Array.from({ length: 9 }, (_, i) => {
        const pocket = pockets[i];
        return pocket ? (
          <PocketButton
            key={pocket.card.id}
            pocket={pocket}
            onOpen={() => onOpen(pocket.card.id)}
          />
        ) : (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: empty trailing pockets have no identity
            key={`blank-${i}`}
            className="pocket sleeve relative rounded-md"
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

function PocketButton({ pocket, onOpen }: { pocket: Pocket; onOpen(): void }) {
  const { t } = useTranslation('sheets');
  const number = String(pocket.card.number).padStart(3, '0');
  const label =
    pocket.state === 'filled'
      ? t('binder.pocketFilled', { name: pocket.card.name, number })
      : pocket.state === 'available'
        ? t('binder.pocketAvailable', { name: pocket.card.name, number })
        : pocket.seen
          ? t('binder.pocketSeen', { name: pocket.card.name, number })
          : t('binder.pocketMissing', { number });
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        playSfx('ui.pop');
        onOpen();
      }}
      className="pocket sleeve group relative grid min-h-0 place-items-center overflow-visible rounded-md p-[6%] transition-transform duration-150 hover:-translate-y-0.5"
    >
      {pocket.state === 'filled' ? (
        <motion.span
          className="block w-full"
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        >
          <CardThumb card={pocket.card} finish={pocket.binderFinish} width="100%" />
        </motion.span>
      ) : (
        <span className="grid aspect-[5/7] w-full place-items-center rounded-[6%] border-2 border-dashed border-ink/35 bg-ink/10 text-ink/55">
          <span className="flex flex-col items-center gap-[4%] text-center">
            {pocket.seen && pocket.card.element ? (
              <span className="opacity-40 grayscale">
                <ElementIcon element={pocket.card.element} size="2.4cqmin" />
              </span>
            ) : null}
            <span className="font-display text-[max(11px,2.4cqmin)] leading-none">#{number}</span>
            <span className="max-w-full truncate px-1 text-[max(9px,1.6cqmin)] leading-none font-extrabold">
              {pocket.seen ? pocket.card.name : t('binder.unknown')}
            </span>
          </span>
          {pocket.state === 'available' ? (
            <span className="pulse-low absolute -top-1 -right-1 grid size-[3.2cqmin] min-h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-sun font-display text-[2cqmin] text-ink">
              +
            </span>
          ) : null}
        </span>
      )}
    </button>
  );
}

function PocketDetail({ pocket, onClose }: { pocket: Pocket; onClose(): void }) {
  const { t } = useTranslation('sheets');
  const { t: tc } = useTranslation('cards');
  const artUrl = useSheetCardArt(pocket.card);
  const finish = pocket.binderFinish ?? pocket.copies[0]?.finish;
  const put = (key: string) => {
    if (runCommand({ type: 'collection/addToBinder', cardKey: key }).ok) {
      playSfx('ui.stamp');
      onClose();
    }
  };
  const remove = () => {
    if (runCommand({ type: 'collection/removeFromBinder', cardId: pocket.card.id }).ok) {
      playSfx('ui.close');
      onClose();
    }
  };
  return (
    <motion.div
      className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-night/75 p-4 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={pocket.card.name}
        className="flex w-full max-w-xl flex-wrap items-center justify-center gap-5 [@media(max-height:500px)]:flex-nowrap"
        initial={{ scale: 0.85, rotate: -3 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 24 }}
      >
        <div className="w-[min(230px,44vw)] shrink-0 [@media(max-height:500px)]:w-[160px]">
          {pocket.seen || pocket.state !== 'missing' ? (
            <div className={pocket.state === 'missing' ? 'opacity-50 grayscale' : ''}>
              <CardView card={pocket.card} finish={finish} artUrl={artUrl} width="100%" />
            </div>
          ) : (
            <CardBack width="100%" />
          )}
        </div>
        <div className="min-w-56 flex-1 rounded-2xl border-[3px] border-ink bg-paper p-4 text-ink shadow-[0_5px_0_var(--color-ink)]">
          <h3 className="font-display text-2xl leading-tight tracking-wide">
            {pocket.seen || pocket.state !== 'missing' ? pocket.card.name : t('binder.unknown')}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-ink/75">
            <RarityGem rarity={pocket.card.rarity} size={16} />
            {tc(`rarity.${pocket.card.rarity}`)} · #{String(pocket.card.number).padStart(3, '0')}
          </p>
          {pocket.state === 'filled' ? (
            <div className="mt-3 space-y-1">
              <p className="font-hand text-xl font-bold text-teal">{t('binder.detail.inPocket')}</p>
              <Button variant="danger" size="md" onClick={remove}>
                {t('binder.detail.remove')}
              </Button>
              <p className="text-xs text-ink/65">{t('binder.detail.removeHint')}</p>
            </div>
          ) : null}
          {pocket.copies.length > 0 ? (
            <div className="mt-3">
              <p className="text-sm font-bold">{t('binder.detail.choose')}</p>
              <ul className="mt-1.5 space-y-1.5">
                {pocket.copies.map((copy) => (
                  <li key={copy.key}>
                    <button
                      type="button"
                      onClick={() => put(copy.key)}
                      className="flex min-h-12 w-full items-center gap-2 rounded-xl border-2 border-ink bg-white px-2 text-left shadow-[0_2px_0_var(--color-ink)] transition-transform active:translate-y-[2px] active:shadow-none"
                    >
                      <CardThumb card={pocket.card} finish={copy.finish} width={30} />
                      <span className="min-w-0 flex-1 text-sm font-bold">
                        {t(`finish.${copy.finish}`)} · ×{copy.count}
                      </span>
                      <PriceTag cents={copy.valueCents} size="sm" />
                      <span className="sr-only">{t('binder.detail.put')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : pocket.state === 'missing' ? (
            <p className="mt-3 font-hand text-xl font-bold">{t('binder.detail.none')}</p>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
