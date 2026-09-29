// Debug page: exempt from i18n (CLAUDE.md).
import { Dices, ImageOff, RefreshCw } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { ArtComposition, ArtPose, BiomeId, CreatureArtRequest } from '@/art/types';
import type { SpeciesDef } from '@/content/schema/species';
import { elements } from '@/content/tcg/gk/elements';
import { gkSpecies } from '@/content/tcg/gk/species';
import { DebugShell } from '@/debug/DebugShell';
import { Button } from '@/ui/components/Button';
import { ElementIcon } from '@/ui/components/ElementIcon';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { type ClayQuality, clayDeviceInfo, renderClayArt } from './renderer';

/**
 * /debug/clay: the Clay Critters workshop. Every spike species in both card compositions, with
 * lighting, background, pose, seed and quality controls. State mirrors the URL, so any view can
 * be linked or screenshotted: ?time=dusk&bg=transparent&pose=happy&seed=7&quality=draft
 */

type TimeOfDay = NonNullable<CreatureArtRequest['timeOfDay']>;
type Background = NonNullable<CreatureArtRequest['background']>;

interface Controls {
  time: TimeOfDay;
  bg: Background;
  pose: ArtPose;
  quality: ClayQuality;
  seed: number;
}

const TIMES: readonly TimeOfDay[] = ['day', 'dusk', 'night'];
const BACKGROUNDS: readonly Background[] = ['biome', 'transparent'];
const POSES: readonly ArtPose[] = ['idle', 'happy', 'action'];
const QUALITIES: readonly ClayQuality[] = ['draft', 'final', 'ultra'];
const BIOMES: readonly BiomeId[] = ['storm-meadow', 'volcano-dawn', 'lagoon'];

/** Sizes the card UI uses (src/art/loadRenderers.ts). */
const SIZES: Record<ArtComposition, { w: number; h: number }> = {
  window: { w: 648, h: 438 },
  fullArt: { w: 500, h: 700 },
};

const BIOME_LABEL: Record<BiomeId, string> = {
  'storm-meadow': 'Storm Meadow',
  'volcano-dawn': 'Volcano Dawn',
  lagoon: 'Lagoon',
};

const QUALITY_HINT: Record<ClayQuality, string> = {
  draft: '1 sample/px',
  final: 'adaptive 5× AA',
  ultra: 'adaptive 9× AA',
};

function pick<T extends string>(options: readonly T[], value: string | null, fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}

function readControls(): Controls {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed'));
  return {
    time: pick(TIMES, params.get('time'), 'day'),
    bg: pick(BACKGROUNDS, params.get('bg'), 'biome'),
    pose: pick(POSES, params.get('pose'), 'idle'),
    quality: pick(QUALITIES, params.get('quality'), 'final'),
    seed: Number.isInteger(seed) && seed > 0 ? seed : 1,
  };
}

