# Stream `setup`: notes for the lead

How outfits are chosen: **not changed** (no `PLAN_RULES` bump needed). `sw.js`: `setup.js` was added to `ASSETS`; `CACHE` was not bumped.

## Bullets for CLAUDE.md

### `setup.js` (new heading, after `sync.js`)

- first-run setup and the empty states (loaded last, after sync.js): `#setup`, a full-screen flow in the style of Settings (a centred panel from 600px), made by `setupEl()` the first time it is needed; it is not in index.html
- `setupStart()` runs once at start-up, after the wardrobe, history and settings are read (the start-up chain in app.js calls it through `afterScripts`): it opens the setup when the wardrobe is empty, no day was ever recorded and `settings.setupDone` is not set
- someone who already has items never sees it: `setupStart` sets `settings.setupDone` in memory only, and it is stored with the next settings change (storing it at once would count as a change on the device and turn the next sync into a full one)
- steps (`SETUP_STEPS`: welcome, week, wear, weather, connect, done; `setupStep(k)` draws one, `setupGo(±1)` moves, `setupDraw()` redraws): each has Back and Next, and Skip in the header finishes at once
- the steps store through the app's own functions: `setupDay` → `toggleDay`, `setupUnits` → `setUnits`, `setupVest` → `setVestMode`, `setupPick` → `setLocation`, `setupLocate` → `useMyLocation`, `setupSearch` → `findCity`
- `setupSearch` puts its text in Settings' own `#cfg-city`, calls `findCity()` and reads `window._cities` (null afterwards = the search failed); `setupLocate` polls for `settings.location` to change, since `useMyLocation` gives no answer back
- What you wear: two switches write `settings.dress = {jacket, tie}` (`setupSetDress`; `setupDress()` reads it, a missing object or key = true) and release the coming week's locks (`clearLocks`); the planner does not read it in this file
- the vest: a new person who doesn't choose gets `settings.vestMode='never'` when the setup finishes (`setupFinish`, only for a setup that opened by itself); the stored default stays `auto` for everyone else
- Connection: connected = `localStorage.worker_url` and `app_token` both set (`setupConnected`), shown with a tick; otherwise a field for the invite link, given to `connectFromLink(text)` when the app has it, else read by `setupParseLink` (`#invite=<code>&w=<encoded address>` → `app_token`, `worker_url`)
- `setupFinish(toAdd)`: Skip (stays on Today) and the last step's button (goes to the Add tab; to Today when there are items) both store `settings.setupDone = Date.now()` through `saveUserSettings`
- Settings → "Run setup again" (`#setup-again`, under Connection) calls `setupOpen(true)`: the same flow, showing the stored vest choice and not forcing "no vest"
- a setup that opened by itself steps aside without being marked done when the app is driven past it (`setupYield(t)`, called first thing in `show()` and from `setupToday`): items came in (a sync on a new device, a restore) or another tab was opened; one started from Settings stays
- while it is up, `header`, `main` and `nav` are `inert` (`setupInert`); its z-index (980) is under Settings (1000)
- in a browser driven by a test program (`navigator.webdriver`) the setup does not open by itself unless the page sets `window.SETUP_AUTO=true` before the scripts load (`setupAuto()`): every test starts as a new install, and tests such as `theme` and "add an item without a photo" click the header and the tab bar straight away; `tests/setup.test.js` sets it with `addInitScript`
- Today's checklist (`setupToday()`, called by `renderToday`; rows from `setupNeeds()`): "Get your first outfit" lists a suit or blazer (jackets on), a shirt, a tie (ties on), trousers (no suit in the wardrobe, or jackets off) and shoes, ticks what is in rotation, and has a button to the Add tab; it returns '' once every row is ticked
- where the checklist goes: in place of the picture while the day has no outfit at all (an empty wardrobe, or no jacket and no shirt), above the score card while the planner already dresses part of the day (a shirt alone), and under the note on a day that is not a workday
- the empty Wardrobe (`setupWardEmpty()`, `#wempty`): a card with a drawn hanger and "Add your first item"; a type filter with nothing in it keeps "Nothing here yet"
- `tests/setup.test.js` covers the steps and what each stores, Skip and Done, an install with items, "Run setup again", both connection paths, stepping aside, the checklist for a suit-and-tie person and a no-jacket, no-tie person, and no sideways scroll at 320/390/626px in light and dark

### `app.js`

- the Add tab's note while not connected (`renderAdd`): "Photos won't be read automatically. Paste your invite link in Settings → Connection, or add items by hand."

## For the lead

- Settings → Connection still shows the address and code fields under their old labels; the Add note points there for the invite link, which the server engineer's work is expected to add.
- With the dress-code engineer's planner merged, check the no-jacket, no-tie checklist against it once: the checklist only counts items, it does not ask the planner.
