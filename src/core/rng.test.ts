import { describe, expect, it } from 'vitest';
import { mean } from './math';
import { createRng, hashString, nextUint32, type RngState, seedStream } from './rng';

describe('rng', () => {
  it('is deterministic per seed and stream', () => {
    const a = createRng(seedStream(42, 'market'));
    const b = createRng(seedStream(42, 'market'));
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('keeps streams independent', () => {
    const market = createRng(seedStream(42, 'market'));
    const packs = createRng(seedStream(42, 'packs'));
    expect(market.next()).not.toEqual(packs.next());
  });

  it('continues the same sequence after a JSON round-trip of its state', () => {
    const state = seedStream(7, 'customers');
    const rng = createRng(state);
    for (let i = 0; i < 5; i++) rng.next();
    const restored = JSON.parse(JSON.stringify(state)) as RngState;
    expect(nextUint32(restored)).toEqual(nextUint32(state));
  });

  it('produces floats in [0, 1) with a sane mean', () => {
    const rng = createRng(seedStream(1, 'test'));
    const values = Array.from({ length: 20_000 }, () => rng.next());
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(mean(values)).toBeCloseTo(0.5, 1);
  });

  it('int() is inclusive and covers the whole range', () => {
    const rng = createRng(seedStream(3, 'test'));
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) seen.add(rng.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('gauss() matches mean and standard deviation', () => {
    const rng = createRng(seedStream(5, 'test'));
    const values = Array.from({ length: 40_000 }, () => rng.gauss(9, 0.7));
    const m = mean(values);
    const sd = Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
    expect(m).toBeCloseTo(9, 1);
    expect(sd).toBeCloseTo(0.7, 1);
  });

  it('gamma() has mean k·θ (shape/scale parametrization, docs/02 §8.1)', () => {
    const rng = createRng(seedStream(9, 'test'));
    for (const [k, theta] of [
      [1, 0.45],
      [1.6, 0.7],
      [0.5, 2],
    ] as const) {
      const values = Array.from({ length: 40_000 }, () => rng.gamma(k, theta));
      expect(mean(values)).toBeCloseTo(k * theta, 1);
    }
  });

  it('weighted() respects weights', () => {
    const rng = createRng(seedStream(11, 'test'));
    const counts = { a: 0, b: 0, c: 0 };
    const items = [
      { value: 'a' as const, weight: 1 },
      { value: 'b' as const, weight: 3 },
      { value: 'c' as const, weight: 0 },
    ];
    for (let i = 0; i < 20_000; i++) counts[rng.weighted(items)]++;
    expect(counts.c).toBe(0);
    expect(counts.b / counts.a).toBeGreaterThan(2.7);
    expect(counts.b / counts.a).toBeLessThan(3.3);
  });

  it('shuffle() returns a permutation without mutating the input', () => {
    const rng = createRng(seedStream(13, 'test'));
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const output = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...output].sort()).toEqual(input);
  });

  it('rejects invalid arguments', () => {
    const rng = createRng(seedStream(1, 'test'));
    expect(() => rng.pick([])).toThrow();
    expect(() => rng.int(5, 1)).toThrow();
    expect(() => rng.weighted([{ value: 1, weight: 0 }])).toThrow();
    expect(() => rng.gamma(0, 1)).toThrow();
  });

  it('hashString is stable', () => {
    expect(hashString('market')).toBe(hashString('market'));
    expect(hashString('market')).not.toBe(hashString('packs'));
  });
});
