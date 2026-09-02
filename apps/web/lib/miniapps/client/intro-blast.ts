/**
 * The wordmark blast: the transition out of the welcome stage and into the
 * intro film. A WebGL pass that accumulates the WZRD.tech wordmark over a
 * motion shutter while it stretches ~7x vertically and swings toward the
 * camera, so the speed itself tears the colour out of it into vertical
 * green/violet streaks.
 *
 * The colour is a byproduct of speed, not a tint: the same white silhouette
 * is accumulated into the three channels over three different shutter
 * lengths (green longest, red 0.62 of it, blue 0.34) and divided by the
 * sample weight, so the longest shutter spreads the same ink over the most
 * pixels and comes out faintest. Green reaches furthest and goes faint,
 * blue stays tight and bright, and every stroke ends with a blue-white core
 * and green escaping past both ends.
 *
 * The invariant that governs everything here: every term is exactly zero at
 * p = 0. At rest all three shutters collapse to the same zero-length window,
 * the channels land on identical pixels, and the wordmark resolves to plain
 * white and pixel-sharp — so the stage can hand over to this canvas without
 * a visible tint. Widening the gap between the three shutter lengths is the
 * only knob that adds colour.
 */

// The blast timeline: p ramps 0 → 1 over BLAST_S, then holds at the peak
// while the film cross-fades in over the streaks.
export const BLAST_S = 0.5;
export const PEAK_HOLD_S = 0.32;

const SY_PEAK = 7.0;
const SX_PEAK = 1.57;
/** Shutter window, in timeline seconds, sampled per frame. */
const SHUTTER_S = 0.04;
const SMEAR_GAIN = 1.6;
const SAMPLES = 28;
const SAMPLES_COARSE = 18;
/** Red / green / blue shutter lengths — the only source of colour. */
const SHUTTER_K: readonly [number, number, number] = [0.62, 1.0, 0.34];
const SHUTTER_SHAPE = 0.85;
const ROLL_U = 0.38;
const LAG_U = 0.55;
const THIN = 0.55;
const BLOOM_GAIN = 0.5;
const BLOOM_SPREAD = 3.2;
const BLOOM_BIAS = 3.5;
const SPEED_GAIN = 0.95;
const EXPOSURE = 1.75;
const FOCAL = 1.0;
const ORBIT_DEPTH = 0.42;
const ORBIT_RISE = 0.16;
const ORBIT_YAW = 0.55;
const ORBIT_YAW_LAG = 0.6;
const ORBIT_PITCH = 0.26;
const ORBIT_PITCH_LAG = -0.9;
const ORBIT_HANG_ARC = 0.9;
const PIVOT_FRAC = 0.07;
const CRT_GAIN = 1.0;
const CRT_PITCH = 5.0;
const CRT_MASK = 0.16;
const CRT_SCAN_PITCH = 3.0;
const CRT_SCAN = 0.12;
const CRT_BEAM = 0.7;
const CRT_HUM = 0.035;
const CRT_HUM_SPEED = 0.14;
const GLOW_BASE = 0.03;
const GLOW_SPEED = 0.028;
const GLOW_SPREAD = 2.6;
const GLOW_MIN = 0.34;
const GLOW_MAX_Y = 1.2;

/** Slow, then violent — the launch curve for p. */
const RISE: readonly number[] = [0.0, 0.08, 0.8, 1.0];
/** The arc the wordmark swings through as it leaves. */
const ORBIT_OUT: readonly number[] = [0.0, 0.05, 0.14, 0.38, 1.0];
const SWING_ARC = Math.PI - ORBIT_HANG_ARC;

/**
 * How much of the wordmark's own luminance survives into the white ink.
 * The silhouette alone reads as a blobby slab; mixing the artwork's
 * luminance back in keeps the blackletter strokes legible.
 */
const INK_DETAIL = 0.65;

function sampleTable(table: readonly number[], u: number): number {
  const n = table.length - 1;
  const x = Math.min(Math.max(u, 0), 1) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const from = table[i] ?? 0;
  const to = table[i + 1] ?? from;
  return from + (to - from) * (x - i);
}

