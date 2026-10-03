import { Layers, SkipForward, WandSparkles, X, Zap } from 'lucide-react';
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/core/money';
import { Button } from '@/ui/components/Button';
import { Pips, ValueTicker } from './bits';
import { createDirector, rarityGlow } from './fx';
import {
  applyAction,
  buildOpeningModel,
  defaultStageContext,
  GLOW_MIN_MS,
  initialProgress,
  isAutoStep,
  isFiller,
  nextAction,
  type OpenedEvent,
  type Progress,
  type PullGroup,
  type RevealCard,
  revealTiming,
  type StageAction,
  type StageContext,
  sameProgress,
  skipToHits,
  TIER_FX,
  unrevealedHits,
} from './model';
import { useOpeningPrefs } from './prefs';
import { QuickRipReel } from './QuickRipReel';
import { CardZoom, SummaryView } from './SummaryView';
import { BoxChoice, type OpenHandle, PackTear, SealedProduct } from './sealed';
import { duckForReveal, HAPTICS, haptic, sfx, stingerFor } from './stageAudio';
import { DEAL_STAGGER_MS, DeckTable, RevealTable } from './table';
import { useStageMotion } from './useStageMotion';

/** Pause between auto-revealed commons. */
const AUTO_DELAY_MS = 380;

type BoxMode = 'choice' | 'oneByOne' | 'quickRip';

export interface StageViewProps {
  opened: OpenedEvent;
  onClose(): void;
  /** Content and balance; the app's own by default (the playground injects its own). */
  ctx?: StageContext;
}

/**
 * The pack-opening stage (docs/05 §5.7, docs/01 §14): a dark stage with a spotlight where the
 * player tears, flips and celebrates a result the sim already decided. The step machine lives in
 * `model.ts`; this component runs the show: timing, sounds, FX, the chrome and the controls.
 */
