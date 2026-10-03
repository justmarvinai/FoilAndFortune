import { describe, expect, it } from 'vitest';
import type { Command } from '@/sim/commands';
import { runCommand } from '@/sim/engine';
import type { DomainEvent, PackResult } from '@/sim/events';
import { pulledCardKey } from '@/sim/packs/misprints';
import { alphaCards, idsOf, P, packTestContext, packTestGame } from '@/sim/packs/testing';
import { itemMarketValue } from '@/sim/pricing';
import { FIRST_BOX_FLAG, FIRST_PACK_FLAG } from '@/sim/systems/opening';
import { flipKeyframes, shakeKeyframes, TEAR_Y, tearClipPaths, tearLine } from './fxMath';
import {
  applyAction,
  bestPull,
  binderPlan,
  boxHighlights,
  buildOpeningModel,
  deckSections,
  groupPulls,
  hitCountsByRarity,
  initialProgress,
  isAutoStep,
  isFiller,
  nextAction,
  type OpenedEvent,
  type OpeningModel,
  type OpeningPrefs,
  type Progress,
  QUICK_RIP,
  quickRipPlan,
  revealTiming,
  sameProgress,
  skipToHits,
  summaryTotals,
  tierOf,
  unrevealedHits,
  verdictFor,
} from './model';
import { DEFAULT_PREFS, parsePrefs } from './prefs';

const ctx = packTestContext();
const plain: OpeningPrefs = { autoReveal: false, skipCommons: false };

function openReal(productId: string, seed = 1234): OpenedEvent {
  const game = packTestGame(ctx, seed);
  game.progression.flags[FIRST_PACK_FLAG] = true;
  game.progression.flags[FIRST_BOX_FLAG] = true;
  const command: Command = { type: 'open/openProduct', productId };
  const { events, result } = runCommand(game, command, ctx);
  expect(result.ok).toBe(true);
  const opened = events.find(
    (event: DomainEvent): event is OpenedEvent => event.type === 'product/opened',
  );
  if (!opened) throw new Error('no product/opened');
  return opened;
}

const ids = (rarity: Parameters<typeof idsOf>[1]) => idsOf(alphaCards, rarity);

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('empty');
  return item;
}

/** A hand-made booster: 5 commons, 3 uncommons, a reverse holo, then `rare` in the rare slot. */
function syntheticPack(rareSlot: string, extra: Partial<PackResult> = {}): PackResult {
  const commons = ids('common');
  const uncommons = ids('uncommon');
  return {
    productId: P.booster,
    kind: 'pack',
    cards: [
      ...commons.slice(0, 5).map((cardId) => ({ cardId, finish: 'normal' as const })),
      ...uncommons.slice(0, 3).map((cardId) => ({ cardId, finish: 'normal' as const })),
      { cardId: first(commons), finish: 'reverseHolo' },
      { cardId: rareSlot, finish: 'holo' },
    ],
    ...extra,
  };
}

function event(packs: PackResult[], rest: Partial<OpenedEvent> = {}): OpenedEvent {
  return { type: 'product/opened', productId: P.booster, packs, newCardIds: [], ...rest };
}

/** Plays the step machine to the end, returning every action taken. */
function playThrough(model: OpeningModel, prefs: OpeningPrefs = plain) {
  let p = initialProgress(model);
  const actions = [];
  for (let guard = 0; guard < 2000 && !p.summary; guard++) {
    const action = nextAction(model, p, prefs);
    actions.push(action);
    p = applyAction(model, p, action);
  }
  return { actions, progress: p };
}

