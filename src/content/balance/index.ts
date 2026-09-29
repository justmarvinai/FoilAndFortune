import { difficultyBalance } from './difficulty';
import { progressionBalance } from './progression';
import { reputationBalance } from './reputation';
import { shopTiers } from './shop';
import { timeBalance } from './time';

/**
 * Every tunable number lives under `src/content/balance/` (CLAUDE.md rule 3). Systems receive
 * this object through the SimContext, so tests and the balance simulator can swap values.
 */
export const defaultBalance = {
  time: timeBalance,
  difficulty: difficultyBalance,
  progression: progressionBalance,
  reputation: reputationBalance,
  shopTiers,
} as const;

export type BalanceConfig = typeof defaultBalance;
