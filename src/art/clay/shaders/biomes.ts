import type { BiomeId } from '@/art/types';

/**
 * Biome backdrops. Each biome provides:
 *  - `vec3 biomeSky(vec3 rd)`: sky, clouds and far layers for rays that miss the ground;
 *  - `Ground biomeGround(vec3 p, vec3 n, vec3 rd, float t)`: the knoll the creature stands on;
 *  - optionally `vec3 biomeWater(...)` (define HAS_WATER) and a silhouette fringe
 *    (define FRINGE) such as grass blades along the knoll's horizon.
 *
 * Everything is deliberately low-frequency and soft-edged: the backdrop plays the role of an
 * out-of-focus photo background so the crisp creature pops (docs/04 §6.2).
 * Palette slots come from stage.ts (u_pal), so time-of-day variants need no shader changes.
 */

const SHARED = /* glsl */ `
#define SKY_TOP u_pal[0]
#define SKY_MID u_pal[1]
#define SKY_HOR u_pal[2]
#define CLOUD_LIT u_pal[3]
#define CLOUD_SHADE u_pal[4]
#define FAR_LAND u_pal[5]
#define MID_LAND u_pal[6]
#define GROUND_A u_pal[7]
#define GROUND_B u_pal[8]
#define ACCENT u_pal[9]
#define ACCENT2 u_pal[10]
#define HAZE u_pal[11]
#define SUN_GLOW u_pal[12]
#define EXTRA u_pal[13]

struct Ground {
  vec3 alb;
  vec3 n;
  float rough;
  float spec;
  vec3 emit;
};

float azimuth(vec3 rd) { return atan(rd.x, -rd.z); }

vec3 skyGradient(vec3 rd) {
  float e = rd.y;
  vec3 col = mix(SKY_HOR, SKY_MID, smoothstep(-0.02, 0.2, e));
  col = mix(col, SKY_TOP, smoothstep(0.14, 0.62, e));
  float sd = max(dot(rd, u_skySun), 0.0);
  col += SUN_GLOW * (pow(sd, 6.0) * 0.28 + pow(sd, 48.0) * 0.5 + pow(sd, 900.0) * 1.5);
  return col;
}

float stars(vec3 rd) {
  vec2 uv = vec2(azimuth(rd), rd.y) * 70.0;
  vec2 id = floor(uv);
  vec2 f = fract(uv) - 0.5;
  float h = hash12(id + 17.0);
  vec2 o = (hash22(id) - 0.5) * 0.6;
  float s = smoothstep(0.09, 0.0, length(f - o)) * step(0.935, h);
  return s * (0.4 + (h - 0.935) * 30.0);
}

// Soft layered silhouette (hills, islands). Returns coverage with a blurred edge.
float ridgeMask(float e, float h, float soft) {
  return smoothstep(soft, -soft, e - h);
}

// Crepuscular rays fanning out from the sun/moon direction (angle-space stripes).
float sunRays(vec3 rd) {
  vec2 d = vec2(azimuth(rd) - azimuth(u_skySun), rd.y - u_skySun.y);
  float ang = atan(d.y, d.x);
  float r = pow(0.5 + 0.5 * sin(ang * 22.0 + fbm1(ang * 5.0 + u_seed * 9.0) * 7.0), 5.0);
  return r * smoothstep(0.75, 0.05, length(d)) * smoothstep(-0.01, 0.06, rd.y);
}

// Big soft cloud shadows drifting over distant land.
float cloudShadow(float az, float e) {
  return smoothstep(0.42, 0.62, fbm3(vec2(az * 3.2 + u_seed * 5.0, e * 22.0) + 3.0));
}

// One layer of rolling hills: ridge height h(az) = base + amp * noise. Returns coverage and,
// via "lit", how much the slope faces the sun (so hills get form instead of flat bands) and,
// via "mist", how deep below the crest we are (valleys fill with haze, separating layers).
float hillLayer(float e, float az, float base, float amp, float freq, float offs, float soft,
                float tufts, out float lit, out float mist) {
  float ridge = base + amp * fbm1(az * freq + offs);
  float dh = (fbm1((az + 0.004) * freq + offs) - fbm1((az - 0.004) * freq + offs)) * amp / 0.008;
  float sunSide = azimuth(u_skySun) < 0.0 ? 1.0 : -1.0;
  lit = sat(0.5 + dh * sunSide * 3.0);
  // Mist follows the smooth ridge, not the tufts, so trees don't cast vertical streaks.
  mist = sat((ridge - e) / (amp * 1.6 + 0.012));
  // Slope shading belongs to the hill's face near its crest; deeper down it would smear into
  // vertical bands (the slope only depends on azimuth).
  lit = mix(0.5, lit, 1.0 - smoothstep(0.0, 0.7, mist));
  // Optional small bumps along the crest read as distant trees/hedgerows.
  float h = ridge + tufts * smoothstep(0.55, 0.9, vnoise1(az * 120.0 + offs * 13.0));
  return ridgeMask(e, h, soft);
}
`;

