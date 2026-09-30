import i18n from '@/i18n';
import type { Command } from '@/sim/commands';
import type { DomainEventOf } from '@/sim/events';
import { type DispatchResult, useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { useToasts } from '@/ui/components/Toasts';

/**
 * Play-screen actions usable outside React render (event handlers, keyboard shortcuts, the
 * scene's click callbacks). Like `useCommand`, a validation failure becomes a friendly toast.
 */
export function runCommand(command: Command): DispatchResult {
  const result = useGameStore.getState().dispatch(command);
  if (!result.ok) {
    useToasts.getState().push({
      title: i18n.t(result.code, { ns: 'errors', ...(result.params ?? {}) }),
      tone: 'warning',
      icon: '✋',
    });
  }
  return result;
}

/**
 * Opens one unit of a product from storage and shows the result on the pack-opening stage
 * (docs/05 §5.7). The sim has already decided every card; the stage only reveals them.
 */
export function openProductWithStage(productId: string): DispatchResult {
  const result = runCommand({ type: 'open/openProduct', productId });
  if (result.ok) {
    const opened = result.events.find(
      (event): event is DomainEventOf<'product/opened'> => event.type === 'product/opened',
    );
    if (opened) useUiStore.getState().openStage({ kind: 'opening', opened });
  }
  return result;
}

/** Rings up the customer at the pay spot (docs/01 §11.1), e.g. from a click on the register. */
export function checkoutAtRegister(): DispatchResult {
  return runCommand({ type: 'customers/checkout' });
}
