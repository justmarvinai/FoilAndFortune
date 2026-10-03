import type { SheetProps } from '@/game/sheets/types';
import { useGameStore } from '@/state/gameStore';
import { SettingsBoard } from './SettingsBoard';

const currentGame = () => useGameStore.getState().game;

/** The in-game Settings sheet (docs/05 §5.19): the settings board plus saves and quit. */
export default function SettingsSheet({ onClose }: SheetProps) {
  return <SettingsBoard onClose={onClose} getGame={currentGame} />;
}
