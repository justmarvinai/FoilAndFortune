import { describe, expect, it } from 'vitest';
import { dollars, formatMoney, isCents, scaleCents } from './money';

describe('money', () => {
  it('converts dollars to integer cents', () => {
    expect(dollars(4.49)).toBe(449);
    expect(dollars(161.64)).toBe(16164);
    expect(isCents(dollars(0.1 + 0.2))).toBe(true);
  });

  it('scales and rounds to whole cents', () => {
    expect(scaleCents(449, 0.66)).toBe(296);
    expect(scaleCents(-449, 0.5)).toBe(-225);
    expect(isCents(scaleCents(333, 1 / 3))).toBe(true);
  });

  it('formats amounts', () => {
    expect(formatMoney(123456)).toBe('$1,234.56');
    expect(formatMoney(449, { signed: true })).toBe('+$4.49');
    expect(formatMoney(-449)).toBe('−$4.49');
    expect(formatMoney(60000, { hideZeroCents: true })).toBe('$600');
  });

  it('abbreviates large amounts in compact mode', () => {
    expect(formatMoney(1_240_000, { compact: true })).toBe('$12.4K');
    expect(formatMoney(120_000_000, { compact: true })).toBe('$1.2M');
    expect(formatMoney(999_999, { compact: true })).toBe('$9,999.99');
  });
});
