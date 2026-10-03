import type { SheetId } from '@/state/uiStore';

/**
 * Play-screen keyboard map (docs/05 §9): Space pause · 1/2/3 speed (1×, 2×, 4×) · I/P/O/C
 * sheets · Esc back. Pure: the session hook feeds it key events and performs the action.
 */
export type ShellAction =
  | { kind: 'back' }
  | { kind: 'togglePause' }
  | { kind: 'speed'; speed: 1 | 2 | 4 }
  | { kind: 'sheet'; sheet: SheetId }
  /** Space/Enter on a celebration: skip it (docs/05 §2 "celebrations are skippable"). */
  | { kind: 'skipCelebration' };

export interface KeyInput {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  /** Tag of the focused element, e.g. `INPUT`, `BUTTON`. */
  targetTag?: string;
  /** `type` attribute for inputs (`text`, `range`, `checkbox`…). */
  targetType?: string;
  targetEditable?: boolean;
  /**
   * The focused control sits in a sheet or dialog. There Space keeps its native job (pressing
   * the focused button or switch); on the HUD and dock it pauses, and Enter presses buttons.
   */
  targetInDialog?: boolean;
}

export interface ShortcutContext {
  /** A full-screen stage (pack opening) owns the keyboard except Esc. */
  stageOpen: boolean;
  celebrating: boolean;
}

export const SHEET_KEYS: Readonly<Record<string, SheetId>> = {
  i: 'inventory',
  p: 'prices',
  o: 'crate',
  c: 'binder',
};

const SPEED_CODES: Readonly<Record<string, 1 | 2 | 4>> = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 4,
  Numpad1: 1,
  Numpad2: 2,
  Numpad3: 4,
};
const SPEED_KEYS: Readonly<Record<string, 1 | 2 | 4>> = { '1': 1, '2': 2, '3': 4 };

/** Inputs that type text: shortcuts must not steal their keys. */
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'range', 'submit', 'reset']);

function isTextEntry(input: KeyInput): boolean {
  if (input.targetEditable) return true;
  if (input.targetTag === 'TEXTAREA' || input.targetTag === 'SELECT') return true;
  if (input.targetTag === 'INPUT') return !NON_TEXT_INPUTS.has(input.targetType ?? 'text');
  return false;
}

/** Controls that Space activates natively. */
function spaceActivates(input: KeyInput): boolean {
  const tag = input.targetTag;
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return true;
  return (
    tag === 'INPUT' && ['button', 'checkbox', 'radio', 'submit'].includes(input.targetType ?? '')
  );
}

export function shortcutFor(input: KeyInput, context: ShortcutContext): ShellAction | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  if (input.key === 'Escape') return input.repeat ? null : { kind: 'back' };
  if (input.repeat || isTextEntry(input)) return null;
  // The pack-opening stage handles its own keys (tap to reveal, skip…).
  if (context.stageOpen) return null;

  const isSpace = input.key === ' ' || input.code === 'Space';
  if (context.celebrating) {
    return isSpace || input.key === 'Enter' ? { kind: 'skipCelebration' } : null;
  }
  if (isSpace) {
    if (spaceActivates(input) && input.targetInDialog) return null;
    return { kind: 'togglePause' };
  }
  const speed = (input.code && SPEED_CODES[input.code]) || SPEED_KEYS[input.key];
  if (speed) return { kind: 'speed', speed };
  const sheet = SHEET_KEYS[input.key.toLowerCase()];
  if (sheet) return { kind: 'sheet', sheet };
  return null;
}

/** Letter shown on the dock key caps. */
export function shortcutKeyOf(sheet: SheetId): string | null {
  for (const [key, id] of Object.entries(SHEET_KEYS)) if (id === sheet) return key.toUpperCase();
  return null;
}
