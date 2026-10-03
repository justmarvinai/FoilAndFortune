import { describe, expect, it } from 'vitest';
import type { ArtPose, CreatureArtRequest } from '@/art/types';
import { getRegistry } from '@/content/registry';
import type { CreatureGenome } from '@/content/schema/genome';
import { IDENTITY } from './math';
import { subjectScene } from './renderer';
import { genomeToScene } from './sdf/genomeToScene';
import { groupHull } from './sdf/kit';
import { propToScene } from './sdf/propToScene';
import { sceneToGlsl } from './sdf/sceneToGlsl';
import type { CreatureScene } from './sdf/types';
import { buildStage } from './stage';

const POSES: readonly ArtPose[] = ['idle', 'happy', 'action'];
const registry = getRegistry();
const birds = [...registry.species.values()].filter((s) => s.genome.plan === 'bird');

function bounds(scene: CreatureScene) {
  const balls = scene.groups.flatMap((g) => groupHull(g, scene.headCenter, IDENTITY));
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const b of balls) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i] ?? 0, (b.c[i] ?? 0) - b.r);
      hi[i] = Math.max(hi[i] ?? 0, (b.c[i] ?? 0) + b.r);
    }
  }
  return { lo, hi, balls };
}

function expectSane(scene: CreatureScene) {
  const json = JSON.stringify(scene);
  expect(json).not.toMatch(/null|NaN|Infinity/);
  const glsl = sceneToGlsl(scene);
  expect(glsl).toContain('mapCreature');
  expect(glsl).not.toMatch(/NaN|Infinity|undefined/);
}

describe('bird body plan', () => {
  it('covers the birds of the Emberdawn subset', () => {
    expect(birds.map((s) => s.name).sort()).toEqual([
      'Chirpip',
      'Galewing',
      'Solaryx',
      'Stormcrest',
    ]);
  });

  for (const species of birds) {
    for (const pose of POSES) {
      it(`${species.name} (${pose}): deterministic, finite and well proportioned`, () => {
        const genome: CreatureGenome = species.genome;
        const scene = genomeToScene(genome, pose);
        expectSane(scene);
        // Same genome + pose → same shader (fresh copy of the genome bypasses the cache key object).
        expect(sceneToGlsl(genomeToScene(structuredClone(genome), pose))).toBe(sceneToGlsl(scene));
        const names = scene.groups.map((g) => g.name);
        expect(names).toEqual(expect.arrayContaining(['body', 'wings', 'head', 'eyes']));
        if (genome.tail.shape !== 'none') expect(names).toContain('tail');
        const { lo, hi } = bounds(scene);
        expect(lo[1]).toBeGreaterThan(-0.03); // nothing sinks into the ground
        expect(hi[1]).toBeLessThan(1.6);
        expect((hi[0] ?? 0) - (lo[0] ?? 0)).toBeLessThan(2);
        expect((hi[2] ?? 0) - (lo[2] ?? 0)).toBeLessThan(1.6);
        // Perched birds stand on their toes; flying ones leave the ground.
        if (pose === 'action') expect(lo[1]).toBeGreaterThan(0.05);
        else expect(lo[1]).toBeLessThan(0.02);
        // The head sits above the body, beak forward.
        expect(scene.headCenter[1]).toBeGreaterThan(0.1);
        expect(scene.headRadius).toBeGreaterThan(0.05);
      });
    }
  }

  it('gives Solaryx glowing flame plumes (emitters) and spreads the wings when it flies', () => {
    const solaryx = registry.species.get('gk.species.solaryx')?.genome;
    if (!solaryx) throw new Error('no Solaryx');
    const perched = genomeToScene(solaryx, 'idle');
    const flying = genomeToScene(solaryx, 'action');
    expect(perched.emitters.length).toBeGreaterThan(0);
    const wingTop = (s: CreatureScene) =>
      bounds({ ...s, groups: s.groups.filter((g) => g.name === 'wings') }).hi[1] ?? 0;
    expect(wingTop(flying)).toBeGreaterThan(wingTop(perched) + 0.1);
  });
});

describe('tactic subjects', () => {
  const tactics = [...registry.cards.values()].filter((card) => card.art.prop);

  it('builds every prop kind of the subset in every pose', () => {
    expect(new Set(tactics.map((card) => card.art.prop?.kind))).toEqual(
      new Set(['potion', 'charm', 'lantern', 'folk']),
    );
    for (const card of tactics) {
      for (const pose of POSES) {
        if (!card.art.prop) continue;
        const scene = propToScene(card.art.prop, pose);
        expectSane(scene);
        expect(scene.groups.length).toBeGreaterThan(0);
      }
    }
  });

  it('stages Arenas without a subject: nothing to march, particles from the biome', () => {
    const request: CreatureArtRequest = {
      element: 'neutral',
      width: 560,
      height: 378,
      composition: 'window',
      biome: 'volcano-dawn',
      seed: 9401,
    };
    const scene = subjectScene(request);
    expect(scene.groups).toEqual([]);
    const stage = buildStage(request, scene);
    expect(stage.boxMin).toEqual(stage.boxMax);
    expect(stage.particles.length).toBeGreaterThan(0);
    expect(JSON.stringify(stage)).not.toMatch(/null|NaN/);
  });
});
