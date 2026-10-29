// main.js — My Dream Bucket: the app around the Bucket List screens. The screens (js/shell/bucket*.js) are the same
// files as MyNotes' Bucket List; this adds the header, the menu (bring the list from MyNotes, backup and restore,
// currency, privacy) and the switch between the list and the plan.
import { el, $, toast, appConfirm, openModal, closeModal, state, setAppMode, onMode } from './core/app.js';
import { DB, readMyNotesMeta } from './core/db.js';
import { APP_CURRENCIES, appCur, setAppCur } from './core/core.js';
import { makeBackup, readBackup, countOf, countText } from './core/backup.js';
import { renderBucket, openAdd } from './shell/bucket-ui.js';
import { renderBucketPlan } from './shell/bucket-plan-ui.js';

export const APP_VERSION = 2;
const LIST = 'bucketList', PHOTOS = 'bucketPhotos';

// ---- Light or dark, as the phone is set ----
const dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const applyTheme = () => {
  const night = !!(dark && dark.matches);
  document.documentElement.dataset.theme = night ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', night ? '#120e2b' : '#f6f3ff');
};
applyTheme();
if (dark && dark.addEventListener) dark.addEventListener('change', applyTheme);

// ---- Header: the list (with the plan and the menu), or the plan (with the way back) ----
function drawHeader() {
  const h = $('#appHeader');
  h.innerHTML = '';
  const plan = state.appMode === 'bucketplan';
  h.append(...[
    plan ? el('button', { type: 'button', class: 'mdb-icon mdb-back', 'aria-label': 'Back to my bucket list', text: '‹', onclick: () => history.back() })
      : el('img', { class: 'mdb-logo', src: 'icons/icon-192.png', alt: '' }),
    el('div', { class: 'mdb-title' }, [el('b', { text: plan ? 'Bucket List Plan' : 'My Dream Bucket' }), el('small', { text: plan ? 'What to save for each dream, and when' : 'Dreams, places and memories' })]),
    plan ? null : el('button', { type: 'button', class: 'mdb-icon', title: 'Bucket List Plan', 'aria-label': 'Bucket List Plan', text: '🎯', onclick: () => setAppMode('bucketplan') }),
    el('button', { type: 'button', class: 'mdb-icon', title: 'Menu', 'aria-label': 'Menu', text: '☰', onclick: openMenu }),
  ].filter(Boolean));
}
// Each returns its drawing, so a screen change waits for the new screen before it slides in.
onMode('bucket', () => { drawHeader(); enter(); return renderBucket(); });
onMode('bucketplan', () => { drawHeader(); enter(); return renderBucketPlan(); });

// ---- Motion: a new screen's parts come in one after another (styles in app.css, body.mdb-enter) ----
let _enterTimer = null;
function enter() {
  document.body.classList.add('mdb-enter');
  clearTimeout(_enterTimer);
  _enterTimer = setTimeout(() => document.body.classList.remove('mdb-enter'), 1100);
}
// A tab of the bottom bar, or another person's list.
document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#bucketBottomNav button, .bk-person:not(.on):not(.is-add)')) enter(); }, true);
// The header gets a shadow once the page is scrolled under it.
window.addEventListener('scroll', () => { const h = $('#appHeader'); if (h) h.classList.toggle('is-scrolled', window.scrollY > 4); }, { passive: true });

