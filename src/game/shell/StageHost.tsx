import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/state/uiStore';
import { LoadingDots } from './LoadingDots';

/** The pack-opening stage is its own chunk: only a rip downloads it (docs/05 §5.7). */
const OpeningStage = lazy(() => import('@/game/opening/OpeningStage'));

function StageLoading() {
  const { t } = useTranslation('shell');
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-night/95 text-paper">
      <p className="flex flex-col items-center gap-3 font-display text-2xl tracking-wide">
        <LoadingDots />
        {t('stage.loading')}
      </p>
    </div>
  );
}

/** Full-screen modes (docs/05 §2): renders the pack-opening stage while `ui.stage` is set. */
export function StageHost() {
  const stage = useUiStore((ui) => ui.stage);
  const close = useUiStore((ui) => ui.closeStage);
  if (!stage) return null;
  return (
    <Suspense fallback={<StageLoading />}>
      {stage.kind === 'opening' ? <OpeningStage opened={stage.opened} onClose={close} /> : null}
    </Suspense>
  );
}
