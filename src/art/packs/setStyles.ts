import type { ElementId } from '@/content/schema/common';
import type { ProductDef, SetDef } from '@/content/schema/tcg';
import { elements } from '@/content/tcg/gk/elements';
import type { MascotId } from './mascots';
import { hashString } from './svg';

/**
 * Per-set trade dress for sealed products (docs/04 §5.5, docs/03 §3.5 "3–4 pack wrappers per
 * set"). Authored sets get a hand-picked palette; any other set (future sets, Set Forge) gets a
 * deterministic palette from its code, so a new set never renders blank.
 */

export type EmblemId = 'sunrise' | 'star';

export interface WrapperVariant {
  mascot: MascotId;
  /** Wrapper gradient, top → bottom. */
  top: string;
  mid: string;
  bottom: string;
  /** Sunburst and halo tint behind the mascot. */
  burst: string;
}

export interface SetArtStyle {
  code: string;
  name: string;
  /** Ribbon behind the set name and its text color. */
  band: string;
  bandText: string;
  emblem: EmblemId;
  /** Booster wrapper variants; blisters and boxes reuse them. */
  variants: readonly WrapperVariant[];
  /** The set's headline creature (booster box lid). */
  hero: MascotId;
}

/** Emberdawn: a volcanic island at sunrise, where the sun phoenix Solaryx returns (docs/03 §4). */
const emberdawnStyle: Omit<SetArtStyle, 'code' | 'name'> = {
  band: '#1E2340',
  bandText: '#FFD166',
  emblem: 'sunrise',
  hero: 'solaryx',
  variants: [
    { mascot: 'solaryx', top: '#FFE27A', mid: '#FF9F43', bottom: '#E8505B', burst: '#FFF6D8' },
    { mascot: 'magmadillo', top: '#FFAA5E', mid: '#D9413B', bottom: '#5E1E4E', burst: '#FFD9A8' },
    { mascot: 'boltbuck', top: '#FFF6B0', mid: '#FFC93C', bottom: '#EE7F2A', burst: '#FFFBE6' },
    { mascot: 'emberpup', top: '#FFC27A', mid: '#FF6F59', bottom: '#A82E52', burst: '#FFEBD0' },
  ],
};

const AUTHORED: Record<string, Omit<SetArtStyle, 'code' | 'name'>> = {
  'gk.emberdawn': emberdawnStyle,
};

const FALLBACK_MASCOTS: readonly MascotId[] = ['sprite', 'sparkit', 'sploot', 'emberpup'];

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h) % 360},${Math.round(s)}%,${Math.round(l)}%)`;
}

/** A deterministic palette for sets without authored art. */
function generatedStyle(key: string): Omit<SetArtStyle, 'code' | 'name'> {
  const hue = hashString(key) % 360;
  return {
    band: '#1E2340',
    bandText: hsl(hue + 40, 95, 75),
    emblem: 'star',
    hero: FALLBACK_MASCOTS[hashString(`${key}:hero`) % FALLBACK_MASCOTS.length] ?? 'sprite',
    variants: FALLBACK_MASCOTS.map((mascot, i) => ({
      mascot,
      top: hsl(hue + i * 24, 90, 78),
      mid: hsl(hue + i * 24 + 18, 80, 60),
      bottom: hsl(hue + i * 24 + 40, 65, 38),
      burst: hsl(hue + i * 24, 100, 94),
    })),
  };
}

export function setArtStyle(set: Pick<SetDef, 'id' | 'code' | 'name'> | undefined): SetArtStyle {
  const key = set?.id ?? 'unknown';
  const base = AUTHORED[key] ?? generatedStyle(key);
  return { ...base, code: set?.code ?? '???', name: set?.name ?? '' };
}

/** The wrapper variant for an index (wraps around; negative indices are fine). */
export function wrapperVariant(style: SetArtStyle, variant: number): WrapperVariant {
  const count = style.variants.length;
  const index = ((Math.trunc(variant) % count) + count) % count;
  return style.variants[index] as WrapperVariant;
}

const ELEMENT_MASCOT: Partial<Record<ElementId, MascotId>> = {
  ember: 'emberpup',
  volt: 'sparkit',
  tide: 'sploot',
};

export interface DeckTheme {
  element: ElementId;
  mascot: MascotId;
  color: string;
  tint: string;
  shade: string;
}

/**
 * A starter deck's theme element, read from its content id (e.g. `gk.emberdawn.starter-ember`):
 * Ember Blaze is the Emberpup line, Volt Surge the Sparkit line (docs/03 §4.1).
 */
export function deckTheme(product: Pick<ProductDef, 'id'>): DeckTheme {
  const tail = product.id.split('.').pop() ?? '';
  const element =
    (Object.keys(elements) as ElementId[]).find((id) => tail.includes(id)) ?? 'neutral';
  const def = elements[element];
  return {
    element,
    mascot: ELEMENT_MASCOT[element] ?? 'sprite',
    color: def.color,
    tint: def.tint,
    shade: def.shade,
  };
}
