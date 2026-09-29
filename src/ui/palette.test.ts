import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { palette, rarityColors } from './palette';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').toLowerCase();

describe('design tokens', () => {
  it('tokens.css mirrors palette.ts', () => {
    for (const [name, hex] of Object.entries(palette)) {
      expect(css, `--color-${name}`).toContain(
        `--color-${name.toLowerCase()}: ${hex.toLowerCase()}`,
      );
    }
  });

  it('rarity colors are present in tokens.css', () => {
    for (const hex of Object.values(rarityColors)) {
      if (hex === palette.ink) continue;
      expect(css).toContain(hex.toLowerCase());
    }
  });
});
