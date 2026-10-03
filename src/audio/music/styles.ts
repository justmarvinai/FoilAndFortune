import type { MusicContext } from '../index';

/**
 * The procedural soundtrack's styles (docs/04 §11.1, Q15: cozy lo-fi / jazz-hop), as data. Each
 * playing context is a key, a tempo with swing, two 4-bar progressions of diatonic extended
 * chords, an 8-bar section form, drum/bass/comping patterns, a melody instrument and a mix.
 *
 * Chords stack diatonic thirds on a scale degree, so every note stays in key: the default is a
 * 9th chord (maj9 on I/IV, m9 on ii/vi), `7` a plain seventh (iii, where the 9th would clash),
 * `sus` a 9sus4 and `13` a dominant 13. Pack stingers are in D major and resolve the `opening` bed.
 */
export type Mode = 'major' | 'aeolian';

export const SCALES: Record<Mode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

export interface ChordSpec {
  /** Scale degree, 1–7. */
  degree: number;
  kind?: '9' | '7' | 'sus' | '13';
}

export type Part = 'kick' | 'snare' | 'hat' | 'bass' | 'keys' | 'pad' | 'lead' | 'arp' | 'riser';

export type LeadInstrument = 'bell' | 'mallet' | 'pluck' | 'flute';

export interface SectionSpec {
  drums: 'full' | 'light' | 'none';
  bass: boolean;
  keys: boolean;
  pad: boolean;
  lead: boolean;
  arp: boolean;
  /** Index into `progressions`. */
  progression: number;
}

/** A 16th-step pattern: [step 0–15, length in steps, role or velocity]. */
export type BassStep = readonly [number, number, 'R' | '5' | 'O' | 'A' | 'P'];
export type CompStep = readonly [number, number, number];

export interface MusicStyle {
  bpm: number;
  /** 16th swing: 0.5 straight, 0.6 lazy, 0.67 triplet. */
  swing: number;
  /** Tonic pitch class (0 = C). */
  tonic: number;
  mode: Mode;
  progressions: readonly (readonly ChordSpec[])[];
  /** Section per 8-bar phrase: phrase 0 plays `form[0]`, later phrases cycle through the rest. */
  form: readonly string[];
  sections: Readonly<Record<string, SectionSpec>>;
  drums: {
    /** 16-step strings: `x` hit, `o` soft hit, `.` rest. Kick variants are picked per bar. */
    kick: readonly string[];
    snare: string;
    hat: string;
    light: { kick: string; snare: string; hat: string };
    /** Side-stick instead of a snare (evening, night). */
    rim: boolean;
    /** Chance of a ghost snare per empty off-beat. */
    ghost: number;
  };
  bass: { patterns: readonly (readonly BassStep[])[] };
  keys: { center: number; comp: readonly (readonly CompStep[])[] };
  lead: { instrument: LeadInstrument; low: number; high: number; density: number };
  arp?: { low: number; high: number };
  /** Riser every other phrase over its last two bars (tension for pack opening). */
  riser?: boolean;
  /** Part levels (dB), tape texture and the context bus. */
  mix: Readonly<Partial<Record<Part, number>>> & {
    crackle: number;
    /** Reverb send, 0–1. */
    reverb: number;
    /** Tape-style low-pass on the whole context (Hz): darker in the evening. */
    lowpass: number;
    /** Context bus gain (dB): balances the contexts' loudness against each other. */
    gain: number;
  };
}

const FULL = {
  drums: 'full',
  bass: true,
  keys: true,
  pad: false,
  lead: false,
  arp: false,
} as const;

