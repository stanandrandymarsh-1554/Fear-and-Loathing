/* ============================================================
   THE DRIVE — act three.

   The hotel was a room you walk around. This is the opposite: the
   world comes at you and the only thing you control is whether the
   car stays between the lines. It is the one part of the game where
   the motor channel is the WHOLE mechanic rather than a texture on
   top of one -- ether and downers take your hands off the wheel, and
   there is no talking your way out of a ditch.

   The film's version of this road is the stretch out of Las Vegas
   toward Baker: two lanes of blacktop across the Mojave, a basin
   floor of creosote and rock with bare brown ranges standing off on
   either side, telephone poles, a barbed-wire right of way, the odd
   Joshua tree, a state line, and a phone booth at the end of it.

   It used to be a ruler-straight 900m on a flat sand plane. Now the
   road is a CENTRELINE -- a gentle curve in plan and a slow rise and
   fall in section -- and everything else is built off that one line:
   the tarmac ribbon, the paint, the poles, the fence, the terrain
   flattened under it, and the car's own height and pitch. Progress is
   still measured in -Z, so everything that asks "how far down the
   road am I" is unchanged; only "how far off the road am I" now asks
   the centreline.

   Both ends are straight and level: out of town -- the motor court
   under the hotel canopy and a quarter mile of neon downtown street --
   and into the motel lot at the far end.
   ============================================================ */
import * as THREE from 'three';

export const ROAD = {
  halfWidth: 5.2,        // tarmac, centre to edge
  shoulder: 2.4,         // gravel you can survive
  length: 2600,          // how far it is to the motel
  start: 0,              // player begins here and drives toward -Z
};
const L = ROAD.length;

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------------------------------------------------- the centreline
   s is distance down the road from the hotel, which is just -z. The
   window keeps the first and last few hundred metres straight and level:
   the whole town is laid out on a straight street, so nothing in it has
   to know the road ever bends. */
const win = (s) => sm(430, 740, s) * (1 - sm(L - 480, L - 150, s));

/* ---------------------------------------------------- the town end
   The car is parked under the hotel canopy at s = 0. Between there and
   the street is the MOTOR COURT: a paved circle round a landscaped island,
   which you drive round to get out. The highway proper starts where the
   court lets out onto the street, at a traffic light. Everything here is
   in desert-local metres, x across and s down the road. */
export const COURT = {
  halfW: 17,           // the court is a rectangle this wide...
  sMid: 30,            // ...down to here, then a half circle of radius halfW
  sTop: 5.7,           // where the court paving meets the hotel's own drive
  island: { s: 21, rx: 7, rs: 5.5 },
  mouth: 46,           // past this you are on the street
  // the canopy's pillars, which the court runs right up to
  pillars: [[-18.5, 4.8], [-9.5, 4.8], [11.5, 4.8], [19.5, 4.8]],
};
export const TOWN = { s0: 44, s1: 300 };     // the sidewalked downtown
/** is this desert-local point on the court's paving (island or not)? */
export function inCourt(x, s) {
  if (s < -3.5) return false;                 // up over the kerb onto the pavement
  if (s < COURT.sMid) return Math.abs(x) <= COURT.halfW;
  return Math.hypot(x, s - COURT.sMid) <= COURT.halfW;
}
const fx = (s) => win(s) * (72 * Math.sin(s / 430 - 0.6) + 30 * Math.sin(s / 170 + 1.1)
  + 9 * Math.sin(s / 61 + 0.3));
const gy = (s) => win(s) * (10 * Math.sin(s / 310 + 0.4) + 3.6 * Math.sin(s / 105 + 0.7));
const d1 = (f, s) => (f(s + 0.5) - f(s - 0.5));

/** road centre x at desert-local z */
export const roadX = (z) => fx(-z);
/** road surface height at desert-local z */
export const roadY = (z) => gy(-z);
/** the car heading that points straight down the road (southbound) */
export const roadHeading = (z) => -Math.atan(d1(fx, -z));
/** rise per metre travelled southbound */
export const roadSlope = (z) => d1(gy, -z);
/** signed distance from the centreline, + to the southbound driver's right */
export function lateral(x, z) {
  const k = d1(fx, -z);
  return (x - fx(-z)) / Math.sqrt(1 + k * k);
}

/** a point a given distance down the road and off to one side of it */
export function roadPoint(s, lat, out = {}) {
  const k = d1(fx, s), inv = 1 / Math.sqrt(1 + k * k);
  out.x = fx(s) + inv * lat; out.z = -s + k * inv * lat; out.y = gy(s);
  out.heading = -Math.atan(k); out.slope = d1(gy, s);
  return out;
}

/* The ground. Level with the road under it and for twenty metres either
   side, then broken ground, then the ranges. Flat all round the town end,
   and a range across the far horizon for the road to be heading toward. */
function hill(x, z) {
  const s = -z;
  const d = Math.abs(x - fx(Math.max(0, Math.min(L + 400, s))));
  const town = sm(420, 820, s);
  const roll = (Math.sin(x * 0.031 + z * 0.017) + Math.sin(x * 0.071 - z * 0.049 + 2)
    + Math.sin(x * 0.013 + z * 0.023 + 4)) * 1.6 + 4.8;
  const ridge = 55 + 45 * Math.sin(z / 260 + x / 420) + 38 * Math.abs(Math.sin(z / 83 + x / 97))
    + 22 * Math.abs(Math.sin(x / 41 - z / 57));
  const range = sm(140, 460, d) * (1 - 0.55 * sm(700, 900, Math.abs(x)));
  const ahead = sm(L + 250, L + 800, s) * (90 + 40 * Math.sin(x / 70));
  // the motel and its lot sit on level ground, west of the road
  const lot = sm(45, 95, Math.hypot(x + 12, s - L));
  return town * lot * (sm(20, 60, d) * roll + range * ridge) + ahead;
}
function groundY(x, z) {
  const s = Math.max(0, -z);
  return gy(Math.min(s, L + 400)) + hill(x, z);
}
export { groundY };

