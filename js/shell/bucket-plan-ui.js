// bucket-plan-ui.js — Savings > Bucket List Plan: every dream with a cost and a year, from every person's list, turned
// into a savings plan - what each will cost by then, where to keep the money meanwhile, what to put aside a month, and,
// with what can be put aside, which fit on time and which move later. The maths is in bucket-plan.js.
import { el, $, toast, state, setAppMode, field } from '../core/app.js';
import { DB } from '../core/db.js';
import { appCur, curSym } from '../core/core.js';
import { fmtIntCur } from '../money/personal-ui.js';
import { normalise, updateItem, setPlan, catOf } from './bucket.js';
import { planGoals, HORIZONS } from './bucket-plan.js';

const KEY = 'bucketList';
const short = (v) => {
  const x = Math.round(Number(v) || 0), sy = curSym();
  if (appCur() === 'INR') { if (x >= 1e7) return sy + (x / 1e7).toFixed(1).replace(/\.0$/, '') + ' Cr'; if (x >= 1e5) return sy + (x / 1e5).toFixed(1).replace(/\.0$/, '') + ' L'; }
  else { if (x >= 1e6) return sy + (x / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (x >= 1e4) return sy + Math.round(x / 1e3) + 'K'; }
  return fmtIntCur(x);
};
async function load() { const r = await DB.get('meta', KEY).catch(() => null); return normalise(r && r.value); }
async function save(list) { await DB.put('meta', { key: KEY, value: list, updatedAt: new Date().toISOString() }); }
const todayISO = () => new Date().toISOString().slice(0, 10);

// For the Savings page card.
export async function bucketPlanCardSub() {
  const l = await load();
  const p = planGoals(l, todayISO(), l.plan.budget, l.plan.inflation);
  if (!p.rows.length) return 'Turn dreams with a cost into a savings plan';
  return p.rows.length + (p.rows.length === 1 ? ' dream' : ' dreams') + ' · ' + fmtIntCur(p.needNow) + '/month to fund';
}

export async function renderBucketPlan() {
  const host = $('#bucketPlanView');
  if (!host) return;
  const list = await load();
  if (state.appMode !== 'bucketplan') return;
  host.innerHTML = '';
  const today = todayISO(), year = Number(today.slice(0, 4));
  const p = planGoals(list, today, list.plan.budget, list.plan.inflation);

  if (!p.rows.length) {
    host.appendChild(el('div', { class: 'bk-welcome' }, [
      el('div', { class: 'bk-welcome-e', text: '🗺️' }),
      el('h2', { text: 'Bucket List Plan' }),
      el('p', { text: 'Give a dream on your bucket list a cost and a year to aim for, and it shows up here as a savings goal: what it will cost by then, where to keep the money, and what to put aside each month.' }),
      p.missing.length ? el('p', { class: 'bk-plan-miss-n', text: p.missing.length + (p.missing.length === 1 ? ' dream needs' : ' dreams need') + ' a cost and a year.' }) : null,
      el('button', { type: 'button', class: 'btn primary', text: '🪣 Open My Bucket List', onclick: () => setAppMode('bucket') }),
    ].filter(Boolean)));
    return;
  }

  // ---- The headline ----
  host.appendChild(el('div', { class: 'bk-hero bk-plan-hero' }, [
    el('div', { class: 'bk-plan-k', text: 'To fund every dream on time, put aside' }),
    el('div', { class: 'bk-plan-big' }, [fmtIntCur(p.needNow), el('small', { text: ' a month' })]),
    el('div', { class: 'bk-plan-sub', text: p.rows.length + (p.rows.length === 1 ? ' dream' : ' dreams') + ' · ' + short(p.costToday) + ' today → ' + short(p.costThen) + ' by their years (' + p.inflation + '% price rise a year)' + (p.saved ? ' · ' + short(p.saved) + ' already put aside' : '') }),
  ]));

  // ---- What can be put aside, and how fast prices rise ----
  const budget = el('input', { type: 'number', inputmode: 'decimal', min: '0', value: p.budget ? String(p.budget) : '', placeholder: 'e.g. 15000' });
  const infl = el('input', { type: 'number', inputmode: 'decimal', min: '0', step: '0.5', value: String(p.inflation) });
  const apply = async () => { await save(setPlan(await load(), { budget: Number(budget.value) || 0, inflation: Number(infl.value) || 0 })); renderBucketPlan(); };
  budget.addEventListener('change', apply); infl.addEventListener('change', apply);
  const verdict = !p.budget ? el('p', { class: 'bk-plan-verdict', text: 'Enter what you can put aside a month to see which dreams fit on time and which would need a later year.' })
    : p.short <= 0 ? el('p', { class: 'bk-plan-verdict is-good', text: '✅ ' + fmtIntCur(p.budget) + ' a month funds every dream on time' + (p.spare >= 1 ? ', with ' + fmtIntCur(p.spare) + ' to spare.' : '.') })
      : el('p', { class: 'bk-plan-verdict is-warn', text: '⚠️ ' + fmtIntCur(p.short) + ' a month short of funding every dream on time. With ' + fmtIntCur(p.budget) + ': '
        + [p.onTrack ? p.onTrack + ' on time' : null, p.later ? p.later + ' a little later' : null, p.impossible ? p.impossible + ' not within 15 years' : null].filter(Boolean).join(', ') + ' - see each below.' });
  host.appendChild(el('div', { class: 'card bk-plan-set' }, [
    el('div', { class: 'field-row' }, [
      field('I can put aside a month', budget),
      field('Prices rise a year (%)', infl),
    ]),
    verdict,
  ]));

  // ---- Year by year ----
  host.appendChild(el('div', { class: 'bk-h', text: '🗓️ Year by year' }));
  host.appendChild(el('div', { class: 'bk-plan-years' }, p.byYear.map((y) => el('div', { class: 'bk-plan-year' + (y.year === year ? ' is-now' : '') }, [
    el('b', { text: String(y.year) }),
    el('span', { text: y.goals.length + (y.goals.length === 1 ? ' dream' : ' dreams') }),
    el('small', { text: short(y.cost) }),
  ]))));

  // ---- Each goal ----
  host.appendChild(el('div', { class: 'bk-h', text: '🎯 The plan, dream by dream' }));
  host.appendChild(el('div', { class: 'bk-plan-list' }, p.rows.map((r) => goalCard(list, r))));

  // ---- Dreams still to give a cost and a year ----
  if (p.missing.length) {
    host.appendChild(el('div', { class: 'bk-h', text: '✏️ Give these a cost and a year to plan them' }));
    host.appendChild(el('div', { class: 'bk-plan-miss' }, p.missing.map((g) => el('button', { type: 'button', class: 'bk-idea', onclick: async () => {
      await save(Object.assign(await load(), { active: g.pid })); setAppMode('bucket');
    } }, [g.emoji + ' ' + g.title + (g.cost ? ' · needs a year' : g.by ? ' · needs a cost' : '')]))));
  }

  // ---- How to make it happen ----
  const tips = [
    ['🏦', 'One place for each dream', 'Keep each goal’s money apart from everyday savings - a separate RD, FD or fund - so it is not spent by accident.'],
    ['📅', 'Automate it on pay day', 'Set the monthly amount to move the day salary arrives. What is never seen is never missed.'],
    ['📶', 'Raise it with your pay', 'Add to the monthly amount when your salary rises; the goals come sooner, or bigger.'],
    ['🛡️', 'Safer as the date nears', 'For goals 5+ years away kept in equity, move the money to an FD or debt fund 1-2 years before you need it, so a market fall cannot cut the trip short.'],
    ['🎁', 'Bonuses and windfalls', 'Put part of a bonus, a tax refund or a gift straight into the nearest goal - then record it here under “put aside so far”.'],
    ['✈️', 'Spend less on the dream itself', 'Travel off-season, book early, and watch for fares and offers: the same dream often costs 20-30% less.'],
    ['🚫', 'Not on credit', 'Avoid funding a dream with a loan or card EMI - the interest makes it cost far more than planned.'],
    ['🚨', 'Emergency fund first', 'Keep 6 months of expenses safe before saving for dreams, so a surprise never eats into them.'],
  ];
  host.appendChild(el('div', { class: 'bk-h', text: '💡 Making it happen' }));
  host.appendChild(el('div', { class: 'ret-tips' }, tips.map(([i, h, t]) => el('div', { class: 'ret-tip' }, [el('span', { class: 'ret-tip-ico', text: i }), el('div', {}, [el('b', { text: h }), el('p', { text: t })])]))));
  host.appendChild(el('p', { class: 'hint bk-foot', text: 'Where to keep the money goes by how far away each dream is: ' + HORIZONS.map((h) => (h.upTo === Infinity ? '5+ years' : 'up to ' + (h.upTo / 12) + (h.upTo === 12 ? ' year' : ' years')) + ' - ' + h.place.toLowerCase() + ' (about ' + h.rate + '%)').join('; ') + '. These are careful assumptions, not promises; returns vary and market-linked ones can fall. General information, not financial advice.' }));
}

function goalCard(list, r) {
  const c = catOf(r.cat), a = r.asked, pl = r.plan;
  const badge = r.status === 'ontrack' ? ['is-good', '✓ On track for ' + pl.year] : r.status === 'later' ? ['is-warn', '⏩ Possible by ' + pl.year + ' (' + r.lateBy + (r.lateBy === 1 ? ' year' : ' years') + ' later)']
    : r.status === 'no' ? ['is-bad', '✕ Not within 15 years at this budget'] : ['', '🎯 By ' + a.year];
  const saved = el('input', { type: 'number', inputmode: 'decimal', min: '0', class: 'bk-plan-saved', value: r.saved ? String(r.saved) : '', placeholder: '0', 'aria-label': 'Put aside so far for ' + r.title });
  saved.addEventListener('change', async () => {
    await save(updateItem(await load(), r.pid, r.id, { saved: Number(saved.value) > 0 ? Number(saved.value) : 0 }));
    toast('Saved'); renderBucketPlan();
  });
  const monthly = pl.stepped
    ? fmtIntCur(pl.from) + ' now, up to ' + fmtIntCur(pl.upTo) + ' as earlier dreams are reached'
    : fmtIntCur(r.status === 'no' ? a.monthly : pl.monthly) + ' a month';
  return el('div', { class: 'bk-plan-goal' + (r.star ? ' is-star' : ''), style: '--pc:' + r.color }, [
    el('div', { class: 'bk-plan-goal-h' }, [
      el('span', { class: 'bk-plan-who', text: r.emoji + ' ' + r.who }),
      el('span', { class: 'bk-plan-badge ' + badge[0], text: badge[1] }),
    ]),
    el('div', { class: 'bk-item-t', text: (r.star ? '★ ' : '') + r.title }),
    el('div', { class: 'bk-plan-rows' }, [
      row(c.icon + ' Cost today', fmtIntCur(r.cost)),
      row('Cost in ' + pl.year + ' (' + (pl.months >= 12 ? Math.round(pl.months / 12) + ' yr' : pl.months + ' mo') + ')', fmtIntCur(pl.costThen)),
      el('div', { class: 'bk-plan-row' }, [el('span', { text: 'Put aside so far' }), saved]),
      row('Still to save', fmtIntCur(pl.need)),
      el('div', { class: 'bk-plan-row is-main' }, [el('span', { text: 'Save' }), el('b', { text: pl.need <= 0 ? 'Nothing more - funded 🎉' : monthly })]),
    ]),
    pl.need > 0 ? el('div', { class: 'bk-plan-where' }, [el('b', { text: '🏦 ' + pl.place + ' · ~' + pl.rate + '% a year' }), el('small', { text: pl.why })]) : null,
    r.status === 'later' ? el('p', { class: 'bk-plan-note', text: 'On time (' + a.year + ') it needs ' + fmtIntCur(a.monthly) + ' a month - more than is left after the dreams before it. A bigger monthly amount, or a bonus put in, brings it back.' }) : null,
  ].filter(Boolean));
}
const row = (k, v) => el('div', { class: 'bk-plan-row' }, [el('span', { text: k }), el('b', { text: v })]);
