// GLOAMDEEP — best-game-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library
// and no network request). This program hands it in: it copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
// Fail loudly instead of handing in a dossier with no cover: the judge
// reads the game mostly through its screenshots.
if (!existsSync(join(here, 'screenshots'))) {
  throw new Error('screenshots/ is missing: the dossier needs 1-4 real screenshots');
}
const shotCount = readdirSync(join(here, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f)).length;
if (shotCount < 1 || shotCount > 4) {
  throw new Error(`expected 1-4 screenshots, found ${shotCount}`);
}
// The scorer refuses any screenshot over 256 KiB: catch an oversized one
// here instead of handing in a dossier the site would reject.
for (const f of readdirSync(join(here, 'screenshots'))) {
  if (!/\.(png|jpe?g)$/i.test(f)) continue;
  const bytes = statSync(join(here, 'screenshots', f)).size;
  if (bytes > 262144) {
    throw new Error(`screenshot ${f} is ${bytes} bytes, over the 256 KiB cap`);
  }
}
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files, in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
