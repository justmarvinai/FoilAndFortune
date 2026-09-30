import type { DomainEventOf } from '@/sim/events';

/**
 * The pack-opening stage (docs/05 §5.7, docs/01 §14): a full-screen reveal of a result the sim
 * already decided. STUB: replaced by the pack-opening work package (keep the default export and
 * props).
 */
export interface OpeningStageProps {
  opened: DomainEventOf<'product/opened'>;
  onClose(): void;
}

export default function OpeningStage({ opened, onClose }: OpeningStageProps) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-night/95 text-paper">
      <button type="button" onClick={onClose}>
        {opened.productId}
      </button>
    </div>
  );
}
