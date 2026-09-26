/* ============================================================
   BAZOOKO CIRCUS — built on the bones of a real building.

   The reference is Circus Circus on the Las Vegas Strip, which
   is the place the novel's Bazooko Circus is drawn from. What
   that building actually is, and what this floor plan keeps:

     · a round pink-and-white striped BIG TOP, roughly 90 m
       across, with the casino laid out underneath the dome
     · a revolving MERRY-GO-ROUND BAR at dead centre — patrons
       on the outside, bartender riding the middle
     · circus acts on a trapeze rig directly above the floor,
       working over the gamblers' heads all night
     · the MIDWAY: a mezzanine ring above the casino, carnival
       booths facing inward over the rail
     · a registration wing off the rotunda, because the desk is
       never on the gaming floor
     · and the longest possible walk to the elevators

   SCALE. Real big top is ~90 m across; this rotunda is 72 m
   (R = 36), which keeps the proportions and the sightlines while
   staying walkable. Everything else is sized off a 1.78 m person:
   slot machines 0.66 m wide and 2.1 m to the top of the sign, bar
   top at 1.1 m, the front desk at 1.07 m, stools at 0.78 m, rail at
   1.0 m, dome springing at 6 m and apex at 22 m.
   ============================================================ */

import * as THREE from 'three';

const R = 36;                 // rotunda radius
const DOME_SPRING = 6;        // where the wall stops and the tent starts
const DOME_APEX = 22;
const MEZZ_Y = 8.5;           // the midway floor
const CAROUSEL_R = 6.3;       // outer edge of the revolving bar
const LAMP_COUNT = 6;

const C = {
  carpetA: 0x230810,   // burgundy ground
  carpetB: 0x14535c,   // teal medallion
  carpetC: 0xc07d22,   // gold lattice and rings
  carpetD: 0xc4331a,   // the jewel in the eye
  trim: 0xc9962e,
};

/* ============================================================
   OUT FRONT. The pavement, the canopy, the driveway and the Strip.

   Built like the front of a real Strip hotel of the period: the lobby
   doors open onto a pavement under a PORTE-COCHERE -- a deep canopy
   on pillars, its underside solid with bulbs -- with the drive running
   underneath it and the highway starting at the kerb beyond that. The
   car is where they left it in the film: pulled up crooked with its nose
   over the kerb, because nobody in that car was in any condition to park.

   All in world coordinates. Only ever reached on the way OUT.
   ============================================================ */
function buildFrontage(scene, box, mat, DOOR, WALL_Z) {
  const PAVE_Z = WALL_Z - 0.5;      // outside face of the front wall
  const KERB_Z = PAVE_Z - 4.5;      // pavement edge
  const DRIVE_Z = KERB_Z - 9.0;     // far side of the drive
  const X0 = -30, X1 = 22;

  const flat = (w, d, color, x, z, y = 0.01) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat({ color, roughness: 0.95 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };
  // pavement and drive under the canopy; beyond the kerb the highway runs
  // south, straight out of town
  flat(X1 - X0 + 30, PAVE_Z - KERB_Z, 0x6a625a, (X0 + X1) / 2, (PAVE_Z + KERB_Z) / 2);
  flat(X1 - X0 + 30, KERB_Z - DRIVE_Z, 0x232124, (X0 + X1) / 2, (KERB_Z + DRIVE_Z) / 2);
  // the kerb itself
  const kerb = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0 + 30, 0.15, 0.3),
    mat({ color: 0x8a8278, roughness: 0.9 }));
  kerb.position.set((X0 + X1) / 2, 0.075, KERB_Z);
  scene.add(kerb);

  /* ---- the building's face. Pink and white, like the tent inside it */
  {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const g = cv.getContext('2d');
    for (let i = 0; i < 32; i++) {
      g.fillStyle = i % 2 ? '#d8c8c0' : '#b0506a';
      g.fillRect(i * 16, 0, 16, 128);
    }
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, 512, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    // in three pieces, round the doorway, or you would see stripes
    // where the glass doors are
    const piece = (x0, x1, y0, y1) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), faceMat);
      f.position.set((x0 + x1) / 2, (y0 + y1) / 2, PAVE_Z - 0.02);
      f.rotation.y = Math.PI;
      scene.add(f);
    };
    piece(-49, DOOR.x0, 0, 16);
    piece(DOOR.x1, 41, 0, 16);
    piece(DOOR.x0, DOOR.x1, 3.2, 16);
  }

  /* ---- the doors: four glass leaves that part when you walk at them */
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9ab8c0, roughness: 0.1,
    metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false });
  const frameMat = mat({ color: C.trim, roughness: 0.35, metalness: 0.7 });
  const leaves = [];
  const dw = (DOOR.x1 - DOOR.x0) / 4;
  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Group();
    leaf.userData.rigid = true;       // slides as one piece
    const home = DOOR.x0 + dw * (i + 0.5);
    leaf.position.set(home, 0, WALL_Z);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.08, 3.1, 0.05), glassMat);
    pane.position.y = 1.6;
    leaf.add(pane);
    [-1, 1].forEach((sd) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.1, 0.08), frameMat);
      rail.position.set(sd * (dw / 2 - 0.04), 1.6, 0);
      leaf.add(rail);
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(dw * 0.7, 0.05, 0.12), frameMat);
    bar.position.set(0, 1.05, 0);
    leaf.add(bar);
    scene.add(leaf);
    // the outer pair slides outward, the inner pair slides over them
    leaves.push({ leaf, home, dir: i < 2 ? -1 : 1, open: 0 });
  }

  /* ---- the porte-cochere */
  const CAN_X0 = -26, CAN_X1 = 14, CAN_Z1 = DRIVE_Z + 0.4, CAN_Y = 5.4;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(CAN_X1 - CAN_X0, 0.7, PAVE_Z - CAN_Z1),
    mat({ color: 0x2a1418, roughness: 0.8 }));
  canopy.position.set((CAN_X0 + CAN_X1) / 2, CAN_Y + 0.35, (PAVE_Z + CAN_Z1) / 2);
  scene.add(canopy);
  // its underside is nothing but bulbs -- and, like the film's entrance
  // canopy, they CHASE, in diagonal waves out toward the street
  let bulbs = null;
  const bulbGrid = [];
  {
    const cols = Math.floor((CAN_X1 - CAN_X0) / 1.1), rows = Math.floor((PAVE_Z - CAN_Z1) / 1.1);
    bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff }), cols * rows);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
      m.makeTranslation(CAN_X0 + 0.55 + a * 1.1, CAN_Y - 0.05, CAN_Z1 + 0.55 + b * 1.1);
      bulbs.setMatrixAt(n, m);
      bulbGrid.push(a + b);
      bulbs.setColorAt(n++, new THREE.Color(0xffe6a0));
    }
    scene.add(bulbs);
  }
  // pillars along the highway side, clear of the lane the car leaves by
  // (x -14..2 is tarmac and shoulder); the building carries the other edge
  const pillarMat = mat({ color: 0xd8c8b8, roughness: 0.6 });
  for (const x of [CAN_X0 + 1, -16, 5, CAN_X1 - 1]) {
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, CAN_Y, 14), pillarMat);
    pl.position.set(x, CAN_Y / 2, CAN_Z1 + 0.6);
    scene.add(pl);
    box(x, CAN_Z1 + 0.6, 0.42, 0.42);
  }
  // the name, on the canopy's face, lit, facing the street
  const nameSign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4),
    new THREE.MeshBasicMaterial({ map: neonTexture('BAZOOKO CIRCUS', '#ff2d6a'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  nameSign.position.set((CAN_X0 + CAN_X1) / 2, CAN_Y + 1.2, CAN_Z1 - 0.02);
  nameSign.rotation.y = Math.PI;
  scene.add(nameSign);
  const hotelSign = new THREE.Mesh(new THREE.PlaneGeometry(20, 5),
    new THREE.MeshBasicMaterial({ map: neonTexture('HOTEL  CASINO', '#ffb400'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  hotelSign.position.set(19, 11, PAVE_Z - 0.05);
  hotelSign.rotation.y = Math.PI;
  scene.add(hotelSign);

  // the valet's podium, by the doors, with nobody's keys on it
  const podium = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.15, 0.6),
    mat({ color: 0x3a1c10, roughness: 0.5 }));
  podium.position.set(0.5, 0.58, PAVE_Z - 1.6);
  scene.add(podium);
  box(0.5, PAVE_Z - 1.6, 0.45, 0.3);

  // planters close off the ends of the pavement
  const planterMat = mat({ color: 0x4a4038, roughness: 0.9 });
  const leafMat = mat({ color: 0x2c4a22, roughness: 0.9 });
  // (the pavement only: the drive runs on out to the highway both ways)
  for (const x of [X0 + 1, X1 - 1]) {
    const pb = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, PAVE_Z - KERB_Z), planterMat);
    pb.position.set(x, 0.4, (PAVE_Z + KERB_Z) / 2);
    scene.add(pb);
    box(x, (PAVE_Z + KERB_Z) / 2, 1, (PAVE_Z - KERB_Z) / 2);
  }
  // and palms flanking the road where the drive lets out, because it is Las Vegas
  for (let i = 0; i < 6; i++) {
    const x = X0 + 4 + i * 9;
    if (x > -24 && x < 12) continue;   // the motor court opens out through here
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 7.5, 7),
      mat({ color: 0x5a4632, roughness: 1 }));
    trunk.position.set(x, 3.75, DRIVE_Z - 0.7);
    scene.add(trunk);
    for (let f = 0; f < 7; f++) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.4), leafMat);
      const a = (f / 7) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.1, 7.3, DRIVE_Z - 0.7 + Math.sin(a) * 1.1);
      frond.rotation.set(0, -a, -0.45);
      scene.add(frond);
    }
  }

  // (the canopy's wash and the street light: the shared pool in main.js)

  /* ---- the clown. The film's Bazooko entrance is a giant clown's head
     with its mouth gaping open, and you walk in through the mouth. Here
     the glass doors are at the back of its throat, and its face rises up
     past the canopy roof to look out over the highway. */
  {
    const tex = canvasTex(1024, 1024, (g) => {
      const PX = 51.2;                           // pixels per metre, 20m square
      const X = (m) => 512 + m * PX, Y = (m) => 1024 - m * PX;
      g.clearRect(0, 0, 1024, 1024);
      // hair first, behind the face: orange tufts either side
      g.fillStyle = '#ff6a1a';
      for (let i = 0; i < 26; i++) {
        const sd = i % 2 ? 1 : -1, k = i >> 1;
        g.beginPath();
        g.arc(X(sd * (7.2 + (k % 3) * 0.8)), Y(10.5 + (k % 5) * 1.1), 1.2 * PX, 0, Math.PI * 2);
        g.fill();
      }
      // the face
      g.fillStyle = '#f4efe6';
      g.beginPath(); g.ellipse(X(0), Y(9.6), 8.0 * PX, 9.2 * PX, 0, 0, Math.PI * 2); g.fill();
      // a little hat, cocked
      g.fillStyle = '#2a8a3a';
      g.beginPath(); g.moveTo(X(-1.8), Y(18.2)); g.lineTo(X(1.2), Y(20)); g.lineTo(X(2.2), Y(17.6)); g.fill();
      // cheeks
      g.fillStyle = 'rgba(230,90,110,0.55)';
      [-4.6, 4.6].forEach((x) => { g.beginPath(); g.arc(X(x), Y(8.2), 1.5 * PX, 0, Math.PI * 2); g.fill(); });
      // eyes: white, a blue diamond through each, pupils rolled up at nothing
      [-3.0, 3.0].forEach((x) => {
        g.fillStyle = '#2a5ad8';
        g.beginPath(); g.moveTo(X(x), Y(15.8)); g.lineTo(X(x + 1.2), Y(13.0));
        g.lineTo(X(x), Y(10.4)); g.lineTo(X(x - 1.2), Y(13.0)); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(X(x), Y(13.0), 0.95 * PX, 1.3 * PX, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111';
        g.beginPath(); g.arc(X(x + 0.15), Y(13.5), 0.45 * PX, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#111'; g.lineWidth = 0.35 * PX;
        g.beginPath(); g.arc(X(x), Y(13.4), 1.9 * PX, -2.4, -0.7); g.stroke();
      });
      // the nose
      const ng = g.createRadialGradient(X(-0.3), Y(10.5), 5, X(0), Y(10.2), 1.3 * PX);
      ng.addColorStop(0, '#ff9a8a'); ng.addColorStop(0.35, '#e0141a'); ng.addColorStop(1, '#8a0a0e');
      g.fillStyle = ng; g.beginPath(); g.arc(X(0), Y(10.2), 1.25 * PX, 0, Math.PI * 2); g.fill();
      // the lips: a huge red grin, gaping right down to the pavement
      g.fillStyle = '#d0101a';
      g.beginPath();
      g.moveTo(X(-6.4), Y(0)); g.quadraticCurveTo(X(-6.6), Y(7.8), X(0), Y(7.6));
      g.quadraticCurveTo(X(6.6), Y(7.8), X(6.4), Y(0)); g.closePath(); g.fill();
      // the throat
      g.fillStyle = '#3a0408';
      g.beginPath();
      g.moveTo(X(-5.2), Y(0)); g.quadraticCurveTo(X(-5.3), Y(6.3), X(0), Y(6.1));
      g.quadraticCurveTo(X(5.3), Y(6.3), X(5.2), Y(0)); g.closePath(); g.fill();
      // teeth along the top of it
      g.fillStyle = '#fbf8f0';
      for (let i = -4; i <= 4; i++) {
        const tx = i * 1.05, ty = 6.1 - 0.02 * i * i * 1.4;
        g.fillRect(X(tx - 0.45), Y(ty), 0.9 * PX, 0.9 * PX);
      }
      // and the doors, which are at the back of its throat: cut clean out
      g.clearRect(X(-4.0), Y(3.25), 8.0 * PX, 3.25 * PX);
      // a ring of bulbs round the whole head
      g.fillStyle = '#ffe28a';
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const bx = X(Math.cos(a) * 8.5), by = Y(9.6 + Math.sin(a) * 9.7);
        if (by > Y(7.5) && Math.abs(Math.cos(a)) < 0.8) continue;   // not across the mouth
        g.beginPath(); g.arc(bx, by, 0.16 * PX, 0, Math.PI * 2); g.fill();
      }
    });
    const clown = new THREE.Mesh(new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5,
        emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.8 }));
    clown.position.set((DOOR.x0 + DOOR.x1) / 2, 10, PAVE_Z - 0.06);
    clown.rotation.y = Math.PI;
    scene.add(clown);
  }

  /* ---- the pole sign: a neon clown a hundred feet up, and in place of
     the real one's pinwheel, the film's mallet */
  {
    const tex = canvasTex(512, 768, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, 512, 768);
      g.lineCap = 'round'; g.lineJoin = 'round';
      const neon = (col, w, draw) => {
        g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 30; g.lineWidth = w;
        for (let i = 0; i < 2; i++) { g.beginPath(); draw(); g.stroke(); }
        g.shadowBlur = 0; g.strokeStyle = '#fff5e6'; g.lineWidth = w * 0.35;
        g.beginPath(); draw(); g.stroke();
      };
      neon('#ff2d6a', 14, () => g.arc(256, 300, 110, 0, Math.PI * 2));            // head
      neon('#12e2e2', 12, () => { g.moveTo(170, 205); g.lineTo(256, 70); g.lineTo(342, 205); });  // hat
      neon('#ffb400', 12, () => g.arc(256, 330, 60, 0.15 * Math.PI, 0.85 * Math.PI));            // grin
      neon('#ff2d1f', 12, () => g.arc(256, 300, 20, 0, Math.PI * 2));             // nose
      neon('#b6ff2e', 10, () => { g.arc(215, 265, 14, 0, Math.PI * 2); g.moveTo(311, 265); g.arc(297, 265, 14, 0, Math.PI * 2); });
      // the arm going up, and the mallet in it
      neon('#ffb400', 14, () => { g.moveTo(355, 350); g.lineTo(430, 250); g.lineTo(440, 120); });
      neon('#a03cff', 16, () => { g.rect(390, 60, 110, 60); });
      neon('#ff2d6a', 14, () => { g.moveTo(180, 420); g.lineTo(256, 700); g.lineTo(332, 420); });   // collar/body
    });
    const signMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(10, 15), signMat);
    face.position.set(15, 19, DRIVE_Z - 0.7);
    scene.add(face);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 12, 8),
      mat({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 }));
    pole.position.set(15, 6, DRIVE_Z - 0.7);
    scene.add(pole);
  }

  const bulbCol = new THREE.Color();
  return {
    DOOR, PAVE_Z, KERB_Z, DRIVE_Z, X0, X1,
    /** the canopy's chase: a real marquee, not a symptom, so it always runs */
    update(t, near = true) {
      if (!bulbs || !near) return;
      // the chase moves 7 times a second, so only re-upload when it moves;
      // it used to rewrite all 400 bulb colours every frame, even from the
      // far end of the casino where nobody could see them
      const step = Math.floor(t * 7);
      if (step === this._step) return;
      this._step = step;
      for (let i = 0; i < bulbGrid.length; i++) {
        const on = (bulbGrid[i] + step) % 5 === 0;
        bulbs.setColorAt(i, bulbCol.setHex(on ? 0xfff6d8 : 0x8a6a30));
      }
      bulbs.instanceColor.needsUpdate = true;
    },
    // where the car is: left on the drive under the canopy, pointed straight
    // down the highway it is about to leave by, so getting in turns nothing
    car: { x: -6.5, z: KERB_Z - 3.2, yaw: 0 },
    /** slide the doors toward open (1) or shut (0) */
    doors(openAmt, dt) {
      leaves.forEach((d) => {
        d.open += (openAmt - d.open) * (1 - Math.pow(0.02, dt));
        d.leaf.position.x = d.home + d.dir * d.open * dw * 1.7;
      });
    },
  };
}



