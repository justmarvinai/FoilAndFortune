/**
 * Money is always integer cents (CLAUDE.md rule 6). Floats only exist transiently while
 * multiplying, and every result is rounded back to whole cents.
 */
export type Cents = number;

export function isCents(value: number): boolean {
  return Number.isSafeInteger(value);
}

export function dollars(amount: number): Cents {
  return Math.round(amount * 100);
}

export function toDollars(cents: Cents): number {
  return cents / 100;
}

/** Multiplies a cent amount by a factor and rounds to whole cents (half away from zero). */
export function scaleCents(cents: Cents, factor: number): Cents {
  const raw = cents * factor;
  return raw < 0 ? -Math.round(-raw) : Math.round(raw);
}

export interface FormatMoneyOptions {
  locale?: string;
  /** Abbreviate large amounts: $12.4k, $1.2M (HUD). */
  compact?: boolean;
  /** Always show a sign: +$4.49 / −$4.49 (deltas). */
  signed?: boolean;
  /** Drop cents for whole amounts in compact contexts. */
  hideZeroCents?: boolean;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(key: string, create: () => Intl.NumberFormat): Intl.NumberFormat {
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = create();
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** Formats cents as fictional Brightbay dollars, e.g. `$1,234.56`. */
export function formatMoney(cents: Cents, options: FormatMoneyOptions = {}): string {
  const { locale = 'en-US', compact = false, signed = false, hideZeroCents = false } = options;
  const value = cents / 100;
  const abs = Math.abs(value);
  const wholeDollars = cents % 100 === 0;

  let body: string;
  if (compact && abs >= 10_000) {
    const formatter = getFormatter(`${locale}|compact`, () =>
      Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    );
    body = formatter.format(abs);
  } else {
    const fraction = hideZeroCents && wholeDollars ? 0 : 2;
    const formatter = getFormatter(`${locale}|${fraction}`, () =>
      Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: fraction,
        maximumFractionDigits: fraction,
      }),
    );
    body = formatter.format(abs);
  }

  if (value < 0) return `−${body}`;
  if (signed) return `+${body}`;
  return body;
}
