/* ============================================================
   THE PEOPLE — and the things the people turn into.

   Every NPC carries two heads. One is the head they have.
   The other is the head you see when the chemistry decides
   to show you what they really are. The crossfade is driven
   by perception, not by truth.
   ============================================================ */

import * as THREE from 'three';


function makeHumanHead(skin) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 18, 14),
    new THREE.MeshStandardMaterial({
      color: skin, roughness: 0.72, metalness: 0.05,
      emissive: skin, emissiveIntensity: 0.22,
    })
  );
  head.scale.set(1, 1.12, 0.92);
  g.add(head);

  const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  [-0.1, 0.1].forEach((x) => {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    e.position.set(x, 0.05, 0.235);
    g.add(e);
  });
  return g;
}

function makeLizardHead() {
  const g = new THREE.Group();
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0x2f7a2a, roughness: 0.42, metalness: 0.25,
      emissive: 0x0d2a0b, emissiveIntensity: 1.0,
    })
  );
  skull.scale.set(0.9, 0.85, 1.05);
  g.add(skull);

  const snout = new THREE.Mesh(
    new THREE.ConeGeometry(0.17, 0.62, 10),
    new THREE.MeshStandardMaterial({
      color: 0x3c8f31, roughness: 0.4, metalness: 0.2,
      emissive: 0x0d2a0b, emissiveIntensity: 1.0,
    })
  );
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.03, 0.34);
  g.add(snout);

  const jaw = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.07, 0.48),
    new THREE.MeshStandardMaterial({ color: 0x1f5a1c, roughness: 0.5 })
  );
  jaw.position.set(0, -0.14, 0.3);
  g.add(jaw);
  g.userData.jaw = jaw;

  // teeth
  const toothGeo = new THREE.ConeGeometry(0.022, 0.09, 4);
  const toothMat = new THREE.MeshBasicMaterial({ color: 0xfff3d0 });
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Mesh(toothGeo, toothMat);
    t.position.set(-0.075 + (i % 4) * 0.05, -0.09, 0.16 + Math.floor(i / 4) * 0.22);
    t.rotation.x = Math.PI;
    g.add(t);
  }

  const eyeGeo = new THREE.SphereGeometry(0.075, 10, 10);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffdd22 });
  const slitMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  [-0.16, 0.16].forEach((x) => {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    e.position.set(x, 0.12, 0.13);
    g.add(e);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.1, 0.02), slitMat);
    s.position.set(x, 0.12, 0.2);
    g.add(s);
  });

  // crest
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.14, 4),
      new THREE.MeshBasicMaterial({ color: 0x8fff3a })
    );
    sp.position.set(0, 0.2 - i * 0.02, -0.02 - i * 0.07);
    sp.rotation.x = -0.35;
    g.add(sp);
  }
  return g;
}

/* ============================================================ */
/* one soft round glow, shared by every halo */
let _haloTex = null;
function haloTexture() {
  if (_haloTex) return _haloTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  _haloTex = new THREE.CanvasTexture(cv);
  return _haloTex;
}

