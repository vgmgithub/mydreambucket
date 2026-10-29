// Copy the Bucket List screens from MyNotes into this app, so both stay the same.
//   node tools/sync-from-mynotes.mjs [path to the MyNotes folder]   (default: ../mynote)
// Only js/shell/bucket*.js are copied; MyNotes itself is never changed. Run the tests afterwards (npm test).
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(new URL('..', import.meta.url)));
const from = resolve(process.argv[2] || join(here, '..', 'mynote'));
const FILES = ['bucket.js', 'bucket-ui.js', 'bucket-geo.js', 'bucket-map.js', 'bucket-plan.js', 'bucket-plan-ui.js'];
let changed = 0;
for (const f of FILES) {
  const src = join(from, 'js', 'shell', f), dst = join(here, 'js', 'shell', f);
  if (!existsSync(src)) { console.error('Not found: ' + src); process.exitCode = 1; continue; }
  const same = existsSync(dst) && readFileSync(src, 'utf8') === readFileSync(dst, 'utf8');
  if (!same) { copyFileSync(src, dst); changed++; console.log('updated ' + f); }
}
console.log(changed ? changed + ' file(s) updated - now run npm test, bump CACHE in service-worker.js and APP_VERSION in js/main.js' : 'Already the same as MyNotes');
