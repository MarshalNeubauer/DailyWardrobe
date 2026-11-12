# wardrobe stream: notes for the lead

How outfits are chosen: NOT changed (no `PLAN_RULES` bump needed). `sw.js` has `wardrobe.js` added to `ASSETS`; `CACHE` was not bumped.

## Bullets for CLAUDE.md

### `core.js`

- `MATERIALS_BY`: the materials offered per item type for `item.material` (suit, blazer, pants, shirt, tie, socks, overcoat, raincoat; lower-case names, shown with `cap1`); shoes and belts (their `leather`), watches (band and metal), cufflinks and tie clips have no list
- `itemName(i)` / `itemTitle(i)` / `titleCls(i)`: an item's own name (`item.name`), what it is called on screen (the name, else `desc(i)`), and the class for it (`named`: shown as typed; `cap`: a description, capitalised)
- they are in core.js, not wardrobe.js, because Today is drawn at start-up, which can be before the later scripts have loaded: with them in wardrobe.js the start-up render threw now and then and the app came up with an empty wardrobe (`items=[]` in the start-up `catch`)
- the planner's texts (`desc`, `nm`, `rateOutfit` notes, `outfitText`) never use the name

### `wardrobe.js`

- the Wardrobe tab's search and sort, the item fields `name` / `brand` / `material` / `notes`, and Delete with Undo (loaded after stats.js; app.js calls in from `renderWardrobe`, `wardList`, `itemBody`, `save` and `rm`)
- search: a field above the type chips (`wardBar`, `#wsearch`, `wardQ`); every word typed must be in the item's name, brand, notes, material, type, colour names or pattern (`wardHay`, `wardMatch`; case and accents ignored); it combines with the type chip and stays when the chip changes
- typing redraws only the grid and the count (`wardSearch` → `wardRefresh`: `#wslide`, `#wcount`, `#wclear`), never the field, so the focus and the keyboard stay; a full `renderWardrobe` while the field is in use (a sync arriving) puts the focus and the caret back (`wardKeep`/`wardBack`)
- the header count reads "n items", or "n of m items" when a chip or the search narrows the list (`wardCount`); × in the field clears it (`wardClear`, also Escape)
- nothing matches: `#wnone` (`wardGrid`) says so, with "Clear search" and, when a chip is on and other types match, how many and "Search all types"
- sort: the dropdown beside the search field (`#wsort`, `WARD_SORTS`, `setWardSort`), remembered in `localStorage.ward_sort`: By type (the type chips' order, newest first within a type), Newest first, Most worn, Longest since worn (never worn first), Colour, A to Z (by the title shown)
- By type used to sort by the type's key, so "All" began with belts; it now follows `Object.keys(TYPES)`, suits first
- Most worn and Longest since worn count the days really worn (`wardWear` over `wornDays()` in stats.js) and each box says "Worn n times" / "Last worn 3 Nov" / "Not worn yet" (`.wwear`)
- Colour groups by family (`WARD_FAMS`: neutrals, blues, browns, greens, reds, purples, then pieces shown by their metal; `WARD_FAM` over the planner's `fam`), light to dark within each (`lumCol`, the item's `shade` counted)
- `wardView()` is the list on screen (chip, search, sort) and `wardList()` in app.js returns it, so the item sheet's ‹ ›, swipes and "n of m" follow the filtered, sorted list; it is kept in `wardMemo` until the next redraw (`wardFresh`), since the sheet's swipe asks for it on every touch move
- `wardGrid(list)` draws the grid (moved here from `renderWardrobe`): a box's title is `itemTitle(i)`
- fields: `item.name` (60 characters), `item.brand` (40), `item.material` (40), `item.notes` (500) (`WARD_FIELDS`, `WARD_MAX`); an empty one is removed from the item
- the item sheet's Details card has Name and Brand at its top (`wardFieldsTop`), Material and Notes at its end (`wardFieldsEnd`); `setItemField` saves a text field when it is left and 600 ms after the last keystroke (`itemFieldSoon`: a sheet swiped away never tells a field it was left) without redrawing the sheet (the next field tapped would lose its focus); only the header's title and the grid follow
- Material (`matRow`) is None, the type's `MATERIALS_BY` list, Other; Other shows "Which material?" and the text typed is the material (`'other'` until something is typed); types without a list show no Material row
- the Add card has "More details" (`moreRow`, `toggleMore`, `q.more`), folded until tapped, with the same four fields (`setQField`, kept on the card as typed); folded with something in it, it says "n filled in"; `wardSaveFields(q,it)` in `save()` copies them onto the item
- a name is the item's title in the Wardrobe grid, the item sheet's header, Today's pieces list and the piece picker (and their `aria-label`s)
- the fields are ordinary item properties, so they sync, back up, restore and roll back with the item (whole items are merged, newest wins)
- Delete (`rm` → `wardDelete`) no longer asks: it removes the item at once, closes the sheet and shows the toast "Deleted <name>" with Undo for `WARD_UNDO_MS` (8 s)
- Undo (`wardUndelete`) writes the item back as it was (same id, photos, close-up, tags, fields, rotation state, its place in `items`) with `updated` one above the deletion's time, and saves again any day record that referred to it and was changed meanwhile (a day re-planned without it)
- why that survives a sync: the tombstone stays, and in `mergeState` a tombstone only wins over an item whose stamp is not newer; so the restored item wins on every device, also on one that had already taken the deletion; a delete that is not undone propagates as before
- `tests/wardrobe.test.js`: search by each field and with a chip, each sort order, the sheet stepping through the filtered list, the fields (sheet, Add card, two synced devices, backup file restored on an empty device), the name in its four places, materials by type, delete / Undo with and without a sync in between, sizes and no sideways scroll at 320 / 390 / 626px in both themes

### `app.js`

- `renderWardrobe` draws the header count (`#wcount`), `wardBar()` above the chips and the grid through `wardGrid(wardFresh())` (wardrobe.js)

### `styles.css`

- the block `/* ---- wardrobe ---- */` at the end: `.wfind` (search field and sort on one row), `.wsearch`, `.wclear`, `.wsort`, `.wwear`, `.wnone`, `.named`, `.wfld`, `.wnotes`, `.morefold` / `.morebtn` / `.morein`

## Existing tests changed

- `tests/compare.test.js`: its second item is now dress pants, not a suit. The test steps blazer → next → next and relied on "All" sorting by type name (blazer before suit); with the chips' order a suit comes first. Intended: that order is the bug this stream fixes.

## Seen while testing (not from this stream)

- `tests/watchmatch.test.js` "a chronograph is drawn with subdials…" fails on the starting commit too, so `npm test` cannot pass and the map has no fresh `# tested` stamp.
- under the shared machine's load (load average 14–20) `itempics`, `prefetch`, `daysoff`, `month`, `climate`, `shopswipe` each failed in one run or another and passed when run alone.
