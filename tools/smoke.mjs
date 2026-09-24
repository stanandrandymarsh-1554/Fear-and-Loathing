/* ============================================================
   SMOKE — every act, in headless Chromium, with pictures.

     node tools/smoke.mjs                 ->  shots/*.png
     SMOKE_SIZE=640x360 node tools/smoke.mjs
     SHOTS_DIR=/some/dir node tools/smoke.mjs

   Runs the modular source, not the bundle: the dev channel it drives
   (data-fl-cmd, in src/main.js) is stripped from the built file. three.js
   is served from vendor/ so nothing is fetched from a network.

   WHY IT IS BUILT THIS WAY. A cloud container has no GPU, so WebGL is
   SwiftShader, on the CPU, and a frame of this game costs about a second
   at 960x540 and four at 1280x720. Two things follow:

     · the game's own loop is HELD (data-fl-hold), and the harness steps
       the world itself, undrawn. A free-running loop kept the main thread
       so busy that page.screenshot waited on the compositor for a fresh
       frame until it timed out.
     · a picture is taken with the shot command, which draws the frame and
       reads the canvas back in the same task -- the only moment the WebGL
       buffer is guaranteed to still hold it. A read-back any later comes
       out black, and so does any picture taken mid-fade between acts,
       which is why every act change is settled before a shot.

   Each shot is written twice: NN-name.png is the 3D frame alone and
   NN-name-hud.png is the page as a player sees it. The run fails on a
   shot that is near-black (it never rendered), a shot the game says was
   taken mid-fade, a drive that stalls, or any error on the page.
   SMOKE_TRACE=1 prints what the driving autopilot is doing.
   ============================================================ */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.env.SHOTS_DIR || path.join(ROOT, 'shots'));
const [W, H] = (process.env.SMOKE_SIZE || '960x540').split('x').map(Number);
// mean luma out of 255 below which a frame counts as black
const BLACK = 4;

// playwright from the project if it has one, else the global install
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall through */ }
  const root = execSync('npm root -g').toString().trim();
  return import(pathToFileURL(path.join(root, 'playwright', 'index.mjs')).href);
}
const { chromium } = await loadPlaywright();

/* ------------------------------------------------ static server */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ------------------------------------------------ the browser */
const browser = await chromium.launch({
  // ANGLE on SwiftShader: software WebGL2. Newer Chromium refuses to fall
  // back to SwiftShader on its own, so it has to be asked for outright.
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('crash', () => problems.push('the page crashed'));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push('console.error: ' + m.text());
  else if (m.type() === 'warning') console.log('  (warning) ' + m.text().slice(0, 160));
});
await page.route('https://cdn.jsdelivr.net/npm/three@*/build/three.module.js',
  (r) => r.fulfill({ path: path.join(ROOT, 'vendor', 'three.module.js'), contentType: 'text/javascript' }));
// fonts fall back to the stack in ui.css; the network is not ours to wait on
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));

await page.goto(BASE + '/index.html');
const gl = await page.evaluate(() => {
  const g = document.createElement('canvas').getContext('webgl2');
  if (!g) return null;
  const ext = g.getExtension('WEBGL_debug_renderer_info');
  return g.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : g.RENDERER);
});
if (!gl) {
  console.log('FAIL: no WebGL2 context in this browser, so there is nothing to photograph');
  await browser.close(); server.close(); process.exit(1);
}
console.log(`WebGL: ${gl}\nviewport ${W}x${H}, shots -> ${OUT}`);
fs.mkdirSync(OUT, { recursive: true });

await page.evaluate(() => {
  document.documentElement.setAttribute('data-fl-debug', '');
  document.documentElement.setAttribute('data-fl-hold', '');
});
await page.click('#start');

/* ------------------------------------------------ driving it */
/** one dev-channel command; returns the game state after it */
async function cmd(c) {
  return page.evaluate((c) => {
    document.documentElement.setAttribute('data-fl-cmd', JSON.stringify(c));
    document.dispatchEvent(new Event('fl-pump'));
    return JSON.parse(document.body.dataset.fl || '{}');
  }, c);
}

/** step until no cut to black is in progress, so a shot is not of the dark */
async function settle(max = 900) {
  let s = await cmd({});
  for (let n = 0; n < max && !s.over && (s.fading || s.blackout < 0.999); n += 30) {
    s = await cmd({ steps: 30 });
  }
  return s;
}

