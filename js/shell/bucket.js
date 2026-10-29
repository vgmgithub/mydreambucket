// bucket.js — My Bucket List, the part with no screen: profiles, their lists, check-ins and the figures the screen
// shows. Pure - data in, data out. The screen is bucket-ui.js.
//
// Stored in meta 'bucketList' (so every backup carries it):
//   { profiles: [{ id, name, emoji, color, manual, items: [item, ...], visits: [visit, ...] }], active: profileId, plan: { budget, inflation } }
//   visit: a place visited outside any dream (Places > Add): { id, place, placeType, ym: 'YYYY-MM', note, region, geo, stay, days }
//   region (state, Union Territory or country), geo (landscapes, GEOS ids), stay (where they stayed), days and nights away (nights is
//   one less than days unless set) -
//   the trip's details, kept on a visit and on a dream that came true somewhere; all optional.
//   manual: the to-do order was set by hand (Rearrange), so the list keeps the items' own order.
//   item: { id, title, cat, by (target year), cost, star, note, addedAt,
//           done: 'YYYY-MM' | null (the month and year it was done), memory (a line about how it went),
//           since: 'YYYY-MM' (when it was first wished for - added that month unless changed),
//           place: where it is - opened on a map from the list,
//           placeType: 'intl' | 'tn' | 'state' | 'ut' (international; in India: within Tamil Nadu, another state, a Union Territory),
//           saved (put aside for it so far - Savings > Bucket List Plan),
//           steps: [{ id, title, done: 'YYYY-MM' | null }] - optional stages, each checked in on its own (progress) }

export const CATEGORIES = [
  { id: 'travel', icon: '✈️', label: 'Travel' },
  { id: 'adventure', icon: '🪂', label: 'Adventure' },
  { id: 'learn', icon: '📚', label: 'Learn' },
  { id: 'experience', icon: '🎟️', label: 'Experience' },
  { id: 'food', icon: '🍜', label: 'Food' },
  { id: 'fitness', icon: '🏃', label: 'Health & fitness' },
  { id: 'family', icon: '👨‍👩‍👧', label: 'Family' },
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'lifestyle', icon: '🛋️', label: 'Lifestyle' },
  { id: 'vehicle', icon: '🚗', label: 'Vehicle' },
  { id: 'asset', icon: '🏡', label: 'Asset' },
  { id: 'finance', icon: '📈', label: 'Finance' },
  { id: 'creative', icon: '🎨', label: 'Creative' },
  { id: 'career', icon: '💼', label: 'Career' },
  { id: 'tech', icon: '💻', label: 'Technology' },
  { id: 'giving', icon: '🤝', label: 'Giving back' },
  { id: 'other', icon: '⭐', label: 'Other' },
];
export const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// Ideas to start from, one tap each (shown while a list is short).
export const IDEAS = [
  ['travel', 'See the Northern Lights'], ['travel', 'Visit Kashi and the Ganga aarti'], ['adventure', 'Go scuba diving'],
  ['learn', 'Learn to swim'], ['experience', 'Watch a match at a stadium'], ['food', 'Cook a full meal for the family'],
  ['fitness', 'Run a 10K'], ['family', 'Take the parents on a trip'], ['creative', 'Learn an instrument'],
  ['giving', 'Sponsor a child’s education'], ['adventure', 'Trek to a Himalayan base camp'], ['travel', 'Take a long train journey'],
];

export const PROFILE_EMOJIS = ['😀', '😎', '👩', '👨', '👧', '👦', '👵', '👴', '🧑', '💑', '👪', '🌟'];
export const PROFILE_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6'];

const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function emptyList() { return normalise(null); }

// Read whatever is stored into the current shape; anything missing gets its default.
export function normalise(v) {
  const src = v && typeof v === 'object' ? v : {};
  const profiles = (Array.isArray(src.profiles) ? src.profiles : []).filter((p) => p && p.id).map((p, i) => ({
    id: p.id, name: String(p.name || 'Me'), emoji: p.emoji || PROFILE_EMOJIS[0], color: p.color || PROFILE_COLORS[i % PROFILE_COLORS.length], manual: !!p.manual,
    // My places ranking: place names (lower case) in the order dragged on the Places tab.
    placeRank: (Array.isArray(p.placeRank) ? p.placeRank : []).map((k) => String(k || '').trim().toLowerCase()).filter((k, i, a) => k && a.indexOf(k) === i),
    // The travel goals (the map).
    goals: { countries: Number(p.goals && p.goals.countries) > 0 ? Number(p.goals.countries) : 10 },
    // Places to visit added on the Places tab (apart from the dreams): { id, place, placeType, region, by, note, addedAt }.
    wishes: (Array.isArray(p.wishes) ? p.wishes : []).filter((w) => w && w.id && w.place).map((w) => ({ id: w.id, place: String(w.place).trim(),
      placeType: PLACE_TYPES.some((t) => t.id === w.placeType) ? w.placeType : guessPlaceType(w.place), region: String(w.region || '').trim(),
      by: Number(w.by) || null, note: String(w.note || '').trim(), addedAt: w.addedAt || null })),
    visits: (Array.isArray(p.visits) ? p.visits : []).filter((v) => v && v.id && v.place && /^\d{4}-\d{2}$/.test(v.ym || ''))
      .map((v) => Object.assign({ id: v.id, place: String(v.place).trim(), placeType: PLACE_TYPES.some((t) => t.id === v.placeType) ? v.placeType : guessPlaceType(v.place), ym: v.ym, note: String(v.note || '') }, tripDetails(v))),
    items: (Array.isArray(p.items) ? p.items : []).filter((x) => x && x.id && x.title).map((x) => ({
      id: x.id, title: String(x.title), cat: catOf(x.cat).id, by: Number(x.by) || null, cost: Number(x.cost) > 0 ? Number(x.cost) : null,
      star: !!x.star, note: x.note || '', addedAt: x.addedAt || null, done: /^\d{4}-\d{2}$/.test(x.done || '') ? x.done : null, memory: x.memory || '',
      saved: Number(x.saved) > 0 ? Number(x.saved) : 0,
      place: String(x.place || '').trim(),
      placeType: PLACE_TYPES.some((t) => t.id === x.placeType) ? x.placeType : '',
      ...tripDetails(x),
      since: /^\d{4}-\d{2}$/.test(x.since || '') ? x.since : (/^\d{4}-\d{2}/.test(x.addedAt || '') ? x.addedAt.slice(0, 7) : null),
      steps: (Array.isArray(x.steps) ? x.steps : []).filter((st) => st && st.id && st.title).map((st) => ({ id: st.id, title: String(st.title), done: /^\d{4}-\d{2}$/.test(st.done || '') ? st.done : null })),
    })),
  }));
  const active = profiles.some((p) => p.id === src.active) ? src.active : (profiles[0] ? profiles[0].id : null);
  const plan = src.plan && typeof src.plan === 'object' ? src.plan : {};
  const infl = plan.inflation == null || plan.inflation === '' ? NaN : Number(plan.inflation);
  return { profiles, active, plan: { budget: Number(plan.budget) > 0 ? Number(plan.budget) : 0, inflation: Number.isFinite(infl) ? infl : 6 } };
}

