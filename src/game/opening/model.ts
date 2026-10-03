import { type BalanceConfig, defaultBalance } from '@/content/balance';
import { type ContentRegistry, getRegistry } from '@/content/registry';
import type { Finish, Rarity } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';
import type { Cents } from '@/core/money';
import type { DomainEventOf, PulledCard } from '@/sim/events';
import { type MisprintKind, pulledCardKey } from '@/sim/packs/misprints';
import { isHit, RARITY_LADDER, rarityRank } from '@/sim/packs/rarity';
import { itemMarketValue } from '@/sim/pricing';

/**
 * The pack-opening stage's pure core (docs/01 §14, docs/05 §5.7): turns a `product/opened` event
 * into reveal order, rarity hints and celebration tiers, the step machine (intro → tear → reveal
 * → next pack → summary), Skip to hits, the summary tally and the Quick Rip reel. The sim already
 * decided (and applied) every card; nothing here touches game state.
 */

export type OpenedEvent = DomainEventOf<'product/opened'>;

export interface StageContext {
  content: ContentRegistry;
  balance: Pick<BalanceConfig, 'cards'>;
}

export function defaultStageContext(): StageContext {
  return { content: getRegistry(), balance: defaultBalance };
}

// ---------------------------------------------------------------------------------------------
// Tiers: how loudly a reveal celebrates (docs/05 §6, docs/04 §9)
// ---------------------------------------------------------------------------------------------

export type Tier = 'none' | 'glint' | 'holo' | 'ultra' | 'illustration' | 'secret' | 'mythic';

const TIER_ORDER: readonly Tier[] = [
  'none',
  'glint',
  'holo',
  'ultra',
  'illustration',
  'secret',
  'mythic',
];

const TIER_OF: Record<Rarity, Tier> = {
  common: 'none',
  uncommon: 'none',
  rare: 'glint',
  holoRare: 'holo',
  ultraRare: 'ultra',
  illustrationRare: 'illustration',
  secretRare: 'secret',
  mythicRare: 'mythic',
  promo: 'holo',
};

export function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

/** Misprints carry big premiums (docs/01 §14.3), so they cheer at least like a holo. */
export function tierOf(rarity: Rarity, misprint?: MisprintKind): Tier {
  const tier = TIER_OF[rarity];
  return misprint && tierRank(tier) < tierRank('holo') ? 'holo' : tier;
}

export interface TierFx {
  /** Flip duration; Illustration Rare and up flip in slow motion. */
  flipMs: number;
  /** Celebration beat after landing during which taps are ignored. */
  holdMs: number;
  /** Light beams behind the card (count by rarity, docs/04 §9). */
  beams: number;
  /** Screen-shake strength 0–1 (big hits only, can be disabled). */
  shake: number;
  /** Spark particles in the burst. */
  sparks: number;
  slowMo: boolean;
}

/** Presentation timings (not economy tunables, so they live with the stage). */
export const TIER_FX: Record<Tier, TierFx> = {
  none: { flipMs: 220, holdMs: 0, beams: 0, shake: 0, sparks: 0, slowMo: false },
  glint: { flipMs: 420, holdMs: 140, beams: 0, shake: 0, sparks: 16, slowMo: false },
  holo: { flipMs: 520, holdMs: 520, beams: 6, shake: 0.35, sparks: 40, slowMo: false },
  ultra: { flipMs: 620, holdMs: 700, beams: 8, shake: 0.55, sparks: 60, slowMo: false },
  illustration: { flipMs: 1150, holdMs: 900, beams: 10, shake: 0.7, sparks: 80, slowMo: true },
  secret: { flipMs: 1250, holdMs: 1000, beams: 12, shake: 0.85, sparks: 100, slowMo: true },
  mythic: { flipMs: 1700, holdMs: 1500, beams: 16, shake: 1, sparks: 150, slowMo: true },
};

/** A featured card glows at least this long before it may flip (the rarity hint, docs/05 §5.7). */
export const GLOW_MIN_MS = 450;

