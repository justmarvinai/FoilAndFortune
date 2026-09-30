import { useFrame } from '@react-three/fiber';
import { useState } from 'react';
import { Color, ShaderMaterial } from 'three';
import { useDioramaRuntime } from '../runtime';
import { lightingPresets } from './presets';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Full-screen quad at the far plane, independent of the camera.
  gl_Position = vec4(position.xy * 2.0, 0.9999, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uTopDay;
uniform vec3 uBottomDay;
uniform vec3 uGlowDay;
uniform vec3 uTopEve;
uniform vec3 uBottomEve;
uniform vec3 uGlowEve;
uniform float uEvening;
uniform float uAspect;
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 top = mix(uTopDay, uTopEve, uEvening);
  vec3 bottom = mix(uBottomDay, uBottomEve, uEvening);
  vec3 glow = mix(uGlowDay, uGlowEve, uEvening);
  vec3 col = mix(bottom, top, smoothstep(0.05, 0.95, vUv.y));
  // Soft light pool behind the diorama, like a studio backdrop.
  vec2 p = (vUv - vec2(0.5, 0.42)) * vec2(uAspect, 1.0);
  col = mix(col, glow, smoothstep(0.95, 0.0, length(p)) * 0.55);
  // Evening stars: sparse round points, twinkling gently, only in the upper sky.
  vec2 grid = vUv * vec2(uAspect, 1.0) * 120.0;
  vec2 cell = floor(grid);
  float h = hash(cell);
  vec2 offset = vec2(hash(cell + 7.1), hash(cell + 3.7)) * 0.6 + 0.2;
  float d = length(fract(grid) - offset);
  float size = 0.06 + 0.08 * hash(cell + 1.3);
  float star = step(0.985, h) * smoothstep(size, size * 0.3, d);
  star *= uEvening * smoothstep(0.4, 0.95, vUv.y);
  col += star * (0.6 + 0.4 * sin(uTime * 1.7 + h * 60.0)) * vec3(1.0, 0.95, 0.85);
  // Dither away gradient banding.
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Gradient "studio backdrop" sky behind the diorama; crossfades with the time of day. */
export function Background() {
  const runtime = useDioramaRuntime();
  const [material] = useState(() => {
    const d = lightingPresets.day.background;
    const e = lightingPresets.evening.background;
    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTopDay: { value: new Color(d.top) },
        uBottomDay: { value: new Color(d.bottom) },
        uGlowDay: { value: new Color(d.glow) },
        uTopEve: { value: new Color(e.top) },
        uBottomEve: { value: new Color(e.bottom) },
        uGlowEve: { value: new Color(e.glow) },
        uEvening: { value: 0 },
        uAspect: { value: 1 },
        uTime: { value: 0 },
      },
    });
  });

  useFrame((state) => {
    const u = material.uniforms;
    if (u.uEvening) u.uEvening.value = runtime.evening;
    if (u.uAspect) u.uAspect.value = state.size.width / Math.max(1, state.size.height);
    if (u.uTime) u.uTime.value = runtime.time;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1000} material={material}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