const STORM_MEADOW = /* glsl */ `
#define FRINGE 1
const float FRINGE_H = 0.07;

vec3 biomeSky(vec3 rd) {
  float e = rd.y;
  float az = azimuth(rd);
  vec3 col = skyGradient(rd);
  // Storm clouds on a virtual cloud plane: bruised violet masses with lit rims. The cloud base
  // breaks up near the horizon, where warm light spills through.
  float ee = max(e, 0.0);
  vec2 uv = rd.xz / (ee + 0.12) * 0.5 + vec2(u_seed * 7.0, 1.3);
  float n = fbm(uv);
  float cover = smoothstep(0.33, 0.6, n + ee * 1.1);
  float rim = smoothstep(0.25, 0.8, fbm3(uv * 1.3 + vec2(-0.3, -0.4)) - n * 0.4 + 0.35);
  float sunSide = pow(max(dot(normalize(rd.xz + vec2(1e-5)), normalize(u_skySun.xz + vec2(1e-5))), 0.0), 3.0);
  vec3 cc = mix(CLOUD_SHADE, CLOUD_LIT, rim * (0.3 + 0.7 * smoothstep(0.42, 0.03, ee)));
  cc += SUN_GLOW * rim * sunSide * smoothstep(0.3, 0.0, ee) * 0.4;
  cc = mix(cc, SKY_HOR, smoothstep(0.1, 0.0, ee) * 0.55);
  float cloudAmt = cover * smoothstep(0.0, 0.06, ee);
  col = mix(col, cc, cloudAmt);
  col += SUN_GLOW * sunRays(rd) * (0.07 + 0.07 * u_tod.y) * (1.0 - 0.5 * cloudAmt);

  // Lightning: a glow pocket in the clouds and a faint jagged bolt behind the hills.
  vec3 bdir = normalize(vec3(0.6, 0.16, -1.0));
  float glow = pow(max(dot(rd, bdir), 0.0), 70.0);
  float strength = mix(0.6, 1.7, u_tod.z) + u_tod.y * 0.3;
  col += ACCENT * glow * (0.3 + cloudAmt) * strength;
  vec3 br = normalize(cross(bdir, vec3(0.0, 1.0, 0.0)));
  vec3 bu = cross(br, bdir);
  float bx = dot(rd, br);
  float by = dot(rd, bu);
  float jag = (vnoise1(by * 70.0 + 3.0) - 0.5) * 0.02 + (vnoise1(by * 19.0 + 1.0) - 0.5) * 0.028;
  float bd = abs(bx - jag);
  float bolt = (exp(-bd * 1400.0) + exp(-bd * 160.0) * 0.3) * smoothstep(-0.2, -0.04, by) * step(by, 0.0);
  col += ACCENT * bolt * strength * 0.9;
  col += stars(rd) * u_tod.z * (1.0 - cloudAmt) * vec3(0.9, 0.95, 1.0);

  // Rolling hills in receding layers. Seen from slightly above, nearer crests sit lower in the
  // frame, so the layers step down through the band between the horizon and the knoll: hazy
  // violet ridges far away, warm golden meadows up close, each misted at its base.
  float lit;
  float mist;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float k = fi / 4.0;
    float m = hillLayer(e, az, 0.02 - 0.026 * fi, 0.022 + 0.004 * fi, 2.2 + 1.2 * fi, 3.7 * fi + 1.0,
      0.0035 - 0.0003 * fi, k > 0.3 && k < 0.9 ? 0.006 : 0.0, lit, mist);
    vec3 land = mix(mix(FAR_LAND, MID_LAND, smoothstep(0.0, 0.5, k)), mix(GROUND_B, GROUND_A, 0.45),
      smoothstep(0.4, 1.0, k));
    land *= mix(0.84, 1.14, lit) * mix(1.0, 0.8, cloudShadow(az + fi * 1.3, e) * (0.4 + 0.6 * k));
    float haze = mix(0.42, 0.06, k) + 0.3 * mist;
    col = mix(col, mix(land, HAZE, haze), m);
  }
  return col;
}

Ground biomeGround(vec3 p, vec3 n, vec3 rd, float t) {
  Ground g;
  vec2 xz = p.xz;
  float blur = sat(t * 0.07 - 0.2);
  float n1 = fbm3(xz * 1.8 + 3.0);
  // Streaks stretched along the view direction project to upright "blades" at grazing angles.
  vec2 vd = normalize(rd.xz + vec2(1e-5));
  vec2 gs = vec2(dot(xz, vec2(-vd.y, vd.x)) * 90.0, dot(xz, vd) * 7.0);
  float blades = mix(vnoise(gs) * 0.65 + vnoise(gs * 2.3 + 7.0) * 0.35, 0.5, blur);
  vec3 alb = mix(GROUND_B, GROUND_A, smoothstep(0.2, 0.75, n1));
  alb *= 0.72 + 0.5 * blades;
  // Scattered little meadow flowers.
  vec2 cell = floor(xz * 8.0);
  vec2 f = fract(xz * 8.0) - 0.5;
  float h = hash12(cell);
  float fl = step(0.84, h) * smoothstep(0.13, 0.06, length(f - (hash22(cell) - 0.5) * 0.6));
  alb = mix(alb, ACCENT2, fl * (1.0 - blur) * 0.9);
  g.alb = alb;
  g.n = n;
  g.rough = 0.85;
  g.spec = 0.05;
  g.emit = vec3(0.0);
  return g;
}

// Grass blades poking above the knoll's silhouette (x = horizontal position along it).
vec3 biomeFringe(float along, float hgt, out float mask) {
  float blades = vnoise1(along * 260.0) * 0.6 + vnoise1(along * 90.0) * 0.4;
  float top = FRINGE_H * (0.2 + 0.8 * blades * blades);
  mask = smoothstep(top, top - 0.01, hgt);
  return mix(GROUND_B, GROUND_A, 0.35 + 0.5 * blades);
}
`;

