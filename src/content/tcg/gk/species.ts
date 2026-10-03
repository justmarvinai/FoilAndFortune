import { defineSpecies, type SpeciesDef } from '@/content/schema/species';

/**
 * Glimmerkin species (docs/03 §6). Phase 1 shipped the three Art Spike species; Phase 2 adds every
 * species the *Emberdawn* subset uses (docs/03 Appendix A). The rest of the dex arrives with their
 * sets. Genomes are renderer-agnostic (docs/04 §6); evolutions keep their parent's palette family
 * and key features, bigger and fancier.
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

// ---- Volt ------------------------------------------------------------------------------------

/** 002 · Lanky storm fox: Sparkit's teenage form, all legs and a zig-zag tail. */
export const voltail = defineSpecies({
  id: 'gk.species.voltail',
  brandId: 'gk',
  dex: 2,
  name: 'Voltail',
  element: 'volt',
  stage: 'stage1',
  evolvesFrom: 'gk.species.sparkit',
  popularity: 1.8,
  biome: 'storm-meadow',
  lore: 'It races thunderheads across the plateau and always arrives a little before the thunder.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 1,
    proportions: { head: 0.55, body: 0.6, legs: 0.7, tail: 0.85 },
    palette: {
      primary: '#F7B829',
      secondary: '#FFF1CF',
      accent: '#2F8FE0',
      belly: '#FFF1CF',
      eyes: '#241A38',
      glow: '#9BE8FF',
    },
    head: { shape: 'fox', muzzle: 'pointed', nose: 'button' },
    face: { eyes: 'round', eyeSize: 0.62, mouth: 'smile', blush: false },
    ears: { shape: 'pointed', size: 1, color: 'primary', innerColor: 'accent' },
    tail: { shape: 'bolt', size: 0.9, color: 'primary', tipColor: 'glow' },
    extras: [
      { kind: 'ruff', color: 'secondary' },
      { kind: 'stripes', where: 'back', count: 3, color: 'accent' },
      { kind: 'forehead-mark', shape: 'bolt', color: 'accent' },
    ],
    elementFx: 'sparks',
  },
});

/** 003 · Majestic lightning fox with a crackling mane. */
export const thundervixen = defineSpecies({
  id: 'gk.species.thundervixen',
  brandId: 'gk',
  dex: 3,
  name: 'Thundervixen',
  element: 'volt',
  stage: 'stage2',
  evolvesFrom: 'gk.species.voltail',
  popularity: 2.4,
  biome: 'storm-meadow',
  lore: 'Where it runs, the grass stands on end for an hour afterwards.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 1.2,
    proportions: { head: 0.45, body: 0.72, legs: 0.78, tail: 1 },
    palette: {
      primary: '#FFCB3D',
      secondary: '#FFF6E0',
      accent: '#2A6FD6',
      belly: '#FFF6E0',
      eyes: '#1E1838',
      glow: '#8FE9FF',
    },
    head: { shape: 'fox', muzzle: 'pointed', nose: 'button' },
    face: { eyes: 'fierce', eyeSize: 0.55, mouth: 'smile', blush: false },
    ears: { shape: 'pointed', size: 1, color: 'primary', innerColor: 'accent' },
    tail: { shape: 'spark', size: 1, color: 'primary', tipColor: 'glow' },
    extras: [
      { kind: 'mane', style: 'spark', color: 'secondary', tipColor: 'glow' },
      { kind: 'stripes', where: 'back', count: 3, color: 'accent' },
      { kind: 'forehead-mark', shape: 'bolt', color: 'accent' },
      { kind: 'socks', color: 'accent' },
    ],
    elementFx: 'sparks',
  },
});

