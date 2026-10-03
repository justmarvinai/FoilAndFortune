import { Hand, Zap } from 'lucide-react';
import {
  type CSSProperties,
  type PointerEvent,
  type Ref,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { palette } from '@/ui/palette';
import type { Director } from './fx';
import { TEAR_Y, tearClipPaths, tearLine } from './fxMath';
import { ProductArtAdapter } from './productArt';
import { HAPTICS, haptic, sfx } from './stageAudio';

/** Lets the stage trigger the same opening a tap would (Space, Enter, a tap beside the pack). */
export interface OpenHandle {
  open(): void;
}

interface Drag {
  id: number;
  x: number;
  y: number;
  t: number;
  lastShard: number;
  /** Started on (or just above) the top crimp: only those drags tear. */
  near: boolean;
  sounded: boolean;
}

/** A drag across this share of the wrapper's width rips it open. */
const TEAR_DONE = 0.8;

/**
 * The sealed booster (docs/01 §14.1): floats in the spotlight with a foil sheen. Drag across the
 * top crimp to rip it (the tear follows the finger, shedding foil shards); a tap, Enter or Space
 * tears it for you. The strip flies off, the wrapper drops away and the stage brings the stack up.
 * A god pack glows gold before it's even torn (docs/04 §9).
 */
export function PackTear({
  productId,
  variant,
  godPack,
  reduced,
  director,
  onTorn,
  ref,
}: {
  productId: string;
  variant: number;
  godPack: boolean;
  reduced: boolean;
  director: Director;
  onTorn(): void;
  ref?: Ref<OpenHandle>;
}) {
  const { t } = useTranslation('opening');
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const live = useRef({ progress: 0, dir: 1, done: false, tween: 0, timer: 0 });
  const dragRef = useRef<Drag | null>(null);
  const [clips] = useState(() => tearClipPaths(tearLine(16, 0.011, variant + 3)));

  function setTear(value: number, dir: number) {
    const root = rootRef.current;
    if (!root) return;
    live.current.progress = value;
    live.current.dir = dir;
    root.style.setProperty('--tear', value.toFixed(3));
    root.style.setProperty('--tear-dir', String(dir));
    root.style.setProperty('--tear-hinge', dir > 0 ? '100%' : '0%');
    root.style.setProperty('--tear-from', dir > 0 ? '0%' : '100%');
  }

  function tearY(rect: DOMRect): number {
    return rect.top + rect.height * TEAR_Y;
  }

  function complete() {
    const state = live.current;
    const root = rootRef.current;
    const top = topRef.current;
    const body = bodyRef.current;
    if (state.done || !root || !top || !body) return;
    state.done = true;
    cancelAnimationFrame(state.tween);
    root.dataset.state = 'torn';
    haptic(HAPTICS.tear);
    if (reduced) {
      top.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
      state.timer = window.setTimeout(onTorn, 170);
      return;
    }
    const rect = root.getBoundingClientRect();
    const dir = state.dir;
    director.shards(rect.left + rect.width / 2, tearY(rect), 48, rect.width);
    director.sparks(rect.left + rect.width / 2, tearY(rect) + 6, palette.sun, 26, 0.7);
    top.animate(
      [
        { transform: `translateY(-7px) rotate(${dir * -7}deg)` },
        { transform: `translate(${dir * 130}px, -190px) rotate(${dir * -50}deg)`, opacity: 0 },
      ],
      { duration: 560, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' },
    );
    body.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: 'translateY(62%) scale(.9)', opacity: 0 },
      ],
      { duration: 460, delay: 200, easing: 'cubic-bezier(.55,0,.75,.2)', fill: 'forwards' },
    );
    state.timer = window.setTimeout(onTorn, 430);
  }

  function autoTear() {
    const state = live.current;
    const root = rootRef.current;
    if (state.done || state.tween || !root) return;
    sfx('pack.tear');
    if (reduced) {
      complete();
      return;
    }
    const rect = root.getBoundingClientRect();
    const from = state.progress;
    const duration = 80 + 340 * (1 - from);
    const start = performance.now();
    let lastShard = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const value = from + (1 - from) * k * k;
      setTear(value, state.dir);
      if (value - lastShard > 0.08) {
        lastShard = value;
        const x = state.dir > 0 ? rect.left + rect.width * value : rect.right - rect.width * value;
        director.shards(x, tearY(rect), 4);
      }
      if (k < 1) state.tween = requestAnimationFrame(step);
      else {
        state.tween = 0;
        complete();
      }
    };
    state.tween = requestAnimationFrame(step);
  }

  useImperativeHandle(ref, () => ({ open: autoTear }));

  const ceremony = useEffectEvent(() => {
    const state = live.current;
    if (!godPack) return () => window.clearTimeout(state.timer);
    sfx('pack.godPack');
    const motes = window.setInterval(() => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect && !state.done) {
        director.motes(
          rect.left + rect.width / 2,
          rect.bottom - rect.height * 0.15,
          rect.width,
          palette.sun,
          3,
        );
      }
    }, 240);
    return () => {
      window.clearInterval(motes);
      window.clearTimeout(state.timer);
    };
  });
  useEffect(() => ceremony(), []);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    const state = live.current;
    if (state.done || state.tween) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
      lastShard: event.clientX,
      near: (event.clientY - rect.top) / rect.height < 0.42,
      sounded: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const root = rootRef.current;
    const state = live.current;
    if (!drag || drag.id !== event.pointerId || state.done || !root) return;
    const dx = event.clientX - drag.x;
    if (!drag.near || Math.abs(dx) < 6) return;
    if (!drag.sounded) {
      drag.sounded = true;
      root.dataset.state = 'tearing';
      sfx('pack.tear', { volume: 0.85 });
    }
    const rect = root.getBoundingClientRect();
    const value = Math.max(state.progress, Math.min(1, Math.abs(dx) / (rect.width * TEAR_DONE)));
    setTear(value, dx > 0 ? 1 : -1);
    if (Math.abs(event.clientX - drag.lastShard) > 14) {
      drag.lastShard = event.clientX;
      director.shards(event.clientX, tearY(rect), 3);
    }
    if (value >= 1) {
      dragRef.current = null;
      complete();
    }
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || live.current.done) return;
    const moved = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
    if (moved < 10 && performance.now() - drag.t < 600) autoTear();
    else if (live.current.progress >= TEAR_DONE) autoTear();
  }

  return (
    <div
      ref={rootRef}
      className="ffo-pack"
      data-god={godPack}
      style={{ '--tear-y': TEAR_Y } as CSSProperties}
    >
      <div className="ffo-pack__aura" aria-hidden="true" />
      <div className="ffo-pack__float">
        <button
          type="button"
          className="ffo-pack__hit"
          aria-label={t('tearAria')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          // Keyboard activation only (detail 0); pointers are handled above.
          onClick={(event) => {
            if (event.detail === 0) autoTear();
          }}
        >
          <div ref={bodyRef} className="ffo-pack__layer" style={{ clipPath: clips.body }}>
            <ProductArtAdapter productId={productId} variant={variant} height="100%" />
            <div className="ffo-pack__sheen" />
          </div>
          <div
            ref={topRef}
            className="ffo-pack__layer ffo-pack__top"
            style={{ clipPath: clips.top }}
          >
            <ProductArtAdapter productId={productId} variant={variant} height="100%" />
          </div>
          <div className="ffo-pack__rip" aria-hidden="true" />
          <div className="ffo-pack__guide" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * An outer product opened with one gesture (docs/01 §14.2): the blister is peeled and a starter
 * deck's box flips open. The stage takes over once its little exit animation is done.
 */
export function SealedProduct({
  productId,
  label,
  reduced,
  director,
  onOpened,
  ref,
}: {
  productId: string;
  label: string;
  reduced: boolean;
  director: Director;
  onOpened(): void;
  ref?: Ref<OpenHandle>;
}) {
  const artRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  function open() {
    const art = artRef.current;
    if (doneRef.current) return;
    doneRef.current = true;
    sfx('pack.tear', { rate: 0.8 });
    if (reduced || !art) {
      onOpened();
      return;
    }
    const rect = art.getBoundingClientRect();
    director.shards(rect.left + rect.width / 2, rect.top + rect.height * 0.3, 30, rect.width * 0.8);
    art
      .animate(
        [
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(1.12) rotate(-4deg)', opacity: 1, offset: 0.35 },
          { transform: 'scale(.6) translateY(40%) rotate(8deg)', opacity: 0 },
        ],
        { duration: 520, easing: 'ease-in', fill: 'forwards' },
      )
      .finished.then(onOpened, () => {});
  }

  useImperativeHandle(ref, () => ({ open }));

  return (
    <button type="button" className="ffo-sealed" aria-label={label} onClick={open}>
      <div ref={artRef} className="ffo-sealed__art">
        <ProductArtAdapter productId={productId} height="calc(var(--pack-h) * 0.9)" />
      </div>
    </button>
  );
}

/** Booster box (docs/01 §14.2): Rip one by one, or Quick Rip with a highlights reel. */
export function BoxChoice({
  productId,
  packs,
  onPick,
}: {
  productId: string;
  packs: number;
  onPick(mode: 'oneByOne' | 'quickRip'): void;
}) {
  const { t } = useTranslation('opening');
  return (
    <div className="ffo-view">
      <div className="ffo-choice">
        <div className="ffo-sealed__art">
          <ProductArtAdapter productId={productId} height="calc(var(--pack-h) * 0.62)" />
        </div>
        <div className="ffo-choice__options">
          <p className="ffo-label">{t('box.inside', { count: packs })}</p>
          <button type="button" className="ffo-option" onClick={() => onPick('oneByOne')}>
            <span className="ffo-option__icon">
              <Hand aria-hidden="true" />
            </span>
            <span className="ffo-option__title">{t('box.oneByOne')}</span>
            <span className="ffo-option__hint">{t('box.oneByOneHint')}</span>
          </button>
          <button
            type="button"
            className="ffo-option ffo-option--quick"
            onClick={() => onPick('quickRip')}
          >
            <span className="ffo-option__icon">
              <Zap aria-hidden="true" />
            </span>
            <span className="ffo-option__title">{t('box.quickRip')}</span>
            <span className="ffo-option__hint">{t('box.quickRipHint', { count: packs })}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
