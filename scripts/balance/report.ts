/**
 * Markdown report for `npm run balance:sim` (docs/02 §18): per-day means ± standard deviation
 * across seeds, plus the Phase 2 KPI flags.
 */
import { mean } from '../../src/core/math';
import { formatMoney } from '../../src/core/money';
import type { BotName, DayMetrics, RunResult } from './run';

export interface KpiResult {
  name: string;
  target: string;
  result: string;
  pass: boolean;
}

function sd(values: readonly number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

const money = (cents: number) => formatMoney(Math.round(cents), { hideZeroCents: true });

function spread(values: readonly number[], format: (v: number) => string): string {
  return `${format(mean(values))} ± ${format(sd(values)).replace('−', '')}`;
}

const num = (digits: number) => (v: number) => v.toFixed(digits);

/** First day a condition held, per seed (Infinity when it never did). */
function firstDay(results: readonly RunResult[], test: (day: DayMetrics) => boolean): number[] {
  return results.map((run) => run.days.find(test)?.day ?? Number.POSITIVE_INFINITY);
}

function dayKpi(name: string, targetDay: number, days: number[], simulated: number): KpiResult {
  const med = median(days);
  const reached = days.filter(Number.isFinite);
  const range = reached.length
    ? `${Math.min(...reached)}–${Math.max(...reached)}`
    : `not by day ${simulated}`;
  return {
    name,
    target: `day ${targetDay} (±20%)`,
    result: Number.isFinite(med)
      ? `median day ${med} (range ${range}; ${reached.length}/${days.length} seeds)`
      : `median not reached by day ${simulated} (${reached.length}/${days.length} seeds)`,
    pass: med >= targetDay * 0.8 && med <= targetDay * 1.2,
  };
}

export function phase2Kpis(results: readonly RunResult[], simulated: number): KpiResult[] {
  const day1 = results.flatMap((run) => run.days.slice(0, 1));
  const revenue = mean(day1.map((d) => d.revenue));
  const profit = mean(day1.map((d) => d.profit));
  const stuck = results.reduce(
    (sum, run) => sum + run.days.reduce((n, day) => n + day.stuck.length, 0),
    0,
  );
  return [
    {
      name: 'Day-1 revenue',
      target: '$100–180',
      result: spread(
        day1.map((d) => d.revenue),
        money,
      ),
      pass: revenue >= 100_00 && revenue <= 180_00,
    },
    {
      name: 'Day-1 profit',
      target: '$30–70',
      result: spread(
        day1.map((d) => d.profit),
        money,
      ),
      pass: profit >= 30_00 && profit <= 70_00,
    },
    dayKpi(
      'Lv 2 reached',
      1,
      firstDay(results, (d) => d.level >= 2),
      simulated,
    ),
    dayKpi(
      'Lv 4 reached',
      4,
      firstDay(results, (d) => d.level >= 4),
      simulated,
    ),
    dayKpi(
      'Lv 5 reached',
      7,
      firstDay(results, (d) => d.level >= 5),
      simulated,
    ),
    dayKpi(
      '2★ reached',
      6,
      firstDay(results, (d) => d.stars >= 2),
      simulated,
    ),
    { name: 'Stuck states', target: '0', result: String(stuck), pass: stuck === 0 },
  ];
}

export function formatReport(results: readonly RunResult[], bot: BotName, days: number): string {
  const lines: string[] = [];
  lines.push(`## Balance sim: ${bot} bot, ${days} days × ${results.length} seeds (Standard)`);
  lines.push('');
  lines.push('Per day: mean ± standard deviation across seeds. Profit as on the Day Summary');
  lines.push('receipt (revenue − COGS − opened stock − rent). Rep and stars after the night.');
  lines.push('');
  lines.push(
    '| Day | Revenue | COGS | Opened | Profit | Visitors | Served | Lost | Avg sat | Rep | ★ | Lv | Cash |',
  );
  lines.push('|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (let i = 0; i < days; i++) {
    const rows = results.flatMap((run) => run.days.slice(i, i + 1));
    if (rows.length === 0) continue;
    const col = (pick: (d: DayMetrics) => number, format: (v: number) => string) =>
      spread(rows.map(pick), format);
    lines.push(
      `| ${rows[0]?.day ?? i + 1} | ${col((d) => d.revenue, money)} | ${col((d) => d.cogs, money)} | ` +
        `${col((d) => d.opened, money)} | ${col((d) => d.profit, money)} | ` +
        `${col((d) => d.visitors, num(1))} | ${col((d) => d.served, num(1))} | ` +
        `${col((d) => d.lost, num(1))} | ${col((d) => d.satisfaction, num(2))} | ` +
        `${col((d) => d.rep, num(1))} | ${col((d) => d.stars, num(1))} | ` +
        `${col((d) => d.level, num(1))} | ${col((d) => d.cash, money)} |`,
    );
  }
  const packs = results.reduce((s, r) => s + r.days.reduce((n, d) => n + d.packsOpened, 0), 0);
  const failures = results.reduce((s, r) => s + r.days.reduce((n, d) => n + d.openFailures, 0), 0);
  lines.push('');
  lines.push(`Packs opened: ${packs} in total · failed open commands: ${failures}`);
  lines.push('');
  lines.push('### Phase 2 KPIs (docs/02 §18; targets are for the balanced bot)');
  lines.push('');
  lines.push('| KPI | Target | Result | Flag |');
  lines.push('|---|---|---|---|');
  for (const kpi of phase2Kpis(results, days)) {
    lines.push(`| ${kpi.name} | ${kpi.target} | ${kpi.result} | ${kpi.pass ? 'PASS' : 'FAIL'} |`);
  }
  const stuck = results.flatMap((run) =>
    run.days.flatMap((day) => day.stuck.map((s) => `seed ${run.seed} day ${day.day}: ${s}`)),
  );
  if (stuck.length > 0) {
    lines.push('');
    lines.push('Stuck states (first 10):');
    for (const entry of stuck.slice(0, 10)) lines.push(`- ${entry}`);
  }
  return lines.join('\n');
}
