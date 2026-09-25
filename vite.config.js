/* ============================================================
   BUILD — Vite.

     npm run dev       the game at http://localhost:5173, reloading on save
     npm run build     dist/ — what GitHub Pages serves
     npm run preview   dist/ served locally, to check a build

   `npm run build` makes two things in dist/:

     · the site: index.html and hashed files under assets/. A changed
       file gets a new name, so a phone never runs yesterday's code.
     · fear-and-loathing-offline.html: the whole game in ONE file,
       three.js, fonts and all, that plays by being double-clicked with
       no server and no network.

   It also leaves a page at the old address, "Fear and Loathing.html",
   that forwards to the new one, so old links and Home Screen icons
   still work.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OFFLINE = 'fear-and-loathing-offline.html';
const OLD_ADDRESS = 'Fear and Loathing.html';

/* The shaders live in JS template literals, so a backtick typed inside a
   COMMENT ends the shader string and spills GLSL into JS. That cost a black
   screen once, with an error that pointed at a number, not a quote. Nothing
   in src/ has any business carrying a backtick on a comment line. */
function shaderSafety() {
  return {
    name: 'fl-shader-safety',
    buildStart() {
      const dir = path.join(ROOT, 'src');
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
        fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((line, i) => {
          if (/^\s*(\/\/|\/\*|\*)/.test(line) && line.includes('`')) {
            this.error(`src/${f}:${i + 1} backtick in a comment would end a shader string:\n  ${line.trim()}`);
          }
        });
      }
    },
  };
}

/* src/main.js carries a DOM-backed dev channel that tools/smoke.mjs uses
   to drive the game from outside the page. It is inert without a
   data-fl-debug attribute, but a published build has no business carrying
   it, so everything between DBG-START and DBG-END comes out. */
function stripDevChannel() {
  const BLOCK = /^[ \t]*\/\* DBG-START \*\/[\s\S]*?^[ \t]*\/\* DBG-END \*\/[ \t]*\n/gm;
  return {
    name: 'fl-strip-dev-channel',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/main.js')) return null;
      const out = code.replace(BLOCK, '');
      if (out === code) this.error('src/main.js: no DBG-START/DBG-END blocks found to strip');
      if (/DBG-(START|END)/.test(out)) this.error('src/main.js: an unmatched DBG-START/DBG-END marker');
      return { code: out, map: null };
    },
  };
}

/* the page people used to open: send them on to the new one */
function oldAddress() {
  const page = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Fear &amp; Loathing</title>
<meta http-equiv="refresh" content="0; url=./" />
<script>location.replace('./');</script>
</head><body style="background:#000;color:#ccc;font:16px monospace">
<a href="./" style="color:#fc6">Fear &amp; Loathing has moved. Go.</a>
</body></html>
`;
  return {
    name: 'fl-old-address',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: OLD_ADDRESS, source: page });
    },
  };
}

/* the offline build writes one index.html to a scratch folder; this moves
   it into dist/ under its own name */
function offlineInto(dist) {
  let outDir;
  return {
    name: 'fl-offline-into-dist',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      fs.mkdirSync(dist, { recursive: true });
      fs.copyFileSync(path.join(outDir, 'index.html'), path.join(dist, OFFLINE));
      fs.rmSync(outDir, { recursive: true, force: true });
    },
  };
}

export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  return {
    base: './',
    plugins: [
      shaderSafety(),
      stripDevChannel(),
      ...(offline ? [viteSingleFile(), offlineInto(path.join(ROOT, 'dist'))] : [oldAddress()]),
    ],
    build: {
      outDir: offline ? path.join(ROOT, 'node_modules/.fl-offline') : 'dist',
      emptyOutDir: true,
      // three.js is most of the game by weight and is one chunk on purpose
      chunkSizeWarningLimit: 1200,
    },
  };
});
