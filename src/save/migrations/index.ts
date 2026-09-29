import { SAVE_VERSION } from '@/sim/state/types';

/**
 * Save migrations (docs/06 §11). Each entry upgrades a raw state object from version `n` to
 * `n + 1`. Rules:
 * - Every GameState shape change bumps SAVE_VERSION and adds one migration file here
 *   (`NNN-description.ts`) plus a fixture in tests/fixtures/saves/.
 * - Migrations operate on plain JSON (`unknown`), never on current types, because old saves
 *   don't match them.
 */
export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/** v1 is the first shipped format, so there's nothing to migrate yet. */
export const migrations: Readonly<Record<number, Migration>> = {};

export class SaveVersionError extends Error {
  override name = 'SaveVersionError';
}

export function migrateState(
  state: Record<string, unknown>,
  fromVersion: number,
  toVersion: number = SAVE_VERSION,
  registry: Readonly<Record<number, Migration>> = migrations,
): Record<string, unknown> {
  if (fromVersion > toVersion) {
    throw new SaveVersionError(
      `This save was made with a newer version of the game (v${fromVersion} > v${toVersion}).`,
    );
  }
  let current = state;
  for (let version = fromVersion; version < toVersion; version++) {
    const migration = registry[version];
    if (!migration)
      throw new SaveVersionError(`Missing save migration ${version} → ${version + 1}`);
    current = migration(current);
    const meta = current.meta as Record<string, unknown> | undefined;
    if (meta) meta.saveVersion = version + 1;
  }
  return current;
}