/* canvas helpers for the dressing below */
function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  return tex;
}
/** smoked mirror tiles with a streak of reflected light across each one */
function mirrorTex(repeat) {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#39434e'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4; i++) {
      const gr = g.createLinearGradient(0, i * 32, 128, i * 32 + 60);
      gr.addColorStop(0, 'rgba(160,190,220,0)');
      gr.addColorStop(0.5, 'rgba(170,200,230,0.35)');
      gr.addColorStop(1, 'rgba(160,190,220,0)');
      g.fillStyle = gr; g.fillRect(0, i * 32, 128, 32);
    }
    g.strokeStyle = '#b08a40'; g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  }, repeat);
}
function textBanner(text, bg, fg, w = 1024, h = 128) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    // shrink the lettering until it fits inside the border: long banners
    // were overflowing the canvas and losing their first and last words
    let px = Math.round(h * 0.42);
    do { g.font = `bold ${px}px Georgia, serif`; px -= 2; }
    while (px > 10 && g.measureText(text).width > w - 48);
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

/* ============================================================
   THE LOBBY, dressed. From the film's check-in: a line at the front desk,
   a desk long enough for several windows, mirrors, chandeliers, a bell
   captain, and the banner for the convention everyone is in town for.
   ============================================================ */
function buildLobbyDressing(scene, box, mat, spots, LOB_X, LOB_Z1) {
  spots.fixed = spots.fixed || [];

  // ...and a line behind the window you want. You are at the front of it.
  spots.fixed.push({ kind: 'stand', x: -14.3, z: -45.9, ry: 0.15 },
                   { kind: 'stand', x: -14.1, z: -47.1, ry: 0.05 },
                   { kind: 'stand', x: -14.4, z: -48.3, ry: -0.1 });

  // ---- chandeliers: tiers of crystal on a chain, and the glow inside them
  const crystalGeo = new THREE.OctahedronGeometry(0.07, 0);
  const crystalMat = new THREE.MeshBasicMaterial({ color: 0xffe9c0 });
  const spots3 = [[-4, -49], [-4, -37], [9, -43]];
  const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, spots3.length * 84);
  const chainMat = mat({ color: 0xb08a40, roughness: 0.3, metalness: 0.8 });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff2d0 });
  {
    const m = new THREE.Matrix4();
    let n = 0;
    spots3.forEach(([x, z]) => {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), chainMat);
      chain.position.set(x, 6.45, z);
      scene.add(chain);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), coreMat);
      core.position.set(x, 5.55, z);
      scene.add(core);
      [[0.45, 5.85, 16], [0.8, 5.5, 28], [1.1, 5.15, 40]].forEach(([r, y, k]) => {
        for (let i = 0; i < k; i++) {
          const a = (i / k) * Math.PI * 2;
          m.makeTranslation(x + Math.cos(a) * r, y - (i % 2) * 0.12, z + Math.sin(a) * r);
          crystals.setMatrixAt(n++, m);
        }
      });
    });
    crystals.count = n;
  }
  scene.add(crystals);
  // (the lobby's own light comes from the shared pool in main.js)

  // ---- mirrored columns, the other thing a Vegas lobby of 1971 is made of
  const colTex = mirrorTex([3, 4]);
  const colMat = new THREE.MeshStandardMaterial({ map: colTex, emissiveMap: colTex,
    emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.5 });
  const bandMat = mat({ color: 0xb08a40, roughness: 0.3, metalness: 0.8 });
  [[3, -50], [3, -36], [15, -50], [15, -36]].forEach(([x, z]) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 7, 8), colMat);
    c.position.set(x, 3.5, z);
    scene.add(c);
    [0.15, 6.85].forEach((y) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.3, 8), bandMat);
      b.position.set(x, y, z);
      scene.add(b);
    });
    box(x, z, 0.52, 0.52);
  });

  // ---- the bell captain, and a luggage cart nobody has come back for
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.15, 0.7), mat({ color: 0x3a1c10, roughness: 0.5 }));
  stand.position.set(1.4, 0.58, LOB_Z1 + 1.8);
  scene.add(stand);
  box(1.4, LOB_Z1 + 1.8, 0.6, 0.35);
  const bellSign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.22),
    new THREE.MeshBasicMaterial({ map: textBanner('BELL CAPTAIN', '#1a0c06', '#d8b060', 512, 100) }));
  bellSign.position.set(1.4, 1.0, LOB_Z1 + 2.16);
  scene.add(bellSign);
  spots.fixed.push({ kind: 'stand', x: 1.4, z: LOB_Z1 + 1.0, ry: 0 });
  {
    const cart = new THREE.Group();
    cart.position.set(-1.2, 0, LOB_Z1 + 3.2);
    cart.rotation.y = 0.3;
    const brass = mat({ color: 0xc8a040, roughness: 0.25, metalness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.7), mat({ color: 0x5a1a1a, roughness: 0.8 }));
    deck.position.y = 0.28; cart.add(deck);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 6, 20, Math.PI), brass);
    hoop.position.y = 0.3; hoop.scale.y = 2.4; cart.add(hoop);
    [[0.5, 0.45, 0.35, 0x3a2a1a], [0.8, 0.3, 0.4, 0x6a4020], [0.45, 0.35, 0.3, 0x243a44]].forEach(([w, h, d, c], i) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat({ color: c, roughness: 0.7 }));
      b.position.set(-0.3 + i * 0.3, 0.32 + h / 2 + (i === 2 ? 0.45 : 0), 0);
      cart.add(b);
    });
    scene.add(cart);
    box(-1.2, LOB_Z1 + 3.2, 0.72, 0.5);
  }

  // ---- potted palms in the corners
  const potMat = mat({ color: 0x5a3a2a, roughness: 0.8 });
  const frondMat = mat({ color: 0x2f5a2a, roughness: 0.9 });
  [[18.4, LOB_Z1 + 1.6], [18.4, -31.6], [-12.2, LOB_Z1 + 1.6]].forEach(([x, z]) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.8, 10), potMat);
    pot.position.set(x, 0.4, z); scene.add(pot);
    for (let f = 0; f < 8; f++) {
      const a = (f / 8) * Math.PI * 2;
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.03, 0.26), frondMat);
      fr.position.set(x + Math.cos(a) * 0.55, 1.7, z + Math.sin(a) * 0.55);
      fr.rotation.set(0, -a, -0.5);
      scene.add(fr);
    }
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 5), frondMat);
    trunk.position.set(x, 1.2, z); scene.add(trunk);
    box(x, z, 0.45, 0.45);
  });

  // ---- the banner for the convention the whole building is full of
  // two single-sided faces back to back: a double-sided plane read
  // backwards from the casino floor side
  const welcomeMat = new THREE.MeshBasicMaterial({ map: textBanner(
    'WELCOME  ·  NATIONAL DISTRICT ATTORNEYS ASSOCIATION  ·  NARCOTICS & DANGEROUS DRUGS',
    '#10224a', '#f0e6c8', 2048, 150) });
  [Math.PI, 0].forEach((ry, i) => {
    const welcome = new THREE.Mesh(new THREE.PlaneGeometry(22, 1.6), welcomeMat);
    welcome.position.set(0, 5.6, -31.2 + (i ? 0.02 : -0.02));
    welcome.rotation.y = ry;
    scene.add(welcome);
  });
}

/* ============================================================
   THE FRONT DESK. It was a slab 2.6 metres deep and chest high with a
   wall of pigeonholes five metres tall behind it, each hole the size of a
   man's body -- so the clerks were heads on a counter the size of a
   lorry, and everybody in the lobby looked like ants. A hotel desk is
   built to a person: a counter you can lean on at 1.07 m, 0.75 m deep so
   the clerk can reach your card, and a key rack at arm's height behind.

   Three windows along its eighteen metres -- CASHIER, REGISTRATION,
   INFORMATION -- split by brass-and-smoked-glass partitions, each with
   its bell and its pen, and at registration the register and the bowl
   of snacks that, in the film, is full of worms by the time Duke looks
   into it again. Behind: walnut to three metres, a key rack for each
   window, and the clocks that tell a guest it is later somewhere else.
   ============================================================ */
const DESK = { front: -15.7, depth: 0.75, top: 1.07, z0: -52, z1: -34, back: -19.45 };
const WINDOWS = [[-49, 'CASHIER', '#12e2e2'], [-43, null, null], [-37, 'INFORMATION', '#b6ff2e']];

