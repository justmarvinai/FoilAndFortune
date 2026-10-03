import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ProductArt } from '@/art/packs/ProductArt';
import { playSfx } from '@/audio';
import { defaultBalance } from '@/content/balance';
import { reputationSubs } from '@/content/balance/reputation';
import { formatClock, weekdayOf } from '@/core/calendar';
import { formatMoney } from '@/core/money';
import { runCommand } from '@/game/actions';
import { reputationStars } from '@/sim/selectors';
import { useGameStore } from '@/state/gameStore';
import { Button } from '@/ui/components/Button';
import { Stamp } from '@/ui/components/Stamp';
import { useToasts } from '@/ui/components/Toasts';
import {
  type Cart,
  type CartCheck,
  type CatalogItem,
  checkCart,
  clampQty,
  maxAffordable,
  orderLines,
  pendingOrders,
  SUPPLIER_TEASERS,
  stepQty,
  supplierCatalog,
  teaserLevel,
} from './model/crate';
import { storageSummary } from './model/stock';
import { CloseKey } from './parts/controls';
import { NO_ORDERS, NO_PERKS, NO_REP, NO_SEALED, VIEW } from './parts/empty';
import { useReducedMotion } from './parts/hooks';
import { BudgetBoxMark, CrateLogo, LockIcon, TeaserMark, TruckIcon } from './parts/icons';
import { StorageMeter } from './parts/StorageMeter';
import type { SheetProps } from './types';
import './sheets.css';

/** Reputation stars from sub-scores; mirrors `reputationScore` (src/sim/selectors). */
function starsOf(sub: Record<(typeof reputationSubs)[number], number>): number {
  let score = 0;
  for (const key of reputationSubs) score += defaultBalance.reputation.weights[key] * sub[key];
  return reputationStars(score);
}

/**
 * Crate, the supplier app on the shop tablet (docs/05 §5.6): supplier tabs (locked ones tease
 * their requirements), product tiles with steppers that respect minimums, storage and cash checks
 * before placing, and the deliveries on their way.
 */
