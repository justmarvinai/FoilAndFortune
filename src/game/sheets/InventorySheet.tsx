import { AnimatePresence, MotionConfig } from 'motion/react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ProductArt } from '@/art/packs/ProductArt';
import { playSfx } from '@/audio';
import { formatMoney } from '@/core/money';
import { runCommand } from '@/game/actions';
import { useGameStore } from '@/state/gameStore';
import { Button } from '@/ui/components/Button';
import { useToasts } from '@/ui/components/Toasts';
import { SealedPanel } from './inventory/SealedPanel';
import { SinglesPanel } from './inventory/SinglesPanel';
import { breakExtraUnits, loosePackId, type SealedRow, sealedRows } from './model/inventory';
import { storageSummary } from './model/stock';
import { ConfirmNote } from './parts/ConfirmNote';
import { CloseKey, Tabs } from './parts/controls';
import {
  NO_COLLECTION,
  NO_FIXTURES,
  NO_ORDERS,
  NO_PERKS,
  NO_SEALED,
  NO_STACKS,
  NO_UNLOCKS,
  VIEW,
} from './parts/empty';
import { useReducedMotion } from './parts/hooks';
import { BreakIcon, CrateLogo, RipIcon } from './parts/icons';
import { StorageMeter } from './parts/StorageMeter';
import type { SheetProps } from './types';
import './sheets.css';

type Tab = 'sealed' | 'singles';

/**
 * The Backroom (docs/05 §5.4): a wood-panel stockroom with a painted sign, the closet meter, and
 * folder tabs for sealed product and singles.
 */
export default function InventorySheet({ onClose }: SheetProps) {
  const { t } = useTranslation('sheets');
  const reduced = useReducedMotion();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [tab, setTab] = useState<Tab>('sealed');
  const [breaking, setBreaking] = useState<SealedRow | null>(null);
  const game = useGameStore(
    useShallow((store) => ({
      sealed: store.game?.inventory.sealed ?? NO_SEALED,
      stacks: store.game?.inventory.cardStacks ?? NO_STACKS,
      fixtures: store.game?.shop.fixtures ?? NO_FIXTURES,
      orders: store.game?.suppliers.orders ?? NO_ORDERS,
      perks: store.game?.progression.perks ?? NO_PERKS,
      unlocked: store.game?.progression.unlocked ?? NO_UNLOCKS,
      collection: store.game?.collection ?? NO_COLLECTION,
      day: store.game?.clock.day ?? 1,
    })),
  );
  const storage = storageSummary(game.sealed, game.orders, game.perks, VIEW);
  const rows = sealedRows(game.sealed, game.fixtures, game.orders, VIEW.content);
  const singlesCount = Object.values(game.stacks).reduce((sum, count) => sum + count, 0);

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <section
        aria-labelledby={`${id}-title`}
        className="ff-sheet skin-backroom relative flex h-full flex-col overflow-hidden rounded-[22px] border-[3px] border-ink shadow-[0_6px_0_var(--color-ink)]"
      >
        <header className="skin-plank relative flex items-center gap-3 border-b-[3px] border-ink px-4 py-3 [@media(max-height:500px)]:py-1.5">
          <span className="nail absolute top-2 left-2" aria-hidden="true" />
          <span className="nail absolute right-2 bottom-2" aria-hidden="true" />
          <span className="hidden -rotate-6 sm:block" aria-hidden="true">
            <CrateLogo size={40} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={`${id}-title`}
              className="font-display text-3xl leading-none tracking-wider text-sun uppercase [text-shadow:0_3px_0_var(--color-ink)] [@media(max-height:500px)]:text-2xl"
            >
              {t('inventory.title')}
            </h2>
            <StorageMeter summary={storage} className="mt-1.5 max-w-80" />
          </div>
          <CloseKey onClose={onClose} />
        </header>

        <Tabs<Tab>
          label={t('inventory.tabsLabel')}
          idPrefix={id}
          value={tab}
          onChange={setTab}
          className="relative z-[1] -mb-[3px] flex gap-1.5 px-4 pt-2.5"
          tabClass={(active) =>
            `inline-flex h-11 items-center gap-2 rounded-t-xl border-[3px] border-ink px-4 font-display tracking-wide transition-[transform,background-color] duration-100 ${
              active
                ? 'kraft border-b-transparent text-ink'
                : 'kraft-deep translate-y-1 text-ink/75 hover:translate-y-0.5'
            }`
          }
          tabs={[
            {
              id: 'sealed',
              label: t('inventory.tabs.sealed'),
              badge: <TabCount value={rows.reduce((sum, row) => sum + row.inStorage, 0)} />,
            },
            {
              id: 'singles',
              label: t('inventory.tabs.singles'),
              badge: <TabCount value={singlesCount} />,
            },
          ]}
        />

        <div
          role="tabpanel"
          id={`${id}-panel-${tab}`}
          aria-labelledby={`${id}-tab-${tab}`}
          className={`relative min-h-0 flex-1 border-t-[3px] border-ink ${
            tab === 'sealed' ? 'sheet-scroll overflow-y-auto' : 'flex flex-col'
          }`}
        >
          {tab === 'sealed' ? (
            <SealedPanel
              rows={rows}
              fixtures={game.fixtures}
              sealed={game.sealed}
              onBreak={(row) => {
                playSfx('ui.open');
                setBreaking(row);
              }}
            />
          ) : (
            <SinglesPanel
              stacks={game.stacks}
              collection={game.collection}
              day={game.day}
              fixtures={game.fixtures}
              unlocked={game.unlocked}
            />
          )}
        </div>

        <AnimatePresence>
          {breaking ? (
            <BreakConfirm row={breaking} free={storage.free} onDone={() => setBreaking(null)} />
          ) : null}
        </AnimatePresence>
      </section>
    </MotionConfig>
  );
}

