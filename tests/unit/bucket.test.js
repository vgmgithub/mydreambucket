import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, addProfile, updateProfile, removeProfile, addItem, updateItem, removeItem, checkIn, undoCheckIn, sortItems, stats, memories, catOf, CATEGORIES } from '../../js/shell/bucket.js';
import { read } from './src.js';

test('profiles: each has its own list; the newest is the one shown; deleting one falls back to another', () => {
  let l = normalise(null);
  assert.deepEqual(l, { profiles: [], active: null, plan: { budget: 0, inflation: 6 } });
  l = addProfile(l, { name: 'Me', emoji: '😎' });
  const me = l.active;
  l = addProfile(l, { name: 'Amma' });
  assert.equal(l.profiles.length, 2);
  assert.notEqual(l.active, me, 'a new profile is opened');
  l = addItem(l, me, { title: 'See the Northern Lights', cat: 'travel', by: 2028, cost: 300000 }, '2026-10-28T00:00:00Z');
  assert.equal(l.profiles[0].items.length, 1);
  assert.equal(l.profiles[1].items.length, 0, 'lists are kept apart');
  l = updateProfile(l, me, { name: 'Gopal' });
  assert.equal(l.profiles[0].name, 'Gopal');
  assert.equal(l.profiles[0].items.length, 1, 'renaming keeps the list');
  l = removeProfile(l, l.active);
  assert.equal(l.active, me);
});

test('check-in: the month and year it was done, a memory, and undo', () => {
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  l = addItem(l, p, { title: 'Run a 10K', cat: 'fitness' });
  const id = l.profiles[0].items[0].id;
  l = checkIn(l, p, id, 2026, 3, 'Finished in 58 minutes');
  assert.equal(l.profiles[0].items[0].done, '2026-03');
  assert.equal(l.profiles[0].items[0].memory, 'Finished in 58 minutes');
  l = undoCheckIn(l, p, id);
  assert.equal(l.profiles[0].items[0].done, null);
  assert.equal(addItem(l, p, { title: '   ' }).profiles[0].items.length, 1, 'a blank title is not added');
  l = removeItem(l, p, id);
  assert.equal(l.profiles[0].items.length, 0);
});

test('order: must-dos first, then the soonest year; done ones last, latest first. Stats and memories', () => {
  const items = [
    { id: 'a', title: 'A', by: 2030, star: false, addedAt: '1', done: null },
    { id: 'b', title: 'B', by: 2027, star: false, addedAt: '2', done: null },
    { id: 'c', title: 'C', by: null, star: true, addedAt: '3', done: null },
    { id: 'd', title: 'D', done: '2025-05', cost: 0 },
    { id: 'e', title: 'E', done: '2026-08' },
    { id: 'f', title: 'F', by: 2024, done: null, cost: 50000 },
    { id: 'g', title: 'G', by: 2026, done: null, cost: 20000 },
  ];
  assert.deepEqual(sortItems(items).map((x) => x.id), ['c', 'f', 'g', 'b', 'a', 'e', 'd']);
  const s = stats(items, 2026);
  assert.deepEqual([s.total, s.done, s.todo, s.pct, s.thisYear, s.dueThisYear, s.overdue, s.costToGo, s.costThisYear], [7, 2, 5, 29, 1, 1, 1, 70000, 20000]);
  assert.deepEqual(memories(items).map((g) => [g.year, g.items.map((x) => x.id)]), [[2026, ['e']], [2025, ['d']]]);
  assert.equal(catOf('nope').id, 'other');
  assert.ok(CATEGORIES.length >= 10);
});

test('the app: the list kept in meta as in MyNotes, the screens started by main.js, installable as My Dream Bucket', () => {
  assert.match(read('js/shell/bucket-ui.js'), /const KEY = 'bucketList';/);
  assert.match(read('js/main.js'), /onMode\('bucket', \(\) => \{ drawHeader\(\); renderBucket\(\); \}\);/);
  assert.match(read('js/main.js'), /onMode\('bucketplan', \(\) => \{ drawHeader\(\); renderBucketPlan\(\); \}\);/);
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'My Dream Bucket');
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
});

test('Technology is a category; rearranging keeps the hand-set order until Automatic', async () => {
  const { reorder, autoOrder } = await import('../../js/shell/bucket.js');
  assert.equal(catOf('tech').label, 'Technology');
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  ['A', 'B', 'C'].forEach((t, i) => { l = addItem(l, p, { title: t, by: 2030 - i }); });
  const ids = l.profiles[0].items.map((x) => x.id);
  assert.deepEqual(sortItems(l.profiles[0].items, l.profiles[0].manual).map((x) => x.title), ['C', 'B', 'A'], 'automatic: soonest year first');
  l = reorder(l, p, [ids[1], ids[0], ids[2]]);
  assert.equal(l.profiles[0].manual, true);
  assert.deepEqual(sortItems(l.profiles[0].items, l.profiles[0].manual).map((x) => x.title), ['B', 'A', 'C'], 'the order it was left in');
  l = autoOrder(l, p);
  assert.deepEqual(sortItems(l.profiles[0].items, l.profiles[0].manual).map((x) => x.title), ['C', 'B', 'A']);
});

