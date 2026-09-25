/* ============================================================
   MAIN — renderer, the body you are driving, and the wiring.
   ============================================================ */

import * as THREE from 'three';
import { buildWorld } from './world.js';
import { buildSuite, SUITE } from './suite.js';
// (one line: build.rb rewrites imports line by line)
import { buildDesert, ROAD, DRIVER_SEAT, makeCar, makeVehicle, makePatrolCar, damageCar, roadY, roadHeading, roadSlope, lateral, roadPoint, COURT, TOWN, inCourt } from './desert.js';
import { buildConvention, CONV } from './convention.js';
import { NPC, Hallucination, Briefcase, Pickup, BatSwarm, Crowd } from './npc.js';
import { Post } from './post.js';
import { Audio } from './audio.js';
import { Game, SUBSTANCES, STORY_COMPOSURE } from './game.js';
import { touch, initTouch, askForMotion, sampleTouch, resetTouch } from './touch.js';
import { buildMint, MINT, PITS, MINT_SPAWN } from './mint.js';

// defaults match game.js: a one-argument call here returned NaN, which is
// how running the car off the road froze the whole game
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ---------------------------------------------------- setup */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
camera.rotation.order = 'YXZ';

const world = buildWorld(scene);
// Fog belongs to the Scene. The casino was setting it on its own Group,
// where three ignores it, so each act sets its own here instead.
const FOG = {
  // the casino's own fog object, which world.update thickens with fear
  1: world.root.fog,
  2: null,
  3: new THREE.FogExp2(0xd9c4a8, 0.0013),
  4: null,
};
scene.fog = FOG[1];
// Room 1850 is built at the same time as the casino and simply kept
// hidden. It sits far out in +X so nothing about it can reach the floor.
const suite = buildSuite(scene);
// and the Mint 400, which is only ever a memory, far out in +Z
const mint = buildMint(scene);
FOG[5] = mint.fog;
const SUITE_X = 300;
suite.group.position.x = SUITE_X;
// The highway is the road outside the hotel. It starts under the parked
// car on the kerb and runs south from there, so pulling away and driving
// are one unbroken line -- there is no street to cross and no hand-off.
const desert = buildDesert(scene);
const DESERT_X = world.frontage.car.x;   // road centreline, at the parked car
const DESERT_Z = world.frontage.car.z;   // road starts right under the car
desert.group.position.set(DESERT_X, 0, DESERT_Z);
// The road bends and climbs now, so "how far off it am I" and "which way
// does it run here" are questions for the centreline, not for DESERT_X.
const latOf = (x, z) => lateral(x - DESERT_X, z - DESERT_Z);
/** a heading measured against the road's own direction at z, in -PI..PI */
function relHeading(h, z) {
  let d = h - roadHeading(z - DESERT_Z);
  while (d > Math.PI) d -= 6.283;
  while (d < -Math.PI) d += 6.283;
  return d;
}
// The convention wing: act four. Kept hidden like the suite, and hung 300m
// out in -X, the one direction nothing else in the game uses.
const conv = buildConvention(scene);
const CONV_X = -300;
conv.group.position.x = CONV_X;
// the car is a state, not an object: speed, and how hard you are turning
const car = { speed: 0, offRoad: 0, arrived: false, parked: false, returning: false,
              pos: new THREE.Vector3(),
              // null on foot, 'road' once you are behind the wheel
              stage: null, travelled: 0, heading: 0 };
// ...and the same car, parked out front of the hotel where you left it
const hotelCar = makeCar();
{
  const at = world.frontage.car;
  hotelCar.position.set(at.x, 0, at.z);
  hotelCar.rotation.y = at.yaw;
  world.root.add(hotelCar);
}
const post = new Post(renderer, scene, camera);

/* ------------------------------------------------ the light pool
   Every point light in the scene is paid for by every lit pixel on screen,
   every frame, however far away it is -- that is how a forward renderer
   works. The lobby, the lounge and the pavement had grown ten lights of
   their own between them, and the frame rate went with them. Instead
   three lights follow you round the building: in the lounge they are its
   blue gels and the lamp over the bar, out front they are the canopy's
   wash and the street, in the lobby the chandeliers, on the floor the
   lamps over the pits. The count never changes, so nothing recompiles. */
const ZONE_LIGHTS = {
  lobby:  [[1, 5.2, -43, 0xffd9a0, 120], [12, 5.2, -43, 0xffd0a0, 50], [-13, 6.6, -44, 0xff9a20, 420]],
  elevators: [[0, 5.4, 44, 0xb6ff2e, 400], [0, 5.0, 34, 0xa03cff, 120]],
  lounge: [[23.5, 3.6, -48, 0x3a6cff, 40], [25, 3.6, -38, 0x3a6cff, 40], [31.6, 3.0, -44, 0xffb060, 26]],
  front:  [[-12, 4.8, -60.5, 0xffc27a, 90], [4, 4.8, -60.5, 0xffc27a, 90], [0, 7, -90, 0xffb070, 90]],
  floor:  [[19, 5.0, 0, 0xfff0d0, 45], [-19.5, 5.0, 0, 0xfff0d0, 40]],
};
const zonePool = [0, 1, 2].map(() => {
  const L = new THREE.PointLight(0xffffff, 0, 0, 2);
  world.root.add(L);
  return L;
});
let zoneNow = null;
function updateZoneLights(p) {
  const F = world.frontage, L = world.lounge;
  const z = p.z < F.PAVE_Z + 1.5 ? 'front'
    : (p.x > 14 && p.z > L.Z0 && p.z < L.Z1) ? 'lounge'
    : p.z < -30 ? 'lobby' : p.z > 30 ? 'elevators' : 'floor';
  if (z === zoneNow) return;
  zoneNow = z;
  zonePool.forEach((light, i) => {
    const d = ZONE_LIGHTS[z][i];
    if (!d) { light.intensity = 0; return; }
    light.position.set(d[0], d[1], d[2]);
    light.color.setHex(d[3]);
    light.intensity = d[4];
  });
}

/* ------------------------------------------------ static batching
   Anything that never moves is baked into one mesh per material -- but per
   16m CHUNK of floor, not per building. One mesh per material for the whole
   casino meant a single object whose bounds covered everything, which the
   camera could never cull: looking at a wall still drew the lounge, the
   pits and the pavement behind you. Chunks keep the draw count low AND let
   frustum culling throw away whatever is behind you.
   It also reaches inside groups now. It used to take only the top level,
   so every sofa, chandelier, table and car -- all built as groups -- was
   still a separate draw per part, a couple of hundred of them.
   Things that move as one piece (the carousel, the trapeze, a sliding door,
   a car) are marked rigid and batched inside themselves; things that move
   on their own (a steering wheel, a bobbing float) are marked dynamic and
   left alone. */
const CHUNK = 32;
// materials with less geometry than this are one batch for the whole building:
// splitting a handful of brass rails into chunks costs more draws than it culls
const CHUNK_MIN_VERTS = 6000;
function batchStatic(root) {
  root.updateMatrixWorld(true);
  const bodies = [root];
  root.traverse((o) => { if (o !== root && o.userData.rigid) bodies.push(o); });
  let before = 0, after = 0;
  const M = new THREE.Matrix4(), inv = new THREE.Matrix4(), nm = new THREE.Matrix3();
  const v = new THREE.Vector3(), wp = new THREE.Vector3();

  for (const body of bodies) {
    inv.copy(body.matrixWorld).invert();
    const buckets = new Map();
    // walk the body's own subtree, stopping at anything that moves separately
    const visit = (o) => {
      for (const c of o.children) {
        if (!c.visible || c.userData.dynamic || c.userData.rigid) continue;
        if (c.isMesh && !c.isInstancedMesh && !c.isSkinnedMesh && c.children.length === 0
            && c.renderOrder === 0 && c.frustumCulled && !Array.isArray(c.material)
            && c.geometry.attributes.position && c.matrixWorld.determinant() > 0) {
          c.getWorldPosition(wp);
          const cell = body === root
            ? Math.floor(wp.x / CHUNK) + ':' + Math.floor(wp.z / CHUNK) : '';
          const key = c.material.uuid + '|' + cell;
          if (!buckets.has(key)) buckets.set(key, { material: c.material, list: [] });
          buckets.get(key).list.push(c);
        } else if (!c.isLight && !c.isCamera) {
          visit(c);
        }
      }
    };
    visit(body);
    // re-key small materials into a single building-wide batch
    if (body === root) {
      const perMat = new Map();
      for (const b of buckets.values()) {
        const n = b.list.reduce((a, o) => a + o.geometry.attributes.position.count, 0);
        perMat.set(b.material, (perMat.get(b.material) || 0) + n);
      }
      for (const [key, b] of [...buckets]) {
        if (perMat.get(b.material) >= CHUNK_MIN_VERTS) continue;
        buckets.delete(key);
        const k = b.material.uuid + '|all';
        if (!buckets.has(k)) buckets.set(k, { material: b.material, list: [] });
        buckets.get(k).list.push(...b.list);
      }
    }

    for (const { material, list } of buckets.values()) {
      before += list.length;
      if (list.length < 2) { after += list.length; continue; }
      after += 1;
      let nv = 0, ni = 0;
      for (const o of list) {
        const g = o.geometry;
        nv += g.attributes.position.count;
        ni += g.index ? g.index.count : g.attributes.position.count;
      }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
      const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      let vo = 0, io = 0;
      for (const o of list) {
        const g = o.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
        M.multiplyMatrices(inv, o.matrixWorld);
        nm.getNormalMatrix(M);
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(M);
          pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
          if (N) {
            v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
            nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
          }
          if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
        }
        if (g.index) for (let k = 0; k < g.index.count; k++) idx[io++] = g.index.getX(k) + vo;
        else for (let k = 0; k < P.count; k++) idx[io++] = k + vo;
        vo += P.count;
      }
      list.forEach((o) => o.parent.remove(o));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      body.add(new THREE.Mesh(geo, material));
    }
  }
  return { before, after };
}
const merged = { casino: batchStatic(world.root), suite: batchStatic(suite.group),
                 desert: batchStatic(desert.group), convention: batchStatic(conv.group) };

/* ------------------------------------------------ the other traffic
   Three vehicles on the whole road, always in the other lane and always
   coming at you: a rig, a wagon, a pickup. Stay on your own side and they
   are scenery. Drift over the centre line on ether and the horn is the
   last thing you hear. Added after the batching, because they move. */
const traffic = ['rig', 'wagon', 'pickup'].map((kind, i) => {
  const mesh = makeVehicle(kind);
  mesh.visible = false;
  desert.group.add(mesh);
  return { mesh, s: 0, v: 21 + i * 3, active: false, honked: false, cool: 5 + i * 11 };
});
const LANE = 2.6;
const tp = {};
function clearTraffic() {
  traffic.forEach((V) => { V.active = false; V.mesh.visible = false; });
}
/* ------------------------------------------------ the highway patrol
   The book's stop on the road out: somewhere in the empty middle of the
   drive a black-and-white comes up behind you with its lamps going. Stop
   -- anywhere, the shoulder or the lane, however hard -- and he pulls in
   behind you and walks up to the window. Keep going and he sits on your
   bumper for half a minute, then drops back to his radio. Once a game: a
   wreck on the way out before he has had his word puts him back on the
   road for next time. */
const COP_AT = 1150;                 // metres out of town when he finds you
const COP_GIVES_UP = 30;             // seconds of not stopping
const cop = { state: 'idle', s: 0, lat: LANE, v: 0, t: 0, siren: 0, mesh: makePatrolCar(), walk: null };
cop.mesh.visible = false;
desert.group.add(cop.mesh);
// (the patrolman himself is built with the rest of the cast, further down)
function copReset() {
  if (cop.state !== 'done') {
    cop.state = 'idle';
    game.resetTask('chp');
  }
  cop.mesh.visible = false;
  patrolman.group.visible = false;
}
function placeCop() {
  roadPoint(cop.s, cop.lat, tp);
  cop.mesh.position.set(tp.x, tp.y, tp.z);
  cop.mesh.rotation.y = tp.heading;
  cop.mesh.rotation.x = Math.atan(tp.slope);
}
/** outbound only. Returns true while he has you stopped. */
function updateCop(dt) {
  const ps = -(car.pos.z - DESERT_Z);
  const plat = latOf(car.pos.x, car.pos.z);
  if (cop.state === 'idle') {
    if (ps < COP_AT || car.final || car.speed < 8) return false;
    cop.state = 'chase';
    cop.s = ps - 100; cop.lat = plat; cop.v = car.speed + 14; cop.t = 0; cop.siren = 0;
    cop.mesh.visible = true;
    // the other lane is his for this: nobody coming the other way
    clearTraffic();
    game.activate('chp');
    game.fear = clamp(game.fear + 0.12);
    game.say('Red lamps in the mirror, coming up fast. Highway patrol. '
      + 'Stop the car -- or see how far he wants it.', null, 7);
  }
  // the lamps take turns, whatever he is doing
  const lit = Math.floor(clock * 5) % 2;
  cop.mesh.userData.lamps[0].color.setHex(lit ? 0xff2a1a : 0x400808);
  cop.mesh.userData.lamps[1].color.setHex(lit ? 0x400808 : 0xff2a1a);
  if (cop.state === 'chase') {
    cop.t += dt;
    const gap = ps - cop.s;
    // Closes fast from a distance and sits on your bumper. You cannot turn
    // round far enough in the seat to see him there, so after a few
    // seconds of that he pulls out and comes up alongside, in the other
    // lane, where he is at the edge of the windscreen with his lamps going.
    const beside = cop.t > 5 && gap < 30;
    const stay = beside ? -1.5 : 12;
    const want = car.speed + clamp((gap - stay) * 0.7, -6, 20);
    cop.v += clamp(want - cop.v, -9 * dt, 9 * dt);
    cop.s += Math.max(0, cop.v) * dt;
    const wantLat = beside ? plat - 3.8 : plat;
    cop.lat += (wantLat - cop.lat) * Math.min(1, dt * 1.2);
    // and never through you
    if (Math.abs(cop.lat - plat) < 2.4 && ps - cop.s < 11) cop.s = ps - 11;
    cop.siren -= dt;
    if (cop.siren <= 0) {
      cop.siren = 1.8;
      audio.siren(0.1 / (1 + Math.max(0, gap - 10) * 0.02), 0);
    }
    placeCop();
    if (car.speed < 0.5 && gap < 60) {
      // stopped. He rolls up behind you and gets out.
      cop.state = 'pull'; cop.t = 0;
      game.say('He pulls in behind you. The door opens. The door shuts.', null, 4);
    } else if (cop.t > COP_GIVES_UP) {
      cop.state = 'gone'; cop.t = 0;
      game.copRan = true;
      game.fear = clamp(game.fear + 0.2);
      game.loathing = clamp(game.loathing + 0.08);
      game.completeTask('chp');
      game.say('The lamps fall back, and then they go out. He has a radio, though, '
        + 'and yours is the only red convertible in the state.', null, 7);
    }
    return false;
  }
  if (cop.state === 'pull') {
    cop.t += dt;
    // he drops back and tucks in behind you, where a patrol car stops
    const target = ps - 11;
    cop.s += (target - cop.s) * Math.min(1, dt * 1.6);
    cop.lat += (plat - cop.lat) * Math.min(1, dt * 1.6);
    placeCop();
    // then the door, and he walks up the side of your car to the window
    if (cop.t > 1.4) {
      const P = patrolman.group;
      if (!P.visible) {
        copPoint(cop.mesh.position, cop.mesh.rotation.y, -1.25, -0.3, P.position);
        P.position.y = cop.mesh.position.y;
        P.visible = true;
        audio.door();
      }
      const to = copPoint(desert.car.position, car.heading, -1.85, 0.25, _copTo);
      if (walkTo(P, to, 1.35, dt) || cop.t > 12) {
        if (!game.dlg) { cop.state = 'talk'; game.openDialogue('chp'); }
      }
    }
    return true;
  }
  if (cop.state === 'talk') {
    if (game.dlg) return true;
    // however it ended -- even saying nothing until he gave up on you
    game.completeTask('chp');
    cop.state = 'done'; cop.t = 0;
    return false;
  }
  if (cop.state === 'gone') {
    cop.t += dt;
    cop.v = Math.max(0, cop.v - 6 * dt);
    cop.s += cop.v * dt;
    placeCop();
    if (ps - cop.s > 400) { cop.mesh.visible = false; cop.state = 'done'; }
    return false;
  }
  // done: he walks back to his car and gets in, and it stays parked where
  // he stopped you until it is out of sight
  if (patrolman.group.visible) {
    const back = copPoint(cop.mesh.position, cop.mesh.rotation.y, -1.25, -0.3, _copTo);
    if (walkTo(patrolman.group, back, 1.4, dt)) { patrolman.group.visible = false; audio.door(); }
  }
  if (cop.mesh.visible && ps - cop.s > 400) { cop.mesh.visible = false; patrolman.group.visible = false; }
  return false;
}
const _copTo = new THREE.Vector3();
/** a point beside a car (desert-local): across (-x is the driver's side) and along (-z is forward) */
function copPoint(at, heading, across, along, out) {
  const c = Math.cos(heading), sn = Math.sin(heading);
  out.set(at.x + across * c + along * sn, at.y, at.z - across * sn + along * c);
  return out;
}
/** move a group toward a point at a walking pace; true once it is there */
function walkTo(g, to, speed, dt) {
  const dx = to.x - g.position.x, dz = to.z - g.position.z, d = Math.hypot(dx, dz);
  if (d < 0.08) return true;
  const k = Math.min(1, (speed * dt) / d);
  g.position.x += dx * k; g.position.z += dz * k;
  g.position.y += (to.y - g.position.y) * Math.min(1, dt * 4);
  return d - speed * dt < 0.08;
}

