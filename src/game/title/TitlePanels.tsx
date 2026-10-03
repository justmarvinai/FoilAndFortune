import { FileUp, FolderOpen, Heart, Trash, X } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '@/audio';
import { dayToDate } from '@/core/calendar';
import { formatMoney } from '@/core/money';
import type { SaveSlotId } from '@/save/saveFile';
import type { SlotInfo } from '@/save/saveManager';
import { groupSlots, playTimeParts, relativeAgo } from './saveSlots';

/** A paper panel over the dimmed street (Load, Credits, Settings on the title). */
export function TitlePanel({
  label,
  onClose,
  children,
  wide = false,
  closeButton = true,
}: {
  label: string;
  onClose(): void;
  children: ReactNode;
  wide?: boolean;
  /** Off when the content brings its own close key (the settings board). */
  closeButton?: boolean;
}) {
  const { t } = useTranslation('shell');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="fixed inset-0 z-20 grid place-items-center p-4 [@media(max-height:540px)]:p-2">
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        initial={{ y: 60, rotate: -2, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className={`relative flex max-h-[calc(100dvh-2rem)] w-full flex-col outline-none [@media(max-height:540px)]:max-h-[calc(100dvh-1rem)] ${wide ? 'max-w-2xl' : 'max-w-xl'}`}
      >
        {children}
        {closeButton ? (
          <button
            type="button"
            onClick={() => {
              playSfx('ui.close');
              onClose();
            }}
            aria-label={t('load.close')}
            className="absolute -top-3 -right-3 z-10 grid size-11 place-items-center rounded-full border-[3px] border-ink bg-coral text-white shadow-[0_3px_0_var(--color-ink)] active:translate-y-[3px] active:shadow-none [@media(max-height:540px)]:top-1 [@media(max-height:540px)]:right-1"
          >
            <X className="size-6" strokeWidth={3} />
          </button>
        ) : null}
      </motion.div>
    </div>
  );
}

function SlotCard({
  info,
  label,
  onLoad,
  onDelete,
}: {
  info: SlotInfo | null;
  label: string;
  onLoad?(): void;
  onDelete?(): void;
}) {
  const { t } = useTranslation('shell');
  const tc = useTranslation().t;
  const [confirming, setConfirming] = useState(false);
  if (!info) {
    return (
      <li className="flex h-[74px] items-center gap-3 rounded-2xl border-[3px] border-dashed border-ink/30 px-4 text-ink/45">
        <span className="w-28 font-display tracking-wide">{label}</span>
        <span className="font-hand text-xl">{t('load.empty')}</span>
      </li>
    );
  }
  const date = dayToDate(info.summary.day);
  const play = playTimeParts(info.summary.playTimeMs);
  return (
    <li className="relative flex items-center gap-3 rounded-2xl border-[3px] border-ink bg-white px-4 py-2.5 shadow-[0_4px_0_var(--color-ink)] [background-image:linear-gradient(90deg,transparent_6.5rem,rgb(255_111_89/0.35)_6.5rem,rgb(255_111_89/0.35)_calc(6.5rem+2px),transparent_calc(6.5rem+2px))]">
      <span className="w-[5.5rem] shrink-0 font-display leading-tight tracking-wide text-ink/70">
        {label}
      </span>
      <span className="min-w-0 flex-1 pl-2">
        <span className="block truncate font-hand text-2xl leading-none font-bold">
          {info.summary.shopName}
        </span>
        <span className="block truncate text-sm font-semibold text-ink/70">
          {t('load.stats', { day: info.summary.day, level: info.summary.level })} ·{' '}
          {tc(`season.${date.season}`)} {date.dayOfSeason} · {formatMoney(info.summary.cashCents)}
        </span>
        <span className="block truncate text-xs text-ink/50">
          {t('load.savedAgo', { ago: relativeAgo(info.savedAt, Date.now()) })} ·{' '}
          {t('load.playTime', {
            time:
              play.hours > 0
                ? t('time.hoursMinutes', {
                    hours: play.hours,
                    minutes: String(play.minutes).padStart(2, '0'),
                  })
                : t('time.minutes', { minutes: play.minutes }),
          })}
        </span>
      </span>
      {confirming ? (
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold">{t('load.deleteConfirm')}</span>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              onDelete?.();
            }}
            className="h-10 rounded-xl border-[3px] border-ink bg-coral px-3 font-display text-white shadow-[0_3px_0_var(--color-ink)]"
          >
            {t('load.deleteYes')}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-10 rounded-xl border-[3px] border-ink bg-white px-3 font-display shadow-[0_3px_0_var(--color-ink)]"
          >
            {t('load.deleteNo')}
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {onDelete ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={t('load.deleteAria', { slot: label })}
              className="grid size-11 place-items-center rounded-xl text-ink/50 hover:bg-coral/15 hover:text-coral"
            >
              <Trash className="size-5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onLoad}
            aria-label={t('load.loadAria', {
              slot: label,
              shop: info.summary.shopName,
              day: info.summary.day,
            })}
            className="flex h-11 items-center gap-1.5 rounded-xl border-[3px] border-ink bg-teal px-4 font-display text-lg tracking-wide text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.15),0_4px_0_var(--color-ink)] [text-shadow:0_2px_0_rgb(30_35_64/0.45)] active:translate-y-[4px] active:shadow-none"
          >
            <FolderOpen className="size-5" aria-hidden="true" />
            {t('load.loadButton')}
          </button>
        </span>
      )}
    </li>
  );
}

