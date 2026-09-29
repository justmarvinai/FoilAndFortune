import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { usePathname } from '@/app/router';
import { matchRoute } from '@/app/routes';

function PageFallback() {
  const { t } = useTranslation();
  return (
    <div className="grid h-full place-items-center bg-night text-paper">
      <p className="animate-pulse font-display text-2xl tracking-wide">{t('app.loading')}</p>
    </div>
  );
}

export function App() {
  const pathname = usePathname();
  const { component: Page } = matchRoute(pathname);
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageFallback />}>
        <Page />
      </Suspense>
    </ErrorBoundary>
  );
}
