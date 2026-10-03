/**
 * `npm run art:render -- --set emberdawn [--only 035,108] [--force] [--quality draft|final]`
 *
 * Pre-renders card art with the Clay Critters renderer (ADR-006) in headless Chromium and writes
 * `public/art/v<N>/<set>/<nnn>.webp` plus `manifest.json` (docs/06 §9, docs/08 §5–6). Cards whose
 * render inputs (request, Clay sources, quality, budget) hash the same as their manifest entry are
 * skipped. Renders run serially on one page: software WebGL is CPU-heavy.
 * `--set` takes set slugs (`emberdawn`, `promo`) or `all`.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import {
  artFileName,
  artRequestFor,
  artSpeciesId,
  hasIllustration,
  PRERENDER_ART,
  setSlug,
} from '../../src/art/cardArt';
import { CLAY_VERSION } from '../../src/art/clay/version';
import { ART_VERSION, type ArtManifest, MANIFEST_FORMAT } from '../../src/cards/artManifest';
import { getRegistry } from '../../src/content/registry';
import type { CardDef } from '../../src/content/schema/tcg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CLAY_DIR = join(ROOT, 'src/art/clay');

interface Options {
  sets: string[];
  only: Set<number> | null;
  force: boolean;
  quality: 'draft' | 'final';
}

function parseArgs(argv: readonly string[]): Options {
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const sets = (value('--set') ?? '').split(',').filter(Boolean);
  if (sets.length === 0) {
    console.error(
      'usage: npm run art:render -- --set <slug[,slug]|all> [--only 035,108] [--force] [--quality draft|final]',
    );
    process.exit(2);
  }
  const only = value('--only');
  const quality = value('--quality') ?? 'final';
  if (quality !== 'draft' && quality !== 'final') throw new Error(`unknown quality ${quality}`);
  return {
    sets,
    only: only ? new Set(only.split(',').map((n) => Number.parseInt(n, 10))) : null,
    force: argv.includes('--force'),
    quality,
  };
}

/** Digest of every Clay source that can change pixels (tests and the playground excluded). */
function clayDigest(): string {
  const hash = createHash('sha256');
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) {
        hash.update(relative(CLAY_DIR, path));
        hash.update(readFileSync(path));
      }
    }
  };
  walk(CLAY_DIR);
  return hash.digest('hex').slice(0, 16);
}

const shortHash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

function readManifest(path: string, set: string): ArtManifest {
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as ArtManifest;
  return {
    format: MANIFEST_FORMAT,
    set,
    renderer: { id: 'clay', version: CLAY_VERSION, digest: '' },
    cards: {},
  };
}

