# pack: notes for the lead

Changed how outfits are chosen: **no** (planner.js untouched; no `PLAN_RULES` bump). `pack.js` is new in `ASSETS` (sw.js), so `CACHE` needs its bump.

## Bullets for CLAUDE.md

### `pack.js` (new heading, after `stats.js`)

- the packing list page (Settings → Packing list `#pack-btn`, and "Packing list for a trip" at the top of Today's open month, `packMonthBtn` from `monthGridHtml`): the `#pack` section, shown by `show('pack')` through `packShow(t)` (called at the end of `show()`), `openPack`/`renderPack`
- the trip (`packTrip()`, `localStorage.pack_trip` `{a, b, j, s}`: first and last day as `YYYY-MM-DD`, most jackets and pairs of shoes, 0 = no limit) defaults to the workdays of the week starting next Monday (`packDefault`); a stored trip that is over makes way for it; at most `PACK_MAX` (31) days (`packSetDate`)
- `packDays(t, plan)`: every day of the range with its outfit from `planMonth` (or from a plan passed in), `o` null on a day off or a day with nothing planned; the page lists each with the month's stack drawing (`stackSVG`) and `shortTop`/`shortRest`
- `packList(days, wear)` → `{groups, worn, counts, total}`: every distinct piece once with its days (`n`), grouped by type in `TYPES` order (`PACK_TITLE`); a suit's `o.bot` is the suit itself and is not counted again; a suit worn with its vest says so
- one belt per shoe colour worn (`leatherGroup` of the shoes): the belt planned most often with that colour, so two brown belts planned on different days are one line
- what the wardrobe lacks is a line without an item (keys `x-belt-<group>`, `x-links`, `x-coat`): a belt for shoes with none that matches, cufflinks for a French-cuff shirt, a coat on a cold or wet day
- the count line (`packCount`, `PACK_COUNTED`: suits, blazers, dress pants, shirts, ties, shoes, socks; nouns in `PACK_NOUN`)
- ticks and travel wear are kept per trip on the device (`localStorage.pack_marks`: `{'<a>_<b>': {t:[line keys], w:[item ids], at}}`, the newest `PACK_TRIPS` 8; `packMark`/`packSetMark`, `packTick`, `packWear`); a piece marked Wear moves to "Wearing on the way" and is not counted; `packWearDay` marks the first outfit day's whole outfit (`packWornIds`: its belt is the list's belt for that shoe colour)
- pack lighter (`packLight(t, base)`, memoised on the `cache` object): with a limit below what the trip uses, the trip's days are planned again on a copy of the day records (`packPlanOf(recs, end)`: `planSim` from the shared start with `dayRecs` swapped, like `planWith`)
- `packLightRecs(days, AJ, AS)`: each live day rules out (`rec.skip.top` / `.shoes`) every jacket of its kind and every pair of shoes not in the allowed sets, drops its lock, and takes the other kind of jacket (`rec.kind`) when none of its own kind is allowed and the day has no occasion; pieces picked by hand (`rec.force`) and days already worn are never changed and come first in the allowed sets (`packTally`)
- up to `PACK_TRIES` (3) sets of jackets × 3 sets of shoes are tried, the most worn first (`packSets`), with one suit and one blazer first when the limit is 2+ and the trip has both; the best by `packRate` wins (outfit scores, −50 for a hard check, −1000 for an incomplete outfit, −3000 for each piece over the limit); measured 100 ms on the test wardrobe
- the page shows the lighter plan's outfits and list with what it saves (`packSaved`) and the average score before and after; nothing is saved until "Keep this plan", which locks the trip's days to it (`packLock` → `packLockDays`, which also saves `rec.kind` for a day that took the other kind)
- keep these outfits: `packLockDays` gives every live day of the trip `rec.lock = lockIds(o)` (the app's own lock, which only covers 7 days); `packLockState` counts the days whose lock is what the plan shows; the page says Locked / n of m days locked / Not locked; `packRelease` removes the locks
- `clearLocks()` (a planner setting, an occasion, Re-plan) releases a trip's lock like any other; the page then says Not locked
- `packText(t, days, list)` is the plain-text list (title, count line, groups, travel wear, the outfits per day); `packCopy` uses `navigator.clipboard`, falling back to a hidden textarea; Share (`packShare`) only where `navigator.share` exists
- `tests/pack.test.js`; `PACK_SHOTS=<folder>` saves pictures of the page at 320/390/626px in both themes

### `styles.css`

- `#pack` is not in the `:is(#wardrobe,#item-view,#add,#stats,#settings-modal)` design-system rules (shared lines); the `/* ---- pack ---- */` block repeats the button, input and card rules for it

### `app.js`

- `show(t)` ends with `packShow(t)` (pack.js), which hides or shows `#pack`; the Refresh button's list of pages includes `pack`
