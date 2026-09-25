/* ============================================================
   THE PHONE — the whole game played by holding it in landscape.

   Only ever switched on for a touch screen (or ?touch in the URL, for
   testing); a keyboard and a mouse never see any of this.

     on foot   the phone is your head. Turn round with it and you turn
               round. Tilt the top of it away from you to walk, towards
               you to back up, and tip it left or right to step sideways.
               Drag a finger to turn and look up and down from a chair.
               Tap to do whatever the prompt says. Two fingers re-centre.
     driving   the phone is the wheel: tip it like one. The right thumb
               is the gas and the left thumb is the brake.

   HOW THE TILT IS READ. Phones held for a game sit anywhere from upright
   to nearly flat, and the obvious reading -- yaw, pitch and roll of the
   camera -- turns to noise as the phone lies down, just when you tip it
   forward to walk. So each gesture is read off the one part of the phone
   the others barely move:
     heading   which way the long edge of the screen points, flattened
               onto the floor. Tipping it forward does not move that,
               and neither does raising one end.
     sideways  how far the long edge is raised off level: one end up.
     forward   how far the screen has leaned back from facing you. At
               rest you hold it wherever is comfortable, so that is
               measured from where it was when you pressed BEGIN (or
               the last two-finger tap), not from upright.
   ============================================================ */
import * as THREE from 'three';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** 0 inside the dead zone, rising to 1 at full, signed */
const ramp = (v, dead, full) => Math.sign(v) * clamp((Math.abs(v) - dead) / (full - dead), 0, 1);

const params = new URLSearchParams(location.search);
export const touch = {
  on: params.has('touch') || matchMedia('(pointer: coarse)').matches,
  ready: false,        // motion permission granted and a reading in
  denied: false,
  heading: 0, side: 0, lean: 0,   // radians, as read
  side0: 0, lean0: 0,             // the resting hold
  dYaw: 0,                        // turned since last sample
  dragX: 0, dragY: 0,             // dragged since last sample, px
  gas: false, brake: false,       // thumbs on either half, in the car
  fingers: new Map(),
};

// ---------------------------------------------------------- the sensor
const euler = new THREE.Euler();
const q = new THREE.Quaternion();
const qScreen = new THREE.Quaternion();
// the camera looks out of the back of the phone, not out of its top
const qBack = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const Z = new THREE.Vector3(0, 0, 1);
const right = new THREE.Vector3(), normal = new THREE.Vector3();
let lastHeading = null;

function screenAngle() {
  const a = screen.orientation && typeof screen.orientation.angle === 'number'
    ? screen.orientation.angle : window.orientation;
  return (+a || 0) * DEG;
}

function onOrientation(e) {
  if (e.alpha == null || e.beta == null || e.gamma == null) return;
  // device -> the same world three.js draws in (y up), with the screen's
  // own right and up as the camera's, whichever way round the phone is
  euler.set(e.beta * DEG, e.alpha * DEG, -e.gamma * DEG, 'YXZ');
  q.setFromEuler(euler).multiply(qBack).multiply(qScreen.setFromAxisAngle(Z, -screenAngle()));
  right.set(1, 0, 0).applyQuaternion(q);     // along the screen, to the right
  normal.set(0, 0, 1).applyQuaternion(q);    // out of the screen, at you

  // Which way you face, read two ways and summed. The long edge flattened
  // onto the floor ignores a tip that raises one end; the screen's own
  // facing ignores a tip that turns it like a wheel. Held leaning back,
  // either tip turns the phone a little about the vertical whichever way
  // you read it, and summing the two halves that. Each counts for as much
  // as it lies flat, so a phone lying on its back reads off its edge alone.
  // (a camera at yaw h has right = (cos h, 0, -sin h), and faces
  // (-sin h, 0, -cos h), which is away from the screen)
  const fx = right.z - normal.x, fz = -right.x - normal.z;
  const heading = Math.atan2(-fx, -fz);
  // + when the right-hand end is up: tipped to the LEFT
  const side = Math.asin(clamp(right.y, -1, 1));
  // lean: 0 facing you, 90 flat on its back. Measured against the way you
  // face, so a phone tipped past flat keeps counting instead of folding back.
  const toYou = normal.x * Math.sin(heading) + normal.z * Math.cos(heading);
  const lean = Math.atan2(normal.y, toYou);

  if (lastHeading === null) { lastHeading = heading; touch.side0 = side; touch.lean0 = lean; }
  let d = heading - lastHeading;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  lastHeading = heading;
  // with the long edge pointing at the floor there is no heading to read
  if (Math.abs(right.y) < 0.9) touch.dYaw += d;
  touch.heading = heading; touch.side = side; touch.lean = lean;
  touch.ready = true;
}

