import { type ReactNode, useEffect, useRef, useState } from 'react';
import { gridColumns, visibleRows } from '../model/virtualWindow';

/**
 * A virtualized grid (docs/05 §5.4 "virtualized grid, thousands of cards"): only the rows in view
 * (plus overscan) are in the DOM. Columns follow the container width; the cell height follows the
 * cell width (`aspect`) plus a fixed caption.
 */
export function VirtualGrid<T>({
  items,
  itemKey,
  renderItem,
  minCellWidth,
  aspect,
  captionHeight = 0,
  gap = 12,
  padding = 12,
  overscan = 2,
  label,
  className = '',
}: {
  items: readonly T[];
  itemKey(item: T): string;
  renderItem(item: T, cellWidth: number): ReactNode;
  minCellWidth: number;
  /** Height / width of the cell's visual (e.g. 7/5 for cards). */
  aspect: number;
  captionHeight?: number;
  gap?: number;
  padding?: number;
  overscan?: number;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrollTop(el.scrollTop));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  const inner = Math.max(0, box.width - padding * 2);
  const columns = gridColumns(inner, minCellWidth, gap);
  const cellWidth = columns > 0 ? (inner - gap * (columns - 1)) / columns : minCellWidth;
  const cellHeight = cellWidth * aspect + captionHeight;
  const rowHeight = cellHeight + gap;
  const rowCount = Math.ceil(items.length / columns);
  const { start, end } = visibleRows({
    scrollTop: Math.max(0, scrollTop - padding),
    viewportHeight: box.height,
    rowHeight,
    rowCount,
    overscan,
  });

  const cells: ReactNode[] = [];
  if (box.width > 0) {
    for (let row = start; row < end; row++) {
      for (let col = 0; col < columns; col++) {
        const item = items[row * columns + col];
        if (item === undefined) break;
        cells.push(
          <li
            key={itemKey(item)}
            className="absolute"
            style={{
              width: cellWidth,
              height: cellHeight,
              transform: `translate(${padding + col * (cellWidth + gap)}px, ${padding + row * rowHeight}px)`,
            }}
          >
            {renderItem(item, cellWidth)}
          </li>,
        );
      }
    }
  }

  return (
    <div ref={ref} className={`sheet-scroll relative min-h-0 overflow-y-auto ${className}`}>
      <ul
        aria-label={label}
        className="relative"
        style={{ height: rowCount > 0 ? padding * 2 + rowCount * rowHeight - gap : 0 }}
      >
        {cells}
      </ul>
    </div>
  );
}
