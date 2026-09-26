/* ============================================================
   BLACKJACK — the tables in the east pit, played for real.

   The rules are the ordinary Strip rules of the period, so that the
   game underneath is a fair one and anything strange about it is you:
   six decks in a shoe, dealer stands on all 17s, blackjack pays 3 to 2,
   double on any first two cards, split a pair once (split aces take one
   card each), the dealer peeks for blackjack under an ace or a ten.

   What you are on changes what you can do at it, never the cards:
     NERVE       how much you dare push out. $5 to $100.
     PERCEPTION  enough of it and the dealer's hole card is not quite
                 face down any more. Paranoia makes what you see through
                 it a guess -- acid shows you a card, and sometimes the
                 wrong one.
     COMPOSURE   when it goes, the numbers on the cards will not hold
                 still and you stop being able to add them up.
     MOTOR       ether and downers: the hand that means "stand" waves
                 across the felt, and the dealer takes it as a hit.
     JITTER      cocaine and uppers: a clock on every decision, and when
                 it runs out you tap the felt whether you meant to or not.
     And win enough and the pit boss notices, the way they do.
   ============================================================ */

const BETS = [5, 10, 25, 50, 100];
const BET_NERVE = [0, 0, 0.30, 0.50, 0.70];
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const ODD_SUITS = ['☿', '♄', '☥', '⚚'];
const DECKS = 6;
const HEAT_LIMIT = 500;          // up this much at the tables and the pit boss comes over
const SEE_HOLE = 0.6;            // perception to see through the hole card

const val = (c) => (c.r === 1 ? 11 : Math.min(10, c.r));

export function handTotal(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += val(c); if (c.r === 1) aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { total: t, soft: aces > 0 && t <= 21 };
}
const isBJ = (cards) => cards.length === 2 && handTotal(cards).total === 21;

const LINES = {
  sit: ['Five dollar minimum. Cards are coming out of a six-deck shoe, sir.',
    'Good evening. Place your bet in the circle.',
    'The chair is yours. The house would like your money in the circle.'],
  win: ['Winner.', 'Pays you.', 'There you go, sir.', 'Nice hand.'],
  lose: ['House.', 'Sorry, sir.', 'Dealer has it.', 'That one is mine.'],
  push: ['Push. Nobody wins.', 'A tie. It stays in the circle.'],
  bust: ['Too many.', 'Over. Sorry, sir.', 'That is a bust.'],
  bj: ['Blackjack. Three to two.', 'Blackjack! Pays one and a half.'],
  dealerBJ: ['Dealer has blackjack.', 'Sorry. Blackjack.'],
  lizard: ['The dealer blinks sideways. Place your bet.',
    'Something with a very long tongue is dealing the cards now.',
    'Its scales catch the light when it flips your card.'],
};
const pick = (a) => a[(Math.random() * a.length) | 0];
/** dollars, and cents only when there are any: a blackjack on $5 pays $7.50 */
export const cash = (n) => '$' + (n % 1 ? n.toFixed(2) : String(n));