export class NPC {
  /**
   * @param {object} cfg {id, name, x, z, ry, skin, suit, scale, tint}
   */
  constructor(cfg) {
    this.cfg = cfg;
    this.id = cfg.id;
    this.name = cfg.name;
    this.pos = new THREE.Vector3(cfg.x, 0, cfg.z);
    // what they stand on. The idle sway used to write y outright, which
    // stood your attorney up in the bath the frame after he was sat down.
    this.baseY = cfg.y ?? 0;
    this.phase = Math.random() * 6.28;

    const g = (this.group = new THREE.Group());
    g.position.copy(this.pos);
    g.rotation.y = cfg.ry ?? 0;

    const suit = new THREE.MeshStandardMaterial({
      color: cfg.suit ?? 0x2a2030, roughness: 0.68, metalness: 0.18,
      emissive: cfg.suit ?? 0x2a2030, emissiveIntensity: 0.35,
    });
    this.suitMat = suit;

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.62, 6, 14), suit);
    torso.position.y = 1.16;
    g.add(torso);
    this.torso = torso;

    const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 6, 12), suit);
    hips.position.y = 0.52;
    g.add(hips);

    const armGeo = new THREE.CapsuleGeometry(0.09, 0.52, 4, 8);
    this.arms = [-1, 1].map((s) => {
      const a = new THREE.Mesh(armGeo, suit);
      a.position.set(s * 0.36, 1.13, 0);
      a.rotation.z = s * 0.12;
      g.add(a);
      return a;
    });

    this.headPivot = new THREE.Group();
    this.headPivot.position.y = 1.72;
    g.add(this.headPivot);

    this.human = makeHumanHead(cfg.skin ?? 0xc79a76);
    this.lizard = makeLizardHead();
    this.lizard.visible = false;
    this.lizard.scale.setScalar(0.01);
    this.headPivot.add(this.human, this.lizard);

    // The halo behind the head. It was a real point light, and every point
    // light is paid for by every lit pixel on screen, every frame, whether
    // or not it reaches them -- four people carried four of them. It is a
    // glow now: an additive sprite set just behind the head, which reads as
    // the same backlit edge and costs one tiny unlit draw.
    // halo: 0 means none at all; a number scales it.
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTexture(), color: cfg.tint ?? 0xffb400, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    glow.position.set(0, 1.78, -0.35);
    glow.scale.set(1.5, 1.9, 1);
    glow.visible = cfg.halo !== 0;
    g.add(glow);
    this.halo = {
      color: glow.material.color,
      set intensity(v) { glow.material.opacity = Math.min(0.85, v / 70); },
    };

    // interaction marker
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.78, 32),
      new THREE.MeshBasicMaterial({
        color: cfg.tint ?? 0xffb400, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);
    this.ring = ring;

    if (cfg.scale) g.scale.setScalar(cfg.scale);

    this.morph = 0;
    this.active = true;
  }

  /** 0..1 how much of the reptile is showing */
  setMorph(m) {
    this.morph = m;
    const showLiz = m > 0.03;
    this.lizard.visible = showLiz;
    this.human.visible = m < 0.97;
    this.lizard.scale.setScalar(Math.max(0.01, m));
    this.human.scale.setScalar(Math.max(0.01, 1 - m * 0.85));
  }

  update(t, s, playerPos, nearest) {
    const g = this.group;
    const ph = t + this.phase;

    // idle: weight shift + breath
    g.position.y = this.baseY + Math.sin(ph * 1.1) * 0.022;
    this.torso.scale.y = 1 + Math.sin(ph * 1.6) * 0.022;
    this.arms[0].rotation.x = Math.sin(ph * 0.9) * 0.18;
    this.arms[1].rotation.x = Math.sin(ph * 0.9 + 1.4) * 0.18;

    // they track you: the head first, then the shoulders follow
    // once you are close enough to be a problem
    const dx = playerPos.x - g.position.x;
    const dz = playerPos.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const base = this.cfg.ry ?? 0;
    let d = want - base;
    while (d > Math.PI) d -= 6.283;
    while (d < -Math.PI) d += 6.283;

    const engage = 1 - Math.min(1, Math.max(0, (dist - 3.0) / 3.5));
    const bodyWant = base + d * 0.85 * engage;
    g.rotation.y += (bodyWant - g.rotation.y) * 0.05;

    let hd = want - g.rotation.y;
    while (hd > Math.PI) hd -= 6.283;
    while (hd < -Math.PI) hd += 6.283;
    hd = Math.max(-1.4, Math.min(1.4, hd));
    this.headPivot.rotation.y += (hd - this.headPivot.rotation.y) * 0.07;

    // the reveal
    const reveal = Math.min(1, s.perception * 1.25 + s.monster * 0.9 - 0.18);
    this.setMorph(Math.max(0, reveal));

    if (this.morph > 0.2) {
      const jaw = this.lizard.userData.jaw;
      if (jaw) jaw.rotation.x = Math.abs(Math.sin(ph * 2.3)) * 0.4 * this.morph;
      this.headPivot.rotation.z = Math.sin(ph * 3.1) * 0.06 * this.morph;
    } else {
      this.headPivot.rotation.z *= 0.9;
    }

    // hostility colour as loathing rises
    // haloScale: a rim light sized for the casino floor is a floodlight
    // against a bathroom wall a metre behind somebody's head
    this.halo.intensity = (24 + s.loathing * 40 + (nearest ? 20 : 0)) * (this.cfg.halo ?? 1);
    this.halo.color.setHSL(
      THREE.MathUtils.lerp(0.09, 0.0, s.loathing),
      0.9, 0.5
    );

    const o = nearest ? 0.55 + Math.sin(t * 5) * 0.2 : 0;
    this.ring.material.opacity += (o - this.ring.material.opacity) * 0.2;
    this.ring.rotation.z = t * 0.7;
  }
}

