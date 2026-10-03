import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng, seedStream } from '@/core/rng';
import { DEFAULT_OWNER } from '@/sim/state/createNewGame';
import { palette } from '@/ui/palette';
import {
  AVATAR_OPTION_COUNTS,
  avatarLook,
  cycleAvatar,
  DEFAULT_AVATAR,
  normalizeAvatar,
  randomAvatar,
} from './avatar';

const inRange = (spec: ReturnType<typeof normalizeAvatar>) =>
  (Object.keys(AVATAR_OPTION_COUNTS) as (keyof typeof AVATAR_OPTION_COUNTS)[]).every(
    (part) =>
      Number.isInteger(spec[part]) && spec[part] >= 0 && spec[part] < AVATAR_OPTION_COUNTS[part],
  );

describe('owner avatar', () => {
  it('mirrors the sim default owner', () => {
    expect(DEFAULT_AVATAR).toEqual(DEFAULT_OWNER);
  });

  it('maps the default owner to the diorama shopkeeper: a teal apron and a bun', () => {
    const look = avatarLook(DEFAULT_OWNER);
    expect(look.top).toEqual({ style: 'apron', color: palette.paper, accent: palette.teal });
    expect(look.hair.style).toBe('bun');
  });

  it('puts the picked color on the garment for aprons and vests, on the shirt otherwise', () => {
    const vest = avatarLook({ ...DEFAULT_OWNER, top: 2, topColor: 0 });
    expect(vest.top).toEqual({ style: 'vest', color: palette.paper, accent: palette.coral });
    const hoodie = avatarLook({ ...DEFAULT_OWNER, top: 1, topColor: 3 });
    expect(hoodie.top).toEqual({ style: 'hoodie', color: palette.sky, accent: palette.paper });
  });

  it('wraps out-of-range and junk indices from old or edited saves', () => {
    expect(
      normalizeAvatar({ skin: -1, hairStyle: 6, hairColor: 2.7, top: Number.NaN, topColor: 99 }),
    ).toEqual({ skin: 5, hairStyle: 0, hairColor: 2, top: 0, topColor: 3 });
    expect(cycleAvatar(DEFAULT_OWNER, 'top', 1).top).toBe(0);
    expect(cycleAvatar(DEFAULT_OWNER, 'skin', -3).skin).toBe(5);
  });

  it('random looks always stay in range', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 }), (seed) => {
        const rng = createRng(seedStream(seed, 'avatar'));
        return inRange(randomAvatar(() => rng.next()));
      }),
    );
    expect(inRange(randomAvatar(() => 0.999_999))).toBe(true);
  });
});
