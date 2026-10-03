import { describe, expect, it } from 'vitest';
import { gridColumns, visibleRows } from './virtualWindow';

describe('gridColumns', () => {
  it('fits as many minimum-width cells as the width allows', () => {
    expect(gridColumns(600, 100, 12)).toBe(5);
    expect(gridColumns(99, 100, 12)).toBe(1);
    expect(gridColumns(0, 100, 12)).toBe(1);
    expect(gridColumns(Number.NaN, 100, 12)).toBe(1);
    expect(gridColumns(1000, 0, 12)).toBe(1);
  });
});

describe('visibleRows', () => {
  const base = { rowHeight: 100, rowCount: 50, overscan: 2, viewportHeight: 350 };

  it('renders the viewport plus overscan', () => {
    expect(visibleRows({ ...base, scrollTop: 0 })).toEqual({ start: 0, end: 6 });
    expect(visibleRows({ ...base, scrollTop: 1000 })).toEqual({ start: 8, end: 16 });
  });

  it('clamps at the end and on overscroll', () => {
    expect(visibleRows({ ...base, scrollTop: 10_000 })).toEqual({ start: 49, end: 50 });
    expect(visibleRows({ ...base, scrollTop: -80 })).toEqual({ start: 0, end: 6 });
  });

  it('handles empty grids and a zero-height viewport', () => {
    expect(visibleRows({ ...base, rowCount: 0, scrollTop: 0 })).toEqual({ start: 0, end: 0 });
    expect(visibleRows({ ...base, viewportHeight: 0, scrollTop: 0 })).toEqual({ start: 0, end: 2 });
  });
});
