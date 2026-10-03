import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductArt } from '@/art/packs/ProductArt';
import { playSfx } from '@/audio';
import { formatMoney } from '@/core/money';
import { openProductWithStage, runCommand } from '@/game/actions';
import { useUiStore } from '@/state/uiStore';
import { Button } from '@/ui/components/Button';
import { fixtureOrdinal } from '../model/fixture';
import { restockPreview, type SealedRow, shelfTargets } from '../model/inventory';
import type { Fixtures, Sealed } from '../model/stock';
import { Bump } from '../parts/controls';
import { VIEW } from '../parts/empty';
import { BoxIcon, BreakIcon, RipIcon, ShelfIcon, StockIcon, TruckIcon } from '../parts/icons';

/** Sealed tab of the Backroom: product boxes on wooden shelves (docs/05 §5.4). */
export function SealedPanel({
  rows,
  fixtures,
  sealed,
  onBreak,
}: {
  rows: readonly SealedRow[];
  fixtures: Fixtures;
  sealed: Sealed;
  onBreak(row: SealedRow): void;
}) {
  const { t } = useTranslation('sheets');
  const ready = restockPreview(fixtures, sealed, VIEW.content);
  const restockAll = () => {
    const result = runCommand({ type: 'stock/restockAll' });
    if (result.ok) playSfx('shop.restock');
  };

  if (rows.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="kraft max-w-xs -rotate-1 rounded-2xl border-[3px] border-ink p-5 shadow-[0_4px_0_var(--color-ink)]">
          <BoxIcon size={48} />
          <p className="mt-2 font-display text-xl">{t('inventory.sealed.emptyTitle')}</p>
          <p className="mt-1 text-sm text-ink/75">{t('inventory.sealed.emptyBody')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="@container px-4 pt-3 pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-hand text-xl font-bold text-paper [text-shadow:0_2px_0_var(--color-ink)]">
          {ready > 0
            ? t('inventory.sealed.restockReady', { count: ready })
            : t('inventory.sealed.restockDone')}
        </p>
        <Button
          variant="gold"
          size="md"
          icon={<StockIcon />}
          disabled={ready === 0}
          onClick={restockAll}
        >
          {t('inventory.sealed.restockAll')}
        </Button>
      </div>
      <ul className="grid gap-x-5 gap-y-10 @xl:grid-cols-2">
        {rows.map((row, index) => (
          <SealedTile
            key={row.product.id}
            row={row}
            index={index}
            fixtures={fixtures}
            onBreak={() => onBreak(row)}
          />
        ))}
      </ul>
    </div>
  );
}

function CountChip({
  icon,
  count,
  label,
  hatch = false,
}: {
  icon: ReactNode;
  count: number;
  label: string;
  hatch?: boolean;
}) {
  return (
    <span
      className={`inline-flex h-8 items-center gap-1 rounded-lg border-2 border-ink px-1.5 text-sm font-bold ${
        hatch ? 'hatch-incoming' : 'bg-paper'
      } ${count === 0 ? 'opacity-55' : ''}`}
    >
      {icon}
      <Bump value={count} className="font-display text-base">
        {count}
      </Bump>
      <span className="text-xs">{label}</span>
    </span>
  );
}

function SealedTile({
  row,
  index,
  fixtures,
  onBreak,
}: {
  row: SealedRow;
  index: number;
  fixtures: Fixtures;
  onBreak(): void;
}) {
  const { t } = useTranslation('sheets');
  const [picking, setPicking] = useState(false);
  const { product } = row;
  const isDisplay = row.packsInside > 1 && row.canBreak;
  const rip = () => {
    const result = openProductWithStage(product.id);
    if (result.ok) playSfx('pack.tear');
  };
  return (
    <motion.li
      initial={{ y: 18, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26, delay: Math.min(index, 8) * 0.04 }}
      className="shelf-board"
    >
      <article
        aria-label={product.name}
        className="kraft relative z-[1] rounded-2xl border-[3px] border-ink p-3 shadow-[0_4px_0_var(--color-ink)]"
      >
        <span className="tape absolute -top-2.5 left-8 h-5 w-16 -rotate-3" aria-hidden="true" />
        <div className="flex gap-3">
          <div className="grid h-24 w-20 shrink-0 place-items-end justify-center">
            <ProductArt
              productId={product.id}
              height={isDisplay ? 62 : 94}
              className="drop-shadow-[0_4px_0_rgb(30_35_64/0.35)]"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="inline-block -rotate-1 rounded-md border-2 border-ink bg-paper px-2 py-0.5 font-display text-base leading-tight tracking-wide shadow-[0_2px_0_var(--color-ink)]">
              {product.name}
            </h3>
            <p className="mt-2 text-sm font-semibold text-ink/80">
              {row.avgCostCents !== null
                ? t('inventory.sealed.avgCost', { price: formatMoney(row.avgCostCents) })
                : t('inventory.sealed.noCost')}
            </p>
            <p className="text-sm font-semibold text-ink/60">
              {t('inventory.sealed.msrp', { price: formatMoney(product.msrpCents) })}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <CountChip
            icon={<BoxIcon size={18} />}
            count={row.inStorage}
            label={t('inventory.sealed.inBack')}
          />
          <CountChip
            icon={<ShelfIcon size={18} />}
            count={row.onShelf}
            label={t('inventory.sealed.onShelf')}
          />
          {row.incoming > 0 ? (
            <CountChip
              icon={<TruckIcon size={18} />}
              count={row.incoming}
              label={t('inventory.sealed.incoming')}
              hatch
            />
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {row.canOpen ? (
            <Button size="md" icon={<RipIcon />} disabled={row.inStorage === 0} onClick={rip}>
              {row.packsInside > 1
                ? t('inventory.sealed.ripAll', { count: row.packsInside })
                : t('inventory.sealed.rip')}
            </Button>
          ) : null}
          {row.canBreak ? (
            <Button
              variant="gold"
              size="md"
              icon={<BreakIcon />}
              disabled={row.inStorage === 0}
              onClick={onBreak}
            >
              {t('inventory.sealed.break')}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="md"
            icon={<StockIcon />}
            aria-expanded={picking}
            disabled={row.inStorage === 0}
            onClick={() => {
              playSfx('ui.pop');
              setPicking((open) => !open);
            }}
          >
            {t('inventory.sealed.stock')}
          </Button>
        </div>
        <AnimatePresence initial={false}>
          {picking ? (
            <ShelfPicker
              productId={product.id}
              fixtures={fixtures}
              onDone={() => setPicking(false)}
            />
          ) : null}
        </AnimatePresence>
      </article>
    </motion.li>
  );
}

/** "Stock a shelf": pick a slot, or jump to the fixture in the shop (docs/05 §5.4). */
function ShelfPicker({
  productId,
  fixtures,
  onDone,
}: {
  productId: string;
  fixtures: Fixtures;
  onDone(): void;
}) {
  const { t } = useTranslation('sheets');
  const targets = shelfTargets(productId, fixtures, VIEW.content).slice(0, 4);
  const fixtureName = (uid: string) => {
    const { kind, ordinal, count } = fixtureOrdinal(fixtures, uid, VIEW.content);
    return t(`fixture.${kind}`, { n: ordinal, count });
  };
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-3 rounded-xl border-2 border-dashed border-ink/50 bg-paper/80 p-2">
        <p className="px-1 font-hand text-lg font-bold">{t('inventory.picker.title')}</p>
        {targets.length === 0 ? (
          <p className="px-1 pb-1 text-sm">{t('inventory.picker.none')}</p>
        ) : (
          <ul className="grid gap-1.5">
            {targets.map((target) => (
              <li key={`${target.fixtureUid}#${target.slot}`} className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border-2 border-ink bg-white px-2.5 text-left text-sm font-bold shadow-[0_2px_0_var(--color-ink)] transition-transform active:translate-y-[2px] active:shadow-none"
                  onClick={() => {
                    const result = runCommand({
                      type: 'stock/fillSlot',
                      fixtureUid: target.fixtureUid,
                      slot: target.slot,
                      productId,
                    });
                    if (result.ok) {
                      playSfx('shop.restock');
                      onDone();
                    }
                  }}
                >
                  <span className="truncate">
                    {t('inventory.picker.slot', {
                      fixture: fixtureName(target.fixtureUid),
                      slot: target.slot + 1,
                    })}
                  </span>
                  <span className="shrink-0 text-xs text-ink/70">
                    {target.replaces
                      ? t('inventory.picker.replaces', {
                          name: VIEW.content.products.get(target.replaces)?.name ?? '',
                        })
                      : target.qty > 0
                        ? t('inventory.picker.topUp', {
                            qty: target.qty,
                            capacity: target.capacity,
                          })
                        : t('inventory.picker.empty')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {targets[0] ? (
          <button
            type="button"
            className="mt-1.5 min-h-11 px-1 text-sm font-bold text-teal underline decoration-2 underline-offset-2"
            onClick={() => {
              const uid = targets[0]?.fixtureUid;
              if (uid) useUiStore.getState().openFixture(uid);
            }}
          >
            {t('inventory.picker.show')}
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