export function addProfile(list, { name, emoji, color }) {
  const l = normalise(list);
  const p = { id: uid('bp'), name: String(name || '').trim() || 'Me', emoji: emoji || PROFILE_EMOJIS[0], color: color || PROFILE_COLORS[l.profiles.length % PROFILE_COLORS.length], items: [], visits: [], wishes: [] };
  return Object.assign(l, { profiles: l.profiles.concat([p]), active: p.id });
}
export function updateProfile(list, id, patch) {
  const l = normalise(list);
  return Object.assign(l, { profiles: l.profiles.map((p) => (p.id === id ? Object.assign({}, p, patch, { id, items: p.items, visits: p.visits, wishes: p.wishes }) : p)) });
}
export function removeProfile(list, id) {
  const l = normalise(list);
  const profiles = l.profiles.filter((p) => p.id !== id);
  return Object.assign(l, { profiles, active: l.active === id ? (profiles[0] ? profiles[0].id : null) : l.active });
}

const mapItems = (list, pid, fn) => {
  const l = normalise(list);
  return Object.assign(l, { profiles: l.profiles.map((p) => (p.id === pid ? Object.assign({}, p, { items: fn(p.items) }) : p)) });
};
export function addItem(list, pid, item, nowIso) {
  const it = { id: uid('bi'), title: String(item.title || '').trim(), cat: catOf(item.cat).id, by: Number(item.by) || null, cost: Number(item.cost) > 0 ? Number(item.cost) : null,
    star: !!item.star, note: item.note || '', addedAt: nowIso || new Date().toISOString(), done: null, memory: '', saved: 0, steps: stepsFrom(item.steps), place: String(item.place || '').trim(),
    placeType: PLACE_TYPES.some((t) => t.id === item.placeType) ? item.placeType : guessPlaceType(item.place),
    since: /^\d{4}-\d{2}$/.test(item.since || '') ? item.since : (nowIso || new Date().toISOString()).slice(0, 7) };
  if (!it.title) return normalise(list);
  return mapItems(list, pid, (items) => items.concat([it]));
}
export function updateItem(list, pid, iid, patch) {
  return mapItems(list, pid, (items) => items.map((x) => (x.id === iid ? Object.assign({}, x, patch, { id: iid }) : x)));
}
export function removeItem(list, pid, iid) { return mapItems(list, pid, (items) => items.filter((x) => x.id !== iid)); }
// Check-in: done in month (1-12) of year, with an optional line about how it went. Undo clears both.
export function checkIn(list, pid, iid, year, month, memory) {
  const ym = Number(year) + '-' + String(Math.min(12, Math.max(1, Number(month) || 1))).padStart(2, '0');
  return updateItem(list, pid, iid, { done: ym, memory: memory || '' });
}
export function undoCheckIn(list, pid, iid) { return updateItem(list, pid, iid, { done: null, memory: '' }); }

// The list as shown: still to do first - must-dos, then the soonest target year, then the oldest added (or, once
// rearranged by hand, the order it was left in) - and done ones after, the latest first.
export function sortItems(items, manual) {
  const todo = manual ? items.filter((x) => !x.done) : items.filter((x) => !x.done).sort((a, b) => (Number(!!b.star) - Number(!!a.star)) || ((a.by || 9999) - (b.by || 9999)) || String(a.addedAt).localeCompare(String(b.addedAt)));
  const done = items.filter((x) => x.done).sort((a, b) => b.done.localeCompare(a.done));
  return todo.concat(done);
}

// The figures at the top of a profile's list.
export function stats(items, thisYear) {
  const done = items.filter((x) => x.done), todo = items.filter((x) => !x.done);
  return {
    total: items.length, done: done.length, todo: todo.length,
    started: todo.filter((x) => (x.steps || []).some((st) => st.done)).length,
    checked: items.filter((x) => x.done || (x.steps || []).some((st) => st.done)).length,
    // A dream half way through its stages counts as half done.
    pct: items.length ? Math.round((todo.reduce((n, x) => n + ((x.steps || []).length ? (x.steps.filter((st) => st.done).length / x.steps.length) : 0), done.length) / items.length) * 100) : 0,
    thisYear: done.filter((x) => Number(x.done.slice(0, 4)) === thisYear).length,
    dueThisYear: todo.filter((x) => x.by === thisYear).length,
    overdue: todo.filter((x) => x.by && x.by < thisYear).length,
    costToGo: todo.reduce((s, x) => s + (x.cost || 0), 0),
    costThisYear: todo.filter((x) => x.by === thisYear).reduce((s, x) => s + (x.cost || 0), 0),
  };
}

// Done items grouped by year, newest first: the Memories timeline.
export function memories(items) {
  const by = new Map();
  items.filter((x) => x.done).forEach((x) => { const y = x.done.slice(0, 4); if (!by.has(y)) by.set(y, []); by.get(y).push(x); });
  return [...by.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, list]) => ({ year: Number(year), items: list.sort((a, b) => b.done.localeCompare(a.done)) }));
}

// Rearrange: the items in the order given (ids, done ones included - the list is one ranking); any not given keep
// their place after them. The list then keeps this order.
export function reorder(list, pid, ids) {
  const l = normalise(list);
  return Object.assign(l, { profiles: l.profiles.map((p) => {
    if (p.id !== pid) return p;
    const byId = new Map(p.items.map((x) => [x.id, x]));
    const moved = ids.map((id) => byId.get(id)).filter(Boolean);
    const rest = p.items.filter((x) => !moved.includes(x));
    return Object.assign({}, p, { manual: true, items: moved.concat(rest) });
  }) });
}
// Back to the automatic order (must-dos, then the soonest year).
export function autoOrder(list, pid) { return updateProfile(list, pid, { manual: false }); }
// The plan's own settings: what can be put aside a month, and how fast prices rise.
export function setPlan(list, patch) { const l = normalise(list); return Object.assign(l, { plan: Object.assign({}, l.plan, patch) }); }