export default function CrateSheet({ onClose }: SheetProps) {
  const { t } = useTranslation('sheets');
  const { t: tc } = useTranslation('common');
  const reduced = useReducedMotion();
  const titleId = useId();
  const push = useToasts((store) => store.push);
  const [cart, setCart] = useState<Cart>({});
  const [sent, setSent] = useState(0);
  const [bonk, setBonk] = useState(0);
  const game = useGameStore(
    useShallow((store) => ({
      cash: store.game?.finance.cashCents ?? 0,
      level: store.game?.progression.level ?? 1,
      perks: store.game?.progression.perks ?? NO_PERKS,
      rep: store.game?.reputation.sub ?? NO_REP,
      day: store.game?.clock.day ?? 1,
      minute: store.game?.clock.minute ?? 0,
      sealed: store.game?.inventory.sealed ?? NO_SEALED,
      orders: store.game?.suppliers.orders ?? NO_ORDERS,
    })),
  );
  const suppliers = [...VIEW.content.suppliers.values()].filter(
    (entry) => entry.unlockLevel <= game.level,
  );
  const supplier = suppliers[0];
  const catalog = supplier ? supplierCatalog(supplier, game.perks, VIEW.content) : [];
  const storage = storageSummary(game.sealed, game.orders, game.perks, VIEW);
  const check = checkCart(cart, catalog, game.cash, storage.free);
  const etaDay = game.day + (supplier?.deliveryDays ?? 1);
  const etaName = tc(`weekday.${weekdayOf(etaDay)}`);
  const pending = pendingOrders(game.orders, game.day, VIEW.content);
  const stars = starsOf(game.rep);

  const place = () => {
    if (!supplier) return;
    if (!check.canPlace) {
      setBonk((value) => value + 1);
      playSfx('ui.error');
      return;
    }
    const result = runCommand({
      type: 'suppliers/placeOrder',
      supplierId: supplier.id,
      lines: orderLines(check),
    });
    if (!result.ok) return;
    playSfx('ui.stamp');
    playSfx('shop.delivery', { volume: 0.6 });
    setSent((value) => value + 1);
    setCart({});
    push({
      title: t('crate.placed', { day: etaName }),
      tone: 'success',
      icon: <TruckIcon size={28} />,
    });
  };

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <section
        aria-labelledby={titleId}
        className="ff-sheet tablet-bezel relative flex h-full flex-col rounded-[34px] border-[3px] border-ink p-2.5 shadow-[0_6px_0_var(--color-ink)] [@media(max-height:500px)]:rounded-[24px] [@media(max-height:500px)]:p-1.5"
      >
        <span
          className="absolute top-[5px] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-ink ring-2 ring-white/10 [@media(max-height:500px)]:hidden"
          aria-hidden="true"
        />
        <div className="tablet-screen relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border-2 border-black/50 text-paper [@media(max-height:500px)]:rounded-[18px]">
          <div className="tablet-glare absolute inset-0 z-10" aria-hidden="true" />
          <StatusBar time={formatClock(game.minute)} day={tc(`weekday.${weekdayOf(game.day)}`)} />

          <header className="flex items-center gap-2.5 px-4 pt-1 pb-2 [@media(max-height:500px)]:pb-1">
            <span className="-rotate-6">
              <CrateLogo size={36} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-2xl leading-none tracking-wide">
                {t('crate.title')}
              </h2>
              <p className="truncate text-xs font-bold text-paper/60">{t('crate.tagline')}</p>
            </div>
            <CartPill check={check} />
            <CloseKey onClose={onClose} />
          </header>

          <nav
            aria-label={t('crate.suppliersLabel')}
            className="rail flex shrink-0 gap-2 overflow-x-auto px-4 pb-2"
          >
            {suppliers.map((entry) => (
              <span
                key={entry.id}
                aria-current="page"
                className="flex h-12 shrink-0 items-center gap-2 rounded-2xl border-[3px] border-ink bg-sun pr-3 pl-1 font-display text-ink shadow-[0_3px_0_var(--color-ink)]"
              >
                <BudgetBoxMark size={34} />
                {entry.name}
              </span>
            ))}
            {SUPPLIER_TEASERS.map((teaser) => {
              const level = teaserLevel(teaser, VIEW.content);
              const name = t(`crate.teasers.${teaser.key}.name`);
              const met = game.level >= level && (teaser.stars ?? 0) <= stars;
              return (
                <span
                  key={teaser.key}
                  role="img"
                  title={t(`crate.teasers.${teaser.key}.blurb`)}
                  aria-label={t('crate.lockedAria', { name, level })}
                  className="flex h-12 shrink-0 items-center gap-2 rounded-2xl border-[3px] border-white/15 bg-white/5 pr-3 pl-1 text-paper/70"
                >
                  <span className="opacity-60 grayscale-[0.6]">
                    <TeaserMark kind={teaser.key} size={34} />
                  </span>
                  <span className="leading-tight">
                    <span className="block font-display text-sm">{name}</span>
                    <span className="flex items-center gap-1 text-[11px] font-bold">
                      <LockIcon size={12} />
                      {met ? t('crate.comingSoon') : t('crate.locked', { level })}
                      {teaser.stars && !met
                        ? ` · ${t('crate.lockedStars', { count: teaser.stars })}`
                        : ''}
                    </span>
                  </span>
                </span>
              );
            })}
          </nav>

          <div className="sheet-scroll relative min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {supplier ? (
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white/8 px-3 py-2 ring-1 ring-white/10">
                <p className="text-sm font-bold text-paper/80">{t('crate.budgetTagline')}</p>
                <p className="flex items-center gap-1.5 text-sm font-bold text-sun">
                  <TruckIcon size={20} />
                  {supplier.deliveryDays === 1
                    ? t('crate.deliveryTomorrow', { day: etaName })
                    : t('crate.deliveryDays', { count: supplier.deliveryDays, day: etaName })}
                </p>
              </div>
            ) : null}

            <ul className="@container grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {catalog.map((item, index) => (
                <CatalogTile
                  key={item.product.id}
                  item={item}
                  index={index}
                  qty={cart[item.product.id] ?? 0}
                  max={maxAffordable(item, cart, catalog, game.cash, storage.free)}
                  onQty={(qty) => setCart((current) => ({ ...current, [item.product.id]: qty }))}
                />
              ))}
            </ul>

            <PendingOrders pending={pending} weekday={(day) => tc(`weekday.${weekdayOf(day)}`)} />
          </div>

          <CartFooter
            check={check}
            storage={storage}
            etaName={etaName}
            sent={sent}
            bonk={bonk}
            onPlace={place}
            onClear={() => setCart({})}
          />
        </div>
      </section>
    </MotionConfig>
  );
}

