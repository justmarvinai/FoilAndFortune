// Debug page: exempt from i18n (CLAUDE.md).
import { Activity, Moon, RotateCcw, RotateCw, Smile, Sun, ZoomIn, ZoomOut } from 'lucide-react';
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { DebugShell } from '@/debug/DebugShell';
import { EXPRESSIONS, type Expression } from './agents/faces';
import { ZOOM_MAX, ZOOM_MIN } from './camera/CameraRig';
import { angleIndex } from './camera/cameraMath';
import type { TimeOfDay } from './lighting/presets';
import type { QualityLevel } from './quality';
import { type RenderInfo, ShopDiorama } from './ShopDiorama';

/**
 * /debug/scene: the 3D shop-diorama art spike (Q1). Full-viewport diorama with a chunky control
 * panel. State mirrors the URL so any view can be linked or screenshotted:
 *   ?time=evening&angle=2&quality=high&expr=happy&zoom=1.6&stats=1
 * QA helpers: phase=<script phase, e.g. bin|shelf|checkout|paid> and/or t=<extra seconds>,
 * freeze=1 (hold the customer there), follow=customer|owner.
 * Keys: Q/E rotate · N day/evening · X face · 1/2/3 quality · +/- zoom · S stats.
 */
type ExpressionChoice = Expression | 'auto';
const EXPRESSION_CYCLE: readonly ExpressionChoice[] = ['auto', ...EXPRESSIONS];
const QUALITIES: readonly QualityLevel[] = ['low', 'medium', 'high'];
const ZOOM_STEPS = [1, 1.45, 2.1] as const;

interface PlaygroundState {
  time: TimeOfDay;
  angle: number;
  quality: QualityLevel;
  expr: ExpressionChoice;
  zoom: number;
  stats: boolean;
  t: number;
  follow: 'customer' | 'owner' | null;
  freeze: boolean;
  phase: string | null;
}

function readUrlState(): PlaygroundState {
  const params = new URLSearchParams(window.location.search);
  const quality = params.get('quality');
  const expr = params.get('expr');
  const zoom = Number(params.get('zoom'));
  const angle = Number(params.get('angle'));
  const t = Number(params.get('t'));
  return {
    time: params.get('time') === 'evening' ? 'evening' : 'day',
    angle: Number.isFinite(angle) ? Math.round(angle) : 0,
    quality: quality === 'low' || quality === 'high' ? quality : 'medium',
    expr: EXPRESSION_CYCLE.find((e) => e === expr) ?? 'auto',
    zoom: Number.isFinite(zoom) && zoom > 0 ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) : 1,
    stats: params.get('stats') === '1',
    t: Number.isFinite(t) && t > 0 ? t : 0,
    follow:
      params.get('follow') === 'customer'
        ? 'customer'
        : params.get('follow') === 'owner'
          ? 'owner'
          : null,
    freeze: params.get('freeze') === '1',
    phase: params.get('phase'),
  };
}