// ---- Stages: a dream done in several steps, each checked in with its own month and year ----
// From a list of titles (or { id, title, done }), keeping the id and check-in of a step that was already there.
export function stepsFrom(steps, old) {
  const prev = new Map((old || []).map((x) => [x.id, x]));
  return (Array.isArray(steps) ? steps : []).map((x) => (typeof x === 'string' ? { title: x } : x || {}))
    .filter((x) => String(x.title || '').trim())
    .map((x) => { const was = x.id && prev.get(x.id); return { id: x.id || uid('bs'), title: String(x.title).trim(), done: was ? was.done : (/^\d{4}-\d{2}$/.test(x.done || '') ? x.done : null) }; });
}
export function setSteps(list, pid, iid, steps) {
  return mapItems(list, pid, (items) => items.map((x) => (x.id === iid ? Object.assign({}, x, { steps: stepsFrom(steps, x.steps) }) : x)));
}
export function checkStep(list, pid, iid, sid, year, month) {
  const ym = Number(year) + '-' + String(Math.min(12, Math.max(1, Number(month) || 1))).padStart(2, '0');
  return mapItems(list, pid, (items) => items.map((x) => (x.id === iid ? Object.assign({}, x, { steps: x.steps.map((st) => (st.id === sid ? Object.assign({}, st, { done: ym }) : st)) }) : x)));
}
export function undoStep(list, pid, iid, sid) {
  return mapItems(list, pid, (items) => items.map((x) => (x.id === iid ? Object.assign({}, x, { steps: x.steps.map((st) => (st.id === sid ? Object.assign({}, st, { done: null }) : st)) }) : x)));
}
// How far along a dream is: by its stages if it has any; a dream ticked off is 100%.
export function progress(item) {
  const total = (item.steps || []).length, done = (item.steps || []).filter((st) => st.done).length;
  if (item.done) return { done: total, total, pct: 100 };
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// ---- How long a wish took to come true: from the month it was wished for to the month it was done ----
export function monthsBetween(fromYm, toYm) {
  if (!/^\d{4}-\d{2}/.test(fromYm || '') || !/^\d{4}-\d{2}/.test(toYm || '')) return null;
  return Math.max(0, (Number(toYm.slice(0, 4)) - Number(fromYm.slice(0, 4))) * 12 + Number(toYm.slice(5, 7)) - Number(fromYm.slice(5, 7)));
}
export function tookLabel(months) {
  if (months == null) return '';
  if (months < 1) return 'within a month';
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? y + (y === 1 ? ' yr' : ' yrs') : null, m ? m + (m === 1 ? ' mo' : ' mos') : null].filter(Boolean).join(' ');
}
export const took = (item) => (item.done ? monthsBetween(item.since, item.done) : null);
// On average, how long the dreams that came true took (null when none can be worked out).
export function averageTook(items) {
  const ms = items.map(took).filter((x) => x != null);
  return ms.length ? Math.round(ms.reduce((s, x) => s + x, 0) / ms.length) : null;
}

// The list as one ranking: done ones stay where they rank (struck through), nothing moves to the bottom. By hand once
// rearranged; otherwise must-dos first, then the soonest target year, then the oldest added.
export function rankItems(items, manual) {
  if (manual) return items.slice();
  return items.slice().sort((a, b) => (Number(!!b.star) - Number(!!a.star)) || ((a.by || 9999) - (b.by || 9999)) || String(a.addedAt).localeCompare(String(b.addedAt)));
}

// A map link for a place (opened only when tapped).
export const mapUrl = (place) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place);

// Milestones: everything that came true, and every stage done, year by year (newest first) - the story of the list.
//   [{ year, dreams, stages, events: [{ kind: 'dream' | 'stage', ym, item, step }] }], plus the first wish.
export function milestones(items) {
  const ev = [];
  items.forEach((x) => {
    if (x.done) ev.push({ kind: 'dream', ym: x.done, item: x });
    (x.steps || []).forEach((st) => { if (st.done) ev.push({ kind: 'stage', ym: st.done, item: x, step: st }); });
  });
  // A stage's progress as it stood that month: how many of the dream's stages were done by then.
  ev.forEach((e) => { if (e.kind === 'stage') { const st = e.item.steps; e.total = st.length; e.doneBy = st.filter((x) => x.done && x.done <= e.ym).length; } });
  ev.sort((a, b) => b.ym.localeCompare(a.ym) || (a.kind === 'dream' ? -1 : 1));
  const years = new Map();
  ev.forEach((e) => { const y = Number(e.ym.slice(0, 4)); if (!years.has(y)) years.set(y, { year: y, dreams: 0, stages: 0, events: [] }); const g = years.get(y); g.events.push(e); if (e.kind === 'dream') g.dreams++; else g.stages++; });
  const wishes = items.filter((x) => x.since).sort((a, b) => a.since.localeCompare(b.since));
  return { years: [...years.values()].sort((a, b) => b.year - a.year), first: wishes[0] || null, count: ev.filter((e) => e.kind === 'dream').length };
}

// ---- Insights: what the list says, by category, to keep the dreaming going ----
export function insights(items, thisYear) {
  const done = items.filter((x) => x.done), todo = items.filter((x) => !x.done);
  // By category: how many, how many done, and the share done.
  const cats = CATEGORIES.map((c) => {
    const all = items.filter((x) => x.cat === c.id), d = all.filter((x) => x.done);
    return { cat: c, total: all.length, done: d.length, pct: all.length ? Math.round((d.length / all.length) * 100) : 0 };
  }).filter((c) => c.total).sort((a, b) => b.done - a.done || b.pct - a.pct || b.total - a.total);
  const strongest = cats.find((c) => c.done) || null;
  // The kind of dream waiting longest for its first tick.
  const untouched = cats.filter((c) => !c.done).sort((a, b) => b.total - a.total)[0] || null;
  const byYear = new Map();
  done.forEach((x) => { const y = Number(x.done.slice(0, 4)); byYear.set(y, (byYear.get(y) || 0) + 1); });
  const best = [...byYear.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] || null;
  const tooks = done.map((x) => ({ x, m: took(x) })).filter((t) => t.m != null);
  const fastest = tooks.slice().sort((a, b) => a.m - b.m)[0] || null;
  // The wish held longest that is still waiting.
  const oldest = todo.filter((x) => x.since).sort((a, b) => a.since.localeCompare(b.since))[0] || null;
  // Closest to done: the most stages in, still to finish.
  const closest = todo.map((x) => ({ x, p: progress(x) })).filter((t) => t.p.total && t.p.done).sort((a, b) => b.p.pct - a.p.pct)[0] || null;
  const nextUp = todo.filter((x) => x.by).sort((a, b) => (Number(!!b.star) - Number(!!a.star)) || a.by - b.by)[0] || null;
  return {
    total: items.length, done: done.length, todo: todo.length, pct: items.length ? Math.round((done.length / items.length) * 100) : 0,
    cats, strongest, untouched, kinds: cats.length, kindsAll: CATEGORIES.length,
    thisYear: byYear.get(thisYear) || 0, lastYear: byYear.get(thisYear - 1) || 0, best: best ? { year: best[0], count: best[1] } : null,
    fastest, oldest, closest, nextUp, avg: averageTook(items),
    places: new Set(done.map((x) => x.place).filter(Boolean)).size,
    stagesDone: items.reduce((s, x) => s + (x.steps || []).filter((st) => st.done).length, 0),
  };
}