export function StageView({ opened, onClose, ctx: given }: StageViewProps) {
  const { t } = useTranslation(['opening', 'cards']);
  const titleId = useId();
  const [ctx] = useState(() => given ?? defaultStageContext());
  const [model] = useState(() => buildOpeningModel(opened, ctx));
  const [director] = useState(createDirector);
  const { reduced } = useStageMotion();
  const prefs = useOpeningPrefs((store) => store.prefs);
  const updatePrefs = useOpeningPrefs((store) => store.update);

  const [progress, setProgress] = useState(() => initialProgress(model));
  const [landed, setLanded] = useState(0);
  const [boxMode, setBoxMode] = useState<BoxMode>(
    model.presentation === 'box' ? 'choice' : 'oneByOne',
  );
  const [reelFrom, setReelFrom] = useState(0);
  const [batch, setBatch] = useState<number[] | null>(null);
  const [batchNote, setBatchNote] = useState<{ key: number; count: number; cents: number } | null>(
    null,
  );
  const [dim, setDim] = useState(false);
  const [stamp, setStamp] = useState<{ kind: 'mythic' | 'godPack'; key: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [inspect, setInspect] = useState<PullGroup | null>(null);
  const [announce, setAnnounce] = useState('');

  const progressRef = useRef(progress);
  const landedRef = useRef(0);
  const busyRef = useRef(false);
  const queuedRef = useRef(false);
  const overlayRef = useRef(false);
  const glowSinceRef = useRef(0);
  const autoRef = useRef(0);
  const timersRef = useRef(new Set<number>());
  const openRef = useRef<OpenHandle | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ x: number; y: number; id: number } | null>(null);

  // ---- bookkeeping -------------------------------------------------------------------------

  function commit(next: Progress) {
    progressRef.current = next;
    setProgress(next);
  }

  function land(count: number) {
    landedRef.current = Math.max(landedRef.current, count);
    setLanded(landedRef.current);
  }

  function later(run: () => void, ms: number) {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      run();
    }, ms);
    timersRef.current.add(id);
  }

  function clearTimers() {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current.clear();
    window.clearTimeout(autoRef.current);
  }

  const prefsNow = () => useOpeningPrefs.getState().prefs;

  // ---- the show ----------------------------------------------------------------------------

  function showStamp(kind: 'mythic' | 'godPack') {
    setStamp({ kind, key: performance.now() });
    sfx('ui.stamp');
  }

  /** Sounds, particles, shake and flash for a card that just landed face-up (docs/05 §6). */
  function celebrate(card: RevealCard, element: HTMLElement) {
    const fx = TIER_FX[card.tier];
    const stinger = stingerFor(card.tier);
    if (stinger) sfx(stinger);
    else if (card.finish !== 'normal') sfx('pack.shimmer', { volume: 0.6 });
    if (card.isNew) sfx('pack.newCard', { volume: card.hit ? 0.6 : 0.8 });
    const { x, y } = director.centerOf(element);
    if (fx.sparks > 0) {
      director.sparks(x, y, rarityGlow(card.rarity), fx.sparks, card.tier === 'mythic' ? 1.5 : 1);
    }
    director.shake(fx.shake);
    if (card.hit) haptic(card.tier === 'mythic' ? HAPTICS.mythic : HAPTICS.hit);
    if (card.tier === 'mythic') {
      director.flash();
      director.starRain(3200);
      showStamp('mythic');
    }
    const segment = model.segments[card.segment];
    if (segment?.godPack && card.index === segment.first + segment.count - 1) {
      sfx('pack.godPack');
      director.flash(0.6);
      director.starRain(4000);
      showStamp('godPack');
    }
    const rarity = t(`rarity.${card.rarity}`, { ns: 'cards' });
    setAnnounce(
      t(card.isNew ? 'announceNew' : 'announce', {
        name: card.def.name,
        rarity,
        value: formatMoney(card.valueCents),
      }),
    );
  }

  /** Auto-reveal commons: schedule the next filler step on its own. */
  function afterStep() {
    const p = progressRef.current;
    const action = nextAction(model, p, prefsNow());
    if (!isAutoStep(model, action, prefsNow())) return;
    window.clearTimeout(autoRef.current);
    autoRef.current = window.setTimeout(() => {
      if (busyRef.current || overlayRef.current || !sameProgress(progressRef.current, p)) return;
      const next = nextAction(model, progressRef.current, prefsNow());
      if (isAutoStep(model, next, prefsNow())) perform(next);
    }, AUTO_DELAY_MS);
  }

  function release() {
    busyRef.current = false;
    if (queuedRef.current) {
      queuedRef.current = false;
      primary();
    } else afterStep();
  }

  function onLanded(card: RevealCard, element: HTMLElement) {
    if (landedRef.current > card.index) return;
    land(card.index + 1);
    setDim(false);
    celebrate(card, element);
    const hold = revealTiming(card).holdMs;
    later(release, reduced ? Math.min(hold, 250) : hold);
  }

  function reveal(action: Extract<StageAction, { kind: 'reveal' }>) {
    const p = progressRef.current;
    const first = action.cards[0];
    const last = action.cards[action.cards.length - 1];
    if (first === undefined || last === undefined) return;
    busyRef.current = true;
    if (action.batch) {
      setBatch(action.cards);
      commit(applyAction(model, p, action));
      sfx('pack.slide');
      sfx('pack.snap', { volume: 0.6, delay: 0.35 });
      setBatchNote({
        key: last,
        count: action.cards.length,
        cents: (model.prefix[last + 1] ?? 0) - (model.prefix[first] ?? 0),
      });
      const ms = reduced ? 120 : Math.min(6, action.cards.length) * DEAL_STAGGER_MS + 440;
      later(() => {
        land(last + 1);
        release();
      }, ms);
      return;
    }
    const card = model.cards[first];
    if (!card) return;
    setBatch(null);
    const go = () => {
      if (revealTiming(card).slowMo) {
        if (!reduced) setDim(true);
        duckForReveal();
      }
      sfx('pack.flip', { rate: card.tier !== 'none' ? 0.85 : card.rarity === 'common' ? 1.15 : 1 });
      commit(applyAction(model, progressRef.current, action));
    };
    // The rarity hint gets its moment before a special card may flip.
    const wait =
      card.featured && !reduced ? GLOW_MIN_MS - (performance.now() - glowSinceRef.current) : 0;
    if (wait > 0) later(go, wait);
    else go();
  }

  function toSummary() {
    clearTimers();
    busyRef.current = false;
    queuedRef.current = false;
    setDim(false);
    setBatch(null);
    commit(applyAction(model, progressRef.current, { kind: 'summary' }));
    land(model.cards.length);
    sfx('ui.receipt');
  }

  function perform(action: StageAction) {
    switch (action.kind) {
      case 'none':
        return;
      case 'intro':
      case 'open':
        openRef.current?.open();
        return;
      case 'reveal':
        reveal(action);
        return;
      case 'next':
        sfx('pack.slide');
        setBatch(null);
        commit(applyAction(model, progressRef.current, action));
        return;
      case 'summary':
        toSummary();
        return;
    }
  }

  /** Tap, swipe, Space, Enter or → : whatever comes next. */
  function primary() {
    if (overlayRef.current) return;
    if (busyRef.current) {
      // A tap during a plain flip finishes it and queues the next one.
      if (director.hurry()) queuedRef.current = true;
      return;
    }
    const p = progressRef.current;
    if (boxMode === 'quickRip' || (model.presentation === 'box' && !p.intro)) return;
    perform(nextAction(model, p, prefsNow()));
  }

  function skip() {
    if (boxMode === 'quickRip') {
      toSummary();
      return;
    }
    director.hurry();
    clearTimers();
    busyRef.current = false;
    queuedRef.current = false;
    setDim(false);
    setBatch(null);
    const target = skipToHits(model, progressRef.current);
    if (target.summary) {
      toSummary();
      return;
    }
    commit(target);
    land(target.revealed);
    if (model.presentation === 'box') setBoxMode('oneByOne');
    sfx('ui.tab');
  }

  function ripRest() {
    clearTimers();
    director.hurry();
    busyRef.current = false;
    setDim(false);
    setReelFrom(progressRef.current.revealed);
    setBoxMode('quickRip');
    sfx('ui.pop');
  }

  function pickBoxMode(mode: 'oneByOne' | 'quickRip') {
    sfx('ui.pop');
    commit(applyAction(model, progressRef.current, { kind: 'intro' }));
    setReelFrom(0);
    setBoxMode(mode);
  }

  function close() {
    clearTimers();
    sfx('ui.close');
    onClose();
  }

  function requestClose() {
    const p = progressRef.current;
    const left = unrevealedHits(model, { ...p, revealed: Math.max(p.revealed, landedRef.current) });
    if (left > 0) setConfirming(true);
    else close();
  }

  function onTorn() {
    sfx('pack.slide');
    const p = progressRef.current;
    commit(applyAction(model, p, { kind: 'open', segment: p.segment }));
    rootRef.current?.focus({ preventScroll: true });
    later(afterStep, 520);
  }

  function onIntroDone() {
    commit(applyAction(model, progressRef.current, { kind: 'intro' }));
    rootRef.current?.focus({ preventScroll: true });
  }

  function onDeckOpened() {
    const p = progressRef.current;
    commit(applyAction(model, p, { kind: 'open', segment: p.segment }));
    rootRef.current?.focus({ preventScroll: true });
  }

  function onDealt() {
    const segment = model.segments[progressRef.current.segment];
    if (segment) land(segment.first + segment.count - 1);
  }

  function toggleAuto() {
    const autoReveal = !prefsNow().autoReveal;
    updatePrefs({ autoReveal });
    sfx('ui.tab');
    if (autoReveal && !busyRef.current) afterStep();
  }

  function toggleSkipCommons() {
    updatePrefs({ skipCommons: !prefsNow().skipCommons });
    sfx('ui.tab');
  }

  // ---- input ---------------------------------------------------------------------------------

  // Esc skips the shell's "close the stage" (docs/05 §2): dialogs first, then a confirm if hits
  // are still face-down. Space, Enter and → advance unless a control has focus.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (inspect) setInspect(null);
      else if (confirming) setConfirming(false);
      else requestClose();
      return;
    }
    if (inspect || confirming) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('button, a, input, select, textarea')) return;
    if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) primary();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, []);

  const attach = useEffectEvent(() => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const flash = flashRef.current;
    if (!canvas || !camera || !flash) return undefined;
    const detach = director.attach({ canvas, camera, flash });
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      detach();
      clearTimers();
    };
  });
  useEffect(() => attach(), []);

  // Dialogs pause auto-reveal and take focus.
  useEffect(() => {
    overlayRef.current = confirming || inspect !== null;
    if (confirming) confirmRef.current?.querySelector('button')?.focus();
  }, [confirming, inspect]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target : null;
    pointerRef.current = target?.closest('button, a, .ffo-summary')
      ? null
      : { x: event.clientX, y: event.clientY, id: event.pointerId };
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const start = pointerRef.current;
    pointerRef.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const tap = Math.hypot(dx, dy) < 12;
    const swipe = Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy);
    if (tap || swipe) primary();
  }

  // ---- what's on the table -------------------------------------------------------------------

  const segment = model.segments[progress.segment];
  const segmentEnd = segment ? segment.first + segment.count : 0;
  const onTable =
    !progress.summary &&
    progress.intro &&
    progress.opened &&
    segment !== undefined &&
    boxMode !== 'quickRip';
  const top =
    onTable && progress.revealed < segmentEnd && landed >= progress.revealed
      ? model.cards[progress.revealed]
      : undefined;

  const glowStart = useEffectEvent((card: RevealCard) => {
    glowSinceRef.current = performance.now();
    if (card.featured) sfx('pack.glow');
  });
  const topIndex = top?.index ?? null;
  useEffect(() => {
    const card = topIndex === null ? undefined : model.cards[topIndex];
    if (card) glowStart(card);
  }, [topIndex, model]);

  const product = ctx.content.products.get(model.productId);
  const set = product?.setId ? ctx.content.sets.get(product.setId) : undefined;
  const hitsLeft = unrevealedHits(model, progress);
  const choosing = model.presentation === 'box' && boxMode === 'choice' && !progress.summary;
  const reeling = boxMode === 'quickRip' && !progress.summary;

  let view: ReactNode = null;
  let hint: string | null = null;
  if (progress.summary) {
    view = (
      <SummaryView
        model={model}
        ctx={ctx}
        reduced={reduced}
        onInspect={setInspect}
        onDone={close}
      />
    );
  } else if (choosing) {
    view = <BoxChoice productId={model.productId} packs={model.packCount} onPick={pickBoxMode} />;
  } else if (reeling) {
    view = (
      <QuickRipReel
        key={reelFrom}
        model={model}
        from={reelFrom}
        reduced={reduced}
        director={director}
        onProgress={land}
        onLanded={celebrate}
        onDone={toSummary}
      />
    );
  } else if (!progress.intro) {
    view = (
      <div className="ffo-view">
        <SealedProduct
          key="intro"
          ref={openRef}
          productId={model.productId}
          label={t('peelAria')}
          reduced={reduced}
          director={director}
          onOpened={onIntroDone}
        />
      </div>
    );
    hint = t('hint.peel');
  } else if (segment && !progress.opened) {
    if (segment.kind === 'deck') {
      view = (
        <div className="ffo-view">
          <SealedProduct
            key={`deck-${segment.index}`}
            ref={openRef}
            productId={segment.productId}
            label={t('dealAria')}
            reduced={reduced}
            director={director}
            onOpened={onDeckOpened}
          />
        </div>
      );
      hint = t('hint.deal');
    } else {
      view = (
        <div className="ffo-view">
          <PackTear
            key={segment.index}
            ref={openRef}
            productId={segment.productId}
            variant={Math.max(0, segment.packNumber - 1)}
            godPack={segment.godPack}
            reduced={reduced}
            director={director}
            onTorn={onTorn}
          />
        </div>
      );
      hint = t(segment.godPack ? 'hint.godPack' : 'hint.tear');
    }
  } else if (segment?.kind === 'deck') {
    const final = segmentEnd - 1;
    view = (
      <DeckTable
        key={segment.index}
        model={model}
        segment={segment}
        progress={progress}
        landed={landed}
        batch={null}
        reduced={reduced}
        director={director}
        onLanded={onLanded}
        onDealt={onDealt}
      />
    );
    if (progress.revealed <= final) hint = landed >= final ? t('hint.deckHolo') : null;
    else if (landed > final) hint = t('hint.summary');
  } else if (segment) {
    view = (
      <RevealTable
        key={segment.index}
        model={model}
        segment={segment}
        progress={progress}
        landed={landed}
        batch={batch}
        reduced={reduced}
        director={director}
        onLanded={onLanded}
      />
    );
    if (progress.revealed < segmentEnd) {
      if (top?.featured) hint = t('hint.featured');
      else if (top && prefs.autoReveal && isFiller(top)) hint = t('hint.auto');
      else hint = t('hint.reveal');
    } else if (landed >= segmentEnd) {
      hint = model.segments[segment.index + 1] ? t('hint.nextPack') : t('hint.summary');
    }
  }

  const subtitle =
    reeling || choosing
      ? null
      : segment?.kind === 'pack' && model.packCount > 1
        ? t('packOf', { n: segment.packNumber, total: model.packCount })
        : segment?.kind === 'promo'
          ? t('promoTitle')
          : null;
  const showChrome = !progress.summary && !choosing;
  const pipsLeft = segment ? segmentEnd - Math.max(progress.revealed, segment.first) : 0;

  return (
    <div
      ref={rootRef}
      className="ffo-stage"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-reduced={reduced}
      data-dim={dim}
    >
      <div className="ffo-backdrop" aria-hidden="true">
        <div className="ffo-stars hub-stars" />
        <div className="ffo-dimmer" />
      </div>
      <div ref={cameraRef} className="ffo-camera">
        <header className="ffo-top">
          <div className="ffo-title" id={titleId}>
            <span className="ffo-title__set">{set?.name ?? product?.name ?? ''}</span>
            <span className="ffo-title__kind">
              {product ? t(`kind.${product.kind}`) : ''}
              {subtitle ? ` · ${subtitle}` : ''}
            </span>
          </div>
          <div className="ffo-top__actions flex items-center gap-2">
            {model.presentation === 'box' && boxMode === 'oneByOne' && !progress.summary ? (
              <button type="button" className="ffo-chip" onClick={ripRest}>
                <Zap aria-hidden="true" />
                <span className="ffo-toggle__label">{t('box.ripRest')}</span>
              </button>
            ) : null}
            {showChrome ? (
              <button type="button" className="ffo-chip ffo-chip--sun" onClick={skip}>
                <span>
                  {reeling ? t('reel.skip') : hitsLeft > 0 ? t('skipToHits') : t('skipToEnd')}
                </span>
                <SkipForward aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="ffo-chip ffo-chip--icon"
              aria-label={t('close')}
              title={t('close')}
              onClick={requestClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="ffo-main" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          {view}
          {batchNote ? (
            <span key={batchNote.key} className="ffo-batch-note">
              {t('batch', { count: batchNote.count, value: formatMoney(batchNote.cents) })}
            </span>
          ) : null}
          {hint && showChrome && !reeling ? (
            <p key={hint} className="ffo-hint">
              {hint}
            </p>
          ) : null}
        </main>

        {showChrome ? (
          <footer className="ffo-bottom">
            <div className="ffo-value">
              <span className="ffo-label">{t('valueSoFar')}</span>
              <ValueTicker cents={model.prefix[landed] ?? model.totalCents} reduced={reduced} />
            </div>
            <div className="ffo-bottom__right">
              {!reeling && segment?.kind !== 'deck' ? (
                <>
                  <button
                    type="button"
                    className="ffo-chip ffo-toggle"
                    aria-pressed={prefs.autoReveal}
                    title={t('toggles.autoReveal')}
                    onClick={toggleAuto}
                  >
                    <WandSparkles aria-hidden="true" />
                    <span className="ffo-toggle__label">{t('toggles.autoReveal')}</span>
                  </button>
                  <button
                    type="button"
                    className="ffo-chip ffo-toggle"
                    aria-pressed={prefs.skipCommons}
                    title={t('toggles.skipCommons')}
                    onClick={toggleSkipCommons}
                  >
                    <Layers aria-hidden="true" />
                    <span className="ffo-toggle__label">{t('toggles.skipCommons')}</span>
                  </button>
                </>
              ) : null}
              {segment && !reeling ? (
                <Pips
                  total={segment.count}
                  left={pipsLeft}
                  hintRarity={top?.featured && pipsLeft === 1 ? top.rarity : null}
                />
              ) : null}
            </div>
          </footer>
        ) : null}
      </div>

      <canvas ref={canvasRef} className="ffo-fx" />
      <div ref={flashRef} className="ffo-flash" aria-hidden="true" />

      {stamp ? (
        <div className="ffo-crown" aria-hidden="true">
          <div key={stamp.key} className="ffo-crown__stamp" onAnimationEnd={() => setStamp(null)}>
            <span>♛</span>
            {t(stamp.kind === 'mythic' ? 'stamp.mythic' : 'stamp.godPack')}
          </div>
        </div>
      ) : null}

      {confirming ? (
        <div
          ref={confirmRef}
          className="ffo-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`${titleId}-confirm`}
        >
          <div className="ffo-dialog">
            <h2 id={`${titleId}-confirm`} className="font-display text-2xl tracking-wide">
              {t('confirm.title')}
            </h2>
            <p className="mt-2">{t('confirm.body', { count: hitsLeft })}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                {t('confirm.stay')}
              </Button>
              <Button variant="danger" onClick={close}>
                {t('confirm.leave')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {inspect ? (
        <CardZoom group={inspect} reduced={reduced} onClose={() => setInspect(null)} />
      ) : null}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
