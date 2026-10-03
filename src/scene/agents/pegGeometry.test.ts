import { BoxGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import {
  pegGeometry,
  pegGeometryCount,
  releasePegGeometry,
  retainPegGeometry,
} from './pegGeometry';

const box = () => [{ geometry: new BoxGeometry(0.1, 0.1, 0.1), color: '#ffffff' }];

describe('Peg-folk look meshes', () => {
  it('bakes one shared mesh per key', () => {
    const a = pegGeometry('test:a', box);
    expect(pegGeometry('test:a', box)).toBe(a);
    expect(pegGeometry('test:b', box)).not.toBe(a);
  });

  it('keeps worn looks and evicts the oldest unused ones beyond the cap', () => {
    const worn = pegGeometry('test:worn', box);
    retainPegGeometry(['test:worn']);
    // A long day of customers, each with a new look, each leaving again.
    for (let i = 0; i < 120; i++) {
      const key = `test:customer-${i}`;
      pegGeometry(key, box);
      retainPegGeometry([key]);
      releasePegGeometry([key]);
    }
    // Bounded: the cap of unused looks plus the ones still worn.
    expect(pegGeometryCount()).toBeLessThanOrEqual(48 + 1);
    expect(pegGeometry('test:worn', box)).toBe(worn);
    // The most recent unused looks are still cached for reuse.
    const recent = pegGeometry('test:customer-119', box);
    expect(pegGeometry('test:customer-119', box)).toBe(recent);
    releasePegGeometry(['test:worn']);
  });
});
