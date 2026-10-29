// bucket-ui.js — My Bucket List: a list per profile (you, a partner, the kids...), each thing ticked off with the month
// and year it was done and a line about how it went. Stored in meta 'bucketList'; the logic is in bucket.js.
import { el, $, openModal, closeModal, toast, appConfirm, field, state } from '../core/app.js';
import { DB } from '../core/db.js';
import { appCur, curSym } from '../core/core.js';
import { fmtIntCur } from '../money/personal-ui.js';
import { CATEGORIES, IDEAS, PROFILE_EMOJIS, PROFILE_COLORS, catOf, normalise, addProfile, updateProfile, removeProfile, addItem, updateItem,
  removeItem, checkIn, undoCheckIn, sortItems, stats, memories, reorder, autoOrder, setSteps, checkStep, undoStep, progress, took, tookLabel, averageTook, rankItems, milestones, mapUrl, insights, CHEERS, PLACE_TYPES, placeTypeOf, guessPlaceType, placesVisited, addVisit, updateVisit, removeVisit,
  guessRegion, regionInfo, REGION_NAMES, GEOS, geoOf, STAYS, travelInsights, nightsOf, nightsDays, placesToVisit, COMPANIONS, companionOf, MODES, addWish, updateWish, removeWish, placeRanking, ADVENTURES, adventureOf } from './bucket.js';

const KEY = 'bucketList';
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// A short amount for the small stat tiles: 5.6 L / 1.2 Cr in India, 12K / 1.2M elsewhere.
const short = (v) => {
  const x = Math.round(Number(v) || 0), sy = curSym();
  if (appCur() === 'INR') { if (x >= 1e7) return sy + (x / 1e7).toFixed(1).replace(/\.0$/, '') + ' Cr'; if (x >= 1e5) return sy + (x / 1e5).toFixed(1).replace(/\.0$/, '') + ' L'; }
  else { if (x >= 1e6) return sy + (x / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (x >= 1e4) return sy + Math.round(x / 1e3) + 'K'; }
  return fmtIntCur(x);
};
const ymText = (ym) => MONS[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
let _cat = '', _arrange = false, _edit = false;   // _edit: a tap on a dream opens its editor
let _show = '', _q = '';   // _show: '' all, 'todo' or 'done' (the hero tiles); _q: the search box
const _openSteps = new Set();   // dreams whose stages are shown, kept open across redraws

const PHOTO_KEY = 'bucketPhotos';
let _photos = {};
async function loadPhotos() { const r = await DB.get('meta', PHOTO_KEY).catch(() => null); _photos = (r && r.value) || {}; return _photos; }
async function savePhoto(id, url) {
  if (url) _photos[id] = url; else delete _photos[id];
  await DB.put('meta', { key: PHOTO_KEY, value: _photos, updatedAt: new Date().toISOString() });
}
// A photo picked from the phone, made small (720 px on the long side, JPEG) so it costs little room and backup.
async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const k = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.72);
  } finally { URL.revokeObjectURL(url); }
}
function photoPick(current) {
  let val = current || '', changed = false;
  const input = el('input', { type: 'file', accept: 'image/*', class: 'hidden' });
  const box = el('div', { class: 'bk-photo-pick' });
  const draw = () => {
    box.innerHTML = '';
    if (val) box.append(el('img', { src: val, alt: 'Trip photo' }), el('div', { class: 'bk-photo-acts' }, [
      el('button', { type: 'button', class: 'btn ghost small', text: '🔁 Change', onclick: () => input.click() }),
      el('button', { type: 'button', class: 'btn ghost small bk-danger', text: '✕ Remove', onclick: () => { val = ''; changed = true; draw(); } }),
    ]));
    else box.appendChild(el('button', { type: 'button', class: 'btn ghost', text: '📷 Add a photo', onclick: () => input.click() }));
    box.appendChild(input);
  };
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    try { val = await shrinkPhoto(f); changed = true; draw(); } catch (_) { toast('Could not read that photo'); }
    input.value = '';
  });
  draw();
  return { el: box, value: () => val, changed: () => changed };
}
// Adventures tried: tap as many as were done.
function advPick(current) {
  const sel = new Set(current || []);
  const row = el('div', { class: 'bk-ptype bk-adv' });
  const draw = () => { row.innerHTML = ''; ADVENTURES.forEach((a) => row.appendChild(el('button', { type: 'button', class: sel.has(a.id) ? 'on' : '', onclick: () => { if (sel.has(a.id)) sel.delete(a.id); else sel.add(a.id); draw(); } }, [a.icon + ' ' + a.label]))); };
  draw();
  return { el: row, value: () => ADVENTURES.filter((a) => sel.has(a.id)).map((a) => a.id) };
}
// How the trip was travelled: tap one (tap again to clear).
function modePick(current) {
  let val = current || '';
  const row = el('div', { class: 'bk-ptype' });
  const draw = () => { row.innerHTML = ''; MODES.forEach((m) => row.appendChild(el('button', { type: 'button', class: val === m.id ? 'on' : '', onclick: () => { val = val === m.id ? '' : m.id; draw(); } }, [m.icon + ' ' + m.label]))); };
  draw();
  return { el: row, value: () => val };
}

async function load() { const r = await DB.get('meta', KEY).catch(() => null); return normalise(r && r.value); }
async function save(list) { await DB.put('meta', { key: KEY, value: list, updatedAt: new Date().toISOString() }); }
async function saveAndShow(list, msg) { await save(list); closeModal(); if (msg) toast(msg); renderBucket(); }

// For the Home card: "3 of 12 done · Me".
export async function bucketCardSub() {
  const l = await load();
  const p = l.profiles.find((x) => x.id === l.active);
  if (!p) return 'Dreams to tick off · one list per person';
  const s = stats(p.items, new Date().getFullYear());
  return s.total ? s.done + ' of ' + s.total + ' done · ' + p.emoji + ' ' + p.name : p.emoji + ' ' + p.name + ' · add the first dream';
}

// The bottom menu of the Bucket List: the list, and the milestones it has made (in place of Home's bar).
const TABS = [['list', '📝', 'My list'], ['milestones', '🏆', 'Milestones'], ['places', '🗺️', 'Places'], ['insights', '💡', 'Insights']];
let _tab = 'list';
export function buildBucketBottomNav() {
  const nav = $('#bucketBottomNav');
  if (!nav) return;
  nav.innerHTML = '';
  TABS.forEach(([v, ico, label]) => nav.appendChild(el('button', { type: 'button', 'data-view': v, class: _tab === v ? 'active' : '', onclick: () => {
    if (_tab === v) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    _tab = v; _arrange = false; _edit = false; buildBucketBottomNav(); renderBucket(); window.scrollTo(0, 0);
  } }, [el('span', { class: 'bn-ico', text: ico }), label])));
}

export async function renderBucket() {
  const host = $('#bucketView');
  if (!host) return;
  const list = await load();
  if (state.appMode !== 'bucket') return;
  buildBucketBottomNav();
  host.innerHTML = '';
  if (!list.profiles.length) { host.appendChild(welcome()); return; }
  const p = list.profiles.find((x) => x.id === list.active) || list.profiles[0];
  const year = new Date().getFullYear();
  host.style.setProperty('--bk', p.color);

  // ---- Profiles (both tabs) ----
  host.appendChild(el('div', { class: 'bk-people' }, list.profiles.map((x) => {
    const n = x.items.length, d = x.items.filter((i) => i.done).length;
    return el('button', { type: 'button', class: 'bk-person' + (x.id === p.id ? ' on' : ''), style: '--pc:' + x.color, onclick: async () => {
      if (x.id === p.id) return;
      _cat = ''; _show = ''; _q = ''; await save(Object.assign({}, list, { active: x.id })); renderBucket();
    } }, [el('span', { class: 'bk-person-e', text: x.emoji }), el('span', { class: 'bk-person-n', text: x.name }), n ? el('small', { text: d + '/' + n }) : null].filter(Boolean));
  }).concat([el('button', { type: 'button', class: 'bk-person is-add', onclick: () => openProfileForm(list, null) }, [el('span', { class: 'bk-person-e', text: '+' }), el('span', { class: 'bk-person-n', text: 'Person' })])])));

  if (_tab === 'milestones') { renderMilestones(host, list, p); return; }
  if (_tab === 'insights') { renderInsights(host, list, p); return; }
  if (_tab === 'places') { await loadPhotos(); renderPlaces(host, list, p); return; }
  const s = stats(p.items, year);
  const showTile = (id, ico, n, label) => el('button', { type: 'button', class: 'bk-stat is-filter' + (_show === id ? ' on' : ''), 'aria-pressed': String(_show === id),
    onclick: () => { _show = _show === id ? '' : id; renderBucket(); } }, [el('b', { text: ico + ' ' + n }), el('span', { text: label })]);

  // ---- The hero: progress and what is ahead ----
  const C = 2 * Math.PI * 26, f = s.total ? s.done / s.total : 0;
  const ring = el('div', { class: 'bk-ring' });
  ring.innerHTML = '<svg viewBox="0 0 64 64" width="76" height="76" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="7"/>'
    + '<circle cx="32" cy="32" r="26" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (C * f).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 32 32)"/></svg>';
  ring.appendChild(el('div', { class: 'bk-ring-t' }, [el('b', { text: s.pct + '%' }), el('span', { text: 'done' })]));
  host.appendChild(el('div', { class: 'bk-hero' }, [
    el('div', { class: 'bk-hero-top' }, [
      el('div', { class: 'bk-hero-who' }, [
        el('span', { class: 'bk-hero-e', text: p.emoji }),
        el('div', {}, [el('b', { text: p.name + '’s bucket list' }), el('span', { text: s.total ? s.done + ' of ' + s.total + ' ticked off' : 'Nothing on it yet' })]),
        _edit ? el('button', { type: 'button', class: 'bk-edit', 'aria-label': 'Edit ' + p.name, text: '✏️', onclick: () => openProfileForm(list, p) }) : null,
      ].filter(Boolean)),
      ring,
    ]),
    el('div', { class: 'bk-stats' }, [
      // To do / Checked: tap to show only those below; tap again for all. A dream with some stages done is in both.
      showTile('todo', '📝', s.todo, 'To do'),
      showTile('done', '✓', s.checked, 'Checked'),
      s.overdue ? stat('⏳', String(s.overdue), 'past their year') : s.started ? stat('🚧', String(s.started), 'under way') : null,
      s.costToGo ? stat('💰', short(s.costToGo), 'to save for') : null,
    ].filter(Boolean)),
  ]));

  if (_arrange && p.items.length < 2) _arrange = false;
  if (_arrange) {
    // Rearrange: the whole list (done ones too - it is one ranking), each with a handle to drag it up or down.
    host.appendChild(el('div', { class: 'bk-arrange-bar' }, [
      el('span', { text: '↕ Drag ☰ to put them in your order' }),
      p.manual ? el('button', { type: 'button', class: 'btn ghost small', text: 'Automatic', onclick: async () => { _arrange = false; await save(autoOrder(list, p.id)); toast('Back to the automatic order'); renderBucket(); } }) : null,
      el('button', { type: 'button', class: 'btn primary small', text: 'Done', onclick: () => { _arrange = false; renderBucket(); } }),
    ].filter(Boolean)));
    const box = el('div', { class: 'bk-list is-arrange' }, rankItems(p.items, p.manual).map((i) => itemCard(list, p, i, year, true)));
    sortable(box, async (ids) => { await save(reorder(list, p.id, ids)); const fresh = await load(); list.profiles = fresh.profiles; });
    host.appendChild(box);
    return;
  }
  // Add, Edit and Rearrange: one place at the top for changing the list. In Edit, a tap on a dream opens its editor;
  // outside it, a tap only shows the dream's stages or note, so nothing is changed by accident.
  // Search: redraws only the list, so the box keeps its focus while typing.
  const search = el('input', { type: 'search', class: 'bk-search', placeholder: '🔍 Search', 'aria-label': 'Search the list', value: _q,
    oninput: () => { _q = search.value; drawList(); } });
  if (_edit) {
    host.appendChild(el('div', { class: 'bk-arrange-bar is-edit' }, [
      el('span', { text: '✏️ Tap a dream to edit or delete it' }),
      el('button', { type: 'button', class: 'btn primary small', text: 'Done', onclick: () => { _edit = false; renderBucket(); } }),
    ]));
  } else {
    host.appendChild(el('div', { class: 'bk-modes' }, [
      el('button', { type: 'button', class: 'bk-arrange-btn is-add', onclick: () => openItemForm(list, p, null) }, ['+ Add a dream']),
      p.items.length ? search : null,
      p.items.length ? el('button', { type: 'button', class: 'bk-arrange-btn', 'aria-label': 'Edit the list', onclick: () => { _edit = true; renderBucket(); } }, ['✏️ Edit']) : null,
      p.items.length > 1 ? el('button', { type: 'button', class: 'bk-arrange-btn', title: 'Rearrange', 'aria-label': 'Rearrange the list', onclick: () => { _arrange = true; _cat = ''; _show = ''; _q = ''; renderBucket(); } }, ['↕ ' + (p.manual ? 'My order' : 'Rearrange')]) : null,
    ].filter(Boolean)));
  }
  const used = CATEGORIES.filter((c) => p.items.some((i) => i.cat === c.id));
  if (used.length > 1) {
    host.appendChild(el('div', { class: 'bk-cats' }, [['', '🌈', 'All']].concat(used.map((c) => [c.id, c.icon, c.label])).map(([id, ico, label]) =>
      el('button', { type: 'button', class: 'bk-cat' + (_cat === id ? ' on' : ''), onclick: () => { _cat = id; renderBucket(); } }, [ico + ' ' + label]))));
  }

  // ---- The list: one ranking; a dream that is done stays in its place, struck through ----
  // The rank stays the dream's place in the whole list, whatever is filtered.
  const ranked = rankItems(p.items, p.manual);
  const listHost = host.appendChild(el('div', {}));
  const drawList = () => {
    listHost.innerHTML = '';
    if (!p.items.length) {
      listHost.appendChild(el('div', { class: 'bk-empty' }, [
        el('div', { class: 'bk-empty-e', text: '🪣' }),
        el('p', { text: 'Add the first thing ' + p.name + ' wants to do, see or learn.' }),
        el('button', { type: 'button', class: 'btn primary', text: '+ Add a dream', onclick: () => openItemForm(list, p, null) }),
      ]));
      return;
    }
    const q = _q.trim().toLowerCase();
    const shown = ranked.filter((i) => (!_cat || i.cat === _cat) && (!_show || (_show === 'done' ? !!i.done || progress(i).done > 0 : !i.done))
      && (!q || [i.title, i.note, i.place, i.memory, catOf(i.cat).label].some((t) => String(t || '').toLowerCase().includes(q))));
    if (_show || q) listHost.appendChild(el('div', { class: 'bk-show' }, [
      el('span', { text: shown.length + ' ' + (_show === 'done' ? 'checked' : _show === 'todo' ? 'to do' : 'found') + (q ? ' for “' + _q.trim() + '”' : '') }),
      el('button', { type: 'button', class: 'btn ghost small', text: 'Show all', onclick: () => { _show = ''; _q = ''; renderBucket(); } }),
    ]));
    if (!shown.length) {
      listHost.appendChild(el('div', { class: 'bk-empty' }, [el('div', { class: 'bk-empty-e', text: q ? '🔍' : _show === 'done' ? '🌱' : '🎉' }),
        el('p', { text: q ? 'Nothing on the list matches that.' : _show === 'done' ? 'Nothing ticked off yet - the first one is the best one.' : 'Everything is ticked off. Time to dream up more!' })]));
      return;
    }
    listHost.appendChild(el('div', { class: 'bk-list is-ranked' + (_edit ? ' is-editing' : '') }, shown.map((i) => itemCard(list, p, i, year, false, ranked.indexOf(i) + 1))));
  };
  drawList();

  // ---- Ideas while the list is short ----
  if (s.todo < 6) {
    const have = new Set(p.items.map((i) => i.title.toLowerCase()));
    const ideas = IDEAS.filter(([, t]) => !have.has(t.toLowerCase())).slice(0, 8);
    if (ideas.length) host.appendChild(el('div', { class: 'bk-ideas' }, [
      el('div', { class: 'bk-h', text: '💡 Ideas - tap to add' }),
      el('div', { class: 'bk-idea-row' }, ideas.map(([cat, t]) => el('button', { type: 'button', class: 'bk-idea', onclick: async () => {
        await saveAndShow(addItem(list, p.id, { title: t, cat }), 'Added to ' + p.name + '’s list');
      } }, [catOf(cat).icon + ' ' + t]))),
    ]));
  }
  host.appendChild(el('p', { class: 'hint bk-foot', text: 'Kept on this phone and in your backups. Tap a circle to tick a dream off; Milestones (below) tells the story of what came true.' }));
}

