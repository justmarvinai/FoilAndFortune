import { button, Leva, useControls } from 'leva';
import { useEffect } from 'react';
import { defaultBalance } from '@/content/balance';
import { dollars } from '@/core/money';
import { useGameStore } from '@/state/gameStore';
import { Panel } from '@/ui/components';
import { grantCash, grantXp, playDays, sandboxTuning, skipMinutes, skipToClose } from './cheats';

// Debug page: exempt from i18n (CLAUDE.md).

/** Leva themed with our tokens so the dev panel sits naturally inside a tablet panel. */
const levaTheme = {
  colors: {
    elevation1: 'rgb(0 0 0 / 0.25)',
    elevation2: 'transparent',
    elevation3: 'rgb(255 255 255 / 0.1)',
    accent1: 'var(--color-teal)',
    accent2: 'var(--color-teal)',
    accent3: 'var(--color-sky)',
    highlight1: 'rgb(255 246 229 / 0.45)',
    highlight2: 'rgb(255 246 229 / 0.85)',
    highlight3: 'var(--color-paper)',
    vivid1: 'var(--color-sun)',
  },
  fonts: { mono: 'var(--font-legible)', sans: 'var(--font-ui)' },
  fontSizes: { root: '13px' },
  sizes: { rootWidth: '100%', controlWidth: '58%', rowHeight: '28px' },
  radii: { xs: '4px', sm: '8px', lg: '12px' },
};

function RawState() {
  const game = useGameStore((store) => store.game);
  return (
    <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-black/30 p-3 font-legible text-[11px] leading-snug text-paper/80">
      {JSON.stringify(game, null, 2)}
    </pre>
  );
}

/** The leva dev panel (docs/06 §19): time warp, grants and a raw state inspector. */
export function DevToolsPanel() {
  const { minuteMs, showState } = useControls({
    minuteMs: {
      label: 'ms / game-min',
      value: defaultBalance.time.realSecondsPerGameMinute * 1000,
      min: 5,
      max: 1200,
      step: 5,
    },
    showState: { label: 'raw state', value: false },
    'Skip 1 hour': button(() => skipMinutes(60)),
    'Skip to closing': button(skipToClose),
    'Play 7 days': button(() => playDays(7)),
    '+ $1,000': button(() => grantCash(dollars(1000))),
    '− $500': button(() => grantCash(dollars(-500))),
    '+ 250 XP': button(() => grantXp(250)),
  });

  useEffect(() => {
    sandboxTuning.minuteMs = minuteMs;
  }, [minuteMs]);

  return (
    <Panel theme="tablet" title="Dev panel">
      <p className="mb-3 text-sm text-paper/70">
        Cheats run through the real commands and tick pipeline, so rent, loans and level-ups fire as
        they would in play.
      </p>
      <div className="overflow-hidden rounded-xl">
        <Leva fill flat titleBar={false} hideCopyButton theme={levaTheme} />
      </div>
      {showState ? <RawState /> : null}
    </Panel>
  );
}