/** @param dir +1 driving out (south), -1 driving back. Returns true on a crash. */
function updateTraffic(dt, dir) {
  const ps = -(car.pos.z - DESERT_Z);
  const plat = latOf(car.pos.x, car.pos.z);
  for (const V of traffic) {
    if (!V.active) {
      V.cool -= dt;
      if (V.cool > 0 || car.speed < 6 || cop.state === 'chase' || cop.state === 'pull' || cop.state === 'talk') continue;
      const s = ps + dir * (420 + Math.random() * 280);
      // never in town, and never in the motel lot
      if (s < 320 || s > ROAD.length - 320) { V.cool = 3; continue; }
      // spaced out, not in convoy
      if (traffic.some((o) => o.active && Math.abs(o.s - s) < 180)) { V.cool = 2; continue; }
      V.s = s; V.active = true; V.honked = false; V.mesh.visible = true;
    }
    V.s -= dir * V.v * dt;
    // they belong to the open road: one heading for town turns off before
    // it gets there, instead of driving on into the hotel's motor court
    if (V.s < TOWN.s1 + 30 || V.s > ROAD.length - 300) {
      V.active = false; V.mesh.visible = false; V.cool = 4 + Math.random() * 10;
      continue;
    }
    // the lane on your left, which is theirs
    const lat = -dir * LANE;
    roadPoint(V.s, lat, tp);
    const heading = tp.heading + (dir > 0 ? Math.PI : 0);
    V.mesh.position.set(tp.x, tp.y, tp.z);
    V.mesh.rotation.y = heading;
    V.mesh.rotation.x = Math.atan(tp.slope * Math.cos(heading - tp.heading));
    const ahead = (V.s - ps) * dir;
    const gapLat = Math.abs(lat - plat);
    const half = V.mesh.userData.halfW + 1.0;
    if (!V.honked && ahead > 0 && ahead < 95 && gapLat < half + 0.8) {
      V.honked = true;
      audio.horn(0.13, clamp(-(lat - plat) * dir * 0.3, -0.8, 0.8));
      game.fear = clamp(game.fear + 0.1);
    }
    if (Math.abs(ahead) < V.mesh.userData.len / 2 + 2.7 && gapLat < half) {
      game.crash('traffic');
      return true;
    }
    if (ahead < -60) { V.active = false; V.mesh.visible = false; V.cool = 6 + Math.random() * 16; }
  }
  return false;
}
const audio = new Audio();
const game = new Game(audio);
const bats = new BatSwarm(scene);

/* ------------------------------------ the four that matter */
// reach is per-NPC: anyone behind a counter you cannot walk through
// has to be talkable from the far side of it
// He works the inside of the ring, on the lobby side of it, which is the
// side you walk in from -- so he is standing there when you arrive rather
// than somewhere round the back of a turning bar.

const npcs = [
  new NPC({ id: 'clerk', name: 'SWAN', x: -18.8, z: -43, ry: Math.PI / 2, reach: 5.2,
            skin: 0xd8b08c, suit: 0x3c1a44, tint: 0xffb400, look: 'clerk', pose: 'counter' }),
  new NPC({ id: 'dealer', name: 'THE MAN AT THE BAR', x: 0, z: -4.4, ry: Math.PI, reach: 5.0,
            skin: 0x8a6244, suit: 0x1e2a33, tint: 0x12e2e2, look: 'bartender', pose: 'counter' }),
  // at the nautical bar, among the lizards, where the film has him
  new NPC({ id: 'attorney', name: 'YOUR ATTORNEY', x: 29.9, z: -44.6, ry: Math.PI / 2, reach: 3.8,
            skin: 0xb07a52, suit: 0x6a2020, tint: 0xff2d1f, scale: 1.06, look: 'attorney' }),
  new NPC({ id: 'security', name: 'HOUSE SECURITY', x: 3.0, z: 34, ry: Math.PI, reach: 4.2,
            skin: 0xc09070, suit: 0x252525, tint: 0xb6ff2e, scale: 1.12, look: 'security' }),
  // the parking attendant out front: "I'll remember your face."
  new NPC({ id: 'valet', name: 'THE PARKING ATTENDANT', x: 1.3, z: world.frontage.PAVE_Z - 1.7,
            ry: Math.PI, reach: 3.0, skin: 0xb08a6a, suit: 0x7a1420, tint: 0xffb400, halo: 0, look: 'valet' }),
];
npcs.forEach((n) => scene.add(n.group));

// Act two's cast. Built now, added to the scene only when the lift lands,
// and positioned in suite-local coordinates offset by SUITE_X.
// y: he is IN the bath, not standing next to it -- only head and shoulders dry
const gonzo = new NPC({ id: 'gonzo', name: 'YOUR ATTORNEY',
  x: 300 - 3.2, z: -7.5, y: -0.85, ry: 0, reach: 3.0, halo: 0.15,
  skin: 0xc08a60, suit: 0x33202a, tint: 0xff2d1f, look: 'bath', pose: 'bath' });
const maid = new NPC({ id: 'maid', name: 'HOUSEKEEPING',
  x: 300 - 6.9, z: 0, ry: Math.PI / 2, reach: 2.8, halo: 0,
  skin: 0xd8b08c, suit: 0x8fa0a8, tint: 0xb6ff2e, look: 'maid' });
// she knocks, waits, is dealt with, and then she GOES: down the corridor
// and out of sight, and the door shuts behind her
const maidState = { phase: 'away', t: 0 };   // away | here | leaving | gone

// Act four's cast, in world coordinates (convention-local + CONV_X).
const registrar = new NPC({ id: 'registrar', name: 'REGISTRATION',
  x: CONV_X + CONV.registrar.x, z: CONV.registrar.z, ry: Math.PI / 2, reach: 3.2, halo: 0.4,
  skin: 0xd8b08c, suit: 0x1f3a5a, tint: 0xffb400, look: 'registrar', pose: 'counter' });
// your attorney, in the foyer with supplies, and at the urn after the keynote
const gonzoC = new NPC({ id: 'gonzo4', name: 'YOUR ATTORNEY',
  x: CONV_X + 4.6, z: 16.2, ry: -Math.PI / 2, reach: 3.0, halo: 0.5,
  skin: 0xb07a52, suit: 0x6a2020, tint: 0xff2d1f, scale: 1.06, look: 'attorney' });
const GONZO_AT_URN = new THREE.Vector3(CONV_X + CONV.urn.x - 2.6, 0, CONV.urn.z - 1.0);
const georgiaDA = new NPC({ id: 'georgia', name: 'THE DELEGATE FROM GEORGIA',
  x: CONV_X + CONV.urn.x - 1.1, z: CONV.urn.z - 1.2, ry: Math.PI, reach: 3.0, halo: 0.5,
  skin: 0xe0b090, suit: 0x8a8070, tint: 0xb6ff2e, scale: 1.1, look: 'georgia' });
// he stands on the stage, which is 0.7m up, behind the lectern and off to
// one side of the screen so the slides are not projected onto his face
const keynote = new NPC({ id: 'keynote', name: 'DR. BUMQUIST',
  x: CONV_X - 1.2, z: -14.25, y: 0.7, ry: 0, halo: 0.8,
  skin: 0xd8b8a0, suit: 0x2a2a38, tint: 0x9ab0ff, look: 'keynote', pose: 'lectern' });
const convCast = [registrar, gonzoC, georgiaDA, keynote];
// your attorney in the passenger seat, for the last morning: he rides in
// whichever car is showing, parked at the kerb or out on the road
const carGonzo = new NPC({ id: 'gonzoCar', name: 'YOUR ATTORNEY', x: 0.43, z: 0.5, ry: Math.PI,
  halo: 0, skin: 0xb07a52, suit: 0x6a2020, tint: 0xff2d1f, look: 'attorney', pose: 'sit', seatY: 0.42, turns: false });
carGonzo.group.visible = false;
// the highway patrolman, who gets out and walks up to your window
const patrolman = new NPC({ id: 'patrol', name: 'THE HIGHWAY PATROLMAN', x: 0, z: 0, ry: 0, halo: 0,
  skin: 0xd0a080, suit: 0xb8a878, tint: 0xffb400, look: 'patrol' });
patrolman.group.visible = false;
desert.group.add(patrolman.group);
// once you are done with him he goes to find a telephone: across the back
// of the hall, out through the doors, and gone
const GEORGIA_OUT = [[4, 11.2], [0, 12.8], [0, 20.2]].map(([x, z]) => new THREE.Vector3(CONV_X + x, 0, z));
const georgiaWalk = { leg: 0, t: 0 };
convCast.forEach((n) => { n.group.visible = false; scene.add(n.group); });
// sitting through the keynote: where the chair is and whether you are in it
const seminar = { seated: false, armed: false };

/* ------------------------------------------- everyone else */
const crowdSpecs = [];
const pickN = (arr, n, kind) => {
  const pool = arr.slice();
  for (let i = 0; i < n && pool.length; i++) {
    const s = pool.splice((Math.random() * pool.length) | 0, 1)[0];
    crowdSpecs.push({ kind, x: s.x ?? 0, z: s.z ?? 0, ry: s.ry, orbit: s.orbit, y: s.y });
  }
};
pickN(world.spots.slotSeats, 16, 'sit');
pickN(world.spots.barSpots, 8, 'sit');       // riding the carousel
pickN(world.spots.midway, 6, 'stand');
pickN(world.spots.standing, 6, 'stand');
// the people who are always where they are: the line at the desk, the
// clerks, the lounge, the dealers and players in the pits
(world.spots.fixed || []).forEach((f) => crowdSpecs.push({ ...f }));
world.spots.paths.forEach((path, i) => {
  const many = i < 3 ? 4 : 2;
  for (let k = 0; k < many; k++) {
    crowdSpecs.push({ kind: 'walk', x: path[0].x, z: path[0].z, ry: 0, path });
  }
});
const crowd = new Crowd(scene, crowdSpecs);

// ...and everybody at the convention: most of the chairs full, a knot of
// delegates in the foyer, a few standing at the back and pacing the aisles.
const convSpecs = [];
{
  const O = (p) => ({ x: CONV_X + p.x, z: p.z });
  const seats = conv.spots.seats.slice();
  for (let i = 0; i < 150 && seats.length; i++) {
    // fuller toward the front, the way a keynote fills
    const k = (Math.random() ** 1.6 * seats.length) | 0;
    const s = seats.splice(k, 1)[0];
    convSpecs.push({ kind: 'sit', ...O(s), ry: Math.PI });
  }
  conv.spots.foyer.forEach((p) => convSpecs.push({ kind: 'stand', ...O(p), ry: Math.random() * 6.28 }));
  conv.spots.back.forEach((p) => convSpecs.push({ kind: 'stand', ...O(p), ry: Math.PI }));
  conv.spots.paths.forEach((path) => {
    const wp = path.map(O);
    convSpecs.push({ kind: 'walk', x: wp[0].x, z: wp[0].z, ry: 0, path: wp });
  });
}
const convCrowd = new Crowd(scene, convSpecs);
convCrowd.group.visible = false;

/* --------------------------------------- things that aren't */
const onRing = (r, a) => [Math.sin(a) * r, Math.cos(a) * r];
const ghosts = [
  new Hallucination(...onRing(13, 0.5), 0.75),
  new Hallucination(...onRing(15, 2.6), 0.55),
  new Hallucination(...onRing(11, 4.4), 0.9),
  new Hallucination(-6, -40, 0.3),
  new Hallucination(...onRing(16, 5.6), 0.12),
];
ghosts.forEach((g) => scene.add(g.group));

const briefcase = new Briefcase(...onRing(14, 4.0));
scene.add(briefcase.group);

const pickups = [
  new Pickup('tequila', 9, -50, 0xe8c14a),
  new Pickup('uppers', ...onRing(13, 0.9), 0xffb400),
  new Pickup('grass', ...onRing(13, 3.6), 0x6fbf4a),
  new Pickup('mescaline', ...onRing(15.5, 5.4), 0xa03cff),
  new Pickup('downers', 8, 44, 0x5a7fd0),
  new Pickup('tequila', ...onRing(10, 1.9), 0xe8c14a),
];
pickups.forEach((p) => scene.add(p.group));

/* ---------------------------------------------------- body */
const player = {
  pos: new THREE.Vector3(-7, 1.72, -53.5),   // just inside the front doors
  vel: new THREE.Vector3(),
  yaw: Math.PI, pitch: 0, roll: 0,
  bob: 0,
  stagger: new THREE.Vector2(),
  staggerAt: 0,
  lookLag: new THREE.Vector2(),
};
// A person, not a wardrobe. At 0.85 a two metre doorway left a 30cm lane
// you had to thread with the mouse, and every counter held you an arm's
// length further off than it looked.
const RADIUS = 0.45;

const keys = Object.create(null);
let pointerLocked = false;
let lockUnavailable = false;   // sandboxed iframes refuse pointer lock
let started = false;
let winning = 0;

function grabMouse() {
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => { lockUnavailable = true; });
  } catch { lockUnavailable = true; }
}

