/* ============================================================
   THE PHONE — the game played in landscape on a touch screen.

   Only ever switched on for a touch screen (or ?touch in the URL, for
   testing); a keyboard and a mouse never see any of this.

   This is the scheme shipped phone shooters settled on, not an invention:
     look      GYRO AIMING (Fortnite, CoD Mobile, Splatoon, Genshin). The
               camera turns by as much as the phone turns, read from how
               fast it is rotating -- not from where it is pointing -- so
               there is no resting angle to hold and nothing to drift.
               Turning is taken in PLAYER SPACE: rotation about the real
               vertical, whichever way the phone is leaning, so "turn left"
               is turn left whether you hold it upright or in your lap.
               (Jibb Smart's GyroWiki; the 1.41 relax factor is his.)
     move      a floating thumbstick: put the left thumb down anywhere on
               the left half and push. Past the ring is a run.
     also      drag on the right half to look (for the big turns), tap
               anything to use it.
     driving   the racing-game standard (Asphalt, Real Racing): tip the
               phone like a wheel, read as its roll against gravity, zeroed
               when you get in. Gravity does not drift. The left thumb is
               the same stick as on foot -- up to go, down to brake and
               then reverse -- and a right thumb held anywhere is gas too.
               (The left thumb used to be a plain brake pedal, so a thumb
               put down the way you walk sat there reversing.)
   ============================================================ */
import * as THREE from 'three';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const params = new URLSearchParams(location.search);
export const touch = {
  on: params.has('touch') || matchMedia('(pointer: coarse)').matches,
  ready: false,        // motion permission granted and a reading in
  denied: false,
  yaw: 0, pitch: 0,    // radians turned since last sample: + left, + up
  roll: 0, roll0: 0,   // the wheel: + anticlockwise, and where it sits at rest
  dragX: 0, dragY: 0,  // right-hand drag since last sample, px
  stick: { x: 0, y: 0, run: false },
  gas: false,
  fingers: new Map(),
};

// ---------------------------------------------------------- the sensor
const euler = new THREE.Euler();
const q = new THREE.Quaternion(), qPrev = new THREE.Quaternion(), dq = new THREE.Quaternion();
const qInv = new THREE.Quaternion(), qScreen = new THREE.Quaternion();
// the camera looks out of the back of the phone, not out of its top
const qBack = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const Z = new THREE.Vector3(0, 0, 1);
const up = new THREE.Vector3(), turn = new THREE.Vector3();
let hasPrev = false, lastT = 0;

function screenAngle() {
  const a = screen.orientation && typeof screen.orientation.angle === 'number'
    ? screen.orientation.angle : window.orientation;
  return (+a || 0) * DEG;
}

