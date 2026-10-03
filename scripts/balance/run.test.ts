import { describe, expect, it } from 'vitest';
import { formatReport, phase2Kpis } from './report';
import { BOT_NAMES, runSeed } from './run';

describe('balance:sim smoke run (docs/02 §18)', () => {
  it('plays two days with every bot without stuck states, deterministically', () => {
    for (const bot of BOT_NAMES) {
      const run = runSeed(3, 2, bot);
      expect(run.days.map((day) => day.day)).toEqual([1, 2]);
      expect(run.days.flatMap((day) => day.stuck)).toEqual([]);
      expect(run.days[0]?.visitors).toBeGreaterThan(5);
      expect(run.days[0]?.revenue).toBeGreaterThan(0);
      expect(runSeed(3, 2, bot)).toEqual(run);
    }
  });

  it('reports the Phase 2 KPIs', () => {
    const results = [runSeed(1, 2, 'balanced'), runSeed(2, 2, 'balanced')];
    expect(phase2Kpis(results, 2).map((kpi) => kpi.name)).toEqual([
      'Day-1 revenue',
      'Day-1 profit',
      'Lv 2 reached',
      'Lv 4 reached',
      'Lv 5 reached',
      '2★ reached',
      'Stuck states',
    ]);
    const report = formatReport(results, 'balanced', 2);
    expect(report).toContain('| Day | Revenue |');
    expect(report).toContain('Stuck states | 0 | 0 | PASS');
  });
});