/* -------------------------------------------------- input */
addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if (!started) return;

  if (e.code === 'Tab') {
    e.preventDefault();
    document.getElementById('tasks').classList.toggle('dim');
    return;
  }

  // 1-9 then 0, because the briefcase holds ten things
  const digit = /^Digit([0-9])$/.exec(e.code);
  if (digit) {
    e.preventDefault();
    const d = +digit[1];
    if (game.dlg) { if (d >= 1 && d <= 4) game.choose(d - 1); return; }
    const slot = d === 0 ? 9 : d - 1;
    game.take(Object.keys(SUBSTANCES)[slot]);
    return;
  }

  if (e.code === 'KeyE') {
    e.preventDefault();
    interact();
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('click', () => {
  if (started) grabMouse();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  document.body.classList.toggle('pointer', !pointerLocked);
});

addEventListener('mousemove', (e) => {
  if ((!pointerLocked && !lockUnavailable) || game.over) return;
  const s = game.snapshot();
  // booze and ether put a lag and an overshoot between hand and head
  const sens = 0.0021 * (1 + s.blur * 0.55 + s.jitter * 0.3);
  player.lookLag.x += e.movementX * sens;
  player.lookLag.y += e.movementY * sens;
});

/* ---------------------------------------------- interaction */
let focusTarget = null;

/* ================================================ objective marker
   Where the current errand actually is. Without this the game is a
   scavenger hunt in a round room: the front desk is eighteen metres of
   counter with one clerk somewhere along it, and the briefcase is a
   single object on a floor the size of a big top that you cannot even
   see until you are holding enough perception. Pointing at it does not
   do it for you -- you still have to get there, and still have to be
   in a fit state to deal with whatever is waiting.  */
const OBJECTIVE_AT = {
  checkin:   () => npcs[0].group.position,
  score:     () => npcs[1].group.position,
  briefcase: () => (briefcase.taken ? null : briefcase.pos),
  security:  () => npcs[3].group.position,
  room:      () => new THREE.Vector3(0, 1.4, 52),
  bath:      () => gonzo.group.position,
  maid:      () => (maidState.phase === 'here' ? maid.group.position : null),
  story:     () => new THREE.Vector3(SUITE_X + 4.95, 1.2, -2.8),
  downstairs: () => new THREE.Vector3(SUITE_X + SUITE.liftCall.x, 1.2, SUITE.liftCall.z),
  // the doors while you are inside, the car once you are through them
  checkout:  () => (player.pos.z > world.frontage.PAVE_Z
    ? new THREE.Vector3((world.frontage.DOOR.x0 + world.frontage.DOOR.x1) / 2, 1.6, world.LOB_Z1)
    : carDoorPoint()),
  drive:     () => new THREE.Vector3(DESERT_X, 2.5, DESERT_Z + desert.end),
  chp:       () => (cop.mesh.visible && cop.state !== 'done' && cop.state !== 'gone'
    ? cop.mesh.getWorldPosition(new THREE.Vector3()).setY(1.6) : null),
  callback:  () => new THREE.Vector3(DESERT_X + desert.phone.x, 1.5, DESERT_Z + desert.phone.z),
  // (or, after a wreck on the way back, the lounge door to the convention)
  return:    () => (game.act === 1 ? LOUNGE_DOOR_AT
    : new THREE.Vector3(DESERT_X, 1.5, DESERT_Z - COURT.mouth - 6)),
  badge:     () => registrar.group.position,
  seminar:   () => (seminar.seated ? null : new THREE.Vector3(CONV_X + CONV.seat.x, 1.0, CONV.seat.z)),
  georgia:   () => georgiaDA.group.position,
  walkout:   () => new THREE.Vector3(CONV_X + CONV.exit.x, 1.6, CONV.exit.z),
  bill:      () => npcs[0].group.position,
  // the same way out as the first time, and then the far end of the road
  westward:  () => (car.stage ? new THREE.Vector3(DESERT_X, 2.5, DESERT_Z + desert.end - 80)
    : player.pos.z > world.frontage.PAVE_Z
      ? new THREE.Vector3((world.frontage.DOOR.x0 + world.frontage.DOOR.x1) / 2, 1.6, world.LOB_Z1)
      : carDoorPoint()),
};
const objEl = document.getElementById('objective');
const objVec = new THREE.Vector3();
const objCam = new THREE.Vector3();   // kept separate: project() would clobber it

function updateObjective() {
  // no hand-holding while you are being spoken to, or once it is over
  if (game.over || game.dlg || !started) { objEl.classList.add('hidden'); return; }
  // Only an errand in this act can have a live target: each act completes
  // its tasks as you leave it, so anything still active is nearby.
  const task = game.tasks.find((t) => {
    if (t.state !== 'active' || !OBJECTIVE_AT[t.id]) return false;
    const w = OBJECTIVE_AT[t.id]();
    // The suite sits 300m out in +X; nothing on the floor or the road is
    // that far, so X is what separates the one act you can no longer reach.
    return w && Math.abs(w.x - player.pos.x) < 150;
  });
  const at = task && OBJECTIVE_AT[task.id]();
  if (!at) { objEl.classList.add('hidden'); return; }

  const dist = Math.hypot(at.x - player.pos.x, at.z - player.pos.z);
  const w = innerWidth, h = innerHeight, pad = 46;

  // The behind-the-camera test has to be done in CAMERA SPACE. Doing it on
  // the projected depth instead mirrors the point through the origin, so a
  // target on your left came out pinned to the right-hand edge, and an arrow
  // confidently pointing the wrong way is worse than no arrow at all.
  camera.updateMatrixWorld();
  const cam = objCam.copy(at).applyMatrix4(camera.matrixWorldInverse);
  const behind = cam.z > -0.05;            // three's camera looks down -Z

  let sx, sy;
  if (behind) {
    // nothing meaningful to project: throw it off whichever side it lies on
    sx = cam.x >= 0 ? w * 2 : -w;
    sy = h / 2;
  } else {
    const ndc = objVec.copy(at).project(camera);
    sx = (ndc.x * 0.5 + 0.5) * w;
    sy = (-ndc.y * 0.5 + 0.5) * h;
  }

  let edge = behind || sx < pad || sx > w - pad || sy < pad || sy > h - pad;
  if (edge) {
    const cx = w / 2, cy = h / 2;
    let dx = sx - cx, dy = sy - cy;
    if (!dx && !dy) dx = 1;
    const m = Math.max(Math.abs(dx) / (w / 2 - pad), Math.abs(dy) / (h / 2 - pad)) || 1;
    dx /= m; dy /= m;
    sx = cx + dx; sy = cy + dy;
    objEl.style.setProperty('--pt', String(Math.atan2(dy, dx) * 180 / Math.PI - 90));
  }

  objEl.classList.remove('hidden');
  objEl.classList.toggle('edge', edge);
  objEl.classList.toggle('near', dist < 6);
  objEl.style.left = sx.toFixed(0) + 'px';
  objEl.style.top = sy.toFixed(0) + 'px';
  objEl.querySelector('b').textContent = dist < 3 ? '' : Math.round(dist) + 'm';
}

function interact() {
  if (game.over || game._blacking > 0) return;
  if (game.dlg) return;
  if (!focusTarget) return;

  const f = focusTarget;

  // A LOCKED TARGET IS LOCKED FOR EVERYONE. This check used to live inside
  // the npc branch only, so the lift would print "House security has not
  // cleared you" as a hint and then carry you up regardless -- which left
  // that errand open forever, because by then the casino is switched off
  // and there is no going back down to finish it.
  // The typewriter is the one exception: it does its own check and has a
  // better line for it than this generic one.
  if (f.locked && f.kind !== 'typewriter') { audio.deny(); game.say(f.locked); return; }
  if (fade) return;

  if (f.kind === 'npc') {
    audio.resume();
    // Swan has a second conversation in her, for the morning after
    const id = f.obj.id === 'clerk' && game.finale ? 'bill'
      : f.obj.id === 'gonzo4' && game.taskState('seminar') === 'done' ? 'gonzo5'
      : f.obj.id;
    game.openDialogue(id);
  } else if (f.kind === 'seat') {
    sitDown();
  } else if (f.kind === 'stand') {
    // getting up in the middle of the keynote is a thing four hundred people see
    if (!seminar.armed) {
      seminar.armed = true;
      audio.deny();
      game.say('Every head in the row will turn. Press E again to get up and walk out anyway.');
      return;
    }
    game.leaveLecture();
    standUp();
  } else if (f.kind === 'exit') {
    audio.door();
    fadeThrough(startFinale, 2.8);
  } else if (f.kind === 'ghost') {
    game.openDialogue('ghost');
  } else if (f.kind === 'pickup') {
    f.obj.taken = true;
    f.obj.group.visible = false;
    game.giveItem(f.obj.kind);
  } else if (f.kind === 'briefcase') {
    briefcase.taken = true;
    game.takeBriefcase();
  } else if (f.kind === 'slot') {
    const res = game.gamble(5);
    if (res) {
      // reroll the face of the machine you actually pulled
      const sc = world.screens[f.obj.screen];
      if (sc) sc.t = 0;
    }
  } else if (f.kind === 'liftdown') {
    audio.elevator();
    game.say('The car comes up eighteen floors, very slowly, and goes back down faster.');
    fadeThrough(() => { audio.stopElevator(); startDownstairs(); }, 3.4);
  } else if (f.kind === 'getin') {
    getInCar();
  } else if (f.kind === 'convention') {
    audio.door();
    fadeThrough(startActFour, 2.8);

  } else if (f.kind === 'phone') {
    game.openDialogue('phone');
  } else if (f.kind === 'typewriter') {
    // steady enough to write, and nothing yet to write about: the race
    if (game.composure >= STORY_COMPOSURE && game.taskState('mint') !== 'done') {
      audio.door();
      game.say('You put a sheet in the machine and type THE MINT 400, and then you '
        + 'sit there trying to remember what it looked like.', null, 4);
      fadeThrough(startMint, 3);
    } else {
      game.fileStory();
    }
  } else if (f.kind === 'bar') {
    game.buyDrink('tequila');
  } else if (f.kind === 'elevator') {
    if (winning) return;
    // riding up ends the night, so make the player say it twice
    if (!game.elevatorArmed) {
      game.elevatorArmed = true;
      game.say('There is no coming back down to the floor. Press E again when '
        + 'you are finished down here.');
      audio.deny();
      return;
    }
    winning = 1;
    audio.elevator();
    game.say('The doors take a very long time to close.');
  }
}

const fwd = new THREE.Vector3();

function findFocus() {
  if (game.dlg || game.over) { focusTarget = null; return; }
  camera.getWorldDirection(fwd);

  let best = null, bestScore = -1;
  // BIAS exists because the bar is a ring: its target point is generated at
  // whatever angle you are standing, so it always scores a near-perfect dot
  // at almost no distance and it was quietly shadowing the dealer from every
  // angle of the carousel -- the one man the second errand sends you to find.
  // A person you can reach outranks a countertop.
  const consider = (kind, obj, pos, range, label, locked, bias = 0) => {
    const dx = pos.x - player.pos.x, dz = pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > range) return;
    const dot = (dx / d) * fwd.x + (dz / d) * fwd.z;
    if (dot < 0.45) return;
    const score = dot * 2 - d / range + bias;
    if (score > bestScore) { bestScore = score; best = { kind, obj, label, locked, d }; }
  };

  if (game.act === 3) {
    // nothing to look at out here until the car has stopped moving
    if (game.taskState('callback') === 'active' && car.parked) {
      const ph = desert.phone;
      consider('phone', null, new THREE.Vector3(DESERT_X + ph.x, 0, DESERT_Z + ph.z), 3.4,
        'ANSWER IT');
    }
    focusTarget = best;
    game.setPrompt(best?.label, best?.locked);
    document.getElementById('reticle').classList.toggle('hot', !!best && !best.locked);
    return;
  }

  if (game.act === 4) {
    if (seminar.seated) {
      // in the chair the only thing you can do is get out of it
      best = game.lecture ? { kind: 'stand', label: 'GET UP AND WALK OUT' } : null;
    } else {
      const T = (x, z) => new THREE.Vector3(CONV_X + x, 0, z);
      consider('npc', registrar, registrar.group.position, 3.2, 'REGISTRATION',
        game.taskState('badge') === 'done' ? 'You already have a name.' : null, 0.9);
      consider('npc', gonzoC, gonzoC.group.position, 3.0, 'YOUR ATTORNEY', null, 0.9);
      const gState = game.taskState('georgia');
      consider('npc', georgiaDA, georgiaDA.group.position, 3.0,
        gState === 'active' ? 'THE DELEGATE FROM GEORGIA' : 'A DELEGATE, AT THE URN',
        gState === 'done' ? 'He has gone to telephone his wife.'
          : gState !== 'active' ? 'He is waiting for the keynote to start, like everybody else.' : null, 0.9);
      if (game.taskState('badge') !== 'done') {
        consider('gate', null, T(0, 12.6), 3.0, 'THE BALLROOM', 'Delegates only. You have no badge.');
      }
      if (game.taskState('seminar') === 'active') {
        consider('seat', null, T(CONV.seat.x, CONV.seat.z), 2.6, 'TAKE YOUR SEAT', null, 1.2);
      }
      if (game.taskState('walkout') === 'active') {
        consider('exit', null, T(CONV.exit.x, CONV.exit.z), 3.2, 'LEAVE THE CONVENTION', null, 1.2);
      }
    }
    focusTarget = best;
    game.setPrompt(best?.label, best?.locked);
    document.getElementById('reticle').classList.toggle('hot', !!best && !best.locked);
    return;
  }

  if (mintOn) { focusTarget = null; game.setPrompt(null); return; }
  if (game.act === 2) {
    consider('npc', gonzo, gonzo.group.position, 3.0,
      game.taskState('bath') === 'done' ? 'YOUR ATTORNEY' : 'YOUR ATTORNEY, IN THE BATH',
      game.taskState('bath') === 'done' ? 'He is finished talking to you.' : null, 0.9);
    if (game.taskState('maid') === 'active' && maidState.phase === 'here') {
      consider('npc', maid, maid.group.position, 3.4, 'ANSWER THE DOOR', null, 0.9);
    }
    if (game.taskState('downstairs') === 'active') {
      consider('liftdown', null,
        new THREE.Vector3(SUITE_X + SUITE.liftCall.x - 0.6, 0, SUITE.liftCall.z), 2.4,
        'CALL THE LIFT. GO DOWN.');
    }
    if (game.taskState('story') === 'active') {
      // the typewriter is the last thing in the game and the only one
      // the chemistry cannot help you with
      // say what it wants the way a greyed-out dialogue option does, so a
      // locked typewriter reads as something you can fix
      const have = Math.floor(game.composure * 100 + 1e-9), need = Math.round(STORY_COMPOSURE * 100);
      consider('typewriter', null,
        new THREE.Vector3(SUITE_X + 4.9, 0, -2.6), 2.4,
        'FILE THE STORY',
        game.composure < STORY_COMPOSURE
          ? `Too wrecked to write. COMPOSURE ${have}/${need}` : null);
    }
    focusTarget = best;
    game.setPrompt(best?.label, best?.locked);
    document.getElementById('reticle').classList.toggle('hot', !!best && !best.locked);
    return;
  }

  npcs.forEach((n) => {
    let label, locked = null;
    switch (n.id) {
      case 'clerk':
        if (game.finale) {
          label = game.taskState('bill') === 'done' ? 'SWAN' : 'SETTLE THE BILL';
          if (game.taskState('bill') === 'done') locked = 'She is no longer looking at you. On purpose.';
        } else if (game.taskState('checkin') === 'done') { label = 'SWAN'; locked = 'She has already given you the key.'; }
        else label = 'SPEAK TO THE NIGHT DESK';
        break;
      case 'dealer':
        label = game.taskState('score') === 'done' ? 'THE MAN AT THE BAR' : 'APPROACH THE MAN AT THE BAR';
        break;
      case 'attorney':
        // by the morning he is out in the car with the engine running
        if (game.finale) return;
        label = 'YOUR ATTORNEY';
        break;
      case 'security':
        if (game.securityCleared) { label = 'HOUSE SECURITY'; locked = 'He has already waved you through.'; }
        else label = 'HOUSE SECURITY';
        break;
      case 'valet':
        label = 'THE PARKING ATTENDANT';
        break;
    }
    // staff stand behind a counter you cannot walk through, so they
    // need a longer reach than someone standing on the open floor
    consider('npc', n, n.group.position, n.cfg.reach ?? 3.6, label, locked, 0.9);
  });

  ghosts.forEach((g) => {
    if (g.mat.opacity < 0.25) return;
    consider('ghost', g, g.group.position, 3.2, 'SOMEONE IS STANDING THERE');
  });

  pickups.forEach((p) => {
    if (p.taken) return;
    consider('pickup', p, p.pos, 2.6, 'TAKE THE ' + SUBSTANCES[p.kind].name);
  });

  if (!briefcase.taken && briefcase.mat.opacity > 0.3) {
    // it lies right up against a bank of slots, and a slot at the same angle
    // was winning the prompt: you pressed E for the errand and pulled a lever
    consider('briefcase', briefcase, briefcase.pos, 2.8, 'THE BRIEFCASE', null, 1.0);
  }

  // a machine is a machine. five dollars a pull.
  const brokeSlot = game.money < 5 ? 'You are out of money.' : null;
  world.machines.forEach((m) => consider('slot', m, m, 2.4, 'PLAY  $5', brokeSlot));

  // the nautical bar: a straight counter, so the nearest point along it
  {
    const L = world.lounge;
    if (player.pos.x > L.X0 && player.pos.z > L.Z0 && player.pos.z < L.Z1) {
      const price = SUBSTANCES.tequila.price;
      consider('bar', null, { x: L.BX - 0.5, z: clamp(player.pos.z, L.BZ0, L.BZ1) }, 2.6,
        `BUY A DRINK  $${price}`, game.money >= price ? null : 'You are out of money.');
    }
  }
  // the bar counter is a ring, so you buy a drink wherever you stand at it
  {
    const d = Math.hypot(player.pos.x, player.pos.z);
    if (d < 11) {
      const a = Math.atan2(player.pos.x, player.pos.z);
      const price = SUBSTANCES.tequila.price;
      consider('bar', null,
        { x: Math.sin(a) * world.CAROUSEL_R, z: Math.cos(a) * world.CAROUSEL_R }, 3.2,
        `BUY A DRINK  $${price}`,
        game.money >= price ? null : 'You are out of money.');
    }
  }

  if (game.leaving) {
    consider('elevator', null, new THREE.Vector3(0, 0, 54), 5.5, 'THE ELEVATORS',
      'You are not going back up there.');
    if (game.taskState('return') === 'active' && car.stage === null) {
      consider('convention', null, LOUNGE_DOOR_AT, 3.2, 'THE CONVENTION WING', null, 1.2);
    }
    if (car.stage === null && player.pos.z < world.frontage.PAVE_Z
        && (game.taskState('checkout') === 'active' || game.taskState('westward') === 'active')) {
      consider('getin', null, carDoorPoint(), 2.6, 'GET IN THE CAR', null, 1.2);
    } else if (car.stage === null && game.finale && game.taskState('bill') === 'active'
        && player.pos.z < world.frontage.PAVE_Z) {
      consider('getin', null, carDoorPoint(), 2.6, 'THE CAR', 'Swan has your bill. The desk first.', 1.2);
    }
  } else if (!winning) {
    const ready = game.hasKey && game.hasBriefcase && game.securityCleared;
    const missing = !game.securityCleared ? 'House security has not cleared you.'
      : !game.hasKey ? 'You have no room key.'
      : 'You are not leaving without the briefcase.';
    consider('elevator', null, new THREE.Vector3(0, 0, 54), 5.5,
      ready ? 'RIDE UP TO 1850' : 'THE ELEVATORS', ready ? null : missing);
  }

  focusTarget = best;
  game.setPrompt(best?.label, best?.locked);
  document.getElementById('reticle').classList.toggle('hot', !!best && !best.locked);
}

/* -------------------------------------------------- physics */
/* DBG-START */
/**
 * Cross-checks every collider against what is actually DRAWN, by walking
 * the scene graph for world-space bounds rather than by re-reading the
 * collider list -- otherwise the test only agrees with itself.
 * Reports colliders with no geometry behind them (invisible walls) and
 * colliders materially bigger than the thing they stand for.
 */
/**
 * A top-down walkability map. The collider audit cannot catch a CONTAINMENT
 * clamp, because a clamp is not a collider -- it is the per-zone boundary in
 * collide(). Only a picture shows those.
 *   green = walkable, red = pushed by a collider,
 *   blue  = thrown more than 3m, which means a zone clamp caught the point.
 */
function drawWalkMap() {
  // the map follows the act: the suite lives 300m out in +X
  const A2 = game.act === 2;
  const X0 = A2 ? SUITE_X - 9 : -42, X1 = A2 ? SUITE_X + 9 : 42;
  const Z0 = A2 ? -11 : -60,        Z1 = A2 ? 7 : 60;
  const STEP = A2 ? 0.08 : 0.25;
  const W = Math.round((X1 - X0) / STEP), H = Math.round((Z1 - Z0) / STEP);
  let cv = document.getElementById('walkmap');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'walkmap';
    cv.style.cssText = 'position:fixed;inset:0;margin:auto;z-index:99999;' +
                       'background:#000;image-rendering:pixelated;';
    document.body.appendChild(cv);
  }
  cv.width = W; cv.height = H;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const g = cv.getContext('2d');
  const img = g.createImageData(W, H);
  const probe = new THREE.Vector3();

  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = X0 + i * STEP, z = Z0 + j * STEP;
      probe.set(x, 1.72, z);
      collide(probe);
      const moved = Math.hypot(probe.x - x, probe.z - z);
      const k = (j * W + i) * 4;
      let r = 0, gg = 0, b = 0;
      if (moved < 0.01) gg = 90;
      else if (moved < 3.0) r = 200;
      else { b = 220; r = 60; }
      img.data[k] = r; img.data[k+1] = gg; img.data[k+2] = b; img.data[k+3] = 255;
    }
  }
  /* Reachability is the only question that matters: eyeballing a map does
     not prove you can WALK from the bed to the bath. Flood-fill the free
     cells from the spawn and see what the fill actually touches. */
  const free = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = X0 + i * STEP, z = Z0 + j * STEP;
      probe.set(x, 1.72, z);
      collide(probe);
      free[j * W + i] = Math.hypot(probe.x - x, probe.z - z) < 0.01 ? 1 : 0;
    }
  }
  const idx = (x, z) => Math.round((z - Z0) / STEP) * W + Math.round((x - X0) / STEP);
  const seen = new Uint8Array(W * H);
  const start = A2 ? idx(SUITE_X + SUITE.spawn.x, SUITE.spawn.z) : idx(-7, -53.5);
  const queue = [start];
  seen[start] = 1;
  let count = 0;
  while (queue.length) {
    const k = queue.pop(); count++;
    const i = k % W, j = (k - i) / W;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([di, dj]) => {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) return;
      const nk = nj * W + ni;
      if (seen[nk] || !free[nk]) return;
      seen[nk] = 1; queue.push(nk);
    });
  }
  // paint anything walkable but NOT reachable in bright yellow: that is a
  // pocket of floor the player can never get to
  for (let k = 0; k < W * H; k++) {
    if (free[k] && !seen[k]) {
      img.data[k*4] = 255; img.data[k*4+1] = 230; img.data[k*4+2] = 0;
    }
  }
  let stranded = 0;
  for (let k = 0; k < W * H; k++) if (free[k] && !seen[k]) stranded++;
  // probe the spots a PLAYER stands on, not the middle of the furniture:
  // a point inside a table is blocked for the obvious reason
  const targets = A2
    ? { bathside: [SUITE_X - 3.2, -5.9], deskside: [SUITE_X + 3.1, -2.6],
        window: [SUITE_X + 4.6, -0.4], door: [SUITE_X - 4.8, 0] }
    : { bar: [0, -8], frontdesk: [-14.2, -43], lift: [0, 50],
        farfloor: [0, 28], westaisle: [-20, 0] };
  const reach = {};
  for (const [name, [tx, tz]] of Object.entries(targets)) {
    const k = idx(tx, tz);
    reach[name] = k >= 0 && k < W * H ? (seen[k] ? 'reachable' : free[k] ? 'STRANDED' : 'blocked') : 'off-map';
  }
  document.body.dataset.flReach = JSON.stringify(
    { reachableCells: count, strandedCells: stranded, reach });

  g.putImageData(img, 0, 0);
}

