import { describe, expect, it } from 'vitest';
import { type KeyInput, shortcutFor, shortcutKeyOf } from './shortcuts';

const idle = { stageOpen: false, celebrating: false };
const key = (input: Partial<KeyInput> & { key: string }): KeyInput => ({
  targetTag: 'BODY',
  ...input,
});

describe('shortcutFor (docs/05 §9)', () => {
  it('maps Space, 1/2/3, I/P/O/C and Esc', () => {
    expect(shortcutFor(key({ key: ' ', code: 'Space' }), idle)).toEqual({ kind: 'togglePause' });
    expect(shortcutFor(key({ key: '1', code: 'Digit1' }), idle)).toEqual({
      kind: 'speed',
      speed: 1,
    });
    expect(shortcutFor(key({ key: '2', code: 'Digit2' }), idle)).toEqual({
      kind: 'speed',
      speed: 2,
    });
    expect(shortcutFor(key({ key: '3', code: 'Numpad3' }), idle)).toEqual({
      kind: 'speed',
      speed: 4,
    });
    expect(shortcutFor(key({ key: 'i' }), idle)).toEqual({ kind: 'sheet', sheet: 'inventory' });
    expect(shortcutFor(key({ key: 'P' }), idle)).toEqual({ kind: 'sheet', sheet: 'prices' });
    expect(shortcutFor(key({ key: 'o' }), idle)).toEqual({ kind: 'sheet', sheet: 'crate' });
    expect(shortcutFor(key({ key: 'c' }), idle)).toEqual({ kind: 'sheet', sheet: 'binder' });
    expect(shortcutFor(key({ key: 'Escape' }), idle)).toEqual({ kind: 'back' });
    expect(shortcutFor(key({ key: 'x' }), idle)).toBeNull();
  });

  it('never steals keys from text fields or browser shortcuts', () => {
    expect(shortcutFor(key({ key: 'p', targetTag: 'INPUT', targetType: 'text' }), idle)).toBeNull();
    expect(
      shortcutFor(key({ key: '1', targetTag: 'INPUT', targetType: 'number' }), idle),
    ).toBeNull();
    expect(shortcutFor(key({ key: ' ', targetTag: 'TEXTAREA' }), idle)).toBeNull();
    expect(shortcutFor(key({ key: 'i', targetEditable: true }), idle)).toBeNull();
    expect(shortcutFor(key({ key: 'p', ctrlKey: true }), idle)).toBeNull();
    expect(shortcutFor(key({ key: 'c', metaKey: true }), idle)).toBeNull();
    // Esc still backs out of a text field's sheet.
    expect(shortcutFor(key({ key: 'Escape', targetTag: 'INPUT' }), idle)).toEqual({ kind: 'back' });
    // Sliders and checkboxes are not text: letters still work.
    expect(shortcutFor(key({ key: 'o', targetTag: 'INPUT', targetType: 'range' }), idle)).toEqual({
      kind: 'sheet',
      sheet: 'crate',
    });
  });

  it('keeps Space for buttons inside sheets and dialogs, but pauses from the HUD and dock', () => {
    const inSheet = key({ key: ' ', targetTag: 'BUTTON', targetInDialog: true });
    expect(shortcutFor(inSheet, idle)).toBeNull();
    const onDock = key({ key: ' ', targetTag: 'BUTTON', targetInDialog: false });
    expect(shortcutFor(onDock, idle)).toEqual({ kind: 'togglePause' });
    // A plain element inside a sheet (not a control) still pauses.
    expect(shortcutFor(key({ key: ' ', targetTag: 'DIV', targetInDialog: true }), idle)).toEqual({
      kind: 'togglePause',
    });
  });

  it('ignores auto-repeat so holding a key does not flicker sheets', () => {
    expect(shortcutFor(key({ key: 'i', repeat: true }), idle)).toBeNull();
    expect(shortcutFor(key({ key: 'Escape', repeat: true }), idle)).toBeNull();
  });

  it('leaves the stage its keys, except Esc', () => {
    const stage = { stageOpen: true, celebrating: false };
    expect(shortcutFor(key({ key: ' ' }), stage)).toBeNull();
    expect(shortcutFor(key({ key: 'i' }), stage)).toBeNull();
    expect(shortcutFor(key({ key: 'Escape' }), stage)).toEqual({ kind: 'back' });
  });

  it('skips a celebration with Space or Enter', () => {
    const party = { stageOpen: false, celebrating: true };
    expect(shortcutFor(key({ key: ' ' }), party)).toEqual({ kind: 'skipCelebration' });
    expect(shortcutFor(key({ key: 'Enter' }), party)).toEqual({ kind: 'skipCelebration' });
    expect(shortcutFor(key({ key: 'i' }), party)).toBeNull();
  });

  it('labels dock key caps', () => {
    expect(shortcutKeyOf('crate')).toBe('O');
    expect(shortcutKeyOf('settings')).toBeNull();
  });
});
