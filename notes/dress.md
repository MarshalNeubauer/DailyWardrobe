# dress: the dress code, and no waistcoat by default

**Planner rules:** this changes how outfits are chosen only when the dress code is not the default (`settings.dress` with `jacket` or `tie` false). With no `dress` object the planner picks and scores exactly what it did (`tests/dress.test.js` compares three months of two wardrobes with a signature recorded from the app before the change). I don't think a `PLAN_RULES` bump is needed: no existing wardrobe is planned differently, and switching the dress code releases the locked week itself.

`CACHE` in `sw.js` needs its usual bump (`dress.js` is new in `ASSETS`). `worker.js` changed (one prompt line), so the merge deploys the worker.

## Bullets for CLAUDE.md

### `core.js`

- the dress code: `settings.dress = {jacket, tie}` (synced; a missing object or key means yes); `wearsJacket()` / `wearsTie()` read it
- `needsJacket(o)` / `needsTie(o)`: is an outfit without that piece short of one (not on a `casual` day, not when the dress code leaves it out); the score and Today's pieces list use them
- `dressOut(type)`: an item type the dress code leaves out (tie and tie clip; suit and blazer): not counted as never worn, not suggested
- `hasVest(i)`: a suit has a waistcoat only with `vest:'yes'`; while the wardrobe has no `settings.vestDef` (it is from before that rule) a suit with no value still has one, so nothing changes until its suits were given their value (dress.js)

### `planner.js`

- `outfit()` follows the dress code: without jackets every workday is planned like the `casual` occasion (`noJ`: no jacket, the shirt judged against the trousers, `day.nojkt` for `clothesScore`), with a tie when ties are worn; without ties (`noT`) no tie and so no tie clip is picked, and a pinned or locked tie is ignored
- a formal day, a wedding or a funeral is still dressed in full from what is owned (`full`), whatever the dress code; a day marked "No jacket or tie" has neither, also for someone who wears ties
- without jackets `planSim` keeps the previous workdays (`prev`) on every day, not only days with a jacket, so shirts and ties still avoid repeats and the Variety check works
- `rateOutfit`: 'Complete outfit' asks for a jacket or tie only when `needsJacket(o)` / `needsTie(o)`; 'Shirt and trousers' is checked on every day without a jacket that needs none; the Metals reason leaves the tie clip out when ties are not worn
- measured on the test wardrobe (9 jackets, 5 trousers, 8 shirts, 9 ties): each of the four combinations plans complete outfits scoring 96 or more with no hard check; without jackets 7 shirts and all 5 trousers rotate and no shirt is worn two workdays running

### `dress.js`

- the dress code's Settings switches and the waistcoat default (loaded after app.js)
- Settings → Schedule → Dress code (`renderDressUI`, `#cfg-dress`, rows from `DRESS_ROWS`): two switches (`.dress-sw`, `role="switch"`, 56×44px), "Jackets (suits and blazers)" and "Ties", each with one line of help; `setDress(k, on)` saves `settings.dress`, releases the locked week (`clearLocks`) and re-plans Today when Settings closes
- with jackets off the Blazer days group and the Suit vest row are hidden (`#blazer-group`, `#vest-row`, class `dress-hide`) and a note says so; `dressSummary()` gives the Schedule category's summary ("no ties", "no jackets", "no jackets or ties")
- `dressWhyUnused(i)`: why trousers, a shirt or shoes are never worn in a wardrobe without jackets (stats.js `whyUnused`)
- waistcoats: every suit saved by the app now carries `vest:'yes'` or `'no'` (Add card, editor, "Bought it"), and a new suit defaults to no waistcoat
- `migrateVests()` (start-up, and after a sync brought data in: `dressSynced`): once per wardrobe, every stored suit with no `vest` value gets `vest:'yes'` (saved with a new stamp, so it syncs) and `settings.vestDef = 1` is saved with the settings; the flag is part of the synced settings, so another device receives it with the suits and has nothing to do
- with backup switched on the suits are changed only right after a sync that went through: stamping this device's copy of a suit or of the settings before that would let an out-of-date copy win over a newer one from another device; until then `hasVest` reads the suits the old way, so the plan is the same while a device waits (or is offline)
- it reads the stored wardrobe (IndexedDB), not `items`: tests that put items straight into `items` are left alone
- an empty wardrobe is not flagged at start-up (one from before may still arrive by sync or from a backup file); a wardrobe with no suit from before is flagged when an item is added (`dressNewItem`, from `save()` and `shopBought`), without a new stamp on the settings
- `dressSynced(m)` also drops `settings.vestDef` and `settings.dress` from memory when the merged settings don't have them (`onSyncedData` spreads the stored settings over the ones in memory, so a key the stored ones lack would stay)