/** Commons are quick, uncommons a touch slower (docs/01 §14.1). */
export function revealTiming(card: Pick<RevealCard, 'tier' | 'rarity' | 'finish'>): TierFx {
  const fx = TIER_FX[card.tier];
  if (card.tier !== 'none') return fx;
  const quick = card.rarity === 'common' && card.finish === 'normal';
  return { ...fx, flipMs: quick ? 220 : 300 };
}

// ---------------------------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------------------------

export interface RevealCard {
  /** Position in the whole opening (reveal order). */
  index: number;
  segment: number;
  /** Position inside its segment. */
  slot: number;
  cardId: string;
  def: CardDef;
  finish: Finish;
  misprint?: MisprintKind;
  cardKey: string;
  rarity: Rarity;
  valueCents: Cents;
  /** The first copy of a card the player had never owned (NEW badge). */
  isNew: boolean;
  /** Holo Rare or better (docs/02 §9.1). */
  hit: boolean;
  tier: Tier;
  /** Glows in its rarity color before the flip: the rare slot, every hit, promos, misprints. */
  featured: boolean;
}

export type SegmentKind = 'pack' | 'deck' | 'promo';

export interface RevealSegment {
  index: number;
  kind: SegmentKind;
  productId: string;
  godPack: boolean;
  /** Index of the segment's first card in `cards`. */
  first: number;
  count: number;
  /** 1-based among the opening's packs; 0 for promo and deck segments. */
  packNumber: number;
}

/**
 * - `booster`: one pack, straight to the tear.
 * - `multi`: a blister or bundle: open the outer product, promos, then each pack.
 * - `deck`: a starter deck: deal the list, then the guaranteed holo.
 * - `box`: 10+ packs: choose Rip one by one or Quick Rip (docs/01 §14.2).
 */
export type Presentation = 'booster' | 'multi' | 'deck' | 'box';

export interface OpeningModel {
  productId: string;
  presentation: Presentation;
  segments: RevealSegment[];
  cards: RevealCard[];
  /** `prefix[i]` = market value of `cards[0..i)` (value so far). */
  prefix: Cents[];
  totalCents: Cents;
  costCents: Cents | null;
  packCount: number;
  godPack: boolean;
}

/** From this many packs a product gets the box treatment (choice + Quick Rip). */
export const BOX_MIN_PACKS = 10;

export function isFeatured(card: Pick<RevealCard, 'hit' | 'rarity' | 'misprint'>): boolean {
  return card.hit || card.rarity === 'promo' || card.misprint !== undefined;
}

export function buildOpeningModel(opened: OpenedEvent, ctx: StageContext): OpeningModel {
  const unseen = new Set(opened.newCardIds);
  const segments: RevealSegment[] = [];
  const cards: RevealCard[] = [];
  let packNumber = 0;

  for (const pack of opened.packs) {
    const kind: SegmentKind = pack.kind ?? 'pack';
    const segment: RevealSegment = {
      index: segments.length,
      kind,
      productId: pack.productId,
      godPack: pack.godPack === true,
      first: cards.length,
      count: 0,
      packNumber: kind === 'pack' ? ++packNumber : 0,
    };
    const known = pack.cards.filter((pulled) => ctx.content.cards.has(pulled.cardId));
    known.forEach((pulled: PulledCard, slot) => {
      const def = ctx.content.cards.get(pulled.cardId);
      if (!def) return;
      const cardKey = pulledCardKey(pulled);
      const hit = isHit(def.rarity);
      // The rare slot (a pack's last card) and a deck's guaranteed holo always get the hint.
      const last = slot === known.length - 1 && kind !== 'promo';
      const card: RevealCard = {
        index: cards.length,
        segment: segment.index,
        slot,
        cardId: def.id,
        def,
        finish: pulled.finish,
        cardKey,
        rarity: def.rarity,
        valueCents: itemMarketValue(ctx, { cardKey }) ?? 0,
        isNew: unseen.delete(def.id),
        hit,
        tier: tierOf(def.rarity, pulled.misprint),
        featured: last || isFeatured({ hit, rarity: def.rarity, misprint: pulled.misprint }),
      };
      if (pulled.misprint) card.misprint = pulled.misprint;
      cards.push(card);
    });
    segment.count = cards.length - segment.first;
    if (segment.count > 0) segments.push(segment);
    else if (kind === 'pack') packNumber -= 1;
  }

  const prefix: Cents[] = [0];
  for (const card of cards) prefix.push((prefix[prefix.length - 1] ?? 0) + card.valueCents);
  const packCount = packNumber;
  const hasDeck = segments.some((segment) => segment.kind === 'deck');
  const presentation: Presentation =
    packCount >= BOX_MIN_PACKS
      ? 'box'
      : hasDeck
        ? 'deck'
        : segments.length > 1 || segments.some((segment) => segment.kind === 'promo')
          ? 'multi'
          : 'booster';

  return {
    productId: opened.productId,
    presentation,
    segments,
    cards,
    prefix,
    totalCents: prefix[prefix.length - 1] ?? 0,
    costCents: opened.costCents ?? null,
    packCount,
    godPack: segments.some((segment) => segment.godPack),
  };
}