describe('buildOpeningModel', () => {
  it('turns a booster into one pack segment with values, NEW badges and the rare-slot hint', () => {
    const opened = openReal(P.booster);
    const model = buildOpeningModel(opened, ctx);
    expect(model.presentation).toBe('booster');
    expect(model.segments).toEqual([
      expect.objectContaining({ kind: 'pack', first: 0, count: 10, packNumber: 1 }),
    ]);
    expect(model.costCents).toBe(opened.costCents);
    const pulled = first(opened.packs).cards;
    model.cards.forEach((card, i) => {
      const source = pulled[i];
      expect(card.cardId).toBe(source?.cardId);
      expect(card.valueCents).toBe(
        itemMarketValue(ctx, { cardKey: pulledCardKey(source ?? card) }) ?? 0,
      );
      expect(model.prefix[i + 1]).toBe((model.prefix[i] ?? 0) + card.valueCents);
    });
    expect(model.totalCents).toBe(model.prefix[10]);
    expect(model.cards.at(-1)?.featured).toBe(true);
    // NEW marks only the first copy of each never-owned card.
    const newCopies = model.cards.filter((card) => card.isNew).map((card) => card.cardId);
    expect(newCopies).toEqual(opened.newCardIds);
  });

  it('reads blisters as multi (promo first), decks as deck and 36 packs as a box', () => {
    const blister = buildOpeningModel(openReal(P.blister), ctx);
    expect(blister.presentation).toBe('multi');
    expect(blister.segments.map((s) => [s.kind, s.packNumber])).toEqual([
      ['promo', 0],
      ['pack', 1],
      ['pack', 2],
      ['pack', 3],
    ]);
    expect(blister.cards[0]?.featured).toBe(true);

    const deck = buildOpeningModel(openReal(P.starter), ctx);
    expect(deck.presentation).toBe('deck');
    expect(deck.cards.at(-1)).toMatchObject({ rarity: 'holoRare', featured: true, hit: true });

    const box = buildOpeningModel(openReal(P.box), ctx);
    expect(box.presentation).toBe('box');
    expect(box.packCount).toBe(36);
    expect(box.cards).toHaveLength(360);
  });

  it('skips unknown cards and empty segments', () => {
    const model = buildOpeningModel(
      event([
        { productId: P.booster, kind: 'pack', cards: [{ cardId: 'nope', finish: 'normal' }] },
        syntheticPack(first(ids('holoRare'))),
      ]),
      ctx,
    );
    expect(model.segments).toHaveLength(1);
    expect(model.segments[0]).toMatchObject({ index: 0, first: 0, count: 10, packNumber: 1 });
  });
});

describe('tiers and timing', () => {
  it('maps rarities to celebration tiers; misprints cheer at least like a holo', () => {
    expect(tierOf('common')).toBe('none');
    expect(tierOf('rare')).toBe('glint');
    expect(tierOf('holoRare')).toBe('holo');
    expect(tierOf('illustrationRare')).toBe('illustration');
    expect(tierOf('mythicRare')).toBe('mythic');
    expect(tierOf('common', 'miscut')).toBe('holo');
    expect(tierOf('secretRare', 'miscut')).toBe('secret');
  });

  it('flips commons fastest, uncommons slower, and big hits in slow motion', () => {
    const common = revealTiming({ tier: 'none', rarity: 'common', finish: 'normal' });
    const uncommon = revealTiming({ tier: 'none', rarity: 'uncommon', finish: 'normal' });
    const rare = revealTiming({ tier: 'glint', rarity: 'rare', finish: 'normal' });
    const holo = revealTiming({ tier: 'holo', rarity: 'holoRare', finish: 'holo' });
    const ir = revealTiming({ tier: 'illustration', rarity: 'illustrationRare', finish: 'gold' });
    const mythic = revealTiming({ tier: 'mythic', rarity: 'mythicRare', finish: 'cosmos' });
    expect(common.flipMs).toBeLessThan(uncommon.flipMs);
    expect(uncommon.flipMs).toBeLessThan(rare.flipMs);
    expect(rare.flipMs).toBeLessThan(holo.flipMs);
    expect(holo.slowMo).toBe(false);
    expect(ir.slowMo && mythic.slowMo).toBe(true);
    expect(mythic.holdMs).toBeGreaterThan(ir.holdMs);
    expect(mythic.beams).toBeGreaterThan(holo.beams);
  });
});

