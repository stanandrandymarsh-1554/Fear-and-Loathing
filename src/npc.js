/* ============================================================
   THE PEOPLE — and the things the people turn into.

   Every NPC carries two heads. One is the head they have.
   The other is the head you see when the chemistry decides
   to show you what they really are. The crossfade is driven
   by perception, not by truth.
   ============================================================ */

import * as THREE from 'three';


/* ============================================================
   A PERSON, as a little jointed puppet.

   They used to be a capsule on a capsule with a ball on top -- a
   Russian doll that swayed. Now each of them is a skeleton of joints
   (pelvis, spine, neck, head, shoulders, elbows, hands, hips, knees,
   ankles) with the body hung off it in low-poly pieces, a face that can
   blink and talk, and clothes that say who they are.

   Nothing here is keyframed. Every frame the joints are worked out from
   what the person is doing -- standing, sitting, lying in a bath, leaning
   on a counter, walking (read off how far they actually moved), talking
   (the mouth, the head, the hands), listening, or one of a handful of
   gestures a line of dialogue can ask for -- and eased toward that, so
   everything blends into everything else.

   Rotation conventions, for a limb hanging straight down in a joint:
   rotation.x < 0 swings it FORWARD (+Z, the way they face), > 0 back;
   rotation.z swings it out to +X (so -z is out for a left limb).
   ============================================================ */

