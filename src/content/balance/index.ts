import { cardBalance } from './cards';
import { customerBalance } from './customers';
import { difficultyBalance } from './difficulty';
import { packBalance } from './packs';
import { progressionBalance } from './progression';
import { reputationBalance } from './reputation';
import { shopTiers, storageBalance } from './shop';
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
  storage: storageBalance,
  customers: customerBalance,
  cards: cardBalance,
  packs: packBalance,
} as const;

export type BalanceConfig = typeof defaultBalance;
