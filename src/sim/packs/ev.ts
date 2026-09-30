import type { BalanceConfig } from '@/content/balance';
import type { Finish, Rarity } from '@/content/schema/common';
import type { CardDef, PackConfigDef } from '@/content/schema/tcg';
import { cardMarketValue } from '../cards';
import { packRules } from './generate';
import { buildCardPool, type CardPool } from './pool';
import { defaultFinish, isFoil } from './rarity';

type EvBalance = Pick<BalanceConfig, 'cards' | 'packs'>;

/**
 * Expected value factor of the misprint premium for a card in `finish`:
 * 1 + chance × (E[multiplier] − 1), with Missing Foil re-rolled on non-foil cards (docs/02 §7.2,
 * §11.1).
 */
function misprintFactor(finish: Finish, balance: EvBalance): number {
  const { chancePerCard, table } = balance.packs.misprint;
  let weight = 0;
  let weighted = 0;
  for (const entry of table) {
    if (entry.weight <= 0 || (entry.kind === 'missingFoil' && !isFoil(finish))) continue;
    weight += entry.weight;
    weighted += entry.weight * balance.cards.misprintMultiplier[entry.kind];
  }
  if (weight <= 0) return 1;
  return 1 + chancePerCard * (weighted / weight - 1);
}

/** Mean market value of the card a table entry draws, following the generator's rules. */
function entryValue(
  pool: CardPool,
  rarity: Rarity,
  finish: Finish | undefined,
  balance: EvBalance,
) {
  const resolved = pool.resolve(rarity);
  if (resolved === null) return 0;
  const cards = pool.cardsOf(resolved, finish);
  if (cards.length === 0) return 0;
  let total = 0;
  for (const card of cards) {
    const print = finish ?? defaultFinish(card);
    total += cardMarketValue(card, print, balance) * misprintFactor(print, balance);
  }
  return total / cards.length;
}

function tableValue(
  pool: CardPool,
  table: readonly { rarity: Rarity; finish?: Finish | undefined; weight: number }[],
  balance: EvBalance,
): number {
  let weight = 0;
  let value = 0;
  for (const entry of table) {
    if (entry.weight <= 0) continue;
    weight += entry.weight;
    value += entry.weight * entryValue(pool, entry.rarity, entry.finish, balance);
  }
  return weight > 0 ? value / weight : 0;
}

/**
 * Market EV of one loose pack in cents (fractional), from the pull tables and the cards' Near Mint
 * market values (docs/02 §11.3). It follows the generator exactly: rarity fallback, finish rules,
 * god packs and misprint premiums. Box mapping and onboarding luck are not part of a loose pack.
 * `cards` are the set's cards; ineligible ones (promos, basic Essences) are ignored.
 *
 * Target at release: 0.85–1.10 × MSRP. The docs' hand check (≈ 1.02 × MSRP) leaves out god packs,
 * which add about 0.03 × MSRP at 1 in 2,000.
 */
export function packExpectedValue(
  config: PackConfigDef,
  cards: readonly CardDef[],
  balance: EvBalance,
): number {
  const pool = buildCardPool(cards);
  if (pool.size === 0) return 0;

  let normal = 0;
  for (const slot of config.slots) normal += slot.count * tableValue(pool, slot.table, balance);

  const { godPack } = packRules(balance);
  if (godPack.table.length === 0 || godPack.chance <= 0) return normal;
  const god = config.cardsPerPack * tableValue(pool, godPack.table, balance);
  return (1 - godPack.chance) * normal + godPack.chance * god;
}
