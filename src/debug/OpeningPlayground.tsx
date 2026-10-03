import { useEffect } from 'react';
import { getRegistry } from '@/content/registry';
import type { Rarity } from '@/content/schema/common';
import type { CardDef } from '@/content/schema/tcg';
import { openProductWithStage } from '@/game/actions';
import OpeningStage from '@/game/opening/OpeningStage';
import type { DomainEventOf, PulledCard } from '@/sim/events';
import { putSealed, sealedInStorage } from '@/sim/systems/inventory';
import { useGame, useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useUiStore } from '@/state/uiStore';
import { DebugShell } from './DebugShell';

// Debug page: exempt from i18n (CLAUDE.md, ADR-031).

type OpenedEvent = DomainEventOf<'product/opened'>;

const P = {
  booster: 'gk.emberdawn.booster',
  blister: 'gk.emberdawn.blister',
  ember: 'gk.emberdawn.starter-ember',
  volt: 'gk.emberdawn.starter-volt',
  box: 'gk.emberdawn.box',
} as const;

const SET = 'gk.emberdawn';

function cardsOf(...rarities: Rarity[]): CardDef[] {
  return [...getRegistry().cards.values()]
    .filter((card) => card.setId === SET && rarities.includes(card.rarity))
    .sort((a, b) => a.baseValueCents - b.baseValueCents);
}

const pulled = (card: CardDef, finish = card.finishes[0] ?? 'normal'): PulledCard => ({
  cardId: card.id,
  finish,
});

function event(cards: PulledCard[], extra: { godPack?: boolean } = {}): OpenedEvent {
  return {
    type: 'product/opened',
    productId: P.booster,
    packs: [{ productId: P.booster, kind: 'pack', cards, ...extra }],
    newCardIds: [...new Set(cards.map((card) => card.cardId))],
    costCents: 325,
  };
}

/** A plain pack's first nine slots: five commons, three uncommons and a reverse holo. */
function fillerSlots(): PulledCard[] {
  const commons = cardsOf('common');
  const uncommons = cardsOf('uncommon');
  const at = <T,>(items: T[], i: number) => items[i % Math.max(1, items.length)];
  const slots: PulledCard[] = [];
  for (let i = 0; i < 5; i++) {
    const card = at(commons, i * 2);
    if (card) slots.push(pulled(card, 'normal'));
  }
  for (let i = 0; i < 3; i++) {
    const card = at(uncommons, i * 2);
    if (card) slots.push(pulled(card, 'normal'));
  }
  const reverse = at(commons, 7);
  if (reverse) slots.push(pulled(reverse, 'reverseHolo'));
  return slots;
}

/** Synthetic examples: rare enough that a real seed won't show them on demand. */
const SYNTHETIC: Record<string, () => OpenedEvent> = {
  god: () => {
    // Every card Illustration Rare or better, best last (docs/01 §14.3).
    const pool = cardsOf('illustrationRare', 'secretRare', 'mythicRare');
    const picks = Array.from({ length: 10 }, (_, i) => pool[i % pool.length]).filter(
      (card): card is CardDef => card !== undefined,
    );
    picks.sort((a, b) => a.baseValueCents - b.baseValueCents);
    return event(
      picks.map((card) => pulled(card)),
      { godPack: true },
    );
  },
  mythic: () => {
    const [mythic] = cardsOf('mythicRare');
    return event([...fillerSlots(), ...(mythic ? [pulled(mythic)] : [])]);
  },
  misprint: () => {
    const [holo] = cardsOf('holoRare').slice(-1);
    const slots = fillerSlots();
    const first = slots[2];
    if (first) slots[2] = { ...first, misprint: 'miscut' };
    return event([...slots, ...(holo ? [pulled(holo)] : [])]);
  },
};

function ensureGame(seed: number, fresh = false) {
  const store = useGameStore.getState();
  if (!store.game || fresh) {
    store.startNewGame({ seed, shopName: 'Debug Nook', difficulty: 'standard' });
  }
}

function restock() {
  useGameStore.setState((store) => {
    const game = store.game;
    if (!game) return;
    for (const productId of Object.values(P)) putSealed(game, productId, 5, 300, game.clock.day);
  });
}

