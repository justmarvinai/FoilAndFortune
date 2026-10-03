import type { DomainEventOf } from '@/sim/events';
import { StageView } from './StageView';
import './opening.css';

/**
 * The pack-opening stage (docs/05 §5.7, docs/01 §14): a full-screen reveal of a result the sim
 * already decided and applied. Lazy-loaded by the play screen while `ui.stage` is an opening.
 */
export interface OpeningStageProps {
  opened: DomainEventOf<'product/opened'>;
  onClose(): void;
}

const keys = new WeakMap<object, number>();
let nextKey = 1;

/** A fresh show per event ("Open another" hands the stage a new one). */
function keyOf(event: object): number {
  let key = keys.get(event);
  if (key === undefined) {
    key = nextKey++;
    keys.set(event, key);
  }
  return key;
}

export default function OpeningStage({ opened, onClose }: OpeningStageProps) {
  return <StageView key={keyOf(opened)} opened={opened} onClose={onClose} />;
}
