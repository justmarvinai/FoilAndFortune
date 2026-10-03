import type { CreatureArtRenderer, CreatureArtRequest } from '@/art/types';
import { mat3Uniform } from './math';
import { genomeToScene } from './sdf/genomeToScene';
import { propToScene, SCENERY_SCENE } from './sdf/propToScene';
import { sceneToGlsl } from './sdf/sceneToGlsl';
import type { CreatureScene } from './sdf/types';
import { biomeGlsl } from './shaders/biomes';
import { buildFragmentShader, MAX_PARTICLES, VERTEX_SHADER } from './shaders/frag';
import { buildStage, type Stage } from './stage';
import { CLAY_VERSION } from './version';

/**
 * Clay Critters (Art Style A, docs/04 §6.1): soft vinyl-toy creatures, ray-marched from signed
 * distance fields compiled out of the species genome.
 *
 * Pipeline: genome → CreatureScene (sdf/genomeToScene) → GLSL (sdf/sceneToGlsl) + biome
 * backdrop (shaders/biomes) → one fragment program; stage.ts turns the request into camera,
 * lights and particles (uniforms). Two passes: one ray per pixel into a float target, then
 * adaptive anti-aliasing on edges plus glows/particles/tone mapping into the canvas.
 *
 * One lazily created WebGL2 context (OffscreenCanvas when available) is shared by all renders.
 * Renders are queued because they share that context; programs are cached per
 * species + pose + biome. Output is a PNG Blob; the same request always yields the same image
 * on a given GPU/driver.
 */

export { CLAY_VERSION };

export type ClayQuality = 'draft' | 'final' | 'ultra';

/** The subject standing on the knoll: a creature, a tactic prop, or nothing (an Arena). */
export function subjectScene(request: CreatureArtRequest): CreatureScene {
  const pose = request.pose ?? 'idle';
  if (request.genome) return genomeToScene(request.genome, pose);
  if (request.prop) return propToScene(request.prop, pose);
  return SCENERY_SCENE;
}

export interface ClayRenderOptions {
  /** draft = 1 sample/pixel, final = adaptive 5×, ultra = adaptive 9× on edges. */
  quality?: ClayQuality;
  /** Development views: 1 normals, 2 occlusion, 3 key shadow, 4 albedo. */
  debugView?: 0 | 1 | 2 | 3 | 4;
}

export interface ClayRenderResult {
  blob: Blob;
  /** Wall-clock time including any shader compile. */
  ms: number;
  /** Time spent compiling programs during this render (0 when cached). */
  compileMs: number;
}

const SAMPLES: Record<ClayQuality, number> = { draft: 1, final: 5, ultra: 9 };
/** Rows per draw call: keeps each GPU submission short (watchdogs, UI responsiveness). */
const TILE_ROWS = 96;

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

interface ProgramInfo {
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
}

interface Device {
  canvas: AnyCanvas;
  gl: WebGL2RenderingContext;
  floatTarget: boolean;
  vao: WebGLVertexArrayObject;
  programs: Map<string, ProgramInfo>;
  target: { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number } | null;
  lost: boolean;
}

let device: Device | null = null;

function createCanvas(): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(16, 16);
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  return canvas;
}

function getDevice(): Device {
  if (device && !device.lost && !device.gl.isContextLost()) return device;
  const canvas = createCanvas();
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error('Clay renderer: WebGL2 is not available');
  const floatTarget = gl.getExtension('EXT_color_buffer_float') !== null;
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  if (!vao || !buffer) throw new Error('Clay renderer: failed to allocate GL resources');
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One oversized triangle covers the viewport (no diagonal seam, fewer vertices than a quad).
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const dev: Device = {
    canvas,
    gl,
    floatTarget,
    vao,
    programs: new Map(),
    target: null,
    lost: false,
  };
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    dev.lost = true;
  });
  device = dev;
  return dev;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Clay renderer: createShader failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    const lines = source.split('\n');
    const m = /ERROR: \d+:(\d+)/.exec(log);
    const at = m?.[1] ? Number(m[1]) : 0;
    const excerpt = lines
      .slice(Math.max(0, at - 4), at + 3)
      .map((l, i) => `${Math.max(1, at - 3) + i}: ${l}`)
      .join('\n');
    gl.deleteShader(shader);
    throw new Error(`Clay renderer: shader compile failed\n${log}\n${excerpt}`);
  }
  return shader;
}

function getProgram(
  dev: Device,
  key: string,
  fragSource: () => string,
  target: { fbo: WebGLFramebuffer },
): ProgramInfo {
  const cached = dev.programs.get(key);
  if (cached) return cached;
  const { gl } = dev;
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSource());
  const program = gl.createProgram();
  if (!program) throw new Error('Clay renderer: createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, 'a_pos');
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`Clay renderer: link failed\n${gl.getProgramInfoLog(program) ?? ''}`);
  }
  const info: ProgramInfo = { program, locations: new Map() };
  dev.programs.set(key, info);
  warmUp(dev, info, target.fbo);
  return info;
}