function auditColliders(lim = 0.30) {
  scene.updateMatrixWorld(true);
  const solids = [];
  const tmp = new THREE.Box3(), gb = new THREE.Box3(), m4 = new THREE.Matrix4();

  scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const push = (b) => {
      // only things occupying the space a body walks through
      if (b.max.y < 0.25 || b.min.y > 2.1) return;
      solids.push({ x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z });
    };
    if (o.isInstancedMesh) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4);
        gb.copy(o.geometry.boundingBox).applyMatrix4(m4).applyMatrix4(o.matrixWorld);
        push(gb);
      }
    } else {
      tmp.setFromObject(o);
      push(tmp);
    }
  });

  const phantom = [], oversize = [];
  // in act two the live set is the suite's, held in suite-local coordinates
  const live = game.act === 2
    ? suite.colliders.map((c) => ({ ...c, x: c.x + SUITE_X }))
    : world.colliders;
  live.forEach((c, i) => {
    const hw = c.circle ? c.r : c.hw;
    const hd = c.circle ? c.r : c.hd;
    const x0 = c.x - hw, x1 = c.x + hw, z0 = c.z - hd, z1 = c.z + hd;
    let cover = null;
    for (const g of solids) {
      if (g.x1 < x0 || g.x0 > x1 || g.z1 < z0 || g.z0 > z1) continue;
      cover = cover
        ? { x0: Math.min(cover.x0, g.x0), x1: Math.max(cover.x1, g.x1),
            z0: Math.min(cover.z0, g.z0), z1: Math.max(cover.z1, g.z1) }
        : { x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1 };
    }
    if (!cover) {
      phantom.push({ i, x: +c.x.toFixed(1), z: +c.z.toFixed(1),
                     hw: +hw.toFixed(2), hd: +hd.toFixed(2) });
      return;
    }
    // how far the collider sticks out past the geometry, worst side
    const over = Math.max(cover.x0 - x0, x1 - cover.x1,
                          cover.z0 - z0, z1 - cover.z1);
    if (over > lim) {
      oversize.push({ i, x: +c.x.toFixed(1), z: +c.z.toFixed(1), over: +over.toFixed(2) });
    }
  });

  return { act: game.act, colliders: live.length, solidsAtBodyHeight: solids.length,
           phantomCount: phantom.length, phantom: phantom.slice(0, 30),
           oversizeCount: oversize.length, oversize: oversize.slice(0, 20) };
}
/* DBG-END */

/* The lift arrives. The casino is switched off wholesale -- it is 300m
   away as well, but hiding it means the floor costs nothing to render
   while you are upstairs -- and the suite is switched on in its place. */
/** the whole casino -- building, crowd, cast and props -- on or off */
function showCasino(on) {
  world.root.visible = on;
  crowd.group.visible = on;
  bats.group.visible = on;
  // on the last morning your attorney is already out in the car
  npcs.forEach((n) => { n.group.visible = on && !((game.finale || game.leaving) && n.id === 'attorney'); });
  ghosts.forEach((g) => { g.group.visible = on; });
  pickups.forEach((pk) => { pk.group.visible = on && !pk.taken; });
  briefcase.group.visible = on && !briefcase.taken;
}

function startActTwo() {
  game.enterSuite();
  atty.with = false;
  atty.trail.length = 0;
  showCasino(false);
  suite.show();

  gonzo.group.visible = true;
  scene.add(gonzo.group);
  scene.fog = FOG[2];
  audio.ambience = 'suite';

  player.pos.set(SUITE_X + SUITE.spawn.x, 1.72, SUITE.spawn.z);
  player.vel.set(0, 0, 0);
  player.yaw = -Math.PI / 2;      // facing into the room
  winning = 0;
  game.blackout = 1;
}

/* Down in the lift from the eighteenth floor. You come out where you went
   in -- the elevator corridor at the far end of the floor -- and the front
   doors are the whole width of the casino away, beside the desk. */
function startDownstairs() {
  game.leaveSuite();
  suite.hide();
  gonzo.group.visible = false;
  if (maid.group.parent) scene.remove(maid.group);
  showCasino(true);
  scene.fog = FOG[1];
  audio.ambience = 'casino';
  player.pos.set(0, 1.72, 51.2);
  player.vel.set(0, 0, 0);
  player.lookLag.set(0, 0);
  player.yaw = 0;                 // out of the lift, facing the floor
  player.pitch = 0;
  winning = 0;
}

/* ACT FOUR. The car is back at the kerb, the night is over, and the
   convention is down the east wing. Everything outside is switched off and
   the ballroom is switched on in its place, the same way the suite works. */
function startActFour() {
  leaveCar();
  clearTraffic();
  // the car goes back to where the valet found it, ready for the last drive
  const at = world.frontage.car;
  car.stage = null; car.returning = false; car.parked = false; car.arrived = false;
  car.final = false; car.speed = 0; car.wheel = 0; car.kick = 0;
  car.pos.set(at.x, 0, at.z); car.heading = at.yaw;
  placeCar();
  hotelCar.visible = true;
  desert.group.visible = false;
  roadBats.group.visible = false;
  phantom.g.visible = false; phantom.active = false;
  showCasino(false);
  world.root.visible = false;

  game.enterConvention();
  conv.show();
  convCrowd.group.visible = true;
  convCast.forEach((n) => { n.group.visible = true; });
  gonzoC.group.position.set(CONV_X + 4.6, 0, 16.2);
  atty.trail.length = 0;
  conv.setSlide('title');
  scene.fog = FOG[4];
  camera.far = 400;
  camera.fov = 72;
  camera.updateProjectionMatrix();
  audio.ambience = 'convention';

  player.pos.set(CONV_X + CONV.spawn.x, 1.72, CONV.spawn.z);
  player.vel.set(0, 0, 0);
  player.lookLag.set(0, 0);
  player.yaw = 0;                 // facing up the foyer toward the ballroom doors
  player.pitch = 0;
  player.roll = 0;
}

/* A WRECK. game.crash() used to be the end card; now it hands over here.
   The car stays where it stopped while the picture goes, and in the dark
   everything the drive switched on is switched back off -- the same work
   startActFour does -- and you are put on a stool at the ring bar, on the
   side nearest the lobby. The car is back at the kerb, dented, and drives
   exactly as it did before. */
let wrecking = false;
game.onWreck = () => {
  wrecking = true;
  audio.engine(-1);
  fadeThrough(wakeAtBar, 5);
};
function wakeAtBar() {
  const leg = car.returning ? 'return' : game.finale ? 'final' : 'out';
  leaveCar();
  clearTraffic();
  copReset();
  const at = world.frontage.car;
  car.stage = null; car.returning = false; car.parked = false; car.arrived = false;
  car.final = false; car.speed = 0; car.wheel = 0; car.kick = 0; car.offRoad = 0;
  car.pos.set(at.x, 0, at.z); car.heading = at.yaw;
  car.damage = (car.damage || 0) + 1;
  damageCar(desert.car, car.damage);
  damageCar(hotelCar, car.damage);
  placeCar();
  hotelCar.visible = true;
  roadBats.group.visible = false;
  phantom.g.visible = false; phantom.active = false;
  showCasino(true);
  scene.fog = FOG[1];
  camera.far = 400;
  camera.updateProjectionMatrix();
  audio.ambience = 'casino';
  game.wakeAtBar(leg);

  player.pos.set(0, 1.72, -(world.CAROUSEL_R + 2.1));
  player.vel.set(0, 0, 0);
  player.lookLag.set(0, 0);
  player.yaw = Math.PI;           // facing the counter
  player.pitch = 0;
  player.roll = 0;
  zoneNow = null;
  wrecking = false;
}
// the lounge door off the east side of the lobby, which is the way into the
// convention wing -- the way you come back out of it on the last morning
const LOUNGE_DOOR_AT = new THREE.Vector3(world.LOB_X - 0.6, 1.4, -44);

/* Into the chair for the keynote. You can look around -- at the lizards,
   mostly -- but not get up without making a scene of it. */
function sitDown() {
  if (seminar.seated) return;
  seminar.seated = true;
  seminar.armed = false;
  // the crowd sits tall on these chairs, so you do too
  player.pos.set(CONV_X + CONV.seat.x, 1.45, CONV.seat.z);
  player.vel.set(0, 0, 0);
  player.yaw = 0; player.pitch = 0.06;
  audio.door();
  game.startLecture();
}

function standUp() {
  if (!seminar.seated) return;
  seminar.seated = false;
  player.pos.set(CONV_X + CONV.seatFrom.x, 1.72, CONV.seatFrom.z);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI;           // back up the aisle toward the urn
  // and he has already crossed to the urn to set the thing up
  gonzoC.group.position.copy(GONZO_AT_URN);
}

/* ACT FIVE. Out of the ballroom, back through the lobby you came in by,
   and the same desk is the last thing between you and the road. */
function startFinale() {
  conv.hide();
  convCrowd.group.visible = false;
  convCast.forEach((n) => { n.group.visible = false; });
  seminar.seated = false;
  game.enterFinale();
  showCasino(true);
  scene.fog = FOG[1];
  audio.ambience = 'casino';
  // in through the lounge door off the east side of the lobby, facing the desk
  player.pos.set(12, 1.72, -44);
  player.vel.set(0, 0, 0);
  player.lookLag.set(0, 0);
  player.yaw = Math.PI / 2;
  player.pitch = 0;
  zoneNow = null;
}

/* Where you stand to open the driver's door: the car's left, which is the
   side facing the hotel, because they pulled in nose-first to the kerb. */
const carDoorAt = new THREE.Vector3();
function carDoorPoint() {
  const at = world.frontage.car;
  // car-local -X is the driver's side
  return carDoorAt.set(at.x - Math.cos(at.yaw) * 1.5, 1.2, at.z + Math.sin(at.yaw) * 1.5);
}

/* Into the car, and straight onto the road outside the hotel -- which is
   the highway itself, running south from the kerb the whole way out. */
function getInCar() {
  if (car.stage) return;
  const at = world.frontage.car;
  car.stage = 'road';
  car.speed = 0; car.wheel = 0; car.kick = 0; car.travelled = 0;
  car.offRoad = 0; car.arrived = false; car.parked = false; car.returning = false;
  car.pos.set(at.x, 0, at.z);
  car.heading = at.yaw;            // already pointed down the highway
  hotelCar.visible = false;        // the one you are sitting in takes its place
  head.yaw = 0; head.pitch = 0;
  player.roll = 0;
  player.vel.set(0, 0, 0);
  player.lookLag.set(0, 0);
  game.completeTask('checkout');
  startActThree();
  audio.door();
  audio.engine(0);
  game.say('It starts on the second try, which is more than you deserve. '
    + 'The hotel is behind you and the road runs on. '
    + 'W to go, A and D to steer, the mouse to look.');
}

/* Behind the wheel. Nothing around you is switched off or swapped: the
   hotel stays standing behind you, the canopy stays lit over your head,
   and the night only gives way to the morning as you drive out of it. */
function startActThree() {
  // Same reconciliation the suite does for the casino: once the car is
  // moving there is no going back for anything left unfinished.
  ['bath', 'maid', 'mint', 'story', 'downstairs', 'checkout'].forEach((id) => game.completeTask(id));
  game.leaving = false;
  // the last time out it is morning, the bill is settled, and it is one way
  car.final = game.finale;
  // the people inside go; the building, the canopy and the drive stay
  showCasino(false);
  world.root.visible = true;
  car.stage = 'road';
  game.act = 3;
  suite.hide();
  gonzo.group.visible = false;
  maid.group.visible = false;
  if (maid.group.parent) scene.remove(maid.group);
  // the drive starts in exactly the air you were standing in
  nightFog.copy(FOG[1].color);
  // the casino's own haze would swallow the neon a block away
  nightDensity = Math.min(FOG[1].density, 0.0065);
  scene.fog = FOG[3];
  setDaylight(0);
  camera.far = 1800;               // the ranges stand a kilometre off the road
  camera.updateProjectionMatrix();
  audio.ambience = 'desert';
  if (!car.final) game.activate('drive');
  car.returning = false;
  car.offRoad = 0;
  head.yaw = 0; head.pitch = 0;
  player.vel.set(0, 0, 0);
  player.lookLag.set(0, 0);
  phantom.cool = 6;
  placeCar();
}

/* Night at the kerb, full morning a few hundred metres out. One number
   drives the desert's own lights, its sky and the fog, so there is never
   a moment where the time of day jumps. Coming back, it stays morning. */
const DAY_FOG = new THREE.Color(0xd9c4a8), DAY_DENSITY = 0.0013;
const nightFog = new THREE.Color(0x100604);
let nightDensity = 0.017;
function daylight() {
  // the morning after the convention, it is morning the whole way out
  if (game.finale) return 1;
  if (game.act !== 3) return 0;
  if (car.returning) return 1;
  const d = DESERT_Z - car.pos.z;              // metres south of the hotel
  // night the whole way down the neon street, and the dawn coming up only
  // once the town has given out: full morning half a kilometre past it
  const t = clamp((d - 250) / 520, 0, 1);
  return t * t * (3 - 2 * t);
}
function setDaylight(k) {
  desert.lights.children.forEach((L) => {
    if (L.userData.base === undefined) L.userData.base = L.intensity;
    L.intensity = L.userData.base * k;
  });
  desert.sky.material.color.setScalar(k);
  desert.setNight(1 - k);
  // the windscreen glass is a glint in daylight and a grey sheet at night
  const pane = desert.car.userData.pane;
  if (pane) pane.material.opacity = 0.07 * k;
  if (scene.fog === FOG[3]) {
    FOG[3].color.copy(nightFog).lerp(DAY_FOG, k);
    FOG[3].density = nightDensity + (DAY_DENSITY - nightDensity) * k;
  }
}

/* ---------------------------------------- things on the road that aren't
   Headlights in your lane, closing fast, that are gone a car's length
   before they would hit you -- and the bats. Only ever while hallucinating. */
const phantom = (() => {
  const g = new THREE.Group();
  const glow = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.25, 'rgba(255,230,170,0.7)');
    gr.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const mat = new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false });
  [-0.75, 0.75].forEach((x) => {
    const sp = new THREE.Sprite(mat);
    sp.position.set(x, 0.75, 0);
    sp.scale.setScalar(2.2);
    g.add(sp);
  });
  g.visible = false;
  desert.group.add(g);
  return { g, mat, active: false, cool: 8, warned: false };
})();
const roadBats = new BatSwarm(scene, 90);
const ZERO = new THREE.Vector3();
const fwdFlat = new THREE.Vector3();

function updateRoadVisions(dt, s) {
  // ---- phantom headlights
  const tripping = s.psych + s.monster * 1.5;
  const P = phantom;
  if (!P.active) {
    P.g.visible = false;
    if (tripping > 0.35 && !car.parked && car.speed > 8) {
      P.cool -= dt * tripping;
      if (P.cool <= 0) {
        P.active = true; P.warned = false;
        P.g.position.set(car.pos.x - DESERT_X, 0, car.pos.z - DESERT_Z - 170);
        P.g.position.y = roadY(P.g.position.z);
      }
    }
  } else {
    P.g.visible = true;
    P.g.position.z += 26 * dt;                        // coming at you
    P.g.position.y = roadY(P.g.position.z);
    P.g.position.x += ((car.pos.x - DESERT_X) - P.g.position.x) * dt * 0.8;  // in your lane
    const gap = (car.pos.z - DESERT_Z) - P.g.position.z;
    P.mat.opacity = clamp((gap - 8) / 20, 0, 1) * clamp((170 - gap) / 40, 0, 1);
    if (!P.warned && gap < 30) {
      P.warned = true;
      game.fear = clamp(game.fear + 0.14, 0, 1);
      audio.sting();
    }
    if (gap < 8) { P.active = false; P.cool = 10 + Math.random() * 14; }
  }

  // ---- bats, swarming the windscreen
  const batAmt = clamp(s.psych * 0.55 + s.monster * 0.9
    + Math.max(0, s.loathing - 0.62) * 1.6 - 0.15, 0, 1);
  roadBats.group.visible = batAmt > 0.01;
  camera.getWorldDirection(fwdFlat);
  roadBats.group.position.set(camera.position.x + fwdFlat.x * 5, 0.2, camera.position.z + fwdFlat.z * 5);
  roadBats.update(clock, batAmt, ZERO);
}

/* The car is drawn around the driver: the camera is the driver's head,
   so the body is placed back from it by the seat offset. */
function placeCar(mesh = desert.car) {
  const lz = car.pos.z - DESERT_Z;
  mesh.position.set(car.pos.x - DESERT_X, roadY(lz), lz);
  mesh.rotation.y = car.heading;
  // nose up on the climbs, down over the crests, whichever way you face
  mesh.rotation.x = carPitch();
  // the wheel in your hands turns with the front wheels, about 14:1
  const wheel = mesh.userData.wheel;
  if (wheel) wheel.rotation.z = car.wheel * 5.5;
}

/* ================================================= THE CAR
   One model for both drives. It used to slide sideways when you steered
   -- the body never turned, the camera tilted a little to pretend -- so
   it drove like a cursor. Now it is a car:

     · it turns about its wheels: heading changes at speed / wheelbase *
       tan(front wheel angle), so nothing turns while stood still and a
       flick at 70mph moves you a lane, not across the desert
     · the lock you get shrinks with speed, and the wheel returns to the
       middle on its own when you let go
     · W is throttle that runs out of pull near the top, S brakes and then
       reverses, and letting go coasts

   Sober, that is all it is. The chemistry comes in on top, channel by
   channel, and every term below is zero with nothing in you:

     motor  the hands are late on the wheel and the car wanders off line
     jitter the hands twitch it
     blur   the head sways, the horizon rolls, the wheel is slower still
     psych  the view breathes -- FOV swims, the horizon tilts -- and there
            are headlights coming at you in your own lane that are not there
     rush   speed reads as more speed: the view stretches as you go
     and bats, if you are far enough gone. It is bat country.

   You can look around while you drive: the mouse moves your head, not
   the car, and the head drifts back to the road when you leave it. */
