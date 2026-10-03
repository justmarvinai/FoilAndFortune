import type { SfxId } from '../index';
import type { PartialSpec } from './instruments';
import type { SfxLayer, SfxPreset } from './render';

/**
 * Sound designs (docs/04 §11.2, docs/05 §6), as data. Each sound is a few layers: ZzFX patches
 * (paste straight from the ZzFX designer), tones, filtered noise, bells, instrument notes and
 * sparkle grains. Buffers are peak-normalized, then `gainDb` sets the loudness balance (checked
 * with `scripts/audio/levels.ts`).
 *
 * Musical sounds sit in the soundtrack's keys: UI rewards in F major (the day music's key; also
 * fits the evening's B♭ and the night's D minor), pack stingers in D major, resolving the
 * pack-opening bed (`music/styles.ts`). MIDI: D5 = 74, F5 = 77, A5 = 81, D6 = 86, F6 = 89.
 */

/** A warm shop bell: inharmonic partials, one detuned twin for a slow shimmer. */
const SHOP_BELL: readonly PartialSpec[] = [
  [1, 1, 0.9],
  [1.003, 0.5, 0.9],
  [2, 0.3, 0.45],
  [2.76, 0.28, 0.3],
  [5.4, 0.08, 0.12],
];
const SOFT_BELL: readonly PartialSpec[] = [
  [1, 1, 1],
  [2, 0.25, 0.4],
  [3, 0.08, 0.2],
];
const COIN: readonly PartialSpec[] = [
  [1, 1, 0.15],
  [1.47, 0.6, 0.09],
  [2.09, 0.35, 0.06],
  [2.89, 0.2, 0.04],
];
const CHING: readonly PartialSpec[] = [
  [1, 1, 0.6],
  [1.004, 0.6, 0.6],
  [2.4, 0.4, 0.3],
  [3.9, 0.2, 0.15],
  [5.8, 0.08, 0.08],
];

/** A cardboard knock: low thump plus boxy band-passed noise. */
function thud(at: number, freq: number, gain: number): SfxLayer[] {
  return [
    { kind: 'noise', at, filter: 'bp', freq, q: 1.2, decay: 0.02, dur: 0.06, gain },
    { kind: 'tone', at, freq: 190, to: 150, glide: 0.03, decay: 0.03, dur: 0.07, gain: gain * 0.6 },
  ];
}

function boxThud(at: number, gain: number): SfxLayer[] {
  return [
    { kind: 'tone', at, freq: 110, to: 60, glide: 0.03, decay: 0.09, dur: 0.25, gain },
    { kind: 'noise', at, filter: 'lp', freq: 500, decay: 0.04, dur: 0.1, gain: gain * 0.6 },
  ];
}

