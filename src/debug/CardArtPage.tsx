import { useEffect, useState } from 'react';
import { artRequestFor, loadRenderers, renderCached } from '@/art/loadRenderers';
import type { CreatureArtRenderer } from '@/art/types';
import { CardBack } from '@/cards/CardBack';
import { CardView } from '@/cards/CardView';
import { getRegistry } from '@/content/registry';
import type { CardDef } from '@/content/schema/tcg';
import { DebugShell } from './DebugShell';

// Debug page: exempt from i18n (CLAUDE.md).

function useClayRenderer(): CreatureArtRenderer | null | undefined {
  const [renderer, setRenderer] = useState<CreatureArtRenderer | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void loadRenderers().then((found) => {
      if (alive) setRenderer(found.get('clay') ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);
  return renderer;
}

function ArtCard({ card, renderer }: { card: CardDef; renderer: CreatureArtRenderer | null }) {
  const [art, setArt] = useState<{ url: string; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!renderer) return;
    const species = getRegistry().species.get(card.art.speciesId ?? card.speciesId ?? '');
    if (!species) return;
    let alive = true;
    renderCached(renderer, artRequestFor(card, species), card.id)
      .then((result) => {
        if (alive) setArt(result);
      })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      alive = false;
    };
  }, [card, renderer]);

  const status = !renderer
    ? 'renderer unavailable'
    : error
      ? `error: ${error}`
      : art
        ? `${art.ms} ms`
        : 'rendering…';

  return (
    <figure className="flex flex-col items-center gap-2">
      <CardView card={card} artUrl={art?.url} width="min(260px, 42vw)" />
      <figcaption className="text-center text-xs text-paper/60">
        {card.id} · {card.rarity}
        <br />
        {status}
      </figcaption>
    </figure>
  );
}

/**
 * Card art gallery (/debug/art): every card in the registry, drawn at runtime with the Clay
 * Critters renderer (ADR-006) inside the real card frames and foils.
 */
export default function CardArtPage() {
  const renderer = useClayRenderer();
  const cards = [...getRegistry().cards.values()].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <DebugShell
      title="Card Art"
      subtitle="Clay Critters art on real cards. Hover or drag across a card to tilt the foil."
      tone="dark"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-8 px-4 py-10">
        {renderer === undefined
          ? null
          : cards.map((card) => <ArtCard key={card.id} card={card} renderer={renderer} />)}
        <CardBack width="min(260px, 42vw)" />
      </div>
    </DebugShell>
  );
}