const WHEELBASE = 2.9;
const head = { yaw: 0, pitch: 0, idle: 0 };
function carPitch() {
  const lz = car.pos.z - DESERT_Z;
  return Math.atan(roadSlope(lz) * Math.cos(car.heading - roadHeading(lz)));
}
const eyeOff = new THREE.Vector3();

function stepCar(dt, s, opt = {}) {
  const lost = 1 - s.motor;
  const input = !fade && !opt.brake;
  const W = input && (keys.KeyW || keys.ArrowUp);
  const S = input && (keys.KeyS || keys.ArrowDown);
  const top = (opt.top ?? 34) * (1 - lost * 0.2);

  // ---- pedals
  let acc;
  if (opt.brake) acc = car.speed > 0 ? -8.5 : 0;
  else if (W) acc = car.speed < -0.2 ? 9 : 7.5 * Math.max(0, 1 - car.speed / top) + 0.4;
  else if (S) acc = car.speed > 0.2 ? -10 : -3;
  else acc = -car.speed * 0.06 - Math.sign(car.speed) * 0.35;
  car.speed += acc * dt;
  if (!W && !S && Math.abs(car.speed) < 0.25) car.speed = 0;
  car.speed = clamp(car.speed, opt.brake ? 0 : -4, top);
  const v = car.speed, vAbs = Math.abs(v);

  // ---- the wheel
  let want = 0;
  if (input && (keys.KeyA || keys.ArrowLeft)) want += 1;
  if (input && (keys.KeyD || keys.ArrowRight)) want -= 1;
  // ~31deg parked, ~3deg at 60mph: about 25 degrees a second of turn at
  // highway speed, which is a lane change, not a handbrake turn
  // Keys are all-or-nothing, so the lock falls away hard with speed: at
  // highway speed a full press is ~15 degrees a second, a lane change, and
  // a tap is a correction rather than a swerve. It was ~25 and twitchy.
  // Below walking pace the full lock is yours, so the motor court can be got
  // round like a real car does it; above that it falls away as before, and
  // at highway speed it is exactly what it was.
  const lock = 0.55 / (1 + Math.max(0, vAbs - 4) * 0.4 + vAbs * vAbs * 0.012);
  // winding on is gradual (a keyboard has no half-press, so the wheel
  // supplies one); letting go centres faster, the way a real wheel does
  const hands = (want ? 2.6 : 7) * clamp(1 - lost * 0.8 - s.blur * 0.3, 0.14, 1);
  const target = clamp(want * lock + (opt.assist || 0), -0.55, 0.55);
  car.wheel += (target - car.wheel) * (1 - Math.exp(-hands * dt));

  // what the hands do on their own
  const drift = (Math.sin(clock * 0.37) * 0.6 + Math.sin(clock * 0.91 + 1.3) * 0.4)
    * lost * lock * 0.9;
  if (s.jitter > 0.05 && Math.random() < dt * 2.5 * s.jitter) {
    car.kick = (Math.random() - 0.5) * lock * 1.4 * s.jitter;
  }
  car.kick *= Math.exp(-dt * 6);
  const angle = car.wheel + drift + car.kick;

  // ---- the car itself
  car.yawRate = v / WHEELBASE * Math.tan(angle);
  car.heading += car.yawRate * dt;
  car.pos.x -= Math.sin(car.heading) * v * dt;
  car.pos.z -= Math.cos(car.heading) * v * dt;
  car.travelled += vAbs * dt;

  // ---- your head: where the mouse puts it, drifting home when left alone
  const lx = player.lookLag.x * 0.35, ly = player.lookLag.y * 0.35;
  player.lookLag.x -= lx; player.lookLag.y -= ly;
  head.yaw = clamp(head.yaw - lx, -1.9, 1.9);
  head.pitch = clamp(head.pitch - ly, -0.8, 0.55);
  head.idle = Math.abs(lx) + Math.abs(ly) > 1e-4 ? 0 : head.idle + dt;
  if (head.idle > 1.6 && vAbs > 3) {
    const k = 1 - Math.exp(-dt * 1.2);
    head.yaw -= head.yaw * k; head.pitch -= head.pitch * k;
  }

  // ---- what the chemistry does to the picture (all zero sober)
  const sf = Math.min(1, vAbs / 30);
  // the road itself, sober or not -- and the gravel only while you are
  // rolling over it: a parked car does not rumble
  const bump = ((opt.rough || 0) + 0.004) * sf;
  const swayYaw = Math.sin(clock * 0.43) * 0.10 * s.blur + Math.sin(clock * 0.21) * 0.07 * lost
    + Math.sin(clock * 0.17 + 2) * 0.05 * s.psych;
  const swayPitch = Math.sin(clock * 0.53) * 0.035 * s.blur;
  const roll = -car.yawRate * 0.035                      // leaning into a bend, sober too
    + Math.sin(clock * 0.61) * 0.09 * s.blur + Math.sin(clock * 0.33) * 0.08 * lost
    + Math.sin(clock * 0.27) * 0.11 * s.psych;
  player.roll += (roll - player.roll) * (1 - Math.exp(-dt * 3));
  const fov = 72 + s.rush * sf * 16 + Math.sin(clock * 0.8) * 7 * s.psych + s.monster * 9;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }

  player.yaw = car.heading;
  player.pitch = head.pitch;
  // road texture is a smooth low rumble, not per-frame random noise, which
  // read as the picture jittering even sober
  const rumble = (Math.sin(clock * 23) * 0.6 + Math.sin(clock * 37 + 1) * 0.4) * bump * 0.5;
  camera.rotation.set(
    head.pitch + swayPitch + rumble + carPitch(),
    car.heading + head.yaw + swayYaw,
    player.roll);
  eyeOff.copy(DRIVER_SEAT).applyAxisAngle(THREE.Object3D.DEFAULT_UP, car.heading);
  const ground = roadY(car.pos.z - DESERT_Z);
  player.pos.set(car.pos.x + eyeOff.x, ground + DRIVER_SEAT.y, car.pos.z + eyeOff.z);
  camera.position.set(player.pos.x, player.pos.y + Math.sin(clock * 21) * bump * 3, player.pos.z);

  game.moving = false;
  game.speed = 0;
  audio.engine(vAbs / 27);
}

/** out of the car, back on your feet: the lens goes back to normal */
function leaveCar() {
  camera.fov = 72;
  camera.updateProjectionMatrix();
  head.yaw = 0; head.pitch = 0;
  audio.engine(-1);
}

/* ------------------------------------------------ the phone
   What src/touch.js reads, turned into what the mouse and the keys would
   have done, so everything downstream -- the drugs on your hands, the
   stagger, the car -- treats it exactly the same. The phone's turning and
   a dragged finger go in where the mouse goes (and lag and overshoot like
   it on booze and ether); the stick goes in where the keys go. */
const GYRO = 1.5;          // camera degrees per degree the phone turns
const phone = { walk: 0, strafe: 0, run: false };
let phoneDriving = false;
function phoneInput() {
  if (!touch.on) return;
  const t = sampleTouch();
  const driving = game.act === 3 && car.stage === 'road' && !car.parked && !wrecking;
  document.documentElement.classList.toggle('driving', driving);

  // in the car the thumbs are on the buttons and the head is on the road
  if (!game.over && !driving) {
    player.lookLag.x -= t.yaw * GYRO;
    player.lookLag.y -= t.pitch * GYRO;
    player.lookLag.x += t.dragX * 0.005;
    player.lookLag.y += t.dragY * 0.004;
  }
  // a conversation, a cut to black or a chair: the legs are not yours
  const still = !!game.dlg || driving || !!fade || !!winning || seminar.seated || game.over;
  phone.walk = still ? 0 : t.walk;
  phone.strafe = still ? 0 : t.strafe;
  phone.run = !still && t.run;

  if (driving) {
    if (!phoneDriving) {
      resetTouch();
      game.say('Hold GAS to go and BRAKE to stop -- keep holding it to reverse. '
        + 'The arrows steer.', null, 6);
    }
    // the four buttons are the four keys, held for as long as they are held
    keys.KeyW = t.pads.gas;
    keys.KeyS = t.pads.brake;
    keys.KeyA = t.pads.left;
    keys.KeyD = t.pads.right;
    phoneDriving = true;
  } else if (phoneDriving) {
    keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = false;
    resetTouch();
    phoneDriving = false;
  }
}

initTouch({
  driving: () => document.documentElement.classList.contains('driving'),
  // a tap on the view is E; a tap on a thing on screen is that thing
  tap(target) {
    if (!started || game.over) return;
    const opt = target.closest('.dlg-options li');
    if (opt) { game.choose([...opt.parentNode.children].indexOf(opt)); return; }
    const vial = target.closest('.vial');
    if (vial) { game.take(vial.dataset.k); document.body.classList.remove('case-open'); return; }
    if (target.closest('#case-btn')) { document.body.classList.toggle('case-open'); return; }
    if (target.closest('#tasks')) { document.getElementById('tasks').classList.toggle('dim'); return; }
    if (document.body.classList.contains('case-open')) { document.body.classList.remove('case-open'); return; }
    // in the car the buttons are all there is
    if (game.dlg || document.documentElement.classList.contains('driving')) return;
    interact();
  },
});

/* ------------------------------------------------ fades
   A cut to black and back, with the change of scene in the dark middle.
   Leaving the suite used to teleport you into a moving car mid-frame. */
let fade = null;
function fadeThrough(fn, secs = 2.4) {
  fade = { t: 0, secs, fn, fired: false };
}
function updateFade(dt) {
  if (!fade) return;
  fade.t += dt;
  const half = fade.secs / 2;
  if (!fade.fired && fade.t >= half) { fade.fired = true; fade.fn(); }
  game.blackout = fade.t < half ? Math.max(0, 1 - fade.t / (half * 0.8))
                                : Math.min(1, (fade.t - half) / half);
  if (fade.t >= fade.secs) { game.blackout = 1; fade = null; }
}

/* ------------------------------------------------ the Mint 400
   What the story is supposed to be about. You sit down at the typewriter
   and the room goes, and you are back at the pits that morning with the
   dust coming across the track like weather. Three of the machines, seen
   with your own eyes -- or a minute and a half of engines going by in a
   cloud -- and you are back at the desk with whatever you have. */
let mintOn = false;
let mintT = 0;
const MINT_SECS = 90;
const mintFwd = new THREE.Vector3();
function startMint() {
  mintOn = true;
  mintT = 0;
  mint.reset();
  suite.hide();
  gonzo.group.visible = false;
  mint.show();
  scene.fog = FOG[5];
  renderer.setClearColor(mint.fog.color, 1);
  audio.ambience = 'desert';
  player.pos.set(MINT.x + MINT_SPAWN.x, 1.72, MINT.z + MINT_SPAWN.z);
  player.vel.set(0, 0, 0);
  player.lookLag.set(0, 0);
  player.yaw = 0;                 // facing the rail and the track beyond it
  player.pitch = 0;
  game.activate('mint');
  game.mintSeen = [];
  game.say('That morning. The Mint 400: the richest off-road race in the history of '
    + 'organised sport, and you can see about thirty feet. Get to the rail. Get a look at something.', null, 8);
}
function updateMint(dt, s2) {
  mintT += dt;
  // how far into it you can see is how well you can see: sober, the rail
  // and not much past it; on the mescaline, half the back straight
  const see = 7 + 36 * s2.perception;
  mint.fog.density = 1.38 / see;
  camera.getWorldDirection(mintFwd);
  const { seen, passes } = mint.update(dt, clock, camera.position, mintFwd, see);
  for (const r of passes) {
    const side = Math.sin(Math.atan2(-r.toR.x, -r.toR.z) - player.yaw);
    audio.bike(0.09 / (1 + r.d * 0.04), clamp(-side, -0.9, 0.9));
  }
  for (const r of seen) {
    if (game.mintSeen.length >= 3) break;
    game.mintSeen.push(r.def);
    audio.good();
    game.toast(`#${r.def.n} — IN THE NOTEBOOK (${game.mintSeen.length}/3)`, 'good');
    game.say(`Out of the dust: ${r.def.what}.`, null, 5);
  }
  if (!fade && (game.mintSeen.length >= 3 || mintT > MINT_SECS)) {
    if (game.mintSeen.length < 3) {
      game.say('Then the dust closes over all of it, and the morning is gone.', null, 4);
    }
    fadeThrough(endMint, 3.4);
  }
}
function endMint() {
  mintOn = false;
  mint.hide();
  suite.show();
  gonzo.group.visible = true;
  scene.fog = FOG[2];
  renderer.setClearColor(0x000000, 1);
  audio.ambience = 'suite';
  // back in the chair, facing the machine
  player.pos.set(SUITE_X + 4.9, 1.72, -1.6);
  player.vel.set(0, 0, 0);
  player.lookLag.set(0, 0);
  player.yaw = 0;
  player.pitch = -0.25;
  game.completeTask('mint');
  // and it all comes out at once, whatever the chemistry says now
  game.fileStory(true);
}

/* Where the car is allowed to be, and what it costs to be anywhere else.
   Three places with three sets of rules:
     the motor court   paved all round; the kerb, the island and the canopy
                       pillars stop you with a jolt, and nothing else does
     the town street   the parking lane is road; the sidewalk is a kerb you
                       bounce up; the storefronts, the lamp posts and the
                       parked cars are things you hit
     the open road     the shoulder and the scrub slow you down; driving
                       out into the desert proper (25m off) is a wreck
   Returns true if the drive is over. */
const prevPos = new THREE.Vector3();
const OFFROAD_FEAR = 0.3;      // the most the dirt alone will ever frighten you
function roadRules(dt, dir) {
  const x = car.pos.x - DESERT_X, s = -(car.pos.z - DESERT_Z);
  const lx = latOf(car.pos.x, car.pos.z);
  const fast = Math.abs(car.speed) > 9;
  // one bump is one bump, however long you keep your foot down into it
  const jolt = (keep) => {
    car.speed *= keep;
    if (!car.joltAt || clock - car.joltAt > 0.6) {
      audio.door();
      game.fear = clamp(game.fear + 0.04, 0, 1);
      car.joltAt = clock;
    }
  };
  let off = 0, hard = false;

  if (s < COURT.mouth) {
    // under the canopy the pavement kerb is behind you
    if (s < -3.3) { car.pos.z = DESERT_Z + 3.3; jolt(0.1); }
    if (!inCourt(x, s)) { off = 1; hard = true; }
    // the island, a kerb and a lawn and a fountain: round it, not over it
    const I = COURT.island;
    const ex = x / (I.rx + 1.0), es = (s - I.s) / (I.rs + 1.0), e = Math.hypot(ex, es);
    if (e < 1) {
      const k = 1 / Math.max(e, 0.05);
      car.pos.x = DESERT_X + x * k;
      car.pos.z = DESERT_Z - (I.s + (s - I.s) * k);
      jolt(0.3);
    }
    for (const [px, ps] of COURT.pillars) {
      const dx = x - px, ds = s - ps, d = Math.hypot(dx, ds) || 0.01;
      if (d < 1.5) { car.pos.x = DESERT_X + px + dx / d * 1.5; car.pos.z = DESERT_Z - (ps + ds / d * 1.5); jolt(0.15); }
    }
  } else {
    const inTown = s < TOWN.s1;
    off = Math.abs(lx) - (inTown ? 7.6 : ROAD.halfWidth);   // in town the parking lane is road
    hard = inTown ? off > 0 : off > ROAD.shoulder;
    if (inTown && s < 216 && Math.abs(lx) > 10.8) { game.crash('storefront'); return true; }
    if (!inTown && Math.abs(lx) > 25) { game.crash(); return true; }
    // turned round and heading back the way you came is its own way off the road
    if (s > COURT.mouth + 10 && Math.cos(relHeading(car.heading, car.pos.z) - (dir > 0 ? 0 : Math.PI)) < -0.2
        && car.speed > 8) { game.crash(); return true; }
  }

  // what is standing in the town for you to hit
  if (s < TOWN.s1 + 130) {
    for (const ob of desert.obstacles) {
      if (Math.abs(s - ob.s) < ob.hs + 2.6 && Math.abs(lx - ob.lat) < ob.hw + 1.0) {
        if (fast) { game.crash(ob.kind); return true; }
        car.pos.copy(prevPos);
        car.speed = 0;
        jolt(0);
        break;
      }
    }
  }

  if (off > 0) {
    // Off the tarmac is not a wreck. The dirt slows you down and makes you
    // a little nervous while you are moving on it, and that is all: a
    // little, and only up to a point, and not at all once you have stopped
    // -- pulling onto the shoulder for the highway patrol is pulling over,
    // not a crime. It used to climb a fifth of the bar a second, standing
    // still or not, and end the drive after a few seconds of gravel. What
    // ends a drive now is hitting something.
    const moving = Math.min(1, Math.abs(car.speed) / 10);
    if (game.fear < OFFROAD_FEAR) game.fear = Math.min(OFFROAD_FEAR, game.fear + dt * 0.03 * moving);
    car.speed *= 1 - dt * (hard ? 1.1 : 0.35);
  }
  return false;
}

/* The drive itself. No colliders out here -- the only thing that can go
   wrong is the road leaving without you, and how well you hold it is
   almost entirely the motor channel, which is the point. */