function TabCount({ value }: { value: number }) {
  return (
    <span className="rounded-full border-2 border-ink bg-paper px-1.5 font-display text-xs tabular-nums">
      {value}
    </span>
  );
}

/**
 * Open, sell, or break (docs/01 §14.4): the friendly explainer before breaking a box into loose
 * packs, with the cost per pack and the closet space it needs.
 */
function BreakConfirm({ row, free, onDone }: { row: SealedRow; free: number; onDone(): void }) {
  const { t } = useTranslation('sheets');
  const push = useToasts((store) => store.push);
  const { product } = row;
  const needed = breakExtraUnits(product, VIEW.content);
  const fits = needed <= free;
  const packId = loosePackId(product);
  const pack = packId ? VIEW.content.products.get(packId) : undefined;
  const perPack =
    row.avgCostCents !== null && row.packsInside > 0
      ? Math.round(row.avgCostCents / row.packsInside)
      : null;
  const confirm = () => {
    const result = runCommand({ type: 'open/unboxProduct', productId: product.id });
    if (!result.ok) return;
    playSfx('shop.restock');
    push({
      title: t('inventory.break.done', { count: row.packsInside }),
      body: t('inventory.break.doneBody'),
      tone: 'success',
      icon: packId ? <ProductArt productId={packId} height={34} /> : undefined,
    });
    onDone();
  };
  return (
    <ConfirmNote
      title={t('inventory.break.title', { name: product.name })}
      onCancel={onDone}
      actions={
        <>
          <Button variant="secondary" onClick={onDone}>
            {t('inventory.break.keep')}
          </Button>
          <Button variant="gold" icon={<BreakIcon />} disabled={!fits} onClick={confirm}>
            {t('inventory.break.confirm', { count: row.packsInside })}
          </Button>
        </>
      }
    >
      <div className="flex items-center justify-center gap-2 py-1" aria-hidden="true">
        <ProductArt productId={product.id} height={64} />
        <span className="font-display text-2xl">→</span>
        {packId ? (
          <span className="flex -space-x-5">
            {[0, 1, 2].map((variant) => (
              <ProductArt
                key={variant}
                productId={packId}
                variant={variant}
                height={58}
                className={variant === 1 ? '-translate-y-1' : ''}
              />
            ))}
          </span>
        ) : null}
        <span className="font-display text-xl">×{row.packsInside}</span>
      </div>
      <p className="font-hand text-xl leading-tight font-bold">{t('inventory.break.lead')}</p>
      <ul className="space-y-1.5 text-sm">
        <li className="flex gap-2">
          <RipIcon size={18} />
          <span>{t('inventory.break.rip', { count: row.packsInside })}</span>
        </li>
        <li className="flex gap-2">
          <CrateLogo size={18} />
          <span>{t('inventory.break.keepSealed')}</span>
        </li>
        <li className="flex gap-2 font-bold">
          <BreakIcon size={18} />
          <span>{t('inventory.break.loose', { count: row.packsInside })}</span>
        </li>
      </ul>
      <p className="rounded-lg bg-paper2 px-2.5 py-1.5 text-sm">
        {perPack !== null && pack
          ? t('inventory.break.perPack', {
              cost: formatMoney(perPack),
              msrp: formatMoney(pack.msrpCents),
            })
          : null}
        <br />
        <span className={fits ? '' : 'font-bold text-coral'}>
          {fits
            ? t('inventory.break.space', { needed, free })
            : t('inventory.break.noSpace', { needed, free })}
        </span>
      </p>
    </ConfirmNote>
  );
}
