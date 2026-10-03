import { Coins, House, Landmark, PackageOpen, Timer, Truck } from 'lucide-react';
import { playSfx } from '@/audio';
import { timeBalance } from '@/content/balance/time';
import { getRegistry } from '@/content/registry';
import { weekdayOf } from '@/core/calendar';
import { formatMoney } from '@/core/money';
import i18n from '@/i18n';
import { useGameStore } from '@/state/gameStore';
import { presentationBus } from '@/state/presentationBus';
import { useUiStore } from '@/state/uiStore';
import { useToasts } from '@/ui/components/Toasts';
import { useShellStore } from '../session/shellStore';
import { ToastIcon } from './ToastIcon';

/**
 * Presentation rules for domain events (docs/05 §7): toasts, the activity log, cash floats, dock
 * badges, the Day Summary opening at night, and the sounds that belong to sim-driven moments.
 * Player-driven sounds (a sign flip, a dock key) play where the click happens instead.
 */
export function installShellReactions(): () => void {
  const bus = presentationBus;
  const game = () => useGameStore.getState().game;
  const shell = () => useShellStore.getState();
  const ui = () => useUiStore.getState();
  const toast = useToasts.getState().push;
  const minute = () => game()?.clock.minute ?? 0;
  const supplierName = (id: string) => getRegistry().suppliers.get(id)?.name ?? id;
  const productName = (id: string) => getRegistry().products.get(id)?.name ?? id;
  const lastHour = timeBalance.closeMinute / 60 - 1;

  const offs = [
    bus.on('clock/phaseChanged', ({ to }) => {
      if (to === 'open') shell().log('shopOpened', minute());
      if (to === 'night') {
        shell().log('shopClosed', minute());
        shell().setConfirmClose(false);
        ui().closeFixture();
        ui().setSummaryOpen(true);
      }
      if (to === 'prep') ui().setSummaryOpen(false);
    }),
    bus.on('clock/dayStarted', () => shell().clearFeed()),
    bus.on('clock/hourChanged', ({ hour }) => {
      if (hour !== lastHour) return;
      toast({
        title: i18n.t('toast.lastHour', { ns: 'shell' }),
        body: i18n.t('toast.lastHourBody', { ns: 'shell' }),
        tone: 'info',
        icon: (
          <ToastIcon tone="sky">
            <Timer />
          </ToastIcon>
        ),
      });
    }),
    bus.on('cash/changed', ({ deltaCents, reason }) => shell().pushFloat(deltaCents, reason)),
    bus.on('sale/completed', ({ totalCents }) => {
      playSfx('shop.chaChing');
      const amount = formatMoney(totalCents);
      shell().log('sale', minute(), { amount });
      // Published after commit, so the day log already counts this sale.
      if (game()?.dayLog.served === 1) {
        toast({
          title: i18n.t('toast.firstSale', { ns: 'shell' }),
          body: i18n.t('toast.firstSaleBody', { ns: 'shell', amount }),
          tone: 'celebrate',
          icon: (
            <ToastIcon tone="sun">
              <Coins />
            </ToastIcon>
          ),
        });
      }
    }),
    bus.on('customer/left', ({ bought, satisfaction }) => {
      if (!bought) shell().log('leftEmpty', minute());
      else if (satisfaction >= 1) shell().log('leftHappy', minute());
    }),
    bus.on('order/placed', ({ supplierId, totalCents, etaDay }) => {
      const supplier = supplierName(supplierId);
      shell().log('order', minute(), { supplier, amount: formatMoney(totalCents) });
      toast({
        title: i18n.t('toast.orderPlaced', { ns: 'shell' }),
        body: i18n.t('toast.orderPlacedBody', {
          ns: 'shell',
          supplier,
          weekday: i18n.t(`weekday.${weekdayOf(etaDay)}`),
        }),
        tone: 'info',
        icon: (
          <ToastIcon tone="sky">
            <Truck />
          </ToastIcon>
        ),
      });
    }),
    bus.on('order/delivered', ({ orderUid, supplierId }) => {
      const order = game()?.suppliers.orders.find((entry) => entry.uid === orderUid);
      let units = 0;
      for (const line of order?.lines ?? []) units += line.qty;
      const supplier = supplierName(supplierId);
      playSfx('shop.delivery');
      shell().addDeliveries(1);
      shell().log('delivery', minute(), { supplier });
      toast({
        title: i18n.t('toast.delivery', { ns: 'shell' }),
        body: i18n.t('toast.deliveryBody', { ns: 'shell', supplier, units }),
        tone: 'success',
        icon: (
          <ToastIcon tone="mint">
            <PackageOpen />
          </ToastIcon>
        ),
      });
    }),
    bus.on('rent/charged', ({ cents }) => {
      const amount = formatMoney(cents);
      shell().log('rent', minute(), { amount });
      toast({
        title: i18n.t('toast.rent', { ns: 'shell', amount }),
        body: i18n.t('toast.rentBody', { ns: 'shell' }),
        tone: 'warning',
        icon: (
          <ToastIcon tone="coral">
            <House />
          </ToastIcon>
        ),
      });
    }),
    bus.on('loan/changed', ({ principalCents }) =>
      toast({
        title: i18n.t('toast.loan', { ns: 'shell' }),
        body: i18n.t('toast.loanBody', { ns: 'shell', amount: formatMoney(principalCents) }),
        tone: 'info',
        icon: (
          <ToastIcon tone="sky">
            <Landmark />
          </ToastIcon>
        ),
      }),
    ),
    bus.on('product/opened', ({ productId, newCardIds }) => {
      if (newCardIds.length > 0) shell().addNewCards(newCardIds.length);
      shell().log('opened', minute(), { product: productName(productId) });
    }),
    bus.on('product/unboxed', ({ packs }) => {
      let count = 0;
      for (const pack of packs) count += pack.qty;
      toast({
        title: i18n.t('toast.unboxed', { ns: 'shell' }),
        body: i18n.t('toast.unboxedBody', { ns: 'shell', count }),
        tone: 'success',
        icon: (
          <ToastIcon tone="grape">
            <PackageOpen />
          </ToastIcon>
        ),
      });
    }),
    bus.on('level/up', ({ level }) => shell().log('levelUp', minute(), { level })),
    // Opening a sheet clears its dock badge.
    useUiStore.subscribe((state, previous) => {
      if (state.sheet === previous.sheet) return;
      if (state.sheet === 'inventory') shell().seeDeliveries();
      if (state.sheet === 'binder') shell().seeNewCards();
    }),
  ];
  return () => {
    for (const off of offs) off();
  };
}