function driveCar(dt, s) {
  const off = Math.abs(latOf(car.pos.x, car.pos.z)) - ROAD.halfWidth;
  // at the motel you are stopping, and straightening up to do it
  const assist = car.arrived ? clamp(-relHeading(car.heading, car.pos.z) * 0.8, -0.2, 0.2) : 0;
  prevPos.copy(car.pos);
  // stopped by the highway patrol, the car stays stopped until he is done
  const held = updateCop(dt);
  stepCar(dt, s, { brake: car.arrived || held, assist, rough: off > 0 && car.pos.z < DESERT_Z - COURT.mouth ? 0.03 : 0 });
  if (roadRules(dt, 1)) return;
  placeCar();
  if (updateTraffic(dt, 1)) return;

  // The last drive does not stop. You go past the motel with the phone
  // ringing, and over the grade, and that is the end of it.
  if (car.final) {
    if (car.pos.z - DESERT_Z <= desert.end - 70) game.finishWestward();
    return;
  }

  // Arriving: early enough that the car rolls to a stop short of the phone
  // booth rather than through it. This was a fixed 26m, and from 34m/s the
  // brakes need 68 -- the car sailed 40m past the motel and you got out in
  // the desert behind it. Start braking at the braking distance instead.
  const toGo = (car.pos.z - DESERT_Z) - (desert.end + 9);
  if (!car.arrived && toGo <= car.speed * car.speed / (2 * 8.5) + 2) {
    car.arrived = true;
    game.arrive();
  }
  if (car.arrived && car.speed < 0.3 && !car.parked) {
    // and then you get out, because the phone is not going to walk over
    clearTraffic();
    // the patrolman has gone about his day; he is not there on the way back
    // (and if he was still on your tail, the motel is where he lost interest)
    cop.mesh.visible = false;
    patrolman.group.visible = false;
    if (cop.state !== 'idle' && cop.state !== 'done') { game.completeTask('chp'); cop.state = 'done'; }
    car.speed = 0;
    car.parked = true;
    const out = new THREE.Vector3(-1.9, 0, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, car.heading);
    player.pos.set(car.pos.x + out.x, 1.72, car.pos.z + out.z);
    player.yaw = car.heading + head.yaw;
    player.pitch = 0;
    player.vel.set(0, 0, 0);
    player.roll = 0;
    leaveCar();
    audio.door();
    game.say('You get out. The engine ticks. The phone keeps ringing.');
  }
}

/* The way home, back up the same road. +Z is the route now, so there is
   no "turned round and went back" failure. Everything else is unchanged. */
function driveBack(dt, s) {
  const off = Math.abs(latOf(car.pos.x, car.pos.z)) - ROAD.halfWidth;

  let dh = relHeading(car.heading, car.pos.z) - Math.PI;
  while (dh > Math.PI) dh -= 6.283;
  while (dh < -Math.PI) dh += 6.283;
  // back into town and up to the traffic light at the motor court --
  // braking from the braking distance, and staying braked. It used to be
  // "within 8m of the kerb", which at speed put the car into the lobby.
  const toGo = (DESERT_Z - (COURT.mouth + 6)) - car.pos.z;
  if (!car.arrived && toGo <= car.speed * car.speed / (2 * 8.5) + 1.5) car.arrived = true;
  const arrived = car.arrived;
  const assist = arrived ? clamp(-dh * 0.8, -0.2, 0.2) : 0;

  prevPos.copy(car.pos);
  stepCar(dt, s, { brake: arrived, assist, rough: off > 0 && car.pos.z < DESERT_Z - TOWN.s1 ? 0.03 : 0 });
  if (roadRules(dt, -1)) return;
  placeCar();
  if (updateTraffic(dt, -1)) return;

  // roll to a stop at the light, where the valet can have it, and the night
  // is over. The hotel has been in the windscreen the whole way back.
  if (arrived && car.speed < 0.3 && !car.parked) {
    clearTraffic();
    car.speed = 0;
    car.parked = true;
    audio.engine(-1);
    game.finishReturn();
    audio.door();
    // and in through the doors, to the fourth act
    fadeThrough(startActFour, 3.2);
  }
}

function collide(p) {
  // the Mint: the pits, behind the rail. The track is theirs.
  if (mintOn) {
    p.x = MINT.x + clamp(p.x - MINT.x, PITS.x0, PITS.x1);
    p.z = MINT.z + clamp(p.z - MINT.z, PITS.z0, PITS.z1);
    return;
  }
  // ACT THREE is a parking lot in the middle of nothing. There is no
  // geometry to push against and, more to the point, the casino's own
  // containment would drag the player 900m back across the map.
  if (game.act === 3) {
    const push = (cx, cz, hw, hd) => {
      const dx = p.x - cx, dz = p.z - cz;
      const ox = hw + RADIUS - Math.abs(dx);
      const oz = hd + RADIUS - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) p.x += Math.sign(dx || 1) * ox;
        else p.z += Math.sign(dz || 1) * oz;
      }
    };
    for (const c of desert.colliders) push(DESERT_X + c.x, DESERT_Z + c.z, c.hw, c.hd);
    if (car.parked) push(car.pos.x, car.pos.z, 1.0, 2.7);
    const lx = p.x - DESERT_X;
    p.x = DESERT_X + clamp(lx, -40, 33);
    p.z = clamp(p.z, DESERT_Z + desert.end - 19, DESERT_Z + desert.end + 40);
    return;
  }

  // ACT FOUR. Same scheme as the suite: the walls, chairs and tables push,
  // and the rooms are the safety net. The ballroom is only yours once you
  // have a badge -- until then the double doors are as far as you get.
  if (game.act === 4) {
    for (const c of conv.colliders) {
      const dx = p.x - (CONV_X + c.x), dz = p.z - c.z;
      const ox = c.hw + RADIUS - Math.abs(dx);
      const oz = c.hd + RADIUS - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) p.x += Math.sign(dx || 1) * ox;
        else p.z += Math.sign(dz || 1) * oz;
      }
    }
    // (not your attorney: he walks at your heels, and would shove you about)
    for (const n of [registrar, georgiaDA]) {
      if (!n.group.visible || (n === georgiaDA && game.taskState('georgia') === 'done')) continue;
      const dx = p.x - n.group.position.x, dz = p.z - n.group.position.z;
      const d = Math.hypot(dx, dz) || 0.0001, need = 0.35 + RADIUS;
      if (d < need) { p.x = n.group.position.x + (dx / d) * need; p.z = n.group.position.z + (dz / d) * need; }
    }
    const lx = p.x - CONV_X;
    const rooms = game.taskState('badge') === 'done' ? CONV.rooms
      : CONV.rooms.filter((r) => r.id === 'foyer');
    if (!rooms.some((r) => lx > r.x0 && lx < r.x1 && p.z > r.z0 && p.z < r.z1)) {
      let best = null, bd = Infinity;
      for (const r of rooms) {
        const cx = clamp(lx, r.x0 + 0.05, r.x1 - 0.05);
        const cz = clamp(p.z, r.z0 + 0.05, r.z1 - 0.05);
        const d = Math.hypot(lx - cx, p.z - cz);
        if (d < bd) { bd = d; best = { cx, cz }; }
      }
      p.x = CONV_X + best.cx;
      p.z = best.cz;
    }
    return;
  }

  // ACT TWO. The rooms come from SUITE.rooms, the same list the walls were
  // generated from, so a wall can never stand where you are allowed to be.
  if (game.act === 2) {
    for (const c of suite.colliders) {
      const dx = p.x - (SUITE_X + c.x), dz = p.z - c.z;
      const ox = c.hw + RADIUS - Math.abs(dx);
      const oz = c.hd + RADIUS - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) p.x += Math.sign(dx || 1) * ox;
        else p.z += Math.sign(dz || 1) * oz;
      }
    }
    const lx = p.x - SUITE_X;
    // The walls now stop you themselves, so this is only a safety net and
    // it tests the rooms AS WRITTEN. Inflating them by the body radius --
    // which is what it used to do -- shrank each room by 0.85m on every
    // side, and since the bedroom and the bathroom only overlap by half a
    // metre at the doorway, the two shrunken rooms stopped touching and
    // the bathroom became unreachable on foot.
    // the hall is only yours once the story is filed and you are leaving
    const rooms = game.taskState('downstairs') === 'active'
      ? [...SUITE.rooms, SUITE.hall] : SUITE.rooms;
    const roomsIn = rooms.filter((r) =>
      lx > r.x0 && lx < r.x1 && p.z > r.z0 && p.z < r.z1);
    if (roomsIn.length === 0) {
      let best = null, bd = Infinity;
      for (const r of rooms) {
        const cx = clamp(lx, r.x0 + 0.05, r.x1 - 0.05);
        const cz = clamp(p.z, r.z0 + 0.05, r.z1 - 0.05);
        const d = Math.hypot(lx - cx, p.z - cz);
        if (d < bd) { bd = d; best = { cx, cz }; }
      }
      p.x = SUITE_X + best.cx;
      p.z = best.cz;
    }
    return;
  }

  for (const c of world.colliders) {
    if (c.circle) {
      // the merry-go-round: you stay on the outside of it
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz) || 0.0001;
      const need = c.r + RADIUS;
      if (d < need) { p.x = c.x + (dx / d) * need; p.z = c.z + (dz / d) * need; }
      continue;
    }
    const dx = p.x - c.x, dz = p.z - c.z;
    const ox = c.hw + RADIUS - Math.abs(dx);
    const oz = c.hd + RADIUS - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) p.x += Math.sign(dx || 1) * ox;
      else p.z += Math.sign(dz || 1) * oz;
    }
  }

  // the building is a rotunda with a wing at each end, so containment
  // is per-zone. The seams are sized so the widths match across them.
  const F = world.frontage;
  const inDoorway = p.x > F.DOOR.x0 + RADIUS && p.x < F.DOOR.x1 - RADIUS;
  if (p.z < F.PAVE_Z + 0.5) {
    // OUT FRONT: the pavement and the drive under the canopy. The highway
    // starts past the drive, and you are not walking down it.
    if (game.leaving && car.stage === null) {
      // the parked car, lying along the road (it is ~2m wide, ~5.4m long)
      const at = F.car;
      const dx = p.x - at.x, dz = p.z - at.z;
      const ox = 1.1 + RADIUS - Math.abs(dx), oz = 2.8 + RADIUS - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) p.x += Math.sign(dx || 1) * ox; else p.z += Math.sign(dz || 1) * oz;
      }
    }
    p.x = clamp(p.x, F.X0 + 2 + RADIUS, F.X1 - 2 - RADIUS);
    p.z = clamp(p.z, F.DRIVE_Z + RADIUS, F.PAVE_Z + 0.5);
    // back inside only through the doors, never round the end of the wall
    if (!inDoorway) p.z = Math.min(p.z, F.PAVE_Z - RADIUS);
  } else if (p.z <= -30) {
    // the lounge runs on east of the lobby wall; the wall itself, and its
    // doorway, are colliders, so this only has to allow for the room
    const L = world.lounge;
    const inLoungeBand = p.z > L.Z0 + RADIUS && p.z < L.Z1 - RADIUS;
    p.x = clamp(p.x, -world.LOB_X + RADIUS, (inLoungeBand ? L.X1 : world.LOB_X) - RADIUS);
    // the front doors only open for somebody leaving
    const zMin = game.leaving && inDoorway ? F.PAVE_Z : world.LOB_Z1 + 0.5 + RADIUS;
    p.z = clamp(p.z, zMin, -29);
  } else if (p.z >= 30.5) {
    p.x = clamp(p.x, -13 + RADIUS, 13 - RADIUS);
    p.z = clamp(p.z, 30, 54.9 - RADIUS);
  } else {
    const d = Math.hypot(p.x, p.z);
    const lim = world.R - RADIUS;
    if (d > lim) { p.x *= lim / d; p.z *= lim / d; }
  }
}

function movePlayer(dt, s) {
  // ---- look ------------------------------------------------
  // the hand moves; the head follows, late, and keeps going
  const settle = 1 - Math.pow(0.0001,
    dt * Math.max(0.10, 1 - (1 - s.motor) * 0.88));
  const dx = player.lookLag.x * settle;
  const dy = player.lookLag.y * settle;
  player.lookLag.x -= dx;
  player.lookLag.y -= dy;
  player.yaw -= dx;
  player.pitch -= dy;

  const t = clock;

  // ether takes the head away from you: it drifts off the line you
  // pointed it at. adrenochrome does the opposite — it will not hold still.
  const lost = 1 - s.motor;                       // how much of the body is gone
  const wanderYaw = Math.sin(t * 0.31) * 0.34 * lost + Math.sin(t * 0.13) * 0.08 * s.blur;
  const wanderPitch = Math.sin(t * 0.43) * 0.14 * lost;
  const twitchYaw = (Math.random() - 0.5) * 0.020 * s.jitter;
  const twitchPitch = (Math.random() - 0.5) * 0.014 * s.jitter;

  player.pitch = clamp(player.pitch, -1.35, 1.35);

  camera.rotation.y = player.yaw + wanderYaw + twitchYaw;
  camera.rotation.x = player.pitch + wanderPitch + twitchPitch;

  const targetRoll =
    Math.sin(t * 0.9) * 0.12 * s.blur +
    Math.sin(t * 0.34) * 0.16 * lost +
    -dx * 1.4;
  player.roll += (targetRoll - player.roll) * (1 - Math.pow(0.001, dt));
  camera.rotation.z = player.roll;

  // ---- walk ------------------------------------------------
  let ix = 0, iz = 0;
  // no walking through a cut to black, or out of a closing lift
  if (!fade && !winning && !seminar.seated) {
    if (keys.KeyW || keys.ArrowUp) iz -= 1;
    if (keys.KeyS || keys.ArrowDown) iz += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyD || keys.ArrowRight) ix += 1;
    // a phone tipped a little walks a little (keys only ever give 1 or more)
    ix += phone.strafe; iz -= phone.walk;
  }
  const mag = Math.hypot(ix, iz);
  if (mag > 1) { ix /= mag; iz /= mag; }

  // forward is -Z at yaw 0, which is where the camera looks
  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  const run = (keys.ShiftLeft || keys.ShiftRight || phone.run) ? 1.6 : 1;
  const base = 4.4 * run * (1 - s.fear * 0.15) * (1 - lost * 0.42) * (s.legSpeed ?? 1);

  const wantX = (ix * cy + iz * sy) * base;
  const wantZ = (-ix * sy + iz * cy) * base;

  // GRIP — how much of the leg you are actually driving.
  // ether is the motor drug: at full dose the body keeps going
  // wherever it was already going, for about a second and a half.
  const grip = clamp(1 - lost * 0.92, 0.08, 1);
  const respond = 1 - Math.pow(0.0015, dt * grip * 5);
  player.vel.x += (wantX - player.vel.x) * respond;
  player.vel.z += (wantZ - player.vel.z) * respond;

  // a slow push in a direction you did not choose
  const dr = lost * 1.6;
  const driftX = Math.sin(t * 0.37) * dr;
  const driftZ = Math.cos(t * 0.29) * dr;

  // and the occasional lurch, which is the leg giving out entirely
  const motor = lost;
  if (motor > 0.22 && t > player.staggerAt) {
    player.staggerAt = t + (1.4 + Math.random() * 2.0) / motor;
    const a = Math.random() * 6.283;
    player.stagger.set(Math.cos(a), Math.sin(a)).multiplyScalar(motor * 3.4);
  }
  player.stagger.multiplyScalar(Math.pow(0.03, dt));

  player.pos.x += (player.vel.x + driftX + player.stagger.x) * dt;
  player.pos.z += (player.vel.z + driftZ + player.stagger.y) * dt;
  collide(player.pos);
  // in the chair you sway, but the chair does not go anywhere
  if (seminar.seated) {
    player.pos.x = CONV_X + CONV.seat.x; player.pos.z = CONV.seat.z;
    player.vel.set(0, 0, 0);
  }

  const spd = Math.hypot(player.vel.x, player.vel.z);
  game.moving = spd > 0.4;
  game.speed = spd / 4.4;

  // head bob — heavier and more lopsided the less of the body you have
  player.bob += dt * spd * 1.5;
  const lurch = 1 + motor * 1.8;
  const bobY = Math.sin(player.bob * 2) * 0.055 * lurch * Math.min(1, spd / 3);
  const bobX = Math.cos(player.bob) * 0.035 * lurch * Math.min(1, spd / 3);

  camera.position.set(
    player.pos.x + bobX,
    player.pos.y + bobY
      + Math.sin(t * 1.15) * 0.05 * s.rush
      - s.dim * 0.16,
    player.pos.z
  );
}

/* ------------------------------------------------ your attorney, along
   He is with you for most of it, the way he is in the film. On the floor
   he is at the nautical bar until you have spoken to him, and after that
   he comes with you: he walks the way you walked (a trail of where you
   have been, so he goes round the slots rather than through them), stops
   a couple of metres off when you stop, and every so often has something
   to say about it. At the convention he does the same, and takes the seat
   next to yours for the keynote. On the last morning he is in the car. */
