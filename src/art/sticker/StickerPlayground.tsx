import { type ReactNode, useEffect, useState } from 'react';
import type { ArtPose, BiomeId, CreatureArtRequest } from '@/art/types';
import type { SpeciesDef } from '@/content/schema/species';
import { elements } from '@/content/tcg/gk/elements';
import { gkSpecies } from '@/content/tcg/gk/species';
import { DebugShell } from '@/debug/DebugShell';
import { Button, SegmentedControl } from '@/ui/components';
import { buildStickerSvg, stickerRenderer } from './renderer';

// Debug page: exempt from i18n (CLAUDE.md).

type TimeOfDay = NonNullable<CreatureArtRequest['timeOfDay']>;
type Background = 'scene' | 'sticker';

interface Controls {
  timeOfDay: TimeOfDay;
  background: Background;
  seed: number;
  pose: ArtPose;
}

const BIOME_LABEL: Record<BiomeId, string> = {
  'storm-meadow': 'Storm Meadow',
  'volcano-dawn': 'Volcano Dawn',
  lagoon: 'Lagoon',
};

function isBiome(value: string): value is BiomeId {
  return value in BIOME_LABEL;
}

function requestFor(
  species: SpeciesDef,
  c: Controls,
  width: number,
  height: number,
  composition: CreatureArtRequest['composition'],
): CreatureArtRequest {
  return {
    genome: species.genome,
    element: species.element,
    width,
    height,
    composition,
    pose: c.pose,
    background: c.background === 'scene' ? 'biome' : 'transparent',
    biome: isBiome(species.biome) ? species.biome : undefined,
    timeOfDay: c.timeOfDay,
    seed: c.seed,
  };
}

/** Next seed for the dice button: a tiny LCG keeps the page deterministic and shareable. */
function nextSeed(seed: number): number {
  return ((seed * 1103515245 + 12345) >>> 0) % 10000;
}

