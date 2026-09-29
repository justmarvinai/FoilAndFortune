/**
 * GLSL helpers used by generated paint layers (sdf/kit.ts): soft masks, mouth strokes and the
 * glossy "toy eye" with painted highlights.
 */
export const GLSL_PAINT = /* glsl */ `
// 1 inside (d < 0), 0 outside, with a soft edge of half-width w.
float fillMask(float d, float w) { return 1.0 - smoothstep(-w, w, d); }

// Distance to the lower half of a circle (center c, radius r); the upper half is capped at the
// arc's endpoints. Two of these side by side draw the classic "ω" cat mouth.
float sdArcLower(vec2 p, vec2 c, float r) {
  vec2 d = p - c;
  if (d.y > 0.0) return length(vec2(abs(d.x) - r, d.y));
  return abs(length(d) - r);
}

float sdSegment2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Glossy toy eye. uv = camera-plane coordinates in eye-height units (x right, y up), so the
// painted highlights always sit where a viewer expects them, whatever the head pose.
// style: 0 round, 1 sparkle, 2 sleepy, 3 fierce. lidCol paints eyelids for sleepy/fierce.
void eyePaint(inout Mat m, vec2 uv, float style, vec3 base, vec3 iris, vec3 lidCol) {
  // Soft colored iris glow in the lower half, dark glossy pupil above it.
  float lower = smoothstep(0.2, -0.9, uv.y);
  float inner = smoothstep(1.02, 0.6, length(uv * vec2(1.08, 0.95) - vec2(0.0, -0.04)));
  vec3 col = mix(base, iris, lower * inner * 0.95);
  col = mix(col, base * 0.6, smoothstep(0.55, 0.15, length((uv - vec2(0.03, 0.14)) * vec2(1.25, 1.0))) * 0.7);
  // Thin bright rim of the iris glow for a "wet" look.
  float ring = smoothstep(0.1, 0.0, abs(length(uv * vec2(1.08, 0.95)) - 0.84)) * lower;
  col = mix(col, iris * 1.25, ring * 0.35);

  // Painted highlights: one big soft-edged oval up-left, one small dot down-right.
  float hl = smoothstep(1.0, 0.82, length((uv - vec2(-0.3, 0.37)) / vec2(0.31, 0.27)));
  hl = max(hl, smoothstep(1.0, 0.7, length((uv - vec2(0.33, -0.36)) / 0.12)));
  if (style > 0.5 && style < 1.5) {
    // Sparkle: a four-point twinkle plus a tiny satellite dot.
    float star = sdStar4((uv - vec2(0.3, -0.3)) * vec2(1.0, 0.95), 0.3, 0.055);
    hl = max(hl, smoothstep(0.025, -0.025, star));
    hl = max(hl, smoothstep(1.0, 0.6, length((uv - vec2(-0.2, -0.5)) / 0.075)));
    hl = max(hl, smoothstep(1.0, 0.6, length((uv - vec2(0.02, 0.62)) / 0.06)) * 0.9);
  }
  col = mix(col, vec3(1.0), hl);
  m.emit += vec3(0.55) * hl;

  if (style > 1.5) {
    // Eyelids: sleepy covers the top half, fierce is a slanted cut toward the nose.
    float lid = style < 2.5 ? uv.y - 0.05 : uv.y - 0.25 + uv.x * 0.45;
    float lm = smoothstep(-0.03, 0.03, lid);
    col = mix(col, lidCol, lm);
    m.emit *= 1.0 - lm;
    if (lm > 0.5) {
      m.kind = 0.0;
      m.rough = 0.5;
      m.spec = 0.28;
    }
  }
  m.alb = col;
}
`;
