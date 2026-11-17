// Hand-in program for "Solmar Bay: Heatwave" (Node 22, standard library only).
// Copies the static game (game/) and its screenshots to the output directory, then writes
// dossier.json, the summary the judge reads, using the kit's vendored library.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string, required: boolean): void {
  const from = join(root, name);
  if (!existsSync(from)) {
    if (required) throw new Error(`missing ${name}/`);
    mkdirSync(join(outDir, name), { recursive: true });
    return;
  }
  cpSync(from, join(outDir, name), { recursive: true });
}

if (!existsSync(join(root, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing; the hand-in needs a static entry page');
}
const screenshotsDir = join(root, 'screenshots');
if (!existsSync(screenshotsDir) || readdirSync(screenshotsDir).length === 0) {
  throw new Error('screenshots/ is missing or empty; capture the ?shot= renders first');
}

mkdirSync(outDir, { recursive: true });
copyTree('game', true);
copyTree('screenshots', true);

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, caps));

// Summarise the output so a silent, empty hand-in is impossible.
function tally(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = tally(p);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += statSync(p).size;
    }
  }
  return { files, bytes };
}
const total = tally(outDir);
const shotNames = readdirSync(join(outDir, 'screenshots')).sort().join(', ');
console.log(`wrote ${outDir}/dossier.json (${total.files} files, ${total.bytes} bytes total)`);
console.log(`screenshots: ${shotNames}`);
