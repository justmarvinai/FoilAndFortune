import { createRng, type Rng, seedStream } from '@/core/rng';
import { type ChordSpec, type MusicStyle, type Part, SCALES } from './styles';

/**
 * Procedural lo-fi pattern generator (docs/04 §11.1). Pure and seeded: `generateBar(style, seed,
 * n)` always returns the same notes for bar `n`, so the director can generate bars on demand,
 * just ahead of the lookahead scheduler, with no state to keep. Variety over a 6-minute day comes
 * from the section form (8-bar phrases), alternating progressions, per-bar drum and bass
 * variations, and a melody motif that changes every two phrases.
 */

export interface MusicEvent {
  part: Part;
  /** Start within the bar, in beats (swing applied). */
  beat: number;
  /** Length in beats. */
  dur: number;
  /** MIDI notes (empty for drums). */
  notes: number[];
  /** 0–1. */
  vel: number;
}

export const BEATS_PER_BAR = 4;
export const BARS_PER_PHRASE = 8;
const STEPS = 16;
/** Parts that never play two notes at once (bass line, melody). */
export const MONOPHONIC_PARTS: readonly Part[] = ['bass', 'lead'];

/** Melody rhythm cells: [step, length in steps]. A motif picks two (even and odd bars). */
const RHYTHM_CELLS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 4],
    [6, 2],
    [8, 6],
  ],
  [
    [2, 2],
    [4, 4],
    [10, 6],
  ],
  [
    [0, 6],
    [8, 2],
    [10, 2],
    [12, 4],
  ],
  [
    [4, 2],
    [6, 2],
    [8, 8],
  ],
  [
    [0, 3],
    [3, 3],
    [6, 10],
  ],
  [
    [0, 2],
    [2, 2],
    [4, 4],
    [12, 4],
  ],
];

export function scalePitchClasses(style: MusicStyle): number[] {
  return SCALES[style.mode].map((step) => (style.tonic + step) % 12);
}

export function sectionFor(style: MusicStyle, phrase: number): string {
  const { form } = style;
  if (phrase <= 0 || form.length < 2) return form[0] ?? '';
  return form[1 + ((phrase - 1) % (form.length - 1))] ?? form[0] ?? '';
}

/** Root and voicing tones (pitch classes) of a diatonic chord: stacked thirds from the degree. */
export function chordTones(style: MusicStyle, chord: ChordSpec): { root: number; tones: number[] } {
  const scale = scalePitchClasses(style);
  const at = (offset: number) => scale[(chord.degree - 1 + offset) % 7] ?? 0;
  const root = at(0);
  const [third, fourth, fifth, sixth, seventh, ninth] = [at(2), at(3), at(4), at(5), at(6), at(1)];
  switch (chord.kind ?? '9') {
    case '7':
      return { root, tones: [third, fifth, seventh, root] };
    case 'sus':
      return { root, tones: [fourth, fifth, seventh, ninth] };
    case '13':
      return { root, tones: [third, seventh, ninth, sixth] };
    default:
      // A minor 9th above the root (the iii chord) is the one diatonic 9th that clashes.
      return {
        root,
        tones: [third, fifth, seventh, (ninth - root + 12) % 12 === 1 ? root : ninth],
      };
  }
}

/** Closed-position voicing near `center`: the inversion whose average pitch is closest. */
export function voiceChord(tones: readonly number[], center: number): number[] {
  let best: number[] = [];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let rotation = 0; rotation < tones.length; rotation++) {
    const order = [...tones.slice(rotation), ...tones.slice(0, rotation)];
    const first = order[0] ?? 0;
    let pitch = center - 8 + ((((first - (center - 8)) % 12) + 12) % 12);
    const voicing = [pitch];
    for (const pc of order.slice(1)) {
      pitch += (((pc - pitch) % 12) + 12) % 12 || 12;
      voicing.push(pitch);
    }
    const mean = voicing.reduce((sum, p) => sum + p, 0) / voicing.length;
    if (Math.abs(mean - center) < bestDistance) {
      bestDistance = Math.abs(mean - center);
      best = voicing;
    }
  }
  return best;
}

/** `pc` placed in the octave starting at `low`. */
function place(pc: number, low: number): number {
  return low + ((((pc - low) % 12) + 12) % 12);
}

function swung(style: MusicStyle, step: number): number {
  return step / 4 + (step % 2 === 1 ? (style.swing - 0.5) * 0.5 : 0);
}

