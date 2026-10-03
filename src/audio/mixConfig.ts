/**
 * Audio tunables (docs/04 §11.3, docs/06 §10): channel trims, limiter, ducking, crossfades and
 * scheduler timing. Sound designs live in `sfx/presets.ts`, music in `music/styles.ts`.
 */
export type Channel = 'master' | 'music' | 'sfx' | 'voices' | 'ambience';

export const mixConfig = {
  /** Fixed trims under the player's sliders, so default slider positions give a balanced mix. */
  trimDb: { master: 0, music: 0, sfx: 0, voices: -2, ambience: 0 } satisfies Record<
    Channel,
    number
  >,
  /**
   * Master safety limiter (DynamicsCompressorNode). Chrome, Firefox and Safari share one kernel
   * that adds an automatic makeup gain of about +1–2 dB at these settings; levels allow for it.
   */
  limiter: { threshold: -3, knee: 2, ratio: 16, attack: 0.002, release: 0.12 },
  /** Time constant (s) for slider changes: smooth, no zipper noise. */
  volumeSmoothing: 0.04,
  /** Music ducking under big reveals: attack and release time constants (s). */
  duck: { attack: 0.03, release: 0.35 },
  music: {
    /** Crossfade between two contexts, and the fade to `silent` (s). */
    crossfadeSeconds: 2.4,
    fadeOutSeconds: 1.6,
    /** Lookahead scheduler (docs/06 §10): notes are placed on the AudioContext clock this far ahead. */
    lookaheadSeconds: 0.3,
    tickMs: 40,
    /** A note more than this late (a stalled main thread) is skipped, not played out of time. */
    lateToleranceSeconds: 0.03,
    reverbSeconds: 1.6,
    /** Tape wow (slow) and flutter (fast) as delay-time modulation: [Hz, seconds of depth]. */
    wow: [0.45, 0.0011] as const,
    flutter: [5.5, 0.00007] as const,
  },
  sfx: {
    /** A `playSfx` made while the engine is still loading plays if it's at most this old. */
    pendingTtlMs: 250,
    maxVoices: 24,
    /** Pre-render on unlock in slices this long (ms), yielding to the page in between. */
    renderSliceMs: 8,
    /** Default peak of every rendered buffer before its preset gain (dBFS). */
    peakDb: -1,
  },
  voices: { maxConcurrent: 3 },
} as const;
