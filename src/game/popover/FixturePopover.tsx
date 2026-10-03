import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ProductArt } from '@/art/packs/ProductArt';
import { playSfx } from '@/audio';
import { formatMoney } from '@/core/money';
import { checkoutAtRegister, runCommand } from '@/game/actions';
import { parseCardKey } from '@/sim/cards';
import type { Command } from '@/sim/commands';
import { priceReaction } from '@/sim/pricing';
import { SINGLES_CASE_UNLOCK } from '@/sim/systems/stock';
import { useGameStore } from '@/state/gameStore';
import { Button } from '@/ui/components/Button';
import {
  casePicks,
  compatibleProducts,
  type FixtureView,
  fixtureOrdinal,
  fixtureView,
  type SlotView,
} from '../sheets/model/fixture';
import { restockPreview } from '../sheets/model/inventory';
import type { CardStacks, Prices, Sealed } from '../sheets/model/stock';
import { CardThumb } from '../sheets/parts/CardThumb';
import { CloseKey } from '../sheets/parts/controls';
import {
  NO_FIXTURES,
  NO_LANE,
  NO_PRICES,
  NO_SEALED,
  NO_STACKS,
  NO_UNLOCKS,
  VIEW,
} from '../sheets/parts/empty';
import { useReducedMotion } from '../sheets/parts/hooks';
import {
  BoxIcon,
  CaseIcon,
  LockIcon,
  ShelfIcon,
  StockIcon,
  StockOutIcon,
} from '../sheets/parts/icons';
import { PriceEditor, PriceTag, ReactionBubble } from '../sheets/parts/price';
import '../sheets/sheets.css';

/**
 * Fixture Popover (docs/05 §5.3): slot tiles with counts, capacity and price tags, and quick
 * actions (Fill, Swap product, Price, Clear, Restock this fixture). Rendered by the live scene in
 * its world overlay, anchored to the fixture (src/scene/live/types.ts `anchored`), so it stays
 * compact (≈ 320 px) and opaque enough to read over the shop.
 */
export interface FixturePopoverProps {
  fixtureUid: string;
  onClose(): void;
}

type Mode = 'actions' | 'pickProduct' | 'pickSingle' | 'price';

function run(command: Command): boolean {
  return runCommand(command).ok;
}

