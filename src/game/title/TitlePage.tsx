import { AnimatePresence, MotionConfig } from 'motion/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { navigate } from '@/app/router';
import { playSfx, setMusic } from '@/audio';
import { dayToDate, type Season } from '@/core/calendar';
import { decodeSave, MAX_IMPORT_CHARS } from '@/save/exportImport';
import type { SaveFile, SaveSlotId } from '@/save/saveFile';
import type { SlotInfo } from '@/save/saveManager';
import { getSaveManager } from '@/state/persistence';
import { ToastViewport, useToasts } from '@/ui/components/Toasts';
import { DEFAULT_AVATAR } from '../newgame/avatar';
import { type NewGameChoice, NewGameForm } from '../newgame/NewGameForm';
import { installAudioUnlock } from '../session/audioSession';
import { useApplySettings, useReducedMotion } from '../session/useApplySettings';
import { RotatePrompt } from '../shell/RotatePrompt';
import { SettingsBoard } from '../shell/settings/SettingsBoard';
import { type MenuAction, TitleMenu } from './TitleMenu';
import { CreditsPanel, LoadPanel, TitlePanel } from './TitlePanels';
import { TitleScene } from './TitleScene';
import '../shell/shell.css';
import './title.css';

type Mode = 'menu' | 'newGame' | 'load' | 'settings' | 'credits';

function randomSeed(): number {
  // UI-side randomness: the sim only ever sees the resulting seed (CLAUDE.md rule 1).
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

/** Puts a game in the store (lazily: the title route never bundles the sim) and opens the shop. */
async function enterShop(
  prepare: (store: typeof import('@/state/gameStore')) => void,
): Promise<void> {
  const [store] = await Promise.all([import('@/state/gameStore'), import('@/game/PlayPage')]);
  prepare(store);
  const game = store.useGameStore.getState().game;
  // Saved right away, so a reload and Continue land in this shop (docs/06 §11).
  if (game)
    await getSaveManager()
      .autosave(game, new Date().toISOString())
      .catch(() => undefined);
  navigate('/play');
}

/**
 * The title screen (docs/05 §5.1): the Nook at dusk with its neon sign, and the menu as a hand of
 * cards. Continue reads only save metadata; New Game, Load, Settings and Credits open over the
 * dimmed street. No three.js here (an E2E test guards it).
 */
export default function TitlePage() {
  useApplySettings();
  const { t } = useTranslation('shell');
  const reduced = useReducedMotion();
  const push = useToasts((store) => store.push);
  const [mode, setMode] = useState<Mode>('menu');
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [latest, setLatest] = useState<SaveFile | null>(null);

  const refresh = async () => {
    const saves = getSaveManager();
    try {
      setSlots(await saves.list());
      setLatest((await saves.loadLatest()) ?? null);
    } catch {
      setSlots([]);
      push({ title: t('load.readFailed'), tone: 'warning' });
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: read the saves once on arrival.
  useEffect(() => {
    void refresh();
    setMusic('title');
    return installAudioUnlock();
  }, []);

  // Esc closes whatever panel is open (docs/05 §2).
  useEffect(() => {
    if (mode === 'menu') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      playSfx('ui.close');
      setMode('menu');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const onSelect = (action: MenuAction) => {
    if (action === 'continue') {
      void import('@/game/PlayPage');
      navigate('/play');
      return;
    }
    playSfx('ui.open');
    setMode(action);
  };

  const onNewGame = (choice: NewGameChoice) =>
    void enterShop(({ useGameStore }) => {
      useGameStore.getState().startNewGame({
        seed: randomSeed(),
        shopName: choice.shopName,
        difficulty: choice.difficulty,
        owner: choice.owner,
      });
    });

  const onImport = async (file: File) => {
    try {
      if (file.size > MAX_IMPORT_CHARS) throw new Error('too large');
      const parsed = getSaveManager().parse(decodeSave(await file.text()));
      push({
        title: t('load.imported', { shop: parsed.summary.shopName, day: parsed.summary.day }),
        tone: 'success',
      });
      await enterShop(({ useGameStore }) => useGameStore.getState().loadGame(parsed.state));
    } catch (error) {
      const newer = error instanceof Error && error.name === 'SaveVersionError';
      push({
        title: newer ? t('saveNewer', { ns: 'errors' }) : t('load.importFailed'),
        tone: 'warning',
      });
    }
  };

  const onDelete = async (slot: SaveSlotId) => {
    await getSaveManager().remove(slot);
    playSfx('ui.close');
    push({ title: t('load.deleted'), tone: 'info' });
    await refresh();
  };

  const season: Season = latest ? dayToDate(latest.state.clock.day).season : 'spring';
  const owner = latest?.state.meta.owner ?? DEFAULT_AVATAR;

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <main className="h-full">
        <TitleScene owner={owner} season={season} dimmed={mode !== 'menu'}>
          {mode === 'menu' ? (
            <div className="absolute inset-x-0 bottom-0 flex justify-center px-3 pb-6 [@media(max-height:540px)]:pb-2">
              <TitleMenu latest={latest?.summary ?? null} onSelect={onSelect} />
            </div>
          ) : null}
          <p className="pointer-events-none absolute right-3 bottom-2 text-xs font-bold text-paper/50">
            {t('title.version', { version: __APP_VERSION__ })}
          </p>
        </TitleScene>
        <AnimatePresence>
          {mode === 'newGame' ? (
            <NewGameForm key="new-game" onCancel={() => setMode('menu')} onDone={onNewGame} />
          ) : null}
          {mode === 'load' ? (
            <LoadPanel
              key="load"
              slots={slots}
              onClose={() => setMode('menu')}
              onLoad={(slot) => {
                playSfx('ui.pop');
                void import('@/game/PlayPage');
                navigate(`/play?slot=${slot}`);
              }}
              onDelete={(slot) => void onDelete(slot)}
              onImport={(file) => void onImport(file)}
            />
          ) : null}
          {mode === 'settings' ? (
            <TitlePanel
              key="settings"
              label={t('settings.title')}
              onClose={() => setMode('menu')}
              closeButton={false}
            >
              <div className="h-[min(44rem,calc(100dvh-2rem))]">
                <SettingsBoard onClose={() => setMode('menu')} />
              </div>
            </TitlePanel>
          ) : null}
          {mode === 'credits' ? (
            <CreditsPanel key="credits" onClose={() => setMode('menu')} />
          ) : null}
        </AnimatePresence>
        <ToastViewport />
        <RotatePrompt />
      </main>
    </MotionConfig>
  );
}
