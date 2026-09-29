import { GLSL_COMMON } from './common';
import { GLSL_PAINT } from './paint';

/**
 * Fragment shader assembly. One program renders both passes:
 *  - pass 0: one ray per pixel → HDR color + coverage into a float target;
 *  - pass 1: detects edges in pass 0's image and re-renders only those pixels with extra
 *    rotated-grid samples (adaptive AA), then composites glows and particles, applies the
 *    vignette and tone mapping, and writes display-ready sRGB.
 * That keeps quality close to 5× supersampling at roughly 1.4× the cost of a single sample.
 */

export const MAX_PARTICLES = 32;

export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const UNIFORMS = /* glsl */ `
uniform vec2 u_res;
uniform int u_pass;
uniform int u_spp;
uniform sampler2D u_prev;
uniform vec3 u_camPos;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform vec3 u_camFwd;
uniform float u_tanHalf;
uniform vec2 u_shift;
uniform mat3 u_toLocal;
uniform vec3 u_crPos;
uniform mat3 u_headRot;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
uniform vec3 u_keyDir;
uniform vec3 u_keyCol;
uniform vec3 u_skyFill;
uniform vec3 u_groundFill;
uniform vec3 u_rimDir;
uniform vec3 u_rimCol;
uniform vec3 u_skySun;
uniform vec3 u_pal[14];
uniform vec3 u_tod;
uniform float u_seed;
uniform float u_groundK;
uniform float u_waterY;
uniform float u_hazeDensity;
uniform float u_transparent;
uniform float u_exposure;
uniform float u_vignette;
uniform float u_shadowRadius;
uniform vec4 u_emitPos[3];
uniform vec3 u_emitCol[3];
uniform int u_emitCount;
uniform vec4 u_parts[${MAX_PARTICLES}];
uniform vec4 u_partCol[${MAX_PARTICLES}];
uniform vec4 u_partMisc[${MAX_PARTICLES}];
uniform int u_partCount;
uniform vec4 u_glow[4];
uniform vec3 u_glowCol[4];
uniform int u_glowCount;
uniform int u_debug;
`;

