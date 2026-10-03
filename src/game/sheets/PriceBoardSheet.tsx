import { MotionConfig, motion } from 'motion/react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ProductArt } from '@/art/packs/ProductArt';
import { playSfx } from '@/audio';
import { type Cents, formatMoney } from '@/core/money';
import { runCommand } from '@/game/actions';
import { SINGLES_CASE_UNLOCK } from '@/sim/systems/stock';
import { useGameStore } from '@/state/gameStore';
import { useToasts } from '@/ui/components/Toasts';
import {
  applyHelper,
  type CaseTagRow,
  caseTagRows,
  type PriceHelper,
  type PriceRow,
  priceRows,
} from './model/pricing';
import { CardThumb } from './parts/CardThumb';
import { CloseKey } from './parts/controls';
import { NO_FIXTURES, NO_ORDERS, NO_PRICES, NO_SEALED, NO_UNLOCKS, VIEW } from './parts/empty';
import { useReducedMotion } from './parts/hooks';
import { RiskIcon, ShelfIcon, StockOutIcon } from './parts/icons';
import { PriceEditor, ReactionBubble, ReactionMeter } from './parts/price';
import type { SheetProps } from './types';
import './sheets.css';

type Change =
  | { kind: 'sku'; productId: string; prev: Cents }
  | { kind: 'slot'; fixtureUid: string; slot: number; prev: Cents };

const PCT_STEPS = [5, 10, 15, 20, 25, 30, 40, 50] as const;

/**
 * The Price Board on a clipboard (docs/05 §5.5, docs/01 §9.2): one handwritten line per SKU with
 * your price, market, average cost, margin and stock status; quick-price stamps with undo; the
 * display case's per-slot tags; and the customer reaction your price would get.
 */
