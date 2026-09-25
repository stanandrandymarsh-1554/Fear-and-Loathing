/* ============================================================
   THE PHONE — the whole game played by holding it in landscape.

   Only ever switched on for a touch screen (or ?touch in the URL, for
   testing); a keyboard and a mouse never see any of this.

     on foot   Tilt the top of the phone away from you to walk, towards
               you to back up. Tilt it left or right to look round that
               way. Turn the screen like a wheel -- anticlockwise, or
               clockwise -- to step sideways. Every one of them is a
               held position, not a flick: hold it there and it keeps
               going, bring it back to the middle and it stops.
               Drag a finger to look about, and up and down.
               Tap to do whatever the prompt says. Two fingers re-level.
     driving   Turn the screen like the wheel it is. The right thumb is
               the gas and the left thumb is the brake.

   HOW THE PHONE IS READ. Everything is measured against the way you were
   holding it when you pressed BEGIN (or last tapped with two fingers),
   and in the phone's own terms, so it works however far back you lean it:
     forward   how far the screen has leaned back, or forward, from that
     wheel     how far the screen has turned in its own plane, like a
               wheel: its long edge swinging up or down across the face
     look      how far it has turned about its own short axis: one end
               of it coming towards you as the other goes away
   Those three are separate motions, so each can be held on its own. And
   because you might shift in your seat, the resting hold slowly follows
   which way you face while the phone is sitting in the middle.
   ============================================================ */
import * as THREE from 'three';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** 0 inside the dead zone, rising to 1 at full, signed */
const ramp = (v, dead, full) => Math.sign(v) * clamp((Math.abs(v) - dead) / (full - dead), 0, 1);
const wrap = (a) => (a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a);

const params = new URLSearchParams(location.search);
export const touch = {
  on: params.has('touch') || matchMedia('(pointer: coarse)').matches,
  ready: false,        // motion permission granted and a reading in
  denied: false,
  lean: 0, lean0: 0,   // radians: leaned back from facing you, now and at rest
  wheel: 0,            // + turned anticlockwise from the resting hold
  look: 0,             // + turned to look left of the resting hold
  dragX: 0, dragY: 0,  // dragged since last sample, px
  gas: false, brake: false,       // thumbs on either half, in the car
  fingers: new Map(),
};

// ---------------------------------------------------------- the sensor
const euler = new THREE.Euler();
const q = new THREE.Quaternion();
const qScreen = new THREE.Quaternion();
// the camera looks out of the back of the phone, not out of its top
const qBack = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const Z = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);
const right = new THREE.Vector3(), normal = new THREE.Vector3(), rel = new THREE.Vector3();
// the resting hold, and which way it faces
const rest = new THREE.Quaternion(), restInv = new THREE.Quaternion(), turnRest = new THREE.Quaternion();
let hasRest = false, restHeading = 0, heading = 0, lastT = 0;

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

  // Which way you face, read off the long edge and the screen's facing
  // together, so it holds steady from upright to nearly flat. (A camera at
  // yaw h has right = (cos h, 0, -sin h) and faces (-sin h, 0, -cos h).)
  const fx = right.z - normal.x, fz = -right.x - normal.z;
  heading = Math.atan2(-fx, -fz);
  // lean: 0 facing you, 90 flat on its back. Measured against the way you
  // face, so a phone tipped past flat keeps counting instead of folding back.
  const toYou = normal.x * Math.sin(heading) + normal.z * Math.cos(heading);
  touch.lean = Math.atan2(normal.y, toYou);
  if (!hasRest) recentre();

  // The long edge, as the resting hold sees it. Turned like a wheel, it
  // swings up the face of the screen (y); turned about the short axis, it
  // swings out of the face (z). Leaning forward to walk moves neither.
  rel.copy(right).applyQuaternion(restInv.copy(rest).invert());
  touch.wheel = Math.atan2(rel.y, rel.x);
  touch.look = Math.atan2(-rel.z, rel.x);

  // Settled in the middle, the rest follows you round if you shift in the
  // chair, or the compass creeps: a couple of seconds to catch up.
  const dt = lastT ? clamp((e.timeStamp - lastT) / 1000, 0, 0.2) : 0;
  lastT = e.timeStamp;
  if (Math.abs(touch.look) < 5 * DEG && Math.abs(touch.wheel) < 5 * DEG) {
    const k = wrap(heading - restHeading) * Math.min(1, dt / 2);
    rest.premultiply(turnRest.setFromAxisAngle(UP, k));
    restHeading = wrap(restHeading + k);
  }
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
  rest.copy(q);
  restHeading = heading;
  touch.lean0 = touch.lean;
  touch.wheel = touch.look = 0;
  hasRest = true;
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

/* What the phone is asking for this frame. Dragging is handed over once
   and then cleared; the tilts are held positions.
     walk, strafe   -1..1, + is forward / right
     run            tipped well past a walk
     turn           radians to turn this frame, + is left
     steer          -1..1, + is left, the way the car's A key turns it
     tilt, wheel    the on-screen level: the bubble, and the ring's turn */
export function sampleTouch(dt) {
  const lean = (touch.lean - touch.lean0) / DEG;
  const wheel = touch.wheel / DEG, look = touch.look / DEG;
  const r = touch.ready;
  // a small tilt is a slow look round, a big one a fast one
  const L = r ? ramp(look, 6, 30) : 0;
  const out = {
    dragX: touch.dragX, dragY: touch.dragY,
    walk: r ? ramp(lean, 7, 22) : 0,
    strafe: r ? -ramp(wheel, 7, 24) : 0,
    run: r && lean > 32,
    turn: L * Math.abs(L) * 2.6 * dt,
    steer: r ? ramp(wheel, 2.5, 30) : 0,
    tilt: [clamp(-look / 30, -1, 1), clamp(-lean / 30, -1, 1)],
    wheel: r ? clamp(wheel, -60, 60) : 0,
    gas: touch.gas, brake: touch.brake,
  };
  touch.dragX = 0; touch.dragY = 0;
  return out;
}
