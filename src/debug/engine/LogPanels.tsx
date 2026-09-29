import { useEffect, useState } from 'react';
import { formatClock } from '@/core/calendar';
import { formatMoney } from '@/core/money';
import type { DomainEventType } from '@/sim/events';
import { useGameStore } from '@/state/gameStore';
import { presentationBus } from '@/state/presentationBus';
import { Button, Panel } from '@/ui/components';

// Debug page: exempt from i18n (CLAUDE.md).

interface LogLine {
  id: number;
  stamp: string;
  type: DomainEventType;
  detail: string;
}

const MAX_LINES = 40;

const CATEGORY_COLOR: Record<string, string> = {
  clock: 'text-sky',
  day: 'text-sky',
  cash: 'text-mint',
  rent: 'text-coral',
  loan: 'text-coral',
  xp: 'text-sun',
  level: 'text-sun',
  pricing: 'text-grape',
};

function describe(payload: object): string {
  return Object.entries(payload)
    .filter(([key]) => key !== 'type')
    .map(
      ([key, value]) =>
        `${key}=${typeof value === 'object' ? JSON.stringify(value) : String(value)}`,
    )
    .join('  ');
}

let nextLineId = 1;

/** Live feed of domain events as the presentation layer receives them (docs/07 §5). */
export function EventLogPanel() {
  const [lines, setLines] = useState<readonly LogLine[]>([]);

  useEffect(
    () =>
      presentationBus.onAny(({ type, payload }) => {
        const clock = useGameStore.getState().game?.clock;
        const stamp = clock ? `D${clock.day} ${formatClock(clock.minute)}` : '';
        const line = { id: nextLineId++, stamp, type, detail: describe(payload) };
        setLines((previous) => [line, ...previous].slice(0, MAX_LINES));
      }),
    [],
  );

  return (
    <Panel theme="tablet" title="Domain events">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-paper/70">IDs and numbers only; the UI turns them into words.</p>
        <Button size="sm" variant="ghost" onClick={() => setLines([])}>
          Clear
        </Button>
      </div>
      <ol className="h-72 space-y-1 overflow-y-auto rounded-xl bg-black/25 p-3 font-legible text-xs">
        {lines.length === 0 ? (
          <li className="text-paper/40">Nothing yet. Open the shop or press a button.</li>
        ) : null}
        {lines.map((line) => (
          <li key={line.id} className="flex gap-2">
            <span className="w-20 shrink-0 tabular-nums text-paper/40">{line.stamp}</span>
            <span
              className={`shrink-0 font-bold ${CATEGORY_COLOR[line.type.split('/')[0] ?? ''] ?? 'text-paper'}`}
            >
              {line.type}
            </span>
            <span className="min-w-0 truncate text-paper/70">{line.detail}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** The last ledger lines, printed like a till roll. */
export function LedgerPanel() {
  const ledger = useGameStore((store) => store.game?.finance.ledger);
  if (!ledger) return null;
  const rows = ledger.slice(-12).reverse();

  return (
    <Panel theme="receipt" title="Ledger">
      {rows.length === 0 ? (
        <p className="font-legible text-sm text-ink/50">
          No transactions yet. Grant cash in the dev panel, or play until Sunday for rent.
        </p>
      ) : (
        <table className="w-full font-legible text-sm">
          <tbody>
            {rows.map((entry, index) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: ledger lines have no ID and the rows are stateless.
                key={`${ledger.length - index}`}
                className="border-b border-dotted border-ink/20"
              >
                <td className="py-1.5 tabular-nums text-ink/55">Day {entry.day}</td>
                <td className="py-1.5 uppercase tracking-wider">{entry.kind}</td>
                <td
                  className={`py-1.5 text-right font-semibold tabular-nums ${
                    entry.cents < 0 ? 'text-coral' : 'text-teal'
                  }`}
                >
                  {formatMoney(entry.cents, { signed: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