test('Bucket List Plan: cost grows to its year, the place and rate follow the distance, saved money counts, and the budget decides what fits', async () => {
  const { planGoals, goalAt, monthsUntil, fvFactor, horizonFor } = await import('../../js/shell/bucket-plan.js');
  assert.equal(monthsUntil(2027, '2026-10-28'), 14);
  assert.deepEqual([6, 24, 48, 100].map((m) => horizonFor(m).rate), [6.5, 7, 8.5, 10]);
  const g = goalAt({ cost: 100000, saved: 0 }, 2027, 6, '2026-10-28');
  assert.ok(Math.abs(g.costThen - 100000 * Math.pow(1.06, 14 / 12)) < 0.01);
  assert.ok(Math.abs(g.monthly * fvFactor(7, 14) - g.need) < 0.01, 'the monthly amount reaches what is needed');
  const half = goalAt({ cost: 100000, saved: 50000 }, 2027, 6, '2026-10-28');
  assert.ok(half.monthly < g.monthly / 2, 'money already put aside (and its growth) comes off');

  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  l = addItem(l, p, { title: 'Northern Lights', by: 2028, cost: 350000, star: true });
  l = addItem(l, p, { title: 'Kashi', by: 2027, cost: 60000 });
  l = addItem(l, p, { title: 'Europe', by: 2035, cost: 800000 });
  l = addItem(l, p, { title: 'No cost yet' });
  const free = planGoals(l, '2026-10-28', 0, 6);
  assert.equal(free.rows.length, 3); assert.equal(free.missing.length, 1);
  assert.deepEqual(free.rows.map((r) => r.title), ['Northern Lights', 'Kashi', 'Europe'], 'must-dos first, then the soonest');
  assert.ok(free.rows.every((r) => r.status === 'unbudgeted'));
  const rich = planGoals(l, '2026-10-28', 100000, 6);
  assert.ok(rich.rows.every((r) => r.status === 'ontrack')); assert.equal(rich.short, 0);
  const tight = planGoals(l, '2026-10-28', 16000, 6);
  assert.equal(tight.rows[0].status, 'ontrack', 'the must-do keeps its year');
  assert.ok(tight.rows.some((r) => r.status === 'later' && r.plan.year > r.by), 'what does not fit moves later');
  assert.ok(tight.short > 0);
});

test('wired: Bucket List Plan in the menu; a note sits behind an i', () => {
  assert.match(read('js/main.js'), /'Bucket List Plan', 'What to save for each dream, and when'/);
  assert.match(read('js/core/app.js'), /if \(state\.appMode !== 'bucket'\) setAppMode\('bucket'\);/, 'Back from the plan returns to the list');
  assert.match(read('js/shell/bucket-ui.js'), /class: 'bk-info', 'aria-label': 'Show the note'/);
});

test('stages: a dream done step by step - each stage checked in with its month and year, a progress figure, edits keep check-ins', async () => {
  const { setSteps, checkStep, undoStep, progress } = await import('../../js/shell/bucket.js');
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  l = addItem(l, p, { title: 'Learn guitar', steps: ['Buy a guitar', 'Learn 5 chords', 'Play a full song', ' '] });
  let it = l.profiles[0].items[0];
  assert.equal(it.steps.length, 3, 'a blank stage is dropped');
  assert.deepEqual(progress(it), { done: 0, total: 3, pct: 0 });
  l = checkStep(l, p, it.id, it.steps[0].id, 2026, 10);
  it = l.profiles[0].items[0];
  assert.equal(it.steps[0].done, '2026-10');
  assert.deepEqual(progress(it), { done: 1, total: 3, pct: 33 });
  assert.equal(stats(l.profiles[0].items, 2026).started, 1, 'counted as under way');
  l = setSteps(l, p, it.id, [{ id: it.steps[0].id, title: 'Buy a good guitar' }, 'Learn 8 chords']);
  it = l.profiles[0].items[0];
  assert.deepEqual(it.steps.map((x) => [x.title, x.done]), [['Buy a good guitar', '2026-10'], ['Learn 8 chords', null]], 'renamed stage keeps its check-in');
  l = undoStep(l, p, it.id, it.steps[0].id);
  assert.equal(progress(l.profiles[0].items[0]).done, 0);
  assert.equal(progress({ done: '2026-01', steps: [] }).pct, 100, 'a dream ticked off is 100%');
  assert.match(read('js/shell/bucket-ui.js'), /'✅ Stage done: '/);
});

test('wished since: a new wish starts this month (or a month set back); a done one shows how long it took', async () => {
  const { took, tookLabel, averageTook, monthsBetween } = await import('../../js/shell/bucket.js');
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  l = addItem(l, p, { title: 'Learn to swim' }, '2026-10-28T00:00:00Z');
  l = addItem(l, p, { title: 'See the Northern Lights', since: '2019-02' }, '2026-10-28T00:00:00Z');
  const [a, b] = l.profiles[0].items;
  assert.equal(a.since, '2026-10', 'the month it was added');
  assert.equal(b.since, '2019-02', 'or the month given');
  assert.equal(normalise({ profiles: [{ id: 'x', items: [{ id: 'i', title: 'Old', addedAt: '2024-05-01T00:00:00Z' }] }] }).profiles[0].items[0].since, '2024-05', 'older entries use the day they were added');
  l = checkIn(l, p, b.id, 2027, 1, '');
  const done = l.profiles[0].items.find((x) => x.id === b.id);
  assert.equal(took(done), 95);
  assert.equal(tookLabel(95), '7 yrs 11 mos');
  assert.deepEqual([tookLabel(0), tookLabel(1), tookLabel(12), tookLabel(25)], ['within a month', '1 mo', '1 yr', '2 yrs 1 mo']);
  assert.equal(took(a), null, 'not done yet');
  assert.equal(monthsBetween('2027-01', '2026-01'), 0, 'never negative');
  assert.equal(averageTook([done, { since: '2026-01', done: '2026-05' }]), Math.round((95 + 4) / 2));
});

test('a tap on a dream shows its stages or note; editing is from the Edit button at the top', () => {
  const ui = read('js/shell/bucket-ui.js');
  assert.match(ui, /if \(_edit\) \{ openItemForm\(list, p, i\); return; \}/);
  assert.match(ui, /'✏️ Tap a dream to edit or delete it'/);
  assert.doesNotMatch(ui, /onclick: \(\) => openItemForm\(list, p, i\) \}, \[/, 'a plain tap no longer opens the editor');
});