/** 024 · Static-charged raccoon. Its ringed tail crackles when it's up to something. */
export const zapcoon = defineSpecies({
  id: 'gk.species.zapcoon',
  brandId: 'gk',
  dex: 24,
  name: 'Zapcoon',
  element: 'volt',
  stage: 'basic',
  popularity: 1.2,
  biome: 'storm-meadow',
  lore: 'Picnic baskets on the island come with a warning sticker about Zapcoon.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 0.85,
    proportions: { head: 0.8, body: 0.55, legs: 0.35, tail: 0.8 },
    palette: {
      primary: '#9AA0B8',
      secondary: '#ECEEF4',
      accent: '#2E3140',
      belly: '#ECEEF4',
      eyes: '#1B1D2E',
      glow: '#FFE14D',
    },
    head: { shape: 'fox', muzzle: 'short', nose: 'button' },
    face: { eyes: 'round', eyeSize: 0.72, mouth: 'smile', blush: false },
    ears: { shape: 'round', size: 0.75, color: 'primary', innerColor: 'secondary' },
    tail: { shape: 'fluffy', size: 0.8, color: 'primary', tipColor: 'accent' },
    extras: [
      { kind: 'mask', shape: 'bandit', color: 'accent' },
      { kind: 'stripes', where: 'tail', count: 3, color: 'accent' },
      { kind: 'socks', color: 'accent' },
    ],
    elementFx: 'sparks',
  },
});

/** 025 · Masked raccoon thief: steals static from storm clouds (and snacks from everyone). */
export const voltbandit = defineSpecies({
  id: 'gk.species.voltbandit',
  brandId: 'gk',
  dex: 25,
  name: 'Voltbandit',
  element: 'volt',
  stage: 'stage1',
  evolvesFrom: 'gk.species.zapcoon',
  popularity: 1.4,
  biome: 'storm-meadow',
  lore: 'It never takes more than it can carry, which, with a tail like that, is a lot.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 1.05,
    proportions: { head: 0.62, body: 0.68, legs: 0.48, tail: 1 },
    palette: {
      primary: '#7C84A6',
      secondary: '#E3E6EF',
      accent: '#1F2233',
      belly: '#E3E6EF',
      eyes: '#141626',
      glow: '#FFD23F',
    },
    head: { shape: 'fox', muzzle: 'short', nose: 'button' },
    face: { eyes: 'fierce', eyeSize: 0.6, mouth: 'grin', blush: false },
    ears: { shape: 'round', size: 0.85, color: 'primary', innerColor: 'secondary' },
    tail: { shape: 'fluffy', size: 1, color: 'primary', tipColor: 'glow' },
    extras: [
      { kind: 'mask', shape: 'bandit', color: 'accent' },
      { kind: 'stripes', where: 'tail', count: 4, color: 'accent' },
      { kind: 'socks', color: 'accent' },
      { kind: 'forehead-mark', shape: 'bolt', color: 'glow' },
    ],
    elementFx: 'sparks',
  },
});

/** 056 · Lightning stag (new in *Emberdawn*): its antlers fork like the storms it calls. */
export const boltbuck = defineSpecies({
  id: 'gk.species.boltbuck',
  brandId: 'gk',
  dex: 56,
  name: 'Boltbuck',
  element: 'volt',
  stage: 'basic',
  popularity: 1.5,
  biome: 'storm-meadow',
  lore: 'Herds gather on the plateau before a storm. Their antlers hum like power lines.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 1,
    proportions: { head: 0.5, body: 0.6, legs: 0.85, tail: 0.25 },
    palette: {
      primary: '#D49A5A',
      secondary: '#FFF1DC',
      accent: '#5A3A28',
      belly: '#FFF1DC',
      eyes: '#2A1A12',
      glow: '#FFE36B',
    },
    head: { shape: 'pup', muzzle: 'short', nose: 'button' },
    face: { eyes: 'round', eyeSize: 0.6, mouth: 'smile', blush: false },
    ears: { shape: 'pointed', size: 0.6, color: 'primary', innerColor: 'secondary' },
    tail: { shape: 'fluffy', size: 0.3, color: 'primary', tipColor: 'secondary' },
    extras: [
      { kind: 'antlers', shape: 'bolt', size: 0.75, color: 'glow', glow: true },
      { kind: 'socks', color: 'accent' },
      { kind: 'spots', count: 5, color: 'secondary' },
    ],
    elementFx: 'sparks',
  },
});

// ---- Ember -----------------------------------------------------------------------------------

