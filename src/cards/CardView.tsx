import { type CSSProperties, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getRegistry } from '@/content/registry';
import type { Finish } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';
import { elements } from '@/content/tcg/gk/elements';
import { ElementIcon } from '@/ui/components/ElementIcon';
import { RarityGem } from '@/ui/components/RarityGem';
import { useCardTilt } from './useCardTilt';
import './cards.css';

export interface CardViewProps {
  card: CardDef;
  /** Printed finish; defaults to the card's first finish. */
  finish?: Finish;
  /** Resolved art image (object URL or path). Falls back to an element-tinted placeholder. */
  artUrl?: string;
  /** Card width: pixels or any CSS length. Height follows the 5:7 ratio. */
  width?: number | string;
  /** Pointer tilt + moving foil. Off for dense grids (binder pages, inventory). */
  interactive?: boolean;
  className?: string;
}

/**
 * A Glimmerkin trading card (docs/04 §5): layered DOM/SVG + CSS foil, fully vector and
 * resolution independent (all sizes are container-query units).
 */
export function CardView({
  card,
  finish = card.finishes[0] ?? 'normal',
  artUrl,
  width = 300,
  interactive = true,
  className = '',
}: CardViewProps) {
  const { t } = useTranslation('cards');
  const rootRef = useRef<HTMLDivElement>(null);
  useCardTilt(rootRef, interactive);

  const { set, dex } = useMemo(() => {
    const registry = getRegistry();
    return {
      set: registry.sets.get(card.setId),
      dex: card.speciesId ? registry.species.get(card.speciesId)?.dex : undefined,
    };
  }, [card.setId, card.speciesId]);

  const element = elements[card.element ?? 'neutral'];
  const full = card.art.composition === 'fullArt';
  const foil = finish !== 'normal';
  const number = String(card.number).padStart(3, '0');
  const total = set ? String(set.totalMain).padStart(3, '0') : '???';

  const style = {
    width,
    '--el-color': element.color,
    '--el-tint': element.tint,
  } as CSSProperties;

  const nameBar = (
    <header className="gk-card__namebar">
      {card.stage ? <span className="gk-card__stage">{t(`stage.${card.stage}`)}</span> : null}
      <span className="gk-card__name">{card.name}</span>
      {card.hp ? (
        <span className="gk-card__hp">
          <small>{t('hp')}</small>
          {card.hp}
        </span>
      ) : null}
      {card.element ? <ElementIcon element={card.element} size="6.4cqw" /> : null}
    </header>
  );

  const moves = (
    <div className="gk-card__moves">
      {card.ability ? (
        <div>
          <div className="gk-card__move-head">
            <span className="gk-card__ability-tag">{t('ability')}</span>
            <span className="gk-card__move-name">{card.ability.name}</span>
          </div>
          <p className="gk-card__move-text">{card.ability.text}</p>
        </div>
      ) : null}
      {card.attacks?.map((attack) => (
        <div key={attack.name}>
          <div className="gk-card__move-head">
            <span className="gk-card__cost">
              {attack.cost.map((cost, index) => (
                // Costs can repeat (e.g. two Ember); position is the stable identity here.
                // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
                <ElementIcon key={`${cost}-${index}`} element={cost} size="4.4cqw" />
              ))}
            </span>
            <span className="gk-card__move-name">{attack.name}</span>
            {attack.damage ? <span className="gk-card__damage">{attack.damage}</span> : null}
          </div>
          {attack.text ? <p className="gk-card__move-text">{attack.text}</p> : null}
        </div>
      ))}
    </div>
  );

  const stats = (
    <div className="gk-card__stats">
      <span>
        {t('weakness')}
        {card.weakness ? (
          <>
            <ElementIcon element={card.weakness} size="3.6cqw" />
            ×2
          </>
        ) : (
          '—'
        )}
      </span>
      <span>
        {t('resistance')}
        {card.resistance ? <ElementIcon element={card.resistance} size="3.6cqw" /> : ' —'}
      </span>
      <span>
        {t('retreat')}
        {Array.from({ length: card.retreat ?? 0 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical icons, fixed count
          <ElementIcon key={index} element="neutral" size="3.6cqw" />
        ))}
      </span>
    </div>
  );

  const footer = (
    <footer className="gk-card__footer">
      <span>{t('illustrator', { name: card.illustrator })}</span>
      <span className="gk-card__setno">
        {set?.code ?? ''} {number}/{total}
        <RarityGem rarity={card.rarity} size="3cqw" />
      </span>
    </footer>
  );

  const art = (
    <div className="gk-card__art">
      {artUrl ? (
        <img src={artUrl} alt="" draggable={false} />
      ) : (
        <div className="gk-card__art-placeholder">
          {card.element ? <ElementIcon element={card.element} size="18cqw" /> : null}
        </div>
      )}
      {finish === 'holo' ? (
        <>
          <div className="gk-foil gk-foil--rainbow" />
          <div className="gk-foil gk-foil--starburst" />
          <div className="gk-foil gk-foil--sparkle" />
        </>
      ) : null}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`gk-card ${full ? 'gk-card--full' : ''} ${className}`}
      style={style}
      data-finish={finish}
      data-rarity={card.rarity}
      data-foil={foil}
      role="img"
      aria-label={`${card.name}, ${t(`rarity.${card.rarity}`)}`}
    >
      <div className="gk-card__tilt">
        <div className="gk-card__face">
          {full ? (
            <>
              {art}
              <div className="gk-card__overlay">
                {nameBar}
                <div className="gk-card__panel">
                  {moves}
                  {footer}
                </div>
              </div>
            </>
          ) : (
            <div className="gk-card__body">
              {nameBar}
              {art}
              <div className="gk-card__info">
                {dex ? `No. ${String(dex).padStart(3, '0')} · ` : ''}
                {t(`element.${card.element ?? 'neutral'}`)} · {t(`stage.${card.stage ?? 'basic'}`)}
              </div>
              {moves}
              {stats}
              {card.flavor ? <p className="gk-card__flavor">{card.flavor}</p> : null}
              {footer}
            </div>
          )}

          {finish === 'reverseHolo' ? (
            <div className="gk-foil gk-foil--reverse-mask">
              <div className="gk-foil gk-foil--rainbow" />
              <div className="gk-foil gk-foil--sparkle" />
            </div>
          ) : null}
          {finish === 'fullArtTextured' ? (
            <>
              <div className="gk-foil gk-foil--texture" />
              <div
                className="gk-foil gk-foil--rainbow"
                style={{ opacity: 'calc(0.12 + var(--hover) * 0.3)' }}
              />
              <div className="gk-foil gk-foil--sparkle" />
            </>
          ) : null}
          {finish === 'gold' ? (
            <>
              <div className="gk-foil gk-foil--gold" />
              <div className="gk-foil gk-foil--sparkle" />
            </>
          ) : null}
          {foil || interactive ? <div className="gk-foil gk-foil--glare" /> : null}
        </div>
      </div>
    </div>
  );
}
