import { KeyRound } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { lazy, type RefObject, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '@/audio';
import { checkoutAtRegister, runCommand } from '@/game/actions';
import { FixturePopover } from '@/game/popover/FixturePopover';
import { useGame, useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useUiStore } from '@/state/uiStore';
import { ToastViewport } from '@/ui/components/Toasts';
import { CelebrationHost } from './celebrations/CelebrationHost';
import { Dock } from './hud/Dock';
import { Hud } from './hud/Hud';
import { browserHints, resolveQuality } from './session/quality';
import { useApplySettings, useReducedMotion } from './session/useApplySettings';
import { useGameSession } from './session/useGameSession';
import { LoadingDots } from './shell/LoadingDots';
import { type Insets, isCompact, sceneInsets } from './shell/layout';
import { RotatePrompt } from './shell/RotatePrompt';
import { SheetHost } from './shell/SheetHost';
import { StageHost } from './shell/StageHost';
import { DaySummary } from './summary/DaySummary';
import './shell/shell.css';

/** The live diorama is the 3D chunk: only /play downloads three.js (vite.config.ts). */
const LiveShopScene = lazy(() => import('@/scene/live/LiveShopScene'));

function SceneLoading() {
  const { t } = useTranslation('shell');
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_45%,var(--color-tablet),var(--color-night))] text-paper">
      <p className="flex flex-col items-center gap-4 font-display text-2xl tracking-wide">
        <KeyRound className="size-12 animate-bounce text-sun" aria-hidden="true" />
        {t('session.loading')}
      </p>
    </div>
  );
}

function SessionLoading() {
  const { t } = useTranslation('shell');
  return (
    <main className="grid h-full place-items-center bg-night text-paper">
      <p className="flex flex-col items-center gap-4 font-display text-2xl tracking-wide">
        <LoadingDots />
        {t('session.loading')}
      </p>
    </main>
  );
}

/** Measures the HUD bar and the dock, and turns them into scene insets (docs/05 §9). */
function useSceneInsets(
  rootRef: RefObject<HTMLDivElement | null>,
  barRef: RefObject<HTMLDivElement | null>,
  dockRef: RefObject<HTMLElement | null>,
  sheetOpen: boolean,
): { insets: Insets; compact: boolean } {
  const [box, setBox] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    hudBottom: 90,
    dock: { width: 0, height: 0 },
  }));
  useEffect(() => {
    const measure = () => {
      const bar = barRef.current?.getBoundingClientRect();
      const dock = dockRef.current?.getBoundingClientRect();
      const hudBottom = Math.round(bar?.bottom ?? 90);
      rootRef.current?.style.setProperty('--hud-bottom', `${hudBottom}px`);
      setBox({
        width: window.innerWidth,
        height: window.innerHeight,
        hudBottom,
        dock: { width: Math.round(dock?.width ?? 0), height: Math.round(dock?.height ?? 0) },
      });
    };
    const observer = new ResizeObserver(measure);
    if (barRef.current) observer.observe(barRef.current);
    if (dockRef.current) observer.observe(dockRef.current);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [rootRef, barRef, dockRef]);
  return { insets: sceneInsets({ ...box, sheetOpen }), compact: isCompact(box.width, box.height) };
}

/** Clicking the customer at the pay spot rings them up, like clicking the register. */
function onCustomerClick(uid: number): void {
  const lane = useGameStore.getState().game?.customers.lane;
  if (lane?.[0] === uid) runCommand({ type: 'customers/checkout', uid });
}

function PlayScreen() {
  const { t } = useTranslation('shell');
  const shopName = useGame((game) => game.meta.shopName, '');
  const sheet = useUiStore((ui) => ui.sheet);
  const fixtureUid = useUiStore((ui) => ui.fixtureUid);
  const qualitySetting = useSettingsStore((store) => store.settings.quality);
  const quality = resolveQuality(qualitySetting, browserHints());
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const { insets, compact } = useSceneInsets(rootRef, barRef, dockRef, sheet !== null);
  const closeFixture = useUiStore((ui) => ui.closeFixture);

  return (
    <div
      ref={rootRef}
      className="play-root fixed inset-0 overflow-hidden bg-night text-ink select-none"
      data-sheet-open={sheet !== null && !compact}
    >
      <h1 className="sr-only">{shopName}</h1>
      <section
        className="absolute inset-0"
        aria-label={t('session.sceneLabel', { shop: shopName })}
      >
        <Suspense fallback={<SceneLoading />}>
          <LiveShopScene
            className="absolute inset-0"
            quality={quality}
            insets={insets}
            shopName={shopName}
            anchored={
              fixtureUid
                ? {
                    fixtureUid,
                    content: <FixturePopover fixtureUid={fixtureUid} onClose={closeFixture} />,
                  }
                : null
            }
            onFixtureClick={(uid) => {
              playSfx('ui.pop');
              useUiStore.getState().openFixture(uid);
            }}
            onRegisterClick={() => {
              checkoutAtRegister();
            }}
            onCustomerClick={onCustomerClick}
            onBackgroundClick={() => useUiStore.getState().closeFixture()}
          />
        </Suspense>
      </section>
      <Hud barRef={barRef} />
      <div className="dock-dock pointer-events-none fixed right-0 bottom-3 left-0 z-10 flex justify-center [@media(max-height:540px)]:right-2 [@media(max-height:540px)]:bottom-2 [@media(max-height:540px)]:left-auto">
        <Dock ref={dockRef} />
      </div>
      <SheetHost />
      <DaySummary />
      <StageHost />
      <CelebrationHost />
      <ToastViewport />
      <RotatePrompt />
    </div>
  );
}

/**
 * The play screen (docs/05 §2): the live shop full-bleed (layer 0), the HUD and dock (layer 1),
 * sheets (2), the Day Summary and the pack-opening stage, celebrations (4), toasts (5), plus a
 * rotate prompt for portrait phones. The session hook loads the game and runs the loop.
 */
export default function PlayPage() {
  useApplySettings();
  const status = useGameSession();
  const reduced = useReducedMotion();
  if (status !== 'ready') return <SessionLoading />;
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <PlayScreen />
    </MotionConfig>
  );
}