test('one ranked list: done dreams keep their place; rearranging moves done ones too; a place; milestones year by year', async () => {
  const { rankItems, reorder, milestones, mapUrl } = await import('../../js/shell/bucket.js');
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  l = addItem(l, p, { title: 'A', by: 2026 }, '2020-01-01T00:00:00Z');
  l = addItem(l, p, { title: 'B', by: 2027, place: ' Tromsø, Norway ', since: '2019-02', steps: ['Book flights'] }, '2020-01-01T00:00:00Z');
  l = addItem(l, p, { title: 'C', by: 2028 }, '2020-01-01T00:00:00Z');
  const [a, b, c] = l.profiles[0].items;
  assert.equal(b.place, 'Tromsø, Norway');
  l = checkIn(l, p, a.id, 2025, 6, 'Great');
  assert.deepEqual(rankItems(l.profiles[0].items, false).map((x) => x.title), ['A', 'B', 'C'], 'A is done and stays first');
  l = reorder(l, p, [c.id, a.id, b.id]);
  assert.deepEqual(rankItems(l.profiles[0].items, l.profiles[0].manual).map((x) => x.title), ['C', 'A', 'B'], 'a done one is moved like any other');
  const { checkStep } = await import('../../js/shell/bucket.js');
  l = checkStep(l, p, b.id, l.profiles[0].items.find((x) => x.id === b.id).steps[0].id, 2026, 3);
  l = checkIn(l, p, b.id, 2026, 9, 'Lights!');
  const m = milestones(l.profiles[0].items);
  assert.equal(m.count, 2);
  assert.deepEqual(m.years.map((y) => [y.year, y.dreams, y.stages]), [[2026, 1, 1], [2025, 1, 0]]);
  assert.deepEqual(m.years[0].events.map((e) => e.kind + ':' + e.ym), ['dream:2026-09', 'stage:2026-03'], 'newest first');
  assert.equal(m.first.title, 'B', 'the oldest wish starts the story');
  assert.equal(mapUrl('Tromsø, Norway'), 'https://www.google.com/maps/search/?api=1&query=Troms%C3%B8%2C%20Norway');
  const ui = read('js/shell/bucket-ui.js');
  assert.match(ui, /const TABS = \[\['list', '📝', 'My list'\], \['milestones', '🏆', 'Milestones'\], \['places', '🗺️', 'Places'\], \['insights', '💡', 'Insights'\]\];/);
  assert.doesNotMatch(ui, /\['todo', 'To do'\], \['done', 'Done'\], \['all', 'All'\]/, 'no To do / Done / All');
  assert.match(read('js/core/app.js'), /\$\('#bucketBottomNav'\)\.classList\.toggle\('hidden', mode !== 'bucket'\);/);
});