// ---------------------------------------------------------------------------------------------
// The step machine
// ---------------------------------------------------------------------------------------------

export interface OpeningPrefs {
  /** Commons and uncommons flip on their own (docs/05 §5.7 "auto-open"). */
  autoReveal: boolean;
  /** Commons and uncommons go straight to the pile in one batch. */
  skipCommons: boolean;
}

export interface Progress {
  /** The outer product is open (blister peeled, box mode picked). */
  intro: boolean;
  /** The segment on the table. */
  segment: number;
  /** The segment is open: its pack torn or its deck dealt (promos need no opening). */
  opened: boolean;
  /** Cards revealed so far: always a prefix of the reveal order. */
  revealed: number;
  /** The card in the spotlight (the last single reveal), if any. */
  spot: number | null;
  summary: boolean;
}

export type StageAction =
  | { kind: 'none' }
  | { kind: 'intro' }
  /** Tear a pack or deal a deck. */
  | { kind: 'open'; segment: number }
  | { kind: 'reveal'; cards: number[]; batch: boolean }
  /** Bring the next segment onto the table. */
  | { kind: 'next'; segment: number }
  | { kind: 'summary' };

export function needsIntro(model: Pick<OpeningModel, 'presentation'>): boolean {
  return model.presentation === 'multi' || model.presentation === 'box';
}

function needsOpening(segment: RevealSegment | undefined): boolean {
  return segment?.kind === 'pack' || segment?.kind === 'deck';
}

export function initialProgress(model: OpeningModel): Progress {
  return {
    intro: !needsIntro(model),
    segment: 0,
    opened: !needsOpening(model.segments[0]),
    revealed: 0,
    spot: null,
    summary: model.cards.length === 0,
  };
}

/** Plain commons and uncommons: what "Skip commons" and "Auto-reveal commons" act on. */
export function isFiller(card: Pick<RevealCard, 'featured' | 'finish' | 'rarity'>): boolean {
  return (
    !card.featured &&
    card.finish === 'normal' &&
    (card.rarity === 'common' || card.rarity === 'uncommon')
  );
}

/** The run of consecutive filler cards starting at `from`, before `end`. */
export function fillerRun(model: OpeningModel, from: number, end: number): number[] {
  const run: number[] = [];
  for (let i = from; i < end; i++) {
    const card = model.cards[i];
    if (!card || !isFiller(card)) break;
    run.push(i);
  }
  return run;
}

/** What a tap, swipe, Space or Enter does next. */
export function nextAction(model: OpeningModel, p: Progress, prefs: OpeningPrefs): StageAction {
  if (p.summary) return { kind: 'none' };
  if (!p.intro) return { kind: 'intro' };
  const segment = model.segments[p.segment];
  if (!segment) return { kind: 'summary' };
  if (!p.opened) return { kind: 'open', segment: segment.index };
  const end = segment.first + segment.count;
  if (p.revealed < end) {
    if (prefs.skipCommons && segment.kind !== 'deck') {
      const run = fillerRun(model, p.revealed, end);
      if (run.length > 0) return { kind: 'reveal', cards: run, batch: true };
    }
    return { kind: 'reveal', cards: [p.revealed], batch: false };
  }
  const next = model.segments[p.segment + 1];
  return next ? { kind: 'next', segment: next.index } : { kind: 'summary' };
}

