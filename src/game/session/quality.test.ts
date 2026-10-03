import { describe, expect, it } from 'vitest';
import { type DeviceHints, resolveQuality } from './quality';

const desktop: DeviceHints = { override: null, coarsePointer: false, cores: 8, memoryGb: 16 };

describe('resolveQuality', () => {
  it('honors an explicit setting, and a URL override above all', () => {
    expect(resolveQuality('high', { ...desktop, coarsePointer: true })).toBe('high');
    expect(resolveQuality('high', { ...desktop, override: 'low' })).toBe('low');
    expect(resolveQuality('low', { ...desktop, override: 'ultra' })).toBe('low');
  });

  it('auto-detects: phones and small machines low, big desktops high, the rest medium', () => {
    expect(resolveQuality('auto', desktop)).toBe('medium');
    expect(resolveQuality('auto', { ...desktop, coarsePointer: true })).toBe('low');
    expect(resolveQuality('auto', { ...desktop, cores: 4 })).toBe('low');
    expect(resolveQuality('auto', { ...desktop, memoryGb: 4 })).toBe('low');
    expect(resolveQuality('auto', { ...desktop, cores: 16 })).toBe('high');
    expect(resolveQuality('auto', { ...desktop, cores: 16, memoryGb: undefined })).toBe('high');
    expect(resolveQuality('auto', { ...desktop, cores: 0, memoryGb: undefined })).toBe('medium');
  });
});
