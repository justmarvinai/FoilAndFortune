import type { ArtPose } from '@/art/types';
import type { CreatureGenome } from '@/content/schema/genome';
import { type Box, type Path, type Pt, unionBox } from './core/path';
import { createRng } from './core/rng';
import type { DrawCtx } from './draw';
import { createPaint } from './paint';
import { drawBody } from './parts/bodies';
import { drawEars } from './parts/ears';
import { drawBodyExtras, drawHeadExtras } from './parts/extras';
import { drawFace } from './parts/faces';
import { drawHead } from './parts/heads';
import type { Build } from './parts/kit';
import { drawTail, type TailInfo } from './parts/tails';
import { buildRig } from './rig';
import { Sheet } from './sheet';

/** A creature drawn in its local units, ready for the composer to place and outline. */
export interface CreatureArt {
  /** The painted pieces (fills, shading, lines), back to front. */
  svg: string;
  /** Mass shapes whose union is the sticker silhouette. */
  silhouette: readonly Path[];
  bounds: Box;
  /** Head center/radius, so particles keep clear of the face. */
  head: { c: Pt; r: number };
  tail: TailInfo | null;
  ground: number;
  size: number;
}

export function buildCreature(
  genome: CreatureGenome,
  ctx: DrawCtx,
  seed: number,
  pose: ArtPose,
): CreatureArt {
  const rng = createRng(seed).fork('pose');
  const rig = buildRig(genome, rng);
  const sheet = new Sheet();
  const b: Build = { g: genome, paint: createPaint(genome), ctx, sheet, rig, rng, pose };
  // Head-attached parts share the head tilt.
  const head = sheet.rotated(rig.tilt, rig.neck, () => {
    const info = drawHead(b);
    drawEars(b, info);
    drawFace(b, info);
    drawHeadExtras(b, info);
    return info;
  });
  drawBody(b, head);
  drawBodyExtras(b);
  const tail = drawTail(b);
  return {
    svg: sheet.render(),
    silhouette: sheet.silhouette,
    bounds: unionBox(sheet.silhouette.map((s) => s.bounds())),
    head: { c: rig.head.c, r: Math.max(rig.head.a, rig.head.b) },
    tail,
    ground: rig.ground,
    size: rig.size,
  };
}
