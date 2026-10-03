import {
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Crown,
  Dices,
  PenLine,
  Store,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '@/audio';
import { type Difficulty, difficultyBalance } from '@/content/balance/difficulty';
import { shopTiers } from '@/content/balance/shop';
import { formatMoney } from '@/core/money';
import type { AvatarSpec } from '@/sim/state/types';
import { Stamp } from '@/ui/components/Stamp';
import { Sticker } from '@/ui/components/Sticker';
import { AvatarPortrait } from './AvatarPortrait';
import {
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_SKINS,
  AVATAR_TOP_COLORS,
  AVATAR_TOPS,
  type AvatarPart,
  DEFAULT_AVATAR,
  randomAvatar,
} from './avatar';
import './newgame.css';

export interface NewGameChoice {
  shopName: string;
  difficulty: Difficulty;
  owner: AvatarSpec;
}

const STEPS = ['owner', 'permit', 'sign'] as const;
type Step = (typeof STEPS)[number];
const DIFFICULTIES: readonly Difficulty[] = ['cozy', 'standard', 'tycoon'];
const MAX_NAME = 28;

function Swatches({
  part,
  label,
  colors,
  value,
  onPick,
}: {
  part: AvatarPart;
  label: string;
  colors: readonly string[];
  value: number;
  onPick(part: AvatarPart, index: number): void;
}) {
  const { t } = useTranslation('shell');
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="mb-1 font-display text-sm tracking-wide text-ink/70">{label}</legend>
      {colors.map((color, index) => (
        <label
          key={color}
          className="relative grid size-8 cursor-pointer place-items-center rounded-full border-[3px] border-ink shadow-[0_2px_0_var(--color-ink)] transition-transform has-[:checked]:-translate-y-0.5 has-[:checked]:ring-[3px] has-[:checked]:ring-teal has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-sky has-[:focus-visible]:outline-offset-2 hover:-translate-y-0.5"
          style={{ background: color }}
        >
          <input
            type="radio"
            className="sr-only"
            name={part}
            checked={value === index}
            aria-label={t('newGame.avatar.swatch', { part: label, n: index + 1 })}
            onChange={() => onPick(part, index)}
          />
          {value === index ? (
            <Check
              className="size-4 text-white [filter:drop-shadow(0_1px_0_var(--color-ink))]"
              strokeWidth={4}
              aria-hidden="true"
            />
          ) : null}
        </label>
      ))}
    </fieldset>
  );
}

function Chips<T extends string>({
  part,
  label,
  options,
  value,
  text,
  onPick,
}: {
  part: AvatarPart;
  label: string;
  options: readonly T[];
  value: number;
  text(option: T): string;
  onPick(part: AvatarPart, index: number): void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="mb-1 font-display text-sm tracking-wide text-ink/70">{label}</legend>
      {options.map((option, index) => (
        <label
          key={option}
          className="cursor-pointer rounded-lg border-[2.5px] border-ink bg-white px-2 py-0.5 text-sm font-bold shadow-[0_2px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 has-[:checked]:translate-y-[2px] has-[:checked]:bg-teal has-[:checked]:text-white has-[:checked]:shadow-none has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-sky has-[:focus-visible]:outline-offset-2"
        >
          <input
            type="radio"
            className="sr-only"
            name={part}
            checked={value === index}
            onChange={() => onPick(part, index)}
          />
          {text(option)}
        </label>
      ))}
    </fieldset>
  );
}

