// bucket-geo.js — where to pin a place on the Places map, worked out on this phone: a built-in list of well-known
// places, then the centre of the state, Union Territory or country. Nothing is looked up online, so place names
// never leave the device. Coordinates are approximate (to about a kilometre) - enough for a pin on a map.

// Places by name (alternative spellings joined with |): [latitude, longitude].
const PLACES = {
  // Tamil Nadu
  'chennai|madras': [13.08, 80.27], 'madurai': [9.93, 78.12], 'coimbatore': [11.02, 76.96], 'ooty|udhagamandalam': [11.41, 76.70],
  'kodaikanal|kodai': [10.24, 77.49], 'rameswaram': [9.29, 79.31], 'kanyakumari': [8.08, 77.54], 'trichy|tiruchirappalli': [10.79, 78.70],
  'salem': [11.66, 78.15], 'tirunelveli': [8.71, 77.76], 'thanjavur|tanjore': [10.79, 79.14], 'vellore': [12.92, 79.13],
  'mahabalipuram|mamallapuram': [12.62, 80.19], 'yercaud': [11.78, 78.21], 'tiruvannamalai': [12.23, 79.07], 'kanchipuram': [12.83, 79.70],
  'kumbakonam': [10.96, 79.39], 'erode': [11.34, 77.72], 'tiruppur': [11.11, 77.34], 'thoothukudi|tuticorin': [8.76, 78.13],
  'dindigul': [10.36, 77.98], 'karur': [10.96, 78.08], 'hosur': [12.74, 77.83], 'nagercoil': [8.18, 77.41], 'chidambaram': [11.40, 79.69],
  'velankanni': [10.68, 79.85], 'palani': [10.45, 77.52], 'courtallam': [8.93, 77.28], 'valparai': [10.33, 76.95], 'coonoor': [11.35, 76.80],
  'yelagiri': [12.58, 78.64], 'hogenakkal': [12.12, 77.78], 'tiruchendur': [8.50, 78.12], 'srirangam': [10.86, 78.69],
  'karaikudi|chettinad': [10.07, 78.78], 'poompuhar': [11.14, 79.85], 'pollachi': [10.66, 77.01], 'kotagiri': [11.42, 76.86],
  'topslip': [10.43, 76.84], 'meghamalai': [9.68, 77.40], 'kolli hills': [11.25, 78.35], 'mudumalai': [11.57, 76.53],
  'dhanushkodi': [9.18, 79.42], 'nilgiris': [11.40, 76.70],
  // Union Territories
  'puducherry|pondicherry|pondichery|pondichéry|pondy': [11.93, 79.83], 'auroville': [12.01, 79.81], 'karaikal': [10.92, 79.84],
  'mahe': [11.70, 75.54], 'yanam': [16.73, 82.21], 'delhi|new delhi': [28.61, 77.21], 'leh': [34.16, 77.58], 'kargil': [34.56, 76.13],
  'nubra': [34.60, 77.60], 'pangong': [33.75, 78.66], 'jammu': [32.73, 74.86], 'srinagar': [34.08, 74.80], 'gulmarg': [34.05, 74.38],
  'pahalgam': [34.02, 75.32], 'sonamarg': [34.30, 75.29], 'vaishno devi': [33.03, 74.95], 'port blair': [11.62, 92.73],
  'havelock|swaraj dweep': [11.97, 92.98], 'neil island|shaheed dweep': [11.83, 93.03], 'agatti': [10.86, 72.19], 'kavaratti': [10.57, 72.64],
  'bangaram': [10.94, 72.29], 'chandigarh': [30.73, 76.78], 'daman': [20.40, 72.83], 'diu': [20.71, 70.98], 'silvassa': [20.27, 73.01],
  // Kerala
  'munnar': [10.09, 77.06], 'alleppey|alappuzha|alapuzha': [9.50, 76.34], 'kochi|cochin': [9.93, 76.27], 'wayanad': [11.69, 76.13],
  'thekkady': [9.60, 77.16], 'varkala': [8.73, 76.71], 'sabarimala': [9.43, 77.08], 'guruvayur': [10.59, 76.04], 'kovalam': [8.40, 76.98],
  'trivandrum|thiruvananthapuram': [8.52, 76.94], 'kumarakom': [9.62, 76.43], 'vagamon': [9.69, 76.90], 'kozhikode|calicut': [11.26, 75.78],
  'thrissur': [10.53, 76.21], 'athirappilly': [10.29, 76.57], 'poovar': [8.32, 77.07], 'kannur': [11.87, 75.37], 'bekal': [12.39, 75.03],
  // Karnataka
  'bengaluru|bangalore': [12.97, 77.59], 'mysuru|mysore': [12.30, 76.64], 'coorg|coorgh|kodagu': [12.42, 75.74], 'hampi': [15.34, 76.46],
  'gokarna': [14.55, 74.32], 'chikmagalur|chikkamagaluru': [13.32, 75.77], 'hesaraghatta': [13.14, 77.48], 'udupi': [13.34, 74.75],
  'mangalore|mangaluru': [12.91, 74.86], 'dandeli': [15.25, 74.62], 'sakleshpur': [12.94, 75.79], 'kabini': [11.95, 76.35],
  'bandipur': [11.67, 76.63], 'murudeshwar': [14.09, 74.48], 'nandi hills': [13.37, 77.68], 'shivamogga': [13.93, 75.57], 'jog falls': [14.23, 74.81],
  // Andhra Pradesh, Telangana, Goa
  'tirupati': [13.63, 79.42], 'tirumala': [13.68, 79.35], 'visakhapatnam|vizag': [17.69, 83.22], 'araku': [18.33, 82.87],
  'srisailam': [16.07, 78.87], 'vijayawada': [16.51, 80.65], 'horsley hills': [13.66, 78.40], 'hyderabad|secunderabad': [17.39, 78.49],
  'warangal': [17.97, 79.59], 'panaji|panjim': [15.49, 73.83], 'calangute': [15.54, 73.76], 'baga': [15.56, 73.75], 'anjuna': [15.59, 73.74],
  'palolem': [15.01, 74.02], 'candolim': [15.52, 73.76],
  // West and north
  'mumbai|bombay': [19.08, 72.88], 'pune': [18.52, 73.86], 'lonavala': [18.75, 73.41], 'mahabaleshwar': [17.92, 73.66], 'nashik': [20.00, 73.79],
  'shirdi': [19.77, 74.48], 'aurangabad': [19.88, 75.34], 'ajanta': [20.55, 75.70], 'ellora': [20.03, 75.18], 'alibaug': [18.64, 72.87],
  'matheran': [18.99, 73.27], 'ahmedabad': [23.02, 72.57], 'rann of kutch|kutch': [23.73, 69.86], 'dwarka': [22.24, 68.97], 'somnath': [20.89, 70.40],
  'gir': [21.12, 70.82], 'statue of unity': [21.84, 73.72], 'vadodara': [22.31, 73.18], 'jaipur': [26.91, 75.79], 'udaipur': [24.59, 73.71],
  'jodhpur': [26.24, 73.02], 'jaisalmer': [26.92, 70.91], 'mount abu': [24.59, 72.71], 'pushkar': [26.49, 74.55], 'ranthambore': [26.02, 76.50],
  'bikaner': [28.02, 73.31], 'agra|taj mahal': [27.18, 78.01], 'varanasi|kashi|banaras': [25.32, 82.97], 'mathura': [27.49, 77.67],
  'vrindavan': [27.58, 77.70], 'ayodhya': [26.80, 82.20], 'prayagraj|allahabad': [25.44, 81.85], 'lucknow': [26.85, 80.95],
  'rishikesh': [30.09, 78.27], 'haridwar': [29.95, 78.16], 'kedarnath': [30.73, 79.07], 'badrinath': [30.74, 79.49], 'nainital': [29.38, 79.46],
  'mussoorie': [30.46, 78.07], 'auli': [30.53, 79.57], 'jim corbett': [29.53, 78.77], 'dehradun': [30.32, 78.03], 'manali': [32.24, 77.19],
  'shimla': [31.10, 77.17], 'spiti': [32.25, 78.03], 'dharamshala': [32.22, 76.32], 'mcleodganj': [32.24, 76.32], 'kasol': [32.01, 77.31],
  'dalhousie': [32.53, 75.98], 'kullu': [31.96, 77.11], 'amritsar|golden temple': [31.63, 74.87], 'gurugram|gurgaon': [28.46, 77.03],
  // East and north-east, centre
  'kolkata|calcutta': [22.57, 88.36], 'darjeeling': [27.04, 88.26], 'sundarbans': [21.95, 88.90], 'gangtok': [27.33, 88.61], 'pelling': [27.30, 88.24],
  'shillong': [25.58, 91.89], 'cherrapunji|sohra': [25.27, 91.73], 'dawki': [25.19, 92.02], 'kaziranga': [26.58, 93.17], 'guwahati': [26.14, 91.74],
  'majuli': [26.95, 94.17], 'tawang': [27.59, 91.86], 'ziro': [27.54, 93.83], 'puri': [19.81, 85.83], 'konark': [19.89, 86.09],
  'bhubaneswar': [20.30, 85.82], 'khajuraho': [24.85, 79.93], 'ujjain': [23.18, 75.78], 'indore': [22.72, 75.86], 'bhopal': [23.26, 77.41],
  'pachmarhi': [22.47, 78.43], 'kanha': [22.33, 80.61], 'bandhavgarh': [23.70, 81.03], 'bodh gaya': [24.70, 84.99], 'patna': [25.59, 85.14],
  'ranchi': [23.34, 85.31], 'raipur': [21.25, 81.63], 'imphal': [24.82, 93.94], 'aizawl': [23.73, 92.72], 'kohima': [25.67, 94.11], 'agartala': [23.83, 91.29],
  // Abroad
  'colombo': [6.93, 79.86], 'kandy': [7.29, 80.63], 'galle': [6.03, 80.22], 'ella': [6.87, 81.05], 'nuwara eliya': [6.95, 80.79],
  'sigiriya': [7.96, 80.76], 'bentota': [6.42, 80.00], 'jaffna': [9.66, 80.01], 'trincomalee': [8.59, 81.22], 'kathmandu': [27.72, 85.32],
  'pokhara': [28.21, 83.99], 'thimphu': [27.47, 89.64], 'paro': [27.43, 89.42], 'bangkok': [13.76, 100.50], 'phuket': [7.88, 98.39],
  'pattaya': [12.93, 100.88], 'krabi': [8.09, 98.91], 'chiang mai': [18.79, 98.98], 'kuala lumpur': [3.14, 101.69], 'langkawi': [6.35, 99.80],
  'penang': [5.41, 100.33], 'bali': [-8.41, 115.19], 'jakarta': [-6.21, 106.85], 'hanoi': [21.03, 105.85], 'ho chi minh': [10.82, 106.63],
  'da nang': [16.05, 108.20], 'ha long': [20.95, 107.08], 'dubai': [25.20, 55.27], 'abu dhabi': [24.45, 54.38], 'muscat': [23.59, 58.41],
  'doha': [25.29, 51.53], 'mecca|makkah': [21.39, 39.86], 'medina|madinah': [24.47, 39.61], 'istanbul': [41.01, 28.98], 'cappadocia': [38.64, 34.83],
  'cairo': [30.04, 31.24], 'giza': [29.98, 31.13], 'tokyo': [35.68, 139.69], 'kyoto': [35.01, 135.77], 'osaka': [34.69, 135.50],
  'seoul': [37.57, 126.98], 'beijing': [39.90, 116.41], 'shanghai': [31.23, 121.47], 'sydney': [-33.87, 151.21], 'melbourne': [-37.81, 144.96],
  'auckland': [-36.85, 174.76], 'queenstown': [-45.03, 168.66], 'london': [51.51, -0.13], 'edinburgh': [55.95, -3.19], 'paris': [48.86, 2.35],
  'zurich': [47.38, 8.54], 'interlaken': [46.69, 7.86], 'geneva': [46.20, 6.14], 'rome': [41.90, 12.50], 'venice': [45.44, 12.32],
  'florence': [43.77, 11.26], 'milan': [45.46, 9.19], 'barcelona': [41.39, 2.17], 'madrid': [40.42, -3.70], 'athens': [37.98, 23.73],
  'santorini': [36.39, 25.46], 'berlin': [52.52, 13.40], 'munich': [48.14, 11.58], 'amsterdam': [52.37, 4.90], 'oslo': [59.91, 10.75],
  'tromsø|tromso': [69.65, 18.96], 'reykjavik': [64.15, -21.94], 'new york': [40.71, -74.01], 'las vegas': [36.17, -115.14],
  'san francisco': [37.77, -122.42], 'toronto': [43.65, -79.38], 'vancouver': [49.28, -123.12], 'masai mara': [-1.49, 35.14], 'cape town': [-33.92, 18.42],
};
// The middle of each state, Union Territory and country MyNotes knows (as named in bucket.js).
const REGION_CENTRES = {
  'Tamil Nadu': [11.10, 78.66], 'Puducherry': [11.93, 79.83], 'Delhi': [28.61, 77.21], 'Ladakh': [34.15, 77.58], 'Jammu & Kashmir': [33.78, 75.00],
  'Andaman & Nicobar': [11.62, 92.73], 'Lakshadweep': [10.57, 72.64], 'Chandigarh': [30.73, 76.78], 'Dadra, Daman & Diu': [20.40, 72.83],
  'Kerala': [10.40, 76.40], 'Karnataka': [14.50, 75.90], 'Andhra Pradesh': [15.90, 79.70], 'Telangana': [17.80, 79.10], 'Goa': [15.40, 74.00],
  'Maharashtra': [19.40, 76.10], 'Gujarat': [22.60, 71.60], 'Rajasthan': [26.60, 73.80], 'Uttar Pradesh': [27.00, 80.90], 'Uttarakhand': [30.10, 79.20],
  'Himachal Pradesh': [31.90, 77.20], 'West Bengal': [23.00, 87.90], 'Sikkim': [27.50, 88.50], 'Meghalaya': [25.50, 91.40], 'Assam': [26.20, 92.90],
  'Arunachal Pradesh': [28.00, 94.60], 'Odisha': [20.50, 84.40], 'Madhya Pradesh': [23.50, 78.50], 'Bihar': [25.60, 85.60], 'Punjab': [30.90, 75.40],
  'Haryana': [29.10, 76.10], 'Jharkhand': [23.60, 85.30], 'Chhattisgarh': [21.30, 81.90], 'Manipur': [24.70, 93.90], 'Mizoram': [23.30, 92.80],
  'Nagaland': [26.10, 94.50], 'Tripura': [23.80, 91.60],
  'India': [22.50, 79.00], 'Sri Lanka': [7.87, 80.77], 'Maldives': [3.20, 73.22], 'Nepal': [28.20, 84.10], 'Bhutan': [27.50, 90.40],
  'Thailand': [15.50, 101.00], 'Singapore': [1.35, 103.82], 'Malaysia': [4.20, 102.00], 'Indonesia': [-2.50, 118.00], 'Vietnam': [16.00, 107.80],
  'UAE': [24.30, 54.40], 'Oman': [21.50, 57.00], 'Qatar': [25.30, 51.20], 'Saudi Arabia': [23.90, 45.10], 'Turkey': [39.00, 35.20],
  'Egypt': [26.80, 30.80], 'Mauritius': [-20.30, 57.55], 'Seychelles': [-4.68, 55.49], 'Japan': [36.20, 138.30], 'South Korea': [36.50, 127.90],
  'China': [35.00, 104.00], 'Hong Kong': [22.32, 114.17], 'Australia': [-25.30, 133.80], 'New Zealand': [-41.50, 172.80],
  'United Kingdom': [54.00, -2.50], 'France': [46.60, 2.40], 'Switzerland': [46.80, 8.20], 'Italy': [42.80, 12.60], 'Spain': [40.30, -3.70],
  'Greece': [39.10, 22.00], 'Germany': [51.20, 10.40], 'Netherlands': [52.20, 5.30], 'Norway': [61.50, 9.00], 'Iceland': [64.90, -18.60],
  'USA': [39.80, -98.60], 'Canada': [56.10, -106.30], 'Kenya': [0.00, 37.90], 'South Africa': [-30.60, 22.90],
};