export function applyAction(model: OpeningModel, p: Progress, action: StageAction): Progress {
  switch (action.kind) {
    case 'none':
      return p;
    case 'intro':
      return { ...p, intro: true };
    case 'open': {
      const segment = model.segments[action.segment];
      if (!segment) return p;
      // Dealing a deck lays out its whole list; only the guaranteed holo stays face-down.
      const revealed =
        segment.kind === 'deck'
          ? Math.max(p.revealed, segment.first + segment.count - 1)
          : Math.max(p.revealed, segment.first);
      return { ...p, intro: true, segment: segment.index, opened: true, revealed, spot: null };
    }
    case 'reveal': {
      const last = action.cards[action.cards.length - 1];
      if (last === undefined) return p;
      return { ...p, revealed: Math.max(p.revealed, last + 1), spot: action.batch ? null : last };
    }
    case 'next': {
      const segment = model.segments[action.segment];
      if (!segment) return p;
      return {
        ...p,
        segment: segment.index,
        opened: !needsOpening(segment),
        revealed: Math.max(p.revealed, segment.first),
        spot: null,
      };
    }
    case 'summary':
      return {
        ...p,
        intro: true,
        opened: true,
        summary: true,
        revealed: model.cards.length,
        spot: null,
      };
  }
}

/** Steps whose card(s) "Auto-reveal commons" plays without a tap. */
export function isAutoStep(model: OpeningModel, action: StageAction, prefs: OpeningPrefs): boolean {
  if (!prefs.autoReveal || action.kind !== 'reveal') return false;
  return action.cards.every((index) => {
    const card = model.cards[index];
    return card !== undefined && isFiller(card);
  });
}

/**
 * Skip to hits ⏭: everything before the next unrevealed hit is revealed at once and that hit
 * waits face-down (glowing) on top of its pack's stack. With no hits left, straight to the summary.
 */
export function skipToHits(model: OpeningModel, p: Progress): Progress {
  if (p.summary) return p;
  const hit = model.cards.find((card) => card.index >= p.revealed && card.hit);
  if (!hit) return applyAction(model, p, { kind: 'summary' });
  return {
    intro: true,
    segment: hit.segment,
    opened: true,
    revealed: hit.index,
    spot: null,
    summary: false,
  };
}

export function sameProgress(a: Progress, b: Progress): boolean {
  return (
    a.intro === b.intro &&
    a.segment === b.segment &&
    a.opened === b.opened &&
    a.revealed === b.revealed &&
    a.spot === b.spot &&
    a.summary === b.summary
  );
}

/** Hits still face-down (closing early asks first; the sim already booked them). */
export function unrevealedHits(model: OpeningModel, p: Progress): number {
  if (p.summary) return 0;
  let count = 0;
  for (const card of model.cards) if (card.index >= p.revealed && card.hit) count += 1;
  return count;
}

// ---------------------------------------------------------------------------------------------
// Summary (docs/01 §14.1 "total market value versus what the pack cost")
// ---------------------------------------------------------------------------------------------

export type Verdict = 'jackpot' | 'profit' | 'even' | 'ouch';

/** Within ±5% of the cost reads as "break even"; 4× the cost or more is a jackpot. */
export const VERDICT_EVEN_BAND = 0.05;
export const VERDICT_JACKPOT_RATIO = 4;

export function verdictFor(totalCents: Cents, costCents: Cents | null): Verdict | null {
  if (costCents === null) return null;
  if (costCents <= 0) return totalCents > 0 ? 'profit' : 'even';
  const ratio = totalCents / costCents;
  if (ratio >= VERDICT_JACKPOT_RATIO) return 'jackpot';
  if (ratio > 1 + VERDICT_EVEN_BAND) return 'profit';
  if (ratio >= 1 - VERDICT_EVEN_BAND) return 'even';
  return 'ouch';
}

