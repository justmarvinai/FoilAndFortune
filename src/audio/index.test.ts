import { describe, expect, it, vi } from 'vitest';

// The reactions module subscribes to the real stores; here only the facade's bookkeeping counts.
const installReactions = vi.fn(() => vi.fn());
vi.mock('./reactions/install', () => ({ installReactions }));

const audio = await import('./index');

describe('audio facade without Web Audio (tests, old browsers)', () => {
  it('every call is a safe no-op and unlocking reports "unavailable"', () => {
    expect(audio.getAudioStatus()).toBe('locked');
    expect(() => {
      audio.playSfx('ui.pop');
      audio.setMusic('day', { seed: 3 });
      audio.speak(audio.voiceForSeed(1), 3, 'happy');
      audio.duckMusic(0.5, 1000);
      audio.unlockAudio();
      audio.unlockAudio();
    }).not.toThrow();
    expect(audio.getAudioStatus()).toBe('unavailable');
    expect(audio.getAudioEngine()).toBeNull();
  });

  it('maps rarities to the ascending stinger family', () => {
    expect(audio.stingerForRarity('common')).toBeNull();
    expect(audio.stingerForRarity('uncommon')).toBeNull();
    expect(audio.stingerForRarity('rare')).toBe('pack.stingerRare');
    expect(audio.stingerForRarity('holoRare')).toBe('pack.stingerHolo');
    expect(audio.stingerForRarity('mythicRare')).toBe('pack.stingerMythic');
  });

  it('installs the reactions once, however many times it is called, and uninstalls at zero', async () => {
    const releaseA = audio.installAudioReactions();
    const releaseB = audio.installAudioReactions();
    await vi.waitFor(() => expect(installReactions).toHaveBeenCalledTimes(1));
    const uninstall = installReactions.mock.results[0]?.value as ReturnType<typeof vi.fn>;
    releaseA();
    releaseA(); // releasing twice counts once
    expect(uninstall).not.toHaveBeenCalled();
    releaseB();
    expect(uninstall).toHaveBeenCalledTimes(1);
    // A StrictMode remount installs again.
    const releaseC = audio.installAudioReactions();
    await vi.waitFor(() => expect(installReactions).toHaveBeenCalledTimes(2));
    releaseC();
  });
});
