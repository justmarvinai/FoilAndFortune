// Debug page: exempt from i18n (CLAUDE.md rule 8, ADR-031).
import {
  Activity,
  Bell,
  DoorClosed,
  FastForward,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  SunMoon,
  UserPlus,
  X,
} from 'lucide-react';
import { lazy, type ReactNode, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { defaultBalance } from '@/content/balance';
import { xpToNextLevel } from '@/content/balance/progression';
import type { GameSpeed } from '@/content/balance/time';
import { getRegistry } from '@/content/registry';
import type { RenderInfo } from '@/scene/DioramaStage';
import type { QualityLevel } from '@/scene/quality';
import type { Command } from '@/sim/commands';
import type { DomainEvent } from '@/sim/events';
import { customerAtPaySpot, spawnCustomerNow } from '@/sim/systems/customers';
import { GameLoop } from '@/state/gameLoop';
import { useGame, useGameStore } from '@/state/gameStore';
import { publish } from '@/state/presentationBus';
import { DebugShell } from './DebugShell';

/**
 * /debug/live: the live, state-driven shop scene on a real game (Phase 2 scene work package).
 * Starts a game, stocks the shelves and the case, opens the shop and runs the GameLoop.
 *
 * URL: ?quality=low|medium|high &speed=0|1|2|4 &t=HH:MM (fast-forward, ringing everyone up)
 *      &crowd=N (spawn N customers now) &after=M (then run M minutes, nobody rung up: a line forms)
 *      &evening=auto|0…1 &anchor=<fixture uid> &stats=1
 *      &box=1 (keep Theo's booster box: it shows behind the counter) &seed=N &autoserve=1
 * Keys: Space pause · 1/2/3 speed · R ring up · C spawn a customer · X close the shop.
 */
const LiveShopScene = lazy(() => import('@/scene/live/LiveShopScene'));

const QUALITIES: readonly QualityLevel[] = ['low', 'medium', 'high'];
const SPEEDS: readonly GameSpeed[] = [1, 2, 4];
const ARCHETYPES = ['arch.kid', 'arch.casual'] as const;

interface Params {
  quality: QualityLevel;
  speed: GameSpeed;
  time: number | null;
  crowd: number;
  after: number;
  evening: number | null;
  anchor: string | null;
  stats: boolean;
  keepBox: boolean;
  seed: number;
  autoserve: boolean;
}

function readParams(): Params {
  const p = new URLSearchParams(window.location.search);
  const quality = p.get('quality');
  const speed = Number(p.get('speed') ?? 1);
  const [hh, mm] = (p.get('t') ?? '').split(':').map(Number);
  const evening = p.get('evening');
  return {
    quality: quality === 'low' || quality === 'high' ? quality : 'medium',
    speed: speed === 0 || speed === 2 || speed === 4 ? speed : 1,
    time:
      hh !== undefined && Number.isFinite(hh)
        ? hh * 60 + (Number.isFinite(mm) ? (mm ?? 0) : 0)
        : null,
    crowd: Math.max(0, Math.min(12, Number(p.get('crowd') ?? 0) || 0)),
    after: Math.max(0, Math.min(120, Number(p.get('after') ?? 0) || 0)),
    evening:
      evening && evening !== 'auto' && Number.isFinite(Number(evening)) ? Number(evening) : null,
    anchor: p.get('anchor'),
    stats: p.get('stats') === '1',
    keepBox: p.get('box') === '1',
    seed: Number(p.get('seed') ?? 7) || 7,
    autoserve: p.get('autoserve') === '1',
  };
}

function run(command: Command) {
  return useGameStore.getState().dispatch(command);
}

/** Debug "spawn a customer by archetype" (docs/06 §19), applied through the store. */
function spawnNow(archetypeId: string) {
  const events: DomainEvent[] = [];
  const ctx = {
    content: getRegistry(),
    balance: defaultBalance,
    emit: (e: DomainEvent) => events.push(e),
  };
  useGameStore.setState((store) => {
    if (store.game) spawnCustomerNow(store.game, ctx, archetypeId);
  });
  publish(events);
}

function ringUp() {
  return run({ type: 'customers/checkout' });
}

/**
 * Fast-forward to `minute`. With `serve`, whoever reaches the register is rung up (an attentive
 * owner); without, a line forms.
 */
function fastForward(minute: number, serve = true) {
  for (let guard = 0; guard < 24 * 60; guard++) {
    const game = useGameStore.getState().game;
    if (game?.clock.phase !== 'open' || game.clock.minute >= minute) break;
    useGameStore.getState().advance(1, 0);
    const now = useGameStore.getState().game;
    if (serve && now && customerAtPaySpot(now)) ringUp();
  }
}

/** One setup per page load (StrictMode runs effects twice in development). */
let setUp = false;

function setupGame(params: Params) {
  if (setUp) return;
  setUp = true;
  const store = useGameStore.getState();
  store.startNewGame({ seed: params.seed, shopName: 'The Nook', difficulty: 'standard' });
  // Level 2 unlocks the singles case (docs/02 §9.3).
  for (let guard = 0; guard < 10; guard++) {
    const game = useGameStore.getState().game;
    if (!game || game.progression.level >= 2) break;
    run({
      type: 'debug/grantXp',
      amount: xpToNextLevel(game.progression.level) - game.progression.xp,
    });
  }
  if (!params.keepBox) run({ type: 'open/unboxProduct', productId: 'gk.emberdawn.box' });
  const fills: [string, number, string][] = [
    ['shelf-a', 0, 'gk.emberdawn.booster'],
    ['shelf-a', 1, 'gk.emberdawn.booster'],
    ['shelf-a', 2, 'gk.emberdawn.blister'],
    ['shelf-a', 3, 'gk.emberdawn.starter-ember'],
    ['shelf-b', 0, 'gk.emberdawn.booster'],
    ['shelf-b', 1, 'gk.emberdawn.booster'],
    ['shelf-b', 2, 'gk.emberdawn.booster'],
    ['shelf-b', 3, 'gk.emberdawn.blister'],
  ];
  for (const [fixtureUid, slot, productId] of fills)
    run({ type: 'stock/fillSlot', fixtureUid, slot, productId });
  run({ type: 'stock/restockAll' });
  // The case: the shiniest singles in storage.
  const game = useGameStore.getState().game;
  if (game) {
    const rank = (key: string) =>
      key.includes('|holo|') ? 0 : key.includes('|reverseHolo|') ? 1 : 2;
    const keys = Object.keys(game.inventory.cardStacks).sort((a, b) => rank(a) - rank(b));
    keys.slice(0, 5).forEach((cardKey, slot) => {
      run({ type: 'stock/fillSlot', fixtureUid: 'case-1', slot, cardKey });
    });
  }
  run({ type: 'time/openShop' });
  run({ type: 'time/setSpeed', speed: params.speed === 0 ? 1 : params.speed });
  if (params.time !== null) fastForward(params.time);
  // A crowd arrives a minute and a half apart, so they spread over the shop.
  for (let i = 0; i < params.crowd; i++) {
    spawnNow(ARCHETYPES[i % ARCHETYPES.length] ?? 'arch.kid');
    if (params.after > 0 && i < params.crowd - 1) {
      fastForward((useGameStore.getState().game?.clock.minute ?? 0) + (i % 2 === 0 ? 1 : 2), false);
    }
  }
  const minute = useGameStore.getState().game?.clock.minute ?? 0;
  if (params.after > 0) fastForward(minute + params.after, false);
}

const COMPACT_QUERY = '(max-height: 500px)';
function subscribeCompact(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function Chunky({
  children,
  onClick,
  title,
  active = false,
  wide = false,
}: {
  children: ReactNode;
  onClick(): void;
  title: string;
  active?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-9 items-center justify-center gap-1 rounded-xl border-[3px] border-ink font-display text-sm tracking-wide text-ink shadow-[0_3px_0_var(--color-ink)] select-none active:translate-y-[3px] active:shadow-none ${wide ? 'px-2.5' : 'w-9'} ${active ? 'bg-sun' : 'bg-paper hover:bg-white'}`}
    >
      {children}
    </button>
  );
}

function Group({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-ink/40 p-1.5 backdrop-blur-sm">
      {children}
    </div>
  );
}

/** Stand-in for the Fixture Popover: shows the fixture's slots. */
function FakePopover({ uid, onClose }: { uid: string; onClose(): void }) {
  const fixture = useGame((game) => game.shop.fixtures.find((f) => f.uid === uid), undefined);
  return (
    <div className="pointer-events-auto w-[260px] rounded-2xl border-[3px] border-ink bg-paper p-3 text-ink shadow-[0_5px_0_var(--color-ink)]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg">{uid}</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-lg border-2 border-ink bg-white p-0.5"
        >
          <X className="size-4" />
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {(fixture?.slots ?? [])
          .map((slot, index) => ({ slot, index }))
          .map(({ slot, index }) => (
            <li
              key={index}
              className="flex justify-between gap-2 rounded-lg bg-paper2 px-2 py-1 font-mono text-xs"
            >
              <span className="truncate">
                {slot.productId ?? slot.cardKey?.split('|')[0] ?? 'empty'}
              </span>
              <span>× {slot.qty}</span>
            </li>
          ))}
        {fixture && fixture.slots.length === 0 ? <li className="text-ink/60">No slots</li> : null}
      </ul>
    </div>
  );
}

function clockText(minute: number) {
  const h = Math.floor(minute / 60);
  const m = Math.floor(minute % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function LiveScenePlayground() {
  const [params] = useState(readParams);
  const [quality, setQuality] = useState<QualityLevel>(params.quality);
  const [paused, setPaused] = useState(params.speed === 0);
  const [evening, setEvening] = useState<number | null>(params.evening);
  const [anchorUid, setAnchorUid] = useState<string | null>(params.anchor);
  const [stats, setStats] = useState(params.stats);
  const [info, setInfo] = useState<RenderInfo | null>(null);
  const [headerHeight, setHeaderHeight] = useState(64);
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  );
  const ready = useGame(() => true, false);
  const speed = useGame((game) => game.clock.speed, 1);
  const minute = useGame((game) => game.clock.minute, 0);
  const phase = useGame((game) => game.clock.phase, 'prep');
  const customers = useGame((game) => game.customers.active.length, 0);
  const cash = useGame((game) => game.finance.cashCents, 0);

  useEffect(() => {
    setupGame(params);
    const loop = new GameLoop({
      getGame: () => useGameStore.getState().game,
      advance: (ticks, realMs) => {
        useGameStore.getState().advance(ticks, realMs);
        const game = useGameStore.getState().game;
        if (params.autoserve && game && customerAtPaySpot(game)) ringUp();
      },
      isPaused: () => pausedRef.paused,
    });
    loop.start();
    return () => loop.stop();
  }, [params]);

  useEffect(() => {
    pausedRef.paused = paused;
  }, [paused]);

  // The header overlaps the fixed scene; frame the shop below it.
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const measure = () => setHeaderHeight(Math.round(header.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stats || !info) return;
    (globalThis as { __liveStats?: RenderInfo }).__liveStats = info;
  }, [stats, info]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const key = event.key.toLowerCase();
      if (key === ' ') {
        event.preventDefault();
        setPaused((p) => !p);
      } else if (key === '1' || key === '2' || key === '3') {
        run({ type: 'time/setSpeed', speed: SPEEDS[Number(key) - 1] ?? 1 });
        setPaused(false);
      } else if (key === 'r') ringUp();
      else if (key === 'x') run({ type: 'time/closeShop' });
      else if (key === 'c') spawnNow(ARCHETYPES[Math.floor(Math.random() * 2)] ?? 'arch.kid');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const insets = compact
    ? { top: headerHeight, right: 104, bottom: 0, left: 0 }
    : { top: headerHeight, right: 0, bottom: 64, left: 0 };

  return (
    <DebugShell
      title="Live Shop Scene"
      subtitle="The state-driven Nook: a real game, the GameLoop and the live diorama"
      tone="dark"
    >
      <div className="fixed inset-0 z-0">
        {ready ? (
          <Suspense fallback={null}>
            <LiveShopScene
              quality={quality}
              insets={insets}
              shopName="The Nook"
              anchored={
                anchorUid
                  ? {
                      fixtureUid: anchorUid,
                      content: <FakePopover uid={anchorUid} onClose={() => setAnchorUid(null)} />,
                    }
                  : null
              }
              onFixtureClick={(uid) => setAnchorUid(uid)}
              onRegisterClick={() => ringUp()}
              onCustomerClick={(uid) => {
                if (useGameStore.getState().game?.customers.lane[0] === uid)
                  run({ type: 'customers/checkout', uid });
              }}
              onBackgroundClick={() => setAnchorUid(null)}
              eveningOverride={evening}
              showStats={false}
              onRenderInfo={stats ? setInfo : undefined}
            />
          </Suspense>
        ) : null}
      </div>
      <div
        className={
          compact
            ? 'fixed right-1.5 bottom-1.5 z-10 flex w-[96px] flex-col gap-1.5 overflow-y-auto'
            : 'pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center p-2.5'
        }
        style={compact ? { top: headerHeight + 6 } : undefined}
      >
        <div
          className={
            compact
              ? 'flex flex-col gap-1.5'
              : 'pointer-events-auto flex flex-wrap items-center justify-center gap-2'
          }
        >
          <Group>
            <Chunky
              title={paused ? 'Resume (Space)' : 'Pause (Space)'}
              active={paused}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </Chunky>
            {SPEEDS.map((s, i) => (
              <Chunky
                key={s}
                wide
                title={`Speed ${s}× (${i + 1})`}
                active={!paused && speed === s}
                onClick={() => {
                  run({ type: 'time/setSpeed', speed: s });
                  setPaused(false);
                }}
              >
                {s}×
              </Chunky>
            ))}
          </Group>
          <Group>
            <Chunky
              title="Follow the sim clock"
              active={evening === null}
              onClick={() => setEvening(null)}
            >
              <SunMoon className="size-4" />
            </Chunky>
            <Chunky title="Day" active={evening === 0} onClick={() => setEvening(0)}>
              <Sun className="size-4" />
            </Chunky>
            <Chunky title="Evening" active={evening === 1} onClick={() => setEvening(1)}>
              <Moon className="size-4" />
            </Chunky>
          </Group>
          <Group>
            <Chunky title="Ring up (R)" wide onClick={() => ringUp()}>
              <Bell className="size-4" />
            </Chunky>
            <Chunky
              title="Spawn a customer (C)"
              wide
              onClick={() => spawnNow(ARCHETYPES[Math.floor(Math.random() * 2)] ?? 'arch.kid')}
            >
              <UserPlus className="size-4" />
            </Chunky>
            <Chunky title="Restock all" wide onClick={() => run({ type: 'stock/restockAll' })}>
              <RotateCcw className="size-4" />
            </Chunky>
            <Chunky title="Fast-forward 30 min" wide onClick={() => fastForward(minute + 30)}>
              <FastForward className="size-4" />
            </Chunky>
            <Chunky
              title={phase === 'open' ? 'Close the shop (X)' : 'Next day, open'}
              wide
              onClick={() => {
                if (phase === 'open') run({ type: 'time/closeShop' });
                else {
                  if (phase === 'night') run({ type: 'time/startNextDay' });
                  run({ type: 'time/openShop' });
                }
              }}
            >
              <DoorClosed className="size-4" />
            </Chunky>
          </Group>
          <Group>
            {QUALITIES.map((q) => (
              <Chunky
                key={q}
                wide
                title={`Quality: ${q}`}
                active={quality === q}
                onClick={() => setQuality(q)}
              >
                {q === 'medium' ? 'Med' : q === 'low' ? 'Low' : 'High'}
              </Chunky>
            ))}
            <Chunky title="Stats" active={stats} onClick={() => setStats((s) => !s)}>
              <Activity className="size-4" />
            </Chunky>
          </Group>
        </div>
      </div>
      <div
        className="pointer-events-none fixed left-3 z-10 rounded-xl border-[3px] border-ink bg-paper px-3 py-1.5 font-mono text-xs text-ink shadow-[0_3px_0_var(--color-ink)] [@media(max-height:500px)]:left-1.5 [@media(max-height:500px)]:px-2 [@media(max-height:500px)]:py-1"
        style={{ top: headerHeight + 8 }}
      >
        <div>
          {clockText(minute)} · {phase} · {customers} in · ${(cash / 100).toFixed(2)}
        </div>
        {stats && info ? (
          <div>
            {info.drawCalls} draws · {(info.triangles / 1000).toFixed(0)}k tris ·{' '}
            {info.frameMs.toFixed(1)} ms
          </div>
        ) : null}
      </div>
    </DebugShell>
  );
}

/** Shared with the GameLoop callback (a ref outside React: the loop is created once). */
const pausedRef = { paused: false };
