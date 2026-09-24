/* ============================================================
   ROOM 1850 — the second act.

   The casino floor is a public room: big, round, loud, and the game
   there is getting four errands done in front of four hundred district
   attorneys. This is the opposite. It is small, it is private, the door
   is shut, and the trouble is already inside it.

   THE ROOMS ARE DEFINED ONCE, AS RECTANGLES, and both the walls and the
   containment are generated from that same list. The casino grew its
   invisible walls precisely because the two were written out separately
   and drifted apart; here a wall cannot exist where you are allowed to
   stand, because the wall builder skips any stretch that falls inside
   another room.
   ============================================================ */
import * as THREE from 'three';

export const SUITE = {
  // x0, x1, z0, z1 in suite-local metres. They overlap at the doorways,
  // which is what joins them into one walkable space.
  rooms: [
    { id: 'main', x0: -6.0, x1: 6.0, z0: -4.5, z1: 4.5 },
    // 4m wide, not 3: at 3m the walls' own standoff left a 1.08m lane and
    // the basin ate all but 34cm of it, which is not a room you can walk
    // through. Fittings go against a wall for the same reason.
    { id: 'bath', x0: -5.2, x1: -1.2, z0: -9.0, z1: -4.0 },
  ],
  door: { x: -6.0, z: 0 },      // the suite's door, onto the hall
  spawn: { x: -4.6, z: 0.4 },
  // The eighteenth-floor hall outside the door. NOT one of the rooms above:
  // the wall builder would open the suite's whole west wall onto it. It is
  // walked only on the way out, and its walls are built by hand below.
  // x1 overlaps the suite's wall by 10cm so the doorway has no seam in it.
  hall: { id: 'hall', x0: -8.4, x1: -5.9, z0: -14.0, z1: 6.5 },
  // the lift bank, on the hall's far wall down at the end
  lifts: [-12.2, -9.8],
  liftCall: { x: -7.6, z: -11.0 },
};

const WALL_H = 3.2;
const SEG = 0.5;                // wall sampling step

const inside = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

/** Is this point inside any room OTHER than the one whose wall we are building? */
function inAnother(rooms, self, x, z) {
  return rooms.some((r) => r !== self && inside(r, x, z));
}

