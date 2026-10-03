import { CardView } from '@/cards/CardView';
import type { Finish } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';
import { useSheetCardArt } from './hooks';

/**
 * A light card thumbnail for grids, pockets and pickers: the real CardView (frame, foil layers,
 * text) without pointer tilt, so dense grids stay cheap (docs/05 §12 "CardThumb").
 */
export function CardThumb({
  card,
  finish,
  width,
  className = '',
}: {
  card: CardDef;
  finish?: Finish;
  width: number | string;
  className?: string;
}) {
  const artUrl = useSheetCardArt(card);
  return (
    <CardView
      card={card}
      finish={finish}
      artUrl={artUrl}
      width={width}
      interactive={false}
      className={className}
    />
  );
}
