/**
 * SFX level check (docs/04 §11.3): renders every preset exactly as the engine does and prints
 * its length, peak and loudness after the preset gain, at full SFX volume.
 *
 *   npx tsx --tsconfig tsconfig.node.json scripts/audio/levels.ts [sampleRate]
 *
 * Targets (max momentary loudness, src/audio/README.md): UI −36…−26 LUFS, shop −26…−20, rewards
 * −23…−18, rarity stingers climbing −22 → −14.6; peaks at or below −6 dBFS. Music sits at about
 * −16.5 LUFS integrated at full music volume (scripts/audio/measure-music.ts).
 */
import { measureLoudness } from '../../src/audio/loudness';
import { SFX_IDS, sfxPresets } from '../../src/audio/sfx/presets';
import { renderSfx, sfxSampleRate } from '../../src/audio/sfx/render';
import { dbToGain } from '../../src/audio/volume';

const sampleRate = Number(process.argv[2] ?? 48000);
const rows: string[] = [];
let totalMs = 0;
for (const id of SFX_IDS) {
  const preset = sfxPresets[id];
  const started = performance.now();
  const rate = sfxSampleRate(preset, sampleRate);
  const channels = renderSfx(preset, rate);
  const ms = performance.now() - started;
  totalMs += ms;
  const report = measureLoudness(channels, rate, dbToGain(preset.gainDb));
  const seconds = (channels[0]?.length ?? 0) / rate;
  rows.push(
    [
      id.padEnd(26),
      `${seconds.toFixed(2)} s`.padStart(8),
      `${report.peakDb.toFixed(1)} dBFS`.padStart(12),
      `${report.momentaryMax.toFixed(1)} LUFS-M`.padStart(14),
      `${ms.toFixed(1)} ms`.padStart(9),
    ].join(' '),
  );
}
console.log(
  `${'id'.padEnd(26)} ${'length'.padStart(8)} ${'peak'.padStart(12)} ${'max momentary'.padStart(14)} ${'render'.padStart(9)}`,
);
for (const row of rows) console.log(row);
console.log(`total render time ${totalMs.toFixed(0)} ms at ${sampleRate} Hz`);
