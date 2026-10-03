import type { BufferGeometry } from 'three';
import { mergeParts, type Part } from '../lib/merge';

/**
 * Baked Peg-folk part meshes, shared between characters with the same look and released when
 * nobody wears them any more. Unlike fixtures (a fixed set, cached forever), customers bring a
 * new look every few minutes, so unused meshes are kept for reuse only up to a cap, then the
 * least recently used ones are disposed.
 */
interface Entry {
  geometry: BufferGeometry;
  users: number;
  touched: number;
}

const entries = new Map<string, Entry>();
/** Unused looks kept around for the next customer who happens to wear them. */
const MAX_UNUSED = 48;
let clock = 0;

/** The baked mesh for `key`, building it on first use. Doesn't take a reference. */
export function pegGeometry(key: string, build: () => readonly Part[]): BufferGeometry {
  let entry = entries.get(key);
  if (!entry) {
    entry = { geometry: mergeParts(build()), users: 0, touched: 0 };
    entries.set(key, entry);
  }
  entry.touched = ++clock;
  return entry.geometry;
}

export function retainPegGeometry(keys: readonly string[]): void {
  for (const key of keys) {
    const entry = entries.get(key);
    if (entry) {
      entry.users += 1;
      entry.touched = ++clock;
    }
  }
}

export function releasePegGeometry(keys: readonly string[]): void {
  for (const key of keys) {
    const entry = entries.get(key);
    if (entry) entry.users = Math.max(0, entry.users - 1);
  }
  evictUnused();
}

function evictUnused(): void {
  const unused = [...entries].filter(([, entry]) => entry.users === 0);
  if (unused.length <= MAX_UNUSED) return;
  unused.sort((a, b) => a[1].touched - b[1].touched);
  for (const [key, entry] of unused.slice(0, unused.length - MAX_UNUSED)) {
    entry.geometry.dispose();
    entries.delete(key);
  }
}

/** Number of baked look meshes alive (debug readouts, tests). */
export function pegGeometryCount(): number {
  return entries.size;
}