describe('the step machine', () => {
  it('walks a booster: tear, ten single reveals, summary', () => {
    const model = buildOpeningModel(openReal(P.booster), ctx);
    const { actions, progress } = playThrough(model);
    expect(actions.map((a) => a.kind)).toEqual([
      'open',
      ...Array.from({ length: 10 }, () => 'reveal'),
      'summary',
    ]);
    expect(progress).toMatchObject({ summary: true, revealed: 10, spot: null });
  });

  it('puts the revealed card in the spotlight and keeps reveals a prefix', () => {
    const model = buildOpeningModel(openReal(P.booster), ctx);
    let p = applyAction(model, initialProgress(model), { kind: 'open', segment: 0 });
    p = applyAction(model, p, nextAction(model, p, plain));
    expect(p).toMatchObject({ revealed: 1, spot: 0 });
    p = applyAction(model, p, nextAction(model, p, plain));
    expect(p).toMatchObject({ revealed: 2, spot: 1 });
  });

  it('batches plain commons and uncommons with Skip commons, never deck cards', () => {
    const model = buildOpeningModel(event([syntheticPack(first(ids('holoRare')))]), ctx);
    expect(model.cards.filter(isFiller)).toHaveLength(8);
    const { actions } = playThrough(model, { autoReveal: false, skipCommons: true });
    expect(actions).toEqual([
      { kind: 'open', segment: 0 },
      { kind: 'reveal', cards: [0, 1, 2, 3, 4, 5, 6, 7], batch: true },
      { kind: 'reveal', cards: [8], batch: false },
      { kind: 'reveal', cards: [9], batch: false },
      { kind: 'summary' },
    ]);
    const deck = buildOpeningModel(openReal(P.starter), ctx);
    const deckActions = playThrough(deck, { autoReveal: false, skipCommons: true }).actions;
    expect(deckActions.some((a) => a.kind === 'reveal' && a.batch)).toBe(false);
  });

  it('auto-reveals only filler steps', () => {
    const model = buildOpeningModel(event([syntheticPack(first(ids('holoRare')))]), ctx);
    const auto = { autoReveal: true, skipCommons: false };
    expect(isAutoStep(model, { kind: 'reveal', cards: [0], batch: false }, auto)).toBe(true);
    expect(isAutoStep(model, { kind: 'reveal', cards: [8], batch: false }, auto)).toBe(false);
    expect(isAutoStep(model, { kind: 'reveal', cards: [9], batch: false }, auto)).toBe(false);
    expect(isAutoStep(model, { kind: 'reveal', cards: [0], batch: false }, plain)).toBe(false);
    expect(isAutoStep(model, { kind: 'open', segment: 0 }, auto)).toBe(false);
  });

  it('walks a blister: peel, promo, then three packs, then one summary', () => {
    const model = buildOpeningModel(openReal(P.blister), ctx);
    expect(initialProgress(model)).toMatchObject({ intro: false, opened: true });
    const kinds = playThrough(model).actions.map((a) => a.kind);
    expect(kinds[0]).toBe('intro');
    expect(kinds[1]).toBe('reveal');
    expect(kinds.filter((k) => k === 'open')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'next')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'reveal')).toHaveLength(31);
    expect(kinds.at(-1)).toBe('summary');
  });

  it('deals a deck in one go, then reveals the guaranteed holo last', () => {
    const model = buildOpeningModel(openReal(P.starter), ctx);
    const { actions } = playThrough(model);
    const last = model.cards.length - 1;
    expect(actions).toEqual([
      { kind: 'open', segment: 0 },
      { kind: 'reveal', cards: [last], batch: false },
      { kind: 'summary' },
    ]);
  });

  it('skips to the next face-down hit, then to the summary when none are left', () => {
    const holo = first(ids('holoRare'));
    const model = buildOpeningModel(
      event([syntheticPack(ids('rare')[0] ?? holo), syntheticPack(holo), syntheticPack(holo)]),
      ctx,
    );
    let p = initialProgress(model);
    expect(unrevealedHits(model, p)).toBe(2);
    p = skipToHits(model, p);
    expect(p).toEqual({
      intro: true,
      segment: 1,
      opened: true,
      revealed: 19,
      spot: null,
      summary: false,
    } satisfies Progress);
    expect(sameProgress(skipToHits(model, p), p)).toBe(true);
    p = applyAction(model, p, nextAction(model, p, plain));
    expect(p).toMatchObject({ revealed: 20, spot: 19 });
    expect(unrevealedHits(model, p)).toBe(1);
    p = skipToHits(model, p);
    expect(p).toMatchObject({ segment: 2, revealed: 29 });
    p = skipToHits(model, applyAction(model, p, nextAction(model, p, plain)));
    expect(p).toMatchObject({ summary: true, revealed: 30 });
    expect(unrevealedHits(model, p)).toBe(0);
  });
});