// ---- Insights: what the list says, category by category, put to keep the dreaming going ----
function renderInsights(host, list, p) {
  const year = new Date().getFullYear();
  const s = insights(p.items, year);
  const day = Math.floor(Date.now() / 86400000);
  host.appendChild(el('div', { class: 'bk-hero bk-in-hero' }, [
    el('div', { class: 'bk-in-cheer', text: '“' + CHEERS[day % CHEERS.length] + '”' }),
    el('div', { class: 'bk-in-big' }, [el('b', { text: String(s.done) }), el('span', { text: (s.done === 1 ? ' dream' : ' dreams') + ' come true' + (s.total ? ' · ' + s.pct + '% of ' + p.name + '’s list' : '') })]),
  ]));
  if (!s.total) {
    host.appendChild(el('div', { class: 'bk-empty' }, [el('div', { class: 'bk-empty-e', text: '💡' }), el('p', { text: 'Add a few dreams to My list - the insights grow with it.' })]));
    return;
  }
  // ---- Momentum ----
  const vs = s.thisYear > s.lastYear ? (s.thisYear - s.lastYear) + ' more than last year 🔥' : s.lastYear && s.thisYear < s.lastYear ? (s.lastYear - s.thisYear) + ' to go to beat last year' : s.lastYear ? 'level with last year' : 'a fresh start';
  host.appendChild(el('div', { class: 'bk-in-grid' }, [
    tile('🔥', String(s.thisYear), 'came true in ' + year, vs),
    s.best ? tile('🏆', String(s.best.year), 'your best year', s.best.count + (s.best.count === 1 ? ' dream' : ' dreams')) : tile('🌅', String(s.todo), 'dreams waiting', 'the best is ahead'),
    s.avg != null ? tile('⏱️', s.avg < 1 ? '< 1 mo' : tookLabel(s.avg), 'from wish to done', 'on average') : null,
    s.places ? tile('📍', String(s.places), s.places === 1 ? 'place' : 'places', 'where dreams came true') : null,
    s.stagesDone ? tile('🪜', String(s.stagesDone), s.stagesDone === 1 ? 'stage done' : 'stages done', 'every step counts') : null,
    tile('🌈', s.kinds + '/' + s.kindsAll, 'kinds of dream', s.kinds >= 5 ? 'a well-rounded life' : 'room to explore'),
  ].filter(Boolean)));

  // ---- Nudges ----
  const nudges = [
    s.strongest ? ['💪', s.strongest.cat.label + ' is your strength', s.strongest.done + ' of ' + s.strongest.total + ' ' + s.strongest.cat.label.toLowerCase() + ' dreams done. Ride the momentum - add the next one.'] : null,
    s.closest ? ['🧗', 'Almost there', '“' + s.closest.x.title + '” is ' + s.closest.p.pct + '% done - ' + (s.closest.p.total - s.closest.p.done) + ' stage' + (s.closest.p.total - s.closest.p.done === 1 ? '' : 's') + ' to go.'] : null,
    s.nextUp ? ['🎯', 'Next up', '“' + s.nextUp.title + '”' + (s.nextUp.by <= year ? ' was planned for ' + s.nextUp.by + ' - this is its year.' : ' by ' + s.nextUp.by + '. ' + (s.nextUp.cost ? 'Start saving for it in Savings > Bucket List Plan.' : 'Pick a month and make it real.'))] : null,
    s.oldest && s.oldest.since.slice(0, 4) < String(year) ? ['⏳', 'Your oldest wish', 'You have wanted to ' + s.oldest.title.charAt(0).toLowerCase() + s.oldest.title.slice(1) + ' since ' + s.oldest.since.slice(0, 4) + '. Could ' + year + ' be the year?'] : null,
    s.untouched ? ['🌱', 'Waiting for a first tick', 'Nothing in ' + s.untouched.cat.icon + ' ' + s.untouched.cat.label + ' done yet - ' + s.untouched.total + ' dream' + (s.untouched.total === 1 ? '' : 's') + ' there. Choose one for this year.'] : null,
    s.fastest && s.fastest.m <= 12 ? ['⚡', 'Proof it can happen fast', '“' + s.fastest.x.title + '” came true ' + (s.fastest.m < 1 ? 'within a month of being wished for.' : 'just ' + tookLabel(s.fastest.m) + ' after it was first wished for.')] : null,
  ].filter(Boolean);
  if (nudges.length) {
    host.appendChild(el('div', { class: 'bk-h', text: '✨ For you' }));
    host.appendChild(el('div', { class: 'bk-in-nudges' }, nudges.map(([i, h, t]) => el('div', { class: 'bk-in-nudge' }, [el('span', { class: 'bk-in-ico', text: i }), el('div', {}, [el('b', { text: h }), el('p', { text: t })])]))));
  }

  // ---- By category ----
  host.appendChild(el('div', { class: 'bk-h', text: '📊 By category' }));
  host.appendChild(el('div', { class: 'bk-in-cats' }, s.cats.map((c, ix) => el('div', { class: 'bk-in-cat' }, [
    el('span', { class: 'bk-in-cat-ico', text: c.cat.icon }),
    el('div', { class: 'bk-in-cat-b' }, [
      el('div', { class: 'bk-in-cat-h' }, [el('b', { text: c.cat.label + (ix === 0 && c.done ? ' 👑' : '') }), el('span', { text: c.done + ' of ' + c.total + ' done' })]),
      el('span', { class: 'bk-prog-bar' }, [el('i', { style: 'width:' + c.pct + '%' })]),
    ]),
    el('b', { class: 'bk-in-cat-p', text: c.pct + '%' }),
  ]))));
}
const tile = (ico, v, k, sub) => el('div', { class: 'bk-in-tile' }, [el('span', { class: 'bk-in-tile-i', text: ico }), el('b', { text: v }), el('span', { text: k }), sub ? el('small', { text: sub }) : null].filter(Boolean));