/**
 * Zero at rest by construction: the `pin` term subtracts the turn the lag
 * would otherwise leave behind at psi = PI.
 */
function orbitTurn(psi: number, amp: number, lag: number): number {
  const pin = Math.sin(lag);
  return (amp * (Math.sin(psi - lag) - pin)) / (1 + Math.abs(pin));
}

const VERT = `
attribute vec2 aPos;
void main(){gl_Position=vec4(aPos,0.0,1.0);}
`;

const FRAG = (samples: number): string => `
precision highp float;

uniform sampler2D uText;
uniform vec2  uRes;
uniform vec2  uHalfPx;
uniform float uSx;
uniform vec3  uSyQ;
uniform float uCenterY;
uniform vec3  uK;
uniform float uShape;
uniform float uRoll;
uniform float uLag;
uniform float uThin;
uniform float uBloom;
uniform float uGain;
uniform float uExp;
uniform float uFocal;
uniform vec3  uPos;
uniform vec4  uRot;
uniform float uCrt;
uniform float uTime;
uniform vec4  uGlow;
uniform float uGlowAmp;

#define SAMPLES ${samples}
#define BLOOM_TAPS 4
#define BLOOM_SPREAD ${BLOOM_SPREAD.toFixed(3)}
#define BLOOM_BIAS ${BLOOM_BIAS.toFixed(3)}
#define TAU 6.2831853
#define CRT_PITCH ${CRT_PITCH.toFixed(3)}
#define CRT_MASK ${CRT_MASK.toFixed(4)}
#define CRT_SCAN_PITCH ${CRT_SCAN_PITCH.toFixed(3)}
#define CRT_SCAN ${CRT_SCAN.toFixed(4)}
#define CRT_BEAM ${CRT_BEAM.toFixed(4)}
#define CRT_HUM ${CRT_HUM.toFixed(4)}
#define CRT_HUM_SPEED ${CRT_HUM_SPEED.toFixed(4)}

vec2 atlasUv(float sy, vec2 W, out float inside){
  float sx = max(uSx, 1e-4);
  float sv = max(abs(sy), 1e-4);
  vec2 q = vec2(
    (W.x / sx + uHalfPx.x * 0.5) / uHalfPx.x,
    (W.y / sv + uHalfPx.y * 0.5) / uHalfPx.y
  );
  inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  return vec2(clamp(q.x, 0.0, 1.0), clamp(q.y, 0.0, 1.0));
}

// The ink is white, so each channel reads the *same* plate — only through
// its own shutter. The difference in shutter length is the sole source of
// colour in the piece.
float tap(float sy, vec2 W, float front, vec3 chan){
  float inside;
  vec2 t = atlasUv(sy, W, inside);
  inside *= front;
  float v = dot(texture2D(uText, t).rgb, chan) * inside;
  // Strokes thin as they stretch, so a smeared letter keeps its shape
  // instead of turning into a slab.
  return v * mix(1.0, v, uThin);
}

float tapBlur(float sy, vec2 W, float front, vec3 chan){
  float inside;
  vec2 t = atlasUv(sy, W, inside);
  inside *= front;
  return dot(texture2D(uText, t, BLOOM_BIAS).rgb, chan) * inside;
}

void main(){
  vec2 P = gl_FragCoord.xy;
  vec2 C = vec2(uRes.x * 0.5, uRes.y * uCenterY);
  vec2 sp = P - C;

  // Un-project the pixel onto the wordmark's plane: the plate yaws and
  // pitches as it swings toward the lens, so the smear is perspective
  // correct rather than a screen-space stretch.
  float sy = uRot.x, cy = uRot.y, sps = uRot.z, cps = uRot.w;
  float a1 = -(sp.x * sy + uFocal * cy);
  float b1 = sps * (sp.x * cy - uFocal * sy);
  float c1 = uFocal * uPos.x - sp.x * uPos.z;
  float a2 = -sp.y * sy;
  float b2 = sp.y * sps * cy - uFocal * cps;
  float c2 = uFocal * uPos.y - sp.y * uPos.z;
  float det = a1 * b2 - a2 * b1;
  float inv = 1.0 / (abs(det) < 1e-4 ? 1e-4 : det);
  float a = (c1 * b2 - c2 * b1) * inv;
  float b = (a1 * c2 - a2 * c1) * inv;
  float Zc = uPos.z - a * sy + b * sps * cy;
  vec2 W = vec2(a, b);
  float front = step(uFocal * 0.05, Zc);

  const vec3 CH_R = vec3(1.0, 0.0, 0.0);
  const vec3 CH_G = vec3(0.0, 1.0, 0.0);
  const vec3 CH_B = vec3(0.0, 0.0, 1.0);

  vec3 acc = vec3(0.0);
  bool still = abs(uSyQ.y) + abs(uSyQ.z) < 1e-5;

  // At rest the shutter has no length at all: one tap per channel at the
  // same instant, so the frame is the artwork itself — sharp, untinted,
  // with no ghost and no streak.
  if (still) {
    acc = vec3(
      tap(uSyQ.x, W, front, CH_R),
      tap(uSyQ.x, W, front, CH_G),
      tap(uSyQ.x, W, front, CH_B)
    );
  } else {
    float off = uLag * (W.x / uRes.x) - uRoll * (sp.y / uRes.y);

    float wsum = 0.0;
    for (int i = 0; i < SAMPLES; i++) {
      float u = float(i) / float(SAMPLES - 1) - 0.5;
      float w = 1.0 - uShape * abs(u) * 2.0;
      wsum += w;
      float us = u + off;
      vec3 uk = us * uK;
      vec3 syc = uSyQ.x + uSyQ.y * uk + uSyQ.z * uk * uk;
      acc.r += w * tap(syc.r, W, front, CH_R);
      acc.g += w * tap(syc.g, W, front, CH_G);
      acc.b += w * tap(syc.b, W, front, CH_B);
    }
    // Divide, never sum: a longer shutter spreads the same ink over more
    // pixels, which is what makes green faint and blue bright.
    acc /= max(wsum, 1e-4);

    vec3 halo = vec3(0.0);
    for (int j = 0; j < BLOOM_TAPS; j++) {
      float u = (float(j) / float(BLOOM_TAPS - 1) - 0.5) * BLOOM_SPREAD + off;
      vec3 uk = u * uK;
      vec3 syc = uSyQ.x + uSyQ.y * uk + uSyQ.z * uk * uk;
      halo.r += tapBlur(syc.r, W, front, CH_R);
      halo.g += tapBlur(syc.g, W, front, CH_G);
      halo.b += tapBlur(syc.b, W, front, CH_B);
    }
    acc += halo * (uBloom / float(BLOOM_TAPS));
    acc *= uGain;
    // Only the smeared frames get the highlight roll-off; the resting
    // frame has to match the static wordmark pixel for pixel.
    acc = (1.0 - exp(-acc * uExp)) / (1.0 - exp(-uExp));
  }

  vec2 gd = (P - uGlow.xy) / max(uGlow.zw, vec2(1.0));
  float ground = uGlowAmp * (1.0 - smoothstep(0.0, 1.0, length(gd)));
  acc += ground * (1.0 - acc);

  if (uCrt > 0.0) {
    float lum = max(max(acc.r, acc.g), acc.b);
    vec3 m = 0.5 + 0.5 * cos(TAU * (P.x / CRT_PITCH - vec3(0.0, 0.33333, 0.66667)));
    vec3 mask = mix(vec3(1.0), m * 2.0, CRT_MASK * uCrt);
    float s = 0.5 + 0.5 * cos(TAU * P.y / CRT_SCAN_PITCH);
    float scan = 1.0 - CRT_SCAN * uCrt * (1.0 - CRT_BEAM * lum) * (1.0 - s);
    float bar = 0.5 + 0.5 * cos(TAU * (P.y / uRes.y - uTime * CRT_HUM_SPEED));
    float hum = 1.0 + CRT_HUM * uCrt * (bar * 2.0 - 1.0);
    acc *= mask * scan * hum;
  }

  gl_FragColor = vec4(acc, 1.0);
}
`;