/* ============================================================
   Hallucinations — people who are not there. Under mescaline
   they are solid. Sober they are not even a smudge. Talking to
   one costs you dearly.
   ============================================================ */
export class Hallucination {
  constructor(x, z, hue) {
    const g = (this.group = new THREE.Group());
    g.position.set(x, 0, z);
    this.home = new THREE.Vector3(x, 0, z);
    this.phase = Math.random() * 6.28;
    this.hue = hue;

    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(hue, 1, 0.55),
      transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mat = m;

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 6, 12), m);
    body.position.y = 1.05; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), m);
    head.position.y = 1.75; g.add(head);
    this.head = head;

    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(0.5 + i * 0.26, 0.02, 6, 28), m
      );
      r.position.y = 1.1; r.rotation.x = Math.PI / 2 + i * 0.4;
      g.add(r);
      if (i === 0) this.r0 = r;
    }
  }

  update(t, s) {
    // people who are not there belong to the hallucinogen channel
    const vis = Math.max(0, s.psych * 1.15 - 0.12) * (0.65 + 0.35 * Math.sin(t * 2 + this.phase));
    this.mat.opacity = Math.min(0.85, vis);
    this.group.visible = this.mat.opacity > 0.01;
    if (!this.group.visible) return;

    this.group.position.x = this.home.x + Math.sin(t * 0.5 + this.phase) * 2.6 * s.psych;
    this.group.position.z = this.home.z + Math.cos(t * 0.37 + this.phase) * 2.6 * s.psych;
    this.group.position.y = Math.sin(t * 1.3 + this.phase) * 0.35;
    this.group.rotation.y = t * 0.6 + this.phase;
    this.head.scale.setScalar(1 + Math.sin(t * 4 + this.phase) * 0.25);
    this.mat.color.setHSL((this.hue + t * 0.07) % 1, 1, 0.55);
    if (this.r0) this.r0.rotation.z = t * 1.4;
  }
}

/* ============================================================
   The briefcase. It is on the floor the whole time. You simply
   cannot see it with a sober eye.
   ============================================================ */
export class Briefcase {
  constructor(x, z) {
    const g = (this.group = new THREE.Group());
    g.position.set(x, 0, z);
    this.pos = new THREE.Vector3(x, 0.3, z);

    this.mat = new THREE.MeshStandardMaterial({
      color: 0x4a2a10, roughness: 0.4, metalness: 0.5,
      emissive: 0xa03cff, emissiveIntensity: 0,
      transparent: true, opacity: 0,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.6, 0.24), this.mat);
    body.position.y = 0.32; g.add(body);

    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.03, 6, 18, Math.PI), this.mat
    );
    handle.position.y = 0.64; g.add(handle);

    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0xa03cff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.5, 32), this.glowMat);
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.02;
    g.add(halo);
    this.halo = halo;

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.9, 6, 12, 1, true), this.glowMat
    );
    beam.position.y = 3; g.add(beam);

    this.taken = false;
  }

  update(t, s) {
    if (this.taken) { this.group.visible = false; return; }
    const v = Math.max(0, Math.min(1, s.perception * 1.6 - 0.25));
    this.mat.opacity = v;
    this.mat.emissiveIntensity = v * 2.4;
    this.glowMat.opacity = v * (0.18 + 0.12 * Math.sin(t * 3));
    this.group.visible = v > 0.01;
    this.group.rotation.y = t * 0.4;
    this.group.position.y = Math.sin(t * 1.6) * 0.08 * v;
    this.halo.scale.setScalar(1 + Math.sin(t * 2) * 0.12);
  }
}