function buildFrontDesk(scene, box, mat, spots) {
  spots.fixed = spots.fixed || [];
  const len = DESK.z1 - DESK.z0, zc = (DESK.z0 + DESK.z1) / 2;
  const add = (geo, m, x, y, z, ry = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z); o.rotation.y = ry;
    scene.add(o);
    return o;
  };
  const brass = mat({ color: 0xc9a048, roughness: 0.28, metalness: 0.9 });
  const walnut = mat({ color: 0x3a1e10, roughness: 0.5, metalness: 0.15 });

  // ---- the counter: walnut panels between gilt pilasters, a black kick
  const front = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#2a140a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) {
      const x = i * 256;
      const gr = g.createLinearGradient(x, 0, x + 256, 0);
      gr.addColorStop(0, '#4a2412'); gr.addColorStop(0.5, '#6a3a1c'); gr.addColorStop(1, '#4a2412');
      g.fillStyle = gr; g.fillRect(x + 22, 14, 212, h - 34);
      g.strokeStyle = '#1a0a04'; g.lineWidth = 4; g.strokeRect(x + 30, 22, 196, h - 50);
      g.fillStyle = '#c9a048'; g.fillRect(x, 0, 12, h - 12);          // the pilaster
      g.fillStyle = '#8a6a28'; g.fillRect(x + 3, 0, 3, h - 12);
    }
    g.fillStyle = '#c9a048'; g.fillRect(0, 0, w, 5);                  // the rail under the top
    g.fillStyle = '#0a0604'; g.fillRect(0, h - 12, w, 12);            // the kick
  }, [len / 3, 1]);
  add(new THREE.BoxGeometry(DESK.depth, DESK.top - 0.05, len), walnut,
    DESK.front - DESK.depth / 2, (DESK.top - 0.05) / 2, zc);
  // solid from the counter front back to the lobby wall. If the collider
  // is allowed to overhang the wall instead, the push-out shoves you
  // out of bounds and the containment clamp drops you behind the desk.
  box(-17.6, zc, 1.9, len / 2);
  add(new THREE.PlaneGeometry(len, DESK.top - 0.05),
    new THREE.MeshStandardMaterial({ map: front, roughness: 0.55, metalness: 0.1 }),
    DESK.front + 0.005, (DESK.top - 0.05) / 2, zc, Math.PI / 2);

  // the top: black marble with pale veins, overhanging the front on a brass
  // nosing. (Cream marble under the lobby's amber light was one flat glare.)
  const marble = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#1e1a18'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,180,150,0.32)'; g.lineWidth = 1.2;
    let s = 11;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 14; i++) {
      g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += 10 + r() * 30; y += (r() - 0.5) * 22; g.lineTo(x, y); }
      g.stroke();
    }
  }, [len / 2, 1]);
  add(new THREE.BoxGeometry(DESK.depth + 0.2, 0.05, len + 0.2),
    new THREE.MeshStandardMaterial({ map: marble, roughness: 0.3, metalness: 0.1 }),
    DESK.front - DESK.depth / 2 + 0.08, DESK.top - 0.025, zc);
  add(new THREE.BoxGeometry(0.04, 0.06, len + 0.2), brass, DESK.front + 0.18, DESK.top - 0.03, zc);
  // the clerks' side: a shelf under the counter, where the cards live
  add(new THREE.BoxGeometry(0.45, 0.04, len), walnut, DESK.front - DESK.depth - 0.2, 0.86, zc);

  // ---- the windows
  const glass = new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 0.1, metalness: 0.3,
    transparent: true, opacity: 0.45, depthWrite: false });
  const bellGeo = new THREE.SphereGeometry(0.055, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const bellBase = new THREE.CylinderGeometry(0.06, 0.065, 0.02, 12);
  const cardMat = mat({ color: 0xf0e8d8, roughness: 0.8 });
  const inkMat = mat({ color: 0x14100c, roughness: 0.4, metalness: 0.4 });
  const y0 = DESK.top;
  const xm = DESK.front - 0.2;          // the middle of the counter top, guest side
  WINDOWS.forEach(([z, label, col], i) => {
    // a clerk, and somebody being served at the two you are not queueing for
    spots.fixed.push({ kind: 'stand', x: DESK.front - DESK.depth - 0.4, z: z + (label ? 0 : 1.6), ry: Math.PI / 2 });
    if (label) spots.fixed.push({ kind: 'stand', x: DESK.front + 0.55, z, ry: -Math.PI / 2 });
    // the bell, the pen on its stand, a stack of cards
    add(bellBase, brass, xm, y0 + 0.01, z - 0.55);
    add(bellGeo, brass, xm, y0 + 0.02, z - 0.55);
    add(new THREE.BoxGeometry(0.1, 0.02, 0.08), inkMat, xm - 0.05, y0 + 0.01, z + 0.5);
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 5), inkMat, xm - 0.05, y0 + 0.09, z + 0.5).rotation.z = 0.5;
    add(new THREE.BoxGeometry(0.16, 0.02, 0.11), cardMat, xm - 0.02, y0 + 0.01, z + 0.25);
    // partitions between the windows
    if (i > 0) {
      const pz = z - 3;
      add(new THREE.BoxGeometry(0.6, 0.5, 0.02), glass, xm - 0.08, y0 + 0.27, pz);
      [-0.38, 0.22].forEach((dx) => add(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 6), brass, xm + dx, y0 + 0.28, pz));
      add(new THREE.BoxGeometry(0.64, 0.025, 0.035), brass, xm - 0.08, y0 + 0.55, pz);
    }
    // the sign over each window that is not the main one
    if (label) {
      add(new THREE.PlaneGeometry(2.6, 0.65),
        new THREE.MeshBasicMaterial({ map: neonTexture(label, col), transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false }), DESK.back + 0.1, 2.95, z, Math.PI / 2);
    }
  });
  // registration: the book, open, and the bowl of snacks
  {
    const z = -43;
    add(new THREE.BoxGeometry(0.34, 0.03, 0.46), mat({ color: 0x4a1010, roughness: 0.7 }), xm - 0.05, y0 + 0.015, z);
    add(new THREE.BoxGeometry(0.3, 0.012, 0.42), cardMat, xm - 0.05, y0 + 0.036, z);
    const bowl = add(new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      mat({ color: 0xc8c0b0, roughness: 0.2, metalness: 0.6, side: THREE.DoubleSide }), xm + 0.05, y0 + 0.11, z - 1.0);
    bowl.scale.y = 0.7;
    const nutGeo = new THREE.SphereGeometry(0.016, 5, 4);
    const nutMat = mat({ color: 0x9a6a30, roughness: 0.8 });
    for (let k = 0; k < 14; k++) {
      const a = k * 2.4, r = 0.02 + (k % 5) * 0.017;
      add(nutGeo, nutMat, xm + 0.05 + Math.cos(a) * r, y0 + 0.06 + (k % 3) * 0.008, z - 1.0 + Math.sin(a) * r);
    }
  }

  // ---- the wall behind: walnut wainscot to three metres, a gilt cornice
  add(new THREE.BoxGeometry(0.08, 3.0, len + 0.6), mat({ color: 0x2a140a, roughness: 0.55, metalness: 0.1 }),
    DESK.back, 1.5, zc);
  add(new THREE.BoxGeometry(0.12, 0.08, len + 0.6), brass, DESK.back + 0.02, 3.02, zc);
  add(new THREE.BoxGeometry(0.1, 0.12, len + 0.6), mat({ color: 0x0a0604, roughness: 0.6 }), DESK.back + 0.02, 0.06, zc);

  // a key rack behind each window: pigeonholes a hand wide, keys on tags
  const rack = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#3a1c0c'; g.fillRect(0, 0, w, h);
    const cols = 14, rows = 7, cw = (w - 12) / cols, ch = (h - 12) / rows;
    let s = 5;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let c = 0; c < cols; c++) for (let rI = 0; rI < rows; rI++) {
      const x = 6 + c * cw, y = 6 + rI * ch;
      g.fillStyle = '#0e0604'; g.fillRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
      const k = r();
      if (k < 0.55) {                          // a key on its brass tag
        g.fillStyle = '#c9a048'; g.fillRect(x + cw * 0.38, y + ch * 0.25, cw * 0.24, ch * 0.55);
      } else if (k < 0.72) {                   // a message waiting
        g.fillStyle = '#e8e0cc'; g.fillRect(x + 3, y + ch * 0.35, cw - 6, ch * 0.45);
      }
    }
  });
  const rackFace = new THREE.MeshStandardMaterial({ map: rack, roughness: 0.6 });
  WINDOWS.forEach(([z]) => {
    add(new THREE.BoxGeometry(0.28, 1.3, 2.4), walnut, DESK.back + 0.18, 1.85, z);
    add(new THREE.PlaneGeometry(2.3, 1.2), rackFace, DESK.back + 0.325, 1.85, z, Math.PI / 2);
  });

  // clocks for the places it is not three in the morning
  const clocks = canvasTex(512, 96, (g, w, h) => {
    const names = ['LAS VEGAS', 'NEW YORK', 'LONDON', 'TOKYO'];
    const times = [[3, 10], [6, 10], [11, 10], [8, 10]];
    names.forEach((n, i) => {
      const cx = 64 + i * 128, cy = 38;
      g.fillStyle = '#c9a048'; g.beginPath(); g.arc(cx, cy, 34, 0, 7); g.fill();
      g.fillStyle = '#f2ead8'; g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.fill();
      g.strokeStyle = '#1a1008'; g.lineWidth = 2;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.beginPath(); g.moveTo(cx + Math.sin(a) * 25, cy - Math.cos(a) * 25);
        g.lineTo(cx + Math.sin(a) * 29, cy - Math.cos(a) * 29); g.stroke();
      }
      const [hh, mm] = times[i];
      const ha = ((hh % 12) + mm / 60) / 12 * Math.PI * 2, ma = mm / 60 * Math.PI * 2;
      g.lineWidth = 3.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(ha) * 15, cy - Math.cos(ha) * 15); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(ma) * 23, cy - Math.cos(ma) * 23); g.stroke();
      g.fillStyle = '#d8b060'; g.font = 'bold 13px Georgia, serif'; g.textAlign = 'center';
      g.fillText(n, cx, 90);
    });
  });
  add(new THREE.PlaneGeometry(4.0, 0.75), new THREE.MeshBasicMaterial({ map: clocks, transparent: true }),
    DESK.back + 0.06, 2.95, -43, Math.PI / 2);
}

/* ============================================================
   THE NAUTICAL BAR -- the room the lizards are in.

   The film's direction: "The bar -- oily people -- quiet music --
   nautical theme", and its cinematographer on the set: an entirely
   mirrored interior, lit with blue gels. So: mirror on every wall, a
   net on the ceiling with glass floats in it, portholes onto water that
   is not there, a mounted marlin, a ship's wheel, and a long bar with a
   line of people along it who will turn into reptiles if you are seeing
   clearly enough. The spike on the wall is the film's marlin spike.
   ============================================================ */
function buildLounge(scene, box, mat, spots, LOB_X, DOOR) {
  spots.fixed = spots.fixed || [];
  const X0 = LOB_X + 0.5, X1 = 34, Z0 = -55, Z1 = -33, H = 4.2;
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;

  // teak deck of a floor
  const plank = canvasTex(256, 256, (g) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = ['#4a2c16', '#553218', '#432712', '#5c381c'][i % 4];
      g.fillRect(0, i * 32, 256, 32);
      g.fillStyle = '#1a0e06'; g.fillRect(0, i * 32, 256, 2);
      g.fillRect(((i * 97) % 256), i * 32, 2, 32);
    }
  }, [(X1 - X0) / 4, (Z1 - Z0) / 4]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0),
    new THREE.MeshStandardMaterial({ map: plank, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0.012, cz);
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 1, Z1 - Z0 + 1),
    mat({ color: 0x0a1426, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, H, cz);
  scene.add(ceil);

  // mirror on every wall
  const mirrorMat = (rx, ry) => {
    const t = mirrorTex([rx, ry]);
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0x9fb8ff,
      emissiveIntensity: 0.28, roughness: 0.15, metalness: 0.45 });
  };
  const wall = (x, z, w, d, rx) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), mirrorMat(rx, 2));
    m.position.set(x, H / 2, z);
    scene.add(m);
    box(x, z, w / 2, d / 2);
  };
  wall(cx, Z1 + 0.15, X1 - X0 + 1, 0.3, 7);      // north
  wall(cx, Z0 - 0.15, X1 - X0 + 1, 0.3, 7);      // south
  wall(X1 + 0.15, cz, 0.3, Z1 - Z0, 11);         // east, behind the bar
  // the lobby wall seen from in here is mirror too, round the doorway
  [[Z0, DOOR.z0], [DOOR.z1, Z1]].forEach(([a, b]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a, H), mirrorMat((b - a) / 2, 2));
    m.position.set(X0 + 0.01, H / 2, (a + b) / 2);
    m.rotation.y = Math.PI / 2;
    scene.add(m);
  });

  // ---- the bar, along the east wall, with a brass rail to put a foot on
  const BX = 31.6, BZ0 = -52, BZ1 = -36;
  const woodMat = mat({ color: 0x3a1a0c, roughness: 0.35, metalness: 0.2 });
  const brass = mat({ color: 0xc8a040, roughness: 0.25, metalness: 0.9 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, BZ1 - BZ0), woodMat);
  counter.position.set(BX, 0.525, (BZ0 + BZ1) / 2);
  scene.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, BZ1 - BZ0 + 0.3),
    mat({ color: 0x1a0804, roughness: 0.12, metalness: 0.3 }));
  top.position.set(BX, 1.09, (BZ0 + BZ1) / 2);
  scene.add(top);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, BZ1 - BZ0, 8), brass);
  rail.rotation.x = Math.PI / 2;
  rail.position.set(BX - 0.62, 0.22, (BZ0 + BZ1) / 2);
  scene.add(rail);
  box(BX, (BZ0 + BZ1) / 2, 0.6, (BZ1 - BZ0) / 2 + 0.15);
  // the back bar: shelves of bottles against the mirror
  const shelfMat = mat({ color: 0x2a140a, roughness: 0.5 });
  const bottleGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.3, 6);
  const bottleMat = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1,
    emissive: 0x111111 });
  const bottles = new THREE.InstancedMesh(bottleGeo, bottleMat, 3 * 40);
  {
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const cols = [0x2c6b3a, 0x7a5a22, 0xc8c0a0, 0x6a1a1a, 0x2a3a6a];
    let n = 0;
    for (let sh = 0; sh < 3; sh++) {
      const y = 1.25 + sh * 0.55;
      const sb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, BZ1 - BZ0), shelfMat);
      sb.position.set(X1 - 0.3, y - 0.17, (BZ0 + BZ1) / 2);
      scene.add(sb);
      for (let i = 0; i < 40; i++) {
        m.makeTranslation(X1 - 0.3, y, BZ0 + 0.2 + i * 0.39);
        bottles.setMatrixAt(n, m);
        bottles.setColorAt(n++, c.setHex(cols[(i * 7 + sh) % cols.length]));
      }
    }
  }
  scene.add(bottles);
  spots.fixed.push({ kind: 'stand', x: 33.1, z: -45, ry: -Math.PI / 2 });   // the barman

  // stools, and the oily people on them
  const stoolMat = mat({ color: 0x6a1420, roughness: 0.6 });
  for (let i = 0; i < 12; i++) {
    const z = BZ0 + 0.7 + i * 1.3;
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 12), stoolMat);
    seat.position.set(BX - 1.15, 0.78, z);
    scene.add(seat);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6), brass);
    pole.position.set(BX - 1.15, 0.38, z);
    scene.add(pole);
    if (i !== 6 && i !== 7 && i % 3 !== 1) {
      spots.fixed.push({ kind: 'sit', x: BX - 1.15, z, ry: Math.PI / 2 });
    }
  }

  // booths along the far walls: a high back, two ends and a table
  const boothMat = mat({ color: 0x5a1020, roughness: 0.7 });
  const tableMat = mat({ color: 0x241008, roughness: 0.3, metalness: 0.2 });
  [[23.2, Z0 + 1.3, 1], [27.4, Z0 + 1.3, 1], [23.2, Z1 - 1.3, -1], [27.4, Z1 - 1.3, -1]].forEach(([x, z, f]) => {
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.4, 0.3), boothMat);
    back.position.set(x, 0.7, z - f * 1.0);
    scene.add(back);
    [-1, 1].forEach((sd) => {
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 1.9), boothMat);
      end.position.set(x + sd * 1.35, 0.55, z);
      scene.add(end);
    });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.7), boothMat);
    seat.position.set(x, 0.23, z - f * 0.55);
    scene.add(seat);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 16), tableMat);
    tb.position.set(x, 0.76, z + f * 0.25);
    scene.add(tb);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.74, 6), brass);
    leg.position.set(x, 0.37, z + f * 0.25);
    scene.add(leg);
    // the back sits 1.15 behind the seat line and the table 0.85 in front
    box(x, z - f * 0.1, 1.5, 1.05);
    spots.fixed.push({ kind: 'sit', x: x - 0.55, z: z - f * 0.55, ry: f > 0 ? 0 : Math.PI },
                     { kind: 'sit', x: x + 0.6, z: z - f * 0.55, ry: f > 0 ? 0 : Math.PI });
  });

  // ---- the nautical business
  // portholes, onto a sea that is not there
  const seaTex = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 50, 4, 64, 64, 70);
    gr.addColorStop(0, '#3fd0d8'); gr.addColorStop(1, '#063848');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(0,20,30,0.7)';
    [[40, 70, 1], [84, 44, -1], [70, 96, 1]].forEach(([x, y, d]) => {
      g.beginPath(); g.ellipse(x, y, 12, 5, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(x - d * 12, y); g.lineTo(x - d * 20, y - 6); g.lineTo(x - d * 20, y + 6); g.fill();
    });
  });
  const seaMat = new THREE.MeshBasicMaterial({ map: seaTex });
  const portholes = [];
  [[23, Z1 + 0.32, Math.PI], [27, Z1 + 0.32, Math.PI], [21.5, Z0 - 0.32, 0], [29.5, Z0 - 0.32, 0]].forEach(([x, z, ry]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.07, 8, 20), brass);
    ring.position.set(x, 2.3, z); ring.rotation.y = ry; scene.add(ring);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), seaMat);
    glass.position.set(x, 2.3, z + (ry ? -0.01 : 0.01)); glass.rotation.y = ry; scene.add(glass);
    portholes.push(glass);
  });
  // the marlin, mounted, leaping at nothing over the north booths
  {
    const g = new THREE.Group();
    g.position.set(25.3, 3.05, Z1 + 0.45);
    const blue = mat({ color: 0x1c3e8a, roughness: 0.3, metalness: 0.4 });
    const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), blue);
    bodyM.scale.set(2.2, 0.55, 0.3); g.add(bodyM);
    const bill = new THREE.Mesh(new THREE.ConeGeometry(0.05, 1.1, 6), blue);
    bill.rotation.z = Math.PI / 2; bill.position.x = 1.55; g.add(bill);
    [[0.5, 0.35], [-0.5, -0.35]].forEach(([dy, rz]) => {
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 4), blue);
      tail.position.set(-1.25, dy * 0.6, 0); tail.rotation.z = Math.PI / 2 + rz * 2.2; g.add(tail);
    });
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 3), blue);
    fin.position.set(0.1, 0.42, 0); fin.scale.z = 0.2; g.add(fin);
    g.rotation.z = 0.12;
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.06), woodMat);
    plaque.position.set(25.3, 2.4, Z1 + 0.34);
    scene.add(plaque, g);
  }
  // the ship's wheel, and the marlin spike on the wall beside it
  {
    const g = new THREE.Group();
    g.position.set(25.3, 2.3, Z0 + 0.36);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 24), woodMat);
    g.add(wheel);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5, 6), woodMat);
      sp.rotation.z = a; g.add(sp);
      const hnd = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), woodMat);
      hnd.position.set(Math.sin(-a) * 0.76, Math.cos(a) * 0.76, 0);
      g.add(hnd);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), brass);
    hub.rotation.x = Math.PI / 2; g.add(hub);
    scene.add(g);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.9, 8), brass);
    spike.position.set(27.2, 2.0, Z0 + 0.34);
    spike.rotation.z = 0.35;
    scene.add(spike);
  }
  // a life ring by the door
  {
    const ringTex = canvasTex(256, 16, (g) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f0ece0' : '#c8201a'; g.fillRect(i * 32, 0, 32, 16); }
    });
    const lr = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.12, 10, 24),
      new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.6 }));
    lr.position.set(X0 + 1.4, 2.3, Z1 + 0.4);
    lr.rotation.y = Math.PI;
    scene.add(lr);
  }
  // the net on the ceiling, with its green glass floats
  const netTex = canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(150,130,90,0.45)'; g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 16) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 128); g.stroke();
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i - 64, 128); g.stroke();
    }
  }, [(X1 - X0) / 2, (Z1 - Z0) / 2]);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 - 1, Z1 - Z0 - 1, 24, 16),
    new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  net.rotation.x = Math.PI / 2;
  net.position.set(cx - 1, H - 0.35, cz);
  // it sags between the places it is hung from
  {
    const pos = net.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / (X1 - X0), v = pos.getY(i) / (Z1 - Z0);
      pos.setZ(i, -0.35 * Math.abs(Math.sin(u * Math.PI * 3)) * Math.abs(Math.sin(v * Math.PI * 2)));
    }
    net.geometry.computeVertexNormals();
  }
  scene.add(net);
  const floatMat = new THREE.MeshStandardMaterial({ color: 0x2f8a4a, roughness: 0.1,
    metalness: 0.2, emissive: 0x0c3a1a, transparent: true, opacity: 0.85 });
  const floats = [];
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), floatMat);
    f.position.set(X0 + 1.5 + (i % 3) * 3.6, H - 0.55, Z0 + 3 + Math.floor(i / 3) * 7);
    scene.add(f);
    f.userData.dynamic = true;     // they bob: never merged into the static set
    floats.push({ f, y: f.position.y, ph: i * 1.7 });
  }

  // (blue gels and the light over the bar: the shared pool in main.js)

  // the sign over the way in, on the lobby side
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5),
    new THREE.MeshBasicMaterial({ map: neonTexture('NAUTICAL BAR', '#3ab8ff'), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false }));
  sign.position.set(LOB_X - 0.52, 4.8, (DOOR.z0 + DOOR.z1) / 2);
  sign.rotation.y = -Math.PI / 2;
  scene.add(sign);

  return {
    X0, X1, Z0, Z1, BX, BZ0, BZ1,
    update(t, s) {
      // the sea behind the glass moves only if you are seeing things
      floats.forEach((o) => { o.f.position.y = o.y + Math.sin(t * 1.3 + o.ph) * 0.08 * s.psych; });
      seaTex.offset.x = Math.sin(t * 0.4) * 0.08 * s.psych;
    },
  };
}