// Lines to keep going - written for the app, one shown each day.
export const CHEERS = [
  'Every dream on this list is a promise to your future self.',
  'Small steps still move you forward - tick off one stage this month.',
  'The best time to start was years ago. The next best is this month.',
  'Memories last longer than things. Keep collecting them.',
  'A dream with a date is a plan. Give the next one a year.',
  'You do not need to do it all - just the next one.',
  'Look back at Milestones: you have done hard things before.',
];

// ---- Places: where dreams came true, by kind - international, or in India within Tamil Nadu, another state, or a
// Union Territory ----
export const PLACE_TYPES = [
  { id: 'intl', icon: '🌍', label: 'International' },
  { id: 'tn', icon: '🛕', label: 'Within Tamil Nadu' },
  { id: 'state', icon: '🏞️', label: 'Other states' },
  { id: 'ut', icon: '🏝️', label: 'Union Territories' },
];
export const placeTypeOf = (id) => PLACE_TYPES.find((t) => t.id === id) || null;
// Names to recognise a place by, with the state, Union Territory or country it is in (the person can always change
// it). Union Territories as of 2026: Andaman and Nicobar, Chandigarh, Dadra and Nagar Haveli and Daman and Diu, Delhi,
// Jammu and Kashmir, Ladakh, Lakshadweep, Puducherry. Checked in this order: Tamil Nadu, the UTs, the states, abroad.
const TN = ['tamil nadu', 'chennai', 'madras', 'madurai', 'coimbatore', 'ooty', 'udhagamandalam', 'kodaikanal', 'kodai', 'rameswaram', 'kanyakumari',
  'trichy', 'tiruchirappalli', 'salem', 'tirunelveli', 'thanjavur', 'tanjore', 'vellore', 'mahabalipuram', 'mamallapuram', 'yercaud', 'tiruvannamalai',
  'kanchipuram', 'kumbakonam', 'erode', 'tiruppur', 'thoothukudi', 'tuticorin', 'dindigul', 'karur', 'hosur', 'nagercoil', 'chidambaram', 'velankanni',
  'palani', 'courtallam', 'valparai', 'coonoor', 'yelagiri', 'hogenakkal', 'tiruchendur', 'srirangam', 'karaikudi', 'chettinad', 'poompuhar', 'pollachi',
  'kotagiri', 'topslip', 'meghamalai', 'kolli hills', 'mudumalai', 'dhanushkodi', 'nilgiris'];
