import { BookOpen, type LucideIcon, Package, Settings, Tags, Truck } from 'lucide-react';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '@/state/gameStore';
import { type SheetId, useUiStore } from '@/state/uiStore';
import { useShellStore } from '../session/shellStore';
import { shortcutKeyOf } from '../session/shortcuts';
import { toggleSheet } from '../session/useGameSession';

interface DockKeyDef {
  id: SheetId;
  icon: LucideIcon;
  /** Progressive disclosure (docs/05 §1.4): the key appears once this unlock is granted. */
  unlock?: string;
  /** Token class for the icon's color chip. */
  chip: string;
}

const KEYS: readonly DockKeyDef[] = [
  { id: 'inventory', icon: Package, chip: 'bg-sun text-ink' },
  { id: 'prices', icon: Tags, unlock: 'unlock.feature.pricing', chip: 'bg-mint text-ink' },
  { id: 'crate', icon: Truck, unlock: 'unlock.supplier.budget-box', chip: 'bg-sky text-white' },
  { id: 'binder', icon: BookOpen, unlock: 'unlock.feature.binder', chip: 'bg-coral text-white' },
];

function Badge({ children, tone, label }: { children: string; tone: string; label: string }) {
  return (
    <span
      className={`dock-badge absolute -top-2.5 -right-2.5 grid h-6 min-w-6 place-items-center rounded-full border-[3px] border-ink px-1 font-display text-xs leading-none shadow-[0_2px_0_var(--color-ink)] [@media(max-height:540px)]:-top-2 [@media(max-height:540px)]:-right-2 ${tone}`}
      title={label}
    >
      {children}
    </span>
  );
}

function DockKey({
  def,
  active,
  badge,
}: {
  def: DockKeyDef | { id: 'settings'; icon: LucideIcon; chip: string };
  active: boolean;
  badge?: { text: string; tone: string; label: string } | null;
}) {
  const { t } = useTranslation('shell');
  const letter = shortcutKeyOf(def.id);
  const Icon = def.icon;
  const label = t(`dock.${def.id}`);
  return (
    <button
      type="button"
      data-dock-target={def.id}
      aria-pressed={active}
      aria-keyshortcuts={letter ?? undefined}
      aria-label={badge ? `${label} (${badge.label})` : label}
      title={letter ? `${label} · ${t('dock.keyHint', { key: letter })}` : label}
      onClick={() => toggleSheet(def.id)}
      className={`dock-key relative flex h-[68px] w-[76px] flex-col items-center justify-center gap-1 rounded-2xl border-[3px] border-ink font-display text-sm tracking-wide text-ink outline-offset-4 [@media(max-height:540px)]:h-12 [@media(max-height:540px)]:w-12 [@media(max-height:540px)]:rounded-xl ${
        active
          ? 'translate-y-[4px] bg-paper2 shadow-[inset_0_3px_0_rgb(0_0_0/0.18)]'
          : 'bg-paper shadow-[inset_0_-4px_0_rgb(0_0_0/0.08),0_4px_0_var(--color-ink)] hover:-translate-y-0.5 active:translate-y-[4px] active:shadow-none'
      }`}
    >
      <span
        className={`grid size-8 place-items-center rounded-lg border-[2.5px] border-ink [@media(max-height:540px)]:size-7 ${def.chip}`}
        aria-hidden="true"
      >
        <Icon className="size-[18px]" strokeWidth={2.5} />
      </span>
      <span className="leading-none [@media(max-height:540px)]:hidden">{label}</span>
      {letter ? (
        <kbd className="pointer-events-none absolute top-1 left-1 grid size-4 place-items-center rounded border-[1.5px] border-ink/40 bg-white/70 font-ui text-[9px] font-black leading-none text-ink/70 [@media(hover:none)]:hidden [@media(max-height:540px)]:hidden">
          {letter}
        </kbd>
      ) : null}
      {badge ? (
        <Badge tone={badge.tone} label={badge.label}>
          {badge.text}
        </Badge>
      ) : null}
    </button>
  );
}

/**
 * The bottom dock (docs/05 §3.1): chunky key buttons with letter shortcuts and badges for
 * pending work. Phone landscape turns it into an icon rail on the right edge (docs/05 §3.2).
 */
const NO_UNLOCKS: Readonly<Record<string, number>> = {};

export function Dock({ ref }: { ref?: Ref<HTMLElement> }) {
  const { t } = useTranslation('shell');
  const sheet = useUiStore((ui) => ui.sheet);
  const unlocked = useGame((game) => game.progression.unlocked, NO_UNLOCKS);
  const pending = useGame(
    (game) => game.suppliers.orders.filter((order) => order.status === 'pending').length,
    0,
  );
  const deliveries = useShellStore((store) => store.deliveriesUnseen);
  const newCards = useShellStore((store) => store.newCardsUnseen);

  const badgeFor = (id: SheetId) => {
    if (id === 'inventory' && deliveries > 0)
      return {
        text: String(deliveries),
        tone: 'bg-mint text-ink',
        label: t('dock.badge.delivery', { count: deliveries }),
      };
    if (id === 'crate' && pending > 0)
      return {
        text: String(pending),
        tone: 'bg-sky text-white',
        label: t('dock.badge.pending', { count: pending }),
      };
    if (id === 'binder' && newCards > 0)
      return {
        text: String(newCards),
        tone: 'bg-grape text-white',
        label: t('dock.badge.cards', { count: newCards }),
      };
    return null;
  };

  return (
    <nav
      ref={ref}
      aria-label={t('dock.label')}
      className="pointer-events-auto flex items-end gap-2.5 rounded-[22px] border-[3px] border-ink bg-wood p-2.5 pb-3 shadow-[inset_0_-6px_0_var(--color-woodDark),0_5px_0_var(--color-ink)] [@media(max-height:540px)]:flex-col [@media(max-height:540px)]:items-center [@media(max-height:540px)]:gap-2 [@media(max-height:540px)]:rounded-2xl [@media(max-height:540px)]:p-1.5 [@media(max-height:540px)]:pb-2"
    >
      {KEYS.filter((def) => !def.unlock || unlocked[def.unlock] !== undefined).map((def) => (
        <DockKey key={def.id} def={def} active={sheet === def.id} badge={badgeFor(def.id)} />
      ))}
      <span
        className="mx-0.5 h-12 w-[3px] self-center rounded-full bg-woodDark [@media(max-height:540px)]:mx-0 [@media(max-height:540px)]:my-0.5 [@media(max-height:540px)]:h-[3px] [@media(max-height:540px)]:w-8"
        aria-hidden="true"
      />
      <DockKey
        def={{ id: 'settings', icon: Settings, chip: 'bg-paper2 text-ink' }}
        active={sheet === 'settings'}
      />
    </nav>
  );
}