export function buildDesert(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const mat = (o) => new THREE.MeshStandardMaterial(o);
  const basic = (o) => new THREE.MeshBasicMaterial(o);
  let seed = 20260924;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  /* ---------------------------------------------- the ground
     One heightfield, ten metres to a cell, flat-shaded so the ranges
     read as rock faces rather than pudding. Coloured per vertex: basin
     sand, darker scrub ground, pale dry-lake flats, and the rust and
     umber of the slopes. It tucks a few metres north of the kerb so it
     runs under the driveway without a seam. */
  {
    const W = 1800, Z0 = 4, Z1 = -(L + 900);
    const nx = 180, nz = Math.round((Z0 - Z1) / 10);
    const geo = new THREE.PlaneGeometry(W, Z0 - Z1, nx, nz);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, (Z0 + Z1) / 2);
    const P = geo.attributes.position;
    const col = new Float32Array(P.count * 3);
    const c = new THREE.Color();
    const sand = new THREE.Color(0xc4a26c), scrubG = new THREE.Color(0x9a8456),
      lake = new THREE.Color(0xdccdae), rock = new THREE.Color(0x8e5c3e),
      umber = new THREE.Color(0x6a4a36);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i);
      const h = hill(x, z);
      P.setY(i, groundY(x, z) - 0.06);
      const n = Math.sin(x * 0.05 + z * 0.031) * Math.sin(x * 0.019 - z * 0.043);
      c.copy(sand).lerp(scrubG, 0.5 + 0.5 * Math.sin(x * 0.11 + z * 0.07) * 0.6 + n * 0.3);
      // dry lake beds: pale, and only where the basin is flat
      const lakeK = sm(0.55, 0.8, Math.sin(x * 0.004 + 1.3) * Math.sin(z * 0.0033 + 0.4)) * (1 - sm(4, 12, h));
      c.lerp(lake, lakeK * 0.85);
      c.lerp(rock, sm(12, 60, h) * 0.8);
      c.lerp(umber, sm(70, 150, h) * (0.5 + 0.5 * n));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, mat({ vertexColors: true, roughness: 1, flatShading: true }));
    group.add(ground);
  }

  /* ---------------------------------------------- ribbons along the road
     A strip between two lateral offsets, sampled every few metres down
     the centreline, so the tarmac, the shoulders and the paint all bend
     and climb together with nothing between them to crack open. */
  // the highway starts where the motor court lets out onto the street
  const S0 = COURT.mouth - 2, S1 = L + 200;
  const ribbon = (a, b, dy, material, step = 4) => {
    const n = Math.ceil((S1 - S0) / step) + 1;
    const pos = new Float32Array(n * 2 * 3);
    const idx = [];
    for (let i = 0; i < n; i++) {
      const s = Math.min(S1, S0 + i * step);
      const k = d1(fx, s), inv = 1 / Math.sqrt(1 + k * k);
      const cx = fx(s), cy = gy(s) + dy, cz = -s;
      // horizontal perpendicular to the direction of travel, to the right
      const nx = inv, nz = k * inv;
      pos.set([cx + nx * a, cy, cz + nz * a, cx + nx * b, cy, cz + nz * b], i * 6);
      if (i) { const o = (i - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // the winding comes out facing down on one side; the road is only
    // ever seen from above, so both faces is the cheaper fix
    material.side = THREE.DoubleSide;
    const m = new THREE.Mesh(geo, material);
    group.add(m);
    return m;
  };
  const HW = ROAD.halfWidth, SH = ROAD.shoulder;
  const gravelMat = mat({ color: 0x8a6a4a, roughness: 1 });
  ribbon(-HW - SH, -HW, -0.005, gravelMat);
  ribbon(HW, HW + SH, -0.005, gravelMat.clone());
  ribbon(-HW, HW, 0, mat({ color: 0x2c2b30, roughness: 0.85 }));
  // the white edge lines, which are the things you are trying to stay inside
  const edgeMat = basic({ color: 0xe0d8bc });
  ribbon(-HW + 0.29, -HW + 0.51, 0.012, edgeMat);
  ribbon(HW - 0.51, HW - 0.29, 0.012, edgeMat.clone());

  /* ---------------------------------------------- the centre line
     Yellow and broken, laid one dash at a time along the curve. */
  const place = new THREE.Object3D();
  place.rotation.order = 'YXZ';
  const at = (s, lat, y) => {
    const k = d1(fx, s), inv = 1 / Math.sqrt(1 + k * k);
    place.position.set(fx(s) + inv * lat, gy(s) + y, -s + k * inv * lat);
    return place;
  };
  const dashGeo = new THREE.PlaneGeometry(0.2, 3.4);
  const DASHES = Math.floor((S1 - S0 - 4) / 9);
  const dashes = new THREE.InstancedMesh(dashGeo, basic({ color: 0xd8b030 }), DASHES);
  dashes.frustumCulled = false;
  for (let i = 0; i < DASHES; i++) {
    const s = S0 + 4 + i * 9;
    at(s, 0, 0.014);
    place.rotation.set(-Math.PI / 2 + Math.atan(d1(gy, s)), -Math.atan(d1(fx, s)), 0);
    place.updateMatrix();
    dashes.setMatrixAt(i, place.matrix);
  }
  group.add(dashes);

  /* ---------------------------------------------- what goes past */
  const poleMat = mat({ color: 0x3b2a1e, roughness: 0.9 });
  // the power line starts where the town's own streetlights stop
  const POLES = Math.floor((L + 150 - TOWN.s1) / 45);
  const poles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 8.5, 0.3), poleMat, POLES);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.16, 0.16), poleMat, POLES);
  poles.frustumCulled = false; arms.frustumCulled = false;
  const poleTops = [];
  for (let i = 0; i < POLES; i++) {
    const s = TOWN.s1 + 20 + i * 45;
    at(s, 11.5, 0);
    const base = groundY(place.position.x, place.position.z);
    place.rotation.set(0, -Math.atan(d1(fx, s)), 0);
    place.position.y = base + 4.25; place.updateMatrix(); poles.setMatrixAt(i, place.matrix);
    place.position.y = base + 7.6; place.updateMatrix(); arms.setMatrixAt(i, place.matrix);
    poleTops.push(place.position.clone());
  }
  group.add(poles, arms);
  // the wire, sagging between the poles
  {
    const pts = [];
    for (let i = 0; i + 1 < poleTops.length; i++) {
      const A = poleTops[i], B = poleTops[i + 1];
      for (let k = 0; k < 6; k++) {
        const t0 = k / 6, t1 = (k + 1) / 6;
        const p0 = A.clone().lerp(B, t0), p1 = A.clone().lerp(B, t1);
        p0.y -= Math.sin(t0 * Math.PI) * 0.9; p1.y -= Math.sin(t1 * Math.PI) * 0.9;
        pts.push(p0, p1);
      }
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2a221c })));
  }

  // the right-of-way fence: a post every six metres and two strands of wire
  {
    const FENCE = 26, STEP = 6;
    const n = Math.floor((L - 300) / STEP);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 1.25, 0.09), poleMat, n * 2);
    posts.frustumCulled = false;
    const wire = [];
    let j = 0;
    [-1, 1].forEach((side) => {
      let prev = null;
      for (let i = 0; i < n; i++) {
        const s = 380 + i * STEP;
        at(s, side * FENCE, 0);
        const y = groundY(place.position.x, place.position.z);
        place.rotation.set(0, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.12);
        place.position.y = y + 0.6;
        place.updateMatrix();
        posts.setMatrixAt(j++, place.matrix);
        const top = place.position.clone(); top.y = y + 1.1;
        const mid = top.clone(); mid.y = y + 0.7;
        if (prev) wire.push(prev[0], top, prev[1], mid);
        prev = [top, mid];
      }
    });
    group.add(posts);
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire),
      new THREE.LineBasicMaterial({ color: 0x5a4a3a })));
  }

  /* ---------------------------------------------- the desert itself
     Creosote in its thousands, rocks, and the Joshua trees standing
     about like people who have been waiting a long time. All instanced. */
  const scatter = (count, near, far, fn) => {
    for (let i = 0; i < count; i++) {
      // the desert starts where the town gives out
      const s = TOWN.s1 + 40 + rnd() * (L - TOWN.s1);
      const side = rnd() > 0.5 ? 1 : -1;
      const lat = side * (near + Math.pow(rnd(), 1.6) * (far - near));
      at(s, lat, 0);
      const x = place.position.x, z = place.position.z;
      fn(i, x, groundY(x, z), z);
    }
  };
  {
    const SCRUB = 1400;
    const scrub = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.6, 0),
      mat({ color: 0x5a5a2c, roughness: 1, flatShading: true }), SCRUB);
    scrub.frustumCulled = false;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const tint = new THREE.Color();
    scatter(SCRUB, HW + SH + 1.5, 420, (i, x, y, z) => {
      const s = 0.5 + rnd() * 1.4;
      sc.set(s * (1 + rnd() * 0.5), s * (0.55 + rnd() * 0.3), s * (1 + rnd() * 0.5));
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * 6.28);
      m.compose(v.set(x, y + 0.25 * sc.y, z), q, sc);
      scrub.setMatrixAt(i, m);
      scrub.setColorAt(i, tint.setHSL(0.14 + rnd() * 0.06, 0.35, 0.22 + rnd() * 0.12));
    });
    group.add(scrub);

    const ROCKS = 420;
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
      mat({ color: 0x7a5a44, roughness: 1, flatShading: true }), ROCKS);
    rocks.frustumCulled = false;
    const e = new THREE.Euler();
    scatter(ROCKS, HW + SH + 3, 520, (i, x, y, z) => {
      const s = 0.4 + Math.pow(rnd(), 3) * 4.5;
      sc.set(s * (0.8 + rnd() * 0.6), s * (0.4 + rnd() * 0.4), s * (0.8 + rnd() * 0.6));
      q.setFromEuler(e.set(rnd(), rnd() * 6, rnd()));
      m.compose(v.set(x, y + sc.y * 0.3, z), q, sc);
      rocks.setMatrixAt(i, m);
      rocks.setColorAt(i, tint.setHSL(0.05 + rnd() * 0.04, 0.3, 0.28 + rnd() * 0.14));
    });
    group.add(rocks);

    // Joshua trees: a trunk that forks into two or three arms, each ending
    // in a dark spiky ball. Two instanced meshes between all of them.
    const TREES = 140;
    const limb = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1, 6),
      mat({ color: 0x5a4a38, roughness: 1, flatShading: true }), TREES * 4);
    const tuft = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.55, 0),
      mat({ color: 0x3e5a2a, roughness: 1, flatShading: true }), TREES * 3);
    limb.frustumCulled = false; tuft.frustumCulled = false;
    let li = 0, ti = 0;
    const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
    scatter(TREES, 14, 260, (i, x, y, z) => {
      const h = 2.2 + rnd() * 2.4;
      // the trunk
      m.compose(v.set(x, y + h / 2, z), q.identity(), sc.set(1.1, h, 1.1));
      limb.setMatrixAt(li++, m);
      const arms = 2 + (rnd() > 0.5 ? 1 : 0);
      for (let k = 0; k < 3; k++) {
        if (k < arms) {
          const a = rnd() * 6.28, lean = 0.5 + rnd() * 0.5, len = 1.0 + rnd() * 1.3;
          dir.set(Math.sin(a) * lean, 1, Math.cos(a) * lean).normalize();
          q.setFromUnitVectors(up, dir);
          m.compose(v.set(x + dir.x * len / 2, y + h + dir.y * len / 2 - 0.1, z + dir.z * len / 2), q,
            sc.set(0.8, len, 0.8));
          limb.setMatrixAt(li++, m);
          m.compose(v.set(x + dir.x * len, y + h + dir.y * len, z + dir.z * len), q.identity(),
            sc.setScalar(0.8 + rnd() * 0.5));
          tuft.setMatrixAt(ti++, m);
        } else {
          // a two-armed tree still needs all its instances accounted for
          m.makeScale(0, 0, 0); limb.setMatrixAt(li++, m); tuft.setMatrixAt(ti++, m);
        }
      }
    });
    group.add(limb, tuft);
  }

  /* ---------------------------------------------- road signs
     Green highway signs for the way out, and their backs for the way home.
     The distances are the film's road, squeezed into a few minutes. */
  const signs = [
    // s, which way it faces (1 = southbound driver), lines, colours
    [320, 1, ['BAKER 89', 'BARSTOW 152'], 'green'],
    [950, 1, ['CALIFORNIA', 'STATE LINE'], 'white'],
    [1000, -1, ['WELCOME TO', 'NEVADA'], 'white'],
    [1520, 1, ['SPEED', 'LIMIT 70'], 'white'],
    [2250, 1, ['BAKER', 'NEXT EXIT'], 'green'],
    [2280, -1, ['LAS VEGAS 88'], 'green'],
  ];
  signs.forEach(([s, face, lines, kind]) => {
    const sgn = new THREE.Group();
    const w = kind === 'green' ? 4.2 : 2.4, h = lines.length > 1 ? 2.2 : 1.3;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      basic({ map: signTexture(lines, kind), side: THREE.FrontSide }));
    panel.position.y = 2.6 + h / 2;
    sgn.add(panel);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat({ color: 0x8a8a84, roughness: 0.6 }));
    back.position.set(0, 2.6 + h / 2, -0.02);
    back.rotation.y = Math.PI;
    sgn.add(back);
    [-w / 3, w / 3].forEach((dx) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6 + h, 0.12), mat({ color: 0x9a9a94, roughness: 0.5 }));
      post.position.set(dx, (2.6 + h) / 2, -0.06);
      sgn.add(post);
    });
    at(s, face * (HW + SH + 2.2), 0);
    sgn.position.copy(place.position);
    sgn.rotation.y = -Math.atan(d1(fx, s)) + (face > 0 ? 0 : Math.PI);
    group.add(sgn);
  });

  // a billboard, sun-bleached, for something forty miles away
  {
    const bb = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5),
      basic({ map: billboardTexture() }));
    face.position.y = 5.5;
    bb.add(face);
    [-4.5, 0, 4.5].forEach((dx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.5, 0.3), poleMat);
      leg.position.set(dx, 2.75, -0.2);
      bb.add(leg);
    });
    at(1250, -34, 0);
    bb.position.set(place.position.x, groundY(place.position.x, place.position.z), place.position.z);
    bb.rotation.y = -Math.atan(d1(fx, 1250)) + 0.35;
    group.add(bb);
  }

  /* ---------------------------------------------- the town
     The motor court, the neon street, the outskirts, the city sign. */
  const town = buildTown(group, { mat, basic, rnd, at, place });

  /* ---------------------------------------------- the sky */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 24, 16),
    // no fog on the sky itself, or the haze eats the dawn it is lit by
    basic({ map: dawnTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.z = -L / 2;
  sky.renderOrder = -1;
  group.add(sky);

  /* ---------------------------------------------- the motel at the end
     Baker, where the film's phone booth is. The road is straight and level
     here, so nothing below needs to know the road ever bent. */
  const end = -L;
  const motel = new THREE.Group();
  motel.position.set(0, 0, end);
  group.add(motel);

  const blockMat = mat({ color: 0x8d7a5e, roughness: 0.95 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(26, 4.2, 9), blockMat);
  block.position.set(-16, 2.1, -10);
  motel.add(block);
  // a row of doors, because a motel is a row of doors
  const doorMat = mat({ color: 0x2f4d52, roughness: 0.7 });
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.16), doorMat);
    d.position.set(-27 + i * 3.6, 1.1, -5.6);
    motel.add(d);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(26, 0.3, 2.4),
    mat({ color: 0x6b3b2a, roughness: 0.9 }));
  canopy.position.set(-16, 2.9, -4.6);
  motel.add(canopy);
  // a gravel lot in front of it
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(40, 22), mat({ color: 0x9a8062, roughness: 1 }));
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(-14, 0.004, -2);
  motel.add(lot);

  // the sign, which is the only thing awake
  const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5),
    mat({ color: 0x4a3a2a, roughness: 0.9 }));
  signPost.position.set(9, 4.5, -2);
  motel.add(signPost);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 3.2),
    basic({ map: motelSignTexture(), transparent: true }));
  sign.position.set(9, 8.4, -2);
  motel.add(sign);
  const signBack = sign.clone();
  signBack.rotation.y = Math.PI;
  motel.add(signBack);

  const signLight = new THREE.PointLight(0xff6a2d, 60, 0, 2);
  signLight.position.set(9, 8.4, 0);
  motel.add(signLight);

  /* the payphone, which is the reason any of this is happening */
  const boothMat = mat({ color: 0x1d3f56, roughness: 0.5, metalness: 0.3 });
  const booth = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.3, 0.9), boothMat);
  booth.position.set(3.2, 1.15, -3.4);
  motel.add(booth);
  const phoneFace = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.2),
    mat({ color: 0x141414, roughness: 0.6 }));
  phoneFace.position.set(3.2, 1.45, -2.92);
  motel.add(phoneFace);
  const boothLight = new THREE.PointLight(0xbfe4ff, 14, 0, 2);
  boothLight.position.set(3.2, 2.5, -3.0);
  motel.add(boothLight);

  /* ---------------------------------------------- the car
     A red convertible, top down: the hood and the windshield frame are
     what tell you that you are in it, and it is still there when you
     get out. */
  const car = makeCar();
  group.add(car);

  /* things you can walk into once you are on foot, desert-local x */
  const colliders = [
    { x: 3.2, z: end - 3.4, hw: 0.5, hd: 0.45 },    // the phone booth
    { x: -16, z: end - 10, hw: 13, hd: 4.5 },       // the motel block
    { x: 9, z: end - 2, hw: 0.25, hd: 0.25 },       // the sign post
  ];

  /* ---------------------------------------------- lighting
     Kept in their own group so the daylight can be switched off when the
     road is shown at night out front of the hotel, and on for the drive.
     A low morning sun off to the east, which is the driver's left on the
     way out: it rakes across the ranges and picks out every rock face. */
  const lights = new THREE.Group();
  lights.add(new THREE.AmbientLight(0xcdbfb2, 1.6));
  lights.add(new THREE.HemisphereLight(0xbcd4e8, 0x8a6a4a, 1.4));
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.8);
  sun.position.set(-900, 420, -L / 2 + 300);
  sun.target.position.set(0, 0, -L / 2);
  lights.add(sun, sun.target);
  group.add(lights);

  return {
    group,
    end,
    sky,
    lights,
    car,
    colliders,
    phone: new THREE.Vector3(3.2, 0, end - 3.4),
    // the town's moving parts, what you can hit in it, and its night light
    update: town.update,
    obstacles: town.obstacles,
    setNight: town.setNight,
    show() { group.visible = true; },
    hide() { group.visible = false; },
  };
}