const REGIONS = [
  ['Tamil Nadu', 'tn', TN],
  ['Puducherry', 'ut', ['puducherry', 'pondicherry', 'pondichery', 'pondichéry', 'pondy', 'karaikal', 'mahe', 'yanam', 'auroville']],
  ['Delhi', 'ut', ['delhi', 'new delhi']],
  ['Ladakh', 'ut', ['ladakh', 'leh', 'kargil', 'nubra', 'pangong']],
  ['Jammu & Kashmir', 'ut', ['jammu', 'kashmir', 'srinagar', 'gulmarg', 'pahalgam', 'sonamarg', 'vaishno devi']],
  ['Andaman & Nicobar', 'ut', ['andaman', 'nicobar', 'port blair', 'havelock', 'swaraj dweep', 'neil island', 'shaheed dweep']],
  ['Lakshadweep', 'ut', ['lakshadweep', 'agatti', 'kavaratti', 'bangaram']],
  ['Chandigarh', 'ut', ['chandigarh']],
  ['Dadra, Daman & Diu', 'ut', ['daman', 'diu', 'dadra', 'silvassa']],
  ['Kerala', 'state', ['kerala', 'munnar', 'alleppey', 'alappuzha', 'alapuzha', 'kochi', 'cochin', 'wayanad', 'thekkady', 'varkala', 'sabarimala', 'guruvayur',
    'kovalam', 'trivandrum', 'thiruvananthapuram', 'kumarakom', 'vagamon', 'kozhikode', 'calicut', 'thrissur', 'athirappilly', 'poovar', 'kannur', 'bekal']],
  ['Karnataka', 'state', ['karnataka', 'bengaluru', 'bangalore', 'mysuru', 'mysore', 'coorg', 'coorgh', 'kodagu', 'hampi', 'gokarna', 'chikmagalur', 'chikkamagaluru',
    'hesaraghatta', 'udupi', 'mangalore', 'mangaluru', 'dandeli', 'sakleshpur', 'kabini', 'bandipur', 'murudeshwar', 'nandi hills', 'shivamogga', 'jog falls']],
  ['Andhra Pradesh', 'state', ['andhra pradesh', 'tirupati', 'tirumala', 'visakhapatnam', 'vizag', 'araku', 'srisailam', 'vijayawada', 'horsley hills']],
  ['Telangana', 'state', ['telangana', 'hyderabad', 'secunderabad', 'warangal']],
  ['Goa', 'state', ['goa', 'panaji', 'panjim', 'calangute', 'baga', 'anjuna', 'palolem', 'candolim']],
  ['Maharashtra', 'state', ['maharashtra', 'mumbai', 'bombay', 'pune', 'lonavala', 'mahabaleshwar', 'nashik', 'shirdi', 'aurangabad', 'ajanta', 'ellora', 'alibaug', 'matheran']],
  ['Gujarat', 'state', ['gujarat', 'ahmedabad', 'rann of kutch', 'kutch', 'dwarka', 'somnath', 'gir', 'statue of unity', 'vadodara']],
  ['Rajasthan', 'state', ['rajasthan', 'jaipur', 'udaipur', 'jodhpur', 'jaisalmer', 'mount abu', 'pushkar', 'ranthambore', 'bikaner']],
  ['Uttar Pradesh', 'state', ['uttar pradesh', 'agra', 'taj mahal', 'varanasi', 'kashi', 'banaras', 'mathura', 'vrindavan', 'ayodhya', 'prayagraj', 'allahabad', 'lucknow']],
  ['Uttarakhand', 'state', ['uttarakhand', 'rishikesh', 'haridwar', 'kedarnath', 'badrinath', 'nainital', 'mussoorie', 'auli', 'jim corbett', 'dehradun']],
  ['Himachal Pradesh', 'state', ['himachal', 'manali', 'shimla', 'spiti', 'dharamshala', 'mcleodganj', 'kasol', 'dalhousie', 'kullu']],
  ['West Bengal', 'state', ['west bengal', 'kolkata', 'calcutta', 'darjeeling', 'sundarbans']],
  ['Sikkim', 'state', ['sikkim', 'gangtok', 'pelling']],
  ['Meghalaya', 'state', ['meghalaya', 'shillong', 'cherrapunji', 'sohra', 'dawki']],
  ['Assam', 'state', ['assam', 'kaziranga', 'guwahati', 'majuli']],
  ['Arunachal Pradesh', 'state', ['arunachal pradesh', 'tawang', 'ziro']],
  ['Odisha', 'state', ['odisha', 'orissa', 'puri', 'konark', 'bhubaneswar']],
  ['Madhya Pradesh', 'state', ['madhya pradesh', 'khajuraho', 'ujjain', 'indore', 'bhopal', 'pachmarhi', 'kanha', 'bandhavgarh']],
  ['Bihar', 'state', ['bihar', 'bodh gaya', 'patna']],
  ['Punjab', 'state', ['punjab', 'amritsar', 'golden temple']],
  ['Haryana', 'state', ['haryana', 'gurugram', 'gurgaon']],
  ['Jharkhand', 'state', ['jharkhand', 'ranchi']],
  ['Chhattisgarh', 'state', ['chhattisgarh', 'raipur']],
  ['Manipur', 'state', ['manipur', 'imphal']],
  ['Mizoram', 'state', ['mizoram', 'aizawl']],
  ['Nagaland', 'state', ['nagaland', 'kohima']],
  ['Tripura', 'state', ['tripura', 'agartala']],
  ['Sri Lanka', 'intl', ['sri lanka', 'colombo', 'kandy', 'galle', 'ella', 'nuwara eliya', 'sigiriya', 'bentota', 'jaffna', 'trincomalee']],
  ['Maldives', 'intl', ['maldives']],
  ['Nepal', 'intl', ['nepal', 'kathmandu', 'pokhara']],
  ['Bhutan', 'intl', ['bhutan', 'thimphu', 'paro']],
  ['Thailand', 'intl', ['thailand', 'bangkok', 'phuket', 'pattaya', 'krabi', 'chiang mai']],
  ['Singapore', 'intl', ['singapore']],
  ['Malaysia', 'intl', ['malaysia', 'kuala lumpur', 'langkawi', 'penang']],
  ['Indonesia', 'intl', ['indonesia', 'bali', 'jakarta']],
  ['Vietnam', 'intl', ['vietnam', 'hanoi', 'ho chi minh', 'da nang', 'ha long']],
  ['UAE', 'intl', ['uae', 'dubai', 'abu dhabi']],
  ['Oman', 'intl', ['oman', 'muscat']],
  ['Qatar', 'intl', ['qatar', 'doha']],
  ['Saudi Arabia', 'intl', ['saudi', 'mecca', 'makkah', 'medina', 'madinah']],
  ['Turkey', 'intl', ['turkey', 'turkiye', 'istanbul', 'cappadocia']],
  ['Egypt', 'intl', ['egypt', 'cairo', 'giza']],
  ['Mauritius', 'intl', ['mauritius']],
  ['Seychelles', 'intl', ['seychelles']],
  ['Japan', 'intl', ['japan', 'tokyo', 'kyoto', 'osaka']],
  ['South Korea', 'intl', ['korea', 'seoul']],
  ['China', 'intl', ['china', 'beijing', 'shanghai']],
  ['Hong Kong', 'intl', ['hong kong']],
  ['Australia', 'intl', ['australia', 'sydney', 'melbourne']],
  ['New Zealand', 'intl', ['new zealand', 'auckland', 'queenstown']],
  ['United Kingdom', 'intl', ['uk', 'united kingdom', 'england', 'london', 'scotland', 'edinburgh']],
  ['France', 'intl', ['france', 'paris']],
  ['Switzerland', 'intl', ['switzerland', 'swiss', 'zurich', 'interlaken', 'geneva']],
  ['Italy', 'intl', ['italy', 'rome', 'venice', 'florence', 'milan']],
  ['Spain', 'intl', ['spain', 'barcelona', 'madrid']],
  ['Greece', 'intl', ['greece', 'athens', 'santorini']],
  ['Germany', 'intl', ['germany', 'berlin', 'munich']],
  ['Netherlands', 'intl', ['netherlands', 'amsterdam']],
  ['Norway', 'intl', ['norway', 'oslo', 'tromsø', 'tromso']],
  ['Iceland', 'intl', ['iceland', 'reykjavik']],
  ['USA', 'intl', ['usa', 'united states', 'america', 'new york', 'las vegas', 'san francisco', 'california']],
  ['Canada', 'intl', ['canada', 'toronto', 'vancouver']],
  ['Kenya', 'intl', ['kenya', 'masai mara']],
  ['South Africa', 'intl', ['south africa', 'cape town']],
];
const nameRe = (w) => new RegExp('(^|[^a-z\u00e0-\u00ff])' + w.replace(/ /g, '\\s+') + '([^a-z\u00e0-\u00ff]|$)');
const REGION_RES = REGIONS.map(([region, type, words]) => [region, type, words.map(nameRe)]);
// The state, UT or country a place is in, from its name: { region, type, country }, or null if it is not known.
export function guessRegion(place) {
  const t = String(place || '').toLowerCase();
  if (!t.trim()) return null;
  const hit = REGION_RES.find(([, , res]) => res.some((re) => re.test(t)));
  return hit ? { region: hit[0], type: hit[1], country: hit[1] === 'intl' ? hit[0] : 'India' } : null;
}
// A state, UT or country typed by name: its kind, or null if it is not one MyNotes knows.
export function regionInfo(name) {
  const n = String(name || '').trim().toLowerCase();
  const hit = n && REGIONS.find(([r]) => r.toLowerCase() === n);
  return hit ? { region: hit[0], type: hit[1], country: hit[1] === 'intl' ? hit[0] : 'India' } : null;
}
export const REGION_NAMES = REGIONS.map(([r]) => r);
export function guessPlaceType(place) {
  const t = String(place || '').toLowerCase();
  if (!t.trim()) return '';
  const r = guessRegion(t);
  if (r) return r.type;
  return nameRe('india').test(t) ? 'state' : 'intl';
}