export interface SummaryTotals {
  totalCents: Cents;
  costCents: Cents | null;
  /** Value minus cost (null without a cost). */
  deltaCents: Cents | null;
  verdict: Verdict | null;
  cards: number;
  hits: number;
  newCards: number;
}

export function summaryTotals(model: OpeningModel): SummaryTotals {
  let hits = 0;
  let newCards = 0;
  for (const card of model.cards) {
    if (card.hit) hits += 1;
    if (card.isNew) newCards += 1;
  }
  return {
    totalCents: model.totalCents,
    costCents: model.costCents,
    deltaCents: model.costCents === null ? null : model.totalCents - model.costCents,
    verdict: verdictFor(model.totalCents, model.costCents),
    cards: model.cards.length,
    hits,
    newCards,
  };
}

/** Best first: value, then rarity, then reveal order. */
export function compareByValue(a: RevealCard, b: RevealCard): number {
  return (
    b.valueCents - a.valueCents || rarityRank(b.rarity) - rarityRank(a.rarity) || a.index - b.index
  );
}

export interface PullGroup {
  /** The print's stack key. */
  key: string;
  /** Its first copy in reveal order. */
  card: RevealCard;
  count: number;
  isNew: boolean;
}

/** Identical prints grouped (×N), best first. */
export function groupPulls(cards: readonly RevealCard[]): PullGroup[] {
  const groups = new Map<string, PullGroup>();
  for (const card of cards) {
    const group = groups.get(card.cardKey);
    if (group) {
      group.count += 1;
      group.isNew ||= card.isNew;
    } else {
      groups.set(card.cardKey, { key: card.cardKey, card, count: 1, isNew: card.isNew });
    }
  }
  return [...groups.values()].sort((a, b) => compareByValue(a.card, b.card));
}

export function bestPull(cards: readonly RevealCard[]): RevealCard | null {
  let best: RevealCard | null = null;
  for (const card of cards) if (!best || compareByValue(card, best) < 0) best = card;
  return best;
}

/** Hit counts from Mythic down, zero counts left out (the box summary). */
export function hitCountsByRarity(
  cards: readonly RevealCard[],
): { rarity: Rarity; count: number }[] {
  const counts = new Map<Rarity, number>();
  for (const card of cards)
    if (card.hit) counts.set(card.rarity, (counts.get(card.rarity) ?? 0) + 1);
  return [...RARITY_LADDER]
    .reverse()
    .filter((rarity) => counts.has(rarity))
    .map((rarity) => ({ rarity, count: counts.get(rarity) ?? 0 }));
}

/** Every Holo Rare and better from `from` on, in reveal order (the Quick Rip reel). */
export function boxHighlights(model: OpeningModel, from = 0): RevealCard[] {
  return model.cards.filter((card) => card.hit && card.index >= from);
}

/**
 * "Add hits to binder": the best copy of each hit card, unless its binder pocket already holds a
 * copy worth as much. Stack keys in order of first appearance.
 */
export function binderPlan(
  model: OpeningModel,
  binder: Readonly<Record<string, { cardKey: string }>>,
  valueOfKey: (cardKey: string) => Cents,
): string[] {
  const best = new Map<string, RevealCard>();
  for (const card of model.cards) {
    if (!card.hit) continue;
    const current = best.get(card.cardId);
    if (!current || card.valueCents > current.valueCents) best.set(card.cardId, card);
  }
  const keys: string[] = [];
  for (const card of best.values()) {
    const pocket = binder[card.cardId];
    if (
      pocket &&
      (pocket.cardKey === card.cardKey || valueOfKey(pocket.cardKey) >= card.valueCents)
    )
      continue;
    keys.push(card.cardKey);
  }
  return keys;
}

export type DeckSectionKind = CardDef['kind'];

export interface DeckSection {
  kind: DeckSectionKind;
  count: number;
  groups: PullGroup[];
}

