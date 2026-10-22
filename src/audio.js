/* ============================================================
   AUDIO — everything is synthesised. No files, no loading.

   Signal path:

     [voices] ──► dry ─────────────────────┐
              └─► sendRev ──► convolver ───┤
                                           ├─► muffle(LP) ──► drive ──► comp ──► out
     [heartbeat / stingers] ───────────────┘

   The muffle filter and a global detune are driven by how
   wrecked the player is, so the entire world goes underwater
   and sours in pitch as the chemistry takes hold.
   ============================================================ */

const rnd = (a, b) => a + Math.random() * (b - a);
// defaults match game.js: a one-argument call here returned NaN, which is
// how running the car off the road froze the whole game
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------ the bands' books
   Note names to frequencies, the two tunes, and how each plays a beat. */
const NOTE = (n) => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(n);
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (semi + (+m[3] - 4) * 12 - 9) / 12);
};
const CALLIOPE = { atk: 0.02, vib: 0.006, parts: [[1, 0.6], [2, 0.22], [3, 0.08]] };
const PAH = { atk: 0.01, decay: 0.5, parts: [[1, 0.35, 'triangle'], [2, 0.08]] };
const TUBA = { atk: 0.02, decay: 0.7, parts: [[1, 0.7, 'triangle'], [2, 0.12]] };
const KEYS = { atk: 0.006, decay: 1.6, parts: [[1, 0.55], [2, 0.12], [4.02, 0.05]] };
const UPRIGHT = { atk: 0.01, decay: 0.9, parts: [[1, 0.8], [2, 0.18, 'triangle']] };
const chordOf = (root, kind) => {
  const r = NOTE(root);
  const iv = { maj: [0, 4, 7], dom7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10] }[kind];
  return iv.map((x) => r * Math.pow(2, x / 12));
};
// the carousel waltz: sixteen bars of 3/4 in C, then round again
const WALTZ_CHORDS = ['C3 maj', 'C3 maj', 'G2 dom7', 'G2 dom7', 'G2 dom7', 'G2 dom7', 'C3 maj', 'C3 maj',
  'C3 maj', 'C3 dom7', 'F2 maj', 'F2 maj', 'C3 maj', 'G2 dom7', 'C3 maj', 'C3 maj'];
const WALTZ_TUNE = [   // [note, beats] per bar
  [['E5', 2], ['G5', 1]], [['G5', 2], ['E5', 1]], [['D5', 2], ['F5', 1]], [['F5', 3]],
  [['D5', 2], ['F5', 1]], [['F5', 2], ['D5', 1]], [['C5', 2], ['E5', 1]], [['E5', 3]],
  [['E5', 2], ['G5', 1]], [['C6', 2], ['Bb5', 1]], [['A5', 2], ['F5', 1]], [['A5', 3]],
  [['G5', 2], ['E5', 1]], [['D5', 2], ['B4', 1]], [['C5', 3]], [],
];
// the lounge: a slow ii-V-I, four bars round and round
const LOUNGE_CHORDS = ['C3 maj7', 'A2 m7', 'D3 m7', 'G2 dom7'];
const LOUNGE_TUNE = [
  [['E5', 1], ['G5', 1], ['B5', 2]], [['A5', 1], ['G5', 1], ['E5', 2]],
  [['F5', 1], ['A5', 1], ['C6', 1], ['A5', 1]], [['G5', 2], ['F5', 1], ['D5', 1]],
];
function playTune(a, tune, bar, beatInBar, at, beat, out, voice, vol, bend) {
  let b = 0;
  for (const [n, len] of tune[bar % tune.length]) {
    if (b === beatInBar) a._note(out, NOTE(n) * bend, at, len * beat * 0.95, voice, vol);
    b += len;
  }
}
const SONGS = {
  waltz: {
    bpm: 138,
    play(a, step, at, beat, out, bend) {
      const bar = Math.floor(step / 3) % 16, k = step % 3;
      const [root, kind] = WALTZ_CHORDS[bar].split(' ');
      const ch = chordOf(root, kind);
      if (k === 0) a._note(out, ch[0] * bend, at, beat * 0.9, TUBA, 0.5);
      else ch.slice(1, 3).forEach((f) => a._note(out, f * 2 * bend, at, beat * 0.5, PAH, 0.16));
      playTune(a, WALTZ_TUNE, bar, k, at, beat, out, CALLIOPE, 0.22, bend);
    },
  },
  lounge: {
    bpm: 76,
    play(a, step, at, beat, out, bend) {
      const bar = Math.floor(step / 4) % 4, k = step % 4;
      const [root, kind] = LOUNGE_CHORDS[bar].split(' ');
      const ch = chordOf(root, kind);
      // the bass walks: root, fifth, root, a step toward the next bar
      const walk = [ch[0], ch[2] / 2, ch[0], ch[0] * Math.pow(2, 2 / 12)];
      a._note(out, walk[k] * bend, at, beat * 0.9, UPRIGHT, 0.45);
      if (k === 0 || k === 2) ch.forEach((f) => a._note(out, f * 2 * bend, at + 0.02, beat * 1.8, KEYS, 0.09));
      playTune(a, LOUNGE_TUNE, bar, k, at, beat, out, KEYS, 0.2, bend);
    },
  },
};