const atty = { with: false, trail: [], barkIn: 14, lastBark: null };
const ATTY_GAP = 2.2;
const BARKS = {
  floor: [
    ['Keep walking. Look like you own the carpet. Legally, we may.', 'hands'],
    ['That man at the craps table has been a lizard since we came in. I am not going to mention it to him.', 'point'],
    ['As your attorney I advise you to buy a drink and hold it. People trust a man holding a drink.', 'shrug'],
    ['Do not look at the carpet. The carpet is looking for someone to blame.', 'shake'],
    ['This is the main nerve of the American Dream, and it smells of popcorn and fear.', 'laugh'],
    ['Somebody up there on the trapeze just looked at me with real contempt.', 'point'],
    ['We are in no danger. I want that on the record. Mostly no danger.', 'hands'],
    ['I would kill for a grapefruit. That is a figure of speech. Mostly.', 'fist'],
  ],
  high: [
    ['Your face is doing something. Do not let it do it near the security man.', 'recoil'],
    ['Breathe through the nose. The nose is on our side.', 'nod'],
    ['I can see it working on you. Good. Now try not to tell anybody.', 'laugh'],
  ],
  conv: [
    ['Four hundred cops and not one of them knows what we are. Smile at them.', 'laugh'],
    ['Look at the badges. Everyone is somebody here. We are somebody too, it says so.', 'point'],
    ['If anybody asks, I am your attorney and you are my attorney.', 'shrug'],
  ],
  car: [
    ['As your attorney I advise you to drive at top speed. It is the only way out of this state.', 'point'],
    ['Look at that sky. It is the colour of a pill I took once in Tijuana.', 'wave'],
    ['I think we got away with it. I want to say that once, out loud, before it stops being true.', 'laugh'],
    ['Do not stop for anything. Not the telephone. Not the police. Not me.', 'fist'],
  ],
};
function attorneyHere() {
  if (game.act === 1 && !game.finale && !game.leaving) return npcs[2];
  if (game.act === 2) return gonzo;
  if (game.act === 4) return gonzoC;
  if (carGonzo.group.visible) return carGonzo;
  return null;
}
/** follow the player along where they have actually walked */
function follow(n, dt) {
  const g = n.group, T = atty.trail;
  const last = T[T.length - 1];
  if (!last || Math.hypot(player.pos.x - last.x, player.pos.z - last.z) > 0.35) {
    T.push({ x: player.pos.x, z: player.pos.z });
    if (T.length > 80) T.shift();
  }
  // how far behind he is, along the trail
  let behind = Math.hypot(T[0].x - g.position.x, T[0].z - g.position.z);
  for (let i = 1; i < T.length; i++) behind += Math.hypot(T[i].x - T[i - 1].x, T[i].z - T[i - 1].z);
  behind += Math.hypot(player.pos.x - T[T.length - 1].x, player.pos.z - T[T.length - 1].z);
  // lost you entirely (a lift, a fade, a stool at the bar): catch up out of sight
  if (behind > 16) {
    const i = Math.max(0, T.length - 6);
    g.position.set(T[i].x, g.position.y, T[i].z);
    T.splice(0, i);
    return;
  }
  if (behind > ATTY_GAP && !game.dlg) {
    const speed = behind > 5 ? 3.4 : 1.5;
    let left = Math.min(speed * dt, behind - ATTY_GAP);
    while (left > 1e-4 && T.length) {
      const p0 = T[0];
      const dx = p0.x - g.position.x, dz = p0.z - g.position.z, d = Math.hypot(dx, dz);
      if (d <= left) {
        g.position.x = p0.x; g.position.z = p0.z; left -= d;
        if (T.length > 1) T.shift(); else break;
      } else { g.position.x += dx / d * left; g.position.z += dz / d * left; left = 0; }
    }
  }
  // standing about: he faces you
  n.homeYaw = Math.atan2(player.pos.x - g.position.x, player.pos.z - g.position.z);
}
function bark(where, s2, dt) {
  atty.barkIn -= dt;
  if (atty.barkIn > 0 || game.dlg || game._sayTimer > 0 || fade) return;
  atty.barkIn = 24 + Math.random() * 22;
  let pool = BARKS[where];
  if (where === 'floor' && (s2.perception > 0.4 || s2.psych > 0.3) && Math.random() < 0.6) pool = BARKS.high;
  let i = Math.floor(Math.random() * pool.length);
  if (pool[i][0] === atty.lastBark) i = (i + 1) % pool.length;
  atty.lastBark = pool[i][0];
  game.say(pool[i][0], 'YOUR ATTORNEY', 5.5);
  const n = attorneyHere();
  if (n) n.gesture(pool[i][1], 2.2);
}
function updateAttorneyFloor(dt, s2) {
  const n = npcs[2];
  if (game.finale || game.leaving || game.act !== 1) return;
  if (!atty.with) {
    // he joins you once you have found him and heard him out
    if (lastDlg === 'attorney' && !game.dlg) {
      atty.with = true;
      atty.trail.length = 0;
      atty.barkIn = 10;
      game.say('Your attorney gets up off the stool and falls in behind you, still talking.', null, 4);
    }
    return;
  }
  follow(n, dt);
  bark('floor', s2, dt);
}
/* at the convention: with you through the foyer, beside you in the seats,
   at the urn with the delegate from Georgia, and out the doors after you */
function updateAttorneyConv(dt, s2) {
  const n = gonzoC;
  if (seminar.seated) {
    n.pose = 'sit'; n.turns = false;
    n.group.position.set(CONV_X + CONV.seat.x + 0.75, 0, CONV.seat.z);
    n.group.rotation.y = Math.PI;
    n.homeYaw = Math.PI;
    // he reacts to the slides: badly
    if (Math.random() < dt * 0.12) n.gesture(['laugh', 'shake', 'point', 'lean'][Math.floor(Math.random() * 4)], 1.8);
    return;
  }
  n.pose = 'stand'; n.turns = true;
  // at the urn with the delegate from Georgia until that is done
  if (game.taskState('georgia') === 'active') {
    n.homeYaw = Math.atan2(georgiaDA.group.position.x - n.group.position.x,
      georgiaDA.group.position.z - n.group.position.z);
    atty.trail.length = 0;
    return;
  }
  follow(n, dt);
  bark('conv', s2, dt);
}
/* the last morning: in the passenger seat of whichever car is showing */
function updateCarAttorney(dt, s2) {
  const want = game.finale && game.taskState('westward') !== 'done';
  const host = car.stage ? desert.car : hotelCar;
  if (want && carGonzo.group.parent !== host) host.add(carGonzo.group);
  carGonzo.group.visible = want && host.visible !== false;
  if (!carGonzo.group.visible) return;
  // he watches the road, and you when he is talking to you
  if (carGonzo.speaking) carGonzo.lookTarget = camera.position;
  else {
    carGonzo.group.getWorldPosition(_ahead);
    const h = host.rotation.y;
    _ahead.x -= Math.sin(h) * 20; _ahead.z -= Math.cos(h) * 20;
    carGonzo.lookTarget = _ahead;
  }
  carGonzo.update(clock, s2, player.pos, false);
  if (car.stage && car.final) bark('car', s2, dt);
}
const _ahead = new THREE.Vector3();

/* ------------------------------------------------ who is talking
   The dialogue and the subtitles know WHO is speaking only by name; this
   turns that into a person, so the right mouth moves, the right hands go,
   and whoever is being spoken to listens (and nods). A line can ask for a
   gesture by name; otherwise one is picked now and then so nobody just
   stands there. */
const DLG_SPEAKER = {
  clerk: () => npcs[0], bill: () => npcs[0], dealer: () => npcs[1], attorney: () => npcs[2],
  security: () => npcs[3], valet: () => npcs[4], gonzo: () => gonzo, maid: () => maid,
  registrar: () => registrar, lecturer: () => keynote, georgia: () => georgiaDA, chp: () => patrolman,
  gonzo4: () => gonzoC, gonzo5: () => gonzoC,
};
const EVERYONE = [...npcs, gonzo, maid, ...convCast, carGonzo, patrolman];
let lastDlg = null, talkNode = null, talkT = 0, talkFor = 0;
function updateSpeakers() {
  EVERYONE.forEach((n) => { n.speaking = false; n.listening = false; });
  const d = game.dlg;
  const a = attorneyHere();
  if (d && d.node) {
    const partner = DLG_SPEAKER[d.who] ? DLG_SPEAKER[d.who]() : null;
    const who = /ATTORNEY/.test(d.node.who) ? a : partner;
    if (d.node !== talkNode) {
      talkNode = d.node; talkT = clock;
      talkFor = Math.min(4.5, 0.9 + (d.node.line || '').length * 0.04);
      if (who) {
        if (d.node.gesture) who.gesture(d.node.gesture, 1.8);
        else if (Math.random() < 0.4) who.gesture(['nod', 'shrug', 'hands', 'point'][Math.floor(Math.random() * 4)], 1.6);
      }
    }
    if (who) { who.speaking = clock - talkT < talkFor; who.listening = !who.speaking; }
    if (partner && partner !== who) partner.listening = true;
    // your attorney, if he is with you, listens in and watches whoever it is
    if (a && a !== who && a !== carGonzo) {
      a.listening = true;
      a.lookTarget = who ? who.group.getWorldPosition(_spk) : null;
    }
    lastDlg = d.who;
  } else {
    talkNode = null;
    if (a && a !== carGonzo) a.lookTarget = null;
    // lastDlg holds the conversation that just ended for exactly one frame
    if (lastDlg && lastDlgSeen) lastDlg = null;
  }
  lastDlgSeen = !d;
  // subtitles with a name on them
  if (game.sayWho && game._sayTimer > 0) {
    const n = game.sayWho === 'YOUR ATTORNEY' ? a : game.sayWho === keynote.name ? keynote : null;
    if (n) n.speaking = true;
  }
}
let lastDlgSeen = false;
const _spk = new THREE.Vector3();

/* The maid. She arrives when the bath is settled, knocks, stands in the
   open door until she is dealt with -- and then she walks off down the
   corridor and the door swings shut. She used to stay where she was for
   the rest of the act, which read as the errand not having worked. */
let phoneAt = 0.5;
function updateMaid(dt, s) {
  const st = maidState;
  const task = game.taskState('maid');
  if (st.phase === 'away' && task === 'active') {
    st.phase = 'here';
    maid.group.position.set(SUITE_X - 6.9, 0, 0);
    maid.group.rotation.y = Math.PI / 2;
    maid.group.visible = true;
    scene.add(maid.group);
    audio.knock();
  }
  if (st.phase === 'here') {
    maid.update(clock, s, player.pos, focusTarget?.obj === maid);
    if (task === 'done' && !game.dlg) { st.phase = 'leaving'; st.t = 0; }
  } else if (st.phase === 'leaving') {
    // turn to face down the corridor, then walk
    st.t += dt;
    const g = maid.group;
    if (st.t > 0.5) {
      // step out of the doorway first, then along the hall to the lifts
      if (g.position.x > SUITE_X - 7.2) g.position.x -= 1.3 * dt;
      else g.position.z -= 1.4 * dt;
    }
    maid.update(clock, s, player.pos, false);
    if (g.position.z < SUITE.liftCall.z + 0.5 || st.t > 14) {
      // and she is gone into the lift
      st.phase = 'gone';
      scene.remove(g);
      audio.pickup();
    }
  }
}

/* ------------------------------------------------ the loop */
let clock = 0;
let last = performance.now();

// No automatic resolution drop: it made the picture soft and did not fix
// the stutter, which came from draw calls, lights and uploads, not pixels.
let resScale = 1;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.05);
  if (!started) return;
  /* DBG-START */
  // A harness driving the clock itself holds the loop. Under a software GL a
  // frame costs seconds, and a free-running loop kept the main thread so busy
  // that a screenshot waited on the compositor until it timed out.
  if (document.documentElement.hasAttribute('data-fl-debug')
      && document.documentElement.hasAttribute('data-fl-hold')) return;
  /* DBG-END */
  tick(dt);
}

/* One step of the world. Separated from the rAF callback so it can be
   driven at a fixed timestep -- which is the only way to actually play
   the game under test, rather than teleporting past it.
   draw=false steps the world without rendering it: a test that walks for
   ten seconds needs the last frame, not six hundred of them. */
