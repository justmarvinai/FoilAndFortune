// Debug page: exempt from i18n (ADR-031).
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  getAudioEngine,
  getAudioStatus,
  installAudioReactions,
  type MusicContext,
  playSfx,
  type SfxId,
  setMusic,
  speak,
  unlockAudio,
  type VoiceMood,
  voiceForSeed,
} from '@/audio';
import type { EngineStats } from '@/audio/engine/engine';
import { renderMusicOffline } from '@/audio/engine/music';
import { measureLoudness } from '@/audio/loudness';
import type { Channel } from '@/audio/mixConfig';
import { musicStyles } from '@/audio/music/styles';
import { reactionStats } from '@/audio/reactions/install';
import { SFX_IDS, sfxPresets } from '@/audio/sfx/presets';
import { gainToDb, volumeToGain } from '@/audio/volume';
import type { Cents } from '@/core/money';
import type { DomainEvent } from '@/sim/events';
import { presentationBus, publish } from '@/state/presentationBus';
import { useSettingsStore } from '@/state/settingsStore';
import { Button } from '@/ui/components/Button';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { DebugShell } from './DebugShell';

const CONTEXTS: readonly MusicContext[] = ['title', 'day', 'evening', 'night', 'opening', 'silent'];
const CHANNELS: readonly Channel[] = ['master', 'music', 'sfx', 'voices', 'ambience'];
const MOODS: readonly VoiceMood[] = ['neutral', 'happy', 'excited', 'question', 'grumble'];
const LADDER: readonly SfxId[] = [
  'pack.stingerRare',
  'pack.stingerHolo',
  'pack.stingerUltra',
  'pack.stingerIllustration',
  'pack.stingerSecret',
  'pack.stingerMythic',
  'pack.godPack',
];
const KEYS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

