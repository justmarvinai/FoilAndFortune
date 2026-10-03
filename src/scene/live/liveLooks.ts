import {
  HAIR_COLORS,
  type HairStyle,
  type PegLook,
  SKIN_TONES,
  type TopStyle,
} from '../agents/looks';
import { createRng, randPick, randRange } from '../lib/rng';
import { pegColors } from '../scenePalette';

/**
 * Customer looks from the sim's `lookSeed` and archetype (docs/04 §4.4 "archetype cues"): kids
 * are small and bright with caps and backpacks, casual collectors wear hoodies and carry totes.
 * Deterministic: the same customer always looks the same, on every device and after a reload.
 */
export const KID_ARCHETYPE = 'arch.kid';

const HAIR_STYLES: readonly HairStyle[] = ['bob', 'spiky', 'bun', 'ponytail', 'curls', 'buzz'];

export function isKid(archetypeId: string): boolean {
  return archetypeId === KID_ARCHETYPE;
}

function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}

export function customerLook(seed: number, archetypeId: string): PegLook {
  const rng = createRng(seed ^ 0x5bd1e995);
  const kid = isKid(archetypeId);
  const topStyles: readonly TopStyle[] = kid ? ['hoodie', 'tee'] : ['hoodie', 'tee', 'vest'];
  const top = {
    style: randPick(rng, topStyles),
    color: randPick(rng, kid ? pegColors.kidTops : pegColors.adultTops),
    accent: randPick(rng, pegColors.accents),
  };
  const accessories: PegLook['accessories'] = {};
  if (kid) {
    if (chance(rng, 0.45)) accessories.cap = randPick(rng, pegColors.caps);
    if (chance(rng, 0.55)) accessories.backpack = randPick(rng, pegColors.bags);
  } else {
    if (chance(rng, 0.35)) accessories.tote = randPick(rng, pegColors.bags);
    else if (chance(rng, 0.2)) accessories.backpack = randPick(rng, pegColors.bags);
    if (chance(rng, 0.25)) accessories.glasses = randPick(rng, pegColors.frames);
    if (chance(rng, 0.15)) accessories.headphones = randPick(rng, pegColors.headphones);
  }
  return {
    // docs/04 §4.2: adults ≈ 1.1 m, kids ≈ 0.8 m (chibi proportions keep kids a bit taller).
    scale: kid
      ? Math.round(randRange(rng, 0.78, 0.84) * 100) / 100
      : Math.round(randRange(rng, 0.96, 1.04) * 100) / 100,
    skin: randPick(rng, SKIN_TONES),
    hair: { style: randPick(rng, HAIR_STYLES), color: randPick(rng, HAIR_COLORS) },
    top,
    bottom: randPick(rng, pegColors.bottoms),
    shoes: randPick(rng, pegColors.shoes),
    accessories,
  };
}