const GEO = {};
const geo = (key, make) => GEO[key] || (GEO[key] = make());
const cap = (r, l, a = 3, b = 8) => geo(`cap${r},${l},${a},${b}`, () => new THREE.CapsuleGeometry(r, l, a, b));
const sph = (r, w = 10, h = 8) => geo(`sph${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const box = (x, y, z) => geo(`box${x},${y},${z}`, () => new THREE.BoxGeometry(x, y, z));
const cyl = (a, b, h, n = 10) => geo(`cyl${a},${b},${h},${n}`, () => new THREE.CylinderGeometry(a, b, h, n));

const DARK = new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: 0.6 });
const EYE_WHITE = new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.4, emissive: 0x302c28 });
const LIP = new THREE.MeshStandardMaterial({ color: 0x7a3a34, roughness: 0.6, emissive: 0x200c0a });
const SHOE = new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.5, metalness: 0.2, emissive: 0x0a0808 });
const GOLD = new THREE.MeshStandardMaterial({ color: 0xd8b040, roughness: 0.3, metalness: 0.8, emissive: 0x302000 });

/* the attorney's shirt: something loud, from a rack in Acapulco */
let _loud = null;
function loudShirt() {
  if (_loud) return _loud;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#b8261c'; g.fillRect(0, 0, 128, 128);
  const cols = ['#ffb400', '#ff6a2d', '#f4e9c8', '#2a1a10', '#ff2d6a'];
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const x = r() * 128, y = r() * 128, R = 6 + r() * 10;
    g.fillStyle = cols[i % cols.length];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + i;
      g.beginPath(); g.ellipse(x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.6, R * 0.45, R * 0.25, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(x, y, R * 0.22, 0, Math.PI * 2); g.fill();
  }
  _loud = new THREE.CanvasTexture(cv);
  _loud.colorSpace = THREE.SRGBColorSpace;
  _loud.wrapS = _loud.wrapT = THREE.RepeatWrapping;
  return _loud;
}

/* Who wears what. Anything left out falls back to the config's suit and
   skin, so a new face needs nothing but a colour to be somebody. */
const LOOKS = {
  // big, loud, moustached, shirt open to the sternum and a medallion in it
  attorney: { width: 1.2, belly: 1.12, hair: 'curly', hairCol: 0x1a120c, stache: true,
    shirt: 'loud', open: true, chain: true, jacket: null, trousers: 0x2e2a30, energy: 1.7 },
  // in the tub: the same man with no shirt at all
  bath: { width: 1.2, belly: 1.12, hair: 'curly', hairCol: 0x1a120c, stache: true,
    shirt: 'skin', jacket: null, trousers: 0x2e2a30, energy: 1.7 },
  clerk: { hair: 'bun', hairCol: 0xc8a060, shirt: 0xf0e6d2, tie: null, skirt: true, energy: 0.7, width: 0.9 },
  bartender: { hair: 'short', hairCol: 0x2a1a10, shirt: 0xf2eee4, vest: 0x161618, tie: 'bow', jacket: null, energy: 0.9 },
  security: { width: 1.18, hair: 'short', hairCol: 0x100c0a, shades: true, shirt: 0xe8e4dc, tie: 0x101010, energy: 0.5 },
  valet: { hair: 'short', hairCol: 0x3a2412, hat: 'cap', hatCol: 0x7a1420, shirt: 0xf0ece0, tie: 0x101010, energy: 0.8 },
  maid: { hair: 'bun', hairCol: 0x3a2412, hat: 'maid', shirt: null, apron: true, skirt: true, energy: 0.9, width: 0.92 },
  registrar: { hair: 'long', hairCol: 0x6a4422, shirt: 0xf4efe4, tie: null, skirt: true, energy: 0.8, width: 0.9 },
  georgia: { width: 1.25, belly: 1.25, hair: 'bald', hairCol: 0xd8d4cc, shirt: 0xf2eee4, tie: 0x8a1a1a, glasses: true, energy: 1.2 },
  keynote: { hair: 'bald', hairCol: 0x8a8278, glasses: true, shirt: 0xf2eee4, tie: 0x2a3a6a, energy: 1.3 },
  patrol: { width: 1.08, hair: 'short', hairCol: 0x4a3018, hat: 'patrol', hatCol: 0x2a2a2a, shades: true,
    jacket: 0xb8a878, shirt: null, trousers: 0x2a2a30, belt: true, energy: 0.9 },
};

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

/* Everything on one joint that is the same material becomes one mesh. A
   person is sixty-odd little pieces as built and would be sixty-odd draw
   calls each; merged, the head is a handful and the whole body about
   thirty. Pieces that animate on their own are marked userData.keep. */
function mergeGeos(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    pos.set(P.array.subarray(0, P.count * 3), vo * 3);
    if (N) nor.set(N.array.subarray(0, P.count * 3), vo * 3);
    if (U) uv.set(U.array.subarray(0, P.count * 2), vo * 2);
    if (g.index) for (let k = 0; k < g.index.count; k++) idx[io++] = g.index.getX(k) + vo;
    else for (let k = 0; k < P.count; k++) idx[io++] = k + vo;
    vo += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
function mergeParts(root) {
  const joints = [];
  root.traverse((o) => { if (o.isGroup || o === root) joints.push(o); });
  for (const j of joints) {
    const buckets = new Map();
    for (const c of j.children) {
      if (!c.isMesh || c.userData.keep || c.children.length) continue;
      if (!buckets.has(c.material)) buckets.set(c.material, []);
      buckets.get(c.material).push(c);
    }
    for (const [m, list] of buckets) {
      if (list.length < 2) continue;
      const geos = list.map((c) => { c.updateMatrix(); return c.geometry.clone().applyMatrix4(c.matrix); });
      list.forEach((c) => j.remove(c));
      j.add(new THREE.Mesh(mergeGeos(geos), m));
    }
  }
}

const lerp = (a, b, k) => a + (b - a) * k;
const _pq = new THREE.Quaternion(), _pe = new THREE.Euler();
const wrap = (a) => { while (a > Math.PI) a -= 6.283185; while (a < -Math.PI) a += 6.283185; return a; };

/* What each named gesture does to the joints, at full weight. Arm values
   are [shoulder pitch, shoulder out, elbow] for the right arm then the
   left (out is mirrored). k is how far through the gesture it is, 0..1,
   for the ones that move rather than hold. */
const GESTURES = {
  point:  (k, t) => ({ R: [-1.45, 0.05, -0.1], head: [0.05, 0, 0] }),
  shrug:  (k, t) => ({ R: [-0.35, 0.55, -1.35], L: [-0.35, 0.55, -1.35], head: [0, 0, 0.18], lift: 0.04 }),
  nod:    (k, t) => ({ head: [Math.sin(k * Math.PI * 4) * 0.22, 0, 0] }),
  shake:  (k, t) => ({ head: [0, Math.sin(k * Math.PI * 6) * 0.38, 0] }),
  laugh:  (k, t) => ({ spine: -0.12 - Math.abs(Math.sin(t * 9)) * 0.1, head: [-0.35, 0, 0.1], jaw: 0.5,
                       R: [-0.3, 0.2, -1.2], L: [-0.3, 0.2, -1.2] }),
  wave:   (k, t) => ({ R: [-0.4, 2.3, -0.4 + Math.sin(t * 13) * 0.5] }),
  fist:   (k, t) => ({ R: [-2.5 + Math.sin(t * 11) * 0.25, 0.2, -0.7], jaw: 0.35 }),
  throw:  (k, t) => ({ R: k < 0.45 ? [0.9, 0.4, -1.6] : [-1.7, 0.1, -0.1], spine: k < 0.45 ? -0.1 : 0.15 }),
  slam:   (k, t) => ({ R: [k < 0.4 ? -1.4 : -0.6, 0.15, k < 0.4 ? -1.0 : -0.8], L: [k < 0.4 ? -1.4 : -0.6, 0.15, k < 0.4 ? -1.0 : -0.8] }),
  splash: (k, t) => ({ R: [-0.6 + Math.sin(t * 14) * 0.5, 0.9, -0.5], L: [-0.6 - Math.sin(t * 14) * 0.5, 0.9, -0.5], jaw: 0.45 }),
  cross:  (k, t) => ({ R: [-0.55, -0.35, -1.95], L: [-0.55, -0.35, -1.95] }),
  hands:  (k, t) => ({ R: [-0.7, 0.35, -1.1], L: [-0.7, 0.35, -1.1] }),        // palms out, placating
  lean:   (k, t) => ({ spine: 0.25, head: [0.15, 0, 0] }),
  recoil: (k, t) => ({ spine: -0.2, head: [-0.2, 0, 0], R: [-0.9, 0.3, -1.6], L: [-0.9, 0.3, -1.6] }),
  writes: (k, t) => ({ R: [-0.75, -0.05, -1.3 + Math.sin(t * 16) * 0.08], L: [-0.6, 0.05, -1.5], head: [0.35, 0, 0] }),
};

export class NPC {
  /**
   * @param {object} cfg {id, name, x, z, y, ry, skin, suit, scale, tint, halo, look, pose}
   *   look: a key into LOOKS (clothes, hair, build); pose: stand | counter |
   *   sit | bath | lectern
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
    this.pose = cfg.pose || 'stand';
    this.homeYaw = cfg.ry ?? 0;
    this.turns = cfg.turns ?? (this.pose === 'stand' || this.pose === 'counter');

    const L = { ...(LOOKS[cfg.look] || {}) };
    L.hair ??= 'short';
    this.look = L;
    const W = L.width ?? 1;
    this.energy = L.energy ?? 1;

    const g = (this.group = new THREE.Group());
    g.position.copy(this.pos);
    g.position.y = this.baseY;
    g.rotation.y = this.homeYaw;
    g.rotation.order = 'YXZ';

    // ---- materials: a few per person, everything else shared
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({
      color, roughness: 0.7, metalness: 0.06, emissive: color, emissiveIntensity: 0.28, ...extra });
    const skinCol = cfg.skin ?? 0xc79a76;
    const skin = std(skinCol, { roughness: 0.72, emissiveIntensity: 0.2 });
    const jacketCol = L.jacket === null ? null : (L.jacket ?? cfg.suit ?? 0x2a2030);
    const jacket = std(jacketCol ?? cfg.suit ?? 0x2a2030, { metalness: 0.15 });
    const shirt = L.shirt === 'loud' ? std(0xffffff, { map: loudShirt(), emissiveIntensity: 0.18, emissiveMap: loudShirt() })
      : L.shirt === 'skin' ? skin
        : std(L.shirt ?? 0xe8e2d4);
    const trousers = std(L.trousers ?? (jacketCol != null ? new THREE.Color(jacketCol).multiplyScalar(0.8).getHex() : 0x2a2a30));
    const hair = std(L.hairCol ?? 0x2a1a10, { roughness: 0.9, emissiveIntensity: 0.12 });
    this.suitMat = jacket;
    // what the chest and arms are made of: the jacket, or the shirt when
    // there is no jacket, and his own skin in the bath
    const top = jacketCol == null ? shirt : jacket;
    const sleeve = L.shirt === 'skin' ? skin : top;

    const mesh = (gm, m, x, y, z, parent) => { const o = new THREE.Mesh(gm, m); o.position.set(x, y, z); parent.add(o); return o; };

    // ---- the skeleton
    const HIP = 0.92;
    const pelvis = (this.pelvis = new THREE.Group());
    pelvis.position.y = HIP;
    g.add(pelvis);
    mesh(cap(0.15 * W, 0.1, 3, 10), trousers, 0, 0.02, 0, pelvis).scale.set(1.05, 1, 0.78);
    if (L.belt) mesh(cyl(0.16 * W, 0.16 * W, 0.05, 12), DARK, 0, 0.1, 0, pelvis).scale.z = 0.8;
    // a skirt hides the thighs: a short flared tube from the waist
    if (L.skirt) mesh(cyl(0.16 * W, 0.24 * W, 0.46, 12), L.apron ? jacket : trousers, 0, -0.17, 0, pelvis).scale.z = 0.85;

    const spine = (this.spine = new THREE.Group());
    spine.position.y = 0.08;
    pelvis.add(spine);
    const chestR = 0.165 * W;
    const chest = mesh(cap(chestR, 0.26, 3, 12), top, 0, 0.24, 0, spine);
    chest.scale.set(1.12, 1, 0.74 * (L.belly ? 1.05 : 1));
    chest.userData.keep = true;           // it breathes
    this.chest = chest;
    if (L.belly) mesh(sph(0.15 * W, 12, 10), top, 0, 0.13, 0.035, spine).scale.set(1.0, 0.95, 0.85 * L.belly);
    // the shoulders: a bar across the top, so the arms hang from a frame
    mesh(cap(0.07, 0.26 * W, 2, 8), top, 0, 0.43, 0, spine).rotation.z = Math.PI / 2;
    const front = chestR * 0.74 + 0.004;
    // a V: the jacket open on the shirt, or the shirt open on the chest
    const vee = geo('vee', () => new THREE.CircleGeometry(0.075, 3).rotateZ(-Math.PI / 2).scale(1, 2.2, 1));
    if (jacketCol != null && L.shirt !== null) {
      // lapels open on a shirt, and a tie in it
      mesh(vee, shirt, 0, 0.36, front, spine);
      if (L.tie === 'bow') mesh(box(0.08, 0.03, 0.02), DARK, 0, 0.45, front + 0.008, spine);
      else if (L.tie !== null && L.tie !== undefined) mesh(box(0.03, 0.2, 0.012), std(L.tie), 0, 0.33, front + 0.006, spine);
    }
    if (L.vest) {
      mesh(box(0.26 * W, 0.3, 0.012), std(L.vest), 0, 0.26, front + 0.002, spine);
      mesh(box(0.08, 0.3, 0.014), shirt, 0, 0.29, front + 0.004, spine);
      if (L.tie === 'bow') mesh(box(0.08, 0.03, 0.02), DARK, 0, 0.45, front + 0.012, spine);
    }
    if (L.open) {
      // unbuttoned to the sternum, with a medallion in it
      mesh(vee, skin, 0, 0.38, front + 0.002, spine).scale.set(0.8, 0.8, 1);
    }
    if (L.chain) mesh(geo('chain', () => new THREE.TorusGeometry(0.07, 0.006, 4, 16, Math.PI)), GOLD, 0, 0.44, front + 0.01, spine).rotation.z = Math.PI;
    if (L.apron) mesh(box(0.24 * W, 0.62, 0.012), std(0xf4f0e8), 0, 0.02, front + 0.01, spine);
    if (L.belt) mesh(box(0.05, 0.05, 0.02), GOLD, 0, 0.02, front + 0.012, spine);

    // ---- neck and head
    const neck = (this.neck = new THREE.Group());
    neck.position.y = 0.5;
    spine.add(neck);
    mesh(cyl(0.05, 0.056, 0.12, 8), skin, 0, 0.03, 0, neck);
    if (L.open === undefined && L.shirt !== 'skin' && L.shirt !== null) {
      mesh(cyl(0.062, 0.066, 0.05, 10), shirt, 0, -0.01, 0, neck);         // the collar
    }
    this.headPivot = new THREE.Group();
    this.headPivot.position.y = 0.1;
    neck.add(this.headPivot);
    const human = (this.human = new THREE.Group());
    this.headPivot.add(human);
    mesh(sph(0.115, 16, 12), skin, 0, 0.1, 0, human).scale.set(0.94, 1.12, 1.02);        // skull
    mesh(sph(0.09, 12, 8), skin, 0, 0.035, 0.022, human).scale.set(0.95, 0.85, 1.0);    // jaw and cheeks
    [-1, 1].forEach((s) => mesh(sph(0.03, 6, 5), skin, s * 0.108, 0.09, -0.005, human).scale.set(0.5, 1, 0.8));
    // eyes, which blink
    this.eyes = [-1, 1].map((s) => {
      const e = new THREE.Group();
      e.position.set(s * 0.042, 0.115, 0.098);
      human.add(e);
      mesh(sph(0.018, 8, 6), EYE_WHITE, 0, 0, 0, e);
      mesh(sph(0.009, 6, 5), DARK, 0, 0, 0.014, e);
      return e;
    });
    this.brows = [-1, 1].map((s) => {
      const b = mesh(box(0.05, 0.012, 0.014), hair, s * 0.045, 0.152, 0.108, human);
      b.userData.keep = true;             // they go up when a point is being made
      return b;
    });
    mesh(cap(0.017, 0.035, 2, 6), skin, 0, 0.085, 0.118, human).rotation.x = 0.35;        // nose
    mesh(box(0.05, 0.01, 0.012), LIP, 0, 0.048, 0.108, human);                           // upper lip
    this.jaw = new THREE.Group();
    this.jaw.position.set(0, 0.06, 0.02);
    human.add(this.jaw);
    mesh(box(0.046, 0.011, 0.012), LIP, 0, -0.024, 0.086, this.jaw);                    // lower lip
    this.mouthIn = mesh(box(0.04, 0.03, 0.006), DARK, 0, 0.034, 0.104, human);           // inside, when open
    this.mouthIn.scale.y = 0.05;
    this.mouthIn.userData.keep = true;
    if (L.stache) mesh(box(0.08, 0.02, 0.022), hair, 0, 0.062, 0.114, human);
    // hair
    const capGeo = geo('haircap', () => new THREE.SphereGeometry(0.123, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52));
    const fringeGeo = geo('fringe', () => new THREE.SphereGeometry(0.121, 16, 6, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.18));
    const hairAt = (gm, y = 0.108, z = -0.012) => { const o = mesh(gm, hair, 0, y, z, human); o.scale.set(0.97, 1.1, 1.06); return o; };
    if (L.hair === 'short' || L.hair === 'bun' || L.hair === 'long' || L.hair === 'curly') hairAt(capGeo);
    if (L.hair === 'bald') { const f = hairAt(fringeGeo, 0.1, -0.015); f.rotation.x = -0.25; }
    if (L.hair === 'bun') mesh(sph(0.055, 10, 8), hair, 0, 0.19, -0.1, human);
    if (L.hair === 'long') mesh(box(0.2, 0.26, 0.06), hair, 0, -0.02, -0.08, human);
    if (L.hair === 'curly') {
      // a mop: a ring of curls round the crown and one round the back and
      // sides, leaving the face clear
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        if (Math.cos(a) > 0.55) continue;                   // not over the forehead
        mesh(sph(0.042, 7, 5), hair, Math.sin(a) * 0.112, 0.15, Math.cos(a) * 0.105 - 0.01, human);
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        mesh(sph(0.04, 7, 5), hair, Math.sin(a) * 0.065, 0.205, Math.cos(a) * 0.06 - 0.02, human);
      }
    }
    if (L.hat === 'cap' || L.hat === 'patrol') {
      const hm = std(L.hatCol ?? 0x222222);
      mesh(cyl(0.125, 0.128, 0.07, 14), hm, 0, 0.215, -0.005, human);
      if (L.hat === 'patrol') mesh(cyl(0.14, 0.13, 0.03, 14), hm, 0, 0.26, -0.01, human);
      mesh(box(0.2, 0.012, 0.09), DARK, 0, 0.19, 0.11, human).rotation.x = 0.15;       // the peak
      if (L.hat === 'patrol') mesh(box(0.05, 0.04, 0.01), GOLD, 0, 0.225, 0.126, human);
    }
    if (L.hat === 'maid') mesh(box(0.16, 0.05, 0.1), std(0xf4f0e8), 0, 0.225, -0.02, human).rotation.x = -0.3;
    if (L.glasses) {
      const rim = geo('rim', () => new THREE.TorusGeometry(0.026, 0.005, 4, 12));
      [-1, 1].forEach((s) => mesh(rim, DARK, s * 0.043, 0.115, 0.118, human));
      mesh(box(0.03, 0.005, 0.005), DARK, 0, 0.12, 0.12, human);
    }
    if (L.shades) {
      [-1, 1].forEach((s) => mesh(box(0.05, 0.032, 0.01), DARK, s * 0.043, 0.115, 0.12, human));
      mesh(box(0.13, 0.008, 0.008), DARK, 0, 0.128, 0.12, human);
    }

    this.lizard = makeLizardHead();
    this.lizard.visible = false;
    this.lizard.scale.setScalar(0.01);
    this.lizard.position.y = 0.1;
    this.headPivot.add(this.lizard);

    // ---- arms: shoulder -> upper arm -> elbow -> forearm -> hand
    this.arms = [-1, 1].map((s) => {
      const sh = new THREE.Group();
      sh.position.set(s * 0.2 * W, 0.43, 0);
      spine.add(sh);
      mesh(cap(0.056, 0.19, 2, 8), sleeve, 0, -0.14, 0, sh);
      const el = new THREE.Group();
      el.position.y = -0.29;
      sh.add(el);
      mesh(cap(0.048, 0.18, 2, 8), sleeve, 0, -0.13, 0, el);
      if (sleeve !== skin && L.shirt !== null && L.shirt !== 'loud') mesh(cyl(0.05, 0.05, 0.03, 8), shirt, 0, -0.245, 0, el);
      const hand = new THREE.Group();
      hand.position.y = -0.27;
      el.add(hand);
      mesh(sph(0.045, 8, 6), skin, 0, -0.04, 0.005, hand).scale.set(0.75, 1.15, 0.5);
      return { sh, el, hand, s, cur: [0, 0.1, -0.15] };
    });
    // ---- legs: hip -> thigh -> knee -> shin -> ankle -> shoe
    this.legs = [-1, 1].map((s) => {
      const hp = new THREE.Group();
      hp.position.set(s * 0.09 * W, 0, 0);
      pelvis.add(hp);
      mesh(cap(0.072 * Math.sqrt(W), 0.3, 2, 8), trousers, 0, -0.21, 0, hp);
      const kn = new THREE.Group();
      kn.position.y = -0.43;
      hp.add(kn);
      mesh(cap(0.058, 0.32, 2, 8), L.skirt ? skin : trousers, 0, -0.21, 0, kn);
      const an = new THREE.Group();
      an.position.y = -0.43;
      kn.add(an);
      mesh(box(0.09, 0.065, 0.24), SHOE, 0, -0.03, 0.045, an);
      return { hp, kn, an, s };
    });

    // The halo behind the head. It was a real point light, and every point
    // light is paid for by every lit pixel on screen, every frame, whether
    // or not it reaches them -- four people carried four of them. It is a
    // glow now: an additive sprite set just behind the head, which reads as
    // the same backlit edge and costs one tiny unlit draw.
    // halo: 0 means none at all; a number scales it.
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTexture(), color: cfg.tint ?? 0xffb400, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    glow.position.set(0, 1.62, -0.3);
    glow.scale.set(1.1, 1.4, 1);
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
    mergeParts(g);

    this.morph = 0;
    this.active = true;

    // ---- what they are doing
    this.speaking = false;     // set every frame by whoever runs the dialogue
    this.listening = false;
    this.lookTarget = null;    // a world point to look at instead of you
    this.talk = 0;             // eased 0..1
    this.gest = null;          // { name, t, dur }
    this.walkPh = 0;
    this.speed = 0;
    this.moving = false;
    this._lx = g.position.x; this._lz = g.position.z; this._lt = null;
    this.blinkIn = 1 + Math.random() * 3;
    this.beatIn = 0;
    this.beat = [[-0.3, 0.2, -0.6], [-0.3, 0.2, -0.6]];
    this._wp = new THREE.Vector3();
  }

  /** a one-off movement: see GESTURES */
  gesture(name, dur = 1.6) {
    if (GESTURES[name]) this.gest = { name, t: 0, dur };
  }

  /** 0..1 how much of the reptile is showing */
  setMorph(m) {
    this.morph = m;
    const showLiz = m > 0.03;
    this.lizard.visible = showLiz;
    this.human.visible = m < 0.97;
    this.lizard.scale.setScalar(Math.max(0.01, m) * 0.5);
    this.human.scale.setScalar(Math.max(0.01, 1 - m * 0.85));
  }

  update(t, s, playerPos, nearest) {
    const g = this.group;
    const dt = this._lt == null ? 0 : Math.min(0.1, Math.max(0, t - this._lt));
    this._lt = t;
    const ph = t + this.phase;
    const E = this.energy;

    // ---- are they going anywhere: read it off where they actually are
    const mx = g.position.x - this._lx, mz = g.position.z - this._lz;
    this._lx = g.position.x; this._lz = g.position.z;
    const step = Math.hypot(mx, mz);
    const v = dt > 0 ? step / dt : 0;
    this.speed += (Math.min(v, 4) - this.speed) * Math.min(1, dt * 8);
    this.moving = this.speed > 0.25 && step < 1.5;      // a teleport is not a stride
    if (this.moving) this.walkPh += step * (Math.PI * 2 / 1.35);
    const walk = Math.min(1, this.speed / 1.2);

    // ---- which way they face
    const look = this.lookTarget || playerPos;
    g.getWorldPosition(this._wp);
    const dx = look.x - this._wp.x, dz = look.z - this._wp.z;
    const dist = Math.hypot(dx, dz);
    // (parent-relative: a person riding in a car faces the way the car does)
    let pYaw = 0;
    if (g.parent && g.parent.type !== 'Scene') {
      g.parent.getWorldQuaternion(_pq);
      pYaw = _pe.setFromQuaternion(_pq, 'YXZ').y;
    }
    const want = Math.atan2(dx, dz) - pYaw;
    if (this.moving && step > 0.0005) {
      const head = Math.atan2(mx, mz);
      g.rotation.y += wrap(head - g.rotation.y) * Math.min(1, dt * 7);
    } else if (this.turns) {
      // they turn to you once you are close enough to be a problem
      const engage = 1 - Math.min(1, Math.max(0, (dist - 3.0) / 3.5));
      const d = wrap(want - this.homeYaw);
      const bodyWant = this.homeYaw + d * 0.85 * (this.speaking || this.listening ? 1 : engage);
      g.rotation.y += wrap(bodyWant - g.rotation.y) * Math.min(1, dt * 3);
    }
    let hd = wrap(want - g.rotation.y);
    hd = Math.max(-1.3, Math.min(1.3, hd));
    if (this.moving) hd *= 0.3;

    // ---- talking, eased in and out
    this.talk += ((this.speaking ? 1 : 0) - this.talk) * Math.min(1, dt * 6);
    const talk = this.talk;
    // every half second or so the hands go somewhere new
    this.beatIn -= dt;
    if (this.beatIn <= 0) {
      this.beatIn = 0.45 + Math.random() * 0.5;
      const r = () => Math.random();
      this.beat = [
        [-0.25 - r() * 0.75 * E, 0.12 + r() * 0.35, -0.5 - r() * 1.0],
        r() < 0.55 ? [-0.2 - r() * 0.55 * E, 0.1 + r() * 0.3, -0.4 - r() * 0.9] : [0.02, 0.1, -0.2],
      ];
    }

    // ---- the gesture, if one is running
    let G = null, gw = 0;
    if (this.gest) {
      const q = this.gest;
      q.t += dt;
      const k = q.t / q.dur;
      if (k >= 1) this.gest = null;
      else {
        gw = Math.min(1, q.t / 0.22, (q.dur - q.t) / 0.3);
        G = GESTURES[q.name](k, t);
      }
    }

    // ---- the body
    const pose = this.pose;
    const sit = pose === 'sit', bath = pose === 'bath';
    const breathe = Math.sin(ph * 1.5) * 0.012;
    const stride = Math.sin(this.walkPh);
    this.pelvis.position.y = sit ? (this.cfg.seatY ?? 0.5) : bath ? 0.92
      : 0.92 + Math.abs(Math.cos(this.walkPh)) * 0.035 * walk + breathe * 0.3;
    this.pelvis.rotation.z = (sit || bath) ? 0 : Math.sin(ph * 0.45) * 0.025 * (1 - walk) + stride * 0.03 * walk;
    this.pelvis.rotation.y = stride * 0.1 * walk;
    let spineX = (pose === 'counter' || pose === 'lectern') ? 0.12 : sit ? 0.05 : bath ? -0.45 : 0.03;
    spineX += walk * 0.05 + talk * Math.sin(ph * 2.3) * 0.03 * E;
    if (G?.spine) spineX += G.spine * gw;
    this.spine.rotation.x = lerp(this.spine.rotation.x, spineX, Math.min(1, dt * 8));
    this.spine.rotation.y = -stride * 0.12 * walk + talk * Math.sin(ph * 1.3) * 0.08 * E;
    this.spine.position.y = 0.08 + (G?.lift ? G.lift * gw : 0);
    this.chest.scale.y = 1 + breathe * 1.6;

    // ---- legs
    for (const Lg of this.legs) {
      let hip, knee, out = -Lg.s * 0.03;
      if (sit) { hip = -1.5; knee = 1.45; out = -Lg.s * 0.1; }
      else if (bath) { hip = -1.3; knee = 0.5; }
      else {
        const p = this.walkPh + (Lg.s > 0 ? Math.PI : 0);
        // idle: the weight on one leg, the other knee a little soft
        const rest = Lg.s * Math.sin(ph * 0.45) > 0 ? 0.1 : 0.02;
        hip = lerp(0, -Math.sin(p) * 0.45, walk);
        knee = lerp(rest, Math.max(0, Math.sin(p + 1.3)) * 0.85 + 0.08, walk);
      }
      Lg.hp.rotation.x = lerp(Lg.hp.rotation.x, hip, Math.min(1, dt * 12));
      Lg.hp.rotation.z = out;
      Lg.kn.rotation.x = lerp(Lg.kn.rotation.x, knee, Math.min(1, dt * 12));
      Lg.an.rotation.x = -(Lg.hp.rotation.x + Lg.kn.rotation.x) * 0.8;
    }

    // ---- arms: the pose, then the hands while talking, then any gesture
    this.arms.forEach((A, i) => {
      const right = A.s > 0;
      let base;
      if (pose === 'counter' || pose === 'lectern') base = [-0.6, 0.12, -0.9];
      else if (sit) base = [-0.45, 0.1, -0.9];
      else if (bath) base = [0.3, 0.95, -0.95];           // along the rim of the tub
      else base = [Math.sin(ph * 0.9 + i) * 0.04, 0.1, -0.18];
      if (this.moving) base = [stride * A.s * 0.5 * walk, 0.1, -0.35];
      const b = this.beat[right ? 0 : 1];
      const tk = talk * (pose === 'counter' || bath ? 0.6 : 1) * (this.moving ? 0.3 : 1);
      let tgt = [lerp(base[0], b[0], tk), lerp(base[1], b[1], tk), lerp(base[2], b[2], tk)];
      if (G) {
        const gv = right ? G.R : G.L;
        if (gv) tgt = [lerp(tgt[0], gv[0], gw), lerp(tgt[1], gv[1], gw), lerp(tgt[2], gv[2], gw)];
      }
      const k = Math.min(1, dt * (G ? 10 : 6));
      A.cur[0] = lerp(A.cur[0], tgt[0], k);
      A.cur[1] = lerp(A.cur[1], tgt[1], k);
      A.cur[2] = lerp(A.cur[2], tgt[2], k);
      A.sh.rotation.x = A.cur[0];
      A.sh.rotation.z = A.s * A.cur[1];
      A.el.rotation.x = A.cur[2];
      A.hand.rotation.x = talk * Math.sin(ph * 4 + i) * 0.3;
    });

    // ---- the head: at you, nodding along when talking or being talked at
    let hx = talk * Math.sin(ph * 5.1) * 0.06 * E + (this.listening ? Math.max(0, Math.sin(ph * 1.7)) * 0.08 : 0);
    let hy = hd, hz = talk * Math.sin(ph * 2.2) * 0.05;
    if (bath) hx += 0.35;                // lying back, but looking at you
    if (G?.head) { hx += G.head[0] * gw; hy += G.head[1] * gw; hz += G.head[2] * gw; }
    const hk = Math.min(1, dt * 5);
    this.headPivot.rotation.x = lerp(this.headPivot.rotation.x, hx, hk);
    this.headPivot.rotation.y = lerp(this.headPivot.rotation.y, hy, hk);
    this.headPivot.rotation.z = lerp(this.headPivot.rotation.z, hz, hk);

    // ---- the face: the mouth works while they talk, the eyes blink
    let open = talk * Math.max(0, Math.sin(t * 13 + Math.sin(t * 4.7) * 2)) * 0.3;
    if (G?.jaw) open = Math.max(open, G.jaw * gw);
    this.jaw.rotation.x = open;
    this.mouthIn.scale.y = 0.05 + open * 3;
    this.blinkIn -= dt;
    let lid = 1;
    if (this.blinkIn < 0) { lid = 0.1; if (this.blinkIn < -0.12) this.blinkIn = 2 + Math.random() * 4; }
    this.eyes.forEach((e) => { e.scale.y = lid; });
    const browUp = talk * Math.max(0, Math.sin(ph * 2.6)) * 0.012 * E;
    this.brows.forEach((b) => { b.position.y = 0.152 + browUp; });

    // ---- the reveal
    const reveal = Math.min(1, s.perception * 1.25 + s.monster * 0.9 - 0.18);
    this.setMorph(Math.max(0, reveal));
    if (this.morph > 0.2) {
      const jaw = this.lizard.userData.jaw;
      if (jaw) jaw.rotation.x = Math.abs(Math.sin(ph * 2.3)) * 0.4 * this.morph + open;
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

    // Plain see-through glass. It was a physical material with
    // transmission, and one transmissive thing in view makes three draw
    // every opaque object in the building a second time, to have something
    // to refract -- the whole casino, twice a frame, for a 25cm vial.
    const glass = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.05, metalness: 0.1,
      transparent: true, opacity: 0.35, depthWrite: false,
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
const HAIR_COLS = [0x1a120c, 0x3a2412, 0x6a4422, 0xb89060, 0x8a8278, 0x2a1a10, 0xd8d4cc, 0x4a3018];

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
      bald: Math.random() < 0.12,
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
    // hair and shoes: without them they were shop-window mannequins
    const hairMat = new THREE.MeshStandardMaterial({ roughness: 0.9, emissive: 0x100c0a });
    this.hair = inst(new THREE.SphereGeometry(P.headR * 1.07, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat, n);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.5, emissive: 0x0a0808 });
    this.shoe = inst(new THREE.BoxGeometry(0.09, 0.06, 0.22), shoeMat, n * 2);

    const c = new THREE.Color();
    this.specs.forEach((s, i) => {
      const suit = SUIT_COLS[i % SUIT_COLS.length];
      const skin = SKIN_COLS[(i * 3) % SKIN_COLS.length];
      const leg = new THREE.Color(suit).multiplyScalar(0.7).getHex();
      this.head.setColorAt(i, c.setHex(skin));
      this.hair.setColorAt(i, c.setHex(HAIR_COLS[(i * 5 + 1) % HAIR_COLS.length]));
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
      // the hair sits on the head, and does not stretch into a snout
      sc.setScalar(e.bald ? 0 : B);
      this._off(0, (sit ? 0.05 : 0.02) - 0.012, yaw);
      p.set(e.x + this._ox, headY + 0.018 * B, e.z + this._oz);
      m.compose(p, q, sc);
      this.hair.setMatrixAt(i, m);

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
        const sd = this._seg(this.shin, i * 2 + k,
          kx, ky, kz, pitch + knee, 0, yaw, P.shin * B);
        // a shoe at the end of it, flat, pointing the way they face
        this._off(0, 0.05, yaw);
        p.set(kx + sd.x * P.shin * B + this._ox, ky + sd.y * P.shin * B - 0.03, kz + sd.z * P.shin * B + this._oz);
        q.setFromAxisAngle(UP, yaw);
        m.compose(p, q, ONE);
        this.shoe.setMatrixAt(i * 2 + k, m);
      }

      const dx = e.x - playerPos.x, dz = e.z - playerPos.z;
      const near = Math.exp(-(dx * dx + dz * dz) / 34);
      if (near > nearest) nearest = near;
    }

    [this.head, this.hair, this.neck, this.torso, this.upperArm, this.foreArm, this.thigh, this.shin, this.shoe]
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
