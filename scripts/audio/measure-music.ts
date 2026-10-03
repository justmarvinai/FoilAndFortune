/**
 * Music level check (docs/04 §11.3: about −16 LUFS integrated at full music volume). Opens the
 * audio lab with `?measure=1`, which renders 48 s of every context (after its intro) through the real Web Audio
 * graph in an OfflineAudioContext, and prints the loudness table. Needs a dev server:
 *
 *   npx vite --port 5176 --strictPort
 *   npx tsx --tsconfig tsconfig.node.json scripts/audio/measure-music.ts [http://localhost:5176]
 */
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5176';
const preinstalled = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath:
    process.env.PW_CHROMIUM_PATH ?? (existsSync(preinstalled) ? preinstalled : undefined),
});
const page = await browser.newPage();
const result = new Promise<string>((resolve) => {
  page.on('console', (message) => {
    const text = message.text();
    if (text.startsWith('[audio-levels] ')) resolve(text.slice('[audio-levels] '.length));
    else if (message.type() === 'error') console.log(`[browser error] ${text}`);
  });
});
page.on('pageerror', (error) => console.log(`[page error] ${error.message}`));
await page.goto(`${base}/debug/audio?measure=1`);
const timeout = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('timed out')), 120_000),
);
const rows = JSON.parse(await Promise.race([result, timeout])) as {
  context: string;
  integrated: number;
  momentaryMax: number;
  peakDb: number;
  ms: number;
}[];
console.log('context    integrated   max momentary   peak        render');
for (const row of rows) {
  console.log(
    `${row.context.padEnd(10)} ${row.integrated.toFixed(1).padStart(6)} LUFS  ${row.momentaryMax.toFixed(1).padStart(6)} LUFS    ${row.peakDb.toFixed(1).padStart(6)} dBFS  ${row.ms.toFixed(0).padStart(5)} ms`,
  );
}
await browser.close();
