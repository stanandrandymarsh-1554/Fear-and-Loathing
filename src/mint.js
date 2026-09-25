/* ============================================================
   THE MINT 400 — the race you were sent to cover.

   The book's joke is that there was nothing to see: four hundred miles
   of motorcycles and dune buggies going round a loop of desert in a dust
   cloud so thick that from the pits you could not tell whether anything
   was out there at all. So that is the scene. A dirt oval, a rail, a
   press tent, a banner -- and dust, and the sound of engines going past
   somewhere in it.

   It is a memory: you get to it by sitting down at the typewriter in
   1850, and it is over when you have actually SEEN three of the machines
   with your own eyes, or when the morning runs out. How far you can see
   into the dust is PERCEPTION, which main.js turns into the fog; this
   file only builds the place, drives the racers round, and says which of
   them you were looking at when they came out of it.

   Built far out in +Z, in a place nothing else in the game can reach.
   ============================================================ */
import * as THREE from 'three';
import { makeVehicle } from './desert.js';

export const MINT = { x: 0, z: 1200 };
const STRAIGHT = 60;           // half the length of each straight
const R = 30;                  // the bends, and half the gap between the straights
const LAP = 4 * STRAIGHT + 2 * Math.PI * R;
const HALF_W = 4.5;            // half the width of the churned-up track
// the pits: the strip of desert behind the rail on the near straight
export const PITS = { x0: -48, x1: 48, z0: R + HALF_W + 1.6, z1: R + 32 };
export const MINT_SPAWN = { x: 0, z: R + 14 };

/** a point u metres round the loop from the near straight. heading is a
    rotation.y that points a -Z-forward model the way it is going */
function lapPoint(u, out) {
  u = ((u % LAP) + LAP) % LAP;
  const a = 2 * STRAIGHT, b = Math.PI * R;
  if (u < a) {                                  // the near straight, going -x
    out.x = STRAIGHT - u; out.z = R; out.heading = Math.PI / 2;
  } else if (u < a + b) {                       // round the far-left bend
    const t = (u - a) / R;
    out.x = -STRAIGHT - Math.sin(t) * R; out.z = Math.cos(t) * R; out.heading = Math.PI / 2 - t;
  } else if (u < 2 * a + b) {                   // the far straight, going +x
    out.x = -STRAIGHT + (u - a - b); out.z = -R; out.heading = -Math.PI / 2;
  } else {                                      // and round the right-hand bend home
    const t = (u - 2 * a - b) / R;
    out.x = STRAIGHT + Math.sin(t) * R; out.z = -Math.cos(t) * R; out.heading = -Math.PI / 2 - t;
  }
  return out;
}

function bannerTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = '#f2ead6'; g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#b3201a'; g.fillRect(0, 0, 512, 12); g.fillRect(0, 84, 512, 12);
  g.fillStyle = '#1b1b1b';
  g.font = 'bold 50px Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('THE MINT 400', 256, 50);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function plateTexture(n) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4f0e0'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#111';
  g.font = 'bold 40px Helvetica, Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 32, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// what you write down about each of them, if you see it
const RACERS = [
  { kind: 'bike', n: 23, color: 0xc0302a, what: 'a Husqvarna, stood up on the pegs, doing ninety into a wall of nothing' },
  { kind: 'buggy', n: 7, color: 0x2f7fc0, what: 'a Meyers Manx dune buggy, sideways, with both men in it screaming' },
  { kind: 'bike', n: 41, color: 0xe0b020, what: 'a yellow Bultaco with the rider looking straight at you through his goggles' },
  { kind: 'bike', n: 12, color: 0x2a8a3a, what: 'a Yamaha, and then the same Yamaha again, a lap later, now missing its front fender' },
  { kind: 'buggy', n: 88, color: 0xe06a1a, what: 'a Volkswagen buggy on three wheels and a prayer' },
  { kind: 'bike', n: 5, color: 0xf0f0f0, what: 'a white Triumph going the wrong way round, as far as anyone could tell' },
];

