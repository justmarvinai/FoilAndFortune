import type { Ref } from 'react';
import { ActivityFeed } from './ActivityFeed';
import { CashDisplay, ReputationChip, SavedFlash } from './CashDisplay';
import { ClockPanel } from './ClockPanel';
import { DoorSign } from './DoorSign';
import { ShopBadge } from './ShopBadge';
import './hud.css';

/**
 * The HUD top bar (docs/05 §3): shop badge on the left, calendar, clock, speed and the door sign
 * in the middle, cash and reputation on the right, with the activity log under them on wide
 * screens. The bar itself lets clicks through to the shop; only its pieces are interactive.
 */
export function Hud({ barRef }: { barRef?: Ref<HTMLDivElement> }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-start gap-3 px-3 pt-3 [@media(max-height:540px)]:gap-2 [@media(max-height:540px)]:px-2 [@media(max-height:540px)]:pt-2">
      <div className="pointer-events-auto justify-self-start">
        <ShopBadge />
      </div>
      {/* The middle cluster is the bar's tallest part: the scene insets measure it. */}
      <div
        ref={barRef}
        className="pointer-events-auto flex items-start gap-2.5 [@media(max-height:540px)]:gap-1.5"
      >
        <ClockPanel />
        <DoorSign />
      </div>
      <div className="flex flex-col items-end gap-2 justify-self-end [@media(max-height:540px)]:gap-1.5">
        <div className="pointer-events-auto flex items-center gap-2 [@media(max-height:540px)]:flex-col [@media(max-height:540px)]:items-end [@media(max-height:540px)]:gap-1.5">
          <ReputationChip />
          <CashDisplay />
        </div>
        <div className="pointer-events-auto">
          <SavedFlash />
        </div>
        <ActivityFeed />
      </div>
    </header>
  );
}
