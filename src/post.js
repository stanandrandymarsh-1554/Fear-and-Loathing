/* ============================================================
   POST — the head.

   scene ─► [feedback/trails] ─► [bright] ─► [blurH] ─► [blurV] ─┐
                    │                                            │
                    └────────────────────────────────────────────┴─► [final] ─► screen

   The final pass is where the chemistry lives: domain-warped UVs,
   radial chromatic aberration, kaleidoscopic folding, hue rotation,
   heartbeat zoom, tunnel vision, grain, and the occasional
   full-frame inversion when the adrenochrome peaks.
   ============================================================ */

import * as THREE from 'three';

const QUAD_VS = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/* ---------------------------------------------------- shared */
const GLSL_LIB = /* glsl */ `
float hash11(float p){ return fract(sin(p*127.1)*43758.5453123); }
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash21(i), b = hash21(i+vec2(1,0));
  float c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
vec3 hueRotate(vec3 col, float ang){
  const vec3 k = vec3(0.57735);
  float cs = cos(ang), sn = sin(ang);
  return col*cs + cross(k, col)*sn + k*dot(k, col)*(1.0-cs);
}
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

/* ================================================== feedback */
const FEEDBACK_FS = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tPrev;
uniform float uTime;
uniform float uDecay;    // how long the smear lives
uniform float uZoom;     // trail drift toward/away from centre
uniform float uSwirl;
uniform float uAspect;
${GLSL_LIB}

void main(){
  vec3 cur = texture2D(tScene, vUv).rgb;

  vec2 c = vUv - 0.5;
  c.x *= uAspect;
  float r = length(c);
  float a = atan(c.y, c.x) + uSwirl * (0.35 - r) ;
  c = vec2(cos(a), sin(a)) * r * (1.0 - uZoom);
  c.x /= uAspect;
  vec2 puv = c + 0.5;

  vec3 prev = texture2D(tPrev, puv).rgb * uDecay;

  // screen-blend the ghost so only light smears, never the dark
  vec3 col = max(cur, prev);
  gl_FragColor = vec4(col, 1.0);
}`;

