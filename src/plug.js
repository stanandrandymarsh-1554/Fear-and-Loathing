/* ============================================================
   THE PLUG — corner booth, the nautical bar. Cash only.

   He sells by the piece out of a flight bag on the seat beside him:
   four kinds of grass (see STRAINS in game.js) and a few of the things
   your attorney did not already pack. Everything is paid for with the
   money in your wallet -- or not paid for at all.

   STEALING. Each line can be lifted instead of bought. The odds are
   printed, because a man in your condition would at least know them:
     + PERCEPTION   you see the moment he looks away
     + NERVE        you take it like it is yours
     - MOTOR        ether hands knock the bag over
     - PARANOIA     you keep looking at him, and he notices
     - FEAR         it shows
     - every time you have already got away with it: he is counting now
   Get caught and he takes it back, leaves the booth, and some minutes
   later -- somewhere else, after you have gone up in the lift -- he
   comes to find you about it (main.js, updatePlugVisit).
   ============================================================ */

import { SUBSTANCES, STRAINS } from './game.js';
import { cash } from './blackjack.js';

const MENU = [
  { strain: 'mexican', price: 10, blurb: 'Commercial Mexican, pressed into a brick for the trip north. Seeds, stems, harsh smoke, a weak foggy high.' },
  { strain: 'panama', price: 25, blurb: 'Panama Red, for the red hairs on the buds. A sativa: racy, heady, talks fast.' },
  { strain: 'acapulco', price: 35, blurb: 'Acapulco Gold, out of Guerrero. The top shelf: bright, euphoric, and strong. Smooth smoke.' },
  { strain: 'thai', price: 50, blurb: 'Thai stick: buds tied to bamboo with silk, said to be cured in hash oil. Very strong and cerebral. Easy to overdo.' },
  { kind: 'mescaline', price: 60, blurb: 'Buttons. You will see through things and talk like a radio between stations.' },
  { kind: 'acid', price: 80, blurb: 'Blotter, with a little cartoon on it. You will see everything, including what is not there.' },
  { kind: 'cocaine', price: 90, blurb: 'For saying the thing you came to say.' },
  { kind: 'uppers', price: 30, blurb: 'Truck-stop whites. Nerve, and the shakes that come with it.' },
  { kind: 'ether', price: 40, blurb: 'A whole can. Nothing hurts and your legs belong to someone else.' },
].map((m) => ({
  ...m,
  kind: m.kind || 'grass',
  name: m.strain ? STRAINS[m.strain].name : SUBSTANCES[m.kind].name,
  color: SUBSTANCES[m.kind || 'grass'].color,
  glyph: SUBSTANCES[m.kind || 'grass'].glyph,
}));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class PlugShop {
  constructor(game, audio) {
    this.game = game;
    this.audio = audio;
    this.el = document.getElementById('plug');
    this.el.innerHTML = '<div class="bj-frame plug-frame"></div>';
    this.frame = this.el.firstChild;
    this.open = false;
    this.sel = 0;
    this.thefts = 0;           // how many times you have got away with it
    this.gone = false;         // caught: he has left the booth
    this.msg = '';
    this.onClose = null;       // main.js
    this.onCaught = null;
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pl]');
      if (b) this.action(b.dataset.pl);
    });
  }

  /** 0..1, the chance of walking off with it */
  stealOdds() {
    const g = this.game;
    return clamp(0.32 + 0.3 * g.perception + 0.25 * g.nerve
      - 0.4 * (1 - g.motor) - 0.22 * Math.min(1, g.paranoia) - 0.2 * g.fear
      - 0.14 * this.thefts, 0.05, 0.85);
  }

  show() {
    this.open = true;
    this.msg = this.thefts
      ? '"Back again." He moves the bag a little closer to his leg.'
      : '"Cash. No credit, no promises, no names." He opens a flight bag on the seat beside him.';
    this.el.classList.remove('hidden');
    document.body.classList.add('at-table');
    this.paint();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    document.body.classList.remove('at-table');
    this.onClose?.();
  }

  key(code) {
    if (!this.open || this.game.dlg) return false;
    const map = {
      ArrowUp: 'up', ArrowDown: 'down', KeyW: 'up', KeyS: 'down',
      KeyB: 'buy', Space: 'buy', Enter: 'buy', KeyT: 'steal', KeyE: 'leave',
    };
    if (!map[code]) return false;
    this.action(map[code]);
    return true;
  }

  action(a) {
    if (!this.open || this.game.dlg || this.game.over) return;
    if (a === 'leave') return this.close();
    if (a === 'up' || a === 'down') {
      this.sel = (this.sel + (a === 'up' ? -1 : 1) + MENU.length) % MENU.length;
      return this.paint();
    }
    if (a.startsWith('row')) { this.sel = +a.slice(3); return this.paint(); }
    if (a.startsWith('buy')) { if (a.length > 3) this.sel = +a.slice(3); return this.buy(); }
    if (a.startsWith('steal')) { if (a.length > 5) this.sel = +a.slice(5); return this.steal(); }
  }

  buy() {
    const g = this.game, m = MENU[this.sel];
    if (g.money < m.price) {
      this.audio.deny();
      this.msg = '"That is not enough money. That is not even close to enough money."';
      return this.paint();
    }
    g.money -= m.price;
    g.giveItem(m.kind, m.strain || null);
    g._paintHUD();
    this.audio.chips?.();
    this.msg = `He counts out ${cash(m.price)} without looking at it and slides the ${m.name.toLowerCase()} across.`;
    this.paint();
  }

  steal() {
    const g = this.game, m = MENU[this.sel];
    if (Math.random() < this.stealOdds()) {
      this.thefts++;
      g.giveItem(m.kind, m.strain || null);
      g.loathing = Math.min(1, g.loathing + 0.03);
      this.msg = `He looks over at the bar for one second, and the ${m.name.toLowerCase()} is in your jacket.`;
      return this.paint();
    }
    // caught. He takes it back, and he takes his bag, and he goes.
    this.gone = true;
    this.close();
    this.onCaught?.(m.price);
  }

  paint() {
    if (!this.open) return;
    const g = this.game;
    const odds = Math.round(this.stealOdds() * 100);
    const rows = MENU.map((m, i) => {
      const afford = g.money >= m.price;
      return `<div class="pl-row${i === this.sel ? ' sel' : ''}" data-pl="row${i}">`
        + `<span class="pl-glyph" style="color:${m.color}">${m.glyph}</span>`
        + `<span class="pl-name">${m.name}</span>`
        + `<span class="pl-price${afford ? '' : ' short'}">${cash(m.price)}</span>`
        + `<button data-pl="buy${i}" class="${afford ? '' : 'off'}">BUY</button>`
        + `<button data-pl="steal${i}" class="pl-steal">STEAL ${odds}%</button>`
        + '</div>';
    }).join('');
    const m = MENU[this.sel];
    this.frame.innerHTML = '<div class="bj-rules">THE PLUG · CASH ONLY</div>'
      + `<div class="pl-list">${rows}</div>`
      + `<div class="pl-blurb">${g._esc(m.blurb)}</div>`
      + `<div class="bj-msg">${g._garble(this.msg, g.garbleAmount * 0.5)}</div>`
      + '<div class="bj-controls">'
      + '<button data-pl="buy"><kbd>B</kbd>BUY</button>'
      + `<button data-pl="steal" class="pl-steal"><kbd>T</kbd>STEAL · ${odds}%</button>`
      + '<span class="pl-keys"><kbd>↑</kbd><kbd>↓</kbd> choose</span>'
      + '<button data-pl="leave" style="margin-left:auto"><kbd>E</kbd>LEAVE</button>'
      + '</div>';
  }
}