/* ---------------------------------------------- the traffic
   Somebody else is on this road. Not many -- a rig, a wagon, a pickup --
   and always in the other lane, coming at you. Car-local like makeCar:
   forward is -Z. */
export function makeVehicle(kind, color) {
  const g = new THREE.Group();
  const M = (color, r = 0.6, m = 0.1) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const tyre = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const dark = M(0x1a1616, 0.8);
  const glass = M(0x2a3a44, 0.2, 0.4);
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
  const wheels = (pairs, y = 0.42) => pairs.forEach(([x, z]) => { add(tyre, dark, x, y, z).rotation.z = Math.PI / 2; });
  if (kind === 'rig') {
    const cab = M(0xd8d2c0, 0.5, 0.2);
    add(new THREE.BoxGeometry(2.4, 2.2, 2.6), cab, 0, 1.9, -6.2);
    add(new THREE.BoxGeometry(2.3, 1.2, 1.8), cab, 0, 1.3, -8.1);   // the nose
    add(new THREE.BoxGeometry(2.2, 0.9, 0.05), glass, 0, 2.5, -7.51);
    add(new THREE.BoxGeometry(2.5, 2.9, 11), M(0xb8b4a8, 0.7), 0, 2.35, 1.0);   // the trailer
    add(new THREE.BoxGeometry(0.16, 1.2, 0.16), M(0xc8c8c8, 0.3, 0.7), 1.0, 3.4, -5.0);  // stack
    wheels([[-1.1, -7.6], [1.1, -7.6], [-1.1, -4.8], [1.1, -4.8], [-1.1, 4.5], [1.1, 4.5], [-1.1, 5.6], [1.1, 5.6]]);
    [-0.9, 0.9].forEach((x) => add(new THREE.CircleGeometry(0.16, 10), lamp, x, 1.1, -9.01).rotation.y = Math.PI);
    g.userData.len = 18; g.userData.halfW = 1.3;
  } else {
    const paint = M(color ?? (kind === 'wagon' ? 0x6a8a6a : 0x3a5a8a), 0.45, 0.15);
    const long = kind === 'wagon' ? 5.4 : 5.0;
    add(new THREE.BoxGeometry(1.9, 0.7, long), paint, 0, 0.75, 0);
    if (kind === 'wagon') add(new THREE.BoxGeometry(1.8, 0.6, 3.2), glass, 0, 1.4, 0.6);
    else {
      add(new THREE.BoxGeometry(1.8, 0.6, 1.4), glass, 0, 1.4, -0.4);
      add(new THREE.BoxGeometry(1.9, 0.35, 2.0), paint, 0, 1.25, 1.4);   // the bed sides
    }
    wheels([[-0.95, -1.6], [0.95, -1.6], [-0.95, 1.6], [0.95, 1.6]], 0.36);
    [-0.65, 0.65].forEach((x) => add(new THREE.CircleGeometry(0.13, 10), lamp, x, 0.8, -long / 2 - 0.01).rotation.y = Math.PI);
    g.userData.len = long; g.userData.halfW = 0.95;
  }
  g.userData.rigid = true;
  g.rotation.order = 'YXZ';
  return g;
}