### `figure.js`

- no tie (`tie` null): an open collar (`.fig-open`: the throat between collar leaves that lie open on the shirt front) and, under a jacket, a buttoned placket down to the lapels' meeting point; in shirt sleeves the existing placket follows; with a tie the drawing is unchanged, character for character
- the figure's `aria-label` (draw.js `figureSvg`) says "open collar" when there is no tie

### `app.js`

- Today's pieces list (`slots`) has no Suit/Blazer row and no Tie / Tie clip rows for a piece the outfit lacks and the day doesn't need (`needsJacket`, `needsTie`), so no "Add one on the Add tab" for it; the rows stay while correcting a past day
- the month and Today's strip name a day without a jacket by its trousers ("Grey trousers") instead of "No jacket: grey trousers" when the dress code has no jackets (`shortTop`)
- photos: `outfitText` describes a jacket without a tie as "worn with the collar open and the top button undone, with no tie"; `comboSig` already had `-` in the tie's place, so a tieless outfit has its own photo key; a day without a jacket sends `nojacket` as before
- the Add card's and the editor's Vest choice show "No vest" unless the suit has one (`hasVest`)

### `worker.js`

- `RENDER_PROMPT` (jacket pose): "silk tie" became "a silk tie if one is listed (if none is listed he wears no tie: the shirt collar is open, the top button undone)"; the shirt-sleeves prompt already said "no tie unless one is listed"

### `analysis.js`

- the what-to-buy check follows the dress code: `compatBase` leaves out the types it excludes, the Ties (or Suits and Blazers) sections are skipped, no tie clip is suggested, reasons don't count ties, and excluded pieces are not listed as never planned; `shopSig` adds `|nojacket` / `|notie`, so the check runs again after a change
- without ties a shirt idea is ranked by the jackets it works with, a suit or blazer idea by the shirts
- not done: without jackets there are no shirt or trouser ideas (their ranking is built on jackets); shoes, belts, socks and coats are still checked against the real plan

### `stats.js`

- pieces the dress code leaves out are not counted as never worn (`buildStats().unused`), and `whyUnused` says so for one ("Your dress code leaves out ties…")

### `assemble.js`

- `asmNeeds()` asks for a waistcoat piece only for suits with `hasVest`
- not done: assembled pictures (switched off) still need a tie (`asmCan`), so a tieless outfit keeps a photo of its own, and `asmNeeds()` does not yet skip jacket or tie pieces the dress code excludes

## Testing

- `tests/dress.test.js`: the default plan against the recorded signature (`GOLD`, recorded from commit 671db36 with the test's own `PLAN_SIG` and `WARD`); the four combinations; the score; Today, the drawing, the photo text, key and the worker's prompt; stats and what to buy; the Settings switches in both themes at 390 and 626px; the waistcoat default, the migration, a new wardrobe, and two devices on one backup in either order
- `tests/multi.test.js`: "saved suits have their matching vest by default" now expects no waistcoat (the intended change)
- test wardrobes put into `items` by a test have no `settings.vestDef`, so their suits with no `vest` value still read as three-piece, as before