function writeUrlState(s: PlaygroundState) {
  const params = new URLSearchParams();
  if (s.time !== 'day') params.set('time', s.time);
  if (angleIndex(s.angle) !== 0) params.set('angle', String(angleIndex(s.angle)));
  if (s.quality !== 'medium') params.set('quality', s.quality);
  if (s.expr !== 'auto') params.set('expr', s.expr);
  if (s.zoom !== 1) params.set('zoom', s.zoom.toFixed(2));
  if (s.stats) params.set('stats', '1');
  if (s.follow) params.set('follow', s.follow);
  if (s.freeze) {
    params.set('freeze', '1');
    params.set('t', String(s.t));
  }
  if (s.phase) params.set('phase', s.phase);
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

/** Phone landscape (≤ 500 px tall): controls move to a slim column on the right. */
const COMPACT_QUERY = '(max-height: 500px)';

function subscribeCompact(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function useCompact(): boolean {
  return useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  );
}

function ChunkyButton({
  children,
  onClick,
  active = false,
  title,
  wide = false,
  compact = false,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
  wide?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl border-[3px] border-ink font-display tracking-wide text-ink shadow-[0_3px_0_var(--color-ink)] transition-[transform,box-shadow,background-color] duration-100 select-none active:translate-y-[3px] active:shadow-none ${
        compact ? 'h-8 text-xs' : 'h-10 text-sm'
      } ${wide ? (compact ? 'w-full px-1.5' : 'px-3') : compact ? 'w-8' : 'w-10'} ${active ? 'bg-sun' : 'bg-paper hover:bg-white'}`}
    >
      {children}
    </button>
  );
}

function Group({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div
      className={`rounded-2xl bg-ink/35 backdrop-blur-sm ${
        compact ? 'grid grid-cols-2 gap-1 p-1' : 'flex items-center gap-1.5 p-1.5'
      }`}
    >
      {children}
    </div>
  );
}

export default function ScenePlayground() {
  const [state, setState] = useState<PlaygroundState>(readUrlState);
  const [info, setInfo] = useState<RenderInfo | null>(null);
  const [headerHeight, setHeaderHeight] = useState(72);
  const compact = useCompact();
  const iconSize = compact ? 'size-4' : 'size-5';
  const update = (patch: Partial<PlaygroundState>) => setState((s) => ({ ...s, ...patch }));

  useEffect(() => {
    writeUrlState(state);
  }, [state]);

  // The DebugShell header overlaps the fixed canvas; frame the diorama below it.
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
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const key = event.key.toLowerCase();
      setState((s) => {
        switch (key) {
          case 'q':
            return { ...s, angle: s.angle - 1 };
          case 'e':
            return { ...s, angle: s.angle + 1 };
          case 'n':
            return { ...s, time: s.time === 'day' ? 'evening' : 'day' };
          case 'x': {
            const i = EXPRESSION_CYCLE.indexOf(s.expr);
            return { ...s, expr: EXPRESSION_CYCLE[(i + 1) % EXPRESSION_CYCLE.length] ?? 'auto' };
          }
          case '1':
          case '2':
          case '3':
            return { ...s, quality: QUALITIES[Number(key) - 1] ?? s.quality };
          case '+':
          case '=':
            return { ...s, zoom: Math.min(ZOOM_MAX, s.zoom * 1.25) };
          case '-':
            return { ...s, zoom: Math.max(ZOOM_MIN, s.zoom / 1.25) };
          case 's':
            return { ...s, stats: !s.stats };
          default:
            return s;
        }
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nextExpression = () => {
    const i = EXPRESSION_CYCLE.indexOf(state.expr);
    update({ expr: EXPRESSION_CYCLE[(i + 1) % EXPRESSION_CYCLE.length] ?? 'auto' });
  };
  const zoomStep = (dir: 1 | -1) => {
    const current = ZOOM_STEPS.findIndex((z) => z >= state.zoom - 0.01);
    const index = Math.min(
      ZOOM_STEPS.length - 1,
      Math.max(0, (current === -1 ? 0 : current) + dir),
    );
    update({ zoom: ZOOM_STEPS[index] ?? 1 });
  };

  return (
    <DebugShell
      title="Shop Diorama Spike"
      subtitle="The Nook · 3D toy-diorama art direction (Q1)"
      tone="dark"
    >
      <div className="fixed inset-0 z-0">
        <ShopDiorama
          timeOfDay={state.time}
          quality={state.quality}
          cameraAngle={state.angle}
          zoom={state.zoom}
          customerExpression={state.expr}
          showStats={state.stats}
          customerStartTime={state.t}
          follow={state.follow}
          freezeCustomer={state.freeze}
          customerStartPhase={state.phase ?? undefined}
          insets={compact ? { top: headerHeight, right: 92 } : { top: headerHeight, bottom: 64 }}
          onRenderInfo={state.stats ? setInfo : undefined}
        />
      </div>
      <div
        className={
          compact
            ? 'fixed right-1.5 bottom-1.5 z-10 flex w-[84px] flex-col gap-1.5'
            : 'pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center p-3'
        }
        style={compact ? { top: headerHeight + 6 } : undefined}
      >
        <div
          className={
            compact
              ? 'flex h-full flex-col justify-center gap-1.5'
              : 'pointer-events-auto flex flex-wrap items-center justify-center gap-2'
          }
        >
          <Group compact={compact}>
            <ChunkyButton
              compact={compact}
              title="Day"
              active={state.time === 'day'}
              onClick={() => update({ time: 'day' })}
            >
              <Sun className={iconSize} strokeWidth={2.6} />
            </ChunkyButton>
            <ChunkyButton
              compact={compact}
              title="Evening"
              active={state.time === 'evening'}
              onClick={() => update({ time: 'evening' })}
            >
              <Moon className={iconSize} strokeWidth={2.6} />
            </ChunkyButton>
          </Group>
          <Group compact={compact}>
            <ChunkyButton
              compact={compact}
              title="Rotate left (Q)"
              onClick={() => update({ angle: state.angle - 1 })}
            >
              <RotateCcw className={iconSize} strokeWidth={2.6} />
            </ChunkyButton>
            <ChunkyButton
              compact={compact}
              title="Rotate right (E)"
              onClick={() => update({ angle: state.angle + 1 })}
            >
              <RotateCw className={iconSize} strokeWidth={2.6} />
            </ChunkyButton>
            <ChunkyButton compact={compact} title="Zoom out (-)" onClick={() => zoomStep(-1)}>
              <ZoomOut className={iconSize} strokeWidth={2.6} />
            </ChunkyButton>
            <ChunkyButton compact={compact} title="Zoom in (+)" onClick={() => zoomStep(1)}>
              <ZoomIn className={iconSize} strokeWidth={2.6} />
            </ChunkyButton>
          </Group>
          <Group compact={compact}>
            <div className={compact ? 'col-span-2' : undefined}>
              <ChunkyButton
                compact={compact}
                title="Customer expression (X)"
                wide
                active={state.expr !== 'auto'}
                onClick={nextExpression}
              >
                {compact ? null : <Smile className={iconSize} strokeWidth={2.6} />}
                <span
                  className={`capitalize ${compact ? 'max-w-full truncate text-center' : 'w-[4.6rem] text-left'}`}
                >
                  {state.expr}
                </span>
              </ChunkyButton>
            </div>
          </Group>
          <Group compact={compact}>
            {QUALITIES.map((q, i) => (
              <ChunkyButton
                key={q}
                compact={compact}
                title={`Quality: ${q} (${i + 1})`}
                wide
                active={state.quality === q}
                onClick={() => update({ quality: q })}
              >
                {q === 'medium' ? 'Med' : q === 'low' ? 'Low' : 'High'}
              </ChunkyButton>
            ))}
            <ChunkyButton
              compact={compact}
              title="Stats (S)"
              active={state.stats}
              onClick={() => update({ stats: !state.stats })}
            >
              <Activity className={iconSize} strokeWidth={2.6} />
            </ChunkyButton>
          </Group>
        </div>
      </div>
      {state.stats && info ? (
        <div
          className="pointer-events-none fixed left-3 z-10 rounded-xl border-[3px] border-ink bg-paper px-3 py-1.5 font-mono text-xs text-ink shadow-[0_3px_0_var(--color-ink)]"
          style={{ top: headerHeight + 8 }}
        >
          <div>draw calls {info.drawCalls}</div>
          <div>triangles {(info.triangles / 1000).toFixed(0)}k</div>
          <div>
            geo {info.geometries} · tex {info.textures}
          </div>
        </div>
      ) : null}
    </DebugShell>
  );
}
