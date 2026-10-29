/* My Dream Bucket website — the moving parts. Plain JavaScript, nothing to build; the page reads fine without it.
   Install flow as on the HabitSeven site: the browser's own install prompt when it offers one, else the steps for this
   browser in a pop-up; once installed, every Install button says so. No tracking, no visit counting. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const fine = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } },
  };

  /* ── toast ── */
  const toastEl = $('#toast');
  let toastTimer = 0;
  function toast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 3200);
  }

  /* ── service worker (offline + installability) ── */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' }).catch(() => {}); });
  }

  /* ── platform (for the install steps) ── */
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isIOSSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  const isFirefox = /Firefox|FxiOS/.test(ua);
  const isSamsung = /SamsungBrowser/.test(ua);
  const isMacSafari = !isIOS && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
  const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  /* ── install ── */
  const SHARE = '<svg class="ios-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let deferred = null;                              // the saved beforeinstallprompt event
  let installed = store.get('mdb_installed') === '1';

  function note(msg) { $$('[data-install-note]').forEach((n) => { n.textContent = msg; }); }
  function renderInstall() {
    $$('[data-install]').forEach((btn) => {
      const label = $('[data-install-label]', btn) || btn;
      if (!label.dataset.orig) label.dataset.orig = label.textContent;
      label.textContent = installed ? (btn.classList.contains('nav-cta') ? 'Installed ✓' : 'Installed — open it from your home screen') : label.dataset.orig;
      if (installed) btn.setAttribute('data-state', 'installed'); else btn.removeAttribute('data-state');
    });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();                             // our own buttons instead of the browser's mini bar
    deferred = e;
    installed = false;                              // the browser only offers this when it is NOT installed
    store.del('mdb_installed');
    renderInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    store.set('mdb_installed', '1');
    renderInstall();
    note('Installed! Open My Dream Bucket from your home screen or app list.');
    toast('My Dream Bucket installed ✓');
  });

  function steps(title, items, extra) {
    return (title ? '<p><b>' + title + '</b></p>' : '') + '<ol>' + items.map((i) => '<li>' + i + '</li>').join('') + '</ol>' + (extra ? '<p>' + extra + '</p>' : '');
  }
  function helpHTML() {
    if (!('serviceWorker' in navigator) || window.isSecureContext === false) {
      return '<p>This browser can’t install web apps here. Please open this page in a current <b>Chrome</b>, <b>Edge</b> or <b>Safari</b> over a secure (https) connection.</p>';
    }
    if (isIOS) {
      if (isIOSSafari) {
        return steps('Add it to your Home Screen', [
          'Tap the <b>Share</b> button ' + SHARE + ' in Safari’s toolbar.',
          'Scroll down and choose <b>Add to Home Screen</b>.',
          'Tap <b>Add</b>.',
          'Open <b>Dream Bucket</b> from your Home Screen.',
        ]);
      }
      return '<p>On iPhone and iPad, installing works from <b>Safari</b>. Open this page in Safari, tap <b>Share</b> ' + SHARE + ', then <b>Add to Home Screen</b>.</p>';
    }
    if (isAndroid) {
      if (isSamsung) return steps('Add it to your home screen', ['Open the browser menu (☰).', 'Tap <b>Add page to</b>, then <b>Home screen</b>.', 'Confirm, then open <b>Dream Bucket</b> from your home screen.']);
      if (isFirefox) return steps('Install My Dream Bucket', ['Open the <b>⋮</b> menu.', 'Tap <b>Install</b>.', 'Open <b>Dream Bucket</b> from your home screen.']);
      return steps('Install My Dream Bucket', [
        'Open the browser menu <b>⋮</b>.',
        'Tap <b>Install app</b> (or <b>Add to Home screen</b>).',
        'Confirm with <b>Install</b>.',
        'Open <b>Dream Bucket</b> from your home screen.',
      ], 'Don’t see it? Let the page finish loading, then try again.');
    }
    if (isFirefox) return '<p>Firefox on a computer can’t install web apps. Open this page in <b>Chrome</b> or <b>Edge</b> (or <b>Safari</b> on a Mac) to install My Dream Bucket.</p>';
    if (isMacSafari) return steps('Add it to your Dock', ['Open the <b>File</b> menu.', 'Choose <b>Add to Dock…</b>', 'Click <b>Add</b>, then open My Dream Bucket from your Dock.']);
    return steps('Install My Dream Bucket', [
      'Look for the <b>install icon</b> at the right end of the address bar — or open the <b>⋮</b> menu and choose <b>Install My Dream Bucket</b> (Chrome: <i>Cast, save and share → Install page as app</i>).',
      'Click <b>Install</b>.',
      'Open <b>My Dream Bucket</b> from your apps or desktop.',
    ], 'Not there? Let the page finish loading and try again, or use a current Chrome, Edge or Safari.');
  }
  const dlg = $('#install-dialog');
  function openHelp() {
    $('#install-dialog-body').innerHTML = helpHTML();
    if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
    else if (dlg) dlg.setAttribute('open', '');
  }
  if (dlg) dlg.addEventListener('click', (e) => { if (e.target === dlg && dlg.close) dlg.close(); });   // a tap outside closes it
  function onInstall() {
    if (window.MDB && MDB.isStandalone()) { note('My Dream Bucket is already running as an app.'); return; }
    if (installed) {
      note('My Dream Bucket is already installed on this device — open it from your home screen or app list.');
      toast('Already installed — open it from your home screen.');
      return;
    }
    if (deferred) {                                 // the browser's own install prompt
      const ev = deferred;
      deferred = null;                              // a saved prompt can only be used once
      ev.prompt();
      Promise.resolve(ev.userChoice).then((c) => {
        note(c && c.outcome === 'accepted' ? 'Installing… look for Dream Bucket on your home screen or app list.' : 'No problem — you can install any time.');
      }).catch(() => {});
      return;
    }
    openHelp();                                     // no prompt to show: this browser's steps
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-install]');
    if (b) { e.preventDefault(); onInstall(); }
  });
  renderInstall();

  /* ── install steps: one device at a time, the visitor's own first ── */
  (function howTabs() {
    const tabs = $$('.how-tabs [data-p]');
    if (!tabs.length) return;
    const pick = (p, focus) => {
      tabs.forEach((t) => { const on = t.dataset.p === p; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
      $$('.how-steps').forEach((s) => s.classList.toggle('shown', s.dataset.p === p));
    };
    tabs.forEach((t, i) => {
      if (t.dataset.p === platform) t.insertAdjacentHTML('beforeend', '<span class="yours">Your device</span>');
      t.addEventListener('click', () => pick(t.dataset.p));
      t.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); pick(tabs[(i + d + tabs.length) % tabs.length].dataset.p, true); }
      });
    });
    pick(platform);
  })();

  /* ── header: glass once scrolled; the section in view is marked ── */
  const nav = $('#nav');
  const links = $$('.nav-links a');
  let lastY = window.scrollY;
  function onScrollNav() {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 12);
    // Out of the way while reading down, back when scrolling up.
    nav.classList.toggle('hide', y > 640 && y > lastY + 4 && !nav.contains(document.activeElement));
    if (y < lastY - 4 || y < 640) nav.classList.remove('hide');
    lastY = y;
  }
  if ('IntersectionObserver' in window && links.length) {
    const ids = links.map((a) => a.getAttribute('href').slice(1));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => { if (a.getAttribute('href') === '#' + en.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ids.forEach((id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ── reveal on scroll ── */
  const reveals = $$('[data-reveal], .ladder');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach((n) => io.observe(n));
  } else reveals.forEach((n) => n.classList.add('in'));

  /* ── ideas ticker: the list twice, so it loops without a seam ── */
  const track = $('.ticker-track');
  if (track) { track.innerHTML += track.innerHTML; $$('span', track).slice(track.children.length / 2).forEach((s) => s.setAttribute('aria-hidden', 'true')); }

  /* ── counters count up once seen ── */
  const counters = $$('[data-count]');
  if ('IntersectionObserver' in window && !reduce) {
    counters.forEach((c) => { c.textContent = '0'; });
    const co = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        co.unobserve(en.target);
        const end = Number(en.target.dataset.count), t0 = performance.now(), dur = 1400;
        const step = (t) => { const k = Math.min(1, (t - t0) / dur); en.target.textContent = String(Math.round(end * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => co.observe(c));
  }

  /* ── scroll-linked: the hero's layers (parallax), the map tilting flat, the timeline filling ── */
  const layers = $$('.scene .layer');
  const hero = $('.hero');
  const mapFrame = $('#map-frame');
  const timeline = $('#timeline');
  let ticking = false;
  function onScroll() {
    onScrollNav();
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const vh = window.innerHeight;
      if (!reduce) {
        const y = window.scrollY;
        if (y < (hero ? hero.offsetHeight : vh) * 1.2) layers.forEach((l) => { l.style.transform = 'translate3d(0,' + (y * Number(l.dataset.depth || 0)).toFixed(1) + 'px,0)'; });
        if (mapFrame) {
          const r = mapFrame.getBoundingClientRect();
          const k = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.75)));   // 0 as it comes in, 1 once well up the screen
          mapFrame.style.transform = 'perspective(1400px) rotateX(' + ((1 - k) * 16).toFixed(2) + 'deg) scale(' + (0.92 + k * 0.08).toFixed(3) + ')';
        }
      }
      if (timeline) {
        const r = timeline.getBoundingClientRect();
        const k = Math.max(0, Math.min(1, (vh * 0.7 - r.top) / r.height));
        timeline.style.setProperty('--p', k.toFixed(3));
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ── phones lean towards the pointer (computers only) ── */
  if (fine && !reduce) {
    $$('[data-tilt]').forEach((ph) => {
      const base = getComputedStyle(ph).transform;
      const keep = base && base !== 'none' ? base + ' ' : '';
      ph.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1)';
      const box = ph.closest('.hero-visual, .split-visual') || ph;
      box.addEventListener('pointermove', (e) => {
        const r = box.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        ph.style.transform = keep + 'perspective(1000px) rotateY(' + (x * 12).toFixed(2) + 'deg) rotateX(' + (-y * 10).toFixed(2) + 'deg)';
      });
      box.addEventListener('pointerleave', () => { ph.style.transform = ''; });
    });
  }

  /* ── "Try it": tick off a dream ── */
  (function tryIt() {
    const card = $('#try-card'), tick = $('#try-tick'), reset = $('#try-reset');
    if (!card || !tick) return;
    const mem = $('.try-mem', card), chips = $('.try-chips', card);
    const LINE = '“The sky danced green for an hour. Worth every rupee.”';
    let typing = 0;
    function burst() {
      if (reduce) return;
      const colors = ['#7ee8d3', '#8ec5ff', '#b794f6', '#fdba74', '#f472b6', '#fcd34d', '#22c55e'];
      for (let i = 0; i < 26; i++) {
        const c = document.createElement('i');
        c.className = 'confetti';
        const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 110;
        c.style.setProperty('--x', (Math.cos(a) * d).toFixed(0) + 'px');
        c.style.setProperty('--y', (Math.sin(a) * d - 40).toFixed(0) + 'px');
        c.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg');
        c.style.background = colors[i % colors.length];
        c.style.animationDelay = (Math.random() * 0.08).toFixed(2) + 's';
        card.appendChild(c);
        setTimeout(() => c.remove(), 1400);
      }
    }
    function done() {
      card.classList.add('done');
      tick.setAttribute('aria-pressed', 'true');
      chips.insertAdjacentHTML('beforeend', '<i class="yay">✅ Came true · Feb 2027</i>');
      burst();
      let k = 0;
      clearInterval(typing);
      if (reduce) mem.textContent = LINE;
      else typing = setInterval(() => { mem.textContent = LINE.slice(0, ++k); if (k >= LINE.length) clearInterval(typing); }, 28);
      reset.hidden = false;
    }
    function undo() {
      clearInterval(typing);
      card.classList.remove('done');
      tick.setAttribute('aria-pressed', 'false');
      const y = $('.yay', chips); if (y) y.remove();
      mem.textContent = '';
      reset.hidden = true;
    }
    tick.addEventListener('click', () => (card.classList.contains('done') ? undo() : done()));
    reset.addEventListener('click', undo);
  })();

  window.addEventListener('offline', () => toast('You’re offline — this page still works from your device.', 4200));
})();