function Section({
  title,
  children,
  aside,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={`rounded-[var(--radius-panel)] border-[3px] border-ink bg-white p-4 shadow-[0_4px_0_var(--color-ink)] ${wide ? 'lg:col-span-2' : ''}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex-1 font-display text-xl tracking-wide">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Post-limiter level meter, drawn straight into the DOM (no React state at 60 fps). */
function MasterMeter() {
  const bar = useRef<HTMLDivElement>(null);
  const peak = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const data = new Float32Array(1024);
    const draw = () => {
      const engine = getAudioEngine();
      if (engine) {
        engine.analyser.getFloatTimeDomainData(data);
        let sum = 0;
        let max = 0;
        for (const v of data) {
          sum += v * v;
          max = Math.max(max, Math.abs(v));
        }
        const rmsDb = gainToDb(Math.sqrt(sum / data.length));
        const peakDb = gainToDb(max);
        const width = (db: number) => `${Math.max(0, Math.min(100, ((db + 60) / 60) * 100))}%`;
        if (bar.current) bar.current.style.width = width(rmsDb);
        if (peak.current) peak.current.style.left = width(peakDb);
        if (label.current) {
          label.current.textContent = `RMS ${Number.isFinite(rmsDb) ? rmsDb.toFixed(1) : '−∞'} · peak ${Number.isFinite(peakDb) ? peakDb.toFixed(1) : '−∞'} dBFS`;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div>
      <div className="relative h-4 overflow-hidden rounded-full border-2 border-ink bg-paper2">
        <div ref={bar} className="h-full w-0 bg-teal" />
        <div ref={peak} className="absolute top-0 h-full w-1 bg-coral" />
      </div>
      <span ref={label} className="mt-1 block font-mono text-xs opacity-70">
        locked
      </span>
    </div>
  );
}

interface LevelRow {
  context: string;
  integrated: number;
  momentaryMax: number;
  peakDb: number;
  ms: number;
}

async function measureMusic(seconds = 48): Promise<LevelRow[]> {
  const rows: LevelRow[] = [];
  for (const context of ['title', 'day', 'evening', 'night', 'opening'] as const) {
    const started = performance.now();
    const buffer = await renderMusicOffline(context, seconds);
    const channels = [buffer.getChannelData(0), buffer.getChannelData(1)].map(
      (d) => new Float32Array(d),
    );
    const report = measureLoudness(channels, buffer.sampleRate);
    rows.push({ context, ...report, ms: performance.now() - started });
  }
  return rows;
}

function startMeasure(
  setLevels: (rows: LevelRow[]) => void,
  setMeasuring: (measuring: boolean) => void,
): void {
  setMeasuring(true);
  measureMusic()
    .then((rows) => {
      setLevels(rows);
      console.info(`[audio-levels] ${JSON.stringify(rows)}`);
    })
    .catch((error: unknown) => console.error('Music level measurement failed', error))
    .finally(() => setMeasuring(false));
}

let stormUid = 90_000;

/** A busy-shop burst through the real reaction pipeline: 10 customers walk in at once, etc. */
function storm(): void {
  const events: DomainEvent[] = [];
  for (let i = 0; i < 10; i++) events.push({ type: 'customer/entered', uid: ++stormUid });
  for (let i = 0; i < 5; i++) {
    events.push({
      type: 'sale/completed',
      uid: stormUid - i,
      items: [{ productId: 'debug', qty: 1 + i, priceCents: 499 as Cents }],
      totalCents: (499 * (1 + i)) as Cents,
    });
  }
  for (const bubble of ['delight', 'angry', 'steal', 'ripoff', 'outOfStock'] as const) {
    events.push({ type: 'customer/bubble', uid: stormUid - 6, bubble });
  }
  for (let i = 0; i < 6; i++) {
    events.push({
      type: 'customer/left',
      uid: stormUid - i,
      satisfaction: i % 2 ? 2 : -2,
      bought: true,
    });
  }
  publish(events);
}

export default function AudioLabPage() {
  const volume = useSettingsStore((state) => state.settings.volume);
  const setVolume = useSettingsStore((state) => state.setVolume);
  const [status, setStatus] = useState(getAudioStatus());
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [reactions, setReactions] = useState(reactionStats());
  const [seed, setSeed] = useState(1);
  const [voiceSeed, setVoiceSeed] = useState(1234);
  const [kid, setKid] = useState(false);
  const [mood, setMood] = useState<VoiceMood>('happy');
  const [syllables, setSyllables] = useState(3);
  const [levels, setLevels] = useState<LevelRow[] | null>(null);
  const [measuring, setMeasuring] = useState(false);

  // Like the game: any first gesture unlocks; the storm runs through the real reactions.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    const release = installAudioReactions();
    const poll = setInterval(() => {
      setStatus(getAudioStatus());
      setStats(getAudioEngine()?.stats() ?? null);
      setReactions(reactionStats());
    }, 250);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      release();
      clearInterval(poll);
    };
  }, []);

  const runMeasure = () => startMeasure(setLevels, setMeasuring);

  // `?measure=1`: measure on load (offline rendering needs no gesture); scripts/audio reads it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('measure') === '1') {
      startMeasure(setLevels, setMeasuring);
    }
  }, []);

  const voice = voiceForSeed(voiceSeed, { pitchBias: kid ? 0.25 : 0 });
  const groups = ['ui', 'shop', 'pack'] as const;

  return (
    <DebugShell
      title="Audio Lab"
      subtitle="Audio v1: SFX board, procedural lo-fi music, blip voices, mixer (docs/04 §11, docs/06 §10)"
      actions={
        <>
          <span className="rounded-full border-2 border-ink bg-paper px-3 py-1 font-mono text-xs">
            {status}
            {stats ? ` · ${stats.state} · ${stats.sampleRate} Hz` : ''}
          </span>
          <Button size="sm" variant="gold" onClick={() => unlockAudio()}>
            Unlock audio
          </Button>
        </>
      }
    >
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-2">
        <Section
          title="Mixer"
          aside={<span className="text-xs opacity-60">bound to the settings store</span>}
        >
          <div className="space-y-2">
            {CHANNELS.map((channel) => (
              <label
                key={channel}
                className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 text-sm"
              >
                <span className="font-display tracking-wide capitalize">{channel}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume[channel]}
                  onChange={(event) => setVolume(channel, Number(event.target.value))}
                />
                <span className="text-right font-mono text-xs">
                  {volume[channel] > 0
                    ? `${gainToDb(volumeToGain(volume[channel])).toFixed(1)} dB`
                    : 'off'}
                </span>
              </label>
            ))}
            <MasterMeter />
            {stats ? (
              <p className="font-mono text-xs opacity-70">
                SFX rendered {stats.sfxReady}/{stats.sfxTotal} · playing {stats.activeSfx} · voices{' '}
                {stats.activeVoices} · duck {stats.duck.toFixed(2)}
              </p>
            ) : (
              <p className="text-sm opacity-70">Click anywhere to unlock audio.</p>
            )}
          </div>
        </Section>

        <Section
          title="Music"
          aside={
            <label className="flex items-center gap-2 text-sm">
              seed
              <input
                type="number"
                className="w-20 rounded-lg border-2 border-ink px-2 py-0.5"
                value={seed}
                onChange={(event) => setSeed(Number(event.target.value) || 0)}
              />
            </label>
          }
        >
          <div className="flex flex-wrap gap-2">
            {CONTEXTS.map((context) => (
              <Button
                key={context}
                size="sm"
                variant={stats?.music === context ? 'primary' : 'secondary'}
                onClick={() => setMusic(context, { seed })}
              >
                {context}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => getAudioEngine()?.duck(0.7, 1500)}>
              Duck 70% · 1.5 s
            </Button>
          </div>
          <p className="mt-3 font-mono text-xs opacity-70">
            {stats && stats.music !== 'silent'
              ? `${stats.music}: ${musicStyles[stats.music].bpm} BPM · ${KEYS[musicStyles[stats.music].tonic]} ${musicStyles[stats.music].mode} · bar ${stats.bar ?? 0} · ${stats.section ?? ''}`
              : 'silent'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" disabled={measuring} onClick={runMeasure}>
              {measuring ? 'Rendering…' : 'Measure music levels (offline, 48 s after the intro)'}
            </Button>
          </div>
          {levels ? (
            <table className="mt-2 w-full font-mono text-xs" data-testid="levels">
              <thead>
                <tr className="text-left opacity-60">
                  <th>context</th>
                  <th>integrated</th>
                  <th>max momentary</th>
                  <th>peak</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((row) => (
                  <tr key={row.context}>
                    <td>{row.context}</td>
                    <td>{row.integrated.toFixed(1)} LUFS</td>
                    <td>{row.momentaryMax.toFixed(1)} LUFS</td>
                    <td>{row.peakDb.toFixed(1)} dBFS</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Section>

        <Section title="Voices">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                look seed
                <input
                  type="number"
                  className="w-24 rounded-lg border-2 border-ink px-2 py-0.5"
                  value={voiceSeed}
                  onChange={(event) => setVoiceSeed(Number(event.target.value) || 0)}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={kid}
                  onChange={(event) => setKid(event.target.checked)}
                />
                kid
              </label>
              <label className="flex items-center gap-2">
                syllables
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={syllables}
                  onChange={(event) => setSyllables(Number(event.target.value))}
                />
                {syllables}
              </label>
            </div>
            <SegmentedControl<VoiceMood>
              size="sm"
              value={mood}
              options={MOODS.map((m) => ({ value: m, label: m }))}
              onChange={setMood}
            />
            <p className="font-mono text-xs opacity-70">
              pitch {voice.pitch.toFixed(2)} · timbre {voice.timbre?.toFixed(2)} · rate{' '}
              {voice.rate?.toFixed(2)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => speak(voice, syllables, mood)}>
                Speak
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  for (let i = 0; i < 6; i++) {
                    setTimeout(
                      () =>
                        speak(
                          voiceForSeed(voiceSeed + i * 101),
                          2 + (i % 3),
                          MOODS[i % MOODS.length] ?? 'neutral',
                        ),
                      i * 450,
                    );
                  }
                }}
              >
                A crowd of six
              </Button>
            </div>
          </div>
        </Section>

        <Section
          title="Busy-shop storm"
          aside={
            <span className="font-mono text-xs opacity-70">
              played {reactions.allowed} · suppressed {reactions.suppressed}
            </span>
          }
        >
          <p className="mb-3 text-sm opacity-80">
            One tick with 10 customers entering, 5 sales, 5 bubbles and 6 goodbyes, through the real
            reaction rules: expect one bell, one register run, a couple of voices.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="danger" onClick={storm}>
              Event storm
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                presentationBus.emit('customer/entered', {
                  type: 'customer/entered',
                  uid: ++stormUid,
                })
              }
            >
              One customer
            </Button>
          </div>
        </Section>

        <Section
          title="Sound effects"
          wide
          aside={
            <Button
              size="sm"
              variant="gold"
              onClick={() => {
                for (const [i, id] of LADDER.entries()) setTimeout(() => playSfx(id), i * 2600);
              }}
            >
              Stinger ladder
            </Button>
          }
        >
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group}>
                <h3 className="mb-1 font-display text-sm tracking-wide opacity-70">{group}.*</h3>
                <div className="flex flex-wrap gap-1.5">
                  {SFX_IDS.filter((id) => id.startsWith(`${group}.`)).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => playSfx(id)}
                      title={`${sfxPresets[id].gainDb} dB${sfxPresets[id].duck ? ' · ducks music' : ''}`}
                      className="rounded-lg border-2 border-ink bg-paper px-2 py-1 font-mono text-xs shadow-[0_2px_0_var(--color-ink)] active:translate-y-[2px] active:shadow-none"
                    >
                      {id.slice(group.length + 1)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </DebugShell>
  );
}
