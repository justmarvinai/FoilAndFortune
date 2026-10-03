import { describe, expect, it } from 'vitest';
import {
  BEATS_PER_BAR,
  chordTones,
  generateBar,
  MONOPHONIC_PARTS,
  scalePitchClasses,
  sectionFor,
  voiceChord,
} from './generator';
import { type MusicStyle, musicStyles } from './styles';

const styles = Object.entries(musicStyles) as [string, MusicStyle][];
const BARS = 64; // 8 phrases: every section of every form

describe('music generator', () => {
  it.each(styles)('%s is deterministic per seed and varies with it', (_, style) => {
    for (let bar = 0; bar < 16; bar++) {
      expect(generateBar(style, 42, bar)).toEqual(generateBar(style, 42, bar));
    }
    const a = Array.from({ length: 16 }, (_, bar) => generateBar(style, 1, bar));
    const b = Array.from({ length: 16 }, (_, bar) => generateBar(style, 2, bar));
    expect(a).not.toEqual(b);
  });

  it.each(styles)('%s stays in key', (_, style) => {
    const scale = new Set(scalePitchClasses(style));
    for (const seed of [1, 7, 99]) {
      for (let bar = 0; bar < BARS; bar++) {
        for (const event of generateBar(style, seed, bar)) {
          for (const midi of event.notes)
            expect(scale.has(midi % 12), `${event.part} ${midi}`).toBe(true);
        }
      }
    }
  });

  it.each(styles)('%s never overlaps notes on a monophonic voice', (_, style) => {
    for (const seed of [3, 11]) {
      for (let bar = 0; bar < BARS; bar++) {
        const events = generateBar(style, seed, bar);
        for (const part of MONOPHONIC_PARTS) {
          const line = events.filter((e) => e.part === part).sort((x, y) => x.beat - y.beat);
          line.forEach((note, i) => {
            const next = line[i + 1];
            expect(note.notes).toHaveLength(1);
            expect(note.beat + note.dur).toBeLessThanOrEqual((next?.beat ?? BEATS_PER_BAR) + 1e-9);
          });
        }
      }
    }
  });

  it.each(styles)('%s keeps events inside the bar with sane values', (_, style) => {
    for (let bar = 0; bar < BARS; bar++) {
      for (const event of generateBar(style, 5, bar)) {
        expect(event.beat).toBeGreaterThanOrEqual(0);
        expect(event.beat).toBeLessThan(BEATS_PER_BAR);
        expect(event.dur).toBeGreaterThan(0);
        expect(event.vel).toBeGreaterThan(0);
        expect(event.vel).toBeLessThanOrEqual(1.1);
        for (const midi of event.notes) {
          expect(midi).toBeGreaterThanOrEqual(30);
          expect(midi).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('builds jazzy diatonic chords: maj9 on IV, m7 on iii, 9sus, 13', () => {
    const day = musicStyles.day; // F major
    const names = (pcs: number[]) =>
      pcs.map((pc) => ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][pc]);
    // B♭maj9 without its root (the bass plays it): D F A C.
    expect(names(chordTones(day, { degree: 4 }).tones)).toEqual(['D', 'F', 'A', 'C']);
    // Am7: the 9th (B♭) would be a minor 9th, so the voicing doubles the root instead.
    expect(names(chordTones(day, { degree: 3, kind: '7' }).tones)).toEqual(['C', 'E', 'G', 'A']);
    expect(names(chordTones(day, { degree: 3 }).tones)).toEqual(['C', 'E', 'G', 'A']);
    // C9sus4: F G B♭ D; C13: E B♭ D A.
    expect(names(chordTones(day, { degree: 5, kind: 'sus' }).tones)).toEqual(['F', 'G', 'Bb', 'D']);
    expect(names(chordTones(day, { degree: 5, kind: '13' }).tones)).toEqual(['E', 'Bb', 'D', 'A']);
  });

  it('voices chords in close position around the center', () => {
    const voicing = voiceChord([2, 5, 9, 0], 62);
    expect([...voicing].sort((a, b) => a - b)).toEqual(voicing);
    expect(voicing[voicing.length - 1]! - voicing[0]!).toBeLessThanOrEqual(12);
    const mean = voicing.reduce((s, v) => s + v, 0) / voicing.length;
    expect(Math.abs(mean - 62)).toBeLessThanOrEqual(3);
  });

  it('follows the section form: an intro first, then the cycle', () => {
    const day = musicStyles.day;
    expect(sectionFor(day, 0)).toBe('intro');
    const cycle = day.form.length - 1;
    expect(sectionFor(day, 1)).toBe(sectionFor(day, 1 + cycle));
    expect(
      new Set(Array.from({ length: cycle }, (_, i) => sectionFor(day, i + 1))).size,
    ).toBeGreaterThan(2);
    // A 6-minute day (~16 phrases at 84 BPM) hears several melodies: motifs change every 2 phrases.
    const leadPitches = new Set<string>();
    for (let bar = 0; bar < 16 * 8; bar++) {
      const lead = generateBar(day, 9, bar).filter((e) => e.part === 'lead');
      if (lead.length > 0) leadPitches.add(lead.map((e) => e.notes[0]).join(','));
    }
    expect(leadPitches.size).toBeGreaterThan(10);
  });
});