const RENDER = /* glsl */ `
// ---- Creature queries ---------------------------------------------------------------------------
// mapCreature() is large and GPU compilers inline it at every call site, so all distance queries
// of a sample (march, normal, shadow, occlusion, thickness) run through ONE call site inside a
// small state machine in renderSample(). That keeps compile times low on software GL and on
// slow D3D compilers, and SIMD lanes stay busy even when neighbors are in different phases.
vec2 boxHit(vec3 ro, vec3 rd) {
  vec3 inv = 1.0 / (rd + vec3(1e-7));
  vec3 t0 = (u_boxMin - ro) * inv;
  vec3 t1 = (u_boxMax - ro) * inv;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  return vec2(max(max(max(tmin.x, tmin.y), tmin.z), 0.0), min(min(tmax.x, tmax.y), tmax.z));
}

// ---- Terrain ----------------------------------------------------------------------------------
// The creature stands on a gentle knoll y = -k (x² + z²): cheap to intersect analytically, and
// the falling-away horizon silhouettes the creature against the sky.
float intersectKnoll(vec3 ro, vec3 rd, float k) {
  float a = k * (rd.x * rd.x + rd.z * rd.z);
  float b = 2.0 * k * (ro.x * rd.x + ro.z * rd.z) + rd.y;
  float c = k * (ro.x * ro.x + ro.z * ro.z) + ro.y;
  if (a < 1e-7) return abs(b) > 1e-7 && -c / b > 0.0 ? -c / b : -1.0;
  float disc = b * b - 4.0 * a * c;
  if (disc < 0.0) return -1.0;
  float s = sqrt(disc);
  float t0 = (-b - s) / (2.0 * a);
  float t1 = (-b + s) / (2.0 * a);
  if (t0 > 0.0) return t0;
  if (t1 > 0.0) return t1;
  return -1.0;
}

vec3 knollNormal(vec3 p, float k) {
  return normalize(vec3(2.0 * k * p.x, 1.0, 2.0 * k * p.z));
}

// ---- Creature shading -------------------------------------------------------------------------
vec3 envLight(vec3 dir) {
  return mix(u_groundFill, u_skyFill, smoothstep(-0.6, 0.8, dir.y));
}

vec3 saturateColor(vec3 c, float s) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return max(vec3(l) + (c - vec3(l)) * s, 0.0);
}

vec3 shadeCreature(vec3 p, vec3 n, vec3 rd, Mat m, float sh, float ao, float thin) {
  // Big-softbox toy photography: self-shadows never go fully black.
  sh = mix(0.22, 1.0, sh);
  // Glowing parts (flames, sparks) are mostly self-lit: scene light would wash them pastel.
  float lit = m.kind > 2.5 && m.kind < 3.5 ? 0.25 : 1.0;
  vec3 L = u_keyDir;
  float ndl = dot(n, L);
  float nv = sat(dot(n, -rd));

  // Wrapped diffuse for a soft clay falloff, plus a warm subsurface band on the terminator.
  float wrap = 0.15 + 0.3 * m.sss;
  float diff = sat((ndl + wrap) / (1.0 + wrap));
  vec3 col = m.alb * u_keyCol * diff * sh;
  float band = sat(1.0 - abs(ndl - 0.05) * 3.0) * m.sss;
  vec3 sssTint = saturateColor(m.alb, 1.35) * vec3(1.0, 0.78, 0.7);
  col += sssTint * u_keyCol * band * 0.22 * mix(0.4, 1.0, sh);

  // Sky + bounce fill. Shadows use a richer version of the albedo so they stay colorful
  // (vinyl toys under soft light never go gray).
  vec3 shadeAlb = saturateColor(m.alb, 1.2);
  col += shadeAlb * envLight(n) * ao;

  // Rim light on the silhouette, mostly on the side facing away from the key.
  float fres = pow(1.0 - nv, 3.0);
  float rimAmt = fres * sat(dot(n, u_rimDir) * 0.6 + 0.5) * (1.0 - diff * sh * 0.6);
  col += u_rimCol * rimAmt * (0.3 + 0.7 * ao) * mix(vec3(1.0), m.alb, 0.45);

  // Thin parts (ears, fins, gills) glow when back-lit.
  float back = pow(sat(dot(rd, L)), 2.0) + pow(sat(dot(rd, u_rimDir)), 2.0) * 0.6;
  col += saturateColor(m.alb, 1.3) * (u_keyCol + u_rimCol) * thin * back * m.sss * 0.4;

  // Specular: satin vinyl lobe; eyes/noses get a sharp clear-coat and sky reflection.
  vec3 H = normalize(L - rd);
  float shin = mix(1200.0, 16.0, m.rough);
  float specN = (shin + 8.0) / 25.1327;
  float f0 = m.kind > 0.5 && m.kind < 2.5 ? 0.06 : 0.03;
  float F = f0 + (1.0 - f0) * pow(1.0 - sat(dot(H, -rd)), 5.0);
  col += u_keyCol * pow(sat(dot(n, H)), shin) * specN * F * m.spec * sh * sat(ndl * 4.0);
  vec3 R = reflect(rd, n);
  float envF = f0 + (1.0 - f0) * pow(1.0 - nv, 5.0);
  col += envLight(R) * envF * m.spec * ao * mix(1.6, 0.12, m.rough);
  vec3 Hr = normalize(u_rimDir - rd);
  col += u_rimCol * pow(sat(dot(n, Hr)), shin * 0.5) * specN * 0.3 * F * m.spec;

  // Glowing emitters (spark tip, flames) light their surroundings.
  for (int i = 0; i < 3; i++) {
    if (i >= u_emitCount) break;
    vec3 lv = u_emitPos[i].xyz - p;
    float dist = length(lv);
    float att = 1.0 / (1.0 + pow(dist / u_emitPos[i].w, 2.0) * 6.0);
    col += m.alb * u_emitCol[i] * att * (sat(dot(n, lv / dist)) * 0.8 + 0.2);
  }

  col *= lit;
  // Emission: slightly brighter where the surface faces us, for a volumetric feel.
  col += m.emit * (0.8 + 0.45 * pow(nv, 1.5));
  return col;
}

// ---- Background -------------------------------------------------------------------------------
vec3 hazeColor() {
  return mix(HAZE, SKY_HOR, 0.35);
}

vec3 shadeKnoll(vec3 p, vec3 n, vec3 rd, float t, float sh, float occ) {
  Ground g = biomeGround(p, n, rd, t);
  float ndl = sat(dot(g.n, u_keyDir));
  vec3 col = g.alb * (u_keyCol * ndl * sh + u_skyFill * 0.9 * occ + u_groundFill * 0.15);
  col *= mix(0.5, 1.0, occ);
  vec3 H = normalize(u_keyDir - rd);
  col += u_keyCol * pow(sat(dot(g.n, H)), 30.0) * g.spec * sh;
  // Grazing sheen, like light skimming over grass or sand.
  col += u_rimCol * g.alb * pow(1.0 - sat(dot(g.n, -rd)), 4.0) * 0.25;
  for (int i = 0; i < 3; i++) {
    if (i >= u_emitCount) break;
    vec3 lv = u_emitPos[i].xyz - p;
    float dist = length(lv);
    col += g.alb * u_emitCol[i] * sat(dot(g.n, lv / dist)) /
      (1.0 + pow(dist / u_emitPos[i].w, 2.0) * 5.0);
  }
  col += g.emit;
  return mix(col, hazeColor(), 1.0 - exp(-t * u_hazeDensity));
}

vec3 skyAndFringe(vec3 ro, vec3 rd) {
  vec3 col = biomeSky(rd);
#ifdef FRINGE
  // Grass along the knoll's silhouette: how far above the knoll does this ray pass?
  float a = u_groundK * (rd.x * rd.x + rd.z * rd.z);
  float b = 2.0 * u_groundK * (ro.x * rd.x + ro.z * rd.z) + rd.y;
  float c = u_groundK * (ro.x * ro.x + ro.z * ro.z) + ro.y;
  if (a > 1e-7) {
    float tm = -b / (2.0 * a);
    float hgt = c - b * b / (4.0 * a);
    if (tm > 0.0 && hgt < FRINGE_H) {
      vec3 pm = ro + rd * tm;
      float fm;
      vec3 fc = biomeFringe(atan(pm.x, pm.z) * 2.0 + pm.x * 0.3, hgt, fm);
      vec3 lit = fc * (u_keyCol * 0.5 + u_skyFill * 0.9) + u_rimCol * fc * 0.3;
      lit = mix(lit, hazeColor(), 1.0 - exp(-tm * u_hazeDensity));
      col = mix(col, lit, fm);
    }
  }
#endif
  return col;
}

// ---- HDR target encoding (8-bit fallback when float targets are unavailable) ------------------
vec4 encodeTarget(vec4 c) {
#ifdef LDR_TARGET
  return vec4(sqrt(c.rgb / (1.0 + c.rgb)), c.a);
#else
  return c;
#endif
}
vec4 decodeTarget(vec4 e) {
#ifdef LDR_TARGET
  vec3 x = e.rgb * e.rgb;
  return vec4(x / max(1.0 - x, 1e-4), e.a);
#else
  return e;
#endif
}

// ---- One camera sample --------------------------------------------------------------------------
#define Q_MARCH 0
#define Q_NORMAL 1
#define Q_SHADOW 2
#define Q_OCCL 3
#define Q_THIN 4
#define Q_BG 5
#define Q_SHADOW_SETUP 6
#define Q_OCCL_SETUP 7
#define Q_DONE 8

vec3 tetraTap(int i) {
  return 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
}

// Returns linear HDR color (premultiplied in transparent mode) and creature coverage/alpha.
vec4 renderSample(vec2 frag) {
  vec2 uv = frag / u_res * 2.0 - 1.0;
  float aspect = u_res.x / u_res.y;
  vec3 rd = normalize(
    u_camFwd + (uv.x * aspect * u_tanHalf + u_shift.x) * u_camRight +
    (uv.y * u_tanHalf + u_shift.y) * u_camUp
  );
  vec3 ro = u_camPos;
  float pixAngle = 2.0 * u_tanHalf / u_res.y;

  // Background candidate (analytic): 0 sky, 1 knoll, 2 water, 3 shadow catcher (transparent).
  int bg = 0;
  float tbg = -1.0;
  if (u_transparent > 0.5) {
    if (rd.y < 0.0) {
      tbg = -ro.y / rd.y;
      bg = 3;
    }
  } else {
    float tk = intersectKnoll(ro, rd, u_groundK);
    float tw = rd.y < 0.0 ? (u_waterY - ro.y) / rd.y : -1.0;
    if (tw > 0.0 && (tk < 0.0 || tw < tk)) {
      bg = 2;
      tbg = tw;
    } else if (tk > 0.0) {
      bg = 1;
      tbg = tk;
    }
  }

  vec2 box = boxHit(ro, rd);
  int phase = box.x < box.y ? Q_MARCH : Q_BG;
  float t = box.x;
  int steps = 0;
  bool hitC = false;
  bool nearC = false;
  vec3 p = vec3(0.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 nsum = vec3(0.0);
  float eps = 0.001;
  int k = 0;
  vec3 so = vec3(0.0);
  float st = 0.0;
  float stMax = 0.0;
  float sk = 6.0;
  float sres = 1.0;
  vec3 odir = vec3(0.0, 1.0, 0.0);
  float oh0 = 0.012;
  float odh = 0.03;
  float oacc = 0.0;
  float osca = 1.0;
  float sh = 1.0;
  float occ = 1.0;
  float thin = 0.0;

  for (int it = 0; it < 200; it++) {
    // Phase transitions (no distance evaluations).
    if (phase == Q_BG) {
      if (bg > 0) {
        p = ro + rd * tbg;
        n = bg == 1 ? knollNormal(p, u_groundK) : vec3(0.0, 1.0, 0.0);
        nearC = length(p.xz - u_crPos.xz) < u_shadowRadius;
      }
      phase = nearC ? Q_SHADOW_SETUP : Q_DONE;
    }
    if (phase == Q_SHADOW_SETUP) {
      phase = Q_OCCL_SETUP;
      if (!hitC || dot(n, u_keyDir) > -0.35) {
        so = p + n * (hitC ? 0.004 : 0.002);
        sk = hitC ? 6.0 : 7.0;
        vec2 sb = boxHit(so, u_keyDir);
        if (sb.x < sb.y) {
          st = max(sb.x, 0.01);
          stMax = sb.y;
          sres = 1.0;
          phase = Q_SHADOW;
        }
      } else {
        sh = 0.0;
      }
    }
    if (phase == Q_OCCL_SETUP) {
      phase = Q_DONE;
      if (hitC || bg != 2) {
        odir = hitC ? n : vec3(0.0, 1.0, 0.0);
        oh0 = hitC ? 0.012 : 0.03;
        odh = hitC ? 0.03 : 0.065;
        oacc = 0.0;
        osca = 1.0;
        k = 0;
        phase = Q_OCCL;
      }
    }
    if (phase == Q_DONE) break;

    // One distance evaluation.
    vec3 sp;
    if (phase == Q_MARCH) sp = ro + rd * t;
    else if (phase == Q_NORMAL) sp = p + tetraTap(k) * eps;
    else if (phase == Q_SHADOW) sp = so + u_keyDir * st;
    else if (phase == Q_OCCL) sp = p + odir * (oh0 + odh * float(k));
    else sp = p - n * 0.035;
    // Loose group bounds are fine for marching, but shadows/AO read absolute distances.
    g_boundMargin = phase <= Q_NORMAL ? 0.06 : 0.6;
    float d = mapCreature(sp);

    // Consume it.
    if (phase == Q_MARCH) {
      steps++;
      if (d < pixAngle * t * 0.3) {
        hitC = true;
        p = ro + rd * t;
        eps = max(0.0006, pixAngle * t * 0.5);
        nsum = vec3(0.0);
        k = 0;
        phase = Q_NORMAL;
      } else {
        // Under-relaxed steps: smooth unions and bent parts slightly overestimate distance.
        t += d * 0.82;
        if (t > box.y || steps >= 140) phase = Q_BG;
      }
    } else if (phase == Q_NORMAL) {
      nsum += tetraTap(k) * d;
      k++;
      if (k == 4) {
        n = normalize(nsum);
        phase = Q_SHADOW_SETUP;
      }
    } else if (phase == Q_SHADOW) {
      sres = min(sres, sk * d / st);
      st += clamp(d, 0.012, 0.12);
      if (sres < 0.003 || st > stMax) {
        sres = sat(sres);
        sh = sres * sres * (3.0 - 2.0 * sres);
        phase = Q_OCCL_SETUP;
      }
    } else if (phase == Q_OCCL) {
      float h = oh0 + odh * float(k);
      oacc += max(h - d, 0.0) / h * osca;
      osca *= 0.8;
      k++;
      if (k == 5) {
        occ = sat(1.0 - 0.3 * oacc);
        phase = hitC ? Q_THIN : Q_DONE;
      }
    } else {
      thin = sat(1.0 + d / 0.035);
      phase = Q_DONE;
    }
  }

  if (hitC) {
    Mat m = creatureMaterial(p, n);
    if (u_debug == 1) return vec4(pow(n * 0.5 + 0.5, vec3(2.2)), 1.0);
    if (u_debug == 2) return vec4(vec3(occ), 1.0);
    if (u_debug == 3) return vec4(vec3(sh), 1.0);
    if (u_debug == 4) return vec4(m.alb, 1.0);
    return vec4(shadeCreature(p, n, rd, m, sh, occ, thin), 1.0);
  }
  if (u_transparent > 0.5) {
    if (bg != 3 || !nearC) return vec4(0.0);
    // Shadow catcher: a soft contact shadow the card compositor can lay over any backdrop.
    float a = sat((1.0 - mix(1.0, sh, 0.5) * mix(1.0, occ, 0.8)) * 0.75);
    return vec4(vec3(0.03, 0.02, 0.06) * a, a);
  }
  vec3 col;
  if (bg == 1) {
    col = shadeKnoll(p, n, rd, tbg, sh, occ);
  }
#ifdef HAS_WATER
  else if (bg == 2) {
    float depth = u_waterY + u_groundK * dot(p.xz, p.xz);
    col = biomeWater(p, rd, tbg, depth, sh);
    col = mix(col, hazeColor(), 1.0 - exp(-tbg * u_hazeDensity * 0.6));
  }
#endif
  else {
    col = skyAndFringe(ro, rd);
  }
  return vec4(col, 0.0);
}

// Rotated-grid / stratified offsets for the adaptive AA pass.
const vec2 AA_OFFS[8] = vec2[8](
  vec2(0.125, 0.375), vec2(-0.375, 0.125), vec2(-0.125, -0.375), vec2(0.375, -0.125),
  vec2(0.4375, 0.3125), vec2(-0.3125, 0.4375), vec2(-0.4375, -0.3125), vec2(0.3125, -0.4375)
);

float displayLuma(vec3 c) {
  vec3 t = toneNeutral(c * u_exposure);
  return dot(sqrt(max(t, 0.0)), vec3(0.3, 0.55, 0.15));
}

// ---- Particles & glows (composited in screen space) ----------------------------------------
void drawParticles(inout vec3 col, inout float alpha, float cover, vec2 frag) {
  for (int i = 0; i < ${MAX_PARTICLES}; i++) {
    if (i >= u_partCount) break;
    vec4 P = u_parts[i];
    vec4 C = u_partCol[i];
    vec4 M = u_partMisc[i];
    vec2 d = frag - P.xy;
    float r = max(P.z, 0.75);
    if (dot(d, d) > r * r * 25.0) continue;
    float vis = M.y > 0.5 ? 1.0 : 1.0 - cover;
    if (vis <= 0.0) continue;
    float cs = cos(P.w);
    float sn = sin(P.w);
    vec2 q = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
    float blur = M.z;
    float light = 0.0;
    float kind = M.x;
    if (kind < 0.5) {
      // Spark: hot core, four thin rays, soft halo.
      float core = exp(-dot(q, q) / (r * r * 0.12));
      float rays = exp(-abs(q.x) / (r * 0.08)) * exp(-abs(q.y) / (r * 1.1));
      rays += exp(-abs(q.y) / (r * 0.08)) * exp(-abs(q.x) / (r * 1.1));
      float halo = exp(-length(q) / (r * 0.9)) * 0.35;
      light = core + rays * (1.0 - blur * 0.7) * 0.8 + halo;
    } else if (kind < 1.5) {
      // Ember: glowing mote stretched along its drift.
      vec2 e = q / vec2(1.0, M.w);
      light = exp(-dot(e, e) / (r * r * mix(0.25, 0.9, blur))) + exp(-length(e) / (r * 1.1)) * 0.3;
    } else if (kind < 2.5) {
      // Bubble: bright thin rim, faint body and a highlight.
      float l = length(q);
      float w = r * mix(0.1, 0.35, blur);
      float rim = exp(-pow((l - r) / w, 2.0));
      float body = smoothstep(r, r * 0.6, l) * 0.12;
      vec2 hq = q - vec2(-0.35, 0.38) * r;
      float hl = exp(-dot(hq, hq) / (r * r * 0.04));
      light = rim * 0.7 + body + hl * 0.9;
    } else {
      float l = length(q);
      light = smoothstep(r, r * mix(0.7, 0.1, blur), l) * 0.6 + exp(-l / r) * 0.2;
    }
    vec3 add = C.rgb * C.a * light * vis;
    col += add;
    alpha = max(alpha, sat(dot(add, vec3(0.33))));
  }
}

void drawGlows(inout vec3 col, inout float alpha, vec2 frag) {
  for (int i = 0; i < 4; i++) {
    if (i >= u_glowCount) break;
    vec4 G = u_glow[i];
    float dist = length(frag - G.xy) / max(G.z, 1.0);
    float g = exp(-dist * dist * 2.2) * 0.55 + exp(-dist * 1.8) * 0.22;
    vec3 add = u_glowCol[i] * G.w * g;
    col += add;
    alpha = max(alpha, sat(dot(add, vec3(0.33))));
  }
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  ivec2 ip = ivec2(frag);
  vec4 c0 = vec4(0.0);
  int extra = 1;
  if (u_pass == 1) {
    c0 = decodeTarget(texelFetch(u_prev, ip, 0));
    extra = 0;
    if (u_spp > 1) {
      // Edge detection on pass 0: contrast in display space or a coverage change.
      ivec2 maxP = ivec2(u_res) - 1;
      float l0 = displayLuma(c0.rgb);
      float edge = 0.0;
      for (int k = 0; k < 4; k++) {
        ivec2 o = k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1);
        vec4 cn = decodeTarget(texelFetch(u_prev, clamp(ip + o, ivec2(0), maxP), 0));
        edge = max(edge, abs(displayLuma(cn.rgb) - l0) + abs(cn.a - c0.a));
      }
      if (edge > 0.045) extra = u_spp - 1;
    }
  }
  // Single renderSample() call site for both passes (see the note at the top).
  vec4 sum = c0;
  for (int s = 0; s < 8; s++) {
    if (s >= extra) break;
    sum += renderSample(frag + (u_pass == 0 ? vec2(0.0) : AA_OFFS[s]));
  }
  if (u_pass == 0) {
    outColor = encodeTarget(sum);
    return;
  }
  vec4 acc = sum / float(1 + extra);

  vec3 col = acc.rgb;
  float alpha = u_transparent > 0.5 ? acc.a : 1.0;
  drawGlows(col, alpha, frag);
  drawParticles(col, alpha, acc.a, frag);

  col *= u_exposure;
  if (u_transparent > 0.5) {
    // Un-premultiply for the straight-alpha canvas.
    col = alpha > 1e-4 ? col / alpha : vec3(0.0);
  }
  vec2 v = (frag / u_res - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  float vig = smoothstep(1.05, 0.3, length(v) / max(1.0, u_res.x / u_res.y) * 1.3);
  col *= mix(1.0, vig, u_vignette);

  vec3 outc = linearToSrgb(toneNeutral(col));
  // Print-like grade: a little extra saturation and a gentle S-curve so the art keeps its punch
  // under card foils and at thumbnail size.
  float gl = dot(outc, vec3(0.2126, 0.7152, 0.0722));
  outc = clamp(mix(vec3(gl), outc, 1.1), 0.0, 1.0);
  outc = mix(outc, outc * outc * (3.0 - 2.0 * outc), 0.22);
  // Dither hides banding in the soft sky gradients.
  outc += (hash12(frag + u_seed * 91.0) - 0.5) / 255.0;
  outColor = vec4(outc, alpha);
}
`;

export function buildFragmentShader(creatureGlsl: string, biomeGlsl: string): string {
  return `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;
${UNIFORMS}
${GLSL_COMMON}
${GLSL_PAINT}
${creatureGlsl}
${biomeGlsl}
${RENDER}
`;
}