const word = (w) => new RegExp('(^|[^a-zà-ÿ])' + w.replace(/ /g, '\\s+') + '([^a-zà-ÿ]|$)');
const PLACE_RES = Object.entries(PLACES).map(([names, at]) => [names.split('|').map(word), at]);

// The middle of a state, UT or country, by its name (any case); null if not known.
export function regionCentre(name) {
  const n = String(name || '').trim().toLowerCase();
  const k = n && Object.keys(REGION_CENTRES).find((r) => r.toLowerCase() === n);
  return k ? REGION_CENTRES[k] : null;
}
// Where to pin a place: { at: [lat, lng], exact } - exact when the place itself is known; else the centre of its
// state, UT or country (exact: false); null when none of these is known. The name mentioned first wins
// ("Hesaraghatta, Bengaluru" pins Hesaraghatta).
export function placeCoords(place, region, country) {
  const t = String(place || '').toLowerCase();
  let best = null;
  PLACE_RES.forEach(([res, at]) => res.forEach((re) => { const m = re.exec(t); if (m && (!best || m.index < best.i)) best = { i: m.index, at }; }));
  if (best) return { at: best.at, exact: true };
  const c = regionCentre(region) || regionCentre(country);
  return c ? { at: c, exact: false } : null;
}

// The pins: each place (its trips together), and the places grouped by state / UT / country and by country, each
// group at its region's centre (or the middle of its places). Places that can not be pinned are kept apart.
export function mapGroups(visits) {
  const byPlace = new Map();
  visits.forEach((x) => {
    const k = x.place.trim().toLowerCase();
    if (!byPlace.has(k)) {
      const c = placeCoords(x.place, x.region, x.country);
      byPlace.set(k, { name: x.place.trim(), region: x.region || x.country || '', country: x.country || '', at: c ? c.at : null, exact: !!(c && c.exact), trips: [] });
    }
    byPlace.get(k).trips.push(x);
  });
  const all = [...byPlace.values()];
  const places = all.filter((p) => p.at);
  const group = (keyOf) => {
    const m = new Map();
    places.forEach((p) => { const k = keyOf(p); if (!k) return; if (!m.has(k)) m.set(k, { name: k, places: [] }); m.get(k).places.push(p); });
    return [...m.values()].map((gr) => Object.assign(gr, { at: regionCentre(gr.name) || [gr.places.reduce((s, p) => s + p.at[0], 0) / gr.places.length, gr.places.reduce((s, p) => s + p.at[1], 0) / gr.places.length] }));
  };
  return { places, unpinned: all.filter((p) => !p.at), regions: group((p) => p.region), countries: group((p) => p.country) };
}