function StatusBar({ time, day }: { time: string; day: string }) {
  return (
    <div
      className="flex h-6 shrink-0 items-center justify-between px-5 pt-1 text-[11px] font-bold tracking-wide text-paper/70 tabular-nums [@media(max-height:500px)]:hidden"
      aria-hidden="true"
    >
      <span>
        {day} {time}
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true">
          <rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor" />
          <rect x="4.5" y="4.5" width="3" height="6.5" rx="1" fill="currentColor" />
          <rect x="9" y="2" width="3" height="9" rx="1" fill="currentColor" />
          <rect x="13.5" y="0" width="2.5" height="11" rx="1" fill="currentColor" opacity="0.4" />
        </svg>
        <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true">
          <rect
            x="0.75"
            y="0.75"
            width="20"
            height="10.5"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect x="2.5" y="2.5" width="13" height="7" rx="1.5" fill="var(--color-mint)" />
          <rect x="21.5" y="3.5" width="2" height="5" rx="1" fill="currentColor" />
        </svg>
      </span>
    </div>
  );
}

function CartPill({ check }: { check: CartCheck }) {
  const { t } = useTranslation('sheets');
  return (
    <span
      aria-label={t('crate.cartAria', {
        count: check.itemCount,
        price: formatMoney(check.totalCents),
      })}
      role="status"
      className="flex h-11 shrink-0 items-center gap-2 rounded-full border-[3px] border-ink bg-paper px-3 font-display text-ink shadow-[0_3px_0_var(--color-ink)]"
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          d="M2 4h3l2.5 11h11L21 7H6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="9" cy="19.5" r="1.8" fill="currentColor" />
        <circle cx="17" cy="19.5" r="1.8" fill="currentColor" />
      </svg>
      <motion.span
        key={check.itemCount}
        initial={{ scale: 1.4 }}
        animate={{ scale: 1 }}
        className="tabular-nums"
      >
        {formatMoney(check.totalCents)}
      </motion.span>
    </span>
  );
}

