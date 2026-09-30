import { xpToNextLevel } from '@/content/balance/progression';
import type { ContentRegistry } from '@/content/registry';
import type { SimContext } from '../context';
import type { XpSource } from '../events';
import type { GameState } from '../state/types';

/** Grants XP and processes level-ups and their unlocks (docs/02 §9). */
export function addXp(state: GameState, ctx: SimContext, amount: number, source: XpSource): void {
  if (amount <= 0) return;
  const gained = Math.round(amount);
  if (gained <= 0) return;
  const { levelCap } = ctx.balance.progression;
  state.progression.xp += gained;
  state.dayLog.xpGained += gained;
  ctx.emit({ type: 'xp/gained', amount: gained, source });

  while (state.progression.level < levelCap) {
    const needed = xpToNextLevel(state.progression.level);
    if (state.progression.xp < needed) break;
    state.progression.xp -= needed;
    state.progression.level += 1;
    ctx.emit({ type: 'level/up', level: state.progression.level });
    grantUnlocks(state, ctx);
  }
  if (state.progression.level >= levelCap) state.progression.xp = 0;
}

/**
 * Grants every unlock up to the current level that isn't granted yet. Unbuilt features grant
 * their placeholder perk instead (docs/02 §9.3 "no empty levels").
 */
export function grantUnlocks(state: GameState, ctx: Pick<SimContext, 'content' | 'emit'>): void {
  for (const unlock of ctx.content.unlocks.values()) {
    if (unlock.level > state.progression.level) continue;
    if (state.progression.unlocked[unlock.id] !== undefined) continue;
    state.progression.unlocked[unlock.id] = state.clock.day;
    if (!unlock.built && unlock.perkId) state.progression.perks.push(unlock.perkId);
    ctx.emit(
      unlock.perkId && !unlock.built
        ? { type: 'unlock/granted', unlockId: unlock.id, perkId: unlock.perkId }
        : { type: 'unlock/granted', unlockId: unlock.id },
    );
  }
}

export function hasUnlock(state: GameState, unlockId: string): boolean {
  return state.progression.unlocked[unlockId] !== undefined;
}

/** Extra on-site storage units from perks. */
export function perkStorageUnits(state: GameState, content: ContentRegistry): number {
  let total = 0;
  for (const perkId of state.progression.perks) {
    const effect = content.perks.get(perkId)?.effect;
    if (effect?.type === 'storageUnits') total += effect.amount;
  }
  return total;
}

/** Supplier discount from perks (0–0.5), applied to order unit costs. */
export function perkSupplierDiscount(state: GameState, content: ContentRegistry): number {
  let pct = 0;
  for (const perkId of state.progression.perks) {
    const effect = content.perks.get(perkId)?.effect;
    if (effect?.type === 'supplierDiscount') pct += effect.pct;
  }
  return Math.min(pct, 0.5);
}