function StepOwner({
  shopName,
  setShopName,
  owner,
  setOwner,
}: {
  shopName: string;
  setShopName(name: string): void;
  owner: AvatarSpec;
  setOwner(spec: AvatarSpec): void;
}) {
  const { t } = useTranslation('shell');
  const nameId = useId();
  const [bounce, setBounce] = useState(0);
  const pick = (part: AvatarPart, index: number) => {
    playSfx('ui.tab');
    setOwner({ ...owner, [part]: index });
    setBounce((count) => count + 1);
  };
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto] [@media(max-height:540px)]:grid-cols-[1fr_auto] [@media(max-height:540px)]:gap-4">
      <div className="space-y-4">
        <div>
          <label
            htmlFor={nameId}
            className="font-display text-sm tracking-widest text-ink/60 uppercase"
          >
            {t('newGame.shopName')}
          </label>
          <input
            id={nameId}
            value={shopName}
            maxLength={MAX_NAME}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setShopName(event.target.value)}
            className="reg-field block w-full bg-transparent py-1 font-hand text-4xl leading-tight font-bold text-ink outline-none focus-visible:bg-sun/15 [@media(max-height:540px)]:text-3xl"
          />
          <p className={`mt-1 text-sm ${shopName.trim() ? 'text-ink/60' : 'font-bold text-coral'}`}>
            {shopName.trim() ? t('newGame.shopNameHint') : t('newGame.shopNameRequired')}
          </p>
        </div>
        <div>
          <p className="font-display text-sm tracking-widest text-ink/60 uppercase">
            {t('newGame.premises')}
          </p>
          <p className="reg-field py-1 font-hand text-2xl font-bold text-ink/80">
            {t('newGame.premisesValue')}
          </p>
        </div>
        <div className="space-y-2.5">
          <Swatches
            part="skin"
            label={t('newGame.avatar.skin')}
            colors={AVATAR_SKINS}
            value={owner.skin}
            onPick={pick}
          />
          <Chips
            part="hairStyle"
            label={t('newGame.avatar.hairStyle')}
            options={AVATAR_HAIR_STYLES}
            value={owner.hairStyle}
            text={(style) => t(`newGame.avatar.hair.${style}`)}
            onPick={pick}
          />
          <Swatches
            part="hairColor"
            label={t('newGame.avatar.hairColor')}
            colors={AVATAR_HAIR_COLORS}
            value={owner.hairColor}
            onPick={pick}
          />
          <Chips
            part="top"
            label={t('newGame.avatar.top')}
            options={AVATAR_TOPS}
            value={owner.top}
            text={(style) => t(`newGame.avatar.outfit.${style}`)}
            onPick={pick}
          />
          <Swatches
            part="topColor"
            label={t('newGame.avatar.topColor')}
            colors={AVATAR_TOP_COLORS}
            value={owner.topColor}
            onPick={pick}
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="font-display text-sm tracking-widest text-ink/60 uppercase">
          {t('newGame.proprietor')}
        </p>
        <div className="relative rotate-2 rounded-md border-[3px] border-ink bg-white p-2 pb-8 shadow-[0_5px_0_var(--color-ink)] [@media(max-height:540px)]:pb-5">
          <span
            className="absolute -top-3 left-1/2 h-6 w-16 -translate-x-1/2 -rotate-3 bg-sunLight/90 shadow-sm"
            aria-hidden="true"
          />
          <div
            key={bounce}
            className={`grid size-44 place-items-center overflow-hidden rounded-sm bg-sky ${bounce ? 'portrait-bounce' : ''} [@media(max-height:540px)]:size-28`}
          >
            <AvatarPortrait
              spec={owner}
              expression={bounce % 2 ? 'excited' : 'happy'}
              title={t('newGame.portraitAlt')}
              className="size-full translate-y-3"
            />
          </div>
          <p className="absolute inset-x-0 bottom-1 text-center font-hand text-lg leading-none font-bold [@media(max-height:540px)]:text-sm">
            {shopName.trim() || t('newGame.defaultShopName')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            playSfx('ui.pop');
            setOwner(randomAvatar(Math.random));
            setBounce((count) => count + 1);
          }}
          className="flex h-11 items-center gap-2 rounded-xl border-[3px] border-ink bg-sun px-3 font-display tracking-wide shadow-[0_4px_0_var(--color-ink)] active:translate-y-[4px] active:shadow-none"
        >
          <Dices className="size-5" aria-hidden="true" />
          {t('newGame.avatar.shuffle')}
        </button>
      </div>
    </div>
  );
}

const PERMIT_STYLE: Record<Difficulty, { band: string; icon: ReactNode }> = {
  cozy: { band: 'bg-mint text-ink', icon: <Coffee className="size-7" strokeWidth={2.5} /> },
  standard: { band: 'bg-sun text-ink', icon: <Store className="size-7" strokeWidth={2.5} /> },
  tycoon: { band: 'bg-coral text-white', icon: <Crown className="size-7" strokeWidth={2.5} /> },
};