/* ============================================================
   A dose on the floor.
   ============================================================ */
export class Pickup {
  constructor(kind, x, z, color) {
    this.kind = kind;
    this.taken = false;
    const g = (this.group = new THREE.Group());
    g.position.set(x, 0, z);
    this.pos = new THREE.Vector3(x, 0.6, z);

    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.05, metalness: 0,
      transmission: 0.85, transparent: true, opacity: 0.55, ior: 1.4,
    });
    const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 12), glass);
    vial.position.y = 0.62; g.add(vial);

    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.3, 12),
      new THREE.MeshBasicMaterial({ color })
    );
    liquid.position.y = 0.56; g.add(liquid);

    // a glow shell instead of a real light — six pickups meant six
    // more lights in every standard material on the floor
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 10),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    glow.position.y = 0.62; g.add(glow);
    this.glow = glow;

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1, roughness: 0.3 })
    );
    cap.position.y = 0.86; g.add(cap);

    this.ringMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.35,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.5, 24), this.ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    g.add(ring);
    this.ring = ring;
    this.phase = Math.random() * 6.28;
  }

  update(t, s) {
    if (this.taken) return;
    const g = this.group;
    g.rotation.y = t * 1.1;
    g.position.y = Math.sin(t * 1.8 + this.phase) * 0.12;
    this.glow.scale.setScalar(1 + Math.sin(t * 4 + this.phase) * 0.14);
    this.ringMat.opacity = 0.2 + Math.sin(t * 2.4 + this.phase) * 0.15;
    this.ring.scale.setScalar(1 + Math.sin(t * 2.4 + this.phase) * 0.18);
  }
}


/* ============================================================
   THE CROWD — everybody else in the building.

   Each body is a real little skeleton: head, torso, two arms of
   two segments, two legs of two segments. But every part type is
   ONE InstancedMesh, so forty people with nine hundred joints
   between them still cost six draw calls. Limbs are placed by
   joint: take the joint position, point the segment along a
   direction, and put the capsule's centre half a length down it.

   When your perception comes up they all turn at once, because
   the shared head material is the thing that goes green.
   ============================================================ */
// mid-tones, not near-blacks: a casino crowd in bad seventies clothes
// still has to read as PEOPLE in a dark room, not as silhouettes
const SUIT_COLS = [
  0x7a5340, 0x3d5b7a, 0x8a3f42, 0x55555f, 0x6a5280,
  0x3f6b52, 0x9a7340, 0x8f4a63, 0x4a6b6b, 0xa8864a,
];
const SKIN_COLS = [0xe8c0a0, 0xc08a60, 0x9a7050, 0xd6a882, 0x7e5238];

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

// proportions, in metres, for a person about 1.78 tall
// The torso capsule is taller than the hip-to-shoulder span (its end
// caps add a radius at each end), so the head has to clear the TOP CAP
// or it gets swallowed and everyone looks decapitated.
//   torso half-height = (shoulderY-hipY)/2 + torsoR
const TORSO_R = 0.175, TORSO_LEN = 0.30;
const P = {
  hipY: 0.92, shoulderY: 1.44, headY: 1.745,
  thigh: 0.42, shin: 0.42,
  upperArm: 0.30, foreArm: 0.28,
  hipX: 0.11, shoulderX: 0.20,
  headR: 0.125,
};