const DECK_ORDER: readonly DeckSectionKind[] = ['creature', 'tactic', 'essence'];

/** A deck list grouped like a printed decklist: creatures, tactics, essences, by card number. */
export function deckSections(cards: readonly RevealCard[]): DeckSection[] {
  const sections: DeckSection[] = [];
  for (const kind of DECK_ORDER) {
    const inKind = cards.filter((card) => card.def.kind === kind);
    if (inKind.length === 0) continue;
    const groups = new Map<string, PullGroup>();
    for (const card of inKind) {
      const group = groups.get(card.cardKey);
      if (group) {
        group.count += 1;
        group.isNew ||= card.isNew;
      } else groups.set(card.cardKey, { key: card.cardKey, card, count: 1, isNew: card.isNew });
    }
    sections.push({
      kind,
      count: inKind.length,
      groups: [...groups.values()].sort(
        (a, b) => a.card.def.number - b.card.def.number || a.card.index - b.card.index,
      ),
    });
  }
  return sections;
}

// ---------------------------------------------------------------------------------------------
// Quick Rip (docs/01 §14.2: all packs in about 10 seconds, with a highlights reel)
// ---------------------------------------------------------------------------------------------

export const QUICK_RIP = {
  targetMs: 10_000,
  leadMs: 350,
  tailMs: 450,
  minPackMs: 100,
  maxPackMs: 260,
  /** Hits may take up to this share of the target; longer reels scale their beats down. */
  hitShare: 0.6,
  minHoldMs: 320,
} as const;

const HIT_HOLD_MS: Record<Tier, number> = {
  none: 0,
  glint: 0,
  holo: 520,
  ultra: 720,
  illustration: 950,
  secret: 1100,
  mythic: 1800,
};

export type ReelEvent =
  | { kind: 'pack'; atMs: number; segment: number; packNumber: number }
  | { kind: 'hit'; atMs: number; card: number; holdMs: number };

export interface ReelPlan {
  events: ReelEvent[];
  totalMs: number;
  packs: number;
}

/** The reel from card `from` on: one beat per pack, a held beat per hit. */
export function quickRipPlan(model: OpeningModel, from = 0): ReelPlan {
  const packs = model.segments.filter(
    (segment) => segment.kind === 'pack' && segment.first + segment.count > from,
  );
  const included = new Set(packs.map((segment) => segment.index));
  const hits = model.cards.filter(
    (card) => card.hit && card.index >= from && included.has(card.segment),
  );
  let holds = hits.map((card) => HIT_HOLD_MS[card.tier]);
  const budget = QUICK_RIP.targetMs * QUICK_RIP.hitShare;
  const wanted = holds.reduce((sum, hold) => sum + hold, 0);
  if (wanted > budget) {
    const k = budget / wanted;
    holds = holds.map((hold) => Math.max(QUICK_RIP.minHoldMs, Math.round(hold * k)));
  }
  const holdTotal = holds.reduce((sum, hold) => sum + hold, 0);
  const free = QUICK_RIP.targetMs - QUICK_RIP.leadMs - QUICK_RIP.tailMs - holdTotal;
  const packMs =
    packs.length > 0
      ? Math.min(QUICK_RIP.maxPackMs, Math.max(QUICK_RIP.minPackMs, free / packs.length))
      : 0;

  const events: ReelEvent[] = [];
  let t = QUICK_RIP.leadMs;
  let h = 0;
  for (const segment of packs) {
    events.push({
      kind: 'pack',
      atMs: Math.round(t),
      segment: segment.index,
      packNumber: segment.packNumber,
    });
    t += packMs;
    while (h < hits.length && hits[h]?.segment === segment.index) {
      const card = hits[h];
      const holdMs = holds[h] ?? QUICK_RIP.minHoldMs;
      if (card) events.push({ kind: 'hit', atMs: Math.round(t), card: card.index, holdMs });
      t += holdMs;
      h += 1;
    }
  }
  return { events, totalMs: Math.round(t + QUICK_RIP.tailMs), packs: packs.length };
}
