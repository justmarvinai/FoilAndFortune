import type { SheetProps } from './types';

/** STUB: replaced by the sheets work package (keep the default export and `SheetProps`). */
export default function PriceBoardSheet({ onClose }: SheetProps) {
  return (
    <div className="h-full bg-paper p-4 text-ink">
      <button type="button" onClick={onClose} aria-label="close">
        ×
      </button>
    </div>
  );
}
