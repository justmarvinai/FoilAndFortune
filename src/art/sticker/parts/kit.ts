import type { ArtPose } from '@/art/types';
import type { CreatureGenome } from '@/content/schema/genome';
import type { Path, Pt } from '../core/path';
import type { Rng } from '../core/rng';
import type { DrawCtx } from '../draw';
import type { Paint } from '../paint';
import type { Rig } from '../rig';
import type { Sheet } from '../sheet';

/** Everything a part needs to draw itself. */
export interface Build {
  g: CreatureGenome;
  paint: Paint;
  ctx: DrawCtx;
  sheet: Sheet;
  rig: Rig;
  rng: Rng;
  pose: ArtPose;
}

export interface EyeAnchor {
  c: Pt;
  rx: number;
  ry: number;
  /** Degrees. */
  tilt: number;
  /** The eye nearer to the viewer (bigger, fully frontal). */
  near: boolean;
}

export interface MouthAnchor {
  /** Under the nose, where the mouth splits (or the middle of a wide mouth). */
  c: Pt;
  /** Far and near mouth corners (3/4 view: the far side is short). */
  far: Pt;
  near: Pt;
  /** How far an open mouth may drop. */
  drop: number;
  /** `muzzle` = small cat/dog mouth under a nose; `wide` = one long smile line. */
  kind: 'muzzle' | 'wide';
}

/** Face layout a head shape hands to the face and extras modules. */
export interface HeadInfo {
  shape: Path;
  eyes: readonly EyeAnchor[];
  nose: { c: Pt; size: number } | null;
  mouth: MouthAnchor;
  /** Blush spots (near cheek first). */
  cheeks: readonly { c: Pt; r: number }[];
  /** Top of the head, where tufts sprout, and its outward direction (deg). */
  crown: { p: Pt; deg: number };
  forehead: Pt;
  /** Attachment points for ears (near, far). */
  earBase: { near: Pt; far: Pt };
  /** Side anchors for gills/fins (near, far). */
  sides: { near: Pt; far: Pt };
}