export class Crowd {
  /** @param {Array} specs {kind:'sit'|'stand'|'walk', x, z, ry, path} */
  constructor(scene, specs) {
    this.specs = specs.map((s) => ({
      ...s,
      phase: Math.random() * 6.28,
      seg: 0,
      u: Math.random(),
      speed: 0.7 + Math.random() * 0.6,
      build: 0.92 + Math.random() * 0.18,
      yaw: s.ry ?? 0,
    }));
    const n = (this.n = this.specs.length);

    // emissive is NOT multiplied by per-instance colour, so it stays
    // dark — a bright one turns the whole crowd into glowing pills
    const skinMat = new THREE.MeshStandardMaterial({
      roughness: 0.74, metalness: 0.04, emissive: 0x33241c });
    const suitMat = new THREE.MeshStandardMaterial({
      roughness: 0.72, metalness: 0.14, emissive: 0x2a1f1c });
    const legMat = new THREE.MeshStandardMaterial({
      roughness: 0.78, metalness: 0.10, emissive: 0x1e1a20 });
    this.skinMat = skinMat;

    // one group for the whole crowd: act two switches the casino off in
    // a single call and loose meshes would be left hanging in the dark
    this.group = new THREE.Group();
    scene.add(this.group);

    const inst = (geo, matl, count) => {
      const m = new THREE.InstancedMesh(geo, matl, count);
      m.frustumCulled = false;
      this.group.add(m);
      return m;
    };

    // Low-poly on purpose. A hundred-odd people at the old segment counts
    // was 205,000 triangles -- two thirds of everything on screen -- for
    // limbs a few centimetres across that nobody sees closer than a metre.
    // Smooth shading does the rounding; the silhouettes read the same.
    this.head = inst(new THREE.SphereGeometry(P.headR, 10, 7), skinMat, n);
    this.torso = inst(new THREE.CapsuleGeometry(TORSO_R, TORSO_LEN, 2, 8), suitMat, n);
    this.neck = inst(new THREE.CapsuleGeometry(0.058, 0.10, 1, 5), skinMat, n);
    this.upperArm = inst(new THREE.CapsuleGeometry(0.058, P.upperArm * 0.7, 1, 5), suitMat, n * 2);
    this.foreArm = inst(new THREE.CapsuleGeometry(0.05, P.foreArm * 0.7, 1, 5), skinMat, n * 2);
    this.thigh = inst(new THREE.CapsuleGeometry(0.088, P.thigh * 0.6, 1, 6), legMat, n * 2);
    this.shin = inst(new THREE.CapsuleGeometry(0.072, P.shin * 0.6, 1, 6), legMat, n * 2);

    const c = new THREE.Color();
    this.specs.forEach((s, i) => {
      const suit = SUIT_COLS[i % SUIT_COLS.length];
      const skin = SKIN_COLS[(i * 3) % SKIN_COLS.length];
      const leg = new THREE.Color(suit).multiplyScalar(0.7).getHex();
      this.head.setColorAt(i, c.setHex(skin));
      this.neck.setColorAt(i, c.setHex(skin));
      this.torso.setColorAt(i, c.setHex(suit));
      for (let k = 0; k < 2; k++) {
        this.upperArm.setColorAt(i * 2 + k, c.setHex(suit));
        this.foreArm.setColorAt(i * 2 + k, c.setHex(skin));
        this.thigh.setColorAt(i * 2 + k, c.setHex(leg));
        this.shin.setColorAt(i * 2 + k, c.setHex(leg));
      }
    });

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._sc = new THREE.Vector3();
    this._lq = new THREE.Quaternion();
    this._xAxis = new THREE.Vector3(1, 0, 0);
    this._ox = 0; this._oz = 0;
    this._green = new THREE.Color(0x4f9e38);
    this._white = new THREE.Color(0xffffff);
    this.nearest = 0;
  }

  /** place one capsule segment: joint -> direction -> centre */
  _seg(inst, idx, jx, jy, jz, pitch, roll, yaw, len) {
    // rest direction is straight down; pitch swings it fore/aft,
    // roll swings it out to the side
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    const sr = Math.sin(roll), cr = Math.cos(roll);
    let dx = sr * cp, dy = -cp * cr, dz = sp;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const wx = dx * cy + dz * sy;
    const wz = -dx * sy + dz * cy;

    this._d.set(wx, dy, wz).normalize();
    this._q.setFromUnitVectors(UP, this._d);
    this._p.set(jx + this._d.x * len * 0.5,
                jy + this._d.y * len * 0.5,
                jz + this._d.z * len * 0.5);
    this._m.compose(this._p, this._q, ONE);
    inst.setMatrixAt(idx, this._m);
    return this._d;   // caller can walk to the next joint along it
  }

  /** rotate a body-local offset into world space, into _ox/_oz */
  _off(ox, oz, yaw) {
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    this._ox = ox * cy + oz * sy;
    this._oz = -ox * sy + oz * cy;
  }