// ---- Milestones: a real milestone timeline - a centre line, the years as nodes on it, each dream that came true (and
// each stage reached) as a card on alternating sides. Above "Today", the dreams coming up on a dashed future line. A
// year bar stays at the top: a tap glides to that year, and it follows along while scrolling. Cards ease in as they
// come into view (not when the phone asks for reduced motion).
function renderMilestones(host, list, p) {
  const m = milestones(p.items);
  const avg = averageTook(p.items);
  const now = new Date(), year = now.getFullYear();
  const firstYear = m.first ? Number(m.first.since.slice(0, 4)) : null;
  host.appendChild(el('div', { class: 'bk-hero bk-ms-hero' }, [
    el('div', { class: 'bk-ms-hero-t' }, [el('span', { class: 'bk-hero-e', text: '🏆' }), el('div', {}, [
      el('b', { text: p.name + '’s milestones' }),
      el('span', { text: m.count ? m.count + (m.count === 1 ? ' dream' : ' dreams') + ' came true' + (firstYear ? ' · dreaming since ' + firstYear : '') : 'The story starts with the first dream ticked off' }),
    ])]),
    avg != null ? el('div', { class: 'bk-ms-hero-s', text: '⏱️ A dream takes ' + (avg < 1 ? 'under a month' : tookLabel(avg)) + ' to come true, on average' }) : null,
  ].filter(Boolean)));

  // Coming up: the next dreams with a year, farthest at the top of the future line.
  const upcoming = p.items.filter((i) => !i.done && i.by).sort((a, b) => (a.by - b.by) || (Number(!!b.star) - Number(!!a.star))).slice(0, 3).reverse();
  if (!m.years.length && !upcoming.length) {
    host.appendChild(el('div', { class: 'bk-empty' }, [el('div', { class: 'bk-empty-e', text: '🌱' }),
      el('p', { text: 'Nothing has come true yet. Tick a dream off on My list - or check in a stage - and it becomes the first milestone here.' })]));
    return;
  }

  // ---- The year bar ----
  const anchors = [];
  const bar = el('div', { class: 'bk-tl-years' });
  const chip = (label, target, cls) => {
    const b = el('button', { type: 'button', class: 'bk-tl-chip ' + (cls || ''), text: label, onclick: () => target.scrollIntoView({ behavior: 'smooth', block: 'start' }) });
    bar.appendChild(b); anchors.push([target, b]);
  };

  const tl = el('div', { class: 'bk-tl' });
  let side = 0;
  const row = (card, node, cls) => {
    const left = side++ % 2 === 0;
    return el('div', { class: 'bk-tl-row ' + (left ? 'is-l' : 'is-r') + (cls ? ' ' + cls : '') }, [
      el('div', { class: 'bk-tl-side' }, [left ? card : null].filter(Boolean)),
      node,
      el('div', { class: 'bk-tl-side' }, [left ? null : card].filter(Boolean)),
    ]);
  };

  // Future
  if (upcoming.length) {
    const fut = el('div', { class: 'bk-tl-mark is-future' }, [el('span', { text: '🎯 Coming up' })]);
    tl.appendChild(fut);
    chip('Next', fut, 'is-future');
    upcoming.forEach((i) => tl.appendChild(row(
      el('div', { class: 'bk-tl-card is-future' }, [
        el('div', { class: 'bk-tl-when', text: 'By ' + i.by + (i.star ? ' · ★' : '') }),
        el('b', { class: 'bk-tl-title', text: i.title }),
        progress(i).total ? el('span', { class: 'bk-prog-bar' }, [el('i', { style: 'width:' + progress(i).pct + '%' })]) : null,
        el('small', { class: 'bk-tl-sub', text: catOf(i.cat).label + (i.place ? ' · 📍 ' + i.place : '') }),
      ].filter(Boolean)),
      el('span', { class: 'bk-tl-node is-future', text: catOf(i.cat).icon }), 'is-future')));
  }
  // Today
  const today = el('div', { class: 'bk-tl-mark is-today' }, [el('span', { text: '📍 Today · ' + MONS[now.getMonth()] + ' ' + year })]);
  tl.appendChild(today);
  if (!upcoming.length) chip('Today', today);

  // The years, newest first
  m.years.forEach((g) => {
    const said = [g.dreams ? g.dreams + (g.dreams === 1 ? ' dream' : ' dreams') : null, g.stages ? g.stages + (g.stages === 1 ? ' step' : ' steps') : null].filter(Boolean).join(' · ');
    const yn = el('div', { class: 'bk-tl-year' }, [el('b', { text: String(g.year) }), el('small', { text: said })]);
    tl.appendChild(yn);
    chip(String(g.year), yn);
    g.events.forEach((e) => tl.appendChild(e.kind === 'dream' ? row(msDream(e.item), el('span', { class: 'bk-tl-node', text: catOf(e.item.cat).icon }))
      : row(msStage(e), el('span', { class: 'bk-tl-node is-small' }), 'is-stage')));
  });
  // Where it began
  if (m.first) {
    const start = el('div', { class: 'bk-tl-start' }, [el('span', { class: 'bk-tl-node is-start', text: '🌱' }),
      el('b', { text: 'Where it began · ' + ymText(m.first.since) }), el('small', { text: 'The first wish: “' + m.first.title + '”' })]);
    tl.appendChild(start);
    chip('Began', start, 'is-start');
  }
  host.appendChild(bar);
  host.appendChild(tl);

  // Ease cards in as they come into view; keep the year bar on the year being read.
  const cards = tl.querySelectorAll('.bk-tl-row, .bk-tl-year, .bk-tl-mark, .bk-tl-start');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) { cards.forEach((c) => c.classList.add('is-in')); }
  else {
    const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { threshold: 0.12 });
    cards.forEach((c) => io.observe(c));
    const spy = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting) return;
        const hit = anchors.find(([t]) => t === en.target);
        if (!hit) return;
        anchors.forEach(([, b]) => b.classList.toggle('on', b === hit[1]));
        hit[1].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    }, { rootMargin: '-120px 0px -60% 0px' });
    anchors.forEach(([t]) => spy.observe(t));
  }
  if (anchors[0]) anchors[0][1].classList.add('on');
}
function msDream(i) {
  const c = catOf(i.cat), t = took(i);
  return el('div', { class: 'bk-tl-card' }, [
    el('div', { class: 'bk-tl-when', text: ymText(i.done) }),
    el('b', { class: 'bk-tl-title', text: i.title }),
    el('small', { class: 'bk-tl-sub', text: c.label + (t != null && t >= 1 ? ' · ' + tookLabel(t) + ' in the making' : '') }),
    i.memory ? el('p', { class: 'bk-tl-quote', text: '“' + i.memory + '”' }) : null,
    i.place ? placeChip(i.place) : null,
  ].filter(Boolean));
}
function msStage(e) {
  const pct = e.total ? Math.round((e.doneBy / e.total) * 100) : 0;
  return el('div', { class: 'bk-tl-card is-mini' }, [
    el('div', { class: 'bk-tl-when', text: ymText(e.ym) + ' · ' + e.doneBy + '/' + e.total }),
    el('span', { class: 'bk-tl-step', text: '✅ ' + e.step.title }),
    el('span', { class: 'bk-prog-bar' }, [el('i', { style: 'width:' + pct + '%' })]),
    el('small', { class: 'bk-tl-sub', text: pct + '% of “' + e.item.title + '”' }),
  ]);
}
// The kind of place - International, or in India: within Tamil Nadu, another state, a Union Territory. Picked from the
// place's name as it is typed (until the person picks one themselves).
function placeTypePick(input, current) {
  let val = current || guessPlaceType(input.value), mine = !!current;
  const row = el('div', { class: 'bk-ptype' + (input.value.trim() ? '' : ' hidden') });
  const draw = () => { row.innerHTML = ''; PLACE_TYPES.forEach((t) => row.appendChild(el('button', { type: 'button', class: val === t.id ? 'on' : '', onclick: () => { val = t.id; mine = true; draw(); } }, [t.icon + ' ' + t.label]))); };
  input.addEventListener('input', () => { row.classList.toggle('hidden', !input.value.trim()); if (!mine) { val = guessPlaceType(input.value); draw(); } });
  draw();
  return { el: row, value: () => val, set: (id) => { val = id; mine = true; row.classList.remove('hidden'); draw(); } };
}
// The state, UT or country: filled from the place's name as it is typed, until the person types their own. Typing one
// MyNotes knows (e.g. Kerala, Sri Lanka) also sets the kind of place.
function regionPick(place, kind, current) {
  let mine = !!current;
  const guess = () => { const g = guessRegion(place.value); return g ? g.region : ''; };
  const input = el('input', { type: 'text', maxlength: '60', list: 'bkRegionList', autocomplete: 'off', value: current || guess(), placeholder: 'Filled from the place - e.g. Kerala, Sri Lanka' });
  place.addEventListener('input', () => { if (!mine) input.value = guess(); });
  input.addEventListener('input', () => { mine = !!input.value.trim(); const r = regionInfo(input.value); if (r) kind.set(r.type); });
  return { el: el('div', {}, [input, el('datalist', { id: 'bkRegionList' }, REGION_NAMES.map((n) => el('option', { value: n })))]), value: () => input.value.trim() };
}
// Landscapes: tap as many as fit; each one picked gets a box for its name (which beach, which falls). In Tamil Nadu
// (tnOf), Temple shows the gopuram.
function geoPick(current, spots, tnOf) {
  const iconOf = (g) => (g.id === 'temple' && tnOf && tnOf() ? gopuramEl(g.label) : document.createTextNode(g.icon));
  const sel = new Set(current || []);
  // The names for each landscape: a list (+ adds another box - three temples, two beaches).
  const names = {};
  Object.entries(spots || {}).forEach(([k, v]) => { names[k] = [].concat(v || []); });
  const row = el('div', { class: 'bk-ptype bk-geo' });
  const boxes = el('div', { class: 'bk-spots' });
  let focusAt = null;
  const draw = () => {
    row.innerHTML = ''; boxes.innerHTML = '';
    GEOS.forEach((g) => row.appendChild(el('button', { type: 'button', class: sel.has(g.id) ? 'on' : '', onclick: () => { if (sel.has(g.id)) sel.delete(g.id); else sel.add(g.id); draw(); } }, [iconOf(g), ' ' + g.label])));
    GEOS.filter((g) => sel.has(g.id)).forEach((g) => {
      const list = names[g.id] && names[g.id].length ? names[g.id] : (names[g.id] = ['']);
      const noun = g.label.toLowerCase().split(' /')[0];
      list.forEach((val, i) => {
        const inp = el('input', { type: 'text', maxlength: '80', value: val, placeholder: i ? 'Another ' + noun + '…' : 'Which ' + noun + '? (optional)', oninput: () => { list[i] = inp.value; } });
        boxes.appendChild(el('div', { class: 'bk-spot' + (i ? ' is-more' : '') }, [
          i ? el('span', { class: 'bk-spot-i is-more' }) : el('span', { class: 'bk-spot-i', title: g.label }, [iconOf(g)]),
          inp,
          i ? el('button', { type: 'button', class: 'bk-spot-btn', 'aria-label': 'Remove this ' + noun, text: '✕', onclick: () => { list.splice(i, 1); draw(); } }) : null,
          i === list.length - 1 && list.length < 12 ? el('button', { type: 'button', class: 'bk-spot-btn is-add', 'aria-label': 'Add another ' + noun, text: '+', onclick: () => { list.push(''); focusAt = g.id; draw(); } }) : null,
        ].filter(Boolean)));
        if (focusAt === g.id && i === list.length - 1) setTimeout(() => inp.focus(), 0);
      });
    });
    focusAt = null;
  };
  draw();
  const ids = () => [...sel];   // in the order picked - the first one is the place's icon
  return { redraw: draw, el: el('div', {}, [row, boxes]), value: ids,
    spots: () => Object.fromEntries(ids().map((id) => [id, (names[id] || []).map((n) => String(n || '').trim()).filter(Boolean)]).filter(([, a]) => a.length)) };
}
// Where they stayed: tags - tap a suggestion, or type one and press Enter; ✕ takes one off.
function stayPick(current) {
  const tags = (current || []).slice();
  const box = el('div', { class: 'bk-tags' });
  const sugg = el('div', { class: 'bk-ptype' });
  const input = el('input', { type: 'text', maxlength: '40', placeholder: 'Type a stay and press Enter - e.g. Hotel Sea View' });
  const at = (t) => tags.findIndex((u) => u.toLowerCase() === t.trim().toLowerCase());
  const add = (t) => { if (t.trim() && at(t) < 0 && tags.length < 8) tags.push(t.trim()); };
  const draw = () => {
    box.innerHTML = ''; sugg.innerHTML = '';
    tags.forEach((t, i) => box.appendChild(el('span', { class: 'bk-tag' }, [t, el('button', { type: 'button', 'aria-label': 'Remove ' + t, text: '✕', onclick: () => { tags.splice(i, 1); draw(); } })])));
    STAYS.forEach((t) => sugg.appendChild(el('button', { type: 'button', class: at(t) >= 0 ? 'on' : '', onclick: () => { if (at(t) >= 0) tags.splice(at(t), 1); else add(t); draw(); } }, [t])));
  };
  const flush = () => { if (input.value.trim()) { add(input.value); input.value = ''; draw(); } };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); flush(); } });
  input.addEventListener('blur', flush);
  draw();
  return { el: el('div', {}, [box, input, sugg]), value: () => { flush(); return tags.slice(); } };
}
// A place's details on one line: Kerala · 🏖️⛰️ · Resort, Airbnb · 3 days.
// A temple gopuram, for heritage in Tamil Nadu (there is no emoji for one).
// Who with: an icon each, drawn so every one is different - a red heart (with her), a trekker with a backpack (solo),
// a car with four inside (family), father and mother with the baby in their arms (with baby), three friends, a briefcase.
const WITH_ICONS = {
  her: '<path d="M12 21s-7.6-4.7-9.7-9.3C.8 8.3 2.9 4.4 6.6 4.4c2.2 0 3.7 1.2 4.4 2.7.8-1.5 2.3-2.7 4.4-2.7 3.7 0 5.8 3.9 4.3 7.3C19.6 16.3 12 21 12 21z" fill="#e11d48"/>',
  solo: '<rect x="7.2" y="6.6" width="4.2" height="6.4" rx="1.3" transform="rotate(-12 9.3 9.8)" fill="#f97316"/><circle cx="13.4" cy="3.6" r="2.1" fill="#0f766e"/>'
    + '<g fill="none" stroke="#0f766e" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12.7 6.6L11 13.2l2.6 3.8-.6 4.9"/><path d="M11 13.2l-2.3 4.2-1.9 4.3"/><path d="M12.4 8.6l3.4 2.6"/></g>'
    + '<path d="M17.6 5.6l-1.9 16.6" stroke="#92400e" stroke-width="1.5" stroke-linecap="round"/>',
  family: '<path d="M1.8 15.2l2.1-5.1c.4-1 1.4-1.7 2.5-1.7h11.2c1.1 0 2.1.7 2.5 1.7l2.1 5.1v3.4c0 .8-.7 1.5-1.5 1.5H3.3c-.8 0-1.5-.7-1.5-1.5z" fill="#2563eb"/>'
    + '<path d="M4.6 15l1.9-5.6c.2-.5.6-.9 1.2-.9h8.6c.6 0 1 .4 1.2.9l1.9 5.6z" fill="#dbeafe"/>'
    + '<g fill="#1e3a8a"><circle cx="7.4" cy="12.2" r="1.6"/><circle cx="10.6" cy="11.9" r="1.6"/><circle cx="13.6" cy="12.5" r="1.25"/><circle cx="16.5" cy="12.7" r="1.15"/></g>'
    + '<circle cx="6.6" cy="20.1" r="2" fill="#111827"/><circle cx="17.4" cy="20.1" r="2" fill="#111827"/>',
  baby: '<circle cx="6.6" cy="4.3" r="2.2" fill="#1d4ed8"/><path d="M3.9 8.4h5.4l.4 8H8.4l-.3 5.4H5.4l-.3-5.4H3.6z" fill="#1d4ed8"/>'
    + '<circle cx="17.4" cy="4.8" r="2" fill="#db2777"/><path d="M15 8.6h4.8l1.6 8.6h-2.2l-.3 4.6h-2.9l-.3-4.6h-2.3z" fill="#db2777"/>'
    + '<ellipse cx="12" cy="12.4" rx="3.6" ry="2.3" fill="#f472b6"/><circle cx="9.8" cy="10.6" r="2" fill="#f59e0b"/>'
    + '<path d="M9.2 10.2l2 1.6M15.1 10.4l-2 1.4" stroke="#334155" stroke-width="1.1" stroke-linecap="round"/>',
  friends: '<circle cx="5.4" cy="8" r="2.2" fill="#7c3aed"/><path d="M1.6 18c0-2.9 1.7-5 3.8-5s3.8 2.1 3.8 5z" fill="#7c3aed"/>'
    + '<circle cx="18.6" cy="8" r="2.2" fill="#0891b2"/><path d="M14.8 18c0-2.9 1.7-5 3.8-5s3.8 2.1 3.8 5z" fill="#0891b2"/>'
    + '<circle cx="12" cy="6.2" r="2.5" fill="#16a34a"/><path d="M7.6 19c0-3.4 2-5.8 4.4-5.8s4.4 2.4 4.4 5.8z" fill="#16a34a"/>',
  work: '<path d="M9 6.5V5.2C9 4.5 9.6 4 10.3 4h3.4c.7 0 1.3.5 1.3 1.2v1.3" fill="none" stroke="#78350f" stroke-width="1.6"/>'
    + '<rect x="2.6" y="6.6" width="18.8" height="13" rx="2" fill="#92400e"/><path d="M2.6 11.8h18.8" stroke="#78350f" stroke-width="1.2"/><rect x="10.6" y="10.6" width="2.8" height="2.6" rx=".5" fill="#fbbf24"/>',
};
// The icon of who a trip was with, as an element.
export function withIcon(id, cls) {
  const s = el('span', { class: 'bk-with' + (cls ? ' ' + cls : ''), title: (companionOf(id) || {}).label || '' });
  s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (WITH_ICONS[id] || '') + '</svg>';
  return s;
}
// Who with: tap one (tap again to clear).
function withPick(current) {
  let val = current || '';
  const row = el('div', { class: 'bk-ptype bk-with-pick' });
  const draw = () => { row.innerHTML = ''; COMPANIONS.forEach((w) => row.appendChild(el('button', { type: 'button', class: val === w.id ? 'on' : '', onclick: () => { val = val === w.id ? '' : w.id; draw(); } }, [withIcon(w.id), w.label]))); };
  draw();
  return { el: row, value: () => val };
}
// A cup for the top three on the journey: gold, silver, bronze.
const CUP_METALS = { 1: ['#facc15', '#a16207'], 2: ['#e2e8f0', '#64748b'], 3: ['#e0975a', '#8a4b16'] };
export function cupSvg(n) {
  const [c, d] = CUP_METALS[n];
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.6H4.2a2.6 2.6 0 0 0 2.9 4.4M17 4.6h2.8a2.6 2.6 0 0 1-2.9 4.4" fill="none" stroke="' + d + '" stroke-width="1.7" stroke-linecap="round"/>'
    + '<path d="M6.6 2.6h10.8v5a5.4 5.4 0 0 1-10.8 0z" fill="' + c + '" stroke="' + d + '" stroke-width="1.1"/>'
    + '<path d="M9.3 4.3v3.1a2.8 2.8 0 0 0 1.4 2.4" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.1" stroke-linecap="round"/>'
    + '<rect x="10.9" y="12.9" width="2.2" height="3.3" fill="' + d + '"/><path d="M8.2 19.4c0-1.8 1.7-3.2 3.8-3.2s3.8 1.4 3.8 3.2z" fill="' + c + '" stroke="' + d + '" stroke-width="1"/>'
    + '<rect x="6.8" y="19.2" width="10.4" height="2.4" rx=".7" fill="' + d + '"/></svg>';
}
export const GOPURAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.2 0.6h1.6v2.2h-1.6z" fill="#eab308"/>'
  + '<path d="M7.6 3h8.8a1.2 1.2 0 0 1 0 2.4H7.6a1.2 1.2 0 0 1 0-2.4z" fill="#d97706"/>'
  + '<g fill="#f59e0b" stroke="#9a3412" stroke-width=".5" stroke-linejoin="round"><path d="M8.2 5.4h7.6l.7 3H7.5z"/><path d="M7.5 8.4h9l.8 3.3H6.7z"/>'
  + '<path d="M6.7 11.7h10.6l.9 3.6H5.8z"/><path d="M4.8 15.3h14.4v7.9H4.8z"/></g>'
  + '<path d="M10.3 23.2v-3.6a1.7 1.7 0 0 1 3.4 0v3.6z" fill="#7c2d12"/></svg>';
