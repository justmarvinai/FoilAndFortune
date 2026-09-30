/**
 * The pack generator (docs/02 §11) and its helpers. Opening commands live in
 * `src/sim/systems/opening.ts`; this folder is pure: content + seeded `Rng` in, cards out.
 */
export { packExpectedValue } from './ev';
export {
  applyMisprints,
  type BoxMapping,
  type DrawnCard,
  drawPack,
  type GeneratedPack,
  generatePack,
  generatePackRun,
  type PackRules,
  type PackRunOptions,
  type PackSource,
  packRules,
  rareSlotIndex,
} from './generate';
export {
  MISPRINT_KINDS,
  type MisprintKind,
  misprintOf,
  misprintStamp,
  pulledCardKey,
} from './misprints';
export { buildCardPool, type CardPool, isBoosterEligible, setCardPool } from './pool';
export { defaultFinish, isAtLeast, isFoil, isHit, RARITY_LADDER, rarityRank } from './rarity';