// ---- The list and photos ----
const getList = async () => { const r = await DB.get('meta', LIST).catch(() => null); return r ? r.value : null; };
const getPhotos = async () => { const r = await DB.get('meta', PHOTOS).catch(() => null); return (r && r.value) || {}; };
async function putAll(list, photos) {
  const at = new Date().toISOString();
  await DB.put('meta', { key: LIST, value: list, updatedAt: at });
  await DB.put('meta', { key: PHOTOS, value: photos || {}, updatedAt: at });
}
// Bring a list in (from MyNotes or a backup): what is here is replaced, after saying so.
async function takeIn(got, where) {
  const c = countOf(got.list);
  if (!got.list || !c.people) { toast('There is no bucket list in ' + where); return false; }
  const mine = countOf(await getList());
  if (mine.people && !(await appConfirm('Replace the list here (' + countText(mine) + ') with the one from ' + where + ' (' + countText(c) + ')?'))) return false;
  await putAll(got.list, got.photos);
  closeModal();
  toast('🪣 ' + countText(c) + ' brought in');
  setAppMode('bucket');
  return true;
}
// A file picked from the phone, read as JSON.
function pickFile() {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept: 'application/json,.json,text/plain', style: 'display:none' });
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.remove();
      if (!f) { resolve(null); return; }
      try { resolve(JSON.parse(await f.text())); } catch (_) { toast('That file could not be read'); resolve(null); }
    });
    input.click();
  });
}
async function fromFile() {
  const data = await pickFile();
  if (!data) return;
  let got;
  try { got = readBackup(data); } catch (e) { toast(e.message); return; }
  await takeIn(got, got.from === 'mynotes' ? 'the MyNotes backup' : 'the backup');
}
// MyNotes on this same phone and web address: read its list straight away (MyNotes itself is never changed).
async function fromMyNotes() {
  let got = null;
  try { got = await readMyNotesMeta([LIST, PHOTOS]); } catch (_) { got = null; }
  if (got && got[LIST]) { await takeIn({ list: got[LIST], photos: got[PHOTOS] || {} }, 'MyNotes'); return; }
  // Elsewhere: from a MyNotes backup file.
  if (await appConfirm('MyNotes is not on this phone at this address. Pick a MyNotes backup file instead? (In MyNotes: Menu > Backup > Download.)', { okText: 'Pick the file', danger: false })) fromFile();
}
async function saveBackup() {
  const data = makeBackup(await getList(), await getPhotos());
  const name = 'mydreambucket-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  if (navigator.canShare && navigator.share && /iPhone|iPad/.test(navigator.userAgent)) {
    try { await navigator.share({ files: [new File([blob], name, { type: 'application/json' })], title: 'My Dream Bucket backup' }); toast('Backup saved'); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Backup downloaded');
}

// ---- Menu ----
function openMenu() {
  const row = (ico, title, sub, act) => el('button', { type: 'button', class: 'mdb-menu-row', onclick: act }, [el('span', { class: 'mdb-menu-i', text: ico }), el('div', {}, [el('b', { text: title }), el('small', { text: sub })])]);
  const cur = el('div', { class: 'mdb-cur' }, APP_CURRENCIES.map((c) => el('button', { type: 'button', class: c.code === appCur() ? 'on' : '', onclick: () => { setAppCur(c.code); closeModal(); toast('Amounts in ' + c.name); setAppMode(state.appMode); } }, [c.sym.trim() + ' ' + c.code])));
  openModal(el('div', { class: 'sheet has-fixed-footer bk-sheet' }, [
    el('div', { class: 'sheet-scroll' }, [
      el('div', { class: 'mdb-brand' }, [el('img', { src: 'icons/icon-192.png', alt: '' }), el('div', {}, [el('b', { text: 'My Dream Bucket' }), el('small', { text: 'Dream it. Plan it. Live it.' })])]),
      row('📥', 'Bring my list from MyNotes', 'Your dreams, places, photos and plan - MyNotes stays as it is', fromMyNotes),
      row('💾', 'Back up my list', 'A file to keep (with your photos)', saveBackup),
      row('♻️', 'Restore from a backup', 'This app’s backup or a MyNotes backup', fromFile),
      row('🎯', 'Bucket List Plan', 'What to save for each dream, and when', () => { closeModal(); setTimeout(() => setAppMode('bucketplan'), 120); }),   // after the sheet's Back step
      row('💌', 'Share the app', 'Send My Dream Bucket to a fellow traveller', shareApp),
      el('div', { class: 'mdb-menu-sub', text: '💱 Currency' }), cur,
      el('div', { class: 'mdb-menu-sub', text: '🔒 Privacy' }),
      el('p', { class: 'hint', text: PRIVACY }),
      el('p', { class: 'hint mdb-ver', text: 'My Dream Bucket · version ' + APP_VERSION }),
    ]),
    el('div', { class: 'sheet-footer' }, [el('div', { class: 'btn-row' }, [el('button', { class: 'btn primary', type: 'button', text: 'Done', onclick: closeModal })])]),
  ]));
}
// The website (this folder's index.html), to share.
async function shareApp() {
  const url = new URL('./', location.href).href;
  const text = 'My Dream Bucket - a bucket list, the places you have been and the memories, private on your phone.';
  if (navigator.share) { try { await navigator.share({ title: 'My Dream Bucket', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('Link copied - ' + url); } catch (_) { toast(url); }
}
export const PRIVACY = 'Your list, places, memories and photos are kept on this phone only - no account, nothing sent to us. Backups are files you keep. '
  + 'The app’s letters (the Baloo 2 and Nunito fonts) come from Google Fonts. '
  + 'When you open the Places map, the map library (Leaflet) and the outlines of countries (world-atlas) and India’s states (india-maps-data) are downloaded from cdn.jsdelivr.net, '
  + 'and map pictures of the area on screen from Esri (server.arcgisonline.com) - your places, names and photos are never sent.';

// ---- Start ----
// Home-screen shortcuts (manifest.webmanifest): ?action=add, ?view=places | milestones | insights | plan.
(async function start() {
  const q = new URLSearchParams(location.search);
  const view = q.get('view'), action = q.get('action');
  if (view === 'plan') { await setAppMode('bucketplan'); return; }
  await setAppMode('bucket');
  if (['places', 'milestones', 'insights'].includes(view)) { const b = document.querySelector('#bucketBottomNav [data-view="' + view + '"]'); if (b) b.click(); }
  if (action === 'add') openAdd();
})();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(() => {});