// ---- The map's shapes: the world's countries (world-atlas, Natural Earth) and India's 36 states and UTs
// (india-maps-data), both TopoJSON. Read here as data - never run - and turned into GeoJSON for the map. ----
export const INDIA_AREAS = 36;   // 28 states and 8 Union Territories
export const WORLD_COUNTRIES = 195;
// TopoJSON -> GeoJSON features of one object (arcs delta-decoded when quantised).
export function topoFeatures(topo, name) {
  const tf = topo.transform;
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map((p) => {
      if (!tf) return [p[0], p[1]];
      x += p[0]; y += p[1];
      return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]];
    });
  });
  const ring = (ids) => {
    const pts = [];
    ids.forEach((i) => { const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; a.forEach((pt, k) => { if (k === 0 && pts.length) return; pts.push(pt); }); });
    return pts;
  };
  const geom = (g) => (g.type === 'Polygon' ? { type: 'Polygon', coordinates: g.arcs.map(ring) }
    : g.type === 'MultiPolygon' ? { type: 'MultiPolygon', coordinates: g.arcs.map((pg) => pg.map(ring)) } : null);
  return (topo.objects[name] ? topo.objects[name].geometries : []).map((g) => ({ type: 'Feature', id: g.id, properties: g.properties || {}, geometry: geom(g) })).filter((f) => f.geometry);
}
const outerRings = (geometry) => (geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0]));
const ringBox = (r) => r.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
// The middle of a shape's biggest part: [lat, lng] - where its count or photo goes.
export function shapeCentre(geometry) {
  let best = null, area = -1;
  outerRings(geometry).forEach((r) => { const b = ringBox(r), a = (b[2] - b[0]) * (b[3] - b[1]); if (a > area) { area = a; best = b; } });
  return best ? [(best[1] + best[3]) / 2, (best[0] + best[2]) / 2] : null;
}
// A small silhouette of a state or country (an SVG path in a size x size box), drawn from its own shape.
export function shapeSilhouette(geometry, size) {
  const rings = outerRings(geometry);
  const all = rings.reduce((b, r) => { const q = ringBox(r); return [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])]; }, [Infinity, Infinity, -Infinity, -Infinity]);
  const kx = Math.cos((((all[1] + all[3]) / 2) * Math.PI) / 180);
  const w = (all[2] - all[0]) * kx || 1, h = all[3] - all[1] || 1;
  const s = (size - 2) / Math.max(w, h), ox = (size - w * s) / 2, oy = (size - h * s) / 2;
  return rings.map((r) => {
    const step = Math.max(1, Math.floor(r.length / 120));
    return r.filter((_, i) => i % step === 0).map((p, i) => (i ? 'L' : 'M') + ((p[0] - all[0]) * kx * s + ox).toFixed(1) + ' ' + ((all[3] - p[1]) * s + oy).toFixed(1)).join('') + 'Z';
  }).join('');
}
// Our state and UT names to the names in india-maps-data.
export const stateShapeName = (region) => ({ 'Andaman & Nicobar': 'Andaman and Nicobar Islands', 'Jammu & Kashmir': 'Jammu and Kashmir', 'Dadra, Daman & Diu': 'Dadra and Nagar Haveli and Daman and Diu' }[region] || region);
// Our country names to world-atlas ids (ISO 3166 numeric); others are matched by name.
export const COUNTRY_NUM = {
  'India': '356', 'Sri Lanka': '144', 'Maldives': '462', 'Nepal': '524', 'Bhutan': '064', 'Thailand': '764', 'Singapore': '702', 'Malaysia': '458',
  'Indonesia': '360', 'Vietnam': '704', 'UAE': '784', 'Oman': '512', 'Qatar': '634', 'Saudi Arabia': '682', 'Turkey': '792', 'Egypt': '818',
  'Mauritius': '480', 'Seychelles': '690', 'Japan': '392', 'South Korea': '410', 'China': '156', 'Hong Kong': '344', 'Australia': '036',
  'New Zealand': '554', 'United Kingdom': '826', 'France': '250', 'Switzerland': '756', 'Italy': '380', 'Spain': '724', 'Greece': '300',
  'Germany': '276', 'Netherlands': '528', 'Norway': '578', 'Iceland': '352', 'USA': '840', 'Canada': '124', 'Kenya': '404', 'South Africa': '710',
};
export const countryMatch = (name, feature) => (COUNTRY_NUM[name] ? feature.id === COUNTRY_NUM[name] : String(feature.properties.name || '').toLowerCase() === String(name || '').toLowerCase());

