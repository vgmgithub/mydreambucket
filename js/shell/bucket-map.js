// bucket-map.js — "Where I have been": the Places map (My Bucket List > Places, the 🗺️ on the top card). Full screen
// and landscape (a phone held upright is turned sideways, or the view is turned for it).
//   Top bar  - World / India / Cities, search, Visited / To visit / All and a year, full screen.
//   Map      - a real map (Standard, Satellite, Terrain, or a plain Chart): the countries and Indian states visited
//              filled green (darker = more places), places still to visit outlined orange, a count or the latest
//              photo on each, orange dots for the places; a place picked shows its own route (from where its trip
//              started) - the line on the map, the start, the way travelled and the end in the panel.
//   Panel    - My travel story, the states / UTs / countries / places with their own shapes, travel goals, and
//              whatever is tapped: its places, trips, photos and memories.
//   Recent trips - the latest trips as photo cards.
// Everything is worked out on this phone (bucket-geo.js). Only the map library, the outlines of the world's countries
// and of India's states (read as data, never run) and the map pictures are loaded, when the map is opened (see the
// Privacy Policy, "Places map"). Photos never leave the phone.
import { el, openModal, closeModal } from '../core/app.js';
import { geoOf, placeTypeOf, travelInsights, nightsOf, nightsDays, companionOf, modeOf, adventureOf } from './bucket.js';
import { travelGroups, topoFeatures, shapeCentre, shapeSilhouette, countryMatch, routeOf, curve, placeCoords, regionCentre, INDIA_AREAS, WORLD_COUNTRIES } from './bucket-geo.js';
import { GOPURAM, starsText, withIcon } from './bucket-ui.js';

const CDN = 'https://cdn.jsdelivr.net/';
const LEAFLET = CDN + 'npm/leaflet@1.9.4/dist/';
const WORLD = CDN + 'npm/world-atlas@2.0.2/countries-110m.json';
const INDIA = CDN + 'gh/udit-001/india-maps-data@2884453/topojson/india.json';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const tiles = (name) => ESRI + name + '/MapServer/tile/{z}/{y}/{x}';
// The base maps: [service, deepest zoom it has, first zoom it is shown at].
const BASES = [
  { id: 'standard', label: 'Standard', thumb: 'World_Street_Map', layers: [['World_Street_Map', 19]], attr: 'Map &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors' },
  { id: 'satellite', label: 'Satellite', thumb: 'World_Imagery', layers: [['World_Imagery', 19]], attr: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' },
  { id: 'terrain', label: 'Terrain', thumb: 'World_Physical_Map', layers: [['World_Physical_Map', 8], ['World_Terrain_Base', 13, 9]], attr: 'Map &copy; Esri, USGS, NOAA' },
  { id: 'chart', label: 'Chart', thumb: '', layers: [], attr: '' },
];
const INDIA_BOUNDS = [[6.4, 68], [37.3, 97.5]];
// From this zoom in, each place visited shows as a node with its rank (My places ranking).
const RANK_ZOOM = 6;
const rankNode = (n) => '<div class="bkx-node' + (n <= 3 ? ' r' + n : '') + '"><b>' + n + '</b></div>';
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Green by places visited: 1, 2, 3-4, 5-7, 8 or more.
const GREENS = ['#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d'];
const fillOf = (n) => GREENS[n >= 8 ? 4 : n >= 5 ? 3 : n >= 3 ? 2 : n >= 2 ? 1 : 0];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const ymText = (ym) => MONS[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch (_) { return d; } };
const setPref = (k, val) => { try { localStorage.setItem(k, val); } catch (_) {} };
const NS = 'http://www.w3.org/2000/svg';

let _leaflet = null;
function loadLeaflet() {
  if (window.L && window.L.map) return Promise.resolve(window.L);
  if (_leaflet) return _leaflet;
  _leaflet = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = LEAFLET + 'leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = LEAFLET + 'leaflet.js';
    s.onload = () => resolve(window.L);
    s.onerror = () => { _leaflet = null; s.remove(); reject(new Error('map library')); };
    document.head.appendChild(s);
  });
  return _leaflet;
}
// The outlines, as data (fetched and parsed - never run), kept for the next time the map is opened.
const _topo = {};
function loadShapes(url, object) {
  if (!_topo[url]) _topo[url] = fetch(url).then((r) => { if (!r.ok) throw new Error('shapes'); return r.json(); }).then((t) => topoFeatures(t, object)).catch((e) => { delete _topo[url]; throw e; });
  return _topo[url];
}

// A trip's (or a place's) icon: its first landscape, the gopuram for heritage in Tamil Nadu, else its kind of place.
const iconHtml = (x) => {
  if (!x || !x.geo || !x.geo.length) return esc((placeTypeOf(x && x.type) || { icon: '📍' }).icon);
  if (x.geo[0] === 'temple' && (x.type === 'tn' || x.region === 'Tamil Nadu')) return '<span class="bk-gopuram">' + GOPURAM + '</span>';
  return esc(geoOf(x.geo[0]).icon);
};
const iconEl = (x) => { const s = el('span', { class: 'bkx-ico' }); s.innerHTML = iconHtml(x); return s; };
// A small silhouette of a state or country, drawn from its own outline.
function silhouette(geometry, color, size) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size); svg.setAttribute('class', 'bkx-sil'); svg.setAttribute('aria-hidden', 'true');
  if (geometry) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', shapeSilhouette(geometry, size)); p.setAttribute('fill', color); svg.appendChild(p); }
  return svg;
}
// Trips, nights and days, and the years, for a group of trips.
function sumUp(trips) {
  const withStay = trips.filter((x) => x.days || x.nights != null);
  const nights = withStay.reduce((n, x) => n + nightsOf(x), 0), days = withStay.reduce((n, x) => n + (x.days || nightsOf(x) + 1), 0);
  const years = trips.map((x) => Number(x.ym.slice(0, 4))).sort((a, b) => a - b);
  return { trips: trips.length, nights, days, stay: withStay.length ? nightsDays(nights, days) : '', from: years[0], to: years[years.length - 1] };
}