const gopuramEl = (title) => { const s = el('span', { class: 'bk-gopuram', title: title || 'Temple' }); s.innerHTML = GOPURAM; return s; };
// A landscape's icon on a place; heritage in Tamil Nadu is a gopuram.
function geoIcon(id, x) {
  if (id === 'temple' && x && (x.type === 'tn' || x.region === 'Tamil Nadu')) return gopuramEl(geoOf(id).label);
  return document.createTextNode(geoOf(id).icon);
}
// A place's icon: its first landscape, else its kind of place.
const placeIcon = (x) => (x.geo.length ? geoIcon(x.geo[0], x) : document.createTextNode((placeTypeOf(x.type) || { icon: '📍' }).icon));
// A place's details on one line: Kerala · 🏖️⛰️ · Resort, Airbnb · 3 days.
function tripLine(x, withRegion) {
  const parts = [withRegion ? x.region : '', x.geo.length ? x.geo : '', x.stay.join(', '), stayND(x)].filter((p) => p && p.length);
  if (!parts.length) return null;
  const kids = [];
  parts.forEach((p, i) => { if (i) kids.push(' · '); if (Array.isArray(p)) p.forEach((g) => kids.push(geoIcon(g, x))); else kids.push(p); });
  return el('small', { class: 'bk-pl-det' }, kids);
}
// Stars: a tap picks 1-5, a tap on the same star clears it.
const RATE_WORDS = ['', 'Okay', 'Good', 'Very good', 'Loved it', 'Best ever'];
export const starsText = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
function starPick(current) {
  let val = current || 0;
  const row = el('div', { class: 'bk-stars-pick', role: 'group', 'aria-label': 'Rating' });
  const draw = () => {
    row.innerHTML = '';
    [1, 2, 3, 4, 5].forEach((n) => row.appendChild(el('button', { type: 'button', class: n <= val ? 'on' : '', 'aria-label': n + (n === 1 ? ' star' : ' stars'), text: '★', onclick: () => { val = val === n ? 0 : n; draw(); } })));
    row.appendChild(el('span', { class: 'bk-stars-t', text: val ? RATE_WORDS[val] : 'Tap to rate' }));
  };
  draw();
  return { el: row, value: () => val || null };
}
const daysText = (n) => n + (n === 1 ? ' day' : ' days');
const stayND = (x) => (x.days || x.nights ? nightsDays(nightsOf(x), x.days) : '');

// A place's card, on a tap outside Edit: everything about the trip, with the map and Change.
// ---- Places to visit: dreams on the bucket list with a place (until ticked off) and places added here, in a section
// that folds away (open or shut is remembered on this phone) ----
const tvOpen = () => { try { return localStorage.getItem('bkTvOpen') === '1'; } catch (_) { return false; } };
function renderToVisit(host, list, p) {
  const tv = placesToVisit(p.items, p.wishes);
  const open = tvOpen();
  const box = el('div', { class: 'bk-tv' + (open ? ' is-open' : '') });
  const toggle = () => { try { localStorage.setItem('bkTvOpen', open ? '0' : '1'); } catch (_) {} renderBucket(); };
  box.appendChild(el('div', { class: 'bk-tv-h', role: 'button', tabindex: '0', 'aria-expanded': String(open), onclick: toggle }, [
    el('b', { text: '🎯 Places to visit' }), el('span', { class: 'bk-pl-count', text: String(tv.length) }),
    el('button', { type: 'button', class: 'bk-arrange-btn is-add', onclick: (e) => { e.stopPropagation(); openToVisitForm(list, p, null); } }, ['+ Add']),
    el('span', { class: 'bk-tv-chev', text: open ? '▴' : '▾' }),
  ]));
  if (!open) {
    if (tv.length) box.appendChild(el('div', { class: 'bk-tv-peek', onclick: toggle }, [tv.slice(0, 4).map((x) => x.place).join(' · ') + (tv.length > 4 ? ' · +' + (tv.length - 4) : '')]));
    host.appendChild(box);
    return;
  }
  box.appendChild(tv.length ? el('div', { class: 'bk-tv-list' }, tv.map((x) => {
    const dream = x.source === 'dream';
    const change = () => (dream ? openItemForm(list, p, x.item) : openToVisitForm(list, p, x.wish));
    return el('div', { class: 'bk-tv-row', role: 'button', tabindex: '0', onclick: () => (_edit ? change() : openToVisitView(list, p, x)) }, [
      el('span', { class: 'bk-tv-i', text: (placeTypeOf(x.type) || { icon: '📍' }).icon }),
      el('div', {}, [el('b', { text: x.place }), el('small', { text: [dream ? '🪣 ' + x.title : x.title, x.region, x.by ? 'by ' + x.by : ''].filter(Boolean).join(' · ') })]),
      _edit ? el('span', { class: 'bk-pl-acts' }, [
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Change ' + x.place, text: '✏️', onclick: (e) => { e.stopPropagation(); change(); } }),
        el('button', { type: 'button', class: 'icon-btn bk-danger', 'aria-label': 'Take ' + x.place + ' off', text: '✕', onclick: async (e) => {
          e.stopPropagation();
          if (!(await appConfirm(dream ? 'Take ' + x.place + ' off Places to visit? “' + x.title + '” stays on your bucket list.' : 'Take ' + x.place + ' off Places to visit?'))) return;
          await saveAndShow(dream ? updateItem(list, p.id, x.id, { place: '', placeType: '', region: '' }) : removeWish(list, p.id, x.id), 'Taken off');
        } }),
      ]) : el('span', { class: 'bk-tv-go', text: '›' }),
    ]);
  })) : el('p', { class: 'bk-pl-none', text: 'Add a place you want to go. A dream on your bucket list with a place shows here too, until it is ticked off.' }));
  host.appendChild(box);
}
// ---- My places ranking: every place visited; drag ☰ to put a favourite higher. It folds away (remembered on this
// phone); the top three show on the journey's cards, and every rank on the map's places when zoomed in. ----
const rkOpen = () => { try { return localStorage.getItem('bkRkOpen') === '1'; } catch (_) { return false; } };
function renderRanking(host, list, p, ranking, track) {
  const open = rkOpen();
  const toggle = () => { try { localStorage.setItem('bkRkOpen', open ? '0' : '1'); } catch (_) {} renderBucket(); };
  const head = el('div', { class: 'bk-rk-h', role: 'button', tabindex: '0', 'aria-expanded': String(open), onclick: toggle }, [
    el('b', { text: '🏆 My places ranking' }),
    open ? el('small', { text: 'Drag ☰ to put a favourite higher' }) : null,
    el('span', { class: 'bk-tv-chev', text: open ? '▴' : '▾' }),
  ].filter(Boolean));
  if (!open) {
    const medal = ['🥇', '🥈', '🥉'];
    host.appendChild(el('div', { class: 'bk-rk' }, [head, ranking.length ? el('div', { class: 'bk-tv-peek', onclick: toggle }, [ranking.slice(0, 3).map((r, i) => medal[i] + ' ' + r.place).join('  ·  ')]) : null].filter(Boolean)));
    return;
  }
  const box = el('div', { class: 'bk-rk-list' }, ranking.map((r) => el('div', { class: 'bk-rk-item', 'data-id': r.key }, [
    el('span', { class: 'bk-rk-n' + (r.rank <= 3 ? ' is-' + r.rank : ''), text: String(r.rank) }),
    el('span', { class: 'bk-rk-i' }, [placeIcon(r.latest)]),
    el('div', {}, [
      el('b', {}, [r.place, r.rating ? el('span', { class: 'bk-stars', text: ' ' + starsText(r.rating) }) : null].filter(Boolean)),
      el('small', { text: [r.trips + (r.trips === 1 ? ' trip' : ' trips'), r.latest.region, MONS[Number(r.latest.ym.slice(5, 7)) - 1] + ' ' + r.latest.ym.slice(0, 4)].filter(Boolean).join(' · ') }),
      r.memory ? el('i', { class: 'bk-rk-mem', text: '“' + r.memory + '”' }) : null,
    ].filter(Boolean)),
    el('span', { class: 'bk-handle', role: 'button', 'aria-label': 'Drag ' + r.place + ' up or down', text: '☰' }),
  ])));
  // After a drag: the new order is kept, and the numbers here and on the journey change at once.
  sortable(box, async (keys) => {
    await save(updateProfile(list, p.id, { placeRank: keys }));
    p.placeRank = keys;
    keys.forEach((k, i) => {
      const n = i + 1, cls = (base) => base + (n <= 3 ? ' is-' + n : '');
      const row = box.querySelector('[data-id="' + CSS.escape(k) + '"] .bk-rk-n');
      if (row) { row.textContent = String(n); row.className = cls('bk-rk-n'); }
      track.querySelectorAll('.bk-pl-rank[data-key="' + CSS.escape(k) + '"]').forEach((b) => { b.innerHTML = n <= 3 ? cupSvg(n) : ''; b.className = cls('bk-pl-rank') + (n > 3 ? ' is-off' : ''); b.title = 'Ranked ' + n; });
    });
  }, '.bk-rk-item');
  host.appendChild(el('div', { class: 'bk-rk' }, [head, box]));
}

