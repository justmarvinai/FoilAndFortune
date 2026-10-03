/**
 * `npm run balance:sim -- --days 7 --seeds 10 --bot balanced` (docs/02 §18): plays the pure sim
 * headless with a scripted bot and prints a Markdown report with the Phase 2 KPI flags.
 * Bots: balanced (the pacing reference), cautious (never opens, MSRP), ripper (opens most stock).
 */
import { formatReport } from './report';
import { BOT_NAMES, type BotName, runSeed } from './run';

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const days = Number.parseInt(option('days', '7'), 10);
const seeds = Number.parseInt(option('seeds', '10'), 10);
const bot = option('bot', 'balanced') as BotName;

if (!BOT_NAMES.includes(bot) || !(days > 0) || !(seeds > 0)) {
  console.error(`usage: balance:sim -- --days N --seeds N --bot ${BOT_NAMES.join('|')}`);
  process.exit(1);
}

const started = performance.now();
const results = Array.from({ length: seeds }, (_, i) => runSeed(i + 1, days, bot));
console.log(formatReport(results, bot, days));
console.log(
  `\n_${seeds} × ${days} days in ${((performance.now() - started) / 1000).toFixed(1)} s_`,
);
