import { describe, expect, it } from 'vitest';
import {
  type AnchorInput,
  fullInsets,
  MIN_ANCHOR_SCALE,
  placeAnchored,
  sameInsets,
  screenBounds,
} from './anchor';

const base: AnchorInput = {
  target: { left: 600, top: 400, right: 800, bottom: 500 },
  size: { width: 320, height: 200 },
  viewport: { width: 1440, height: 900 },
  insets: { top: 80, right: 0, bottom: 100, left: 0 },
  gap: 10,
  margin: 8,
};

describe('anchored panel placement', () => {
  it('sits above the fixture, centred, when there is room', () => {
    const result = placeAnchored(base);
    expect(result.placement).toBe('above');
    expect(result.y).toBe(400 - 10 - 200);
    expect(result.x).toBe(700 - 160);
  });

  it('flips below when the HUD leaves no room above', () => {
    const result = placeAnchored({
      ...base,
      target: { left: 600, top: 200, right: 800, bottom: 300 },
    });
    expect(result.placement).toBe('below');
    expect(result.y).toBe(310);
  });

  it('keeps its side while it still fits (no flip-flop)', () => {
    const target = { left: 600, top: 250, right: 800, bottom: 350 };
    expect(placeAnchored({ ...base, target }).placement).toBe('below');
    expect(placeAnchored({ ...base, target, previous: 'below' }).placement).toBe('below');
    expect(placeAnchored({ ...base, target: base.target, previous: 'below' }).placement).toBe(
      'below',
    );
    expect(placeAnchored({ ...base, previous: 'above' }).placement).toBe('above');
  });

  it('takes the roomier side and clamps when neither fits', () => {
    const result = placeAnchored({
      ...base,
      viewport: { width: 915, height: 412 },
      insets: { top: 60, right: 90, bottom: 0, left: 0 },
      target: { left: 300, top: 150, right: 420, bottom: 260 },
      size: { width: 320, height: 300 },
    });
    expect(result.y).toBeGreaterThanOrEqual(60 + 8);
    expect(result.y + 300).toBeLessThanOrEqual(412 - 8);
  });

  it('clamps horizontally inside the insets', () => {
    const left = placeAnchored({ ...base, target: { left: 0, top: 400, right: 40, bottom: 500 } });
    expect(left.x).toBe(8);
    const right = placeAnchored({
      ...base,
      insets: { ...base.insets, right: 500 },
      target: { left: 900, top: 400, right: 1000, bottom: 500 },
    });
    expect(right.x).toBe(1440 - 500 - 8 - 320);
  });

  it('shrinks a panel taller than the free area to fit under the HUD', () => {
    const result = placeAnchored({
      ...base,
      viewport: { width: 915, height: 412 },
      insets: { top: 70, right: 100, bottom: 0, left: 0 },
      target: { left: 300, top: 120, right: 420, bottom: 220 },
      size: { width: 320, height: 396 },
    });
    expect(result.scale).toBeLessThan(1);
    expect(result.scale).toBeGreaterThanOrEqual(MIN_ANCHOR_SCALE);
    expect(result.y).toBeGreaterThanOrEqual(70 + 8);
    expect(result.y + 396 * result.scale).toBeLessThanOrEqual(412 - 8 + 0.5);
    // Horizontally it still keeps clear of the dock rail.
    expect(result.x + 320 * result.scale).toBeLessThanOrEqual(915 - 100 - 8);
  });

  it('covers the HUD rather than leaving the screen when even the smallest scale is too big', () => {
    const result = placeAnchored({
      ...base,
      viewport: { width: 915, height: 360 },
      insets: { top: 120, right: 100, bottom: 0, left: 0 },
      target: { left: 300, top: 150, right: 420, bottom: 220 },
      size: { width: 320, height: 420 },
    });
    expect(result.scale).toBe(MIN_ANCHOR_SCALE);
    expect(result.y).toBe(8);
  });

  it('keeps fitting panels at full size', () => {
    expect(placeAnchored(base).scale).toBe(1);
  });

  it('keeps oversized panels on screen', () => {
    const result = placeAnchored({
      ...base,
      viewport: { width: 300, height: 200 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(result.scale).toBeLessThan(1);
    expect(result.x).toBeGreaterThanOrEqual(8);
    expect(result.x + 320 * result.scale).toBeLessThanOrEqual(300 - 8 + 0.5);
    expect(result.y).toBeGreaterThanOrEqual(8);
    expect(result.y + 200 * result.scale).toBeLessThanOrEqual(200 - 8 + 0.5);
  });

  it('bounds projected points and fills partial insets', () => {
    expect(
      screenBounds([
        { x: 5, y: 9 },
        { x: -1, y: 20 },
      ]),
    ).toEqual({ left: -1, top: 9, right: 5, bottom: 20 });
    expect(screenBounds([])).toBeNull();
    expect(fullInsets({ top: 4 })).toEqual({ top: 4, right: 0, bottom: 0, left: 0 });
    expect(sameInsets(fullInsets({ top: 4 }), { top: 4, right: 0, bottom: 0, left: 0 })).toBe(true);
    expect(sameInsets(fullInsets({}), fullInsets({ left: 1 }))).toBe(false);
  });
});