// A place to visit: what it is, with the map and Been there (a dream: its check-in; a place added here: a visit).
function openToVisitView(list, p, x) {
  const dream = x.source === 'dream', it = x.item;
  const line = (ico, k, val) => el('div', { class: 'bk-pv-row' }, [el('span', { class: 'bk-pv-i', text: ico }), el('div', {}, [el('small', { text: k }), el('b', { text: val })])]);
  openModal(el('div', { class: 'sheet has-fixed-footer bk-sheet' }, [
    el('div', { class: 'sheet-scroll' }, [
      el('h2', { text: '🎯 ' + x.place }),
      dream ? line(catOf(it.cat).icon, 'On your bucket list', it.title) : x.title ? line('📝', 'Why', x.title) : null,
      line((placeTypeOf(x.type) || { icon: '📌' }).icon, 'Where', [x.region, x.country && x.country !== x.region ? x.country : ''].filter(Boolean).join(', ') || 'Not set'),
      x.by ? line('📅', 'Planned for', String(x.by)) : null,
      dream && it.cost ? line('💰', 'Cost', fmtIntCur(it.cost) + (it.saved ? ' · ' + fmtIntCur(it.saved) + ' saved' : '')) : null,
      dream && it.note ? line('📝', 'Note', it.note) : null,
    ].filter(Boolean)),
    el('div', { class: 'sheet-footer' }, [el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn ghost', type: 'button', text: '🗺️ Map', onclick: () => window.open(mapUrl(x.place), '_blank', 'noopener') }),
      el('button', { class: 'btn primary', type: 'button', text: '✓ Been there', onclick: () => {
        closeModal();
        setTimeout(() => (dream ? openCheckIn(list, p, it) : openPlaceForm(list, p, null, { place: x.place, placeType: x.wish.placeType, region: x.wish.region, wishId: x.id })), 0);
      } }),
    ])]),
  ]));
}
// Add (or change) a place to visit - its own list, apart from the dreams.
function openToVisitForm(list, p, w) {
  const place = el('input', { type: 'text', maxlength: '80', value: w ? w.place : '', placeholder: 'e.g. Munnar, Kerala' });
  const kind = placeTypePick(place, w ? w.placeType : '');
  const reg = regionPick(place, kind, w ? w.region : '');
  const by = el('input', { type: 'number', inputmode: 'numeric', min: String(new Date().getFullYear()), max: '2100', value: w && w.by ? String(w.by) : '', placeholder: 'Optional - e.g. ' + (new Date().getFullYear() + 1) });
  const note = el('input', { type: 'text', maxlength: '80', value: w ? w.note : '', placeholder: 'Optional - e.g. See the tea gardens, Honeymoon' });
  const del = w ? el('button', { class: 'btn ghost bk-danger', type: 'button', text: 'Remove', onclick: async () => {
    if (!(await appConfirm('Take ' + w.place + ' off Places to visit?'))) return;
    await saveAndShow(removeWish(list, p.id, w.id), 'Taken off');
  } }) : null;
  sheet(w ? '🎯 Change a place to visit' : '🎯 Add a place to visit', [
    field('Place', el('div', {}, [el('div', { class: 'bk-place-row' }, [place,
      el('button', { type: 'button', class: 'btn ghost small', text: '🗺️ Check on map', onclick: () => { const v = place.value.trim(); if (!v) { toast('Type the place first'); place.focus(); return; } window.open(mapUrl(v), '_blank', 'noopener'); } })]), kind.el])),
    field('State / Union Territory / Country', reg.el),
    el('div', { class: 'field-row' }, [field('By year', by), field('Why?', note)]),
  ], async () => {
    const pl = place.value.trim();
    if (!pl) { toast('Type the place'); place.focus(); return; }
    const yr = Number(by.value);
    const data = { place: pl, placeType: kind.value(), region: reg.value(), by: yr >= new Date().getFullYear() ? yr : null, note: note.value };
    await saveAndShow(w ? updateWish(list, p.id, w.id, data) : addWish(list, p.id, data), w ? 'Changed' : '🎯 ' + pl + ' added to places to visit');
  }, del);
  if (!w) setTimeout(() => place.focus(), 50);
}

function openPlaceView(list, p, x) {
  const t = placeTypeOf(x.type);
  const line = (ico, k, v) => el('div', { class: 'bk-pv-row' }, [el('span', { class: 'bk-pv-i', text: ico }), el('div', {}, [el('small', { text: k }), el('b', { text: v })])]);
  openModal(el('div', { class: 'sheet has-fixed-footer bk-sheet' }, [
    el('div', { class: 'sheet-scroll' }, [
      _photos[x.id] ? el('img', { class: 'bk-pv-photo', src: _photos[x.id], alt: x.place }) : null,
      el('h2', { text: (x.source === 'visit' ? '🧳 ' : '📍 ') + x.place }),
      x.from ? line((MODES.find((m) => m.id === x.mode) || { icon: '🧭' }).icon, 'Route', x.from + ' → ' + x.place + (x.mode ? ' · ' + MODES.find((m) => m.id === x.mode).label : '')) : null,
      line('📅', 'When', ymText(x.ym) + (stayND(x) ? ' · ' + stayND(x) : '')),
      line(t ? t.icon : '📌', 'Where', [x.region, x.country && x.country !== x.region ? x.country : ''].filter(Boolean).join(', ') || (t ? t.label : 'Not set')),
      line(x.source === 'dream' ? '🎯' : '📝', x.source === 'dream' ? 'The dream' : 'What it was', x.label),
      x.with ? el('div', { class: 'bk-pv-row' }, [withIcon(x.with, 'bk-pv-i'), el('div', {}, [el('small', { text: 'Who with' }), el('b', { text: companionOf(x.with).label })])]) : null,
      x.rating ? line('⭐', 'Rating', starsText(x.rating) + '  ' + RATE_WORDS[x.rating]) : null,
      x.memory ? line('💭', 'Best memory', x.memory) : null,
      x.geo.length ? el('div', { class: 'bk-pv-row' }, [el('span', { class: 'bk-pv-i', text: '🏞️' }), el('div', {}, [el('small', { text: 'Landscape' }),
        el('div', { class: 'bk-ti-chips' }, x.geo.flatMap((g) => (x.spots[g] || [geoOf(g).label]).map((n) => el('span', {}, [geoIcon(g, x), ' ' + n]))))])]) : null,
      x.adv.length ? el('div', { class: 'bk-pv-row' }, [el('span', { class: 'bk-pv-i', text: '🧗' }), el('div', {}, [el('small', { text: 'Adventures' }),
        el('div', { class: 'bk-ti-chips bk-adv-badges' }, x.adv.map((a) => el('span', {}, [adventureOf(a).icon + ' ' + adventureOf(a).label])))])]) : null,
      x.stay.length ? el('div', { class: 'bk-pv-row' }, [el('span', { class: 'bk-pv-i', text: '🛏️' }), el('div', {}, [el('small', { text: 'Stayed at' }),
        el('div', { class: 'bk-ti-chips' }, x.stay.map((s) => el('span', { text: s })))])]) : null,
    ].filter(Boolean)),
    el('div', { class: 'sheet-footer' }, [el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn ghost', type: 'button', text: '✏️ Change', onclick: () => { closeModal(); openPlaceForm(list, p, x); } }),
      el('button', { class: 'btn primary', type: 'button', text: '🗺️ Open on map', onclick: () => window.open(mapUrl(x.place), '_blank', 'noopener') }),
    ])]),
  ]));
}

// ---- Places: where dreams came true - a horizontal timeline, year by year, then each kind of place with its count ----
function renderPlaces(host, list, p) {
  const v = placesVisited(p.items, p.visits);
  const openMap = () => import('./bucket-map.js').then((m) => m.openPlacesMap({ v, toVisit: placesToVisit(p.items, p.wishes), photos: _photos, goals: p.goals,
    ranks: Object.fromEntries(placeRanking(v.visits, p.placeRank).map((r) => [r.key, r.rank])),
    onGoal: async (n) => { await save(updateProfile(list, p.id, { goals: Object.assign({}, p.goals, { countries: n }) })); p.goals = Object.assign({}, p.goals, { countries: n }); } }));
  const india = v.byType.filter((t) => t.type.id !== 'intl').reduce((s, t) => s + t.count, 0);
  const intl = v.byType.find((t) => t.type.id === 'intl').count;
  host.appendChild(el('div', { class: 'bk-hero bk-pl-hero' }, [
    el('div', { class: 'bk-ms-hero-t' }, [
      // The map of every place, in a popup (loaded only when tapped).
      v.visits.length || placesToVisit(p.items, p.wishes).length ? el('button', { type: 'button', class: 'bk-hero-e bk-map-btn', title: 'Open the map', 'aria-label': 'Open the map of places visited', onclick: openMap }, ['🗺️', el('small', { text: 'Map' })]) : el('span', { class: 'bk-hero-e', text: '🗺️' }),
      el('div', {}, [
      el('b', { text: v.count + (v.count === 1 ? ' place' : ' places') + ' visited' }),
      el('span', { text: v.count ? '🌍 ' + intl + ' international · 📍 ' + india + ' in India' : 'Where your dreams came true, all in one place' }),
    ])]),
  ]));
  // Add a place (one visited outside any dream), and Edit: every place gets ✏️ to change it and ✕ to remove it.
  host.appendChild(_edit
    ? el('div', { class: 'bk-arrange-bar is-edit' }, [el('span', { text: '✏️ Change or remove a place' }), el('button', { type: 'button', class: 'btn primary small', text: 'Done', onclick: () => { _edit = false; renderBucket(); } })])
    : el('div', { class: 'bk-modes' }, [
      el('button', { type: 'button', class: 'bk-arrange-btn is-add', onclick: () => openPlaceForm(list, p, null) }, ['+ Add a place']),
      v.visits.length ? el('button', { type: 'button', class: 'bk-arrange-btn', onclick: () => { _edit = true; renderBucket(); } }, ['✏️ Edit']) : null,
    ].filter(Boolean)));
  if (!v.visits.length) {
    host.appendChild(el('div', { class: 'bk-empty' }, [el('div', { class: 'bk-empty-e', text: '📍' }),
      el('p', { text: 'Add a place you have been, or tick a dream off with where it was - it shows up here, on the year it happened.' })]));
    renderToVisit(host, list, p);
    return;
  }
  // Each place's rank (My places ranking, below): a badge on its cards.
  const ranking = placeRanking(v.visits, p.placeRank);
  const rankOf = new Map(ranking.map((r) => [r.key, r.rank]));
  const rankBadge = (k) => { const n = rankOf.get(k); const b = el('span', { class: 'bk-pl-rank' + (n <= 3 ? ' is-' + n : ' is-off'), 'data-key': k, title: 'Ranked ' + n }); b.innerHTML = n <= 3 ? cupSvg(n) : ''; return b; };
  // A tap on a place: in Edit, change it; otherwise show its card (with the map from there).
  const tapPlace = (x) => (_edit ? openPlaceForm(list, p, x) : openPlaceView(list, p, x));
  // The timeline, left to right: the oldest year first, so it reads like a journey; it opens on the newest end.
  host.appendChild(el('div', { class: 'bk-h', text: '🧭 The journey' }));
  const track = el('div', { class: 'bk-pl-track' }, v.years.map((g) => el('div', { class: 'bk-pl-year' }, [
    el('div', { class: 'bk-pl-y' }, [el('b', { text: String(g.year) }), el('small', { text: g.visits.length + (g.visits.length === 1 ? ' place' : ' places') })]),
    el('div', { class: 'bk-pl-stops' }, g.visits.slice().reverse().map((x) => {
      const t = placeTypeOf(x.type);
      return el('button', { type: 'button', class: 'bk-pl-stop is-' + x.type + (_edit ? ' is-edit' : ''), title: _edit ? 'Change this place' : 'See this trip', onclick: () => tapPlace(x) }, [
        rankBadge(x.place.trim().toLowerCase()),
        x.with ? withIcon(x.with, 'bk-pl-with') : null,
        el('span', { class: 'bk-pl-pin' }, [placeIcon(x)]),
        el('b', { text: x.place }),
        // The best memory there (not when or what it was - the year is above, the rest is on the place's card).
        x.memory ? el('small', { class: 'bk-pl-mem', text: '“' + x.memory + '”' }) : null,
        stayND(x) ? el('small', { class: 'bk-pl-det', text: stayND(x) }) : null,
        x.adv.length ? el('small', { class: 'bk-pl-adv', title: x.adv.map((a) => adventureOf(a).label).join(', '), text: x.adv.slice(0, 5).map((a) => adventureOf(a).icon).join('') }) : null,
        x.rating ? el('span', { class: 'bk-pl-stars', title: x.rating + ' of 5', text: starsText(x.rating) }) : null,
      ].filter(Boolean));
    })),
  ])));
  host.appendChild(track);
  // The years, side by side under the journey (in place of a scrollbar): a tap glides there; the year in view is lit
  // as the journey is swiped.
  const yearBar = el('div', { class: 'bk-pl-yearbar' }, v.years.map((g, i) => el('button', { type: 'button', 'aria-label': 'Go to ' + g.year, onclick: () => {
    const col = track.children[i];
    track.scrollTo({ left: Math.max(0, col.offsetLeft - (track.clientWidth - col.offsetWidth) / 2), behavior: 'smooth' });
  } }, [String(g.year)])));
  host.appendChild(yearBar);
  const lightYear = () => {
    const cols = [...track.children];
    if (!cols.length) return;
    let i;
    if (track.scrollLeft <= 2) i = 0;
    else if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 2) i = cols.length - 1;
    else {
      const mid = track.scrollLeft + track.clientWidth / 2;
      i = cols.findIndex((c) => c.offsetLeft + c.offsetWidth > mid);
      if (i < 0) i = cols.length - 1;
    }
    [...yearBar.children].forEach((b, k) => b.classList.toggle('on', k === i));
    const chip = yearBar.children[i];
    if (chip.offsetLeft < yearBar.scrollLeft) yearBar.scrollLeft = chip.offsetLeft - 8;
    else if (chip.offsetLeft + chip.offsetWidth > yearBar.scrollLeft + yearBar.clientWidth) yearBar.scrollLeft = chip.offsetLeft + chip.offsetWidth - yearBar.clientWidth + 8;
  };
  track.addEventListener('scroll', lightYear, { passive: true });
  // Open on the newest end, at once (no glide on arrival).
  track.style.scrollBehavior = 'auto'; track.scrollLeft = track.scrollWidth; track.style.scrollBehavior = '';
  lightYear();
  renderToVisit(host, list, p);
  renderRanking(host, list, p, ranking, track);
  renderTravelInsights(host, v);

  // Each kind of place: its count and the list.
  host.appendChild(el('div', { class: 'bk-h', text: '📌 By kind of place' }));
  host.appendChild(el('div', { class: 'bk-pl-kinds' }, v.byType.map((g) => el('div', { class: 'bk-pl-kind is-' + g.type.id + (g.count ? '' : ' is-empty') }, [
    el('div', { class: 'bk-pl-kind-h' }, [el('span', { class: 'bk-pl-kind-i', text: g.type.icon }), el('b', { text: g.type.label }), el('span', { class: 'bk-pl-count', text: String(g.count) })]),
    g.type.id !== 'tn' ? regionChips(g.visits) : null,
    g.visits.length ? el('div', { class: 'bk-pl-list' }, g.visits.map((x) => el('div', { class: 'bk-pl-row', role: 'button', tabindex: '0', onclick: () => tapPlace(x) }, [
      el('span', { text: x.source === 'visit' ? '🧳' : '📍' }), el('div', {}, [el('b', {}, [x.place, x.rating ? el('span', { class: 'bk-stars', text: ' ' + starsText(x.rating) }) : null].filter(Boolean)), el('small', { text: x.label }), tripLine(x, x.type !== 'tn')].filter(Boolean)), el('span', { class: 'bk-pl-when', text: MONS[Number(x.ym.slice(5, 7)) - 1] + ' ' + x.ym.slice(0, 4) }),
      _edit ? el('span', { class: 'bk-pl-acts' }, [
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Change ' + x.place, text: '✏️', onclick: (e) => { e.stopPropagation(); openPlaceForm(list, p, x); } }),
        el('button', { type: 'button', class: 'icon-btn bk-danger', 'aria-label': 'Remove ' + x.place, text: '✕', onclick: (e) => { e.stopPropagation(); removePlace(list, p, x); } }),
      ]) : null,
    ].filter(Boolean)))) : el('p', { class: 'bk-pl-none', text: 'None yet - ' + (g.type.id === 'intl' ? 'the world is waiting.' : 'one to plan?') }),
  ].filter(Boolean)))));
  host.appendChild(el('p', { class: 'hint bk-foot', text: 'Tap a place to see the trip and open the map. 📍 a dream that came true there · 🧳 a place added here. The state or country is picked from the name - change it, or add the landscape, stay and days, with Edit.' }));
}

