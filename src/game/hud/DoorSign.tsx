import { MousePointerClick, Receipt } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '@/audio';
import { runCommand } from '@/game/actions';
import { useGame } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { Button } from '@/ui/components/Button';
import { useShellStore } from '../session/shellStore';

/** "Close early?" bubble under the sign: a big irreversible action gets a confirmation (§4). */
function CloseEarlyBubble() {
  const { t } = useTranslation('shell');
  const setConfirm = useShellStore((store) => store.setConfirmClose);
  const bubbleRef = useRef<HTMLDivElement>(null);
  // The safe choice gets focus, so Enter never closes the shop by accident.
  useEffect(() => bubbleRef.current?.querySelector('button')?.focus(), []);
  return (
    <div
      ref={bubbleRef}
      role="alertdialog"
      aria-labelledby="close-early-title"
      aria-describedby="close-early-body"
      className="absolute top-[calc(100%+14px)] right-1/2 z-30 w-72 translate-x-1/2 rounded-2xl border-[3px] border-ink bg-paper p-4 text-ink shadow-[0_5px_0_var(--color-ink)] [@media(max-height:540px)]:w-64 [@media(max-height:540px)]:p-3"
    >
      <span className="absolute bottom-full left-1/2 -mb-[2px] size-4 -translate-x-1/2 translate-y-1/2 rotate-45 border-t-[3px] border-l-[3px] border-ink bg-paper" />
      <p id="close-early-title" className="font-display text-xl tracking-wide">
        {t('hud.closeEarly.title')}
      </p>
      <p id="close-early-body" className="mt-1 text-sm text-ink/75">
        {t('hud.closeEarly.body')}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            playSfx('ui.close');
            setConfirm(false);
          }}
        >
          {t('hud.closeEarly.cancel')}
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            setConfirm(false);
            playSfx('shop.doorBell');
            runCommand({ type: 'time/closeShop' });
          }}
        >
          {t('hud.closeEarly.confirm')}
        </Button>
      </div>
    </div>
  );
}

/**
 * The big flippable OPEN/CLOSED door sign (docs/05 §3.1). Prep: flip it to open the shop. Open:
 * closing early asks first. Night: it shows CLOSED and brings back the day's receipt.
 */
export function DoorSign() {
  const { t } = useTranslation('shell');
  const tc = useTranslation().t;
  const phase = useGame((game) => game.clock.phase, 'prep');
  const confirm = useShellStore((store) => store.confirmClose);
  const setConfirm = useShellStore((store) => store.setConfirmClose);
  const [swinging, setSwinging] = useState(false);
  const open = phase === 'open';

  // Swing on every flip, whoever flipped it (the sign, a shortcut or closing time).
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    setSwinging(true);
  }, [phase]);

  const onClick = () => {
    if (phase === 'prep') {
      playSfx('shop.doorBell');
      runCommand({ type: 'time/openShop' });
    } else if (phase === 'open') {
      playSfx('ui.pop');
      setConfirm(!confirm);
    } else {
      playSfx('ui.receipt');
      useUiStore.getState().setSummaryOpen(true);
    }
  };

  const label =
    phase === 'prep'
      ? t('hud.sign.openAria')
      : phase === 'open'
        ? t('hud.sign.closeAria')
        : t('hud.sign.nightAria');
  const face =
    'flex h-full w-full flex-col items-center justify-center rounded-xl border-[3px] border-ink px-3 shadow-[inset_0_-5px_0_rgb(0_0_0/0.15)]';

  return (
    <div className="relative flex flex-col items-center">
      {/* The nail and string it hangs from. */}
      <svg
        viewBox="0 0 100 16"
        className="h-3.5 w-[100px] [@media(max-height:540px)]:h-2.5"
        aria-hidden="true"
      >
        <path
          d="M22 16 L50 3 L78 16"
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle
          cx="50"
          cy="3"
          r="3"
          fill="var(--color-sun)"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
        />
      </svg>
      <button
        type="button"
        onClick={onClick}
        onAnimationEnd={(event) => {
          if (event.animationName === 'door-sign-swing') setSwinging(false);
        }}
        aria-label={label}
        aria-expanded={phase === 'open' ? confirm : undefined}
        data-open={open}
        className={`door-sign ${swinging ? 'is-swinging' : ''} -mt-0.5 h-[60px] w-[132px] rounded-xl outline-offset-4 drop-shadow-[0_4px_0_var(--color-ink)] [@media(max-height:540px)]:h-11 [@media(max-height:540px)]:w-24`}
      >
        <span className="door-sign__sway">
          <span className="door-sign__card h-full w-full">
            <span className={`door-sign__face door-sign__face--closed ${face} bg-coral`}>
              <span className="font-display text-2xl leading-none tracking-[0.12em] text-white [text-shadow:0_2px_0_var(--color-ink)] [@media(max-height:540px)]:text-lg">
                {tc('sign.closed')}
              </span>
              <span className="flex items-center gap-1 font-hand text-base leading-none font-bold text-white [@media(max-height:540px)]:hidden">
                {phase === 'prep' ? (
                  <>
                    <MousePointerClick className="hint-bob size-4" aria-hidden="true" />
                    {t('hud.sign.flipHint')}
                  </>
                ) : (
                  <>
                    <Receipt className="size-3.5" aria-hidden="true" />
                    {t('hud.sign.night')}
                  </>
                )}
              </span>
            </span>
            <span className={`door-sign__face door-sign__face--open ${face} bg-mint`}>
              <span className="font-display text-2xl leading-none tracking-[0.12em] text-white [text-shadow:0_2px_0_var(--color-ink)] [@media(max-height:540px)]:text-lg">
                {tc('sign.open')}
              </span>
              <span className="font-hand text-base leading-none font-bold text-ink [@media(max-height:540px)]:hidden">
                {t('hud.sign.welcome')}
              </span>
            </span>
          </span>
        </span>
      </button>
      {open && confirm ? <CloseEarlyBubble /> : null}
    </div>
  );
}
