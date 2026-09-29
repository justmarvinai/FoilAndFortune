import { LogOut } from 'lucide-react';
import { useEffect, useReducer } from 'react';
import { formatMoney } from '@/core/money';
import { GameLoop } from '@/state/gameLoop';
import { useGameStore } from '@/state/gameStore';
import { installAutosave } from '@/state/persistence';
import { presentationBus } from '@/state/presentationBus';
import { Button, ToastViewport, useToasts } from '@/ui/components';
import { DebugShell } from './DebugShell';
import { sandboxTuning } from './engine/cheats';
import { DevToolsPanel } from './engine/DevToolsPanel';
import { EventLogPanel, LedgerPanel } from './engine/LogPanels';
import { NewGamePanel } from './engine/NewGamePanel';
import { SandboxHud } from './engine/SandboxHud';
import { SavesPanel } from './engine/SavesPanel';
import { ShiftPanel } from './engine/ShiftPanel';
import { StockPanel } from './engine/StockPanel';

// Debug page: exempt from i18n (CLAUDE.md).

/** Presentation reactions to domain events: the seed of the real toast rules (docs/05 §7). */
function useSimToasts(): void {
  const push = useToasts((store) => store.push);
  useEffect(() => {
    const offs = [
      presentationBus.on('level/up', ({ level }) =>
        push({
          title: `Level ${level}!`,
          body: 'Higher levels unlock new products and features.',
          tone: 'celebrate',
          icon: '🎉',
        }),
      ),
      presentationBus.on('rent/charged', ({ cents }) =>
        push({ title: `Rent paid: ${formatMoney(cents)}`, tone: 'warning', icon: '🏠' }),
      ),
      presentationBus.on('loan/changed', ({ principalCents }) =>
        push({
          title: 'The bank covered the shortfall',
          body: `Loan balance: ${formatMoney(principalCents)}`,
          tone: 'info',
          icon: '🏦',
        }),
      ),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [push]);
}

/**
 * Phase 1 engine sandbox (/debug/engine): the pure sim running for real behind a prototype HUD,
 * with the GameLoop, autosave, save slots, export/import and a leva dev panel.
 */
export default function EngineSandboxPage() {
  const hasGame = useGameStore((store) => store.game !== null);
  const unload = useGameStore((store) => store.unload);
  const [savesRevision, bumpSaves] = useReducer((revision: number) => revision + 1, 0);
  useSimToasts();

  useEffect(() => {
    const loop = new GameLoop({
      getGame: () => useGameStore.getState().game,
      advance: (ticks, realMs) => useGameStore.getState().advance(ticks, realMs),
      msPerGameMinute: () => sandboxTuning.minuteMs,
    });
    loop.start();
    const stopAutosave = installAutosave(() => useGameStore.getState().game, {
      onSaved: () => bumpSaves(),
    });
    return () => {
      loop.stop();
      stopAutosave();
    };
  }, []);

  return (
    <DebugShell
      title="Engine Sandbox"
      subtitle="The pure simulation driving a prototype HUD: clock, day phases, commands, saves."
      actions={
        hasGame ? (
          <Button size="sm" variant="secondary" icon={<LogOut />} onClick={unload}>
            Quit to title
          </Button>
        ) : null
      }
    >
      {hasGame ? <SandboxHud /> : null}
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-16">
        {hasGame ? (
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div className="space-y-12">
              <ShiftPanel />
              <StockPanel />
              <LedgerPanel />
            </div>
            <div className="space-y-12">
              <DevToolsPanel />
              <EventLogPanel />
              <SavesPanel revision={savesRevision} />
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-12 lg:grid-cols-[1.2fr_1fr]">
            <NewGamePanel />
            <SavesPanel revision={savesRevision} />
          </div>
        )}
      </div>
      <ToastViewport />
    </DebugShell>
  );
}