let shotNo = 0;
const shots = [];
/** the 3D frame, and the page with the HUD over it */
async function shot(name, frames = 1) {
  const t0 = Date.now();
  const r = await page.evaluate(async (frames) => {
    document.documentElement.setAttribute('data-fl-cmd', JSON.stringify({ shot: frames }));
    document.dispatchEvent(new Event('fl-pump'));
    const url = document.body.dataset.flShot;
    delete document.body.dataset.flShot;
    if (!url) return null;
    // how dark it is, measured on a thumbnail
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 36;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0, 64, 36);
    const d = g.getImageData(0, 0, 64, 36).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return { url, luma: sum / (d.length / 4), state: JSON.parse(document.body.dataset.fl || '{}') };
  }, frames);
  const base = `${String(++shotNo).padStart(2, '0')}-${name}`;
  if (!r) { problems.push(`${base}: the shot command produced no image`); return; }
  fs.writeFileSync(path.join(OUT, base + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
  // the loop is held, so the compositor is idle and this is quick
  await page.screenshot({ path: path.join(OUT, base + '-hud.png'), timeout: 60000,
                          animations: 'disabled', caret: 'hide' });
  // Two ways to be black. A frame that never rendered is caught by its
  // pixels. A frame mid-fade is not: the fade is applied before the gamma
  // curve, so 90% of the way to black still averages 12/255 -- darker than a
  // night street is not a test -- and only the game can say it was fading.
  const black = r.luma < BLACK;
  const midFade = r.state.fading || r.state.blackout < 0.999;
  if (black) problems.push(`${base}: black frame (mean luma ${r.luma.toFixed(1)})`);
  if (midFade) problems.push(`${base}: taken mid-fade (blackout ${r.state.blackout}); settle() first`);
  shots.push(base);
  console.log(`${black ? 'BLACK' : midFade ? 'FADE ' : 'shot '} ${base.padEnd(24)} luma ${r.luma.toFixed(1).padStart(5)}`
    + `  act ${r.state.act}  pos ${JSON.stringify(r.state.pos)}  ${Date.now() - t0}ms`);
}

/** hold the road: a little autopilot over the dev channel. Round the right
    of the fountain island in the motor court, as a driver would -- straight
    down the centreline puts the car into it -- then in its own lane. */
async function drive(seconds, cruise = 22) {
  let s = await cmd({});
  for (let t = 0; t < seconds * 60 && !s.over; t += 6) {
    const [lat, rel, along] = s.road || [0, 0, 0];
    const speed = s.car ? s.car[0] : 0;
    const court = along < 50;
    const want = along > 1 && along < 26 ? 11 : 1.4;   // the island ends at 27m
    const top = court ? Math.min(cruise, 6) : cruise;
    // aim at a point on the wanted line a little way ahead. + lat is right
    // of the centreline; + rel is pointing left of the road.
    const err = rel + Math.atan((want - lat) / (court ? 6 : 20));
    if (process.env.SMOKE_TRACE && t % 60 === 0) {
      console.log(`  drive s=${along} lat=${lat} rel=${rel} v=${speed.toFixed(1)} err=${err.toFixed(2)}`);
    }
    s = await cmd({ keys: { KeyW: speed < top, KeyA: err < -0.03, KeyD: err > 0.03 }, steps: 6 });
  }
  await cmd({ keys: { KeyW: false, KeyA: false, KeyD: false } });
  return s;
}

/* ------------------------------------------------ the run */
const t0 = Date.now();
try {
  await settle();
  await shot('act1-lobby');
  await cmd({ keys: { KeyW: true }, steps: 150 });
  await cmd({ keys: { KeyW: false } });
  await shot('act1-floor');
  await cmd({ dose: 'mescaline', steps: 240 });
  await shot('act1-mescaline', 6);
  await cmd({ clear: 1, skip: 1, act2: 1 });
  await settle();
  await shot('act2-suite');
  await cmd({ down: 1 });
  await settle();
  await shot('act1-downstairs');
  await cmd({ act3: 1 });
  await settle();
  await shot('act3-kerb');
  let s = await drive(12);
  await shot('act3-town');
  s = await drive(25, 30);
  await shot('act3-desert');
  const along = s.road ? s.road[2] : 0;
  if (!s.over && along < 400) problems.push(`the drive stalled ${along}m down the road`);
  if (s.over) console.log('  (the drive ended early; the autopilot left the road)');
  else {
    await cmd({ act4: 1 });
    await settle();
    await shot('act4-foyer');
    await cmd({ finale: 1 });
    await settle();
    await shot('act5-lobby');
    await cmd({ set: { acid: 0.9 }, steps: 120 });
    await shot('act5-acid', 6);
  }
} catch (err) {
  problems.push('harness: ' + (err.stack || err.message));
}

await browser.close();
server.close();
console.log(`\n${shots.length} shots in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${OUT}`);
if (problems.length) {
  console.log('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('OK');