/* The Great Red Shark, more or less. Car-local: forward is -Z, the
   driver sits on the left at DRIVER_SEAT, which is where the camera goes. */
export const DRIVER_SEAT = new THREE.Vector3(-0.42, 1.22, 0.45);

export function makeCar() {
  const car = new THREE.Group();
  // pitched with the road: yaw first, then the nose up or down
  car.rotation.order = 'YXZ';
  // no environment map out here, so anything fully metallic renders black:
  // the paint and the chrome are kept mostly diffuse on purpose
  const paint = new THREE.MeshStandardMaterial({ color: 0xc0202a, roughness: 0.4, metalness: 0.15 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8e6de, roughness: 0.3, metalness: 0.3 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.7 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xe6dcc2, roughness: 0.5 });
  const seat = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.8 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); car.add(o); return o; };

  add(new THREE.BoxGeometry(2.0, 0.60, 1.90), paint, 0, 0.60, -1.75);  // hood
  add(new THREE.BoxGeometry(2.0, 0.60, 1.50), paint, 0, 0.60, 2.00);   // rear deck
  [-1, 1].forEach((sd) => add(new THREE.BoxGeometry(0.14, 0.60, 2.05), paint, sd * 0.93, 0.60, 0.22));
  add(new THREE.BoxGeometry(1.8, 0.10, 2.05), trim, 0, 0.34, 0.22);    // floor
  add(new THREE.BoxGeometry(1.8, 0.20, 0.30), paint, 0, 0.90, -0.72);  // dashboard
  add(new THREE.BoxGeometry(1.8, 0.03, 0.04), chrome, 0, 1.01, -0.58); // its chrome lip
  add(new THREE.BoxGeometry(1.7, 0.16, 0.62), seat, 0, 0.58, 0.62);    // bench
  add(new THREE.BoxGeometry(1.7, 0.62, 0.14), seat, 0, 0.90, 0.98);    // seat back
  add(new THREE.BoxGeometry(2.04, 0.08, 5.3), chrome, 0, 0.30, 0.2);   // the bumper line

  // the windshield, leaning back toward you: two posts, a thin top rail,
  // and a pane you can only just see
  const lean = 0.35;
  [-0.9, 0.9].forEach((x) => {
    const p = add(new THREE.BoxGeometry(0.035, 0.46, 0.035), chrome, x, 1.22, -0.85);
    p.rotation.x = lean;
  });
  add(new THREE.BoxGeometry(1.84, 0.03, 0.03), chrome, 0, 1.44, -0.77);
  const pane = add(new THREE.PlaneGeometry(1.78, 0.44),
    new THREE.MeshBasicMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.07,
                                  depthWrite: false, side: THREE.DoubleSide }), 0, 1.22, -0.85);
  pane.rotation.x = lean;
  car.userData.pane = pane;          // the drive fades it in with the daylight

  // the wheel you are holding, top tipped away from you like the column
  const wheel = add(new THREE.TorusGeometry(0.17, 0.02, 8, 28), ivory,
    DRIVER_SEAT.x, 0.84, -0.30);
  wheel.rotation.x = -0.45;
  car.userData.wheel = wheel;
  wheel.userData.dynamic = true;     // it turns with your hands
  car.userData.rigid = true;         // drives as one piece
  const column = add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), trim,
    DRIVER_SEAT.x, 0.78, -0.52);
  column.rotation.x = Math.PI / 2 - 0.45;

  // road wheels
  const tyre = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16);
  [[-0.98, -1.55], [0.98, -1.55], [-0.98, 1.75], [0.98, 1.75]].forEach(([x, z]) => {
    const w = add(tyre, trim, x, 0.36, z);
    w.rotation.z = Math.PI / 2;
  });
  // lamps
  [-0.7, 0.7].forEach((x) => {
    // a circle faces +Z, so the headlights are turned round to face the road
    const hl = add(new THREE.CircleGeometry(0.14, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c8 }), x, 0.66, -2.71);
    hl.rotation.y = Math.PI;
    add(new THREE.CircleGeometry(0.1, 10), new THREE.MeshBasicMaterial({ color: 0xff2020 }), x, 0.66, 2.76);
  });
  return car;
}

/* What a wreck leaves on the car, one step worse each time: a star in the
   windscreen that spreads, a bonnet that buckles up at the front, and then
   a headlight out. Only ever added -- the car is batched at load, so its
   own parts cannot be bent -- and it drives exactly as it did. */
export function damageCar(car, level) {
  let d = car.userData.damage;
  if (!d) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    // just inside the glass, so it sits over the pane from the driver's seat
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(1.78, 0.44),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false,
                                    side: THREE.DoubleSide, fog: false }));
    crack.position.set(0, 1.22, -0.83);
    crack.rotation.x = 0.35;
    crack.renderOrder = 2;
    car.add(crack);
    // the front of the bonnet, kinked up in two panels
    const paint = new THREE.MeshStandardMaterial({ color: 0x9a1a22, roughness: 0.6, metalness: 0.1 });
    const buckle = new THREE.Group();
    [-0.5, 0.5].forEach((x, i) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.05, 0.9), paint);
      p.position.set(x, 0.94, -2.2);
      p.rotation.set(0.22 + i * 0.08, 0, (i ? -1 : 1) * 0.07);
      buckle.add(p);
    });
    buckle.visible = false;
    car.add(buckle);
    // a black disc over the passenger-side headlight
    const dead = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12),
      new THREE.MeshBasicMaterial({ color: 0x111111 }));
    dead.position.set(0.7, 0.66, -2.72);
    dead.rotation.y = Math.PI;
    dead.visible = false;
    car.add(dead);
    d = car.userData.damage = { cv, tex, buckle, dead };
  }

  // the crack: a star low on the passenger side, then more stars
  const g = d.cv.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stars = [[330, 96], [150, 70], [420, 40], [250, 30]].slice(0, Math.min(level, 4));
  g.lineCap = 'round';
  for (const [cx, cy] of stars) {
    for (let r = 0; r < 11; r++) {
      const a = rnd() * Math.PI * 2, len = 40 + rnd() * 120;
      let x = cx, y = cy;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 1; k <= 4; k++) {
        const aa = a + (rnd() - 0.5) * 0.6;
        x += Math.cos(aa) * len / 4; y += Math.sin(aa) * len / 4;
        g.lineTo(x, y);
      }
      g.strokeStyle = 'rgba(235,240,245,0.75)'; g.lineWidth = 1.6; g.stroke();
    }
    // the rings round the point of impact
    for (let ring = 1; ring <= 2; ring++) {
      g.beginPath(); g.arc(cx, cy, 8 * ring, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(235,240,245,0.55)'; g.lineWidth = 1.2; g.stroke();
    }
    g.fillStyle = 'rgba(240,244,248,0.8)';
    g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
  }
  d.tex.needsUpdate = true;
  d.buckle.visible = level >= 1;
  d.dead.visible = level >= 2;
}

/* the sky, a bright morning over the desert: clear and blue, the sun
   still low enough to warm the horizon */