const UNIFORMS = [
  "uText", "uRes", "uHalfPx", "uSx", "uSyQ", "uCenterY", "uK", "uShape",
  "uRoll", "uLag", "uThin", "uBloom", "uGain", "uExp", "uFocal", "uPos",
  "uRot", "uCrt", "uTime", "uGlow", "uGlowAmp",
] as const;

type Uniforms = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

export interface WordmarkBlast {
  /** False when WebGL, the shader or the artwork is unavailable. */
  readonly ok: boolean;
  /** Renders the frame at `t` seconds into the blast (t <= 0 is at rest). */
  render(t: number): void;
  destroy(): void;
}

/**
 * Builds the blast over `host`, drawing `src` at `restHeight` CSS pixels
 * tall with its centre at `restCenter` (a fraction of the host's height) so
 * the canvas at rest sits exactly where the stage's own wordmark was.
 * Resolves once the artwork is in the atlas and the resting frame is on
 * screen; never rejects — check `ok` on the result.
 */
export async function createWordmarkBlast(
  host: HTMLElement,
  src: string,
  restHeight: number,
  restCenter: number
): Promise<WordmarkBlast> {
  const dead: WordmarkBlast = {
    ok: false,
    render: () => {},
    destroy: () => {},
  };

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });
  if (!gl) return dead;

  const image = new Image();
  image.src = src;
  try {
    await (image.decode
      ? image.decode()
      : new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("wordmark failed to load"));
        }));
  } catch {
    return dead;
  }
  if (!image.naturalWidth || !image.naturalHeight) return dead;

  const coarse =
    typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  const compile = (type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vert = compile(gl.VERTEX_SHADER, VERT);
  const frag = compile(gl.FRAGMENT_SHADER, FRAG(coarse ? SAMPLES_COARSE : SAMPLES));
  if (!vert || !frag) return dead;
  const prog = gl.createProgram();
  if (!prog) return dead;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return dead;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const uni = {} as Uniforms;
  for (const name of UNIFORMS) uni[name] = gl.getUniformLocation(prog, name);

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const rect = host.getBoundingClientRect();
  const width = Math.max(1, Math.round((rect.width || window.innerWidth) * dpr));
  const height = Math.max(1, Math.round((rect.height || window.innerHeight) * dpr));
  canvas.width = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 1);

  // The atlas has to hold the wordmark at its widest, which is the peak
  // horizontal stretch plus the perspective gain from swinging toward the
  // lens.
  const atlasW = width * (SX_PEAK / (1 - ORBIT_DEPTH)) * 1.3 > 1000 ? 2048 : 1024;
  const atlasH = atlasW / 4;
  const inkH = Math.round(atlasH * 0.64);

  const scratch = document.createElement("canvas");
  scratch.width = atlasW;
  scratch.height = atlasH;
  const ctx = scratch.getContext("2d");
  if (!ctx) return dead;

  const aspect = image.naturalWidth / image.naturalHeight;
  let drawH = inkH;
  let drawW = inkH * aspect;
  const maxW = atlasW * 0.92;
  if (drawW > maxW) {
    drawW = maxW;
    drawH = maxW / aspect;
  }

  ctx.clearRect(0, 0, atlasW, atlasH);
  ctx.drawImage(image, (atlasW - drawW) / 2, (atlasH - drawH) / 2, drawW, drawH);

  // Flatten the artwork to white ink on black: alpha gives the silhouette,
  // its own luminance keeps the blackletter strokes readable, and none of
  // its colour survives — the mark ignites to white as the canvas takes
  // over, and from there every hue on screen is made by the shutter.
  const ink = ctx.getImageData(0, 0, atlasW, atlasH);
  const px = ink.data;
  for (let i = 0; i < px.length; i += 4) {
    const alpha = (px[i + 3] ?? 0) / 255;
    const luma =
      (0.2126 * (px[i] ?? 0) +
        0.7152 * (px[i + 1] ?? 0) +
        0.0722 * (px[i + 2] ?? 0)) /
      255;
    const value = Math.round(255 * alpha * (1 - INK_DETAIL + INK_DETAIL * luma));
    px[i] = value;
    px[i + 1] = value;
    px[i + 2] = value;
    px[i + 3] = 255;
  }
  ctx.putImageData(ink, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);

  host.appendChild(canvas);

  // One atlas texel of ink maps to this many device pixels at rest, which
  // is what lines the canvas wordmark up with the stage's own <img>.
  const unit = (restHeight * dpr) / drawH;
  const inkHalfW = drawW * 0.5;

  const pAt = (t: number): number =>
    t <= 0 ? 0 : t >= BLAST_S ? 1 : sampleTable(RISE, t / BLAST_S);
  const psiAt = (t: number): number =>
    Math.PI + SWING_ARC * sampleTable(ORBIT_OUT, Math.min(Math.max(t / BLAST_S, 0), 1));

  const render = (t: number): void => {
    const p = pAt(t);
    const half = SHUTTER_S * 0.5;
    const syOf = (u: number): number => unit * (1 + pAt(u) * (SY_PEAK - 1));
    const syB = syOf(t - half);
    const syC = syOf(t);
    const syA = syOf(t + half);

    // The shutter window as a quadratic in shutter time: constant term at
    // the current scale, linear term the velocity, quadratic the curvature.
    // SMEAR_GAIN folds the stretch itself into the velocity so a fast
    // growth smears even when the centre barely moves.
    const qa = syC;
    const qc = 2 * (syA + syB - 2 * syC);
    const qbT = syA - syB;
    const extra = SMEAR_GAIN * p * syC;
    const mag = Math.sqrt(qbT * qbT + extra * extra);
    const qb = qbT < 0 ? -mag : mag;
    const sx = unit * (1 + p * (SX_PEAK - 1));
    const pivot = PIVOT_FRAC * p;

    const psi = psiAt(t);
    const focal = height * FOCAL;
    const z = focal * (1 - ORBIT_DEPTH * (1 + Math.cos(psi)) * 0.5);
    const y = focal * ORBIT_RISE * Math.sin(psi);
    const yaw = orbitTurn(psi, ORBIT_YAW, ORBIT_YAW_LAG);
    const pitch = orbitTurn(psi, ORBIT_PITCH, ORBIT_PITCH_LAG);

    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.uniform1i(uni.uText, 0);
    gl.uniform2f(uni.uRes, width, height);
    gl.uniform2f(uni.uHalfPx, atlasW, atlasH);
    gl.uniform1f(uni.uSx, sx);
    gl.uniform3f(uni.uSyQ, qa, qb, qc);
    gl.uniform1f(uni.uCenterY, restCenter + pivot);
    gl.uniform3f(uni.uK, SHUTTER_K[0], SHUTTER_K[1], SHUTTER_K[2]);
    gl.uniform1f(uni.uShape, SHUTTER_SHAPE);
    gl.uniform1f(uni.uRoll, ROLL_U);
    gl.uniform1f(uni.uLag, LAG_U);
    gl.uniform1f(uni.uThin, THIN * p);
    gl.uniform1f(uni.uBloom, BLOOM_GAIN * p);
    gl.uniform1f(uni.uGain, 1 + SPEED_GAIN * p);
    gl.uniform1f(uni.uExp, EXPOSURE);
    gl.uniform1f(uni.uFocal, focal);
    gl.uniform3f(uni.uPos, 0, y, z);
    gl.uniform4f(
      uni.uRot,
      Math.sin(yaw),
      Math.cos(yaw),
      Math.sin(pitch),
      Math.cos(pitch)
    );
    gl.uniform1f(uni.uCrt, CRT_GAIN * p);
    gl.uniform1f(uni.uTime, t);

    const persp = focal / z;
    const glowY = height * (restCenter + pivot) + (focal * y) / z;
    const inkW = inkHalfW * sx * persp;
    const inkPx = drawH * syC * persp;
    gl.uniform4f(
      uni.uGlow,
      width * 0.5,
      glowY,
      Math.max(inkW * GLOW_SPREAD, width * GLOW_MIN),
      Math.min(Math.max(inkPx * GLOW_SPREAD, height * GLOW_MIN), height * GLOW_MAX_Y)
    );
    gl.uniform1f(uni.uGlowAmp, GLOW_BASE + GLOW_SPEED * p);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  render(0);

  return {
    ok: true,
    render,
    destroy: () => {
      gl.deleteProgram(prog);
      gl.deleteBuffer(quad);
      gl.deleteTexture(tex);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    },
  };
}