export const sfxPresets: Record<SfxId, SfxPreset> = {
  // ---------------------------------------------------------------- UI (docs/05 §6)
  'ui.pop': {
    // Soft rising "bloop" for button presses (ZzFX: sine 400 Hz sliding up ~7 kHz/s).
    layers: [
      { kind: 'zzfx', params: [1, 0, 400, 0.002, 0.01, 0.06, 0, 1, 14] },
      { kind: 'noise', filter: 'hp', freq: 3000, decay: 0.004, dur: 0.012, gain: 0.15 },
    ],
    gainDb: -14,
    jitter: 0.05,
    minIntervalMs: 30,
  },
  'ui.open': {
    layers: [
      {
        kind: 'noise',
        filter: 'bp',
        freq: 700,
        to: 2600,
        q: 1.2,
        attack: 0.06,
        decay: 0.08,
        dur: 0.2,
        gain: 0.5,
      },
      {
        kind: 'tone',
        at: 0.07,
        freq: 520,
        to: 1040,
        glide: 0.04,
        decay: 0.05,
        dur: 0.14,
        gain: 0.6,
      },
    ],
    gainDb: -13.5,
    jitter: 0.03,
    minIntervalMs: 60,
  },
  'ui.close': {
    layers: [
      {
        kind: 'noise',
        filter: 'bp',
        freq: 2400,
        to: 700,
        q: 1.2,
        attack: 0.03,
        decay: 0.07,
        dur: 0.16,
        gain: 0.5,
      },
      {
        kind: 'tone',
        at: 0.02,
        freq: 760,
        to: 380,
        glide: 0.04,
        decay: 0.05,
        dur: 0.12,
        gain: 0.6,
      },
    ],
    gainDb: -13.5,
    jitter: 0.03,
    minIntervalMs: 60,
  },
  'ui.tab': {
    layers: [
      { kind: 'tone', wave: 'triangle', freq: 1250, attack: 0.001, decay: 0.012, dur: 0.045 },
      { kind: 'noise', filter: 'hp', freq: 4000, decay: 0.003, dur: 0.01, gain: 0.2 },
    ],
    gainDb: -12.5,
    jitter: 0.06,
    minIntervalMs: 25,
  },
  'ui.tick': {
    layers: [{ kind: 'zzfx', params: [1, 0, 2100, 0, 0.004, 0.018, 1] }],
    gainDb: -19,
    jitter: 0.08,
    minIntervalMs: 20,
  },
  'ui.toggle': {
    // Two-step click: triangle 880 Hz that jumps up a fifth after 30 ms.
    layers: [{ kind: 'zzfx', params: [1, 0, 880, 0.001, 0.02, 0.04, 1, 1, 0, 0, 440, 0.03] }],
    gainDb: -18,
    jitter: 0.03,
    minIntervalMs: 40,
  },
  'ui.error': {
    // Gentle "bonk": a rounded triangle that sags in pitch, plus a soft wood knock. Never harsh.
    layers: [
      {
        kind: 'zzfx',
        params: [1, 0, 196, 0.005, 0.04, 0.15, 1, 1.4, -0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0.8],
      },
      { kind: 'noise', filter: 'bp', freq: 700, q: 2, decay: 0.012, dur: 0.03, gain: 0.3 },
    ],
    gainDb: -14,
    jitter: 0.03,
    minIntervalMs: 120,
  },
  'ui.stamp': {
    // "DEAL!" stamp: a low thump, a dull body and a papery slap.
    layers: [
      { kind: 'tone', freq: 140, to: 50, glide: 0.035, attack: 0.001, decay: 0.11, dur: 0.4 },
      { kind: 'noise', filter: 'lp', freq: 900, decay: 0.03, dur: 0.08, gain: 0.6 },
      { kind: 'noise', filter: 'bp', freq: 2600, q: 0.8, decay: 0.012, dur: 0.04, gain: 0.35 },
    ],
    room: 0.15,
    tail: 0.2,
    gainDb: -10,
    jitter: 0.03,
    minIntervalMs: 80,
  },
  'ui.receipt': {
    // One thermal-printer line: a choppy paper buzz over a stepper-motor whine.
    layers: [
      {
        kind: 'noise',
        filter: 'bp',
        freq: 2200,
        q: 3,
        am: 70,
        attack: 0.005,
        decay: 10,
        dur: 0.2,
        gain: 0.6,
      },
      {
        kind: 'tone',
        wave: 'square',
        freq: 175,
        lp: 1200,
        attack: 0.005,
        decay: 10,
        dur: 0.2,
        gain: 0.25,
        trem: [60, 0.5],
      },
    ],
    gainDb: -21,
    jitter: 0.03,
    minIntervalMs: 40,
  },
  'ui.levelUp': {
    // F major jingle: bell arpeggio into an Fmaj9 bloom with sparkles.
    layers: [
      {
        kind: 'notes',
        instrument: 'bell',
        notes: [
          [0, 77, 0.3, 0.75],
          [0.085, 81, 0.3, 0.8],
          [0.17, 84, 0.3, 0.85],
          [0.255, 89, 0.3, 0.95],
        ],
        spread: 0.5,
      },
      {
        kind: 'notes',
        at: 0.36,
        instrument: 'ep',
        notes: [[0, [65, 69, 72, 76, 79], 1, 0.7]],
        gain: 0.8,
      },
      {
        kind: 'notes',
        at: 0.36,
        instrument: 'pad',
        notes: [[0, [53, 60, 64, 69], 1, 0.6]],
        gain: 0.5,
      },
      { kind: 'notes', at: 0.36, instrument: 'bell', notes: [[0, [89, 93], 0.5, 0.6]], gain: 0.6 },
      {
        kind: 'sparkle',
        at: 0.3,
        dur: 1.1,
        rate: 30,
        lo: 3000,
        hi: 8000,
        shape: 'out',
        gain: 0.25,
      },
    ],
    stereo: true,
    halfRate: true,
    room: 0.25,
    tail: 0.3,
    gainDb: -10.6,
    duck: { amount: 0.5, ms: 1500 },
    minIntervalMs: 500,
  },
  'ui.achievement': {
    layers: [
      {
        kind: 'notes',
        instrument: 'bell',
        notes: [
          [0, 77, 0.3, 0.7],
          [0.07, 81, 0.3, 0.75],
          [0.14, 84, 0.3, 0.8],
          [0.21, 89, 0.3, 0.9],
        ],
        spread: 0.6,
      },
      { kind: 'notes', at: 0.3, instrument: 'bell', notes: [[0, [89, 93], 0.6, 0.7]], gain: 0.7 },
      { kind: 'sparkle', at: 0.1, dur: 0.9, rate: 28, lo: 3500, hi: 9000, shape: 'out', gain: 0.3 },
    ],
    stereo: true,
    halfRate: true,
    room: 0.25,
    gainDb: -11,
    duck: { amount: 0.35, ms: 900 },
    minIntervalMs: 300,
  },
  'ui.notify': {
    layers: [
      {
        kind: 'notes',
        instrument: 'bell',
        notes: [
          [0, 81, 0.3, 0.7],
          [0.09, 84, 0.3, 0.8],
        ],
      },
    ],
    gainDb: -16.8,
    minIntervalMs: 200,
  },
  'ui.paper': {
    layers: [
      {
        kind: 'noise',
        filter: 'bp',
        freq: 3500,
        q: 0.7,
        am: 40,
        attack: 0.02,
        decay: 0.12,
        dur: 0.25,
      },
      {
        kind: 'noise',
        filter: 'hp',
        freq: 4000,
        crackle: 120,
        attack: 0.01,
        decay: 0.15,
        dur: 0.2,
        gain: 0.5,
      },
    ],
    gainDb: -18,
    variants: 3,
    jitter: 0.05,
    minIntervalMs: 60,
  },
  'ui.coin': {
    // One coin: bright inharmonic partials and a little bounce.
    layers: [
      {
        kind: 'bell',
        freq: 2350,
        partials: COIN,
        dur: 0.4,
        strikes: [
          [0, 1],
          [0.065, 0.4],
        ],
        humanize: 0.01,
      },
      { kind: 'noise', filter: 'hp', freq: 5000, decay: 0.002, dur: 0.008, gain: 0.3 },
    ],
    gainDb: -15.6,
    jitter: 0.06,
    variants: 2,
    minIntervalMs: 40,
  },
  'ui.coins': {
    layers: [
      {
        kind: 'bell',
        freq: 2350,
        partials: COIN,
        dur: 0.6,
        strikes: [
          [0, 1],
          [0.16, 0.6],
          [0.33, 0.35],
        ],
        humanize: 0.02,
      },
      {
        kind: 'bell',
        freq: 2620,
        partials: COIN,
        dur: 0.6,
        strikes: [
          [0.05, 0.8],
          [0.22, 0.5],
          [0.4, 0.3],
        ],
        humanize: 0.02,
        pan: 0.3,
      },
      {
        kind: 'bell',
        freq: 2140,
        partials: COIN,
        dur: 0.6,
        strikes: [
          [0.09, 0.7],
          [0.27, 0.45],
        ],
        humanize: 0.02,
        pan: -0.3,
      },
    ],
    stereo: true,
    gainDb: -13.7,
    variants: 2,
    jitter: 0.04,
    minIntervalMs: 120,
  },

  // ---------------------------------------------------------------- Shop world
  'shop.doorBell': {
    // The brass bell on the door spring: a few quick strikes as it swings, plus a smaller twin.
    layers: [
      {
        kind: 'bell',
        freq: 1046.5,
        partials: SHOP_BELL,
        dur: 1.7,
        strikes: [
          [0, 1],
          [0.12, 0.6],
          [0.23, 0.45],
          [0.37, 0.25],
        ],
        humanize: 0.015,
      },
      {
        kind: 'bell',
        at: 0.05,
        freq: 1568,
        partials: SHOP_BELL,
        dur: 1.4,
        strikes: [
          [0, 0.45],
          [0.13, 0.3],
          [0.26, 0.2],
        ],
        humanize: 0.015,
        gain: 0.7,
      },
    ],
    room: 0.3,
    tail: 0.3,
    variants: 3,
    jitter: 0.02,
    gainDb: -14,
    minIntervalMs: 400,
  },
  'shop.register': {
    // Barcode scan beep (B6), with a faint second harmonic.
    layers: [
      { kind: 'zzfx', params: [1, 0, 1975, 0.002, 0.07, 0.02] },
      { kind: 'tone', freq: 3950, attack: 0.002, decay: 10, dur: 0.09, gain: 0.12 },
    ],
    gainDb: -17,
    jitter: 0.005,
    minIntervalMs: 60,
  },
  'shop.chaChing': {
    // "Cha": the drawer's mechanical clunk; "ching": the bell; then the drawer rolls and coins clink.
    layers: [
      { kind: 'noise', filter: 'bp', freq: 1500, q: 1, decay: 0.025, dur: 0.06, gain: 0.8 },
      {
        kind: 'tone',
        wave: 'square',
        freq: 260,
        to: 180,
        glide: 0.02,
        lp: 900,
        decay: 0.03,
        dur: 0.06,
        gain: 0.3,
      },
      { kind: 'bell', at: 0.08, freq: 2093, partials: CHING, dur: 1 },
      {
        kind: 'noise',
        at: 0.12,
        filter: 'lp',
        freq: 600,
        to: 1500,
        attack: 0.05,
        decay: 0.1,
        dur: 0.22,
        gain: 0.3,
      },
      {
        kind: 'bell',
        at: 0.2,
        freq: 2600,
        partials: COIN,
        dur: 0.4,
        strikes: [
          [0, 0.5],
          [0.07, 0.3],
        ],
        gain: 0.5,
      },
    ],
    room: 0.2,
    tail: 0.2,
    gainDb: -14,
    variants: 2,
    // A manual checkout plays it on click and again from the sale event: one cha-ching only.
    minIntervalMs: 150,
  },
  'shop.restock': {
    layers: [
      ...thud(0, 700, 1),
      ...thud(0.09, 650, 0.7),
      ...thud(0.17, 760, 0.5),
      {
        kind: 'noise',
        filter: 'bp',
        freq: 2500,
        am: 30,
        attack: 0.03,
        decay: 0.1,
        dur: 0.25,
        gain: 0.15,
      },
    ],
    gainDb: -11.6,
    jitter: 0.05,
    variants: 3,
    minIntervalMs: 90,
  },
  'shop.delivery': {
    // Two boxes land, then the two-tone "ding-dong" (A5 → F5).
    layers: [
      ...boxThud(0, 1),
      ...boxThud(0.17, 0.8),
      { kind: 'bell', at: 0.45, freq: 880, partials: SOFT_BELL, dur: 1 },
      { kind: 'bell', at: 0.78, freq: 698.5, partials: SOFT_BELL, dur: 1.1 },
    ],
    room: 0.3,
    gainDb: -13,
    minIntervalMs: 600,
  },
  'shop.boxOpen': {
    // Packing tape rip, then the flaps fold open.
    layers: [
      {
        kind: 'noise',
        filter: 'bp',
        freq: 1400,
        to: 2800,
        q: 1.5,
        am: 90,
        attack: 0.01,
        decay: 10,
        dur: 0.32,
        gain: 0.9,
      },
      { kind: 'noise', filter: 'hp', freq: 3000, crackle: 200, decay: 10, dur: 0.3, gain: 0.4 },
      { kind: 'tone', at: 0.42, freq: 160, to: 110, glide: 0.03, decay: 0.04, dur: 0.1, gain: 0.6 },
      { kind: 'noise', at: 0.42, filter: 'lp', freq: 800, decay: 0.03, dur: 0.08, gain: 0.5 },
      {
        kind: 'tone',
        at: 0.52,
        freq: 150,
        to: 105,
        glide: 0.03,
        decay: 0.04,
        dur: 0.1,
        gain: 0.45,
      },
      { kind: 'noise', at: 0.52, filter: 'lp', freq: 800, decay: 0.03, dur: 0.08, gain: 0.36 },
    ],
    gainDb: -13,
    variants: 2,
    jitter: 0.04,
    minIntervalMs: 300,
  },
  'shop.priceTag': {
    // Price gun "ka-chunk": click, a filtered square clunk (ZzFX), the return click.
    layers: [
      { kind: 'noise', filter: 'hp', freq: 3000, decay: 0.003, dur: 0.01, gain: 0.6 },
      {
        kind: 'zzfx',
        params: [1, 0, 420, 0, 0.01, 0.03, 5, 0.5, -4, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -700],
        gain: 0.5,
      },
      { kind: 'noise', at: 0.06, filter: 'hp', freq: 2500, decay: 0.004, dur: 0.015, gain: 0.5 },
      { kind: 'tone', at: 0.06, freq: 1200, decay: 0.008, dur: 0.02, gain: 0.3 },
    ],
    gainDb: -12,
    jitter: 0.04,
    minIntervalMs: 60,
  },
  'shop.orderSent': {
    layers: [
      {
        kind: 'noise',
        filter: 'bp',
        freq: 700,
        to: 3200,
        q: 1,
        attack: 0.08,
        decay: 0.1,
        dur: 0.3,
        gain: 0.5,
      },
      { kind: 'bell', at: 0.18, freq: 1046.5, partials: SOFT_BELL, dur: 0.6, gain: 0.7 },
      { kind: 'bell', at: 0.27, freq: 1396.9, partials: SOFT_BELL, dur: 0.6, gain: 0.7 },
    ],
    gainDb: -16.4,
    minIntervalMs: 300,
  },
  'shop.angry': {
    // Steam puff "pfff" and a low "grr" (sawtooth with a fast tremolo).
    layers: [
      {
        kind: 'noise',
        filter: 'bp',
        freq: 2200,
        to: 900,
        q: 0.8,
        attack: 0.01,
        decay: 0.12,
        dur: 0.3,
        gain: 0.7,
      },
      {
        kind: 'tone',
        wave: 'saw',
        freq: 115,
        to: 92,
        glide: 0.2,
        lp: 700,
        attack: 0.02,
        decay: 0.2,
        dur: 0.35,
        gain: 0.5,
        trem: [22, 0.5],
      },
    ],
    gainDb: -12,
    jitter: 0.05,
    minIntervalMs: 250,
  },
  'shop.happy': {
    layers: [
      {
        kind: 'notes',
        instrument: 'bell',
        notes: [
          [0, 89, 0.2, 0.7],
          [0.07, 93, 0.2, 0.75],
          [0.14, 96, 0.2, 0.85],
        ],
        spread: 0.4,
      },
      {
        kind: 'sparkle',
        at: 0.05,
        dur: 0.55,
        rate: 25,
        lo: 3500,
        hi: 9000,
        shape: 'out',
        gain: 0.3,
      },
    ],
    stereo: true,
    gainDb: -15,
    minIntervalMs: 250,
  },

  // ---------------------------------------------------------------- Pack opening (docs/05 §5.7)
  'pack.tear': {
    // Crinkly foil: a swept, grainy rip, dense foil crinkles, a papery body and the final snap.
    layers: [
      {
        kind: 'noise',
        filter: 'bp',
        freq: 1700,
        to: 3600,
        q: 1.1,
        am: 160,
        attack: 0.03,
        decay: 10,
        dur: 0.5,
        gain: 0.8,
      },
      {
        kind: 'noise',
        filter: 'hp',
        freq: 3500,
        crackle: 320,
        attack: 0.02,
        decay: 10,
        dur: 0.5,
        gain: 0.9,
      },
      {
        kind: 'noise',
        filter: 'lp',
        freq: 700,
        am: 40,
        attack: 0.05,
        decay: 0.25,
        dur: 0.45,
        gain: 0.25,
      },
      {
        kind: 'noise',
        at: 0.47,
        filter: 'hp',
        freq: 2500,
        crackle: 900,
        decay: 0.015,
        dur: 0.05,
        gain: 0.7,
      },
    ],
    gainDb: -8.3,
    variants: 3,
    jitter: 0.04,
    minIntervalMs: 120,
  },
  'pack.slide': {
    layers: [
      {
        kind: 'noise',
        filter: 'bp',
        freq: 1100,
        to: 2300,
        q: 0.9,
        attack: 0.05,
        decay: 0.12,
        dur: 0.24,
        gain: 0.8,
      },
      { kind: 'tone', at: 0.22, freq: 1800, decay: 0.006, dur: 0.02, gain: 0.2 },
    ],
    gainDb: -14.8,
    jitter: 0.05,
    variants: 2,
    minIntervalMs: 60,
  },
  'pack.flip': {
    layers: [
      {
        kind: 'noise',
        filter: 'bp',
        freq: 2600,
        q: 1,
        attack: 0.004,
        decay: 0.03,
        dur: 0.08,
        gain: 0.8,
      },
      { kind: 'tone', freq: 700, to: 1500, glide: 0.02, decay: 0.025, dur: 0.06, gain: 0.35 },
      { kind: 'noise', at: 0.05, filter: 'hp', freq: 3500, decay: 0.003, dur: 0.01, gain: 0.4 },
    ],
    gainDb: -12.2,
    variants: 3,
    jitter: 0.06,
    minIntervalMs: 35,
  },
  'pack.snap': {
    layers: [
      { kind: 'noise', filter: 'hp', freq: 2500, decay: 0.004, dur: 0.015, gain: 0.8 },
      { kind: 'tone', freq: 1900, decay: 0.008, dur: 0.025, gain: 0.4 },
    ],
    gainDb: -10.7,
    jitter: 0.05,
    minIntervalMs: 30,
  },
  'pack.glow': {
    // Anticipation for the rare slot's edge glow: an A5/E6 swell with gathering sparkles.
    layers: [
      {
        kind: 'tone',
        freq: 880,
        attack: 0.45,
        decay: 10,
        dur: 0.9,
        release: 0.25,
        gain: 0.35,
        vib: [5, 8],
      },
      {
        kind: 'tone',
        freq: 1318.5,
        attack: 0.5,
        decay: 10,
        dur: 0.9,
        release: 0.25,
        gain: 0.25,
        vib: [5.5, 6],
      },
      { kind: 'sparkle', at: 0.2, dur: 0.9, rate: 18, lo: 3000, hi: 8000, shape: 'in', gain: 0.3 },
      {
        kind: 'noise',
        filter: 'hp',
        freq: 6000,
        attack: 0.6,
        decay: 10,
        dur: 0.9,
        release: 0.25,
        gain: 0.05,
      },
    ],
    stereo: true,
    halfRate: true,
    gainDb: -16,
    minIntervalMs: 300,
  },
  'pack.shimmer': {
    layers: [{ kind: 'sparkle', dur: 0.6, rate: 35, lo: 4000, hi: 9000 }],
    stereo: true,
    gainDb: -20,
    minIntervalMs: 120,
  },
  'pack.newCard': {
    layers: [
      { kind: 'tone', freq: 600, to: 1200, glide: 0.02, decay: 0.04, dur: 0.1, gain: 0.5 },
      { kind: 'notes', at: 0.05, instrument: 'bell', notes: [[0, 86, 0.3, 0.8]] },
    ],
    gainDb: -17.3,
    minIntervalMs: 80,
  },
  // Rarity stingers: one ascending family, longer, richer and louder per tier (docs/05 §6).
  'pack.stingerRare': {
    layers: [
      {
        kind: 'notes',
        instrument: 'bell',
        notes: [
          [0, 81, 0.3, 0.7],
          [0.09, 86, 0.3, 0.8],
        ],
        spread: 0.3,
      },
      {
        kind: 'sparkle',
        at: 0.1,
        dur: 0.5,
        rate: 12,
        lo: 3000,
        hi: 7000,
        shape: 'out',
        gain: 0.25,
      },
    ],
    stereo: true,
    room: 0.2,
    gainDb: -15,
    duck: { amount: 0.25, ms: 700 },
  },
  'pack.stingerHolo': {
    layers: [
      {
        kind: 'notes',
        instrument: 'bell',
        notes: [
          [0, 74, 0.3, 0.7],
          [0.075, 78, 0.3, 0.75],
          [0.15, 81, 0.3, 0.8],
          [0.225, 86, 0.3, 0.9],
        ],
        spread: 0.5,
      },
      { kind: 'notes', at: 0.225, instrument: 'mallet', notes: [[0, 62, 0.5, 0.5]], gain: 0.5 },
      {
        kind: 'sparkle',
        at: 0.15,
        dur: 0.95,
        rate: 25,
        lo: 3000,
        hi: 8000,
        shape: 'out',
        gain: 0.3,
      },
    ],
    stereo: true,
    halfRate: true,
    room: 0.25,
    gainDb: -11.3,
    duck: { amount: 0.4, ms: 1000 },
  },
  'pack.stingerUltra': {
    layers: [
      {
        kind: 'notes',
        instrument: 'pluck',
        notes: [
          [0, 74, 0.3, 0.8],
          [0.06, 78, 0.3, 0.8],
          [0.12, 81, 0.3, 0.8],
          [0.18, 85, 0.3, 0.85],
          [0.24, 88, 0.3, 0.9],
        ],
        spread: 0.6,
      },
      {
        kind: 'notes',
        at: 0.3,
        instrument: 'ep',
        notes: [[0, [62, 66, 69, 73, 76], 1, 0.7]],
        gain: 0.8,
      },
      { kind: 'notes', at: 0.3, instrument: 'bell', notes: [[0, [86, 90], 0.5, 0.7]], gain: 0.6 },
      {
        kind: 'sparkle',
        at: 0.25,
        dur: 1.25,
        rate: 30,
        lo: 3000,
        hi: 9000,
        shape: 'out',
        gain: 0.3,
      },
    ],
    stereo: true,
    halfRate: true,
    room: 0.3,
    gainDb: -10,
    duck: { amount: 0.5, ms: 1400 },
  },
  'pack.stingerIllustration': {
    layers: [
      {
        kind: 'notes',
        instrument: 'pluck',
        notes: [74, 76, 78, 81, 83, 86, 88, 90, 93, 95].map(
          (midi, i) => [i * 0.035, midi, 0.3, 0.55 + i * 0.04] as const,
        ),
        spread: 0.7,
      },
      {
        kind: 'notes',
        at: 0.3,
        instrument: 'pad',
        notes: [[0, [62, 66, 69, 73, 76], 1.4, 0.7]],
        gain: 0.7,
      },
      {
        kind: 'notes',
        at: 0.35,
        instrument: 'bell',
        notes: [
          [0, 74, 0.5, 0.7],
          [0.05, [93, 98], 0.5, 0.6],
        ],
        gain: 0.7,
      },
      { kind: 'sparkle', at: 0.3, dur: 1.7, rate: 35, lo: 3000, hi: 9500, shape: 'out', gain: 0.3 },
    ],
    stereo: true,
    halfRate: true,
    room: 0.35,
    gainDb: -8.9,
    duck: { amount: 0.6, ms: 1800 },
  },
  'pack.stingerSecret': {
    layers: [
      // Riser into a Dmaj13 hit with a sub boom, then a falling bell cascade.
      {
        kind: 'noise',
        filter: 'bp',
        freq: 500,
        to: 5000,
        q: 0.8,
        attack: 0.5,
        decay: 10,
        dur: 0.52,
        gain: 0.45,
      },
      {
        kind: 'tone',
        freq: 440,
        to: 880,
        glide: 0.25,
        attack: 0.45,
        decay: 10,
        dur: 0.52,
        gain: 0.15,
      },
      {
        kind: 'tone',
        at: 0.5,
        freq: 73.4,
        to: 60,
        glide: 0.1,
        attack: 0.003,
        decay: 0.5,
        dur: 1.2,
        gain: 0.9,
      },
      {
        kind: 'notes',
        at: 0.5,
        instrument: 'ep',
        notes: [[0, [62, 66, 69, 73, 76, 83], 1.6, 0.8]],
      },
      {
        kind: 'notes',
        at: 0.5,
        instrument: 'bell',
        notes: [[0, [86, 90, 93], 0.5, 0.7]],
        gain: 0.6,
      },
      {
        kind: 'notes',
        at: 0.6,
        instrument: 'bell',
        notes: [
          [0, 98, 0.2, 0.5],
          [0.08, 93, 0.2, 0.5],
          [0.16, 90, 0.2, 0.5],
          [0.24, 88, 0.2, 0.5],
          [0.32, 86, 0.2, 0.55],
        ],
        spread: 0.6,
        gain: 0.6,
      },
      {
        kind: 'sparkle',
        at: 0.5,
        dur: 2.1,
        rate: 40,
        lo: 3000,
        hi: 10000,
        shape: 'out',
        gain: 0.3,
      },
      {
        kind: 'noise',
        at: 0.5,
        filter: 'hp',
        freq: 5000,
        attack: 0.02,
        decay: 0.5,
        dur: 1,
        gain: 0.2,
      },
    ],
    stereo: true,
    halfRate: true,
    room: 0.35,
    gainDb: -7.8,
    duck: { amount: 0.7, ms: 2300 },
  },
  'pack.stingerMythic': {
    layers: [
      // Brass fanfare: "da-da-da DAAA", a plagal G/D, then the big D with timpani and cymbal swell.
      {
        kind: 'notes',
        instrument: 'brass',
        notes: [
          [0, 69, 0.07, 0.7],
          [0.09, 69, 0.07, 0.7],
          [0.18, 69, 0.07, 0.75],
          [0.27, [62, 66, 69, 74], 0.75, 0.9],
          [1.05, [62, 67, 71, 74], 0.3, 0.85],
          [1.38, [62, 66, 69, 74, 78], 1.3, 1],
        ],
      },
      {
        kind: 'notes',
        instrument: 'timpani',
        notes: [
          [0.27, 38, 0.5, 0.9],
          [1.38, 38, 0.5, 1],
        ],
        gain: 0.8,
      },
      {
        kind: 'noise',
        at: 0.48,
        filter: 'hp',
        freq: 4500,
        attack: 0.9,
        decay: 0.6,
        dur: 1.6,
        gain: 0.25,
      },
      {
        kind: 'notes',
        instrument: 'bell',
        notes: [
          [0.27, 81, 0.3, 0.6],
          [1.38, 86, 0.4, 0.8],
        ],
        gain: 0.6,
      },
      {
        kind: 'sparkle',
        at: 1.38,
        dur: 1.6,
        rate: 45,
        lo: 3000,
        hi: 10000,
        shape: 'out',
        gain: 0.3,
      },
    ],
    stereo: true,
    halfRate: true,
    room: 0.35,
    gainDb: -6,
    duck: { amount: 0.8, ms: 3000 },
  },
  'pack.godPack': {
    layers: [
      // Riser → D → run → G → A → a long D with choir pad, bells and a rain of sparkles.
      {
        kind: 'noise',
        filter: 'bp',
        freq: 400,
        to: 6000,
        q: 0.8,
        attack: 0.55,
        decay: 10,
        dur: 0.6,
        gain: 0.45,
      },
      {
        kind: 'notes',
        instrument: 'brass',
        notes: [
          [0.6, [62, 66, 69, 74], 0.45, 0.9],
          [1.1, 74, 0.09, 0.8],
          [1.2, 76, 0.09, 0.8],
          [1.3, 78, 0.09, 0.85],
          [1.4, 81, 0.12, 0.9],
          [1.6, [67, 71, 74, 79], 0.42, 0.9],
          [2.1, [69, 73, 76, 81], 0.42, 0.95],
          [2.6, [62, 66, 69, 74, 78, 81], 1.6, 1],
        ],
      },
      {
        kind: 'notes',
        instrument: 'timpani',
        notes: [
          [0.6, 38, 0.5, 0.9],
          [2.1, 45, 0.5, 0.8],
          [2.6, 38, 0.5, 1],
        ],
        gain: 0.8,
      },
      {
        kind: 'noise',
        at: 1.7,
        filter: 'hp',
        freq: 4500,
        attack: 0.9,
        decay: 0.8,
        dur: 2,
        gain: 0.25,
      },
      {
        kind: 'notes',
        at: 2.6,
        instrument: 'pad',
        notes: [[0, [50, 62, 66, 69, 73, 76], 1.6, 0.7]],
        gain: 0.6,
      },
      {
        kind: 'notes',
        at: 2.6,
        instrument: 'bell',
        notes: [
          [0, 86, 0.3, 0.7],
          [0.1, 90, 0.3, 0.75],
          [0.2, 93, 0.3, 0.8],
          [0.3, 98, 0.4, 0.9],
        ],
        spread: 0.6,
        gain: 0.7,
      },
      {
        kind: 'sparkle',
        at: 2.6,
        dur: 1.9,
        rate: 60,
        lo: 3000,
        hi: 10000,
        shape: 'out',
        gain: 0.35,
      },
    ],
    stereo: true,
    halfRate: true,
    room: 0.4,
    gainDb: -5,
    duck: { amount: 0.85, ms: 4300 },
  },
};

/** Ids in pre-render order: the interface first (needed soonest), the long fanfares last. */
export const SFX_IDS = Object.keys(sfxPresets) as SfxId[];