function StepPermit({
  difficulty,
  setDifficulty,
}: {
  difficulty: Difficulty;
  setDifficulty(value: Difficulty): void;
}) {
  const { t } = useTranslation('shell');
  const tc = useTranslation().t;
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display text-2xl tracking-wide">{t('newGame.permit.title')}</h3>
        <p className="text-sm text-ink/65">{t('newGame.permit.hint')}</p>
      </div>
      <div
        role="radiogroup"
        aria-label={t('newGame.permit.title')}
        className="grid gap-4 pt-3 sm:grid-cols-3 [@media(max-height:540px)]:grid-cols-3 [@media(max-height:540px)]:gap-2 [@media(max-height:540px)]:pt-2"
      >
        {DIFFICULTIES.map((value) => {
          const balance = difficultyBalance[value];
          const weeklyRent = Math.round(
            (shopTiers[0]?.dailyRent ?? 0) * 7 * balance.rentMultiplier,
          );
          const selected = value === difficulty;
          return (
            // biome-ignore lint/a11y/useSemanticElements: big permit cards act as one radio group; a native radio can't hold this layout.
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                playSfx('ui.pop');
                setDifficulty(value);
              }}
              className={`permit-card relative flex flex-col overflow-hidden rounded-2xl border-[3px] border-ink bg-white text-left shadow-[0_5px_0_var(--color-ink)] transition-[translate,box-shadow] duration-200 ${selected ? 'ring-4 ring-teal' : 'hover:-translate-y-1'}`}
            >
              <span
                className={`flex items-center gap-2 border-b-[3px] border-ink px-3 py-2 ${PERMIT_STYLE[value].band}`}
              >
                <span aria-hidden="true">{PERMIT_STYLE[value].icon}</span>
                <span className="font-display text-2xl tracking-wide [@media(max-height:540px)]:text-lg">
                  {tc(`difficulty.${value}`)}
                </span>
              </span>
              <span className="flex flex-1 flex-col gap-2 p-3 [@media(max-height:540px)]:gap-1 [@media(max-height:540px)]:p-2">
                <span className="text-sm leading-snug font-semibold text-ink/75 [@media(max-height:540px)]:text-xs">
                  {tc(`difficulty.${value}Blurb`)}
                </span>
                <dl className="mt-auto grid grid-cols-[1fr_auto] gap-x-2 text-sm [@media(max-height:540px)]:text-xs">
                  <dt className="text-ink/60">{t('newGame.permit.startingCash')}</dt>
                  <dd className="font-display tabular-nums">
                    {formatMoney(balance.startingCash, { hideZeroCents: true })}
                  </dd>
                  <dt className="text-ink/60">{t('newGame.permit.rent')}</dt>
                  <dd className="font-display tabular-nums">
                    {weeklyRent > 0
                      ? t('newGame.permit.rentWeekly', {
                          amount: formatMoney(weeklyRent, { hideZeroCents: true }),
                        })
                      : t('newGame.permit.rentNone')}
                  </dd>
                  <dt className="text-ink/60">{t('newGame.permit.bankruptcy')}</dt>
                  <dd className="font-display">
                    {balance.bankruptcy
                      ? t('newGame.permit.bankruptcyYes')
                      : t('newGame.permit.bankruptcyNo')}
                  </dd>
                </dl>
              </span>
              {value === 'standard' ? (
                <span className="absolute top-1 right-1">
                  <Sticker color="var(--color-teal)" rotate={6} className="text-xs">
                    {t('newGame.permit.recommended')}
                  </Sticker>
                </span>
              ) : null}
              {selected ? (
                <span className="pointer-events-none absolute right-2 bottom-2 -rotate-12 rounded-md border-[3px] border-teal px-1.5 font-display text-sm tracking-widest text-teal uppercase mix-blend-multiply">
                  {t('newGame.permit.approved')}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepSign({
  choice,
  signed,
  onSign,
}: {
  choice: NewGameChoice;
  signed: boolean;
  onSign(): void;
}) {
  const { t } = useTranslation('shell');
  const tc = useTranslation().t;
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr] [@media(max-height:540px)]:grid-cols-[auto_1fr] [@media(max-height:540px)]:gap-4">
      <div className="grid size-36 place-items-center overflow-hidden rounded-md border-[3px] border-ink bg-sky shadow-[0_4px_0_var(--color-ink)] [@media(max-height:540px)]:size-24">
        <AvatarPortrait
          spec={choice.owner}
          expression={signed ? 'excited' : 'happy'}
          className="size-full translate-y-3"
        />
      </div>
      <div className="space-y-3">
        <h3 className="font-display text-2xl tracking-wide">{t('newGame.sign.title')}</h3>
        <p className="font-hand text-2xl leading-tight font-bold [@media(max-height:540px)]:text-xl">
          {t('newGame.sign.pledge', { shop: choice.shopName })}
        </p>
        <p className="text-sm text-ink/70">
          {tc(`difficulty.${choice.difficulty}`)} · {t('newGame.premisesValue')}
        </p>
        <div className="relative grid grid-cols-[1fr_auto] items-end gap-4">
          <div>
            <div className="reg-field relative h-14">
              {signed ? (
                <svg
                  viewBox="0 0 300 60"
                  className="absolute inset-0 h-full w-full"
                  aria-hidden="true"
                >
                  <path
                    className="signature-path"
                    d="M8 42 C 30 8, 40 8, 44 40 S 70 52, 84 24 S 110 10, 116 38 S 150 48, 170 22 S 200 12, 214 36 S 250 46, 292 18"
                    fill="none"
                    stroke="var(--color-sky)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              ) : null}
            </div>
            <p className="mt-1 text-xs tracking-widest text-ink/60 uppercase">
              {t('newGame.sign.signature')}
            </p>
          </div>
          <div>
            <p className="reg-field font-hand text-xl font-bold">{t('newGame.sign.dateValue')}</p>
            <p className="mt-1 text-xs tracking-widest text-ink/60 uppercase">
              {t('newGame.sign.date')}
            </p>
          </div>
          {signed ? (
            <span className="pointer-events-none absolute -top-6 right-6">
              <Stamp text={t('newGame.sign.stamp')} color="var(--color-coral)" rotate={-14} />
            </span>
          ) : null}
        </div>
        {signed ? (
          <p className="font-display text-lg tracking-wide text-teal" role="status">
            {t('newGame.sign.opening')}
          </p>
        ) : (
          <button
            type="button"
            onClick={onSign}
            className="flex h-14 items-center gap-2 rounded-[14px] border-[3px] border-ink bg-coral px-6 font-display text-2xl tracking-wide text-white shadow-[inset_0_-4px_0_rgb(0_0_0/0.15),0_4px_0_var(--color-ink)] [text-shadow:0_2px_0_rgb(30_35_64/0.45)] transition-[translate,box-shadow] duration-75 hover:-translate-y-px active:translate-y-[4px] active:shadow-none"
          >
            <PenLine className="size-6" aria-hidden="true" />
            {t('newGame.sign.button')}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * New Game (docs/05 §5.2): a shop registration form on a clipboard, in three steps: you and
 * your shop (name and owner avatar), the business permit (difficulty) and signing, which stamps
 * the form and opens the shop. The caller starts the game in `onDone`.
 */
export function NewGameForm({
  onCancel,
  onDone,
}: {
  onCancel(): void;
  onDone(choice: NewGameChoice): void;
}) {
  const { t } = useTranslation('shell');
  const [step, setStep] = useState<Step>('owner');
  const [shopName, setShopName] = useState(() => t('newGame.defaultShopName'));
  const [owner, setOwner] = useState<AvatarSpec>(DEFAULT_AVATAR);
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [signed, setSigned] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const index = STEPS.indexOf(step);
  const name = shopName.trim();
  const choice: NewGameChoice = { shopName: name, difficulty, owner };

  useEffect(() => {
    paperRef.current?.focus({ preventScroll: true });
  }, []);

  const go = (delta: number) => {
    const next = STEPS[index + delta];
    if (!next) return;
    playSfx(delta > 0 ? 'ui.open' : 'ui.close');
    setStep(next);
  };

  const sign = () => {
    if (signed || !name) return;
    setSigned(true);
    playSfx('ui.stamp');
    // Let the pen and the stamp land before the keys change hands.
    window.setTimeout(() => onDone(choice), 1300);
  };

  return (
    <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto p-4 [@media(max-height:540px)]:p-1.5">
      <motion.div
        initial={{ y: 120, rotate: 4, opacity: 0 }}
        animate={{ y: 0, rotate: -0.6, opacity: 1 }}
        exit={{ y: 140, rotate: 6, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="reg-board relative w-full max-w-3xl rounded-[26px] border-[3px] border-ink p-4 pt-9 shadow-[0_10px_0_var(--color-ink)] [@media(max-height:540px)]:max-w-[52rem] [@media(max-height:540px)]:p-2 [@media(max-height:540px)]:pt-6"
      >
        {/* The clipboard clip. */}
        <span
          className="reg-clip absolute -top-4 left-1/2 h-10 w-40 -translate-x-1/2 rounded-xl border-[3px] border-ink shadow-[0_4px_0_var(--color-ink)] [@media(max-height:540px)]:h-7 [@media(max-height:540px)]:w-28"
          aria-hidden="true"
        />
        <div
          ref={paperRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reg-title"
          tabIndex={-1}
          className="reg-paper relative max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-md border-[3px] border-ink py-5 pr-6 pl-14 text-ink shadow-[0_4px_0_rgb(30_35_64/0.35)] outline-none [@media(max-height:540px)]:max-h-[calc(100dvh-3.5rem)] [@media(max-height:540px)]:py-3 [@media(max-height:540px)]:pr-3 [@media(max-height:540px)]:pl-12"
        >
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold tracking-[0.2em] text-ink/55 uppercase">
                {t('newGame.office')}
              </p>
              <h2
                id="reg-title"
                className="font-display text-4xl leading-none tracking-wide [@media(max-height:540px)]:text-2xl"
              >
                {t('newGame.formTitle')}
              </h2>
            </div>
            <span className="rotate-3 rounded-md border-[3px] border-coral/70 px-2 py-0.5 font-display tracking-widest text-coral/80 uppercase">
              {t('newGame.formNo')}
            </span>
          </header>
          <ol className="my-4 flex flex-wrap gap-2 [@media(max-height:540px)]:my-2">
            {STEPS.map((id, position) => (
              <li
                key={id}
                aria-current={id === step ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-lg border-[2.5px] px-2 py-1 text-sm font-bold ${
                  id === step
                    ? 'border-ink bg-sun text-ink'
                    : position < index
                      ? 'border-ink/40 bg-mintLight text-ink/70'
                      : 'border-ink/25 text-ink/45'
                }`}
              >
                <span className="grid size-5 place-items-center rounded border-2 border-current text-xs">
                  {position < index ? (
                    <Check className="size-3.5" strokeWidth={4} aria-hidden="true" />
                  ) : (
                    position + 1
                  )}
                </span>
                {t(`newGame.steps.${id}`)}
              </li>
            ))}
          </ol>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.18 }}
            >
              {step === 'owner' ? (
                <StepOwner
                  shopName={shopName}
                  setShopName={setShopName}
                  owner={owner}
                  setOwner={setOwner}
                />
              ) : step === 'permit' ? (
                <StepPermit difficulty={difficulty} setDifficulty={setDifficulty} />
              ) : (
                <StepSign choice={choice} signed={signed} onSign={sign} />
              )}
            </motion.div>
          </AnimatePresence>
          <footer className="sticky -bottom-5 z-10 mt-5 -mb-5 flex items-center justify-between gap-3 border-t-2 border-dashed border-ink/25 bg-paper/95 pt-4 pb-5 [@media(max-height:540px)]:-bottom-3 [@media(max-height:540px)]:-mb-3 [@media(max-height:540px)]:pb-3 [@media(max-height:540px)]:mt-3 [@media(max-height:540px)]:pt-2">
            {index === 0 ? (
              <button
                type="button"
                onClick={onCancel}
                className="h-11 rounded-xl px-3 font-display tracking-wide text-ink/70 hover:bg-ink/5"
              >
                {t('newGame.cancel')}
              </button>
            ) : (
              <button
                type="button"
                disabled={signed}
                onClick={() => go(-1)}
                className="flex h-11 items-center gap-1 rounded-xl border-[3px] border-ink bg-white px-3 font-display tracking-wide shadow-[0_4px_0_var(--color-ink)] active:translate-y-[4px] active:shadow-none disabled:opacity-40"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
                {t('newGame.back')}
              </button>
            )}
            {step !== 'sign' ? (
              <button
                type="button"
                disabled={!name}
                onClick={() => go(1)}
                className="flex h-12 items-center gap-1 rounded-xl border-[3px] border-ink bg-teal px-5 font-display text-xl tracking-wide text-white shadow-[inset_0_-4px_0_rgb(0_0_0/0.15),0_4px_0_var(--color-ink)] [text-shadow:0_2px_0_rgb(30_35_64/0.45)] active:translate-y-[4px] active:shadow-none disabled:opacity-45"
              >
                {t('newGame.next')}
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            ) : null}
          </footer>
        </div>
        {step === 'owner' ? (
          <p className="pointer-events-none absolute top-40 right-[calc(100%-1.5rem)] hidden w-48 -rotate-6 rounded-sm bg-sunLight p-3 font-hand text-lg leading-tight font-bold text-ink shadow-[0_4px_0_rgb(30_35_64/0.35)] xl:block">
            {t('newGame.theoNote')}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}
