import { AnimatePresence, motion } from 'motion/react';
import { type ComponentType, lazy, Suspense, useEffect, useState } from 'react';
import { Link } from '@/app/router';
import { ProductArt } from '@/art/packs/ProductArt';
import { xpToNextLevel } from '@/content/balance/progression';
import { getRegistry } from '@/content/registry';
import { FixturePopover } from '@/game/popover/FixturePopover';
import type { SheetProps } from '@/game/sheets/types';
import type { Command } from '@/sim/commands';
import { useGameStore } from '@/state/gameStore';
import { type SheetId, useUiStore } from '@/state/uiStore';
import { ToastViewport } from '@/ui/components/Toasts';

// Debug page: exempt from i18n (CLAUDE.md, ADR-031).
//
// /debug/sheets?sheet=inventory|prices|crate|binder&popover=shelf-a|shelf-b|case-1|register
//   &level=2&cash=500&demo=1&view=art
// Starts a fresh game, optionally levels up, grants cash and plays a short "demo morning"
// (stocked shelves, an order on the way, a few binder pockets, singles in the case), then shows a
// mock play layout: a stand-in shop backdrop, a dock, the sheet host and the anchored popover.

const InventorySheet = lazy(() => import('@/game/sheets/InventorySheet'));
const PriceBoardSheet = lazy(() => import('@/game/sheets/PriceBoardSheet'));
const CrateSheet = lazy(() => import('@/game/sheets/CrateSheet'));
const BinderSheet = lazy(() => import('@/game/sheets/BinderSheet'));
const OpeningStage = lazy(() => import('@/game/opening/OpeningStage'));

const SHEETS: Record<Exclude<SheetId, 'settings'>, ComponentType<SheetProps>> = {
  inventory: InventorySheet,
  prices: PriceBoardSheet,
  crate: CrateSheet,
  binder: BinderSheet,
};

const DOCK: { id: Exclude<SheetId, 'settings'>; label: string; key: string }[] = [
  { id: 'inventory', label: 'Stock', key: 'I' },
  { id: 'prices', label: 'Prices', key: 'P' },
  { id: 'crate', label: 'Orders', key: 'O' },
  { id: 'binder', label: 'Binder', key: 'C' },
];

/** Where the fake fixtures sit on the stand-in backdrop (percent of the stage). */
const HOTSPOTS: { uid: string; label: string; x: number; y: number }[] = [
  { uid: 'shelf-a', label: 'Shelf A', x: 24, y: 30 },
  { uid: 'shelf-b', label: 'Shelf B', x: 42, y: 30 },
  { uid: 'case-1', label: 'Case', x: 30, y: 62 },
  { uid: 'register', label: 'Register', x: 62, y: 44 },
];

/** One setup per page load (StrictMode runs effects twice in development). */
let setUp = false;

function setupGame(params: URLSearchParams): void {
  if (setUp) return;
  setUp = true;
  const store = useGameStore.getState();
  store.startNewGame({ seed: 7, shopName: 'Foil & Fortune', difficulty: 'standard' });
  const run = (command: Command) => useGameStore.getState().dispatch(command);
  const level = Number(params.get('level') ?? 1);
  for (let guard = 0; guard < 60; guard++) {
    const game = useGameStore.getState().game;
    if (!game || game.progression.level >= level) break;
    run({
      type: 'debug/grantXp',
      amount: xpToNextLevel(game.progression.level) - game.progression.xp,
    });
  }
  const cash = Number(params.get('cash') ?? 0);
  if (cash > 0) run({ type: 'debug/grantCash', cents: Math.round(cash * 100) });
  if (params.get('demo') !== '1') return;

  run({
    type: 'stock/fillSlot',
    fixtureUid: 'shelf-a',
    slot: 0,
    productId: 'gk.emberdawn.booster',
  });
  run({
    type: 'stock/fillSlot',
    fixtureUid: 'shelf-a',
    slot: 1,
    productId: 'gk.emberdawn.blister',
    qty: 1,
  });
  run({
    type: 'stock/fillSlot',
    fixtureUid: 'shelf-a',
    slot: 2,
    productId: 'gk.emberdawn.starter-ember',
  });
  run({
    type: 'stock/fillSlot',
    fixtureUid: 'shelf-b',
    slot: 0,
    productId: 'gk.emberdawn.booster',
    qty: 3,
  });
  run({ type: 'pricing/setPrice', productId: 'gk.emberdawn.blister', cents: 1899 });
  run({ type: 'open/openProduct', productId: 'gk.emberdawn.booster' });
  run({ type: 'open/openProduct', productId: 'gk.emberdawn.booster' });
  run({
    type: 'suppliers/placeOrder',
    supplierId: 'sup.budget-box',
    lines: [
      { productId: 'gk.emberdawn.booster', qty: 12 },
      { productId: 'gk.emberdawn.starter-volt', qty: 2 },
    ],
  });
  const game = useGameStore.getState().game;
  if (!game) return;
  const keys = Object.entries(game.inventory.cardStacks)
    .sort(([, a], [, b]) => b - a)
    .map(([key]) => key);
  for (const key of keys.slice(0, 4)) run({ type: 'collection/addToBinder', cardKey: key });
  if (level >= 2) {
    const rare = Object.keys(game.inventory.cardStacks).filter((key) => !key.includes('|normal|'));
    rare.slice(0, 2).forEach((cardKey, slot) => {
      run({ type: 'stock/fillSlot', fixtureUid: 'case-1', slot, cardKey });
    });
  }
}

