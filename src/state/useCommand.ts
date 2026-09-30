import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Command } from '@/sim/commands';
import { useToasts } from '@/ui/components';
import { type DispatchResult, useGameStore } from './gameStore';

/**
 * Dispatches a command and turns a validation failure into a friendly toast (docs/05 §7).
 * Components use this instead of calling the store's `dispatch` directly.
 */
export function useCommand(): (command: Command) => DispatchResult {
  const dispatch = useGameStore((store) => store.dispatch);
  const push = useToasts((store) => store.push);
  const { t } = useTranslation('errors');
  return useCallback(
    (command: Command) => {
      const result = dispatch(command);
      if (!result.ok)
        push({ title: t(result.code, result.params ?? {}), tone: 'warning', icon: '✋' });
      return result;
    },
    [dispatch, push, t],
  );
}