/* ============================================================
   THE PITS. The film's floor: "a high wire act ... plummet to the nets
   suspended over the gambling tables and slot machines." A casino floor
   is not only slots: blackjack in one pit, craps in the other, the
   dealers inside, the players out, and a net slung over each.
   ============================================================ */
function buildPits(scene, box, mat, spots) {
  spots.fixed = spots.fixed || [];
  const felt = mat({ color: 0x0f5a2c, roughness: 0.9 });
  const rim = mat({ color: 0x1a0c08, roughness: 0.5 });
  const wood = mat({ color: 0x4a2412, roughness: 0.4, metalness: 0.2 });
  const chipCols = [0xc8201a, 0x1a4ac8, 0xf0ece0, 0x1a1a1a, 0x2a9a3a];
  const chipGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10);
  const chipMats = chipCols.map((c) => mat({ color: c, roughness: 0.5 }));
  const stoolMat = mat({ color: 0x6a1420, roughness: 0.6 });
  // the six you can sit down at: the middle stool of each is kept for you
  const tables = [];

  // east: blackjack, three and three, dealers facing the pit
  [13, 19, 25].forEach((x) => {
    [-1, 1].forEach((side) => {
      const z = side * 3.4;
      // the half-moon: its arc bulges away from the pit, toward the players
      const t0 = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.75, 24, 1, false, t0, Math.PI), wood);
      body.position.set(x, 0.375, z); scene.add(body);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 0.08, 24, 1, false, t0, Math.PI), rim);
      rail.position.set(x, 0.79, z); scene.add(rail);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.16, 0.02, 24, 1, false, t0, Math.PI), felt);
      top.position.set(x, 0.84, z); scene.add(top);
      box(x, z + side * 0.62, 1.32, 0.66);
      for (let c = 0; c < 4; c++) {
        const chip = new THREE.Mesh(chipGeo, chipMats[(c + x) % 5]);
        chip.position.set(x - 0.45 + c * 0.3, 0.9, z + side * 0.15);
        scene.add(chip);
      }
      // the dealer, on the pit side of the flat edge
      spots.fixed.push({ kind: 'stand', x, z: z - side * 0.55, ry: side > 0 ? 0 : Math.PI });
      // and three players on stools round the arc
      [-0.9, 0, 0.9].forEach((a) => {
        const px = x + Math.sin(a) * 1.75, pz = z + side * Math.cos(a) * 1.75;
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10), stoolMat);
        st.position.set(px, 0.72, pz); scene.add(st);
        if (a !== 0) spots.fixed.push({ kind: 'sit', x: px, z: pz, ry: Math.atan2(x - px, z - pz) });
      });
      // looking across the felt at the dealer: -Z from the +Z side
      tables.push({ x, z, side, seat: { x, z: z + side * 1.75 }, yaw: side > 0 ? 0 : Math.PI });
    });
  });

  // west: craps, two tables with the crew along one side
  [-14.5, -24.5].forEach((x) => {
    const tb = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.8, 1.9), wood);
    tb.position.set(x, 0.4, 0); scene.add(tb);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.04, 1.5), felt);
    bed.position.set(x, 0.72, 0); scene.add(bed);
    [[0, 0.9, 4.4, 0.1], [0, -0.9, 4.4, 0.1], [2.15, 0, 0.1, 1.9], [-2.15, 0, 0.1, 1.9]].forEach(([dx, dz, w, d]) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), rim);
      r.position.set(x + dx, 0.95, dz); scene.add(r);
    });
    box(x, 0, 2.3, 1.05);
    spots.fixed.push({ kind: 'stand', x, z: -1.55, ry: 0 },              // the boxman's side
                     { kind: 'stand', x: x - 1.2, z: -1.55, ry: 0 },
                     { kind: 'stand', x: x + 0.3, z: 1.6, ry: Math.PI },  // players, shooting
                     { kind: 'stand', x: x + 1.6, z: 1.55, ry: Math.PI },
                     { kind: 'stand', x: x - 2.9, z: 0.4, ry: Math.PI / 2 });
  });

  // a net slung over each pit, hung off cables from the rig
  const netTex = canvasTex(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(170,160,130,0.38)'; g.lineWidth = 1.5;
    for (let i = 0; i <= 64; i += 16) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
    }
  }, [16, 6]);
  const cableMat = mat({ color: 0x888888, roughness: 0.5, metalness: 0.8 });
  [[19, 0, 17, 10], [-19.5, 0, 13, 6]].forEach(([x, z, w, d]) => {
    const net = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 20, 8),
      new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    net.rotation.x = -Math.PI / 2;
    net.position.set(x, 5.4, z);
    const pos = net.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / w + 0.5, v = pos.getY(i) / d + 0.5;
      pos.setZ(i, -0.9 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI));
    }
    scene.add(net);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 9, 4), cableMat);
      c.position.set(x + sx * w / 2, 5.4 + 4.5, z + sz * d / 2);
      scene.add(c);
    });
  });
  return tables;
}

/* ============================================================
   THE LOBBY CARPET, and the walls it climbs.

   The film's own direction for this room: "vegetal paisley patterns on
   the carpet which are shifting, undulating. The carpet patterns are
   inexorably creeping up the walls." So the lobby is not the casino's
   medallion carpet -- it is paisley on a maroon ground with vines between
   the motifs, and the walls are flocked wallpaper over a wood dado.

   Sober, every term below is still: the carpet is carpet and the wall is
   a wall. uPsych is the only thing that moves the vines, and it is the
   only thing that sends the carpet up the walls.
   ============================================================ */
const PAISLEY_GLSL = /* glsl */ `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
}
vec3 paisley(vec2 wp, float t, float grow){
  const vec3 GROUND = vec3(0.20, 0.035, 0.045);
  const vec3 ORANGE = vec3(0.78, 0.36, 0.09);
  const vec3 GOLD   = vec3(0.86, 0.62, 0.22);
  const vec3 RED    = vec3(0.62, 0.08, 0.07);
  const vec3 TEAL   = vec3(0.07, 0.40, 0.40);
  const vec3 GREEN  = vec3(0.18, 0.40, 0.16);
  // a hotel carpet repeat is well under a metre; at 1.4 the motifs read
  // as dinner plates and the vines as hosepipes
  const float TILE = 0.9;
  vec2 cell = floor(wp / TILE);
  vec2 g = fract(wp / TILE) - 0.5;
  // alternate motifs turn round, which is how a paisley repeat is laid
  float flip = mod(cell.x + cell.y, 2.0) * 2.0 - 1.0;
  g *= flip;
  vec2 q = g * 2.3;
  // the teardrop's tail curls over -- and, on something, keeps curling
  q.x += (0.38 + 0.30 * grow * sin(t * 0.7 + cell.x * 1.3 + cell.y)) * q.y * q.y - 0.1;
  float taper = 1.0 - 0.62 * smoothstep(-0.35, 0.95, q.y);
  float d = length(vec2(q.x, q.y * 0.78)) - 0.46 * taper * (1.0 + 0.10 * grow * sin(t + cell.y));
  vec3 col = GROUND;
  col = mix(col, ORANGE, smoothstep(0.02, -0.02, d));
  col = mix(col, GOLD, smoothstep(0.03, 0.0, abs(d + 0.10)) * step(d, 0.0));
  col = mix(col, RED, smoothstep(-0.18, -0.22, d));
  float eye = length(q - vec2(0.02, -0.2)) - 0.09;
  col = mix(col, TEAL, smoothstep(0.015, -0.015, eye));
  float ang = atan(q.y, q.x);
  col = mix(col, GOLD, smoothstep(0.035, 0.0, abs(d - 0.07)) * step(0.5, fract(ang * 4.0)) * 0.8);
  // the vines between the motifs: stems, and leaves along them
  vec2 v = wp / TILE;
  float wave = 0.12 * sin(v.x * 6.283 + t * 0.9 * grow);
  float stem = abs(fract(v.y + 0.5 + wave) - 0.5);
  col = mix(col, GREEN, smoothstep(0.022, 0.0, stem) * step(0.12, d));
  vec2 lq = fract(v * vec2(2.0, 1.0) + vec2(0.25, 0.5 + wave)) - 0.5;
  float leaf = length(lq * vec2(1.0, 3.2)) - 0.12 * (1.0 + 0.5 * grow);
  // and a small gold sprig in the empty ground between everything else
  vec2 sq = fract(v + 0.5) - 0.5;
  float sprig = length(sq) - 0.045;
  col = mix(col, GOLD * 0.85, smoothstep(0.012, -0.012, sprig) * step(0.18, d));
  col = mix(col, GREEN * 1.35, smoothstep(0.02, -0.02, leaf) * step(0.1, d));
  col *= 0.86 + 0.28 * vn(wp * 40.0);
  return col;
}
vec3 lampLight(vec3 wpos, vec3 n){
  vec3 lit = vec3(0.07, 0.05, 0.045);
  for (int i = 0; i < LAMP_COUNT; i++){
    vec3 d = uLampPos[i] - wpos;
    float ndl = n.y > 0.9 ? 1.0 : max(0.15, dot(normalize(d), n));
    lit += uLampCol[i] * ndl / (1.0 + dot(d, d) * 0.020);
  }
  return lit;
}`;

const LOBBY_VS = /* glsl */ `
varying vec3 vWorld;
varying vec3 vN;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const LOBBY_FLOOR_FS = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vN;
uniform float uTime, uPsych;
uniform vec3 uLampPos[LAMP_COUNT];
uniform vec3 uLampCol[LAMP_COUNT];
${PAISLEY_GLSL}
void main(){
  if (vWorld.z > -30.0) discard;          // the casino's carpet from here on
  vec2 wp = vWorld.xz;
  float t = uTime * uPsych;
  // undulating: the whole weave swells like something breathing under it
  if (uPsych > 0.001) wp += vec2(sin(wp.y * 0.8 + t), cos(wp.x * 0.7 - t * 0.8)) * 0.30 * uPsych;
  vec3 col = paisley(wp, uTime, uPsych);
  // far away the weave is finer than a pixel, and a pattern that fine
  // shimmers as you walk: fade it toward the carpet's own average instead
  float far = clamp(length(fwidth(vWorld.xz)) * 9.0 - 0.15, 0.0, 1.0);
  col = mix(col, vec3(0.36, 0.11, 0.07), far * 0.75);
  gl_FragColor = vec4(col * lampLight(vWorld, vec3(0.0, 1.0, 0.0)), 1.0);
}`;

