import type { SheetId } from '@/state/uiStore';

/**
 * How an unlock or placeholder perk looks on its level-up card (docs/05 §6: "unlock cards fly to
 * the dock"). Names and blurbs are i18n keys by id (`shell:unlock.<id>` / `shell:perk.<id>`);
 * this module only picks the icon and where the card flies.
 */
export type UnlockIcon =
  | 'truck'
  | 'shelf'
  | 'tag'
  | 'pack'
  | 'binder'
  | 'case'
  | 'chart'
  | 'manga'
  | 'storage'
  | 'discount'
  | 'sparkle';

export interface UnlockVisual {
  icon: UnlockIcon;
  /** Dock key the card flies into; `null` flies to the level badge. */
  dock: SheetId | null;
  /** Accent token name from `src/ui/tokens.css`. */
  tone: 'teal' | 'sun' | 'coral' | 'sky' | 'grape' | 'mint';
}

const UNLOCKS: Readonly<Record<string, UnlockVisual>> = {
  'unlock.supplier.budget-box': { icon: 'truck', dock: 'crate', tone: 'sky' },
  'unlock.supplier.harbor-hobby': { icon: 'truck', dock: 'crate', tone: 'teal' },
  'unlock.fixture.wall-shelf-small': { icon: 'shelf', dock: 'inventory', tone: 'sun' },
  'unlock.fixture.gondola': { icon: 'shelf', dock: 'inventory', tone: 'sun' },
  'unlock.fixture.bargain-bin': { icon: 'shelf', dock: 'inventory', tone: 'coral' },
  'unlock.feature.pricing': { icon: 'tag', dock: 'prices', tone: 'mint' },
  'unlock.feature.pack-opening': { icon: 'pack', dock: 'inventory', tone: 'grape' },
  'unlock.feature.binder': { icon: 'binder', dock: 'binder', tone: 'coral' },
  'unlock.feature.singles-case': { icon: 'case', dock: 'inventory', tone: 'sky' },
  'unlock.app.foiltrack': { icon: 'chart', dock: null, tone: 'teal' },
  'unlock.category.manga': { icon: 'manga', dock: null, tone: 'grape' },
};

const PERKS: Readonly<Record<string, UnlockVisual>> = {
  'perk.storage-10': { icon: 'storage', dock: 'inventory', tone: 'sun' },
  'perk.supplier-2': { icon: 'discount', dock: 'crate', tone: 'mint' },
};

const FALLBACK: UnlockVisual = { icon: 'sparkle', dock: null, tone: 'grape' };

export function unlockVisual(unlockId: string): UnlockVisual {
  return UNLOCKS[unlockId] ?? FALLBACK;
}

export function perkVisual(perkId: string): UnlockVisual {
  return PERKS[perkId] ?? FALLBACK;
}

/** One card per unlock and perk, in grant order (unlocks first). */
export interface RewardCard {
  kind: 'unlock' | 'perk';
  id: string;
  visual: UnlockVisual;
}

export function rewardCards(
  unlockIds: readonly string[],
  perkIds: readonly string[],
): RewardCard[] {
  return [
    ...unlockIds.map((id) => ({ kind: 'unlock' as const, id, visual: unlockVisual(id) })),
    ...perkIds.map((id) => ({ kind: 'perk' as const, id, visual: perkVisual(id) })),
  ];
}