function writeControls(c: Controls) {
  const params = new URLSearchParams({
    time: c.time,
    bg: c.bg,
    pose: c.pose,
    quality: c.quality,
    seed: String(c.seed),
  });
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

function biomeOf(species: SpeciesDef): BiomeId {
  return BIOMES.find((biome) => biome === species.biome) ?? 'storm-meadow';
}

interface Slot {
  url?: string;
  ms?: number;
  compileMs?: number;
  error?: string;
  /** Render generation the image belongs to (older ones are shown dimmed while updating). */
  run: number;
}

const slotKey = (species: SpeciesDef, composition: ArtComposition) =>
  `${species.id}|${composition}`;

const JOBS = gkSpecies.flatMap((species) =>
  (['window', 'fullArt'] as const).map((composition) => ({ species, composition })),
);

export default function ClayPlayground() {
  const [controls, setControls] = useState<Controls>(readControls);
  const [run, setRun] = useState(1);
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [device, setDevice] = useState<string>('');
  const urls = useRef(new Map<string, string>());

  const update = (patch: Partial<Controls>) => {
    const next = { ...controls, ...patch };
    writeControls(next);
    setControls(next);
    setRun((r) => r + 1);
  };

  useEffect(() => {
    try {
      setDevice(clayDeviceInfo().renderer);
    } catch (error) {
      setDevice(error instanceof Error ? error.message : 'WebGL2 unavailable');
    }
  }, []);

  // Render all six illustrations in sequence whenever the controls change (or on re-render).
  useEffect(() => {
    let alive = true;
    const generation = run;
    (async () => {
      for (const { species, composition } of JOBS) {
        const key = slotKey(species, composition);
        const size = SIZES[composition];
        try {
          const result = await renderClayArt(
            {
              genome: species.genome,
              element: species.element,
              width: size.w,
              height: size.h,
              composition,
              pose: controls.pose,
              background: controls.bg,
              biome: biomeOf(species),
              timeOfDay: controls.time,
              seed: controls.seed,
            },
            { quality: controls.quality },
          );
          if (!alive) return;
          const url = URL.createObjectURL(result.blob);
          const previous = urls.current.get(key);
          if (previous) URL.revokeObjectURL(previous);
          urls.current.set(key, url);
          setSlots((s) => ({
            ...s,
            [key]: { url, ms: result.ms, compileMs: result.compileMs, run: generation },
          }));
        } catch (error) {
          if (!alive) return;
          const message = error instanceof Error ? error.message : String(error);
          setSlots((s) => ({ ...s, [key]: { ...s[key], error: message, run: generation } }));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [controls, run]);

  // Object URLs outlive re-renders on purpose (old art stays visible, dimmed, while updating);
  // free them when leaving the page.
  useEffect(() => {
    const owned = urls.current;
    return () => {
      for (const url of owned.values()) URL.revokeObjectURL(url);
      owned.clear();
    };
  }, []);

  const current = Object.values(slots).filter((s) => s.run === run && s.ms !== undefined);
  const totalMs = current.reduce((sum, s) => sum + (s.ms ?? 0), 0);
  const compileMs = current.reduce((sum, s) => sum + (s.compileMs ?? 0), 0);
  const done = current.length;

  return (
    <DebugShell
      title="Clay Critters"
      subtitle="Style A · signed-distance vinyl toys, ray-marched in WebGL2"
      tone="dark"
      actions={
        <>
          <SegmentedControl
            label="Time of day"
            size="sm"
            value={controls.time}
            onChange={(time) => update({ time })}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'dusk', label: 'Dusk' },
              { value: 'night', label: 'Night' },
            ]}
          />
          <SegmentedControl
            label="Background"
            size="sm"
            value={controls.bg}
            onChange={(bg) => update({ bg })}
            options={[
              { value: 'biome', label: 'Biome' },
              { value: 'transparent', label: 'Cut-out' },
            ]}
          />
          <SegmentedControl
            label="Pose"
            size="sm"
            value={controls.pose}
            onChange={(pose) => update({ pose })}
            options={[
              { value: 'idle', label: 'Idle' },
              { value: 'happy', label: 'Happy' },
              { value: 'action', label: 'Action' },
            ]}
          />
        </>
      }
    >
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-5">
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-panel)] border-[3px] border-ink bg-white/5 px-4 py-3">
          <SegmentedControl
            label="Quality"
            size="sm"
            value={controls.quality}
            onChange={(quality) => update({ quality })}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'final', label: 'Final' },
              { value: 'ultra', label: 'Ultra' },
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="font-display text-sm tracking-wide text-paper/70">Seed</span>
            <span className="min-w-12 rounded-lg border-[3px] border-ink bg-paper px-2 py-0.5 text-center font-display text-ink tabular-nums">
              {controls.seed}
            </span>
            <Button
              size="sm"
              variant="secondary"
              icon={<Dices />}
              onClick={() => update({ seed: (controls.seed % 9973) + 1 + ((run * 7919) % 97) })}
            >
              Shuffle
            </Button>
          </div>
          <Button
            size="sm"
            variant="gold"
            icon={<RefreshCw />}
            onClick={() => setRun((r) => r + 1)}
          >
            Re-render
          </Button>
          <p className="ml-auto text-sm text-paper/70">
            {done < JOBS.length ? `Rendering ${done + 1}/${JOBS.length}… ` : 'Done · '}
            <span className="tabular-nums text-paper">{(totalMs / 1000).toFixed(1)} s</span> total
            {compileMs > 0 ? ` (incl. ${(compileMs / 1000).toFixed(1)} s shader compile)` : ''} ·{' '}
            {QUALITY_HINT[controls.quality]} · <span className="text-paper/50">{device}</span>
          </p>
        </div>

        {gkSpecies.map((species) => (
          <SpeciesRow
            key={species.id}
            species={species}
            slots={slots}
            run={run}
            transparent={controls.bg === 'transparent'}
          />
        ))}

        <p className="pb-6 text-center text-sm text-paper/50">
          Genome → signed-distance part kit → one WebGL2 shader per species/biome/pose. Same
          request, same image. Card sizes: window 648×438, full art 500×700.
        </p>
      </div>
    </DebugShell>
  );
}

