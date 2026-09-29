import { type KeyboardEvent, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getRegistry } from '@/content/registry';
import type { Cents } from '@/core/money';
import { formatMoney } from '@/core/money';
import { useGameStore } from '@/state/gameStore';
import { useCommand } from '@/state/useCommand';
import { Panel } from '@/ui/components';

// Debug page: exempt from i18n (CLAUDE.md).

function toDollarText(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

/**
 * Inline price editor. The sim is the validator: whatever the player typed goes into a
 * `pricing/setPrice` command, and a rejection comes back as a friendly toast.
 */
function PriceField({
  cents,
  label,
  onCommit,
}: {
  cents: Cents;
  label: string;
  onCommit(cents: Cents): void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Math.round(Number.parseFloat(draft.replace(/[$,\s]/g, '')) * 100);
    setDraft(null);
    if (parsed !== cents) onCommit(parsed);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setDraft(null);
      event.currentTarget.blur();
    }
  };

  return (
    <label className="inline-flex items-center rounded-lg border-2 border-ink/30 bg-paper px-1.5 focus-within:border-teal">
      <span className="text-ink/50">$</span>
      <input
        aria-label={label}
        inputMode="decimal"
        className="w-16 bg-transparent py-0.5 text-right tabular-nums outline-none"
        value={draft ?? toDollarText(cents)}
        onFocus={(event) => {
          setDraft(toDollarText(cents));
          event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </label>
  );
}

/** Receipt-style stock list with editable shelf prices (docs/01 §7 pricing). */
export function StockPanel() {
  const run = useCommand();
  const { sealed, prices } = useGameStore(
    useShallow((store) => ({
      sealed: store.game?.inventory.sealed,
      prices: store.game?.pricing.prices,
    })),
  );
  if (!sealed || !prices) return null;

  const rows = [...getRegistry().products.values()]
    .filter((product) => sealed[product.id] !== undefined || prices[product.id] !== undefined)
    .map((product) => {
      const lots = sealed[product.id] ?? [];
      const qty = lots.reduce((total, lot) => total + lot.qty, 0);
      const costTotal = lots.reduce((total, lot) => total + lot.qty * lot.unitCostCents, 0);
      const cost = qty > 0 ? Math.round(costTotal / qty) : 0;
      const price = prices[product.id] ?? product.msrpCents;
      return {
        product,
        qty,
        cost,
        price,
        margin: price > 0 && cost > 0 ? (price - cost) / price : null,
      };
    });

  return (
    <Panel theme="receipt" title="Stock & prices">
      <table className="w-full font-legible text-sm">
        <thead>
          <tr className="border-b-2 border-dashed border-ink/30 text-left text-xs uppercase tracking-wider text-ink/55">
            <th className="py-1.5 font-semibold">Item</th>
            <th className="py-1.5 text-right font-semibold">Qty</th>
            <th className="hidden py-1.5 text-right font-semibold sm:table-cell">Cost</th>
            <th className="py-1.5 text-right font-semibold">Price</th>
            <th className="py-1.5 text-right font-semibold">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product, qty, cost, price, margin }) => (
            <tr key={product.id} className="border-b border-dotted border-ink/20">
              <td className="py-2 pr-2">{product.name}</td>
              <td className="py-2 text-right tabular-nums">{qty}</td>
              <td className="hidden py-2 text-right tabular-nums text-ink/60 sm:table-cell">
                {formatMoney(cost)}
              </td>
              <td className="py-2 text-right">
                <PriceField
                  cents={price}
                  label={`Price of ${product.name}`}
                  onCommit={(cents) =>
                    run({ type: 'pricing/setPrice', productId: product.id, cents })
                  }
                />
              </td>
              <td
                className={`py-2 text-right tabular-nums font-semibold ${
                  margin === null ? 'text-ink/40' : margin < 0 ? 'text-coral' : 'text-teal'
                }`}
              >
                {margin === null ? '–' : `${Math.round(margin * 100)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 font-hand text-lg text-ink/70">
        Prices are checked by the sim: try typing “abc” or 0 to see a rejection.
      </p>
    </Panel>
  );
}
