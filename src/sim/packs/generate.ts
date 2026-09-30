import type { BalanceConfig } from '@/content/balance';
import type { Finish, Rarity } from '@/content/schema/common';
import type { CardDef, PackConfigDef } from '@/content/schema/tcg';
import type { Rng, WeightedItem } from '@/core/rng';
import type { MisprintKind } from './misprints';
import type { CardPool } from './pool';
import { defaultFinish, isAtLeast, isFoil, isHit, rarityRank } from './rarity';

/**
 * The pack generator (docs/02 §11): pure functions over a pack config, a card pool and a seeded
 * `Rng`. The sim decides every card here; the pack-opening stage only reveals them.
 */

/** One card as drawn: a `PulledCard` plus the card's own rarity (after any fallback). */
export interface DrawnCard {
  cardId: string;
  finish: Finish;
  rarity: Rarity;
  misprint?: MisprintKind;
}

export interface GeneratedPack {
  /** In slot order, so the rare slot comes last in modern configs; god packs sort best-last. */
  cards: DrawnCard[];
  godPack: boolean;
  /** Indices of the rare slot's cards in `cards` (none in a god pack). */
  rareSlot: readonly number[];
}

export interface RarityWeight {
  rarity: Rarity;
  weight: number;
}

/**
 * Rules on top of the per-set pack configs, from `balance.packs` (CLAUDE.md rule 3). The balance
 * is authoritative for god packs and misprints; a config's own `godPack` and
 * `misprintChancePerCard` fields are not read (Emberdawn's mirror the balance).
 */
export interface PackRules {
  godPack: { readonly chance: number; readonly table: readonly RarityWeight[] };
  misprint: {
    readonly chancePerCard: number;
    readonly table: readonly { kind: MisprintKind; weight: number }[];
  };
}

/** Booster box guarantees (docs/02 §11.1). */
export interface BoxMapping {
  minHoloRare: number;
  minUltraPlus: number;
}

export function packRules(balance: Pick<BalanceConfig, 'packs'>): PackRules {
  return { godPack: balance.packs.godPack, misprint: balance.packs.misprint };
}

export interface PackSource {
  config: PackConfigDef;
  pool: CardPool;
}

export interface PackRunOptions {
  /** Booster box guarantees across the whole run; omit for loose packs. */
  boxMapping?: BoxMapping | null;
  /**
   * Hidden onboarding luck (docs/02 §11.1): this card takes the first pack's rare slot, and that
   * pack is never a god pack. Skipped when the card isn't in the first pack's pool.
   */
  firstPackCardId?: string | null;
  /** Hidden onboarding luck: the run holds at least one card at this rarity or better. */
  minRarity?: Rarity | null;
}

// ---------------------------------------------------------------------------------------------
// Config compilation (cached per config object; content is immutable)
// ---------------------------------------------------------------------------------------------

interface SlotEntry {
  rarity: Rarity;
  finish?: Finish;
}

interface CompiledConfig {
  slots: { count: number; table: WeightedItem<SlotEntry>[] }[];
  /** Card index where the rare slot starts, and its card count (0 = no rare slot). */
  rareStart: number;
  rareCount: number;
  rareTable: readonly WeightedItem<SlotEntry>[];
}

const compiledConfigs = new WeakMap<PackConfigDef, CompiledConfig>();

function slotEntry(entry: { rarity: Rarity; finish?: Finish | undefined }): SlotEntry {
  return entry.finish ? { rarity: entry.rarity, finish: entry.finish } : { rarity: entry.rarity };
}

/**
 * The rare slot: the slot whose table reaches the highest rarity (the last one on ties), as long
 * as that is Rare or better. Box mapping and onboarding luck adjust this slot only.
 */
export function rareSlotIndex(config: Pick<PackConfigDef, 'slots'>): number {
  let best = -1;
  let bestRank = rarityRank('rare');
  config.slots.forEach((slot, index) => {
    for (const entry of slot.table) {
      const rank = rarityRank(entry.rarity);
      if (rank >= bestRank) {
        bestRank = rank;
        best = index;
      }
    }
  });
  return best;
}

