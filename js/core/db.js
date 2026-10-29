// db.js (My Dream Bucket) — storage on this device (IndexedDB). One store, 'meta' ({ key, value }), as in MyNotes:
// 'bucketList' holds the list (people, dreams, places, plan) and 'bucketPhotos' the trip photos.
// ?testdb=1 uses a separate database, so trying things out never touches the real list.
const TEST = /[?&]testdb=1/.test(typeof location !== 'undefined' ? location.search : '');
export const DB_NAME = TEST ? 'mydreambucket-test' : 'mydreambucket';
const VERSION = 1;

let _db = null;
function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' }); };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}
const reqP = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
async function store(name, mode) { const db = await open(); return db.transaction(name, mode).objectStore(name); }

export const DB = {
  async get(name, key) { return reqP((await store(name, 'readonly')).get(key)); },
  async put(name, value) { return reqP((await store(name, 'readwrite')).put(value)); },
  async del(name, key) { return reqP((await store(name, 'readwrite')).delete(key)); },
  async all(name) { return reqP((await store(name, 'readonly')).getAll()); },
};

// MyNotes on this same device and web address: its list can be read (never changed) for "Bring my list from MyNotes".
export const MYNOTES_DB = TEST ? 'mynote-app-test' : 'mynote-app';
export async function readMyNotesMeta(keys) {
  if (!indexedDB.databases) return null;
  const dbs = await indexedDB.databases().catch(() => []);
  if (!dbs.some((d) => d.name === MYNOTES_DB)) return null;   // not here: nothing is opened (opening would create it)
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open(MYNOTES_DB); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  try {
    if (!db.objectStoreNames.contains('meta')) return null;
    const os = db.transaction('meta', 'readonly').objectStore('meta');
    const out = {};
    for (const k of keys) { const row = await reqP(os.get(k)); out[k] = row ? row.value : null; }
    return out;
  } finally { db.close(); }
}