export async function openPlacesMap({ v, toVisit, photos, goals, onGoal, ranks }) {
  const rankOf = (p) => (ranks || {})[p.key.slice(2)] || 0;
  const want = toVisit || [];
  const pics = photos || {};
  const all = v.visits.slice().sort((a, b) => b.ym.localeCompare(a.ym));   // newest first
  const years = [...new Set(all.map((x) => Number(x.ym.slice(0, 4))))].sort((a, b) => b - a);
  const st = {
    view: 'world', show: pref('bkMapShow', 'visited'), year: 0, base: pref('bkMapBase', 'standard'),
    tab: all.some((x) => x.country === 'India') ? 'states' : 'countries', sel: null,
  };
  if (!BASES.some((b) => b.id === st.base)) st.base = 'standard';
  let goal = (goals && goals.countries) || 10;
  let world = [], india = [], lmap = null, L = null, layers = {}, rotated = false, sized = null;

  // ---- What is shown: the trips of the year picked; places to visit when asked for ----
  let D = null;
  const compute = () => {
    const visits = st.show === 'want' ? [] : all.filter((x) => !st.year || Number(x.ym.slice(0, 4)) === st.year);
    const wants = st.show === 'visited' ? [] : want;
    const g = travelGroups(visits, wants);
    const story = all.filter((x) => !st.year || Number(x.ym.slice(0, 4)) === st.year);
    const t = travelInsights({ visits: story, count: new Set(story.map((x) => x.place.trim().toLowerCase())).size });
    D = { visits, wants, g, t, story };
  };
  const photoOf = (trips) => { const x = trips.slice().sort((a, b) => b.ym.localeCompare(a.ym)).find((tr) => pics[tr.id]); return x ? pics[x.id] : ''; };
  const featureOfCountry = (name) => (name === 'India' ? null : world.find((f) => countryMatch(name, f)));
  const featuresOfState = (name) => india.filter((f) => f.properties.st_nm === name);
  const indiaShape = () => (india.length ? { type: 'MultiPolygon', coordinates: india.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)) } : null);
  const shapeOf = (sel) => {
    if (!sel) return null;
    if (sel.startsWith('c:')) { const g = D.g.countries.find((c) => c.key === sel); if (!g) return null; if (g.name === 'India') return indiaShape(); const f = featureOfCountry(g.name); return f ? f.geometry : null; }
    if (sel.startsWith('s:')) { const g = D.g.states.find((s) => s.key === sel); const fs = g ? featuresOfState(g.shape) : []; return fs.length ? fs[0].geometry : null; }
    return null;
  };

  // ---- The frame ----
  const top = el('div', { class: 'bkx-top' });
  const mapBox = el('div', { class: 'bkx-map' });
  const mapWrap = el('div', { class: 'bkx-mapwrap' }, [mapBox]);
  const recentBox = el('div', { class: 'bkx-recent' });
  const left = el('div', { class: 'bkx-left' }, [mapWrap, recentBox]);
  const panel = el('div', { class: 'bkx-panel' });
  const root = el('div', { class: 'bkx' }, [top, el('div', { class: 'bkx-body' }, [left, panel])]);
  const shortScreen = () => (rotated ? window.innerWidth : window.innerHeight) < 620;

  // ---- Top bar ----
  const flag = () => { const s = el('span', { class: 'bkx-flag' }); s.innerHTML = '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" rx="2" fill="#fff"/><rect width="30" height="6.7" rx="2" fill="#ff9933"/><rect y="13.3" width="30" height="6.7" rx="2" fill="#138808"/><circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width=".9"/></svg>'; return s; };
  const search = el('input', { type: 'search', class: 'bkx-search-in', placeholder: 'Search country, state or place…', 'aria-label': 'Search country, state or place' });
  const results = el('div', { class: 'bkx-results hidden' });
  const menu = el('div', { class: 'bkx-menu hidden' });
  const drawTop = () => {
    top.innerHTML = '';
    const seg = el('div', { class: 'bkx-seg' }, [['world', '🌍', 'World'], ['india', flag(), 'India'], ['cities', '📍', 'Cities']].map(([id, ico, label]) =>
      el('button', { type: 'button', class: st.view === id ? 'on' : '', onclick: () => setView(id) }, [typeof ico === 'string' ? el('span', { text: ico }) : ico, el('span', { class: 'bkx-seg-t', text: label })])));
    const showDot = { visited: '#22c55e', want: '#f97316', all: '#0ea5e9' }[st.show];
    const showLabel = { visited: 'Visited', want: 'To visit', all: 'All' }[st.show] + (st.year ? ' · ' + st.year : '');
    top.append(
      el('div', { class: 'bkx-brand' }, [el('span', { class: 'bkx-globe', text: '🌍' }), el('div', {}, [el('b', { text: 'Where I have been' }), el('small', { text: 'Exploring places, collecting memories' })])]),
      seg,
      el('div', { class: 'bkx-search' }, [el('span', { class: 'bkx-search-i', text: '🔍' }), search, results]),
      el('div', { class: 'bkx-filter' }, [el('button', { type: 'button', class: 'bkx-filter-btn', 'aria-haspopup': 'true', onclick: (e) => { e.stopPropagation(); drawMenu(); menu.classList.toggle('hidden'); } }, [el('i', { style: 'background:' + showDot }), el('span', { text: showLabel }), el('span', { class: 'bkx-caret', text: '▾' })]), menu]),
      el('button', { type: 'button', class: 'bkx-icon', title: document.fullscreenElement ? 'Leave full screen' : 'Full screen', 'aria-label': 'Full screen', text: document.fullscreenElement ? '🗗' : '⛶', onclick: toggleFull }),
      el('button', { type: 'button', class: 'bkx-icon bkx-x', 'aria-label': 'Close the map', text: '✕', onclick: () => { cleanup(); closeModal(); } }),
    );
  };
  const drawMenu = () => {
    menu.innerHTML = '';
    const opt = (on, label, dot, act) => el('button', { type: 'button', class: on ? 'on' : '', onclick: () => { act(); menu.classList.add('hidden'); } }, [dot ? el('i', { style: 'background:' + dot }) : el('i', { class: 'bkx-blank' }), label, on ? el('b', { text: '✓' }) : null].filter(Boolean));
    menu.append(el('small', { text: 'Show' }),
      opt(st.show === 'visited', 'Visited', '#22c55e', () => setShow('visited')),
      opt(st.show === 'want', 'To visit' + (want.length ? ' (' + want.length + ')' : ''), '#f97316', () => setShow('want')),
      opt(st.show === 'all', 'All', '#0ea5e9', () => setShow('all')),
      el('small', { text: 'Year' }),
      opt(!st.year, 'All years', '', () => setYear(0)),
      ...years.map((y) => opt(st.year === y, String(y), '', () => setYear(y))));
  };
  const setShow = (s) => { st.show = s; setPref('bkMapShow', s); st.sel = null; refresh(); };
  const setYear = (y) => { st.year = y; st.sel = null; refresh(); };
  // Search: countries, states and places, visited or to visit.
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    results.innerHTML = '';
    if (!q) { results.classList.add('hidden'); return; }
    const g = travelGroups(all, want);
    const hits = [].concat(
      g.countries.filter((c) => c.name.toLowerCase().includes(q)).map((c) => ['🌍', c.name, 'Country', c.key]),
      g.states.filter((s) => s.name.toLowerCase().includes(q)).map((s) => [s.ut ? '🏝️' : '🗺️', s.name, s.ut ? 'Union Territory' : 'State', s.key]),
      g.places.filter((p) => p.name.toLowerCase().includes(q)).map((p) => [p.visits.length ? '📍' : '🎯', p.name, [p.region, p.visits.length ? plural(p.visits.length, 'trip', 'trips') : 'to visit'].filter(Boolean).join(' · '), p.key]),
    ).slice(0, 8);
    results.append(...(hits.length ? hits.map(([i, n, k, key]) => el('button', { type: 'button', onclick: () => {
      search.value = ''; results.classList.add('hidden');
      if (st.show !== 'all' && !D.g.places.concat(D.g.states, D.g.countries).some((x) => x.key === key)) { st.show = 'all'; st.year = 0; refresh(); }
      select(key, true);
    } }, [el('span', { text: i }), el('b', { text: n }), el('small', { text: k })])) : [el('p', { text: 'Nothing matches' })]));
    results.classList.remove('hidden');
  });
  root.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) menu.classList.add('hidden');
    if (!results.contains(e.target) && e.target !== search) results.classList.add('hidden');
  });

  // ---- The map ----
  // Close in (zoom 6 and more), the fills go light so the map under them can be read.
  const fade = () => (lmap && lmap.getZoom() >= 6 && st.base !== 'chart' ? 0.35 : 1);
  const styleCountry = (f) => {
    const g = D.g.countries.find((c) => countryMatch(c.name, f));
    const n = g ? g.places.length : 0, w = g && !n && g.wantPlaces.length, chart = st.base === 'chart', sel = g && st.sel === g.key;
    return {
      fillColor: n ? fillOf(n) : chart ? '#e2e8f0' : '#ffffff', fillOpacity: n ? (chart ? 0.95 : 0.7 * fade()) : chart ? 1 : 0,
      color: sel ? '#0f172a' : w ? '#f97316' : chart ? '#ffffff' : '#475569', weight: sel ? 2.4 : w ? 2 : chart ? 0.7 : 0.4,
      opacity: sel || w || chart ? 1 : 0.3, dashArray: w && !sel ? '5 4' : null,
    };
  };
  const styleState = (f) => {
    const chart = st.base === 'chart';
    if (st.view === 'world') {
      const g = D.g.countries.find((c) => c.name === 'India');
      const n = g ? g.places.length : 0, w = g && !n && g.wantPlaces.length, sel = g && st.sel === g.key;
      return { fillColor: n ? fillOf(n) : chart ? '#e2e8f0' : '#fff', fillOpacity: n ? (chart ? 0.95 : 0.7 * fade()) : chart ? 1 : 0, color: sel ? '#0f172a' : w ? '#f97316' : n ? fillOf(n) : '#475569', weight: sel ? 1.6 : w ? 1.5 : n ? 0.3 : 0.3, opacity: sel || w ? 1 : n ? 1 : 0.25, dashArray: w && !sel ? '5 4' : null };
    }
    const g = D.g.states.find((s) => s.shape === f.properties.st_nm);
    const n = g ? g.places.length : 0, w = g && !n && g.wantPlaces.length, sel = g && st.sel === g.key;
    return { fillColor: n ? fillOf(n) : chart ? '#e2e8f0' : '#fff', fillOpacity: n ? (chart ? 0.95 : 0.72 * fade()) : chart ? 1 : 0.05, color: sel ? '#0f172a' : w ? '#f97316' : chart ? '#fff' : '#334155', weight: sel ? 2.6 : w ? 2 : 0.8, opacity: sel || w || chart ? 1 : 0.45, dashArray: w && !sel ? '5 4' : null };
  };
  const setBase = (id) => {
    st.base = id; setPref('bkMapBase', id);
    (layers.base || []).forEach((l) => lmap.removeLayer(l));
    const b = BASES.find((x) => x.id === id);
    layers.base = b.layers.map(([name, deepest, first]) => L.tileLayer(tiles(name), { maxNativeZoom: deepest, maxZoom: 18, minZoom: first || 0, attribution: b.attr }).addTo(lmap));
    layers.base.forEach((l) => l.bringToBack());
    mapBox.classList.toggle('is-chart', id === 'chart');
    if (layers.world) { layers.world.setStyle(styleCountry); layers.india.setStyle(styleState); }
    drawBases();
  };
  const basesBox = el('div', { class: 'bkx-bases' });
  const drawBases = () => {
    basesBox.innerHTML = '';
    BASES.forEach((b) => basesBox.appendChild(el('button', { type: 'button', class: st.base === b.id ? 'on' : '', 'aria-label': b.label + ' map', onclick: () => setBase(b.id) }, [
      b.thumb ? el('img', { src: ESRI + b.thumb + '/MapServer/tile/3/3/5', alt: '', loading: 'lazy' }) : el('span', { class: 'bkx-chart-thumb' }), el('span', { text: b.label }),
    ])));
  };
  const legend = el('div', { class: 'bkx-legend' });
  let legendOpen = !shortScreen();
  const drawLegend = () => {
    legend.innerHTML = '';
    legend.classList.toggle('is-closed', !legendOpen);
    legend.appendChild(el('button', { type: 'button', class: 'bkx-legend-t', onclick: () => { legendOpen = !legendOpen; drawLegend(); } }, [legendOpen ? 'Legend ▾' : 'ⓘ Legend']));
    if (!legendOpen) return;
    [['bkx-lg-fill', 'Visited country / state'], ['bkx-lg-dot', 'Visited place'], want.length ? ['bkx-lg-want', 'To visit'] : null, ['bkx-lg-none', 'Not visited'], routesShown() ? ['bkx-lg-route', 'Route'] : null]
      .filter(Boolean).forEach(([c, t]) => legend.appendChild(el('div', {}, [el('i', { class: c }), t])));
    if (st.base !== 'chart') legend.appendChild(el('div', { class: 'bkx-lg-scale' }, GREENS.map((c) => el('i', { style: 'background:' + c }))));
  };

  // Counts, photo cards, places and home on the map.
  const drawMarks = () => {
    if (!lmap) return;
    if (layers.marks) layers.marks.clearLayers(); else layers.marks = L.layerGroup().addTo(lmap);
    const add = (m) => layers.marks.addLayer(m);
    const icon = (html, cls) => L.divIcon({ className: 'bkx-mk ' + (cls || ''), html, iconSize: [0, 0] });
    const groupAt = (g, kind) => {
      if (kind === 'c' && g.name === 'India') return [22.6, 79.2];
      const shape = kind === 'c' ? (featureOfCountry(g.name) || {}).geometry : (featuresOfState(g.shape)[0] || {}).geometry;
      const c = shape ? shapeCentre(shape) : regionCentre(g.name);
      if (c) return c;
      const pts = g.visits.concat(g.want).map((x) => placeCoords(x.place, x.region, x.country)).filter(Boolean).map((q) => q.at);
      return pts.length ? [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length] : null;
    };
    if (st.view !== 'cities') {
      const groups = st.view === 'world' ? D.g.countries.map((g) => [g, 'c']) : D.g.states.map((g) => [g, 's']);
      groups.forEach(([g, kind]) => {
        const at = groupAt(g, kind);
        if (!at) return;
        const n = g.places.length, ph = photoOf(g.visits);
        if (!n) { add(L.marker(at, { icon: icon('<div class="bkx-badge is-want"><b>🎯</b><span>' + esc(g.name) + '</span></div>'), title: g.name }).on('click', () => select(g.key))); return; }
        const html = ph && st.view === 'world'
          ? '<div class="bkx-card"><img src="' + ph + '" alt=""><b>' + esc(g.name) + '</b><i>' + n + '</i></div>'
          : ph ? '<div class="bkx-avatar"><img src="' + ph + '" alt=""><i>' + n + '</i><span>' + esc(g.name) + '</span></div>'
            : '<div class="bkx-badge' + (n >= 5 ? ' is-big' : '') + '"><b>' + n + '</b><span>' + esc(g.name) + '</span></div>';
        const mk = L.marker(at, { icon: icon(html), title: g.name, riseOnHover: true, zIndexOffset: ph ? 600 : 400 }).on('click', () => select(g.key));
        mk._bkxN = n;
        add(mk);
      });
      // The places: small dots from afar; zoomed in (RANK_ZOOM), each visited place is a node with its rank.
      const close = lmap.getZoom() >= RANK_ZOOM;
      D.g.places.forEach((p) => {
        if (!p.at) return;
        const visited = p.visits.length, n = rankOf(p);
        if (visited && n && close) {
          add(L.marker(p.at, { icon: icon(rankNode(n), 'is-node'), title: '#' + n + ' ' + p.name, riseOnHover: true, zIndexOffset: 700 - n })
            .bindTooltip(esc(p.name), { direction: 'top', offset: [0, -12] }).on('click', () => select(p.key)));
          return;
        }
        add(L.circleMarker(p.at, visited ? { radius: 5, color: '#fff', weight: 1.6, fillColor: '#f97316', fillOpacity: 1 } : { radius: 5, color: '#f97316', weight: 2, dashArray: '2 2', fillColor: '#fff', fillOpacity: 0.9 })
          .bindTooltip(esc(p.name), { direction: 'top', offset: [0, -4] }).on('click', () => select(p.key)));
      });
    } else {
      D.g.places.forEach((p) => {
        if (!p.at) return;
        const visited = p.visits.length, x = p.visits.find((tr) => tr.geo.length) || p.visits[0];
        const html = '<div class="bkx-pin' + (visited ? '' : ' is-want') + '"><svg viewBox="0 0 30 40" aria-hidden="true"><path d="M15 39S2 23.5 2 14.5a13 13 0 0 1 26 0C28 23.5 15 39 15 39z"/></svg>'
          + '<span class="bkx-pin-i">' + (visited ? iconHtml(x) : '🎯') + '</span>' + (p.visits.length > 1 ? '<b>' + p.visits.length + '</b>' : '')
          + (visited && rankOf(p) ? '<i class="bkx-pin-r' + (rankOf(p) <= 3 ? ' r' + rankOf(p) : '') + '">' + rankOf(p) + '</i>' : '') + '<em>' + esc(p.name) + '</em></div>';
        const mk = L.marker(p.at, { icon: icon(html), title: p.name, riseOnHover: true }).on('click', () => select(p.key));
        mk._bkxN = p.visits.length || 0.5;
        add(mk);
      });
    }
    declutter();
  };
  // Where counts crowd together (south India seen whole), the smaller ones shrink and drop their name (it shows on hover).
  const declutter = () => {
    if (!lmap || !layers.marks) return;
    const ms = [];
    layers.marks.eachLayer((m) => { if (m._bkxN && m.getElement && m.getElement()) ms.push(m); });
    ms.sort((a, b) => b._bkxN - a._bkxN);
    const placed = [];
    ms.forEach((m) => {
      const pt = lmap.latLngToContainerPoint(m.getLatLng());
      m.getElement().classList.toggle('is-tight', placed.some((q) => Math.abs(q.x - pt.x) < 72 && Math.abs(q.y - pt.y) < 46));
      placed.push(pt);
    });
  };
  // Routes: only for the place picked - from where each of its trips started (Travelled from) to the place: a curved
  // dashed line and the start point on the map (how it was travelled is in the panel, not on the map).
  const routesOf = (key) => {
    const p = key && key.startsWith('p:') ? D.g.places.find((x) => x.key === key) : null;
    const seen = new Map();
    (p ? p.visits : []).forEach((x) => { const r = routeOf(x); if (r) seen.set(r.from.join() + '>' + r.to.join(), r); });
    return [...seen.values()];
  };
  const routesShown = () => routesOf(st.sel).length > 0;
  const drawRoutes = () => {
    if (!lmap) return;
    if (layers.routes) layers.routes.clearLayers(); else layers.routes = L.layerGroup().addTo(lmap);
    routesOf(st.sel).forEach((r) => {
      layers.routes.addLayer(L.polyline(curve(r.from, r.to, 40), { color: '#1e3a8a', weight: 2.5, opacity: 0.85, dashArray: '6 7', className: 'bkx-route', interactive: false }));
      layers.routes.addLayer(L.circleMarker(r.from, { radius: 6, color: '#fff', weight: 2, fillColor: '#1e3a8a', fillOpacity: 1, interactive: false })
        .bindTooltip(esc(r.fromName), { permanent: true, direction: 'top', offset: [0, -6], className: 'bkx-from-tip' }));
    });
    drawLegend();
  };

  // ---- Fly to what is picked ----
  const boundsOf = (key) => {
    const shape = shapeOf(key);
    if (shape) return L.geoJSON(shape).getBounds();
    const g = D.g.places.concat(D.g.states, D.g.countries).find((x) => x.key === key);
    const pts = g ? g.visits.concat(g.want).map((x) => placeCoords(x.place, x.region, x.country)).filter(Boolean).map((q) => q.at) : [];
    return pts.length ? L.latLngBounds(pts) : null;
  };
  const flyTo = (key) => {
    if (!lmap) return;
    if (key.startsWith('p:')) {
      const p = D.g.places.find((x) => x.key === key);
      if (!p || !p.at) return;
      // With a route: the start and the place both in view.
      const pts = [p.at].concat(routesOf(key).map((r) => r.from));
      if (pts.length > 1) lmap.flyToBounds(L.latLngBounds(pts), { paddingTopLeft: [50, 50], paddingBottomRight: [60, 110], maxZoom: 9, duration: 0.9 });
      else lmap.flyTo(p.at, Math.max(lmap.getZoom(), 9), { duration: 0.9 });
      return;
    }
    const b = boundsOf(key);
    if (b && b.isValid()) lmap.flyToBounds(b.pad(0.25), { maxZoom: key.startsWith('s:') ? 8 : 6, duration: 0.9 });
  };
  const fitView = () => {
    if (!lmap) return;
    if (st.view === 'india') { lmap.flyToBounds(INDIA_BOUNDS, { duration: 0.8 }); return; }
    const pts = D.g.places.filter((p) => p.at).map((p) => p.at);
    if (st.view === 'cities') { if (pts.length) lmap.flyToBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 9, duration: 0.8 }); return; }
    const b = L.latLngBounds(pts.length ? pts : [[8, 68], [35, 97]]);
    D.g.countries.forEach((c) => { const f = featureOfCountry(c.name); if (f) b.extend(L.geoJSON(f.geometry).getBounds()); });
    lmap.flyToBounds(b.pad(0.35), { maxZoom: 4, duration: 0.8 });
  };
  const setView = (id) => {
    st.view = id; st.sel = null;
    drawRoutes();
    st.tab = id === 'cities' ? 'places' : id === 'india' ? (st.tab === 'countries' ? 'states' : st.tab) : st.tab;
    drawTop();
    if (layers.india) layers.india.setStyle(styleState);
    drawMarks(); drawPanel(); fitView();
  };

  // ---- Side panel ----
  const select = (key, fly) => {
    st.sel = key;
    if (layers.world) { layers.world.setStyle(styleCountry); layers.india.setStyle(styleState); }
    drawPanel(); drawRoutes();
    if (fly !== false) flyTo(key);
  };
  const back = () => { st.sel = null; if (layers.world) { layers.world.setStyle(styleCountry); layers.india.setStyle(styleState); } drawPanel(); drawRoutes(); };
  const card = (title, kids, extra) => el('div', { class: 'bkx-card-p' }, [el('div', { class: 'bkx-card-h' }, [title].concat(extra || []))].concat(kids));
  const tripLine = (x) => el('div', { class: 'bkx-trip' }, [
    el('div', { class: 'bkx-trip-h' }, [el('b', { text: ymText(x.ym) }), x.with ? withIcon(x.with) : null, x.rating ? el('span', { class: 'bk-stars', text: starsText(x.rating) }) : null].filter(Boolean)),
    el('small', { text: [x.label, nightsDays(nightsOf(x), x.days), x.stay.join(', ')].filter(Boolean).join(' · ') }),
    x.from || x.mode ? el('div', { class: 'bkx-way' }, [
      el('b', { text: x.from || '…' }),
      el('span', { class: 'bkx-way-by' }, [x.mode ? modeOf(x.mode).icon + ' ' + modeOf(x.mode).label : '→']),
      el('b', { text: x.place }),
    ]) : null,
    x.geo.length ? el('div', { class: 'bkx-chips' }, x.geo.flatMap((id) => (x.spots[id] || [geoOf(id).label]).map((n) => el('span', {}, [iconEl({ geo: [id], type: x.type, region: x.region }), ' ' + n])))) : null,
    x.adv && x.adv.length ? el('div', { class: 'bkx-chips is-adv' }, x.adv.map((a) => el('span', { text: adventureOf(a).icon + ' ' + adventureOf(a).label }))) : null,
    x.memory ? el('i', { class: 'bkx-mem', text: '“' + x.memory + '”' }) : null,
  ].filter(Boolean));
  const statTile = (ico, big, label) => el('div', { class: 'bkx-stat' }, [typeof ico === 'string' ? el('span', { class: 'bkx-stat-i', text: ico }) : ico, el('div', {}, [el('b', { text: big }), el('small', { text: label })])]);
  const drawPanel = () => {
    panel.innerHTML = '';
    panel.scrollTop = 0;
    if (st.sel) { drawDetail(); return; }
    const t = D.t, countries = t.abroad + (t.india ? 1 : 0);
    panel.appendChild(card(el('b', { text: '🗺️ My travel story' + (st.year ? ' · ' + st.year : '') }), [
      el('div', { class: 'bkx-stats' }, [
        statTile('🌍', String(countries), countries === 1 ? 'Country visited' : 'Countries visited'),
        statTile(india.length ? silhouette(indiaShape(), '#22c55e', 34) : '🇮🇳', t.india + ' / ' + INDIA_AREAS, 'Indian states & UTs'),
        statTile('📍', String(t.places), 'Places explored'),
        statTile('🧳', String(t.trips), 'Trips completed'),
      ]),
      el('div', { class: 'bkx-strip' }, [
        t.days ? el('span', { text: '🌙 ' + t.nights + 'N ' + t.days + 'D away' }) : null,
        t.daysKnown > 1 ? el('span', { text: '⏱️ ' + t.avgDays + ' days a trip' }) : null,
        el('span', { text: '🌐 ' + Math.max(countries ? 1 : 0, Math.round((countries / WORLD_COUNTRIES) * 100)) + '% of the world' }),
        t.busiest && t.years.length > 1 ? el('span', { text: '🔥 ' + t.busiest.year + ': ' + plural(t.busiest.trips, 'trip', 'trips') }) : null,
      ].filter(Boolean)),
    ]));
    // States, UTs, countries and places.
    const TABS = [['states', 'States'], ['uts', 'UTs'], ['countries', 'Countries'], ['places', 'Places']];
    const rows = st.tab === 'states' ? D.g.states.filter((s) => !s.ut) : st.tab === 'uts' ? D.g.states.filter((s) => s.ut) : st.tab === 'countries' ? D.g.countries : D.g.places;
    const max = Math.max(1, ...rows.map((r) => r.visits.length));
    panel.appendChild(card(el('b', { text: 'States, UTs & countries' }), [
      rows.length ? el('div', { class: 'bkx-rows' }, rows.map((r) => {
        const n = r.visits.length;
        const sil = st.tab === 'places' ? iconEl(r.visits[0] || r.want[0])
          : silhouette(st.tab === 'countries' ? (r.name === 'India' ? indiaShape() : (featureOfCountry(r.name) || {}).geometry) : (featuresOfState(r.shape)[0] || {}).geometry, n ? fillOf(Math.max(2, r.places.length + 1)) : '#fdba74', 30);
        return el('button', { type: 'button', class: 'bkx-row' + (n ? '' : ' is-want'), onclick: () => select(r.key) }, [
          sil, el('span', { class: 'bkx-row-n', text: r.name }),
          el('span', { class: 'bkx-bar' }, [el('i', { style: 'width:' + Math.max(n ? 8 : 0, Math.round((n / max) * 100)) + '%' })]),
          el('small', { text: n ? plural(n, 'trip', 'trips') : 'to visit' }), el('span', { class: 'bkx-chev', text: '›' }),
        ]);
      })) : el('p', { class: 'bkx-none', text: st.tab === 'uts' ? 'No Union Territory yet - Puducherry, Andaman, Ladakh…' : 'Nothing here yet.' }),
    ], [el('div', { class: 'bkx-tabs' }, TABS.map(([id, label]) => el('button', { type: 'button', class: st.tab === id ? 'on' : '', onclick: () => { st.tab = id; drawPanel(); } }, [label])))]));
    // Travel goals.
    const dreamsDone = all.filter((x) => x.source === 'dream').length;
    const goalRow = (label, n, of, color, extra) => el('div', { class: 'bkx-goal' }, [
      el('div', { class: 'bkx-goal-h' }, [el('b', { text: label }), el('small', { text: n + ' / ' + of }), extra || null].filter(Boolean)),
      el('div', { class: 'bkx-goal-bar' }, [el('i', { style: 'width:' + Math.min(100, Math.round((n / Math.max(1, of)) * 100)) + '%;background:' + color })]),
    ]);
    const goalPick = el('div', { class: 'bkx-goal-pick hidden' }, [5, 10, 15, 25, 50, 100].map((n) => el('button', { type: 'button', class: n === goal ? 'on' : '', onclick: async () => { goal = n; if (onGoal) await onGoal(n); drawPanel(); } }, [String(n)])));
    panel.appendChild(card(el('b', { text: '🎯 Travel goals' }), [
      goalRow('Explore more of India', D.t.india, INDIA_AREAS, '#22c55e'),
      goalRow('Visit more countries', countries, goal, '#6366f1', el('button', { type: 'button', class: 'bkx-goal-edit', 'aria-label': 'Change the goal', text: '✏️', onclick: () => goalPick.classList.toggle('hidden') })),
      goalPick,
      want.length || dreamsDone ? goalRow('Bucket-list places', dreamsDone, dreamsDone + want.length, '#f97316') : null,
    ].filter(Boolean)));
    if (shortScreen()) panel.appendChild(recent(true));
  };
  const drawDetail = () => {
    const key = st.sel;
    const g = D.g.places.concat(D.g.states, D.g.countries).find((x) => x.key === key);
    panel.appendChild(el('button', { type: 'button', class: 'bkx-back', onclick: back }, ['← Back']));
    if (key === 'all') {
      panel.appendChild(card(el('b', { text: '🧳 All trips' + (st.year ? ' · ' + st.year : '') }), D.visits.map((x) => el('button', { type: 'button', class: 'bkx-row', onclick: () => select('p:' + x.place.trim().toLowerCase()) }, [
        iconEl(x), el('span', { class: 'bkx-row-n', text: x.place }), el('small', { text: ymText(x.ym) + (nightsDays(nightsOf(x), x.days) ? ' · ' + nightsDays(nightsOf(x), x.days) : '') }), el('span', { class: 'bkx-chev', text: '›' }),
      ]))));
      return;
    }
    if (!g) { panel.appendChild(el('p', { class: 'bkx-none', text: 'Not in what is shown - try All, or another year.' })); return; }
    const s = sumUp(g.visits);
    const kind = key[0];
    const shape = shapeOf(key);
    const ph = g.visits.filter((x) => pics[x.id]).map((x) => pics[x.id]);
    panel.appendChild(el('div', { class: 'bkx-detail-h' }, [
      kind === 'p' ? iconEl(g.visits[0] || g.want[0]) : silhouette(shape, g.places.length ? '#22c55e' : '#fdba74', 52),
      el('div', {}, [
        el('b', { text: g.name }),
        el('small', { text: kind === 'p' ? [g.region, g.country !== g.region ? g.country : ''].filter(Boolean).join(', ') : kind === 's' ? (g.ut ? 'Union Territory' : 'State') + ', India' : 'Country' }),
      ]),
    ]));
    if (g.visits.length) panel.appendChild(el('div', { class: 'bkx-strip' }, [
      kind !== 'p' ? el('span', { text: '📍 ' + plural(g.places.length, 'place', 'places') }) : null,
      el('span', { text: '🧳 ' + plural(s.trips, 'trip', 'trips') }),
      s.stay ? el('span', { text: '🌙 ' + s.stay }) : null,
      el('span', { text: '📅 ' + (s.from === s.to ? s.from : s.from + '–' + s.to) }),
    ].filter(Boolean)));
    if (ph.length) panel.appendChild(el('div', { class: 'bkx-photos' }, ph.map((src) => el('img', { src, alt: '' }))));
    if (kind === 'p') g.visits.slice().sort((a, b) => b.ym.localeCompare(a.ym)).forEach((x) => panel.appendChild(tripLine(x)));
    else g.places.forEach((p) => panel.appendChild(el('div', { class: 'bkx-place' }, [
      el('button', { type: 'button', class: 'bkx-place-h', onclick: () => select('p:' + p.name.toLowerCase()) }, [iconEl(p.trips.find((x) => x.geo.length) || p.trips[0]), el('b', { text: p.name }), el('small', { text: plural(p.trips.length, 'trip', 'trips') }), el('span', { class: 'bkx-chev', text: '›' })]),
      ...p.trips.slice().sort((a, b) => b.ym.localeCompare(a.ym)).map(tripLine),
    ])));
    if (g.want.length) panel.appendChild(card(el('b', { text: '🎯 Still to visit' }), g.want.map((x) => el('div', { class: 'bkx-want' }, [el('b', { text: x.place }), el('small', { text: [x.source === 'dream' ? '🪣 ' + x.title : x.title, x.by ? 'by ' + x.by : ''].filter(Boolean).join(' · ') })]))));
  };
  // Recent trips: photo cards, newest first.
  const recent = (inPanel) => {
    const box = el('div', { class: 'bkx-recent-in' + (inPanel ? ' is-panel' : '') });
    const strip = el('div', { class: 'bkx-rc-strip' }, D.visits.slice(0, 20).map((x) => {
      const ph = pics[x.id];
      return el('button', { type: 'button', class: 'bkx-rc is-' + x.type, onclick: () => select('p:' + x.place.trim().toLowerCase()) }, [
        el('div', { class: 'bkx-rc-img' }, [ph ? el('img', { src: ph, alt: '' }) : iconEl(x), el('span', { class: 'bkx-rc-c', text: x.country || 'Somewhere' }), x.with ? withIcon(x.with, 'bkx-rc-w') : null].filter(Boolean)),
        el('b', { text: x.place }),
        el('small', { text: [x.region !== x.place ? x.region : '', ymText(x.ym), nightsDays(nightsOf(x), x.days)].filter(Boolean).join(' • ') }),
      ]);
    }));
    box.append(
      el('div', { class: 'bkx-rc-h' }, [el('b', { text: '📷 Recent trips' }), el('button', { type: 'button', class: 'bkx-link', onclick: () => select('all', false) }, ['View all trips →'])]),
      D.visits.length ? strip : el('p', { class: 'bkx-none', text: 'No trips in what is shown.' }),
    );
    if (!inPanel && D.visits.length > 3) box.appendChild(el('button', { type: 'button', class: 'bkx-rc-next', 'aria-label': 'More trips', text: '›', onclick: () => strip.scrollBy({ left: strip.clientWidth * 0.8, behavior: 'smooth' }) }));
    return box;
  };
  const drawRecent = () => { recentBox.innerHTML = ''; recentBox.classList.toggle('hidden', shortScreen()); if (!shortScreen()) recentBox.appendChild(recent(false)); };

  const refresh = () => {
    compute();
    drawTop();
    if (layers.world) { layers.world.setStyle(styleCountry); layers.india.setStyle(styleState); }
    drawMarks(); drawRoutes(); drawPanel(); drawRecent(); drawLegend();
  };

  // ---- Always landscape: full screen and turned sideways where the phone allows it; whenever the screen is still taller
  // than wide (any size, any device), the view itself is turned - the map is never shown upright. ----
  const fit = () => {
    rotated = window.innerHeight > window.innerWidth;
    root.classList.toggle('is-rotated', rotated);
    if (lmap) {
      // A turned view can not be dragged the right way round: zoom with the buttons and the list instead.
      ['dragging', 'touchZoom', 'doubleClickZoom'].forEach((h) => lmap[h] && lmap[h][rotated ? 'disable' : 'enable']());
      setTimeout(() => lmap && lmap.invalidateSize(), 80);
    }
    if (D) { drawRecent(); drawPanel(); }
  };
  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await root.requestFullscreen({ navigationUI: 'hide' }); await screen.orientation.lock('landscape').catch(() => {}); }
    } catch (_) {}
    drawTop(); fit();
  }
  const host = document.getElementById('modalHost');
  const watch = new MutationObserver(() => { if (!root.isConnected || host.classList.contains('hidden')) cleanup(); });
  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    watch.disconnect();
    window.removeEventListener('resize', fit);
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (_) {}
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (sized) sized.disconnect();
    if (lmap) { lmap.remove(); lmap = null; }
  }

  compute();
  openModal(root);
  watch.observe(host, { attributes: true, attributeFilter: ['class'], childList: true });
  window.addEventListener('resize', fit);
  try {
    if (root.requestFullscreen && window.innerHeight > window.innerWidth) {
      await root.requestFullscreen({ navigationUI: 'hide' });
      await screen.orientation.lock('landscape');
    }
  } catch (_) { /* not supported here (iPhone, desktop): the view is turned instead */ }
  fit();
  drawTop(); drawPanel(); drawRecent(); drawLegend();
  mapBox.appendChild(el('div', { class: 'bkx-msg', text: '🗺️ Loading the map…' }));

  // ---- Load the library and the outlines, then draw ----
  try {
    [L] = await Promise.all([loadLeaflet(), loadShapes(WORLD, 'countries').then((f) => { world = f; }).catch(() => {}), loadShapes(INDIA, 'states').then((f) => { india = f; }).catch(() => {})]);
  } catch (_) {
    mapBox.innerHTML = '';
    mapBox.appendChild(el('div', { class: 'bkx-msg', text: '📶 The map needs the internet. Connect, then open it again.' }));
    return;
  }
  if (cleaned) return;
  mapBox.innerHTML = '';
  lmap = L.map(mapBox, { worldCopyJump: true, minZoom: 2, maxZoom: 18, zoomControl: true, zoomSnap: 0.5 });
  // The map measures itself again whenever its box changes (the panel, a turn, full screen).
  sized = new ResizeObserver(() => lmap && lmap.invalidateSize());
  sized.observe(mapBox);
  setBase(st.base);
  layers.world = L.geoJSON({ type: 'FeatureCollection', features: world.filter((f) => f.id !== '356') }, {
    style: styleCountry,
    onEachFeature: (f, l) => l.on('click', () => { const g = D.g.countries.find((c) => countryMatch(c.name, f)); if (g) select(g.key); }),
  }).addTo(lmap);
  layers.india = L.geoJSON({ type: 'FeatureCollection', features: india }, {
    style: styleState,
    onEachFeature: (f, l) => l.on('click', () => {
      if (st.view === 'world') { const g = D.g.countries.find((c) => c.name === 'India'); if (g) select(g.key); return; }
      const g = D.g.states.find((s) => s.shape === f.properties.st_nm); if (g) select(g.key);
    }),
  }).addTo(lmap);
  lmap.on('zoomend', declutter);
  let rankView = false;
  lmap.on('zoomend', () => { const now = lmap.getZoom() >= RANK_ZOOM; if (now !== rankView && st.view !== 'cities') { rankView = now; drawMarks(); } });
  lmap.on('zoomend', () => { layers.world.setStyle(styleCountry); layers.india.setStyle(styleState); });
  mapWrap.append(basesBox, legend);
  drawBases(); drawLegend();
  drawRoutes(); drawMarks(); drawPanel();
  lmap.setView([22, 60], 2);
  fitView();
  fit();
}