/* ==================================================== bright */
const BRIGHT_FS = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform float uThreshold;
${GLSL_LIB}
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = luma(c);
  float k = max(0.0, l - uThreshold) / max(0.0001, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

/* ====================================================== blur */
const BLUR_FS = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 uDir;      // texel-space direction
void main(){
  vec3 s = vec3(0.0);
  s += texture2D(tDiffuse, vUv - uDir*4.0).rgb * 0.0162;
  s += texture2D(tDiffuse, vUv - uDir*3.0).rgb * 0.0540;
  s += texture2D(tDiffuse, vUv - uDir*2.0).rgb * 0.1216;
  s += texture2D(tDiffuse, vUv - uDir*1.0).rgb * 0.1945;
  s += texture2D(tDiffuse, vUv            ).rgb * 0.2270;
  s += texture2D(tDiffuse, vUv + uDir*1.0).rgb * 0.1945;
  s += texture2D(tDiffuse, vUv + uDir*2.0).rgb * 0.1216;
  s += texture2D(tDiffuse, vUv + uDir*3.0).rgb * 0.0540;
  s += texture2D(tDiffuse, vUv + uDir*4.0).rgb * 0.0162;
  gl_FragColor = vec4(s, 1.0);
}`;

/* ===================================================== final */
const FINAL_FS = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D tDiffuse;
uniform sampler2D tBloom;

uniform float uTime;
uniform float uAspect;

uniform float uDim;
uniform float uRush;
uniform float uPsych;
uniform float uBlur;
uniform float uMonster;
uniform float uFear;
uniform float uLoath;

uniform float uPulse;     // heartbeat spike 0..1
uniform float uFlash;     // white blast
uniform float uBlackout;  // 1 = normal, 0 = gone
uniform float uBloom;

${GLSL_LIB}

void main(){
  float t = uTime;

  /* Fear idles around 0.06-0.16 just from standing in a crowded room,
     and that was enough to put grain and a vignette on the screen with
     nothing in the bloodstream. Everything fear drives reads off this
     deadbanded copy instead, so a calm sober frame is untouched. */
  float fearFx  = max(0.0, (uFear  - 0.22) * 1.282);
  // Loathing idles around 0.04 all on its own, which cleared the 0.01
  // gates below and left a random channel-tear flickering on a sober
  // screen. It gets the same deadband fear does. (No backticks in here:
  // this is a JS template literal, and one would end the shader string.)
  float loathFx = max(0.0, (uLoath - 0.12) * 1.136);

  vec2 c = vUv - 0.5;
  c.x *= uAspect;
  float r0 = length(c);

  /* ---- kaleidoscope: mescaline folds the periphery ---- */
  if (uPsych > 0.02){
    float ang = atan(c.y, c.x);
    float rad = length(c);
    float seg = mix(6.28318, 6.28318/5.0, smoothstep(0.3, 1.0, uPsych));
    float ka = mod(ang + t*0.08, seg);
    ka = abs(ka - seg*0.5);
    vec2 kc = vec2(cos(ka), sin(ka)) * rad;
    // periphery only: the middle of the field has to stay walkable
    float w = smoothstep(0.40, 1.0, uPsych) * smoothstep(0.30, 0.72, rad) * 0.34;
    c = mix(c, kc, w);
  }

  /* ---- ether is not a light show. it takes the body, not the eyes.
         all it does here is let the head hang a little.        ---- */
  c += vec2(0.0, 0.020 * uDim);

  /* ---- mescaline: slow crawling domain warp ---- */
  if (uPsych > 0.01){
    float n1 = vnoise(c*3.0 + t*0.21);
    float n2 = vnoise(c*3.0 - t*0.17 + 41.3);
    c += (vec2(n1, n2) - 0.5) * 0.055 * uPsych;
  }

  /* ---- booze: a slow unfixable sway ---- */
  c += vec2(sin(t*0.90), sin(t*0.62)*0.6) * 0.028 * uBlur;

  /* ---- fear: micro-jitter, the eye won't hold still ---- */
  c += (vec2(hash11(floor(t*34.0)*1.7), hash11(floor(t*34.0)*3.9)) - 0.5)
       * 0.016 * fearFx * fearFx;

  /* ---- surfaces breathing: that is the HALLUCINOGEN, plus the
         invented one. A stimulant does not melt a wall.        ---- */
  float breath = sin(t*1.15)*0.5 + 0.5;
  float scale = 1.0
    + (breath - 0.5) * (0.14*uPsych + 0.16*uMonster)
    // The heart punch is a SYMPTOM. It used to carry a flat 0.030, so a
    // sober man with nothing in him watched the room breathe in time with
    // his pulse. You only feel your own heart when something put it there.
    - uPulse * (0.075 * uRush + 0.045 * fearFx);
  c *= scale;

  /* ---- barrel / pincushion ---- */
  float k = 0.16*uRush + 0.14*uMonster - 0.14*fearFx + 0.10*uBlur;
  c *= 1.0 + k * r0 * r0;

  vec2 uv = vec2(c.x / uAspect, c.y) + 0.5;
  float r = length(c);

  /* ---- radial chromatic aberration ---- */
  vec2 dir = (r > 0.0001) ? c / r : vec2(0.0);
  dir.x /= uAspect;
  // no baseline term: a sober eye does not split colour
  float ca = 0.013 * uPsych
    + 0.011 * uBlur
    + 0.007 * loathFx
    + 0.030 * uPulse * uRush;
  ca *= (0.35 + r*1.6);

  vec3 col;
  col.r = texture2D(tDiffuse, uv + dir*ca).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - dir*ca).b;

  /* ---- booze: double vision + softening ---- */
  if (uBlur > 0.02){
    vec2 off = vec2(sin(t*0.8), cos(t*0.6)) * 0.014 * uBlur;
    vec3 ghost = texture2D(tDiffuse, uv + off).rgb;
    col = mix(col, max(col, ghost), 0.55 * uBlur);

    float b = 0.0035 * uBlur;
    vec3 blur = vec3(0.0);
    blur += texture2D(tDiffuse, uv + vec2( b, 0.0)).rgb;
    blur += texture2D(tDiffuse, uv + vec2(-b, 0.0)).rgb;
    blur += texture2D(tDiffuse, uv + vec2(0.0,  b)).rgb;
    blur += texture2D(tDiffuse, uv + vec2(0.0, -b)).rgb;
    col = mix(col, blur*0.25, 0.5*uBlur);
  }

  /* ---- mescaline: a third eye, echoing behind everything ---- */
  if (uPsych > 0.05){
    vec2 e = (uv - 0.5) * (1.0 - 0.13*uPsych) + 0.5;
    vec3 echo = texture2D(tDiffuse, e).rgb;
    echo = hueRotate(echo, 2.0 + t*0.4);
    col = mix(col, max(col, echo*0.70), 0.16*uPsych);
  }

  /* ---- bloom ---- */
  col += texture2D(tBloom, uv).rgb * uBloom;

  /* =================== colour ======================= */

  /* Mescaline does not paint the room one colour. Rotating every pixel by
     the same angle is just a tint, and at full dose it collapsed the whole
     frame onto a single hue -- the floor went flat cyan. What the drug
     actually does is pull colours APART: surfaces separate from each other
     and go iridescent. So the rotation depends on how bright the surface
     already is and how far it sits from the centre of the field, and the
     carpet and the neon drift away from one another instead of marching
     together. */
  if (uPsych > 0.01){
    // the linear t term used to park the entire room on one hue at a time,
    // so it is an oscillation now. The variety comes from the spatial term:
    // slow noise over the frame means patches of carpet go their own way.
    float lum = luma(col);
    float swim = vnoise(uv*4.0 + vec2(t*0.09, -t*0.07));
    float ang = uPsych * (lum*2.6 + swim*3.4 + r*1.2 + sin(t*0.19)*0.7);
    col = hueRotate(col, ang);
  }

  /* the invented drug, and only the invented drug, turns the world
     inside out. Cocaine does not do this to anybody. */
  float invGate = step(0.72, vnoise(vec2(t*0.55, 0.0))) * uMonster;
  col = mix(col, 1.0 - col, invGate * 0.85);

  /* the stimulant bite: everything a little too sharp, a little too
     present. Pivot low — this room is mostly dark, and contrast
     around mid-grey would just crush it into tar. */
  if (uRush > 0.01){
    col = (col - 0.24) * (1.0 + 0.26*uRush) + 0.24;
    col = max(col, 0.0);
  }

  /* loathing: everything sours — green-yellow bile, crushed blacks */
  if (loathFx > 0.001){
    vec3 sick = vec3(col.r*1.10, col.g*1.02, col.b*0.52);
    sick = pow(max(sick, 0.0), vec3(1.0 + 0.55*loathFx));
    col = mix(col, sick, loathFx);
    // posterise
    float steps = mix(255.0, 7.0, loathFx*0.8);
    col = floor(col*steps + 0.5)/steps;
  }

  /* ether: the lights go a long way away and the colour drains out.
     no patterns, no swimming — just a man losing the room. */
  float le = luma(col);
  col = mix(col, vec3(le), uDim*0.62);
  col *= 1.0 - uDim*0.44;

  /* fear bleaches the world */
  float l = luma(col);
  col = mix(col, vec3(l), fearFx*0.62);
  col *= 1.0 - fearFx*0.22;

  /* saturation lift so neon still bites */
  l = luma(col);
  col = mix(vec3(l), col, 1.0 + 0.55*uPsych + 0.16*uRush);

  /* ---- tunnel vision. Fear closes it, the depressants push the
         room away, the stimulants narrow the focus. At baseline
         there is NO vignette at all.                          ---- */
  float close = max(max(fearFx, uDim * 0.8), uRush * 0.45);
  if (close > 0.01){
    float inner = mix(1.05, 0.16, fearFx) - 0.30*uDim - 0.12*uRush;
    float outer = inner + mix(0.55, 0.16, fearFx);
    float vig = 1.0 - smoothstep(inner, outer, r);
    vig = mix(vig, vig*vig, fearFx);
    col *= mix(1.0, vig, close);
  }

  /* red rim when the heart kicks */
  float rim = smoothstep(0.30, 0.80, r);
  col += vec3(0.55, 0.03, 0.02) * rim * uPulse * (0.9*uRush + 0.6*fearFx);

  /* ---- grain: film stock is not a drug, so none of it when clean ---- */
  float grainAmt = 0.16*loathFx + 0.13*fearFx + 0.05*uPsych;
  if (grainAmt > 0.001){
    float g = hash21(gl_FragCoord.xy + fract(t)*713.0);
    col += (g - 0.5) * grainAmt;
  }

  /* ---- scanline / interlace tear: only when it has soured ---- */
  if (loathFx > 0.001){
    float scan = sin(vUv.y * 900.0) * 0.5 + 0.5;
    col *= 1.0 - scan * (0.08*loathFx);
    float tear = step(0.985, hash11(floor(t*11.0)));
    col = mix(col, col.gbr, tear * loathFx * 0.6);
  }

  /* ---- flash & blackout ---- */
  col += vec3(uFlash);
  col *= uBlackout;

  /* linear -> display */
  col = max(col, 0.0);
  col = pow(col, vec3(0.4545));

  gl_FragColor = vec4(col, 1.0);
}`;

/* ============================================================ */

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(
      new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quad = new THREE.Mesh(geo, null);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthBuffer: false,
    };

    this.rtScene = new THREE.WebGLRenderTarget(1, 1, { ...opts, depthBuffer: true });
    this.rtPrev = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtCur = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtBright = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtBlurA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtBlurB = new THREE.WebGLRenderTarget(1, 1, opts);

    this.mFeedback = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: FEEDBACK_FS, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, tPrev: { value: null },
        uTime: { value: 0 }, uDecay: { value: 0 },
        uZoom: { value: 0 }, uSwirl: { value: 0 }, uAspect: { value: 1 },
      },
    });

    this.mBright = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: BRIGHT_FS, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.62 } },
    });

    this.mBlur = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
    });

    this.mFinal = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: FINAL_FS, depthTest: false, depthWrite: false,
      uniforms: {
        tDiffuse: { value: null }, tBloom: { value: null },
        uTime: { value: 0 }, uAspect: { value: 1 },
        uDim: { value: 0 }, uRush: { value: 0 },
        uPsych: { value: 0 }, uBlur: { value: 0 }, uMonster: { value: 0 },
        uFear: { value: 0 }, uLoath: { value: 0 },
        uPulse: { value: 0 }, uFlash: { value: 0 },
        uBlackout: { value: 1 }, uBloom: { value: 0.9 },
      },
    });
  }

  setSize(w, h, dpr) {
    const W = Math.floor(w * dpr), H = Math.floor(h * dpr);
    this.rtScene.setSize(W, H);
    this.rtPrev.setSize(W, H);
    this.rtCur.setSize(W, H);
    const bw = Math.max(1, W >> 2), bh = Math.max(1, H >> 2);
    this.rtBright.setSize(bw, bh);
    this.rtBlurA.setSize(bw, bh);
    this.rtBlurB.setSize(bw, bh);
    this.bw = bw; this.bh = bh;
    this.mFeedback.uniforms.uAspect.value = w / h;
    this.mFinal.uniforms.uAspect.value = w / h;
  }

  /** forget the trails: the next frame starts from nothing behind it */
  clearHistory() {
    this.renderer.setRenderTarget(this.rtPrev);
    this.renderer.clear();
    this.renderer.setRenderTarget(null);
  }

  /* Where a point of the 3D frame ends up on screen once the final pass has
     moved it. That pass does not move pixels, it chooses where each one
     reads FROM, so this runs the same sums forwards and walks back to the
     point that reads from here. Only the steady parts are mirrored: the
     head hanging, the sway, the breathing and the bulge. The noise crawl,
     the jitter and the kaleidoscope fold are left out; they wander round
     the true spot and never carry it off. x and y are 0..1 from top left. */
  toScreen(x, y) {
    const u = this.mFinal.uniforms, aspect = u.uAspect.value, t = u.uTime.value;
    const fearFx = Math.max(0, (u.uFear.value - 0.22) * 1.282);
    const blur = u.uBlur.value, rush = u.uRush.value, monster = u.uMonster.value;
    const scale = 1 + (Math.sin(t * 1.15) * 0.5) * (0.14 * u.uPsych.value + 0.16 * monster)
      - u.uPulse.value * (0.075 * rush + 0.045 * fearFx);
    const k = 0.16 * rush + 0.14 * monster - 0.14 * fearFx + 0.10 * blur;
    const dx = Math.sin(t * 0.90) * 0.028 * blur;
    const dy = Math.sin(t * 0.62) * 0.6 * 0.028 * blur + 0.020 * u.uDim.value;
    // screen point (y down) -> the shader's centred, aspect-true space (y up)
    const px = (x - 0.5) * aspect, py = 0.5 - y;
    let qx = px, qy = py;
    // Newton's method: the sums are smooth and near enough the identity
    // that a few steps land within a hundredth of a pixel
    for (let i = 0; i < 6; i++) {
      const r2 = qx * qx + qy * qy, b = scale * (1 + k * r2);
      const ax = qx + dx, ay = qy + dy;
      const ex = ax * b - px, ey = ay * b - py;
      // the Jacobian of (q + d) * scale * (1 + k|q|^2)
      const g = 2 * scale * k;
      const j11 = b + g * ax * qx, j12 = g * ax * qy;
      const j21 = g * ay * qx, j22 = b + g * ay * qy;
      const det = j11 * j22 - j12 * j21;
      if (Math.abs(det) < 1e-9) break;
      qx -= (j22 * ex - j12 * ey) / det;
      qy -= (j11 * ey - j21 * ex) / det;
    }
    return [qx / aspect + 0.5, 0.5 - qy];
  }

  _blit(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(s, time, dt = 1 / 60) {
    const r = this.renderer;

    // 1. world
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, this.camera);

    // 2. trails
    const fb = this.mFeedback.uniforms;
    fb.tScene.value = this.rtScene.texture;
    fb.tPrev.value = this.rtPrev.texture;
    fb.uTime.value = time;
    // trails belong to the psychedelic, not to the solvent.
    // the decay is quoted per 60Hz frame and then re-based on the real
    // frame time, so a 144Hz monitor gets the same length of smear.
    // no baseline smear: a clean eye leaves no trails
    const decay60 = Math.min(0.72,
      0.52 * s.psych + 0.16 * s.monster + 0.08 * s.blur);
    fb.uDecay.value = Math.pow(decay60, Math.max(0.15, dt * 60));
    fb.uZoom.value = 0.008 * s.psych + 0.005 * s.monster;
    fb.uSwirl.value = 0.18 * s.psych * Math.sin(time * 0.21);
    this._blit(this.mFeedback, this.rtCur);

    // 3. bloom
    // BLOOM IS PUPIL, NOT MOOD. It used to ride wreck, so any drug at all
    // dropped the threshold to 0.25 and added the result back at 2.1x --
    // which meant the carpet itself passed the bright test and the floor
    // became a flat glowing slab under every substance in the case.
    // What actually widens an iris is mydriasis: the hallucinogens and the
    // stimulants do it, the depressants do the opposite. And a dilated eye
    // haloes LIGHTS. It does not set the floor on fire, so the threshold
    // stays high enough that only real light sources pass it.
    const mydriasis = Math.min(1, 0.80 * s.psych + 0.70 * s.rush + 0.55 * s.monster);
    this.mBright.uniforms.tDiffuse.value = this.rtCur.texture;
    this.mBright.uniforms.uThreshold.value = 0.64 - 0.12 * mydriasis;
    this._blit(this.mBright, this.rtBright);

    this.mBlur.uniforms.tDiffuse.value = this.rtBright.texture;
    this.mBlur.uniforms.uDir.value.set(1 / this.bw, 0);
    this._blit(this.mBlur, this.rtBlurA);

    this.mBlur.uniforms.tDiffuse.value = this.rtBlurA.texture;
    this.mBlur.uniforms.uDir.value.set(0, 1 / this.bh);
    this._blit(this.mBlur, this.rtBlurB);

    // 4. the head
    const u = this.mFinal.uniforms;
    u.tDiffuse.value = this.rtCur.texture;
    u.tBloom.value = this.rtBlurB.texture;
    u.uTime.value = time;
    u.uDim.value = s.dim;
    u.uRush.value = s.rush;
    u.uMonster.value = s.monster;
    u.uPsych.value = s.psych;
    u.uBlur.value = s.blur;
    u.uFear.value = s.fear;
    u.uLoath.value = s.loathing;
    u.uPulse.value = s.pulse;
    u.uFlash.value = s.flash;
    u.uBlackout.value = s.blackout;
    u.uBloom.value = 0.55 + 0.80 * mydriasis - 0.22 * s.dim;
    this._blit(this.mFinal, null);

    // swap
    const t = this.rtPrev; this.rtPrev = this.rtCur; this.rtCur = t;
  }
}
