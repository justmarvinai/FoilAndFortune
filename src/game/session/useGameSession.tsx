import { Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { playSfx } from '@/audio';
import { dayToDate } from '@/core/calendar';
import { runCommand } from '@/game/actions';
import i18n from '@/i18n';
import type { SaveFile } from '@/save/saveFile';
import { GameLoop } from '@/state/gameLoop';
import { useGameStore } from '@/state/gameStore';
import { getSaveManager, installAutosave } from '@/state/persistence';
import { useSettingsStore } from '@/state/settingsStore';
import { isInteractionPaused, type SheetId, useUiStore } from '@/state/uiStore';
import { useToasts } from '@/ui/components/Toasts';
import { installLevelUpCollector } from '../celebrations/collect';
import { installShellReactions } from '../shell/reactions';
import { ToastIcon } from '../shell/ToastIcon';
import { isSaveSlotId } from '../title/saveSlots';
import { createMusicDirector, installAudioUnlock, musicFor } from './audioSession';
import { shellSignals, useShellStore } from './shellStore';
import { type ShellAction, shortcutFor } from './shortcuts';

/**
 * The play screen's session (docs/05 §2–3, §9): makes sure a game is loaded, then runs the
 * GameLoop (paused by interactions, docs/05 §1.7), the dawn autosave, the presentation rules,
 * keyboard shortcuts, audio unlock and the music director. Returns `ready` once a game is on the
 * counter; with no game and no save it goes back to the title.
 */
export type SessionStatus = 'loading' | 'ready';

/** Replaces the current URL without a history entry and tells the router. */
function replaceRoute(to: string): void {
  window.history.replaceState(null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function welcomeBack(file: SaveFile): void {
  const date = dayToDate(file.summary.day);
  useToasts.getState().push({
    title: i18n.t('session.welcomeBack', { ns: 'shell', shop: file.summary.shopName }),
    body: i18n.t('session.welcomeBackBody', {
      ns: 'shell',
      day: file.summary.day,
      weekday: i18n.t(`weekday.${date.weekday}`),
    }),
    tone: 'info',
    icon: (
      <ToastIcon tone="sun">
        <Sun />
      </ToastIcon>
    ),
  });
}

/** Opens (or toggles) a sheet from anywhere: dock keys, shortcuts, the receipt. */
export function toggleSheet(sheet: SheetId): void {
  const ui = useUiStore.getState();
  // Night tasks: a sheet shortcut tucks the receipt away first (docs/05 §5.17).
  if (ui.summaryOpen) ui.setSummaryOpen(false);
  const opening = ui.sheet !== sheet;
  ui.toggleSheet(sheet);
  playSfx(opening ? 'ui.open' : 'ui.close');
}

/** Space: pause, or resume at the last speed. */
export function togglePause(): void {
  const game = useGameStore.getState().game;
  if (!game) return;
  const shell = useShellStore.getState();
  if (game.clock.speed === 0) {
    runCommand({ type: 'time/setSpeed', speed: shell.resumeSpeed });
  } else {
    shell.setResumeSpeed(game.clock.speed);
    runCommand({ type: 'time/setSpeed', speed: 0 });
  }
  playSfx('ui.tab');
}

/** Esc: close the top layer; with nothing open it brings up Settings, the game's pause menu. */
export function goBack(): void {
  const shell = useShellStore.getState();
  if (shell.confirmClose) {
    shell.setConfirmClose(false);
    return;
  }
  const ui = useUiStore.getState();
  if (ui.back()) playSfx('ui.close');
  else toggleSheet('settings');
}

function perform(action: ShellAction): void {
  switch (action.kind) {
    case 'back':
      goBack();
      break;
    case 'togglePause':
      togglePause();
      break;
    case 'speed':
      runCommand({ type: 'time/setSpeed', speed: action.speed });
      playSfx('ui.tab');
      break;
    case 'sheet':
      toggleSheet(action.sheet);
      break;
    case 'skipCelebration':
      shellSignals.emit('skipCelebration', undefined);
      break;
  }
}

function installShortcuts(): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const ui = useUiStore.getState();
    const action = shortcutFor(
      {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        repeat: event.repeat,
        targetTag: target?.tagName,
        targetType: target instanceof HTMLInputElement ? target.type : undefined,
        targetEditable: target?.isContentEditable,
        targetInDialog: target?.closest('[role="dialog"], [role="alertdialog"]') != null,
      },
      { stageOpen: ui.stage !== null, celebrating: ui.celebrations.length > 0 },
    );
    if (!action) return;
    event.preventDefault();
    perform(action);
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

function installMusic(): () => void {
  const direct = createMusicDirector();
  const update = () => {
    const game = useGameStore.getState().game;
    direct(
      musicFor({
        phase: game?.clock.phase ?? null,
        minute: game?.clock.minute ?? 0,
        stageOpen: useUiStore.getState().stage !== null,
      }),
    );
  };
  update();
  const offGame = useGameStore.subscribe(update);
  const offUi = useUiStore.subscribe(update);
  return () => {
    offGame();
    offUi();
  };
}

export function useGameSession(): SessionStatus {
  const [status, setStatus] = useState<SessionStatus>(() =>
    useGameStore.getState().game &&
    !isSaveSlotId(new URLSearchParams(window.location.search).get('slot'))
      ? 'ready'
      : 'loading',
  );

  // 1. Make sure a game is loaded: `?slot=` from the Load panel, the game in memory (New Game or
  // browser back/forward), or the latest save (Continue, a reload).
  useEffect(() => {
    let alive = true;
    const store = useGameStore.getState();
    const slot = new URLSearchParams(window.location.search).get('slot');
    const saves = getSaveManager();
    const adopt = (file: SaveFile | undefined) => {
      if (!alive) return;
      if (!file) {
        replaceRoute('/');
        return;
      }
      store.loadGame(file.state);
      useUiStore.getState().reset();
      if (file.state.clock.phase === 'night') useUiStore.getState().setSummaryOpen(true);
      if (isSaveSlotId(slot)) replaceRoute('/play');
      welcomeBack(file);
      setStatus('ready');
    };
    const fail = () => {
      if (alive) replaceRoute('/');
    };
    if (isSaveSlotId(slot)) saves.load(slot).then(adopt, fail);
    else if (store.game) setStatus('ready');
    else saves.loadLatest().then(adopt, fail);
    return () => {
      alive = false;
    };
  }, []);

  // 2. Run the shop.
  useEffect(() => {
    if (status !== 'ready') return;
    const loop = new GameLoop({
      getGame: () => useGameStore.getState().game,
      advance: (ticks, realMs) => useGameStore.getState().advance(ticks, realMs),
      isPaused: () =>
        isInteractionPaused(
          useUiStore.getState(),
          useSettingsStore.getState().settings.pauseOnInteraction,
        ),
    });
    loop.start();
    const offs = [
      installAutosave(() => useGameStore.getState().game, {
        onSaved: () => useShellStore.getState().noteSaved(),
        onError: (error) => {
          console.error('Autosave failed', error);
          useToasts.getState().push({
            title: i18n.t('toast.saveFailed', { ns: 'shell' }),
            body: i18n.t('toast.saveFailedBody', { ns: 'shell' }),
            tone: 'warning',
          });
        },
      }),
      installLevelUpCollector((celebration) => useUiStore.getState().pushCelebration(celebration)),
      installShellReactions(),
      installShortcuts(),
      installAudioUnlock(),
      installMusic(),
    ];
    return () => {
      loop.stop();
      for (const off of offs) off();
    };
  }, [status]);

  // Leaving the play screen: nothing of this session's UI should leak into the next one.
  useEffect(
    () => () => {
      useUiStore.getState().reset();
      useShellStore.getState().reset();
    },
    [],
  );

  return status;
}