export default function PriceBoardSheet({ onClose }: SheetProps) {
  const { t } = useTranslation('sheets');
  const reduced = useReducedMotion();
  const titleId = useId();
  const push = useToasts((store) => store.push);
  const game = useGameStore(
    useShallow((store) => ({
      prices: store.game?.pricing.prices ?? NO_PRICES,
      sealed: store.game?.inventory.sealed ?? NO_SEALED,
      fixtures: store.game?.shop.fixtures ?? NO_FIXTURES,
      orders: store.game?.suppliers.orders ?? NO_ORDERS,
      level: store.game?.progression.level ?? 1,
      unlocked: store.game?.progression.unlocked ?? NO_UNLOCKS,
    })),
  );
  const orderable = new Set<string>();
  for (const supplier of VIEW.content.suppliers.values()) {
    if (supplier.unlockLevel > game.level) continue;
    for (const item of supplier.items) orderable.add(item.productId);
  }
  const rows = priceRows(game.prices, game.sealed, game.fixtures, game.orders, orderable, VIEW);
  const tags = caseTagRows(game.fixtures, VIEW);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pct, setPct] = useState<number>(10);
  const [scope, setScope] = useState<'row' | 'all'>('row');
  const [history, setHistory] = useState<Change[][]>([]);
  const selected = rows.find((row) => row.product.id === selectedId) ?? rows[0] ?? null;

  /** Applies price changes as one undoable batch. */
  const apply = (changes: { change: Change; cents: Cents }[]) => {
    const done: Change[] = [];
    for (const { change, cents } of changes) {
      if (cents === change.prev) continue;
      const result =
        change.kind === 'sku'
          ? runCommand({ type: 'pricing/setPrice', productId: change.productId, cents })
          : runCommand({
              type: 'pricing/setSlotPrice',
              fixtureUid: change.fixtureUid,
              slot: change.slot,
              cents,
            });
      if (result.ok) done.push(change);
    }
    if (done.length > 0) {
      playSfx('ui.coin');
      setHistory((stack) => [...stack.slice(-19), done]);
    }
  };
  const setSku = (row: PriceRow, cents: Cents) =>
    apply([{ change: { kind: 'sku', productId: row.product.id, prev: row.priceCents }, cents }]);
  const setTag = (tag: CaseTagRow, cents: Cents) =>
    apply([
      {
        change: { kind: 'slot', fixtureUid: tag.fixtureUid, slot: tag.slot, prev: tag.priceCents },
        cents,
      },
    ]);
  const helper = (kind: PriceHelper) => {
    const targets = scope === 'all' ? rows : selected ? [selected] : [];
    apply(
      targets.map((row) => ({
        change: { kind: 'sku' as const, productId: row.product.id, prev: row.priceCents },
        cents: applyHelper(kind, { ...row, msrpCents: row.product.msrpCents }, pct),
      })),
    );
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) {
      playSfx('ui.error');
      return;
    }
    for (const change of [...last].reverse()) {
      if (change.kind === 'sku') {
        runCommand({ type: 'pricing/setPrice', productId: change.productId, cents: change.prev });
      } else {
        runCommand({
          type: 'pricing/setSlotPrice',
          fixtureUid: change.fixtureUid,
          slot: change.slot,
          cents: change.prev,
        });
      }
    }
    setHistory((stack) => stack.slice(0, -1));
    playSfx('ui.tab');
    push({ title: t('prices.undone'), tone: 'info' });
  };

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <section
        aria-labelledby={titleId}
        className="ff-sheet skin-clipboard relative flex h-full flex-col rounded-[24px] border-[3px] border-ink px-3 pt-7 pb-3 shadow-[0_6px_0_var(--color-ink)] [@media(max-height:500px)]:pt-5"
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            undo();
          }
        }}
      >
        <div
          className="clip absolute -top-1.5 left-1/2 z-10 h-11 w-40 -translate-x-1/2 rounded-b-xl rounded-t-md border-[3px] border-ink shadow-[0_3px_0_var(--color-ink)] [@media(max-height:500px)]:h-8"
          aria-hidden="true"
        >
          <span className="absolute top-2 left-1/2 h-3 w-16 -translate-x-1/2 rounded-full border-2 border-ink bg-ink/20" />
        </div>
        <div className="absolute top-2 right-2 z-20">
          <CloseKey onClose={onClose} />
        </div>

        <div className="ruled-paper relative flex min-h-0 flex-1 -rotate-[0.4deg] flex-col rounded-md border-[3px] border-ink shadow-[0_4px_0_rgb(30_35_64/0.5)]">
          <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto pt-4 pr-3 pb-4 pl-12">
            <h2
              id={titleId}
              className="font-hand text-4xl leading-none font-bold [@media(max-height:500px)]:text-3xl"
            >
              {t('prices.title')}
            </h2>
            <p className="mt-0.5 mb-3 text-xs font-bold text-ink/60">{t('prices.subtitle')}</p>

            <ul className="@container space-y-1">
              {rows.map((row, index) => (
                <PriceLine
                  key={row.product.id}
                  row={row}
                  index={index}
                  selected={selected?.product.id === row.product.id}
                  onSelect={() => setSelectedId(row.product.id)}
                  onPrice={(cents) => {
                    setSelectedId(row.product.id);
                    setSku(row, cents);
                  }}
                />
              ))}
            </ul>

            <CaseTags
              tags={tags}
              unlocked={game.unlocked[SINGLES_CASE_UNLOCK] !== undefined}
              onPrice={setTag}
            />
          </div>

          <HelperTray
            selected={selected}
            pct={pct}
            scope={scope}
            canUndo={history.length > 0}
            onPct={setPct}
            onScope={setScope}
            onHelper={helper}
            onUndo={undo}
          />
        </div>
      </section>
    </MotionConfig>
  );
}

function StockNote({ row }: { row: PriceRow }) {
  const { t } = useTranslation('sheets');
  const held = row.onShelf + row.inStorage;
  if (row.onShelf + row.inStorage + row.incoming === 0) {
    return <span className="text-ink/50">{t('prices.stock.none')}</span>;
  }
  const icon =
    row.stock === 'out' ? (
      <StockOutIcon size={18} />
    ) : row.atRisk ? (
      <RiskIcon size={18} />
    ) : (
      <ShelfIcon size={18} />
    );
  const text =
    row.stock === 'out'
      ? row.incoming > 0
        ? t('prices.stock.outIncoming')
        : t('prices.stock.out')
      : row.stock === 'shelfEmpty'
        ? t('prices.stock.shelfEmpty')
        : row.stock === 'low'
          ? t('prices.stock.low', { count: held })
          : t('prices.stock.ok', { count: held });
  return (
    <span
      className={`inline-flex items-center gap-1 ${row.atRisk ? 'font-extrabold text-coral' : ''}`}
    >
      {icon}
      {text}
    </span>
  );
}