/** 005 · Fire hound with a flickering mane. */
export const blazehound = defineSpecies({
  id: 'gk.species.blazehound',
  brandId: 'gk',
  dex: 5,
  name: 'Blazehound',
  element: 'ember',
  stage: 'stage1',
  evolvesFrom: 'gk.species.emberpup',
  popularity: 1.6,
  biome: 'volcano-dawn',
  lore: 'It patrols the caldera rim at night. Lost hikers follow its glow home.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 1,
    proportions: { head: 0.55, body: 0.62, legs: 0.6, tail: 0.75 },
    palette: {
      primary: '#EE5A2A',
      secondary: '#FFDDB8',
      accent: '#3B2530',
      belly: '#FFDDB8',
      eyes: '#2A1616',
      glow: '#FFC14D',
    },
    head: { shape: 'pup', muzzle: 'round', nose: 'button' },
    face: { eyes: 'round', eyeSize: 0.6, mouth: 'grin', blush: false },
    ears: { shape: 'pointed', size: 0.8, color: 'accent', innerColor: 'secondary' },
    tail: { shape: 'flame', size: 0.85, color: 'primary', tipColor: 'glow' },
    extras: [
      { kind: 'mane', style: 'flame', color: 'primary', tipColor: 'glow' },
      { kind: 'socks', color: 'accent' },
    ],
    elementFx: 'embers',
  },
});

/** 006 · Wolf-dragon of fire, the vintage chase. */
export const infernox = defineSpecies({
  id: 'gk.species.infernox',
  brandId: 'gk',
  dex: 6,
  name: 'Infernox',
  element: 'ember',
  stage: 'stage2',
  evolvesFrom: 'gk.species.blazehound',
  popularity: 3,
  biome: 'volcano-dawn',
  lore: 'Old islanders say the volcano only sleeps because Infernox lies awake.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 1.25,
    proportions: { head: 0.45, body: 0.8, legs: 0.7, tail: 1 },
    palette: {
      primary: '#DB3B1F',
      secondary: '#FFCF8A',
      accent: '#2B1A24',
      belly: '#FFB36B',
      eyes: '#1C0F0F',
      glow: '#FFB02E',
    },
    head: { shape: 'fox', muzzle: 'pointed', nose: 'button' },
    face: { eyes: 'fierce', eyeSize: 0.5, mouth: 'fang', blush: false },
    ears: { shape: 'pointed', size: 0.75, color: 'primary', innerColor: 'accent' },
    tail: { shape: 'flame', size: 1, color: 'primary', tipColor: 'glow' },
    extras: [
      { kind: 'horns', shape: 'swept', size: 0.7, color: 'accent' },
      { kind: 'mane', style: 'flame', color: 'primary', tipColor: 'glow' },
      { kind: 'wings', style: 'dragon', size: 0.45, color: 'accent', tipColor: 'primary' },
      { kind: 'socks', color: 'accent' },
    ],
    elementFx: 'embers',
  },
});

/** 054 · Sun phoenix, the *Emberdawn* Legend. It returns to the island with every sunrise. */
export const solaryx = defineSpecies({
  id: 'gk.species.solaryx',
  brandId: 'gk',
  dex: 54,
  name: 'Solaryx',
  element: 'ember',
  stage: 'legend',
  popularity: 2.6,
  biome: 'volcano-dawn',
  lore: 'Each dawn it dips one wing into the caldera and carries the first light over the sea.',
  genome: {
    version: 1,
    plan: 'bird',
    size: 1.25,
    proportions: { head: 0.45, body: 0.7, legs: 0.5, tail: 1 },
    palette: {
      primary: '#FF9A1C',
      secondary: '#FFE7A8',
      accent: '#F2471C',
      belly: '#FFD36B',
      eyes: '#3A1A10',
      glow: '#FFE066',
    },
    head: { shape: 'beaked', muzzle: 'round', nose: 'triangle' },
    face: { eyes: 'fierce', eyeSize: 0.5, mouth: 'beak', blush: false },
    ears: { shape: 'none', size: 0, color: 'primary', innerColor: 'primary' },
    tail: { shape: 'flame', size: 1, color: 'accent', tipColor: 'glow' },
    extras: [
      { kind: 'head-tuft', shape: 'flame', color: 'glow' },
      { kind: 'wings', style: 'flame', size: 0.9, color: 'primary', tipColor: 'accent' },
    ],
    elementFx: 'embers',
  },
});

