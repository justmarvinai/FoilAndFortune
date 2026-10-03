import { useGameStore } from '@/state/gameStore';
import { presentationBus } from '@/state/presentationBus';
import { playSfx, speak, type VoiceProfile } from '../index';
import { hash01, voiceForSeed } from '../voiceProfile';
import { RateLimiter, reactionFor } from './rules';

/** Kids talk higher (docs/04 §4.4 archetype cues). */
const PITCH_BIAS: Record<string, number> = { 'arch.kid': 0.25 };

let lastLimiter: RateLimiter | null = null;

/** Played and suppressed reaction counts of the running install (audio lab). */
export function reactionStats(): { allowed: number; suppressed: number } {
  return { allowed: lastLimiter?.allowed ?? 0, suppressed: lastLimiter?.suppressed ?? 0 };
}

/**
 * Subscribes the reaction rules to the presentation bus (loaded lazily by
 * `installAudioReactions`). A customer's voice comes from their look seed, cached on arrival so
 * the goodbye blip still matches after the sim removed them.
 */
export function installReactions(): () => void {
  const limiter = new RateLimiter();
  lastLimiter = limiter;
  const voices = new Map<number, VoiceProfile>();

  const voiceFor = (uid: number): VoiceProfile => {
    const cached = voices.get(uid);
    if (cached) return cached;
    const agent = useGameStore.getState().game?.customers.active.find((entry) => entry.uid === uid);
    const seed = agent?.lookSeed ?? Math.floor(hash01(uid, 99) * 2 ** 31);
    const voice = voiceForSeed(seed, { pitchBias: PITCH_BIAS[agent?.archetypeId ?? ''] ?? 0 });
    voices.set(uid, voice);
    if (voices.size > 64) {
      const oldest = voices.keys().next();
      if (!oldest.done) voices.delete(oldest.value);
    }
    return voice;
  };

  const off = presentationBus.onAny(({ payload: event }) => {
    if (event.type === 'customer/arrived') voiceFor(event.uid);
    const reaction = reactionFor(event);
    if (reaction && limiter.allow(reaction.key, performance.now(), reaction.uid)) {
      for (const action of reaction.actions) {
        if (action.kind === 'sfx') playSfx(action.id, { delay: action.delay });
        else speak(voiceFor(action.uid), action.syllables, action.mood);
      }
    }
    if (event.type === 'customer/left') voices.delete(event.uid);
  });

  return () => {
    off();
    voices.clear();
  };
}