const placesOf = (trips) => {
  const m = new Map();
  trips.forEach((x) => { const k = x.place.trim().toLowerCase(); if (!m.has(k)) m.set(k, { name: x.place.trim(), trips: [] }); m.get(k).trips.push(x); });
  return [...m.values()];
};
// Everything the map groups: countries, Indian states / UTs and places - each with the trips there (visits) and the
// places still to visit (want). Keys: 'c:<country>', 's:<state>', 'p:<place>' (lower case).
export function travelGroups(visits, want) {
  const countries = new Map(), states = new Map(), places = new Map();
  const add = (m, key, base, x, kind) => {
    if (!m.has(key)) m.set(key, Object.assign({ key, visits: [], want: [] }, base));
    m.get(key)[kind].push(x);
  };
  const take = (x, kind) => {
    const place = x.place.trim(), country = x.country || '';
    const c = placeCoords(place, x.region, country);
    add(places, 'p:' + place.toLowerCase(), { name: place, region: x.region || '', country, type: x.type, at: c ? c.at : null, exact: !!(c && c.exact) }, x, kind);
    if (!country) return;
    add(countries, 'c:' + country.toLowerCase(), { name: country }, x, kind);
    if (country === 'India' && x.region) add(states, 's:' + x.region.toLowerCase(), { name: x.region, shape: stateShapeName(x.region), ut: x.type === 'ut' }, x, kind);
  };
  visits.forEach((x) => take(x, 'visits'));
  (want || []).forEach((x) => take(x, 'want'));
  const fin = (m) => [...m.values()].map((g) => Object.assign(g, { places: placesOf(g.visits), wantPlaces: placesOf(g.want) }))
    .sort((a, b) => b.places.length - a.places.length || b.visits.length - a.visits.length || a.name.localeCompare(b.name));
  return { countries: fin(countries), states: fin(states), places: fin(places) };
}
// A route: only for a trip that says where it started ("Travelled from") - from there to the place, both pinned on this
// phone; null otherwise.
export function routeOf(trip) {
  const from = trip.from;
  if (!from) return null;
  const a = placeCoords(from, '', ''), b = placeCoords(trip.place, trip.region, trip.country);
  if (!a || !b || (a.at[0] === b.at[0] && a.at[1] === b.at[1])) return null;
  return { from: a.at, to: b.at, fromName: from, mode: trip.mode || '' };
}
// The points of a gentle curve between two [lat, lng] (a quadratic bend to one side), for a route line.
export function curve(a, b, n) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[1] - a[1], dy = b[0] - a[0];
  const cx = mx + dx * 0.18, cy = my - dy * 0.18;   // the bend, at right angles to the line
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]); }
  return pts;
}