function CatalogTile({
  item,
  index,
  qty,
  max,
  onQty,
}: {
  item: CatalogItem;
  index: number;
  qty: number;
  max: number;
  onQty(qty: number): void;
}) {
  const { t } = useTranslation('sheets');
  const [draft, setDraft] = useState<string | null>(null);
  const { product } = item;
  const inCart = qty > 0;
  const step = (dir: 1 | -1) => {
    const next = stepQty(item, qty, dir);
    playSfx(dir === 1 ? 'ui.pop' : 'ui.tab', { rate: dir === 1 ? 1.1 : 0.9 });
    onQty(next);
  };
  const stepClass =
    'grid size-11 shrink-0 place-items-center rounded-xl border-[3px] border-ink font-display text-2xl leading-none text-ink shadow-[0_3px_0_var(--color-ink)] transition-transform duration-75 active:translate-y-[3px] active:shadow-none disabled:opacity-40';
  return (
    <motion.li
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28, delay: index * 0.05 }}
      className={`relative flex flex-col rounded-2xl border-[3px] border-ink bg-paper p-2.5 text-ink shadow-[0_4px_0_var(--color-ink)] transition-[outline-color] ${
        inCart ? 'outline-[3px] outline-sun outline-offset-2' : 'outline-0 outline-transparent'
      }`}
    >
      <div className="relative grid h-[104px] place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_60%,var(--color-sunLight),var(--color-paper2)_70%)]">
        <ProductArt productId={product.id} height={product.kind === 'box' ? 70 : 96} />
        <span className="absolute top-1 left-1 rounded-md border-2 border-ink bg-white px-1 font-display text-[11px]">
          {t('crate.min', { count: item.minQty })}
        </span>
        <span className="absolute top-1 right-1 rounded-md border-2 border-ink bg-mint px-1 font-display text-[11px]">
          {t('crate.margin', { pct: Math.round(item.marginPct * 100) })}
        </span>
      </div>
      <h3 className="mt-2 line-clamp-2 min-h-10 text-sm leading-tight font-extrabold">
        {product.name}
      </h3>
      <p className="mt-1 flex items-baseline justify-between gap-1">
        <span className="font-display text-xl tabular-nums">
          {t('crate.each', { price: formatMoney(item.costCents) })}
        </span>
        <span className="text-xs font-bold text-ink/60 tabular-nums">
          {t('crate.msrp', { price: formatMoney(item.msrpCents) })}
        </span>
      </p>
      {item.costCents < item.listCostCents ? (
        <p className="text-xs font-bold text-teal line-through decoration-2">
          {t('crate.listPrice', { price: formatMoney(item.listCostCents) })}
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          className={`${stepClass} bg-white`}
          aria-label={t('crate.less', { name: product.name })}
          disabled={qty === 0}
          onClick={() => step(-1)}
        >
          −
        </button>
        <input
          inputMode="numeric"
          aria-label={t('crate.qty', { name: product.name })}
          className="h-11 w-full min-w-0 rounded-xl border-[3px] border-ink bg-white text-center font-display text-xl tabular-nums outline-none focus:border-teal"
          value={draft ?? String(qty)}
          onFocus={(event) => {
            setDraft(String(qty));
            event.currentTarget.select();
          }}
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
          onBlur={() => {
            if (draft !== null) onQty(clampQty(item, Number(draft)));
            setDraft(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              event.stopPropagation();
              setDraft(null);
            }
          }}
        />
        <button
          type="button"
          className={`${stepClass} bg-sun`}
          aria-label={t('crate.more', { name: product.name })}
          disabled={stepQty(item, qty, 1) - qty > max}
          onClick={() => step(1)}
        >
          +
        </button>
      </div>
      <p className="mt-1.5 flex justify-between text-xs font-bold text-ink/70 tabular-nums">
        <span>
          {inCart ? t('crate.lineTotal', { price: formatMoney(item.costCents * qty) }) : ' '}
        </span>
        <span>{t('crate.units', { count: product.storageUnits * Math.max(qty, 1) })}</span>
      </p>
    </motion.li>
  );
}