function SpeciesRow({
  species,
  slots,
  run,
  transparent,
}: {
  species: SpeciesDef;
  slots: Record<string, Slot>;
  run: number;
  transparent: boolean;
}) {
  const element = elements[species.element];
  const windowSlot = slots[slotKey(species, 'window')];
  const fullSlot = slots[slotKey(species, 'fullArt')];
  const g = species.genome;
  return (
    <section className="rounded-[var(--radius-panel)] border-[3px] border-ink bg-white/[0.04] p-4 shadow-[0_6px_0_var(--color-ink)]">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <ElementIcon element={species.element} size={34} />
        <h2 className="font-display text-3xl leading-none tracking-wide">{species.name}</h2>
        <span
          className="rounded-full border-[3px] border-ink px-2.5 py-0.5 font-display text-sm text-ink"
          style={{ background: element.tint }}
        >
          #{String(species.dex).padStart(3, '0')} · {element.id} · {BIOME_LABEL[biomeOf(species)]}
        </span>
        <span className="text-sm text-paper/60">
          {g.plan} · {g.head.shape} head · {g.ears.shape} ears · {g.tail.shape} tail · {g.face.eyes}{' '}
          eyes
        </span>
      </header>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,648px)_minmax(0,260px)_minmax(0,1fr)]">
        <ArtFrame
          label="Art window"
          slot={windowSlot}
          run={run}
          aspect="648 / 438"
          transparent={transparent}
        />
        <ArtFrame
          label="Full art"
          slot={fullSlot}
          run={run}
          aspect="5 / 7"
          transparent={transparent}
          className="max-w-[260px]"
        />
        <div className="flex flex-col gap-3">
          <p className="font-display text-sm tracking-wide text-paper/70">At card size</p>
          <div className="flex flex-wrap items-end gap-3">
            <Thumb slot={windowSlot} width={300} transparent={transparent} caption="300 px" />
            <Thumb slot={windowSlot} width={150} transparent={transparent} caption="150 px" />
          </div>
          <p className="text-sm leading-snug text-paper/60">{species.lore}</p>
        </div>
      </div>
    </section>
  );
}

const CHECKER =
  'bg-[repeating-conic-gradient(var(--color-paper2)_0%_25%,var(--color-paper)_0%_50%)] bg-[length:22px_22px]';

function ArtFrame({
  label,
  slot,
  run,
  aspect,
  transparent,
  className = '',
}: {
  label: string;
  slot: Slot | undefined;
  run: number;
  aspect: string;
  transparent: boolean;
  className?: string;
}) {
  const stale = slot !== undefined && slot.run !== run;
  let body: ReactNode;
  if (slot?.url) {
    body = (
      <img
        src={slot.url}
        alt={label}
        className={`block h-full w-full object-cover transition-opacity duration-300 ${stale ? 'opacity-45' : ''}`}
      />
    );
  } else if (slot?.error) {
    body = (
      <div className="grid h-full place-items-center p-4 text-center text-sm text-coral">
        <ImageOff className="mx-auto mb-2 size-8" />
        {slot.error.split('\n')[0]}
      </div>
    );
  } else {
    body = <div className="h-full w-full animate-pulse bg-white/10" />;
  }
  return (
    <figure className={`flex flex-col gap-1.5 ${className}`}>
      <div
        className={`relative overflow-hidden rounded-2xl border-[3px] border-ink shadow-[0_4px_0_var(--color-ink)] ${transparent ? CHECKER : 'bg-black/30'}`}
        style={{ aspectRatio: aspect }}
      >
        {body}
        {stale || !slot?.url ? (
          <span className="absolute top-2 left-2 rounded-full border-2 border-ink bg-sun px-2 font-display text-xs text-ink">
            rendering…
          </span>
        ) : null}
      </div>
      <figcaption className="flex items-center justify-between text-xs text-paper/60">
        <span className="font-display tracking-wide text-paper/80">{label}</span>
        {slot?.ms !== undefined ? (
          <span className="tabular-nums">
            {(slot.ms / 1000).toFixed(2)} s
            {slot.compileMs ? ` · compile ${(slot.compileMs / 1000).toFixed(2)} s` : ''}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

function Thumb({
  slot,
  width,
  transparent,
  caption,
}: {
  slot: Slot | undefined;
  width: number;
  transparent: boolean;
  caption: string;
}) {
  return (
    <figure className="flex flex-col items-center gap-1">
      <div
        className={`overflow-hidden rounded-lg border-2 border-ink ${transparent ? CHECKER : 'bg-black/30'}`}
        style={{ width, aspectRatio: '648 / 438' }}
      >
        {slot?.url ? (
          <img src={slot.url} alt="" className="block h-full w-full object-cover" />
        ) : null}
      </div>
      <figcaption className="text-xs text-paper/50">{caption}</figcaption>
    </figure>
  );
}
