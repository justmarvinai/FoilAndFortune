import { defineSpecies, type SpeciesDef } from '@/content/schema/species';

/**
 * Glimmerkin species (docs/03 §6). Phase 1 ships the three Art Spike species; the rest of the
 * dex is added with their sets. Genomes are renderer-agnostic (docs/04 §6).
 */

/** 001 · Volt electric fox kit, the brand mascot. Deliberately NOT yellow-with-red-cheeks. */
export const sparkit = defineSpecies({
  id: 'gk.species.sparkit',
  brandId: 'gk',
  dex: 1,
  name: 'Sparkit',
  element: 'volt',
  stage: 'basic',
  popularity: 3,
  biome: 'storm-meadow',
  lore: 'Its tail tip stores static from every step it takes. On stormy nights it glows like a tiny star.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 0.85,
    proportions: { head: 0.8, body: 0.45, legs: 0.35, tail: 0.9 },
    palette: {
      primary: '#FFC53D',
      secondary: '#FFF4D6',
      accent: '#3FA9F5',
      belly: '#FFF4D6',
      eyes: '#2B1B3A',
      glow: '#7FE3FF',
    },
    head: { shape: 'fox', muzzle: 'pointed', nose: 'button' },
    face: { eyes: 'sparkle', eyeSize: 0.8, mouth: 'smile', blush: false },
    ears: { shape: 'pointed', size: 0.9, color: 'primary', innerColor: 'accent' },
    tail: { shape: 'spark', size: 0.9, color: 'primary', tipColor: 'glow' },
    extras: [
      { kind: 'ruff', color: 'secondary' },
      { kind: 'stripes', where: 'back', count: 2, color: 'accent' },
    ],
    elementFx: 'sparks',
  },
});

/** 004 · Ember puppy with a flame tail. */
export const emberpup = defineSpecies({
  id: 'gk.species.emberpup',
  brandId: 'gk',
  dex: 4,
  name: 'Emberpup',
  element: 'ember',
  stage: 'basic',
  popularity: 2.2,
  biome: 'volcano-dawn',
  lore: 'The flame on its tail wags faster when it is happy, which is almost always.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 0.85,
    proportions: { head: 0.75, body: 0.5, legs: 0.35, tail: 0.6 },
    palette: {
      primary: '#FF7A3D',
      secondary: '#FFE3C2',
      accent: '#3A2A33',
      belly: '#FFE3C2',
      eyes: '#2B1B1B',
      glow: '#FFD166',
    },
    head: { shape: 'pup', muzzle: 'round', nose: 'button' },
    face: { eyes: 'round', eyeSize: 0.75, mouth: 'grin', blush: true },
    ears: { shape: 'floppy', size: 0.8, color: 'accent', innerColor: 'accent' },
    tail: { shape: 'flame', size: 0.7, color: 'primary', tipColor: 'glow' },
    extras: [
      { kind: 'head-tuft', shape: 'flame', color: 'glow' },
      { kind: 'socks', color: 'accent' },
    ],
    elementFx: 'embers',
  },
});

/** 007 · Tide axolotl, always smiling. Aqua body with coral-pink gills (not blue/purple). */
export const sploot = defineSpecies({
  id: 'gk.species.sploot',
  brandId: 'gk',
  dex: 7,
  name: 'Sploot',
  element: 'tide',
  stage: 'basic',
  popularity: 2.4,
  biome: 'lagoon',
  lore: 'Sploot flops onto warm rocks to nap. Its frilly gills change color with its mood.',
  genome: {
    version: 1,
    plan: 'amphibian',
    size: 0.8,
    proportions: { head: 0.85, body: 0.55, legs: 0.25, tail: 0.7 },
    palette: {
      primary: '#6FD6E8',
      secondary: '#E8FBFF',
      accent: '#FF8FB1',
      belly: '#E8FBFF',
      eyes: '#1B2440',
      glow: '#B8F4FF',
    },
    head: { shape: 'axolotl', muzzle: 'wide', nose: 'none' },
    face: { eyes: 'round', eyeSize: 0.6, mouth: 'smile', blush: true },
    ears: { shape: 'none', size: 0, color: 'primary', innerColor: 'primary' },
    tail: { shape: 'fin', size: 0.75, color: 'primary', tipColor: 'accent' },
    extras: [
      { kind: 'gills', count: 3, color: 'accent' },
      { kind: 'spots', count: 5, color: 'secondary' },
    ],
    elementFx: 'bubbles',
  },
});

export const gkSpecies: readonly SpeciesDef[] = [sparkit, emberpup, sploot];
