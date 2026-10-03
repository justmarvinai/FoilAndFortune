import {
  HAIR_COLORS,
  type HairStyle,
  OWNER_LOOK,
  type PegLook,
  SKIN_TONES,
  type TopStyle,
} from '@/scene/agents/looks';
import type { AvatarSpec } from '@/sim/state/types';
import { palette } from '@/ui/palette';

/**
 * The owner avatar (docs/04 §4.4 "The owner avatar is customizable at New Game"): `AvatarSpec`
 * stores indices into these tables, and `avatarLook` turns them into a Peg-folk look. The 2D
 * portrait (New Game, HUD, title window) and the 3D owner behind the counter both read this
 * mapping, so the shopkeeper looks the same everywhere.
 *
 * Index order matters for saves: append new options, never reorder (CLAUDE.md rule 5). The
 * orders are chosen so `DEFAULT_OWNER` matches the diorama's default shopkeeper (a teal apron and
 * a bun).
 */
export const AVATAR_SKINS: readonly string[] = SKIN_TONES;
export const AVATAR_HAIR_STYLES: readonly HairStyle[] = [
  'bob',
  'bun',
  'spiky',
  'ponytail',
  'curls',
  'buzz',
];
export const AVATAR_HAIR_COLORS: readonly string[] = HAIR_COLORS;
export const AVATAR_TOPS: readonly TopStyle[] = ['tee', 'hoodie', 'vest', 'apron'];
export const AVATAR_TOP_COLORS: readonly string[] = [
  palette.coral,
  palette.sun,
  palette.teal,
  palette.sky,
  palette.grape,
  palette.mint,
  palette.wood,
  palette.ink,
];

export type AvatarPart = keyof AvatarSpec;

/**
 * The sim's `DEFAULT_OWNER`, repeated here so the title route doesn't bundle the sim; a unit
 * test keeps the two equal.
 */
export const DEFAULT_AVATAR: AvatarSpec = {
  skin: 2,
  hairStyle: 1,
  hairColor: 0,
  top: 3,
  topColor: 2,
};

export const AVATAR_OPTION_COUNTS: Readonly<Record<AvatarPart, number>> = {
  skin: AVATAR_SKINS.length,
  hairStyle: AVATAR_HAIR_STYLES.length,
  hairColor: AVATAR_HAIR_COLORS.length,
  top: AVATAR_TOPS.length,
  topColor: AVATAR_TOP_COLORS.length,
};

const PARTS: readonly AvatarPart[] = ['skin', 'hairStyle', 'hairColor', 'top', 'topColor'];

function wrap(index: number, count: number): number {
  if (!Number.isFinite(index) || count <= 0) return 0;
  const whole = Math.trunc(index);
  return ((whole % count) + count) % count;
}

/** Brings any stored spec (old saves, hand-edited imports) back into range. */
export function normalizeAvatar(spec: AvatarSpec): AvatarSpec {
  const out = { ...spec };
  for (const part of PARTS) out[part] = wrap(spec[part], AVATAR_OPTION_COUNTS[part]);
  return out;
}

/** Steps one part forward or back, wrapping around. */
export function cycleAvatar(spec: AvatarSpec, part: AvatarPart, step: number): AvatarSpec {
  return normalizeAvatar({ ...spec, [part]: spec[part] + step });
}

/** A random look from `random()` in [0, 1) (UI randomness; the sim never calls this). */
export function randomAvatar(random: () => number): AvatarSpec {
  const pick = (part: AvatarPart) => Math.floor(random() * AVATAR_OPTION_COUNTS[part]);
  return normalizeAvatar({
    skin: pick('skin'),
    hairStyle: pick('hairStyle'),
    hairColor: pick('hairColor'),
    top: pick('top'),
    topColor: pick('topColor'),
  });
}

/** Aprons and vests are worn over a cream shirt: the picked color goes on the garment. */
function topColors(style: TopStyle, picked: string): { color: string; accent: string } {
  if (style === 'apron' || style === 'vest') return { color: palette.paper, accent: picked };
  return { color: picked, accent: palette.paper };
}

export function avatarLook(spec: AvatarSpec): PegLook {
  const safe = normalizeAvatar(spec);
  const style = AVATAR_TOPS[safe.top] ?? 'apron';
  return {
    scale: 1,
    skin: AVATAR_SKINS[safe.skin] ?? OWNER_LOOK.skin,
    hair: {
      style: AVATAR_HAIR_STYLES[safe.hairStyle] ?? 'bun',
      color: AVATAR_HAIR_COLORS[safe.hairColor] ?? OWNER_LOOK.hair.color,
    },
    top: { style, ...topColors(style, AVATAR_TOP_COLORS[safe.topColor] ?? palette.teal) },
    bottom: OWNER_LOOK.bottom,
    shoes: OWNER_LOOK.shoes,
    accessories: {},
  };
}
