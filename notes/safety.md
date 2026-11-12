# safety: notes for the lead

Outfit choice: **not changed** (no `PLAN_RULES` bump needed). `sw.js`: `safety.js` was added to `ASSETS`; `CACHE` still needs its bump.

## Bullets for CLAUDE.md

### `safety.js` (new heading, after `app.js`)

- data safety (loaded right after app.js, before tagging.js and sync.js): failed saves, storage that can't be opened, keeping the wardrobe, kept tagging copies, tagging failures, unsaved Add cards, a device's first sync; `tests/safety.test.js`, `tests/safetysync.test.js`
- `storeFailure(e)`: an error is a storage failure when `txs`/`atomic` marked it (`e.dwStore` = 'read' or 'write'), it is a `QuotaExceededError`, or it is an IndexedDB request's error event
- `saveFailed(e)` toasts it in plain words (`storeFailText`: "Couldn’t save: your phone’s storage is full…", else the browser's reason), once per 1.5 s since one failed save rejects more than one promise (`put` chains a `.then`)
- the `unhandledrejection` listener shows storage failures nobody caught and leaves every other rejection alone; Add's `save()` has no try/catch of its own, its rejection arrives there and the card stays to be saved again
- `dbDown`/`dbErr` are set by safety.js's own `db.then` at load: it is queued before sync.js's `db.then`, so the listener already knows storage is down when that one rejects, and stays quiet
- `storageDown(e)` (from the start-up chain's `catch`, through `afterScripts`): when `db` didn't open (or a start-up read failed) it puts `#nostore` over the whole page ("Your wardrobe can’t be opened here … can’t be loaded or saved", the browser's reason, Try again = reload) and makes `header`, `main` and `nav` inert; other start-up errors still fall back to the empty Today as before
- `askPersist()`: `navigator.storage.persist()` once (`localStorage.persist_asked`, the answer in `persist_ok`), from `save()` after an Add card is stored, and from `safetyStart()` for a wardrobe that already has items
- `safetyStart()` runs at the end of the start-up chain (after `appReady`): `pruneTagImgs()` and the persist request
- `pruneTagImgs()`: removes from Cache Storage `dw-keep-tagimg` the sharp copies whose item is not in `items` (nor an Add card); at start-up only, since a deleted item can be undone for a few seconds; never with an empty wardrobe (a lost one comes back from the backup)
- tagging failures: `ask()` (app.js) calls `tagFailText(status, json, error)` for a refused answer or a thrown error; it returns the Add page's note (`aiError`) and keeps the plain reason in `tagWhy`; a 429 `{error:'limit', message}` shows the server's `message` as is
- `addFiles` calls `tagFailed(q)` when `ask()` gave nothing and a server is set: `q.tagErr`, drawn by `tagFailNote(q,i)` at the top of the card (`.tagfail`: "This photo wasn’t tagged." + the reason + Try again); `retryTag(i)` asks again and fills the card; the card can still be filled in by hand and saved
- `guardUnsaved()` (from `addFiles` and `addManual`, once: `guardOn`) installs the `beforeunload` listener: leaving asks first while `queue` holds a card that is not a failed read
- `adoptBackupSettings(local, data)` (called by `syncOnce` before the merge): on a device that has never finished a sync (no `localStorage.last_sync`) whose stored settings carry a newer stamp than the backup's, the backup's settings win key by key (`{...local, ...backup}`, the backup's stamp), are stored and applied at once; keys only the device has (`setupDone`) stay; why: first-run setup stamps its settings before the device is connected, and they replaced the backup's holidays, days off, own colours and learned preferences
- after its first finished sync a device's changes count by stamp like any other's

### `app.js`

- `txs` and `atomic` reject on `onabort` too (`txFail`): a transaction aborted by a full disk used to settle neither way, so the Add card just stayed; the rejection is the browser's error marked `dwStore`
- `checkPlanRules()` stores `settings.planRules` with `metaPut` and no new stamp (not `saveUserSettings`): the stamp made a fresh install's defaults newer than the backup's settings, and on an existing device it could undo a setting changed on another device since its last sync
- only `saveUserSettings()` stamps the settings, and only something the user did should call it
- Today's pieces card says "1 piece"; the backup status, restore and roll-back messages say "1 item"

### `sync.js`

- `syncOnce` calls `adoptBackupSettings` (safety.js) on the downloaded backup before merging

### `styles.css`

- `/* ---- safety ---- */`: `.nostore` (the full-page message), `.tagfail` (the Add card's tagging failure)

## Still open (not done here)

- the backup is one blob with a 24 MB limit on the server: a large wardrobe will stop backing up; untouched as instructed
- `refreshHolidays()` (the monthly refetch of the holiday list) still goes through `saveUserSettings()` and stamps the settings: opened on a device that hasn't synced yet, it can beat a setting changed elsewhere since
- restoring a backup file on a never-synced device and then connecting it to a server that already has a backup: the server's settings win (first-contact rule); items and days merge as before
- `stats.js`, `shop.js` and `tagging.js` have counts that would read "1 points" / "1 items" in rare cases (`whyUnused` gaps, benchmark runs of one item); left alone, other streams are editing those files