function dawnTexture() {
  const cv = document.createElement('canvas');
  cv.width = 8; cv.height = 256;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, '#4a7fc8');
  grad.addColorStop(0.55, '#9cc4e0');
  grad.addColorStop(0.78, '#e8c8a0');
  grad.addColorStop(0.92, '#f8d8a8');
  grad.addColorStop(1.00, '#ffe8b8');
  g.fillStyle = grad; g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function motelSignTexture() {
  const cv = document.createElement('canvas');
  cv.width = 300; cv.height = 128;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 300, 128);
  g.fillStyle = '#20131a';
  g.fillRect(4, 4, 292, 120);
  g.strokeStyle = '#ff6a2d'; g.lineWidth = 4;
  g.strokeRect(10, 10, 280, 108);
  g.fillStyle = '#ffd08a';
  g.font = 'bold 40px Georgia, serif';
  g.textAlign = 'center';
  g.fillText('BAKER', 150, 56);
  g.fillStyle = '#ff6a2d';
  g.font = 'bold 26px Georgia, serif';
  g.fillText('MOTOR LODGE', 150, 92);
  g.fillStyle = '#9adfff';
  g.font = '16px Georgia, serif';
  g.fillText('VACANCY', 150, 114);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* a highway sign: green with white letters and a white border, or the
   plain white regulatory kind with black letters */
