import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '@/audio';
import { CardView } from '@/cards/CardView';
import type { ElementId, Rarity } from '@/content/schema/common';
import { formatMoney } from '@/core/money';
import { runCommand } from '@/game/actions';
import { SINGLES_CASE_UNLOCK } from '@/sim/systems/stock';
import { Button } from '@/ui/components/Button';
import { ElementIcon } from '@/ui/components/ElementIcon';
import { RarityGem } from '@/ui/components/RarityGem';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { useToasts } from '@/ui/components/Toasts';
import {
  type BinderFilter,
  filterSingles,
  NO_FILTER,
  presentFacets,
  type SingleRow,
  type SinglesFilter,
  type SinglesSort,
  singleRows,
  singlesTotals,
  sortSingles,
} from '../model/singles';
import type { CardStacks, Collection, Fixtures } from '../model/stock';
import { CardThumb } from '../parts/CardThumb';
import { Chip } from '../parts/controls';
import { VIEW } from '../parts/empty';
import { useSheetCardArt } from '../parts/hooks';
import { BinderIcon, CaseIcon, LockIcon } from '../parts/icons';
import { PriceTag } from '../parts/price';
import { VirtualGrid } from '../parts/VirtualGrid';

/** Singles tab of the Backroom: a felt sorting mat of card stacks (docs/05 §5.4). */
export function SinglesPanel({
  stacks,
  collection,
  day,
  fixtures,
  unlocked,
}: {
  stacks: CardStacks;
  collection: Collection;
  day: number;
  fixtures: Fixtures;
  unlocked: Record<string, number>;
}) {
  const { t } = useTranslation('sheets');
  const { t: tc } = useTranslation('cards');
  const [filter, setFilter] = useState<SinglesFilter>(NO_FILTER);
  const [sort, setSort] = useState<SinglesSort>('value');
  const [selected, setSelected] = useState<string | null>(null);

  const all = singleRows(stacks, collection, day, VIEW);
  const facets = presentFacets(all);
  const rows = sortSingles(filterSingles(all, filter), sort);
  const totals = singlesTotals(all);
  const selectedRow = selected ? (all.find((row) => row.key === selected) ?? null) : null;

  const toggleRarity = (rarity: Rarity) =>
    setFilter((f) => ({ ...f, rarity: f.rarity === rarity ? 'all' : rarity }));
  const toggleElement = (element: ElementId) =>
    setFilter((f) => ({ ...f, element: f.element === element ? 'all' : element }));
  const toggleBinder = (binder: BinderFilter) =>
    setFilter((f) => ({ ...f, binder: f.binder === binder ? 'all' : binder }));

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="kraft relative z-[2] space-y-2 border-b-[3px] border-ink px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-11 min-w-0 flex-1 basis-40 items-center gap-2 rounded-xl border-[3px] border-ink bg-white px-2.5 focus-within:border-teal">
            <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
              <circle
                cx="10.5"
                cy="10.5"
                r="6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
              />
              <path
                d="m15 15 5.5 5.5"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={filter.query}
              onChange={(event) => setFilter((f) => ({ ...f, query: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && filter.query) {
                  event.stopPropagation();
                  setFilter((f) => ({ ...f, query: '' }));
                }
              }}
              placeholder={t('singles.search')}
              aria-label={t('singles.search')}
              className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-ink/45"
            />
          </label>
          <SegmentedControl<SinglesSort>
            size="sm"
            label={t('singles.sortLabel')}
            value={sort}
            onChange={(value) => {
              playSfx('ui.tab');
              setSort(value);
            }}
            options={[
              { value: 'value', label: t('singles.sort.value') },
              { value: 'number', label: t('singles.sort.number') },
              { value: 'rarity', label: t('singles.sort.rarity') },
            ]}
          />
        </div>
        <fieldset className="rail flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5">
          <legend className="sr-only">{t('singles.filters')}</legend>
          {facets.rarities.map((rarity) => (
            <Chip
              key={rarity}
              active={filter.rarity === rarity}
              onClick={() => toggleRarity(rarity)}
              label={tc(`rarity.${rarity}`)}
            >
              <RarityGem rarity={rarity} size={16} title={tc(`rarity.${rarity}`)} />
            </Chip>
          ))}
          <span className="mx-0.5 h-6 w-[3px] shrink-0 rounded bg-ink/25" aria-hidden="true" />
          {facets.elements.map((element) => (
            <Chip
              key={element}
              active={filter.element === element}
              onClick={() => toggleElement(element)}
              label={tc(`element.${element}`)}
            >
              <ElementIcon element={element} size={18} title={tc(`element.${element}`)} />
            </Chip>
          ))}
          <span className="mx-0.5 h-6 w-[3px] shrink-0 rounded bg-ink/25" aria-hidden="true" />
          <Chip active={filter.binder === 'out'} onClick={() => toggleBinder('out')}>
            {t('singles.binderOut')}
          </Chip>
          <Chip active={filter.binder === 'in'} onClick={() => toggleBinder('in')}>
            <BinderIcon size={16} />
            {t('singles.binderIn')}
          </Chip>
        </fieldset>
      </div>

      <div className="felt relative flex min-h-0 flex-1 flex-col">
        <p className="px-4 pt-2 font-hand text-lg font-bold text-paper/90">
          {t('singles.totals', {
            count: totals.cards,
            stacks: totals.stacks,
            value: formatMoney(totals.valueCents),
          })}
          {rows.length !== all.length ? (
            <span className="ml-2 text-sun">{t('singles.showing', { count: rows.length })}</span>
          ) : null}
        </p>
        {rows.length === 0 ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <p className="max-w-xs font-display text-lg text-paper/85">
              {all.length === 0 ? t('singles.empty') : t('singles.noMatch')}
            </p>
          </div>
        ) : (
          <VirtualGrid
            className="flex-1"
            items={rows}
            itemKey={(row) => row.key}
            minCellWidth={92}
            aspect={7 / 5}
            captionHeight={30}
            gap={14}
            label={t('singles.gridLabel')}
            renderItem={(row, width) => (
              <SingleCell row={row} width={width} onOpen={() => setSelected(row.key)} />
            )}
          />
        )}
      </div>

      <AnimatePresence>
        {selectedRow ? (
          <SingleDetail
            key={selectedRow.key}
            row={selectedRow}
            fixtures={fixtures}
            caseUnlocked={unlocked[SINGLES_CASE_UNLOCK] !== undefined}
            onClose={() => setSelected(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SingleCell({ row, width, onOpen }: { row: SingleRow; width: number; onOpen(): void }) {
  const { t } = useTranslation('sheets');
  const { t: tc } = useTranslation('cards');
  return (
    <button
      type="button"
      onClick={() => {
        playSfx('ui.pop');
        onOpen();
      }}
      aria-label={t('singles.cellLabel', {
        name: row.card.name,
        rarity: tc(`rarity.${row.card.rarity}`),
        count: row.count,
        price: formatMoney(row.valueCents),
      })}
      className="group relative block size-full rounded-lg text-left"
    >
      <span className="relative block transition-transform duration-150 group-hover:-translate-y-1 group-hover:rotate-[-1.5deg] group-active:translate-y-0">
        {row.count > 1 ? (
          <span
            className="absolute -top-0.5 left-1 h-full rounded-[4.6cqw] bg-paper2/60"
            style={{ width: width - 4, transform: 'rotate(3deg)' }}
            aria-hidden="true"
          />
        ) : null}
        <CardThumb card={row.card} finish={row.finish} width={width} />
        {row.isNew ? (
          <span className="absolute -top-2 -left-1.5 -rotate-12 rounded-md border-2 border-ink bg-coral px-1 font-display text-[11px] text-white shadow-[0_2px_0_var(--color-ink)]">
            {t('singles.new')}
          </span>
        ) : null}
        {row.misprint ? (
          <span className="absolute top-6 -left-1.5 -rotate-6 rounded-md border-2 border-ink bg-grape px-1 font-display text-[10px] text-white">
            {t('singles.misprint')}
          </span>
        ) : null}
        {row.inBinder ? (
          <span className="absolute -bottom-1.5 -left-1.5 rounded-full border-2 border-ink bg-paper p-0.5">
            <BinderIcon size={16} />
          </span>
        ) : null}
        {row.count > 1 ? (
          <span className="absolute -top-2 -right-2 rounded-full border-2 border-ink bg-ink px-1.5 font-display text-sm text-paper shadow-[0_2px_0_rgb(0_0_0/0.4)]">
            ×{row.count}
          </span>
        ) : null}
      </span>
      <span className="mt-1 flex h-[26px] items-center justify-center">
        <PriceTag cents={row.valueCents} size="sm" className="min-w-0! scale-90" />
      </span>
    </button>
  );
}

/** Close-up of one stack with its actions (docs/05 §5.8-lite: tilt and foil via CardView). */
function SingleDetail({
  row,
  fixtures,
  caseUnlocked,
  onClose,
}: {
  row: SingleRow;
  fixtures: Fixtures;
  caseUnlocked: boolean;
  onClose(): void;
}) {
  const { t } = useTranslation('sheets');
  const { t: tc } = useTranslation('cards');
  const push = useToasts((store) => store.push);
  const artUrl = useSheetCardArt(row.card);
  const caseLevel = VIEW.content.unlocks.get(SINGLES_CASE_UNLOCK)?.level ?? 2;
  const freeSlot = findFreeCaseSlot(fixtures);

  const addToBinder = () => {
    const result = runCommand({ type: 'collection/addToBinder', cardKey: row.key });
    if (!result.ok) return;
    playSfx('ui.stamp');
    push({
      title: t('singles.toBinder', { name: row.card.name }),
      tone: 'success',
      icon: <BinderIcon size={26} />,
    });
    onClose();
  };
  const toCase = () => {
    if (!freeSlot) return;
    const result = runCommand({
      type: 'stock/fillSlot',
      fixtureUid: freeSlot.fixtureUid,
      slot: freeSlot.slot,
      cardKey: row.key,
    });
    if (!result.ok) return;
    playSfx('shop.restock');
    push({
      title: t('singles.toCase', { name: row.card.name }),
      body: t('singles.toCaseBody'),
      tone: 'success',
      icon: <CaseIcon size={26} />,
    });
    onClose();
  };

  return (
    <motion.div
      className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-night/70 p-3 backdrop-blur-[2px]"
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
        aria-label={row.card.name}
        className="flex w-full max-w-lg flex-wrap items-center justify-center gap-4 [@media(max-height:500px)]:flex-nowrap"
        initial={{ scale: 0.85, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      >
        <div className="w-[min(210px,46vw)] shrink-0 [@media(max-height:500px)]:w-[150px]">
          <CardView card={row.card} finish={row.finish} artUrl={artUrl} width="100%" />
        </div>
        <div className="min-w-56 flex-1 rounded-2xl border-[3px] border-ink bg-paper p-4 shadow-[0_5px_0_var(--color-ink)]">
          <h3 className="font-display text-2xl leading-tight tracking-wide">{row.card.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink/80">
            <RarityGem rarity={row.card.rarity} size={16} />
            {tc(`rarity.${row.card.rarity}`)}
            <span className="text-ink/40">·</span>
            {t(`finish.${row.finish}`)}
            <span className="text-ink/40">·</span>#{String(row.card.number).padStart(3, '0')}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <PriceTag cents={row.valueCents} size="lg" tone="sun" />
            <p className="text-sm leading-snug">
              {t('singles.detailCount', { count: row.count })}
              <br />
              <span className="font-bold">
                {t('singles.detailTotal', { value: formatMoney(row.valueCents * row.count) })}
              </span>
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Button size="md" icon={<BinderIcon />} onClick={addToBinder}>
              {row.inBinder ? t('singles.swapBinder') : t('singles.addBinder')}
            </Button>
            {row.inBinder ? (
              <p className="-mt-1 text-xs text-ink/70">{t('singles.swapHint')}</p>
            ) : null}
            {caseUnlocked ? (
              <Button
                variant="gold"
                size="md"
                icon={<CaseIcon />}
                disabled={!freeSlot}
                onClick={toCase}
              >
                {freeSlot ? t('singles.toCaseAction') : t('singles.caseFull')}
              </Button>
            ) : (
              <Button variant="secondary" size="md" icon={<LockIcon />} disabled>
                {t('singles.caseLocked', { level: caseLevel })}
              </Button>
            )}
            <Button variant="ghost" size="md" onClick={onClose}>
              {t('common.back')}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function findFreeCaseSlot(fixtures: Fixtures): { fixtureUid: string; slot: number } | null {
  for (const fixture of fixtures) {
    const def = VIEW.content.fixtures.get(fixture.fixtureId);
    if (def?.slots.accepts.kind !== 'singles') continue;
    const slot = fixture.slots.findIndex((entry) => entry.qty === 0);
    if (slot !== -1) return { fixtureUid: fixture.uid, slot };
  }
  return null;
}