function drumHits(
  out: MusicEvent[],
  style: MusicStyle,
  rng: Rng,
  part: Part,
  pattern: string,
  humanize: number,
): void {
  for (let step = 0; step < STEPS; step++) {
    const char = pattern[step];
    if (char !== 'x' && char !== 'o') continue;
    const vel = (char === 'x' ? 0.9 : 0.45) * rng.float(0.88, 1.05);
    out.push({
      part,
      beat: Math.max(0, swung(style, step) + rng.float(-humanize, humanize)),
      dur: 0.25,
      notes: [],
      vel,
    });
  }
}

export function generateBar(style: MusicStyle, seed: number, bar: number): MusicEvent[] {
  const phrase = Math.floor(bar / BARS_PER_PHRASE);
  const inPhrase = bar % BARS_PER_PHRASE;
  const section = style.sections[sectionFor(style, phrase)];
  if (!section) return [];
  const rng = createRng(seedStream(seed, `bar:${bar}`));
  const phraseRng = createRng(seedStream(seed, `phrase:${phrase}`));
  const progression = style.progressions[section.progression % style.progressions.length] ?? [];
  const chord = progression[inPhrase % progression.length] ?? { degree: 1 };
  const next = progression[(inPhrase + 1) % progression.length] ?? chord;
  const { root, tones } = chordTones(style, chord);
  const scale = scalePitchClasses(style);
  const events: MusicEvent[] = [];
  const humanize = 0.012;

  // Drums: patterns plus ghost notes, a 16th fill or a drop at the end of each phrase.
  if (section.drums !== 'none') {
    const drums = section.drums === 'full' ? style.drums : { ...style.drums, ...style.drums.light };
    const kick =
      section.drums === 'full'
        ? (style.drums.kick[rng.chance(0.7) ? 0 : rng.int(0, style.drums.kick.length - 1)] ?? '')
        : style.drums.light.kick;
    const lastBar = inPhrase === BARS_PER_PHRASE - 1;
    const drop = section.drums === 'full' && lastBar && phraseRng.chance(0.35);
    drumHits(events, style, rng, 'kick', drop ? kick.slice(0, 12).padEnd(16, '.') : kick, humanize);
    let snare = drums.snare;
    if (section.drums === 'full' && style.drums.ghost > 0) {
      snare = [...snare]
        .map((char, step) =>
          char === '.' && step % 2 === 1 && rng.chance(style.drums.ghost) ? 'o' : char,
        )
        .join('');
    }
    if (section.drums === 'full' && lastBar && !drop && !style.drums.rim) {
      snare = `${snare.slice(0, 12)}oxox`;
    }
    drumHits(events, style, rng, 'snare', snare, humanize);
    let hat = drums.hat;
    if (inPhrase % 4 === 3 && section.drums === 'full') hat = `${hat.slice(0, 14)}O.`;
    for (let step = 0; step < STEPS; step++) {
      const char = hat[step];
      if (char !== 'x' && char !== 'o' && char !== 'O') continue;
      // A few hats drop out per bar so the groove breathes; `O` is an open hat.
      if (char !== 'O' && step % 4 !== 0 && rng.chance(0.08)) continue;
      const vel = (char === 'o' ? 0.4 : step % 4 === 0 ? 0.8 : 0.6) * rng.float(0.85, 1.05);
      events.push({
        part: 'hat',
        beat: Math.max(0, swung(style, step) + rng.float(-humanize, humanize)),
        dur: char === 'O' ? 0.5 : 0.1,
        notes: [],
        vel,
      });
    }
  }

  // Bass: root, fifth, octave and a diatonic approach to the next chord's root (or a tonic pedal).
  if (section.bass) {
    const patterns = style.bass.patterns;
    const pattern = patterns[rng.chance(0.6) ? 0 : rng.int(0, patterns.length - 1)] ?? [];
    const bassRoot = place(root, 36);
    const nextRoot = chordTones(style, next).root;
    const approachPc = scale[(scale.indexOf(nextRoot) + 1) % 7] ?? nextRoot;
    for (const [step, length, role] of pattern) {
      const midi =
        role === 'P'
          ? place(style.tonic, 36)
          : role === '5'
            ? place(scale[(scale.indexOf(root) + 4) % 7] ?? root, bassRoot)
            : role === 'O'
              ? bassRoot + 12
              : role === 'A'
                ? place(approachPc, bassRoot - 5)
                : bassRoot;
      events.push({
        part: 'bass',
        beat: swung(style, step),
        dur: length / 4,
        notes: [midi],
        vel: role === 'P' ? 0.7 : 0.85,
      });
    }
  }

  // Keys: rootless extended voicings with a per-phrase comping rhythm.
  const voicing = voiceChord(tones, style.keys.center);
  if (section.keys) {
    const comp = style.keys.comp[phraseRng.int(0, style.keys.comp.length - 1)] ?? [];
    for (const [step, length, vel] of comp) {
      events.push({
        part: 'keys',
        beat: Math.max(0, swung(style, step) + rng.float(0, humanize)),
        dur: length / 4,
        notes: voicing,
        vel: vel * rng.float(0.9, 1.05),
      });
    }
  }
  if (section.pad) {
    events.push({
      part: 'pad',
      beat: 0,
      dur: BEATS_PER_BAR,
      notes: [place(root, 48), ...voicing],
      vel: 0.6,
    });
  }

  // Melody: a motif (two rhythm cells and a contour) per two phrases, on the key's pentatonic.
  if (section.lead && style.lead.density > 0) {
    const motif = createRng(seedStream(seed, `motif:${Math.floor(phrase / 2)}`));
    const cells = [motif.pick(RHYTHM_CELLS), motif.pick(RHYTHM_CELLS)];
    const contour = Array.from({ length: 6 }, () => motif.pick([-2, -1, -1, 1, 1, 2, 0]));
    const anchor = motif.int(style.lead.low + 3, style.lead.high - 5);
    const penta = (style.mode === 'major' ? [0, 1, 2, 4, 5] : [0, 2, 3, 4, 6]).map(
      (i) => scale[i] ?? 0,
    );
    const allowed: number[] = [];
    for (let midi = style.lead.low; midi <= style.lead.high; midi++)
      if (penta.includes(midi % 12)) allowed.push(midi);
    const chordSet = new Set([root, ...tones]);
    const phraseEnd = inPhrase === BARS_PER_PHRASE - 1;
    const rest = !phraseEnd && (inPhrase === 3 ? rng.chance(0.5) : !rng.chance(style.lead.density));
    if (allowed.length > 0 && !rest) {
      const cell = phraseEnd ? [[0, 8] as const] : (cells[inPhrase % 2] ?? []);
      // Start on the chord tone nearest the motif's anchor, then follow the contour.
      const starts = allowed.filter((midi) => chordSet.has(midi % 12));
      const start = (starts.length > 0 ? starts : allowed).reduce((a, b) =>
        Math.abs(b - anchor) < Math.abs(a - anchor) ? b : a,
      );
      let index = allowed.indexOf(start);
      cell.forEach(([step, length], k) => {
        if (k > 0) index = Math.min(allowed.length - 1, Math.max(0, index + (contour[k - 1] ?? 0)));
        events.push({
          part: 'lead',
          beat: swung(style, step),
          dur: length / 4,
          notes: [allowed[index] ?? start],
          vel: (k === 0 ? 0.8 : 0.65) * rng.float(0.9, 1.05),
        });
      });
    }
  }

  // Sparkle arpeggio (pack opening): chord tones up and down in 16ths, high and soft.
  if (section.arp && style.arp) {
    const { low, high } = style.arp;
    const pitches: number[] = [];
    for (let midi = low; midi <= high; midi++)
      if (midi % 12 === root || tones.includes(midi % 12)) pitches.push(midi);
    const run = [...pitches.slice(0, 8), ...pitches.slice(0, 8).reverse()];
    for (let step = 0; step < STEPS && run.length > 0; step++) {
      events.push({
        part: 'arp',
        beat: step / 4,
        dur: 0.2,
        notes: [run[step % run.length] ?? low],
        vel: (step % 4 === 0 ? 0.5 : 0.32) * rng.float(0.9, 1.1),
      });
    }
  }
  if (style.riser && inPhrase === BARS_PER_PHRASE - 2 && phrase % 2 === 1) {
    events.push({ part: 'riser', beat: 0, dur: 2 * BEATS_PER_BAR, notes: [], vel: 0.8 });
  }

  // Monophonic parts: each note ends before the next begins and inside the bar.
  for (const part of MONOPHONIC_PARTS) {
    const line = events.filter((event) => event.part === part).sort((a, b) => a.beat - b.beat);
    line.forEach((event, i) => {
      const nextBeat = line[i + 1]?.beat ?? BEATS_PER_BAR;
      event.dur = Math.max(0.05, Math.min(event.dur, nextBeat - event.beat - 0.02));
    });
  }
  return events.sort((a, b) => a.beat - b.beat);
}