function signTexture(lines, kind) {
  const green = kind === 'green';
  const cv = document.createElement('canvas');
  cv.width = green ? 336 : 192; cv.height = lines.length > 1 ? 176 : 104;
  const g = cv.getContext('2d');
  g.fillStyle = green ? '#1f6a3c' : '#eeeae0';
  g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = green ? '#eeeae0' : '#1a1a1a'; g.lineWidth = 5;
  g.strokeRect(7, 7, cv.width - 14, cv.height - 14);
  g.fillStyle = green ? '#f4f0e4' : '#161616';
  g.textAlign = 'center';
  g.font = `bold ${green ? 40 : 34}px Helvetica, Arial, sans-serif`;
  const top = cv.height / 2 - (lines.length - 1) * 24 + 14;
  lines.forEach((ln, i) => g.fillText(ln, cv.width / 2, top + i * 50));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function billboardTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 192;
  const g = cv.getContext('2d');
  g.fillStyle = '#e4d6b4'; g.fillRect(0, 0, 512, 192);
  g.fillStyle = '#b8402a'; g.fillRect(0, 0, 512, 46);
  g.fillStyle = '#f4ead0'; g.textAlign = 'center';
  g.font = 'bold 32px Georgia, serif';
  g.fillText('LAST CHANCE', 256, 34);
  g.fillStyle = '#3a2a1e';
  g.font = 'bold 54px Georgia, serif';
  g.fillText('GAS · EATS · ICE', 256, 118);
  g.font = '26px Georgia, serif';
  g.fillText('40 MILES — BAKER, CALIF.', 256, 166);
  // the sun has had it for twenty years
  g.fillStyle = 'rgba(255,248,230,0.28)';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 512, Math.random() * 192, 30 + Math.random() * 90, 3 + Math.random() * 10);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ============================================================
   THE TOWN — the quarter mile between the hotel and the desert.

   The film leaves Las Vegas at night down a street of neon, and the
   dawn comes up only once the town has run out. So: a motor court to
   drive round, a traffic light, downtown casino fronts with blade signs
   and chasing marquees, sodium streetlights, cars parked at the kerb,
   then the outskirts -- a gas station, a motel, a wedding chapel, some
   billboards -- and the city sign, which says goodbye on its back.

   The street is dead straight (the road's curves start after it), so
   everything here is placed in plain desert-local x and z = -s.
   ============================================================ */
function buildTown(group, { mat, basic }) {
  const add = (geo, m, x, y, z, parent = group) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o;
  };
  const obstacles = [];          // {s, lat, hs, hw, kind} -- what the car can hit
  const night = [];              // materials that only show after dark
  const chase = [];              // marquee textures that scroll
  const flicker = [];            // neon that stutters
  const fountain = {};
  const concrete = mat({ color: 0x8a8580, roughness: 0.95 });
  const asphalt = mat({ color: 0x2c2b30, roughness: 0.85 });
  const HWS = 7.6, WALK = 11.6;  // kerb line, and the back of the sidewalk

  /* ---------------------------------------------- the motor court */
  {
    const C = COURT;
    const shape = new THREE.Shape();
    shape.moveTo(-C.halfW, C.sTop);
    shape.lineTo(C.halfW, C.sTop);
    shape.lineTo(C.halfW, C.sMid);
    shape.absarc(0, C.sMid, C.halfW, 0, Math.PI, false);
    shape.lineTo(-C.halfW, C.sTop);
    const geo = new THREE.ShapeGeometry(shape, 24);
    geo.rotateX(-Math.PI / 2);      // (x, s) -> (x, 0, -s)
    const pave = new THREE.Mesh(geo, asphalt);
    pave.position.y = 0.004;
    group.add(pave);

    // a kerb all the way round, open at the mouth onto the street
    const curbMat = mat({ color: 0xb8b0a4, roughness: 0.9 });
    const curbGeo = new THREE.BoxGeometry(1.0, 0.15, 0.3);
    const pts = [];
    for (let s = C.sTop; s < C.sMid; s += 1) { pts.push([-C.halfW, s + 0.5, 0]); pts.push([C.halfW, s + 0.5, 0]); }
    for (let a = 0.03; a < Math.PI; a += 1 / C.halfW) {
      const x = C.halfW * Math.cos(a), s = C.sMid + C.halfW * Math.sin(a);
      if (Math.abs(x) < HWS) continue;       // the mouth
      pts.push([x, s, a + Math.PI / 2]);
    }
    const curbs = new THREE.InstancedMesh(curbGeo, curbMat, pts.length);
    const o = new THREE.Object3D();
    pts.forEach(([x, s, yaw], i) => {
      o.position.set(x, 0.075, -s);
      o.rotation.set(0, yaw ? yaw : Math.PI / 2, 0);
      o.updateMatrix(); curbs.setMatrixAt(i, o.matrix);
    });
    group.add(curbs);

    // the island: a raised lawn inside its own kerb, palms, and a fountain
    const I = C.island;
    const ell = new THREE.Shape();
    ell.absellipse(0, I.s, I.rx, I.rs, 0, Math.PI * 2, false, 0);
    const lawnGeo = new THREE.ShapeGeometry(ell, 32);
    lawnGeo.rotateX(-Math.PI / 2);
    const lawn = new THREE.Mesh(lawnGeo, mat({ color: 0x3e6a2e, roughness: 1 }));
    lawn.position.y = 0.17;
    group.add(lawn);
    const ring = new THREE.InstancedMesh(curbGeo, curbMat, 44);
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2;
      o.position.set(Math.cos(a) * I.rx, 0.09, -(I.s + Math.sin(a) * I.rs));
      // tangent of the ellipse, so the kerb pieces follow it round
      o.rotation.set(0, Math.atan2(Math.cos(a) * I.rs, Math.sin(a) * I.rx) + Math.PI / 2, 0);
      o.scale.set(1.15, 1.2, 1);
      o.updateMatrix(); ring.setMatrixAt(i, o.matrix);
    }
    o.scale.set(1, 1, 1);
    group.add(ring);

    const stone = mat({ color: 0xd8ccb8, roughness: 0.7 });
    add(new THREE.CylinderGeometry(2.6, 2.8, 0.6, 28), stone, 0, 0.3, -I.s);
    add(new THREE.CylinderGeometry(2.35, 2.35, 0.05, 28), basic({ color: 0x3a7a94 }), 0, 0.58, -I.s);
    add(new THREE.CylinderGeometry(0.5, 0.7, 1.1, 14), stone, 0, 1.0, -I.s);
    add(new THREE.CylinderGeometry(1.1, 0.5, 0.2, 18), stone, 0, 1.6, -I.s);
    // the spray: a column that breathes, lit from under the water at night
    const sprayMat = new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const spray = add(new THREE.CylinderGeometry(0.08, 0.45, 3.2, 12, 1, true), sprayMat, 0, 3.2, -I.s);
    spray.userData.dynamic = true;
    const fall = add(new THREE.CylinderGeometry(1.1, 0.25, 1.2, 16, 1, true), sprayMat, 0, 2.2, -I.s);
    fall.userData.dynamic = true;
    Object.assign(fountain, { spray, fall, mat: sprayMat });
    [[-4.6, I.s], [4.6, I.s], [0, I.s - 3.6], [0, I.s + 3.6]].forEach(([x, s]) => palm(x, s, 7.5, 0.17));

    // globe lamps on posts round the court's kerb, and the island lit from
    // below -- decals again, only after dark
    {
      const post = mat({ color: 0x2a2420, roughness: 0.5, metalness: 0.5 });
      const globe = new THREE.MeshBasicMaterial({ color: 0xfff0d0 });
      const poolM = new THREE.MeshBasicMaterial({ map: glowTexture('255,210,150'), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
      night.push(poolM);
      const spots = [[-C.halfW - 0.8, 10], [C.halfW + 0.8, 10], [-C.halfW - 0.8, 26], [C.halfW + 0.8, 26],
        [-12.6, 42.4], [12.6, 42.4]];
      spots.forEach(([x, s]) => {
        add(new THREE.CylinderGeometry(0.08, 0.12, 4.2, 8), post, x, 2.1, -s);
        add(new THREE.SphereGeometry(0.32, 12, 8), globe, x, 4.4, -s);
        const p = add(new THREE.PlaneGeometry(12, 12), poolM, x * 0.85, 0.02, -s);
        p.rotation.x = -Math.PI / 2;
        p.userData.dynamic = true;
      });
      const up = add(new THREE.PlaneGeometry(22, 18), poolM, 0, 0.19, -I.s);
      up.rotation.x = -Math.PI / 2;
      up.userData.dynamic = true;
    }

    // a stop line across the mouth, and the lights
    const stop = add(new THREE.PlaneGeometry(HWS * 2 - 0.4, 0.5), basic({ color: 0xe0d8bc }), 0, 0.012, -(C.mouth - 1));
    stop.rotation.x = -Math.PI / 2;
    obstacles.push({ s: C.mouth - 1, lat: 9.6, hs: 0.3, hw: 0.3, kind: 'pole' });
    obstacles.push({ s: C.mouth + 3, lat: -9.6, hs: 0.3, hw: 0.3, kind: 'pole' });
  }

  /* the traffic light: green, amber, red, round and round, for nobody */
  const lamps = { r: [], a: [], g: [] };
  const trafficLight = (x, s, facing) => {
    const pole = mat({ color: 0x5a5a56, roughness: 0.5, metalness: 0.4 });
    add(new THREE.CylinderGeometry(0.12, 0.14, 5.2, 8), pole, x, 2.6, -s);
    // the head hangs out over the lane on an arm
    const dx = -Math.sign(x) * 3.2;
    add(new THREE.BoxGeometry(Math.abs(dx), 0.12, 0.12), pole, x + dx / 2, 5.1, -s);
    const hx = x + dx;
    add(new THREE.BoxGeometry(0.45, 1.25, 0.35), mat({ color: 0x2a2a1a, roughness: 0.6 }), hx, 4.5, -s);
    [['r', 0xff2a1a, 4.88], ['a', 0xffa01a, 4.5], ['g', 0x2aff7a, 4.12]].forEach(([k, c, y]) => {
      const m = new THREE.MeshBasicMaterial({ color: c });
      m.userData.on = new THREE.Color(c); m.userData.off = new THREE.Color(c).multiplyScalar(0.12);
      const lens = add(new THREE.CircleGeometry(0.14, 12), m, hx, y, -s + facing * 0.18);
      if (facing < 0) lens.rotation.y = Math.PI;
      lamps[k].push(m);
    });
  };
  trafficLight(9.6, COURT.mouth - 1, 1);      // for you, leaving
  trafficLight(-9.6, COURT.mouth + 3, -1);    // for you, coming back

  /* ---------------------------------------------- the street itself */
  {
    const len = TOWN.s1 - TOWN.s0, mid = (TOWN.s0 + TOWN.s1) / 2;
    [-1, 1].forEach((sd) => {
      // the parking lane is paved in town, over the desert road's gravel
      const lane = add(new THREE.PlaneGeometry(HWS - 5.2, len), asphalt, sd * (5.2 + HWS) / 2, 0.003, -mid);
      lane.rotation.x = -Math.PI / 2;
      // the sidewalk, a kerb high
      add(new THREE.BoxGeometry(WALK - HWS, 0.15, len), concrete, sd * (HWS + WALK) / 2, 0.075, -mid);
      // and past it the lots, paved, so the buildings are not standing in sand
      const lot = add(new THREE.PlaneGeometry(60, len), mat({ color: 0x4a4540, roughness: 1 }), sd * (WALK + 30), 0.002, -mid);
      lot.rotation.x = -Math.PI / 2;
    });
  }

  /* ---------------------------------------------- streetlights
     Sodium heads on long arms over the road, and under each one a pool
     of orange on the tarmac -- the pool is a decal, not a light, so forty
     of them cost the same as one. It only shows after dark. */
  {
    const pts = [];
    for (let s = 58; s < TOWN.s1 + 120; s += 32) { pts.push([1, s]); pts.push([-1, s + 16]); }
    const n = pts.length;
    const poleM = mat({ color: 0x6a6a66, roughness: 0.5, metalness: 0.4 });
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 8.5, 6), poleM, n);
    const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(3.0, 0.1, 0.1), poleM, n);
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.22, 0.45),
      new THREE.MeshBasicMaterial({ color: 0xffb060 }), n);
    const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture('255,150,60'), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
    night.push(poolMat);
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(14, 14), poolMat, n);
    const o = new THREE.Object3D();
    pts.forEach(([sd, s], i) => {
      const x = sd * (HWS + 0.5);
      o.rotation.set(0, 0, 0);
      o.position.set(x, 4.25, -s); o.updateMatrix(); poles.setMatrixAt(i, o.matrix);
      o.position.set(x - sd * 1.5, 8.4, -s); o.updateMatrix(); arms.setMatrixAt(i, o.matrix);
      o.position.set(x - sd * 2.9, 8.3, -s); o.updateMatrix(); heads.setMatrixAt(i, o.matrix);
      o.rotation.set(-Math.PI / 2, 0, 0);
      o.position.set(x - sd * 3.5, 0.02, -s); o.updateMatrix(); pools.setMatrixAt(i, o.matrix);
      obstacles.push({ s, lat: x, hs: 0.2, hw: 0.2, kind: 'pole' });
    });
    [poles, arms, heads, pools].forEach((m) => { m.frustumCulled = false; group.add(m); });
  }

  // cars parked at the kerb, nose to tail with gaps, facing the way
  // their own lane runs
  [[1, 72, 'wagon', 0x8a6a3a], [1, 118, 'pickup', 0x6a2a2a], [1, 166, 'wagon', 0x3a5a7a],
   [1, 210, 'pickup', 0xa8a090], [-1, 92, 'pickup', 0x2a4a3a], [-1, 146, 'wagon', 0xb8a070],
   [-1, 188, 'wagon', 0x5a3a5a]].forEach(([sd, s, kind, col]) => {
    const v = makeVehicle(kind, col);
    v.position.set(sd * 6.4, 0, -s);
    v.rotation.y = sd > 0 ? 0 : Math.PI;
    group.add(v);
    obstacles.push({ s, lat: sd * 6.4, hs: v.userData.len / 2, hw: v.userData.halfW, kind: 'parked' });
  });

  // palms down the sidewalks, downtown only
  for (let s = 74; s < 240; s += 36) {
    palm(10.4, s, 8 + (s % 3), 0.15);
    palm(-10.4, s + 18, 8 + ((s + 1) % 3), 0.15);
  }

  /* ---------------------------------------------- the casino fronts */
  const FRONTS = [
    // side, start s, length, height, colour, the big sign, the blade sign
    [1, 50, 26, 14, 0x3a2226, ['GOLDEN SPUR', '#ffb400'], ['CASINO', '#ff2d1f']],
    [1, 80, 18, 10, 0x2a2a3a, ['LOOSE SLOTS', '#12e2e2'], ['LUCKY 7', '#ff2d6a']],
    [1, 102, 24, 16, 0x3a2a1a, ["DIAMOND JIM'S", '#ff2d6a'], ['HOTEL', '#ffb400']],
    [1, 130, 14, 8, 0x2a3026, ['COCKTAILS', '#b6ff2e'], null],
    [1, 148, 22, 12, 0x302630, ['SILVER SADDLE', '#e8e8ff'], ['KENO', '#12e2e2']],
    [1, 174, 16, 7, 0x3a3226, ['PAWN · LOANS', '#ffb400'], null],
    [1, 194, 18, 6, 0x262a30, ['LIQUOR', '#ff2d1f'], null],
    [-1, 52, 24, 18, 0x2e2230, ['EL DORADO', '#ff2d1f'], ['HOTEL', '#12e2e2']],
    [-1, 80, 20, 12, 0x223036, ['NICKEL SLOTS', '#ffb400'], ['BINGO', '#b6ff2e']],
    [-1, 104, 26, 14, 0x3a2622, ['4 ACES', '#ff2d6a'], ['CASINO', '#ffb400']],
    [-1, 134, 16, 9, 0x2a2a26, ['GIFTS · SOUVENIRS', '#a03cff'], null],
    [-1, 154, 22, 10, 0x30261e, ['SILVER DOLLAR', '#e8e8ff'], ['21', '#ff2d1f']],
    [-1, 180, 16, 7, 0x262a2a, ['CHECKS CASHED', '#12e2e2'], null],
    [-1, 200, 14, 6, 0x2e2a22, ['EAT', '#ff2d1f'], null],
  ];
  // shopfront glass: panes and mullions and a pair of doors, lit from inside
  const shopTex = shopfrontTexture();
  FRONTS.forEach(([sd, s0, w, h, col, big, blade], idx) => {
    const d = 14, sc = s0 + w / 2, face = sd * (WALK + 0.2);
    add(new THREE.BoxGeometry(d, h, w - 0.6), mat({ color: col, roughness: 0.85 }), sd * (WALK + 0.2 + d / 2), h / 2, -sc);
    // a cornice, and the lit shopfront along the bottom
    add(new THREE.BoxGeometry(0.5, 0.4, w - 0.4), mat({ color: 0x8a7a60, roughness: 0.7 }), face - sd * 0.1, h + 0.1, -sc);
    const tex = shopTex.clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round((w - 2.4) / 6)), 1);
    const shop = add(new THREE.PlaneGeometry(w - 2.4, 2.5), new THREE.MeshBasicMaterial({ map: tex }), face - sd * 0.02, 1.45, -sc);
    shop.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
    // the marquee: an awning with a row of chasing bulbs along its edge
    add(new THREE.BoxGeometry(2.6, 0.5, w - 1.2), mat({ color: 0x1a1414, roughness: 0.6 }), face - sd * 1.3, 3.2, -sc);
    const bulbs = marquee();
    chase.push(bulbs);
    const mq = add(new THREE.PlaneGeometry(w - 1.2, 0.45),
      new THREE.MeshBasicMaterial({ map: bulbs, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      face - sd * 2.62, 3.2, -sc);
    mq.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
    // the big sign on the face of the building
    const bw = Math.min(w - 2, 3 + big[0].length * 1.15), bh = Math.min(h * 0.36, 4.5);
    const bm = new THREE.MeshBasicMaterial({ map: neonTexture([big], 512, 160), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const bs = add(new THREE.PlaneGeometry(bw, bh), bm, face - sd * 0.08, Math.max(5.2, h * 0.64), -sc);
    bs.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (idx % 4 === 1) flicker.push(bm);
    // the blade: a tall double-sided sign out over the sidewalk, which is
    // the one you actually read, driving past
    if (blade) {
      const bl = new THREE.MeshBasicMaterial({ map: neonTexture([blade], 160, 512, true), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const bh2 = Math.min(h - 1, 9);
      add(new THREE.PlaneGeometry(2.4, bh2), bl, face - sd * 1.6, h - bh2 / 2 - 0.3, -(s0 + 1.5));
      add(new THREE.BoxGeometry(2.6, 0.12, 0.12), mat({ color: 0x3a3a3a }), face - sd * 1.4, h - 0.3, -(s0 + 1.5));
    }
  });

  /* ---------------------------------------------- the outskirts */
  // a gas station, 1971: a canopy, two pumps, an office, a price on a pole
  {
    const sd = 1, s = 236, x = sd * (WALK + 9);
    const white = mat({ color: 0xe8e2d4, roughness: 0.6 });
    add(new THREE.BoxGeometry(9, 0.5, 12), white, x, 4.6, -s);
    [[-3.6, -5], [3.6, -5], [-3.6, 5], [3.6, 5]].forEach(([dx, ds]) =>
      add(new THREE.BoxGeometry(0.3, 4.4, 0.3), white, x + dx, 2.2, -(s + ds)));
    const pumpM = mat({ color: 0xc0302a, roughness: 0.5 });
    [-2.5, 2.5].forEach((ds) => add(new THREE.BoxGeometry(0.7, 1.6, 1.0), pumpM, x, 0.8, -(s + ds)));
    add(new THREE.BoxGeometry(8, 3.4, 7), white, x + 9, 1.7, -s);
    const glow = add(new THREE.PlaneGeometry(8.6, 11.6), basic({ color: 0xfff4d8 }), x, 4.34, -s);
    glow.rotation.x = Math.PI / 2;
    const sign = new THREE.MeshBasicMaterial({ map: neonTexture([['GAS', '#ff2d1f'], ['33.9¢', '#ffffff']], 256, 256),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    add(new THREE.CylinderGeometry(0.2, 0.2, 7, 8), mat({ color: 0x6a6a6a }), sd * (WALK + 1.2), 3.5, -(s - 8));
    const sp = add(new THREE.PlaneGeometry(3.4, 3.4), sign, sd * (WALK + 1.2), 8.4, -(s - 8));
    sp.rotation.y = Math.PI / 2;
  }
  // a motel, and its sign on a pole with an arrow that chases
  {
    const sd = -1, s0 = 232, w = 40;
    add(new THREE.BoxGeometry(10, 4, w), mat({ color: 0xc8a888, roughness: 0.9 }), sd * (WALK + 12), 2, -(s0 + w / 2));
    for (let i = 0; i < 9; i++) {
      add(new THREE.BoxGeometry(0.15, 2.2, 1.1), mat({ color: 0x2f6a72, roughness: 0.6 }), sd * (WALK + 6.9), 1.1, -(s0 + 3 + i * 4.2));
    }
    add(new THREE.CylinderGeometry(0.25, 0.3, 10, 8), mat({ color: 0x5a5a5a }), sd * (WALK + 1.4), 5, -s0);
    const m = new THREE.MeshBasicMaterial({ map: neonTexture([['DESERT ROSE', '#ff2d6a'], ['MOTEL', '#12e2e2'],
      ['COLOR TV · POOL', '#ffb400'], ['VACANCY', '#b6ff2e']], 320, 400), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const sg = add(new THREE.PlaneGeometry(5, 6.2), m, sd * (WALK + 1.4), 12, -s0);
    sg.rotation.y = Math.PI / 2;
    flicker.push(m);
  }
  // a wedding chapel, white, with a steeple and a sign that never sleeps
  {
    const sd = 1, s = 280, x = sd * (WALK + 8);
    const white = mat({ color: 0xf0ece4, roughness: 0.7 });
    add(new THREE.BoxGeometry(8, 5, 12), white, x, 2.5, -s);
    const roof = add(new THREE.CylinderGeometry(0.01, 6.4, 2.6, 4, 1), mat({ color: 0x8a8a90, roughness: 0.7 }), x, 6.3, -s);
    roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 1.8);
    add(new THREE.BoxGeometry(1.6, 4, 1.6), white, x - sd * 2.4, 7, -(s - 4.6));
    add(new THREE.ConeGeometry(1.2, 3.4, 4), white, x - sd * 2.4, 10.7, -(s - 4.6));
    const m = new THREE.MeshBasicMaterial({ map: neonTexture([['SILVER BELL', '#e8e8ff'], ['WEDDING CHAPEL', '#ff2d6a'],
      ['OPEN 24 HOURS', '#ffb400']], 400, 240), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const sg = add(new THREE.PlaneGeometry(6.4, 3.8), m, x - sd * 4.05, 3.6, -s);
    sg.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  // two billboards on the empty lots where the town gives out
  [[-1, 300, 'SEE HOOVER DAM', '30 MILES · FREE TOURS'], [1, 330, 'LAST CHANCE', 'LOOSE SLOTS 1 MI BACK']].forEach(([sd, s, a, b]) => {
    const bb = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.2), basic({ map: plainBoard(a, b) }));
    face.position.y = 5.4; bb.add(face);
    [-4, 0, 4].forEach((dx) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.4, 0.3), mat({ color: 0x3b2a1e })); leg.position.set(dx, 2.7, -0.2); bb.add(leg); });
    bb.position.set(sd * 22, 0, -s);
    bb.rotation.y = sd > 0 ? -0.5 : 0.5;
    group.add(bb);
  });

  /* ---------------------------------------------- the city sign
     The diamond at the south end of town. Coming in, you read the front;
     going out, the back: drive carefully, come back soon. */
  {
    const S = 405, x = -12.5;
    const sign = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 8.4),
      new THREE.MeshBasicMaterial({ map: welcomeTexture(false), transparent: true, alphaTest: 0.5 }));
    front.rotation.y = Math.PI;               // faces south, at traffic coming in
    const back = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 8.4),
      new THREE.MeshBasicMaterial({ map: welcomeTexture(true), transparent: true, alphaTest: 0.5 }));
    back.position.z = 0.03;                   // faces north, at you leaving
    [front, back].forEach((m) => { m.position.y = 7.2; sign.add(m); });
    [-1.6, 1.6].forEach((dx) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4, 0.35), mat({ color: 0xe8e2d4, roughness: 0.6 }));
      post.position.set(dx, 2, 0.015); sign.add(post);
    });
    sign.position.set(x, 0, -S);
    group.add(sign);
    obstacles.push({ s: S, lat: x, hs: 0.4, hw: 2.2, kind: 'pole' });
  }

  // a little moonlight, so the unlit fronts read as buildings after dark
  const moon = new THREE.HemisphereLight(0x5a6a9a, 0x2a2018, 0.9);
  group.add(moon);

  /** palm tree: a leaning trunk and a crown of fronds */
  function palm(x, s, h, y0 = 0) {
    const trunkM = palm.trunk ??= mat({ color: 0x5a4632, roughness: 1 });
    const leafM = palm.leaf ??= mat({ color: 0x2c4a22, roughness: 0.9 });
    add(new THREE.CylinderGeometry(0.16, 0.26, h, 7), trunkM, x, y0 + h / 2, -s);
    for (let f = 0; f < 8; f++) {
      const a = (f / 8) * Math.PI * 2;
      const fr = add(new THREE.BoxGeometry(2.8, 0.04, 0.42), leafM, x + Math.cos(a) * 1.2, y0 + h - 0.2, -s + Math.sin(a) * 1.2);
      fr.rotation.set(0, -a, -0.45);
    }
  }

  let phase = -1;
  return {
    obstacles,
    /** 0 = full day, 1 = full night */
    setNight(k) {
      night.forEach((m) => { m.opacity = 0.55 * k; });
      moon.intensity = 0.9 * k;
    },
    update(t) {
      // the court's fountain, breathing
      if (fountain.spray) {
        const k = 1 + Math.sin(t * 2.3) * 0.08 + Math.sin(t * 7.1) * 0.03;
        fountain.spray.scale.set(1, k, 1);
        fountain.spray.position.y = 3.2 * k;
        fountain.fall.scale.set(1 + Math.sin(t * 3.1) * 0.05, 1, 1 + Math.sin(t * 3.1) * 0.05);
        fountain.mat.opacity = 0.38 + Math.sin(t * 5.3) * 0.06;
      }
      chase.forEach((tex) => { tex.offset.x = -((t * 6) | 0) / 24; });
      flicker.forEach((m, i) => {
        const k = Math.sin(t * 13 + i * 7) + Math.sin(t * 29 + i);
        m.opacity = k > 1.7 ? 0.25 : 1;
      });
      // the lights, round and round: 9s green, 2s amber, 7s red
      const c = t % 18, p = c < 9 ? 'g' : c < 11 ? 'a' : 'r';
      if (p !== phase) {
        phase = p;
        ['r', 'a', 'g'].forEach((k) => lamps[k].forEach((m) => m.color.copy(k === p ? m.userData.on : m.userData.off)));
      }
    },
  };
}

