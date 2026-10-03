/**
 * Shared GLSL (ES 3.00) helpers for the Clay Critters renderer: hashing/noise, signed-distance
 * primitives, smooth boolean ops and the tone mapper.
 *
 * Adapted third-party snippets are marked where they appear, and their notices ship in
 * public/licenses/third-party-code.txt (CREDITS.md): SDF primitives and smooth-min after
 * Inigo Quilez (MIT), "Hash without Sine" by David Hoskins (MIT), and the Khronos PBR Neutral
 * tone mapper (Apache-2.0). Everything else is original.
 */
export const GLSL_COMMON = /* glsl */ `
#define PI 3.14159265
#define TAU 6.28318531

float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x) { return clamp(x, 0.0, 1.0); }

// ---- Hashing & value noise (fract-based, stable on highp float) ---------------------------
// hash11/hash12/hash22: "Hash without Sine", David Hoskins (MIT).
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float vnoise1(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash11(i), hash11(i + 1.0), f * f * (3.0 - 2.0 * f));
}
const mat2 FBM_ROT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = FBM_ROT * p;
    a *= 0.5;
  }
  return s;
}
float fbm3(vec2 p) {
  float s = 0.5 * vnoise(p);
  p = FBM_ROT * p;
  s += 0.25 * vnoise(p);
  p = FBM_ROT * p;
  s += 0.125 * vnoise(p);
  return s / 0.875;
}
float fbm1(float x) {
  return 0.5 * vnoise1(x) + 0.25 * vnoise1(x * 2.03 + 1.7) + 0.125 * vnoise1(x * 4.01 + 3.1);
}

// ---- Smooth booleans ----------------------------------------------------------------------
// Polynomial smooth-min (after Inigo Quilez, MIT): organic "clay" joins. k = blend radius.
float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

// ---- Primitives ---------------------------------------------------------------------------
// Ellipsoid bound (after Inigo Quilez, MIT).
float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-6);
}

// Round cone between points a (radius r1) and b (radius r2), exact (after Inigo Quilez, MIT).
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

// Round cone from the origin (radius r1) up the +Y axis to height h (radius r2).
float sdRoundConeY(vec3 p, float r1, float r2, float h) {
  float b = (r1 - r2) / h;
  float a = sqrt(max(1.0 - b * b, 1e-4));
  vec2 q = vec2(length(p.xz), p.y);
  float k = dot(q, vec2(-b, a));
  if (k < 0.0) return length(q) - r1;
  if (k > a * h) return length(q - vec2(0.0, h)) - r2;
  return dot(q, vec2(a, b)) - r1;
}

// Tapered "leaf" along +Y (ears, flames, fins): a round cone flattened along X (flat < 1)
// and curled toward +X by bend. The factors keep the estimate conservative for marching.
float sdLeaf(vec3 p, float h, float ra, float rb, float thin, float bend) {
  float y = clamp(p.y / h, 0.0, 1.0);
  p.x -= bend * h * y * y;
  p.x /= thin;
  return sdRoundConeY(p, ra, rb, h) * thin * inversesqrt(1.0 + 4.0 * bend * bend);
}

// Quadratic Bezier distance, closed-form cubic solve (after Inigo Quilez, MIT). Returns (d, t).
vec2 sdBezier(vec3 pos, vec3 A, vec3 B, vec3 C) {
  vec3 a = B - A;
  vec3 b = A - 2.0 * B + C;
  vec3 c = a * 2.0;
  vec3 d = A - pos;
  float kk = 1.0 / dot(b, b);
  float kx = kk * dot(a, b);
  float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
  float kz = kk * dot(d, a);
  float p = ky - kx * kx;
  float p3 = p * p * p;
  float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
  float h = q * q + 4.0 * p3;
  vec2 res;
  if (h >= 0.0) {
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - q) / 2.0;
    vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
    vec3 w = d + (c + b * t) * t;
    res = vec2(dot(w, w), t);
  } else {
    float z = sqrt(-p);
    float v = acos(clamp(q / (p * z * 2.0), -1.0, 1.0)) / 3.0;
    float m = cos(v);
    float n = sin(v) * 1.732050808;
    vec3 t = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
    vec3 w = d + (c + b * t.x) * t.x;
    res = vec2(dot(w, w), t.x);
    w = d + (c + b * t.y) * t.y;
    float dis = dot(w, w);
    if (dis < res.x) res = vec2(dis, t.y);
  }
  res.x = sqrt(res.x);
  return res;
}

// Radius profile through three control radii (base, middle, tip): plump in the middle.
float tubeProfile(vec3 R, float t) {
  return t < 0.5 ? mix(R.x, R.y, smoothstep(0.0, 0.5, t)) : mix(R.y, R.z, smoothstep(0.5, 1.0, t));
}

// Bezier tube with a varying radius (tails). Returns (distance, t).
vec2 sdTube(vec3 p, vec3 A, vec3 B, vec3 C, vec3 R) {
  vec2 bt = sdBezier(p, A, B, C);
  return vec2(bt.x - max(tubeProfile(R, bt.y), 0.004), bt.y);
}

// Bezier tube with a thin vertical fin sheet (axolotl tail). Returns (distance, t, finAmount).
vec3 sdFinTube(vec3 p, vec3 A, vec3 B, vec3 C, vec3 R, vec3 F, float thick) {
  vec2 bt = sdBezier(p, A, B, C);
  float t = bt.y;
  vec3 P = mix(mix(A, B, t), mix(B, C, t), t);
  vec3 T = normalize(mix(B - A, C - B, t) + vec3(1e-5));
  vec3 L = normalize(cross(vec3(0.0, 1.0, 0.0), T) + vec3(1e-5));
  vec3 V = cross(T, L);
  vec3 v = p - P;
  float r = max(tubeProfile(R, t), 0.004);
  float tube = bt.x - r;
  float fh = tubeProfile(F, t);
  float vy = abs(dot(v, V));
  vec2 w = vec2(abs(dot(v, L)) - thick, vy - (r + fh));
  float fin = length(max(w, 0.0)) + min(max(w.x, w.y), 0.0) - 0.004;
  fin = max(fin, abs(dot(v, T)) - 0.004);
  float d = smin(tube, fin, 0.03);
  return vec3(d, t, smoothstep(r * 0.7, r + fh * 0.8, vy));
}

// Four-point sparkle star in 2D (signed).
float sdStar4(vec2 p, float r, float inner) {
  p = abs(p);
  if (p.y > p.x) p = p.yx;
  vec2 a = vec2(r, 0.0);
  vec2 b = vec2(inner * 0.70710678);
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  return (ba.x * pa.y - ba.y * pa.x) > 0.0 ? -d : d;
}

// Concave four-point "twinkle" (an astroid-like superellipse |x|^k + |y|^k = 1, k < 1).
// The raw field grows up to ~2.4x faster than true distance along the diagonals, so it is
// scaled down to stay a conservative bound for marching.
float sdTwinkle(vec2 p, float r, float k) {
  p = abs(p) / r + 1e-5;
  return (pow(pow(p.x, k) + pow(p.y, k), 1.0 / k) - 1.0) * r * 0.42;
}

// Pillowy 3D twinkle facing +Z: the flat shape grown by "thick" in every direction.
float sdTwinkle3(vec3 p, float r, float k, float thick) {
  float d2 = sdTwinkle(p.xy, r - thick * 0.5, k);
  float dist = d2 > 0.0 ? length(vec2(d2, p.z)) : abs(p.z);
  return dist - thick;
}

// Ring around the +Y axis: ring radius R, tube radius r (exact).
float sdTorusY(vec3 p, float R, float r) {
  return length(vec2(length(p.xz) - R, p.y)) - r;
}

// Cylinder along +Y (radius ra, half-height h) with edges rounded by rr (exact).
float sdRoundCylinderY(vec3 p, float ra, float h, float rr) {
  vec2 d = vec2(length(p.xz) - ra + rr, abs(p.y) - h + rr);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rr;
}

// ---- Materials ----------------------------------------------------------------------------
// kind: 0 fur/vinyl, 1 glossy, 2 eye, 3 emissive, 4 fin/translucent
struct Mat {
  vec3 alb;
  vec3 emit;
  float rough;
  float spec;
  float sss;
  float kind;
  float tag;
};

Mat matOf(vec3 alb, vec3 emit, float rough, float spec, float sss, float kind, float tag) {
  Mat m;
  m.alb = alb;
  m.emit = emit;
  m.rough = rough;
  m.spec = spec;
  m.sss = sss;
  m.kind = kind;
  m.tag = tag;
  return m;
}

// Smooth union that also blends the surface: seams between parts get a soft color transition.
void opMat(inout float d, inout Mat m, float di, Mat mi, float k) {
  if (k <= 0.0) {
    if (di < d) {
      d = di;
      m = mi;
    }
    return;
  }
  float h = clamp(0.5 + 0.5 * (d - di) / k, 0.0, 1.0);
  d = mix(d, di, h) - k * h * (1.0 - h);
  // Paint changes over a narrower band than the geometry blends: soft sculpted joins, crisp
  // painted color boundaries, like a vinyl toy.
  float hc = smoothstep(0.25, 0.75, h);
  m.alb = mix(m.alb, mi.alb, hc);
  m.emit = mix(m.emit, mi.emit, hc);
  m.rough = mix(m.rough, mi.rough, hc);
  m.spec = mix(m.spec, mi.spec, hc);
  m.sss = mix(m.sss, mi.sss, hc);
  if (h > 0.5) {
    m.kind = mi.kind;
    m.tag = mi.tag;
  }
}

void paintMix(inout Mat m, vec3 col, float a) {
  m.alb = mix(m.alb, col, a);
}

// ---- Tone mapping ------------------------------------------------------------------------
// Khronos PBR Neutral (The Khronos Group, Apache-2.0; ported to GLSL): keeps authored colors
// faithful up to ~0.8 and rolls highlights off gracefully, which suits a toy look better than
// filmic curves that shift hues.
vec3 toneNeutral(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float dd = 1.0 - startCompression;
  float newPeak = 1.0 - dd * dd / (peak + dd - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
`;
