import { useState } from 'react';
import { CardBack } from '@/cards/CardBack';
import { CardView } from '@/cards/CardView';
import { useCardArt } from '@/cards/useCardArt';
import { getRegistry } from '@/content/registry';
import type { Rarity } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { DebugShell } from './DebugShell';

// Debug page: exempt from i18n (CLAUDE.md).

const RARITY_ORDER: readonly Rarity[] = [
  'mythicRare',
  'secretRare',
  'illustrationRare',
  'ultraRare',
  'holoRare',
  'rare',
  'uncommon',
  'common',
  'promo',
];

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  holoRare: 'Holo Rare',
  ultraRare: 'Ultra Rare',
  illustrationRare: 'Illustration Rare',
  secretRare: 'Secret Rare',
  mythicRare: 'Mythic Rare',
  promo: 'Promo',
};

type Mode = 'files' | 'live';

const CARD_WIDTH = 'min(230px, 38vw)';

function readMode(): Mode {
  return new URLSearchParams(window.location.search).get('art') === 'live' ? 'live' : 'files';
}

/** Live mode: renders the card's art in the browser (lazy-loads the Clay renderer). */
function LiveCard({ card }: { card: CardDef }) {
  const art = useCardArt(card, { live: true });
  return (
    <figure className="flex flex-col items-center gap-1.5">
      <CardView card={card} artUrl={art.url} width={CARD_WIDTH} />
      <figcaption className="text-center text-xs text-paper/60">
        {card.id} · {art.status === 'ready' ? `${art.ms ?? 0} ms` : art.status}
      </figcaption>
    </figure>
  );
}

function FileCard({ card }: { card: CardDef }) {
  const art = useCardArt(card, { runtime: false });
  return (
    <figure className="flex flex-col items-center gap-1.5">
      <CardView card={card} width={CARD_WIDTH} />
      <figcaption className="text-center text-xs text-paper/60">
        {card.id} · {art.source}
      </figcaption>
    </figure>
  );
}

/**
 * Card art gallery (/debug/art): every card in the registry on its real frame and foil, grouped
 * by set and rarity. Art comes from the pre-rendered WebP files (`npm run art:render`); the
 * "Live" toggle renders it in the browser with Clay Critters instead (ADR-006) for comparison.
 */
export default function CardArtPage() {
  const [mode, setMode] = useState<Mode>(readMode);
  const registry = getRegistry();
  const cards = [...registry.cards.values()];
  const sets = [...registry.sets.values()];

  const changeMode = (next: Mode) => {
    const params = new URLSearchParams(window.location.search);
    if (next === 'live') params.set('art', 'live');
    else params.delete('art');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    setMode(next);
  };

  return (
    <DebugShell
      title="Card Art"
      subtitle="Clay Critters art on real cards. Hover or drag across a card to tilt the foil."
      tone="dark"
      actions={
        <SegmentedControl
          label="Art source"
          size="sm"
          value={mode}
          onChange={changeMode}
          options={[
            { value: 'files', label: 'Pre-rendered' },
            { value: 'live', label: 'Live render' },
          ]}
        />
      }
    >
      <div className="mx-auto flex max-w-[1500px] flex-col gap-10 px-4 py-8">
        {sets.map((set) => {
          const inSet = cards.filter((card) => card.setId === set.id);
          return (
            <section key={set.id} className="flex flex-col gap-6">
              <h2 className="font-display text-3xl tracking-wide">
                {set.name}{' '}
                <span className="text-base text-paper/50">
                  {set.code} · {inSet.length} cards
                </span>
              </h2>
              <div className="flex flex-wrap gap-x-10 gap-y-8">
                {RARITY_ORDER.map((rarity) => {
                  const group = inSet
                    .filter((card) => card.rarity === rarity)
                    .sort((a, b) => a.number - b.number);
                  if (group.length === 0) return null;
                  return (
                    <div key={rarity} className="flex flex-col gap-3">
                      <h3 className="font-display text-lg tracking-wide text-paper/80">
                        {RARITY_LABEL[rarity]} · {group.length}
                      </h3>
                      <div className="flex flex-wrap gap-6">
                        {group.map((card) =>
                          mode === 'live' && card.kind !== 'essence' ? (
                            <LiveCard key={card.id} card={card} />
                          ) : (
                            <FileCard key={card.id} card={card} />
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-3xl tracking-wide">Card back</h2>
          <CardBack width={CARD_WIDTH} />
        </section>
      </div>
    </DebugShell>
  );
}