function compile(config: PackConfigDef): CompiledConfig {
  const cached = compiledConfigs.get(config);
  if (cached) return cached;
  const slots = config.slots.map((slot) => ({
    count: slot.count,
    table: slot.table.map((entry) => ({ value: slotEntry(entry), weight: entry.weight })),
  }));
  const rare = rareSlotIndex(config);
  let rareStart = 0;
  for (let i = 0; i < rare; i++) rareStart += slots[i]?.count ?? 0;
  const rareSlot = rare >= 0 ? slots[rare] : undefined;
  const compiled: CompiledConfig = {
    slots,
    rareStart,
    rareCount: rareSlot?.count ?? 0,
    rareTable: rareSlot?.table ?? [],
  };
  compiledConfigs.set(config, compiled);
  return compiled;
}

// ---------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------

function printOf(card: CardDef, finish?: Finish): DrawnCard {
  return { cardId: card.id, rarity: card.rarity, finish: finish ?? defaultFinish(card) };
}

/**
 * A uniformly random card of `rarity` (or its fallback, see `CardPool.resolve`). An explicit
 * table finish wins; otherwise the card's default finish applies.
 */
function drawCard(pool: CardPool, rng: Rng, rarity: Rarity, finish: Finish | undefined): DrawnCard {
  const resolved = pool.resolve(rarity);
  if (resolved === null) throw new RangeError('drawCard: the card pool is empty');
  return printOf(rng.pick(pool.cardsOf(resolved, finish)), finish);
}

/**
 * Draws one pack's cards without misprints (docs/02 §11.1): each slot draws `count` cards, picking
 * a rarity (and optional finish) from its weighted table, then a uniformly random card of that
 * rarity. A god pack instead draws all `cardsPerPack` cards from the god-pack table.
 */
export function drawPack(
  config: PackConfigDef,
  pool: CardPool,
  rng: Rng,
  rules: PackRules,
  options: { godPacks?: boolean } = {},
): GeneratedPack {
  const compiled = compile(config);
  const { godPack } = rules;
  if ((options.godPacks ?? true) && godPack.table.length > 0 && rng.chance(godPack.chance)) {
    const table = godPack.table.map((entry) => ({ value: entry.rarity, weight: entry.weight }));
    const cards: DrawnCard[] = [];
    for (let i = 0; i < config.cardsPerPack; i++) {
      cards.push(drawCard(pool, rng, rng.weighted(table), undefined));
    }
    // Best last, like the rare slot of a normal pack (docs/01 §14.1). The sort is stable.
    cards.sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity));
    return { cards, godPack: true, rareSlot: [] };
  }

  const cards: DrawnCard[] = [];
  for (const slot of compiled.slots) {
    for (let i = 0; i < slot.count; i++) {
      const entry = rng.weighted(slot.table);
      cards.push(drawCard(pool, rng, entry.rarity, entry.finish));
    }
  }
  const rareSlot: number[] = [];
  for (let i = 0; i < compiled.rareCount; i++) rareSlot.push(compiled.rareStart + i);
  return { cards, godPack: false, rareSlot };
}

interface MisprintTables {
  foil: WeightedItem<MisprintKind>[];
  plain: WeightedItem<MisprintKind>[];
}

const misprintTableCache = new WeakMap<PackRules['misprint'], MisprintTables>();

function misprintTables(misprint: PackRules['misprint']): MisprintTables {
  let tables = misprintTableCache.get(misprint);
  if (!tables) {
    const foil = misprint.table
      .filter((entry) => entry.weight > 0)
      .map((entry) => ({ value: entry.kind, weight: entry.weight }));
    // Missing Foil needs foil layers: a non-foil card re-rolls the type, which is the same as
    // drawing from the rest of the table.
    const plain = foil.filter((entry) => entry.value !== 'missingFoil');
    tables = { foil, plain };
    misprintTableCache.set(misprint, tables);
  }
  return tables;
}