export function buildSuite(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const colliders = [];
  const box = (x, z, hw, hd) => colliders.push({ x, z, hw, hd });

  const mat = (o) => new THREE.MeshStandardMaterial(o);   // few enough here not to matter
  const wallMat = mat({ color: 0x6d5a48, roughness: 0.92, metalness: 0.0 });
  const trimMat = mat({ color: 0x2a1a12, roughness: 0.6, metalness: 0.2 });
  const tileMat = mat({ color: 0x9aa8a4, roughness: 0.35, metalness: 0.05 });

  /* ---------------------------------------------- floor & ceiling */
  SUITE.rooms.forEach((r) => {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      r.id === 'bath' ? tileMat
                      : mat({ color: 0x4a2b22, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((r.x0 + r.x1) / 2, 0.01, (r.z0 + r.z1) / 2);
    group.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      mat({ color: 0x241a16, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set((r.x0 + r.x1) / 2, WALL_H, (r.z0 + r.z1) / 2);
    group.add(ceil);
  });

  /* ---------------------------------------------- walls
     Walked round each room's perimeter in half-metre pieces. A piece is
     only built where it does NOT fall inside another room, so the join
     between the bedroom and the bathroom opens itself and no collider
     is ever left standing in a place you are supposed to walk. */
  const wallGeo = new THREE.BoxGeometry(SEG + 0.02, WALL_H, 0.22);
  SUITE.rooms.forEach((r) => {
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
        // a doorway is simply a stretch of wall that is inside the next room
        const probeX = x + (run.fixed === 'x' ? (run.at === r.x0 ? -0.2 : 0.2) : 0);
        const probeZ = run.fixed === 'z' ? z + (run.at === r.z0 ? -0.2 : 0.2) : z;
        if (inAnother(SUITE.rooms, r, probeX, probeZ)) continue;
        // and the way out to the lift is a hole in the wall too
        if (Math.abs(x - SUITE.door.x) < 0.3 && Math.abs(z - SUITE.door.z) < 0.9) continue;
        const m = new THREE.Mesh(wallGeo, wallMat);
        m.position.set(x, WALL_H / 2, z);
        m.rotation.y = run.rot;
        group.add(m);
        // EVERY wall piece gets a collider, which is what makes the
        // doorways work: a stretch with no wall has no collider either,
        // so there is nothing left to inflate a gap across.
        if (run.fixed === 'z') box(x, z, SEG / 2 + 0.01, 0.11);
        else box(x, z, 0.11, SEG / 2 + 0.01);
      }
    });
  });

  /* ---------------------------------------------- the window
     A hotel window is a recess with a sill and curtains either side of it,
     not a picture hung on a wall, and the curtains are what actually make
     the room read as a room from the inside. */
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 2.0),
    new THREE.MeshBasicMaterial({ map: stripTexture() }));
  glass.position.set(5.86, 1.85, 0);
  glass.rotation.y = -Math.PI / 2;
  group.add(glass);

  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 7.6), trimMat);
  sill.position.set(5.82, 0.82, 0);
  group.add(sill);
  const pelmet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 8.2), trimMat);
  pelmet.position.set(5.80, 2.98, 0);
  group.add(pelmet);

  const curtainMat = mat({ color: 0x6d3a2c, roughness: 0.95 });
  [-1, 1].forEach((sd) => {
    // a curtain is a few folds, not a flat slab
    for (let f = 0; f < 5; f++) {
      const fold = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.13, 2.2, 6, 1, false, 0, Math.PI), curtainMat);
      fold.position.set(5.70, 1.85, sd * (2.6 + f * 0.22));
      fold.rotation.y = -Math.PI / 2;
      group.add(fold);
    }
  });

  /* ---------------------------------------------- skirting
     The single cheapest thing you can do to stop a box reading as a box:
     a line where the wall meets the floor. */
  SUITE.rooms.forEach((r) => {
    const runs = [
      [r.x0, r.z0, r.x1, r.z0], [r.x0, r.z1, r.x1, r.z1],
      [r.x0, r.z0, r.x0, r.z1], [r.x1, r.z0, r.x1, r.z1],
    ];
    runs.forEach(([x0, z0, x1, z1]) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const sk = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.06), trimMat);
      sk.position.set((x0 + x1) / 2, 0.07, (z0 + z1) / 2);
      if (x0 === x1) sk.rotation.y = Math.PI / 2;
      group.add(sk);
    });
  });

  /* ---------------------------------------------- the door you came in by */
  const frameMat = mat({ color: 0x33221a, roughness: 0.7 });
  [[-0.95], [0.95]].forEach(([dz]) => {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.25, 0.14), frameMat);
    jamb.position.set(SUITE.door.x, 1.13, SUITE.door.z + dz);
    group.add(jamb);
  });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 2.04), frameMat);
  lintel.position.set(SUITE.door.x, 2.33, SUITE.door.z);
  group.add(lintel);

  /* the door itself. There used to be a hole here and nothing in it, so the
     maid stood in a black void and never had anything to leave through.
     Hinged on the -Z jamb and swinging into the room, like a hotel door. */
  const doorPivot = new THREE.Group();
  doorPivot.userData.rigid = true;
  doorPivot.position.set(SUITE.door.x, 0, SUITE.door.z - 0.88);
  const leafGeo = new THREE.BoxGeometry(0.06, 2.2, 1.76);
  leafGeo.translate(0, 1.1, 0.88);
  const leaf = new THREE.Mesh(leafGeo, mat({ color: 0x5a3a26, roughness: 0.6 }));
  doorPivot.add(leaf);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6),
    mat({ color: 0xc8a650, roughness: 0.3, metalness: 0.9 }));
  handle.position.set(0.07, 1.02, 1.55);
  doorPivot.add(handle);
  group.add(doorPivot);

  /* ---------------------------------------------- the hall
     Carpet, other people's doors, a light every few metres and the lift
     bank at the end, which is the way back down to the floor. */
  const H = SUITE.hall;
  const hallW = -6.0 - H.x0, hallD = H.z1 - H.z0, hallCZ = (H.z0 + H.z1) / 2;
  const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(hallW, hallD),
    mat({ color: 0x3a1418, roughness: 0.95 }));
  hallFloor.rotation.x = -Math.PI / 2;
  hallFloor.position.set((H.x0 - 6.0) / 2, 0.01, hallCZ);
  group.add(hallFloor);
  const hallCeil = new THREE.Mesh(new THREE.PlaneGeometry(hallW, hallD),
    mat({ color: 0x241a16, roughness: 1 }));
  hallCeil.rotation.x = Math.PI / 2;
  hallCeil.position.set((H.x0 - 6.0) / 2, WALL_H, hallCZ);
  group.add(hallCeil);
  const hallWallMat = mat({ color: 0x7a6248, roughness: 0.9 });
  const hallWall = (x, z, w, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), hallWallMat);
    m.position.set(x, WALL_H / 2, z);
    group.add(m);
    box(x, z, w / 2, d / 2);
  };
  hallWall(H.x0 - 0.1, hallCZ, 0.2, hallD);                           // far wall
  hallWall((H.x0 - 6.0) / 2, H.z0 - 0.1, hallW, 0.2);                 // the lift end
  hallWall((H.x0 - 6.0) / 2, H.z1 + 0.1, hallW, 0.2);                 // the other end
  // the near wall, where the suite's own wall does not already stand
  hallWall(-6.0, (H.z0 - 4.5) / 2, 0.22, -4.5 - H.z0);
  hallWall(-6.0, (4.5 + H.z1) / 2, 0.22, H.z1 - 4.5);

  const otherDoorMat = mat({ color: 0x4a3020, roughness: 0.6 });
  [-5.5, 0.4, 4.6].forEach((z) => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 1.0), otherDoorMat);
    d.position.set(H.x0 + 0.02, 1.1, z);
    group.add(d);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.2),
      mat({ color: 0xc8a650, roughness: 0.3, metalness: 0.8 }));
    plate.position.set(H.x0 + 0.05, 1.6, z + 0.7);
    group.add(plate);
  });

  // the lifts: brushed doors in a frame, and a lit call button between them
  const liftMat = mat({ color: 0x8c8a84, roughness: 0.3, metalness: 0.6 });
  const liftFrame = mat({ color: 0x2a1a12, roughness: 0.5 });
  SUITE.lifts.forEach((z) => {
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 1.5), liftFrame);
    fr.position.set(H.x0 + 0.02, 1.25, z);
    group.add(fr);
    [-1, 1].forEach((sd) => {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.3, 0.6), liftMat);
      d.position.set(H.x0 + 0.08, 1.15, z + sd * 0.31);
      group.add(d);
    });
    const ind = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffa040 }));
    ind.position.set(H.x0 + 0.09, 2.62, z);
    group.add(ind);
  });
  const callPlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.14),
    mat({ color: 0xc8a650, roughness: 0.3, metalness: 0.8 }));
  callPlate.position.set(H.x0 + 0.06, 1.15, SUITE.liftCall.z);
  group.add(callPlate);
  const callBtn = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
  callBtn.position.set(H.x0 + 0.09, 1.15, SUITE.liftCall.z);
  group.add(callBtn);

  [-10.5, -2.5, 4.0].forEach((z) => {
    const fx = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe2b4 }));
    fx.position.set((H.x0 - 6.0) / 2, WALL_H - 0.05, z);
    group.add(fx);
    const L = new THREE.PointLight(0xffc88a, 6, 0, 2);
    L.position.set((H.x0 - 6.0) / 2, WALL_H - 0.3, z);
    group.add(L);
  });

  /* ---------------------------------------------- furniture
     Everything here is built from parts. A bed is a base, a mattress, a
     cover and a headboard; a desk is a top on legs you can see under. A
     single box is a crate, and a room full of crates is what the suite
     was before this. */
  const collide = (x, z, hw, hd) => box(x, z, hw, hd);

  const bedBaseMat = mat({ color: 0x4b3326, roughness: 0.85 });
  const sheetMat = mat({ color: 0xc9bfa6, roughness: 0.95 });
  const coverMat = mat({ color: 0x7c2f34, roughness: 0.9 });
  const pillowMat = mat({ color: 0xe0d8c4, roughness: 1 });

  const makeBed = (cx, cz) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.30, 2.55), bedBaseMat);
    base.position.set(cx, 0.15, cz); group.add(base);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.26, 2.48), sheetMat);
    mattress.position.set(cx, 0.43, cz); group.add(mattress);
    // the cover only reaches partway up: that gap is what reads as bedding
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.10, 1.72), coverMat);
    cover.position.set(cx, 0.58, cz + 0.36); group.add(cover);
    [-0.44, 0.44].forEach((px) => {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.16, 0.44), pillowMat);
      pil.position.set(cx + px, 0.62, cz - 0.94);
      pil.rotation.x = -0.10;
      group.add(pil);
    });
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.95, 0.10), bedBaseMat);
    head.position.set(cx, 0.62, cz - 1.32); group.add(head);
    collide(cx, cz, 1.0, 1.3);
  };
  makeBed(3.3, 2.9);
  makeBed(0.6, 2.9);

  // the table between them, with the lamp that lights this half of the room
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.5), trimMat);
  stand.position.set(1.95, 0.26, 2.2); group.add(stand);
  collide(1.95, 2.2, 0.32, 0.26);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.34, 10),
    mat({ color: 0x8a7030, roughness: 0.4, metalness: 0.6 }));
  lampBase.position.set(1.95, 0.69, 2.2); group.add(lampBase);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.28, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, side: THREE.DoubleSide }));
  shade.position.set(1.95, 1.02, 2.2); group.add(shade);

  /* the desk: a top, a back panel, and four legs you can see the floor under */
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.82), trimMat);
  deskTop.position.set(4.95, 0.76, -2.8); group.add(deskTop);
  [[-0.78, -0.34], [0.78, -0.34], [-0.78, 0.34], [0.78, 0.34]].forEach(([dx, dz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.76, 0.07), trimMat);
    leg.position.set(4.95 + dx, 0.38, -2.8 + dz); group.add(leg);
  });
  collide(4.95, -2.8, 0.87, 0.44);

  const chair = new THREE.Group();
  chair.position.set(4.3, 0, -2.0);
  chair.rotation.y = 0.5;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.46), bedBaseMat);
  seat.position.y = 0.44; chair.add(seat);
  const backR = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.06), bedBaseMat);
  backR.position.set(0, 0.70, -0.20); chair.add(backR);
  [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([dx, dz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.05), bedBaseMat);
    leg.position.set(dx, 0.22, dz); chair.add(leg);
  });
  group.add(chair);
  collide(4.3, -2.0, 0.34, 0.34);

  /* the television, on its own legs, because it is 1971 */
  const tvBody = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.78, 0.62),
    mat({ color: 0x4a3526, roughness: 0.6 }));
  tvBody.position.set(-5.1, 0.82, 2.4); group.add(tvBody);
  [[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]].forEach(([dx, dz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.44, 6),
      mat({ color: 0x241a12, roughness: 0.6 }));
    leg.position.set(-5.1 + dx, 0.22, 2.4 + dz); group.add(leg);
  });
  const tvFace = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.56),
    new THREE.MeshBasicMaterial({ color: 0x24333d }));
  tvFace.position.set(-4.78, 0.86, 2.4);
  tvFace.rotation.y = Math.PI / 2;
  group.add(tvFace);
  collide(-5.1, 2.4, 0.6, 0.35);

  /* the dresser under the mirror */
  const dresser = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.86, 0.52), trimMat);
  dresser.position.set(-3.6, 0.43, 4.16); group.add(dresser);
  for (let d = 0; d < 3; d++) {
    const drw = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.22, 0.04),
      mat({ color: 0x4a3526, roughness: 0.6 }));
    drw.position.set(-3.6, 0.20 + d * 0.27, 3.89); group.add(drw);
  }
  collide(-3.6, 4.16, 0.82, 0.28);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9),
    mat({ color: 0x2a3138, roughness: 0.12, metalness: 0.85 }));
  mirror.position.set(-3.6, 1.62, 4.42);
  mirror.rotation.y = Math.PI;
  group.add(mirror);

  /* ---------------------------------------------- the bath
     A tub is a box with a hole in it. Four walls and a floor, so you can
     see the water sitting inside it rather than balanced on top. */
  const TUB_X = -3.2, TUB_Z = -7.6, TW = 0.95, TD = 0.52, TH = 0.62;
  const tubMat = mat({ color: 0xe8e4dc, roughness: 0.25, metalness: 0.05 });
  const tubFloor = new THREE.Mesh(new THREE.BoxGeometry(TW * 2, 0.10, TD * 2), tubMat);
  tubFloor.position.set(TUB_X, 0.05, TUB_Z); group.add(tubFloor);
  [[TW, 0, 0.09, TD], [-TW, 0, 0.09, TD],
   [0, TD, TW, 0.09], [0, -TD, TW, 0.09]].forEach(([dx, dz, hw, hd]) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, TH, hd * 2), tubMat);
    w.position.set(TUB_X + dx, TH / 2, TUB_Z + dz);
    group.add(w);
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(TW * 1.8, TD * 1.8),
    new THREE.MeshBasicMaterial({ color: 0x35565b }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(TUB_X, 0.50, TUB_Z);
  group.add(water);
  collide(TUB_X, TUB_Z, TW, TD);

  const taps = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8),
    mat({ color: 0xb8bcc0, roughness: 0.2, metalness: 0.9 }));
  taps.position.set(TUB_X + TW - 0.12, 0.72, TUB_Z);
  taps.rotation.z = 0.5;
  group.add(taps);

  /* the vanity: a counter with a basin sunk in it and a mirror over it */
  const VX = -1.72, VZ = -5.2;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 1.5), tubMat);
  counter.position.set(VX, 0.86, VZ); group.add(counter);
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.86, 1.4),
    mat({ color: 0x8e8c84, roughness: 0.6 }));
  pedestal.position.set(VX, 0.43, VZ); group.add(pedestal);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.12, 14),
    mat({ color: 0xf2efe8, roughness: 0.2 }));
  bowl.position.set(VX, 0.87, VZ); group.add(bowl);
  collide(VX, VZ, 0.45, 0.75);
  const vmirror = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0),
    mat({ color: 0x2a3138, roughness: 0.1, metalness: 0.9 }));
  vmirror.position.set(VX + 0.44, 1.60, VZ);
  vmirror.rotation.y = -Math.PI / 2;
  group.add(vmirror);

  // and the lavatory, because a bathroom without one is a shower room
  const wcBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.4, 12), tubMat);
  wcBowl.position.set(-4.5, 0.2, -5.1); group.add(wcBowl);
  const cistern = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.2), tubMat);
  cistern.position.set(-4.5, 0.65, -5.35); group.add(cistern);
  collide(-4.5, -5.15, 0.24, 0.3);

  /* ---------------------------------------------- what two days did to it
     None of this gets a collider. It all sits below 0.25m, which is under
     the height the collision audit counts as a solid, and giving knee-high
     litter a hitbox is exactly how you end up with invisible walls. */
  const litterMat = [
    mat({ color: 0x2c6b3a, roughness: 0.25, metalness: 0.1 }),   // bottle glass
    mat({ color: 0x7a5a22, roughness: 0.3, metalness: 0.1 }),
    mat({ color: 0xb8b2a4, roughness: 0.9 }),                    // towels
    mat({ color: 0x1d1a17, roughness: 0.7 }),
  ];
  const bottleGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.28, 7);
  const litterRand = (() => { let n = 20260922; return () => (n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  for (let i = 0; i < 26; i++) {
    const inBath = i > 20;
    const x = inBath ? -4.6 + litterRand() * 3.0 : -5.4 + litterRand() * 10.6;
    const z = inBath ? -8.4 + litterRand() * 3.6 : -4.1 + litterRand() * 8.2;
    const b = new THREE.Mesh(bottleGeo, litterMat[(litterRand() * 2) | 0]);
    // most of them are on their side, because nobody put them down carefully
    const fallen = litterRand() > 0.25;
    b.position.set(x, fallen ? 0.055 : 0.14, z);
    if (fallen) b.rotation.z = Math.PI / 2;
    b.rotation.y = litterRand() * 6.28;
    group.add(b);
  }
  // towels, where a towel ends up
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.5), litterMat[2]);
    t.position.set(-4.8 + litterRand() * 4.2, 0.04, -7.8 + litterRand() * 4.4);
    t.rotation.y = litterRand() * 6.28;
    group.add(t);
  }

  // the tape machine, dry on the cistern, which is the whole argument
  const recorder = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.24), litterMat[3]);
  recorder.position.set(-1.72, 0.96, -5.2);
  group.add(recorder);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 12),
    mat({ color: 0x8a8a8a, roughness: 0.4, metalness: 0.6 }));
  reel.rotation.x = Math.PI / 2;
  reel.position.set(-1.79, 1.02, -5.2);
  reel.rotation.z = Math.PI / 2;
  group.add(reel);

  // the grapefruit. It is on the desk until somebody needs it.
  const grapefruit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 9),
    mat({ color: 0xd98a3a, roughness: 0.85 }));
  grapefruit.position.set(4.5, 0.89, -2.2);
  group.add(grapefruit);

  // and the machine the whole night is supposed to turn into copy
  const typewriter = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.36),
    mat({ color: 0x23201d, roughness: 0.5, metalness: 0.35 }));
  typewriter.position.set(4.95, 0.86, -2.85);
  group.add(typewriter);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xe8e2d0, side: THREE.DoubleSide }));
  paper.position.set(4.95, 1.08, -2.72);
  paper.rotation.x = -0.35;
  group.add(paper);

  // the open suitcase somebody has been living out of
  const caseBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.6),
    mat({ color: 0x4a2c1c, roughness: 0.6 }));
  caseBase.position.set(-1.6, 0.09, 2.6);
  group.add(caseBase);
  const caseLid = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.6),
    mat({ color: 0x4a2c1c, roughness: 0.6 }));
  caseLid.position.set(-1.6, 0.32, 2.28);
  caseLid.rotation.x = -1.15;
  group.add(caseLid);

  /* ---------------------------------------------- lighting
     Every light in here belongs to a fixture you can see. A room lit by
     nothing reads as a diagram, and a lamp with a shade and no bulb in it
     reads as a prop. */
  const ceilingRose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.42, 0.16, 14),
    new THREE.MeshBasicMaterial({ color: 0xffe2b4 }));
  ceilingRose.position.set(0.5, WALL_H - 0.12, 0.5);
  group.add(ceilingRose);

  const lamps = [
    [0.5, WALL_H - 0.3, 0.5, 0xffd9a8, 60],   // the ceiling fixture
    [1.95, 1.05, 2.2, 0xffc98a, 13],          // the bedside lamp's own bulb
    [4.95, 2.30, -2.6, 0xffb46a, 16],         // over the desk
    [-3.2, 2.80, -7.0, 0xdff0ff, 22],         // the bathroom
    [-1.72, 2.30, -5.2, 0xdff0ff, 9],         // over the vanity
  ];
  lamps.forEach(([x, y, z, c, i]) => {
    const L = new THREE.PointLight(c, i, 0, 2);
    L.position.set(x, y, z);
    group.add(L);
  });
  group.add(new THREE.AmbientLight(0x4a3a30, 1.9));
  // the Strip throws a cold wash in through the glass all night
  const cityGlow = new THREE.PointLight(0x7090c0, 10, 0, 2);
  cityGlow.position.set(5.2, 1.9, 0);
  group.add(cityGlow);

  return {
    group, colliders, rooms: SUITE.rooms, doorPivot,
    show() { group.visible = true; },
    hide() { group.visible = false; },
  };
}

/* the view out of the window: a dark plain with the Strip burning on it */
function stripTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#05060f');
  sky.addColorStop(0.55, '#0b0a16');
  sky.addColorStop(1, '#241508');
  g.fillStyle = sky; g.fillRect(0, 0, 512, 128);

  const cols = ['#ff2d1f', '#ffb400', '#12e2e2', '#b6ff2e', '#a03cff', '#fff0c0'];
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512;
    const h = 8 + Math.random() * 46;
    const w = 6 + Math.random() * 20;
    g.fillStyle = '#0d0b12';
    g.fillRect(x, 128 - h, w, h);
    for (let k = 0; k < 14; k++) {
      if (Math.random() > 0.55) continue;
      g.fillStyle = cols[(Math.random() * cols.length) | 0];
      g.fillRect(x + 1 + Math.random() * (w - 3), 128 - h + Math.random() * (h - 3), 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
