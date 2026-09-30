import { useTranslation } from 'react-i18next';

/**
 * The play screen (docs/05 §2): the live shop scene with the HUD, dock, sheets, popovers, the
 * pack-opening stage, celebrations and toasts. PLACEHOLDER: composed by the shell work package.
 */
export default function PlayPage() {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-full place-items-center bg-night text-paper">
      <h1 className="font-display text-4xl">{t('appName')}</h1>
    </main>
  );
}
