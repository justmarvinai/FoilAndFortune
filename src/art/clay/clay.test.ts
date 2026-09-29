import { describe, expect, it } from 'vitest';
import type { ArtPose, CreatureArtRequest } from '@/art/types';
import { type CreatureGenome, creatureGenomeSchema } from '@/content/schema/genome';
import { gkSpecies } from '@/content/tcg/gk/species';
import { genomeToScene } from './sdf/genomeToScene';
import { sceneToGlsl } from './sdf/sceneToGlsl';
import { buildStage } from './stage';

/**
 * The GPU pass can't run in Node, but everything feeding it is pure TypeScript: genome → scene
 * → generated GLSL, plus the stage (camera, lights, particles). These tests pin that pipeline.
 */

const POSES: readonly ArtPose[] = ['idle', 'happy', 'action'];

function glslFor(genome: CreatureGenome, pose: ArtPose = 'idle'): string {
  return sceneToGlsl(genomeToScene(genome, pose));
}

function expectSaneGlsl(glsl: string): void {
  expect(glsl).toContain('mapCreature');
  expect(glsl).toContain('creatureMaterial');
  expect(glsl).not.toMatch(/NaN|Infinity|undefined|null/);
}

function request(genome: CreatureGenome, seed: number): CreatureArtRequest {
  return { genome, element: 'volt', width: 648, height: 438, composition: 'window', seed };
}

describe('clay pipeline', () => {
  it('generates the same shader for the same species and pose', () => {
    for (const species of gkSpecies) {
      for (const pose of POSES) {
        const glsl = glslFor(species.genome, pose);
        expectSaneGlsl(glsl);
        expect(glslFor(species.genome, pose)).toBe(glsl);
      }
    }
  });

  it('builds a shader for every body plan the schema allows (fallbacks included)', () => {
    const base = gkSpecies[0]?.genome;
    if (!base) throw new Error('no spike species');
    for (const plan of creatureGenomeSchema.shape.plan.options) {
      expectSaneGlsl(glslFor({ ...base, plan }));
    }
  });

  it('stages deterministically per seed, and the seed varies the dressing', () => {
    const genome = gkSpecies[0]?.genome;
    if (!genome) throw new Error('no spike species');
    const scene = genomeToScene(genome);
    const a = buildStage(request(genome, 11), scene);
    expect(buildStage(request(genome, 11), scene)).toEqual(a);
    expect(buildStage(request(genome, 12), scene)).not.toEqual(a);
  });
});