function SeedControl({ seed, onChange }: { seed: number; onChange: (seed: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="secondary"
        aria-label="Previous seed"
        onClick={() => onChange(Math.max(0, seed - 1))}
      >
        −
      </Button>
      <label className="flex items-center gap-1.5 font-display text-sm tracking-wide text-paper/80">
        <span className="sr-only md:not-sr-only">Seed</span>
        <input
          type="number"
          min={0}
          value={seed}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="h-9 w-20 rounded-xl border-[3px] border-ink bg-paper px-2 text-center font-ui font-extrabold text-ink tabular-nums"
        />
      </label>
      <Button
        size="sm"
        variant="secondary"
        aria-label="Next seed"
        onClick={() => onChange(seed + 1)}
      >
        +
      </Button>
      <Button
        size="sm"
        variant="gold"
        aria-label="Shuffle seed"
        onClick={() => onChange(nextSeed(seed))}
      >
        🎲
      </Button>
    </div>
  );
}

/** Inline SVG (crisp at any zoom). Ids are prefixed per instance so several SVGs coexist. */
function InlineArt({ svg, label }: { svg: string; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SVG built by our own renderer from typed content data.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Kraft-paper sheet behind transparent stickers, so the die-cut border reads. */
const PAPER = {
  backgroundColor: '#E9DFC9',
  backgroundImage:
    'radial-gradient(circle at 1px 1px, rgb(30 35 64 / 0.12) 1px, transparent 0), linear-gradient(135deg, #F3EAD6, #DCCFB3)',
  backgroundSize: '14px 14px, 100% 100%',
} as const;

function Frame({
  children,
  caption,
  scene,
}: {
  children: ReactNode;
  caption: string;
  scene: boolean;
}) {
  return (
    <figure className="min-w-0">
      <div
        className="overflow-hidden rounded-2xl border-[3px] border-ink bg-night shadow-[0_5px_0_var(--color-ink)]"
        style={scene ? undefined : PAPER}
      >
        {children}
      </div>
      <figcaption className="mt-2 text-center font-display text-xs tracking-wider text-paper/60 uppercase">
        {caption}
      </figcaption>
    </figure>
  );
}

function SpeciesRow({ species, controls }: { species: SpeciesDef; controls: Controls }) {
  const element = elements[species.element];
  const windowSvg = buildStickerSvg(requestFor(species, controls, 640, 440, 'window'), {
    idPrefix: `sp${species.dex}w`,
  });
  const fullSvg = buildStickerSvg(requestFor(species, controls, 500, 700, 'fullArt'), {
    idPrefix: `sp${species.dex}f`,
  });
  const biome = isBiome(species.biome) ? BIOME_LABEL[species.biome] : species.biome;
  const scene = controls.background === 'scene';
  return (
    <section className="rounded-[22px] border-[3px] border-ink bg-white/[0.04] p-3 shadow-[0_6px_0_rgb(0_0_0/0.35)] sm:p-5">
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rounded-lg border-[3px] border-ink bg-paper px-2 py-0.5 font-display text-sm text-ink tabular-nums shadow-[0_2px_0_var(--color-ink)]">
          #{String(species.dex).padStart(3, '0')}
        </span>
        <h2 className="font-display text-2xl tracking-wide sm:text-3xl">{species.name}</h2>
        <span
          className="rounded-full border-[3px] border-ink px-3 py-0.5 font-display text-sm tracking-wide text-ink capitalize"
          style={{ backgroundColor: element.color }}
        >
          {element.nameKey}
        </span>
        <span className="font-display text-sm tracking-wide text-paper/60">{biome}</span>
        <p className="w-full text-sm text-paper/70 italic sm:ml-auto sm:w-auto sm:max-w-md sm:text-right">
          “{species.lore}”
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4545fr_0.7143fr]">
        <Frame caption="Card window · 640 × 440" scene={scene}>
          <InlineArt svg={windowSvg} label={`${species.name}, card window art`} />
        </Frame>
        <Frame caption="Full art · 500 × 700" scene={scene}>
          <InlineArt svg={fullSvg} label={`${species.name}, full art`} />
        </Frame>
      </div>
    </section>
  );
}

interface PngResult {
  name: string;
  url: string;
  ms: number;
  kb: number;
}

/** Renders through `stickerRenderer.render()` (PNG) at card size, to check the raster path. */
function PngStrip({ controls }: { controls: Controls }) {
  const [results, setResults] = useState<PngResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const out: PngResult[] = [];
      for (const species of gkSpecies) {
        const start = performance.now();
        const blob = await stickerRenderer.render(
          requestFor(species, controls, 300, 206, 'window'),
        );
        const url = URL.createObjectURL(blob);
        urls.push(url);
        out.push({ name: species.name, url, ms: performance.now() - start, kb: blob.size / 1024 });
      }
      if (!cancelled) {
        setResults(out);
        setError(null);
      }
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [controls]);
  return (
    <section className="rounded-[22px] border-[3px] border-ink bg-white/[0.04] p-3 sm:p-5">
      <h2 className="font-display text-xl tracking-wide">Card-size check</h2>
      <p className="mb-4 text-sm text-paper/60">
        PNG via <code className="font-bold text-sun">stickerRenderer.render()</code> at 300 × 206,
        the art window size in the card UI.
      </p>
      {error ? <p className="font-bold text-coral">Render failed: {error}</p> : null}
      <div className="flex flex-wrap gap-4">
        {results.map((r) => (
          <figure key={r.name} className="w-[300px] max-w-full">
            <img
              src={r.url}
              alt={`${r.name} rendered to PNG`}
              width={300}
              height={206}
              className="h-auto w-full rounded-xl border-[3px] border-ink shadow-[0_4px_0_var(--color-ink)]"
            />
            <figcaption className="mt-1.5 flex justify-between font-display text-xs tracking-wider text-paper/60 uppercase">
              <span>{r.name}</span>
              <span className="tabular-nums">
                {r.ms.toFixed(0)} ms · {r.kb.toFixed(0)} KB
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default function StickerPlayground() {
  const [controls, setControls] = useState<Controls>({
    timeOfDay: 'day',
    background: 'scene',
    seed: 1,
    pose: 'idle',
  });
  const patch = (p: Partial<Controls>) => setControls((c) => ({ ...c, ...p }));
  return (
    <DebugShell
      title="Sticker Pop"
      subtitle="Style B · bold-outline, cel-shaded SVG creatures"
      tone="dark"
      actions={
        <>
          <SegmentedControl<TimeOfDay>
            size="sm"
            label="Time of day"
            value={controls.timeOfDay}
            onChange={(timeOfDay) => patch({ timeOfDay })}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'dusk', label: 'Dusk' },
              { value: 'night', label: 'Night' },
            ]}
          />
          <SegmentedControl<Background>
            size="sm"
            label="Background"
            value={controls.background}
            onChange={(background) => patch({ background })}
            options={[
              { value: 'scene', label: 'Scene' },
              { value: 'sticker', label: 'Sticker' },
            ]}
          />
          <SegmentedControl<ArtPose>
            size="sm"
            label="Pose"
            value={controls.pose}
            onChange={(pose) => patch({ pose })}
            options={[
              { value: 'idle', label: 'Idle' },
              { value: 'happy', label: 'Happy' },
            ]}
          />
          <SeedControl seed={controls.seed} onChange={(seed) => patch({ seed })} />
        </>
      }
    >
      <div className="relative">
        <div
          className="hub-stars pointer-events-none absolute inset-0 opacity-40"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-3 py-6 sm:px-6">
          {gkSpecies.map((species) => (
            <SpeciesRow key={species.id} species={species} controls={controls} />
          ))}
          <PngStrip controls={controls} />
        </div>
      </div>
    </DebugShell>
  );
}
