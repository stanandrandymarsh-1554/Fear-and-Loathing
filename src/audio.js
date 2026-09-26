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
    muffle.connect(drive);

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
    rev.buffer = this._impulse(3.4, 2.6);
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
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) *
               (1 - 0.35 * Math.sin(t * 40 + ch));
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

    const bp = (this.roomBP = ctx.createBiquadFilter());
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.6;

    const g = (this.roomGain = ctx.createGain());
    g.gain.value = 0.055;

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

    // stimulants tilt it bright and hard; loathing scoops it out
    this.tilt.gain.setTargetAtTime(-14 * loathing + 6 * s.rush, now, 0.5);

    // dissociation puts you at the wrong end of a hall
    this.revGain.gain.setTargetAtTime(
      0.12 + 0.95 * s.dim + 0.35 * s.psych, now, 0.6);

    const driveAmt = loathing * 0.85 + s.monster * 0.5 + s.rush * 0.15;
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
      + 0.16 * Math.max(0, fear - 0.45) + 0.10 * loathing, now, 0.8);

    // the room itself stays the room
    this.roomBP.frequency.setTargetAtTime(520 - 260 * muffled, now, 0.6);
    this.roomGain.gain.setTargetAtTime(0.055 + 0.07 * fear, now, 0.6);  // room tone is the room, not a symptom

    const T = now;

    // ---- casino chatter & machines ------------------------
    const near = s.crowdNear; // 0..1 how close to the floor/people
    const casino = this.ambience === 'casino';
    // the convention has no machines in it, only people talking about you
    const murmur = casino || this.ambience === 'convention';
    if (!casino) { this._blipAt = this._coinAt = T + 0.5; }
    if (!murmur) this._chatAt = T + 0.5;
    if (T > this._blipAt) {
      this._blipAt = T + rnd(0.1, 0.55) / (0.35 + near);
      const scale = [262, 294, 330, 392, 440, 523, 587, 659];
      const f = scale[(Math.random() * scale.length) | 0] *
                (Math.random() < 0.4 ? 2 : 1) *
                (1 - wreck * 0.28);
      this._blip(f, rnd(0.05, 0.18), Math.random() < 0.5 ? 'square' : 'triangle',
                 0.045 * (0.3 + near), rnd(-0.9, 0.9));
    }

    if (T > this._coinAt) {
      this._coinAt = T + rnd(2.5, 9) / (0.3 + near);
      const n = 6 + ((Math.random() * 16) | 0);
      const pan = rnd(-0.9, 0.9);
      for (let i = 0; i < n; i++) {
        setTimeout(() => this._burst(rnd(2200, 6500), 0.05, 10,
                   0.05 * (0.3 + near), 'bandpass', pan), i * rnd(25, 70));
      }
    }

    if (T > this._chatAt) {
      this._chatAt = T + rnd(0.7, 3.2) / (0.25 + near);
      this._mutter(rnd(-1, 1), 0.035 * (0.3 + near) * (1 + fear));
    }

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