export class Audio {
  constructor() {
    this.ready = false;
    this.ctx = null;
    this.t0 = 0;
    this._blipAt = 0;
    this._coinAt = 0;
    this._chatAt = 0;
    this._beatAt = 0;
    this._stepAt = 0;
    this._beatPhase = 0;
    // which room the ear is in. The slot blips, coin showers and crowd
    // murmur are the CASINO, and they were playing on in the suite and
    // out on an empty highway at dawn.
    this.ambience = 'casino';
  }

  /* ---------------------------------------------------- boot */
  start() {
    if (this.ready) return;
    this._claimSpeaker();
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC());
    this.t0 = ctx.currentTime;

    // ---- master chain -------------------------------------
    const out = (this.out = ctx.createGain());
    out.gain.value = 0.0;
    out.connect(ctx.destination);

    const comp = (this.comp = ctx.createDynamicsCompressor());
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.24;
    comp.connect(out);

    const drive = (this.drive = ctx.createWaveShaper());
    drive.curve = this._curve(0);
    drive.oversample = '2x';
    drive.connect(comp);

    const muffle = (this.muffle = ctx.createBiquadFilter());
    muffle.type = 'lowpass';
    muffle.frequency.value = 18000;
    muffle.Q.value = 0.9;
    // grass: the music gets more vivid too -- air on top, warmth underneath
    const air = (this.air = ctx.createBiquadFilter());
    air.type = 'highshelf'; air.frequency.value = 5200; air.gain.value = 0;
    const warm = (this.warm = ctx.createBiquadFilter());
    warm.type = 'lowshelf'; warm.frequency.value = 180; warm.gain.value = 0;
    muffle.connect(air); air.connect(warm); warm.connect(drive);

    // tilt: as loathing climbs we scoop the mids and boost lows
    const tilt = (this.tilt = ctx.createBiquadFilter());
    tilt.type = 'peaking';
    tilt.frequency.value = 900;
    tilt.Q.value = 0.8;
    tilt.gain.value = 0;
    tilt.connect(muffle);

    this.bus = tilt;

    // ---- reverb -------------------------------------------
    const rev = (this.rev = ctx.createConvolver());
    rev.buffer = this._impulse(2.6, 3.2);
    const revGain = (this.revGain = ctx.createGain());
    revGain.gain.value = 0.42;
    rev.connect(revGain);
    revGain.connect(this.bus);

    this.send = ctx.createGain();
    this.send.gain.value = 1;
    this.send.connect(rev);

    // ---- noise source (shared) ----------------------------
    this.noiseBuf = this._noise(4.0);

    this._buildDrone();
    this._buildRoom();

