import { z } from '@/core/zod';
import { contentId, elementIdSchema } from './common';
import { creatureGenomeSchema } from './genome';

export const speciesSchema = z.object({
  id: contentId,
  brandId: z.string(),
  dex: z.number().int().positive(),
  name: z.string().min(1),
  element: elementIdSchema,
  stage: z.enum(['basic', 'stage1', 'stage2', 'legend']),
  evolvesFrom: contentId.optional(),
  /** Base popularity 0.5–3.0 (docs/02 §7.1). */
  popularity: z.number().min(0.5).max(3),
  genome: creatureGenomeSchema,
  lore: z.string(),
  /** Default art background for this species (a biome id understood by the art engines). */
  biome: z.string(),
});
export type SpeciesDef = z.infer<typeof speciesSchema>;

/** Typed identity helper: gives autocompletion in content files; validation runs separately. */
export function defineSpecies(def: SpeciesDef): SpeciesDef {
  return def;
}