// The landscape of a trip (more than one can apply) and where they stayed - picked when a place is added or changed.
export const GEOS = [
  { id: 'beach', icon: '🏖️', label: 'Beach' }, { id: 'hill', icon: '⛰️', label: 'Hills' }, { id: 'lake', icon: '🏞️', label: 'Lake' },
  { id: 'river', icon: '🛶', label: 'River / Backwaters' }, { id: 'island', icon: '🏝️', label: 'Island' }, { id: 'forest', icon: '🌳', label: 'Forest / Wildlife' },
  { id: 'waterfall', icon: '🌊', label: 'Waterfall' }, { id: 'snow', icon: '🏔️', label: 'Snow' }, { id: 'desert', icon: '🐪', label: 'Desert' },
  { id: 'temple', icon: '🛕', label: 'Temple / Spiritual' }, { id: 'heritage', icon: '🏰', label: 'Heritage' }, { id: 'city', icon: '🏙️', label: 'City' },
];
export const geoOf = (id) => GEOS.find((g) => g.id === id) || null;
// Adventures tried at a place: tap as many as were done (each its own badge).
export const ADVENTURES = [
  { id: 'scuba', icon: '🤿', label: 'Scuba diving' }, { id: 'snorkel', icon: '🐠', label: 'Snorkelling' }, { id: 'parasail', icon: '🪂', label: 'Parasailing' },
  { id: 'paraglide', icon: '🪁', label: 'Paragliding' }, { id: 'jeep', icon: '🚙', label: 'Jeep safari' }, { id: 'kayak', icon: '🛶', label: 'Kayaking' },
  { id: 'boat', icon: '🚤', label: 'Boat safari' }, { id: 'rafting', icon: '🚣', label: 'River rafting' }, { id: 'trek', icon: '🥾', label: 'Trekking' },
  { id: 'climb', icon: '🧗', label: 'Rock climbing' }, { id: 'sail', icon: '⛵', label: 'Sailing' }, { id: 'surf', icon: '🏄', label: 'Surfing' },
  { id: 'jetski', icon: '🛥️', label: 'Jet ski' }, { id: 'zipline', icon: '🚡', label: 'Zip-line' }, { id: 'bungee', icon: '🪢', label: 'Bungee jump' },
  { id: 'skydive', icon: '🛩️', label: 'Skydiving' }, { id: 'balloon', icon: '🎈', label: 'Hot-air balloon' }, { id: 'atv', icon: '🏎️', label: 'ATV ride' },
  { id: 'camel', icon: '🐪', label: 'Camel safari' }, { id: 'horse', icon: '🐎', label: 'Horse riding' }, { id: 'camp', icon: '🏕️', label: 'Camping' },
  { id: 'cycle', icon: '🚵', label: 'Mountain biking' }, { id: 'ski', icon: '⛷️', label: 'Skiing' }, { id: 'cave', icon: '🔦', label: 'Caving' },
];
export const adventureOf = (id) => ADVENTURES.find((a) => a.id === id) || null;
export const STAYS = ['Resort', 'Beach resort', 'Hotel', 'Room', 'Homestay', 'Cottage', 'Villa', 'Boat house', 'Airbnb', 'Tent / Camp', 'Day trip'];
// Who the trip was with (one of these; each has its own icon on the place's card).
export const COMPANIONS = [
  { id: 'her', label: 'With her' }, { id: 'solo', label: 'Solo' }, { id: 'family', label: 'Family' },
  { id: 'baby', label: 'With baby' }, { id: 'friends', label: 'Friends' }, { id: 'work', label: 'Work visit' },
];
// How the trip was travelled (the route on the map shows it).
export const MODES = [
  { id: 'flight', icon: '✈️', label: 'Flight' }, { id: 'train', icon: '🚆', label: 'Train' }, { id: 'car', icon: '🚗', label: 'Car' }, { id: 'cab', icon: '🚕', label: 'Cab' },
  { id: 'bus', icon: '🚌', label: 'Bus' }, { id: 'bike', icon: '🏍️', label: 'Bike' }, { id: 'ship', icon: '⛴️', label: 'Ship / Ferry' },
];
export const modeOf = (id) => MODES.find((x) => x.id === id) || null;
export const companionOf = (id) => COMPANIONS.find((x) => x.id === id) || null;
// Read a trip's details into their shape (on a visit or a dream).
export function tripDetails(src) {
  const x = src || {};
  const days = Math.round(Number(x.days));
  const geo = (Array.isArray(x.geo) ? x.geo : []).filter((g, i, a) => GEOS.some((t) => t.id === g) && a.indexOf(g) === i);
  return {
    region: String(x.region || '').trim().slice(0, 60),
    geo,
    // The places stayed at: tags (one stay saved as text before is read as one tag).
    stay: (Array.isArray(x.stay) ? x.stay : [x.stay]).map((t) => String(t || '').trim().slice(0, 40)).filter((t, i, a) => t && a.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i).slice(0, 8),
    days: days >= 1 && days <= 366 ? days : null,
    // Nights, when typed: else one less than the days (2 nights = 3 days).
    // How it was: 1-5 stars, and the best memory of the trip (a dream's memory is the one written at check-in).
    with: COMPANIONS.some((w) => w.id === x.with) ? x.with : '',
    // Where the trip started (blank: home) and how it was travelled - the route on the map.
    from: String(x.from || '').trim().slice(0, 80),
    mode: MODES.some((m) => m.id === x.mode) ? x.mode : '',
    rating: Math.round(Number(x.rating)) >= 1 && Math.round(Number(x.rating)) <= 5 ? Math.round(Number(x.rating)) : null,
    memory: String(x.memory || '').trim(),
    nights: x.nights == null || x.nights === '' || !(Math.round(Number(x.nights)) >= 0 && Math.round(Number(x.nights)) <= 365) ? null : Math.round(Number(x.nights)),
    // The name of the beach, hill, falls... for each landscape picked: { waterfall: 'Athirappilly' }.
    spots: Object.fromEntries(geo.map((g) => [g, [].concat((x.spots || {})[g] || []).map((n) => String(n || '').trim().slice(0, 80)).filter(Boolean).slice(0, 12)]).filter(([, a]) => a.length)),
    adv: (Array.isArray(x.adv) ? x.adv : []).filter((a, i, all) => ADVENTURES.some((t) => t.id === a) && all.indexOf(a) === i),
  };
}

