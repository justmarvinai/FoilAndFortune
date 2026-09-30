import type { ReactNode } from 'react';
import type { Insets } from '../camera/cameraMath';
import type { QualityLevel } from '../quality';

/**
 * Contract between the play screen (src/game) and the live, state-driven shop scene (docs/06 §7).
 * The scene reads the game itself (narrow `useGameStore` selectors for the layout, slots and
 * customers; `simClock` every frame for smooth agent motion) and reports clicks back. It never
 * dispatches commands: the play screen decides what a click does.
 */
export interface LiveShopSceneProps {
  quality: QualityLevel;
  /** Screen areas covered by the HUD, dock and sheets, in px, so the shop frames itself. */
  insets?: Partial<Insets>;
  /**
   * Content rendered in the world overlay, anchored to a fixture and following it on screen
   * (the Fixture Popover, docs/05 §5.3). The scene places it above or below the fixture so it
   * stays inside the viewport.
   */
  anchored?: { fixtureUid: string; content: ReactNode } | null;
  /** Shop name on the storefront sign. */
  shopName?: string;
  onFixtureClick?(fixtureUid: string): void;
  /** The register counter (manual checkout, docs/01 §11.1). */
  onRegisterClick?(): void;
  onCustomerClick?(uid: number): void;
  /** A click on empty floor or sky (closes popovers). */
  onBackgroundClick?(): void;
  className?: string;
}