const VOLCANO_DAWN = /* glsl */ `
vec3 biomeSky(vec3 rd) {
  float e = rd.y;
  float az = azimuth(rd);
  vec3 col = skyGradient(rd);
  // Long streaky dawn clouds, pink-lit from below.
  vec2 cuv = rd.xz / (max(e, 0.0) + 0.1) * vec2(0.25, 1.1) + vec2(u_seed * 5.0, 0.0);
  float n = fbm(cuv);
  float cover = smoothstep(0.5, 0.75, n) * smoothstep(0.03, 0.1, e);
  vec3 cc = mix(CLOUD_SHADE, CLOUD_LIT, smoothstep(0.45, 0.85, n + (0.25 - e)));
  col = mix(col, cc, cover * 0.85);
  col += SUN_GLOW * sunRays(rd) * (0.06 + 0.06 * u_tod.y);
  col += stars(rd) * u_tod.z * (1.0 - cover);

  // Distant volcano: a soft cone with a flat glowing crater and a drifting smoke plume.
  float az0 = 0.2;
  float x = az - az0;
  float peak = 0.1;
  float cone = min(peak - abs(x) * 0.44, peak - 0.006) + 0.004 * (fbm1(az * 40.0) - 0.5);
  float vm = ridgeMask(e, cone, 0.003);
  vec3 vcol = mix(FAR_LAND, HAZE, 0.2 + 0.45 * smoothstep(0.09, 0.0, e));
  // Ridged flanks catch the dawn light on one side.
  vcol *= 0.9 + 0.2 * smoothstep(-0.05, 0.05, -x) * fbm3(vec2(x * 60.0, e * 30.0));
  float crater = exp(-length(vec2(x * 1.3, (e - peak) * 1.6)) * 55.0);
  float lava = smoothstep(0.006, 0.0, abs(x + 0.012 * sin(e * 140.0) + 0.004)) *
    smoothstep(peak, peak - 0.04, e) * smoothstep(0.01, 0.05, e);
  float lava2 = smoothstep(0.005, 0.0, abs(x - 0.03 - 0.01 * sin(e * 90.0) - (peak - e) * 0.3)) *
    smoothstep(peak - 0.01, peak - 0.05, e) * smoothstep(0.015, 0.05, e);
  vcol += ACCENT * (crater * 1.2 + (lava + lava2 * 0.7) * 0.6) * (0.8 + u_tod.z * 1.2);
  col = mix(col, vcol, vm);
  // Smoke column leaning with the wind.
  float sy = e - peak;
  float sx = x - sy * 0.8 - 0.01 * sin(sy * 60.0);
  float width = 0.014 + sy * 0.35;
  float plume = smoothstep(0.0, 0.01, sy) * smoothstep(width, width * 0.2, abs(sx)) *
    (0.55 + 0.45 * fbm3(vec2(sx * 60.0, sy * 30.0 - u_seed * 9.0)));
  col = mix(col, mix(ACCENT2, CLOUD_SHADE, 0.3), plume * 0.75 * smoothstep(0.3, 0.06, sy));
  col += ACCENT * exp(-length(vec2(x, e - peak)) * 22.0) * (0.25 + u_tod.z * 0.6);

  // Rocky foothills in receding layers (see the meadow for why crests step down), from
  // hazy purple ridges to dark near rock whose crests catch ember light.
  float lit;
  float mist;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float k = fi / 3.0;
    float m = hillLayer(e, az, 0.008 - 0.03 * fi, 0.02 + 0.005 * fi, 3.0 + 1.4 * fi, 2.3 * fi + 2.0,
      0.003 - 0.0003 * fi, 0.0, lit, mist);
    vec3 rock = mix(mix(FAR_LAND, MID_LAND, smoothstep(0.0, 0.6, k)), mix(GROUND_B, MID_LAND, 0.35),
      smoothstep(0.5, 1.0, k));
    rock *= mix(0.8, 1.2, lit) * (0.86 + 0.26 * fbm3(vec2(az * 30.0, e * 150.0) + fi));
    rock *= mix(1.0, 0.82, cloudShadow(az + fi, e));
    rock += ACCENT * k * (1.0 - mist) * (0.05 + 0.25 * u_tod.z) * smoothstep(0.7, 1.0, 1.0 - mist);
    float haze = mix(0.4, 0.08, k) + 0.3 * mist;
    col = mix(col, mix(rock, HAZE, haze), m);
  }
  return col;
}

Ground biomeGround(vec3 p, vec3 n, vec3 rd, float t) {
  Ground g;
  vec2 xz = p.xz;
  float blur = sat(t * 0.07 - 0.2);
  float n1 = fbm3(xz * 2.4 + 7.0);
  float n2 = mix(vnoise(xz * 22.0), 0.5, blur);
  vec3 alb = mix(GROUND_B, GROUND_A, smoothstep(0.25, 0.8, n1));
  alb *= 0.85 + 0.3 * n2;
  // Faintly glowing lava veins in the cracks (warmer at night).
  float vein = abs(fbm3(xz * 1.6 + 11.0) - 0.5);
  float crack = smoothstep(0.03, 0.0, vein) * (1.0 - blur * 0.8);
  g.alb = mix(alb, alb * 0.5, crack);
  g.emit = ACCENT * crack * (0.35 + u_tod.z * 0.9 + u_tod.y * 0.3);
  // Pebbles.
  vec2 cell = floor(xz * 10.0);
  vec2 f = fract(xz * 10.0) - 0.5;
  float h = hash12(cell);
  float peb = step(0.8, h) * smoothstep(0.2, 0.1, length(f - (hash22(cell) - 0.5) * 0.4));
  g.alb = mix(g.alb, GROUND_A * 1.25, peb * (1.0 - blur) * 0.7);
  g.n = normalize(n + vec3(f.x, 0.0, f.y) * peb * 0.6);
  g.rough = 0.7;
  g.spec = 0.12;
  return g;
}
`;