/** motion needs asking for on iOS, and only from inside a tap */
export function askForMotion() {
  if (!touch.on) return;
  const listen = () => addEventListener('deviceorientation', onOrientation);
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    D.requestPermission()
      .then((r) => { if (r === 'granted') listen(); else touch.denied = true; })
      .catch(() => { touch.denied = true; });
  } else {
    listen();
  }
}

/** the way you are holding it now is the way you hold it at rest */
export function recentre() {
  touch.side0 = touch.side;
  touch.lean0 = touch.lean;
}

// ---------------------------------------------------------- the fingers
const TAP_MS = 280, TAP_PX = 14;
let handlers = {};
let twoFinger = 0;

function onStart(e) {
  // the title and the end card are ordinary pages with ordinary buttons
  if (e.target.closest('#title, #endcard')) return;
  e.preventDefault();   // no zoom, no scroll, no pretend mouse
  const now = performance.now();
  for (const t of e.changedTouches) {
    touch.fingers.set(t.identifier, { x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY,
      t0: now, moved: false, left: t.clientX < innerWidth / 2, target: e.target });
  }
  if (touch.fingers.size === 2) twoFinger = now;
  pedals();
}

function onMove(e) {
  if (e.target.closest('#title, #endcard')) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const f = touch.fingers.get(t.identifier);
    if (!f) continue;
    if (Math.hypot(t.clientX - f.x0, t.clientY - f.y0) > TAP_PX) f.moved = true;
    touch.dragX += t.clientX - f.x;
    touch.dragY += t.clientY - f.y;
    f.x = t.clientX; f.y = t.clientY;
  }
}

function onEnd(e) {
  if (e.target.closest('#title, #endcard')) return;
  e.preventDefault();
  const now = performance.now();
  for (const t of e.changedTouches) {
    const f = touch.fingers.get(t.identifier);
    touch.fingers.delete(t.identifier);
    if (!f || f.moved || now - f.t0 > TAP_MS) continue;
    if (twoFinger && now - twoFinger < TAP_MS + 60) {
      // the second finger of a two-finger tap: once is enough
      if (touch.fingers.size === 0) { twoFinger = 0; recentre(); handlers.recentred?.(); }
      continue;
    }
    handlers.tap?.(f.target, f.x0, f.y0);
  }
  pedals();
}

/** in the car, a thumb held on either half of the screen */
function pedals() {
  let gas = false, brake = false;
  for (const f of touch.fingers.values()) {
    if (f.target.closest?.('#case-btn, #inventory, #tasks, #dialogue')) continue;
    if (f.left) brake = true; else gas = true;
  }
  touch.gas = gas; touch.brake = brake;
}

export function initTouch(h) {
  handlers = h;
  if (!touch.on) return;
  document.documentElement.classList.add('touch');
  const opt = { passive: false };
  document.addEventListener('touchstart', onStart, opt);
  document.addEventListener('touchmove', onMove, opt);
  document.addEventListener('touchend', onEnd, opt);
  document.addEventListener('touchcancel', onEnd, opt);
  // iOS still pinch-zooms a page that says it may not
  document.addEventListener('gesturestart', (e) => e.preventDefault(), opt);
}

/* What the phone is asking for this frame. Turning and dragging are
   handed over once and then cleared; the tilts are where they are.
     walk, strafe   -1..1, + is forward / right
     run            tipped well past a walk
     steer          -1..1, + is left, the way the car's A key turns it
     tilt           the bubble for the on-screen level, -1..1 each way */
export function sampleTouch() {
  const lean = (touch.lean - touch.lean0) / DEG;
  const side = (touch.side - touch.side0) / DEG;
  const out = {
    turn: touch.dYaw, dragX: touch.dragX, dragY: touch.dragY,
    walk: touch.ready ? ramp(lean, 7, 22) : 0,
    strafe: touch.ready ? -ramp(side, 7, 22) : 0,
    run: touch.ready && lean > 32,
    steer: touch.ready ? ramp(side, 2.5, 30) : 0,
    tilt: [clamp(-side / 30, -1, 1), clamp(-lean / 30, -1, 1)],
    gas: touch.gas, brake: touch.brake,
  };
  touch.dYaw = 0; touch.dragX = 0; touch.dragY = 0;
  return out;
}
