import {
  FolderOpen,
  Heart,
  type LucideIcon,
  Play,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '@/audio';
import { formatMoney } from '@/core/money';
import type { SaveSummary } from '@/save/saveFile';

export type MenuAction = 'continue' | 'newGame' | 'load' | 'settings' | 'credits';

interface CardDef {
  action: MenuAction;
  icon: LucideIcon;
  band: string;
}

const CARDS: Record<MenuAction, CardDef> = {
  continue: { action: 'continue', icon: Play, band: 'bg-sun text-ink' },
  newGame: { action: 'newGame', icon: Sparkles, band: 'bg-teal text-white' },
  load: { action: 'load', icon: FolderOpen, band: 'bg-sky text-white' },
  settings: { action: 'settings', icon: SlidersHorizontal, band: 'bg-paper2 text-ink' },
  credits: { action: 'credits', icon: Heart, band: 'bg-grape text-white' },
};

/** Fan layout for up to five cards: tilt and how far each sits below the arc's top. */
const FAN: Record<number, readonly [number, number][]> = {
  4: [
    [-7, 22],
    [-2.5, 4],
    [2.5, 4],
    [7, 22],
  ],
  5: [
    [-9, 34],
    [-4.5, 10],
    [0, 0],
    [4.5, 10],
    [9, 34],
  ],
};

function MenuCard({
  def,
  hero,
  tilt,
  drop,
  onSelect,
  children,
}: {
  def: CardDef;
  hero: boolean;
  tilt: number;
  drop: number;
  onSelect(action: MenuAction): void;
  children?: ReactNode;
}) {
  const { t } = useTranslation('shell');
  const Icon = def.icon;
  return (
    <button
      type="button"
      data-menu-card={def.action}
      onClick={() => {
        playSfx('ui.pop');
        onSelect(def.action);
      }}
      onPointerEnter={() => playSfx('ui.tab', { volume: 0.35 })}
      className={`title-card group relative flex shrink-0 flex-col overflow-hidden rounded-[20px] border-[3px] border-ink bg-paper text-left text-ink shadow-[0_7px_0_var(--color-ink)] outline-offset-4 ${
        hero
          ? 'title-card--hero h-[17.5rem] w-[13.5rem] [@media(max-height:540px)]:h-[10.5rem] [@media(max-height:540px)]:w-[8.75rem]'
          : 'h-[15.5rem] w-[11rem] [@media(max-height:540px)]:h-[9.5rem] [@media(max-height:540px)]:w-[7.25rem]'
      }`}
      style={{ '--tilt': `${tilt}deg`, '--drop': `${drop}px` } as CSSProperties}
    >
      <span
        className={`relative flex h-[42%] items-center justify-center border-b-[3px] border-ink ${def.band}`}
      >
        <span className="grid size-16 -rotate-6 place-items-center rounded-2xl border-[3px] border-ink bg-white/90 text-ink shadow-[0_4px_0_var(--color-ink)] transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110 [@media(max-height:540px)]:size-10 [@media(max-height:540px)]:rounded-xl">
          <Icon
            className="size-8 [@media(max-height:540px)]:size-5"
            strokeWidth={2.6}
            aria-hidden="true"
          />
        </span>
        {hero ? (
          <span
            className="title-card__shine pointer-events-none absolute inset-0"
            aria-hidden="true"
          />
        ) : null}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-3 [@media(max-height:540px)]:gap-0.5 [@media(max-height:540px)]:p-2">
        <span className="font-display text-2xl leading-none tracking-wide [@media(max-height:540px)]:text-base">
          {t(`title.${def.action}.title`)}
        </span>
        {children ?? (
          <span className="text-sm leading-snug font-semibold text-ink/65 [@media(max-height:540px)]:text-[11px]">
            {hero && def.action === 'newGame'
              ? t('title.newGame.heroHint')
              : t(`title.${def.action}.hint`)}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * The title menu (docs/05 §5.1): chunky cards held like a hand of cards. Continue is the foil
 * hero card with the latest save's shop, day, level and cash; without a save New Game takes its
 * place. Arrow keys move along the hand.
 */
export function TitleMenu({
  latest,
  onSelect,
}: {
  latest: SaveSummary | null;
  onSelect(action: MenuAction): void;
}) {
  const { t } = useTranslation('shell');
  const actions: MenuAction[] = latest
    ? ['load', 'newGame', 'continue', 'settings', 'credits']
    : ['load', 'newGame', 'settings', 'credits'];
  const hero: MenuAction = latest ? 'continue' : 'newGame';
  const fan = FAN[actions.length] ?? FAN[5] ?? [];

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const cards = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-menu-card]')];
    const index = cards.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      cards[(index + (event.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length];
    next?.focus();
    event.preventDefault();
  };

  return (
    <nav
      aria-label={t('title.menuLabel')}
      onKeyDown={onKeyDown}
      className="title-fade-in flex items-end justify-center gap-3 [@media(max-height:540px)]:gap-2"
    >
      {actions.map((action, index) => {
        const [tilt, drop] = fan[index] ?? [0, 0];
        return (
          <MenuCard
            key={action}
            def={CARDS[action]}
            hero={action === hero}
            tilt={tilt}
            drop={drop}
            onSelect={onSelect}
          >
            {action === 'continue' && latest ? (
              <>
                <span className="truncate font-hand text-xl leading-none font-bold text-ink [@media(max-height:540px)]:text-base">
                  {latest.shopName}
                </span>
                <span className="text-sm font-bold text-ink/65 [@media(max-height:540px)]:text-[11px]">
                  {t('title.continue.stats', { day: latest.day, level: latest.level })}
                </span>
                <span className="mt-auto -rotate-3 self-start rounded-md border-2 border-ink bg-sun px-2 py-0.5 font-display text-lg leading-none tabular-nums shadow-[0_2px_0_var(--color-ink)] [@media(max-height:540px)]:text-sm">
                  {formatMoney(latest.cashCents)}
                </span>
              </>
            ) : null}
          </MenuCard>
        );
      })}
    </nav>
  );
}
