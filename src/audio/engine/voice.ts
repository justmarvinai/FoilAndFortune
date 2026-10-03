import type { UtterancePlan } from '../voice/plan';

/**
 * Plays a planned blip utterance (docs/04 §11.2): one oscillator gliding per syllable, two
 * band-pass "formant" filters that move between vowels, a soft low-pass and a per-syllable
 * envelope. Six short-lived nodes per phrase. Works on any BaseAudioContext (offline metering).
 */
export function playUtterance(
  ctx: BaseAudioContext,
  destination: AudioNode,
  plan: UtterancePlan,
  t0: number,
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = plan.wave;
  const env = ctx.createGain();
  env.gain.value = 0;
  const soften = ctx.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 3800;
  soften.connect(env);
  env.connect(destination);
  const formants = [0, 1].map((i) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = i === 0 ? 5 : 7;
    const level = ctx.createGain();
    // F1 carries the vowel's body; F2 its color.
    level.gain.value = i === 0 ? 1.6 : 1;
    osc.connect(filter);
    filter.connect(level);
    level.connect(soften);
    return filter;
  });
  for (const syllable of plan.syllables) {
    const start = t0 + syllable.start;
    const end = start + syllable.dur;
    osc.frequency.setValueAtTime(syllable.from, start);
    osc.frequency.exponentialRampToValueAtTime(syllable.to, end);
    formants.forEach((filter, i) => {
      filter.frequency.setTargetAtTime(syllable.formants[i] ?? 1000, start, 0.01);
    });
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(syllable.amp, start + 0.012);
    env.gain.setTargetAtTime(0, end - 0.025, 0.012);
  }
  osc.start(t0);
  osc.stop(t0 + plan.duration + 0.1);
  osc.addEventListener('ended', () => {
    osc.disconnect();
    env.disconnect();
  });
  return osc;
}