export function FixturePopover({ fixtureUid, onClose }: FixturePopoverProps) {
  const { t } = useTranslation('sheets');
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>('actions');
  const data = useGameStore(
    useShallow((store) => ({
      fixtures: store.game?.shop.fixtures ?? NO_FIXTURES,
      sealed: store.game?.inventory.sealed ?? NO_SEALED,
      stacks: store.game?.inventory.cardStacks ?? NO_STACKS,
      prices: store.game?.pricing.prices ?? NO_PRICES,
      unlocked: store.game?.progression.unlocked ?? NO_UNLOCKS,
      lane: store.game?.customers.lane ?? NO_LANE,
      phase: store.game?.clock.phase ?? 'prep',
    })),
  );
  const fixture = data.fixtures.find((entry) => entry.uid === fixtureUid);
  const view = fixture ? fixtureView(fixture, data.prices, data.sealed, VIEW) : null;
  if (!view) return null;
  const { kind, ordinal, count } = fixtureOrdinal(data.fixtures, fixtureUid, VIEW.content);
  const name = t(`fixture.${kind}`, { n: ordinal, count });
  const slot = view.slots[Math.min(selected, view.slots.length - 1)];
  const ready =
    kind === 'shelf' ? restockPreview(data.fixtures, data.sealed, VIEW.content, fixtureUid) : 0;

  const restock = () => {
    let moved = false;
    for (const entry of view.slots) {
      if (entry.canFill)
        moved = run({ type: 'stock/fillSlot', fixtureUid, slot: entry.index }) || moved;
    }
    if (moved) playSfx('shop.restock');
  };
  const choose = (index: number) => {
    playSfx('ui.pop');
    setSelected(index);
    const target = view.slots[index];
    const empty = !target || target.qty === 0;
    setMode(
      empty && kind === 'shelf' && !target?.productId
        ? 'pickProduct'
        : empty && kind === 'case'
          ? 'pickSingle'
          : 'actions',
    );
  };

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <motion.div
        role="dialog"
        aria-label={name}
        className="ff-sheet pointer-events-auto flex max-h-[min(640px,calc(100dvh-16px))] w-[320px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-[18px] border-[3px] border-ink bg-paper text-ink shadow-[0_5px_0_var(--color-ink),0_18px_40px_-12px_rgb(18_22_52/0.6)]"
        initial={{ scale: 0.85, y: 10, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 30 }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && mode !== 'actions') {
            event.stopPropagation();
            setMode('actions');
          }
        }}
      >
        <header className="skin-plank flex items-center gap-2 border-b-[3px] border-ink py-1.5 pr-1.5 pl-3 text-paper">
          <span className="grid size-8 place-items-center rounded-lg border-2 border-ink bg-paper">
            {kind === 'case' ? (
              <CaseIcon size={22} />
            ) : kind === 'shelf' ? (
              <ShelfIcon size={22} />
            ) : (
              <BoxIcon size={22} />
            )}
          </span>
          <h2 className="min-w-0 flex-1 truncate font-display text-lg tracking-wide [text-shadow:0_2px_0_var(--color-ink)]">
            {name}
          </h2>
          {kind === 'shelf' ? (
            <Button
              size="sm"
              variant="gold"
              className="h-11! px-2.5!"
              icon={<StockIcon />}
              disabled={ready === 0}
              aria-label={t('popover.restockAria', { count: ready })}
              onClick={restock}
            >
              {t('popover.restock')}
              {ready > 0 ? <span className="tabular-nums">+{ready}</span> : null}
            </Button>
          ) : null}
          <CloseKey onClose={onClose} tone="light" className="size-10! pointer-coarse:size-11!" />
        </header>

        <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto">
          {kind === 'register' ? (
            <RegisterBody queue={data.lane.length} open={data.phase === 'open'} />
          ) : kind === 'other' ? (
            <p className="p-4 font-hand text-xl font-bold">{t('popover.decor')}</p>
          ) : kind === 'case' && data.unlocked[SINGLES_CASE_UNLOCK] === undefined ? (
            <p className="flex items-center gap-2 p-4 font-bold">
              <LockIcon size={28} />
              {t('popover.caseLocked', {
                level: VIEW.content.unlocks.get(SINGLES_CASE_UNLOCK)?.level ?? 2,
              })}
            </p>
          ) : (
            <>
              <ul className={`grid gap-2 p-2.5 ${kind === 'case' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {view.slots.map((entry, index) => (
                  <li key={entry.index}>
                    <SlotTile
                      view={view}
                      slot={entry}
                      index={index}
                      active={entry.index === slot?.index}
                      onSelect={() => choose(entry.index)}
                    />
                  </li>
                ))}
              </ul>
              {slot ? (
                <SlotPanel
                  fixtureUid={fixtureUid}
                  view={view}
                  slot={slot}
                  mode={mode}
                  setMode={setMode}
                  sealed={data.sealed}
                  stacks={data.stacks}
                  prices={data.prices}
                />
              ) : null}
              {kind === 'shelf' ? (
                <p className="border-t-2 border-dashed border-ink/25 px-3 py-1.5 text-xs font-semibold text-ink/70">
                  {t('popover.restockHint')}
                </p>
              ) : null}
            </>
          )}
        </div>
      </motion.div>
    </MotionConfig>
  );
}

function slotContent(
  view: FixtureView,
  slot: SlotView,
  t: (key: 'popover.empty' | 'popover.soldOut') => string,
): string {
  if (slot.productId && slot.qty > 0) return VIEW.content.products.get(slot.productId)?.name ?? '';
  if (slot.cardKey) {
    const print = parseCardKey(slot.cardKey);
    return (print && VIEW.content.cards.get(print.cardId)?.name) || '';
  }
  return view.kind === 'shelf' && slot.productId ? t('popover.soldOut') : t('popover.empty');
}

function SlotTile({
  view,
  slot,
  index,
  active,
  onSelect,
}: {
  view: FixtureView;
  slot: SlotView;
  index: number;
  active: boolean;
  onSelect(): void;
}) {
  const { t } = useTranslation('sheets');
  const card = slot.cardKey
    ? VIEW.content.cards.get(parseCardKey(slot.cardKey)?.cardId ?? '')
    : undefined;
  const finish = slot.cardKey ? parseCardKey(slot.cardKey)?.finish : undefined;
  const pulse = slot.level === 'low' || slot.level === 'soldOut';
  const fill = slot.capacity > 0 ? slot.qty / slot.capacity : 0;
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      aria-label={t('popover.slotAria', { n: slot.index + 1, content: slotContent(view, slot, t) })}
      onClick={onSelect}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 26, delay: index * 0.03 }}
      className={`relative flex w-full flex-col items-center rounded-xl border-[3px] px-1 pt-1.5 pb-1 transition-colors ${
        active
          ? 'border-ink bg-sunLight shadow-[0_3px_0_var(--color-ink)]'
          : 'border-ink/70 bg-white hover:bg-sunLight/60'
      } ${slot.qty === 0 && slot.level === 'empty' ? 'border-dashed' : ''} ${pulse ? 'pulse-low' : ''}`}
    >
      <span
        className={`grid w-full place-items-center ${view.kind === 'case' ? 'h-[78px]' : 'h-[68px]'}`}
      >
        {slot.productId && slot.qty > 0 ? (
          <ProductArt productId={slot.productId} height={64} />
        ) : card && slot.qty > 0 ? (
          <CardThumb card={card} finish={finish} width={44} />
        ) : slot.level === 'soldOut' ? (
          <span className="flex flex-col items-center text-coral">
            <StockOutIcon size={36} />
            <span className="font-display text-xs">{t('popover.soldOut')}</span>
          </span>
        ) : (
          <span className="grid size-10 place-items-center rounded-full border-[3px] border-dashed border-ink/40 font-display text-2xl text-ink/45">
            +
          </span>
        )}
      </span>
      {view.kind === 'shelf' ? (
        <span className="mt-1 flex w-full items-center gap-1 px-0.5">
          <span className="relative h-2.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-paper2">
            <span
              className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${
                slot.level === 'low' ? 'bg-coral' : 'bg-teal'
              }`}
              style={{ width: `${fill * 100}%` }}
            />
          </span>
          <span className="font-display text-xs tabular-nums">
            {slot.productId
              ? t('popover.qty', { qty: slot.qty, capacity: slot.capacity })
              : t('popover.empty')}
          </span>
        </span>
      ) : null}
      {slot.priceCents !== null && (slot.qty > 0 || slot.productId) ? (
        <span className="pointer-events-none absolute -top-2 -right-1.5 rotate-6">
          <PriceTag
            cents={slot.priceCents}
            size="sm"
            tone={slot.hasOverride ? 'sun' : 'paper'}
            swing={slot.priceCents}
          />
        </span>
      ) : null}
    </motion.button>
  );
}

