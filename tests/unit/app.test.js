import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { makeBackup, readBackup, countOf, countText, BACKUP_APP } from '../../js/core/backup.js';
import { read } from './src.js';

const list = { profiles: [{ id: 'p1', name: 'Me', items: [{ id: 'a' }, { id: 'b' }], visits: [{ id: 'v1' }], wishes: [] }], active: 'p1' };

test('backup: this app’s own file, read back as it was', () => {
  const b = makeBackup(list, { v1: 'data:image/jpeg;base64,xx' }, '2026-10-29T00:00:00Z');
  assert.equal(b.app, BACKUP_APP);
  assert.deepEqual(readBackup(JSON.parse(JSON.stringify(b))), { from: 'mydreambucket', list, photos: { v1: 'data:image/jpeg;base64,xx' } });
});

test('a MyNotes backup: only its Bucket List and trip photos are taken', () => {
  const mynotes = { app: 'mynote-stocks', version: 30, stocks: [{ id: 's' }], meta: [{ key: 'currency', value: 'INR' }, { key: 'bucketList', value: list }, { key: 'bucketPhotos', value: { v1: 'x' } }] };
  assert.deepEqual(readBackup(mynotes), { from: 'mynotes', list, photos: { v1: 'x' } });
  assert.deepEqual(readBackup({ app: 'mynote-stocks', meta: [] }), { from: 'mynotes', list: null, photos: {} }, 'a MyNotes backup with no list');
  assert.throws(() => readBackup({ app: 'something-else' }), /not a My Dream Bucket or MyNotes backup/);
  assert.throws(() => readBackup(null), /not a backup/);
});

test('counts what is in a list', () => {
  assert.deepEqual(countOf(list), { people: 1, dreams: 2, visits: 1, wishes: 0 });
  assert.equal(countText(countOf(list)), '1 person, 2 dreams, 1 place');
  assert.deepEqual(countOf(null), { people: 0, dreams: 0, visits: 0, wishes: 0 });
});

test('every file the offline cache lists is there, and every app file is listed', () => {
  const sw = read('service-worker.js');
  const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter(Boolean);
  for (const f of listed) assert.ok(existsSync(new URL('../../' + f, import.meta.url)), f + ' is missing');
  for (const f of ['js/main.js', 'js/core/app.js', 'js/core/db.js', 'js/core/core.js', 'js/core/backup.js', 'js/money/personal-ui.js',
    'js/shell/bucket.js', 'js/shell/bucket-ui.js', 'js/shell/bucket-geo.js', 'js/shell/bucket-map.js', 'js/shell/bucket-plan.js', 'js/shell/bucket-plan-ui.js']) assert.ok(listed.includes(f), f + ' not cached');
});

test('MyNotes is only ever read: its database is opened only when it already exists, and nothing is written to it', () => {
  const db = read('js/core/db.js');
  assert.match(db, /if \(!dbs\.some\(\(d\) => d\.name === MYNOTES_DB\)\) return null;/);
  const mine = db.slice(db.indexOf('export async function readMyNotesMeta'));
  assert.doesNotMatch(mine, /readwrite|\.put\(|\.delete\(|\.clear\(/);
});

test('every module loads (the ones that need no browser)', async () => {
  for (const f of ['js/core/db.js', 'js/core/core.js', 'js/core/backup.js', 'js/money/personal-ui.js', 'js/shell/bucket.js', 'js/shell/bucket-geo.js', 'js/shell/bucket-plan.js']) await import('../../' + f);
  assert.ok(readFileSync(new URL('../../index.html', import.meta.url), 'utf8').includes('<script type="module" src="js/main.js"></script>'));
});
