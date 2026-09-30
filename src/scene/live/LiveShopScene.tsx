import type { LiveShopSceneProps } from './types';

/**
 * The live, state-driven shop scene (docs/06 §7). STUB: a flat backdrop until the scene work
 * package replaces it with the real diorama (keep the default export and the props contract in
 * `./types.ts`). It still reports background clicks so the play screen can be wired up.
 */
export default function LiveShopScene({ onBackgroundClick, className = '' }: LiveShopSceneProps) {
  return (
    <div
      className={`h-full w-full bg-[radial-gradient(circle_at_50%_40%,var(--color-paper2),var(--color-night))] ${className}`}
      onClick={onBackgroundClick}
      aria-hidden="true"
    />
  );
}