/** Save slots as index cards in a filing drawer, plus `.ffsave` import (docs/05 §5.19). */
export function LoadPanel({
  slots,
  onClose,
  onLoad,
  onDelete,
  onImport,
}: {
  slots: SlotInfo[] | null;
  onClose(): void;
  onLoad(slot: SaveSlotId): void;
  onDelete(slot: SaveSlotId): void;
  onImport(file: File): void;
}) {
  const { t } = useTranslation('shell');
  const fileRef = useRef<HTMLInputElement>(null);
  const grouped = slots ? groupSlots(slots) : null;
  return (
    <TitlePanel label={t('load.title')} onClose={onClose} wide>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border-[3px] border-ink bg-paper2 text-ink shadow-[0_8px_0_var(--color-ink)]">
        <header className="border-b-[3px] border-ink bg-wood px-5 py-3 shadow-[inset_0_-5px_0_var(--color-woodDark)]">
          <h2 className="font-display text-3xl leading-none tracking-wide text-paper [text-shadow:0_2px_0_var(--color-ink)]">
            {t('load.title')}
          </h2>
          <p className="font-hand text-xl leading-none font-bold text-sunLight">
            {t('load.subtitle')}
          </p>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 [@media(max-height:540px)]:p-3">
          {!grouped ? (
            <p className="font-display text-lg text-ink/60">{t('load.loading')}</p>
          ) : (
            <>
              {slots && slots.length === 0 ? (
                <p className="font-hand text-2xl text-ink/70">{t('load.none')}</p>
              ) : null}
              <section>
                <h3 className="mb-2 font-display text-sm tracking-widest text-ink/60 uppercase">
                  {t('load.manual')}
                </h3>
                <ul className="space-y-3">
                  {grouped.manual.map(({ slot, info }) => (
                    <SlotCard
                      key={slot}
                      info={info}
                      label={t(`load.slot.${slot}`)}
                      onLoad={() => onLoad(slot)}
                      onDelete={() => onDelete(slot)}
                    />
                  ))}
                </ul>
              </section>
              {grouped.auto.length > 0 ? (
                <section>
                  <h3 className="mb-2 font-display text-sm tracking-widest text-ink/60 uppercase">
                    {t('load.auto')}
                  </h3>
                  <ul className="space-y-3">
                    {grouped.auto.map((info) => (
                      <SlotCard
                        key={info.slot}
                        info={info}
                        label={t(`load.slot.${info.slot}`)}
                        onLoad={() => onLoad(info.slot)}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
        <footer className="flex flex-wrap items-center gap-3 border-t-[3px] border-ink bg-paper px-5 py-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-12 items-center gap-2 rounded-[14px] border-[3px] border-ink bg-sun px-4 font-display text-lg tracking-wide text-ink shadow-[inset_0_-4px_0_rgb(0_0_0/0.12),0_4px_0_var(--color-ink)] active:translate-y-[4px] active:shadow-none"
          >
            <FileUp className="size-5" aria-hidden="true" />
            {t('load.import')}
          </button>
          <span className="text-sm text-ink/60">{t('load.importHint')}</span>
          <input
            ref={fileRef}
            type="file"
            accept=".ffsave,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onImport(file);
            }}
          />
        </footer>
      </div>
    </TitlePanel>
  );
}

type FontName = 'lilita' | 'nunito' | 'barlow' | 'barlowCondensed' | 'caveat' | 'atkinson';

const LICENSES: readonly { file: string; name: FontName; license: 'licenseOfl' }[] = [
  { file: 'lilita-one-OFL.txt', name: 'lilita', license: 'licenseOfl' },
  { file: 'nunito-OFL.txt', name: 'nunito', license: 'licenseOfl' },
  { file: 'barlow-OFL.txt', name: 'barlow', license: 'licenseOfl' },
  { file: 'barlow-condensed-OFL.txt', name: 'barlowCondensed', license: 'licenseOfl' },
  { file: 'caveat-OFL.txt', name: 'caveat', license: 'licenseOfl' },
  { file: 'atkinson-hyperlegible-OFL.txt', name: 'atkinson', license: 'licenseOfl' },
];

const CODE_LICENSES: readonly {
  file: string;
  name: 'lucide' | 'thirdParty' | 'apache';
  license: 'licenseIsc' | 'licenseList' | 'licenseApache';
}[] = [
  { file: 'lucide-ISC.txt', name: 'lucide', license: 'licenseIsc' },
  { file: 'third-party-code.txt', name: 'thirdParty', license: 'licenseList' },
  { file: 'apache-2.0.txt', name: 'apache', license: 'licenseApache' },
];

function LicenseLink({ file, name, license }: { file: string; name: string; license: string }) {
  return (
    <li>
      <a
        href={`/licenses/${file}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1 hover:bg-sun/30"
      >
        <span className="font-display tracking-wide">{name}</span>
        <span className="text-sm text-ink/60 underline decoration-dotted underline-offset-2">
          {license}
        </span>
      </a>
    </li>
  );
}

/** A thank-you note on lined paper that points at the bundled licenses (public/licenses). */
export function CreditsPanel({ onClose }: { onClose(): void }) {
  const { t } = useTranslation('shell');
  return (
    <TitlePanel label={t('credits.title')} onClose={onClose}>
      <div className="min-h-0 overflow-y-auto rounded-[6px_22px_22px_22px] border-[3px] border-ink bg-paper p-6 pl-12 text-ink shadow-[0_8px_0_var(--color-ink)] [background-image:linear-gradient(90deg,transparent_2.25rem,rgb(255_111_89/0.45)_2.25rem,rgb(255_111_89/0.45)_calc(2.25rem+2px),transparent_calc(2.25rem+2px)),repeating-linear-gradient(transparent_0_31px,rgb(77_168_255/0.25)_31px_32px)] [@media(max-height:540px)]:p-4 [@media(max-height:540px)]:pl-12">
        <h2 className="flex items-center gap-2 font-display text-3xl tracking-wide">
          {t('credits.title')}
          <Heart className="size-6 fill-coral text-coral" aria-hidden="true" />
        </h2>
        <p className="mt-2 font-hand text-2xl leading-8 font-bold">{t('credits.thanks')}</p>
        <p className="leading-8">{t('credits.madeWith')}</p>
        <p className="leading-8 text-ink/70">{t('credits.fictional')}</p>
        <h3 className="mt-4 font-display text-lg tracking-wide">{t('credits.fonts')}</h3>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {LICENSES.map((entry) => (
            <LicenseLink
              key={entry.file}
              file={entry.file}
              name={t(`credits.font.${entry.name}`)}
              license={t(`credits.${entry.license}`)}
            />
          ))}
        </ul>
        <h3 className="mt-4 font-display text-lg tracking-wide">{t('credits.code')}</h3>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {CODE_LICENSES.map((entry) => (
            <LicenseLink
              key={entry.file}
              file={entry.file}
              name={t(`credits.lib.${entry.name}`)}
              license={t(`credits.${entry.license}`)}
            />
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink/60">{t('credits.licensesHint')}</p>
        <p className="mt-4 text-right font-hand text-2xl font-bold">{t('credits.signoff')}</p>
      </div>
    </TitlePanel>
  );
}
