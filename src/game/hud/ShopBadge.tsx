import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { xpProgress } from '@/sim/selectors';
import { useGameStore } from '@/state/gameStore';
import { AvatarPortrait } from '../newgame/AvatarPortrait';
import { HudTip } from './HudTip';

const RING_R = 27;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Top-left of the HUD (docs/05 §3.1): the owner's portrait inside an XP ring, the level medal and
 * the shop's name on a little wooden plaque. The tip explains where XP comes from.
 */
export function ShopBadge() {
  const { t } = useTranslation('shell');
  const badge = useGameStore(
    useShallow((store) => {
      const game = store.game;
      if (!game) return null;
      const xp = xpProgress(game);
      return {
        name: game.meta.shopName,
        owner: game.meta.owner,
        level: xp.level,
        xp: xp.xp,
        needed: xp.needed,
        ratio: xp.ratio,
      };
    }),
  );
  if (!badge) return null;
  const maxed = !Number.isFinite(badge.needed);

  return (
    <HudTip
      align="start"
      content={
        <>
          <span className="block font-display tracking-wide">
            {t('hud.level', { level: badge.level })}
          </span>
          <span className="block tabular-nums">
            {maxed
              ? t('hud.levelMax')
              : t('hud.levelTip', {
                  xp: badge.xp,
                  needed: badge.needed,
                  left: badge.needed - badge.xp,
                  next: badge.level + 1,
                })}
          </span>
          <span className="mt-1 block text-ink/70">{t('hud.xpWhy')}</span>
        </>
      }
    >
      <section
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users reach the XP explanation.
        tabIndex={0}
        aria-label={`${badge.name} · ${t('hud.level', { level: badge.level })}`}
        className="flex items-center rounded-2xl outline-offset-4"
      >
        <div className="relative z-10 size-[68px] shrink-0 [@media(max-height:540px)]:size-[50px]">
          <svg
            viewBox="0 0 64 64"
            className="absolute inset-0 size-full -rotate-90"
            aria-hidden="true"
          >
            <circle cx="32" cy="32" r="30.5" fill="var(--color-ink)" />
            <circle
              cx="32"
              cy="32"
              r={RING_R}
              fill="none"
              stroke="var(--color-woodDark)"
              strokeWidth="5"
            />
            <circle
              className="xp-ring__fill"
              cx="32"
              cy="32"
              r={RING_R}
              fill="none"
              stroke="var(--color-sun)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - badge.ratio)}
            />
          </svg>
          <div className="absolute inset-[9px] overflow-hidden rounded-full border-2 border-ink bg-sky">
            <AvatarPortrait
              spec={badge.owner}
              expression="happy"
              crop="head"
              className="size-full"
            />
          </div>
          <span
            key={badge.level}
            data-level-badge
            className="level-pop absolute -right-1.5 -bottom-1 grid h-6 min-w-6 place-items-center rounded-full border-[3px] border-ink bg-sun px-1 font-display text-sm leading-none text-ink shadow-[0_2px_0_var(--color-ink)] [@media(max-height:540px)]:h-5 [@media(max-height:540px)]:min-w-5 [@media(max-height:540px)]:text-xs"
          >
            {badge.level}
          </span>
        </div>
        <div className="-ml-3 max-w-[15rem] rounded-r-2xl border-[3px] border-l-0 border-ink bg-wood py-1.5 pr-4 pl-5 shadow-[inset_0_-5px_0_var(--color-woodDark),0_4px_0_var(--color-ink)] [@media(max-height:540px)]:max-w-[9rem] [@media(max-height:540px)]:py-1 [@media(max-height:540px)]:pr-3">
          <p className="truncate font-display text-xl leading-tight tracking-wide text-paper [text-shadow:0_2px_0_var(--color-ink)] [@media(max-height:540px)]:text-base">
            {badge.name}
          </p>
          <p className="font-display text-xs tracking-wider text-sun tabular-nums [@media(max-height:540px)]:hidden">
            {maxed
              ? t('hud.levelMax')
              : t('xp', { ns: 'common', xp: badge.xp, needed: badge.needed })}
          </p>
        </div>
      </section>
    </HudTip>
  );
}
