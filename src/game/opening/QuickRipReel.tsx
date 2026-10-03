import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardView } from '@/cards/CardView';
import { NewSticker } from './bits';
import type { Director } from './fx';
import { type OpeningModel, quickRipPlan, type ReelEvent, type RevealCard } from './model';
import { ProductArtAdapter } from './productArt';
import { Spotlight } from './Spotlight';
import { sfx } from './stageAudio';

const VARIANTS = [0, 1, 2, 3];

function RailCard({ card, from }: { card: RevealCard; from(): DOMRect | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const play = useEffectEvent(() => {
    const element = ref.current;
    const source = from();
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
      { duration: 380, easing: 'cubic-bezier(.25,.9,.3,1)', fill: 'backwards' },
    );
    return () => animation.cancel();
  });
  useLayoutEffect(() => play(), []);
  return (
    <div ref={ref} className="ffo-rail__card">
      <CardView card={card.def} finish={card.finish} width="100%" interactive={false} />
      {card.isNew ? <NewSticker className="ffo-cell__new" /> : null}
    </div>
  );
}

/**
 * Quick Rip (docs/01 §14.2): every remaining pack of the box in about ten seconds. Packs pop past
 * in a blur; each Holo Rare or better stops the reel for its own flip and stinger, then joins the
 * highlights rail. The timeline is pure (`quickRipPlan`); this only plays it.
 */
export function QuickRipReel({
  model,
  from,
  reduced,
  director,
  onProgress,
  onLanded,
  onDone,
}: {
  model: OpeningModel;
  /** First card not yet revealed (Quick Rip the rest). */
  from: number;
  reduced: boolean;
  director: Director;
  /** Cards whose value is now in "value so far". */
  onProgress(landed: number): void;
  onLanded(card: RevealCard, element: HTMLElement): void;
  onDone(): void;
}) {
  const { t } = useTranslation('opening');
  const [plan] = useState(() => quickRipPlan(model, from));
  const [current, setCurrent] = useState<number | null>(null);
  const [landedHit, setLandedHit] = useState<number | null>(null);
  const [rail, setRail] = useState<number[]>([]);
  const packRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const lastHitRect = useRef<DOMRect | null>(null);

  /** Value lands up to the next hit still to be shown in that pack (hits bring their own). */
  function landedUpTo(segmentIndex: number, after: number): number {
    const segment = model.segments[segmentIndex];
    if (!segment) return after;
    const next = model.cards.find(
      (card) => card.segment === segmentIndex && card.hit && card.index > after,
    );
    return next ? next.index : segment.first + segment.count;
  }

  function packBeat(event: Extract<ReelEvent, { kind: 'pack' }>) {
    const pack = packRef.current;
    if (counterRef.current) {
      counterRef.current.textContent = t('reel.pack', {
        n: event.packNumber,
        total: model.packCount,
      });
    }
    if (barRef.current) {
      barRef.current.style.width = `${(event.packNumber / Math.max(1, model.packCount)) * 100}%`;
    }
    sfx('pack.tear', { volume: 0.3, rate: 0.9 + ((event.packNumber * 37) % 40) / 100 });
    if (pack) {
      pack.dataset.variant = String(event.packNumber % VARIANTS.length);
      if (!reduced) {
        pack.animate(
          [{ transform: 'scale(1.14) rotate(-4deg)' }, { transform: 'scale(1) rotate(0deg)' }],
          { duration: 170, easing: 'ease-out' },
        );
        const rect = pack.getBoundingClientRect();
        director.shards(
          rect.left + rect.width / 2,
          rect.top + rect.height * 0.1,
          7,
          rect.width * 0.7,
        );
      }
    }
    const segment = model.segments[event.segment];
    if (segment) onProgress(landedUpTo(segment.index, Math.max(from, segment.first) - 1));
  }

  const run = useEffectEvent(() => {
    let frame = 0;
    let index = 0;
    let shown: number | null = null;
    const start = performance.now();
    const retire = () => {
      if (shown === null) return;
      const moved = shown;
      lastHitRect.current = hitRef.current?.getBoundingClientRect() ?? null;
      setRail((cards) => [...cards, moved]);
      setCurrent(null);
      shown = null;
    };
    const tick = (now: number) => {
      const elapsed = now - start;
      for (
        let event = plan.events[index];
        event && event.atMs <= elapsed;
        event = plan.events[++index]
      ) {
        retire();
        if (event.kind === 'pack') packBeat(event);
        else {
          shown = event.card;
          setLandedHit(null);
          setCurrent(event.card);
        }
      }
      if (elapsed >= plan.totalMs) {
        retire();
        onDone();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });
  useEffect(() => run(), []);

  const hit = current === null ? undefined : model.cards[current];

  return (
    <div className="ffo-view">
      <div className="ffo-reel">
        <div className="ffo-reel__stage">
          <div ref={packRef} className="ffo-reel__pack" data-variant="0" aria-hidden="true">
            {VARIANTS.map((variant) => (
              <div key={variant} className="ffo-reel__variant" data-v={variant}>
                <ProductArtAdapter
                  productId={model.segments[0]?.productId ?? model.productId}
                  variant={variant}
                  height="100%"
                />
              </div>
            ))}
          </div>
          {hit ? (
            <div ref={hitRef} className="ffo-reel__hit">
              <Spotlight
                key={hit.index}
                card={hit}
                landed={landedHit === hit.index}
                from={() => packRef.current?.getBoundingClientRect() ?? null}
                reduced={reduced}
                director={director}
                onLanded={(card, element) => {
                  setLandedHit(card.index);
                  onProgress(landedUpTo(card.segment, card.index));
                  onLanded(card, element);
                }}
              />
            </div>
          ) : null}
          <div className="ffo-reel__meter">
            <span ref={counterRef} className="ffo-reel__counter">
              {t('reel.pack', { n: 0, total: model.packCount })}
            </span>
            <div className="ffo-reel__bar">
              <div ref={barRef} />
            </div>
          </div>
        </div>
        <div className="ffo-rail">
          {rail.map((index) => {
            const card = model.cards[index];
            return card ? (
              <RailCard key={index} card={card} from={() => lastHitRect.current} />
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}
