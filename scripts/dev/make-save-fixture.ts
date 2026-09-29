/**
 * Regenerates tests/fixtures/saves/v<SAVE_VERSION>-new-game.json. Run ONLY when adding a new
 * save version: old fixtures must stay frozen so migration tests keep proving that old saves load.
 */
import { writeFileSync } from 'node:fs';
import { toSaveFile } from '../../src/save/saveFile';
import { SAVE_VERSION } from '../../src/sim/state/types';
import { newTestGame } from '../../src/sim/testing';

const file = toSaveFile(newTestGame('standard', 20260929), 'slot-1', '2026-09-29T12:00:00.000Z');
const out = `tests/fixtures/saves/v${SAVE_VERSION}-new-game.json`;
writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
console.log(`wrote ${out}`);
