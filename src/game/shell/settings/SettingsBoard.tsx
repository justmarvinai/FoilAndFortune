import {
  Accessibility,
  Download,
  Gamepad2,
  Keyboard,
  LogOut,
  MonitorSmartphone,
  Save,
  SlidersHorizontal,
  Volume2,
  X,
} from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { navigate } from '@/app/router';
import { playSfx } from '@/audio';
import { exportSave, saveFileName } from '@/save/exportImport';
import { manualSlots, type SaveSlotId, toSaveFile } from '@/save/saveFile';
import type { SlotInfo } from '@/save/saveManager';
import type { Settings } from '@/save/settings';
import type { GameState } from '@/sim/state/types';
import { useSettingsStore } from '@/state/settingsStore';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { useToasts } from '@/ui/components/Toasts';
import './settings.css';

/** Mixing-board fader for one audio channel. */
function Fader({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange(value: number): void;
}) {
  const { t } = useTranslation('shell');
  const id = useId();
  const pct = Math.round(value * 100);
  return (
    <div className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3">
      <label htmlFor={id} className="font-display tracking-wide">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={pct}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        onPointerUp={() => playSfx('ui.tab')}
        className="settings-fader w-full"
        style={{ '--fill': `${pct}%` } as CSSProperties}
      />
      <span className="text-right font-display tabular-nums text-ink/70">
        {t('settings.volume.value', { pct })}
      </span>
    </div>
  );
}

/** A chunky rocker switch (role="switch"), with its label and a "why" line. */
function Rocker({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange(checked: boolean): void;
}) {
  const { t } = useTranslation('shell');
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p id={id} className="font-display tracking-wide">
          {label}
        </p>
        {hint ? <p className="text-sm leading-snug text-ink/65">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => {
          playSfx('ui.tab');
          onChange(!checked);
        }}
        className={`rocker relative h-9 w-[68px] shrink-0 rounded-full border-[3px] border-ink shadow-[inset_0_3px_0_rgb(0_0_0/0.15)] ${checked ? 'bg-teal' : 'bg-paper'}`}
      >
        <span
          className="absolute inset-y-0 left-2 grid place-items-center text-[10px] font-black text-white"
          aria-hidden="true"
        >
          {t('settings.on')}
        </span>
        <span
          className="absolute inset-y-0 right-2 grid place-items-center text-[10px] font-black text-ink/50"
          aria-hidden="true"
        >
          {t('settings.off')}
        </span>
        <span className="rocker__knob absolute top-0.5 left-0.5 size-6 rounded-full border-[3px] border-ink bg-white shadow-[0_2px_0_var(--color-ink)]" />
      </button>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border-[3px] border-ink bg-paper p-4 shadow-[0_4px_0_var(--color-ink)]">
      <h3 className="-mt-1 mb-3 flex items-center gap-2 font-display text-lg tracking-wide">
        <span
          className="grid size-8 -rotate-3 place-items-center rounded-lg border-[2.5px] border-ink bg-sun [&>svg]:size-[18px]"
          aria-hidden="true"
        >
          {icon}
        </span>
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-7 min-w-7 place-items-center rounded-md border-2 border-ink bg-white px-1.5 font-display text-sm shadow-[0_2px_0_var(--color-ink)]">
      {children}
    </kbd>
  );
}

const TEXT_SIZES = ['0.9', '1', '1.15', '1.3', '1.5'] as const;