export function buildMint(scene) {
  const group = new THREE.Group();
  group.position.set(MINT.x, 0, MINT.z);
  group.visible = false;
  scene.add(group);
  const mat = (o) => new THREE.MeshStandardMaterial(o);
  const add = (geo, m, x, y, z, parent = group) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o;
  };
  let seed = 400;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  // ---- the air, which is the whole point
  const fog = new THREE.FogExp2(0xcdb08a, 0.1);

  // ---- light: a flat white morning sun through the dust
  group.add(new THREE.HemisphereLight(0xf3e2c0, 0x8a6a4a, 1.7));
  const sun = new THREE.DirectionalLight(0xffe6c0, 1.4);
  sun.position.set(-40, 80, 30);
  group.add(sun, sun.target);

  // ---- the ground: flat hardpan, faintly mottled
  {
    const geo = new THREE.PlaneGeometry(700, 700, 70, 70);
    geo.rotateX(-Math.PI / 2);
    const P = geo.attributes.position, col = new Float32Array(P.count * 3);
    const a = new THREE.Color(0xc8a676), b = new THREE.Color(0xb08c5c), c = new THREE.Color();
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i);
      c.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(x * 0.13 + z * 0.07) * Math.sin(x * 0.05 - z * 0.11));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    add(geo, mat({ vertexColors: true, roughness: 1 }), 0, 0, 0);
  }

  // ---- the track: a ribbon of churned dirt round the loop
  {
    const N = 160, p = {}, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      lapPoint((i / N) * LAP, p);
      // across the track: the heading is the direction of travel
      const nx = Math.cos(p.heading), nz = -Math.sin(p.heading);
      pos.push(p.x + nx * HALF_W, 0.03, p.z + nz * HALF_W, p.x - nx * HALF_W, 0.03, p.z - nz * HALF_W);
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    add(geo, mat({ color: 0x8a6a48, roughness: 1, side: THREE.DoubleSide }), 0, 0, 0);
  }

  // ---- the rail you watch from, and the pits behind it
  const wood = mat({ color: 0x8a6a4a, roughness: 0.95 });
  const railZ = PITS.z0 - 0.4;
  for (let x = -50; x <= 50; x += 3.2) add(new THREE.BoxGeometry(0.16, 1.1, 0.16), wood, x, 0.55, railZ);
  add(new THREE.BoxGeometry(100.4, 0.12, 0.1), wood, 0, 1.0, railZ);
  add(new THREE.BoxGeometry(100.4, 0.1, 0.08), wood, 0, 0.55, railZ);
  // the banner over the pits, on two poles
  const pole = mat({ color: 0x5a5a5a, roughness: 0.6, metalness: 0.3 });
  [-9, 9].forEach((x) => add(new THREE.CylinderGeometry(0.1, 0.1, 6, 8), pole, x, 3, railZ + 1.2));
  add(new THREE.PlaneGeometry(17, 2.2), new THREE.MeshBasicMaterial({ map: bannerTexture(), side: THREE.DoubleSide }),
    0, 5.0, railZ + 1.2);
  // the press tent: a striped canopy, a trestle table, nobody under it
  const canvasM = mat({ color: 0xe9e0c8, roughness: 0.9 }), stripe = mat({ color: 0xb3201a, roughness: 0.9 });
  add(new THREE.BoxGeometry(8, 0.15, 6), canvasM, -20, 3.0, 50);
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.9, 0.16, 6.02), stripe, -23 + i * 2, 3.0, 50);
  [[-23.8, 47.2], [-16.2, 47.2], [-23.8, 52.8], [-16.2, 52.8]].forEach(([x, z]) =>
    add(new THREE.BoxGeometry(0.1, 3, 0.1), pole, x, 1.5, z));
  add(new THREE.BoxGeometry(4, 0.08, 1.2), wood, -20, 0.8, 50);
  [[-21.6, 49.6], [-18.4, 49.6], [-21.6, 50.4], [-18.4, 50.4]].forEach(([x, z]) =>
    add(new THREE.BoxGeometry(0.06, 0.8, 0.06), wood, x, 0.4, z));
  // the teams' trucks, parked any old how
  [[18, 52, 0.4, 0x6a4a3a], [26, 56, -0.2, 0x3a5a6a], [34, 50, 1.1, 0x8a8a70]].forEach(([x, z, r, c]) => {
    const v = makeVehicle('pickup', c);
    v.position.set(x, 0, z); v.rotation.y = r;
    group.add(v);
  });
  // and a few oil drums, because every pit has oil drums
  const drum = mat({ color: 0x3a4a5a, roughness: 0.6, metalness: 0.3 });
  for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), drum, 8 + rnd() * 30, 0.45, 42 + rnd() * 14);

  // ---- the racers
  const racers = RACERS.map((def, i) => {
    const g = new THREE.Group();
    const paint = mat({ color: def.color, roughness: 0.5 });
    const dark = mat({ color: 0x1a1616, roughness: 0.8 });
    const rider = mat({ color: 0xd8d0c0, roughness: 0.8 });
    const plate = new THREE.MeshBasicMaterial({ map: plateTexture(def.n) });
    const tyre = new THREE.CylinderGeometry(def.kind === 'bike' ? 0.34 : 0.42, def.kind === 'bike' ? 0.34 : 0.42, 0.2, 10);
    if (def.kind === 'bike') {
      add(new THREE.BoxGeometry(0.35, 0.45, 1.5), paint, 0, 0.7, 0, g);
      add(tyre, dark, 0, 0.34, -0.7, g).rotation.z = Math.PI / 2;
      add(tyre, dark, 0, 0.34, 0.7, g).rotation.z = Math.PI / 2;
      add(new THREE.BoxGeometry(0.4, 0.75, 0.35), rider, 0, 1.35, 0.1, g);      // the rider
      add(new THREE.SphereGeometry(0.2, 8, 6), paint, 0, 1.9, 0, g);            // his helmet
      const pl = add(new THREE.PlaneGeometry(0.34, 0.34), plate, 0.19, 0.8, -0.3, g); pl.rotation.y = Math.PI / 2;
      const pr = add(new THREE.PlaneGeometry(0.34, 0.34), plate, -0.19, 0.8, -0.3, g); pr.rotation.y = -Math.PI / 2;
    } else {
      add(new THREE.BoxGeometry(1.6, 0.45, 3.0), paint, 0, 0.7, 0, g);
      [[-0.85, -1.1], [0.85, -1.1], [-0.85, 1.1], [0.85, 1.1]].forEach(([x, z]) => { add(tyre, dark, x, 0.42, z, g).rotation.z = Math.PI / 2; });
      // the roll cage and the two men in it
      [[-0.7, 0.4], [0.7, 0.4]].forEach(([x, z]) => add(new THREE.BoxGeometry(0.08, 1.0, 0.08), pole, x, 1.4, z, g));
      add(new THREE.BoxGeometry(1.5, 0.08, 0.08), pole, 0, 1.9, 0.4, g);
      [-0.35, 0.35].forEach((x) => add(new THREE.SphereGeometry(0.2, 8, 6), rider, x, 1.5, 0.2, g));
      const pl = add(new THREE.PlaneGeometry(0.5, 0.5), plate, 0.81, 0.75, 0, g); pl.rotation.y = Math.PI / 2;
      const pr = add(new THREE.PlaneGeometry(0.5, 0.5), plate, -0.81, 0.75, 0, g); pr.rotation.y = -Math.PI / 2;
    }
    // the rooster tail: three puffs of dust, trailing
    const puffM = new THREE.MeshBasicMaterial({ color: 0xd6bc94, transparent: true, opacity: 0.45, depthWrite: false });
    const puffs = [0, 1, 2].map((k) => add(new THREE.SphereGeometry(0.9 + k * 0.5, 8, 6), puffM, 0, 0.8 + k * 0.3, 1.6 + k * 1.6, g));
    g.rotation.order = 'YXZ';
    group.add(g);
    return { def, g, puffs, u: i * (LAP / RACERS.length) + rnd() * 20,
      v: 23 + rnd() * 8, lane: (rnd() - 0.5) * 5, seen: false, near: false };
  });

  // ---- dust hanging in the air round you, drifting
  const DUST = 700;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (rnd() - 0.5) * 40; dustPos[i * 3 + 1] = rnd() * 6; dustPos[i * 3 + 2] = (rnd() - 0.5) * 40;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe0c89c, size: 0.09, transparent: true, opacity: 0.8, depthWrite: false }));
  dust.frustumCulled = false;
  group.add(dust);

  const p = {}, toR = new THREE.Vector3();
  return {
    group, fog, racers,
    show() { group.visible = true; },
    hide() { group.visible = false; },
    /* Drive them round. Returns what happened this frame:
         seen   racers that came out of the dust in front of you, first time
         passes racers that went by close, for the engine noise
       @param eye   the camera's world position
       @param fwd   the camera's world forward (unit)
       @param see   how far you can see into the dust, metres */
    update(dt, clock, eye, fwd, see) {
      const seen = [], passes = [];
      for (const r of racers) {
        r.u += r.v * dt;
        lapPoint(r.u, p);
        // lanes wander, the way they do when nobody can see the lines
        const lane = r.lane + Math.sin(clock * 0.7 + r.def.n) * 1.2;
        const nx = Math.cos(p.heading), nz = -Math.sin(p.heading);
        r.g.position.set(p.x + nx * lane, 0, p.z + nz * lane);
        r.g.rotation.y = p.heading;
        // bikes lean into the bends; everything bounces
        const uu = ((r.u % LAP) + LAP) % LAP, a = 2 * STRAIGHT, b = Math.PI * R;
        const bend = (uu > a && uu < a + b) || uu > 2 * a + b;
        r.g.rotation.z = r.def.kind === 'bike' && bend ? 0.35 : 0;
        r.g.position.y = Math.abs(Math.sin(clock * 9 + r.def.n)) * 0.12;
        r.puffs.forEach((m, k) => { m.scale.setScalar(1 + 0.25 * Math.sin(clock * 6 + k * 2 + r.def.n)); });

        toR.set(MINT.x + r.g.position.x - eye.x, 0, MINT.z + r.g.position.z - eye.z);
        const d = toR.length();
        const facing = d > 0.01 ? (toR.x * fwd.x + toR.z * fwd.z) / (d * Math.hypot(fwd.x, fwd.z) || 1) : 1;
        if (!r.seen && d < see && facing > 0.72) { r.seen = true; seen.push(r); }
        if (!r.near && d < 26) { r.near = true; passes.push({ r, d, toR: toR.clone() }); }
        else if (r.near && d > 34) r.near = false;
      }
      // the air moves; the dust goes with it, and stays round your head
      const P = dustGeo.attributes.position;
      const lx = eye.x - MINT.x, lz = eye.z - MINT.z;
      for (let i = 0; i < DUST; i++) {
        let x = P.getX(i) + dt * 3.2, y = P.getY(i) + Math.sin(clock + i) * dt * 0.2, z = P.getZ(i) + dt * 0.8;
        if (x > lx + 20) x -= 40; if (x < lx - 20) x += 40;
        if (z > lz + 20) z -= 40; if (z < lz - 20) z += 40;
        if (y < 0) y += 6; if (y > 6) y -= 6;
        P.setXYZ(i, x, y, z);
      }
      P.needsUpdate = true;
      return { seen, passes };
    },
    reset() { racers.forEach((r) => { r.seen = false; r.near = false; }); },
  };
}