function launch(what: string) {
  const synthetic = SYNTHETIC[what];
  if (synthetic) {
    useUiStore.getState().openStage({ kind: 'opening', opened: synthetic() });
    return;
  }
  const productId = P[what as keyof typeof P];
  if (!productId) return;
  const game = useGameStore.getState().game;
  if (game && sealedInStorage(game, productId) < 1) restock();
  openProductWithStage(productId);
}

function Stock({ productId, label }: { productId: string; label: string }) {
  const qty = useGame((game) => sealedInStorage(game, productId), 0);
  return (
    <button
      type="button"
      className="rounded-xl border-[3px] border-ink bg-paper px-4 py-2 text-left font-display text-ink shadow-[0_3px_0_var(--color-ink)] active:translate-y-[3px] active:shadow-none"
      onClick={() => launch(Object.entries(P).find(([, id]) => id === productId)?.[0] ?? '')}
    >
      {label}
      <span className="block font-ui text-xs opacity-70">{qty} in storage · real sim</span>
    </button>
  );
}

/**
 * /debug/opening: launches every pack-opening flow with real `product/opened` events from the sim
 * (booster, blister, starter decks, booster box) plus synthetic god pack, Mythic and misprint
 * examples. `?open=booster|blister|ember|volt|box|god|mythic|misprint&seed=N` auto-launches.
 */
export default function OpeningPlayground() {
  const stage = useUiStore((ui) => ui.stage);
  const closeStage = useUiStore((ui) => ui.closeStage);
  const settings = useSettingsStore((store) => store.settings);
  const update = useSettingsStore((store) => store.update);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const seed = Number(params.get('seed') ?? 1234);
    ensureGame(Number.isFinite(seed) ? seed : 1234, params.has('seed'));
    const open = params.get('open');
    if (open && !useUiStore.getState().stage) launch(open);
  }, []);

  return (
    <DebugShell
      title="Pack Opening"
      subtitle="Every flow on the real stage. Tear, flip, celebrate; the sim already decided."
      tone="dark"
      actions={
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => update({ reducedMotion: e.target.checked })}
            />
            Reduced motion
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.screenShake}
              onChange={(e) => update({ screenShake: e.target.checked })}
            />
            Screen shake
          </label>
        </>
      }
    >
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-8">
        <section className="grid gap-3">
          <h2 className="font-display text-2xl">Real openings</h2>
          <div className="flex flex-wrap gap-3">
            <Stock productId={P.booster} label="Booster Pack" />
            <Stock productId={P.blister} label="3-Pack Blister" />
            <Stock productId={P.ember} label="Starter: Ember Blaze" />
            <Stock productId={P.volt} label="Starter: Volt Surge" />
            <Stock productId={P.box} label="Booster Box" />
          </div>
        </section>
        <section className="grid gap-3">
          <h2 className="font-display text-2xl">Synthetic examples</h2>
          <div className="flex flex-wrap gap-3">
            {[
              ['god', 'God pack'],
              ['mythic', 'Mythic Rare'],
              ['misprint', 'Misprint'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="rounded-xl border-[3px] border-ink bg-sun px-4 py-2 font-display text-ink shadow-[0_3px_0_var(--color-ink)] active:translate-y-[3px] active:shadow-none"
                onClick={() => launch(key ?? '')}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm opacity-70">
            Synthetic events aren't applied to the game, so "Add hits to binder" toasts a miss.
          </p>
        </section>
        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-xl border-[3px] border-ink bg-paper px-4 py-2 font-display text-ink"
            onClick={restock}
          >
            +5 of everything
          </button>
          <button
            type="button"
            className="rounded-xl border-[3px] border-ink bg-paper px-4 py-2 font-display text-ink"
            onClick={() => ensureGame(Math.floor(Math.random() * 1e9), true)}
          >
            New game (new seed: onboarding luck again)
          </button>
        </section>
      </div>
      {stage?.kind === 'opening' ? (
        <OpeningStage opened={stage.opened} onClose={closeStage} />
      ) : null}
    </DebugShell>
  );
}