function SlotPanel({
  fixtureUid,
  view,
  slot,
  mode,
  setMode,
  sealed,
  stacks,
  prices,
}: {
  fixtureUid: string;
  view: FixtureView;
  slot: SlotView;
  mode: Mode;
  setMode(mode: Mode): void;
  sealed: Sealed;
  stacks: CardStacks;
  prices: Prices;
}) {
  const { t } = useTranslation('sheets');
  const ref = { fixtureUid, slot: slot.index };
  const product = slot.productId ? VIEW.content.products.get(slot.productId) : undefined;
  const hasThing = slot.qty > 0 || (view.kind === 'shelf' && !!slot.productId);

  let body: ReactNode = null;
  if (mode === 'pickProduct') {
    const options = compatibleProducts(view.def, sealed, VIEW);
    body = (
      <PickerFrame title={t('popover.pickProduct')}>
        {options.length === 0 ? (
          <p className="p-2 text-sm">{t('popover.noProducts')}</p>
        ) : (
          options.map(({ product: option, inStorage }) => (
            <button
              key={option.id}
              type="button"
              className="flex min-h-12 w-full items-center gap-2 rounded-lg px-1.5 text-left hover:bg-sunLight"
              onClick={() => {
                if (slot.qty > 0 && slot.productId !== option.id)
                  run({ type: 'stock/clearSlot', ...ref });
                if (run({ type: 'stock/fillSlot', ...ref, productId: option.id })) {
                  playSfx('shop.restock');
                  setMode('actions');
                }
              }}
            >
              <ProductArt productId={option.id} height={40} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{option.name}</span>
              <span className="shrink-0 rounded-md bg-paper2 px-1.5 text-xs font-bold">
                {t('popover.inBack', { count: inStorage })}
              </span>
            </button>
          ))
        )}
      </PickerFrame>
    );
  } else if (mode === 'pickSingle') {
    body = (
      <SinglePicker
        stacks={stacks}
        onPick={(cardKey) => {
          if (slot.qty > 0) run({ type: 'stock/clearSlot', ...ref });
          if (run({ type: 'stock/fillSlot', ...ref, cardKey })) {
            playSfx('shop.restock');
            setMode('actions');
          }
        }}
      />
    );
  } else if (mode === 'price' && slot.priceCents !== null) {
    body = (
      <SlotPricer
        fixtureUid={fixtureUid}
        slot={slot}
        productName={product?.name ?? ''}
        skuCents={slot.productId ? (prices[slot.productId] ?? null) : null}
      />
    );
  }

  const actions: {
    key: string;
    label: string;
    onClick(): void;
    disabled?: boolean;
    tone?: 'primary' | 'secondary' | 'danger';
  }[] = [];
  if (view.kind === 'shelf') {
    if (slot.productId) {
      actions.push({
        key: 'fill',
        label: t('popover.actions.fill'),
        disabled: !slot.canFill,
        tone: 'primary',
        onClick: () => {
          if (run({ type: 'stock/fillSlot', ...ref })) playSfx('shop.restock');
        },
      });
    } else {
      actions.push({
        key: 'stock',
        label: t('popover.actions.stock'),
        tone: 'primary',
        onClick: () => setMode('pickProduct'),
      });
    }
    if (slot.productId)
      actions.push({
        key: 'swap',
        label: t('popover.actions.swap'),
        onClick: () => setMode(mode === 'pickProduct' ? 'actions' : 'pickProduct'),
      });
  } else if (view.kind === 'case') {
    actions.push({
      key: 'pick',
      label: slot.qty > 0 ? t('popover.actions.swap') : t('popover.actions.pick'),
      tone: slot.qty > 0 ? 'secondary' : 'primary',
      onClick: () => setMode(mode === 'pickSingle' ? 'actions' : 'pickSingle'),
    });
  }
  if (hasThing && slot.priceCents !== null) {
    actions.push({
      key: 'price',
      label: t('popover.actions.price'),
      onClick: () => setMode(mode === 'price' ? 'actions' : 'price'),
    });
  }
  if (slot.qty > 0 || slot.productId) {
    actions.push({
      key: 'clear',
      label: t('popover.actions.clear'),
      tone: 'danger',
      onClick: () => {
        if (run({ type: 'stock/clearSlot', ...ref })) {
          playSfx('ui.close');
          setMode('actions');
        }
      },
    });
  }

  return (
    <div className="border-t-[3px] border-ink bg-paper2/70 px-2.5 pt-2 pb-2.5">
      <div className="flex items-center justify-between gap-2 pb-1.5">
        <p className="min-w-0 truncate font-display text-sm tracking-wide">
          {t('popover.slot', { n: slot.index + 1 })}
          <span className="font-ui font-bold text-ink/70"> · {slotContent(view, slot, t)}</span>
        </p>
        {slot.marketCents !== null && slot.priceCents !== null && slot.qty > 0 ? (
          <ReactionBubble
            reaction={priceReaction(
              slot.priceCents,
              slot.marketCents,
              VIEW.balance.customers.reaction,
            )}
            compact
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Button
            key={action.key}
            size="sm"
            variant={action.tone ?? 'secondary'}
            className="h-11! min-w-0 flex-1 px-2!"
            disabled={action.disabled}
            aria-expanded={
              action.key === 'price'
                ? mode === 'price'
                : action.key === 'swap' || action.key === 'pick' || action.key === 'stock'
                  ? mode === 'pickProduct' || mode === 'pickSingle'
                  : undefined
            }
            onClick={() => {
              playSfx('ui.pop');
              action.onClick();
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>
      <AnimatePresence initial={false} mode="wait">
        {body ? (
          <motion.div
            key={mode}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2">{body}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function PickerFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-ink bg-white">
      <p className="border-b-2 border-dashed border-ink/25 px-2 py-1 font-hand text-lg font-bold">
        {title}
      </p>
      <div className="sheet-scroll max-h-48 overflow-y-auto p-1">{children}</div>
    </div>
  );
}

/** Pick a single for a case slot: searchable, most valuable first (docs/05 §5.3). */
function SinglePicker({ stacks, onPick }: { stacks: CardStacks; onPick(cardKey: string): void }) {
  const { t } = useTranslation('sheets');
  const [query, setQuery] = useState('');
  const picks = casePicks(stacks, query, VIEW).slice(0, 40);
  return (
    <div className="rounded-xl border-2 border-ink bg-white">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && query) {
            event.stopPropagation();
            setQuery('');
          }
        }}
        placeholder={t('popover.search')}
        aria-label={t('popover.search')}
        className="h-11 w-full rounded-t-[10px] border-b-2 border-dashed border-ink/25 bg-transparent px-2.5 font-semibold outline-none placeholder:text-ink/45"
      />
      <div className="sheet-scroll max-h-52 overflow-y-auto p-1">
        {picks.length === 0 ? <p className="p-2 text-sm">{t('popover.noSingles')}</p> : null}
        {picks.map((pick) => (
          <button
            key={pick.key}
            type="button"
            className="flex min-h-12 w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-sunLight"
            onClick={() => onPick(pick.key)}
          >
            <CardThumb card={pick.card} finish={pick.finish} width={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{pick.card.name}</span>
              <span className="block text-xs text-ink/65">
                #{String(pick.card.number).padStart(3, '0')} · {t(`finish.${pick.finish}`)} · ×
                {pick.count}
              </span>
            </span>
            <PriceTag cents={pick.valueCents} size="sm" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Price a slot: the SKU price for shelves (or just this slot), the tag for case singles. */
function SlotPricer({
  fixtureUid,
  slot,
  productName,
  skuCents,
}: {
  fixtureUid: string;
  slot: SlotView;
  productName: string;
  /** The product's shop-wide price (shown while editing only this slot). */
  skuCents: number | null;
}) {
  const { t } = useTranslation('sheets');
  const isSingle = slot.cardKey !== undefined;
  const [slotOnly, setSlotOnly] = useState(isSingle || slot.hasOverride);
  const cents = slot.priceCents ?? 0;
  const set = (next: number) => {
    if (slotOnly || isSingle || !slot.productId) {
      run({ type: 'pricing/setSlotPrice', fixtureUid, slot: slot.index, cents: next });
    } else {
      run({ type: 'pricing/setPrice', productId: slot.productId, cents: next });
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex justify-center">
        <PriceEditor
          cents={cents}
          onChange={set}
          label={productName}
          size="sm"
          tone={slotOnly ? 'sun' : 'paper'}
        />
      </div>
      {!isSingle && slot.productId ? (
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 text-sm font-bold">
          <input
            type="checkbox"
            checked={slotOnly}
            onChange={(event) => setSlotOnly(event.target.checked)}
            className="size-5 accent-teal"
          />
          {slotOnly ? t('popover.slotOnly') : t('popover.everywhere', { name: productName })}
          {slotOnly && skuCents !== null ? (
            <span className="font-semibold text-ink/60">
              {t('popover.shopPrice', { price: formatMoney(skuCents) })}
            </span>
          ) : null}
        </label>
      ) : null}
    </div>
  );
}

function RegisterBody({ queue, open }: { queue: number; open: boolean }) {
  const { t } = useTranslation('sheets');
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2" aria-hidden="true">
          {Array.from({ length: Math.min(queue, 4) }, (_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholder heads
              key={i}
              className="size-8 rounded-full border-[3px] border-ink bg-sky"
              style={{ filter: `hue-rotate(${i * 70}deg)` }}
            />
          ))}
        </div>
        <p className="font-display text-lg tracking-wide">
          {queue > 0 ? t('popover.register.queue', { count: queue }) : t('popover.register.none')}
        </p>
      </div>
      <p className="text-sm text-ink/75">
        {open ? t('popover.register.hint') : t('popover.register.closed')}
      </p>
      <Button
        size="md"
        variant="gold"
        className="w-full"
        disabled={!open || queue === 0}
        onClick={() => {
          if (checkoutAtRegister().ok) playSfx('shop.chaChing');
        }}
      >
        {t('popover.register.ringUp')}
      </Button>
    </div>
  );
}