const LOBBY_WALL_FS = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vN;
uniform float uTime, uPsych;
uniform vec3 uLampPos[LAMP_COUNT];
uniform vec3 uLampCol[LAMP_COUNT];
${PAISLEY_GLSL}
void main(){
  // run along whichever way the wall runs
  float u = abs(vN.x) > 0.5 ? vWorld.z : vWorld.x;
  float y = vWorld.y;
  // flocked damask over a wood dado, which is a 1971 hotel lobby
  vec3 col;
  if (y < 1.05) {
    col = vec3(0.16, 0.08, 0.04) * (0.8 + 0.3 * vn(vec2(u * 0.6, y * 18.0)));
    col = mix(col, vec3(0.5, 0.36, 0.14), smoothstep(0.03, 0.0, abs(y - 1.0)));
  } else {
    vec2 dm = vec2(u * 1.4, y * 1.1);
    vec2 f = fract(dm) - 0.5;
    float diamond = abs(f.x) + abs(f.y * 0.8);
    float motif = smoothstep(0.30, 0.26, diamond) - smoothstep(0.20, 0.16, diamond)
      + smoothstep(0.08, 0.05, length(f));
    col = mix(vec3(0.30, 0.06, 0.07), vec3(0.62, 0.42, 0.16), clamp(motif, 0.0, 1.0) * 0.55);
    col *= 0.9 + 0.2 * vn(dm * 7.0);
  }
  // the carpet coming up the wall. Nothing here unless uPsych is up.
  if (uPsych > 0.001) {
    float t = uTime * 0.8;
    float reach = uPsych * (1.2 + 4.2 * uPsych);
    float edge = reach + 0.35 * sin(u * 2.1 + t) + 0.22 * sin(u * 5.3 - t * 1.3);
    float body = smoothstep(edge + 0.06, edge - 0.06, y);
    // tendrils running on ahead of it
    float tx = abs(fract(u * 1.3 + 0.08 * sin(y * 3.0 + t)) - 0.5);
    float tendril = smoothstep(0.05, 0.0, tx) * step(edge, y)
      * smoothstep(edge + 1.0 * uPsych, edge, y);
    vec3 carpet = paisley(vec2(u, y), uTime, uPsych);
    col = mix(col, carpet, max(body, tendril * 0.9));
  }
  gl_FragColor = vec4(col * lampLight(vWorld, normalize(vN)), 1.0);
}`;

/* ------------------------------------------------ the carpet */
const CARPET_VS = /* glsl */ `
varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const CARPET_FS = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform float uTime, uWreck;
uniform vec3 uA, uB, uC, uD;
uniform vec3 uPlayer;
uniform vec3 uLampPos[LAMP_COUNT];
uniform vec3 uLampCol[LAMP_COUNT];

float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), f.x),
             mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++){ v += a*vnoise(p); p *= 2.03; a *= 0.5; }
  return v;
}

/* A casino carpet is a PATTERN ON A REPEAT, not a cloud of noise. The old
   one was domain-warped FBM, which is why it read as lava rather than
   floor covering. Real Vegas carpet is a dark ground carrying a medallion
   motif on a two-and-a-half metre repeat, with a lattice joining one
   medallion to the next and a border boxing each tile -- loud on purpose,
   because a busy pattern hides everything a casino floor goes through in
   a night. It is also completely STILL. Nothing here moves until a drug
   moves it. */
float ringBand(float r, float c, float w){
  return smoothstep(w, 0.0, abs(r - c));
}

