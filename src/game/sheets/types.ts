/**
 * Contract between the play screen's sheet host (placement, slide-in, Esc and backdrop close,
 * focus) and each sheet (its own skin, header and content, docs/05 §5.4–5.9).
 */
export interface SheetProps {
  onClose(): void;
}