  update(t, s, playerPos, dt, carouselAngle = 0) {
    const m = this._m, q = this._q, p = this._p, sc = this._sc;
    let nearest = 0;

    // everybody's face, all at the same moment
    const reveal = Math.min(1, Math.max(0, s.perception * 1.2 + s.monster * 0.8 - 0.2));
    this.skinMat.color.copy(this._white).lerp(this._green, reveal);

    for (let i = 0; i < this.n; i++) {
      const e = this.specs[i];
      const ph = t * 1.0 + e.phase;
      const sit = e.kind === 'sit';
      const walking = e.kind === 'walk';

      if (e.orbit) {
        const a = carouselAngle + e.orbit.a0;
        e.x = Math.sin(a) * e.orbit.r;
        e.z = Math.cos(a) * e.orbit.r;
        e.yaw = a + Math.PI;            // facing in, at the bottles
      } else if (walking) {
        const path = e.path;
        let a = path[e.seg];
        let b = path[(e.seg + 1) % path.length];
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        e.u += (e.speed * dt) / len;
        while (e.u >= 1) { e.u -= 1; e.seg = (e.seg + 1) % path.length; }
        a = path[e.seg];
        b = path[(e.seg + 1) % path.length];
        e.x = a.x + (b.x - a.x) * e.u;
        e.z = a.z + (b.z - a.z) * e.u;
        const want = Math.atan2(b.x - a.x, b.z - a.z);
        let d = want - e.yaw;
        while (d > Math.PI) d -= 6.283;
        while (d < -Math.PI) d += 6.283;
        e.yaw += d * Math.min(1, dt * 4);
      }

      const yaw = e.yaw;
      const B = e.build;

      // ---- gait ------------------------------------------------
      const stride = walking ? Math.sin(ph * 4.6) : 0;
      const bounce = walking ? Math.abs(Math.cos(ph * 4.6)) * 0.035 : 0;
      const breathe = Math.sin(ph * 1.2) * 0.012;

      // e.y lifts the whole body: the midway crowd stands a storey up
      const hipY = (e.y || 0) + (sit ? 0.80 : P.hipY * B) + bounce + breathe;
      const shoulderY = hipY + (P.shoulderY - P.hipY) * B;
      const headY = hipY + (P.headY - P.hipY) * B;

      // ---- torso ----------------------------------------------
      const lean = sit ? 0.10 : (walking ? 0.06 : 0.02);
      q.setFromAxisAngle(UP, yaw);
      this._lq.setFromAxisAngle(this._xAxis, lean);
      q.multiply(this._lq);
      sc.set(B, B, B);
      p.set(e.x, (hipY + shoulderY) * 0.5, e.z);
      m.compose(p, q, sc);
      this.torso.setMatrixAt(i, m);

      // ---- neck, bridging the torso cap to the head ------------
      q.setFromAxisAngle(UP, yaw);
      sc.set(B, B, B);
      p.set(e.x, shoulderY + 0.14 * B, e.z);
      m.compose(p, q, sc);
      this.neck.setMatrixAt(i, m);

      // ---- head -----------------------------------------------
      // stretches into a snout as the reveal takes hold
      sc.set(B * (1 - reveal * 0.12), B * (1.02 - reveal * 0.28), B * (0.96 + reveal * 1.1));
      this._off(0, sit ? 0.05 : 0.02, yaw);
      p.set(e.x + this._ox, headY, e.z + this._oz);
      m.compose(p, q, sc);
      this.head.setMatrixAt(i, m);

      // ---- arms ------------------------------------------------
      for (let k = 0; k < 2; k++) {
        const sign = k === 0 ? -1 : 1;
        this._off(sign * P.shoulderX * B, 0, yaw);
        const jx = e.x + this._ox, jz = e.z + this._oz;

        let pitch, elbow, roll;
        if (sit) {
          // hands forward, on the machine or the felt
          pitch = 1.05; elbow = 0.55; roll = sign * 0.10;
        } else if (walking) {
          pitch = -stride * 0.55; elbow = 0.35 + Math.abs(stride) * 0.25;
          roll = sign * 0.09;
        } else {
          pitch = Math.sin(ph * 1.1 + k) * 0.06; elbow = 0.22;
          roll = sign * 0.11;
        }

        const d = this._seg(this.upperArm, i * 2 + k,
          jx, shoulderY, jz, pitch, roll, yaw, P.upperArm * B);
        const ex = jx + d.x * P.upperArm * B;
        const ey = shoulderY + d.y * P.upperArm * B;
        const ez = jz + d.z * P.upperArm * B;
        this._seg(this.foreArm, i * 2 + k,
          ex, ey, ez, pitch + elbow, roll * 0.4, yaw, P.foreArm * B);
      }

      // ---- legs ------------------------------------------------
      for (let k = 0; k < 2; k++) {
        const sign = k === 0 ? -1 : 1;
        this._off(sign * P.hipX * B, 0, yaw);
        const jx = e.x + this._ox, jz = e.z + this._oz;

        let pitch, knee;
        if (sit) {
          pitch = 1.45; knee = -1.45;           // thigh out, shin down
        } else if (walking) {
          pitch = stride * sign * 0.0 + Math.sin(ph * 4.6 + (k ? Math.PI : 0)) * 0.42;
          knee = Math.max(0, -Math.sin(ph * 4.6 + (k ? Math.PI : 0))) * 0.75;
        } else {
          pitch = sign * 0.04; knee = 0.03;
        }

        const d = this._seg(this.thigh, i * 2 + k,
          jx, hipY, jz, pitch, sign * 0.035, yaw, P.thigh * B);
        const kx = jx + d.x * P.thigh * B;
        const ky = hipY + d.y * P.thigh * B;
        const kz = jz + d.z * P.thigh * B;
        this._seg(this.shin, i * 2 + k,
          kx, ky, kz, pitch + knee, 0, yaw, P.shin * B);
      }

      const dx = e.x - playerPos.x, dz = e.z - playerPos.z;
      const near = Math.exp(-(dx * dx + dz * dz) / 34);
      if (near > nearest) nearest = near;
    }

    [this.head, this.neck, this.torso, this.upperArm, this.foreArm, this.thigh, this.shin]
      .forEach((o) => { o.instanceMatrix.needsUpdate = true; });
    this.nearest = nearest;
  }
}

