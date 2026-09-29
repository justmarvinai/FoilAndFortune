/**
 * Visual QA helper (CLAUDE.md "Definition of Done" #3).
 *
 *   npx tsx --tsconfig tsconfig.node.json scripts/dev/screenshot.ts <url> <out.png> [WIDTHxHEIGHT] [waitMs] [full]
 *
 * Uses the pre-installed Chromium in Claude Code cloud sessions when present, with SwiftShader
 * flags so WebGL works headless. Prints console errors from the page (they matter!).
 */
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [url, out, size = '1440x900', waitArg = '1500', mode = 'viewport'] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: screenshot.ts <url> <out.png> [WIDTHxHEIGHT] [waitMs]');
  process.exit(2);
}
const [width, height] = size.split('x').map(Number);
const preinstalled = '/opt/pw-browsers/chromium';

const browser = await chromium.launch({
  executablePath:
    process.env.PW_CHROMIUM_PATH ?? (existsSync(preinstalled) ? preinstalled : undefined),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: width ?? 1440, height: height ?? 900 },
  deviceScaleFactor: 1,
});
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    console.log(`[browser ${message.type()}] ${message.text()}`);
  }
});
page.on('pageerror', (error) => console.log(`[page error] ${error.message}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(waitArg));
await page.screenshot({ path: out, fullPage: mode === 'full' });
await browser.close();
console.log(`saved ${out}`);
