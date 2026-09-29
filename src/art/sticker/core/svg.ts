import { fmt } from './path';

/** Tiny string-based SVG builder. The renderer must run without a DOM (tests, workers). */

export type AttrValue = string | number | undefined | null | false;
export type Attrs = Readonly<Record<string, AttrValue>>;
type Child = string | false | null | undefined;

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `el('path', { d, fill })` → `<path d="…" fill="…"/>`. Falsy attributes and children are skipped. */
export function el(name: string, attrs: Attrs = {}, ...children: readonly Child[]): string {
  let out = `<${name}`;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    out += ` ${key}="${typeof value === 'number' ? fmt(value) : escapeAttr(value)}"`;
  }
  const inner = children.filter((c): c is string => typeof c === 'string' && c.length > 0);
  return inner.length ? `${out}>${inner.join('')}</${name}>` : `${out}/>`;
}

export function group(attrs: Attrs, ...children: readonly Child[]): string {
  const inner = children.filter((c): c is string => typeof c === 'string' && c.length > 0);
  if (!inner.length) return '';
  return el('g', attrs, ...inner);
}

export function url(id: string): string {
  return `url(#${id})`;
}

/**
 * Unique ids per document. Several SVGs are inlined on the same page (playground, card grids)
 * and `url(#id)` resolves document-wide, so every id carries a per-render prefix.
 */
export class Ids {
  private count = 0;
  private readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  next(kind: string): string {
    this.count += 1;
    return `${this.prefix}-${kind}${this.count}`;
  }
}