test('Home, Lifestyle, Vehicle, Asset and Finance are categories; every dream can say where it happened when ticked off', async () => {
  assert.deepEqual(['home', 'lifestyle', 'vehicle', 'asset', 'finance'].map((c) => catOf(c).id), ['home', 'lifestyle', 'vehicle', 'asset', 'finance']);
  const ui = read('js/shell/bucket-ui.js');
  assert.match(ui, /const where = el\('input'/);
  assert.match(ui, /_edit \? el\('button', \{ type: 'button', class: 'bk-edit'/, 'the profile pencil only in Edit');
  const { milestones } = await import('../../js/shell/bucket.js');
  const m = milestones([{ title: 'G', steps: [{ id: 'a', title: 'one', done: '2026-01' }, { id: 'b', title: 'two', done: '2026-05' }, { id: 'c', title: 'three', done: null }] }]);
  assert.deepEqual(m.years[0].events.map((e) => [e.step.title, e.doneBy, e.total]), [['two', 2, 3], ['one', 1, 3]], 'each stage carries the progress as it stood');
  assert.match(ui, /field\('📍 Where was it\?'/);
  assert.match(ui, /if \(where\) next = updateItem\(next, p\.id, i\.id, \{ place: where\.value\.trim\(\), placeType:/);
});

test('Insights: by category, the strongest and the untouched, momentum, and nudges', async () => {
  const { insights, CHEERS } = await import('../../js/shell/bucket.js');
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  l = addItem(l, p, { title: 'A', cat: 'travel', since: '2019-01', place: 'Oslo' });
  l = addItem(l, p, { title: 'B', cat: 'travel' });
  l = addItem(l, p, { title: 'C', cat: 'learn', since: '2015-03', by: 2026 });
  l = checkIn(l, p, l.profiles[0].items[0].id, 2026, 2, '');
  const s = insights(l.profiles[0].items, 2026);
  assert.equal(s.strongest.cat.id, 'travel'); assert.equal(s.strongest.done, 1);
  assert.equal(s.untouched.cat.id, 'learn');
  assert.deepEqual([s.thisYear, s.lastYear, s.best.year, s.places, s.kinds], [1, 0, 2026, 1, 2]);
  assert.equal(s.oldest.title, 'C'); assert.equal(s.nextUp.title, 'C');
  assert.ok(CHEERS.length >= 5);
  assert.match(read('js/shell/bucket-ui.js'), /\['insights', '💡', 'Insights'\]/);
});

test('Milestones is a real timeline: a centre line with alternating cards, year nodes, a year bar that glides, coming up and today', () => {
  const ui = read('js/shell/bucket-ui.js');
  assert.match(ui, /const left = side\+\+ % 2 === 0;/);
  assert.match(ui, /target\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(ui, /'📍 Today · '/);
  assert.match(ui, /prefers-reduced-motion: reduce/);
});

test('Places: the kind of place from its name, and every place visited by year and by kind', async () => {
  const { guessPlaceType, placesVisited } = await import('../../js/shell/bucket.js');
  assert.deepEqual(['Ooty', 'Chennai, Tamil Nadu', 'Leh, Ladakh', 'Puducherry', 'Port Blair', 'Munnar, Kerala', 'Jaipur', 'Tromsø, Norway', 'Paris', ''].map(guessPlaceType),
    ['tn', 'tn', 'ut', 'ut', 'ut', 'state', 'state', 'intl', 'intl', '']);
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  l = addItem(l, p, { title: 'Northern Lights', place: 'Tromsø, Norway' });
  l = addItem(l, p, { title: 'Ooty trip', place: 'Ooty' });
  l = addItem(l, p, { title: 'Ooty again', place: 'ooty' });
  l = addItem(l, p, { title: 'Leh ride', place: 'Leh', placeType: 'ut' });
  l = addItem(l, p, { title: 'Not yet', place: 'Goa' });
  const [a, b, c, d] = l.profiles[0].items;
  assert.equal(b.placeType, 'tn', 'set from the name when added');
  l = checkIn(l, p, a.id, 2026, 2, ''); l = checkIn(l, p, b.id, 2024, 5, ''); l = checkIn(l, p, c.id, 2025, 1, ''); l = checkIn(l, p, d.id, 2025, 7, '');
  const v = placesVisited(l.profiles[0].items);
  assert.equal(v.visits.length, 4, 'only dreams that came true');
  assert.equal(v.count, 3, 'Ooty twice counts once');
  assert.deepEqual(v.years.map((g) => [g.year, g.visits.length]), [[2024, 1], [2025, 2], [2026, 1]], 'oldest first, left to right');
  assert.deepEqual(v.byType.map((t) => [t.type.id, t.count]), [['intl', 1], ['tn', 1], ['state', 0], ['ut', 1]]);
  assert.match(read('js/shell/bucket-ui.js'), /\['places', '🗺️', 'Places'\]/);
});

test('Places can be added, changed and removed: a visit of its own, or the place on a dream', async () => {
  const { addVisit, updateVisit, removeVisit, placesVisited, updateProfile } = await import('../../js/shell/bucket.js');
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  l = addVisit(l, p, { place: 'Munnar, Kerala', year: 2022, month: 12, note: 'Honeymoon' });
  l = addVisit(l, p, { place: '  ' });
  let v = l.profiles[0].visits;
  assert.equal(v.length, 1, 'a blank place is not added');
  assert.deepEqual([v[0].place, v[0].placeType, v[0].ym, v[0].note], ['Munnar, Kerala', 'state', '2022-12', 'Honeymoon']);
  l = updateVisit(l, p, v[0].id, { place: 'Ooty', placeType: 'tn', year: 2023, month: 4 });
  v = l.profiles[0].visits;
  assert.deepEqual([v[0].place, v[0].placeType, v[0].ym, v[0].note], ['Ooty', 'tn', '2023-04', 'Honeymoon']);
  l = addItem(l, p, { title: 'Leh ride', place: 'Leh' });
  l = checkIn(l, p, l.profiles[0].items[0].id, 2025, 7, '');
  const all = placesVisited(l.profiles[0].items, l.profiles[0].visits);
  assert.deepEqual(all.visits.map((x) => [x.source, x.place, x.label]), [['dream', 'Leh', 'Leh ride'], ['visit', 'Ooty', 'Honeymoon']]);
  l = updateProfile(l, p, { name: 'Gopal' });
  assert.equal(l.profiles[0].visits.length, 1, 'renaming keeps the places');
  l = removeVisit(l, p, v[0].id);
  assert.equal(l.profiles[0].visits.length, 0);
  assert.match(read('js/shell/bucket-ui.js'), /'Remove ' \+ x\.place \+ ' from “' \+ x\.item\.title \+ '”\? The dream stays ticked off\.'/);
});

test('My list: To do / Checked tiles filter the list, and a search box sits next to Add', () => {
  const ui = read('js/shell/bucket-ui.js');
  assert.match(ui, /showTile\('todo', '📝', s\.todo, 'To do'\)/);
  assert.match(ui, /showTile\('done', '✓', s\.checked, 'Checked'\)/);
  assert.doesNotMatch(ui, /'done in ' \+ year|'planned for ' \+ year/);
  assert.match(ui, /class: 'bk-search'/);
  assert.match(ui, /_q = search\.value; drawList\(\);/);
});

test('Places: the state or country from the name, the trip details, and travel insights by year, state, landscape and stay', async () => {
  const { guessRegion, regionInfo, addVisit, updateVisit, placesVisited, travelInsights } = await import('../../js/shell/bucket.js');
  assert.deepEqual(['Kovalam', 'Pondichery', 'Hesaraghatta, Bengaluru', 'Coorgh', 'Andaman', 'Sri Lanka', 'Somewhere'].map((x) => (guessRegion(x) || {}).region),
    ['Kerala', 'Puducherry', 'Karnataka', 'Karnataka', 'Andaman & Nicobar', 'Sri Lanka', undefined]);
  assert.deepEqual(regionInfo('kerala'), { region: 'Kerala', type: 'state', country: 'India' });
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  l = addVisit(l, p, { place: 'Kovalam', year: 2022, month: 6, geo: ['beach', 'nope'], stay: 'Resort', days: 3 });
  l = addVisit(l, p, { place: 'Pondichery', year: 2022, month: 8, geo: ['beach'], stay: 'Room', days: 2 });
  l = addVisit(l, p, { place: 'Pondichery', year: 2023, month: 1, stay: 'resort' });
  l = addVisit(l, p, { place: 'Ella', year: 2026, month: 3, region: 'Sri Lanka', geo: ['hill', 'beach'], days: 6 });
  l = addVisit(l, p, { place: 'Hesaraghatta', year: 2024, month: 10, region: 'Karnataka', days: 0 });
  const vs = l.profiles[0].visits;
  assert.deepEqual(vs[0].geo, ['beach'], 'only known landscapes');
  assert.equal(vs[4].days, null, 'no days unless 1 or more');
  l = updateVisit(l, p, vs[4].id, { days: 2 });
  assert.equal(l.profiles[0].visits[4].days, 2);
  assert.equal(l.profiles[0].visits[4].region, 'Karnataka', 'a change keeps the other details');
  const v = placesVisited([], l.profiles[0].visits);
  assert.deepEqual(v.visits.map((x) => [x.place, x.region, x.country]).reverse(),
    [['Kovalam', 'Kerala', 'India'], ['Pondichery', 'Puducherry', 'India'], ['Pondichery', 'Puducherry', 'India'], ['Hesaraghatta', 'Karnataka', 'India'], ['Ella', 'Sri Lanka', 'Sri Lanka']]);
  const t = travelInsights(v);
  assert.deepEqual([t.trips, t.places, t.india, t.abroad, t.days, t.daysKnown], [5, 4, 3, 1, 13, 4]);
  assert.deepEqual(t.years.map((y) => [y.year, y.trips, y.days, y.fresh.join('+')]), [[2022, 2, 5, 'Kerala+Puducherry'], [2023, 1, 0, ''], [2024, 1, 2, 'Karnataka'], [2026, 1, 6, 'Sri Lanka']]);
  assert.deepEqual(t.regions.map((r) => [r.region, r.trips]), [['Puducherry', 2], ['Sri Lanka', 1], ['Kerala', 1], ['Karnataka', 1]]);
  assert.deepEqual(t.geo.map((g) => [g.id, g.trips]), [['beach', 3], ['hill', 1]]);
  assert.deepEqual(t.stays.map((x) => [x.label, x.trips]), [['Resort', 2], ['Room', 1]], 'stays grouped whatever the case');
  assert.deepEqual(t.repeats, [{ place: 'Pondichery', trips: 2 }]);
  assert.equal(t.longest.place, 'Ella');
  assert.match(read('js/shell/bucket-ui.js'), /field\('State \/ Union Territory \/ Country', reg\.el\)/);
  assert.match(read('js/shell/bucket-ui.js'), /'📅 Trips by year'/);
});

test('Stages count toward the overall %, a dream with a stage done is in Checked too; stays are tags, landscapes have names, months travelled', async () => {
  const { stats, tripDetails, addVisit, placesVisited, travelInsights, GEOS } = await import('../../js/shell/bucket.js');
  const items = [{ done: '2025-01', steps: [] }, { done: null, steps: [{ done: '2025-02' }, { done: null }] }, { done: null, steps: [] }, { done: null, steps: [] }];
  const s = stats(items, 2026);
  assert.equal(s.pct, 38, '1 done + half of one = 1.5 of 4');
  assert.deepEqual([s.done, s.checked, s.todo], [1, 2, 3]);
  const ui = read('js/shell/bucket-ui.js');
  assert.match(ui, /_show === 'done' \? !!i\.done \|\| progress\(i\)\.done > 0 : !i\.done/);
  assert.deepEqual(tripDetails({ stay: 'Room/Resort' }).stay, ['Room/Resort'], 'an older single stay becomes one tag');
  assert.deepEqual(tripDetails({ stay: ['Airbnb', 'airbnb', ' Hotel '] }).stay, ['Airbnb', 'Hotel']);
  assert.deepEqual(tripDetails({ geo: ['beach'], spots: { beach: ' Lighthouse beach ', hill: 'not picked' } }).spots, { beach: ['Lighthouse beach'] }, 'one name saved before is a list of one');
  assert.equal(GEOS.find((g) => g.id === 'waterfall').icon, '🌊');
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  [['Kovalam', 2022, 4], ['Yelagiri', 2023, 4], ['Andaman', 2023, 12], ['Madurai', 2025, 12], ['Wayanad', 2025, 4]].forEach(([place, year, month]) => { l = addVisit(l, p, { place, year, month }); });
  const t = travelInsights(placesVisited([], l.profiles[0].visits));
  assert.deepEqual(t.months.map((m) => [m.month, m.trips]), [[4, 3], [12, 2]]);
  assert.deepEqual(t.years.map((y) => y.places.join('>')), ['Kovalam', 'Yelagiri>Andaman', 'Wayanad>Madurai'], 'places in the order gone to');
  assert.match(ui, /: openPlaceView\(list, p, x\)\);/);
  assert.match(ui, /stayND\(x\) \? el\('small', \{ class: 'bk-pl-det', text: stayND\(x\) \}\) : null,/);
  assert.match(ui, /x\.rating \? el\('span', \{ class: 'bk-pl-stars'/);
});

test('Places: nights and days, both editable (days follow nights +1 until typed), shown as 3N 4D', async () => {
  const { nightsDays, nightsOf, tripDetails, travelInsights, placesVisited, addVisit } = await import('../../js/shell/bucket.js');
  assert.deepEqual([nightsDays(3, 4), nightsDays(0, 1), nightsDays(2, 2), nightsDays(0, 0), nightsDays(2, null)], ['3N 4D', 'Day trip', '2N 2D', '', '2N 3D']);
  assert.deepEqual([nightsOf({ days: 4 }), nightsOf({ days: 2, nights: 2 }), nightsOf({})], [3, 2, 0]);
  assert.deepEqual([tripDetails({ nights: '2' }).nights, tripDetails({ nights: '' }).nights, tripDetails({ nights: -1 }).nights], [2, null, null]);
  let l = addProfile(normalise(null), { name: 'Me' });
  l = addVisit(l, l.active, { place: 'Goa', year: 2025, month: 11, days: 4 });
  l = addVisit(l, l.active, { place: 'Ooty', year: 2025, month: 5, days: 2, nights: 2 });
  const it = travelInsights(placesVisited([], l.profiles[0].visits));
  assert.deepEqual([it.nights, it.days], [5, 6]);
  const ui = read('js/shell/bucket-ui.js');
  assert.match(ui, /field\('🌙 Nights', nights\), field\('☀️ Days', days\)/);
  assert.match(ui, /if \(dn == null && nn != null\) dn = nn \+ 1;/);
});

test('Places: the first landscape picked is the place icon, a temple in Tamil Nadu is a gopuram; Beach resort is a stay', async () => {
  const { STAYS, tripDetails } = await import('../../js/shell/bucket.js');
  assert.ok(STAYS.includes('Beach resort'));
  assert.deepEqual(tripDetails({ geo: ['hill', 'beach'] }).geo, ['hill', 'beach'], 'kept in the order picked');
  const ui = read('js/shell/bucket-ui.js');
  assert.match(ui, /const ids = \(\) => \[\.\.\.sel\];/);
  assert.match(ui, /if \(id === 'temple' && x && \(x\.type === 'tn' \|\| x\.region === 'Tamil Nadu'\)\)/);
  assert.match(ui, /el\('span', \{ class: 'bk-pl-pin' \}, \[placeIcon\(x\)\]\)/);
});

test('Places map: pins worked out on the phone - each place, by state and by country; the map opens from the top card', async () => {
  const { placeCoords, regionCentre, mapGroups } = await import('../../js/shell/bucket-geo.js');
  const { addVisit, placesVisited } = await import('../../js/shell/bucket.js');
  assert.deepEqual(placeCoords('Hesaraghatta, Bengaluru', 'Karnataka', 'India'), { at: [13.14, 77.48], exact: true }, 'the name mentioned first');
  assert.deepEqual(placeCoords('Some village', 'Kerala', 'India'), { at: regionCentre('Kerala'), exact: false }, 'else the state centre');
  assert.equal(placeCoords('Nowhere', '', ''), null);
  let l = addProfile(normalise(null), { name: 'Me' });
  [['Kovalam', 2022], ['Pondichery', 2022], ['Pondichery', 2023], ['Madurai', 2025], ['Ella', 2026], ['Our farm', 2024]].forEach(([place, year]) => { l = addVisit(l, l.active, { place, year, month: 5 }); });
  const g = mapGroups(placesVisited([], l.profiles[0].visits).visits);
  assert.deepEqual(g.countries.map((c) => [c.name, c.places.length]).sort(), [['India', 3], ['Sri Lanka', 1]]);
  assert.deepEqual(g.regions.map((r) => r.name).sort(), ['Kerala', 'Puducherry', 'Sri Lanka', 'Tamil Nadu']);
  assert.equal(g.places.find((p) => p.name === 'Pondichery').trips.length, 2);
  assert.deepEqual(g.unpinned.map((p) => p.name), ['Our farm']);
  assert.deepEqual(g.countries.find((c) => c.name === 'India').at, regionCentre('India'));
  const ui = read('js/shell/bucket-ui.js'), map = read('js/shell/bucket-map.js');
  assert.match(ui, /import\('\.\/bucket-map\.js'\)\.then\(\(m\) => m\.openPlacesMap\(\{ v, toVisit: placesToVisit\(p\.items, p\.wishes\), photos: _photos, goals: p\.goals/);
  for (const b of ['World_Street_Map', 'World_Imagery', 'World_Physical_Map', "id: 'chart'"]) assert.ok(map.includes(b), 'base map ' + b);
  assert.match(map, /world-atlas@2\.0\.2\/countries-110m\.json/);
  assert.match(map, /india-maps-data@2884453\/topojson\/india\.json/, 'India with its 36 states and UTs');
  assert.doesNotMatch(map, /import\(['"]https?:|eval\(|new Function/, 'the outlines are read as data, never run');
  assert.doesNotMatch(read('js/shell/bucket-geo.js'), /fetch\(|XMLHttpRequest/, 'nothing about a place is looked up online');
  assert.match(read('js/main.js'), /When you open the Places map, the map library \(Leaflet\)/);
});

test('Places: days fewer than nights are allowed; each place has stars and a best memory; top places are ranked', async () => {
  const { tripDetails, rankPlaces, addVisit, placesVisited, travelInsights } = await import('../../js/shell/bucket.js');
  const ui = read('js/shell/bucket-ui.js');
  assert.doesNotMatch(ui, /Days can not be fewer than nights/);
  assert.deepEqual([tripDetails({ rating: 4 }).rating, tripDetails({ rating: 9 }).rating, tripDetails({}).rating], [4, null, null]);
  assert.equal(tripDetails({ memory: '  Sunrise  ' }).memory, 'Sunrise');
  let l = addProfile(normalise(null), { name: 'Me' });
  [['Goa', 2023, 4, 'Old memory'], ['Goa', 2025, 5, 'Beach shack'], ['Ooty', 2024, 5, ''], ['Madurai', 2025, null, 'Temple'], ['Coorg', 2024, 3, '']].forEach(([place, year, rating, memory]) => { l = addVisit(l, l.active, { place, year, month: 3, rating, memory }); });
  const r = rankPlaces(placesVisited([], l.profiles[0].visits).visits);
  assert.deepEqual(r.map((x) => [x.place, x.rating, x.trips, x.memory]), [['Ooty', 5, 1, ''], ['Goa', 4.5, 2, 'Beach shack'], ['Coorg', 3, 1, '']], 'unrated places are left out; the latest memory');
  assert.equal(travelInsights(placesVisited([], l.profiles[0].visits)).ranked.length, 3);
  assert.match(ui, /field\('⭐ How was it\?', stars\.el\),\n    field\('💭 Best memory', memory\),/);
  assert.match(ui, /'🏆 My places ranking'/);
});

test('Places map: countries, Indian states (UTs apart) and places, visited or to visit; routes only where the trip says where it started', async () => {
  const { travelGroups, routeOf, curve, topoFeatures, shapeCentre, shapeSilhouette, stateShapeName, countryMatch } = await import('../../js/shell/bucket-geo.js');
  const { addVisit, addItem, checkIn, placesVisited, placesToVisit, tripDetails } = await import('../../js/shell/bucket.js');
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  [['Kovalam', 2022], ['Munnar', 2023], ['Madurai', 2024], ['Chandigarh', 2024], ['Zurich', 2025], ['Our farm', 2025]].forEach(([place, year]) => { l = addVisit(l, p, { place, year, month: 4, from: place === 'Zurich' ? 'Mumbai' : '', mode: 'flight' }); });
  l = addItem(l, p, { title: 'Ride to Leh', cat: 'travel', place: 'Leh', by: 2027 });
  l = addItem(l, p, { title: 'Northern Lights', cat: 'travel', place: 'Tromsø, Norway' });
  l = addItem(l, p, { title: 'Learn guitar', cat: 'learn' });
  l = addItem(l, p, { title: 'Ooty trip', cat: 'travel', place: 'Ooty' });
  l = checkIn(l, p, l.profiles[0].items[3].id, 2025, 5, '');
  const tv = placesToVisit(l.profiles[0].items);
  assert.deepEqual(tv.map((x) => [x.place, x.region, x.country]), [['Leh', 'Ladakh', 'India'], ['Tromsø, Norway', 'Norway', 'Norway']], 'not done, with a place; the soonest first');
  const vs = placesVisited(l.profiles[0].items, l.profiles[0].visits).visits;
  const g = travelGroups(vs, tv);
  assert.deepEqual(g.states.map((x) => [x.name, x.places.length, x.ut]), [['Kerala', 2, false], ['Tamil Nadu', 2, false], ['Chandigarh', 1, true], ['Ladakh', 0, true]]);
  assert.deepEqual(g.countries.map((x) => [x.name, x.places.length, x.wantPlaces.length]), [['India', 5, 1], ['Switzerland', 1, 0], ['Norway', 0, 1]]);
  assert.equal(g.places.find((x) => x.name === 'Our farm').at, null, 'a place with no state or country is not pinned');
  assert.equal(stateShapeName('Andaman & Nicobar'), 'Andaman and Nicobar Islands');
  assert.ok(countryMatch('USA', { id: '840', properties: { name: 'United States of America' } }) && countryMatch('Peru', { id: '604', properties: { name: 'Peru' } }));
  // Routes: only for a trip that says where it started.
  const zurich = vs.find((x) => x.place === 'Zurich'), kovalam = vs.find((x) => x.place === 'Kovalam');
  assert.deepEqual(routeOf(zurich), { from: [19.08, 72.88], to: [47.38, 8.54], fromName: 'Mumbai', mode: 'flight' });
  assert.equal(routeOf(kovalam), null, 'no Travelled from, no route');
  assert.equal(routeOf(Object.assign({}, kovalam, { from: 'Chennai' })).fromName, 'Chennai');
  assert.equal(curve([0, 0], [0, 10], 4).length, 5);
  assert.deepEqual([tripDetails({ from: ' Madurai ', mode: 'train' }).from, tripDetails({ mode: 'rocket' }).mode], ['Madurai', '']);
  // TopoJSON read as data: a square from two arcs, its middle and its silhouette.
  const topo = { transform: { scale: [1, 1], translate: [0, 0] }, objects: { a: { geometries: [{ type: 'Polygon', arcs: [[0, 1]], id: 'x', properties: {} }] } }, arcs: [[[0, 0], [10, 0], [0, 10]], [[10, 10], [-10, 0], [0, -10]]] };
  const sq = topoFeatures(topo, 'a')[0].geometry;
  assert.deepEqual(sq.coordinates, [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]);
  assert.deepEqual(shapeCentre(sq), [5, 5]);
  assert.match(shapeSilhouette(sq, 20), /^M1\.0 19\.0L/);
  const ui = read('js/shell/bucket-ui.js');
  assert.match(ui, /renderToVisit\(host, list, p\);/);
  assert.match(ui, /field\('🧭 Travelled from', from\),\n    field\('Travelled by', mode\.el\),\n    field\('📷 Photo', photo\.el\),/);
  assert.match(ui, /const PHOTO_KEY = 'bucketPhotos';/);
});

test('Places: who with - six choices with their own icons on the journey card; With family is no longer a stay', async () => {
  const { COMPANIONS, STAYS, tripDetails, addVisit, placesVisited, travelInsights } = await import('../../js/shell/bucket.js');
  assert.deepEqual(COMPANIONS.map((x) => x.id), ['her', 'solo', 'family', 'baby', 'friends', 'work']);
  assert.ok(!STAYS.includes('With family'));
  assert.deepEqual([tripDetails({ with: 'her' }).with, tripDetails({ with: 'boss' }).with], ['her', '']);
  let l = addProfile(normalise(null), { name: 'Me' });
  [['Goa', 'her', 3], ['Ooty', 'her', 2], ['Leh', 'solo', 6], ['Kochi', 'work', 2]].forEach(([place, w, days]) => { l = addVisit(l, l.active, { place, year: 2025, month: 3, with: w, days }); });
  assert.deepEqual(travelInsights(placesVisited([], l.profiles[0].visits)).company.map((x) => [x.id, x.trips, x.days]), [['her', 2, 5], ['solo', 1, 6], ['work', 1, 2]]);
  const ui = read('js/shell/bucket-ui.js');
  for (const id of ['her', 'solo', 'family', 'baby', 'friends', 'work']) assert.match(ui, new RegExp('\\n  ' + id + ": '<"), id + ' has its own icon');
  assert.match(ui, /x\.with \? withIcon\(x\.with, 'bk-pl-with'\) : null,/);
  assert.match(ui, /field\('👥 Who with\?', company\.el\)/);
});

test('Places to visit: their own list beside the dreams with a place, folding away; Been there turns one into a visit; the gopuram is for temples in Tamil Nadu', async () => {
  const { addWish, updateWish, removeWish, addItem, placesToVisit, addVisit, updateProfile } = await import('../../js/shell/bucket.js');
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  l = addWish(l, p, { place: 'Munnar', by: 2027, note: 'Tea gardens' });
  l = addWish(l, p, { place: '  ' });
  l = addItem(l, p, { title: 'See Ladakh', cat: 'travel', place: 'Leh', by: 2026 });
  const w = l.profiles[0].wishes;
  assert.equal(w.length, 1, 'a blank place is not added');
  assert.deepEqual([w[0].place, w[0].placeType, w[0].by, w[0].note], ['Munnar', 'state', 2027, 'Tea gardens']);
  assert.equal(l.profiles[0].items.length, 1, 'adding a place to visit does not add a dream');
  let tv = placesToVisit(l.profiles[0].items, l.profiles[0].wishes);
  assert.deepEqual(tv.map((x) => [x.place, x.source, x.title, x.region]), [['Leh', 'dream', 'See Ladakh', 'Ladakh'], ['Munnar', 'wish', 'Tea gardens', 'Kerala']]);
  l = updateWish(l, p, w[0].id, { by: null });
  assert.equal(l.profiles[0].wishes[0].by, null);
  l = updateProfile(l, p, { name: 'Gopal' });
  assert.equal(l.profiles[0].wishes.length, 1, 'renaming keeps them');
  l = removeWish(addVisit(l, p, { place: 'Munnar', year: 2026, month: 1 }), p, w[0].id);
  assert.equal(l.profiles[0].wishes.length, 0);
  const ui = read('js/shell/bucket-ui.js'), map = read('js/shell/bucket-map.js');
  assert.doesNotMatch(ui, /For which dream\?|openHomeForm|bk-home-chip/);
  assert.match(ui, /localStorage\.getItem\('bkTvOpen'\) === '1'/);
  assert.match(ui, /if \(pre && pre\.wishId\) next = removeWish\(next, p\.id, pre\.wishId\);/);
  assert.match(ui, /if \(id === 'temple' && x && \(x\.type === 'tn' \|\| x\.region === 'Tamil Nadu'\)\) return gopuramEl/);
  assert.match(map, /if \(x\.geo\[0\] === 'temple' && \(x\.type === 'tn' \|\| x\.region === 'Tamil Nadu'\)\) return/);
  assert.doesNotMatch(ui + map, /'heritage' && x && \(x\.type === 'tn'|geo\[0\] === 'heritage'/, 'heritage keeps its castle');
});

test('Places: the journey has year badges in place of a scrollbar; My places ranking can be dragged and its rank shows on the cards', async () => {
  const { placeRanking, addVisit, placesVisited, updateProfile } = await import('../../js/shell/bucket.js');
  let l = addProfile(normalise(null), { name: 'Me' });
  const p = l.active;
  [['Goa', 2023, 4], ['Goa', 2025, 5], ['Ooty', 2024, 5], ['Madurai', 2025, null], ['Coorg', 2024, 3]].forEach(([place, year, rating]) => { l = addVisit(l, p, { place, year, month: 3, rating }); });
  const vs = placesVisited([], l.profiles[0].visits).visits;
  assert.deepEqual(placeRanking(vs, []).map((r) => r.place + ':' + r.rank), ['Ooty:1', 'Goa:2', 'Coorg:3', 'Madurai:4'], 'not placed yet: best rated first');
  assert.deepEqual(placeRanking(vs, ['madurai', 'coorg']).map((r) => r.place), ['Madurai', 'Coorg', 'Ooty', 'Goa'], 'the order dragged first');
  l = updateProfile(l, p, { placeRank: ['Madurai', 'madurai', ' Coorg '] });
  assert.deepEqual(normalise(l).profiles[0].placeRank, ['madurai', 'coorg'], 'kept clean when read');
  const ui = read('js/shell/bucket-ui.js');
  assert.match(ui, /track\.scrollTo\(\{ left: Math\.max\(0, col\.offsetLeft - \(track\.clientWidth - col\.offsetWidth\) \/ 2\), behavior: 'smooth' \}\)/);
  assert.match(ui, /track\.addEventListener\('scroll', lightYear, \{ passive: true \}\);/);
  assert.match(ui, /renderToVisit\(host, list, p\);\n  renderRanking\(host, list, p, ranking, track\);\n  renderTravelInsights\(host, v\);/, 'places to visit and the ranking below the journey');
  assert.match(ui, /rankBadge\(x\.place\.trim\(\)\.toLowerCase\(\)\),/);
  assert.match(read('styles.css'), /\.bk-pl-track::-webkit-scrollbar \{ display: none; \}/);
});

test('Places map: a route only for the place picked, no vehicle on the map; the panel shows start, the way travelled and the end; no routes switch', () => {
  const map = read('js/shell/bucket-map.js');
  assert.doesNotMatch(map, /Show routes|bkMapRoutes|bkx-mode/, 'no all-routes switch, no vehicle on the map');
  assert.match(map, /const p = key && key\.startsWith\('p:'\) \? D\.g\.places\.find\(\(x\) => x\.key === key\) : null;/);
  assert.match(map, /routesOf\(st\.sel\)\.forEach/);
  assert.match(map, /el\('span', \{ class: 'bkx-way-by' \}, \[x\.mode \? modeOf\(x\.mode\)\.icon \+ ' ' \+ modeOf\(x\.mode\)\.label : '→'\]\)/);
});

test('Places map: never upright - turned sideways whenever the screen is taller than wide', () => {
  const map = read('js/shell/bucket-map.js');
  assert.match(map, /rotated = window\.innerHeight > window\.innerWidth;/);
  assert.match(map, /await screen\.orientation\.lock\('landscape'\)/);
});

test('Travelled by includes Cab', async () => {
  const { MODES, tripDetails } = await import('../../js/shell/bucket.js');
  assert.deepEqual(MODES.map((m) => m.id), ['flight', 'train', 'car', 'cab', 'bus', 'bike', 'ship']);
  assert.equal(tripDetails({ mode: 'cab' }).mode, 'cab');
});

test('Journey cards show the best memory, not when or what it was', () => {
  const ui = read('js/shell/bucket-ui.js');
  assert.ok(ui.includes("x.memory ? el('small', { class: 'bk-pl-mem', text: '“' + x.memory + '”' }) : null,"));
  assert.ok(!ui.includes("MONS[Number(x.ym.slice(5, 7)) - 1] + ' · ' + x.label"));
});

test('Ranking folds away; only the top three show on the journey; the map shows each rank on its places when zoomed in', () => {
  const ui = read('js/shell/bucket-ui.js'), map = read('js/shell/bucket-map.js');
  assert.ok(ui.includes("localStorage.getItem('bkRkOpen') === '1'"));
  assert.ok(ui.includes("class: 'bk-pl-rank' + (n <= 3 ? ' is-' + n : ' is-off')"));
  assert.ok(ui.includes('ranks: Object.fromEntries(placeRanking(v.visits, p.placeRank).map((r) => [r.key, r.rank])),'));
  assert.ok(map.includes('const RANK_ZOOM = 6;'));
  assert.ok(map.includes('if (visited && n && close) {'));
  assert.ok(map.includes('<i class=\"bkx-pin-r'));
});

test('Places: several names for one landscape; adventures tried as badges; cups for the top three on the journey', async () => {
  const { tripDetails, ADVENTURES, travelInsights, placesVisited, addVisit } = await import('../../js/shell/bucket.js');
  assert.deepEqual(tripDetails({ geo: ['temple'], spots: { temple: ['Meenakshi', ' ', 'Alagar Kovil', 'Thiruparankundram'] } }).spots, { temple: ['Meenakshi', 'Alagar Kovil', 'Thiruparankundram'] });
  for (const id of ['scuba', 'snorkel', 'parasail', 'jeep', 'kayak', 'boat', 'trek', 'climb', 'sail']) assert.ok(ADVENTURES.some((a) => a.id === id), id);
  assert.equal(new Set(ADVENTURES.map((a) => a.icon)).size, ADVENTURES.length, 'each adventure its own icon');
  assert.deepEqual(tripDetails({ adv: ['scuba', 'nope', 'scuba', 'trek'] }).adv, ['scuba', 'trek']);
  let l = addProfile(normalise(null), { name: 'Me' });
  l = addVisit(l, l.active, { place: 'Andaman', year: 2023, month: 12, adv: ['scuba', 'snorkel'] });
  l = addVisit(l, l.active, { place: 'Goa', year: 2025, month: 11, adv: ['parasail', 'scuba'] });
  assert.deepEqual(travelInsights(placesVisited([], l.profiles[0].visits)).adventures.map((a) => [a.id, a.trips]), [['scuba', 2], ['snorkel', 1], ['parasail', 1]]);
  const ui = read('js/shell/bucket-ui.js');
  assert.ok(ui.includes("b.innerHTML = n <= 3 ? cupSvg(n) : '';"), 'a cup, not a number');
  assert.ok(ui.includes("field('🧗 Adventures tried', adv.el)"));
  assert.ok(ui.includes("'aria-label': 'Add another ' + noun, text: '+'"));
});