/** 055 · Lava armadillo (new in *Emberdawn*): basalt plates with glowing seams. */
export const magmadillo = defineSpecies({
  id: 'gk.species.magmadillo',
  brandId: 'gk',
  dex: 55,
  name: 'Magmadillo',
  element: 'ember',
  stage: 'basic',
  popularity: 1.3,
  biome: 'volcano-dawn',
  lore: 'It curls up on cooling lava flows and naps until the rock is cold enough to eat.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 0.9,
    proportions: { head: 0.55, body: 0.85, legs: 0.22, tail: 0.45 },
    palette: {
      primary: '#C98A6E',
      secondary: '#F2D2B4',
      accent: '#6A5258',
      belly: '#F2D2B4',
      eyes: '#2A1616',
      glow: '#FF7A1A',
    },
    head: { shape: 'round', muzzle: 'pointed', nose: 'button' },
    face: { eyes: 'round', eyeSize: 0.5, mouth: 'smile', blush: true },
    ears: { shape: 'round', size: 0.65, color: 'primary', innerColor: 'secondary' },
    tail: { shape: 'curl', size: 0.45, color: 'accent', tipColor: 'glow' },
    extras: [
      { kind: 'shell', bands: 4, color: 'accent', seamColor: 'glow', glowSeams: true },
      { kind: 'stripes', where: 'tail', count: 2, color: 'glow' },
    ],
    elementFx: 'embers',
  },
});

// ---- Bloom -----------------------------------------------------------------------------------

/** 010 · Bunny with leaf ears. */
export const budbun = defineSpecies({
  id: 'gk.species.budbun',
  brandId: 'gk',
  dex: 10,
  name: 'Budbun',
  element: 'bloom',
  stage: 'basic',
  popularity: 2.2,
  biome: 'storm-meadow',
  lore: 'Its leaf ears turn toward the sun. On cloudy days it just sits and waits.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 0.8,
    proportions: { head: 0.85, body: 0.5, legs: 0.3, tail: 0.3 },
    palette: {
      primary: '#F6EEDC',
      secondary: '#FFFFFF',
      accent: '#6CC45C',
      belly: '#FFFFFF',
      eyes: '#2A2438',
      glow: '#C9F5A0',
    },
    head: { shape: 'round', muzzle: 'short', nose: 'button' },
    face: { eyes: 'round', eyeSize: 0.82, mouth: 'smile', blush: true },
    ears: { shape: 'long', size: 0.75, color: 'accent', innerColor: 'glow' },
    tail: { shape: 'fluffy', size: 0.3, color: 'secondary', tipColor: 'secondary' },
    extras: [{ kind: 'head-tuft', shape: 'leaf', color: 'accent' }],
    elementFx: 'petals',
  },
});

/** 011 · Flower-crowned hare. */
export const bloomhop = defineSpecies({
  id: 'gk.species.bloomhop',
  brandId: 'gk',
  dex: 11,
  name: 'Bloomhop',
  element: 'bloom',
  stage: 'stage1',
  evolvesFrom: 'gk.species.budbun',
  popularity: 1.3,
  biome: 'storm-meadow',
  lore: 'Every spring its crown blooms a new color. No two meadows agree on which is best.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 1,
    proportions: { head: 0.62, body: 0.6, legs: 0.6, tail: 0.35 },
    palette: {
      primary: '#EBD9BC',
      secondary: '#FFF8EA',
      accent: '#5DB24E',
      belly: '#FFF8EA',
      eyes: '#2A2438',
      glow: '#FF8FC4',
    },
    head: { shape: 'round', muzzle: 'short', nose: 'button' },
    face: { eyes: 'round', eyeSize: 0.66, mouth: 'smile', blush: true },
    ears: { shape: 'long', size: 1, color: 'accent', innerColor: 'secondary' },
    tail: { shape: 'fluffy', size: 0.35, color: 'secondary', tipColor: 'secondary' },
    extras: [{ kind: 'head-tuft', shape: 'flower', color: 'glow' }],
    elementFx: 'petals',
  },
});

// ---- Terra -----------------------------------------------------------------------------------

