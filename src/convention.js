/* ============================================================
   THE CONVENTION — act four.

   The National District Attorneys Association, in the ballroom off
   the east wing: a foyer with a table handing out names, and past it
   a hall of folding chairs facing a screen. The casino was loud and
   round and nobody looked at you twice. This is quiet and square and
   everybody in it is a professional at looking at people twice.

   Built the way the suite is. The rooms are rectangles written down
   ONCE, and the walls are generated from that same list, so a wall
   can never stand where you are allowed to be -- a stretch of wall
   that falls inside the next room is simply a doorway.

   Everything is in convention-local metres. main.js hangs the group
   300m out in -X, where nothing about it can reach the other acts.
   ============================================================ */
import * as THREE from 'three';

export const CONV = {
  rooms: [
    { id: 'hall',  x0: -14.0, x1: 14.0, z0: -17.0, z1: 12.5 },
    // the double doors between them: a short passage, so the opening
    // has jambs either side instead of the whole foyer opening at once
    { id: 'doors', x0: -2.5,  x1: 2.5,  z0: 12.0,  z1: 13.4 },
    { id: 'foyer', x0: -7.0,  x1: 7.0,  z0: 13.0,  z1: 21.0 },
  ],
  spawn: { x: 0, z: 19.4 },
  // the way back out to the lobby, in the foyer's far wall
  exit: { x: 0, z: 20.5 },
  // the registration table, and where the woman behind it stands
  desk: { x: -4.0, z: 15.6 },
  registrar: { x: -5.0, z: 15.6 },
  urn: { x: 10.4, z: 9.9 },
  // your chair: first seat off the centre aisle, halfway back
  seat: { x: 1.8, z: -2.1 },
  seatFrom: { x: 0.55, z: -2.1 },   // where you stand to take it
  stageFront: -13.0,
};

const WALL_H = 5.6;
const SEG = 0.5;
const ROW_Z0 = -10.5, ROW_DZ = 1.4, ROWS = 11;
const SEAT_X0 = 1.8, SEAT_DX = 0.75, SEATS_PER_SIDE = 14;

const inside = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
const inAnother = (rooms, self, x, z) => rooms.some((r) => r !== self && inside(r, x, z));