function tick(dt, draw = true) {
  if (game.over) return;
  clock += dt;

  const s = game.snapshot();

  // you took the call and turned the car around: reseated in place at the
  // motel, heading back up the same road -- no cut, no teleport
  if (game.pendingReturn && !fade) {
    game.pendingReturn = false;
    car.returning = true;
    car.parked = false;
    car.arrived = false;
    car.heading = Math.PI;
    car.speed = 0; car.wheel = 0; car.kick = 0;
    head.yaw = 0; head.pitch = 0;
    player.roll = 0;
    player.vel.set(0, 0, 0);
    player.lookLag.set(0, 0);
    audio.door();
    game.say('You get back in and turn the car around. The road runs back to the hotel.');
  }

  phoneInput();

  // How much humanity is breathing on you right now. Upstairs there are at
  // most two people in the room and a shut door is the whole point of the
  // place; on the highway there is nobody for forty miles.
  let near = 0;
  if (game.act === 1) {
    near = crowd.nearest;
    npcs.forEach((n) => {
      const d = n.group.position.distanceTo(player.pos);
      near = Math.max(near, Math.exp(-d * d / 42));
    });
    // standing in the open under the big top is its own kind of exposure
    if (player.pos.z > -30 && player.pos.z < 30.5) near = Math.max(near, 0.26);
    // and out on the pavement the building's noise is behind glass
    if (player.pos.z < world.frontage.PAVE_Z) near *= 0.3;
  } else if (game.act === 2) {
    [gonzo, maid].forEach((n) => {
      if (!n.group.parent) return;
      const d = n.group.position.distanceTo(player.pos);
      near = Math.max(near, Math.exp(-d * d / 26));
    });
  } else if (game.act === 4) {
    // a room built for looking at people: the foyer is a crowd, and the
    // middle of row seven is the worst seat in the building for a man in
    // your condition
    near = convCrowd.nearest;
    [registrar, gonzoC, georgiaDA].forEach((n) => {
      const d = n.group.position.distanceTo(player.pos);
      near = Math.max(near, Math.exp(-d * d / 42));
    });
    if (seminar.seated) near = Math.max(near, 0.92);
  }
  game.crowdNear = near;

  // the highway is the road outside the hotel: it is there the moment you
  // are at the front doors on the way out, and it stays under the car for
  // the drive. How light it is depends only on how far out of town you are.
  const outFront = game.act === 1 && game.leaving && player.pos.z < world.frontage.PAVE_Z + 4;
  desert.group.visible = game.act === 3 || outFront;
  if (desert.group.visible) { setDaylight(daylight()); desert.update(clock); }

  // act three is a car, not a pair of legs -- and so is pulling away
  if (wrecking) {
    // the car stays where it stopped while the picture goes
  } else if (game.act === 3 && !car.parked) {
    if (car.returning) driveBack(dt, s); else driveCar(dt, s);
  } else if (!(game.act === 3 && car.returning)) {
    // (parked back at the hotel, you stay in the seat while it fades out)
    movePlayer(dt, s);
  }
  game.update(dt);

  const s2 = game.snapshot();
  updateSpeakers();

  if (game.act === 1) {
    // the bar he works behind is turning. He does not turn with it any more.
    world.update(clock, s2, player.pos);
    updateAttorneyFloor(dt, s2);
    npcs.forEach((n) => n.update(clock, s2, player.pos, focusTarget?.obj === n));
    crowd.update(clock, s2, player.pos, dt, world.carousel.rotation.y);
    ghosts.forEach((g) => g.update(clock, s2));
    briefcase.update(clock, s2);
    pickups.forEach((p) => p.update(clock, s2));
    bats.update(clock, clamp((s2.loathing - 0.62) / 0.38, 0, 1), player.pos);
    updateZoneLights(player.pos);
    // the front doors part for somebody walking at them on the way out
    const F = world.frontage;
    const dd = Math.hypot(player.pos.x - (F.DOOR.x0 + F.DOOR.x1) / 2, player.pos.z - F.DOOR.z);
    F.doors(game.leaving && dd < 7 ? 1 : 0, dt);
    // past the glass the slot machines give way to the Boulevard, and in
    // the lounge there is only quiet music
    audio.ambience = player.pos.z < F.PAVE_Z ? 'street'
      : player.pos.x > world.lounge.X0 ? 'lounge' : 'casino';
  } else if (game.act === 2 && mintOn) {
    updateMint(dt, s2);
  } else if (game.act === 2) {
    gonzo.update(clock, s2, player.pos, focusTarget?.obj === gonzo);
    updateMaid(dt, s2);
    // the door is open while somebody is standing in it, and for the way out
    const doorWant = (maidState.phase === 'here' || maidState.phase === 'leaving'
      || game.taskState('downstairs') === 'active') ? 1.45 : 0;
    const dp = suite.doorPivot;
    dp.rotation.y += (doorWant - dp.rotation.y) * (1 - Math.pow(0.02, dt));
  } else if (game.act === 4) {
    updateAttorneyConv(dt, s2);
    convCast.forEach((n) => {
      if (!n.group.visible) return;
      n.update(clock, s2, player.pos, focusTarget?.obj === n);
    });
    if (game.taskState('georgia') === 'done' && !game.dlg && georgiaDA.group.visible) {
      const g = georgiaDA.group, W = GEORGIA_OUT[georgiaWalk.leg];
      const dx = W.x - g.position.x, dz = W.z - g.position.z, d = Math.hypot(dx, dz);
      georgiaWalk.t += dt;
      if (d < 0.2) {
        if (++georgiaWalk.leg >= GEORGIA_OUT.length) g.visible = false;
      } else {
        const k = Math.min(1, (1.35 * dt) / d);
        g.position.x += dx * k; g.position.z += dz * k;
      }
    }
    convCrowd.update(clock, s2, player.pos, dt);
    bats.group.visible = true;
    bats.update(clock, clamp((s2.loathing - 0.62) / 0.38, 0, 1), player.pos);
    if (seminar.seated) {
      const ev = game.updateLecture(dt);
      if (ev?.slide) conv.setSlide(ev.slide, ev.S);
      if (ev?.done) standUp();
    }
  } else if (game.act === 3) {
    // the sky is a backdrop, so it travels with you
    desert.sky.position.set(player.pos.x - DESERT_X, 0, player.pos.z - DESERT_Z);
    // the canopy keeps chasing while it is still in sight behind you
    world.frontage.update(clock, DESERT_Z - car.pos.z < 200);
    updateRoadVisions(dt, s2);
    // the last time past the motel it rings for you anyway, and you let it
    if (car.final && !game.over) {
      phoneAt -= dt;
      const ph = desert.phone;
      const dx = DESERT_X + ph.x - player.pos.x, dz = (DESERT_Z + ph.z) - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (phoneAt <= 0 && d < 260) {
        phoneAt = 2.6;
        const side = Math.sin(Math.atan2(-dx, -dz) - player.yaw);
        audio.ring(0.14 / (1 + d * 0.05), clamp(-side, -0.9, 0.9));
      }
    }
    // and the phone rings until somebody answers it
    if (game.taskState('callback') === 'active' && !game.dlg) {
      phoneAt -= dt;
      if (phoneAt <= 0) {
        phoneAt = 4;
        const ph = desert.phone;
        const dx = DESERT_X + ph.x - player.pos.x, dz = (DESERT_Z + ph.z) - player.pos.z;
        const d = Math.hypot(dx, dz);
        // pan it to where the booth actually is, relative to where you face
        const side = Math.sin(Math.atan2(-dx, -dz) - player.yaw);
        audio.ring(0.11 / (1 + d * 0.08), clamp(-side, -0.9, 0.9));
      }
    }
  }

  updateCarAttorney(dt, s2);
  if (patrolman.group.visible) patrolman.update(clock, s2, player.pos, false);

  findFocus();
  updateObjective();
  audio.update(s2, dt);

  updateFade(dt);

  // riding up
  if (winning) {
    winning += dt;
    game.blackout = Math.max(0, 1 - (winning - 1) / 2.2);
    if (winning > 3.4 && game.act === 1) { audio.stopElevator(); startActTwo(); }
  }

  s2.blackout = game.blackout;   // updateFade()/winning only touch blackout after s2
  if (draw) post.render(s2, clock, dt);

  /* DBG-START */
  // A dev channel over the DOM. The page's own globals are invisible to an
  // out-of-process inspector, so state goes out through an attribute and
  // commands come back in through one. Both halves are inert until something
  // sets data-fl-debug, and build.rb strips this block from the shipped file.
if (document.documentElement.hasAttribute('data-fl-debug')) {
    document.body.dataset.fl = JSON.stringify({
      psych: +s2.psych.toFixed(3), rush: +s2.rush.toFixed(3), blur: +s2.blur.toFixed(3),
      dim: +s2.dim.toFixed(3), monster: +s2.monster.toFixed(3),
      nerve: +s2.nerve.toFixed(2), perception: +s2.perception.toFixed(2),
      composure: +s2.composure.toFixed(2), legSpeed: +s2.legSpeed.toFixed(2),
      wreck: +s2.wreck.toFixed(3), motor: +s2.motor.toFixed(3),
      jitter: +s2.jitter.toFixed(3), fear: +s2.fear.toFixed(3),
      loathing: +s2.loathing.toFixed(3), flash: +s2.flash.toFixed(3),
      pos: [+player.pos.x.toFixed(1), +player.pos.z.toFixed(1)],
      yaw: +player.yaw.toFixed(2),
      car: [+car.speed.toFixed(2), +(car.wheel || 0).toFixed(3), +(car.heading || 0).toFixed(3), car.stage],
      carAt: [+car.pos.x.toFixed(2), +car.pos.z.toFixed(2)], desertAt: [+DESERT_X.toFixed(2), +DESERT_Z.toFixed(2)],
      cop: [cop.state, +(-(car.pos.z - DESERT_Z) - cop.s).toFixed(1)],
      mint: mintOn ? [+mintT.toFixed(1), (game.mintSeen || []).length, +mint.fog.density.toFixed(3)] : null,
      atty: [atty.with, +npcs[2].group.position.x.toFixed(2), +npcs[2].group.position.z.toFixed(2), +npcs[2].speed.toFixed(2)],
      attyConv: [+gonzoC.group.position.x.toFixed(2), +gonzoC.group.position.z.toFixed(2), gonzoC.pose],
      patrol: [patrolman.group.visible, +patrolman.speed.toFixed(2)],
      cam: [+camera.fov.toFixed(1), +camera.rotation.z.toFixed(3), +head.yaw.toFixed(2)],
      phantom: phantom.active, bats: roadBats.points.visible,
      // what a screenshot needs to know: is the picture mid-cut to black
      act: game.act, over: game.over, blackout: +game.blackout.toFixed(3),
      fading: !!fade || !!winning || game._blacking > 0,
      crashes: game.crashes, stock: Object.values(game.stock).reduce((a, n) => a + n, 0),
      road: game.act === 3 ? [+latOf(car.pos.x, car.pos.z).toFixed(2), +relHeading(car.heading, car.pos.z).toFixed(3),
        +(-(car.pos.z - DESERT_Z)).toFixed(0)] : null,
      traffic: traffic.filter((V) => V.active).map((V) => Math.round(V.s + (car.pos.z - DESERT_Z))),
      subs: Object.fromEntries(Object.entries(game.subs)
        .filter(([, v]) => v > 0.001).map(([k, v]) => [k, +v.toFixed(3)]))
      });
  const raw = document.documentElement.getAttribute('data-fl-cmd');
  if (raw) {
    document.documentElement.removeAttribute('data-fl-cmd');
      try {
      const c = JSON.parse(raw);
      if (c.tp) { player.pos.x = c.tp[0]; player.pos.z = c.tp[1]; player.vel.set(0, 0, 0); }
      if (c.yaw !== undefined) { player.yaw = c.yaw; player.lookLag.set(0, 0); }
      if (c.clear) { for (const k in game.subs) game.subs[k] = 0; game.flash = 0; }
      if (c.set) { for (const k in c.set) game.subs[k] = c.set[k]; }
      if (c.dose) game.take(c.dose);
      if (c.act2 && game.act === 1) startActTwo();
      if (c.dlg) document.body.dataset.flDlg = String(game.openDialogue(c.dlg));
      if (c.choose !== undefined) game.choose(c.choose);
      if (c.pick !== undefined || c.pickText) {
        // exactly what pressing the number does, minus the 170ms beat. The
        // options are shuffled on screen, so a test names the line it wants.
        const opts = (game.dlg && game.dlg.opts) || [];
        let i = c.pick;
        if (c.pickText) i = opts.findIndex((o) => o.text.includes(c.pickText));
        const opt = opts[i];
        const ok = !!(opt && game._optionAvailable(opt));
        if (i >= 0) game.choose(i, true);
        document.body.dataset.flPick = JSON.stringify({ ok, i, opts: opts.map((o) => o.text.slice(0, 30)),
          now: game.dlg ? game.dlg.node.who : 'closed' });
      }
      if (c.freeze) game.dlg && (game.dlg.t = 9999);   // stop the timer while testing
      if (c.act3) { if (!car.stage) getInCar(); }
      if (c.mint && game.act === 2 && !mintOn) startMint();
      if (c.sit && game.act === 4) { game.completeTask('badge'); sitDown(); }
      // the car, anywhere down the road, at any speed (the long drive, skipped)
      if (c.carTo !== undefined && car.stage) {
        roadPoint(c.carTo, c.carLat ?? 1.6, tp);
        car.pos.set(DESERT_X + tp.x, 0, DESERT_Z + tp.z);
        car.heading = tp.heading + (car.returning ? Math.PI : 0);
        if (c.carSpeed !== undefined) car.speed = c.carSpeed;
      }
      // straight into the convention, and straight out of it
      if (c.act4) startActFour();
      if (c.finale && game.act === 4) startFinale();
      // straight to the ride down, for testing the way out
      if (c.down && game.act === 2) { game.activate('downstairs'); startDownstairs(); }
// ---- playing the game, rather than teleporting through it ----------
// hold/release keys exactly as a player would
if (c.keys) for (const k in c.keys) keys[k] = !!c.keys[k];
// turn the head
if (c.look) {
  // in a car the mouse turns your head, not the car
  if (game.act === 3 && !car.parked) { head.yaw += c.look[0]; head.pitch += c.look[1] || 0; head.idle = 0; }
  else { player.yaw += c.look[0]; player.pitch = clamp(player.pitch + (c.look[1] || 0), -1.35, 1.35); }
}
// and run the world forward at a fixed timestep, which the browser's
// own frame throttling will never do for us
if (c.steps) {
  const n = Math.min(c.steps, 4000);
  // undrawn: rendering every step is what made a stepped walk cost
  // minutes under a software renderer. Pictures come from c.shot.
  for (let i = 0; i < n && !game.over; i++) tick(1 / 60, false);
}
if (c.press) {   // one interaction, the way E does it
  interact();
}
      if (c.key) game.give('key');
      if (c.skip) {   // fast-forward act one so act two can be tested
          game.hasKey = true; game.hasBriefcase = true; game.securityCleared = true;
        ["checkin", "score", "briefcase", "security"].forEach((t) => game.completeTask(t));
        }
      if (c.audit) document.body.dataset.flAudit =
      JSON.stringify(auditColliders(typeof c.audit === 'number' ? c.audit : 0.30));
      if (c.map) drawWalkMap();
      // what the frame is made of: the heaviest visible meshes by triangles
      if (c.census) {
        const rows = [];
        scene.traverseVisible((o) => {
          if (!o.isMesh && !o.isPoints) return;
          const g = o.geometry; if (!g) return;
          const per = (g.index ? g.index.count : g.attributes.position.count) / 3;
          const inst = o.isInstancedMesh ? o.count : 1;
          const wp = new THREE.Vector3(); o.getWorldPosition(wp);
          let path = o.name || ''; let q = o.parent;
          for (let k = 0; k < 3 && q; k++, q = q.parent) path = (q.name || q.type) + '/' + path;
          rows.push({ tris: Math.round(per * inst), per: Math.round(per), inst, geo: g.type,
            mat: o.material?.type, at: [Math.round(wp.x), Math.round(wp.y), Math.round(wp.z)], path });
        });
        rows.sort((a, b) => b.tris - a.tris);
        const byGeo = {};
        rows.forEach((r) => { byGeo[r.geo] = (byGeo[r.geo] || 0) + r.tris; });
        const byMat = {};
        rows.forEach((r) => { byMat[r.mat] = (byMat[r.mat] || 0) + 1; });
        // which top-level things under the casino hold the meshes
        const byTop = {};
        scene.traverseVisible((o) => {
          if (!o.isMesh) return;
          let q = o; while (q.parent && q.parent !== world.root && q.parent !== scene) q = q.parent;
          const top = q.parent === world.root ? (q === o ? 'root-mesh' : 'group@' + Math.round(q.position.x) + ',' + Math.round(q.position.z) + ':' + q.children.length)
            : (q === o ? 'scene-mesh' : 'scene-group:' + q.type + ':' + q.children.length);
          byTop[top] = (byTop[top] || 0) + 1;
        });
        const topList = Object.entries(byTop).sort((a, b) => b[1] - a[1]).slice(0, 40);
        const rootKinds = {};
        world.root.children.forEach((o) => {
          if (!o.isMesh || !o.visible) return;
          const m = o.material;
          const k = (o.isInstancedMesh ? 'I:' : '') + m.type + (m.transparent ? '+T' : '') + (m.map ? '+map' : '')
            + (m.side === THREE.DoubleSide ? '+2S' : '') + (o.userData.dynamic ? '+dyn' : '') + (o.frustumCulled ? '' : '+nocull');
          rootKinds[k] = (rootKinds[k] || 0) + 1;
        });
        document.body.dataset.flCensus = JSON.stringify({ rootKinds, topList, meshes: rows.length,
          total: rows.reduce((a, r) => a + r.tris, 0), top: rows.slice(0, 25), byGeo, byMat });
      }
      // Frame cost at a fixed size, split into its parts. gl.finish() makes
      // each part wait for the GPU, so the numbers are real work, not queueing.
      if (c.perf) {
        const P = c.perf, gl = renderer.getContext();
        const W = P.w || 1440, Hh = P.h || 900, D = P.dpr || 1.25, N = P.n || 30;
        renderer.setPixelRatio(D); renderer.setSize(W, Hh, false);
        camera.aspect = W / Hh; camera.updateProjectionMatrix(); post.setSize(W, Hh, D);
        const snap = game.snapshot();
        // optionally switch a category off, to see what it costs
        const hidden = [];
        if (P.hide) scene.traverse((o) => {
          const m = o.material;
          const hit = { crowd: o.isInstancedMesh && o.parent === crowd.group,
            transparent: o.isMesh && m && m.transparent,
            standard: o.isMesh && !o.isInstancedMesh && m && m.type === 'MeshStandardMaterial',
            shader: o.isMesh && m && m.type === 'ShaderMaterial',
            points: o.isPoints, sprites: o.isSprite,
            instanced: o.isInstancedMesh, npcs: npcs.some((n) => n.group === o) || ghosts.some((g) => g.group === o),
          }[P.hide];
          if (hit && o.visible) { o.visible = false; hidden.push(o); }
        });
        gl.finish();
        let tTick = 0, tScene = 0, tPost = 0;
        for (let i = 0; i < N; i++) {
          let t0 = performance.now();
          clock += 1 / 60; game.update(1 / 60);
          if (game.act === 1) { world.update(clock, snap, player.pos);
            crowd.update(clock, snap, player.pos, 1 / 60, world.carousel.rotation.y); }
          let t1 = performance.now(); tTick += t1 - t0;
          renderer.setRenderTarget(post.rtScene); renderer.clear(); renderer.render(scene, camera); gl.finish();
          let t2 = performance.now(); tScene += t2 - t1;
          post.render(snap, clock, 1 / 60); gl.finish();
          tPost += performance.now() - t2;
        }
        hidden.forEach((o) => { o.visible = true; });
        const info = renderer.info.render;
        renderer.setRenderTarget(post.rtScene); renderer.render(scene, camera);
        let lights = 0; scene.traverseVisible((o) => { if (o.isLight && o.intensity > 0) lights++; });
        document.body.dataset.flPerf = JSON.stringify({ size: [W, Hh, D],
          tick: +(tTick / N).toFixed(2), scene: +(tScene / N).toFixed(2), post: +((tPost / N) - 0).toFixed(2),
          calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
          programs: renderer.info.programs.length, lights });
        resize();
      }
      if (c.res) { resScale = c.res; resize(); }
      // frame cost with the GPU actually waited on, not just queued
      if (c.bench) {
        const gl = renderer.getContext();
        const t0 = performance.now();
        for (let i = 0; i < c.bench; i++) { tick(1 / 60); gl.finish(); }
        const ms = (performance.now() - t0) / c.bench;
        renderer.info.autoReset = false; renderer.info.reset(); tick(1 / 60); gl.finish();
        renderer.info.autoReset = true;
        let lights = 0;
        scene.traverseVisible((o) => { if (o.isLight && !o.isAmbientLight && !o.isHemisphereLight) lights++; });
        document.body.dataset.flBench = JSON.stringify({ merged, ms: +ms.toFixed(2), calls: renderer.info.render.calls,
          tris: renderer.info.render.triangles, programs: renderer.info.programs.length, lights,
          w: renderer.domElement.width, h: renderer.domElement.height });
      }
      // which colliders are within reach of a point
      if (c.probe) document.body.dataset.flProbe = JSON.stringify(world.colliders
        .map((k, i) => ({ i, ...k, d: Math.hypot(k.x - c.probe[0], k.z - c.probe[1]) - (k.r || Math.max(k.hw, k.hd)) }))
        .filter((k) => k.d < 2).slice(0, 12));
      // The 3D frame as a PNG, without the HUD over it. Drawn and read back in
      // the same task: once the compositor has taken the drawing buffer it is
      // cleared, and a read-back after that comes out black. Last, so it sees
      // whatever the rest of this command did. shot: n draws n frames, which
      // is what the trails need to build up again; the history is cleared
      // first, or the last frame drawn -- maybe another act -- ghosts in.
      if (c.shot) {
        post.clearHistory();
        const frames = Math.max(1, Math.min(+c.shot || 1, 30));
        for (let i = 0; i < frames; i++) {
          if (!game.over) tick(1 / 60);
          else { const s = game.snapshot(); s.blackout = game.blackout; post.render(s, clock, 1 / 60); }
        }
        document.body.dataset.flShot = canvas.toDataURL('image/png');
      }
      } catch (err) { console.warn('dbg', err); }
    }
  }
  /* DBG-END */
}


/* -------------------------------------------------- resize */
function resize() {
  const w = innerWidth, h = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 1.25) * resScale;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  post.setSize(w, h, dpr);
}
addEventListener('resize', resize);
resize();

/* --------------------------------------------------- start */
document.getElementById('start').addEventListener('click', () => {
  askForMotion();
  if (touch.on) document.getElementById('tasks').classList.add('dim');
  audio.start();
  audio.resume();
  document.getElementById('title').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  started = true;
  last = performance.now();
  grabMouse();
  setTimeout(() => game.say(
    'Somewhere around the edge of the carpet the drugs began to take hold.'), 900);
  if (touch.on) setTimeout(() => game.say(touch.denied
    ? 'No motion access, so drag with the right thumb to look. To look by turning the phone, close this tab, open the game again and tap Allow.'
    : 'Left thumb to walk. Turn the phone to look round, or drag with the right thumb. Tap to act.',
  null, 7), 5600);
});

document.getElementById('again').addEventListener('click', () => location.reload());

/* ------------------------------------------------ no hitches
   A browser compiles each shader the first time something using it is
   drawn -- which in this game meant the first look into the lounge, the
   first sight of the clown, the lift arriving at the suite -- and Safari
   in particular stops dead while it does. So every room is compiled now,
   behind the title screen, into the same target the game renders into
   (a shader built for the canvas is a different shader). */
function precompile() {
  const r = renderer;
  r.setRenderTarget(post.rtScene);
  // the floor, as it is when you walk out onto it
  scene.fog = FOG[1];
  r.compile(scene, camera);
  // room 1850, with both people in it
  showCasino(false);
  suite.show();
  scene.add(gonzo.group, maid.group);
  scene.fog = FOG[2];
  r.compile(scene, camera);
  scene.remove(gonzo.group, maid.group);
  suite.hide();
  // the Mint, in its dust
  mint.show();
  scene.fog = FOG[5];
  r.compile(scene, camera);
  mint.hide();
  // the road -- with the hotel still standing at the end of it, which is
  // how it is both out front on the way out and for the whole drive
  world.root.visible = true;
  desert.show();
  scene.fog = FOG[3];
  phantom.g.visible = true;
  roadBats.points.visible = true;
  r.compile(scene, camera);
  phantom.g.visible = false;
  roadBats.points.visible = false;
  desert.hide();
  // the convention wing, with everyone in it
  world.root.visible = false;
  conv.show();
  convCrowd.group.visible = true;
  convCast.forEach((n) => { n.group.visible = true; });
  scene.fog = FOG[4];
  r.compile(scene, camera);
  conv.hide();
  convCrowd.group.visible = false;
  convCast.forEach((n) => { n.group.visible = false; });
  world.root.visible = true;
  // and back to where the game starts
  showCasino(true);
  scene.fog = FOG[1];
  r.setRenderTarget(null);
}
try { precompile(); } catch (err) { console.warn('precompile', err); }

requestAnimationFrame(frame);
/* DBG-START */
// A hidden browser pane gets no animation frames at all (and throttled
// timers), which freezes the dev channel with it. An event dispatched on the
// document runs its listener synchronously, so the harness can pump one
// fixed step itself and the command it just wrote is consumed there and then.
// The pumped step is not drawn: pictures come from the shot command.
document.addEventListener('fl-pump', () => {
  if (started && document.documentElement.hasAttribute('data-fl-debug')) tick(1 / 60, false);
});
/* DBG-END */