/**
 * Rolls factory misprints card by card (docs/02 §11.1: 1 in 5,000 cards, typed by the misprint
 * table). Returns how many cards were misprinted.
 */
export function applyMisprints(cards: DrawnCard[], rng: Rng, rules: PackRules): number {
  const tables = misprintTables(rules.misprint);
  let count = 0;
  for (const card of cards) {
    if (!rng.chance(rules.misprint.chancePerCard)) continue;
    const table = isFoil(card.finish) ? tables.foil : tables.plain;
    if (table.length === 0) continue;
    card.misprint = rng.weighted(table);
    count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------------------------
// Runs: boxes, blisters and onboarding luck
// ---------------------------------------------------------------------------------------------

interface Position {
  pack: number;
  index: number;
}

const positionKey = (pack: number, index: number) => `${pack}:${index}`;

/** Guaranteed hits stop below Mythic Rare: a Mythic is never forced (docs/02 §11.1). */
const forceable = (rarity: Rarity) => rarity !== 'mythicRare';

/** Rare-slot positions from the last pack backwards, skipping god packs and locked cards. */
function rarePositions(packs: readonly GeneratedPack[], locked: ReadonlySet<string>): Position[] {
  const positions: Position[] = [];
  for (let p = packs.length - 1; p >= 0; p--) {
    const pack = packs[p];
    if (!pack || pack.godPack) continue;
    for (let i = pack.rareSlot.length - 1; i >= 0; i--) {
      const index = pack.rareSlot[i];
      if (index !== undefined && !locked.has(positionKey(p, index))) {
        positions.push({ pack: p, index });
      }
    }
  }
  return positions;
}

/**
 * Upgrade targets for one pack: its rare slot's table entries whose rarity passes `accept` and
 * that the pool really has (upgrades never fall back to another rarity).
 */
function upgradeTable(
  source: PackSource | undefined,
  accept: (rarity: Rarity) => boolean,
): WeightedItem<SlotEntry>[] {
  if (!source) return [];
  return compile(source.config).rareTable.filter(
    (entry) => accept(entry.value.rarity) && source.pool.hasRarity(entry.value.rarity),
  );
}

/** The packs of one run with their sources; `locked` cards are never adjusted. */
interface Run {
  packs: GeneratedPack[];
  sources: readonly PackSource[];
  rng: Rng;
  locked: Set<string>;
}

function cardAt(run: Run, position: Position): DrawnCard | undefined {
  return run.packs[position.pack]?.cards[position.index];
}

/** Replaces the card at `position` with an upgrade target; false when there is none. */
function upgrade(run: Run, position: Position, accept: (rarity: Rarity) => boolean): boolean {
  const pack = run.packs[position.pack];
  const source = run.sources[position.pack];
  const table = upgradeTable(source, accept);
  if (!pack || !source || table.length === 0) return false;
  const entry = run.rng.weighted(table);
  const card = run.rng.pick(source.pool.cardsOf(entry.rarity, entry.finish));
  pack.cards[position.index] = printOf(card, entry.finish);
  return true;
}

function countCards(run: Run, predicate: (rarity: Rarity) => boolean): number {
  let total = 0;
  for (const pack of run.packs) for (const card of pack.cards) if (predicate(card.rarity)) total++;
  return total;
}

/**
 * Onboarding luck for the first box (docs/02 §11.1): if the run has no card at `min` or better,
 * one random rare slot below Holo Rare is upgraded (never to a Mythic unless `min` is Mythic).
 */
function ensureMinRarity(run: Run, min: Rarity): void {
  if (countCards(run, (rarity) => isAtLeast(rarity, min)) > 0) return;
  const accept = (rarity: Rarity) =>
    isAtLeast(rarity, min) && (forceable(rarity) || min === 'mythicRare');
  const eligible = (replaceable: (rarity: Rarity) => boolean) =>
    rarePositions(run.packs, run.locked).filter((position) => {
      const card = cardAt(run, position);
      return (
        card !== undefined &&
        replaceable(card.rarity) &&
        upgradeTable(run.sources[position.pack], accept).length > 0
      );
    });
  let positions = eligible((rarity) => !isHit(rarity));
  if (positions.length === 0) positions = eligible((rarity) => !isAtLeast(rarity, min));
  if (positions.length === 0) return;
  upgrade(run, run.rng.pick(positions), accept);
}

/**
 * Box mapping (docs/02 §11.1): at least `minHoloRare` Holo Rares and `minUltraPlus` Ultra Rares or
 * better across the box. Rare slots below Holo Rare are upgraded starting from the last pack;
 * a Mythic is never forced, and existing hits are never downgraded.
 */
function applyBoxMapping(run: Run, mapping: BoxMapping): void {
  let holos = countCards(run, (rarity) => rarity === 'holoRare');
  let ultras = countCards(run, (rarity) => isAtLeast(rarity, 'ultraRare'));
  const positions = rarePositions(run.packs, run.locked);
  const belowHolo = (position: Position) => {
    const card = cardAt(run, position);
    return card !== undefined && !isHit(card.rarity);
  };
  const ultraPlus = (rarity: Rarity) => isAtLeast(rarity, 'ultraRare') && forceable(rarity);

  for (const position of positions) {
    if (ultras >= mapping.minUltraPlus) break;
    if (belowHolo(position) && upgrade(run, position, ultraPlus)) ultras++;
  }
  // Only a run too small to hold both guarantees gets here: trade surplus Holo Rares.
  for (const position of positions) {
    if (ultras >= mapping.minUltraPlus || holos <= mapping.minHoloRare) break;
    if (cardAt(run, position)?.rarity === 'holoRare' && upgrade(run, position, ultraPlus)) {
      ultras++;
      holos--;
    }
  }
  for (const position of positions) {
    if (holos >= mapping.minHoloRare) break;
    if (belowHolo(position) && upgrade(run, position, (rarity) => rarity === 'holoRare')) holos++;
  }
}

/**
 * Generates a run of packs opened together (one booster, a blister's packs or a whole booster
 * box): draws every pack, applies onboarding luck and box mapping, then rolls misprints on the
 * final cards.
 */
export function generatePackRun(
  sources: readonly PackSource[],
  rng: Rng,
  rules: PackRules,
  options: PackRunOptions = {},
): GeneratedPack[] {
  const packs: GeneratedPack[] = [];
  const firstPackCard =
    options.firstPackCardId && sources[0]
      ? sources[0].pool.get(options.firstPackCardId)
      : undefined;
  const run: Run = { packs, sources, rng, locked: new Set() };

  sources.forEach((source, p) => {
    const forced = p === 0 ? firstPackCard : undefined;
    const pack = drawPack(source.config, source.pool, rng, rules, { godPacks: !forced });
    const index = pack.rareSlot[pack.rareSlot.length - 1];
    if (forced && index !== undefined) {
      pack.cards[index] = printOf(forced);
      run.locked.add(positionKey(p, index));
    }
    packs.push(pack);
  });

  if (options.minRarity) ensureMinRarity(run, options.minRarity);
  if (options.boxMapping) applyBoxMapping(run, options.boxMapping);
  for (const pack of packs) applyMisprints(pack.cards, rng, rules);
  return packs;
}

/** One complete loose pack (misprints included). */
export function generatePack(
  config: PackConfigDef,
  pool: CardPool,
  rng: Rng,
  rules: PackRules,
): GeneratedPack {
  const [pack] = generatePackRun([{ config, pool }], rng, rules);
  if (!pack) throw new RangeError('generatePack: no pack generated');
  return pack;
}
