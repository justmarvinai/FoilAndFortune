import { describe, expect, it } from 'vitest';
import { customerLook, isKid } from './liveLooks';

describe('customer looks', () => {
  it('is deterministic per look seed', () => {
    expect(customerLook(123, 'arch.kid')).toEqual(customerLook(123, 'arch.kid'));
    const looks = new Set(
      Array.from({ length: 40 }, (_, i) => JSON.stringify(customerLook(i * 7919, 'arch.casual'))),
    );
    expect(looks.size).toBeGreaterThan(30);
  });

  it('makes kids smaller than adults', () => {
    for (let seed = 1; seed < 200; seed += 13) {
      const kid = customerLook(seed, 'arch.kid');
      const adult = customerLook(seed, 'arch.casual');
      expect(kid.scale).toBeLessThan(0.86);
      expect(adult.scale).toBeGreaterThan(0.94);
    }
    expect(isKid('arch.kid')).toBe(true);
    expect(isKid('arch.casual')).toBe(false);
  });

  it('gives kids their archetype cues often', () => {
    let caps = 0;
    let packs = 0;
    for (let seed = 0; seed < 400; seed++) {
      const look = customerLook(seed * 2654435761, 'arch.kid');
      if (look.accessories.cap) caps++;
      if (look.accessories.backpack) packs++;
      expect(look.accessories.tote).toBeUndefined();
    }
    // 45 % caps and 55 % backpacks, with a statistical tolerance.
    expect(caps / 400).toBeGreaterThan(0.35);
    expect(caps / 400).toBeLessThan(0.55);
    expect(packs / 400).toBeGreaterThan(0.45);
    expect(packs / 400).toBeLessThan(0.65);
  });
});
