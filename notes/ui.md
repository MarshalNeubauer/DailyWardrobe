# Notes from the UI pass (stream `ui`)

Outfit choice is unchanged: no `PLAN_RULES` bump. `ui.js` is a new app file (added to `ASSETS` in `sw.js`): `CACHE` needs its bump at the merge.

## Bullets for CLAUDE.md

### `ui.js`

- small pieces of interface every page shares (loaded after app.js; everything runs when called, nothing at load)
- `askConfirm(message, {ok, cancel, danger})` → `Promise<boolean>`: the app's own question, a sheet from the bottom like the piece picker (`#ask-sheet`/`#ask-backdrop`, made on first use, z-index above Settings, the setup and every sheet); the message's first paragraph is the question, the rest (after a blank line) the explanation; OK → true; Cancel, Escape, a tap outside or a second question → false (`askAnswer`); a destructive one (`danger`) has a red button and the focus starts on Cancel
- `tell(message)`: a plain notice, a toast kept up long enough to read (4–9 s by length)
- no `confirm()`, `alert()` or `prompt()` is left in the app's scripts (`tests/ui.test.js` checks the source); tests click `#ask-ok` / `#ask-cancel` instead of accepting a dialog
- "Forget everything" on the stats page forgets at once and offers Undo in the toast, instead of asking first (`forgetLearned`)
- `isConnected()`: a server address and a code are stored; `NEED_CONN` is the one sentence shown wherever something needs the connection
- `needConn(btn)`: called by the function that draws a button, after it set the button's own state: not connected → disabled, `needconn` class, the reason as its title and once under its row (`.connnote`); used by the month batch, this day's photo, item pictures, item photos; Today's Generate, the item sheet's "Read pattern from photo" (only for a weave the server alone can read, `claudeOnly`), Shirt weaves and the accuracy check write the same into their own markup
- Realistic photos while not connected shows the reason once at the top (`#photos-conn`), not under every button
- `addGate()` (from `renderAdd`): "Several items" is switched off with "Needs a connection" while not connected; "One item" works without
- `renderConnUI()` / `connPaste()` / `connSummary()`: Settings → Connection starts with what a connection gives and, while not connected, a field for the invite link (`connectFromLink`); the summary reads "Not connected", "Connected as <name>" or "Connected as the owner"
- `advToggle(btn)` / `advClose()`: the Advanced folds in Settings

### `index.html` / Settings

- what only the owner needs is in an "Advanced · For the person who runs the server" fold (`.adv`, `#adv-schedule`, `#adv-photos`, `#adv-tagging`, `#adv-connection`), closed every time Settings opens: Re-plan; Item photos; Shirt weaves and the accuracy check (the former "Tagging benchmark"); the server address and the code (`#cfg-url`, `#cfg-token`, still saved by Done)
- tests must open the fold before clicking inside it (`document.querySelector('#adv-schedule .adv-head').click()`)
- wording: nothing a tester reads says worker, Cloudflare, KV, token or benchmark ("the server", "Connect in ⚙ Settings first.", "it needs an update"); `tests/ui.test.js` reads all of Settings for those words
- error texts the code tests by pattern changed with it: `/Connect in|server doesn|Today’s limit/` in `generateRender`, `startItemPics`, `startBatch`
- the three page links (Wardrobe stats, Packing list, Laundry & cleaning) are one card (`.slinks`) under a "Your wardrobe" heading, each with a short line
- a Settings row whose dropdown doesn't fit beside its label wraps it onto its own line (Dark shirts was cut off at 390px)
- About: Send is switched off while not connected

### `styles.css`

- `--acc-ink`: the accent as text. #7a5900 on the light theme (5:1 on `--bg` and `--card`; `--acc` #d9a21b is 2.1:1), `--acc` on the dark theme; used by the weather link, `.gotoday`, `.linkbtn`, the eyebrows and the Settings icons; fills, borders and the tab bar keep `--acc`
- `--danger` is #e2695f on the dark theme (#c0473f was 3.5:1 on the dark card)
- `#pack` and `#care` are in the design system's page selectors (`:is(#wardrobe,#item-view,#add,#stats,#pack,#care,#settings-modal)`); their own copies of the button, input and `.btns` rules are gone
- `#toast` is above Settings, the setup and the sheets (z-index 2050, under a question) and `width:max-content`: at `left:50%` it wrapped at half the screen's width
- the setup's switches are ink when on, like the dress-code switches in Settings

### `app.js`

- Today with a wardrobe that can't dress a day yet: the "Get your first outfit" checklist (`setupToday`) is the first thing in the stage, above the figure or the day-off note (it was under the figure, in the side column)
- Refresh stays on Laundry & cleaning (`'care'` in `refreshAll`'s list of pages)
- an empty Wardrobe shows only its empty card: no search field, sort or type chips
- the Add card's swatch box reads "Fabric swatch · From the photo / From the fabric close-up: zoom and move it to a clean patch of cloth", with Zoom, Left–right, Up–down (it said "Precision Swatch Inspector", "X-Pos", "Y-Pos")
- plurals: "1 point behind" (stats.js `pts`), "planned about once" (analysis.js), "1 item", "1 band", "1 different look", "1 of 1 day locked"
- the Laundry page names a piece by its own name when it has one (`careName`)

## Testing

- `tests/ui.test.js`: the source check for dialogs, `askConfirm`, the Settings wording and folds, the accent's contrast (computed), buttons without a connection, the checklist's place, Refresh on the Laundry page, sizes and no sideways scroll of Packing list, Laundry, the item sheet's new fields and every setup step at 320/390/626px in both themes
- Playwright is not in the worktree's `node_modules`: run with `NODE_PATH=/opt/node22/lib/node_modules`
