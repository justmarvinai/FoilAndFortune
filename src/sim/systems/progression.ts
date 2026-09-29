import { xpToNextLevel } from '@/content/balance/progression';
import type { SimContext } from '../context';
import type { XpSource } from '../events';
import type { GameState } from '../state/types';

/** Grants XP and processes level-ups (docs/02 §9). */
export function addXp(state: GameState, ctx: SimContext, amount: number, source: XpSource): void {
  if (amount <= 0) return;
  const gained = Math.round(amount);
  const { levelCap } = ctx.balance.progression;
  state.progression.xp += gained;
  ctx.emit({ type: 'xp/gained', amount: gained, source });

  while (state.progression.level < levelCap) {
    const needed = xpToNextLevel(state.progression.level);
    if (state.progression.xp < needed) break;
    state.progression.xp -= needed;
    state.progression.level += 1;
    ctx.emit({ type: 'level/up', level: state.progression.level });
  }
  if (state.progression.level >= levelCap) state.progression.xp = 0;
}