// Every place a dream came true, newest first, with the year, and grouped by kind (unsorted ones kept apart).
export function placesVisited(items, extra) {
  // The region: as typed, else from the place's name, else Tamil Nadu for a place marked within it. Abroad, the region is the country.
  const withRegion = (v) => {
    const d = tripDetails(v.src);
    const g = guessRegion(v.place);
    const region = d.region || (g ? g.region : '') || (v.type === 'tn' ? 'Tamil Nadu' : '');
    const known = regionInfo(region);
    const country = v.type === 'intl' ? (known && known.type === 'intl' ? known.region : region) : 'India';
    return Object.assign(v, d, { region, country });
  };
  const visits = items.filter((x) => x.done && x.place).map((x) => ({ source: 'dream', id: x.id, place: x.place, type: x.placeType || guessPlaceType(x.place), ym: x.done, item: x, label: x.title, src: x }))
    .concat((extra || []).map((v) => ({ source: 'visit', id: v.id, place: v.place, type: v.placeType || guessPlaceType(v.place), ym: v.ym, visit: v, label: v.note || 'A visit', src: v })))
    .map(withRegion)
    .sort((a, b) => b.ym.localeCompare(a.ym));
  const byYear = new Map();
  visits.forEach((v) => { const y = Number(v.ym.slice(0, 4)); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(v); });
  const byType = PLACE_TYPES.map((t) => {
    const vs = visits.filter((v) => v.type === t.id);
    return { type: t, visits: vs, count: new Set(vs.map((v) => v.place.toLowerCase())).size };
  });
  return { visits, count: new Set(visits.map((v) => v.place.toLowerCase())).size, years: [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, vs]) => ({ year, visits: vs })), byType };
}

// Places visited outside any dream: add, change, remove.
const mapVisits = (list, pid, fn) => {
  const l = normalise(list);
  return Object.assign(l, { profiles: l.profiles.map((p) => (p.id === pid ? Object.assign({}, p, { visits: fn(p.visits || []) }) : p)) });
};
const ymOf = (year, month) => Number(year) + '-' + String(Math.min(12, Math.max(1, Number(month) || 1))).padStart(2, '0');
export function addVisit(list, pid, data) {
  const { place, placeType, year, month, note } = data;
  const pl = String(place || '').trim();
  if (!pl) return normalise(list);
  return mapVisits(list, pid, (vs) => vs.concat([Object.assign({ id: uid('bv'), place: pl, placeType: placeType || guessPlaceType(pl), ym: ymOf(year, month), note: String(note || '').trim() }, tripDetails(data))]));
}
export function updateVisit(list, pid, vid, data) {
  const { place, placeType, year, month, note } = data;
  return mapVisits(list, pid, (vs) => vs.map((v) => (v.id === vid ? Object.assign({}, v, { place: String(place || v.place).trim(), placeType: placeType || v.placeType, ym: year ? ymOf(year, month) : v.ym, note: note != null ? String(note).trim() : v.note },
    tripDetails(Object.assign({}, v, data))) : v)));
}
export function removeVisit(list, pid, vid) { return mapVisits(list, pid, (vs) => vs.filter((v) => v.id !== vid)); }

// Places to visit added on the Places tab: add, change, remove (a visit there takes it off - see Been there).
const mapWishes = (list, pid, fn) => {
  const l = normalise(list);
  return Object.assign(l, { profiles: l.profiles.map((p) => (p.id === pid ? Object.assign({}, p, { wishes: fn(p.wishes || []) }) : p)) });
};
const wishOf = (w, base) => {
  const pl = String(w.place != null ? w.place : base.place || '').trim();
  return Object.assign({}, base, { place: pl, placeType: w.placeType || base.placeType || guessPlaceType(pl), region: String(w.region != null ? w.region : base.region || '').trim(),
    by: w.by !== undefined ? Number(w.by) || null : base.by || null, note: String(w.note != null ? w.note : base.note || '').trim() });
};
export function addWish(list, pid, w, nowIso) {
  if (!String(w.place || '').trim()) return normalise(list);
  return mapWishes(list, pid, (ws) => ws.concat([wishOf(w, { id: uid('bw'), addedAt: nowIso || new Date().toISOString() })]));
}
export function updateWish(list, pid, wid, w) { return mapWishes(list, pid, (ws) => ws.map((x) => (x.id === wid ? wishOf(w, x) : x))); }
export function removeWish(list, pid, wid) { return mapWishes(list, pid, (ws) => ws.filter((x) => x.id !== wid)); }

// A trip's nights: as typed, else one less than its days (0 if neither is known).
export const nightsOf = (x) => (x.nights != null ? x.nights : x.days ? x.days - 1 : 0);
// "3N 4D" (or "Day trip"), from a trip's nights and days; '' when neither is known.
export function nightsDays(nights, days) {
  if (!days && !nights) return '';
  if (days === 1 && !nights) return 'Day trip';
  return (nights || 0) + 'N ' + (days || (nights || 0) + 1) + 'D';
}

// My places ranking: every place visited, in the order dragged (order: place names, lower case); places not placed
// yet follow - the best rated first, then the most trips, then the latest. Each with its rank (1 = the favourite).
export function placeRanking(visits, order) {
  const by = new Map();
  visits.slice().sort((a, b) => a.ym.localeCompare(b.ym)).forEach((x) => {
    const k = x.place.trim().toLowerCase();
    if (!by.has(k)) by.set(k, { key: k, place: x.place.trim(), trips: 0, stars: [], memory: '', latest: null });
    const r = by.get(k);
    r.trips++; r.latest = x;
    if (x.rating) r.stars.push(x.rating);
    if (x.memory) r.memory = x.memory;
  });
  const pos = new Map((order || []).map((k, i) => [k, i]));
  const at = (r) => (pos.has(r.key) ? pos.get(r.key) : 1e6);
  return [...by.values()].map((r) => ({ key: r.key, place: r.place, trips: r.trips, memory: r.memory, latest: r.latest,
    rating: r.stars.length ? Math.round((r.stars.reduce((s, n) => s + n, 0) / r.stars.length) * 10) / 10 : 0 }))
    .sort((a, b) => at(a) - at(b) || b.rating - a.rating || b.trips - a.trips || b.latest.ym.localeCompare(a.latest.ym))
    .map((r, i) => Object.assign(r, { rank: i + 1 }));
}

