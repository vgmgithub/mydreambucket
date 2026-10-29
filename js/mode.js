/* mode.js — which half of My Dream Bucket a page load belongs to (the same idea as HabitSeven's).
 *
 *   WEBSITE  index.html  → what a normal browser tab sees: what the app is, and the Install button.
 *   APP      app.html    → only runs inside the INSTALLED app (a home-screen / standalone window).
 *
 * Classic script, tiny, loaded first in <head> so the move happens before anything is drawn. `route()` is a pure
 * function of its inputs so it can be tested with made-up environments. Relative URLs only (the site works at a
 * domain's root and in a folder under Apache). The query string and hash are carried across (shortcuts: ?view=, ?action=).
 */
(function (root) {
  'use strict';

  // The app may run in a normal tab on the developer's own machine.
  var DEV_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];
  var DISPLAY_MODES = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];

  function isStandalone(env) {
    try {
      if (env.navigator && env.navigator.standalone === true) return true; // iPhone / iPad home-screen app
      if (typeof env.matchMedia === 'function') {
        return DISPLAY_MODES.some(function (m) { return env.matchMedia('(display-mode: ' + m + ')').matches; });
      }
    } catch (e) { /* treat as "not installed" */ }
    return false;
  }

  function isDevHost(env) {
    try { return DEV_HOSTS.indexOf(env.location.hostname) !== -1; } catch (e) { return false; }
  }

  // page: 'site' | 'app'. The relative URL to go to, or null to stay on this page.
  function route(page, env) {
    var tail = (env.location.search || '') + (env.location.hash || '');
    var installed = isStandalone(env);
    // The installed app opened at "/" → straight into the app.
    if (page === 'site' && installed) return './app.html' + tail;
    // The app opened in a plain browser tab → the website instead (except on the developer's machine).
    if (page === 'app' && !installed && !isDevHost(env)) return './' + tail;
    return null;
  }

  // Moves and stops the rest of the page loading (so the app never starts in a browser tab).
  function guard(page) {
    var to = route(page, root);
    if (!to) return false;
    root.__mdbRedirecting = true;
    try { root.stop(); } catch (e) { /* ignore */ }
    root.location.replace(to);
    return true;
  }

  root.MDB = {
    isStandalone: function () { return isStandalone(root); },
    isDevHost: function () { return isDevHost(root); },
    route: route,
    guard: guard,
  };
})(typeof window !== 'undefined' ? window : globalThis);