// Add or change a place. One added here (🧳) has its own month, year and note; a dream's place (📍) is changed on the
// dream - its date stays the day the dream came true.
// pre: a place to visit being ticked off (Been there) - { place, placeType, region, wishId }; saving takes it off the list.
function openPlaceForm(list, p, x, pre) {
  const isDream = x && x.source === 'dream';
  const now = new Date();
  const place = el('input', { type: 'text', maxlength: '80', value: x ? x.place : pre ? pre.place : '', placeholder: 'e.g. Munnar, Kerala' });
  const kind = placeTypePick(place, x ? x.type : pre ? pre.placeType : '');
  const reg = regionPick(place, kind, x ? x.src.region : pre ? pre.region : '');
  const geo = geoPick(x ? x.src.geo : [], x ? x.src.spots : {}, () => kind.value() === 'tn' || /^tamil nadu$/i.test(reg.value()));
  place.addEventListener('input', () => geo.redraw());
  reg.el.addEventListener('input', () => geo.redraw());
  kind.el.addEventListener('click', () => setTimeout(() => geo.redraw(), 0));
  const stay = stayPick(x ? x.src.stay : []);
  const adv = advPick(x ? x.src.adv : []);
  const stars = starPick(x ? x.src.rating : null);
  const company = withPick(x ? x.src.with : '');
  const from = el('input', { type: 'text', maxlength: '80', value: x ? x.src.from || '' : '', placeholder: 'e.g. Chennai - draws the route on the map' });
  const mode = modePick(x ? x.src.mode : '');
  const photo = photoPick(x ? _photos[x.id] : '');
  const memory = el('textarea', { rows: '3', maxlength: '600', placeholder: 'The best moment there - e.g. Sunrise from the lighthouse, the fish curry at the shack' });
  memory.value = x ? x.src.memory || '' : '';
  // Nights and days away: the days follow the nights (+1: 2 nights = 3 days) until the days are typed by hand.
  const hasStay = x && (x.src.days || x.src.nights != null);
  const nights = el('input', { type: 'number', inputmode: 'numeric', min: '0', max: '365', value: hasStay ? String(nightsOf(x.src)) : '', placeholder: 'e.g. 2' });
  const days = el('input', { type: 'number', inputmode: 'numeric', min: '1', max: '366', value: x && x.src.days ? String(x.src.days) : '', placeholder: 'e.g. 3' });
  let daysMine = !!(x && x.src.days && x.src.days !== nightsOf(x.src) + 1);
  nights.addEventListener('input', () => { if (daysMine) return; const n = Math.round(Number(nights.value)); days.value = nights.value.trim() !== '' && n >= 0 && n <= 365 ? String(n + 1) : ''; });
  days.addEventListener('input', () => { daysMine = days.value.trim() !== ''; });
  const ym = x ? x.ym : now.toISOString().slice(0, 7);
  const m = el('select', {}, MONS.map((t, ix) => el('option', { value: String(ix + 1), text: t }))); m.value = String(Number(ym.slice(5, 7)));
  const y = el('input', { type: 'number', inputmode: 'numeric', min: '1950', max: String(now.getFullYear()), value: ym.slice(0, 4) });
  const note = el('input', { type: 'text', maxlength: '80', value: x && !isDream ? (x.visit.note || '') : '', placeholder: 'Optional - e.g. Honeymoon, School trip' });
  const del = x ? el('button', { class: 'btn ghost bk-danger', type: 'button', text: 'Remove', onclick: () => removePlace(list, p, x) }) : null;
  sheet(x ? 'Change place' : '📍 Add a place', [
    isDream ? el('p', { class: 'hint', text: 'Where “' + x.item.title + '” came true, ' + ymText(x.ym) + '.' }) : null,
    field('Place', el('div', {}, [el('div', { class: 'bk-place-row' }, [place,
      el('button', { type: 'button', class: 'btn ghost small', text: '🗺️ Check on map', onclick: () => { const v = place.value.trim(); if (!v) { toast('Type the place first'); place.focus(); return; } window.open(mapUrl(v), '_blank', 'noopener'); } })]), kind.el])),
    field('State / Union Territory / Country', reg.el),
    isDream ? null : el('div', { class: 'field-row' }, [field('Month', m), field('Year', y)]),
    el('div', { class: 'field-row' }, [field('🌙 Nights', nights), field('☀️ Days', days)]),
    isDream ? null : field('What was it?', note),
    field('👥 Who with?', company.el),
    field('🧭 Travelled from', from),
    field('Travelled by', mode.el),
    field('📷 Photo', photo.el),
    field('Landscape', geo.el),
    field('🧗 Adventures tried', adv.el),
    field('Stayed at', stay.el),
    field('⭐ How was it?', stars.el),
    field('💭 Best memory', memory),
  ].filter(Boolean), async () => {
    const pl = place.value.trim();
    if (!pl) { toast('Type the place'); place.focus(); return; }
    const nn = nights.value.trim() ? Math.round(Number(nights.value)) : null;
    let dn = days.value.trim() ? Math.round(Number(days.value)) : null;
    if (nn != null && !(nn >= 0 && nn <= 365)) { toast('Nights: 0 (a day trip) to 365'); nights.focus(); return; }
    if (dn != null && !(dn >= 1 && dn <= 366)) { toast('Days: 1 to 366'); days.focus(); return; }
    if (dn == null && nn != null) dn = nn + 1;
    const det = { region: reg.value(), geo: geo.value(), spots: geo.spots(), stay: stay.value(), days: dn, nights: nn, rating: stars.value(), memory: memory.value.trim(), with: company.value(), from: from.value.trim(), mode: mode.value(), adv: adv.value() };
    if (isDream) { if (photo.changed()) await savePhoto(x.id, photo.value()); await saveAndShow(updateItem(list, p.id, x.id, Object.assign({ place: pl, placeType: kind.value() }, det)), 'Place changed'); return; }
    const yr = Number(y.value);
    if (!(yr >= 1950 && yr <= now.getFullYear())) { toast('Enter the year'); y.focus(); return; }
    if (yr === now.getFullYear() && Number(m.value) > now.getMonth() + 1) { toast('That month has not come yet'); return; }
    const data = Object.assign({ place: pl, placeType: kind.value(), year: yr, month: Number(m.value), note: note.value }, det);
    let next = x ? updateVisit(list, p.id, x.id, data) : addVisit(list, p.id, data);
    if (pre && pre.wishId) next = removeWish(next, p.id, pre.wishId);
    if (photo.changed()) { const vs = next.profiles.find((q) => q.id === p.id).visits; await savePhoto(x ? x.id : vs[vs.length - 1].id, photo.value()); }
    await saveAndShow(next, x ? 'Place changed' : pre && pre.wishId ? '🎉 ' + pl + ' - ticked off your places to visit' : '📍 ' + pl + ' added');
  }, del);
  if (!x && !pre) setTimeout(() => place.focus(), 50);
}
async function removePlace(list, p, x) {
  const ask = x.source === 'dream' ? 'Remove ' + x.place + ' from “' + x.item.title + '”? The dream stays ticked off.' : 'Remove ' + x.place + ' (' + ymText(x.ym) + ')?';
  if (!(await appConfirm(ask))) return;
  if (_photos[x.id]) await savePhoto(x.id, '');
  await saveAndShow(x.source === 'dream' ? updateItem(list, p.id, x.id, { place: '', placeType: '', region: '', geo: [], spots: {}, stay: [], days: null, nights: null, from: '', mode: '', adv: [] }) : removeVisit(list, p.id, x.id), 'Removed');
}

// The states or countries inside one kind of place, with how many trips each.
function regionChips(visits) {
  const m = new Map();
  visits.forEach((x) => { if (x.region) m.set(x.region, (m.get(x.region) || 0) + 1); });
  if (!m.size) return null;
  return el('div', { class: 'bk-pl-regs' }, [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([r, n]) => el('span', {}, [r + ' ', el('b', { text: String(n) })])));
}