/* neon lettering on black, for additive blending: black adds nothing */
function neonTexture(lines, W, H, vertical = false) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const glow = (text, x, y, size, col) => {
    g.font = `bold ${size}px Georgia, serif`;
    g.shadowColor = col; g.shadowBlur = size * 0.5;
    g.fillStyle = col;
    g.fillText(text, x, y); g.fillText(text, x, y);
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,250,240,0.85)';
    g.font = `bold ${size * 0.96}px Georgia, serif`;
    g.fillText(text, x, y);
  };
  if (vertical) {
    const [text, col] = lines[0];
    const chars = [...text.replace(/ /g, '')];
    const step = Math.min((H - 40) / chars.length, W * 0.8);
    g.strokeStyle = col; g.lineWidth = 6; g.shadowColor = col; g.shadowBlur = 16;
    g.strokeRect(10, 10, W - 20, H - 20); g.shadowBlur = 0;
    chars.forEach((ch, i) => glow(ch, W / 2, 20 + step * (i + 0.5) + (H - 40 - step * chars.length) / 2, step * 0.85, col));
  } else {
    const n = lines.length, lh = H / n;
    lines.forEach(([text, col], i) => {
      let size = lh * 0.7;
      g.font = `bold ${size}px Georgia, serif`;
      const wdt = g.measureText(text).width;
      if (wdt > W * 0.92) size *= (W * 0.92) / wdt;
      glow(text, W / 2, lh * (i + 0.5), size, col);
    });
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function shopfrontTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 108;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 108);
  gr.addColorStop(0, '#f0c880'); gr.addColorStop(1, '#a8703a');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 108);
  // shapes inside: a counter, a row of machines, somebody standing
  g.fillStyle = 'rgba(60,30,20,0.55)';
  for (let i = 0; i < 6; i++) g.fillRect(12 + i * 40, 52, 22, 56);
  g.fillStyle = 'rgba(40,20,20,0.5)';
  g.fillRect(150, 40, 10, 68); g.beginPath(); g.arc(155, 34, 7, 0, Math.PI * 2); g.fill();
  // the frame
  g.fillStyle = '#1a1210';
  g.fillRect(0, 0, 256, 6); g.fillRect(0, 102, 256, 6);
  for (let x = 0; x <= 256; x += 64) g.fillRect(x - 3, 0, 6, 108);
  g.fillRect(0, 30, 256, 3);
  // the doors, darker glass with brass bars
  g.fillStyle = 'rgba(30,20,16,0.55)'; g.fillRect(96, 34, 64, 68);
  g.fillStyle = '#c8a650'; g.fillRect(104, 66, 20, 3); g.fillRect(132, 66, 20, 3);
  g.fillStyle = '#1a1210'; g.fillRect(126, 34, 4, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* a strip of bulbs, every third one lit; scrolling it makes them chase */
function marquee() {
  const cv = document.createElement('canvas');
  cv.width = 96; cv.height = 16;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 96, 16);
  for (let i = 0; i < 24; i++) {
    g.fillStyle = i % 3 === 0 ? '#fff2c0' : '#4a3010';
    g.beginPath(); g.arc(2 + i * 4, 8, 1.6, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

function glowTexture(rgb) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},0.9)`); gr.addColorStop(0.5, `rgba(${rgb},0.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

function plainBoard(a, b) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 192;
  const g = cv.getContext('2d');
  g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 512, 192);
  g.fillStyle = '#1e3a6a'; g.fillRect(0, 0, 512, 16); g.fillRect(0, 176, 512, 16);
  g.textAlign = 'center';
  g.fillStyle = '#b8302a'; g.font = 'bold 58px Georgia, serif'; g.fillText(a, 256, 96);
  g.fillStyle = '#2a2a2a'; g.font = '28px Georgia, serif'; g.fillText(b, 256, 148);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* The city sign: a white diamond on two posts, a star on top, and a row
   of silver dollars with the letters in them. The back is plainer. */
function welcomeTexture(back) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 600;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 512, 600);
  // the diamond: wide in the middle, pointed top and bottom
  const body = () => {
    g.beginPath();
    g.moveTo(256, 90); g.lineTo(500, 250); g.lineTo(460, 330); g.lineTo(256, 470);
    g.lineTo(52, 330); g.lineTo(12, 250); g.closePath();
  };
  g.fillStyle = '#f4f0e8'; body(); g.fill();
  g.strokeStyle = '#d02a2a'; g.lineWidth = 10; body(); g.stroke();
  // bulbs round the edge
  g.fillStyle = '#ffd24a';
  const edge = [[256, 90], [500, 250], [460, 330], [256, 470], [52, 330], [12, 250], [256, 90]];
  for (let k = 0; k + 1 < edge.length; k++) {
    const [x0, y0] = edge[k], [x1, y1] = edge[k + 1];
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 22);
    for (let i = 0; i < n; i++) {
      g.beginPath(); g.arc(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 4, 0, Math.PI * 2); g.fill();
    }
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (!back) {
    // the star, up top
    g.fillStyle = '#ffd24a'; g.strokeStyle = '#d02a2a'; g.lineWidth = 4;
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 22 : 58, a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(256 + Math.cos(a) * r, 60 + Math.sin(a) * r);
    }
    g.closePath(); g.fill(); g.stroke();
    // W E L C O M E, one letter to a silver dollar
    [...'WELCOME'].forEach((ch, i) => {
      const x = 106 + i * 50, y = 205;
      g.fillStyle = '#ffffff'; g.strokeStyle = '#9a9a9a'; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#d02a2a'; g.font = 'bold 28px Georgia, serif'; g.fillText(ch, x, y + 1);
    });
    g.fillStyle = '#1e3a8a'; g.font = 'italic 26px Georgia, serif'; g.fillText('to  Fabulous', 256, 252);
    g.fillStyle = '#d02a2a'; g.font = 'bold 76px Georgia, serif'; g.fillText('LAS VEGAS', 256, 318);
    g.fillStyle = '#1e3a8a'; g.font = 'bold 30px Georgia, serif'; g.fillText('NEVADA', 256, 380);
  } else {
    g.fillStyle = '#d02a2a'; g.font = 'bold 44px Georgia, serif'; g.fillText('DRIVE', 256, 230);
    g.fillText('CAREFULLY', 256, 280);
    g.fillStyle = '#1e3a8a'; g.font = 'bold 40px Georgia, serif'; g.fillText('COME BACK', 256, 340);
    g.fillText('SOON', 256, 386);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
