import { type CSSProperties, useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CardView } from '@/cards/CardView';
import { FaceDown, NewSticker } from './bits';
import type { Director } from './fx';
import {
  deckSections,
  type OpeningModel,
  type Progress,
  type RevealCard,
  type RevealSegment,
} from './model';
import { Spotlight } from './Spotlight';
import { sfx } from './stageAudio';

/** How many revealed cards the pile shows (older ones are buried anyway). */
const PILE_SHOWN = 6;
/** Delay between cards dealt in a batch or a deck cascade. */
export const DEAL_STAGGER_MS = 45;

export interface TableProps {
  model: OpeningModel;
  segment: RevealSegment;
  progress: Progress;
  /** Cards whose reveal animation has finished. */
  landed: number;
  /** The last Skip-commons batch: those cards fly from the stack straight onto the pile. */
  batch: readonly number[] | null;
  reduced: boolean;
  director: Director;
  onLanded(card: RevealCard, element: HTMLElement): void;
}

function rectOf(container: HTMLElement | null, selector: string): DOMRect | null {
  return container?.querySelector(selector)?.getBoundingClientRect() ?? null;
}

function PileCard({
  card,
  depth,
  from,
  delay,
  reduced,
}: {
  card: RevealCard;
  depth: number;
  from(): DOMRect | null;
  delay: number;
  reduced: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const play = useEffectEvent(() => {
    const element = ref.current;
    const source = reduced ? null : from();
    if (!element || !source) return undefined;
    const target = element.getBoundingClientRect();
    if (target.width === 0) return undefined;
    const dx = source.left + source.width / 2 - (target.left + target.width / 2);
    const dy = source.top + source.height / 2 - (target.top + target.height / 2);
    const animation = element.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${source.width / target.width})` },
        { transform: 'none' },
      ],
      { duration: 420, delay, easing: 'cubic-bezier(.25,.9,.3,1)', fill: 'backwards' },
    );
    return () => animation.cancel();
  });
  useLayoutEffect(() => play(), []);
  return (
    <div className="ffo-pile__card" style={{ '--k': depth, zIndex: 10 - depth } as CSSProperties}>
      <div ref={ref}>
        <CardView card={card.def} finish={card.finish} width="100%" interactive={false} />
      </div>
    </div>
  );
}

/**
 * One pack (or the promos) on the table: the revealed pile on the left, the spotlight in the
 * middle and the face-down stack on the right, whose top card glows in its rarity color when
 * it's special (docs/05 §5.7).
 */
export function RevealTable({
  model,
  segment,
  progress,
  landed,
  batch,
  reduced,
  director,
  onLanded,
}: TableProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const cards = model.cards.slice(segment.first, segment.first + segment.count);
  const unrevealed = cards.filter((card) => card.index >= progress.revealed);
  const spot = progress.spot === null ? undefined : model.cards[progress.spot];
  const spotCard = spot?.segment === segment.index ? spot : undefined;
  const pile = cards
    .filter((card) => card.index < progress.revealed && card.index !== spotCard?.index)
    .slice(-PILE_SHOWN);
  const fromBatch = new Set(batch ?? []);
  const stackRect = () => rectOf(stackRef.current, '.ffo-stack__deck');
  const spotRect = () => rectOf(centerRef.current, '.ffo-spot');

  return (
    <div className="ffo-view">
      <div className="ffo-table">
        <div className="ffo-pile">
          <div className="ffo-pile__fan">
            {pile.map((card, i) => (
              <PileCard
                key={card.index}
                card={card}
                depth={pile.length - 1 - i}
                from={fromBatch.has(card.index) ? stackRect : spotRect}
                delay={fromBatch.has(card.index) ? i * DEAL_STAGGER_MS : 0}
                reduced={reduced}
              />
            ))}
          </div>
        </div>
        <div ref={centerRef} className="ffo-center">
          {spotCard ? (
            <Spotlight
              key={spotCard.index}
              card={spotCard}
              landed={landed > spotCard.index}
              from={stackRect}
              reduced={reduced}
              director={director}
              onLanded={onLanded}
            />
          ) : null}
        </div>
        <div ref={stackRef} className="ffo-stack">
          {/* The deck stays mounted when empty: the last card still flies from here. */}
          <div className="ffo-stack__deck">
            {unrevealed.slice(0, 4).map((card, depth) => (
              <FaceDown
                key={card.index}
                card={card}
                depth={depth}
                glow={depth === 0 && card.featured}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A starter deck (docs/01 §14.2 "deck list reveal"): the list cascades onto the table grouped
 * like a printed decklist, then the guaranteed holo waits face-down, glowing, for its own flip.
 */
export function DeckTable({
  model,
  segment,
  progress,
  landed,
  reduced,
  director,
  onLanded,
  onDealt,
}: TableProps & { onDealt(): void }) {
  const { t } = useTranslation('opening');
  const finaleRef = useRef<HTMLDivElement>(null);
  const finalCard = model.cards[segment.first + segment.count - 1];
  const sections = deckSections(
    model.cards.slice(segment.first, segment.first + segment.count - 1),
  );
  const offsets = sections.map((_, i) =>
    sections.slice(0, i).reduce((sum, section) => sum + section.groups.length, 0),
  );
  const groups = sections.reduce((sum, section) => sum + section.groups.length, 0);
  const dealt = finalCard !== undefined && landed >= finalCard.index;
  const pending = finalCard !== undefined && progress.revealed <= finalCard.index;

  const deal = useEffectEvent(() => {
    sfx('pack.slide');
    if (reduced) {
      onDealt();
      return undefined;
    }
    const ticks = Math.min(groups, 14);
    const step = (groups * DEAL_STAGGER_MS) / Math.max(1, ticks);
    const timers = Array.from({ length: ticks }, (_, i) =>
      window.setTimeout(() => sfx('pack.flip', { volume: 0.3, rate: 1.05 + i * 0.03 }), i * step),
    );
    timers.push(window.setTimeout(onDealt, groups * DEAL_STAGGER_MS + 520));
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  });
  useEffect(() => deal(), []);

  return (
    <div className="ffo-view" data-pending={dealt}>
      <div className="ffo-deck">
        {sections.map((section, s) => (
          <section key={section.kind} className="ffo-deck__section">
            <h3>{t(`deck.${section.kind}`, { count: section.count })}</h3>
            <div className="ffo-deck__row">
              {section.groups.map((group, g) => {
                const order = (offsets[s] ?? 0) + g;
                return (
                  <div
                    key={group.key}
                    className="ffo-deck__group"
                    style={
                      {
                        '--d': `${order * DEAL_STAGGER_MS}ms`,
                        '--fx': `${((order % 7) - 3) * 5}vw`,
                      } as CSSProperties
                    }
                  >
                    <CardView
                      card={group.card.def}
                      finish={group.card.finish}
                      width="100%"
                      interactive={false}
                    />
                    {group.count > 1 ? (
                      <span className="ffo-count">{t('copies', { count: group.count })}</span>
                    ) : null}
                    {group.isNew ? <NewSticker className="ffo-cell__new" /> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {finalCard && dealt ? (
        <div ref={finaleRef} className="ffo-finale">
          {pending ? (
            <div className="ffo-spot ffo-finale__card">
              <FaceDown card={finalCard} depth={0} glow />
            </div>
          ) : (
            <Spotlight
              key={finalCard.index}
              card={finalCard}
              landed={landed > finalCard.index}
              from={() => null}
              reduced={reduced}
              director={director}
              onLanded={onLanded}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
