// bucket-plan.js — Savings > Bucket List Plan, the part with no screen: every dream on any list that has a cost and a
// year becomes a savings goal. Pure - list in, plan out. The screen is bucket-plan-ui.js.
//
// For each goal (how goal-based saving is usually done in India, checked October 2026):
//   1. Today's cost grows with inflation to the target year (travel and experiences rise ~6% a year; editable).
//   2. Where the money waits depends on how far away the goal is - the nearer the date, the safer the place:
//        under 1 year  savings account, RD or a liquid fund          ~6.5% a year
//        1-3 years     FD, RD or a short-term debt fund               ~7%
//        3-5 years     a conservative or balanced hybrid fund         ~8.5%
//        5+ years      an equity index fund, by SIP                   ~10% (and move it to safer places 1-2 years before)
//      The returns are deliberately careful assumptions, not promises; they are kinds of place, never named products.
//   3. What has already been put aside grows at the same rate and comes off what is needed.
//   4. The monthly amount that gets there: a level saving at the end of every month until the target month.
// Then, with what can be put aside a month: goals in order of priority (must-dos, then the soonest year, then the
// list's own order) each take their monthly amount until their date, and the money frees up once a goal is reached.
// A goal that does not fit is moved a year later at a time (its cost growing) until it does, or 15 years have passed.

export const HORIZONS = [
  { upTo: 12, place: 'Savings account, RD or a liquid fund', rate: 6.5, why: 'Under a year away: keep it safe and easy to take out.' },
  { upTo: 36, place: 'FD, RD or a short-term debt fund', rate: 7, why: '1-3 years away: steady, with little risk to the amount.' },
  { upTo: 60, place: 'A conservative or balanced hybrid fund', rate: 8.5, why: '3-5 years away: some growth, with a cushion against falls.' },
  { upTo: Infinity, place: 'An equity index fund, by monthly SIP', rate: 10, why: '5+ years away: time to ride out ups and downs. Move it to safer places 1-2 years before.' },
];
export const MAX_DELAY_YEARS = 15;
export const horizonFor = (months) => HORIZONS.find((h) => months <= h.upTo);

// Months from this month to December of the target year (a goal "by 2027" is planned for the end of 2027).
export function monthsUntil(year, today) {
  const y = Number(String(today).slice(0, 4)), m = Number(String(today).slice(5, 7));
  return Math.max(0, (Number(year) - y) * 12 + (12 - m));
}
// What a level saving of 1 at the end of every month grows to over n months at a yearly rate.
export function fvFactor(ratePct, n) {
  const r = ratePct / 100 / 12;
  return n <= 0 ? 0 : r === 0 ? n : (Math.pow(1 + r, n) - 1) / r;
}
// One goal at a target year: its cost then, where to keep the money, and the monthly amount that gets there.
export function goalAt(g, year, inflationPct, today) {
  const months = monthsUntil(year, today);
  const h = horizonFor(months);
  const costThen = g.cost * Math.pow(1 + inflationPct / 100, months / 12);
  const savedThen = (g.saved || 0) * Math.pow(1 + h.rate / 100, months / 12);
  const need = Math.max(0, costThen - savedThen);
  const monthly = need <= 0 ? 0 : months > 0 ? need / fvFactor(h.rate, months) : need;
  return { year, months, place: h.place, rate: h.rate, why: h.why, costThen, savedThen, need, monthly };
}

// Every dream to plan: to do, with a cost and a target year; and the ones that still need a cost or a year.
export function goalsFrom(list) {
  const goals = [], missing = [];
  (list.profiles || []).forEach((p) => p.items.forEach((x, ix) => {
    if (x.done) return;
    const g = { id: x.id, pid: p.id, who: p.name, emoji: p.emoji, color: p.color, title: x.title, cat: x.cat, star: !!x.star, by: x.by, cost: x.cost || 0, saved: x.saved || 0, pos: ix };
    if (x.cost && x.by) goals.push(g); else missing.push(g);
  }));
  return { goals, missing };
}

// The whole plan. budget = what can be put aside a month (0: not set - each goal just shows what it needs).
export function planGoals(list, today, budget, inflationPct) {
  const { goals, missing } = goalsFrom(list);
  const thisYear = Number(String(today).slice(0, 4));
  const order = goals.slice().sort((a, b) => (Number(b.star) - Number(a.star)) || (a.by - b.by) || (a.pos - b.pos));
  const horizon = (MAX_DELAY_YEARS + 60) * 12;
  const free = new Array(horizon).fill(Math.max(0, Number(budget) || 0));
  const rows = order.map((g) => {
    const asked = goalAt(g, Math.max(g.by, thisYear), inflationPct, today);
    const out = Object.assign({}, g, { asked, plan: asked, status: budget > 0 ? null : 'unbudgeted', lateBy: 0 });
    if (!(budget > 0)) return out;
    // The first year (from the one asked) it fits: a level monthly amount if what is still free allows it every month;
    // otherwise a share of whatever is free each month - small while earlier goals take most, more once they are
    // reached - if that adds up in time.
    for (let d = 0; d <= MAX_DELAY_YEARS; d++) {
      const at = d === 0 ? asked : goalAt(g, Math.max(g.by, thisYear) + d, inflationPct, today);
      const n = Math.max(1, at.months);
      let level = true;
      for (let t = 0; t < n && level; t++) if (free[t] + 1e-6 < at.monthly) level = false;
      if (level) {
        for (let t = 0; t < n; t++) free[t] -= at.monthly;
        return Object.assign(out, { plan: Object.assign({}, at, { from: at.monthly, upTo: at.monthly }), status: d === 0 ? 'ontrack' : 'later', lateBy: d });
      }
      const rm = at.rate / 100 / 12;
      let fvAll = 0;
      for (let t = 0; t < n; t++) fvAll += free[t] * Math.pow(1 + rm, n - 1 - t);
      if (at.need > 0 && fvAll + 1e-6 >= at.need) {
        const k = at.need / fvAll;
        let from = null, upTo = 0;
        for (let t = 0; t < n; t++) { const c = free[t] * k; free[t] -= c; if (from == null) from = c; upTo = Math.max(upTo, c); }
        return Object.assign(out, { plan: Object.assign({}, at, { from, upTo, stepped: true }), status: d === 0 ? 'ontrack' : 'later', lateBy: d });
      }
    }
    return Object.assign(out, { status: 'no' });
  });
  const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
  const needNow = sum(rows, (r) => r.asked.monthly);
  // By year: what each year's goals cost then, in the plan's years.
  const years = new Map();
  rows.forEach((r) => { if (r.status === 'no') return; const y = r.plan.year; if (!years.has(y)) years.set(y, { year: y, goals: [], cost: 0 }); const e = years.get(y); e.goals.push(r); e.cost += r.plan.costThen; });
  return {
    rows, missing, budget: Math.max(0, Number(budget) || 0), inflation: inflationPct,
    costToday: sum(rows, (r) => r.cost), costThen: sum(rows, (r) => r.asked.costThen), saved: sum(rows, (r) => r.saved || 0),
    needNow, short: budget > 0 ? Math.max(0, needNow - budget) : 0, spare: budget > 0 ? Math.max(0, budget - needNow) : 0,
    onTrack: rows.filter((r) => r.status === 'ontrack').length, later: rows.filter((r) => r.status === 'later').length, impossible: rows.filter((r) => r.status === 'no').length,
    byYear: [...years.values()].sort((a, b) => a.year - b.year),
  };
}
