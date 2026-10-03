/**
 * Writes `tests/fixtures/saves/v<SAVE_VERSION>-day-two.json`: a deterministic Day-2 prep save from
 * a real Day 1 (served customers, an order delivered at dawn, a ripped pack, a binder pocket), so
 * migrations are tested against a lived-in save (CLAUDE.md rule 5).
 *
 *   npx tsx --tsconfig tsconfig.node.json scripts/dev/make-save-fixture.ts
 *
 * Run it ONLY when adding a new save version: old fixtures stay frozen so the migration tests keep
 * proving that old saves load (`v1-new-game.json` came from the Phase 1 version of this script).
 */
import { writeFileSync } from 'node:fs';
import { setAutoFreeze } from 'immer';
import { defaultBalance } from '../../src/content/balance';
import { getRegistry } from '../../src/content/registry';
import { toSaveFile } from '../../src/save/saveFile';
import type { Command } from '../../src/sim/commands';
import { type PureContext, runCommand, runTicks } from '../../src/sim/engine';
import { createNewGame } from '../../src/sim/state/createNewGame';
import { type GameState, SAVE_VERSION } from '../../src/sim/state/types';
import { customerAtPaySpot } from '../../src/sim/systems/customers';

setAutoFreeze(false);
const ctx: PureContext = { content: getRegistry(), balance: defaultBalance };

let state: GameState = createNewGame(
  {
    seed: 20261003,
    shopName: 'Fixture Cards',
    difficulty: 'standard',
    createdAt: '2026-10-03T09:00:00.000Z',
    gameVersion: '0.2.0',
  },
  ctx,
);

function run(command: Command): void {
  const result = runCommand(state, command, ctx);
  if (!result.result.ok) throw new Error(`${command.type} failed: ${result.result.code}`);
  state = result.state;
}

// Day 1: open, serve whoever reaches the pay spot, close at 19:00.
run({ type: 'time/openShop' });
while (state.clock.phase === 'open') {
  state = runTicks(state, 1, ctx).state;
  if (state.clock.phase === 'open' && customerAtPaySpot(state) !== null) {
    run({ type: 'customers/checkout' });
  }
}

// Night: reorder, rip a booster, keep the first holo-or-better pull in the binder.
run({
  type: 'suppliers/placeOrder',
  supplierId: 'sup.budget-box',
  lines: [{ productId: 'gk.emberdawn.booster', qty: 12 }],
});
run({ type: 'open/openProduct', productId: 'gk.emberdawn.booster' });
const keeper = Object.keys(state.inventory.cardStacks).find((key) => key.includes('|holo|'));
const binderKey = keeper ?? Object.keys(state.inventory.cardStacks)[0];
if (binderKey) run({ type: 'collection/addToBinder', cardKey: binderKey });

// Dawn of Day 2: the order arrives; this is where the game autosaves.
run({ type: 'time/startNextDay' });

const file = toSaveFile(state, 'auto-1', '2026-10-03T09:30:00.000Z');
const out = new URL(`../../tests/fixtures/saves/v${SAVE_VERSION}-day-two.json`, import.meta.url);
writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
console.log(
  `wrote ${out.pathname}: day ${state.clock.day}, level ${state.progression.level}, ` +
    `cash ${state.finance.cashCents}¢, ${state.stats.salesCount ?? 0} sales`,
);