function ArtGallery() {
  const products = [...getRegistry().products.values()];
  return (
    <div className="h-full space-y-6 overflow-y-auto bg-paper p-6 text-ink">
      <Link to="/debug/sheets" className="font-display underline">
        ← back to the sheets
      </Link>
      {[240, 120, 48].map((size) => (
        <section key={size} className="space-y-3">
          <h2 className="font-display text-xl">{size} px</h2>
          <div className="flex flex-wrap items-end gap-6">
            {products.map((product) => (
              <ProductArt key={product.id} productId={product.id} height={size} />
            ))}
            {[1, 2, 3].map((variant) => (
              <ProductArt
                key={variant}
                productId="gk.emberdawn.booster"
                variant={variant}
                height={size}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-6 rounded-2xl bg-tablet p-4">
            {products.map((product) => (
              <ProductArt key={product.id} productId={product.id} height={size} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function SheetsPlayground() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [ready, setReady] = useState(false);
  const sheet = useUiStore((ui) => ui.sheet);
  const fixtureUid = useUiStore((ui) => ui.fixtureUid);
  const stage = useUiStore((ui) => ui.stage);

  useEffect(() => {
    if (!setUp) {
      setupGame(params);
      const ui = useUiStore.getState();
      ui.reset();
      const initialSheet = params.get('sheet');
      if (initialSheet && initialSheet in SHEETS) ui.openSheet(initialSheet as SheetId);
      const popover = params.get('popover');
      if (popover) ui.openFixture(popover);
    }
    setReady(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') useUiStore.getState().back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [params]);

  if (params.get('view') === 'art') return <ArtGallery />;
  const Sheet = sheet && sheet !== 'settings' ? SHEETS[sheet] : null;
  const close = () => useUiStore.getState().closeSheet();
  const hotspot = HOTSPOTS.find((spot) => spot.uid === fixtureUid);

  return (
    <div className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_45%_35%,var(--color-paper2),var(--color-wood)_55%,var(--color-night))] text-paper">
      {/* Stand-in shop: a tiled floor and clickable fixture hotspots. */}
      <div
        className="absolute inset-0 opacity-30 [background-image:linear-gradient(90deg,rgb(0_0_0/0.25)_2px,transparent_2px),linear-gradient(rgb(0_0_0/0.25)_2px,transparent_2px)] [background-size:64px_64px]"
        aria-hidden="true"
      />
      {HOTSPOTS.map((spot) => (
        <button
          key={spot.uid}
          type="button"
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-[3px] border-ink bg-woodDark/90 px-3 py-2 font-display text-sm shadow-[0_4px_0_var(--color-ink)]"
          style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          onClick={() => useUiStore.getState().openFixture(spot.uid)}
        >
          {spot.label}
        </button>
      ))}
      <div className="absolute top-2 left-2 z-10 flex gap-2 text-xs">
        <Link
          to="/debug"
          className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-bold text-ink"
        >
          ← Hub
        </Link>
        <a
          href="/debug/sheets?demo=1&level=2"
          className="rounded-lg border-2 border-ink bg-sun px-2 py-1 font-bold text-ink"
        >
          Demo Lv2
        </a>
        <a
          href="/debug/sheets?view=art"
          className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-bold text-ink"
        >
          Art
        </a>
      </div>

      {/* The anchored popover, as the live scene would place it above a fixture. */}
      {ready && fixtureUid ? (
        <div
          className="absolute z-20 -translate-x-1/2 max-[700px]:top-2! max-[700px]:left-1/2! [@media(max-height:500px)]:top-2!"
          style={{ left: `${hotspot?.x ?? 40}%`, top: `${(hotspot?.y ?? 40) - 26}%` }}
        >
          <FixturePopover
            fixtureUid={fixtureUid}
            onClose={() => useUiStore.getState().closeFixture()}
          />
        </div>
      ) : null}

      {/* Dock. */}
      <nav className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {DOCK.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => useUiStore.getState().toggleSheet(entry.id)}
            className={`h-12 rounded-2xl border-[3px] border-ink px-4 font-display text-ink shadow-[0_4px_0_var(--color-ink)] ${
              sheet === entry.id ? 'bg-sun' : 'bg-paper'
            }`}
          >
            {entry.label} <span className="text-xs opacity-60">{entry.key}</span>
          </button>
        ))}
      </nav>

      {/* Sheet host: right panel ≥ 900 px wide (60% / 480–720 px), full screen on phones; the binder
          is always full screen (docs/05 §9). */}
      <AnimatePresence>
        {ready && Sheet ? (
          <motion.div
            key={sheet}
            className={
              sheet === 'binder'
                ? 'absolute inset-0 z-30'
                : 'absolute inset-0 z-30 min-[900px]:inset-y-3 min-[900px]:right-3 min-[900px]:left-auto min-[900px]:w-[60%] min-[1280px]:w-[clamp(480px,46vw,720px)] [@media(max-height:500px)]:inset-0! [@media(max-height:500px)]:w-auto!'
            }
            initial={{ x: '105%' }}
            animate={{ x: 0 }}
            exit={{ x: '105%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <Suspense fallback={null}>
              <Sheet onClose={close} />
            </Suspense>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {stage ? (
        <div className="absolute inset-0 z-40">
          <Suspense fallback={null}>
            <OpeningStage
              opened={stage.opened}
              onClose={() => useUiStore.getState().closeStage()}
            />
          </Suspense>
        </div>
      ) : null}
      <ToastViewport />
    </div>
  );
}
