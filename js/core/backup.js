// backup.js (My Dream Bucket) — a backup is a file you keep: the list and the trip photos. Reading one back takes this
// app's own backup, or a MyNotes backup (only its Bucket List and trip photos are read; nothing else in it).
export const BACKUP_APP = 'mydreambucket';

export function makeBackup(list, photos, nowIso) {
  return { app: BACKUP_APP, version: 1, exportedAt: nowIso || new Date().toISOString(), bucketList: list || null, bucketPhotos: photos || {} };
}

export function readBackup(data) {
  if (!data || typeof data !== 'object') throw new Error('That file is not a backup.');
  if (data.app === BACKUP_APP) return { from: 'mydreambucket', list: data.bucketList || null, photos: data.bucketPhotos || {} };
  if (data.app === 'mynote-stocks' && Array.isArray(data.meta)) {
    const row = (k) => data.meta.find((m) => m && m.key === k);
    const l = row('bucketList'), ph = row('bucketPhotos');
    return { from: 'mynotes', list: l ? l.value : null, photos: (ph && ph.value) || {} };
  }
  throw new Error('That file is not a My Dream Bucket or MyNotes backup.');
}

// How much is in a list: people, dreams, places visited and places to visit.
export function countOf(list) {
  const ps = (list && Array.isArray(list.profiles)) ? list.profiles : [];
  const n = (k) => ps.reduce((s, p) => s + (Array.isArray(p[k]) ? p[k].length : 0), 0);
  return { people: ps.length, dreams: n('items'), visits: n('visits'), wishes: n('wishes') };
}
export const countText = (c) => [c.people + (c.people === 1 ? ' person' : ' people'), c.dreams + (c.dreams === 1 ? ' dream' : ' dreams'),
  c.visits ? c.visits + (c.visits === 1 ? ' place' : ' places') : '', c.wishes ? c.wishes + ' to visit' : ''].filter(Boolean).join(', ');