/** 016 · Pebble pup: half puppy, half riverbed. */
export const pebblit = defineSpecies({
  id: 'gk.species.pebblit',
  brandId: 'gk',
  dex: 16,
  name: 'Pebblit',
  element: 'terra',
  stage: 'basic',
  popularity: 1.2,
  biome: 'volcano-dawn',
  lore: 'It collects shiny stones and keeps the best one under its tongue.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 0.8,
    proportions: { head: 0.8, body: 0.55, legs: 0.3, tail: 0.35 },
    palette: {
      primary: '#B3ADA2',
      secondary: '#E2DCCF',
      accent: '#6E665D',
      belly: '#E2DCCF',
      eyes: '#2A2622',
      glow: '#FFD9A0',
    },
    head: { shape: 'pup', muzzle: 'round', nose: 'button' },
    face: { eyes: 'round', eyeSize: 0.72, mouth: 'grin', blush: true },
    ears: { shape: 'round', size: 0.65, color: 'accent', innerColor: 'secondary' },
    tail: { shape: 'curl', size: 0.35, color: 'primary', tipColor: 'accent' },
    extras: [{ kind: 'spots', count: 7, color: 'accent' }],
    elementFx: 'dust',
  },
});

// ---- Neutral ---------------------------------------------------------------------------------

/** 013 · Fluffy chick, all head and fluff. */
export const chirpip = defineSpecies({
  id: 'gk.species.chirpip',
  brandId: 'gk',
  dex: 13,
  name: 'Chirpip',
  element: 'neutral',
  stage: 'basic',
  popularity: 1.1,
  biome: 'lagoon',
  lore: 'It practices flying every morning. It has not left the ground yet. It is very proud.',
  genome: {
    version: 1,
    plan: 'bird',
    size: 0.7,
    proportions: { head: 1, body: 0.4, legs: 0.3, tail: 0.3 },
    palette: {
      primary: '#FFD95C',
      secondary: '#FFF3C4',
      accent: '#FF9A3C',
      belly: '#FFF3C4',
      eyes: '#2B2018',
      glow: '#FFF6C2',
    },
    head: { shape: 'beaked', muzzle: 'short', nose: 'none' },
    face: { eyes: 'round', eyeSize: 0.75, mouth: 'beak', blush: true },
    ears: { shape: 'none', size: 0, color: 'primary', innerColor: 'primary' },
    tail: { shape: 'fluffy', size: 0.4, color: 'primary', tipColor: 'secondary' },
    extras: [
      { kind: 'head-tuft', shape: 'fluff', color: 'primary' },
      { kind: 'wings', style: 'stubby', size: 0.4, color: 'primary', tipColor: 'secondary' },
    ],
    elementFx: 'dust',
  },
});

/** 014 · Swift bird that rides the sea breeze. */
export const galewing = defineSpecies({
  id: 'gk.species.galewing',
  brandId: 'gk',
  dex: 14,
  name: 'Galewing',
  element: 'neutral',
  stage: 'stage1',
  evolvesFrom: 'gk.species.chirpip',
  popularity: 1,
  biome: 'lagoon',
  lore: 'It naps in mid-air on the trade winds and wakes up somewhere new.',
  genome: {
    version: 1,
    plan: 'bird',
    size: 0.95,
    proportions: { head: 0.6, body: 0.55, legs: 0.35, tail: 0.75 },
    palette: {
      primary: '#5DB7F2',
      secondary: '#F6FBFF',
      accent: '#FF9A3C',
      belly: '#F6FBFF',
      eyes: '#1A2236',
      glow: '#D8F4FF',
    },
    head: { shape: 'beaked', muzzle: 'pointed', nose: 'none' },
    face: { eyes: 'round', eyeSize: 0.6, mouth: 'beak', blush: false },
    ears: { shape: 'none', size: 0, color: 'primary', innerColor: 'primary' },
    tail: { shape: 'fin', size: 0.8, color: 'primary', tipColor: 'secondary' },
    extras: [
      { kind: 'wings', style: 'feather', size: 0.75, color: 'primary', tipColor: 'secondary' },
    ],
    elementFx: 'dust',
  },
});

