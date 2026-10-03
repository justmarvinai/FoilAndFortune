/**
 * Windowing math for the virtualized singles grid (docs/05 §5.4 "virtualized grid, thousands of
 * cards"). Pure, so the scroll behavior is unit-tested without a DOM.
 */

/** Columns that fit a width with cells of at least `minCell` px and `gap` px between them. */
export function gridColumns(width: number, minCell: number, gap: number): number {
  if (!(width > 0) || !(minCell > 0)) return 1;
  return Math.max(1, Math.floor((width + gap) / (minCell + gap)));
}

export interface WindowInput {
  scrollTop: number;
  viewportHeight: number;
  /** Row pitch: cell height + row gap. */
  rowHeight: number;
  rowCount: number;
  /** Extra rows rendered above and below the viewport. */
  overscan: number;
}

/** Rows to render: `[start, end)` in row indices. */
export function visibleRows({
  scrollTop,
  viewportHeight,
  rowHeight,
  rowCount,
  overscan,
}: WindowInput): { start: number; end: number } {
  if (rowCount <= 0 || !(rowHeight > 0)) return { start: 0, end: 0 };
  const top = Math.max(0, scrollTop);
  const first = Math.floor(top / rowHeight);
  const last = Math.ceil((top + Math.max(0, viewportHeight)) / rowHeight);
  const start = Math.max(0, Math.min(rowCount - 1, first - overscan));
  const end = Math.min(rowCount, Math.max(start + 1, last + overscan));
  return { start, end };
}
