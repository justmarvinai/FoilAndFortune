/**
 * Fixture Popover (docs/05 §5.3): slot tiles with counts, capacity and price tags, and quick
 * actions (Fill, Swap product, Price, Clear, Restock this fixture). Rendered by the live scene in
 * its world overlay, anchored to the fixture (src/scene/live/types.ts `anchored`).
 *
 * STUB: replaced by the sheets work package (keep the named export and props).
 */
export interface FixturePopoverProps {
  fixtureUid: string;
  onClose(): void;
}

export function FixturePopover({ fixtureUid, onClose }: FixturePopoverProps) {
  return (
    <div className="rounded-xl border-[3px] border-ink bg-paper p-3 text-ink">
      <code>{fixtureUid}</code>
      <button type="button" onClick={onClose} aria-label="close">
        ×
      </button>
    </div>
  );
}
