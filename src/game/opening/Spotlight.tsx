import { type CSSProperties, useEffectEvent, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CardBack } from '@/cards/CardBack';
import { CardView } from '@/cards/CardView';
import { formatMoney } from '@/core/money';
import { Sticker } from '@/ui/components/Sticker';
import { hasRim, NewSticker, RarityLabel, rarityStyle } from './bits';
import type { Director } from './fx';
import { flipKeyframes } from './fxMath';
import { type RevealCard, revealTiming } from './model';

export interface SpotlightProps {
  card: RevealCard;
  /** The flip finished: NEW!, the price tag, the ribbon and the beams come in. */
  landed: boolean;
  /** Where the card flies in from (the stack); null flips it in place. */
  from(): DOMRect | null;
  reduced: boolean;
  /** Face-up at once (e.g. a card already shown before a re-mount). */
  instant?: boolean;
  director: Director;
  onLanded(card: RevealCard, element: HTMLElement): void;
}

/**
 * The card in the spotlight (docs/05 §5.7): flies off the stack while flipping face-up, then
 * shows its NEW! sticker, market value tag and rarity ribbon. Hits get beams and a burst in the
 * rarity color; Illustration Rare and up flip in slow motion. Reduced motion crossfades instead.
 */
export function Spotlight({
  card,
  landed,
  from,
  reduced,
  instant = false,
  director,
  onLanded,
}: SpotlightProps) {
  const { t } = useTranslation('opening');
  const rootRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const timing = revealTiming(card);
  const beams = reduced ? 0 : timing.beams;

  const play = useEffectEvent(() => {
    const root = rootRef.current;
    const flip = flipRef.current;
    if (!root || !flip) return undefined;
    if (instant) {
      onLanded(card, root);
      return undefined;
    }
    let animation: Animation;
    if (reduced) {
      animation = flip.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 200,
        easing: 'ease-out',
      });
    } else {
      const source = from();
      const target = root.getBoundingClientRect();
      const delta =
        source && target.width > 0
          ? {
              dx: source.left + source.width / 2 - (target.left + target.width / 2),
              dy: source.top + source.height / 2 - (target.top + target.height / 2),
              scale: source.width / target.width,
            }
          : { dx: 0, dy: 0, scale: 1 };
      animation = flip.animate(flipKeyframes(delta, timing.slowMo), {
        duration: timing.flipMs,
        fill: 'backwards',
      });
    }
    // Taps fast-forward plain flips; hits always play out.
    if (card.tier === 'none') director.track(animation);
    let alive = true;
    animation.finished.then(
      () => {
        if (alive) onLanded(card, root);
      },
      () => {},
    );
    return () => {
      alive = false;
      animation.cancel();
    };
  });

  // Runs once per card (the parent keys the spotlight by card index).
  useLayoutEffect(() => play(), []);

  return (
    <div
      ref={rootRef}
      className="ffo-spot"
      data-tier={card.tier}
      data-hit={card.hit}
      data-landed={landed}
      data-glow={card.featured}
      data-rim={card.featured && hasRim(card)}
      style={rarityStyle(card.rarity)}
    >
      <div className="ffo-spot__fx" aria-hidden="true">
        <div className="ffo-halo" />
        {beams > 0 ? (
          <div className="ffo-beams">
            {Array.from({ length: beams }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed set of identical beams
              <i key={i} style={{ '--i': i, '--n': beams } as CSSProperties} />
            ))}
          </div>
        ) : null}
        <div className="ffo-burst" />
      </div>
      <div ref={flipRef} className="ffo-spot__card">
        <div className="ffo-face ffo-face--front">
          <CardView
            card={card.def}
            finish={card.finish}
            width="100%"
            interactive={landed && !reduced}
          />
        </div>
        <div className="ffo-face ffo-face--back">
          <CardBack width="100%" />
        </div>
      </div>
      {card.isNew ? <NewSticker className="ffo-spot__new" /> : null}
      <span className="ffo-tag">{formatMoney(card.valueCents)}</span>
      <span className="ffo-ribbon">
        <RarityLabel rarity={card.rarity} />
      </span>
      {card.misprint && landed ? (
        <span className="ffo-misprint">
          <Sticker color="var(--color-grape)" rotate={8}>
            {t(`misprint.${card.misprint}`)}
          </Sticker>
        </span>
      ) : null}
    </div>
  );
}