// ---- Travel insights: trips and days by year, by state and country, landscapes, stays and highlights ----
function renderTravelInsights(host, v) {
  const t = travelInsights(v);
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const card = (title, kids) => el('div', { class: 'bk-ti-card' }, [el('div', { class: 'bk-ti-h', text: title })].concat(kids));
  host.appendChild(el('div', { class: 'bk-h', text: '📊 Travel insights' }));
  host.appendChild(el('div', { class: 'bk-ti-tiles' }, [
    ['🧳', t.trips, t.trips === 1 ? 'trip' : 'trips'], ['📍', t.places, t.places === 1 ? 'place' : 'places'],
    ['🗺️', t.india, 'states & UTs'], ['🌍', t.abroad, t.abroad === 1 ? 'country abroad' : 'countries abroad'],
    t.days ? ['🌙', t.nights + 'N ' + t.days + 'D', 'away in all'] : null,
  ].filter(Boolean).map(([i, n, k]) => el('div', { class: 'bk-ti-tile' }, [el('b', { text: i + ' ' + n }), el('span', { text: k })]))));

  const maxY = Math.max(1, ...t.years.map((y) => y.trips));
  host.appendChild(card('📅 Trips by year', t.years.map((y) => el('div', { class: 'bk-ti-bar' }, [
    el('b', { text: String(y.year) }),
    el('div', { class: 'bk-ti-track' }, [el('i', { style: 'width:' + Math.round((y.trips / maxY) * 100) + '%' })]),
    el('span', { text: y.trips + (y.days ? ' · ' + y.days + 'd' : '') }),
    el('small', { text: y.places.join(' → ') }),
  ].filter(Boolean)))));

  if (t.regions.length) {
    const hasDays = t.regions.some((r) => r.days);
    const row = (r) => el('tr', { class: r.country !== 'India' ? 'is-abroad' : '' }, [
      el('td', {}, [(placeTypeOf(r.type) || { icon: '📍' }).icon + ' ', el('b', { text: r.region })]), el('td', { text: r.country }),
      el('td', { class: 'n', text: String(r.trips) }), hasDays ? el('td', { class: 'n', text: r.days ? String(r.days) : '-' }) : null,
    ].filter(Boolean));
    const india = t.regions.filter((r) => r.country === 'India'), abroad = t.regions.filter((r) => r.country !== 'India');
    host.appendChild(card('🗺️ States & countries', [el('table', { class: 'bk-ti-table' }, [
      el('thead', {}, [el('tr', {}, [el('th', { text: 'State / Country' }), el('th', { text: 'Country' }), el('th', { class: 'n', text: 'Trips' }), hasDays ? el('th', { class: 'n', text: 'Days' }) : null].filter(Boolean))]),
      el('tbody', {}, india.concat(abroad).map(row)),
    ]), t.noRegion ? el('p', { class: 'bk-ti-note', text: plural(t.noRegion, 'place has', 'places have') + ' no state or country yet - set it with ✏️ Edit.' }) : null].filter(Boolean)));
  }

  const chips = (xs, label) => el('div', { class: 'bk-ti-chips' }, xs.map((x) => el('span', {}, [label(x) + ' ', el('b', { text: String(x.trips) }), x.days ? el('small', { text: ' · ' + x.days + 'd' }) : null].filter(Boolean))));
  if (t.geo.length || t.stays.length || t.company.length || t.adventures.length) {
    host.appendChild(card('🏞️ What you love', [
      t.geo.length ? chips(t.geo, (g) => g.icon + ' ' + g.label) : null,
      t.stays.length ? el('div', { class: 'bk-ti-sub', text: '🛏️ Where you stayed' }) : null,
      t.stays.length ? chips(t.stays, (x) => x.label) : null,
      t.adventures.length ? el('div', { class: 'bk-ti-sub', text: '🧗 Adventures tried' }) : null,
      t.adventures.length ? chips(t.adventures, (a) => a.icon + ' ' + a.label) : null,
      t.company.length ? el('div', { class: 'bk-ti-sub', text: '👥 Who with' }) : null,
      t.company.length ? el('div', { class: 'bk-ti-chips' }, t.company.map((x) => el('span', {}, [withIcon(x.id), ' ' + x.label + ' ', el('b', { text: String(x.trips) }), x.days ? el('small', { text: ' · ' + x.days + 'd' }) : null].filter(Boolean)))) : null,
    ].filter(Boolean)));
  }

  const top = t.regions[0], fav = t.geo[0];
  const lines = [
    top && top.trips > 1 ? ['❤️', 'Most visited: ' + top.region + ' - ' + plural(top.trips, 'trip', 'trips') + (top.days ? ', ' + top.days + ' days' : '')] : null,
    fav ? ['🏞️', 'Favourite landscape: ' + fav.label.toLowerCase() + ' - ' + plural(fav.trips, 'trip', 'trips')] : null,
    t.busiest && t.years.length > 1 ? ['🔥', 'Busiest year: ' + t.busiest.year + ' - ' + plural(t.busiest.trips, 'trip', 'trips')] : null,
    t.years.length > 1 ? ['📈', 'About ' + plural(t.perYear, 'trip', 'trips') + ' a year since ' + t.years[0].year] : null,
    t.longest ? ['🌙', 'Longest stay: ' + t.longest.place + ' - ' + plural(t.longest.days, 'day', 'days') + ' (' + ymText(t.longest.ym) + ')'] : null,
    t.daysKnown > 1 ? ['⏱️', 'An average trip: ' + t.avgDays + ' days (from ' + t.daysKnown + ' with days)'] : null,
    t.months.length && t.trips > 1 ? ['🗓️', 'Most trips in: ' + t.months.slice(0, 3).map((m) => MONS[m.month - 1] + ' (' + m.trips + ')').join(', ')] : null,
    t.repeats.length ? ['🔁', 'Back again: ' + t.repeats.map((r) => r.place + ' ×' + r.trips).join(', ')] : null,
    !t.days ? ['💡', 'Add the days stayed, landscape and stay to each place (✏️ Edit) to see more here.'] : null,
  ].filter(Boolean);
  if (lines.length) host.appendChild(card('✨ Highlights', lines.map(([i, txt]) => el('div', { class: 'bk-ti-line' }, [el('span', { text: i }), el('span', { text: txt })]))));
}

// 📍 Place: opens the map (only on a tap - nothing is looked up otherwise).
function placeChip(place) {
  return el('button', { type: 'button', class: 'bk-chip is-place', title: 'Open on the map', onclick: (e) => { e.stopPropagation(); window.open(mapUrl(place), '_blank', 'noopener'); } }, ['📍 ' + place]);
}

// Drag a card by its handle (mouse or finger): it follows the pointer, a gap shows where it will land, and on release
// the new order is handed back as ids. The page scrolls when dragged near the top or bottom.
function sortable(box, onDrop, itemSel) {
  let item = null, gap = null, dy = 0, scroller = null, lastY = 0;
  const move = (y) => {
    lastY = y;
    item.style.top = (y - dy) + 'px';
    const others = [...box.children].filter((x) => x !== item && x !== gap);
    const before = others.find((x) => { const r = x.getBoundingClientRect(); return y < r.top + r.height / 2; });
    if (before) box.insertBefore(gap, before); else box.appendChild(gap);
  };
  box.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.bk-handle');
    if (!h) return;
    e.preventDefault();
    item = h.closest(itemSel || '.bk-item');
    const r = item.getBoundingClientRect();
    dy = e.clientY - r.top;
    gap = el('div', { class: 'bk-gap' }); gap.style.height = r.height + 'px';
    box.insertBefore(gap, item);
    Object.assign(item.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', zIndex: '50' });
    item.classList.add('is-drag');
    h.setPointerCapture(e.pointerId);
    scroller = setInterval(() => {
      if (!item) return;
      const edge = lastY < 90 ? -10 : lastY > window.innerHeight - 140 ? 10 : 0;
      if (edge) { window.scrollBy(0, edge); move(lastY); }
    }, 30);
    lastY = e.clientY;
  });
  box.addEventListener('pointermove', (e) => { if (item) { e.preventDefault(); move(e.clientY); } });
  const end = () => {
    if (!item) return;
    clearInterval(scroller);
    item.classList.remove('is-drag');
    item.removeAttribute('style');
    box.insertBefore(item, gap); gap.remove();
    item = null; gap = null;
    onDrop([...box.children].map((x) => x.dataset.id).filter(Boolean));
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
}

const stat = (ico, v, k) => el('div', { class: 'bk-stat' }, [el('b', { text: ico + ' ' + v }), el('span', { text: k })]);

function itemCard(list, p, i, year, arrange, rank) {
  const c = catOf(i.cat);
  if (arrange) {
    return el('div', { class: 'bk-item is-arrange' + (i.star ? ' is-star' : '') + (i.done ? ' is-done' : ''), 'data-id': i.id }, [
      el('div', { class: 'bk-item-b' }, [el('div', { class: 'bk-item-t', text: (i.done ? '✓ ' : '') + i.title }), el('div', { class: 'bk-chips' }, [
        el('span', { class: 'bk-chip', text: c.icon + ' ' + c.label }), i.by ? el('span', { class: 'bk-chip', text: '🎯 by ' + i.by }) : null, i.star ? el('span', { class: 'bk-chip is-star', text: '★' }) : null].filter(Boolean))]),
      el('span', { class: 'bk-handle', 'aria-label': 'Drag to move', text: '☰' }),
    ]);
  }
  const tick = el('button', { type: 'button', class: 'bk-tick' + (i.done ? ' on' : ''), 'aria-label': i.done ? 'Undo: not done yet' : 'Tick off: done', onclick: async (e) => {
    e.stopPropagation();
    if (i.done) { if (await appConfirm('Mark “' + i.title + '” as not done yet?')) await saveAndShow(undoCheckIn(list, p.id, i.id), 'Back on the list'); }
    else openCheckIn(list, p, i);
  } }, [i.done ? '✓' : '']);
  // A note hides behind an ⓘ beside the title; tapping it shows (or hides) the note, without opening the editor.
  const note = i.note ? el('div', { class: 'bk-note hidden', text: i.note }) : null;
  const info = i.note ? el('button', { type: 'button', class: 'bk-info', 'aria-label': 'Show the note', title: 'Note', text: 'i', onclick: (e) => {
    e.stopPropagation();
    const open = note.classList.toggle('hidden') === false;
    info.classList.toggle('on', open);
    info.setAttribute('aria-label', open ? 'Hide the note' : 'Show the note');
  } }) : null;
  // A tap: in Edit, the editor; otherwise it opens or closes the dream's stages, or its note.
  const onTap = (e) => {
    if (_edit) { openItemForm(list, p, i); return; }
    const prog = e.currentTarget.querySelector('.bk-prog');
    if (prog) prog.click(); else if (info) info.click();
  };
  return el('div', { class: 'bk-item' + (i.done ? ' is-done' : '') + (i.star && !i.done ? ' is-star' : '') + (_edit ? ' is-edit' : ''), onclick: onTap }, [
    tick,
    el('div', { class: 'bk-item-b' }, [
      el('div', { class: 'bk-item-th' }, [rank ? el('span', { class: 'bk-rank', text: String(rank) }) : null, el('div', { class: 'bk-item-t', text: i.title }), info].filter(Boolean)),
      el('div', { class: 'bk-chips' }, [
        el('span', { class: 'bk-chip', text: c.icon + ' ' + c.label }),
        i.done ? el('span', { class: 'bk-chip is-done', text: '✓ ' + ymText(i.done) }) : null,
        i.done && took(i) != null ? el('span', { class: 'bk-chip is-took', text: (took(i) < 1 ? '⏱️ within a month' : '⏱️ took ' + tookLabel(took(i))) }) : null,
        !i.done && i.since ? el('span', { class: 'bk-chip is-since', text: '💭 since ' + ymText(i.since) }) : null,
        !i.done && i.by ? el('span', { class: 'bk-chip' + (i.by < year ? ' is-late' : i.by === year ? ' is-now' : ''), text: (i.by < year ? '⏳ was for ' : '🎯 by ') + i.by }) : null,
        i.place ? placeChip(i.place) : null,
        i.cost ? el('span', { class: 'bk-chip', text: '💰 ' + fmtIntCur(i.cost) }) : null,
        i.star && !i.done ? el('span', { class: 'bk-chip is-star', text: '★ must-do' }) : null,
      ].filter(Boolean)),
      note,
      i.steps && i.steps.length ? stagesBlock(list, p, i) : null,
      i.done && i.memory ? el('div', { class: 'bk-memo', text: '“' + i.memory + '”' }) : null,
    ].filter(Boolean)),
  ]);
}

// A dream in stages: a progress bar ("2 of 5 stages") that opens the list of stages; each stage is checked in on its
// own with the month and year, and once the last one is in, the whole dream can be ticked off.
function stagesBlock(list, p, i) {
  const pr = progress(i);
  const open = _openSteps.has(i.id);
  const steps = el('div', { class: 'bk-steps' + (open ? '' : ' hidden') }, i.steps.map((st) => el('div', { class: 'bk-step' + (st.done ? ' is-done' : '') }, [
    el('button', { type: 'button', class: 'bk-step-tick' + (st.done ? ' on' : ''), 'aria-label': st.done ? 'Undo this stage' : 'Check in this stage', onclick: async (e) => {
      e.stopPropagation();
      if (st.done) { if (await appConfirm('Mark the stage “' + st.title + '” as not done yet?')) await saveAndShow(undoStep(list, p.id, i.id, st.id), 'Stage back on the list'); }
      else openStepCheckIn(list, p, i, st);
    } }, [st.done ? '✓' : '']),
    el('span', { class: 'bk-step-t', text: st.title }),
    st.done ? el('span', { class: 'bk-chip is-done', text: ymText(st.done) }) : null,
  ].filter(Boolean))));
  const head = el('button', { type: 'button', class: 'bk-prog', 'aria-expanded': String(open), onclick: (e) => {
    e.stopPropagation();
    const now = steps.classList.toggle('hidden') === false;
    if (now) _openSteps.add(i.id); else _openSteps.delete(i.id);
    head.setAttribute('aria-expanded', String(now));
    head.querySelector('.bk-prog-k').textContent = pr.done + ' of ' + pr.total + ' stages ' + (now ? '▴' : '▾');
  } }, [
    el('span', { class: 'bk-prog-bar' }, [el('i', { style: 'width:' + pr.pct + '%' })]),
    el('span', { class: 'bk-prog-k', text: pr.done + ' of ' + pr.total + ' stages ' + (open ? '▴' : '▾') }),
    el('b', { class: 'bk-prog-p', text: pr.pct + '%' }),
  ]);
  return el('div', { class: 'bk-stages', onclick: (e) => e.stopPropagation() }, [head, steps]);
}

function welcome() {
  return el('div', { class: 'bk-welcome' }, [
    el('div', { class: 'bk-welcome-e', text: '🪣' }),
    el('h2', { text: 'My Bucket List' }),
    el('p', { text: 'The places, adventures and firsts you want in your life - one list for each person in the family.' }),
    el('ul', { class: 'bk-why' }, [
      el('li', { text: '👪 A list for you, your partner, the kids or the parents' }),
      el('li', { text: '✅ Tick one off and note the month and year you did it' }),
      el('li', { text: '🎯 A year to aim for, and what it may cost to save for' }),
      el('li', { text: '📸 A memories timeline of everything you have done' }),
    ]),
    el('button', { type: 'button', class: 'btn primary', text: 'Create my list', onclick: () => openProfileForm(normalise(null), null) }),
  ]);
}