function onOrientation(e) {
  if (e.alpha == null || e.beta == null || e.gamma == null) return;
  // device -> the world three.js draws in (y up), in the screen's own axes
  // as you are holding it: x along the screen to the right, y up it, z out
  // of it at you
  euler.set(e.beta * DEG, e.alpha * DEG, -e.gamma * DEG, 'YXZ');
  q.setFromEuler(euler).multiply(qBack).multiply(qScreen.setFromAxisAngle(Z, -screenAngle()));
  qInv.copy(q).invert();

  // which way is up, as the screen sees it
  up.set(0, 1, 0).applyQuaternion(qInv);
  // the wheel: the tip of the screen against gravity, anticlockwise +
  touch.roll = Math.atan2(up.x, up.y);

  const dt = lastT ? (e.timeStamp - lastT) / 1000 : 0;
  lastT = e.timeStamp;
  if (hasPrev && dt > 0 && dt < 0.25) {
    // the turn since the last reading, in the screen's own axes
    dq.copy(qPrev).invert().multiply(q);
    if (dq.w < 0) { dq.x = -dq.x; dq.y = -dq.y; dq.z = -dq.z; dq.w = -dq.w; }
    const s = Math.sqrt(Math.max(0, 1 - dq.w * dq.w));
    const ang = 2 * Math.acos(Math.min(1, dq.w));
    if (s > 1e-6) turn.set(dq.x / s, dq.y / s, dq.z / s).multiplyScalar(ang);
    else turn.set(0, 0, 0);

    // PLAYER SPACE. Yaw is the turn about the real vertical; the relax
    // factor lets a turn about the phone's own axes count for up to 1.41
    // of it, which is what makes it feel right held at any lean.
    const worldYaw = turn.dot(up);
    const yaw = Math.sign(worldYaw) * Math.min(Math.abs(worldYaw) * 1.41, Math.hypot(turn.y, turn.z));
    const pitch = turn.x;
    // tightening: the hands are never quite still, so the slowest turns
    // (under about 3 degrees a second) are scaled down, and a phone at rest
    // does not creep
    const rate = Math.hypot(yaw, pitch) / dt;
    const tight = Math.min(1, rate / (3 * DEG));
    touch.yaw += yaw * tight;
    touch.pitch += pitch * tight;
  }
  qPrev.copy(q);
  hasPrev = true;
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

/** the wheel is straight however you are holding it as you get in */
export function centreWheel() { touch.roll0 = touch.roll; }

// ---------------------------------------------------------- the fingers
const TAP_MS = 280, TAP_PX = 14;
const STICK_R = 56;                  // px from the thumb's first touch to the ring
let handlers = {};
let stickId = null, stickX = 0, stickY = 0;
const stickEl = document.getElementById('stick');
const knobEl = stickEl && stickEl.querySelector('i');

function showStick(on) {
  if (!stickEl) return;
  stickEl.classList.toggle('on', on);
  if (on) { stickEl.style.left = stickX + 'px'; stickEl.style.top = stickY + 'px'; }
  if (knobEl && !on) knobEl.style.transform = '';
}

function onStart(e) {
  // the title and the end card are ordinary pages with ordinary buttons
  if (e.target.closest('#title, #endcard')) return;
  e.preventDefault();   // no zoom, no scroll, no pretend mouse
  const now = performance.now();
  for (const t of e.changedTouches) {
    const left = t.clientX < innerWidth / 2;
    const f = { x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY,
      t0: now, moved: false, left, target: e.target, stick: false };
    // the left thumb, down on the view, is the stick -- one at a time
    if (left && e.target.id === 'gl' && stickId === null) {
      f.stick = true; stickId = t.identifier; stickX = t.clientX; stickY = t.clientY;
      showStick(true);
    }
    touch.fingers.set(t.identifier, f);
  }
  pedals();
}

function onMove(e) {
  if (e.target.closest('#title, #endcard')) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const f = touch.fingers.get(t.identifier);
    if (!f) continue;
    if (Math.hypot(t.clientX - f.x0, t.clientY - f.y0) > TAP_PX) f.moved = true;
    if (f.stick) {
      const dx = t.clientX - stickX, dy = t.clientY - stickY;
      const d = Math.hypot(dx, dy) / STICK_R;
      touch.stick.run = d > 1.35;
      const k = d > 1 ? 1 / d : 1;
      touch.stick.x = dx / STICK_R * k;
      touch.stick.y = dy / STICK_R * k;
      if (knobEl) knobEl.style.transform = `translate(${(touch.stick.x * STICK_R).toFixed(0)}px, ${(touch.stick.y * STICK_R).toFixed(0)}px)`;
    } else {
      touch.dragX += t.clientX - f.x;
      touch.dragY += t.clientY - f.y;
    }
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
    if (!f) continue;
    if (f.stick) {
      stickId = null;
      touch.stick.x = touch.stick.y = 0; touch.stick.run = false;
      showStick(false);
    }
    if (!f.moved && now - f.t0 <= TAP_MS) handlers.tap?.(f.target, f.x0, f.y0);
  }
  pedals();
}

/** in the car, a right thumb held on the view is the gas */
function pedals() {
  let gas = false;
  for (const f of touch.fingers.values()) if (!f.left && f.target.id === 'gl') gas = true;
  touch.gas = gas;
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

/* What the phone is asking for this frame. The turns and the drags are
   handed over once and then cleared.
     yaw, pitch     radians the phone turned: + left, + up
     dragX, dragY   px dragged by any finger that is not the stick
     walk, strafe   -1..1 from the stick, + forward / right
     run            the stick pushed past its ring
     steer          -1..1, + is left, the way the car's A key turns it
     gas, brake     the car's pedals: the stick up or a right thumb, the
                    stick down */
export function sampleTouch() {
  const s = touch.stick;
  // a little dead zone in the middle of the stick, rescaled so the edge
  // of it is still a gentle walk rather than a jump
  const m = Math.hypot(s.x, s.y);
  const k = m < 0.12 ? 0 : (m - 0.12) / (0.88 * m);
  let roll = (touch.roll - touch.roll0) / DEG;
  if (roll > 180) roll -= 360;
  if (roll < -180) roll += 360;
  const out = {
    yaw: touch.yaw, pitch: touch.pitch,
    dragX: touch.dragX, dragY: touch.dragY,
    walk: -s.y * k, strafe: s.x * k, run: s.run,
    steer: touch.ready ? Math.sign(roll) * clamp((Math.abs(roll) - 2) / 28, 0, 1) : 0,
    gas: touch.gas || -s.y * k > 0.3, brake: s.y * k > 0.3,
  };
  touch.yaw = touch.pitch = 0;
  touch.dragX = touch.dragY = 0;
  return out;
}
