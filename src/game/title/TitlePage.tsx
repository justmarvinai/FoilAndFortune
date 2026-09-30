import { useTranslation } from 'react-i18next';
import { Link } from '@/app/router';

/**
 * Title screen (docs/05 §5.1). PLACEHOLDER: the shell work package replaces it with the real
 * title, New Game and Continue/Load flow. The heading stays "Foil & Fortune" (E2E smoke test).
 */
export default function TitlePage() {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-full place-items-center bg-night text-paper">
      <div className="text-center">
        <h1 className="font-display text-5xl">{t('appName')}</h1>
        <p className="mt-4">
          <Link to="/debug" className="underline">
            /debug
          </Link>
        </p>
      </div>
    </main>
  );
}