void main(){
  // The round carpet reaches seven metres into the lobby, at exactly the
  // lobby floor's height. While both were the same material nobody could
  // tell; with the lobby's paisley they fought, pixel by pixel, in a
  // ragged band. The seam is the lobby mouth, and each side owns its half.
  if (vWorld.z < -30.0) discard;
  // the weave is nailed down. uWreck is the only thing that lifts it.
  float t = uTime * 0.5 * uWreck;

  vec2 wp = vWorld.xz;
  if (uWreck > 0.001){
    // under a hallucinogen the pattern starts to crawl over itself
    wp += vec2(sin(wp.y * 0.55 + t), cos(wp.x * 0.55 - t)) * 0.40 * uWreck;
  }

  const float TILE = 2.5;
  vec2 g = fract(wp / TILE) - 0.5;
  float r = length(g);
  float ang = atan(g.y, g.x);

  vec3 col = uA;                                        // the ground

  /* ---- the medallion ---------------------------------------------- */
  float petal = 0.5 + 0.5 * cos(ang * 8.0);             // eight lobes
  float lobe  = 0.170 + 0.080 * petal;
  col = mix(col, uB, smoothstep(lobe, lobe - 0.018, r));
  col = mix(col, uC, ringBand(r, 0.148, 0.015));        // gold ring
  col = mix(col, uA, smoothstep(0.074, 0.060, r));      // dark eye
  col = mix(col, uD, smoothstep(0.042, 0.030, r));      // and a jewel in it

  /* ---- a rosette on every corner ------------------------------------
     Tiling puts a quarter of this in each corner of the tile, so the
     four quarters meet up and read as a second, offset field of motifs
     between the medallions -- which is how a real repeat is built. */
  vec2 cg = abs(g) - 0.5;
  float cr = length(cg);
  float cpetal = 0.5 + 0.5 * cos(atan(cg.y, cg.x) * 6.0);
  float clobe = 0.105 + 0.045 * cpetal;
  col = mix(col, uD, smoothstep(clobe, clobe - 0.015, cr) * 0.85);
  col = mix(col, uC, ringBand(cr, 0.132, 0.011));

  /* ---- scrollwork on the diagonals ----------------------------------
     NO straight orthogonal bars and NO tile border. Those drew a square
     grid over the whole floor and the thing read as tiling with grout
     rather than as carpet -- a woven repeat has no seams in it. */
  float diag = abs(abs(g.x) - abs(g.y));
  float wob  = 0.022 + 0.012 * sin((g.x + g.y) * 18.0);
  float scroll = smoothstep(wob, wob * 0.35, diag)
               * step(0.245, r) * step(0.175, cr);
  col = mix(col, uC, scroll * 0.55);

  /* ---- wool: fibre is never a flat colour, and it wears in patches -- */
  col *= 0.87 + 0.26 * vnoise(wp * 34.0);
  col *= 0.93 + 0.14 * vnoise(wp * 2.7);

  vec3 lit = vec3(0.045);
  for (int i = 0; i < LAMP_COUNT; i++){
    vec3 d = uLampPos[i] - vWorld;
    lit += uLampCol[i] / (1.0 + dot(d, d) * 0.020);
  }
  float pd = distance(vWorld.xz, uPlayer.xz);
  lit += vec3(0.30, 0.15, 0.06) * exp(-pd*pd*0.055);

  col *= lit;
  gl_FragColor = vec4(col, 1.0);
}`;

/* ------------------------------------------------- textures */
function neonTexture(text, color = '#ff2d1f') {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = '180px "Bebas Neue", Impact, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 55;
  g.fillStyle = color;
  for (let i = 0; i < 3; i++) g.fillText(text, 512, 134);
  g.shadowBlur = 0;
  g.fillStyle = '#fff5e6';
  g.fillText(text, 512, 134);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** the tent: vertical stripes in u become radial stripes on a dome */
function bigTopTexture() {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d');
  const stripes = 32;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? '#55212c' : '#7a1020';
    g.fillRect((i * cv.width) / stripes, 0, cv.width / stripes + 1, cv.height);
  }
  // v = 1 is the apex; brighten it, because that is where the rig hangs
  const grad = g.createLinearGradient(0, 0, 0, cv.height);
  grad.addColorStop(0, 'rgba(255,200,150,0.55)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.75)');
  g.fillStyle = grad;
  g.fillRect(0, 0, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* The whole front of a 1970 upright, drawn to one canvas: the reel
   window with three cream reels of fruit behind it and the payline across,
   the pay table on black glass, the painted belly glass with the machine's
   name, and the coin tray. Eight of these are shared round the floor, and
   rollScreen() spins the reels on whichever one somebody pulls. */
const SLOT_NAMES = ['BIG TOP', 'HIGH WIRE', 'RINGMASTER', 'LION TAMER', 'JACKPOT', 'TRIPLE BAR', 'GOLD RUSH', 'CLOWN MONEY'];
const SLOT_COLS = ['#c8141e', '#1a6ac8', '#c89014', '#6a1ac8', '#c81a78', '#14a078', '#c86414', '#2a2ac8'];
function slotScreenTexture(i = 0) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 192;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.design = i % SLOT_NAMES.length;
  return tex;
}

function rollScreen(tex) {
  const g = tex.image.getContext('2d');
  const d = tex.userData.design || 0, col = SLOT_COLS[d];
  // chrome all round
  const chrome = g.createLinearGradient(0, 0, 128, 0);
  chrome.addColorStop(0, '#6a6a70'); chrome.addColorStop(0.5, '#e8e8ee'); chrome.addColorStop(1, '#6a6a70');
  g.fillStyle = chrome; g.fillRect(0, 0, 128, 192);

  // the reel window
  g.fillStyle = '#0a0606'; g.fillRect(8, 8, 112, 62);
  const SYM = ['cherry', 'bell', 'bar', 'plum', 'orange', 'seven', 'lemon'];
  for (let r = 0; r < 3; r++) {
    const rx = 12 + r * 36;
    const grad = g.createLinearGradient(0, 10, 0, 68);
    grad.addColorStop(0, '#8a8274'); grad.addColorStop(0.5, '#f4eedc'); grad.addColorStop(1, '#8a8274');
    g.fillStyle = grad; g.fillRect(rx, 11, 32, 56);
    for (let k = 0; k < 3; k++) {
      const kind = SYM[(Math.random() * SYM.length) | 0];
      const cx = rx + 16, cy = 20 + k * 19;
      if (kind === 'cherry') {
        g.strokeStyle = '#2a6a1a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 4, cy + 2); g.lineTo(cx + 2, cy - 7); g.lineTo(cx + 5, cy + 2); g.stroke();
        g.fillStyle = '#c8101a'; g.beginPath(); g.arc(cx - 4, cy + 3, 4, 0, 7); g.arc(cx + 5, cy + 3, 4, 0, 7); g.fill();
      } else if (kind === 'bell') {
        g.fillStyle = '#d8a018'; g.beginPath(); g.moveTo(cx - 7, cy + 5); g.quadraticCurveTo(cx - 6, cy - 8, cx, cy - 8);
        g.quadraticCurveTo(cx + 6, cy - 8, cx + 7, cy + 5); g.fill();
      } else if (kind === 'bar') {
        g.fillStyle = '#141010'; g.fillRect(cx - 11, cy - 5, 22, 10);
        g.fillStyle = '#f4eedc'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText('BAR', cx, cy + 3);
      } else if (kind === 'plum') {
        g.fillStyle = '#5a1a7a'; g.beginPath(); g.ellipse(cx, cy, 6, 7, 0, 0, 7); g.fill();
      } else if (kind === 'orange') {
        g.fillStyle = '#e87814'; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.fill();
      } else if (kind === 'lemon') {
        g.fillStyle = '#e8d828'; g.beginPath(); g.ellipse(cx, cy, 8, 5.5, 0, 0, 7); g.fill();
      } else {
        g.fillStyle = '#c8101a'; g.font = 'bold 17px Georgia, serif'; g.textAlign = 'center'; g.fillText('7', cx, cy + 6);
      }
    }
  }
  g.strokeStyle = '#e8101a'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(8, 39); g.lineTo(120, 39); g.stroke();

  // the pay table
  g.fillStyle = '#0c0808'; g.fillRect(10, 76, 108, 40);
  g.fillStyle = '#e8c860'; g.font = 'bold 8px sans-serif'; g.textAlign = 'left';
  [['7  7  7', '200'], ['BAR BAR BAR', '50'], ['BELL BELL BELL', '18'], ['CHERRY', '2']].forEach(([a, b], k) => {
    g.fillText(a, 14, 86 + k * 9); g.textAlign = 'right'; g.fillText(b, 114, 86 + k * 9); g.textAlign = 'left';
  });

  // the belly glass, with the machine's name on it
  g.fillStyle = col; g.fillRect(8, 122, 112, 44);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(8 + k * 24, 122); g.lineTo(20 + k * 24, 122); g.lineTo(8 + k * 24 - 10, 166); g.lineTo(8 + k * 24 - 22, 166); g.fill(); }
  g.fillStyle = '#fff4d8'; g.textAlign = 'center'; g.font = 'bold 15px Georgia, serif';
  g.fillText(SLOT_NAMES[d], 64, 149);
  g.strokeStyle = '#f0d070'; g.lineWidth = 2; g.strokeRect(10, 124, 108, 40);

  // the coin tray
  g.fillStyle = '#1a1414'; g.fillRect(24, 172, 80, 16);
  g.fillStyle = '#c8a048'; g.fillRect(30, 180, 3, 3); g.fillRect(40, 182, 3, 3);

  tex.needsUpdate = true;
}

// One material per LOOK, not per call. Every mat({...}) used to mint a new
// material, so two identical brass rails were two materials -- which is two
// shaders' worth of state changes and two batches that can never merge.
// Only plain value parameters are keyed; anything holding a texture gets
// its own material, as before.
const matCache = new Map();
const sharedMat = (o) => {
  const plain = Object.values(o).every((v) => v === null || typeof v !== 'object');
  if (!plain) return new THREE.MeshStandardMaterial(o);
  const key = JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial(o); matCache.set(key, m); }
  return m;
};

/* A bar stool: chrome pedestal, foot ring, red vinyl seat, its top at
   0.78 m where the crowd's seated hips are. The old one was a drum. */
const STOOL = {};
function addStool(parent, x, z) {
  if (!STOOL.chrome) {
    STOOL.chrome = sharedMat({ color: 0xb8b8c0, roughness: 0.2, metalness: 0.95 });
    STOOL.vinyl = sharedMat({ color: 0x8a1018, roughness: 0.45, metalness: 0.05 });
    // hundreds of these on the floor: kept to as few faces as still look round
    STOOL.base = new THREE.CylinderGeometry(0.19, 0.22, 0.03, 8, 1, true);
    STOOL.post = new THREE.CylinderGeometry(0.035, 0.035, 0.66, 5, 1, true);
    STOOL.ring = new THREE.TorusGeometry(0.16, 0.012, 3, 7);
    STOOL.seat = new THREE.CylinderGeometry(0.21, 0.19, 0.1, 12);
  }
  const put = (geo, m, y, flat) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    if (flat) o.rotation.x = Math.PI / 2;
    parent.add(o);
  };
  put(STOOL.base, STOOL.chrome, 0.015);
  put(STOOL.post, STOOL.chrome, 0.36);
  put(STOOL.ring, STOOL.chrome, 0.3, true);
  put(STOOL.seat, STOOL.vinyl, 0.73);
}

/* A carousel horse, mid-leap, as ONE geometry with its colours in the
   vertices -- white body, gilt mane and tail, a red saddle -- so the whole
   herd is a single draw that can bob up and down on its poles. Faces +Z,
   and the pole runs through the saddle at the origin. */
function horseGeometry() {
  const parts = [];
  const WHITE = 0xf2eadc, GILT = 0xd0a040, RED = 0x9a1420, DARK = 0x1a1210;
  const part = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    parts.push({ geo: geo.index ? geo.toNonIndexed() : geo, m, color: new THREE.Color(color) });
  };
  part(new THREE.CapsuleGeometry(0.17, 0.55, 2, 8), WHITE, 0, 0, 0, Math.PI / 2, 0, 0, 0.82, 1, 1);   // body
  part(new THREE.CapsuleGeometry(0.1, 0.34, 2, 6), WHITE, 0, 0.22, 0.4, 0.75);                       // neck, up and forward
  part(new THREE.BoxGeometry(0.13, 0.15, 0.36), WHITE, 0, 0.45, 0.7, 0.55);                          // head
  part(new THREE.BoxGeometry(0.04, 0.46, 0.08), GILT, 0, 0.28, 0.33, 0.75);                          // mane
  [-1, 1].forEach((sd) => {
    part(new THREE.ConeGeometry(0.03, 0.09, 4), WHITE, sd * 0.045, 0.58, 0.58, -0.3);                 // ears
    part(new THREE.CapsuleGeometry(0.04, 0.34, 1, 5), WHITE, sd * 0.09, -0.08, 0.3, -1.1);           // forelegs, tucked
    part(new THREE.CapsuleGeometry(0.04, 0.4, 1, 5), WHITE, sd * 0.09, -0.26, -0.3, 0.45);           // hind legs, reaching
    part(new THREE.OctahedronGeometry(0.035, 0), DARK, sd * 0.09, -0.16, 0.5);                        // hooves
    part(new THREE.OctahedronGeometry(0.035, 0), DARK, sd * 0.09, -0.46, -0.4);
  });
  part(new THREE.ConeGeometry(0.07, 0.42, 6), GILT, 0, -0.02, -0.5, -2.2);                           // tail
  part(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 8, 1, false, -Math.PI / 2, Math.PI), RED, 0, 0.16, 0, 0, 0, Math.PI / 2, 1, 1, 1.4); // saddle
  part(new THREE.BoxGeometry(0.4, 0.03, 0.3), GILT, 0, 0.13, 0);                                     // blanket
  part(new THREE.BoxGeometry(0.15, 0.03, 0.06), RED, 0, 0.42, 0.78, 0.55);                           // bridle

  let n = 0;
  parts.forEach((p) => { n += p.geo.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let o = 0;
  parts.forEach(({ geo, m, color }) => {
    const P = geo.attributes.position, N = geo.attributes.normal;
    nm.getNormalMatrix(m);
    for (let i = 0; i < P.count; i++, o++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.set([v.x, v.y, v.z], o * 3);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], o * 3);
      col.set([color.r, color.g, color.b], o * 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/* ============================================================ */
export function buildWorld(parent) {
  // Everything the casino builds goes into ONE group, so the whole floor
  // can be switched off in a single call when the lift takes you upstairs.
  // The local name stays scene, so every add below is unchanged.
  const scene = new THREE.Group();
  parent.add(scene);

  const colliders = [];
  const box = (x, z, hw, hd) => colliders.push({ x, z, hw, hd });
  const keepOut = (x, z, r) => colliders.push({ circle: true, x, z, r });
  const mat = sharedMat;

  const spots = { slotSeats: [], barSpots: [], midway: [], standing: [], paths: [] };

  /* ---------------------------------------------- lighting */
  scene.add(new THREE.AmbientLight(0x2a1a14, 1.1));
  scene.add(new THREE.HemisphereLight(0x552211, 0x080404, 0.6));

  // pooled: lit by the light pool in main.js that follows you from area to
  // area, not by a light of its own. The carpet shader still knows where
  // every lamp is, so the floor's own glow is unchanged.
  const lamps = [
    [0, 7.0, 0, 0xffb400, 520, 0],                // over the merry-go-round
    [-13, 6.6, -44, 0xff9a20, 420, 'pooled'],     // registration
    [-24, 5.4, -6, 0xff2d1f, 360, 0],             // the floor, west
    [24, 5.4, 6, 0x12e2e2, 360, 0],               // the floor, east
    [0, 5.6, 26, 0xa03cff, 320, 0],               // the floor, south
    [0, 5.4, 44, 0xb6ff2e, 400, 'pooled'],        // elevator corridor
  ];
  const lampObjs = lamps.filter((l) => l[5] !== 'pooled').map(([x, y, z, c, i]) => {
    const L = new THREE.PointLight(c, i, 0, 2);
    L.position.set(x, y, z);
    scene.add(L);
    return { L, base: i };
  });
  const lampPos = lamps.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const lampCol = lamps.map(([, , , c, i]) => new THREE.Color(c).multiplyScalar(i / 300));

  scene.fog = new THREE.FogExp2(0x100604, 0.017);

  /* ------------------------------------------------ carpet */
  const carpetUni = {
    uTime: { value: 0 }, uWreck: { value: 0 },
    uA: { value: new THREE.Color(C.carpetA) },
    uB: { value: new THREE.Color(C.carpetB) },
    uC: { value: new THREE.Color(C.carpetC) },
    uD: { value: new THREE.Color(C.carpetD) },
    uPlayer: { value: new THREE.Vector3() },
    uLampPos: { value: lampPos },
    uLampCol: { value: lampCol },
  };
  const carpetMat = new THREE.ShaderMaterial({
    vertexShader: CARPET_VS, fragmentShader: CARPET_FS,
    uniforms: carpetUni, defines: { LAMP_COUNT },
  });
  const carpet = new THREE.Mesh(new THREE.CircleGeometry(R + 1, 64), carpetMat);
  carpet.rotation.x = -Math.PI / 2;
  scene.add(carpet);

  // the two wings get the same carpet
  // The lobby is its own carpet: the film's paisley, not the casino's
  // medallion. It stops at the front wall; past it is the pavement.
  const lobbyUni = {
    uTime: { value: 0 }, uPsych: { value: 0 },
    uLampPos: { value: lampPos }, uLampCol: { value: lampCol },
  };
  const lobbyFloorMat = new THREE.ShaderMaterial({
    vertexShader: LOBBY_VS, fragmentShader: LOBBY_FLOOR_FS,
    uniforms: lobbyUni, defines: { LAMP_COUNT },
  });
  const lobbyWallMat = new THREE.ShaderMaterial({
    vertexShader: LOBBY_VS, fragmentShader: LOBBY_WALL_FS,
    uniforms: lobbyUni, defines: { LAMP_COUNT },
  });
  const lobbyFloor = new THREE.Mesh(new THREE.PlaneGeometry(42, 27), lobbyFloorMat);
  lobbyFloor.rotation.x = -Math.PI / 2;
  lobbyFloor.position.set(0, 0, -42.5);
  scene.add(lobbyFloor);

  const corrFloor = new THREE.Mesh(new THREE.PlaneGeometry(28, 26), carpetMat);
  corrFloor.rotation.x = -Math.PI / 2;
  corrFloor.position.set(0, 0, 43);
  scene.add(corrFloor);

  /* ============================= THE BIG TOP (the dome) */
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: bigTopTexture(), side: THREE.BackSide })
  );
  dome.scale.y = (DOME_APEX - DOME_SPRING) / R;
  dome.position.y = DOME_SPRING;
  scene.add(dome);

  // the wall under the dome, built as arc segments so the two
  // mouths (lobby to the north, elevators to the south) stay open
  const wallMat = mat({ color: 0x2a1e1a, roughness: 0.9, metalness: 0.1 });
  const SEGS = 32;
  const segGeo = new THREE.BoxGeometry((2 * Math.PI * R) / SEGS + 0.4, DOME_SPRING, 1.0);
  const NORTH_MOUTH = 0.60;   // half-angle, radians
  const SOUTH_MOUTH = 0.38;
  for (let i = 0; i < SEGS; i++) {
    const a = (i / SEGS) * Math.PI * 2;
    const northish = Math.abs(Math.abs(a - Math.PI) - 0) < NORTH_MOUTH;   // a near PI => -z
    const southish = Math.min(a, Math.PI * 2 - a) < SOUTH_MOUTH;          // a near 0 => +z
    if (northish || southish) continue;
    const m = new THREE.Mesh(segGeo, wallMat);
    m.position.set(Math.sin(a) * R, DOME_SPRING / 2, Math.cos(a) * R);
    m.rotation.y = a;
    scene.add(m);
  }

  /* =============== THE MERRY-GO-ROUND BAR, dead centre */
  const carousel = new THREE.Group();
  carousel.userData.rigid = true;     // turns as one piece: batched inside itself
  scene.add(carousel);
  keepOut(0, 0, CAROUSEL_R + 0.1);

  /* An antique circus carousel with a bar built into it, which is what the
     real one was: the counter where the horses' platform would be, a back
     bar round the centre pole, and the whole top of the ride -- canopy,
     painted rounding board, scalloped fringe, a thousand bulbs -- still on
     it. The horses stayed too, on their brass poles between the stools,
     going up and down as it turns. Sized to people: the bar top at 1.1 m
     and 0.8 m deep, stools at 0.78, the rim of the canopy at 3 m. */
  const BAR_TOP = 1.1, BAR_IN = 5.65;           // the counter runs BAR_IN..CAROUSEL_R
  const RIM = 7.75, RIM_Y = 3.0;                // the canopy's edge, and its underside
  const brass = mat({ color: 0xc9a048, roughness: 0.25, metalness: 0.9 });
  const cAdd = (geo, m, x, y, z, ry = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z); o.rotation.y = ry;
    carousel.add(o);
    return o;
  };

  // the turntable: the ring of floor the stools stand on, which goes round
  const deckTex = canvasTex(1024, 32, (g, w, h) => {
    for (let i = 0; i < 96; i++) {
      g.fillStyle = ['#3a1a0e', '#452212', '#3e1e10'][i % 3];
      g.fillRect((i * w) / 96, 0, w / 96 + 1, h);
      g.fillStyle = '#140804'; g.fillRect((i * w) / 96, 0, 1.5, h);
    }
  });
  {
    const deck = cAdd(new THREE.RingGeometry(CAROUSEL_R, RIM + 0.35, 72, 1),
      new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.45, metalness: 0.15 }), 0, 0.012, 0);
    deck.rotation.x = -Math.PI / 2;
    // a RingGeometry's uvs are planar; wrap them round so the planks run radially
    const P = deck.geometry.attributes.position, U = deck.geometry.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i);
      U.setXY(i, (Math.atan2(y, x) / (Math.PI * 2) + 1) % 1, (Math.hypot(x, y) - CAROUSEL_R) / (RIM + 0.35 - CAROUSEL_R));
    }
    const edge = cAdd(new THREE.TorusGeometry(RIM + 0.35, 0.035, 6, 96), brass, 0, 0.03, 0);
    edge.rotation.x = Math.PI / 2;
  }

  // ---- the counter: red lacquer and gilt panels with little round mirrors
  const barFront = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#4a0c10'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x = i * 128;
      g.fillStyle = '#7a1418'; g.fillRect(x + 10, 12, 108, h - 30);
      g.strokeStyle = '#c9a048'; g.lineWidth = 4; g.strokeRect(x + 14, 16, 100, h - 38);
      const mg = g.createRadialGradient(x + 64, 56, 2, x + 64, 56, 22);
      mg.addColorStop(0, '#c8d4dc'); mg.addColorStop(1, '#4a5660');
      g.fillStyle = mg; g.beginPath(); g.arc(x + 64, 56, 20, 0, 7); g.fill();
      g.strokeStyle = '#e0bc60'; g.lineWidth = 3; g.stroke();
    }
    g.fillStyle = '#0a0404'; g.fillRect(0, h - 14, w, 14);
  }, [16, 1]);
  cAdd(new THREE.CylinderGeometry(CAROUSEL_R, CAROUSEL_R, BAR_TOP - 0.04, 72, 1, true),
    new THREE.MeshStandardMaterial({ map: barFront, roughness: 0.5, metalness: 0.2 }), 0, (BAR_TOP - 0.04) / 2, 0);
  cAdd(new THREE.CylinderGeometry(BAR_IN, BAR_IN, BAR_TOP - 0.04, 48, 1, true),
    mat({ color: 0x2a0a08, roughness: 0.6 }), 0, (BAR_TOP - 0.04) / 2, 0);
  {
    const top = cAdd(new THREE.RingGeometry(BAR_IN - 0.05, CAROUSEL_R + 0.12, 72),
      mat({ color: 0x1a0806, roughness: 0.15, metalness: 0.5 }), 0, BAR_TOP, 0);
    top.rotation.x = -Math.PI / 2;
    // the padded leather roll you lean your elbows on
    const roll = cAdd(new THREE.TorusGeometry(CAROUSEL_R + 0.1, 0.075, 8, 96),
      mat({ color: 0x5a0e12, roughness: 0.55, metalness: 0.05 }), 0, BAR_TOP - 0.03, 0);
    roll.rotation.x = Math.PI / 2;
    const foot = cAdd(new THREE.TorusGeometry(CAROUSEL_R + 0.28, 0.025, 6, 96), brass, 0, 0.24, 0);
    foot.rotation.x = Math.PI / 2;
  }

  // ---- the back bar: a mirrored drum where the ride's engine was, with
  // shelves of bottles round it lit from below
  const drumTex = mirrorTex([10, 3]);
  cAdd(new THREE.CylinderGeometry(1.5, 1.5, RIM_Y + 0.6, 24, 1, true),
    new THREE.MeshStandardMaterial({ map: drumTex, emissiveMap: drumTex, emissive: 0xffffff,
      emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.6 }), 0, (RIM_Y + 0.6) / 2, 0);
  [0.05, 1.05, RIM_Y + 0.55].forEach((y) => cAdd(new THREE.CylinderGeometry(1.58, 1.58, 0.1, 24), brass, 0, y, 0));
  cAdd(new THREE.CylinderGeometry(3.7, 3.7, 1.0, 48, 1, true), mat({ color: 0x3a1a0c, roughness: 0.5 }), 0, 0.5, 0);
  {
    const shelfTop = cAdd(new THREE.RingGeometry(1.5, 3.72, 48), mat({ color: 0x1a0806, roughness: 0.2, metalness: 0.5 }), 0, 1.0, 0);
    shelfTop.rotation.x = -Math.PI / 2;
  }
  const SHELVES = [1.02, 1.5, 1.95];
  SHELVES.slice(1).forEach((y) => {
    const sh = cAdd(new THREE.RingGeometry(2.9, 3.3, 48), mat({ color: 0x3a1a0c, roughness: 0.5, side: THREE.DoubleSide }), 0, y - 0.02, 0);
    sh.rotation.x = -Math.PI / 2;
  });
  const bottleCols = [0xc87a20, 0x2e6a28, 0xd8d0b8, 0x8a2010, 0xe0a030, 0x3a4a6a, 0x6a3a14];
  const PER_SHELF = 56;
  const bottles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.05, 0.3, 7),
    new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.1, emissive: 0x3a2a18 }), PER_SHELF * SHELVES.length);
  {
    const m = new THREE.Matrix4(), c = new THREE.Color();
    let n = 0;
    SHELVES.forEach((y, k) => {
      for (let i = 0; i < PER_SHELF; i++) {
        const a = ((i + k * 0.5) / PER_SHELF) * Math.PI * 2;
        const r = y < 1.2 ? 3.45 : 3.1;
        m.makeScale(1, 0.8 + ((i * 7 + k) % 5) * 0.1, 1);
        m.setPosition(Math.sin(a) * r, y + 0.15, Math.cos(a) * r);
        bottles.setMatrixAt(n, m);
        bottles.setColorAt(n++, c.setHex(bottleCols[(i * 3 + k) % bottleCols.length]));
      }
    });
    bottles.instanceMatrix.needsUpdate = true;
  }
  carousel.add(bottles);

  // ---- the top of the ride
  cAdd(new THREE.ConeGeometry(RIM, 2.3, 48, 1, true),
    new THREE.MeshBasicMaterial({ map: bigTopTexture(), side: THREE.DoubleSide }), 0, RIM_Y + 1.25 + 1.15, 0);
  cAdd(new THREE.SphereGeometry(0.28, 12, 8), brass, 0, RIM_Y + 1.25 + 2.35, 0);
  // the rounding board: painted panels, mirrors and the name, all the way round
  const board = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#f0e2c0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8a1018'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
    g.fillStyle = '#c9a048'; g.fillRect(0, 14, w, 4); g.fillRect(0, h - 18, w, 4);
    const mirror = (x) => {
      const mg = g.createRadialGradient(x, 64, 4, x, 64, 34);
      mg.addColorStop(0, '#dfe8ee'); mg.addColorStop(1, '#56626c');
      g.fillStyle = mg; g.beginPath(); g.ellipse(x, 64, 42, 30, 0, 0, 7); g.fill();
      g.strokeStyle = '#c9a048'; g.lineWidth = 6; g.stroke();
    };
    const star = (x) => {
      g.fillStyle = '#8a1018'; g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 11 : 26;
        g.lineTo(x + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      g.fill();
    };
    mirror(70); star(170); mirror(954); star(854);
    g.fillStyle = '#8a1018'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 58px Georgia, serif';
    g.fillText('MERRY-GO-ROUND  BAR', 512, 68);
    g.strokeStyle = '#c9a048'; g.lineWidth = 1.5; g.strokeText('MERRY-GO-ROUND  BAR', 512, 68);
  }, [4, 1]);
  cAdd(new THREE.CylinderGeometry(RIM, RIM, 0.95, 64, 1, true),
    new THREE.MeshStandardMaterial({ map: board, emissiveMap: board, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.6 }),
    0, RIM_Y + 0.35 + 0.475, 0);
  // the fringe under it: red scallops edged in gold
  const fringe = canvasTex(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      const x = i * 32 + 16;
      g.fillStyle = '#c9a048'; g.beginPath(); g.moveTo(x - 16, 0); g.lineTo(x + 16, 0);
      g.arc(x, 0, 16, 0, Math.PI); g.fill();
      g.fillStyle = i % 2 ? '#8a1018' : '#f0e2c0'; g.beginPath(); g.moveTo(x - 14, 0); g.lineTo(x + 14, 0);
      g.arc(x, 0, 14, 0, Math.PI); g.fill();
    }
  }, [24, 1]);
  cAdd(new THREE.CylinderGeometry(RIM + 0.01, RIM + 0.01, 0.35, 64, 1, true),
    new THREE.MeshStandardMaterial({ map: fringe, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 }),
    0, RIM_Y + 0.175, 0);
  // and the neon they fitted it with in Las Vegas, round the top of the board
  {
    const neon = cAdd(new THREE.TorusGeometry(RIM + 0.04, 0.035, 6, 128), new THREE.MeshBasicMaterial({ color: 0xff4a8a }),
      0, RIM_Y + 1.33, 0);
    neon.rotation.x = Math.PI / 2;
  }
  // bulbs along the top and bottom of the board
  const BULBS = 72;
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });   // update() makes it flicker
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 6, 4), bulbMat, BULBS * 2);
  {
    const m = new THREE.Matrix4();
    for (let i = 0; i < BULBS * 2; i++) {
      const a = ((i % BULBS) / BULBS) * Math.PI * 2;
      m.makeTranslation(Math.sin(a) * (RIM + 0.06), i < BULBS ? RIM_Y + 0.4 : RIM_Y + 1.25, Math.cos(a) * (RIM + 0.06));
      bulbs.setMatrixAt(i, m);
    }
    bulbs.instanceMatrix.needsUpdate = true;
  }
  carousel.add(bulbs);

  // ---- stools, and the seats the crowd will use
  const CAROUSEL_STOOLS = 14;
  for (let i = 0; i < CAROUSEL_STOOLS; i++) {
    const a = (i / CAROUSEL_STOOLS) * Math.PI * 2;
    addStool(carousel, Math.sin(a) * (CAROUSEL_R + 1.0), Math.cos(a) * (CAROUSEL_R + 1.0));
    // riders go round with the bar, facing in toward the bottles
    spots.barSpots.push({ orbit: { r: CAROUSEL_R + 1.0, a0: a } });
  }

  // ---- the horses, between the stools, on twisted brass poles from the
  // turntable to the canopy
  const poleGeo = new THREE.CylinderGeometry(0.045, 0.045, RIM_Y + 0.02, 8);
  const horses = new THREE.InstancedMesh(horseGeometry(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.4, metalness: 0.15, emissive: 0x201410 }), CAROUSEL_STOOLS);
  const horseAt = [];
  for (let i = 0; i < CAROUSEL_STOOLS; i++) {
    const a = ((i + 0.5) / CAROUSEL_STOOLS) * Math.PI * 2;
    const x = Math.sin(a) * (RIM - 0.25), z = Math.cos(a) * (RIM - 0.25);
    cAdd(poleGeo, brass, x, (RIM_Y + 0.02) / 2, z);
    // nose first round the ride: rotation.y grows, so a point at angle a
    // travels toward a + PI/2
    horseAt.push({ x, z, ry: a + Math.PI / 2, phase: i * 1.7 });
    horses.setColorAt(i, new THREE.Color(i % 3 === 1 ? 0x6a5a50 : i % 3 === 2 ? 0xd8c8a8 : 0xffffff));
  }
  carousel.add(horses);
  const hM = new THREE.Matrix4(), hQ = new THREE.Quaternion(), hP = new THREE.Vector3(), hS = new THREE.Vector3(1, 1, 1);
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const rideHorses = (t) => {
    horseAt.forEach((h, i) => {
      hQ.setFromAxisAngle(Y_AXIS, h.ry);
      // high enough that the lowest hoof at the bottom of the bob clears a
      // standing man's eyes: at head height they swept through the face of
      // anyone at the counter, and filled the screen when you came to here
      hP.set(h.x, 2.4 + Math.sin(t * 1.4 + h.phase) * 0.16, h.z);
      horses.setMatrixAt(i, hM.compose(hP, hQ, hS));
    });
    horses.instanceMatrix.needsUpdate = true;
  };
  rideHorses(0);

  /* ================================ THE TRAPEZE, overhead */
  const rigMat = mat({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.8 });
  const rig = new THREE.Group();
  rig.position.y = 16;
  scene.add(rig);
  [-1, 1].forEach((s) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 30), rigMat);
    beam.position.set(s * 9, 0, 0);
    rig.add(beam);
  });
  const platGeo = new THREE.BoxGeometry(2.4, 0.2, 2.0);
  [-1, 1].forEach((s) => {
    const pl = new THREE.Mesh(platGeo, rigMat);
    pl.position.set(s * 9, -0.6, s * 13);
    rig.add(pl);
  });

  // two performers, each on a swinging bar
  const swingers = [];
  const ropeMat = new THREE.MeshBasicMaterial({ color: 0xd8c090 });
  const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, 6, 5);
  const performerMat = mat({
    color: 0xff2d6a, roughness: 0.4, metalness: 0.2,
    emissive: 0x3a0a1a,
  });
  [-1, 1].forEach((s, i) => {
    const pivot = new THREE.Group();
    pivot.userData.rigid = true;
    pivot.position.set(s * 9, 0, 0);
    rig.add(pivot);

    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.y = -3;
    pivot.add(rope);

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), rigMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = -6;
    pivot.add(bar);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 8), performerMat);
    body.position.y = -6.8;
    pivot.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), performerMat);
    head.position.y = -6.1;
    pivot.add(head);

    swingers.push({ pivot, phase: i * 2.1 });
  });

  /* ============================= THE MIDWAY (mezzanine) */
  const mezzMat = mat({ color: 0x241a18, roughness: 0.85, metalness: 0.1 });
  // its own two-sided copy: the booths share mezzMat and must stay one-sided
  const mezz = new THREE.Mesh(new THREE.RingGeometry(29.5, R, 48),
    mat({ color: 0x241a18, roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide }));
  mezz.rotation.x = -Math.PI / 2;
  mezz.position.y = MEZZ_Y;
  scene.add(mezz);

  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(29.5, 0.07, 6, 72),
    new THREE.MeshBasicMaterial({ color: 0xffd280 }));
  rail.rotation.x = Math.PI / 2;
  rail.position.y = MEZZ_Y + 1.0;
  scene.add(rail);

  // columns holding the midway up, spaced off the spokes
  const colMat = mat({ color: 0x6a4a20, roughness: 0.3, metalness: 0.85 });
  const colGeo = new THREE.CylinderGeometry(0.5, 0.6, MEZZ_Y, 10);
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * Math.PI * 2;
    const c = new THREE.Mesh(colGeo, colMat);
    c.position.set(Math.sin(a) * 29.8, MEZZ_Y / 2, Math.cos(a) * 29.8);
    scene.add(c);
    box(Math.sin(a) * 29.8, Math.cos(a) * 29.8, 0.58, 0.58);
  }

  // carnival booths on the midway, facing in over the rail
  const boothCols = ['#ff2d1f', '#ffb400', '#12e2e2', '#b6ff2e', '#a03cff'];
  const boothNames = ['RING TOSS', 'DARTS', 'HOOPS', 'SHOOT OUT', 'MILK CAN'];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    const bx = Math.sin(a) * 33.4, bz = Math.cos(a) * 33.4;
    const b = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.8, 2.2), mezzMat);
    b.position.set(bx, MEZZ_Y + 1.4, bz);
    b.rotation.y = a;
    scene.add(b);

    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 1.1),
      new THREE.MeshBasicMaterial({
        map: neonTexture(boothNames[i % boothNames.length], boothCols[i % boothCols.length]),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    front.position.set(Math.sin(a) * 31.9, MEZZ_Y + 2.1, Math.cos(a) * 31.9);
    front.rotation.y = a + Math.PI;
    scene.add(front);

    spots.midway.push({ x: Math.sin(a) * 31.2, z: Math.cos(a) * 31.2, ry: a, y: MEZZ_Y });
  }

  /* ======================= THE SLOTS
     Full-size casino cabinets: 66 cm wide, on a base, the lit sign about
     2.1 m up -- a machine you sit down in front of, not a toy on a shelf.
     (The first pass was 1.5 m wide and three metres tall; the second was a
     41 cm antique, a thousand of them, and they read as miniatures.) */
  const SCREEN_POOL = 8;
  const screens = [];
  for (let i = 0; i < SCREEN_POOL; i++) {
    const tex = slotScreenTexture(i);
    rollScreen(tex);
    screens.push({ tex, mat: new THREE.MeshBasicMaterial({ map: tex }), t: Math.random() * 3 });
  }
  const SLOT = { w: 0.66, h: 1.05, d: 0.6, base: 0.72, sign: 0.32 };

  /* Casinos do not lay machines on radial spokes -- that was a diagram, not
     a floor. A real floor is a GRID: banks of machines set back-to-back in
     straight runs, with walking aisles between the banks and cross-aisles
     cutting the long runs so nobody is ever trapped at the far end. The
     grid is then clipped to whatever shape the room happens to be, which
     here is a circle, so the banks get shorter as they approach the wall.
     A lane is left clear on the centre line, because that is the walk from
     the lobby mouth to the bar and on to the elevators. */
  // Three rows of banks each side, seven metres apart: a couple of hundred
  // machines, not a thousand, with room to walk between the stool backs.
  const ROW_Z   = [11.5, 18.5, 25.5];  // mirrored to -Z
  const PITCH   = 0.82;   // machines along a bank
  const BACK    = 0.34;   // bank centre line to a cabinet's centre
  // Cross-aisles every eight metres. With only one pair of them the walk
  // from the lobby to the bar ran head-first into a bank and you slid
  // along it blind for twenty metres, because the banks run east-west and
  // the errands all pull you north-south. Now you are never more than four
  // metres from a way through, which is what a real floor gives you.
  const AISLE_X = [8.0, -8.0, 16.0, -16.0, 24.0, -24.0];
  const machines = [];

  const blocked = (x, z) => {
    const rad = Math.hypot(x, z);
    if (rad > 33.0 || rad < 9.6) return true;             // wall, and the bar
    if (Math.abs(x) < 4.6) return true;                   // the centre walk
    if (AISLE_X.some((ax) => Math.abs(x - ax) < 2.3)) return true;
    if (Math.abs(z) > 25.5 && Math.abs(x) < 7.5) return true;  // the two mouths
    return false;
  };

  const runs = [];                   // each side of each bank, as unbroken runs
  ROW_Z.forEach((rz) => {
    [-1, 1].forEach((zs) => {
      const rowZ = rz * zs;
      [-1, 1].forEach((face) => {
        // face -1 looks toward -Z, face +1 toward +Z; the pair sit
        // back-to-back so each one shows its screen to its own aisle
        const z = rowZ + BACK * face;
        let run = null;
        for (let x = -32; x <= 32; x += PITCH) {
          if (blocked(x, z)) { run = null; continue; }
          machines.push({ x, z, ry: face > 0 ? 0 : Math.PI, side: face, perX: 0, perZ: face, rowZ });
          if (!run) runs.push(run = { x0: x, x1: x, rowZ, face });
          run.x1 = x;
        }
      });
    });
  });
  // A collider per run, not per machine: a thousand boxes would be a
  // thousand tests a frame, and a bank is solid along its length anyway.
  runs.forEach((r) => box((r.x0 + r.x1) / 2, r.rowZ + r.face * BACK,
    (r.x1 - r.x0) / 2 + PITCH / 2, BACK));

  // the lit sign on top: white glass, tinted per machine, flickering
  const crownMat = new THREE.MeshBasicMaterial({ map: canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a0a08'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 26px Georgia, serif'; g.fillText('JACKPOT', w / 2, h / 2 + 1);
    g.strokeStyle = '#1a0a08'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
  }) });
  const SLOT_PARTS = {
    // the base is one long box per run: the bank is a single piece of
    // furniture, and a box per machine was a thousand more for nothing
    base: [new THREE.BoxGeometry(1, SLOT.base, BACK * 2), mat({ color: 0x3a0e10, roughness: 0.7, metalness: 0.1 })],
    body: [new THREE.BoxGeometry(SLOT.w, SLOT.h, SLOT.d), mat({ color: 0xa8a8b0, roughness: 0.3, metalness: 0.85 })],
    crown: [new THREE.BoxGeometry(SLOT.w, SLOT.sign, 0.4), crownMat],
    tray: [new THREE.BoxGeometry(0.46, 0.08, 0.14), mat({ color: 0xd0d0d8, roughness: 0.15, metalness: 0.95 })],
    // a thousand-odd of each, so they are as plain as they can be and still
    // read at arm's length: a four-sided rod, an eight-sided ball
    rod: [new THREE.CylinderGeometry(0.016, 0.016, 0.45, 4, 1, true), mat({ color: 0xd0d0d8, roughness: 0.15, metalness: 0.95 })],
    knob: [new THREE.OctahedronGeometry(0.05, 0), mat({ color: 0xc8101a, roughness: 0.25, metalness: 0.2 })],
  };
  const screenGeo = new THREE.PlaneGeometry(SLOT.w - 0.04, SLOT.h - 0.04);
  const stripCols = [0xff4a3a, 0x3ae2ff, 0xffc83a, 0xc07aff, 0xb6ff4a, 0xff7ad9];
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const axis = new THREE.Vector3(0, 1, 0);
    const tilt = new THREE.Quaternion();
    const c = new THREE.Color();
    const cabY = SLOT.base + SLOT.h / 2;

    // One set of instanced parts for the whole floor. (Split into halves or
    // quarters to be culled, the parts cost more draws than they saved: a
    // bounding sphere round a quarter of this room is in view from almost
    // anywhere in it.)
    {
      const list = machines, runList = runs;
      const P = {};
      for (const key in SLOT_PARTS) {
        P[key] = new THREE.InstancedMesh(...SLOT_PARTS[key], key === 'base' ? runList.length : list.length);
      }
      const put = (mesh, i, x, y, z, qq = q) => { p.set(x, y, z); m.compose(p, qq, one); mesh.setMatrixAt(i, m); };
      list.forEach((b, i) => {
        q.setFromAxisAngle(axis, b.ry);
        const f = b.perZ;
        put(P.body, i, b.x, cabY, b.z);
        put(P.crown, i, b.x, SLOT.base + SLOT.h + SLOT.sign / 2, b.z - f * 0.04);
        put(P.tray, i, b.x, SLOT.base + 0.1, b.z + f * (SLOT.d / 2 + 0.06));
        // the handle, on the right as you face the machine, leant back a little
        const side = -f;                 // the machine's own right, in world x
        tilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.25 * f);
        put(P.rod, i, b.x + side * (SLOT.w / 2 + 0.04), cabY + 0.1, b.z + f * 0.02, tilt);
        put(P.knob, i, b.x + side * (SLOT.w / 2 + 0.04), cabY + 0.33, b.z - f * 0.04);
        // a colour to each stretch of bank, the way a floor is zoned by game
        P.crown.setColorAt(i, c.setHex(stripCols[Math.abs(Math.floor(b.x / 8) * 3 + Math.round(b.rowZ)) % stripCols.length]));
      });
      runList.forEach((r, i) => {
        p.set((r.x0 + r.x1) / 2, SLOT.base / 2, r.rowZ + r.face * BACK);
        P.base.setMatrixAt(i, m.compose(p, q.identity(), new THREE.Vector3(r.x1 - r.x0 + PITCH, 1, 1)));
      });
      for (const key in P) { P[key].instanceMatrix.needsUpdate = true; P[key].computeBoundingSphere(); scene.add(P[key]); }
    }

    machines.forEach((b, i) => {
      const f = b.perZ;
      // the face: one of the shared canvases
      b.screen = i % SCREEN_POOL;
      const sc = new THREE.Mesh(screenGeo, screens[b.screen].mat);
      sc.position.set(b.x, cabY, b.z + f * (SLOT.d / 2 + 0.003));
      sc.rotation.y = b.ry;
      scene.add(sc);

      if (i % 2 === 0) {
        const sx = b.x, sz = b.z + f * (SLOT.d / 2 + 0.45);
        addStool(scene, sx, sz);
        spots.slotSeats.push({ x: sx, z: sz, ry: b.ry + Math.PI });
      }
    });
  }
  const tables = buildPits(scene, box, mat, spots);

  /* ===================== REGISTRATION WING, to the north */
  const LOB_X = 20, LOB_Z0 = -30, LOB_Z1 = -56;
  const addWall = (x, z, w, d, h = 7.0, m0 = wallMat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m0);
    m.position.set(x, h / 2, z);
    scene.add(m);
    box(x, z, w / 2, d / 2);
  };
  addWall(-LOB_X, -43, 1.0, 26, 7.0, lobbyWallMat);
  // the east wall has the lounge opening in it
  const LOUNGE_DOOR = { z0: -47, z1: -41 };
  addWall(LOB_X, (LOB_Z1 + LOUNGE_DOOR.z0) / 2, 1.0, LOUNGE_DOOR.z0 - LOB_Z1, 7.0, lobbyWallMat);
  addWall(LOB_X, (LOUNGE_DOOR.z1 + LOB_Z0) / 2, 1.0, LOB_Z0 - LOUNGE_DOOR.z1, 7.0, lobbyWallMat);
  {
    const over = new THREE.Mesh(new THREE.BoxGeometry(1.0, 3.6, LOUNGE_DOOR.z1 - LOUNGE_DOOR.z0), lobbyWallMat);
    over.position.set(LOB_X, 7.0 - 1.8, (LOUNGE_DOOR.z0 + LOUNGE_DOOR.z1) / 2);
    scene.add(over);
  }
  // The back wall is the FRONT of the building, and the way in and out is
  // a bank of glass doors in it just along from the desk -- which is where
  // a hotel puts the desk, so the first thing you walk into is a clerk.
  // There used to be a fourteen metre hole here with nothing behind it.
  const DOOR = { x0: -11, x1: -3, z: LOB_Z1 };
  addWall((-LOB_X - 0.5 + DOOR.x0) / 2, LOB_Z1, DOOR.x0 + LOB_X + 0.5, 1.0, 7.0, lobbyWallMat);
  addWall((DOOR.x1 + LOB_X + 0.5) / 2, LOB_Z1, LOB_X + 0.5 - DOOR.x1, 1.0, 7.0, lobbyWallMat);
  {
    // the wall over the doors, which you walk under, so it has no collider
    const over = new THREE.Mesh(new THREE.BoxGeometry(DOOR.x1 - DOOR.x0, 3.8, 1.0), lobbyWallMat);
    over.position.set((DOOR.x0 + DOOR.x1) / 2, 7.0 - 1.9, LOB_Z1);
    scene.add(over);
  }
  const frontage = buildFrontage(scene, box, mat, DOOR, LOB_Z1);
  const lounge = buildLounge(scene, box, mat, spots, LOB_X, LOUNGE_DOOR);
  buildLobbyDressing(scene, box, mat, spots, LOB_X, LOB_Z1);

  const lobCeil = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 27),
    mat({ color: 0x120a08, roughness: 0.95 }));
  lobCeil.rotation.x = Math.PI / 2;
  lobCeil.position.set(0, 7.0, -42.5);
  scene.add(lobCeil);

  buildFrontDesk(scene, box, mat, spots);

  // queue rail
  const railMat = mat({ color: 0x8a1420, roughness: 0.9 });
  const postMat = mat({ color: C.trim, roughness: 0.3, metalness: 0.9 });
  const postGeo = new THREE.CylinderGeometry(0.07, 0.11, 1.0, 8);
  const ropeSegGeo = new THREE.BoxGeometry(0.09, 0.09, 4);
  for (let i = 0; i < 5; i++) {
    const z = -50 + i * 4;
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(-12.5, 0.5, z);
    scene.add(p);
    if (i < 4) {
      const rp = new THREE.Mesh(ropeSegGeo, railMat);
      rp.position.set(-12.5, 0.82, z + 2);
      scene.add(rp);
    }
  }
  // (the line at the desk is laid out in buildLobbyDressing)

  // lobby seating
  const sofaMat = mat({ color: 0x4a1220, roughness: 0.85 });
  const addSofa = (x, z, ry) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 1.2), sofaMat);
    seat.position.y = 0.42; g.add(seat);
    const bk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.3), sofaMat);
    bk.position.set(0, 0.85, -0.45); g.add(bk);
    scene.add(g);
    box(x, z, 1.75, 0.62);
  };
  addSofa(10, -48, 0);
  addSofa(10, -40, Math.PI);
  spots.standing.push({ x: 6, z: -44, ry: 1.4 }, { x: 14, z: -45, ry: -1.0 });

  /* ================== ELEVATOR CORRIDOR, to the south */
  addWall(-13, 43, 1.0, 26);
  addWall(13, 43, 1.0, 26);
  // close the shoulders between the corridor mouth and the rotunda wall
  addWall(-19.5, 30.5, 12, 1.0);
  addWall(19.5, 30.5, 12, 1.0);

  const corrCeil = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 26),
    mat({ color: 0x120a08, roughness: 0.95 }));
  corrCeil.rotation.x = Math.PI / 2;
  corrCeil.position.set(0, 6.4, 43);
  scene.add(corrCeil);

  const elevMat = mat({ color: 0x3a3230, roughness: 0.2, metalness: 0.9 });
  [-7, 0, 7].forEach((x) => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5.0, 0.4), elevMat);
    d.position.set(x, 2.5, 54.6);
    scene.add(d);
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 5.0, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x000000 }));
    seam.position.set(x, 2.5, 54.35);
    scene.add(seam);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.16, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x331100 }));
    lamp.position.set(x, 5.3, 54.35);
    scene.add(lamp);
  });
  addWall(0, 55.4, 28, 1.0);

  const podium = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.8),
    mat({ color: 0x3a1c10, roughness: 0.5, metalness: 0.3 }));
  podium.position.set(3.6, 0.55, 37);
  scene.add(podium);
  box(3.6, 37, 0.8, 0.4);

  /* ------------------------------------------- neon signs */
  const addSign = (text, color, x, y, z, ry, w, h) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: neonTexture(text, color), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    return m;
  };
  const signs = [
    addSign('BAZOOKO CIRCUS', '#ff2d6a', 0, 12.5, -30.5, 0, 34, 7),
    addSign('REGISTRATION', '#ffb400', -19.36, 4.05, -43, Math.PI / 2, 7.6, 1.9),
    // over the way out, on the inside, the way every hotel does it
    addSign('EXIT', '#ff2d1f', -7, 3.7, LOB_Z1 + 0.56, 0, 3.2, 0.8),
    addSign('ELEVATORS', '#b6ff2e', 0, 5.6, 54.2, Math.PI, 15, 3.6),
    addSign('THE MIDWAY', '#12e2e2', 0, 12.2, 30.5, Math.PI, 22, 5),
  ];

  /* ---------------------------------------- walking routes */
  const ringPath = (radius, n, phase) => {
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + phase;
      p.push({ x: Math.sin(a) * radius, z: Math.cos(a) * radius });
    }
    return p;
  };
  // the walking loops go round the bar, inside the slots: the old ones at
  // 12.5 and 15.5 metres walked people straight through the table pits
  spots.paths = [
    ringPath(8.0, 16, 0),
    ringPath(8.6, 16, 0.4),
    ringPath(32.6, 20, 0.2),
    // (in the centre walk, where no bank reaches: at x = 5 it walked
    // through the end of a bank)
    [{ x: -4, z: -52 }, { x: -4, z: -34 }, { x: -4, z: -14 }, { x: 3.8, z: -14 },
     { x: 3.8, z: -34 }, { x: 3.8, z: -52 }],
    [{ x: 2, z: 50 }, { x: 2, z: 34 }, { x: 2, z: 16 }, { x: -7, z: 16 },
     { x: -7, z: 34 }, { x: -7, z: 50 }],
  ];

  /* ------------------------------------------- dust motes */
  const dustCount = 700;
  const dustGeo = new THREE.BufferGeometry();
  const dpos = new Float32Array(dustCount * 3);
  const dseed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * R;
    dpos[i * 3] = Math.sin(a) * rr;
    dpos[i * 3 + 1] = Math.random() * 14;
    dpos[i * 3 + 2] = Math.cos(a) * rr;
    dseed[i] = Math.random() * 6.28;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dseed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uWreck: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime, uWreck;
      varying float vA;
      void main(){
        vec3 p = position;
        p.y += sin(uTime*0.3 + aSeed)*0.7 + mod(uTime*0.12 + aSeed, 4.0);
        p.x += sin(uTime*0.21 + aSeed*2.0) * (0.6 + 4.0*uWreck);
        p.z += cos(uTime*0.17 + aSeed*3.0) * (0.6 + 4.0*uWreck);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (16.0 + 46.0*uWreck) / -mv.z;
        gl_Position = projectionMatrix * mv;
        vA = 0.22 + 0.7*uWreck;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d));
        gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * a, a * vA);
      }`,
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  /* ============================================== updating */
  const fogCol = new THREE.Color();
  const sick = new THREE.Color(0x2a0008);
  const baseFog = new THREE.Color(0x100604);

  function update(t, s, playerPos) {
    lobbyUni.uTime.value = t;
    frontage.update(t, playerPos.z < -40);
    lobbyUni.uPsych.value = s.psych;
    lounge.update(t, s);
    carpetUni.uTime.value = t;
    carpetUni.uWreck.value = s.wreck;
    carpetUni.uPlayer.value.copy(playerPos);

    dustMat.uniforms.uTime.value = t;
    dustMat.uniforms.uWreck.value = s.wreck;

    // the bar turns all night. slowly, unless you are not well.
    carousel.rotation.y = t * (0.055 + s.wreck * 0.10);
    rideHorses(t);

    // the acts work directly over the gamblers' heads
    swingers.forEach((sw, i) => {
      sw.pivot.rotation.x = Math.sin(t * 0.9 + sw.phase) * 0.85;
      sw.pivot.rotation.z = Math.sin(t * 0.45 + sw.phase) * 0.12;
    });

    screens.forEach((sc) => {
      sc.t -= 1 / 60;
      if (sc.t > 0) return;
      sc.t = 0.6 + Math.random() * 3.5 * (1 - s.wreck * 0.6);
      rollScreen(sc.tex);
    });
    crownMat.color.setScalar(0.65 + Math.sin(t * 3) * 0.3 * (0.3 + s.wreck));
    bulbMat.color.setRGB(
      1, 0.91 - 0.1 * Math.sin(t * 4), 0.69 - 0.2 * Math.sin(t * 4));

    lampObjs.forEach((l, i) => {
      const flick = 1 + Math.sin(t * (3 + i * 1.7)) * 0.12 * (0.2 + s.wreck * 2.4);
      l.L.intensity = l.base * flick * (1 - s.fear * 0.35);
    });

    signs.forEach((sg, i) => {
      sg.material.opacity = 0.75 + Math.sin(t * (2.1 + i)) * 0.25 * (0.2 + s.wreck);
    });

    scene.fog.density = 0.017 + s.fear * 0.028 + s.wreck * 0.010;
    fogCol.copy(baseFog).lerp(sick, s.loathing);
    scene.fog.color.copy(fogCol);
  }

  return {
    root: scene,
    colliders, update, spots, carousel, machines, screens, tables,
    R, CAROUSEL_R, LOB_X, LOB_Z0, LOB_Z1,
    frontage, lounge,
  };
}