describe('summary', () => {
  it('judges value against cost', () => {
    expect(verdictFor(500, null)).toBeNull();
    expect(verdictFor(2000, 325)).toBe('jackpot');
    expect(verdictFor(400, 325)).toBe('profit');
    expect(verdictFor(330, 325)).toBe('even');
    expect(verdictFor(310, 325)).toBe('even');
    expect(verdictFor(200, 325)).toBe('ouch');
    expect(verdictFor(10, 0)).toBe('profit');
  });

  it('tallies totals, hits and new cards', () => {
    const opened = openReal(P.blister);
    const model = buildOpeningModel(opened, ctx);
    const totals = summaryTotals(model);
    expect(totals).toMatchObject({
      totalCents: model.totalCents,
      costCents: opened.costCents,
      deltaCents: model.totalCents - (opened.costCents ?? 0),
      cards: 31,
      newCards: opened.newCardIds.length,
      hits: model.cards.filter((card) => card.hit).length,
    });
  });

  it('groups identical prints best first and finds the best pull', () => {
    const model = buildOpeningModel(openReal(P.box), ctx);
    const groups = groupPulls(model.cards);
    expect(groups.reduce((sum, group) => sum + group.count, 0)).toBe(360);
    expect(new Set(groups.map((group) => group.key)).size).toBe(groups.length);
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i - 1]?.card.valueCents).toBeGreaterThanOrEqual(
        groups[i]?.card.valueCents ?? 0,
      );
    }
    expect(bestPull(model.cards)?.cardKey).toBe(groups[0]?.key);
    expect(bestPull([])).toBeNull();

    const counts = hitCountsByRarity(model.cards);
    expect(counts.reduce((sum, row) => sum + row.count, 0)).toBe(boxHighlights(model).length);
    expect(counts.map((row) => row.rarity)).toEqual(
      ['mythicRare', 'secretRare', 'illustrationRare', 'ultraRare', 'holoRare'].filter((r) =>
        counts.some((row) => row.rarity === r),
      ),
    );
  });

  it('plans the binder: best copy per hit card, unless the pocket already holds as good', () => {
    const [a, b, c] = ids('holoRare');
    if (!a || !b || !c) throw new Error('test content');
    const pack = syntheticPack(a);
    const model = buildOpeningModel(
      event([
        pack,
        syntheticPack(b),
        { ...syntheticPack(c), cards: [{ cardId: c, finish: 'holo' }] },
      ]),
      ctx,
    );
    const value = (key: string) => itemMarketValue(ctx, { cardKey: key }) ?? 0;
    const keyOf = (cardId: string) => pulledCardKey({ cardId, finish: 'holo' });
    expect(binderPlan(model, {}, value)).toEqual([keyOf(a), keyOf(b), keyOf(c)]);
    const binder = {
      [a]: { cardKey: keyOf(a) },
      [b]: { cardKey: pulledCardKey({ cardId: b, finish: 'holo', misprint: 'miscut' }) },
      [c]: { cardKey: pulledCardKey({ cardId: c, finish: 'normal' }) },
    };
    // a: same print already in · b: a pricier misprint is in · c: the pocket's copy is worth less.
    expect(
      binderPlan(model, binder, (key) => (key.includes('normal') ? 0 : value(key) * 3)),
    ).toEqual([keyOf(c)]);
  });

  it('lays a deck out by section and card number', () => {
    const model = buildOpeningModel(openReal(P.starter), ctx);
    const sections = deckSections(model.cards.slice(0, -1));
    expect(sections.reduce((sum, s) => sum + s.count, 0)).toBe(model.cards.length - 1);
    expect(sections.map((s) => s.kind)).toEqual(['tactic', 'essence']);
    for (const section of sections) {
      const numbers = section.groups.map((group) => group.card.def.number);
      expect([...numbers].sort((x, y) => x - y)).toEqual(numbers);
    }
  });
});

