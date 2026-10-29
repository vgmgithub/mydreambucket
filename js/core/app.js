// app.js (My Dream Bucket) — the few MyNotes helpers the Bucket List screens use: building elements, the pop-up
// sheet, toasts, the confirm dialog, form fields and the switch between the list and the plan. The screens in
// js/shell/bucket*.js are the same files as in MyNotes; this file stands in for MyNotes' js/core/app.js.
export const state = { appMode: 'bucket' };

export const $ = (sel, root) => (root || document).querySelector(sel);

export function el(tag, props, children) {
  const n = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const val = props[k];
      if (k === 'class') n.className = val;
      else if (k === 'text') n.textContent = val;
      else if (k.startsWith('on') && typeof val === 'function') n.addEventListener(k.slice(2), val);
      else n.setAttribute(k, val);
    }
  }
  if (children) for (const c of children) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
}

let toastTimer = null;
export function toast(msg, onTap) {
  const existing = $('.toast');
  if (existing) existing.remove();
  const t = el('div', { class: 'toast' + (onTap ? ' is-tappable' : ''), text: msg });
  if (onTap) t.addEventListener('click', () => { clearTimeout(toastTimer); t.remove(); onTap(); });
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), onTap ? 7000 : 2200);
}

// The app's own dialogs in place of the browser's confirm() / alert() (which print the site address).
let _dialogEl = null;
function _showDialog(message, buttons) {
  return new Promise((resolve) => {
    if (_dialogEl) _dialogEl.remove();
    const done = (v) => { if (_dialogEl) { _dialogEl.remove(); _dialogEl = null; } document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(buttons.length > 1 ? false : undefined); };
    document.addEventListener('keydown', onKey);
    const box = el('div', { class: 'app-dialog', role: 'alertdialog', 'aria-modal': 'true' }, [
      el('div', { class: 'app-dialog-msg', text: String(message == null ? '' : message) }),
      el('div', { class: 'app-dialog-btns' }, buttons.map((b) => el('button', { type: 'button', class: 'btn ' + b.cls, text: b.text, onclick: () => done(b.value) }))),
    ]);
    _dialogEl = el('div', { class: 'app-dialog-back' }, [box]);
    document.body.appendChild(_dialogEl);
    const first = _dialogEl.querySelector('.btn.primary, .btn.danger');
    if (first) first.focus();
  });
}
const _DANGER_RE = /delete|erase|wipe|replace|remove|cannot be undone|lose/i;
export function appConfirm(message, opts) {
  const danger = opts && opts.danger != null ? opts.danger : _DANGER_RE.test(String(message));
  return _showDialog(message, [
    { text: 'Cancel', cls: 'ghost', value: false },
    { text: (opts && opts.okText) || (danger ? 'Yes, continue' : 'OK'), cls: danger ? 'danger-fill' : 'primary', value: true },
  ]);
}
export function appAlert(message) { return _showDialog(message, [{ text: 'OK', cls: 'primary', value: undefined }]); }

export const field = (labelText, inputNode) => el('div', { class: 'field' }, [el('label', { text: labelText }), inputNode]);

// ---- The pop-up sheet: one at a time; the phone's Back closes it ----
let _modalEntry = false, _popsToIgnore = 0, escHandler = null;
export function openModal(node) {
  if (!_modalEntry) { try { history.pushState({ modal: true }, '', location.pathname + location.search); _modalEntry = true; } catch (_) {} }
  const host = $('#modalHost');
  host.innerHTML = '';
  host.appendChild(node);
  host.classList.remove('hidden');
  host.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('locked');
  document.body.classList.add('locked');
  host.onclick = (e) => { if (e.target === host) closeModal(); };
  escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', escHandler);
}
function _hideModal() {
  const host = $('#modalHost');
  host.classList.add('hidden');
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = '';
  document.documentElement.classList.remove('locked');
  document.body.classList.remove('locked');
  if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
}
export function closeModal() {
  _hideModal();
  setTimeout(() => {
    if (!_modalEntry || !$('#modalHost').classList.contains('hidden')) return;
    _modalEntry = false; _popsToIgnore++;
    try { history.back(); } catch (_) { _popsToIgnore--; }
  }, 0);
}

// ---- The list ('bucket') and the plan ('bucketplan'): one screen at a time ----
const _modes = {};
export function onMode(mode, draw) { _modes[mode] = draw; }
export function setAppMode(mode) {
  const back = state.appMode !== mode && mode !== 'bucket';
  state.appMode = mode;
  document.body.dataset.mode = mode;
  $('#bucketView').classList.toggle('hidden', mode !== 'bucket');
  $('#bucketPlanView').classList.toggle('hidden', mode !== 'bucketplan');
  $('#bucketBottomNav').classList.toggle('hidden', mode !== 'bucket');
  if (back) { try { history.pushState({ mode }, '', location.pathname + location.search); } catch (_) {} }
  window.scrollTo(0, 0);
  if (_modes[mode]) _modes[mode]();
}
window.addEventListener('popstate', () => {
  if (_popsToIgnore) { _popsToIgnore--; return; }
  if (_modalEntry) { _modalEntry = false; _hideModal(); return; }
  if (state.appMode !== 'bucket') setAppMode('bucket');
});