function PriceLine({
  row,
  index,
  selected,
  onSelect,
  onPrice,
}: {
  row: PriceRow;
  index: number;
  selected: boolean;
  onSelect(): void;
  onPrice(cents: Cents): void;
}) {
  const { t } = useTranslation('sheets');
  const marginPct = row.marginPct === null ? null : Math.round(row.marginPct * 100);
  return (
    <motion.li
      initial={{ x: -12, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.04 }}
      className={`relative rounded-lg px-1.5 py-1.5 ${selected ? 'highlight' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => {
            playSfx('ui.pop');
            onSelect();
          }}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
        >
          <ProductArt productId={row.product.id} height={44} />
          <span className="min-w-0">
            <span className="block truncate font-extrabold leading-tight">{row.product.name}</span>
            <span className="block text-xs font-bold text-ink/70">
              <StockNote row={row} />
            </span>
          </span>
        </button>
        <PriceEditor cents={row.priceCents} onChange={onPrice} label={row.product.name} />
      </div>
      <dl className="mt-1 ml-[52px] flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-ink/75">
        <div className="flex gap-1">
          <dt className="sr-only">{t('prices.columns.market')}</dt>
          <dd>{t('prices.market', { price: formatMoney(row.marketCents) })}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="sr-only">{t('prices.columns.cost')}</dt>
          <dd>
            {row.avgCostCents === null
              ? t('prices.noCost')
              : t('prices.cost', { price: formatMoney(row.avgCostCents) })}
          </dd>
        </div>
        {marginPct !== null ? (
          <div className="flex gap-1">
            <dt className="sr-only">{t('prices.columns.margin')}</dt>
            <dd
              title={t('prices.marginAria', { pct: marginPct })}
              className={`rounded-[50%_45%_55%_50%] border-2 px-2 font-hand text-base leading-tight font-bold ${
                marginPct < 0 ? 'border-coral text-coral' : 'border-teal text-teal'
              }`}
            >
              {t('prices.margin', { pct: marginPct })}
            </dd>
          </div>
        ) : null}
        <div className="ml-auto">
          <ReactionBubble reaction={row.reaction} compact />
        </div>
      </dl>
    </motion.li>
  );
}

function CaseTags({
  tags,
  unlocked,
  onPrice,
}: {
  tags: readonly CaseTagRow[];
  unlocked: boolean;
  onPrice(tag: CaseTagRow, cents: Cents): void;
}) {
  const { t } = useTranslation('sheets');
  return (
    <section className="mt-6">
      <h3 className="font-hand text-2xl font-bold">{t('prices.case.title')}</h3>
      {!unlocked ? (
        <p className="text-sm font-semibold text-ink/60">
          {t('prices.case.locked', {
            level: VIEW.content.unlocks.get(SINGLES_CASE_UNLOCK)?.level ?? 2,
          })}
        </p>
      ) : tags.length === 0 ? (
        <p className="text-sm font-semibold text-ink/60">{t('prices.case.empty')}</p>
      ) : (
        <ul className="mt-1 space-y-2">
          {tags.map((tag) => (
            <li key={`${tag.fixtureUid}#${tag.slot}`} className="flex items-center gap-2">
              <CardThumb card={tag.card} finish={tag.finish} width={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold leading-tight">{tag.card.name}</span>
                <span className="block text-xs font-bold text-ink/65">
                  {t('prices.market', { price: formatMoney(tag.marketCents) })} ·{' '}
                  {tag.hasOverride ? t('prices.case.tagged') : t('prices.case.tracks')}
                </span>
              </span>
              <PriceEditor
                cents={tag.priceCents}
                onChange={(cents) => onPrice(tag, cents)}
                label={tag.card.name}
                size="sm"
                tone={tag.hasOverride ? 'sun' : 'paper'}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HelperTray({
  selected,
  pct,
  scope,
  canUndo,
  onPct,
  onScope,
  onHelper,
  onUndo,
}: {
  selected: PriceRow | null;
  pct: number;
  scope: 'row' | 'all';
  canUndo: boolean;
  onPct(pct: number): void;
  onScope(scope: 'row' | 'all'): void;
  onHelper(kind: PriceHelper): void;
  onUndo(): void;
}) {
  const { t } = useTranslation('sheets');
  const stepPct = (dir: 1 | -1) => {
    const index = PCT_STEPS.indexOf(pct as (typeof PCT_STEPS)[number]);
    const next = PCT_STEPS[Math.min(PCT_STEPS.length - 1, Math.max(0, index + dir))];
    if (next !== undefined) onPct(next);
  };
  const stamp =
    'inline-flex h-11 shrink-0 items-center gap-1 rounded-lg border-[3px] border-dashed px-2.5 font-display text-sm tracking-wide whitespace-nowrap uppercase transition-transform duration-75 active:scale-95 disabled:opacity-40';
  return (
    <div className="shrink-0 border-t-[3px] border-ink bg-sunLight/90 px-3 pt-2 pb-2.5 [@media(max-height:500px)]:py-1.5">
      {selected ? (
        <div className="mb-2 [@media(max-height:500px)]:hidden">
          <p className="text-xs font-bold text-ink/70">
            {t('prices.why', {
              name: selected.product.name,
              market: formatMoney(selected.marketCents),
            })}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <ReactionBubble reaction={selected.reaction} />
            <ReactionMeter
              priceCents={selected.priceCents}
              marketCents={selected.marketCents}
              className="min-w-0 flex-1"
            />
          </div>
        </div>
      ) : (
        <p className="mb-2 text-sm font-bold">{t('prices.pick')}</p>
      )}
      <div className="rail flex flex-wrap items-center gap-1.5 [@media(max-height:500px)]:flex-nowrap [@media(max-height:500px)]:overflow-x-auto">
        <span className="sr-only">{t('prices.helpers.title')}</span>
        <button
          type="button"
          className={`${stamp} border-teal text-teal`}
          onClick={() => onHelper('msrp')}
        >
          {t('prices.helpers.msrp')}
        </button>
        <button
          type="button"
          className={`${stamp} border-sky text-sky`}
          onClick={() => onHelper('market')}
        >
          {t('prices.helpers.market')}
        </button>
        <span className={`${stamp} gap-0 border-grape p-0 text-grape`}>
          <button
            type="button"
            className="grid h-full w-8 place-items-center"
            aria-label={t('prices.helpers.pctLess')}
            onClick={() => stepPct(-1)}
          >
            −
          </button>
          <button type="button" className="h-full px-1" onClick={() => onHelper('marketPlus')}>
            {t('prices.helpers.marketPlus', { pct })}
          </button>
          <button
            type="button"
            className="grid h-full w-8 place-items-center"
            aria-label={t('prices.helpers.pctMore')}
            onClick={() => stepPct(1)}
          >
            +
          </button>
        </span>
        <button
          type="button"
          className={`${stamp} border-coral text-coral`}
          onClick={() => onHelper('round99')}
        >
          {t('prices.helpers.round')}
        </button>
        <button
          type="button"
          className={`${stamp} border-ink text-ink`}
          disabled={!canUndo}
          onClick={onUndo}
        >
          ↶ {t('prices.helpers.undo')}
        </button>
        <fieldset className="ml-auto flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white p-0.5">
          <legend className="sr-only">{t('prices.helpers.scopeLabel')}</legend>
          {(['row', 'all'] as const).map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-full px-2.5 py-1.5 text-xs font-extrabold has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-sky ${
                scope === value ? 'bg-ink text-paper' : 'text-ink'
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                name="price-scope"
                checked={scope === value}
                onChange={() => onScope(value)}
              />
              {value === 'row' ? t('prices.helpers.row') : t('prices.helpers.all')}
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
