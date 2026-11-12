# about: notes for the lead

Outfit choice: **not changed** (no `PLAN_RULES` bump).

`CACHE` in sw.js: not bumped here. It **must** be bumped when this is merged, and from now on with every release (see the first sw.js bullet): the service worker no longer fetches app files from the network on each load.

After the merge, check `tests/about.test.js` "every localStorage key named in the app's scripts is in ABOUT_KEYS": a key another stream added has to be added to `ABOUT_KEYS` (about.js), or Delete my data leaves it behind.

## Bullets for CLAUDE.md

### Workflow (new bullets)

- **Every release bumps `CACHE` in `sw.js`.** Installed apps are served from their version's own cache and look only at `sw.js` for news: a change merged without a bump never reaches a phone. The number is also the version the app shows (Settings → About).
- While developing against a local server, a normal reload shows the installed version's files; a hard reload (Shift+reload) skips the service worker. The tests use a fresh browser context each, so they always get the files on disk.

### `sw.js` (replace "service worker: network-first app files, offline fallback")

- service worker: one version at a time. Installing downloads every file in `ASSETS` afresh (`cache:'reload'`) into the version's own cache (`CACHE`), and the page is then served from that cache only (cache-first; a file not in it comes from the network and is kept); works offline
- why: the earlier handler was network-first with a 4 s race per file, so an app reopened on a slow connection right after a release ran some new files and some old ones from the cache
- a new version installs in the background and waits (no `skipWaiting` at install): it takes over when the app is next started, or when the page sends `{type:'skipWaiting'}` (about.js `updateNow`); `{type:'version'}` with a message port answers the worker's version number
- a request made with `cache:'no-store'` is not handled (about.js reads the newest `sw.js` that way); `sw.js` itself is in `ASSETS`, so the page can read its own version from the cache
- `tests/sw.test.js` serves releases from its own server: a reload stays on the installed version, a bumped `sw.js` prompts and waits, Update switches and reloads with every file new, a version left waiting runs after the app is closed and opened, and a worker following the earlier network-first one takes over without a reload

### `about.js` (new heading, after `sync.js`)

- Settings → About (`SET_CATS` ends with `about`; markup `#sc-about` in index.html, whose head calls `toggleCat('about');renderAbout()`): version and updates, feedback, deleting one's data, the privacy note; loaded last
- `appVersion()`: the number in `sw.js`'s `CACHE` (`swVersionOf`), read once at start-up by fetching `sw.js` (`aboutReadVersion`): the service worker answers from the cache the page's files came from, so it is the version running, not the newest; null until read or when it can't be
- `checkForUpdate(manual)` (start-up, back in the foreground if the last check is over `ABOUT_FRONT_MS` 1 min old, every `ABOUT_CHECK_MS` 30 min, and the "Check for updates" button): `aboutLatest()` fetches `sw.js?check=<time>` with `cache:'no-store'`; a higher number starts the download (`reg.update()`), shows the toast "A new version is ready" with Update once per version (`aboutToasted`) and the Update button in About (`aboutShow`); it never reloads
- `updateNow()`: asks first when the Add tab has unsaved cards (`queue.length`, a `confirm`), then `reg.update()`, sends the waiting worker `{type:'skipWaiting'}` once it is installed and reloads on `controllerchange`; with no service worker, or none newer, it just reloads; a failed download or 45 s without the new worker (`ABOUT_INSTALL_MS`) says so and reloads nothing
- `aboutAdopt()`: a waiting worker of the very version the page already runs (the first start after sw.js stopped taking over by itself, when the old worker had loaded the new files from the network) is told to take over without a reload (`aboutAsk` asks a worker its version; it also listens for `updatefound`, since the browser's own check comes after the page loads)
- feedback (`sendFeedback`): `POST /feedback {text, version, where:'settings'}` with `x-app-token`; thanks on success, the server's `error` on failure, "isn't available yet" for a 404, "needs a connection" when not connected (`aboutConn` reads `worker_url`/`app_token`)
- `loadFeedback()` (from `renderAbout`, and after sending): `GET /me`, and only for `role:'owner'` `GET /feedback`, listed newest first in `#fb-list` (name, date, version, text as plain text); any other answer shows nothing
- delete my data: `askDelete()` unfolds `#del-confirm` with what goes and the buttons "Delete everything" (connected only), "Delete from this device only" and Cancel; `deleteMyData(server)` → `wipeDevice()` → reload
- `wipeDevice()`: clears every store of the IndexedDB database, closes it and deletes it (`ABOUT_DB`), deletes the `dw-keep-*` caches, and when online the service worker's caches and registration (offline they stay, or the restart would find no app), and removes the app's localStorage keys (`ABOUT_KEYS`, `ABOUT_KEY_PREFIXES`: `nav_fit`); other keys on the origin are left alone (GitHub Pages sites of one account share an origin, so no `localStorage.clear()`)
- a new localStorage key must be added to `ABOUT_KEYS`: `tests/about.test.js` reads the scripts' sources and fails on a key that isn't there
- "Delete everything" sends `DELETE /account {confirm:'delete'}` first, with the connection already taken out of localStorage and the sync timer stopped so no backup goes up meanwhile; a 404 (older server) still clears the device and says the server's copy is still there; any other failure deletes nothing, puts the connection back and gives the reason
- deleting from the device only also removes the connection (otherwise the next sync would bring the wardrobe back); the confirmation says the server's copy stays and comes back on connecting again
- what to say after the restart is carried in `sessionStorage.about_note` (`ABOUT_NOTE`) and shown as a toast by `aboutStart()`
- the privacy note is a `<details class="about-fold">` in index.html; styles under `/* ---- about ---- */` at the end of styles.css (`.about-text`, `.about-note`, `.fb-item`, `.about-confirm`, `.about-fold`)
- `tests/about.test.js` mocks the server (`/me`, `/feedback`, `/account`) with `page.route`

### README.md

- rewritten: what the app is, joining by invite link, privacy, hosting (GitHub Pages + the Cloudflare Worker and its settings), running the tests; the screenshots `wa0.png`…`wa6.png` in the root were deleted (nothing referenced them)
