import { describe, expect, it } from 'vitest';
import { isCompact, sceneInsets, sheetWidth } from './layout';

describe('play-screen layout (docs/05 §9)', () => {
  it('treats phones in landscape and narrow windows as compact', () => {
    expect(isCompact(915, 412)).toBe(true); // phone landscape
    expect(isCompact(850, 900)).toBe(true);
    expect(isCompact(1024, 768)).toBe(false); // tablet landscape
    expect(isCompact(1440, 900)).toBe(false);
  });

  it('sizes sheets: 480–720 px on desktop, 60 % on tablets, full screen on phones', () => {
    expect(sheetWidth(1440, 900)).toBe(605);
    expect(sheetWidth(1280, 800)).toBe(538);
    expect(sheetWidth(2560, 1440)).toBe(720);
    expect(sheetWidth(1024, 768)).toBe(614);
    expect(sheetWidth(915, 412)).toBe(915);
  });

  it('insets the scene by the HUD, the dock and an open sheet', () => {
    const desktop = { width: 1440, height: 900, hudBottom: 86, dock: { width: 470, height: 88 } };
    expect(sceneInsets({ ...desktop, sheetOpen: false })).toEqual({
      top: 94,
      right: 0,
      bottom: 104,
      left: 0,
    });
    expect(sceneInsets({ ...desktop, sheetOpen: true }).right).toBe(605 + 24);
  });

  it('moves the dock inset to the right edge on phones, where sheets cover everything', () => {
    const phone = { width: 915, height: 412, hudBottom: 62, dock: { width: 64, height: 300 } };
    expect(sceneInsets({ ...phone, sheetOpen: true })).toEqual({
      top: 70,
      right: 80,
      bottom: 0,
      left: 0,
    });
  });
});