export function buildConvention(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const colliders = [];
  const box = (x, z, hw, hd) => colliders.push({ x, z, hw, hd });
  const mat = (o) => new THREE.MeshStandardMaterial(o);
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); group.add(o); return o; };

  const wallMat = mat({ color: 0x7d7160, roughness: 0.9 });
  const trimMat = mat({ color: 0x3a2a1c, roughness: 0.6, metalness: 0.15 });
  const brass = mat({ color: 0xc8a650, roughness: 0.35, metalness: 0.7 });

  /* ---------------------------------------------- floor & ceiling */
  const carpet = mat({ map: carpetTexture(), roughness: 0.95 });
  CONV.rooms.forEach((r) => {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const floor = add(new THREE.PlaneGeometry(w, d),
      r.id === 'hall' ? carpet : mat({ color: 0x5a2e22, roughness: 0.95 }),
      (r.x0 + r.x1) / 2, 0.01, (r.z0 + r.z1) / 2);
    floor.rotation.x = -Math.PI / 2;
    // the carpet texture repeats per metre-ish, so it has to know the size
    if (r.id === 'hall') {
      floor.material.map.repeat.set(w / 3, d / 3);
    }
    const ceil = add(new THREE.PlaneGeometry(w, d), mat({ color: 0x2c2620, roughness: 1 }),
      (r.x0 + r.x1) / 2, WALL_H, (r.z0 + r.z1) / 2);
    ceil.rotation.x = Math.PI / 2;
  });

  /* ---------------------------------------------- walls
     Same trick as the suite: half-metre pieces round each room, skipped
     wherever the piece falls inside a neighbouring room. */
  const wallGeo = new THREE.BoxGeometry(SEG + 0.02, WALL_H, 0.22);
  CONV.rooms.forEach((r) => {
    const runs = [
      { fixed: 'z', at: r.z0, from: r.x0, to: r.x1, rot: 0 },
      { fixed: 'z', at: r.z1, from: r.x0, to: r.x1, rot: 0 },
      { fixed: 'x', at: r.x0, from: r.z0, to: r.z1, rot: Math.PI / 2 },
      { fixed: 'x', at: r.x1, from: r.z0, to: r.z1, rot: Math.PI / 2 },
    ];
    runs.forEach((run) => {
      for (let s = run.from; s < run.to - 0.001; s += SEG) {
        const mid = s + SEG / 2;
        const x = run.fixed === 'z' ? mid : run.at;
        const z = run.fixed === 'z' ? run.at : mid;
        const probeX = x + (run.fixed === 'x' ? (run.at === r.x0 ? -0.2 : 0.2) : 0);
        const probeZ = run.fixed === 'z' ? z + (run.at === r.z0 ? -0.2 : 0.2) : z;
        if (inAnother(CONV.rooms, r, probeX, probeZ)) continue;
        const m = add(wallGeo, wallMat, x, WALL_H / 2, z);
        m.rotation.y = run.rot;
        if (run.fixed === 'z') box(x, z, SEG / 2 + 0.01, 0.11);
        else box(x, z, 0.11, SEG / 2 + 0.01);
      }
    });
  });

  /* a dado rail and a skirting board round the hall: the difference
     between a function room and a warehouse */
  {
    const H = CONV.rooms[0];
    [[H.x0, H.z0, H.x1, H.z0], [H.x0, H.z0, H.x0, H.z1], [H.x1, H.z0, H.x1, H.z1]].forEach(([x0, z0, x1, z1]) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      [0.07, 1.05].forEach((y) => {
        const b = add(new THREE.BoxGeometry(len, y < 0.5 ? 0.14 : 0.06, 0.06), trimMat,
          (x0 + x1) / 2, y, (z0 + z1) / 2);
        if (x0 === x1) b.rotation.y = Math.PI / 2;
      });
    });
  }

  /* ---------------------------------------------- the stage */
  const stageMat = mat({ color: 0x4a2c1e, roughness: 0.7 });
  add(new THREE.BoxGeometry(14, 0.7, 4), stageMat, 0, 0.35, -15);
  add(new THREE.BoxGeometry(14.1, 0.08, 0.1), brass, 0, 0.7, -12.98);
  box(0, -15, 7, 2);

  // the lectern, with a microphone on a stalk and a little lamp
  add(new THREE.BoxGeometry(0.9, 1.15, 0.55), trimMat, -1.2, 0.7 + 0.575, -13.7);
  const seal = add(new THREE.CircleGeometry(0.22, 18), brass, -1.2, 1.45, -13.41);
  seal.rotation.y = 0;
  const mic = add(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), trimMat, -1.2, 2.05, -13.55);
  mic.rotation.x = 0.5;
  add(new THREE.SphereGeometry(0.04, 8, 6), mat({ color: 0x222222, roughness: 0.4 }), -1.2, 2.24, -13.45);

  // a flag on a stand, because there is always a flag on a stand
  add(new THREE.CylinderGeometry(0.03, 0.03, 3.0, 8), brass, 5.4, 0.7 + 1.5, -14.6);
  const flag = add(new THREE.PlaneGeometry(1.4, 0.9),
    new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.9 }),
    5.4 + 0.72, 0.7 + 2.45, -14.6);
  flag.rotation.y = 0.25;

  // curtains either side of the screen
  const curtainMat = mat({ color: 0x5a1e24, roughness: 0.95 });
  [-1, 1].forEach((sd) => {
    for (let f = 0; f < 6; f++) {
      const fold = add(new THREE.CylinderGeometry(0.16, 0.18, WALL_H - 0.3, 6, 1, false, 0, Math.PI),
        curtainMat, sd * (5.3 + f * 0.3), (WALL_H - 0.3) / 2 + 0.05, -16.8);
      fold.rotation.y = Math.PI;
    }
  });

  /* ---------------------------------------------- the screen
     A canvas the keynote redraws, one slide at a time. */
  const slideCv = document.createElement('canvas');
  slideCv.width = 512; slideCv.height = 288;
  const slideTex = new THREE.CanvasTexture(slideCv);
  slideTex.colorSpace = THREE.SRGBColorSpace;
  const screen = add(new THREE.PlaneGeometry(8.4, 4.72),
    new THREE.MeshBasicMaterial({ map: slideTex }), 0, 3.35, -16.84);
  screen.renderOrder = 0;
  add(new THREE.BoxGeometry(8.7, 5.0, 0.06), trimMat, 0, 3.35, -16.9);

  // the banner over it all
  const banner = add(new THREE.PlaneGeometry(12, 1.0),
    new THREE.MeshBasicMaterial({ map: bannerTexture(
      'NATIONAL DISTRICT ATTORNEYS ASSOCIATION',
      'THIRD NATIONAL INSTITUTE ON NARCOTICS & DANGEROUS DRUGS') }), 0, WALL_H - 0.55, -16.85);
  banner.renderOrder = 0;

  /* ---------------------------------------------- the chairs
     Three hundred of them. One InstancedMesh per part, so they cost three
     draws between them. The rows are solid -- nobody climbs over a row of
     district attorneys -- and you get to your seat from the aisle. */
  const seats = [];
  for (let r = 0; r < ROWS; r++) {
    const z = ROW_Z0 + r * ROW_DZ;
    for (const sd of [-1, 1]) {
      for (let j = 0; j < SEATS_PER_SIDE; j++) seats.push({ x: sd * (SEAT_X0 + j * SEAT_DX), z, row: r });
    }
    // one collider per half-row, covering the chairs and the knees in front of them
    [-1, 1].forEach((sd) => {
      const xa = SEAT_X0 - 0.26, xb = SEAT_X0 + (SEATS_PER_SIDE - 1) * SEAT_DX + 0.26;
      box(sd * (xa + xb) / 2, z + 0.02, (xb - xa) / 2, 0.3);
    });
  }
  // the legs read as a dark frame under the seat, not four sticks
  const chairMat = mat({ color: 0x1c1712, roughness: 0.8 });
  const padMat = mat({ color: 0x7a2a28, roughness: 0.9 });
  const seatI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.07, 0.46), padMat, seats.length);
  const backI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), padMat, seats.length);
  const legI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.58, 0.42), chairMat, seats.length);
  {
    const m = new THREE.Matrix4();
    seats.forEach((s, i) => {
      m.makeTranslation(s.x, 0.62, s.z); seatI.setMatrixAt(i, m);
      m.makeTranslation(s.x, 0.92, s.z + 0.22); backI.setMatrixAt(i, m);
      m.makeTranslation(s.x, 0.29, s.z); legI.setMatrixAt(i, m);
    });
  }
  [seatI, backI, legI].forEach((o) => { group.add(o); });

  /* ---------------------------------------------- the coffee urn */
  add(new THREE.BoxGeometry(2.4, 0.08, 0.9), mat({ color: 0xe8e2d0, roughness: 0.9 }),
    CONV.urn.x - 0.2, 0.9, CONV.urn.z);
  add(new THREE.BoxGeometry(2.3, 0.86, 0.8), mat({ color: 0xd8d2c0, roughness: 0.95 }),
    CONV.urn.x - 0.2, 0.43, CONV.urn.z);
  box(CONV.urn.x - 0.2, CONV.urn.z, 1.2, 0.45);
  add(new THREE.CylinderGeometry(0.2, 0.22, 0.6, 14), brass, CONV.urn.x + 0.5, 1.24, CONV.urn.z);
  add(new THREE.SphereGeometry(0.08, 8, 6), brass, CONV.urn.x + 0.5, 1.6, CONV.urn.z);
  const cupMat = mat({ color: 0xf2efe8, roughness: 0.4 });
  for (let i = 0; i < 9; i++) {
    add(new THREE.CylinderGeometry(0.04, 0.033, 0.08, 8), cupMat,
      CONV.urn.x - 1.0 + (i % 5) * 0.16, 0.98, CONV.urn.z - 0.15 + ((i / 5) | 0) * 0.2);
  }

  /* ---------------------------------------------- the foyer */
  // the registration table, a cloth to the floor and a tray of names
  add(new THREE.BoxGeometry(0.9, 0.78, 2.8), mat({ color: 0x1f3a5a, roughness: 0.9 }),
    CONV.desk.x, 0.39, CONV.desk.z);
  add(new THREE.BoxGeometry(0.94, 0.03, 2.84), mat({ color: 0xe8e2d0, roughness: 0.9 }),
    CONV.desk.x, 0.79, CONV.desk.z);
  box(CONV.desk.x, CONV.desk.z, 0.45, 1.4);
  const badgeMat = mat({ color: 0xf0ead8, roughness: 0.8 });
  for (let i = 0; i < 14; i++) {
    const b = add(new THREE.BoxGeometry(0.14, 0.01, 0.09), badgeMat,
      CONV.desk.x + 0.2 - (i % 2) * 0.18, 0.815, CONV.desk.z - 1.0 + ((i / 2) | 0) * 0.26);
    b.rotation.y = (i * 0.37) % 0.3;
  }
  // the sign on an easel
  const easel = add(new THREE.PlaneGeometry(1.4, 1.0),
    new THREE.MeshBasicMaterial({ map: bannerTexture('WELCOME DELEGATES', 'PLEASE WEAR YOUR BADGE AT ALL TIMES'),
      side: THREE.DoubleSide }), 3.4, 1.6, 13.6);
  easel.rotation.y = -0.4;
  add(new THREE.BoxGeometry(0.05, 1.4, 0.05), trimMat, 3.4, 0.7, 13.7);

  // the exit, double glass doors in the far wall
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x28323a, roughness: 0.15, metalness: 0.5 });
  [-0.7, 0.7].forEach((dx) => {
    add(new THREE.BoxGeometry(1.3, 2.4, 0.06), glassMat, CONV.exit.x + dx, 1.2, 20.85);
    add(new THREE.BoxGeometry(0.5, 0.05, 0.06), brass, CONV.exit.x + dx * 0.6, 1.1, 20.8);
  });
  add(new THREE.BoxGeometry(3.0, 0.2, 0.1), trimMat, CONV.exit.x, 2.5, 20.85);
  const exitSign = add(new THREE.PlaneGeometry(0.7, 0.22),
    new THREE.MeshBasicMaterial({ color: 0xff3a2a }), CONV.exit.x, 2.85, 20.84);
  exitSign.rotation.y = Math.PI;

  // potted palms, because it is a hotel
  const potMat = mat({ color: 0x8a5a3a, roughness: 0.8 });
  const leafMat = mat({ color: 0x2e5a2a, roughness: 0.9 });
  [[-6.3, 20.3], [6.3, 20.3], [-6.3, 13.7], [-13.2, 11.8], [13.2, 11.8]].forEach(([x, z]) => {
    add(new THREE.CylinderGeometry(0.3, 0.24, 0.6, 10), potMat, x, 0.3, z);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const l = add(new THREE.ConeGeometry(0.12, 1.3, 4), leafMat, x + Math.cos(a) * 0.35, 1.2, z + Math.sin(a) * 0.35);
      l.rotation.z = Math.cos(a) * 0.7; l.rotation.x = -Math.sin(a) * 0.7;
    }
    box(x, z, 0.3, 0.3);
  });

  /* ---------------------------------------------- lighting
     Function-room light: flat and bright over the chairs, warmer on the
     stage, and a chandelier in the foyer. Every light has a fixture. */
  const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0 });
  [[-7, -6], [7, -6], [-7, 4], [7, 4]].forEach(([x, z]) => {
    add(new THREE.BoxGeometry(2.4, 0.06, 1.2), fixtureMat, x, WALL_H - 0.04, z);
  });
  const chand = add(new THREE.SphereGeometry(0.34, 12, 8), fixtureMat, 0, 4.7, 17);
  chand.scale.y = 0.5;
  const lights = [
    [0, WALL_H - 0.6, -5, 0xfff0d8, 150],
    [0, WALL_H - 0.6, 6, 0xfff0d8, 120],
    [0, 4.5, -12.5, 0xffc88a, 90],        // the stage wash
    [0, 4.3, 17, 0xffd9a0, 60],           // the foyer chandelier
  ];
  lights.forEach(([x, y, z, c, i]) => {
    const L = new THREE.PointLight(c, i, 0, 2);
    L.position.set(x, y, z);
    group.add(L);
  });
  group.add(new THREE.AmbientLight(0x5a4c40, 1.7));
  group.add(new THREE.HemisphereLight(0xfff4e0, 0x3a2a20, 0.8));

  /* ---------------------------------------------- where people go */
  // yours, the one beside it, and the two in front -- so there is a stage
  // to look at and not the back of a man from the Nevada attorney's office
  const seatKey = (s) => (s.row === 6 || s.row === 5) && s.x > 0 && s.x < 2.7;
  const spots = {
    seats: seats.filter((s) => !seatKey(s)),
    foyer: [[-1.5, 16.5], [1.8, 15.2], [5.2, 17.8], [2.6, 18.9], [-2.2, 19.4], [5.6, 14.6],
            [-5.6, 19.4], [0.8, 14.1]].map(([x, z]) => ({ x, z })),
    back: [[-9, 8.5], [-6.5, 9.8], [-11, 6.2], [6.2, 8.8], [12.5, 6.5], [-12.6, -3], [12.8, -6]]
      .map(([x, z]) => ({ x, z })),
    // down one side aisle, across the back and up the other
    paths: [
      [{ x: -13.0, z: 10.5 }, { x: -13.0, z: -11.5 }, { x: 13.0, z: -11.5 }, { x: 13.0, z: 10.5 }],
      [{ x: 13.0, z: 10.5 }, { x: 0.2, z: 11.2 }, { x: -13.0, z: 10.5 }, { x: -13.0, z: -4 }],
    ],
  };

  /* One slide. Everything the keynote shows is drawn here, from a key the
     lecture script names -- the drugs by their own name and colour. */
  function setSlide(key, S) {
    const g = slideCv.getContext('2d');
    g.fillStyle = '#0d1a3a'; g.fillRect(0, 0, 512, 288);
    g.strokeStyle = '#c8a650'; g.lineWidth = 3; g.strokeRect(10, 10, 492, 268);
    g.textAlign = 'center';
    g.fillStyle = '#e8e2d0';
    if (key === 'title') {
      g.font = 'bold 26px Georgia, serif';
      g.fillText('THE DRUG MENACE', 256, 112);
      g.font = '17px Georgia, serif';
      g.fillText('an introduction for the prosecutor', 256, 146);
      g.font = '13px Georgia, serif';
      g.fillStyle = '#9ab0d0';
      g.fillText('KEYNOTE ADDRESS  ·  GRAND BALLROOM  ·  9:00 A.M.', 256, 214);
    } else if (key === 'roach') {
      g.font = 'bold 22px Georgia, serif';
      g.fillText('EXHIBIT C', 256, 60);
      g.fillStyle = '#b89a6a';
      g.fillRect(186, 130, 140, 16);
      g.fillStyle = '#3a2a1a';
      g.fillRect(318, 130, 10, 16);
      g.fillStyle = '#e8e2d0';
      g.font = 'italic 17px Georgia, serif';
      g.fillText('what is this called?', 256, 214);
    } else if (key === 'end') {
      g.font = 'bold 26px Georgia, serif';
      g.fillText('QUESTIONS', 256, 130);
      g.font = '15px Georgia, serif';
      g.fillStyle = '#9ab0d0';
      g.fillText('coffee is served at the rear of the hall', 256, 170);
    } else if (S) {
      g.font = 'bold 22px Georgia, serif';
      g.fillText(S.name, 256, 58);
      g.font = '110px serif';
      g.fillStyle = S.color;
      g.fillText(S.glyph, 256, 190);
      g.font = '14px Georgia, serif';
      g.fillStyle = '#9ab0d0';
      g.fillText('KNOW IT ON SIGHT', 256, 250);
    } else {
      g.font = 'bold 60px Georgia, serif';
      g.fillStyle = '#ff2d1f';
      g.fillText('?', 256, 170);
    }
    slideTex.needsUpdate = true;
  }
  setSlide('title');

  return {
    group, colliders, spots, setSlide,
    rooms: CONV.rooms,
    show() { group.visible = true; },
    hide() { group.visible = false; },
  };
}