function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** In-game saves: manual slots, a backup file, and save-and-quit (docs/05 §5.19). */
function SavesSection({ getGame }: { getGame(): GameState | null }) {
  const { t } = useTranslation('shell');
  const push = useToasts((store) => store.push);
  const [slots, setSlots] = useState<ReadonlyMap<SaveSlotId, SlotInfo>>(new Map());
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const { getSaveManager } = await import('@/state/persistence');
    const infos = await getSaveManager().list();
    setSlots(new Map(infos.map((info) => [info.slot, info])));
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: load the slot list once.
  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  const withGame = async (task: (game: GameState) => Promise<void>) => {
    const game = getGame();
    if (!game || busy) return;
    setBusy(true);
    try {
      await task(game);
    } catch (error) {
      console.error(error);
      push({ title: t('settings.saves.failed'), tone: 'warning' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section icon={<Save />} title={t('settings.section.saves')}>
      <ul className="space-y-2">
        {manualSlots.map((slot, index) => {
          const info = slots.get(slot);
          return (
            <li
              key={slot}
              className="flex items-center gap-3 rounded-xl border-2 border-ink/20 bg-paper2/60 px-3 py-2"
            >
              <span className="w-14 font-display tracking-wide">
                {t('settings.saves.slot', { n: index + 1 })}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink/70">
                {info
                  ? `${info.summary.shopName} · ${t('settings.saves.stats', { day: info.summary.day, level: info.summary.level })}`
                  : t('settings.saves.empty')}
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label={t('settings.saves.saveAria', { n: index + 1 })}
                onClick={() =>
                  void withGame(async (game) => {
                    const { getSaveManager } = await import('@/state/persistence');
                    await getSaveManager().save(game, slot, new Date().toISOString());
                    playSfx('ui.stamp');
                    push({ title: t('settings.saves.saved', { n: index + 1 }), tone: 'success' });
                    await refresh();
                  })
                }
                className="flex h-9 items-center gap-1.5 rounded-xl border-[3px] border-ink bg-teal px-3 font-display text-sm text-white shadow-[0_3px_0_var(--color-ink)] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
              >
                <Save className="size-4" aria-hidden="true" />
                {t('settings.saves.saveHere')}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink/65">{t('settings.saves.autosaveNote')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void withGame(async (game) => {
              const file = toSaveFile(game, 'slot-1', new Date().toISOString());
              downloadText(saveFileName(file), exportSave(file));
              push({ title: t('settings.saves.exported'), tone: 'success' });
            })
          }
          className="flex h-11 items-center gap-2 rounded-[14px] border-[3px] border-ink bg-sun px-4 font-display tracking-wide text-ink shadow-[0_4px_0_var(--color-ink)] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
        >
          <Download className="size-5" aria-hidden="true" />
          {t('settings.saves.export')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void withGame(async (game) => {
              const { getSaveManager } = await import('@/state/persistence');
              await getSaveManager().autosave(game, new Date().toISOString());
              const { useGameStore } = await import('@/state/gameStore');
              navigate('/');
              useGameStore.getState().unload();
            })
          }
          className="flex h-11 items-center gap-2 rounded-[14px] border-[3px] border-ink bg-coral px-4 font-display tracking-wide text-white shadow-[0_4px_0_var(--color-ink)] [text-shadow:0_2px_0_rgb(30_35_64/0.45)] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
        >
          <LogOut className="size-5" aria-hidden="true" />
          {t('settings.quit')}
        </button>
      </div>
    </Section>
  );
}

/**
 * Settings as a physical control board (docs/05 §5.19, §10): faders for the five audio channels,
 * graphics, comfort and gameplay switches, and, in game, the save slots and quit.
 */
export interface SettingsBoardProps {
  onClose(): void;
  /** In game: the current game, for the save slots and quit. The title screen has none. */
  getGame?: () => GameState | null;
}

export function SettingsBoard({ onClose, getGame }: SettingsBoardProps) {
  const { t } = useTranslation('shell');
  const settings = useSettingsStore((store) => store.settings);
  const update = useSettingsStore((store) => store.update);
  const setVolume = useSettingsStore((store) => store.setVolume);
  const channels: (keyof Settings['volume'])[] = ['master', 'music', 'sfx', 'voices', 'ambience'];
  const textSize = TEXT_SIZES.find((size) => Number(size) === settings.textScale) ?? '1';

  return (
    <div className="settings-board flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border-[3px] border-ink text-ink shadow-[0_6px_0_var(--color-ink)] [@media(max-height:540px)]:rounded-none [@media(max-width:899px)]:rounded-none">
      <header className="flex items-center gap-3 border-b-[3px] border-ink bg-wood px-4 py-3 shadow-[inset_0_-5px_0_var(--color-woodDark)]">
        <span
          className="grid size-10 -rotate-6 place-items-center rounded-xl border-[3px] border-ink bg-sun"
          aria-hidden="true"
        >
          <SlidersHorizontal className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-none tracking-wide text-paper [text-shadow:0_2px_0_var(--color-ink)]">
            {t('settings.title')}
          </h2>
          <p className="font-hand text-lg leading-none font-bold text-sunLight">
            {t('settings.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            playSfx('ui.close');
            onClose();
          }}
          aria-label={t('sheet.close')}
          className="grid size-11 place-items-center rounded-xl border-[3px] border-ink bg-paper text-ink shadow-[0_3px_0_var(--color-ink)] active:translate-y-[3px] active:shadow-none"
        >
          <X className="size-6" strokeWidth={3} />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 pb-6">
        <Section icon={<Volume2 />} title={t('settings.section.sound')}>
          {channels.map((channel) => (
            <Fader
              key={channel}
              label={t(`settings.volume.${channel}`)}
              value={settings.volume[channel]}
              onChange={(value) => setVolume(channel, value)}
            />
          ))}
        </Section>
        <Section icon={<MonitorSmartphone />} title={t('settings.section.graphics')}>
          <div className="space-y-2">
            <p className="font-display tracking-wide">{t('settings.quality.label')}</p>
            <SegmentedControl<Settings['quality']>
              label={t('settings.quality.label')}
              size="sm"
              value={settings.quality}
              onChange={(quality) => {
                playSfx('ui.tab');
                update({ quality });
              }}
              options={(['auto', 'low', 'medium', 'high'] as const).map((value) => ({
                value,
                label: t(`settings.quality.${value}`),
              }))}
            />
            <p className="text-sm text-ink/65">{t('settings.quality.hint')}</p>
          </div>
          <Rocker
            label={t('settings.screenShake')}
            hint={t('settings.screenShakeHint')}
            checked={settings.screenShake}
            onChange={(screenShake) => update({ screenShake })}
          />
        </Section>
        <Section icon={<Accessibility />} title={t('settings.section.comfort')}>
          <Rocker
            label={t('settings.reducedMotion')}
            hint={t('settings.reducedMotionHint')}
            checked={settings.reducedMotion}
            onChange={(reducedMotion) => update({ reducedMotion })}
          />
          <div className="space-y-2">
            <p className="font-display tracking-wide">{t('settings.textSize')}</p>
            <SegmentedControl<(typeof TEXT_SIZES)[number]>
              label={t('settings.textSize')}
              size="sm"
              value={textSize}
              onChange={(size) => {
                playSfx('ui.tab');
                update({ textScale: Number(size) });
              }}
              options={TEXT_SIZES.map((value) => ({
                value,
                label: t('settings.textSizeValue', { pct: Math.round(Number(value) * 100) }),
              }))}
            />
          </div>
          <Rocker
            label={t('settings.dyslexiaFont')}
            hint={t('settings.dyslexiaFontHint')}
            checked={settings.dyslexiaFont}
            onChange={(dyslexiaFont) => update({ dyslexiaFont })}
          />
        </Section>
        <Section icon={<Gamepad2 />} title={t('settings.section.gameplay')}>
          <Rocker
            label={t('settings.pauseOnInteraction')}
            hint={t('settings.pauseOnInteractionHint')}
            checked={settings.pauseOnInteraction}
            onChange={(pauseOnInteraction) => update({ pauseOnInteraction })}
          />
        </Section>
        {getGame ? <SavesSection getGame={getGame} /> : null}
        <Section icon={<Keyboard />} title={t('settings.section.controls')}>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
            <dt>
              <Keycap>Space</Keycap>
            </dt>
            <dd>{t('settings.controls.pause')}</dd>
            <dt className="flex gap-1">
              <Keycap>1</Keycap>
              <Keycap>2</Keycap>
              <Keycap>3</Keycap>
            </dt>
            <dd>{t('settings.controls.speed')}</dd>
            <dt className="flex gap-1">
              <Keycap>I</Keycap>
              <Keycap>P</Keycap>
              <Keycap>O</Keycap>
              <Keycap>C</Keycap>
            </dt>
            <dd>{t('settings.controls.sheets')}</dd>
            <dt>
              <Keycap>Esc</Keycap>
            </dt>
            <dd>{t('settings.controls.back')}</dd>
          </dl>
        </Section>
      </div>
    </div>
  );
}