// My top places: each place rated (its trips' stars averaged), best first; then more trips; with its latest memory.
export function rankPlaces(trips) {
  const by = new Map();
  trips.slice().sort((a, b) => a.ym.localeCompare(b.ym)).forEach((x) => {
    const k = x.place.trim().toLowerCase();
    if (!by.has(k)) by.set(k, { place: x.place.trim(), stars: [], trips: 0, memory: '' });
    const r = by.get(k);
    r.trips++;
    if (x.rating) r.stars.push(x.rating);
    if (x.memory) r.memory = x.memory;
  });
  return [...by.values()].filter((r) => r.stars.length)
    .map((r) => ({ place: r.place, rating: Math.round((r.stars.reduce((s, n) => s + n, 0) / r.stars.length) * 10) / 10, trips: r.trips, memory: r.memory }))
    .sort((a, b) => b.rating - a.rating || b.trips - a.trips || a.place.localeCompare(b.place));
}

// What the places say: trips and days by year, by state or country, the landscapes and the stays, and a few highlights.
// Takes placesVisited's result. Counts are trips (a place visited twice counts twice), as a travel log would.
export function travelInsights(v) {
  const trips = v.visits.slice().sort((a, b) => a.ym.localeCompare(b.ym));   // oldest first
  const sum = (xs) => xs.reduce((n, x) => n + (x.days || 0), 0);
  const sumNights = (xs) => xs.reduce((n, x) => n + nightsOf(x), 0);
  const seen = new Set();
  const years = [];
  trips.forEach((x) => {
    const y = Number(x.ym.slice(0, 4));
    let g = years[years.length - 1];
    if (!g || g.year !== y) { g = { year: y, trips: 0, days: 0, fresh: [], places: [] }; years.push(g); }
    g.trips++; g.days += x.days || 0; g.places.push(x.place);
    if (x.region && !seen.has(x.region.toLowerCase())) { seen.add(x.region.toLowerCase()); g.fresh.push(x.region); }
  });
  const tally = (key, fn) => {
    const m = new Map();
    trips.forEach((x) => fn(x).forEach((k) => { const id = key(k); if (!m.has(id)) m.set(id, { key: k, trips: 0, days: 0, places: new Set() }); const r = m.get(id); r.trips++; r.days += x.days || 0; r.places.add(x.place.toLowerCase()); }));
    return [...m.values()].map((r) => Object.assign(r, { places: r.places.size })).sort((a, b) => b.trips - a.trips || b.days - a.days);
  };
  const regions = tally((k) => k.region.toLowerCase(), (x) => (x.region ? [{ region: x.region, country: x.country || 'India', type: x.type }] : []))
    .map((r) => Object.assign(r.key, { trips: r.trips, days: r.days, places: r.places }));
  const geo = tally((k) => k, (x) => x.geo).map((r) => Object.assign({}, geoOf(r.key), { trips: r.trips, days: r.days }));
  const stays = tally((k) => k.toLowerCase(), (x) => x.stay).map((r) => ({ label: r.key, trips: r.trips, days: r.days }));
  const company = tally((k) => k, (x) => (x.with ? [x.with] : [])).map((r) => ({ id: r.key, label: companionOf(r.key).label, trips: r.trips, days: r.days }));
  const adventures = tally((k) => k, (x) => x.adv || []).map((r) => Object.assign({}, adventureOf(r.key), { trips: r.trips }));
  const places = tally((k) => k.toLowerCase(), (x) => [x.place]);
  const withDays = trips.filter((x) => x.days);
  const longest = withDays.slice().sort((a, b) => b.days - a.days || b.ym.localeCompare(a.ym))[0] || null;
  const busiest = years.slice().sort((a, b) => b.trips - a.trips || b.year - a.year)[0] || null;
  // The months travelled in most, whatever the year.
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, trips: trips.filter((x) => Number(x.ym.slice(5, 7)) === i + 1).length }))
    .filter((m) => m.trips).sort((a, b) => b.trips - a.trips || a.month - b.month);
  const span = years.length ? years[years.length - 1].year - years[0].year + 1 : 0;
  return {
    trips: trips.length, places: v.count, days: sum(trips), nights: sumNights(trips), daysKnown: withDays.length,
    avgDays: withDays.length ? Math.round((sum(withDays) / withDays.length) * 10) / 10 : 0,
    perYear: span ? Math.round((trips.length / span) * 10) / 10 : 0,
    india: regions.filter((r) => r.country === 'India').length,
    abroad: new Set(regions.filter((r) => r.country !== 'India').map((r) => r.country.toLowerCase())).size,
    noRegion: trips.filter((x) => !x.region).length,
    years, regions, geo, stays, company, adventures, longest, busiest, months,
    repeats: places.filter((r) => r.trips > 1).map((r) => ({ place: r.key, trips: r.trips })),
    ranked: rankPlaces(trips),
  };
}

// Places to visit: dreams on the bucket list not yet ticked off that have a place, and the places added on the Places
// tab - each with the state or country it is in; the soonest first.
export function placesToVisit(items, wishes) {
  const at = (place, placeType, reg) => {
    const type = placeType || guessPlaceType(place);
    const g = guessRegion(place);
    const region = reg || (g ? g.region : '') || (type === 'tn' ? 'Tamil Nadu' : '');
    const known = regionInfo(region);
    return { type, region, country: type === 'intl' ? (known && known.type === 'intl' ? known.region : region) : 'India' };
  };
  const dreams = items.filter((x) => !x.done && x.place).map((x) => Object.assign({ id: x.id, place: x.place, source: 'dream', item: x, title: x.title, by: x.by }, at(x.place, x.placeType, x.region)));
  const own = (wishes || []).map((w) => Object.assign({ id: w.id, place: w.place, source: 'wish', wish: w, title: w.note || '', by: w.by }, at(w.place, w.placeType, w.region)));
  return dreams.concat(own).sort((a, b) => (a.by || 9999) - (b.by || 9999) || a.place.localeCompare(b.place));
}