export class Blackjack {
  constructor(game, audio) {
    this.game = game;
    this.audio = audio;
    this.el = document.getElementById('table');
    this.shoe = [];
    this.table = null;
    this.phase = 'bet';        // bet · deal · play · dealer · done
    this.hands = [];
    this.active = 0;
    this.dealer = [];
    this.holeUp = false;
    this.ghost = null;          // what you think the hole card is
    this.betIx = 0;
    this.queue = [];
    this.wait = 0;
    this.clock = 0;             // the jitter clock, when there is one
    this.clockMax = 0;
    this.repaint = 0;
    this.msg = '';
    this.note = '';             // what your own body just did
    this.net = 0;               // across the whole night
    this.sessionHands = 0;       // since you sat down this time
    this.sessionFrom = 0;
    this.barred = false;
    // the frame is built once: rebuilt on every paint, its slide-in (and
    // every card's) replayed each time a card came out, and a tap landing
    // mid-slide missed the button
    this.el.innerHTML = '<div class="bj-frame"></div>';
    this.frame = this.el.firstChild;
    this.shown = {};            // cards already on screen, per row: only new ones fly in
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-bj]');
      if (b) this.action(b.dataset.bj);
    });
  }

  get seated() { return !!this.table; }
  /** mid-hand: you cannot just walk off with your money in the circle */
  get busy() { return this.phase === 'deal' || this.phase === 'play' || this.phase === 'dealer'; }

  get lizard() { const f = this.game.fx; return f.monster > 0.2 || f.psych > 0.55; }

  maxBetIx() {
    const n = this.game.nerve;
    let ix = 0;
    BET_NERVE.forEach((need, i) => { if (n >= need) ix = i; });
    return ix;
  }

  sit(table) {
    this.table = table;
    this.phase = 'bet';
    this.hands = []; this.dealer = [];
    this.note = '';
    this.sessionHands = 0;
    this.sessionFrom = this.net;
    this.betIx = Math.min(this.betIx, this.maxBetIx());
    this.msg = this.lizard ? pick(LINES.lizard) : pick(LINES.sit);
    this.el.classList.remove('hidden');
    document.body.classList.add('at-table');
    this.paint();
  }

  leave() {
    if (!this.table) return;
    this.table = null;
    this.queue = [];
    this.clockMax = 0;
    this.el.classList.add('hidden');
    document.body.classList.remove('at-table');
  }

  /** a blackout, or anything else that takes you out of the chair */
  forfeit() {
    if (this.busy) this.hands.forEach((h) => { this._book(-h.bet, false); });
    this.phase = 'bet';
    this.leave();
  }

  /* ---------------------------------------------------- input */
  key(code) {
    if (!this.table || this.game.dlg) return false;
    const map = {
      KeyH: 'hit', KeyS: 'stand', KeyD: 'double', KeyP: 'split',
      Space: 'deal', Enter: 'deal', ArrowLeft: 'less', ArrowRight: 'more',
      ArrowDown: 'less', ArrowUp: 'more', Minus: 'less', Equal: 'more',
    };
    if (!map[code]) return false;
    this.action(map[code]);
    return true;
  }

  action(a) {
    if (!this.table || this.game.dlg || this.game.over) return;
    if (a === 'less' || a === 'more') {
      if (this.phase !== 'bet' && this.phase !== 'done') return;
      const ix = this.betIx + (a === 'more' ? 1 : -1);
      if (ix < 0 || ix >= BETS.length) return;
      if (ix > this.maxBetIx()) {
        this.audio.deny();
        this.msg = `You cannot make your hand push out $${BETS[ix]}. NERVE `
          + `${Math.floor(this.game.nerve * 100)}/${Math.round(BET_NERVE[ix] * 100)}`;
        this.paint();
        return;
      }
      this.betIx = ix;
      this.audio.chips?.();
      this.paint();
      return;
    }
    if (a.startsWith('bet')) {
      const ix = +a.slice(3);
      if (ix > this.maxBetIx()) { this.betIx = ix - 1; this.action('more'); return; }
      this.betIx = ix; this.audio.chips?.(); this.paint();
      return;
    }
    if (a === 'deal') return this.deal();
    if (a === 'up') return this.getUp?.();
    if (this.phase !== 'play') return;
    if (a === 'stand') {
      // the hand says one thing and does another
      const lost = 1 - this.game.motor;
      if (lost > 0.25 && Math.random() < lost * 0.3) {
        this.note = 'Your hand waves across the felt. The dealer takes it as a hit.';
        return this._hit(true);
      }
      return this._stand();
    }
    if (a === 'hit') return this._hit();
    if (a === 'double') return this._double();
    if (a === 'split') return this._split();
  }

  /* ---------------------------------------------------- the shoe */
  _draw() {
    if (!this.shoe.length) this._shuffle();
    return this.shoe.pop();
  }
  _shuffle() {
    const s = [];
    for (let d = 0; d < DECKS; d++) for (let su = 0; su < 4; su++) for (let r = 1; r <= 13; r++) s.push({ r, s: su });
    for (let i = s.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [s[i], s[j]] = [s[j], s[i]];
    }
    this.shoe = s;
  }

  /* ---------------------------------------------------- a round */
  deal() {
    if (this.phase !== 'bet' && this.phase !== 'done') return;
    if (this.barred) { this.audio.deny(); this.msg = 'The pit boss is still standing there.'; this.paint(); return; }
    if (this.betIx > this.maxBetIx()) this.betIx = this.maxBetIx();
    const bet = BETS[this.betIx];
    if (this.game.money < bet) {
      this.audio.deny();
      this.msg = this.game.money < BETS[0] ? 'You are out of money.' : `You do not have $${bet}.`;
      this.paint();
      return;
    }
    // the cut card: a fresh shoe once three quarters of it is gone
    if (this.shoe.length < DECKS * 52 * 0.25) {
      this._shuffle();
      this.msg = 'The dealer shuffles up. It takes a long time, and you watch all of it.';
    } else this.msg = '';
    this.note = '';
    this.game.money -= bet;
    this.game._paintHUD();
    this.audio.chips?.();
    this.hands = [{ cards: [], bet, done: false, doubled: false, split: false }];
    this.active = 0;
    this.dealer = [];
    this.holeUp = false;
    this.phase = 'deal';
    const h = this.hands[0];
    this.queue = [
      () => h.cards.push(this._draw()),
      () => this.dealer.push(this._draw()),
      () => h.cards.push(this._draw()),
      () => { this.dealer.push(this._draw()); this._hole(); },
      () => this._afterDeal(),
    ];
    this.wait = 0.15;
    this.paint();
  }

  // what you think is under there, if you can see through it at all
  _hole() {
    const g = this.game;
    this.ghost = null;
    if (g.perception < SEE_HOLE) return;
    const lie = Math.random() < Math.min(0.5, g.paranoia * 0.45);
    const real = this.dealer[1];
    this.ghost = lie ? { r: 1 + ((Math.random() * 13) | 0), s: real.s } : real;
  }

  _afterDeal() {
    const up = this.dealer[0];
    const h = this.hands[0];
    // the peek: under an ace or a ten the dealer looks, and a blackjack ends it
    if ((up.r === 1 || val(up) === 10) && isBJ(this.dealer)) {
      this.holeUp = true;
      this._settle();
      return;
    }
    if (isBJ(h.cards)) { this.holeUp = true; this._settle(); return; }
    this.phase = 'play';
    this._startClock();
  }

  _startClock() {
    const j = this.game.jitter;
    this.clockMax = j > 0.45 ? Math.max(2.5, 7 - j * 3) : 0;
    this.clock = this.clockMax;
  }

  get hand() { return this.hands[this.active]; }

  _hit(fumbled = false) {
    const h = this.hand;
    h.cards.push(this._draw());
    this.audio.card?.();
    if (!fumbled) this.note = '';
    const t = handTotal(h.cards).total;
    if (t > 21) { this.msg = pick(LINES.bust); h.done = true; h.bust = true; return this._next(); }
    if (t === 21) { h.done = true; return this._next(); }
    this._startClock();
    this.paint();
  }

  _stand() { this.hand.done = true; this._next(); }

  _double() {
    const h = this.hand;
    if (h.cards.length !== 2) { this.audio.deny(); return; }
    if (this.game.money < h.bet) { this.audio.deny(); this.msg = 'Not enough in front of you to double.'; this.paint(); return; }
    this.game.money -= h.bet;
    this.game._paintHUD();
    h.bet *= 2; h.doubled = true;
    this.audio.chips?.();
    h.cards.push(this._draw());
    this.audio.card?.();
    if (handTotal(h.cards).total > 21) h.bust = true;
    h.done = true;
    this._next();
  }

  _canSplit() {
    const h = this.hand;
    return this.phase === 'play' && this.hands.length === 1 && h.cards.length === 2
      && val(h.cards[0]) === val(h.cards[1]) && this.game.money >= h.bet;
  }

  _split() {
    if (!this._canSplit()) { this.audio.deny(); return; }
    const h = this.hand;
    this.game.money -= h.bet;
    this.game._paintHUD();
    this.audio.chips?.();
    const aces = h.cards[0].r === 1;
    const b = { cards: [h.cards.pop()], bet: h.bet, done: false, doubled: false, split: true };
    h.split = true;
    h.cards.push(this._draw());
    b.cards.push(this._draw());
    this.hands.push(b);
    this.audio.card?.();
    // split aces get one card each and that is all
    if (aces) { h.done = b.done = true; return this._next(); }
    if (handTotal(h.cards).total === 21) { h.done = true; return this._next(); }
    this._startClock();
    this.paint();
  }

  _next() {
    this.clockMax = 0;
    const i = this.hands.findIndex((h) => !h.done);
    if (i >= 0) {
      this.active = i;
      if (handTotal(this.hand.cards).total === 21) { this.hand.done = true; return this._next(); }
      this._startClock();
      this.paint();
      return;
    }
    // the dealer's turn: only if there is anything left to beat
    this.phase = 'dealer';
    this.queue = [() => { this.holeUp = true; }];
    if (this.hands.some((h) => !h.bust)) this.queue.push(() => this._dealerStep());
    else this.queue.push(() => this._settle());
    this.wait = 0.45;
    this.paint();
  }

  _dealerStep() {
    if (handTotal(this.dealer).total < 17) {
      this.dealer.push(this._draw());
      this.queue.push(() => this._dealerStep());
    } else this._settle();
  }

  _settle() {
    const g = this.game;
    const d = handTotal(this.dealer).total;
    const dBJ = isBJ(this.dealer);
    let back = 0, staked = 0, line = '';
    for (const h of this.hands) {
      staked += h.bet;
      const t = handTotal(h.cards).total;
      const bj = !h.split && isBJ(h.cards);
      if (h.bust) { h.out = 'BUST'; line = line || pick(LINES.bust); continue; }
      if (bj && !dBJ) { back += h.bet * 2.5; h.out = 'BLACKJACK'; line = pick(LINES.bj); continue; }
      if (dBJ && !bj) { h.out = 'LOSE'; line = pick(LINES.dealerBJ); continue; }
      if (bj && dBJ) { back += h.bet; h.out = 'PUSH'; line = line || pick(LINES.push); continue; }
      if (d > 21 || t > d) { back += h.bet * 2; h.out = 'WIN'; line = line || pick(LINES.win); continue; }
      if (t === d) { back += h.bet; h.out = 'PUSH'; line = line || pick(LINES.push); continue; }
      h.out = 'LOSE'; line = line || pick(LINES.lose);
    }
    // a $5 blackjack pays $7.50: the dealer has a half-dollar for exactly this
    g.money += back;
    const net = back - staked;
    this._book(net, true);
    this.phase = 'done';
    this.clockMax = 0;
    this.msg = line + (net > 0 ? `  +${cash(net)}` : net < 0 ? `  −${cash(-net)}` : '');

    if (net > 0) {
      this.audio.pickup();
      g.loathing = Math.max(0, g.loathing - Math.min(0.04, net / 2500));
    } else if (net < 0) {
      this.audio.deny();
      // losing real money in front of people costs you something
      if (-net >= 50) g.fear = Math.min(1, g.fear + 0.04 * (-net / 50) * (1 + g.paranoia * 0.5));
    }
    if (this.hands.some((h) => h.out === 'BLACKJACK')) g.toast('BLACKJACK  +' + cash(net), 'good');

    // up enough and a man in a suit with no drink in his hand appears
    if (this.net >= HEAT_LIMIT && !this.barred) {
      this.barred = true;
      g.fear = Math.min(1, g.fear + 0.12);
      this.audio.sting?.();
      this.msg = 'A man in a good suit with no drink in his hand is standing behind your chair. '
        + '"The house would like you to take a break from the tables, sir." He means for good.';
      g.toast('THE PIT BOSS', 'warn');
    }
    g._paintHUD();
    this.paint();
  }

  _book(net, played) {
    this.net += net;
    this.game.tableNet = this.net;
    if (played) {
      this.sessionHands++;
      this.game.handsPlayed = (this.game.handsPlayed || 0) + 1;
    }
  }

  /* ---------------------------------------------------- per frame */
  update(dt) {
    if (!this.table) return;
    // it all goes slower on something that slows the clock
    const k = 1 / (1 + this.game.slowClock * 0.5);
    if (this.queue.length) {
      this.wait -= dt * k;
      if (this.wait <= 0) {
        const step = this.queue.shift();
        const before = this.dealer.length + this.hands.reduce((n, h) => n + h.cards.length, 0);
        step();
        const after = this.dealer.length + this.hands.reduce((n, h) => n + h.cards.length, 0);
        if (after > before) this.audio.card?.();
        this.wait = 0.42;
        this.paint();
      }
      return;
    }
    if (this.phase === 'play' && this.clockMax) {
      this.clock -= dt * k;
      const bar = this.el.querySelector('.bj-clock i');
      if (bar) bar.style.width = Math.max(0, this.clock / this.clockMax * 100) + '%';
      if (this.clock <= 0) {
        this.note = 'You cannot stand it. Your finger taps the felt.';
        this._hit(true);
        return;
      }
    }
    // numbers that will not hold still: repaint now and then while garbled
    if (this.game.garbleAmount > 0.2) {
      this.repaint -= dt;
      if (this.repaint <= 0) { this.repaint = 0.7; this.paint(); }
    }
  }

  /* ---------------------------------------------------- drawing */
  _card(c, i, opts = {}) {
    const g = this.game;
    const amt = g.garbleAmount;
    const fly = opts.row && i >= (this.shown[opts.row] || 0) ? ' fly' : '';
    if (opts.back) {
      const peek = opts.ghost ? `<span class="ghost">${RANKS[opts.ghost.r]}</span>` : '';
      return `<div class="card back${fly}">${peek}</div>`;
    }
    // the rank drifts while you are too far gone to hold it
    let r = RANKS[c.r];
    if (amt > 0.2 && Math.random() < amt * 0.45) r = RANKS[1 + ((Math.random() * 13) | 0)];
    const suit = (this.lizard ? ODD_SUITS : SUITS)[c.s];
    const red = c.s === 1 || c.s === 2;
    return `<div class="card${red ? ' red' : ''}${fly}"><b>${r}</b><i>${suit}</i></div>`;
  }

  _total(cards, hide) {
    if (hide) return '<span class="tot">?</span>';
    // past a certain point you cannot add, and nobody at the table will do it for you
    if (this.game.garbleAmount > 0.3) return '<span class="tot">??</span>';
    const { total, soft } = handTotal(cards);
    return `<span class="tot">${soft && total < 21 ? `${total - 10}/${total}` : total}</span>`;
  }

  paint() {
    if (!this.table) return;
    const g = this.game;
    const deal = this.dealer.map((c, i) => (i === 1 && !this.holeUp
      ? this._card(c, i, { back: true, ghost: this.ghost, row: 'd' }) : this._card(c, i, { row: 'd' }))).join('');
    const dTot = this.dealer.length ? this._total(this.holeUp ? this.dealer : this.dealer.slice(0, 1)) : '';

    const hands = this.hands.map((h, hi) => {
      const on = this.phase === 'play' && hi === this.active && this.hands.length > 1;
      return `<div class="bj-hand${on ? ' on' : ''}">`
        + `<div class="cards">${h.cards.map((c, i) => this._card(c, i, { row: 'h' + hi })).join('')}</div>`
        + (h.cards.length ? this._total(h.cards) : '')
        + `<span class="stake">$${h.bet}${h.doubled ? ' ×2' : ''}</span>`
        + (h.out ? `<span class="out ${h.out.toLowerCase()}">${h.out}</span>` : '')
        + '</div>';
    }).join('');

    const maxIx = this.maxBetIx();
    const betting = this.phase === 'bet' || this.phase === 'done';
    const btn = (id, label, key, ok = true) =>
      `<button data-bj="${id}" class="${ok ? '' : 'off'}"><kbd>${key}</kbd>${label}</button>`;
    let controls;
    if (betting) {
      controls = '<div class="chips">' + BETS.map((b, i) => {
        const locked = i > maxIx;
        return `<button data-bj="bet${i}" class="chip c${i}${i === this.betIx ? ' sel' : ''}${locked ? ' off' : ''}">`
          + `$${b}${locked ? `<small>NERVE ${Math.floor(g.nerve * 100)}/${Math.round(BET_NERVE[i] * 100)}</small>` : ''}</button>`;
      }).join('') + '</div>'
        + btn('deal', `DEAL $${BETS[this.betIx]}`, 'SPACE', !this.barred && g.money >= BETS[this.betIx])
        + btn('up', 'GET UP', 'E');
    } else if (this.phase === 'play') {
      const h = this.hand;
      controls = btn('hit', 'HIT', 'H') + btn('stand', 'STAND', 'S')
        + btn('double', 'DOUBLE', 'D', h.cards.length === 2 && g.money >= h.bet)
        + btn('split', 'SPLIT', 'P', this._canSplit());
    } else controls = '<span class="wait">…</span>';

    const who = this.lizard ? 'THE LIZARD' : 'DEALER';
    this.shown = { d: this.dealer.length };
    this.hands.forEach((h, hi) => { this.shown['h' + hi] = h.cards.length; });
    this.frame.innerHTML = `<div class="bj-rules">BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON ALL 17s · $5–$100</div>`
      + `<div class="bj-row dealer"><span class="who">${who}</span><div class="cards">${deal}</div>${dTot}</div>`
      + `<div class="bj-row you"><span class="who">YOU</span>${hands || '<div class="cards"></div>'}</div>`
      + `<div class="bj-msg">${this.note ? `<em>${g._esc(this.note)}</em> ` : ''}`
      + `${g._garble(this.msg || '', g.garbleAmount * 0.5)}</div>`
      + `<div class="bj-clock${this.phase === 'play' && this.clockMax ? '' : ' idle'}"><i></i></div>`
      + `<div class="bj-controls">${controls}</div>`;
    this.el.style.setProperty('--blur', (g.garbleAmount * 2.2).toFixed(2) + 'px');
  }
}
