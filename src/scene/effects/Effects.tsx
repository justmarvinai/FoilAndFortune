import { useFrame } from '@react-three/fiber';
import {
  Bloom,
  EffectComposer,
  N8AO,
  SMAA,
  TiltShift2,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { type BloomEffect, ToneMappingMode } from 'postprocessing';
import { useRef } from 'react';
import { lerp } from '../lib/easing';
import type { QualityPreset } from '../quality';
import { useDioramaRuntime } from '../runtime';

/**
 * Post-processing per quality tier (docs/04 §4.3): soft AO (N8AO) → subtle bloom for neon and
 * sparkles → tilt-shift for the miniature look (High) → neutral tone mapping → vignette → SMAA.
 *
 * The composer takes over tone mapping from the renderer (it forces NoToneMapping while
 * mounted), hence the explicit ToneMapping effect. Neutral (Khronos PBR Neutral) keeps the toy
 * colours saturated and hue-true where ACES would wash out the pastels.
 */
export function Effects({ quality }: { quality: QualityPreset }) {
  const runtime = useDioramaRuntime();
  const bloomRef = useRef<BloomEffect>(null);
  const { ao, bloom } = quality;
  useFrame(() => {
    const effect = bloomRef.current;
    if (!effect || !bloom) return;
    const t = runtime.evening;
    effect.intensity = lerp(bloom.day.intensity, bloom.evening.intensity, t);
    effect.luminanceMaterial.threshold = lerp(bloom.day.threshold, bloom.evening.threshold, t);
  });
  if (!quality.post) return null;
  return (
    <EffectComposer multisampling={quality.multisampling} enableNormalPass={false}>
      {ao ? (
        <N8AO
          halfRes={ao.halfRes}
          quality={ao.quality}
          aoRadius={ao.radius}
          distanceFalloff={0.55}
          intensity={ao.intensity}
          color="#2A1A2E"
        />
      ) : null}
      {bloom ? (
        <Bloom
          ref={bloomRef}
          mipmapBlur
          intensity={bloom.day.intensity}
          luminanceThreshold={bloom.day.threshold}
          luminanceSmoothing={bloom.smoothing}
          radius={0.7}
        />
      ) : null}
      {/*
        Miniature look: a horizontal focus band with blur growing towards the top and bottom.
        Two 1D passes (horizontal + vertical) approximate a round blur. TiltShift2 samples the
        HDR input directly; postprocessing's TiltShiftEffect washed the image out here.
      */}
      {quality.tiltShift ? (
        <TiltShift2
          blur={0.1}
          taper={0.42}
          start={[0, 0.46]}
          end={[1, 0.46]}
          samples={8}
          direction={[1, 0]}
        />
      ) : null}
      {quality.tiltShift ? (
        <TiltShift2
          blur={0.1}
          taper={0.42}
          start={[0, 0.46]}
          end={[1, 0.46]}
          samples={8}
          direction={[0, 1]}
        />
      ) : null}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      {quality.vignette ? <Vignette offset={0.32} darkness={0.42} /> : null}
      {quality.smaa ? <SMAA /> : null}
    </EffectComposer>
  );
}