/* the hall carpet: a seventies function-room pattern, brown and rust */
function carpetTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#4a2418'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#8a4a1e'; g.lineWidth = 6;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      g.beginPath(); g.arc(32 + i * 64, 32 + j * 64, 22, 0, Math.PI * 2); g.stroke();
    }
  }
  g.strokeStyle = '#b8742a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 64); g.lineTo(128, 64); g.moveTo(64, 0); g.lineTo(64, 128); g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function bannerTexture(top, bottom) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = '#12244a'; g.fillRect(0, 0, 1024, 96);
  g.strokeStyle = '#c8a650'; g.lineWidth = 4; g.strokeRect(6, 6, 1012, 84);
  g.textAlign = 'center';
  g.fillStyle = '#f0e6c8';
  g.font = 'bold 34px Georgia, serif';
  g.fillText(top, 512, 46);
  g.font = '20px Georgia, serif';
  g.fillStyle = '#c8a650';
  g.fillText(bottom, 512, 78);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function flagTexture() {
  const cv = document.createElement('canvas');
  cv.width = 96; cv.height = 64;
  const g = cv.getContext('2d');
  for (let i = 0; i < 13; i++) {
    g.fillStyle = i % 2 ? '#f0ead8' : '#b0202a';
    g.fillRect(0, (i * 64) / 13, 96, 64 / 13 + 1);
  }
  g.fillStyle = '#1e2a5a'; g.fillRect(0, 0, 40, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