// ---- Sheets ----
function sheet(title, body, onSave, extra) {
  openModal(el('div', { class: 'sheet has-fixed-footer bk-sheet' }, [
    el('div', { class: 'sheet-scroll' }, [el('h2', { text: title })].concat(body)),
    el('div', { class: 'sheet-footer' }, [el('div', { class: 'btn-row' }, [
      extra || el('button', { class: 'btn ghost', type: 'button', text: 'Cancel', onclick: closeModal }),
      el('button', { class: 'btn primary', type: 'button', text: 'Save', onclick: onSave }),
    ])]),
  ]));
}
const pickRow = (opts, cur, cls, onPick) => {
  const row = el('div', { class: 'bk-pick ' + cls });
  opts.forEach((o) => row.appendChild(el('button', { type: 'button', class: o === cur ? 'on' : '', style: cls === 'is-colors' ? 'background:' + o : '', text: cls === 'is-colors' ? '' : o,
    'aria-label': o, onclick: () => { [...row.children].forEach((b) => b.classList.remove('on')); row.children[opts.indexOf(o)].classList.add('on'); onPick(o); } })));
  return row;
};

export function openProfileForm(list, p) {
  let emoji = p ? p.emoji : PROFILE_EMOJIS[0], color = p ? p.color : PROFILE_COLORS[list.profiles.length % PROFILE_COLORS.length];
  const name = el('input', { type: 'text', maxlength: '30', value: p ? p.name : (list.profiles.length ? '' : 'Me'), placeholder: 'e.g. Me, Amma, Kavya' });
  const del = p ? el('button', { class: 'btn ghost bk-danger', type: 'button', text: 'Delete', onclick: async () => {
    if (!(await appConfirm('Delete ' + p.name + '’s list' + (p.items.length ? ' and its ' + p.items.length + (p.items.length === 1 ? ' dream' : ' dreams') : '') + '?'))) return;
    await saveAndShow(removeProfile(list, p.id), 'Deleted');
  } }) : null;
  sheet(p ? 'Edit ' + p.name : 'Whose list is this?', [
    field('Name', name),
    field('Emoji', pickRow(PROFILE_EMOJIS, emoji, 'is-emoji', (v) => { emoji = v; })),
    field('Colour', pickRow(PROFILE_COLORS, color, 'is-colors', (v) => { color = v; })),
  ], async () => {
    const n = name.value.trim();
    if (!n) { toast('Add a name'); name.focus(); return; }
    await saveAndShow(p ? updateProfile(list, p.id, { name: n, emoji, color }) : addProfile(list, { name: n, emoji, color }), p ? 'Saved' : n + '’s list is ready');
  }, del);
  setTimeout(() => name.focus(), 50);
}

export function openItemForm(list, p, i) {
  let cat = i ? i.cat : (_cat || 'travel');
  const year = new Date().getFullYear();
  const title = el('input', { type: 'text', maxlength: '120', value: i ? i.title : '', placeholder: 'e.g. See the Northern Lights' });
  const by = el('input', { type: 'number', inputmode: 'numeric', min: String(year - 5), max: String(year + 60), value: i && i.by ? String(i.by) : '', placeholder: 'e.g. ' + (year + 2) });
  // When it was first wished for: this month for a new one; can be set back for a wish held for years.
  const since = (i && i.since) || new Date().toISOString().slice(0, 7);
  const sinceM = el('select', {}, MONS.map((m, ix) => el('option', { value: String(ix + 1), text: m })));
  sinceM.value = String(Number(since.slice(5, 7)));
  const sinceY = el('input', { type: 'number', inputmode: 'numeric', min: '1950', max: String(year), value: since.slice(0, 4) });
  const cost = el('input', { type: 'number', inputmode: 'decimal', min: '0', value: i && i.cost ? String(i.cost) : '', placeholder: 'optional' });
  const star = el('input', { type: 'checkbox' }); star.checked = !!(i && i.star);
  const saved = el('input', { type: 'number', inputmode: 'decimal', min: '0', value: i && i.saved ? String(i.saved) : '', placeholder: '0' });
  // Stages: one line each; a stage already checked in keeps its date (its id rides on the row).
  const stepBox = el('div', { class: 'bk-step-edit' });
  const stepRow = (st) => {
    const inp = el('input', { type: 'text', maxlength: '80', value: st ? st.title : '', placeholder: 'e.g. Book the flights' });
    const row = el('div', { class: 'bk-step-row' }, [
      el('span', { class: 'bk-step-n', text: st && st.done ? '✓' : '•' }), inp,
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove this stage', text: '✕', onclick: () => row.remove() }),
    ]);
    if (st) row.dataset.id = st.id;
    stepBox.appendChild(row);
    return inp;
  };
  (i && i.steps ? i.steps : []).forEach((st) => stepRow(st));
  const addStep = el('button', { type: 'button', class: 'btn ghost small', text: '+ Add a stage', onclick: () => stepRow(null).focus() });
  const readSteps = () => [...stepBox.children].map((r) => ({ id: r.dataset.id || null, title: r.querySelector('input').value }));
  const note = el('textarea', { rows: '2', maxlength: '300', placeholder: 'Optional - who with, where, a link...' }); note.value = i ? i.note : '';
  // 📍 Place: where it is, opened on a map from the list. "Check on map" opens it now to be sure of the spot.
  const place = el('input', { type: 'text', maxlength: '80', value: i ? i.place || '' : '', placeholder: 'Optional - e.g. Tromsø, Norway' });
  const placeKind = placeTypePick(place, i ? i.placeType : '');
  const placeField = field('📍 Place', el('div', {}, [el('div', { class: 'bk-place-row' }, [place,
    el('button', { type: 'button', class: 'btn ghost small', text: '🗺️ Check on map', onclick: () => { const v = place.value.trim(); if (!v) { toast('Type the place first'); place.focus(); return; } window.open(mapUrl(v), '_blank', 'noopener'); } })]), placeKind.el]));
  const cats = el('div', { class: 'bk-catpick' }, CATEGORIES.map((c) => el('button', { type: 'button', class: c.id === cat ? 'on' : '', onclick: (e) => {
    cat = c.id; [...cats.children].forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on');
  } }, [el('span', { text: c.icon }), el('small', { text: c.label })])));
  // A done one can have its month, year and memory changed here too.
  let dm = null, dy = null, mem = null;
  if (i && i.done) {
    dm = el('select', {}, MONS.map((m, ix) => el('option', { value: String(ix + 1), text: m })));
    dm.value = String(Number(i.done.slice(5, 7)));
    dy = el('input', { type: 'number', inputmode: 'numeric', value: i.done.slice(0, 4) });
    mem = el('textarea', { rows: '2', maxlength: '300' }); mem.value = i.memory || '';
  }
  const del = i ? el('button', { class: 'btn ghost bk-danger', type: 'button', text: 'Delete', onclick: async () => {
    if (!(await appConfirm('Delete “' + i.title + '”?'))) return;
    await saveAndShow(removeItem(list, p.id, i.id), 'Deleted');
  } }) : null;
  sheet(i ? 'Edit dream' : 'Add to ' + p.name + '’s list', [
    field('What do you want to do?', title),
    field('Category', cats),
    el('div', { class: 'field-row' }, [field('By year (optional)', by), field('Cost to save for', cost)]),
    el('div', { class: 'field-row' }, [field('Wished for since', sinceM), field('Year', sinceY)]),
    field('Put aside for it so far', saved),
    field('Stages (optional) - for a dream done step by step', el('div', {}, [stepBox, addStep])),
    el('label', { class: 'ret-check' }, [star, el('span', { text: '★ A must-do (shown first)' })]),
    placeField,
    field('Note', note),
    i && i.done ? el('div', { class: 'field-row' }, [field('Done in', dm), field('Year', dy)]) : null,
    i && i.done ? field('How it went', mem) : null,
  ].filter(Boolean), async () => {
    const t = title.value.trim();
    if (!t) { toast('Write what you want to do'); title.focus(); return; }
    const sy = Number(sinceY.value);
    if (!(sy >= 1950 && sy <= year)) { toast('Enter the year it was first wished for'); sinceY.focus(); return; }
    const data = { place: place.value.trim(), placeType: place.value.trim() ? placeKind.value() : '', since: sy + '-' + String(Number(sinceM.value)).padStart(2, '0'), title: t, cat, by: Number(by.value) || null, cost: Number(cost.value) > 0 ? Number(cost.value) : null, star: star.checked, note: note.value.trim(), saved: Number(saved.value) > 0 ? Number(saved.value) : 0 };
    const stepList = readSteps();
    if (i) {
      let next = setSteps(updateItem(list, p.id, i.id, data), p.id, i.id, stepList);
      if (i.done) next = checkIn(next, p.id, i.id, Number(dy.value) || Number(i.done.slice(0, 4)), Number(dm.value), mem.value.trim());
      await saveAndShow(next, 'Saved');
    } else await saveAndShow(addItem(list, p.id, Object.assign(data, { steps: stepList.map((x) => x.title) })), 'Added to ' + p.name + '’s list');
  }, del);
  if (!i) setTimeout(() => title.focus(), 50);
}

// Tick off: the month and year it was done (this month by default) and a line about how it went.
// Check in one stage: the month and year it was done. The last stage in offers to tick off the whole dream.
function openStepCheckIn(list, p, i, st) {
  const now = new Date();
  const m = el('select', {}, MONS.map((x, ix) => el('option', { value: String(ix + 1), text: x })));
  m.value = String(now.getMonth() + 1);
  const y = el('input', { type: 'number', inputmode: 'numeric', min: '1950', max: String(now.getFullYear()), value: String(now.getFullYear()) });
  sheet('✅ Stage done: ' + st.title, [
    el('p', { class: 'hint', text: 'Part of “' + i.title + '”. When did you finish this stage?' }),
    el('div', { class: 'field-row' }, [field('Month', m), field('Year', y)]),
  ], async () => {
    const yr = Number(y.value);
    if (!(yr >= 1950 && yr <= now.getFullYear())) { toast('Enter the year'); y.focus(); return; }
    if (yr === now.getFullYear() && Number(m.value) > now.getMonth() + 1) { toast('That month has not come yet'); return; }
    const next = checkStep(list, p.id, i.id, st.id, yr, Number(m.value));
    const it = next.profiles.find((x) => x.id === p.id).items.find((x) => x.id === i.id);
    const pr = progress(it);
    _openSteps.add(i.id);
    await saveAndShow(next, pr.done === pr.total ? '🎉 Every stage done' : 'Stage ' + pr.done + ' of ' + pr.total + ' done');
    if (pr.done === pr.total && !it.done && await appConfirm('All ' + pr.total + ' stages of “' + i.title + '” are done. Tick off the whole dream?')) {
      const fresh = await load();
      openCheckIn(fresh, fresh.profiles.find((x) => x.id === p.id), it);
    }
  });
}

export function openCheckIn(list, p, i) {
  const now = new Date();
  const m = el('select', {}, MONS.map((x, ix) => el('option', { value: String(ix + 1), text: x })));
  m.value = String(now.getMonth() + 1);
  const y = el('input', { type: 'number', inputmode: 'numeric', min: '1950', max: String(now.getFullYear()), value: String(now.getFullYear()) });
  const mem = el('textarea', { rows: '3', maxlength: '300', placeholder: 'Optional - how was it? Who was there?' });
  // Where it happened (optional; the planned place to start with), with a map check - pinned on the list and in
  // Milestones when given.
  const where = el('input', { type: 'text', maxlength: '80', value: i.place || '', placeholder: 'Optional - e.g. Tromsø, Norway' });
  const whereKind = placeTypePick(where, i.placeType);
  sheet('🎉 Done: ' + i.title, [
    el('p', { class: 'hint', text: 'When did you do it?' }),
    el('div', { class: 'field-row' }, [field('Month', m), field('Year', y)]),
    where ? field('📍 Where was it?', el('div', { class: 'bk-place-row' }, [where,
      el('button', { type: 'button', class: 'btn ghost small', text: '🗺️ Check on map', onclick: () => { const v = where.value.trim(); if (!v) { toast('Type the place first'); where.focus(); return; } window.open(mapUrl(v), '_blank', 'noopener'); } })])) : null,
    whereKind.el,
    field('A line to remember it by', mem),
  ].filter(Boolean), async () => {
    const yr = Number(y.value);
    if (!(yr >= 1950 && yr <= now.getFullYear())) { toast('Enter the year it was done'); y.focus(); return; }
    if (yr === now.getFullYear() && Number(m.value) > now.getMonth() + 1) { toast('That month has not come yet'); return; }
    let next = checkIn(list, p.id, i.id, yr, Number(m.value), mem.value.trim());
    if (where) next = updateItem(next, p.id, i.id, { place: where.value.trim(), placeType: where.value.trim() ? whereKind.value() : '' });
    await saveAndShow(next, '🎉 Ticked off - ' + MONS[Number(m.value) - 1] + ' ' + yr);
  });
}

// The + in the bottom bar.
export async function openAdd() {
  const list = await load();
  const p = list.profiles.find((x) => x.id === list.active);
  if (!p) openProfileForm(list, null); else openItemForm(list, p, null);
}