describe('quickRipPlan', () => {
  it('rips a 36-pack box in about ten seconds with a beat per hit', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const model = buildOpeningModel(openReal(P.box, seed), ctx);
      const plan = quickRipPlan(model);
      expect(plan.packs).toBe(36);
      expect(plan.totalMs).toBeGreaterThan(8_000);
      expect(plan.totalMs).toBeLessThan(13_500);
      const times = plan.events.map((e) => e.atMs);
      expect([...times].sort((x, y) => x - y)).toEqual(times);
      expect(plan.events.filter((e) => e.kind === 'pack')).toHaveLength(36);
      const hits = plan.events.flatMap((e) => (e.kind === 'hit' ? [e.card] : []));
      expect(hits).toEqual(boxHighlights(model).map((card) => card.index));
      for (const e of plan.events)
        if (e.kind === 'hit') expect(e.holdMs).toBeGreaterThanOrEqual(QUICK_RIP.minHoldMs);
    }
  });

  it('can start mid-box (Quick Rip the rest)', () => {
    const model = buildOpeningModel(openReal(P.box), ctx);
    const plan = quickRipPlan(model, 105);
    expect(plan.packs).toBe(26);
    expect(plan.events[0]).toMatchObject({ kind: 'pack', packNumber: 11 });
    expect(quickRipPlan(model, 360)).toMatchObject({ events: [], packs: 0 });
  });
});

describe('fx math', () => {
  it('tears along one shared jagged line just under the crimp', () => {
    const line = tearLine();
    expect(line[0]?.[0]).toBe(0);
    expect(line.at(-1)?.[0]).toBe(1);
    for (const [, y] of line) expect(Math.abs(y - TEAR_Y)).toBeLessThan(0.03);
    const { top, body } = tearClipPaths(line);
    const middle = line
      .slice(1, -1)
      .map(([x, y]) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`);
    for (const point of middle) {
      expect(top).toContain(point);
      expect(body).toContain(point);
    }
    expect(tearLine()).toEqual(line);
  });

  it('shakes in proportion and settles at rest', () => {
    const frames = shakeKeyframes(1);
    expect(frames.at(-1)?.transform).toBe('translate(0.0px, 0.0px) rotate(0.00deg)');
    expect(shakeKeyframes(0).every((f) => !/[1-9]/.test(String(f.transform)))).toBe(true);
    expect(shakeKeyframes(2)).toEqual(shakeKeyframes(1));
  });

  it('flips from the stack to an upright card', () => {
    for (const slow of [false, true]) {
      const frames = flipKeyframes({ dx: 200, dy: 40, scale: 0.6 }, slow);
      expect(frames[0]?.transform).toContain('rotateY(180deg)');
      expect(frames.at(-1)?.transform).toBe('translate(0.0px, 0.0px) scale(1.000) rotateY(0deg)');
    }
  });
});

describe('prefs', () => {
  it('parses stored toggles defensively', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{nope')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('42')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"skipCommons":true,"autoReveal":"yes"}')).toEqual({
      autoReveal: false,
      skipCommons: true,
    });
  });
});
