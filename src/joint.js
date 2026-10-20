/* ============================================================
   A JOINT, smoked a hit at a time.

   Grass used to be a key press and a dose. Now it is rolled from the
   strain you choose, lit, and smoked the way people actually do it:

     HOLD 1      draw on it. The ember brightens and crackles, and how
                 long you draw is how much smoke you take: in the
                 controlled studies, puff volume is what drives the high.
     let go      you are holding it in. Tap 1 to breathe out -- or hold
                 it until you cannot. Holding it in adds next to nothing
                 to the high (the same studies: a little more THC in the
                 blood, no difference to how high people felt), but it
                 does make you cough.
     X           pinch it out and keep the roach for later.

   A joint is about a dozen good hits, burns down a little on its own,
   and goes out if you leave it too long. Every hit is absorbed at once
   (src/game.js smokeHit), so it comes on while you are still smoking;
   coughing throws some of the hit away, and harsh weed makes you cough
   more. Tolerance builds with each joint.

   What you see: the joint in your hand, lower right, which comes up to
   your mouth when you draw on it, the ember, a thread of smoke off it,
   and a cloud when you breathe out. All of it in world space, so you
   walk through your own smoke.
   ============================================================ */
import * as THREE from 'three';
import { STRAINS } from './game.js';

const DRAW_RATE = 0.42;        // puff size per second of drawing: a full one is ~2.4 s
const BURN_DRAW = 0.048;       // joint burnt per second of drawing
const BURN_IDLE = 0.0022;      // and per second just sitting there lit
const GOES_OUT = 50;           // seconds without a hit before it goes out
const MAX_HOLD = 16;           // after this you breathe out whether you like it or not
const SMOKE_N = 56;

function softTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  r.addColorStop(0, 'rgba(255,255,255,0.9)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Joint {
  constructor(scene, camera, game, audio) {
    this.scene = scene; this.camera = camera; this.game = game; this.audio = audio;
    this.active = false;       // a joint is in your hand
    this.lit = false;
    this.strain = null;
    this.left = 1;             // how much of it is still there
    this.drawing = false;
    this.puff = 0;             // smoke in your lungs right now, 0..1
    this.burnt = 0;            // joint burnt during this draw
    this.holding = false;
    this.holdT = 0;
    this.idleT = 0;
    this.lightT = 0;           // the lighter, while it is lighting
    this.lift = 0;             // 0 at your side, 1 at your mouth
    this.coughT = 0;
    this.hits = 0;
    this.toldHold = false;
    this.onCough = null;       // main.js: the camera jolts

    // ---- the joint: paper, a twist at the end, the ember
    const g = this.group = new THREE.Group();
    // paper, flat and warm: under the casino's coloured lights a lit material
    // read lavender, which is no colour a joint has ever been
    const paper = new THREE.MeshBasicMaterial({ color: 0xb9ae9a });
    this.body = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0034, 1, 10, 1, true), paper);
    this.body.rotation.x = Math.PI / 2;
    g.add(this.body);
    const crutch = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.012, 8), new THREE.MeshBasicMaterial({ color: 0x9a8a68 }));
    crutch.rotation.x = Math.PI / 2;
    crutch.position.z = 0.006;
    g.add(crutch);
    this.emberMat = new THREE.MeshBasicMaterial({ color: 0xff5a10 });
    this.ember = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 10, 8), this.emberMat);
    g.add(this.ember);
    this.ash = new THREE.Mesh(new THREE.CylinderGeometry(0.0043, 0.0042, 0.006, 10),
      new THREE.MeshBasicMaterial({ color: 0x5a5652 }));
    this.ash.rotation.x = Math.PI / 2;
    g.add(this.ash);
    // the lighter's flame
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: 0xffb040,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flame.scale.set(0.02, 0.035, 1);
    this.flame.visible = false;
    g.add(this.flame);
    g.visible = false;
    scene.add(g);

    // ---- smoke: one pool, world space
    const tex = softTex();
    this.smoke = [];
    for (let i = 0; i < SMOKE_N; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, color: 0xb8b8b4, transparent: true, opacity: 0, depthWrite: false });
      const sp = new THREE.Sprite(m);
      sp.visible = false;
      sp.renderOrder = 5;
      scene.add(sp);
      this.smoke.push({ sp, life: 0, max: 1, v: new THREE.Vector3(), s0: 0.1, s1: 1, a: 0.3 });
    }
    this._next = 0;
    this._wisp = 0;
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._fwd = new THREE.Vector3();
    this._up = new THREE.Vector3();
  }

  get strainDef() { return STRAINS[this.strain]; }

  /** a joint in your hand, rolled from the choice made in the picker */
  start(choice) {
    const got = this.game.lightJoint(choice);
    if (!got) return false;
    this.active = true;
    this.strain = got.strain;
    this.left = got.left;
    this.lit = false;
    this.light();
    this.hits = 0;
    return true;
  }

  light() {
    if (!this.active || this.lit || this.lightT > 0) return;
    this.lightT = 1.3;
    this.audio.lighter?.();
  }

  /** hold 1 */
  beginDraw() {
    if (!this.active || this.game.dlg || this.coughT > 0) return;
    if (this.holding) { this.exhale(); return; }
    if (!this.lit) { this.light(); return; }
    this.drawing = true;
    this.puff = 0; this.burnt = 0;
    this.audio.inhale?.(true);
  }

  /** let go of 1 */
  endDraw() {
    if (!this.drawing) return;
    this.drawing = false;
    this.audio.inhale?.(false);
    if (this.puff < 0.06) { this.puff = 0; return; }
    this.holding = true;
    this.holdT = 0;
  }

  /** tap 1 while holding it in (or it happens to you) */
  exhale(forced = false) {
    if (!this.holding) return;
    this.holding = false;
    const S = this.strainDef, g = this.game;
    // most of what you take in is absorbed whether or not you hold it;
    // holding it is mostly a way to cough
    const coughP = Math.min(0.92, 0.06 + S.harsh * 0.42 * this.puff * this.puff
      + Math.max(0, this.holdT - 4) * 0.035 * S.harsh + (forced ? 0.5 : 0) - g.grassTol * 0.5);
    const cough = Math.random() < coughP;
    const amount = this.burnt * 0.85 * (cough ? 0.75 : 1) * (1 + Math.min(this.holdT, 10) * 0.004);
    g.smokeHit(this.strain, amount);
    this.hits++;
    this._exhaleCloud(this.puff * (cough ? 1.4 : 1));
    if (cough) this.cough();
    else this.audio.exhale?.();
    if (!this.toldHold && this.holdT > 7) {
      this.toldHold = true;
      g.say('You held it until your ears rang. It does less than you would think, holding it in.', null, 4.5);
    }
    this.puff = 0;
    if (this.left <= 0.02) this._finish();
  }

  cough() {
    this.coughs = (this.coughs || 0) + 1;
    this.coughT = 1.6 + Math.random();
    this.audio.cough?.();
    this.onCough?.();
    const g = this.game;
    // in a room full of people, a coughing fit is a performance
    g.fear = Math.min(1, g.fear + 0.04 * g.crowdNear);
    if (this.hits <= 1) g.say(this.strain === 'mexican'
      ? 'It tastes like a burning hay barn, and your lungs say so, loudly.'
      : 'The cough comes up from somewhere around your knees.', null, 3.5);
  }

  /** X: pinch it and put it in your pocket */
  putOut() {
    if (!this.active) return;
    if (this.holding) this.exhale();
    this.drawing = false;
    this.game.pocketRoach(this.strain, this.left);
    this.game.say(this.left > 0.08 ? 'You pinch it out and put the roach away for later.'
      : 'You drop the last of it and step on it.', null, 3);
    this._end();
  }

  /** anything that takes your hands away -- the car, a blackout, an act change */
  stow() {
    if (!this.active) return;
    if (this.holding) this.exhale();
    this.game.pocketRoach(this.strain, this.left);
    this._end();
  }

  _finish() {
    this.game.say(this.strain === 'thai'
      ? 'You smoke it down to the silk thread. That was a great deal of Thai stick.'
      : 'Down to the roach. You put it out on the heel of your shoe.', null, 3.5);
    this._end();
  }

  _end() {
    this.active = false; this.lit = false; this.drawing = false; this.holding = false;
    this.lightT = 0; this.coughT = 0;
    this.group.visible = false;
    this.audio.inhale?.(false);
  }

  /* --------------------------------------------------------- per frame */
  update(dt, t) {
    const cam = this.camera;
    cam.getWorldDirection(this._fwd);
    this._up.set(0, 1, 0).applyQuaternion(cam.quaternion);

    if (this.active) {
      if (this.lightT > 0) {
        this.lightT -= dt;
        if (this.lightT <= 0) { this.lit = true; this.idleT = 0; }
      }
      if (this.coughT > 0) {
        this.coughT -= dt;
        if (this.drawing) this.endDraw();
      }
      if (this.lit) {
        // it burns whether you smoke it or not
        this.left -= BURN_IDLE * dt;
        this.idleT += dt;
        if (this.drawing) {
          const b = Math.min(this.left, BURN_DRAW * dt);
          this.left -= b; this.burnt += b;
          this.puff = Math.min(1, this.puff + DRAW_RATE * dt);
          this.idleT = 0;
          // lungs are full: you stop drawing
          if (this.puff >= 1 || this.left <= 0) this.endDraw();
        }
        if (this.idleT > GOES_OUT && !this.holding) {
          this.lit = false;
          this.game.say('It has gone out. Hold 1 to light it again.', null, 3);
        }
      }
      if (this.holding) {
        this.holdT += dt;
        if (this.holdT > MAX_HOLD) this.exhale(true);
      }
      if (this.left <= 0 && !this.holding && !this.drawing) this._finish();
    }

    // ---- the hand: at your side, or at your mouth while you draw
    const wantLift = this.drawing ? 1 : 0;
    this.lift += (wantLift - this.lift) * Math.min(1, dt * 7);
    if (this.active) {
      const g = this.group;
      g.visible = true;
      const L = this.lift;
      // camera-local: lower right, pointing forward and in; to the mouth, low and close
      // (just right of centre and low: the case fills the lower right of the screen)
      const lx = 0.045 * (1 - L) + 0.012 * L, ly = -0.1 * (1 - L) - 0.07 * L, lz = -0.3 * (1 - L) - 0.14 * L;
      this._v.set(lx, ly + Math.sin(t * 1.3) * 0.003, lz).applyQuaternion(cam.quaternion).add(cam.position);
      g.position.copy(this._v);
      g.quaternion.copy(cam.quaternion);
      // pointing away from you and a little to the left, ember out
      this._q.setFromEuler(new THREE.Euler(0.35 - L * 0.7, 0.95 * (1 - L) + 0.2 * L, 0.2));
      g.quaternion.multiply(this._q);
      // the length: 7cm when it is new, down to the crutch
      const len = 0.012 + 0.06 * Math.max(0, this.left);
      this.body.scale.set(1, len, 1);
      this.body.position.z = -len / 2;
      this.ember.position.z = -len - 0.001;
      this.ash.position.z = -len + 0.002;
      this.ash.visible = this.lit && this.hits > 0;
      const glow = !this.lit ? 0 : this.drawing ? 0.85 + Math.random() * 0.3 : 0.32 + Math.sin(t * 2.1) * 0.05;
      this.emberMat.color.setRGB(0.25 + glow * 1.0, 0.06 + glow * 0.35, 0.02);
      this.ember.scale.setScalar(this.lit ? 1 : 0.85);
      if (!this.lit) this.emberMat.color.setRGB(0.12, 0.1, 0.09);
      this.flame.visible = this.lightT > 0;
      if (this.flame.visible) {
        this.flame.position.set(0, -0.008, -len - 0.012);
        const f = 0.8 + Math.random() * 0.4;
        this.flame.scale.set(0.016 * f, 0.03 * f, 1);
      }
      // a thread of smoke off the end while it is lit
      if (this.lit) {
        this._wisp -= dt;
        if (this._wisp <= 0) {
          this._wisp = this.drawing ? 0.5 : 0.14;
          this.ember.getWorldPosition(this._v);
          this._emit(this._v, 0, 0.22, 0, 0.012, 0.18, 0.16, 2.6);
        }
      }
    }

    // ---- the smoke
    for (const p of this.smoke) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = 1 - p.life / p.max;
      p.v.multiplyScalar(Math.pow(0.35, dt));
      p.v.y += 0.05 * dt;
      p.sp.position.addScaledVector(p.v, dt);
      const sc = p.s0 + (p.s1 - p.s0) * Math.sqrt(k);
      p.sp.scale.set(sc, sc, 1);
      p.sp.material.opacity = p.a * Math.min(1, k * 8) * (1 - k);
      if (p.life <= 0) p.sp.visible = false;
    }
  }

  _emit(pos, vx, vy, vz, s0, s1, a, life) {
    const p = this.smoke[this._next];
    this._next = (this._next + 1) % SMOKE_N;
    p.sp.position.copy(pos);
    p.v.set(vx + (Math.random() - 0.5) * 0.04, vy, vz + (Math.random() - 0.5) * 0.04);
    p.s0 = s0; p.s1 = s1; p.a = a; p.life = p.max = life;
    p.sp.material.rotation = Math.random() * 6.28;
    p.sp.visible = true;
  }

  /** breathe out: a cloud in front of your face, drifting off */
  _exhaleCloud(size) {
    const cam = this.camera;
    const n = 6 + Math.round(size * 10);
    for (let i = 0; i < n; i++) {
      const d = 0.24 + Math.random() * 0.14;
      this._v.copy(cam.position).addScaledVector(this._fwd, d).addScaledVector(this._up, -0.07);
      const sp = 0.5 + size * 0.7;
      this._emit(this._v,
        this._fwd.x * sp + (Math.random() - 0.5) * 0.25,
        this._fwd.y * sp + 0.05 + Math.random() * 0.08,
        this._fwd.z * sp + (Math.random() - 0.5) * 0.25,
        0.05, 0.35 + size * 0.7 * Math.random(), 0.05 + size * 0.06, 2.5 + Math.random() * 2);
    }
  }
}
