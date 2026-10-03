import { Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Portrait phones get a friendly "rotate your device" card (docs/05 §9; a portrait layout is
 * post-1.0, Q3). Pure CSS: `.rotate-prompt` only shows in portrait under 640 px.
 */
export function RotatePrompt() {
  const { t } = useTranslation('shell');
  return (
    <div
      className="rotate-prompt fixed inset-0 z-[60] place-items-center bg-night p-8 text-center text-paper"
      role="alert"
    >
      <div className="flex max-w-xs flex-col items-center gap-5">
        <span className="rotate-prompt__phone grid size-24 place-items-center rounded-[28px] border-[3px] border-ink bg-sun text-ink shadow-[0_6px_0_var(--color-ink)]">
          <Smartphone className="size-12" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <p className="font-display text-3xl leading-tight tracking-wide">{t('rotate.title')}</p>
        <p className="text-paper/80">{t('rotate.body')}</p>
      </div>
    </div>
  );
}