const LAGOON = /* glsl */ `
#define HAS_WATER 1

vec3 biomeSky(vec3 rd) {
  float e = rd.y;
  float az = azimuth(rd);
  vec3 col = skyGradient(rd);
  float ee = max(e, 0.0);
  // Puffy cumulus: rounded tops lit white, soft blue-gray bellies.
  vec2 cuv = rd.xz / (ee + 0.14) * 0.42 + vec2(u_seed * 4.0, 2.0);
  float n = fbm(cuv * 1.4);
  float band = smoothstep(0.0, 0.05, ee) * smoothstep(0.55, 0.12, ee);
  float cover = smoothstep(0.52, 0.64, n) * band;
  float lit = smoothstep(0.45, 0.72, n + ee * 1.2 - fbm3(cuv * 1.4 - vec2(0.0, 0.25)) * 0.35);
  vec3 cc = mix(CLOUD_SHADE, CLOUD_LIT, lit);
  col = mix(col, cc, cover);
  col += stars(rd) * u_tod.z * (1.0 - cover);
  // Distant islands on the horizon.
  float isl = 0.0;
  isl = max(isl, 0.03 * exp(-pow((az + 0.3) * 7.0, 2.0)) + 0.012 * exp(-pow((az + 0.18) * 12.0, 2.0)));
  isl = max(isl, 0.02 * exp(-pow((az - 0.42) * 9.0, 2.0)));
  isl += 0.002 * (fbm1(az * 60.0) - 0.5);
  col = mix(col, mix(FAR_LAND, HAZE, 0.45), ridgeMask(e, isl - 0.001, 0.0025) * step(0.0015, isl));
  return col;
}

Ground biomeGround(vec3 p, vec3 n, vec3 rd, float t) {
  Ground g;
  vec2 xz = p.xz;
  float blur = sat(t * 0.07 - 0.2);
  float n1 = fbm3(xz * 2.0 + 1.0);
  float grain = mix(vnoise(xz * 50.0), 0.5, blur);
  vec3 alb = mix(GROUND_B, GROUND_A, smoothstep(0.2, 0.7, n1));
  alb *= 0.92 + 0.14 * grain;
  // Wet sand darkens toward the waterline.
  float h = p.y - u_waterY;
  alb = mix(alb * 0.72, alb, smoothstep(0.0, 0.05, h));
  // Tiny shells.
  vec2 cell = floor(xz * 7.0);
  vec2 f = fract(xz * 7.0) - 0.5;
  float hs = hash12(cell);
  float shell = step(0.9, hs) * smoothstep(0.1, 0.05, length((f - (hash22(cell) - 0.5) * 0.5) * vec2(1.0, 1.4)));
  alb = mix(alb, mix(EXTRA, ACCENT2, 0.2), shell * (1.0 - blur) * 0.8);
  g.alb = alb;
  g.n = n;
  g.rough = 0.8;
  g.spec = 0.06;
  g.emit = vec3(0.0);
  return g;
}

vec3 biomeWater(vec3 p, vec3 rd, float t, float depth, float shadow) {
  vec2 uv = p.xz;
  float fade = exp(-t * 0.12);
  float e = 0.05;
  float w0 = fbm3(uv * vec2(1.6, 3.2) + vec2(u_seed * 3.0, 0.0));
  float wx = fbm3((uv + vec2(e, 0.0)) * vec2(1.6, 3.2) + vec2(u_seed * 3.0, 0.0));
  float wz = fbm3((uv + vec2(0.0, e)) * vec2(1.6, 3.2) + vec2(u_seed * 3.0, 0.0));
  vec3 n = normalize(vec3(-(wx - w0) / e * 0.08 * fade, 1.0, -(wz - w0) / e * 0.08 * fade));
  vec3 r = reflect(rd, n);
  r.y = abs(r.y);
  vec3 refl = biomeSky(r);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  // Shallow turquoise over sand → deep blue further out.
  vec3 shallow = ACCENT2;
  vec3 deep = ACCENT;
  vec3 body = mix(shallow, deep, smoothstep(0.0, 0.5, depth));
  vec3 sand = GROUND_B * 0.9;
  body = mix(sand, body, smoothstep(0.0, 0.07, depth));
  body *= u_keyCol * 0.35 * (0.5 + 0.5 * shadow) + u_skyFill * 0.65;
  // Caustic-like shimmer in the shallows.
  float caus = pow(1.0 - abs(fbm3(uv * 6.0 + u_seed) - 0.5) * 2.0, 8.0) * smoothstep(0.35, 0.02, depth);
  body += shallow * caus * 0.25 * fade;
  vec3 col = mix(body, refl, fres);
  // Sun glints.
  float gl = pow(max(dot(r, u_keyDir), 0.0), 350.0) * 6.0 * fade;
  col += u_keyCol * gl * shadow;
  // Foam along the shore.
  float foamN = fbm3(uv * 9.0 + u_seed * 2.0);
  float foam = smoothstep(0.035, 0.0, depth - 0.02 * foamN) * smoothstep(-0.02, 0.01, depth);
  col = mix(col, EXTRA * (u_keyCol * 0.4 + u_skyFill * 0.7), foam * 0.85);
  return col;
}
`;

const BIOME_CODE: Record<BiomeId, string> = {
  'storm-meadow': STORM_MEADOW,
  'volcano-dawn': VOLCANO_DAWN,
  lagoon: LAGOON,
};

export function biomeGlsl(biome: BiomeId): string {
  return `${SHARED}\n${BIOME_CODE[biome]}`;
}
