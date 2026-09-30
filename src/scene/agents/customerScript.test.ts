import { describe, expect, it } from 'vitest';
import { PLINTH, ROOM } from '../layout';
import { CUSTOMER_SCRIPT } from './customerScript';
import { canBlink, EXPRESSIONS } from './faces';

describe('demo customer script', () => {
  it('starts with a spawn and ends by leaving (despawn + pause) so it loops cleanly', () => {
    expect(CUSTOMER_SCRIPT[0]?.kind).toBe('spawn');
    const kinds = CUSTOMER_SCRIPT.map((s) => s.kind);
    expect(kinds.indexOf('despawn')).toBeGreaterThan(0);
    expect(kinds.at(-1)).toBe('pause');
  });

  it('rings up exactly one sale per visit', () => {
    const sales = CUSTOMER_SCRIPT.filter((s) => s.kind === 'act' && s.signal === 'sale');
    expect(sales).toHaveLength(1);
  });

  it('only walks on the plinth, and inside the room while shopping', () => {
    for (const step of CUSTOMER_SCRIPT) {
      if (step.kind !== 'walk') continue;
      const [x, z] = step.to;
      expect(x).toBeGreaterThanOrEqual(PLINTH.minX);
      expect(x).toBeLessThanOrEqual(PLINTH.maxX);
      expect(z).toBeGreaterThanOrEqual(PLINTH.minZ);
      expect(z).toBeLessThanOrEqual(PLINTH.maxZ);
      if (step.phase === 'bin' || step.phase === 'shelf' || step.phase === 'queue') {
        expect(Math.abs(x)).toBeLessThan(ROOM.halfX);
        expect(Math.abs(z)).toBeLessThan(ROOM.halfZ);
      }
    }
  });

  it('declares the phases the shopkeeper reacts to', () => {
    const phases = new Set(
      CUSTOMER_SCRIPT.flatMap((s) => ('phase' in s && s.phase !== undefined ? [s.phase] : [])),
    );
    for (const phase of ['enter', 'checkout', 'paid', 'leave'])
      expect(phases.has(phase)).toBe(true);
  });

  it('uses only known expressions', () => {
    for (const step of CUSTOMER_SCRIPT) {
      if ((step.kind === 'walk' || step.kind === 'act') && step.expression) {
        expect(EXPRESSIONS).toContain(step.expression);
      }
    }
  });

  it('does not blink on expressions whose eyes are already stylised', () => {
    expect(canBlink('neutral')).toBe(true);
    expect(canBlink('happy')).toBe(false);
    expect(canBlink('sleepy')).toBe(false);
    expect(canBlink('starry')).toBe(false);
  });
});
