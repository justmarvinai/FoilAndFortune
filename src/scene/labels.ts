import { createContext, useContext } from 'react';

/**
 * In-world sign text (painted into canvas textures). Kept out of the components and passed in
 * as data so Phase 2 can feed these from i18n keys (CLAUDE.md rule 8) and from the player's
 * chosen shop name. The defaults below are the spike's English copy.
 */
export interface SceneLabels {
  shopName: string;
  address: string;
  open: string;
  shelfHeader: string;
  bargainBin: string;
  bargainPrice: string;
  chalkboardTitle: string;
  chalkboardLines: readonly [string, string];
  brand: string;
  posterSubtitle: string;
  packCount: string;
}

export const DEFAULT_SCENE_LABELS: SceneLabels = {
  shopName: 'THE NOOK',
  address: '12 Lantern Lane · Old Town',
  open: 'OPEN',
  shelfHeader: 'BOOSTERS',
  bargainBin: 'BARGAIN BIN',
  bargainPrice: '3 for $1',
  chalkboardTitle: 'NEW!',
  chalkboardLines: ['Emberdawn', 'packs are in!'],
  brand: 'GLIMMERKIN',
  posterSubtitle: 'EMBERDAWN · OUT NOW',
  packCount: '10 CARDS',
};

export const SceneLabelsContext = createContext<SceneLabels>(DEFAULT_SCENE_LABELS);

export function useSceneLabels(): SceneLabels {
  return useContext(SceneLabelsContext);
}