export const musicStyles: Record<Exclude<MusicContext, 'silent'>, MusicStyle> = {
  // Warm and nostalgic: E♭ major, slow, flute melody over keys and pad.
  title: {
    bpm: 72,
    swing: 0.56,
    tonic: 3,
    mode: 'major',
    progressions: [
      [{ degree: 1 }, { degree: 6 }, { degree: 4 }, { degree: 5, kind: 'sus' }],
      [{ degree: 4 }, { degree: 3, kind: '7' }, { degree: 2 }, { degree: 5, kind: '13' }],
    ],
    form: ['intro', 'theme', 'theme', 'groove', 'break', 'theme', 'groove'],
    sections: {
      intro: {
        drums: 'none',
        bass: true,
        keys: true,
        pad: true,
        lead: false,
        arp: false,
        progression: 0,
      },
      theme: { ...FULL, drums: 'light', pad: true, lead: true, progression: 0 },
      groove: { ...FULL, pad: true, progression: 1 },
      break: {
        drums: 'none',
        bass: false,
        keys: true,
        pad: true,
        lead: true,
        arp: false,
        progression: 1,
      },
    },
    drums: {
      kick: ['x.......x.......', 'x.......x.x.....'],
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      light: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x...x...x...x...' },
      rim: true,
      ghost: 0.1,
    },
    bass: {
      patterns: [
        [
          [0, 10, 'R'],
          [10, 6, '5'],
        ],
        [
          [0, 12, 'R'],
          [12, 4, 'A'],
        ],
      ],
    },
    keys: {
      center: 63,
      comp: [
        [[0, 15, 0.7]],
        [
          [0, 7, 0.65],
          [8, 7, 0.6],
        ],
      ],
    },
    lead: { instrument: 'flute', low: 67, high: 86, density: 0.8 },
    mix: {
      kick: -9,
      snare: -15,
      hat: -24,
      bass: -9,
      keys: -9,
      pad: -19,
      lead: -13,
      crackle: -36,
      reverb: 0.25,
      lowpass: 5200,
      gain: -0.5,
    },
  },
  // Cozy and a bit brighter: F major, laid-back swing, music-box bell melody.
  day: {
    bpm: 84,
    swing: 0.6,
    tonic: 5,
    mode: 'major',
    progressions: [
      [{ degree: 4 }, { degree: 3, kind: '7' }, { degree: 2 }, { degree: 5, kind: 'sus' }],
      [{ degree: 1 }, { degree: 6 }, { degree: 2 }, { degree: 5, kind: '13' }],
    ],
    form: ['intro', 'groove', 'theme', 'theme', 'break', 'groove', 'theme', 'groove', 'break'],
    sections: {
      intro: { ...FULL, drums: 'light', bass: false, progression: 0 },
      groove: { ...FULL, progression: 0 },
      theme: { ...FULL, lead: true, progression: 1 },
      break: {
        drums: 'light',
        bass: true,
        keys: true,
        pad: true,
        lead: true,
        arp: false,
        progression: 1,
      },
    },
    drums: {
      kick: ['x.....x...x.....', 'x.......x.x.....', 'x.....x.x.......'],
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.xo',
      light: { kick: 'x.......x.......', snare: '................', hat: 'x.x.x.x.x.x.x.x.' },
      rim: false,
      ghost: 0.2,
    },
    bass: {
      patterns: [
        [
          [0, 6, 'R'],
          [6, 2, 'R'],
          [10, 4, '5'],
          [14, 2, 'A'],
        ],
        [
          [0, 8, 'R'],
          [10, 2, 'O'],
          [12, 4, '5'],
        ],
        [
          [0, 3, 'R'],
          [3, 3, 'R'],
          [8, 6, '5'],
          [14, 2, 'A'],
        ],
      ],
    },
    keys: {
      center: 62,
      comp: [
        [[0, 14, 0.75]],
        [
          [0, 7, 0.7],
          [10, 6, 0.6],
        ],
        [
          [0, 3, 0.7],
          [6, 8, 0.65],
        ],
      ],
    },
    lead: { instrument: 'bell', low: 72, high: 88, density: 0.7 },
    mix: {
      kick: -7,
      snare: -12,
      hat: -21,
      bass: -8,
      keys: -10,
      pad: -22,
      lead: -15,
      crackle: -38,
      reverb: 0.18,
      lowpass: 6500,
      gain: 0,
    },
  },
  // Mellower: B♭ major, side-stick, quarter-note hats, vibraphone, darker tape.
  evening: {
    bpm: 76,
    swing: 0.58,
    tonic: 10,
    mode: 'major',
    progressions: [
      [{ degree: 1 }, { degree: 6 }, { degree: 2 }, { degree: 5, kind: 'sus' }],
      [{ degree: 4 }, { degree: 3, kind: '7' }, { degree: 2 }, { degree: 1 }],
    ],
    form: ['groove', 'theme', 'groove', 'break', 'theme', 'theme', 'break'],
    sections: {
      groove: { ...FULL, progression: 0 },
      theme: { ...FULL, lead: true, progression: 0 },
      break: {
        drums: 'light',
        bass: true,
        keys: true,
        pad: true,
        lead: true,
        arp: false,
        progression: 1,
      },
    },
    drums: {
      kick: ['x.....x...x.....', 'x.........x.....'],
      snare: '....x.......x...',
      hat: 'x...x...x...x...',
      light: { kick: 'x.........x.....', snare: '............x...', hat: '..x...x...x...x.' },
      rim: true,
      ghost: 0.1,
    },
    bass: {
      patterns: [
        [
          [0, 7, 'R'],
          [8, 4, 'O'],
          [12, 4, '5'],
        ],
        [
          [0, 10, 'R'],
          [10, 6, 'A'],
        ],
      ],
    },
    keys: {
      center: 62,
      comp: [
        [[0, 15, 0.7]],
        [
          [0, 6, 0.65],
          [6, 9, 0.6],
        ],
      ],
    },
    lead: { instrument: 'mallet', low: 70, high: 86, density: 0.55 },
    mix: {
      kick: -8,
      snare: -14,
      hat: -23,
      bass: -8,
      keys: -9,
      pad: -21,
      lead: -14,
      crackle: -33,
      reverb: 0.24,
      lowpass: 3800,
      gain: 0,
    },
  },
  // Quiet summary mood: D minor, very slow, pad and keys, a heartbeat kick, music box.
  night: {
    bpm: 64,
    swing: 0.55,
    tonic: 2,
    mode: 'aeolian',
    progressions: [
      [{ degree: 1 }, { degree: 6 }, { degree: 4 }, { degree: 5, kind: '7' }],
      [{ degree: 6 }, { degree: 7 }, { degree: 1 }, { degree: 1, kind: '7' }],
    ],
    form: ['intro', 'groove', 'theme', 'groove', 'break', 'theme'],
    sections: {
      intro: {
        drums: 'none',
        bass: true,
        keys: true,
        pad: true,
        lead: false,
        arp: false,
        progression: 0,
      },
      groove: { ...FULL, drums: 'light', pad: true, progression: 0 },
      theme: { ...FULL, drums: 'light', pad: true, lead: true, progression: 1 },
      break: {
        drums: 'none',
        bass: false,
        keys: true,
        pad: true,
        lead: true,
        arp: false,
        progression: 1,
      },
    },
    drums: {
      kick: ['x...............'],
      snare: '........x.......',
      hat: '..x...x...x...x.',
      light: { kick: 'x...............', snare: '........x.......', hat: '..x...x...x...x.' },
      rim: true,
      ghost: 0,
    },
    bass: {
      patterns: [
        [[0, 16, 'R']],
        [
          [0, 12, 'R'],
          [12, 4, '5'],
        ],
      ],
    },
    keys: { center: 62, comp: [[[0, 16, 0.6]]] },
    lead: { instrument: 'bell', low: 69, high: 86, density: 0.4 },
    mix: {
      kick: -11,
      snare: -17,
      hat: -28,
      bass: -10,
      keys: -9,
      pad: -17,
      lead: -16,
      crackle: -34,
      reverb: 0.3,
      lowpass: 3200,
      gain: 1.4,
    },
  },
  // Tense, sparkly bed for pack opening: a D pedal under suspended D-major colors, a ticking
  // clock, sparkle arpeggios and a riser; the D-major stingers resolve it.
  opening: {
    bpm: 96,
    swing: 0.5,
    tonic: 2,
    mode: 'major',
    progressions: [[{ degree: 1 }, { degree: 4 }, { degree: 6 }, { degree: 5, kind: 'sus' }]],
    form: ['intro', 'build'],
    sections: {
      intro: {
        drums: 'light',
        bass: true,
        keys: false,
        pad: true,
        lead: false,
        arp: false,
        progression: 0,
      },
      build: {
        drums: 'full',
        bass: true,
        keys: false,
        pad: true,
        lead: false,
        arp: true,
        progression: 0,
      },
    },
    drums: {
      kick: ['x..x............'],
      snare: '................',
      hat: 'x.x.x.x.x.x.x.x.',
      light: { kick: '................', snare: '................', hat: 'x...x...x...x...' },
      rim: false,
      ghost: 0,
    },
    bass: {
      patterns: [
        [
          [0, 4, 'P'],
          [4, 4, 'P'],
          [8, 4, 'P'],
          [12, 4, 'P'],
        ],
      ],
    },
    keys: { center: 64, comp: [[[0, 16, 0.6]]] },
    lead: { instrument: 'bell', low: 74, high: 93, density: 0 },
    arp: { low: 74, high: 98 },
    riser: true,
    mix: {
      kick: -10,
      hat: -25,
      bass: -11,
      pad: -15,
      arp: -21,
      riser: -20,
      crackle: -42,
      reverb: 0.3,
      lowpass: 7000,
      gain: 2.5,
    },
  },
};
