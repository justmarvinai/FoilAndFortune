import { useEffect, useMemo, useState } from 'react';
import { artRequestFor, loadRenderers, renderCached } from '@/art/loadRenderers';
import type { CreatureArtRenderer } from '@/art/types';
import { CardBack } from '@/cards/CardBack';
import { CardView } from '@/cards/CardView';
import { getRegistry } from '@/content/registry';
import type { Finish } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';
import { SegmentedControl } from '@/ui/components';
import { DebugShell } from './DebugShell';

// Debug page: exempt from i18n (CLAUDE.md).

interface SpikeCard {
  cardId: string;
  finish: Finish;
  label: string;
}

const SPIKE_CARDS: readonly SpikeCard[] = [
  { cardId: 'gk.emberdawn.035', finish: 'holo', label: 'Sparkit · Holo Rare' },
  { cardId: 'gk.emberdawn.012', finish: 'reverseHolo', label: 'Emberpup · Common, reverse holo' },
  { cardId: 'gk.emberdawn.024', finish: 'normal', label: 'Sploot · Uncommon' },
  { cardId: 'gk.emberdawn.108', finish: 'fullArtTextured', label: 'Sploot · Illustration Rare' },
  { cardId: 'gk.emberdawn.121', finish: 'gold', label: 'Emberpup · Secret Rare (gold)' },
];

const STYLES = [
  { id: 'clay', letter: 'A', name: 'Clay Critters', blurb: 'Soft 3D "vinyl toy" renders' },
  { id: 'sticker', letter: 'B', name: 'Sticker Pop', blurb: 'Bold-outline vector stickers' },
] as const;

type StyleId = (typeof STYLES)[number]['id'];
type View = 'compare' | StyleId;

function useRenderers(): Map<string, CreatureArtRenderer> | null {
  const [renderers, setRenderers] = useState<Map<string, CreatureArtRenderer> | null>(null);
  useEffect(() => {
    let alive = true;
    void loadRenderers().then((found) => {
      if (alive) setRenderers(found);
    });
    return () => {
      alive = false;
    };
  }, []);
  return renderers;
}

function ArtCard({
  card,
  finish,
  renderer,
  width,
}: {
  card: CardDef;
  finish: Finish;
  renderer: CreatureArtRenderer | undefined;
  width: string;
}) {
  const [art, setArt] = useState<{ url: string; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!renderer) return;
    const species = getRegistry().species.get(card.art.speciesId ?? card.speciesId ?? '');
    if (!species) return;
    let alive = true;
    renderCached(renderer, artRequestFor(card, species), `${card.id}|${finish}`)
      .then((result) => {
        if (alive) setArt(result);
      })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      alive = false;
    };
  }, [card, finish, renderer]);

  const status = !renderer
    ? 'renderer not built yet'
    : error
      ? `error: ${error}`
      : art
        ? `${art.ms} ms`
        : 'rendering…';

  return (
    <figure className="flex flex-col items-center gap-2">
      <CardView card={card} finish={finish} artUrl={art?.url} width={width} />
      <figcaption className="text-xs text-paper/50">{status}</figcaption>
    </figure>
  );
}

export default function ArtSpikePage() {
  const renderers = useRenderers();
  const [view, setView] = useState<View>('compare');
  const cards = useMemo(() => {
    const registry = getRegistry();
    return SPIKE_CARDS.flatMap((spike) => {
      const card = registry.cards.get(spike.cardId);
      return card ? [{ ...spike, card }] : [];
    });
  }, []);

  const cardWidth = view === 'compare' ? 'min(300px, 42vw)' : 'min(280px, 44vw)';

  return (
    <DebugShell
      title="Card Art Spike"
      subtitle="Same creatures, same cards, two art styles. Hover or drag across a card to tilt the foil."
      tone="dark"
      actions={
        <SegmentedControl<View>
          size="sm"
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'compare', label: 'A vs B' },
            { value: 'clay', label: 'A only' },
            { value: 'sticker', label: 'B only' },
          ]}
        />
      }
    >
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {STYLES.map((style) => (
            <div key={style.id} className="rounded-2xl border-[3px] border-black/40 bg-white/5 p-4">
              <p className="font-display text-2xl tracking-wide">
                <span className="mr-2 inline-grid size-9 place-items-center rounded-lg border-[3px] border-ink bg-sun text-ink">
                  {style.letter}
                </span>
                {style.name}
              </p>
              <p className="mt-1 text-paper/70">
                {style.blurb}
                {renderers && !renderers.has(style.id) ? ' (not built yet)' : ''}
              </p>
            </div>
          ))}
        </div>

        {view === 'compare' ? (
          <div className="space-y-14">
            {cards.map(({ card, finish, label }) => (
              <section key={card.id}>
                <h2 className="mb-4 text-center font-display text-xl tracking-wide text-paper/90">
                  {label}
                </h2>
                <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-12">
                  {STYLES.map((style) => (
                    <div key={style.id} className="flex flex-col items-center gap-2">
                      <span className="font-display text-sm tracking-wider text-sun">
                        {style.letter} · {style.name}
                      </span>
                      <ArtCard
                        card={card}
                        finish={finish}
                        renderer={renderers?.get(style.id)}
                        width={cardWidth}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-8">
            {cards.map(({ card, finish }) => (
              <ArtCard
                key={card.id}
                card={card}
                finish={finish}
                renderer={renderers?.get(view)}
                width={cardWidth}
              />
            ))}
            <CardBack width={cardWidth} />
          </div>
        )}

        <p className="mx-auto mt-16 max-w-xl rounded-2xl border-[3px] border-ink bg-sun p-4 text-center font-display text-lg tracking-wide text-ink shadow-[0_4px_0_var(--color-ink)]">
          Which style should Glimmerkin use? Reply in chat with <em>A</em>, <em>B</em>, or what
          you&apos;d mix.
        </p>
      </div>
    </DebugShell>
  );
}