function PendingOrders({
  pending,
  weekday,
}: {
  pending: ReturnType<typeof pendingOrders>;
  weekday(day: number): string;
}) {
  const { t } = useTranslation('sheets');
  return (
    <section className="mt-5">
      <h3 className="flex items-center gap-2 font-display text-lg tracking-wide">
        <TruckIcon size={22} />
        {t('crate.pending.title')}
      </h3>
      {pending.length === 0 ? (
        <p className="mt-1 text-sm font-semibold text-paper/60">{t('crate.pending.none')}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          <AnimatePresence initial={false}>
            {pending.map((order) => (
              <motion.li
                key={order.uid}
                layout
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -60, opacity: 0 }}
                className="flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-2 ring-1 ring-white/12"
              >
                <span className="flex -space-x-3">
                  {order.lines.slice(0, 3).map((line) => (
                    <ProductArt key={line.product.id} productId={line.product.id} height={36} />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {order.lines.map((line) => `${line.qty}× ${line.product.name}`).join(' · ')}
                  </span>
                  <span className="block text-xs font-bold text-paper/60">
                    {t('crate.pending.items', { count: order.itemCount })} ·{' '}
                    {formatMoney(order.totalCents)}
                  </span>
                </span>
                <span className="hatch-incoming shrink-0 rounded-lg border-2 border-ink px-2 py-0.5 font-display text-xs text-ink">
                  {order.daysLeft <= 1
                    ? t('crate.pending.tomorrow')
                    : t('crate.pending.days', {
                        count: order.daysLeft,
                        day: weekday(order.etaDay),
                      })}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function CartFooter({
  check,
  storage,
  etaName,
  sent,
  bonk,
  onPlace,
  onClear,
}: {
  check: CartCheck;
  storage: ReturnType<typeof storageSummary>;
  etaName: string;
  sent: number;
  bonk: number;
  onPlace(): void;
  onClear(): void;
}) {
  const { t } = useTranslation('sheets');
  const problem = check.problems[0];
  const problemText = !problem
    ? null
    : problem.kind === 'empty'
      ? t('crate.problem.empty')
      : problem.kind === 'belowMinimum'
        ? t('crate.problem.belowMinimum', {
            name: VIEW.content.products.get(problem.productId)?.name ?? '',
            min: problem.min,
          })
        : problem.kind === 'cash'
          ? t('crate.problem.cash', { price: formatMoney(problem.shortCents) })
          : t('crate.problem.storage', { count: problem.shortUnits });
  const blocking = problem && problem.kind !== 'empty';
  return (
    <footer className="relative z-[11] shrink-0 border-t-2 border-white/10 bg-tabletBezel/70 px-4 pt-2.5 pb-3 backdrop-blur-sm [@media(max-height:500px)]:py-1.5">
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[1fr_auto] [@media(max-height:500px)]:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-1">
          <StorageMeter summary={storage} extra={check.units} />
          <p className="flex flex-wrap gap-x-3 text-xs font-bold text-paper/75 tabular-nums">
            <span className={check.cashAfterCents < 0 ? 'text-coral' : ''}>
              {t('crate.cashAfter', { price: formatMoney(check.cashAfterCents) })}
            </span>
            <span className={check.freeAfterUnits < 0 ? 'text-coral' : ''}>
              {t('crate.spaceAfter', { count: Math.max(0, check.freeAfterUnits) })}
            </span>
          </p>
        </div>
        <div className="relative flex items-center justify-end gap-2">
          {check.itemCount > 0 ? (
            <Button variant="ghost" size="md" className="text-paper" onClick={onClear}>
              {t('crate.clear')}
            </Button>
          ) : null}
          <span key={bonk} className={bonk > 0 ? 'bonk' : ''}>
            <Button
              variant="gold"
              size="md"
              icon={<TruckIcon />}
              aria-disabled={!check.canPlace}
              className={check.canPlace ? '' : 'opacity-60 saturate-50'}
              onClick={onPlace}
            >
              {t('crate.place', { day: etaName })}
            </Button>
          </span>
          <AnimatePresence>{sent > 0 ? <SendBurst key={sent} /> : null}</AnimatePresence>
        </div>
      </div>
      {problemText ? (
        <p
          role="status"
          className={`mt-1.5 text-sm font-bold ${blocking ? 'text-coral' : 'text-paper/70'}`}
        >
          {problemText}
        </p>
      ) : null}
    </footer>
  );
}

/** The "Place order" payoff: a crate whooshes off and a SENT! stamp lands (docs/05 §6). */
function SendBurst() {
  const { t } = useTranslation('sheets');
  return (
    <>
      <motion.span
        className="pointer-events-none absolute right-6 bottom-6"
        initial={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
        animate={{
          x: [0, -30, 140],
          y: [0, -70, -260],
          rotate: [0, -15, 25],
          scale: [1, 1.3, 0.6],
          opacity: [1, 1, 0],
        }}
        transition={{ duration: 0.9, ease: 'easeIn' }}
        aria-hidden="true"
      >
        <CrateLogo size={48} />
      </motion.span>
      <motion.span
        className="pointer-events-none absolute right-2 -top-12"
        initial={{ opacity: 1 }}
        animate={{ opacity: [1, 1, 0] }}
        transition={{ duration: 1.6, times: [0, 0.7, 1] }}
        aria-hidden="true"
      >
        <Stamp text={t('crate.sent')} color="var(--color-mint)" rotate={-10} />
      </motion.span>
    </>
  );
}