function writeManifest(path: string, manifest: ArtManifest) {
  const cards = Object.fromEntries(
    Object.entries(manifest.cards).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(path, `${JSON.stringify({ ...manifest, cards }, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = getRegistry();
  const allSets = [...registry.sets.values()];
  const sets = options.sets.includes('all')
    ? allSets
    : options.sets.map((slug) => {
        const set = allSets.find((s) => setSlug(s.id) === slug);
        if (!set)
          throw new Error(
            `unknown set "${slug}" (have: ${allSets.map((s) => setSlug(s.id)).join(', ')})`,
          );
        return set;
      });
  const digest = clayDigest();

  interface Job {
    card: CardDef;
    dir: string;
    manifestPath: string;
    hash: string;
  }
  const jobs: Job[] = [];
  const manifests = new Map<string, ArtManifest>();
  for (const set of sets) {
    const dir = join(ROOT, 'public/art', `v${ART_VERSION}`, setSlug(set.id));
    const manifestPath = join(dir, 'manifest.json');
    const manifest = readManifest(manifestPath, set.id);
    manifests.set(manifestPath, manifest);
    const cards = [...registry.cards.values()].filter(
      (c) => c.setId === set.id && hasIllustration(c),
    );
    if (!options.only) {
      // Drop entries of cards that no longer exist.
      for (const id of Object.keys(manifest.cards)) {
        if (!cards.some((c) => c.id === id)) delete manifest.cards[id];
      }
    }
    for (const card of cards) {
      if (options.only && !options.only.has(card.number)) continue;
      const size = PRERENDER_ART[card.art.composition];
      const species = registry.species.get(artSpeciesId(card) ?? '');
      const request = artRequestFor(card, species, 1, size);
      const hash = shortHash({
        request,
        digest,
        quality: options.quality,
        budget: size.budgetBytes,
      });
      const entry = manifest.cards[card.id];
      const file = join(dir, artFileName(card));
      if (!options.force && entry?.hash === hash && existsSync(file)) continue;
      jobs.push({ card, dir, manifestPath, hash });
    }
  }
  if (jobs.length === 0) {
    console.log('✔ card art is up to date');
    return;
  }

  console.log(
    `rendering ${jobs.length} card(s) at ${options.quality} quality (clay ${CLAY_VERSION}, ${digest})`,
  );
  const server = await createServer({
    root: ROOT,
    logLevel: 'warn',
    clearScreen: false,
    server: { port: 5400, strictPort: false, hmr: false },
  });
  await server.listen();
  const base = server.resolvedUrls?.local[0] ?? 'http://localhost:5400/';
  const preinstalled = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch({
    executablePath:
      process.env.PW_CHROMIUM_PATH ?? (existsSync(preinstalled) ? preinstalled : undefined),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const started = Date.now();
  let totalBytes = 0;
  try {
    const page = await browser.newPage();
    page.on('pageerror', (error) => console.error(`[page] ${error.message}`));
    await page.goto(`${base}scripts/art/render.html`);
    await page.waitForFunction(() => typeof window.__renderArt === 'function', null, {
      timeout: 120_000,
    });
    console.log(`GPU: ${await page.evaluate(() => window.__renderDevice?.() ?? '?')}`);
    for (const [index, job] of jobs.entries()) {
      const { card } = job;
      const size = PRERENDER_ART[card.art.composition];
      const species = registry.species.get(artSpeciesId(card) ?? '');
      const request = artRequestFor(card, species, 1, size);
      const t0 = Date.now();
      const result = await page.evaluate(
        ([req, quality, budget]) => {
          const render = window.__renderArt;
          if (!render) throw new Error('render page not ready');
          return render(req, quality, budget);
        },
        [request, options.quality, size.budgetBytes] as const,
      );
      if (result.type !== 'image/webp') throw new Error(`browser encoded ${result.type}, not WebP`);
      mkdirSync(job.dir, { recursive: true });
      writeFileSync(join(job.dir, artFileName(card)), Buffer.from(result.base64, 'base64'));
      totalBytes += result.bytes;
      const manifest = manifests.get(job.manifestPath);
      if (!manifest) throw new Error('manifest missing');
      manifest.renderer = { id: 'clay', version: CLAY_VERSION, digest };
      manifest.cards[card.id] = {
        file: artFileName(card),
        composition: card.art.composition,
        width: request.width,
        height: request.height,
        seed: card.art.seed,
        subject: request.genome ? 'creature' : request.prop ? request.prop.kind : 'scenery',
        genomeHash: shortHash(request.genome ?? request.prop ?? null),
        quality: Math.round(result.quality * 100) / 100,
        bytes: result.bytes,
        renderer: `clay@${CLAY_VERSION}`,
        hash: job.hash,
      };
      writeManifest(job.manifestPath, manifest);
      const over = result.bytes > size.budgetBytes ? ' ⚠ over budget' : '';
      console.log(
        `[${index + 1}/${jobs.length}] ${card.id} ${card.name} · ${request.width}×${request.height} · ` +
          `${(result.bytes / 1024).toFixed(1)} KB q${result.quality.toFixed(2)} · ${Date.now() - t0} ms${over}`,
      );
    }
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(
    `✔ rendered ${jobs.length} card(s) in ${((Date.now() - started) / 1000).toFixed(1)} s, ${(totalBytes / 1024).toFixed(0)} KB`,
  );
}

await main();
