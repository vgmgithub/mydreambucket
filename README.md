# My Dream Bucket

A bucket list, the places you have been and the memories - kept private on your phone. It is the **My Bucket List**
feature of [MyNotes](https://github.com/vgmgithub/mynote-app) as an app of its own: the same screens, the same data.

- **My list** - one list per person; dreams with categories, stages, a year to aim for and a cost; tick one off with the
  month, the place and a memory.
- **Milestones** - a timeline of what came true, year by year.
- **Places** - the journey year by year; places to visit; a ranking you drag; travel insights; and a full-screen map
  (Standard, Satellite, Terrain or Chart) with each country and Indian state you have been to, routes and photos.
- **Insights** and the **Bucket List Plan** (what to save for each dream, and when).

## Bring your list from MyNotes

Menu (☰) > **Bring my list from MyNotes**. On the same phone and web address as MyNotes, the list is read straight from
MyNotes (MyNotes is never changed). Anywhere else, pick a MyNotes backup file (MyNotes: Menu > Backup > Download) - only
its Bucket List and trip photos are read. **Back up my list** saves this app's own backup file; **Restore** reads either kind.

## Privacy

Everything is stored on the phone (IndexedDB) - no account, no server, nothing sent to us. Backups are files you keep.
Opening the Places map downloads the map library (Leaflet) and the outlines of countries
([world-atlas](https://github.com/topojson/world-atlas), Natural Earth) and India's states
([india-maps-data](https://github.com/udit-001/india-maps-data)) from cdn.jsdelivr.net, and map pictures from Esri - your
places, names and photos are never sent.

## Run it

It is plain HTML, CSS and JavaScript modules - no build step. Serve the folder over HTTP (for example with Apache, or
`npx serve`) and open `index.html`. Add `?testdb=1` to use a separate test database.

```bash
npm test
```

## How it is put together

| Path | What it is |
|---|---|
| `js/shell/bucket*.js` | The Bucket List screens - **the same files as in MyNotes** (copy them across with `node tools/sync-from-mynotes.mjs`) |
| `js/core/app.js`, `db.js`, `core.js`, `js/money/personal-ui.js` | Small stand-ins for the MyNotes helpers those screens import (elements, sheets, dialogs, storage, currency) |
| `js/core/backup.js` | This app's backup, and reading a MyNotes backup |
| `js/main.js` | The app around the screens: header, menu, start |
| `styles.css` | The rules the Bucket List uses, taken from MyNotes' styles; `app.css` is the app shell |
| `service-worker.js` | Works offline (bump `CACHE` with every release) |

## Keeping it the same as MyNotes

The Bucket List is still in MyNotes too. When it changes there:

```bash
node tools/sync-from-mynotes.mjs ../mynote
npm test
```

Then bump `CACHE` in `service-worker.js` and `APP_VERSION` in `js/main.js`.