    // fade in
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 2.5);

    this.ready = true;

    // Safari parks the context in 'interrupted' whenever something else
    // takes the speaker for a moment: the motion-access prompt at the start,
    // a notification, the phone locking. Nothing brings it back on its own,
    // so every touch, click and key, and coming back to the tab, tries again.
    const wake = () => this.resume();
    for (const e of ['pointerdown', 'touchend', 'keydown']) addEventListener(e, wake, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    ctx.onstatechange = () => { if (ctx.state === 'interrupted') wake(); };
  }

  /* An iPhone plays Web Audio as "ambient" sound, which the ring/silent
     switch mutes -- so with the switch on the game was silent, while a
     video on the same page would have played. Asking for the "playback"
     session instead (Safari 16.4 on) plays through the switch, as a game
     or a video does. Older iPhones have no way to ask, but a looping
     silent <audio> element started from the same tap moves the page onto
     the playback session all the same. */
  _claimSpeaker() {
    try {
      if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }
    } catch { /* read-only in some builds: fall through */ }
    if (!/iP(hone|ad|od)/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform))) return;
    try {
      const el = document.createElement('audio');
      el.setAttribute('x-webkit-airplay', 'deny');
      el.preload = 'auto';
      el.loop = true;
      el.src = URL.createObjectURL(new Blob([this._silentWav()], { type: 'audio/wav' }));
      el.play().catch(() => {});
      this._keepAlive = el;
    } catch { /* no element, no harm: the switch just stays in charge */ }
  }

  /* half a second of silence as a WAV file: 8 kHz, 8-bit, mono */
  _silentWav() {
    const n = 4000, b = new DataView(new ArrayBuffer(44 + n));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) b.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); b.setUint32(4, 36 + n, true); str(8, 'WAVE');
    str(12, 'fmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
    b.setUint32(24, 8000, true); b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true);
    str(36, 'data'); b.setUint32(40, n, true);
    for (let i = 0; i < n; i++) b.setUint8(44 + i, 128);
    return b.buffer;
  }

  resume() {
    const ctx = this.ctx;
    // 'interrupted' is Safari's own state, and needs waking as much as 'suspended'
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume()?.catch?.(() => {});
    if (this._keepAlive && this._keepAlive.paused) this._keepAlive.play().catch(() => {});
  }

  /* ------------------------------------------------ builders */
  _curve(amount) {
    const n = 1024, c = new Float32Array(n);
    const k = amount * 60;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return c;
  }

  _noise(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      // cheap pink-ish
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
    }
    return buf;
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    // a big soft room: noise under an exponential tail that gets darker as
    // it goes (a one-pole lowpass closing down), with no flutter in it --
    // the old one was modulated, and every voice came back metallic
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const k = 0.85 - 0.75 * t;
        lp += ((Math.random() * 2 - 1) - lp) * k;
        d[i] = lp * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1);
      }
    }
    return buf;
  }

  /* ---------------------------------------------- drone bed */
  _buildDrone() {
    const ctx = this.ctx;
    const g = (this.droneGain = ctx.createGain());
    g.gain.value = 0.0;

    const lp = (this.droneLP = ctx.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    lp.Q.value = 7;
    lp.connect(g);

    g.connect(this.bus);
    const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(this.send);

    // three detuned saws + a sub
    this.droneOscs = [];
    const base = 55; // A1
    [1, 1.005, 1.497, 0.5].forEach((mul, i) => {
      const o = ctx.createOscillator();
      o.type = i === 3 ? 'sine' : 'sawtooth';
      o.frequency.value = base * mul;
      const og = ctx.createGain();
      og.gain.value = i === 3 ? 0.6 : 0.24;
      o.connect(og); og.connect(lp);
      o.start();
      this.droneOscs.push(o);
    });

    // filter wobble
    const lfo = (this.droneLFO = ctx.createOscillator());
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoAmt = (this.droneLFOAmt = ctx.createGain());
    lfoAmt.gain.value = 90;
    lfo.connect(lfoAmt); lfoAmt.connect(lp.frequency);
    lfo.start();

    // silent until something puts it there — baseline has no drone
  }

  /* ----------------------------------------------- room tone */
  _buildRoom() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;

    // the building breathing: air handling, low and steady. (It was band-
    // passed at 520Hz, which is a hiss, which is wind, which is a horror film.)
    const bp = (this.roomBP = ctx.createBiquadFilter());
    bp.type = 'lowpass';
    bp.frequency.value = 260;
    bp.Q.value = 0.5;

    const g = (this.roomGain = ctx.createGain());
    g.gain.value = 0.028;

    src.connect(bp); bp.connect(g); g.connect(this.bus);
    const s = ctx.createGain(); s.gain.value = 0.7; g.connect(s); s.connect(this.send);
    src.start();
    this.roomSrc = src;
  }

  /* ================================================== voices */

  /** short tonal blip — slot machine payout chirps */
  _blip(freq, dur = 0.09, type = 'square', vol = 0.06, pan = 0) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(g); g.connect(p); p.connect(this.bus);
    const s = ctx.createGain(); s.gain.value = 0.55; p.connect(s); s.connect(this.send);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /** filtered noise burst — coins, shuffles, breath */
  _burst(freq, dur, Q = 4, vol = 0.1, type = 'bandpass', pan = 0) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rnd(0.8, 1.3);
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = Q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(f); f.connect(g); g.connect(p); p.connect(this.bus);
    const s = ctx.createGain(); s.gain.value = 0.6; p.connect(s); s.connect(this.send);
    src.start(t, rnd(0, 3)); src.stop(t + dur + 0.05);
  }

  /** a wordless human utterance, vaguely */
  _mutter(pan = 0, vol = 0.045) {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = rnd(0.5, 1.4);
    const base = rnd(95, 190);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * rnd(0.82, 1.25), t + dur);

    // two formants
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = rnd(400, 800); f1.Q.value = 8;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass'; f2.frequency.value = rnd(1100, 2300); f2.Q.value = 10;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.08);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    // syllable chopper
    const chop = ctx.createOscillator();
    chop.type = 'square'; chop.frequency.value = rnd(3, 7);
    const chopAmt = ctx.createGain(); chopAmt.gain.value = vol * 0.5;
    chop.connect(chopAmt); chopAmt.connect(g.gain);
    chop.start(t); chop.stop(t + dur);

    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(f1); o.connect(f2);
    f1.connect(g); f2.connect(g);
    g.connect(p); p.connect(this.bus);
    const s = ctx.createGain(); s.gain.value = 0.9; p.connect(s); s.connect(this.send);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /* ================================================== events */

  step(speed) {
    this._burst(rnd(110, 190), 0.1, 1.1, 0.055 * speed, 'lowpass', rnd(-0.35, 0.35));
  }

  /** the dose lands */
  dose(kind) {
    const ctx = this.ctx, t = ctx.currentTime;

    // glass + swallow
    this._burst(2600, 0.18, 9, 0.12, 'bandpass');
    this._burst(180, 0.4, 1.4, 0.1, 'lowpass');

    // the come-up, shaped like the drug: depressants fall away from
    // you, stimulants climb, hallucinogens open upward and hang
    const conf = {
      grass:        { f0: 520,  f1: 200,  type: 'sine',     dur: 2.2, vol: 0.14 },
      mescaline:    { f0: 320,  f1: 1900, type: 'triangle', dur: 3.6, vol: 0.18 },
      acid:         { f0: 260,  f1: 2600, type: 'triangle', dur: 5.0, vol: 0.19 },
      cocaine:      { f0: 800,  f1: 2400, type: 'square',   dur: 1.1, vol: 0.16 },
      uppers:       { f0: 600,  f1: 1700, type: 'square',   dur: 1.6, vol: 0.14 },
      downers:      { f0: 600,  f1: 45,   type: 'sine',     dur: 3.4, vol: 0.20 },
      tequila:      { f0: 420,  f1: 140,  type: 'triangle', dur: 1.6, vol: 0.15 },
      ether:        { f0: 900,  f1: 60,   type: 'sine',     dur: 3.2, vol: 0.22 },
      amyls:        { f0: 120,  f1: 900,  type: 'sawtooth', dur: 0.8, vol: 0.22 },
      adrenochrome: { f0: 70,   f1: 1500, type: 'sawtooth', dur: 2.0, vol: 0.20 },
    }[kind] || { f0: 440, f1: 220, type: 'sine', dur: 1.5, vol: 0.14 };

    const o = ctx.createOscillator();
    o.type = conf.type;
    o.frequency.setValueAtTime(conf.f0, t + 0.15);
    o.frequency.exponentialRampToValueAtTime(conf.f1, t + 0.15 + conf.dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + 0.15);
    g.gain.exponentialRampToValueAtTime(conf.vol, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15 + conf.dur);

    // ring modulation for the really bad ones
    if (kind === 'adrenochrome' || kind === 'mescaline' || kind === 'acid') {
      const ring = ctx.createOscillator();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(30, t);
      ring.frequency.exponentialRampToValueAtTime(220, t + conf.dur);
      const rg = ctx.createGain(); rg.gain.value = conf.vol * 0.8;
      ring.connect(rg); rg.connect(g.gain);
      ring.start(t); ring.stop(t + conf.dur + 0.3);
    }

    o.connect(g); g.connect(this.bus);
    const s = ctx.createGain(); s.gain.value = 0.8; g.connect(s); s.connect(this.send);
    o.start(t); o.stop(t + conf.dur + 0.4);

    // momentary duck of the world — everything drops out as it hits
    this.muffle.frequency.cancelScheduledValues(t);
    this.muffle.frequency.setValueAtTime(this.muffle.frequency.value, t);
    this.muffle.frequency.exponentialRampToValueAtTime(220, t + 0.35);
  }

  pickup() {
    this._blip(880, 0.07, 'sine', 0.09);
    setTimeout(() => this._blip(1320, 0.12, 'sine', 0.08), 70);
  }

  /* --------------------------------------------- the joint (src/joint.js) */
  /** a lighter: the wheel, then the flame catching */
  lighter() {
    if (!this.ctx) return;
    this._burst(5200, 0.03, 3, 0.09, 'bandpass');
    setTimeout(() => this._burst(4000, 0.025, 3, 0.06, 'bandpass'), 70);
    setTimeout(() => this._burst(700, 0.5, 0.6, 0.035, 'lowpass'), 140);
  }

  /** drawing on it: paper and leaf crackling, for as long as you pull */
  inhale(on) {
    if (!this.ctx) return;
    clearInterval(this._crackle);
    this._crackle = null;
    if (!on) return;
    this._burst(1800, 0.35, 0.7, 0.03, 'bandpass');
    this._crackle = setInterval(() => {
      if (Math.random() < 0.7) this._burst(rnd(2500, 6000), rnd(0.01, 0.025), 6, rnd(0.02, 0.06), 'bandpass', rnd(-0.1, 0.1));
      if (Math.random() < 0.3) this._burst(1400, 0.18, 0.6, 0.02, 'bandpass');
    }, 55);
  }

  /** a long breath out */
  exhale() {
    if (!this.ctx) return;
    this._burst(900, 1.3, 0.5, 0.05, 'lowpass');
  }

  /** the cough: four or five barks, each a little weaker */
  cough() {
    if (!this.ctx) return;
    const n = 4 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        this._burst(rnd(380, 520), 0.16, 1.4, 0.16 * (1 - i / (n + 2)), 'bandpass');
        this._burst(1400, 0.08, 1, 0.05 * (1 - i / (n + 2)), 'bandpass');
      }, i * rnd(230, 330));
    }
  }

  /** the giggles: short breaths through the nose */
  giggle() {
    if (!this.ctx) return;
    const n = 5 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) {
      setTimeout(() => this._burst(rnd(800, 1100), 0.07, 2.5, 0.05, 'bandpass'), i * rnd(120, 160));
    }
  }

  /** a card off the shoe and onto the felt */
  card() {
    if (!this.ctx) return;
    this._burst(3200, 0.05, 1.2, 0.07, 'highpass', rnd(-0.2, 0.2));
    setTimeout(() => this._burst(900, 0.04, 2, 0.04, 'bandpass'), 35);
  }

  /** clay chips, stacked and pushed */
  chips() {
    if (!this.ctx) return;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this._blip(rnd(2600, 3400), 0.035, 'triangle', 0.035, rnd(-0.2, 0.2)), i * rnd(28, 55));
    }
  }

  /** an option you could not take */
  deny() {
    const ctx = this.ctx, t = ctx.currentTime;
    [104, 110].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'square'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(this.bus);
      o.start(t); o.stop(t + 0.32);
    });
  }

  good() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._blip(f, 0.28, 'triangle', 0.085), i * 85));
  }

  bad() {
    const ctx = this.ctx, t = ctx.currentTime;
    [55, 58.3, 77.8].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      o.connect(g); g.connect(this.bus);
      const s = ctx.createGain(); s.gain.value = 0.8; g.connect(s); s.connect(this.send);
      o.start(t); o.stop(t + 1.4);
    });
  }

  /** fear spike — the room notices you */
  sting() {
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(rnd(700, 2400), t);
      o.frequency.exponentialRampToValueAtTime(rnd(120, 300), t + 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.045, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + rnd(0.5, 1.1));
      o.connect(g); g.connect(this.bus);
      const s = ctx.createGain(); s.gain.value = 1; g.connect(s); s.connect(this.send);
      o.start(t); o.stop(t + 1.2);
    }
  }

  /** the bats */
  bats() {
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 40; i++) {
      setTimeout(() => {
        this._burst(rnd(3000, 9000), rnd(0.03, 0.09), 14, 0.075, 'bandpass', rnd(-1, 1));
      }, i * rnd(30, 120));
    }
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(40, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 3.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 5.2);
  }

  /** blackout — everything collapses into a single tone */
  blackout() {
    const ctx = this.ctx, t = ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.exponentialRampToValueAtTime(0.06, t + 1.6);
    this.out.gain.exponentialRampToValueAtTime(0.9, t + 4.5);

    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    o.connect(g); g.connect(this.comp);
    o.start(t); o.stop(t + 3.6);
  }

  /** somebody else's horn, coming the other way, two notes leaning on it */
  horn(vol = 0.12, pan = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [311, 392].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      // and the Doppler drop as it goes past
      o.frequency.setValueAtTime(f, t + 0.7);
      o.frequency.linearRampToValueAtTime(f * 0.86, t + 1.2);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.03);
      g.gain.setValueAtTime(vol, t + 1.0);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      o.connect(lp); lp.connect(g); g.connect(p); p.connect(this.bus);
      o.start(t); o.stop(t + 1.35);
    });
  }

  /** a two-stroke going past in the dust: a rasp that drops as it goes */
  bike(vol = 0.06, pan = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(210, t);
    o.frequency.linearRampToValueAtTime(230, t + 0.5);
    o.frequency.linearRampToValueAtTime(150, t + 1.1);
    // the rasp: the pitch shaken fast
    const lfo = ctx.createOscillator(); lfo.frequency.value = 38;
    const amt = ctx.createGain(); amt.gain.value = 14;
    lfo.connect(amt); amt.connect(o.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(bp); bp.connect(g); g.connect(p); p.connect(this.bus);
    o.start(t); o.stop(t + 1.45); lfo.start(t); lfo.stop(t + 1.45);
  }

  /** a highway patrol siren: one long wail, up and back down */
  siren(vol = 0.08, pan = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(620, t);
    o.frequency.linearRampToValueAtTime(1250, t + 0.9);
    o.frequency.linearRampToValueAtTime(620, t + 1.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.08);
    g.gain.setValueAtTime(vol, t + 1.7);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.85);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(lp); lp.connect(g); g.connect(p); p.connect(this.bus);
    o.start(t); o.stop(t + 1.9);
  }

  door() { this._burst(140, 0.7, 1.2, 0.14, 'lowpass'); this._blip(90, 0.4, 'sine', 0.1); }

  /** twice, politely, which is worse */
  knock() {
    [0, 190, 900, 1090].forEach((ms) => setTimeout(() => {
      this._burst(160, 0.09, 1.4, 0.34, 'lowpass', -0.6);
      this._blip(72, 0.12, 'sine', 0.16, -0.6);
    }, ms));
  }

  /** a Bell payphone: 440 + 480 Hz, warbled, two seconds on */
  ring(vol = 0.08, pan = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + 1.6);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.7);
    const trem = ctx.createGain(); trem.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 20;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.5;
    lfo.connect(lfoAmt); lfoAmt.connect(trem.gain);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    [440, 480].forEach((f) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      o.connect(trem); o.start(t); o.stop(t + 1.75);
    });
    trem.connect(g);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.bus); } else g.connect(this.bus);
    lfo.start(t); lfo.stop(t + 1.75);
  }

  /** the engine: a low, uneven V8, pitched by how fast you are going. <0 = off */
  engine(level) {
    if (!this.ready) return;
    const ctx = this.ctx, now = ctx.currentTime;
    if (!this._eng) {
      if (level < 0) return;
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 2;
      const oscs = [0, 1].map((i) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = 38 + i * 0.7;
        o.connect(lp); o.start(); return o;
      });
      // wind over an open top, which grows with speed
      const wind = ctx.createBufferSource(); wind.buffer = this.noiseBuf; wind.loop = true;
      const wbp = ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 700; wbp.Q.value = 0.6;
      const wg = ctx.createGain(); wg.gain.value = 0;
      wind.connect(wbp); wbp.connect(wg); wg.connect(this.bus); wind.start();
      lp.connect(g); g.connect(this.bus);
      this._eng = { g, lp, oscs, wg };
    }
    const e = this._eng;
    const on = Math.max(0, level);
    e.oscs.forEach((o, i) => o.frequency.setTargetAtTime(34 + on * 70 + i * 0.7, now, 0.25));
    e.lp.frequency.setTargetAtTime(260 + on * 700, now, 0.3);
    e.g.gain.setTargetAtTime(level < 0 ? 0 : 0.10 + on * 0.10, now, level < 0 ? 0.6 : 0.2);
    e.wg.gain.setTargetAtTime(level < 0 ? 0 : on * 0.09, now, 0.4);
  }

  elevator() {
    const ctx = this.ctx, t = ctx.currentTime;
    this._blip(1568, 0.5, 'sine', 0.1);
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(48, t);
    o.frequency.linearRampToValueAtTime(64, t + 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 1.2);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 14);
    this._elev = { o, g };
  }

  stopElevator() {
    if (!this._elev) return;
    const t = this.ctx.currentTime;
    this._elev.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    this._elev = null;
  }

  /* =================================================== frame */

  /**
   * @param {object} s  live game state
   * @param {number} dt seconds
   */
  update(s, dt) {
    if (!this.ready) return;
    const ctx = this.ctx, now = ctx.currentTime;

    const wreck = s.wreck;          // 0..1 overall chemical load
    // Same deadband the renderer uses: fear idles around 0.06-0.16 from
    // nothing but a crowded room, and that was enough to put an audible
    // heartbeat under a sober player. Nothing here hears fear below 0.22.
    const fear = Math.max(0, (s.fear - 0.22) * 1.282);
    const loathing = s.loathing;    // 0..1

    /* ---- how the ear is being interfered with -------------
       BASELINE IS CLEAN. Sober and calm, the filter is wide open,
       there is no drive, no detune and NO DRONE — you hear the
       casino and nothing else. Every term below starts at zero.

         dim    the depressants take the top off everything and
                push it down the far end of a long room
         blur   drink smears it and wobbles the pitch a little
         psych  detunes and wanders; the drone is the hallucinogen
         rush   opens it up and sharpens it, heart first
    */
    // capped: past 1/0.97 the pow below is NaN, and a NaN here throws and takes the frame with it
    const muffled = Math.min(1, s.dim * 0.80 + s.blur * 0.35);
    const cut = 20000 * Math.pow(1 - muffled * 0.97, 2.6) + 300;
    this.muffle.frequency.setTargetAtTime(cut, now, 0.35);
    this.muffle.Q.setTargetAtTime(0.9 + s.dim * 6, now, 0.4);
    this.air.gain.setTargetAtTime(5 * (s.vivid || 0), now, 0.6);
    this.warm.gain.setTargetAtTime(3 * (s.vivid || 0), now, 0.6);

    // stimulants tilt it bright and hard; loathing scoops it out -- but
    // only once there is real loathing. A little of it is a normal night.
    const sour = Math.max(0, (loathing - 0.35) / 0.65);
    this.tilt.gain.setTargetAtTime(-14 * sour + 6 * s.rush, now, 0.5);

    // dissociation puts you at the wrong end of a hall
    this.revGain.gain.setTargetAtTime(
      0.12 + 0.95 * s.dim + 0.35 * s.psych, now, 0.6);

    const driveAmt = sour * 0.85 + s.monster * 0.5 + s.rush * 0.15;
    if (Math.abs(driveAmt - (this._lastDrive ?? -1)) > 0.05) {
      this.drive.curve = this._curve(driveAmt);
      this._lastDrive = driveAmt;
    }

    // ---- the drone belongs to the hallucinogen, not to the room ----
    const detune = -420 * s.dim + 300 * s.monster
      + 240 * Math.sin(now * 0.3) * s.psych;
    this.droneOscs.forEach((o, i) => {
      o.detune.setTargetAtTime(detune + (i === 1 ? 14 : 0), now, 0.5);
    });
    this.droneLP.frequency.setTargetAtTime(
      340 + 900 * fear + 700 * s.monster, now, 0.5);
    this.droneLFO.frequency.setTargetAtTime(
      0.07 + 2.2 * s.dim + 1.4 * s.psych, now, 0.5);
    this.droneLFOAmt.gain.setTargetAtTime(90 + 520 * s.psych, now, 0.5);
    this.droneGain.gain.setTargetAtTime(
      0.26 * s.psych + 0.22 * s.dim + 0.30 * s.monster
      + 0.16 * Math.max(0, fear - 0.45) + 0.10 * sour, now, 0.8);

    // the room itself stays the room
    this.roomBP.frequency.setTargetAtTime(260 - 120 * muffled, now, 0.6);
    this.roomGain.gain.setTargetAtTime(0.028 + 0.05 * fear, now, 0.6);  // room tone is the room, not a symptom

    const T = now;

    // ---- casino chatter & machines ------------------------
    const near = s.crowdNear; // 0..1 how close to the floor/people
    const casino = this.ambience === 'casino';
    // the convention has no machines in it, only people talking about you
    const murmur = casino || this.ambience === 'convention';
    if (!casino) { this._blipAt = this._coinAt = T + 0.5; }
    if (!murmur) this._chatAt = T + 0.5;
    // electromechanical slots, the 1971 kind: a lever, three reels
    // whirring, three clunks, and now and then the coins or the bell
    if (T > this._blipAt) {
      this._blipAt = T + rnd(1.2, 4.5) / (0.3 + near);
      this._slotPull(rnd(-0.9, 0.9), 0.5 * (0.3 + near), wreck);
    }
    // the crowd: a bed of people talking, not a stream of syllables
    this._crowd(murmur ? (0.25 + 0.75 * near) * (1 + fear * 0.5) : 0, now);
    if (murmur && T > this._chatAt) {
      this._chatAt = T + rnd(6, 16) / (0.3 + near);
      if (Math.random() < 0.6) this._laugh(rnd(-0.9, 0.9), 0.03 * (0.3 + near));
    }
    // and the music: the carousel's band out on the floor, soft keys in the lounge
    this._music(now, s);

    // ---- heartbeat ----------------------------------------
    // the heart is the stimulant's signature, and amyls are all heart
    const beatRate = 0.85 + fear * 2.1 + s.rush * 2.2;
    const beatVol = fear * 0.34 + s.rush * 0.34;   // silent at rest
    this._beatPhase += dt * beatRate;
    if (this._beatPhase >= 1) {
      this._beatPhase -= 1;
      // a heart you cannot hear is not a heart, and an exponential ramp
      // from a zero gain is undefined anyway
      if (beatVol > 0.004) {
        this._thump(beatVol);
        setTimeout(() => this._thump(beatVol * 0.62), 175 / beatRate);
      }
    }

    // ---- footsteps ----------------------------------------
    if (s.moving && T > this._stepAt) {
      this._stepAt = T + (0.52 / Math.max(0.35, s.speed)) * (1 + (1 - s.motor) * 0.6);
      this.step(Math.min(1.2, s.speed));
    }
  }

  /* ================================================ the casino, sober
     What the floor actually sounds like, before anything is wrong with you.
     The machines are electromechanical, as they were in 1971: no beeps. */

  /** a short metallic or wooden knock: noise through a narrow band */
  _knock(freq, dur, vol, pan, q = 6, at = 0) {
    const ctx = this.ctx, t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(f); f.connect(g); g.connect(p); p.connect(this.bus);
    const sd = ctx.createGain(); sd.gain.value = 0.3; p.connect(sd); sd.connect(this.send);
    src.start(t, rnd(0, 3)); src.stop(t + dur + 0.05);
  }

  /** a struck metal partial: coins, bells */
  _ping(freq, dur, vol, pan, at = 0) {
    const ctx = this.ctx, t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(g); g.connect(p); p.connect(this.bus);
    const sd = ctx.createGain(); sd.gain.value = 0.35; p.connect(sd); sd.connect(this.send);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /** somebody somewhere pulls a handle */
  _slotPull(pan, vol, wreck = 0) {
    const ctx = this.ctx, t = ctx.currentTime;
    // the handle: a clack and the ratchet coming back up
    this._knock(1600, 0.05, vol * 0.5, pan, 4);
    for (let i = 0; i < 5; i++) this._knock(2600, 0.02, vol * 0.18, pan, 8, 0.05 + i * 0.045);
    // the reels: a whirr with the teeth ticking in it
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 * (1 - wreck * 0.3); bp.Q.value = 1.4;
    const g = ctx.createGain();
    const spin = 1.0 + Math.random() * 0.5;
    g.gain.setValueAtTime(0, t + 0.25);
    g.gain.linearRampToValueAtTime(vol * 0.22, t + 0.35);
    g.gain.setValueAtTime(vol * 0.22, t + 0.25 + spin);
    g.gain.linearRampToValueAtTime(0, t + 0.6 + spin);
    const trem = ctx.createOscillator(); trem.frequency.value = 26;
    const tg = ctx.createGain(); tg.gain.value = vol * 0.12;
    trem.connect(tg); tg.connect(g.gain);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(bp); bp.connect(g); g.connect(p); p.connect(this.bus);
    src.start(t + 0.25, rnd(0, 3)); src.stop(t + 0.7 + spin);
    trem.start(t + 0.25); trem.stop(t + 0.7 + spin);
    // three reels stopping, one after another
    for (let r = 0; r < 3; r++) {
      const at = 0.25 + spin * (0.55 + r * 0.22);
      this._knock(240, 0.09, vol * 0.55, pan, 2, at);
      this._knock(1900, 0.025, vol * 0.25, pan, 6, at);
    }
    const end = 0.3 + spin;
    const roll = Math.random();
    if (roll < 0.015) this._bell(pan, vol * 0.6, end);          // a jackpot: the bell
    else if (roll < 0.14) this._coins(pan, vol, end);           // a small one: coins in the tray
  }

  /** coins dropping into a steel tray */
  _coins(pan, vol, at = 0) {
    const n = 6 + ((Math.random() * 14) | 0);
    let when = at;
    for (let i = 0; i < n; i++) {
      when += rnd(0.035, 0.08);
      this._ping(rnd(2800, 4200), 0.12, vol * 0.1, pan, when);
      this._ping(rnd(5600, 7400), 0.06, vol * 0.05, pan, when);
      this._knock(5000, 0.015, vol * 0.08, pan, 3, when);
    }
  }

  /** the jackpot bell: an electric bell ringing for a couple of seconds */
  _bell(pan, vol, at = 0) {
    for (let i = 0; i < 26; i++) {
      const w = at + i * 0.075;
      this._ping(1180, 0.16, vol * 0.16, pan, w);
      this._ping(1180 * 2.76, 0.1, vol * 0.06, pan, w);
      this._ping(1180 * 5.4, 0.05, vol * 0.03, pan, w);
    }
    this._coins(pan, vol * 1.3, at + 0.4);
  }

  /** the crowd: five people talking at once, somewhere out on the floor.
      Shaped noise through two vowel formants, with a level that moves the
      way speech does -- phrases and pauses -- rather than a chopped tone. */
  _crowd(level, now) {
    const ctx = this.ctx;
    if (!this._talkers) {
      const bus = (this._crowdBus = ctx.createGain());
      bus.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      bus.connect(lp); lp.connect(this.bus);
      const sd = ctx.createGain(); sd.gain.value = 0.45; lp.connect(sd); sd.connect(this.send);
      this._talkers = [];
      for (let i = 0; i < 6; i++) {
        const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 2.2;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 3.0;
        const g = ctx.createGain(); g.gain.value = 0;
        const p = ctx.createStereoPanner(); p.pan.value = rnd(-0.85, 0.85);
        src.connect(f1); src.connect(f2); f1.connect(g); f2.connect(g); g.connect(p); p.connect(bus);
        src.start(0, rnd(0, 3.9));
        // a voice: lower or higher, and its own pace
        const low = Math.random() < 0.5;
        this._talkers.push({ f1, f2, g, low, next: 0, talking: Math.random() < 0.6, until: now + rnd(1, 4) });
      }
    }
    this._crowdBus.gain.setTargetAtTime(level * 0.55, now, 0.8);
    if (level <= 0.001) return;
    for (const v of this._talkers) {
      if (now > v.until) { v.talking = !v.talking; v.until = now + (v.talking ? rnd(1.5, 5) : rnd(0.5, 2.5)); }
      if (now < v.next) continue;
      // syllables: four to six a second, each a vowel of its own
      v.next = now + rnd(0.13, 0.26);
      const amp = v.talking ? Math.pow(Math.random(), 1.5) * 0.5 : 0;
      v.g.gain.setTargetAtTime(amp, now, 0.04);
      v.f1.frequency.setTargetAtTime((v.low ? 420 : 560) + rnd(0, 320), now, 0.03);
      v.f2.frequency.setTargetAtTime((v.low ? 1050 : 1350) + rnd(0, 900), now, 0.03);
    }
  }

  /** a laugh from across the room */
  _laugh(pan, vol) {
    const n = 3 + ((Math.random() * 4) | 0);
    const f = rnd(550, 900);
    for (let i = 0; i < n; i++) {
      const at = i * rnd(0.14, 0.2);
      this._knock(f * (1 - i * 0.03), 0.11, vol * (1 - i * 0.1), pan, 3, at);
      this._knock(f * 2.2, 0.08, vol * 0.4 * (1 - i * 0.1), pan, 4, at);
    }
  }

  /* ---------------------------------------------- the music
     Two small bands, both original tunes and both far enough off to be
     background: on the floor, the carousel's band -- a waltz on something
     like a calliope, oom-pah-pah under it -- getting louder as you get
     near the bar; in the lounge, soft keys and a bass over a ii-V. main.js
     says which, and how close (musicSong, musicNear). The drugs do to it
     what they do to everything else, because it goes through the same bus. */
  _music(now, s) {
    const ctx = this.ctx;
    if (!this._mus) {
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = 0.5;
      g.connect(lp); lp.connect(this.bus);
      const sd = ctx.createGain(); sd.gain.value = 0.5; lp.connect(sd); sd.connect(this.send);
      this._mus = { g, lp, song: null, step: 0, at: 0 };
    }
    const M = this._mus;
    const song = SONGS[this.musicSong] || null;
    const near = song ? Math.max(0, Math.min(1, this.musicNear ?? 0)) : 0;
    M.g.gain.setTargetAtTime(song ? 0.05 + 0.13 * near : 0, now, 0.8);
    // further off is duller as well as quieter
    M.lp.frequency.setTargetAtTime(900 + 3200 * near, now, 0.8);
    if (!song) { M.song = null; return; }
    if (M.song !== this.musicSong) { M.song = this.musicSong; M.step = 0; M.at = now + 0.1; }
    // schedule a little ahead, one beat at a time
    const beat = 60 / song.bpm;
    // ether and downers slow the band down; the stimulants do not speed it up
    const drag = 1 + 0.25 * (s.dim || 0);
    // the hallucinogens pull it off pitch, a little
    const bend = 1 + 0.03 * Math.sin(now * 0.7) * (s.psych || 0);
    // after a stall (a hidden tab, a long frame) pick the tune up from now
    // rather than firing every missed beat at once
    if (M.at < now - 0.5) M.at = now + 0.05;
    while (M.at < now + 0.6) {
      song.play(this, M.step, M.at, beat * drag, M.g, bend);
      M.step++;
      M.at += beat * drag;
    }
  }

  /** one note of the band: a voice is a recipe of partials and an envelope */
  _note(out, freq, at, dur, voice, vol) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + voice.atk);
    if (voice.decay) g.gain.exponentialRampToValueAtTime(vol * 0.0005 + 0.00001, at + dur * voice.decay + voice.atk);
    else { g.gain.setValueAtTime(vol, at + Math.max(voice.atk, dur - 0.06)); g.gain.linearRampToValueAtTime(0, at + dur); }
    g.connect(out);
    for (const [mul, amp, type] of voice.parts) {
      const o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq * mul;
      if (voice.vib) {
        const l = ctx.createOscillator(); l.frequency.value = 5.6;
        const la = ctx.createGain(); la.gain.value = freq * mul * voice.vib;
        l.connect(la); la.connect(o.frequency); l.start(at); l.stop(at + dur + 0.1);
      }
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g);
      o.start(at); o.stop(at + dur + 0.1);
    }
  }

  _thump(vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(96, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(this.comp);
    o.start(t); o.stop(t + 0.34);
  }
}