/* ============================================================
   Bat country.
   ============================================================ */
export class BatSwarm {
  constructor(scene, n = 140) {
    this.n = n;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      seed[i] = Math.random() * 6.28;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uAmt: { value: 0 }, uCenter: { value: new THREE.Vector3() } },
      vertexShader: /* glsl */`
        attribute float aSeed;
        uniform float uTime, uAmt;
        uniform vec3 uCenter;
        varying float vFlap;
        void main(){
          float t = uTime + aSeed*3.0;
          vec3 orbit = vec3(
            sin(t*0.9 + aSeed)*6.0,
            2.4 + sin(t*1.7 + aSeed*2.0)*1.9,
            cos(t*0.75 + aSeed*1.3)*6.0
          );
          vec3 p = mix(position, uCenter + orbit*(0.5 + 1.5*(1.0-uAmt)), uAmt);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (120.0 * uAmt) / -mv.z;
          gl_Position = projectionMatrix * mv;
          vFlap = sin(uTime*14.0 + aSeed*7.0)*0.5 + 0.5;
        }`,
      fragmentShader: /* glsl */`
        uniform float uAmt;
        varying float vFlap;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          // crude winged silhouette
          float wing = abs(d.y*3.0) + (0.25 + 0.5*vFlap)*abs(d.x) - 0.35;
          float body = length(d*vec2(4.0,1.6)) - 0.22;
          float a = 1.0 - smoothstep(-0.02, 0.02, min(wing, body));
          if (a < 0.02) discard;
          gl_FragColor = vec4(vec3(0.02,0.0,0.01), a*uAmt);
        }`,
    });

    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.group = new THREE.Group();
    this.group.add(this.points);
    scene.add(this.group);
  }

  update(t, amt, center) {
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uAmt.value = amt;
    this.mat.uniforms.uCenter.value.copy(center);
    this.points.visible = amt > 0.01;
  }
}