/**
 * Drivers compile lazily at the first draw, and some (SwiftShader) specialize per render-target
 * format. A 1-pixel draw into each target plus a blocking readback moves that cost into program
 * creation, so render timings report compile and render separately.
 */
function warmUp(dev: Device, info: ProgramInfo, targetFbo: WebGLFramebuffer) {
  const { gl } = dev;
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook.
  gl.useProgram(info.program);
  gl.bindVertexArray(dev.vao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.viewport(0, 0, 1, 1);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(0, 0, 1, 1);
  for (const fbo of [targetFbo, null]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  gl.disable(gl.SCISSOR_TEST);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
}

function ensureTarget(dev: Device, w: number, h: number) {
  const { gl } = dev;
  if (dev.target && dev.target.w === w && dev.target.h === h) return dev.target;
  if (dev.target) {
    gl.deleteTexture(dev.target.tex);
    gl.deleteFramebuffer(dev.target.fbo);
  }
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error('Clay renderer: failed to allocate render target');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (dev.floatTarget) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  dev.target = { tex, fbo, w, h };
  return dev.target;
}

/** Tiny typed uniform setter bound to one program. */
function uniformWriter(gl: WebGL2RenderingContext, info: ProgramInfo) {
  const loc = (name: string) => {
    if (!info.locations.has(name)) {
      info.locations.set(name, gl.getUniformLocation(info.program, name));
    }
    return info.locations.get(name) ?? null;
  };
  return {
    f1: (n: string, v: number) => gl.uniform1f(loc(n), v),
    i1: (n: string, v: number) => gl.uniform1i(loc(n), v),
    f2: (n: string, a: number, b: number) => gl.uniform2f(loc(n), a, b),
    v3: (n: string, v: readonly number[]) => gl.uniform3f(loc(n), v[0] ?? 0, v[1] ?? 0, v[2] ?? 0),
    v3a: (n: string, data: Float32Array) => gl.uniform3fv(loc(n), data),
    v4a: (n: string, data: Float32Array) => gl.uniform4fv(loc(n), data),
    m3: (n: string, data: Float32Array) => gl.uniformMatrix3fv(loc(n), false, data),
  };
}

function uploadStage(gl: WebGL2RenderingContext, info: ProgramInfo, s: Stage) {
  const u = uniformWriter(gl, info);
  u.f2('u_res', s.width, s.height);
  u.v3('u_camPos', s.camPos);
  u.v3('u_camRight', s.camRight);
  u.v3('u_camUp', s.camUp);
  u.v3('u_camFwd', s.camFwd);
  u.f1('u_tanHalf', s.tanHalf);
  u.f2('u_shift', s.shift[0], s.shift[1]);
  u.m3('u_toLocal', mat3Uniform(s.toLocal));
  u.v3('u_crPos', s.crPos);
  u.m3('u_headRot', mat3Uniform(s.headRotInv));
  u.v3('u_boxMin', s.boxMin);
  u.v3('u_boxMax', s.boxMax);
  u.v3('u_keyDir', s.keyDir);
  u.v3('u_keyCol', s.keyCol);
  u.v3('u_skyFill', s.skyFill);
  u.v3('u_groundFill', s.groundFill);
  u.v3('u_rimDir', s.rimDir);
  u.v3('u_rimCol', s.rimCol);
  u.v3('u_skySun', s.skySun);
  u.v3a('u_pal', new Float32Array(s.palette.flat()));
  u.v3('u_tod', s.tod);
  u.f1('u_seed', s.seed);
  u.f1('u_groundK', s.groundK);
  u.f1('u_waterY', s.waterY);
  u.f1('u_hazeDensity', s.hazeDensity);
  u.f1('u_transparent', s.transparent ? 1 : 0);
  u.f1('u_exposure', s.exposure);
  u.f1('u_vignette', s.vignette);
  u.f1('u_shadowRadius', s.shadowRadius);

  const emitPos = new Float32Array(12);
  const emitCol = new Float32Array(9);
  s.emitters.slice(0, 3).forEach((e, i) => {
    emitPos.set([e.pos[0], e.pos[1], e.pos[2], e.range], i * 4);
    emitCol.set(e.color, i * 3);
  });
  u.v4a('u_emitPos', emitPos);
  u.v3a('u_emitCol', emitCol);
  u.i1('u_emitCount', Math.min(3, s.emitters.length));

  const parts = new Float32Array(MAX_PARTICLES * 4);
  const partCol = new Float32Array(MAX_PARTICLES * 4);
  const partMisc = new Float32Array(MAX_PARTICLES * 4);
  const list = s.particles.slice(0, MAX_PARTICLES);
  list.forEach((p, i) => {
    parts.set([p.x, p.y, p.radius, p.rotation], i * 4);
    partCol.set([p.color[0], p.color[1], p.color[2], p.intensity], i * 4);
    partMisc.set([p.kind, p.front ? 1 : 0, p.blur, p.stretch], i * 4);
  });
  u.v4a('u_parts', parts);
  u.v4a('u_partCol', partCol);
  u.v4a('u_partMisc', partMisc);
  u.i1('u_partCount', list.length);

  const glow = new Float32Array(16);
  const glowCol = new Float32Array(12);
  s.glows.slice(0, 4).forEach((g, i) => {
    glow.set([g.x, g.y, g.radius, g.intensity], i * 4);
    glowCol.set(g.color, i * 3);
  });
  u.v4a('u_glow', glow);
  u.v3a('u_glowCol', glowCol);
  u.i1('u_glowCount', Math.min(4, s.glows.length));
  return u;
}

const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function drawTiled(gl: WebGL2RenderingContext, w: number, h: number) {
  gl.enable(gl.SCISSOR_TEST);
  for (let y = 0; y < h; y += TILE_ROWS) {
    gl.scissor(0, y, w, Math.min(TILE_ROWS, h - y));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.flush();
    await yieldToEventLoop();
  }
  gl.disable(gl.SCISSOR_TEST);
}

async function canvasToPng(canvas: AnyCanvas): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/png' });
  }
  const html = canvas as HTMLCanvasElement;
  return new Promise<Blob>((resolve, reject) => {
    html.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

async function renderNow(
  request: CreatureArtRequest,
  options: ClayRenderOptions,
): Promise<ClayRenderResult> {
  const start = performance.now();
  const scene = subjectScene(request);
  const stage = buildStage(request, scene);
  const dev = getDevice();
  const { gl } = dev;
  const key = `${scene.key}|${stage.biome}|${dev.floatTarget ? 'f' : 'b'}`;
  const { width: w, height: h } = stage;
  if (dev.canvas.width !== w) dev.canvas.width = w;
  if (dev.canvas.height !== h) dev.canvas.height = h;
  const target = ensureTarget(dev, w, h);
  const compileStart = performance.now();
  const hadProgram = dev.programs.has(key);
  const program = getProgram(
    dev,
    key,
    () =>
      buildFragmentShader(
        sceneToGlsl(scene),
        `${dev.floatTarget ? '' : '#define LDR_TARGET 1\n'}${biomeGlsl(stage.biome)}`,
      ),
    target,
  );
  const compileMs = hadProgram ? 0 : performance.now() - compileStart;

  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook.
  gl.useProgram(program.program);
  gl.bindVertexArray(dev.vao);
  const u = uploadStage(gl, program, stage);
  const spp = SAMPLES[options.quality ?? 'final'];
  u.i1('u_debug', options.debugView ?? 0);

  // Pass 0: one sample per pixel into the HDR target. The target texture must not stay bound
  // to a sampler unit while it's the render target (WebGL rejects the feedback loop).
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  gl.viewport(0, 0, w, h);
  u.i1('u_pass', 0);
  u.i1('u_spp', spp);
  await drawTiled(gl, w, h);

  // Pass 1: adaptive AA on edges + composite, straight into the canvas.
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, target.tex);
  u.i1('u_prev', 0);
  u.i1('u_pass', 1);
  await drawTiled(gl, w, h);

  const blob = await canvasToPng(dev.canvas);
  if (dev.lost || gl.isContextLost()) throw new Error('Clay renderer: WebGL context lost');
  return { blob, ms: performance.now() - start, compileMs };
}

/** GPU description for debug pages (spotting software rendering explains slow renders). */
export function clayDeviceInfo(): { renderer: string; floatTargets: boolean } {
  const dev = getDevice();
  const dbg = dev.gl.getExtension('WEBGL_debug_renderer_info');
  const name: unknown = dev.gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : dev.gl.RENDERER);
  return { renderer: typeof name === 'string' ? name : 'unknown', floatTargets: dev.floatTarget };
}

let queue: Promise<unknown> = Promise.resolve();

/** Renders one card illustration. Calls are serialized on the shared GL context. */
export function renderClayArt(
  request: CreatureArtRequest,
  options: ClayRenderOptions = {},
): Promise<ClayRenderResult> {
  const run = queue.then(() => renderNow(request, options));
  queue = run.catch(() => undefined);
  return run;
}

export const clayRenderer: CreatureArtRenderer = {
  id: 'clay',
  label: 'Clay Critters',
  version: CLAY_VERSION,
  render: async (request) => (await renderClayArt(request)).blob,
};