/** 015 · Crested sky raptor. */
export const stormcrest = defineSpecies({
  id: 'gk.species.stormcrest',
  brandId: 'gk',
  dex: 15,
  name: 'Stormcrest',
  element: 'neutral',
  stage: 'stage2',
  evolvesFrom: 'gk.species.galewing',
  popularity: 1.6,
  biome: 'storm-meadow',
  lore: 'It flies straight into thunderstorms to see what is on the other side.',
  genome: {
    version: 1,
    plan: 'bird',
    size: 1.2,
    proportions: { head: 0.38, body: 0.8, legs: 0.5, tail: 0.85 },
    palette: {
      primary: '#5F78C2',
      secondary: '#F4F1EA',
      accent: '#FFB23E',
      belly: '#F4F1EA',
      eyes: '#1C1A2A',
      glow: '#FFE7A8',
    },
    head: { shape: 'beaked', muzzle: 'round', nose: 'triangle' },
    face: { eyes: 'fierce', eyeSize: 0.5, mouth: 'beak', blush: false },
    ears: { shape: 'none', size: 0, color: 'primary', innerColor: 'primary' },
    tail: { shape: 'fin', size: 1, color: 'primary', tipColor: 'secondary' },
    extras: [
      { kind: 'head-tuft', shape: 'crest', color: 'accent' },
      { kind: 'wings', style: 'feather', size: 0.9, color: 'primary', tipColor: 'secondary' },
    ],
    elementFx: 'sparks',
  },
});

/** 022 · Sleepy panda, a fan favorite. */
export const snoozle = defineSpecies({
  id: 'gk.species.snoozle',
  brandId: 'gk',
  dex: 22,
  name: 'Snoozle',
  element: 'neutral',
  stage: 'basic',
  popularity: 2,
  biome: 'storm-meadow',
  lore: 'It is awake for about four minutes a day and spends them looking for a comfier spot.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 0.95,
    proportions: { head: 0.85, body: 0.85, legs: 0.3, tail: 0.2 },
    palette: {
      primary: '#F5F3EE',
      secondary: '#FFFFFF',
      accent: '#2D2D36',
      belly: '#F5F3EE',
      eyes: '#1B1B22',
      glow: '#FFE9A8',
    },
    head: { shape: 'round', muzzle: 'round', nose: 'button' },
    face: { eyes: 'sleepy', eyeSize: 0.6, mouth: 'smile', blush: true },
    ears: { shape: 'round', size: 0.7, color: 'accent', innerColor: 'accent' },
    tail: { shape: 'fluffy', size: 0.2, color: 'primary', tipColor: 'primary' },
    extras: [
      { kind: 'mask', shape: 'patches', color: 'accent' },
      { kind: 'socks', color: 'accent' },
    ],
    elementFx: 'dust',
  },
});

/** 023 · Cat that mimics others' looks (this is its own, probably). */
export const mimicat = defineSpecies({
  id: 'gk.species.mimicat',
  brandId: 'gk',
  dex: 23,
  name: 'Mimicat',
  element: 'neutral',
  stage: 'basic',
  popularity: 1.8,
  biome: 'storm-meadow',
  lore: 'Ask three people what color Mimicat is and you will get four answers.',
  genome: {
    version: 1,
    plan: 'quadruped',
    size: 0.85,
    proportions: { head: 0.75, body: 0.55, legs: 0.4, tail: 0.85 },
    palette: {
      primary: '#C4B3E3',
      secondary: '#FFFFFF',
      accent: '#8C6FC4',
      belly: '#FFFFFF',
      eyes: '#231A38',
      glow: '#E9D9FF',
    },
    head: { shape: 'feline', muzzle: 'short', nose: 'triangle' },
    face: { eyes: 'sparkle', eyeSize: 0.7, mouth: 'smile', blush: true },
    ears: { shape: 'pointed', size: 0.75, color: 'primary', innerColor: 'secondary' },
    tail: { shape: 'curl', size: 0.75, color: 'primary', tipColor: 'accent' },
    extras: [
      { kind: 'spots', count: 4, color: 'accent' },
      { kind: 'socks', color: 'secondary' },
    ],
    elementFx: 'dust',
  },
});

export const gkSpecies: readonly SpeciesDef[] = [
  sparkit,
  voltail,
  thundervixen,
  emberpup,
  blazehound,
  infernox,
  sploot,
  budbun,
  bloomhop,
  chirpip,
  galewing,
  stormcrest,
  pebblit,
  snoozle,
  mimicat,
  zapcoon,
  voltbandit,
  solaryx,
  magmadillo,
  boltbuck,
];
