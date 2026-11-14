# CLAUDE.md

## Workflow

- **Merge automatically.** When a task is finished and tested, commit, push, open a pull request against `main`, and merge it without asking. Then tell the user what was merged and link the PR.
- **Don't merge when:**
  - tests fail or a change couldn't be verified;
  - the result is uncertain or only partly works;
  - the user says to wait.

  In those cases, push the branch, report the problem, and leave the PR unmerged.
- If the working branch's earlier PR is already merged, start the next change on top of the latest `main`. Merge `main` into the branch rather than force-pushing.
- The app is served from `main` by GitHub Pages, so a merge is a deploy.
- **Other sessions may be merging at the same time.** Right before merging, fetch `main`; if it moved since the branch was made or last updated:
  1. merge `origin/main` into the branch and resolve any conflicts;
  2. if `main` changed `CACHE` in `sw.js` or `PLAN_RULES` in planner.js, and this branch bumps it too, bump it again to one above `main`'s value (two sessions bumping to the same number is a single bump, so phones would miss the second change);
  3. re-run `npm test` on the merged result, push, and only then merge. If tests fail after the merge, apply the "Don't merge" rule.
- **The re-run after merging `main` is small.** It runs only the tests that both `main`'s incoming change and yours can affect, and says so ("main has moved since `npm test` last passed on this branch").
- When `main` brought only docs, or code that none of your tests uses, it prints "Nothing more needs to run" and stamps the map for the merged files: commit the map, push and merge.
- The re-run is your whole selection again, as before, when both sides changed the same file (a second `CACHE` bump in `sw.js` counts), when `main` changed `tests/run.js`, `tests/impact.js` or `package.json`, or when you edited a file after the merge.
- The small re-run needs `npm test` to have passed on the branch before `main` was merged in, with its map committed: so test and commit first, then fetch and merge `main`.
- Measured: a branch that selects 89 tests (100 s); `main` moved by a docs change: 0 run again (1 s); `main` changed `openStats()`: 6 run again (7 s).
- **No GitHub test run.** GitHub doesn't run the tests on pull requests (the user dropped it to save the wait). Your own `npm test` on the final branch is the only gate: merge right after it passes, without waiting on GitHub checks or subscribing to the PR.
- **Nightly full test run** (2026-11-14, the audit; `.github/workflows/nightly-tests.yml`): every check (`npm run test:all`) on `main` at 01:00 UTC on GitHub's Ubuntu runner, nothing deployed; a failure emails the owner, its failing checks are in the run's summary and the log is kept 14 days (`test-log`); run it by hand with `gh workflow run nightly-tests.yml`; it never gates a merge. Tests run on Linux there: a test that leans on Windows (`tasklist`, paths) must work on both (the GPU guard's `alive` uses `process.kill(pid,0)` off Windows)
- a test that counts sync requests waits for the devices to be still first (`tests/sync.test.js`: `quiet` = no sync running and `stateSig` unchanged over three checks 120 ms apart, after `recordRun`; `settle` syncs both devices until they hold the same wardrobe; `hush` calls off a device's scheduled backup): a sync that brings changes redraws Today, which records the day and re-locks the week in the background (`recordRun` in today.js) and schedules a backup, and either device's late write landing during the count made it flaky (about 1 run in 4 under load, 2026-11-14; 0 in 40 after)
- **`npm test` runs only the checks the change can affect** (the user's rule: never the whole suite for a small change). It compares the branch with `origin/main`, prints what changed and why each test runs, and runs nothing for a docs-only change.
- `npm run test:all` runs every check. It is not needed before a merge; use it only when the selection looks too small for what you changed.
- Test runs rewrite `tests/impact.map` (what each test uses). Commit it with the change: later sessions choose their tests from it.
- **The map must be in the commit (enforced).** `git push` is refused while `tests/impact.map` has uncommitted changes; commit it and push again. Never bypass it with `--no-verify`.
- **A changed app file needs a new `CACHE` name (enforced).** The service worker serves one version at a time, so phones take changed files only when `CACHE` in sw.js changes; `git push` is refused when the branch changed a file in sw.js's `ASSETS` while its `CACHE` number is not above `origin/main`'s (`cacheStale` in tests/impact.js, part of the pre-push check, which fetches `main` first for up to 8 s and falls back to the local copy offline): merge `origin/main`, bump it to one above `main`'s, run `npm test`, commit and push again.
- If a change reaches `main` without its map, or without a passing `npm test` on the final files, the next session's `npm test` notices and runs every check. So run `npm test` after your last code edit, then commit everything it changed.
- A conflict in `tests/impact.map` needs no thought: `.gitattributes` merges it by keeping both sides' lines (`merge=union`).
- Never tell the user to download a backup file before a change: the worker keeps daily backups and Settings → Roll back undoes a bad change (see `sync.js`).
- **Run only what you need while working.** `node tests/run.js <name>` (or `TEST_ONLY=<name>`) runs just the `tests/*.test.js` files whose name contains `<name>`. Run `npm test` once before pushing, and once more only if `main` had to be merged in.
- **CLAUDE.md: one fact per line.** Add a new bullet under the file's heading instead of extending an existing one, so sessions working in parallel don't edit the same line and conflict.

## Project

Static app served from `main` by GitHub Pages (no build step): classic scripts loaded in index.html's order, sharing one global scope; Web Workers (asm-worker.js, analysis-worker.js) `importScripts` some of them. The server is a Cloudflare Worker (worker.js and its ES modules in worker/), deployed with Wrangler. The sections below go by file, in load order; a long section groups related facts under #### headings. Each bullet is one current fact; when something changes, add a bullet under the file's heading (or replace the fact when you are sure it is superseded) rather than appending "(replaces … above)" notes. (Rewritten 2026-11-14 from the bullets as they stood: superseded history removed, each fact stated once.)

### `index.html`

- markup and script tags
- the tabs are Today, Wardrobe and Insights (`TABS` in start.js; `#n-stats` shows the `#stats` page, titled Insights, with no ‹)
- Add is a page of the Wardrobe (`openAdd` in add.js: the Wardrobe header's "+ Add" `#ward-add`, the setup's buttons, a pasted photo), with a ‹ back to where it was opened (`SUBS` has `add`; `subOpen`/`subBack`)
- Insights starts with "What to buy" (`shopButton()`), then the stats
- What to buy waits for a wardrobe big enough to judge (`shopGate`, `SHOP_MIN` in shop.js: 3 jackets, or 3 pairs of trousers when the dress code has no jackets; 5 shirts; 4 ties when ties are worn; 2 pairs of shoes, all in rotation): until then the card says what to add and doesn't open (`openShop` returns)
- the page links (Packing list, Laundry & cleaning) are one card (`.slinks`) under a "Your wardrobe" heading, each with a short line
- wording: nothing a tester reads says worker, Cloudflare, KV, token or benchmark ("the server", "Connect in ⚙ Settings first.", "it needs an update"); `tests/ui.test.js` reads all of Settings for those words
- error texts the code tests by pattern: `/Connect in|server doesn|Today’s limit/` in `generateRender`, `startItemPics`
- Privacy: outfit pictures are drawn or painted by the app; item photos and the outfit go to OpenAI only on a tap of Generate photo or Generate item pictures
- the user's phone may run the Dark Reader extension; the page opts out via the `darkreader-lock` meta tag; keep it

#### Settings

- what only the owner needs is in "Advanced · For the person who runs the server" folds (`.adv`: `#adv-photos`, `#adv-connection`), closed every time Settings opens (`advClose` in ui.js); the server address and the code (`#cfg-url`, `#cfg-token`, still saved by Done) are under Connection
- tests must open a fold before clicking inside it (`document.querySelector('#adv-connection .adv-head').click()`); Advanced sections other than Connection's show only with `body.owner` (a test adds the class, or connects as the owner)
- Outfit pictures (`#sc-photos`) → Advanced: Pictures ahead, "Painted plain" (`asmGapUI`, which lists a textured shirt with no reading) and the graphics-chip switch
- Pictures ahead (`asmCmUI`, `asmCmStatus`, `#cm-status`): of the looks of the next `ASM_AHEAD` (60) days' workdays painted on a colour-coded master, how many the computer has built (`asmListGet`'s keys), how many this phone holds (`asmFor`), and when the list was read; the worker's list has no dates, so it can't say when the computer last built
- the Accuracy check (benchmark) was removed and Photo tagging has no Advanced fold; `benchEstimate` stays (the colour picker's cost)
- the Colour-coded masters switch is gone; a phone's stored `asm_cm` is cleared at start-up; `asmCmSet` stays for the tests; Item photos (the earlier assembler's) is gone too
- Schedule → "Start the plan over" (`replanButton` in history.js, `#replan-btn`; 2026-11-14, the owner's ask: "completely redo the plan, throwing out my locks and changes"), for everyone, not in a fold: today and every coming day not marked worn lose the week's locks and the owner's changes (`dayChanged`: swaps, picks, the vest, a piece taken off, the suit or blazer chosen; `replanFuture()`); occasions, days off, worn days and the past stay; it asks first
- a rules change (`replanFuture(true)`) only releases locks after today and keeps picks
- the Suit vest row hides when ties are off too (`renderDressUI`), with a note: no waistcoat is planned without a tie
- a Settings row whose dropdown doesn't fit beside its label wraps it onto its own line (Dark shirts was cut off at 390px)
- About: Send is switched off while not connected

#### Today (today.js)

- Today's date is "Thu, November 12" below 360px (`.dlong`/`.dshort`) so the day never wraps alone
- the folded pieces box (`piecesLine`, `piecesBox`): a jacket, trousers, shirt or tie the owner named is called by its name exactly as typed (`itemName`; "Medium Grey suit", not "mid grey worsted suit"), the others by colour; the line is escaped (`esc`); `tests/piecesname.test.js`
- the picture has no share button (2026-11-14, the owner: "the user can just send a screenshot"; it was `shareMark`/`shareOutfit`, `.wshare`, at its top right)

#### Today's cloth swatches (today.js)

- the picture shows the day's cloth bottom left (`swatchStack`, the owner's choice from mockups): the jacket's, shirt's and tie's swatches top to bottom, no rim, no names; only the pieces worn; above ✕ (`.up`) on days that show ✕ and ✓; hidden while zoomed; pictures only (the drawn figure already shows its cloth); `tests/todayswatch.test.js`
- they are 64 px (radius 13px, 9px apart) with a soft shadow (`0 2px 7px rgba(0,0,0,.28)`): the owner's choice from mockups at 52/64/76/90 px
- `ovlItem`: a jacket's or shirt's stripes in Claude's colours (`patternSpec.across`, as the painter draws them; measured from the photo a thin stripe blurs into the ground), each at least `OVL_LINE` (0.1) of a repeat
- `ovlSvg`: a tie's pattern at half size (`scale(.5)`)
- which source (`ovlPiece`, the owner's choice from a 64 px comparison): a tie, and a plain or finely woven suit or blazer, with a precision swatch (`item.swatch` with `swSrc` 'tex') shows that close-up (`ovlCloseup` and not `ovlDrawn`; painted twill grain read as a flat square at 64 px)
- striped, checked and figured jackets, and those without a close-up, are painted (`ovlSuitPng`): a 260 px PNG (`OVL_PX`), the read bands two repeats across, anti-aliased, a windowpane's crossing lines at least `OVL_CROSS` (.06) of a repeat at `OVL_CROSS_A` (.75), the cloth's grain (`ovlGrain`: twill, herringbone, linen, else plain weave) at `OVL_GRAIN` (2.2); a jacket with a stripe, check or figure and no band reading keeps the drawn tile; cached (`OVL_SUITS`)
- a close-up patch barely shows a pattern at that size (his ink aubergine pinstripe read as plain dark cloth), hence `ovlDrawn` for a band or motif reading, or a stripe, check or motif pattern
- a shirt is always drawn, never its close-up (the owner: as in the mockup he chose)
- a shirt's figured weave is drawn at higher fidelity (`ovlWeave` → `texTileSmooth` in draw.js, the owner's choice "Smooth + thread grain": a soft 6 px tile read blurry, a sharp one as pixel steps)
- a herringbone shirt's swatch is the painter's own cloth (`ovlHbShirt`: `asmCmTile`, its colour held and every other column lighter, `OVL_HB_PAIRS` 5 column pairs across, an `OVL_HB_PX` 512 px PNG; the owner's pick "D"): the drawn tile at 2.2x read as harsh charcoal zigzags; made once per look, asynchronously, a plain patch of the shirt's colour meanwhile (`data-hb`), the drawing if it can't be made; `tests/hbswatch.test.js`
- a twill suit's or blazer's swatch is the painter's own block (`ovlCuSuit`, 2026-11-14, the owner: "show the block of pattern the painter uses for the texture now, not the close up"): `asmCuTile`'s whole 256 px tile in the tagged colour, made once per look asynchronously (a plain patch meanwhile, `data-hb`, `OVL_CU`); only where the painter takes it (`asmCmRoute` 'twill' and `asmCuWants`: a close-up, not near-black), else, or with no clean patch, as before (`ovlSuitOld`); `tests/twillswatch.test.js`
- tapping a swatch opens it up close (`.ovsw`, `swTap`; the owner's pick from mockups): the swatch shows large at the top left (`.swlens`, 46% of the picture) with no name under it (the owner's ask); share, ✕ and ✓ hide; the photo zooms `SW_Z` (2.3) and moves so the piece lands at `SW_AT` (70% across, 40% down), ringed (`.swring`)
- the piece's spot is per colour-coded master (`SW_SPOT`: the point deepest inside each piece, measured from the masters' masks, the jacket's body without sleeves and lapels; `swKind` picks the master, `asmCmUse`, else suit/vest/shirt-tie/shirt-open by the outfit)
- another swatch switches; the same one, a tap on the picture, the double-tap zoom or another day close it (`swClose`, `foldAll`); a redraw of the day keeps it open (`swApply` after `applyZoom`)
- while one is open the small swatches stay where they are at 64 px when the big swatch leaves room, and shrink and move down only as far as they must (the owner: "stay the same size if they don't have to move"): `.fig.photo` is a size container, size `min(64px, max(36px, 18cqw - 16.7px))`, the offset above ✕ kept while `54cqw - 232px` allows it, gaps 9 px; about 48 px on a 390 px phone, 64 px in place on the Duo upright (688 px picture)
- the open small swatch's outline is 1.5 px of white at 70% (the owner: 2.5 px solid white was too thick and bright)
- the picture's frame is `overflow:clip` and `swApply` resets its scroll: the zoomed photo made it scrollable, and a tap's focus on the swatch scrolled it, pushing the big swatch and ring out of place
- `tests/swatchzoom.test.js` checks 390, 375, 330 and 720 px with real taps, and the outline

### `styles.css`

- styles
- design system for every page but Today (`:is(#wardrobe,#item-view,#add,#stats,#pack,#care,#settings-modal)`; Today keeps its own tuned styles): page header `.phead` (22px title, `.pcount`, `.pback`), buttons and inputs 44px (`--ctl-h`/`--in-h`), radius 12px on controls and 14px on cards, bordered cards, `.pri` filled, `.danger` red outline
- the base button rule uses `:where()` so page rules override it
- `tests/uipages.test.js` checks sizes, titles and no sideways scroll at 320/466/626px
- `/* ---- safety ---- */`: `.nostore` (the full-page message), `.tagfail` (the Add card's tagging failure)
- `/* ---- wardrobe ---- */`: `.wfind` (search field and sort on one row), `.wsearch`, `.wclear`, `.wsort`, `.wwear`, `.wnone`, `.named`, `.wfld`, `.wnotes`, `.morefold` / `.morebtn` / `.morein`
- text fields: `--field`, the card colour (white) on the light theme and the page colour (grey) on the dark one, for every input, select and textarea of the pages, Settings, the setup and the sheets (the owner's choice)
- swatches and item thumbnails in lists have a thin `--swatch-edge` border (dark on light, light on dark): navy and charcoal disappeared on the dark card
- every dropdown in Settings is on its own line under its label, full width (`#settings-modal .srow select{flex:1 1 100%}`)
- Settings' sticky header is opaque (`var(--bg)`): text scrolled under it showed through
- `--acc-ink`: the accent as text, #7a5900 on the light theme (5:1 on `--bg` and `--card`; `--acc` #d9a21b is 2.1:1), `--acc` on the dark theme; used by the weather link, `.gotoday`, `.linkbtn`, the eyebrows and the Settings icons; fills, borders and the tab bar keep `--acc`
- `--danger` is #e2695f on the dark theme (#c0473f was 3.5:1 on the dark card)
- `#toast` is above Settings, the setup and the sheets (z-index 2050, under a question) and `width:max-content`: at `left:50%` it wrapped at half the screen's width
- the setup's switches are ink when on, like the dress-code switches in Settings
- reduced motion: the score's checks, the pieces list's rows and the month's days animate only under `prefers-reduced-motion: no-preference` (their `:not(.instant)` rules outranked the reduce rules), and the cards' arrows (`.score .chev`, `.month-link .chev`) turn at once
- tap targets (the `/* ---- accessibility ... */` block at the end): Today's day arrows, a piece's ⇄ and − and the Wardrobe's type chips keep their look and take taps over 44px (a `::after` past the box, counted from inside the 1px border); `.linkbtn` has 4px padding above and below (26px)
- `.score .pts` is `color-mix` of `--mut` and `--ink` (over 4.5:1 in both themes)
- the folded score list (`#sbox:not(.open) #spanel .mpanel-in`) is `visibility:hidden`, so it isn't read out or reached by Tab

### `core.js`

- colours, types, item helpers (no DOM; also loaded by background workers)
- `isWorkday(d)` = a weekday in `settings.workdays` that is not a day off (`offName(d)`: a public holiday in `settings.holidays` `{country, list:[{d,n}], skip}` that is not skipped, or one of the user's own `settings.daysOff` `[{d,n}]`; dates as `YYYY-MM-DD`, `isoKey`)
- the planner skips days off like weekends
- `inRotation(i)`: false for an item the user took out of rotation (`item.paused`, synced with the item); it stays in the wardrobe and in past outfits
- bought, on the way: `item.order` with `item.paused`, optionally `item.arrives` (YYYY-MM-DD); `inRotation(i, n)` is true for day number `n` (`di`) after the arrival date (`arriveN`), so the plan includes it from then on
- `inRotation(i, n)` / `arriveN` serve pieces away being cleaned too: `item.arrives` holds `item.away.back`
- `item.shade` (−6…+6 steps of `SHADE_STEP` 4 L*, `shadeHex`/`shadeFor`/`shadeName`): the owner's darker/lighter for the drawn main colour (`colOf`); the tag, the planner (`planCol`, `lumOf`) and photo keys keep the tagged colour
- shade is set on the Add card and in the editor (`shadeRow`, `stepShadeQ`/`matchShadeQ`, `stepShadeE`/`matchShadeE` in add.js); "Match close-up" uses the close-up's measured lightness
- `desc(i)` names a metal only for `METAL_TYPES` (watch, belt, cufflinks): an Add card carries `metal` 'silver' for every type, and a suit's or shoes' caption read "· silver"
- `MATERIALS_BY`: the materials offered per item type for `item.material` (suit, blazer, pants, shirt, tie, socks, overcoat, raincoat; lower-case names, shown with `cap1`); shoes and belts (their `leather`), watches (band and metal), cufflinks and tie clips have no list
- a shoe's material by style (`leathersFor`): a sneaker in leather (stored `calf`, shown "Leather"), suede, canvas or knit (`SHOE_TEXTILES`, textured in draw.js `leatherLayers`, finish `textile`); a boot in calf, suede, the grains or cordovan; a loafer in calf, suede, patent or cordovan; oxfords, derbies and belts in every leather
- the Add card and the item sheet label it "Material" on every pair of shoes, right under Style and above More details / Notes (`leatherLabel`; belts keep "Leather"); a style change to one that can't be in the material makes it plain leather
- shoes can be white or cream (sneakers), and the second colour is a sneaker's sole
- `stone` (pale grey-beige chinos, family tan) and `denim` (indigo, family blue) are trouser colours; "stone" doesn't read as khaki
- one title style: `.cap` doesn't capitalise every word; `sentence(t)` capitalises a generated description's first letter (`itemTitle`, the item sheet, the piece picker, Today's pieces line, Laundry, Stats, What to buy); a name the user typed is shown exactly as typed
- `itemName(i)` / `itemTitle(i)` / `titleCls(i)`: an item's own name (`item.name`), what it is called on screen (the name, else `desc(i)`), and the class for it (`named`: shown as typed; `cap`: a description, capitalised)
- they are in core.js, not wardrobe.js, because Today is drawn at start-up, which can be before the later scripts have loaded: in wardrobe.js the start-up render threw now and then and the app came up with an empty wardrobe
- the planner's texts (`desc`, `nm`, `rateOutfit` notes, `outfitText`) never use the name
- `avgText(v)`: an average score with one decimal, rounded down ("99.9"), "100" only when every day scored 100; Stats' "What costs you points" is "Small deductions" and What to buy says "days with a deduction"
- the dress code: `settings.dress = {jacket, tie}` (synced; a missing object or key means yes); `wearsJacket()` / `wearsTie()` read it
- `needsJacket(o)` / `needsTie(o)`: is an outfit without that piece short of one (not on a `casual` day, not when the dress code leaves it out); the score and Today's pieces list use them
- `dressOut(type)`: an item type the dress code leaves out (tie and tie clip; suit and blazer): not counted as never worn, not suggested
- trousers have a kind (`item.trouserKind`: chinos or jeans; none = dress trousers) and shoes a style (`item.shoeStyle`: derby, loafer, boot, sneaker; none = oxford): `trouserKind(i)`, `shoeStyle(i)`, `TROUSER_KINDS`, `SHOE_STYLES`; `typeWord(i)` names them in `nm()` ("denim jeans", "brown loafers")
- items from before have neither kind nor style and plan exactly as before (`tests/dress.test.js` GOLD unchanged)
- `hasVest(i)`: a suit has a waistcoat only with `vest:'yes'`; while the wardrobe has no `settings.vestDef` (it is from before that rule) a suit with no value still has one, so nothing changes until its suits were given their value (dress.js)
- the photo request mentions a watch only when the outfit text has one ("wristwatch", `hasWatch` in worker/render.js): otherwise the pose has no watch and "He wears no wristwatch: both wrists are bare" (`NO_WATCH`); `tests/watchmatch.test.js`
- swapping the belt brings shoes that match it, as swapping the shoes brings a belt (`FOLLOW.belt` in history.js: shoes and socks; the owner: with one belt per pair of shoes a belt swap took the belt off and said "None of your belts match")
- when the other belts' shoes don't suit the outfit (a black suit wants black shoes), the swap or pick changes nothing and Today says why (`beltless` in history.js: the day planned with the record in memory only); `tests/beltswap.test.js`
- the type `pants` is "Trousers" on screen (`TYPES`, packing list, Care); photo prompts still say "dress trousers"
- colours always come from the item's tagged colours, matched by brightness rank, never from the photo, except an item's `sett`: it is read from the white-balanced sharp photo or close-up at the user's request, so its bands keep their measured colours
- `PATS_BY` must stay in sync with the worker's prompt (worker/tag.js), and so must the per-type colour lists (`COLS_BY` / `DIAL_COLS` here = `TYPE_COLORS` / `DIAL_COLS` in worker/tag.js; `tests/colouraudit.test.js` checks it)
- each item type offers only colours it really comes in; an off-list tag moves to the closest allowed colour (`fitCol`), and a colour an existing item already has stays selectable for it
- settings merge setting by setting (2026-11-14, the audit's "settings sync as one block": phone A's workdays and phone B's city, the later save dropped the other): each setting has its own stamp `settings.ks[k]` and the fingerprint of the value it was stamped with `settings.kh[k]`; `keySettings` runs where settings are read (start.js start-up and `onSyncedData`, settings.js, safety.js) and gives a copy from before every setting its one stamp, and a setting only the defaults filled in stamp 0; `stampSettings` (in `saveUserSettings` and the learn votes, history.js) stamps only settings whose value changed; `mergeSettings` (in `mergeState`) takes each setting from the newer stamp, ties to the newer copy, and makes the result's `updated` one above both when it took anything from the older copy, so the phone holding it uploads it (sync.js sends settings newer than the server's); two copies without `ks` merge whole as before; a roll-back stamps every setting (`stampAllSettings` in sync.js `rollBackState`) and marks ones the snapshot lacks removed; worker/backup.js `mergeSettingsLite` is the same rule in `mergeLite`; `tests/settingsmerge.test.js`

- cleaning reminders on the phone (2026-11-14, the owner: "a phone reminder when a suit is due"): Settings → Schedule → Morning reminder → "Cleaning reminders" (`#care-rem-sw`, `remindSwitch('care')` in remind.js; follows the morning switch until set by itself, `remindPrefs().care` undefined); `careReminders` (care.js) gives `{date: text}` for the coming workdays: a suit's or blazer's last wear on the morning planned, the first morning it is planned past its limit (the owner, 2026-11-14: only the first), and once due one reminder the next workday morning to come, neither again until cleaned (`localStorage.care_told` {c, d, o}); kept as `care.json` beside `remind.json` in `dw-keep-remind`; the dates sent to the server are those of either kind (no server change); sw.js shows the cleaning text under the outfit line, or alone titled "Due for cleaning"; `tests/care.test.js`, `tests/remind.test.js`
- the cleaning frame on Today's picture (`careFrame`/`careDayState`/`careBandFit` in care.js; the owner's design 2026-11-14, "B" from mockups, tweaked): a suit or blazer one wear short of its limit has a yellow frame and a banner along the picture's bottom (wear dots left, "**1 wear left** · Suit – wear 4 of 5" right, no icon), its last wear red ("**Last wear** · Suit – to the cleaner today"), past it red ("**Overdue** · Suit – worn 6 of 5", the dots +1); on today and coming days, the wears planned between today and the day counted (so yellow today is red the next time it is planned); both inside the picture (frame inset 5 px, banner 40 px over its bottom); the banner is cut round the tie swatch when the swatches reach into it, measured each time (ResizeObserver and every frame through `swApply`'s transition), so the cut follows the swatches when a tap shrinks them; on today and past days the ✕/✓ row and the swatches sit above the banner (`.fig.cb`); words 13 px, down to 11, then the bold words on their own line, fitted once for the narrowest space (beside a full-size tie swatch) and kept while the cut moves (the owner, 2026-11-14: refitted every frame the text jumped), again only when the picture's width changes; trousers keep the grey line under the outfit (`careNote`); `tests/care.test.js`

- the Sync now button is `syncTap()` (sync.js): a tap clears a backup pause (`sync_pause`, the day's saves used up) and tries; if the server still refuses, the pause comes back; while paused, `showSyncStatus` shows the pause's message and the last backup's time, not only "Backed up …" (2026-11-14: the owner's Sync now did nothing silently after Cloudflare's plan was upgraded); `tests/kvlimit.test.js`

- the connection is kept in the database too (`connKeep`/`connRestored` in app.js; 2026-11-14: on the owner's iPhone the Home Screen app's localStorage lost the server address and code after a forced close during an update, while the database kept the wardrobe and Safari kept both): `worker_url`, `app_token` and `remind` are copied to meta `conn` (after the start-up restore, when Settings closes, on connecting, whenever the app goes to the background) and put back at start-up where localStorage lost them; start.js and sync.js wait for `connRestored`; cleared on purpose in Settings, the copy is cleared too; `tests/connkeep.test.js`

### `planner.js`
- an enamel tie clip (black, red, blue, navy: `clipMetal` null) is chosen by the tie (`enamelPref` in planner.js, 2026-11-14, the owner: 7 of his 9 clips were never planned, an enamel clip scored 0 against a silver watch-and-buckle match's 9): picking up the tie's second or third colour (by family) `ENAMEL_ACCENT` 11, beating silver; the tie's own colour or a near one (red with burgundy, blue with navy) `ENAMEL_TONE` 8, just under, so it comes round when silver has been worn; anything else `ENAMEL_CLASH` -5; gold, rose gold and gunmetal stay off against a silver watch and buckle (the owner: "keep gold off"); no clip on a waistcoat day, as before; on his wardrobe over six months: blue 5, navy 2, black 2, red 1, silver 5, grey 6, gold/rose gold/gunmetal 0, scores unchanged (99.77); `tests/enamelclip.test.js` (realPlanner)

- outfit rules, `outfit()` / `buildPlan()`, `rateOutfit()` (no DOM)
- `PLAN_RULES` (13) is bumped to release the week's locks once (picks kept); a bump also clears swaps on future days, so changes that protect picks (`fixedAhead`, `TIE_GAP`) were made without one
- **Planner rules:** whenever a change alters how outfits are chosen (planner.js scoring, groups, rotation), bump `PLAN_RULES` in planner.js
- on the next start a bump releases only the week's locks and the app's own recorded pieces on days after today (`checkPlanRules()` → `replanFuture(true)` in history.js); the owner's swaps, skips and vest choices stay, so there is no reason to skip a bump; Settings' "Re-plan upcoming days" also clears them, on demand

#### Simulation
- every month from two months back is simulated from one shared start so months agree
- the simulation is resumable (`planSim(start).upTo(day)`; `buildPlan(y,m)` runs one from `planStart`)
- `planSim`'s day loop compares day numbers (`di`), not dates: where the clocks go forward at midnight (Cairo, Santiago, Beirut) the month's last day was never planned
- the planner picks only items in rotation (`by()` in `planSim` filters `inRotation`; belt/coat notes in `rateOutfit` too); the what-to-buy analysis runs the same planner
- frozen past days look their pieces up in the full wardrobe (`frozenOutfit`), so a paused item stays in outfits already worn
- a past day whose piece was deleted since is rated without it (`frozenOutfit` sets `o.gone[slot]`; 'Complete outfit' doesn't ask for a gone piece), so deleting an item doesn't fill Insights' trend with real mistakes
- `planSim` keeps on-the-way items with a date in `by()` and gives `outfit()` a per-day pool (`byOn(n)`), so an item joins the plan the day after it arrives
- `planSim` gives every day `o.ctx` = `{prev: the last two workdays' sumUp, prev3, n}`; `prev` stays two days long, since the Variety score reads every entry of it
- a past day marked "Not worn" is not the previous workday for repeats (`prev`/`prev3` skip it, as `last` does)
- without jackets `planSim` keeps `prev` on every day, not only days with a jacket, so shirts and ties still avoid repeats and the Variety check works
- a day with no jacket of its kind (a blazer day with no blazers) takes the other kind
- a wardrobe with no suit and no blazer is planned as trousers, shirt and tie
- speed: `withColRun` keeps each item's colour family (`pcol`) and colours (`colsOf`) for one run (`planSim`'s `upTo`, `runAnalysis`) in WeakMaps (`colRun`; only while the run lasts, so an edited item is read afresh next time)
- speed: in `outfit()` each trousers', shirt's and tie's own terms are worked out once (`P1`/`S1`/`X1`) and the rotation part only for outfits inside the window, summed in the same order, so plans are identical
- measured (Node, desktop): the 149-item audit wardrobe plans 8 months in about 225 ms (was 423); plan hash identical with and without the speed-ups

#### Rest and rotation
- rest bonuses keep creeping up past their caps (`over(i,from)`: 0.01 a day in `rb`, 0.05 for shirts and trousers, 0.2 for jackets, up to 300 days), so a piece always a point short of another still comes round (on the owner's wardrobe 4 of 11 trousers and 2 of 4 socks were never planned without it)
- a tie's rest creeps too, capped: `+Math.min(TIE_CREEP_MAX, over(x,30)*TIE_CREEP)` (9, 0.03 a day after 30 days), well under `TIE_GAP`, so a tie still never repeats within three workdays (on the 40-tie audit wardrobe over 12 months: 9 ties never planned before, 0 now; scores unchanged)
- odd trousers rotate on a long rest (`ptRest`, up to 60 days, since blazer days are weekly) and shoes avoid yesterday's pair when another suits
- a jacket pinned to one of the next 3 workdays is held back before its day
- a jacket out of season (`seasonFit` −15: a cold-weather suit on a warm day) is planned only when there is no other (`offSeason`)
- a suit whose only acceptable shoes were worn yesterday (a black suit the day after black shoes) loses 10 at the jacket choice (`shoeBound`), so another suit goes first

#### Repeats
- jackets rotate by rest and avoid the previous workdays' colour group (`jacketGroup`, `colourRepeat`); the same group as the workday before costs `JKT_SAME` (60)
- the same-group jacket cost is scaled by how avoidable a repeat is (`topGw` in planner.js, 2026-11-14, the audit's walkthrough: three grey suits and one brown, brown planned 35 of 94 suit days against 19-20 for each grey, every other suit day): ((other jackets of the day's kind) / (that group's own))³, at most 1, so there a grey after a grey costs about 2 and the four suits rotate evenly (23-24 each; with a suit every workday 31 each of 124, a grey after a grey on 61 days, the fewest even rotation allows); a wardrobe with no group bigger than all the others together keeps the full `JKT_SAME` (the owner's: the same six-month jacket sequence before and after); `PLAN_RULES` not bumped (nothing changes for the owner; a lopsided wardrobe takes it after the week's locks); `tests/jacketshare.test.js`
- gunmetal jackets are in the grey group (`JKT_GROUP`; the owner's "mid grey worsted" is based on gunmetal), after a dark pinstripe then black, and light then mid grey, on consecutive days (2026-11-14)
- any two very dark jackets running are "dark again" (`darkJkt`: `DARK_JKT` or brightness under `JKT_VDARK` 34 of 255: black 22, dark navy 31; navy 37 and charcoal 62 are not)
- measured on the owner's wardrobe over 124 workdays: jacket-group and tie-colour repeats 1 → 0, scores and jackets worn unchanged; the nine-tie test wardrobe meets 3 tie-colour squeezes in six months (held at 3 in `tests/jacketcolour.test.js`)
- shirts and ties do the same (`shirtRepeat`, `tieRepeat`; white and light blue shirts only mildly; dark shirts count as one look and black/charcoal/grey/silver ties as one, `shirtLook`/`tieLook`)
- a tie colour never repeats on consecutive workdays: `tieRepeat` must outweigh the tie's rest (`tests/jacketcolour.test.js`)
- the same tie is not planned again within three workdays (the owner's choice, 2026-11-13): `tieRepeat` costs `TIE_GAP` (18) for the same tie the day before, two back and three back (`prev3`); tie colours keep their two-day rule; `tests/tiegap.test.js`
- the same jacket colour group with the same shirt look and tie look as either of the last two workdays is a whole-look repeat (`lookRepeat`)
- each jacket remembers its last two outfits so its tie and shirt colour vary (`comboRepeat`)
- the next fixed day's colour is avoided, and the suit before a blazer day avoids the colour of the blazer that is due (`fixedAhead`)
- `fixedAhead` returns the tie and shirt fixed on each of the next 3 workdays (`fx`: sumUps with `w` 0-2 workdays ahead and the day number `n`; picked, moved there, worn or locked; a day marked "Not worn" left out)
- each fixed tie costs as the last three workdays' do (`aheadTie`): the next workday's as the day before's (`tieRepeat`), two ahead as two back (same tie `TIE_GAP`, colour 2), three ahead as three back (same tie `TIE_GAP`)
- each fixed shirt (`aheadShirt`): `shirtRepeat` as the day before for the next workday, as two back for the one after; its very shirt `NEXT_SHIRT` (40) more on the next workday and on any later one within `settings.laundryDays` calendar days
- the look-ahead was found when an outfit moved from Nov 23 to Nov 24 and Nov 23, planned afresh, took the same black tie and check shirt; measured: a tie swapped with the week locked took a tie locked 2-3 workdays later 35 of 88 times, now 1; `tests/planahead.test.js` (`realPlanner`: the fixed test plan never changes), `tests/planaudit.test.js`

#### Colours and harmony
- steel blue is a mid-tone shirt, not a `darkShirt` (cutoff 95)
- `HARM`: black, charcoal, grey and silver ties are classic with navy, charcoal and grey jackets (charcoal and grey with brown, charcoal with tan)
- `BLAZER_TROUSERS` has mid blue under tan, brown and grey; black trousers lose 20 only where the jacket's own list lacks them (they are listed under grey)
- `settings.darkShirts` (`darkMode()`: 'some' default, 'often', 'never'; Settings → Schedule → Dark shirts, `setDarkShirts` in settings.js): 'often' scores a dark shirt under a light jacket like a white one and also allows a mid-tone jacket (L ≥ 80) at least 40 lighter than the shirt; 'never' plans one only when there is nothing else
- socks may pick up the shirt's or the tie's colour (`sockEcho`: their colour groups, neutrals left out; +4 in `sockScore`, behind the trousers' colour)

#### Trousers and shoes
- trousers by the day (`botFits` in `outfit()`): a formal day, a wedding or a funeral takes dress trousers; a blazer day takes dress trousers or chinos, and jeans only when `settings.dress.jeans` (Settings → "Jeans with a blazer", off by default, shown while jackets are worn); a day without a jacket takes any kind
- shoes by their style (`SHOE_FIT` in `shoeScore`, by `shoeCtx`: suit, dress trousers, chinos or jeans): an oxford goes with anything; a derby −4 and a loafer −8 with a suit; boots −60 with a suit, −20 with dress trousers; sneakers −60 with either
- sneakers come only with chinos or jeans, where a white or neutral pair suits any colour (`SNEAKER_COLS`) and needs no matching belt (`beltFit` 0); `tests/casual.test.js`, `tests/plannerfix.test.js` (figures from the owner's backup over six months of planning, not kept in the repo)

#### Occasions and dress code
- `occOf(rec)`: `formal` stored as `rec.formal`, `wedding` / `funeral` / `casual` as `rec.occasion`; rules in `OCC` and `formalTop`/`formalShirt`/`formalTie`
- an occasion's suit outweighs rotation and the one clearly right suit is held back on the days before
- `casual` = no jacket, tie, clip or vest: `o.top` is null and the shirt is judged against the trousers
- a formal day takes the white shirt: `formalShirt(s, k)` counts the colour and pattern `FORMAL_SHIRT_K` (3) times in `clothesScore` and in the shirt shortlist (French cuffs once), and a formal day or a funeral picks among outfits within `FORMAL_QWIN` (3) of the best, not `QWIN` (8), so a French-cuff light blue shirt no longer outscores white
- `outfit()` follows the dress code: without jackets every workday is planned like `casual` (`noJ`, `day.nojkt` for `clothesScore`), with a tie when ties are worn; without ties (`noT`) no tie and so no clip is picked, and a pinned or locked tie is ignored
- a formal day, a wedding or a funeral is still dressed in full from what is owned (`full`), whatever the dress code; a day marked "No jacket or tie" has neither, also for someone who wears ties
- measured on the test wardrobe (9 jackets, 5 trousers, 8 shirts, 9 ties): each of the four dress-code combinations plans complete outfits scoring 96+ with no hard check

#### Laundry
- `settings.laundryDays` (default 1, 0 = off; Settings → Care): in `outfit()` a shirt worn within that many days is in the wash and left out (`washing`, `washed` in `pool()`), unless there is no other shirt; a forced shirt stays
- on a formal day, a wedding or a funeral the occasion's shirt outweighs the washing (`tests/weather.test.js`)
- a lock whose shirt was worn within those days is dropped, when another shirt is free

#### Locks, taking off, waistcoats
- `rec.lock` (the pieces the app showed for one of the coming days): `pool()` returns the locked piece for a slot unless the day forces another or skips it; a locked jacket sets the day's kind and counts as fixed in `fixedAhead`
- the whole lock is dropped when one of its pieces is not in the day's pool (deleted, out of rotation, the other jacket kind) or the forecast has turned against it (suede shoes on a rainy day, a piece out of season)
- taking a piece off for the day (the owner's ask, 2026-11-13): `rec.off = {top, tie}`; `outfit()` plans as usual and `takeOff(o, off, untake)` removes the piece at the end
- `takeOff`: the jacket takes its waistcoat with it, a suit's trousers stay (`o.bot` = the suit, `o.suitDay` false, `o.suitBot` true), a blazer, tie or clip taken off is not counted as worn (`untake` restores `last`); sets `o.off`, `o.offKind`; `frozenOutfit` sets them from `rec.off`
- `needsJacket`/`needsTie` (core.js) ask for neither on a day with a piece off, so no 'Complete outfit' penalty; `scoreAdvice` never offers to swap a suit's trousers
- no waistcoat without a tie (the owner, 2026-11-13: "No one should ever wear a vest and no tie"): `outfit()` sets `vest` only with a tie, whatever `vestMode` or `rec.vest`; `takeOff` drops the waistcoat with the tie; past days keep what was recorded
- Today's vest row (`vestRow`, today.js) is hidden on a day with no tie, so its + can't add one; a jacket worn without a tie is always the `suit-open` master, never `vest-open`; `tests/takeoff.test.js`

#### Learning
- what the user's changes taught it (`settings.learn`: votes on item pairings `p` and items `i`, −3…+3) is applied in `outfit()`: a pairing voted down scores 6 lower per vote, one voted up is preferred among the good outfits (`pairVote`/`itemVote`)
- votes are read as numbers (`+v`): a vote stored as text ("2") was added as text

#### Score (`rateOutfit`)
- `rateOutfit` returns `{score, label, checks:[{label, pts, max, why, hard}], raw, hard:[labels]}`
- the score takes points only for things that can be put right, not for taste: every quiet shirt colour scores 10 (`QUIET_SHIRTS`), a dark shirt under a light jacket too, any listed shoe or trouser colour 10, socks in the shoes' colour 5
- a check marked `hard` is a real mistake and caps the score at `HARD_CAP` (69): shoes that don't suit, three bold patterns or two of one type and scale, trousers the odd jacket's colour, a belt that doesn't match the shoes, a dark shirt under a dark jacket, shirt the jacket's colour, a black tie on a black suit, light socks with dark trousers, one colour head to toe, patent shoes, a piece out of season
- a missing piece (shirt, trousers, shoes; jacket or tie only when `needsJacket(o)` / `needsTie(o)`) adds the hard check 'Complete outfit' and the label 'Incomplete'
- 'Shirt and trousers' is checked on every day without a jacket that needs none; the Metals reason leaves the tie clip out when ties are not worn
- 'Variety' from `o.ctx`: the same look −3, the same tie −2 or tie colour as the workday before −1, the same tie as three workdays ago −1, the same shirt −2, yesterday's shoes −1
- 'Watch strap': a leather strap against the shoes' leather group; 'Weather' whenever the climate is known: a piece a season off −1, out of season hard
- `scoreAdvice(o, pool)`: every single swap of shirt, tie, odd trousers, shoes (with their best belt), belt, socks, watch or clip is scored; `fixes` = the best swap per slot that raises the score (up to 3), `best` = the score reached by taking the best swap again and again, `stuck` = the checks no swap improves
- measured on the owner's wardrobe: planned days 96–100 (80 of 114 at 100) with no hard check, random outfits 79% with a hard check; `tests/scorefix.test.js`

### `analysis.js`

- "what to buy" analysis (no DOM; runs in `analysis-worker.js`, a Web Worker): `runAnalysis(list, T, weeks, progress, onCat)` → `{v:2, base, cats:[{key, title, verdict, own, notes, recs}], top, occasions}`
- `evalPlan(list,T,weeks)` plans the next `SHOP_WEEKS` (26) with the real `dayRecs` (history, occasions) and measures it: score, problem notes, jacket rest, colour/tie/look repeats, shoes worn two days running, first-choice shoe days, pieces never planned, points lost per check
- `shopList` counts pieces on the way and pieces away being cleaned (`item.away`) as owned; pieces out of rotation don't count
- suits, blazers, trousers, shirts and ties: candidates are every colour in `SHOP_COLS` × pattern class (`clothesCandidates`), ranked without simulating (`rankClothes`)
- ranking: fit = how many owned jackets/shirts/ties make an outfit within `QWIN` of that jacket's best (`compatBase`/`compat`), gap = a colour group (`shopGroup`) or pattern class (`shopClass`) not owned, staples first (`STAPLES`), a bonus for partners that are never planned
- ranking by simulation alone is noise in a full wardrobe (the user's got "another brown suit" first)
- the best of each category (one per colour group and class, two per colour) are then simulated for the facts (`simFacts`): days planned, the score of its outfits, two sample outfits, problem days and short-rest days fixed; an idea planned under twice or scoring 1.5 below the usual is dropped
- solid and the fine weaves are one class for jackets (the planner treats them alike): a plain suit idea names the fine textures not owned yet (`shopDetail`)
- shoes, belts, socks, tie clip, cufflinks and coats (`smallCandidates`) are each simulated and ranked by their direct effect; shoes whose owner's pair only lacks a belt get the belt as the idea; `shoeNotes` says what the plan leans on
- tiers: `fix` (problem days or 2+ short-rest days gone), `better` (a check no longer marked down), `gap` (a staple), `variety`, `optional` (everything in a category that is full: 2+ pieces never planned, or each planned less than once in five weeks); category verdict needed / worth / covered
- two fixes for the same days are not both top picks: the best is taken, the rest re-checked as if it were bought (same section: kept as alternatives with `dup`; coats, belts and cufflinks: dropped)
- `occasionCheck` dresses one formal day, wedding, funeral and no-jacket day and lists what is missing
- `settings.shopSkip` (keys `type|colour group|pattern class`, synced) are left out of every check
- the check follows the dress code: `compatBase` leaves out the types it excludes, the Ties (or Suits and Blazers) sections are skipped, no tie clip is suggested, reasons don't count ties, and excluded pieces are not listed as never planned
- without ties a shirt idea is ranked by the jackets it works with, a suit or blazer idea by the shirts
- shoes, belts, socks and coats are checked against the real plan whatever the dress code
- without jackets `compatBase` has one stand-in jacket, `NOJ` (`{id:'nojacket'}`), with every pair of trousers, scored like the planner's no-jacket day (`clothesScore(null,…)` with `day.nojkt`); `NOJ` is never named or counted as an idle piece
- without jackets shirt and tie ideas are ranked by the trousers (and shirts or ties) they suit, trouser ideas by the shirts (and ties); trouser candidates are made for every colour (`clothesCandidates`)
- `tests/dress.test.js` checks the ideas without jackets, with and without ties

### `shop.js`

- the "What to buy" button on the Wardrobe tab (`shopButton`, `#shop-btn`) and its sheet (`#shop-sheet`/`#shop-backdrop`, `openShop`/`closeShop`/`renderShop`): slides up from the bottom over the whole page like the piece picker; Escape, the backdrop, × and changing tab close it
- sections: top picks (`shopGo` opens the idea in its section), one per category with what is owned, a verdict and its ideas, occasions, hidden ideas
- an idea is folded to its picture, name and first reason; opened it shows every reason, sample outfits drawn with `figureSvg` from the owner's pieces, "Bought it" and "Not for me"
- "Bought it" (`shopBought`) adds the piece as bought, on the way (`order`+`paused`, optional `arrives`) and checks again; "Not for me" (`shopHide`) adds its key to `settings.shopSkip` and hides it at once
- swiping the sheet down closes it, like the item sheet: its header (`.shop-top-head`, with a grabber) is a handle at any time, its content only while scrolled to the top; it closes past a quarter of its height or on a flick, else springs back (`shopSwipe`; `tests/shopswipe.test.js`)
- `shopSwipe()` installs the swipe listeners the first time the sheet opens (from `openShop`, once: `shopSwipeOn`), and the grabber is its own element (`<i class="shop-grab">` in the header), so a change to either selects only the tests that open the sheet
- the sheet and its backdrop slide and fade away on closing (`visibility` switches off after the transition; not `.on` = no pointer events); the handler only sets an inline transform and lets the CSS transition finish from there
- `renderShop` during a swipe (`shopDrag`) is put off until the finger lifts (`shopStale`): a redraw removes the element the touch started on and its moves stop coming
- the result is kept on the device (`meta` key `shop`: `{sig, at, res}`) and shown without checking again while `shopSig` is unchanged and it is under a week old; sections appear as the worker finishes them (`{cat}` messages)
- `shopSig` holds the wardrobe and every setting the planner reads: laundry days, dark shirts (`darkMode()`), jeans with a blazer, holidays, days off, `settings.learn` and the occasions marked from today on (else a change left the check up to a week stale); `|nojacket` / `|notie` stay last

### `detect.js`

- stripe/check detection from photos (canvas)
- `usableSett(i)`: the item's `sett`, unless it is a band reading of a `MOTIF_PATS` pattern (an older reading); a weave pattern (`texPat`) takes a texture or a figure (motif) reading; drawing, `settText`, photo diagrams and `patSummary` use it
- `settSig(s)`: a reading's signature for photo keys (`comboSig`): band colours, or the motif's grid, ground, figures and colours
- the full sett (`analyzeSett`/`settFromCanvas`): every band of one repeat in its own colour (per-step medians in Lab, merged until neighbours differ by ΔE 5; a 1–2 step band lying between its neighbours is their blurred edge), the direction, the lines crossing the other way (the residual after the main bands, projected; thread colour = 2 × pixel − band), and the scale (`cr`); stored as `item.sett` `{v:2,a,bands:[[hex,w]],cross:{d,bands:[[hex|null,w]],r},cr,tr,src}`
- `analyzeSett` stays on the page (it needs the canvas); `settFrom`'s cache (tagging.js `settMemo`) keeps it from running again for the same pictures
- `period()` takes the shortest whole fraction of a repeat that matches nearly as well (a clean pattern also matches at 2–3 repeats)
- `analyzeSett` finds the directions on a 320px copy and measures on a sharper one (up to 900px) so fine stripes keep their width
- repeats are found in colour (`periodCh` over L*, a*, b*): a tattersall's red and green lines of one lightness stay apart
- crossing lines are looked for after a moving average is taken out (`detrend`: light falloff and folds are not lines) and their repeat is at least 4% of the length (not the weave texture); they are searched and marked in colour too (each step's kind is its strongest change: lighter/darker/bluer/…)
- directions are found from a colour-difference image (each pixel's Lab distance from the cloth's median, so a light-blue line on khaki linen counts even at the same lightness), with no coherence gate; `opt.straight` (every type but ties, from `settFrom`) tries only upright and level, ±6°
- the repeat is searched with and without the profile's slow drift and both candidates are scored on the drift-free profile (`corrAt`); without a plain repeat the drift-free one counts only above 0.75 (a plaid tie with no full repeat in view stays whole)
- the sharp copy is read in 8 strips running along the lines (`stripProfiles`): a draped cloth's lines wave, so one straight projection smears them; the repeat comes from all strips together and each strip is shifted into line (`stripShifts`, `foldBins`)
- sparse lines (windowpane, pinstripe) whose repeat correlates under 0.6 are found one by one (`linePeaks`/`lineModel`: kept only where about half the strips have them, gaps varying under 25%), and every pixel is lined up on its strip's nearest line, so unevenly spaced panes still fold into one repeat; the test case is the user's linen windowpane blazer (`tests/fixtures/blazer-windowpane*.jpg`)
- with a sharp photo and a close-up, the close-up's colours are shifted so its ground matches the photo's (the photo usually has a white wall to set exposure), and the swatch takes the close-up's scale (`cr`), since it sits beside it
- a narrow band (under 20% of the repeat, a pinstripe, a pinline) takes its strongest step's colour (if 5 ΔE or more from the ground) and its width at half contrast; each crossing line keeps its own thread colour (alike ones merged); the bands are measured without the pixels under the scarcer kind of crossing line (a gingham's white stays white)
- speed: `binMedians` sorts typed arrays numerically, `labGrid` works out `rgbLab` inline with its sRGB curve from a table (`LAB_LIN`), the crossing-direction search builds each angle's projection once, `periodCh` runs on typed arrays; readings identical to before over 94 cases, `tests/sett.test.js` 36 s → 17 s
- the old brightness-only stripe reader (`detectQueued` → `item.stripes`) runs at Confirm only for a card with no close-up whose full reading found nothing and wasn't turned down (`q.settReject`); old items keep their `stripes`, and "Read pattern from photo" (`redetect`, itemsheet.js) still uses it for items with no close-up or box

### `figure.js`

- Today's torso figure (`jacket:false` draws it in shirt sleeves with a button placket, for no-jacket days)
- no head or neck (cropped at the collar, the user's request); athletic build
- shirt collar band with points on the tie knot; slim notched lapels around a wide opening so the vest shows
- set-in sleeves cut by the shoulder line (`clipShoulder`)
- the pose follows the photo the owner chose as the model: the left forearm lower across the chest with the watch, the right hand raised to the waist button right under the left wrist, clear of the watch (`.fig-hand-l`, `.fig-hand-r`)
- the pose comes from the drawing: a photo used as the pose source made the generator copy that photo's watch
- the photo generator gets a square crop of the drawing with a jacket (`FIG_CROP` in photos.js, `figurePng`: shoulders across, ending under the pocket flaps); sent whole it came back zoomed out, down to the hips; a no-jacket day sends the whole drawing; the worker's `RENDER_PROMPT` (worker/render.js) describes the same pose and crop
- `FIG_CROP` is 368 of the drawing's 390 units and the prompt asks for both shoulders and elbows inside the picture with a strip of background either side: the crop alone changed nothing, the wording did ("shoulders filling the width" ran them off both edges)
- the chest pocket is a welt in the jacket's cloth (`.fig-welt`): drawn as a dark stroke it came back as a dark line in the pocket
- no tap targets on it
- fabrics come in as ready-made `<pattern>`s from `figFabric()` in draw.js; keep the pattern ids (`suitB/suitL/suitR/shirt/tie`)
- keep `bladeP`, `.fig-clip`, `.fig-watch`, `.fig-vest`, and no `<use>` inside `<clipPath>`
- no tie (`tie` null): an open collar (`.fig-open`: the throat between collar leaves that lie open on the shirt front) and, under a jacket, a buttoned placket down to the lapels' meeting point; in shirt sleeves the existing placket follows; with a tie the drawing is unchanged, character for character
- the figure's `aria-label` (draw.js `figureSvg`) says "open collar" when there is no tie

### `draw.js`

- procedural fabric patterns (`fabricDef`), `figureSvg()` glue for the torso figure, accessories, wardrobe thumbnails (`itemThumb`)
- `outfitText()` (photos.js) adds an item's `patternText` (Claude's description) for the photo generator, and `comboSig` (photos.js) includes the sett and description, so such an item gets its own photo

#### Fabrics

- an item's `sett` is drawn first: its bands, the crossing lines over them at half opacity, at its angle (ties) or snapped (others); a swatch shows at least one repeat, the figure keeps the repeat's share of the item's width (`fabricDef(..., 'fig')`)
- a tie's read stripes (`v:2` bands) and figures (motif) have no white sheen line: one per repeat, turned with the pattern, it lay almost level and showed as light grey bands across the item sheet's swatch
- a motif `sett` is drawn as a 2×2-cell tile (two colours alternate like a checkerboard; `corner` figures where four cells meet; `alternate-cells` in every other cell), turned 45° for a diagonal grid; swatch scale from `cr` (cells in the close-up), figure scale from `tr` (cells across the item)
- a `figure` is drawn from its bitmap, its rows' runs of 1 as rects, at the figure's own proportions; cells are `T` wide and `T*aspect` tall, offset rows shift half a cell, and a figure crossing the tile's edge is drawn again on the other side
- `texTileSmooth` (Today's shirt swatch, the owner's choice "Smooth + thread grain"): 24 px a cell, a wrapping Gaussian (`TEX_SMOOTH_SIG` .32 of a cell) and a narrow smoothstep, so the figures have rounded anti-aliased outlines, plus a faint diagonal thread grain (`TEX_GRAIN` ±3.5%); herringbone and twill readings and every other swatch are unchanged

#### Traced drawings (no photo)

- every item without a photo is drawn as a shape traced from a product or item picture (2026-11-13, the owner's asks); the tracing tools are not in the repo
- compare a new drawing alone beside the others at 260 px, not only over its photo
- the colour and pattern pickers show the traced drawing (`cpFig` in colpick.js is true for every type): without a photo the "As drawn" panel is the item's shaped drawing (`itemThumb(drawn)`), not a flat square; with a close-up or photo the photo leads and "Drawing" is a tab (`view:'draw'`, `cpViews`/`cpSeg`); redrawn on every tap, nothing saved until Use; the figure fits the panel's height (`.cpfig`); `tests/colpick.test.js`
- the oxford (`SHOE_OX`, `drawOxfordSide`): traced from the item picture of the owner's black calf oxfords on 3x crops, toe right, back shoe 14% darker, tan linings; box 0..96 x 0..48.6
- every shoe style but the sneaker is that traced pair (the owner chose adapting the oxford's tracing over making pictures): `drawShoePair(item,P,style)` lays the style's own paths from `SHOE_ST` over `SHOE_OX` (`drawShoeSide` picks the style): derby facings, tongue and laces; loafer apron and penny strap; chelsea boot shaft (6 units lower in the thumbnail), gusset and pull tab
- the sneaker (`SHOE_SN`, `drawSneakerPair`; the owner: "a normal pair of Nike sneakers"): traced from Nike's photo of the black Air Force 1 '07, mirrored so the toes point right; sole and tread in the second colour (else #f4f2ec); no Swoosh or lettering (Nike's marks)
- on the dark theme a shoe has a faint light edge (`--shoe-edge`)
- the belt (`BELT_D`, `drawBelt`, box 0..96 x 0..44.6, at translate(2 28) in the thumbnail): traced from the item picture of the owner's oxblood cordovan belt; buckle frame and prong in `METAL_TONES` of the belt's metal
- the buckle frame is one U-shaped path open on the right, its right bar hidden under the strap's tail (an outline there showed as a thin line), its bottom bar 20 px deep
- the suit (`SUIT_D`, `suitMarks`; the owner: "trace his arms pose, his legs, everything"): the whole suit as worn in Brooks Brothers' photo of their navy stripe suit, gaps between arms and body open (`fill-rule=evenodd`), right hand in the trouser pocket; shirt, a tie in the suit's colour darkened and a pocket square in the V; head and hands left out
- the suit's cloth is at `SUIT_FAB` (0.28) of the fabric tile (`suitFabric`): at the square's scale the owner found the textures huge; matches the photo's pinstripes, about 26 across the suit
- the blazer (`BLAZER_D`, `blazerMarks`; the owner's pick, head and hands at his request): the model in Brooks Brothers' photo of their hopsack sport coat; only the coat takes the cloth, skin, hair, polo and trousers keep fixed tones; box X=(x-835)*.052+50, Y=(y-40)*.052 in the 1648x2000 photo; routed in `itemThumb` by `i.type==='blazer'` only
- the blazer's cloth is at `BLAZER_FAB` (0.26) (`blazerFabric`; the owner found the square-scale pattern unrealistically large): about 8 windowpanes across the coat
- the models' eyes are drawn by `figEyes` (iris clipped to the lids, pupil, catch-light, lash line), shared by blazer, overcoat and raincoat; irises placed by eye looked cross-eyed (the owner), so they are measured from the photo (the blazer's from the darkest fifth of each eye's pixels; the raincoat's on 8x crops, as that measure was pulled toward the lashes)
- the overcoat (`COAT_D`, `coatMarks`; the owner's pick): the model in Brooks Brothers' wool blend topcoat photo, cropped to mid-thigh (box K .0765) so he fills the square; scarf, cardigan and shirt are placed outlines checked over the photo (colour-class blobs looked like trash beside the others, the owner); sleeve folds measured as dark dips in column brightness; only the coat takes the cloth (`COAT_FAB` .23)
- the raincoat (`RAIN_D`, `rainMarks`; the owner's pick): the model in Brooks Brothers' black water-resistant raincoat photo, to just above the knees, hands in the pockets, with the zip-out bib; cloth at `RAIN_FAB` .26 (`rainFabric`), the bib a darker shade, lines lighter than the cloth on a dark coat; box X=(x-742)*.0518+50, Y=(y-68)*.0518 in the 1648x2000 photo; routed by `i.type==='raincoat'`; `tests/raincoat.test.js`
- the shirt (`SHIRT_D`, `shirtMarks`; the owner's pick): folded, traced from Brooks Brothers' photo of their black pinpoint oxford shirt, the tie and label left out; cloth at `SHIRT_FAB` (.55, `shirtFabric`); lines lighter than the cloth on a dark shirt, darker on a light one
- the folded shirt has three front buttons (`SHIRT_D.fronts`, the owner's ask), cuff-button size, about 8 cm apart down the placket
- the watch (`WATCH_D`, `drawWatchTraced`; the owner's ask): traced from his own watch's item picture (steel Seiko chronograph on its bracelet, three-quarter view); bezel, dial and subdials as ellipses fitted to edge points; no maker's name
- the traced watch follows `watchOpts`: metal tones, dial colour, a leather strap in the item's colour, fluted, smooth or engraved bezel, three hands (date or none) instead of subdials; the old top view `drawWatch` stays, unused by the thumbnail
- the tie (`TIE_D`, `tieMarks`; the owner's pick): laid flat, narrow end rolled beside the blade, traced from Brooks Brothers' solid rep tie in blue (the black's roll folds didn't show); cloth at `TIE_FAB` 1 (`tieFabric`: a repp stripe or dot about 6 across the blade; 1.5 gave 4, too large); the full swatch (`itemThumb(i,true)`) is unchanged
- trousers (`PANTS_D`, `pantsMarks`): traced from the product photo of grey office trousers the owner sent; the space between the legs open from below the crotch (the owner's ask); cloth at `PANTS_FAB` 0.22 (`pantsFabric`; waist to hem is about 42 in against the suit drawing's 34)
- jeans and chinos keep their twill (`trouserMarks`, clipped to the trousers): jeans gold double topstitching and copper rivets at the pockets; chinos a slanted pocket seam

### `dress.js`

- the dress code's Settings switches and the waistcoat default (loaded after app.js)
- Settings → Schedule → Dress code (`renderDressUI`, `#cfg-dress`, rows from `DRESS_ROWS`): two switches (`.dress-sw`, `role="switch"`, 56×44px), "Jackets (suits and blazers)" and "Ties", each with one line of help
- `setDress(k, on)` saves `settings.dress`, releases the locked week (`clearLocks`) and re-plans Today when Settings closes
- with jackets off the Blazer days group and the Suit vest row are hidden (`#blazer-group`, `#vest-row`, class `dress-hide`) and a note says so
- `dressSummary()` gives the Schedule category's summary ("no ties", "no jackets", "no jackets or ties")
- `dressWhyUnused(i)`: why trousers, a shirt or shoes are never worn in a wardrobe without jackets (stats.js `whyUnused`)
- every suit saved by the app carries `vest:'yes'` or `'no'` (Add card, editor, "Bought it"), and a new suit defaults to no waistcoat
- `migrateVests()` (start-up, and after a sync brought data in: `dressSynced`): once per wardrobe, every stored suit with no `vest` value gets `vest:'yes'` (saved with a new stamp, so it syncs) and `settings.vestDef = 1` is saved with the settings; the flag is synced, so another device receives it with the suits and has nothing to do
- with backup on, the suits are changed only right after a sync that went through: stamping this device's copy first would let an out-of-date copy win over a newer one from another device; until then `hasVest` reads the suits the old way, so the plan is the same while a device waits (or is offline)
- it reads the stored wardrobe (IndexedDB), not `items`: tests that put items straight into `items` are left alone
- an empty wardrobe is not flagged at start-up (one from before may still arrive by sync or from a backup file); a wardrobe with no suit from before is flagged when an item is added (`dressNewItem`, from `save()` and `shopBought`), without a new stamp on the settings
- `dressSynced(m)` also drops `settings.vestDef` and `settings.dress` from memory when the merged settings don't have them (`onSyncedData` spreads the stored settings over the ones in memory, so a key the stored ones lack would stay)

### `tagging.js`

#### Tagging requests and sharp copies
- photo tagging on the app side (loaded after app.js): `tagExtras()` adds to every tag request the owner's colours/patterns (`settings.custom`), the latest 20 corrections (`settings.tagFixes`; an item never gets its own), and on a second tag the close-up and the measurement
- tag requests carry `wb` (was the photo white-balanced) from `tagExtras` and `/tag-many`, and `/pattern` from `claudePattern` (one flag for both pictures: the card's photo correction); a saved item's re-read and Ask Claude send none (unknown)
- the tagger gets a sharp copy (`TAG_MAX` 2048px, JPEG `TAG_Q` 0.92; group photos 2576px), kept on the device in Cache Storage `dw-keep-tagimg` (`keepTagImg`/`tagImgOf`; sw.js never deletes `dw-keep-*` caches) so an item can be re-tagged from the same picture
- the kept sharp photo is signed with its item photo (`keepTagImg(id,url,photo)`, header `x-ph`); `tagImgOf(id,it)` gives nothing for another photo; Replace photo keeps a new copy and drops `pbox`, Rotate turns the copy and `pbox`, a crop or `upgradePhotos` signs it again (`resignTagImg`); `cropSource` (itemsheet.js) still takes any copy (its own similarity test)
- the sharp close-up (`keepCloseImg`/`sharpCloseOf`, `closeimg/<id>` in the same device-only cache, `CLOSE_MAX` 1536, JPEG `TAG_Q`) is kept when an Add card is saved (`closeTagImg`) and when the editor adds a close-up (`replaceTexture`, itemsheet.js)
- "Read pattern from photo" (`rereadSett`) and the colour picker's Ask Claude (`colAskImgs`) send the sharp close-up; it is stored with the synced close-up's signature (`texSig`), so a replaced, removed or undone close-up never sends an old copy; another device sends the synced one; `tests/sharpclose.test.js`
- the synced close-up is 1536 px (`TEX_MAX` in add.js, 2026-11-13, the owner's ask; it was 640, where a fine twill aliased into a false check on the owner's mid grey blazer): every device and the PC's pre-build get the sharp close-up
- `upgradeCloseups` (at start-up after `recolourSpecSetts`, once: `localStorage.tex_up` '1536'): a close-up saved at 640 is made again at `TEX_MAX` from this device's sharp copy (none, nothing to do), in the old close-up's colour (each channel's linear mean matched, gains 0.6-1.6), and the sharp copy is kept again under the new signature; a toast says how many; `tests/sharpclose.test.js`
- adding a close-up tags again with both photos (`refineFromCloseup`): fields the owner set by hand (`q.edited`, set by `setq`) stay, the rest take the new answer, and the card says what changed
- `readPatternWithClaude` sends nothing for a card no longer in `queue` (saved or skipped while the close-up's tagging ran)
- `benchEstimate(n,{img,close})` prices the sizes really sent (`TAG_MAX` and `CLOSE_MAX`, 4:3); the colour picker's Ask Claude shows its cost from it

#### Owner colours, patterns and corrections
- owner colours/patterns: `settings.custom` (synced), applied by `applyCustom` in core.js; keys `own<letters>` / `own-<slug>`; each has a base (`colBase`/`patBase`): the planner reads `planCol(i)`/`patOf(i)` so it behaves like the base, while drawings and brightness (`lumCol`) use the colour's own shade; Settings lists them, removable when unused (`renderCustomUI`)
- the card shows confidence, one-tap runner-ups (`altColor`/`altPattern`), the measurement, and offers a new colour (Claude's `newColor`, or ΔE over `FAR_DE` 12) or pattern (`newPattern`) through `newColForm`/`newPatForm`
- corrections: saving an AI-tagged card records changed fields (`recordTagResult`: `settings.tagFixes`, last 60; `settings.tagStats` counts) and the stats page shows the accuracy (`tagStatsCard`)

#### White balance and measuring
- white balance: `wbRead` (gains, whether a white reference is there, its brightness); a close-up with its own reference (white paper) is corrected and exposure-set from it (`texGains` in add.js), otherwise like its item photo
- a white reference in an item photo must be one solid area (half its pixels with 3+ reference neighbours) at least 1.15x the lightness of the picture's darker quarter: a khaki or beige cloth's scattered highlights are not white (taking them turned khaki grey); `settCanvas` also needs it to cover 3% of the frame before setting exposure
- a close-up's white reference must be a solid patch set apart from the cloth (`closeRead` = `wbRead(c,{strict:true})`, `wbSolidStats`/`wbSolidOk`: a 2 px-eroded core over `WB_CORE`, `WB_GAP` brighter than the cloth's median, under `WB_TRANS` in between); used by `measureCard`, `texGains`, `closeTagImg`, `settFrom`/`settFromSpec`/`motifFromSpec`/`texFromSpec` and colpick; item photos keep the looser test
- `settCanvas(…,strict)` takes the close-up's white balance; the exposure may still be raised from the cloth's own white threads, never lowered
- measuring: `measureCloth` gives the median Lab of the close-up (or of Claude's `clothBox` in the item photo); `nearestCols` compares by ΔE2000 (`dE00` in core.js) against `calibLab`, the median of the owner's own measured items of that colour once there are two (`item.meas`), else the swatch
- `measureCloth` leaves out pixels far from the cloth joined to the region's edge (`measEdgeCut`, at most `MEAS_EDGE_MAX` 45%: the background, a collar) and returns `spread`, `edge` and the kept pixels (`px`, not enumerable)
- lightness counts half without a white reference, and a third on a close-up without one (`measKL`, `MEAS_KL_CLOSE` 3): the phone exposes any cloth to a mid tone
- `calibLab(c,type,skip)` learns from plain cloth only (`plainCloth`: a solid or a one-colour weave, `ONE_COL_WEAVES`, with no second colour) and never from the item itself
- a patterned cloth (`multiCol`: stripes, checks, motifs, paisley, tonal check) is measured colour by colour (`measureParts`/`measSplit`: the close-up's pixels split in two, seeded by the band reading's colours; the ground against the main colour, the stripe against the second); a one-colour weave is measured whole; the tagger is told the ground (`measHint`, `groundNear`); saved in `item.meas.parts`
- `sharpness(c)`: fine over fine + coarse detail at 400/100 px; under `BLUR_SHARP` (0.25) the card says "The close-up is too blurry to read the weave: retake it?" (`.blurnote`); the owner's phone close-ups are 0.19-0.64, the walkthrough's web crops mostly under 0.25

#### Colour recognition
- colour recognition on every item (2026-11-14, the owner's design): `measureAndApply` after the first tag, tagging again, Try again and Claude's pattern answer runs `measureCard` → `colourVerdicts` (one per colour) → `applyMeasured`; `tests/measure.test.js`
- a verdict's confidence (`measConf`, 0-1): how much nearer the measured colour is than the tagged one (ΔE00 gap), how near at all, the cloth's evenness (`spread`), the close-up's sharpness, a white reference, the photo agreeing with the close-up (`m.photo`, from `clothBox`), and how many of the two colours the owner's own plain items calibrate (`cal`)
- confident (`MEAS_AUTO`) and from a close-up or a white reference: the Add card changes the colour and says "Changed navy → charcoal (measured from your close-up)" with Undo (`q.auto`, `undoMeasured`, `.measauto`); an undone change is never made again (`q.autoUndo`)
- unsure (`MEAS_FLAG` up to `MEAS_AUTO`, gap 3+, within `FAR_DE`): "Measured: charcoal?" with "Use charcoal" (`.measalt`), the tag unchanged; `measuredAlt(q)` is the main colour's verdict
- a photo-only measurement doesn't count for an offer: the owner's dark mink suit measured nearest black from the photo, deep taupe from the close-up; fixtures `tests/fixtures/suit-mink*.{jpg,png}`
- a field the owner set by hand (`q.edited`) is never changed or asked about
- calibration (2026-11-14, read-only copy of the owner's backup, 42 items with a close-up): nearest measured colour = his tag 40% (walkthrough 25%); no confidence was 95% right (his pale pink herringbone shirt read white at 0.69, above every right one), so `MEAS_AUTO` 0.75 changes nothing on his wardrobe; flags on 4 of his 42 correct main colours where the old "Use …" offer came on 13
- Claude's own signals are kept from the same answer (no extra call): `aiSignals` → `q.tagAI` / `item.tagAI` = {col (the colour Claude gave), conf {type, primaryColor, pattern} high/medium/low, alt, altPat, seen (Claude was told the measurement)}; tag-many's one confidence counts for all three; the planner isn't sent it (shop.js `strip`)
- the worker's confidence stays high/medium/low (no number added): the existing answer already carries it
- the verdict weighs them (`verdictMode`, `aiFor`), main colour only and only while the field still holds Claude's answer (`tagAI.col`): Claude low with the measured colour as its runner-up → changed from `AI_LOW_AUTO` 0.55 (close-up or white reference; the note adds "Claude wasn’t sure"), asked from `AI_LOW_FLAG` 0.25
- Claude high and no white reference → never changed, asked only from `AI_HIGH_FLAG` 0.6; medium, no signals, or a runner-up that is a third colour → the measurement alone (`MEAS_AUTO`, `MEAS_FLAG`); `tests/aiverdict.test.js`
- a runner-up that agrees with the measurement is not evidence by itself: tagging again with the close-up tells Claude the measurement and asks it to name the measured colour as altColor when it picks another (`measuredText`, worker/tag.js)
- calibration of the Claude signals (2026-11-14, mocked answers over the owner's 42 close-up items and the walkthrough's 24): 0 wrong changes when Claude, right, says high or medium; Claude low on his pale pink herringbone shirt would turn it white (the one wrong change); an estimate until items carry `tagAI`
- a white reference is not weighted further than `measConf` already does: only 2 of his 42 close-ups and 1 of the walkthrough's have one, too few to calibrate
- a pattern the tag missed: a sharp close-up of cloth tagged solid with bands 12+ ΔE00 apart and two repeats suggests stripes or a check (`missedPattern`, `.measpat`), never sets it

#### Pattern readings
- full patterns (`readSett`/`settFrom`): for a striped/checked tie or shirt (`SETT_PATS`, or any cloth Claude gives a `weave` for) the sett is read from Claude's `patternBox` in the sharp photo, else the close-up (direction then from Claude's `weave.direction`), else Claude's own `weave.colours`; Claude's `weave.repeatsAcross` sets the figure scale; the card says what was read and can switch to the simple pattern (`toggleSett`); saved as `item.sett`, `item.pbox`, `item.weave`, `item.patternText`
- suits, blazers and trousers read their stripes and checks too (`SETT_PATS`); fine weaves (herringbone, birdseye, nailhead, sharkskin, twill) and houndstooth keep their drawn tiles; with both a sharp photo and a close-up showing 1.5+ repeats, the photo gives the direction and scale and the close-up the bands (`src:'photo+closeup'`); on the figure a jacket or shirt is ~200/180 pattern units across, so a 30-across pinstripe repeats every 6.7
- before a pattern is read, a photo with a white reference is exposure-corrected too (`settCanvas`, at most 1.6x in linear light), so an underexposed photo doesn't read every band too dark; a tie's scale (`tr`) comes from its own photo, a jacket's or shirt's from Claude's count
- `readable(t,p,w)` = `settable` or `claudeOnly`: an Add card reads (and saves) a motif or shirt-weave pattern with Claude once its close-up is in, not only band patterns
- `claudeOnly` patterns (motifs, shirt weaves, tie weaves) never use the pixel band reader; the item sheet's "Read pattern from photo" shows for any `claudeOnly` pattern (itemsheet.js)
- a stripe reading that contradicts the tag is not used (`settCheck` in `readSett`/`rereadSett`): crossing lines on a jacket's or trousers' stripe, or level stripes read from the item photo, turn it down (`q.settReject`, the card says why: `.settrej`); level from a close-up or Claude it is turned upright; a shirt's crossing lines are dropped; a tie keeps any reading (a plaid tie is often tagged stripe)
- `settFrom` keeps each input's reading (`settMemo`, by the card's canvases): the same reading is not worked out again on every re-tag or toggle (1.8-2.5 s each at phone speed)
- Claude reads the pattern itself once a card has a close-up (`readPatternWithClaude` → worker `POST /pattern`, `claudePattern`): every band of a repeat each way with its width, the pane shape and the repeats in the close-up and across the item, with the noise (seams, moire, uneven panes) left out; saved as `item.patternSpec`; the pixel reader (`settFrom`) is the fallback; the editor's "Read pattern from photo" (`rereadSett`) asks Claude too
- `settFromSpec` draws Claude's answer with colours from the photos: each named thread matched to its own pixels, Claude's hue where the pixels read grey (a light-blue line in khaki linen), a quarter of the ground's lightness mixed into each line (crossing threads, a suit's pinstripe)
- `settFromSpec` matches the close-up's exposure to the item photo only inside the saved pattern box (`pbox`); with no box the close-up keeps its own colours (a whole-photo median took in the wall and turned a navy pinstripe lavender); if the measured ground still lands over 15 ΔE00 from Claude's ground, it drops the exposure match, and failing that uses Claude's colours
- `settFromSpec`'s ground is the median of the whole close-up only when Claude's ground covers 70% of the cloth or more; below that it is the pixels nearest Claude's ground colour: the owner's half-navy, half-blue repp tie read slate (#344a71) for #1e2347, the median falling between the two
- a thin line (all its stripes together 10% of the repeat or less) takes, of its nearest pixels, the half furthest from the ground: blurred with the ground in the close-up it read light grey
- `recolourSpecSetts()` (once per rule change, flag `localStorage.spec_recolour`, now '3') recolours saved Claude-read patterns from the saved `patternSpec` and close-up, without calling Claude; the user's suit photos are `tests/fixtures/suit-pinstripe*.jpg`
- the owner's navy & white & grey stripe tie had Claude's structure corrected by hand (2026-11-12: white, grey, white touching), in its `patternSpec`, so a recolour keeps it

#### Motifs
- a motif answer (`layout:'motif'`: a small figure on a grid, a neat/foulard, dots) becomes `sett = {v:3, motif:{grid, ground, figs:[{shape, place, size, cols, names, centre, centreName}]}, a, cr, tr, src:'claude+pixels'}` (`motifFromSpec`, chosen by `specSett`): each colour from its nearest pixels, Claude's hue kept where they read grey, the close-up's exposure matched to the photo only when there is a box on the cloth (else the photo's wall washes it out)
- `MOTIF_PATS` (foulard, polka-dot; detect.js) never get a band reading (`readSett`, `rereadSett`): a band reader turns a neat into a diagonal plaid; without Claude they are drawn with the generic tile
- a motif figure can be any shape (`shape:'figure'`): Claude draws it as a bitmap (`bitmap` rows of 1/0, kept as `figs[].bmp`, with a `name`); the grid's cells can be taller or shorter than wide (`cellAspect` → `motif.aspect`) and every other row can be shifted half a cell (`rowOffset:'half'` → `motif.off`)
- a shirt's two-colour figured dobby (the user's grey chevrons on white, `tests/fixtures/shirt-chevron-closeup.png`) is a motif, not a texture, drawn at full contrast

#### Shirt weaves
- shirt weave textures (`TEXTURE_PATS`/`texPat` in detect.js: dobby, woven, oxford, twill, herringbone…): `/pattern` layout `texture` gives a one-repeat bitmap (`grid` rows of 1/0, 1 = raised), kind, two tones and contrast; `texFromSpec` saves `item.sett {v:4, tex:{kind,grid,lighter,contrast,rel}}`, `rel` being the close-up's lightness swing (`texContrast`, light falloff removed by a box blur) as a share of its lightness
- the texture is drawn in the tagged colour (`texTones` in draw.js: swing softened to 0.4× and capped at 7 L*, average kept at the tag, a white shirt's ground darkens slightly) as a soft image tile (`texTileUrl`), on the figure no finer than 6 units a repeat; only for shirts, and `usableSett` drops a texture reading once the pattern is no longer a weave (or a band reading on a weave)
- a texture read as `herringbone` or `twill` is drawn with the woven tiles (`herringboneTile` in draw.js, columns of slanted lines turning at each column edge), not Claude's bitmap: the user's blue shirt came back as one V that tiled into horizontal zigzags; contrast from `rel`, a swatch at most 20 column pairs (Claude counted 60 chevrons); figured weaves keep the bitmap
- a herringbone stripe's plain bands come from Claude's bitmap (`texPlainBand` in draw.js: columns the same all the way down; all 1 = a shiny satin band), drawn after every twill column, alternating column / band / opposite column / band as on the user's pink shirt (`herringboneTile(…, band)`); the worker prompt tells Claude to mark them
- a texture's `aspect` (a repeat's height ÷ width, from Claude) stretches its tile: Claude drew the user's tall dobby diamonds as a square bitmap
- a texture isn't sent to the photo generator (plain shirts share one photo per colour); textured shirts with a close-up but no reading are listed and read under Settings → Outfit pictures → "Painted plain" (asm-color.js); the user's diamond-dobby close-up is `tests/fixtures/shirt-diamond-closeup.jpg`

#### Ties
- woven and tonal-check ties are read by Claude (`TIE_WEAVES`/`tieWeave` in detect.js, in `claudeOnly`): before, nothing read them and the tie painter drew them plain; the owner's charcoal & grey woven tie came back as a motif (diagonal grid, 40 across) and paints like his close-up; a pure weave (layout `texture`) gives a `tex` reading; `tests/tieweave.test.js`
- `usableSett` takes any reading for such a tie and `specSett` makes a `tex` reading for a tie as for a shirt: the owner's black & charcoal tonal check came back as an 8x8 diamond dobby (32 across) and is painted as a tone-on-tone grid; the faint larger check over it is not drawn (a weave answer has no second layer)
- `asmTieFor` (assemble.js) takes `s.tex`, and `asmTieTile` draws it with `fabricDef(…,'asmtie')`, the weave's swing `TIE_TEX_K` (2.6) times the shirt's (at the shirt's it read about 3.5 L*, nearly flat); `TIE_TEX_K` also strengthens a twill or herringbone in `fabricDef`'s twill branch
- a tie's twill or herringbone repeats at most `ASM_TIE_TEX_MAX` (50) times across, about 4 px a repeat: Claude counted 80 ribs on the owner's burgundy twill tie and at under 3 px they blurred into flat colour
- so a tie's weave shows on the phone (the 2048 picture shrunk about 1.75 times): a figured weave repeats at most `ASM_TIE_FIG_MAX` (22) times across, and on a very dark tie (L* under `TIE_DARK_L` 20) its swing is `TIE_DARK_X` (1.55) times `TIE_TEX_K` (draw.js, generic weave branch only); chosen from four variants at phone size as subtle but visible; the owner's black tonal-check tie read flat black before
- `TIE_TEX_K`, `ASM_TIE_TEX_MAX`, `ASM_TIE_FIG_MAX`, `TIE_DARK_L` and `TIE_DARK_X` are all in `asmTieSig`
- on a tie no ground lightness is mixed into a line (the quarter mix is for a line whose threads cross the ground's): it darkened the repp tie's blue stripe and turned a thin white edging grey

#### Patterns for the photo generator
- a striped or checked shirt, or one with a motif reading (`shirtPatterned` in photos.js), is described to the photo generator ("a white stripe dress shirt (…)", `motifText` for a motif, its drawing as a reference) and gets its own photo key; plain and finely woven shirts share one photo per colour
- the realistic photo gets a read pattern three ways (`patternPrompt`, `outfitRefsFull`): a description from the measurements (`settText`: direction as the viewer sees it from `sett.a`, each colour's share named with Claude's `weave.colours` names (hue-weighted match), pinlines, crossing lines), Claude's `patternText` with any direction phrase removed (`dropDir`: Claude once had a plaid tie's stripes rising the wrong way and the generator copied it), and a drawing of the pattern (`patternDiagram`: a tie's blade tip down, else a square of cloth) inserted after the item's photo
- `motifText()` describes a motif (grid, figures, colours, ground, repeats across); `outfitRefsFull` labels its diagram as figures
- tested against the user's real worker: the same outfit made the old way and the new way, the new one had the right stripe direction, colour balance and crossing lines

### `app.js`

- app.js was split on 2026-11-14 (the audit's recommendation) into classic scripts loaded in its place, in this order: `app.js` (state, IndexedDB, the busy pill, the tab bar's fit, `ask`, colour helpers, photo loading, the precision swatch), `add.js` (the Add page), `itemsheet.js` (the item sheet, its photo editor, the Wardrobe grid), `history.js` (past days, locks, learning, the piece picker, occasions, the score card), `today.js` (the month's plan and snapshot, Today's rows, figure and overlays, the pieces box, zoom, swatches, swiping, `renderToday`), `month.js`, `photos.js` (photo keys, kept photos, the realistic photo, item pictures, the queue), `settings.js` (Settings and its categories, toasts, `refreshAll`, weather, the theme), `start.js` (`show`, the page moves, the start-up chain, the service worker)
- the start-up chain must stay in the last of them (`start.js`): its callbacks can run before the scripts after it (ui.js…) have loaded, so whatever Today draws at start-up lives in these files or earlier (see `itemTitle` in core.js); a new file goes into index.html and sw.js `ASSETS` in load order
- nothing a script runs at load may reach a name declared in a later script (function declarations are hoisted only within their own file); the split was checked mechanically for that (only `applyTheme` → `renderToday`, guarded by `window.appReady`, crosses)
- IndexedDB storage: items, day history, settings; generated photos in `meta` as `render:<combination key>`
- `txs` and `atomic` reject on `onabort` too (`txFail`): a transaction aborted by a full disk used to settle neither way, so the Add card just stayed; the rejection is the browser's error marked `dwStore`
- `loadImg` revokes its object URL once the picture has loaded
- working on it: every POST to the worker's AI endpoints (`/` tagging, `/tag-many`, `/pattern`, `/render` and item pictures, not `mode:'queue'`) is caught by a `fetch` hook (`busyLabelFor`) that shows `#busy`, a spinning pill above the tab bar, with what is running (`busyStart`/`renderBusy`); photos waiting in the background queue show there too
- `.spin` is the ring, also in "Generating photo…", the Add card's busy state and "Claude is reading the pattern…"

#### The tab bar

- the bottom tab bar is compact so the picture and the tiles fit on one screen: 44px buttons (`nav button`), and it keeps only `--navpad` (the home-indicator inset minus 18px) below them; `--navh` is its height, used by the body padding and the toast
- it grows upward (`--navx`, its buttons taller) until its top is one `--gap` below Today's below-the-waist tiles, so nothing peeks out between them (`fitNav`, after each render, on resize and when Today's size changes); at most `NAV_MAX` (58, so the tallest bar is 102px), never on a screen where the tiles already reach it; the natural top is computed, not measured, since the height animates
- the fit is measured only on a day whose photo has loaded (before that the photo has no height and the bar jumped to its cap and stayed); that measurement is kept per screen size (localStorage `nav_fit2:<w>x<h>`) and used on days with only the drawing (whose Generate button pushes the tiles lower) and on weekends; the photo's `onload` refits; old `nav_fit:` values are dropped
- the fit is always taken as if the row had three tiles: with four (trousers, a coat) a picture tile is narrower and, its 4:3 picture following its width, shorter, which made the bar taller on those days; `fitNav` works out the three-tile height from each tile's picture shape (drawn tiles keep their height)

#### The precision swatch

- the precision swatch (`item.swatch`, 128px, `cropSwatch`) is cut from the fabric close-up when there is one (`q.texCanvas`, white-balanced; the Add inspector's zoom/position sliders work on it), else from the item photo; `item.swSrc` says which ('tex'/'photo'); the editor re-cuts it when the close-up is added, replaced, removed or undone (`refreshSwatch`)
- a close-up swatch takes its lightness from the tagged colour (`matchLight`: each pixel keeps its lightness above/below the crop's median and its hue; near white the swing narrows so threads stay under paper white): a close-up shot in dim light made a white shirt grey; changing the colour (Add card `setq`, editor `sete`) re-cuts it
- `texSwatches()` re-cuts existing close-up swatches once (localStorage flag `tex_swatch2`)
- `swatchSVG` (draw.js) shows the close-up swatch for an item with `swSrc:'tex'` (stats); others stay drawn from the tags, never cut from the item photo
- every drawn small swatch uses `fabricDef(…,'dot')` (draw.js), a scale that reads at that size: two repeats of a band sett (T 8 of 16), three motif cells, two and a half weave repeats with 1.7× contrast

#### Wording and accessibility

- Today's pieces card says "1 piece"; the backup status, restore and roll-back messages say "1 item"
- plurals: "1 point behind" (stats.js `pts`), "planned about once" (analysis.js), "1 item", "1 band", "1 different look", "1 of 1 day locked"
- file pickers are `<input type="file" class="vfile">` inside their label (visually hidden, still focusable: with `hidden` the keyboard couldn't reach One item, Several items, Restore file, Replace photo, the close-up); `#photo-url` and `#cfg-city` have `aria-label`s

#### Tests

- `tests/ui.test.js`: dialogs (`askConfirm`), Settings wording and folds, the accent's contrast, the checklist's place, and no sideways scroll of the pages and setup steps at 320/390/626px in both themes
- `tests/auditfix.test.js`: the quick bugs of the 2026-11-13 audit
- in a cloud container Playwright may not be in the worktree's `node_modules`: run with `NODE_PATH` set to the folder that holds the preinstalled one (`npm root -g` shows it; it has been `/opt/node22/lib/node_modules` and `/opt/node-tools/node_modules`); on the owner's PC it is in `node_modules`

### `add.js`

- Add asks "One item" (`#add-one`, `addFiles(files)`; paste and drag too) or "Several items" (`#add-group`, `addFiles(files,true)` → `addMulti`)
- several photos as "One item" each get their card at once and are tagged `ADD_PAR` (3) at a time (`addFiles`)
- fabric close-ups: `TEXTURE_TYPES` (core.js: suit, blazer, pants, shirt, tie) can have a second photo `item.texture` (a close-up of the cloth, `TEX_MAX` 1536px); a card for those types shows "Step 2 · Fabric close-up" (`texSlot`/`addTexture`), optional
- an Add card keeps one close-up canvas (`q.raw.tex`, the larger of `TEX_MAX`/`CLOSE_MAX`), and Confirm lets go of the card's canvases (`q.raw`, `q.big`, `q.texCanvas`) once saved
- an Add card's item photo is made from its sharp copy (`raw.full`, `TAG_MAX`) shrunk to `PH_MAX` (`cardPics`); made from the 800px measuring copy `q.big`, every new item's photo was 800px (audit 2026-11-13)
- automatic white balance on new Add photos (`wbGains` in tagging.js, `applyWb`): gains from the brightest near-neutral pixels (≤35% saturated, 0.5–85% of the frame), capped at −15%/+18% per channel, skipped under 2%; a card's close-up gets its item photo's gains; the card has Show original (`toggleWb`, originals kept in `q.raw` until saved); close-ups added later in the editor are not corrected
- the "As tagged" swatch (`tagSwInner`) splits when there is a close-up: drawn colour on the left half, the close-up on the right (`.swsplit .swtex`)
- the Add card's swatch box reads "Fabric swatch · From the photo / From the fabric close-up: zoom and move it to a clean patch of cloth", with Zoom, Left–right, Up–down
- the Add card's and the editor's Vest choice show "No vest" unless the suit has one (`hasVest`)
- Confirm and "Save all" are switched off while Claude reads a card (`cardReading`: `q.refining` or `q.patternReading`), and `save`/`saveAll` return meanwhile: saved during the reading the card kept the weaker tags and the pattern call was still paid for
- bought, on the way: the Add card has "Bought, on the way" (`orderRow`/`setOrder`) with an optional Arrives date (`setArrives`); `save()` stores it paused; the grid tag reads "On the way · <date>", the open item can change the date (`setItemArrives`, itemsheet.js) or "It arrived: put in rotation"
- `checkArrivals()` (start-up and `newDayCheck`) puts items back in rotation the day after their date, with a toast; it also brings back pieces that were away being cleaned (`item.away`): `cleaned` = the date they were due back, and the toast says they are back (`careBackText`)
- the Add tab's note while not connected (`renderAdd`): "Photos won't be read automatically. Paste your invite link in Settings → Connection, or add items by hand."

### `itemsheet.js`

#### Photos

- the Wardrobe editor can replace, rotate, zoom-crop and undo an item's photo without touching its tags (`photoTools`, `setPhoto`)
- an item's photo is kept at `PH_MAX` 1536px (JPEG .85; the owner, 2026-11-13: "upgrade the main photo size stored as well"), by Add too (`cardPics`); photos are stored one by one on the server and fetched when needed (sync.js), so the backup's text doesn't grow with them
- every item photo has a small copy for grids and lists (`photoSm`, `PH_SM` 480px, JPEG .82, with `phSig` = the photo's signature `phSigOf`): `phSm(i)` gives it when current, else the photo; the wardrobe grid, the piece picker (`pickPic`) and stats (`statPic`) use it, the item sheet, the pieces list's photo and the photo generator the full photo; `makeSmall` makes it on save, in `setPic` and `undoPhoto`, and `smallPhotos` at start-up for any item without a current one; synced like any photo
- `upgradePhotos` (tagging.js, at start-up after `upgradeCloseups`, once: localStorage `photo_up` '1536'): a photo under `PH_MAX` whose sharp copy on this device (`tagImgOf`) shows the same picture (`cropSource`'s test) is made again at `PH_MAX` from it, in the old photo's colour (each channel's linear mean matched, gains 0.6–1.6: the Add card white-balanced the old one); a cropped or replaced photo doesn't match and is left; a toast says how many; `tests/photoedit.test.js`
- zoom & crop cuts from the best copy (`cropSource`): the sharp copy kept on this device when the photo was read (`tagImgOf`, up to 2048px), turned to match the photo, when it is the same picture (same shape, mean grey difference at 24x24 up to `CROP_MATCH` 12); else from the photo; the output is still at most `PH_MAX`
- a replaced or already cropped photo no longer matches the sharp copy, so it is cropped from itself; Replace photo does not renew the sharp copy, since the pattern re-read (`rereadSett`) reads it together with the pattern box (`pbox`) measured on the original
- the editor adds, replaces and removes the fabric close-up (`replaceTexture`/`setTexture`, undo per field via `setPic`)

#### The item sheet

- tapping an item opens it in `#item-view`, a sheet that slides up over the Wardrobe (the full width of a phone, from `--ivtop` below the top of the screen: the status bar's height on a notched phone, else 36px; a centred panel from 600px), over `#item-backdrop`; the grid never moves or reshuffles (`openItem`/`closeItem`/`renderItem`, drawn by `renderWardrobe` whenever `editing` is set)
- swiping the item sheet down closes it: its header (with the grabber) is a handle at any time, its content only while scrolled to the top (further down the swipe scrolls it back up); decided on the first move of a touch, before the browser scrolls; the sheet follows the finger and the backdrop lightens, and it closes past a quarter of its height or on a flick, else springs back (`ivDrag`, `closeItem(false, dragged)`); not while cropping
- closing the item sheet on another item than the one opened (`itemFrom`) first scrolls the grid to that item's box
- the sheet also closes with Done in its bottom bar (`.ivbar`, always on screen), a tap on the backdrop (the strip above the sheet), the phone's Back button or gesture (one history entry while open: `histPush`/`histDrop`, `itemBack` marks our own `history.back()`; `histPush` waits while `appPend`) and Esc (which first leaves a crop); the photo is not a close button
- ‹ › beside Done, a sideways swipe on the sheet (it may start on a dropdown) and the arrow keys go to the previous / next item of the list on screen (`stepItem`, `wardList`); the header shows the type, the name and "n of m"
- the sheet's body (`itemBody`): the photo beside the swatch, "Edit photos" folding the photo tools right under it (`togglePhotoTools`, `phEdit.open`; an item with no photo shows Add photo directly), a Details card (shade, tags, pattern reading), a Rotation card, and Delete item alone at the end
- while the sheet is up, `header`, `main` and `nav` are `inert` (`itemShown`), `body.iv-on` lifts the toast and the busy pill above the bottom bar, and `show()` of another tab drops the sheet (`dropItem`)
- `startCrop` scrolls the item sheet to the top, where the crop frame replaces the picture
- an item with a photo and a close-up gets a tappable pair (`#ivpair`, class `cmpable`): a tap on the split swatch splits them up (`toggleCompare`, `phEdit.cmp`, class `cmp`): a copy of the drawing (`.cmpdraw`, hidden on the swatch's drawn half) slides over the photo's square and the close-up's clip opens to its whole square; a tap on either square puts them back; the captions switch to "As tagged" / "Close-up"; `tests/compare.test.js`
- out of rotation: the Rotation card has "Take out of rotation" / "Put back in rotation" (`togglePause`); taking it out releases upcoming days it was pinned to (`force`), the picker and "Suggest another" leave it out (`slotPool`/`swapSlot` in history.js; correcting a past day still offers it), and its grid box is dimmed with an "Out of rotation" tag (`.gi.paused`, `.pausetag`)

#### The Wardrobe grid

- swiping the grid or ←/→ steps through the type filters in chip order, skipping empty types (`stepType`/`wardTypes`)
- Wardrobe boxes are one tap target (photo, type eyebrow `.gtype`, name) with no buttons; Delete (`.danger`) is in the item sheet; Add and the editor use one set of labels (Type, Colour, Second colour, Third colour) and dropdown labels start with a capital (`cap1`, app.js)
- `renderWardrobe` draws the header count (`#wcount`), `wardBar()` above the chips and the grid through `wardGrid(wardFresh())` (wardrobe.js)
- an empty Wardrobe shows only its empty card: no search field, sort or type chips

### `history.js`

#### The score card

- the score card is a `#sbox` fold box like `#ibox`/`#mbox` (`scoreCard`, `toggleScore`, `scoreOpen`; its checks slide in one after another and each `.sbar` fills to the points scored)
- the score card's second line says what the score means (`scoreCard`, `adviceFor`, memoised per outfit): 'N things to put right' with a hard check (the badge turns red), 'Could be N with what you own' when a swap scores higher, 'The best your wardrobe allows' below 100 with none, else 'Outfit score'
- unfolded, swaps that would score higher sit above the checks as 44px rows (`.sfix`, `.sfixbtn`: swatch, piece, +points; a tap wears it through `applyFix` → `pickItem`); a hard check is marked '!' in red, a check nothing owned improves says so (`.lim`), and a capped score explains the cap (`.scap`); none of this on past or worn days
- no piece card under the score
- the score box and the pieces list unfold and fold like the month (`boxUnfold`/`boxFold`, `.bfast`, `.bshut`): laid out once, the card's edge moving over it and a slide of what is under it; their own entry cascades (the checks and bars, the pieces) still play; folding lifts the rows out last first (`.blift`, `.bli` with `--bi`, `--bn`; `BOX_LIFT` 20 ms apart, `mcLift`), then the card closes; `box._fa` holds a box's running animations so a tap mid-fold finishes it (`boxStop`); `tests/boxfold.test.js`, `tests/scoreanim.test.js` (measures the visible height)
- the month, score and pieces cards don't use a `clip-path` for their moving edge: `foldEdge(box, from, to, o)` lays a strip over the card (`.fedge` clipped to the card's shape, its `<i>` drawing the rounded bottom border with `var(--bg)` under it; `.fedge-on` makes the card `position:relative; overflow:visible; display:flow-root` meanwhile) that slides with the cards below; `drop()` removes it at the end or on a stop
- why: Safari repaints an animated clip-path on the page's thread every frame while it slides transforms on its compositor, so on an iPhone the card's edge and the cards below drifted apart and folding juddered
- the piece photos (`picOpen`/`picShut`, today.js) use the same strip: `foldEdge` draws whatever bottom border the element has (a row's straight line, none for the tile) and fills with the first non-transparent background of its ancestors; `.fedge-bfc` (flow-root) only for an element that had overflow set, so a row's margins aren't changed
- tests find the strip with `.fedge` and wait on `getAnimations({subtree:true})` with `playState==='running'`
- Reset is a card of its own under the month (`resetCard`, `#rbox`, the cards' 76px look, "↺ Reset"), shown on a day the user changed (swaps, picks, the vest); it calls `resetDay`

#### The week's locks and re-planning

- the coming week stays as shown: after each render `lockUpcoming()` gives every workday from today to `LOCK_DAYS`−1 (7) days on `rec.lock` = `lockIds(o)` (the plan's pieces, no coat), rewritten when the plan for that day differs; a different tie today, a new item or a day marked not worn then re-plans only the days after the lock
- a change made by hand on a day drops its lock (`swapSlot`, `pickItem`, `setOccasion`, `resetDay`, `moveRecs`): the day is planned again around the change and locked as it then shows; the vest toggle and worn / not worn keep it
- `clearLocks()` releases the locks after today: from `setDarkShirts`, `toggleDay` (workdays, blazer days) and `setOccasion` (the days around an occasion are planned around it); `tests/weeklock.test.js`
- a new `PLAN_RULES` calls `replanFuture(true)` (the planner audit, 2026-11-14): only what the app chose goes, the week's locks (`rec.lock`) and pieces it recorded by itself (`rec.auto`); the owner's own picks (force, skip, the vest, `kind`, `off`) stay; the toast says "Your own picks were kept"; `tests/replan.test.js`
- Settings' Re-plan upcoming days (`replanFuture()`) clears the locks and the picks too, without counting them as days reset
- `checkPlanRules()` stores `settings.planRules` with `metaPut` and no new stamp (not `saveUserSettings`): the stamp made a fresh install's defaults newer than the backup's settings, and on an existing device it could undo a setting changed on another device since its last sync
- a past day whose record has no pieces (`ids`) is recorded by `recordDays` with what the record already has: a day the app was not opened on kept only its week lock, so it never became history (no wear counts in `wornDays`, an outfit that could still change); `tests/weeklock.test.js`

#### Worn, picks, learning and past days

- worn / not worn is one pill at the right end of the date bar's weather line on today and past workdays with an outfit (`wornPill`/`toggleWorn` in today.js, `setWorn`; the owner's design 2026-11-14, replacing the ✕ / ✓ circles on the picture): a day is worn unless marked not, so it reads "✓ Wore" (accent fill) with nothing recorded; a tap records `worn:false` ("✕ Didn't", grey) and a tap again clears it (no mark, never `worn:true`, which would freeze today's outfit); the weather stays centred (`.wx.haspill`: a three-column grid whose sides hold the pill's width `--wp`, 68 px, 58 px under 360 px), "Set your location for weather" shortens to "Set location" beside the pill; no pill on future days; the date bar's height is unchanged (`tests/todaytight.test.js`)
- "Last worn" (`lastWorn` in photos.js, a pill at the picture's bottom right, `wornBar`) counts every earlier day with recorded pieces unless marked "Didn't" (it used to take a ✓); Insights and the cleaning counts still count today only once it is over or recorded worn, as before
- the swatches on the picture no longer step up on today and past days (`swatchStack(o,false)`): the circles they cleared are gone, so the cleaning banner cuts round the tie swatch on today as on coming days
- ⇄ beside a piece opens the picker sheet (`openPicker`/`pickItem`: every item for the slot, best match first by `fitOf`; "Suggest another" is the old cycling `swapSlot`)
- swaps and picks keep a piece taken off pinned (`keepOff`); Reset and an occasion clear `rec.off`
- changes teach the planner (`learnFrom`: a swap votes a pairing down, a hand pick votes it up)
- a past day can be corrected to what was really worn (`togglePastEdit`/`correctPast`: the record gets `edited`, `worn:true` and the real ids)

### `today.js`

#### Layout

- tiles show a short 4:3 picture; no "Below the waist" heading
- the score, pieces and month cards share one size (76px folded, a 112px picture slot, one text column) and everything on Today is spaced by `--gap` (12px) in styles.css
- Today goes two columns (outfit left, cards right) only from 600px wide in landscape; upright (the Duo unfolded, a tablet) it stacks outfit, tiles and cards, the picture (`.fig`) the full width from 600px (under 600px it stays at most 390px, so a phone or the folded Duo fits picture and tiles on one screen); `tests/run.js` checks both
- with a wardrobe that can't dress a day yet, the "Get your first outfit" checklist (`setupToday`, setup.js) is the first thing in the stage, above the figure or the day-off note
- `goToday()` from the Today tab (the date bar's "↩ Today" / "↩ Next outfit" button is gone, the owner 2026-11-14: `todayBtn` returns ''; `tests/daypieces.test.js`); `newDayCheck()` moves on to today when the app is reopened on a later day

#### The pieces list and photos

- the pieces list is folded into `#ibox` (each piece unfolds into its photo, `toggleRow`); a below-the-waist tile under the figure unfolds that item's photo in `#bbox` below the tiles (`pickPiece`/`belowOpen`; tapping the tile again or the photo folds it)
- Today's pieces list (`slots`) has no Suit/Blazer row and no Tie / Tie clip rows for a piece the outfit lacks and the day doesn't need (`needsJacket`, `needsTie`), so no "Add one on the Add tab" for it; the rows stay while correcting a past day, to add the piece worn
- Today's pieces list, vest row and outfit chips show the drawn swatch even for an item with a close-up (`swatchSVG(i,true)`); Today's piece squares are 40px (`#today .row .dot`), as large as the rows' 40px tap height allows, so no row is taller
- a piece's photo (a row, `toggleRow`; a tile's photo, `pickPiece`/`#bbox`) opens and shuts like the boxes (`picOpen`/`picShut`, `.pfast`): laid out once, the photo's area opening while what is below it slides (`picBelow`: by position, so the side column in landscape stays), the pieces card growing with it (`picCards`); the photo drops in with the days' bounce and lifts out with their dip before the space closes; `el._pa` holds its animations (`picStop`); `tests/picfold.test.js`
- a photo is decoded before it opens (`picOpenReady`, at most 300 ms): with its height unknown the rest of it jumped in afterwards
- opening a row shuts another open photo at once (`picSnap`); one above the tapped row is made up for by the scroll, so the row stays under the finger; another tile while one is open swaps the photo in place
- folding from inside: a tap on an open photo (row or tile) folds it, a tap on the open score breakdown folds it, a tap in the open pieces list that is not on a button or photo folds the list (`foldListTap`), and folding a box whose top is off screen scrolls the card back into view (`keepInView`)
- take off for the day: − beside the jacket and the tie in the pieces list (`offBtn`, today and coming days, not worn or past days, not a "No jacket or tie" day) calls `setOff(slot, true)`, which pins the rest of the outfit (`force`, `kind`) and sets `rec.off`; the row then says "Taken off" (": the trousers stay" for a suit) with + to put it back (`offRow`, `setOff(slot, false)`); the suit's trousers row is "Trousers" with no ⇄

#### Zoom and swiping

- double-tap the picture (photo or drawing) to zoom 2.5x on the tapped spot, again to zoom out (`toggleZoom`/`applyZoom`, `zoom` state, kept across redraws of the same day); a drag pans while zoomed and doesn't change the day; `#mannequin-container` has `touch-action:manipulation` and clips the zoomed picture
- a sideways swipe folds every open box (score, list and rows, below-the-waist photo, month) as soon as the drag locks sideways, and zooms out (`foldAll`, also from `stepDay`)
- with reduced motion a day step doesn't slide (`stepDay` and the swipe's fly-out check `noMotion()`, itemsheet.js)

#### Moving an outfit in the open month

- a long press (`MOVE_HOLD` 380 ms, still within `MOVE_SLOP` 8px) on today or a later workday that isn't worn and has no occasion (`data-mv` on the cell) lifts its drawing (`.mv-ghost`, held above the finger; the other days wiggle, `#mpanel-in.mv-on`); the mouse holds the button
- while it is dragged, the day under it previews the month re-planned with the outfit there (`moveRecs` pins its pieces on the target with its `kind`, clears the day it left; `planWith` runs `buildPlan` on a copy of `dayRecs`); `showPlan` redraws only cells whose outfit changed (`mvSig`), sliding each outfit from the cell that showed it (FLIP), and nothing is saved until the drop
- dropping saves both days, re-renders and toasts what moved with Undo (`toast(text, ms, {label, fn})`); dropping off the days, or on the day it came from, changes nothing; `outfitMove` stops the day swipe and month drag while moving
- during a move the lifted day's old drawing stays in the page hidden (`.mv-held`): removing the node a touch started on stops its touchmove/touchend; the cells' children take no pointer events (`#mpanel-in.mv-on .mc *`), since a drawing sliding to its new day caught the pointer over its old one
- a day record's `kind` ('suit' / 'blazer') fixes the day's jacket kind in `planSim`, so a suit outfit moved onto a blazer day stays a suit day; `tests/moveoutfit.test.js`

#### The plan and its snapshot

- `planMonth(y,m)` / `planFor()` keep one shared `planSim` in `cache` (anything that changes the wardrobe, history, settings or weather must reset `cache={}`)
- no outfit is shown for a day before the wardrobe existed (`planTrim` in `planMonth`: days before `planStartDay()`, the day the first item was `added`, and before today, without a record with pieces, are left out of the month's plan; the planner still plans them for rest and variety; items without `added` set no start): a new user saw two weeks of planned past days with ✕/✓ and "22 outfits"; `tests/newuser.test.js` covers it with plain errors, the list instead of 404s, captions, Several items, the setup's city search and holidays
- `hasOutfit(o)` is true for a no-jacket day too
- Today's month is kept in IndexedDB (meta `PLAN_SNAP`, `planSnapSoon` after the week is locked): pieces as `{$i: id, $x: what the planner added (rest)}` (`snapOut`/`snapIn`), about 60 KB
- at start-up `planSnapUse` puts it in `cache` when `planSig()` (the day, the items' and day records' stamps, the settings' stamp, `weather`, `climate`) matches, so Today is drawn without the planner; `cache.snap` marks it, and once idle `planSnapCheck` plans the month for real, redraws Today only if an outfit differs (`outSig`) and only then records the days and locks the week (`recordDays`/`lockUpcoming` never run from the kept copy); `planSnapUsed`, `planRuns` are read by `tests/speed.test.js`
- `wxPreload()` reads the kept forecast (`wx`, under 3 h old) and climate (`wx_norm`) before Today is first drawn, and `loadWeather` leaves the plan alone when the kept forecast is what it already has: with a location set, start-up planned three times (without weather, with the climate, with the forecast)
- measured (emulated Pixel 7, CPU 4x, 107 items): warm start ready 662 → 205 ms, longest task 302 → 78 ms

### `month.js`

- the month plan is folded into `#mbox` and unfolds in place; the open month has a full-width `.foldbar` ("Fold away") right under the days
- the open month has no arrows, swipe hint or legend (the cells show worn/today/planned/rest themselves), its centred title close above the weekday row: a sideways touch swipe inside `#mpanel-in` (handed over by the Today swipe handler, `st.month`) or a mouse drag moves between months (`monthDrag`/`monthRelease`, `monthStep(n, from)` slides the new month in; the `#mswipe` wrapper moves); the day doesn't change and nothing else folds; a drag's closing click doesn't open a day
- the month box unfolds and folds without animating its height (`monthUnfold`/`monthFold`): the page is laid out once (`.mfast` turns the height, padding and per-day transitions off), the card's edge (`foldEdge`), a slide of what is under it (the Reset card) and a fade of the days move; measured at 4x CPU: unfold 30 layouts and 285 paints before, 5 and 7 after; fold 32/56 before, 4/4 after
- folding scrolls first to where the shorter page can stay (no jump when it is laid out shut) and turns the arrow back at once (`.mshut`); `monthStop` finishes a fold interrupted by another tap
- the days are put into the folded box while the app is idle (`monthFillSoon` from `monthLink`, `monthFill`, `data-fill` = month and selected day), so a tap only unfolds it; the folded `#mpanel-in` is `inert`
- the days drop in one after another with a little bounce (`mcDrop`, easing `cubic-bezier(.34,1.56,.64,1)`, 12 ms apart) while `.mdrop` is on the box, only for the length of an unfold (`monthDrop`; not on a month swiped to, a re-plan or a move); it moves and fades only, so it adds no layout; `tests/monthunfold.test.js`
- folding plays it backwards (`.mlift`, `mcLift`, back-in easing `cubic-bezier(.36,0,.66,-.56)`): the last day lifts out first, `MONTH_LIFT` (8) ms apart, 280 ms each, a little dip before rising away; the edge starts once about half are gone and the panel's own fade only at the end (fading the whole panel earlier hid the days lifting out: it read as the month just disappearing)
- the month and Today's strip name a day without a jacket by its trousers ("Grey trousers") instead of "No jacket: grey trousers" when the dress code has no jackets (`shortTop`)
- every unfold and fold scrolls the page with `pageScroll(to, ms, delay)`: ONE `scrollTo` at the start, and `#today` slides back by what really scrolled (`translateY`, `MONTH_EASE`, same duration and delay, `fill:'backwards'`, held in `#today._ps`; a second call starts from the drawn offset); no script runs per frame
- why: the browser's smooth scroll kept its own pace (WebKit covered 1,000px in one frame), and a `scrollTo` on every frame from rAF ran out of step with the slide on an iPhone, and the calendar, pieces and score cards juddered; `tests/pagescroll.test.js` checks one scroll event per animation (the rAF version fired about 20)
- a box that unfolds (score, pieces list, a piece row, month plan, a tile's photo) scrolls with `reveal(el, top)`: just far enough to show what opened (`revealNeed`), stopping when the tapped box's top reaches the top of the screen
- `picfold`, `boxfold` and `monthunfold` also run on WebKit (`npm run test:webkit`): the layout count is Chromium's CDP, so there it is not counted

### `photos.js`

- a shirt with a read weave texture (`shirtTextured`) gets its own photo key (`/tex/<settSig>` in `comboSig`), a prompt line (`shirtTexText`) and a drawing of its texture with 2.5× contrast (`fabricDef(…,'dia')`) after its close-up
- "Last worn" (`lastWorn`) counts only days marked ✓; the stats still count unmarked past days as worn

#### Outfit photos

- outfit photos are kept on the device as the worker made them (`keptPhoto`): shrunk to 900px and re-encoded at JPEG .85 (`shrinkUrl(…,900)`) they were softer than the 1024 original on a 3x phone and when zoomed; photos kept before stay 900px until made again
- background download of the worker's photos for the month on screen and the next, nearest day first (`prefetchRenders`, after one `GET /render?list=1`)
- a day the worker has no photo for is not asked about (`fetchRemoteRender`, `fetchItemPic`): the worker's list (`remoteList`, `GET ?list=1`, once, shared with `prefetchRenders`; `remoteListed` false when the worker gives none, then each day is asked as before) says which it keeps; each ask was a 404 logged in the console for every day shown
- one Generate tap is one request: `queueCombo` falls back to the direct `/render` only for a worker without the queue (404, 405, or 501 with `noQueue`); a 501 for a missing image service is the answer (it was sent twice)
- a no-jacket day's photo key includes the trousers and its request sends `nojacket`
- `outfitText` describes a jacket without a tie as "worn with the collar open and the top button undone, with no tie"; `comboSig` has `-` in the tie's place, so a tieless outfit has its own photo key
- `outfitRefs()` sends each close-up after its item's photo, labelled "a close-up of the … fabric (match its exact colour and weave)" (suit/blazer, shirt, tie; trousers on no-jacket days); the planner worker never gets `texture`
- the worker takes 8 references; `trimRefs` (tagging.js) drops the least needed first (`refRank`: the shirt's close-up, then its texture drawing (the user's choice: the drawing is in the tagged colour, a dim close-up reads grey), other drawings, close-ups), never an item's photo: cutting at 8 once dropped the watch and the generator drew a generic one
- a tie with a close-up is sent without its photo (`outfitRefs`), the shirt's close-up going in its place; a tie without a close-up keeps its photo (the owner's choice after an A/B on the real worker, 2026-11-11: no difference to see that one run to the next doesn't also make, about 391 tokens saved a 270×360 photo)
- a tie sent without its photo has its pattern drawing right before its close-up (`outfitRefsFull`, tagging.js)
- an outfit photo at `gpt-image-2` medium with 8 references costs about 11¢ (1,756 output tokens, 5.3¢ of it), not the 7¢ the app's texts say; high is 7,024 output tokens (21.1¢)
- `gpt-image-2` accepts any size divisible by 16 up to 3840 on the long edge; 2048x2048 at medium is about 15 to 16¢ a photo, visibly sharper in the watch, tie and shirt weave (2026-11-12); the worker still asks for 1024x1024

#### The watch

- the watch and its dial's enlargement go FIRST, right after the illustration, as two references (`WATCH_WORN`, `WATCH_DIAL`): at the end of the list the generator drew a stock chronograph
- the dial's enlargement is `dialCrop` (tagging.js, `DIAL_PART` .48 of the photo's middle): the watch is about 80px in the picture and with its photo alone the dial came back generic
- the enlargement is never trimmed (`refRank` 9): in a full outfit (9 candidates) the shirt's close-up goes first; the enlargement going first is why the owner's watch came back generic from 2026-11-11
- both go turned half a turn (`turnBy(…, WATCH_TURN)`, 180°): on the left wrist, arm across the chest, a watch is seen with its crown toward the hand and 12 o'clock at the bottom; from upright photos it was drawn upright, crown toward the elbow, which the owner called backwards; the prompt says the same and the figure's watch has its crown toward the hand (`.fig-crown`)
- the watch reference is the owner's own photo (`o.watch.photo`), its product picture (`itemPic`) only when there is none: the product picture is a redrawing whose dial details are already lost
- the drawing the generator edits carries the watch's own dial: `figurePng` cuts it with `dialCrop` and passes it as `face` to `figureSvg(o, prefix, {photo:true, face})`; figure.js puts it in the case, clipped round and turned `rotate(90)` in the hand's frame (crown toward the hand, 6 o'clock at the top); `photo:true` with no photo leaves the dial blank; Today's drawing keeps its drawn hands
- `watchText(w, {worn})` (core.js): with the owner's Details the style's stock layout is left out ("chronograph", not "chronograph (three subdials and a date window)"); `worn` (outfit photos, `outfitText`) says the details describe the watch upright and every position turns with it
- `WATCH_KEY(outfit)` (worker/render.js): with a wristwatch in the outfit, a short sentence before "He is wearing" says the watch is a key detail and its face in the illustration is its real photo, to keep as it is
- on the owner's Seiko Arctura (2026-11-12) words, references and high quality alone gave a stock chronograph; the real dial on the drawing gave a closer but not faithful dial (the watch is about 90px across); the owner declined a second paid edit per photo and a larger framing for now

#### Item pictures

- product pictures for shoes, belts, socks, pants, coats and watches are described by `itemDesc()`, made from the item's own photo by image edit when it has one, saved as `render:c<16 hex>` of the description; a Settings button generates the missing ones
- every item picture is on the same warm grey (the worker's `ITEM_BG`, worker/items.js; it ignores an old app's `bg:'white'`); product photos kept on a white backdrop are toned down to `PIC_BG` once in the app (`greyBackdrop`/`fixItemBackdrops`, flag `grey` on the render)
- a sock's `secondaryColor` is its toe cap colour (`sockToe()` in core.js): the tagger is told so, `drawSock` (draw.js) draws it, `desc` names it, the editor labels it "Toe cap"; the planner ignores it
- socks are drawn as a pair (the owner's ask, 2026-11-13), traced from Nike's product photo of their Everyday Plus Cushioned Crew socks: both socks, the back one 12% darker; no maker's mark; the toe cap and the cuff's edge take the toe colour (`class="sock-toe"`); `SOCK_D` is in a 0..100 box and the thumbnail calls `drawSock` without a transform
- the pair is drawn mirrored (`drawSock` wraps both socks in `matrix(-1 0 0 1 100 0)`) so the toes point right like the shoes (the owner, 2026-11-13); `SOCK_D` stays in the photo's own direction
- `esc()` escapes `'` too (some strings go into `onclick='…'`)

### `settings.js`

- Settings is a full-screen page (a centred panel from 600px): a sticky header with Done (`saveSettings`: saves the connection fields and closes), a Wardrobe stats link, then categories that unfold like Today's cards (`SET_CATS`: schedule, daysoff, weather, care, photos, tagging, backup, connection, about; `.scat`, `toggleCat`, `setCatOpen`), each with a one-line summary (`settingsSummaries`)
- `openSettings('<key>')` opens one category and scrolls to it; tests must open the category before clicking inside it
- `openSettings` draws each part in its own try (blocked storage threw and Settings never opened) and `saveSettings` closes Settings even when storing the server address fails (full storage), with a toast
- while Settings is open the page behind it can't scroll (`setLock`: `html.set-lock` sets `overflow:hidden` on html and body): on the owner's iPhone a scroll in Settings was handed to Today underneath, Settings stood still under the finger and Done was hard to reach; `tests/settingslock.test.js` (desktop browsers can't show the handover itself, only the lock)
- `toggleCat`'s scroll to show an opened category (460 ms after the tap) doesn't run when a finger or the wheel touched Settings since the tap (`m._touch`, set by `setLock`'s listeners): it fought a scroll already under way
- background redraws of Today (photos arriving, weather, the start-up plan check, the queue) go through `refreshToday()`: while Settings is open they set `todayStale` and wait for it to close, since `renderToday` closes Settings (it snapped shut when opened right after launch)
- a sync that brings changes redraws the tab on screen through `syncRedraw` (sync.js): while Settings is open it only marks it (`todayStale`, `viewStale` for the Wardrobe or stats page) and `closeSettings` redraws it
- only `saveUserSettings()` stamps the settings, and only something the user did should call it
- occasions (`setOccasion` in history.js, `addFormalDay`, `renderFormalUI`)
- days off (`setHolidayCountry`, `toggleHoliday`, `addDayOff`, `renderDaysOffUI`; the holiday list is refetched monthly, `refreshHolidays`); the Days off summary is redrawn by `renderDaysOffUI` and `renderFormalUI` while Settings is open
- the Schedule summary lists the days from the week's first one (the first day, Sunday first, whose day before isn't a workday): "Sun–Thu"
- weather: a 16-day forecast; beyond it `loadClimate()` fills `climate` in core.js with the location's usual monthly highs from Open-Meteo's archive, kept in localStorage `wx_norm`, so `dayClimate()` does not fall back to a temperate calendar
- the city search's results (`findCity`) are escaped (names from Open-Meteo went into the page as HTML)
- `refreshAll`'s list of pages includes `pack` and `'care'`, so Refresh stays on the Packing list and Laundry & cleaning

### `start.js`

- moving between pages animates (`pageIn`, from `show`): the page arriving eases in 28px from its tab's side (`TABS` today, wardrobe, stats, left to right) with a fade, `PAGE_MS` 320 on `MONTH_EASE`; a sub-page (add, pack, care) rises 14px; the one leaving hides at once (nothing laid out twice); the tab marker is `nav::before` sliding by `--ti` (`.tab-none` hides it); reduced motion switches instantly; `tests/tabmove.test.js`
- `show(t)` ends with `packShow(t)` (pack.js), which hides or shows `#pack`
- leaving the Wardrobe tab empties `#wardrobe` (`show()`): its grid (about 4,900 elements at 107 items) is drawn again on coming back; `.gi` has `content-visibility:auto` (`contain-intrinsic-size:auto 230px`)
- the stats, packing and care pages' ‹ (`.pback`) calls `subBack()`: `openStats`/`openPack`/`openCare` call `subOpen()` first, which notes the tab under them, its scroll, and, when Settings was open, its open categories and scrollTop; back restores them (`openSettings()` alone folds everything and scrolls to the top); opened from Today it goes back to Today
- the phone's Back on those pages and in Settings goes back one level: Settings and those pages share ONE history entry (`appHist`, `appKind` 'set' or 'sub'; `appPush`/`appDrop`); a popstate on it calls `subBack` or closes Settings like Done (`saveSettings`); opening a page from Settings hands the entry on, its ‹ hands it back (`appKeep`); left another way (the ‹, a tab, closing Settings) the entry is taken away with our own `history.back()` (`appPend`, let pass by the popstate); `tests/subback.test.js`
- the tabs have no Back entries (Back there leaves the app)

### `ui.js`

- shared interface pieces (after app.js; nothing runs at load)
- `askConfirm(message, {ok, cancel, danger})` → `Promise<boolean>`: a bottom sheet (`#ask-sheet`/`#ask-backdrop`) above everything; first paragraph = question; Cancel, Escape, outside tap or a second question → false (`askAnswer`); `danger` = red button, focus on Cancel
- `tell(message)`: a toast up 4–9 s by length
- no `confirm()`/`alert()`/`prompt()` in the app (`tests/ui.test.js` checks); tests click `#ask-ok` / `#ask-cancel`
- "Forget everything" (`forgetLearned`, stats.js) acts at once with Undo instead of asking
- `isConnected()`; `NEED_CONN` is the one "needs a connection" sentence
- `needConn(btn)` hides a server-only button's row (`.connhide`) while not connected; server-only weave reading (`claudeOnly`) is hidden too
- `.conn-only` sections hide under `body.nocon`, with a `.conn-off-note` and Connect (`goConnect`) filled by `renderConnUI`; Realistic photos shows `#photos-conn` only
- `addGate()` hides "Several items" while not connected and shows `#add-group-off`
- `applyRole()` (account.js) sets `body.owner`/`tester`/`nocon`: Advanced folds are owner-only; Connection's address and code hidden from testers
- `renderConnUI`/`connPaste`/`connSummary` draw Settings → Connection; `advToggle`/`advClose` the Advanced folds
- `plainErr(message)` turns server set-up errors (`TECH_RE`) into plain words unless the owner is connected; used by `generateRender`, `tagFailText`, Several items, the picture batch and a tester's `setSyncStatus` (a raw OPENAI_API_KEY message once reached a new user)
- dialogs call `layerOpen`/`layerClose` (Settings, picker, What to buy); `layerInert` keeps the page behind inert and returns focus; `layerUp` traps Tab and handles Escape
- `tests/a11yfix.test.js` covers dialogs, waiting redraws, storage failures, labels, contrast, motion, tap targets

### `safety.js`

- data safety (loaded after app.js, before tagging.js and sync.js); `tests/safety.test.js`, `tests/safetysync.test.js`
- `storeFailure(e)`: marked by `txs`/`atomic` (`e.dwStore`), a `QuotaExceededError`, or an IndexedDB error event; `saveFailed` toasts it plainly (`storeFailText`) at most once per 1.5 s
- the `unhandledrejection` listener shows uncaught storage failures only; Add's `save()` relies on it and the card stays
- `dbDown`/`dbErr` come from safety.js's own `db.then`, queued before sync.js's, so the listener stays quiet when storage is down
- `storageDown(e)` (start-up chain's catch, start.js): `#nostore` over the page with the reason and Try again, the rest inert
- `askPersist()`: `navigator.storage.persist()` once (`persist_asked`, `persist_ok`), after an Add card is stored or from `safetyStart()`
- `safetyStart()` (after `appReady`): `pruneTagImgs()` removes from `dw-keep-tagimg` the copies (`tagimg/<id>`, `closeimg/<id>`) of items no longer present; start-up only (undo window), never with an empty wardrobe
- tagging failures: `tagFailText` gives the Add note (`aiError`) and the reason (`tagWhy`), a 429's `message` as is; `tagFailed(q)` sets `q.tagErr`, drawn by `tagFailNote` (`.tagfail`) with Try again (`retryTag`)
- `guardUnsaved()` (once, `guardOn`): `beforeunload` asks while `queue` holds an unsaved card
- `adoptBackupSettings`: on a device that never finished a sync (no `last_sync`), the backup's settings win key by key over newer local ones; device-only keys (`setupDone`) stay
- why: first-run setup stamps settings before connecting, and they replaced the backup's holidays, days off, colours and preferences

### `sync.js`

#### Sync paths
- backup/sync through the worker's `/sync` (KV); backup file download/restore
- a change syncs without the whole backup (`syncLite`): `GET /sync?lite=1&since=<sync_mark's version>` brings only records changed since, photos as `dwph:<hash>`, every tombstone and `idx` (the backup's stamp of every record)
- with nothing changed here (`sync_mark`: backup version + wardrobe fingerprint) it adds `&v=<rev>:<saved>`, so an older worker answers `same` or the whole backup and the old way runs
- photos: taken from the device's own copy by hash (`phIn`) or downloaded (`GET /sync?ph=…`, `PH_BATCH` 40); `POST /sync {baseRev, baseSaved, day, reason?, delta, photos}` sends only records newer than `idx` and photos the backup lacks (`phOut`)
- a photo is any `data:` string of `PH_MIN` (256)+ characters anywhere in a record, hashed as the first 20 hex of its SHA-256 (`phHash`, the same in worker/backup.js)
- measured on the owner's 16.7 MB backup: a day marked worn went from 16.7 MB each way to 15 KB down and 0.3 KB up
- missing something `idx` says the backup holds → asks for everything (`all`), so a lost wardrobe comes back; 409 → asks again; 400 `missing` → sends those photos; 422 `legacy` (over 20 MB, stored by an older app) → the old way
- the full PUT body is `{baseRev, day, reason?, data}` with `data` last (the worker reads a large backup's leading fields without parsing it)
- `window.SYNC_OLD` before load syncs the old way (`SYNC_LITE` false)
- `syncOnce` calls `adoptBackupSettings` (safety.js) before merging
- tools/asm-prebuild.js answers the small sync's POST itself, so `npm run assemble -- --watch` downloads only what changed and never writes the backup
- `tests/deltasync.test.js`: two devices and an older app, every kind of change under 100 KB each way, against the old worker (tests/fixtures/old-worker/worker-ef18d06.js)

#### First pull and locks
- a connected device saves nothing at start-up until a sync has merged the backup (`afterPull`, `pulledYet`, `pullDone`, `whenPulled`): Today's history and locks, arrivals, `texSwatches`, `recolourSpecSetts`, `upgradeCloseups`, `upgradePhotos`, `smallPhotos`; not connected, an ended invitation or no backup (501): at once; offline: they wait
- why: a phone two days behind locked the week and re-saved 82 items before syncing; their newer stamps replaced another device's pick and tags and brought back deleted items
- a start-up fix-up saves an item only while it is still the copy in `items` (`stillCur`, app.js), and redraws through `fixupRedraw` (never with Settings open, since `renderWardrobe` closes it)
- the week's locks are marked as the app's own (`lockOnly`, `base`; only `saveDay(rec, quiet, true)` keeps the mark): in a merge (`dayWins` in core.js `mergeState`, worker/backup.js `mergeLite`) a newer automatic copy loses to an older one changed after its base
- such a kept day is sent up by the small sync (`keptD`) and kept by the worker, so devices settle; `tests/staledevice.test.js` replays it

#### Timing, limits, errors
- a tester's phone backs up on going to the background or closing, or 15 min after the first waiting change (`TESTER_SYNC_MS`, `syncDue`); the owner's 2.5 s after a change
- over a daily backup limit nothing uploads until the next UTC day (`sync_pause`, `sync_pause_msg`), with the server's sentence; connecting again clears it
- the worker's daily KV writes used up (Cloudflare free plan: 1,000 a day, reset 00:00 UTC; the PC's picture uploads once used them up): 429 `{error:'kv-limit'}` (`kvFull`, worker.js), the same pause, and "Today's backups are used up on the server…" (`backupFullMsg`); `tests/kvlimit.test.js`
- `npm run assemble` stops at the first KV refusal, keeps the pause (`upload-pause.json`), skips --watch cycles until then, and plans 14 days ahead by default
- an invitation switched off (403 `invite off`): said once (`inviteEnded`, `localStorage.invite_ended`) and syncing stops
- sync errors show the server's `message` before its `error`

#### Daily backups
- before the first PUT of each day the worker keeps the backup as `snap:<YYYY-MM-DD>` (30 days) and `snap:<YYYY-MM>` (400 days); `GET /sync?snaps=1` lists, `?snap=<id>` returns one
- "Roll back" (`loadSnapshots`/`rollBack`/`rollBackState`) restamps the snapshot's records and tombstones the rest, so it wins on every device; the PUT carries `reason:'restore'` and the worker keeps `snap:before-restore`

#### Redraws
- a sync's redraw waits while the item sheet or piece picker is open (`syncRedraw` → `syncLater`; `syncLaterRun` on `itemShown(false)` or `closePicker`)
- the monthly holiday refetch (`refreshHolidays`, settings.js) syncs first and refetches only if still needed, never offline: its newest stamp undid a newer change from elsewhere
- the Backup line (`backupSummary`, settings.js; `showSyncStatus`) shows the last backup, a failure, or "Not backed up yet", and keeps the last backup while the next runs ("… · syncing…")

### `account.js`

- who the app is connected as (after sync.js); `acct` holds `GET /me`
- invite link `<app url>#invite=<code>&w=<server>`; `connectFromLink` stores `worker_url`/`app_token` only when `/me` accepts; `acctStart()` runs it for `#invite=` at start-up
- a refused link changes nothing; `#invite` is dropped from the address unless the server was unreachable
- a link on a phone connected with another code: with a local wardrobe (`acctHasLocal`) it asks, wipes (`wipeDevice`) and reloads; else it switches and drops `sync_mark`, `last_sync`, `sync_status` (a sync once merged the owner's wardrobe into a tester's)
- Connection's `#acct-box`: `renderAccountUI`, `loadAccount` (at most once in 3 s); testers see use against caps (`ACCT_CAPS`, `acctUse`), the owner invites (`createInvite`, `copyInvite`, `revokeInvite`, `purgeInvite`)
- `acctStart()` wraps `renderSettingsExtras` (settings.js); an old server (404/405 on `/me`) leaves the box empty
- the role is remembered per code (`rememberRole`, `acct_role`, `acctRole()`, `isTester()`)
- iPhone: a Home Screen app has its own storage; a tester connecting in Safari (`iosInSafari`) gets `homeScreenGuide()` and "Copy my invitation link" (`copyInviteLink`, `myInviteLink`; testers only)
- a daily limit shows the server's `message`: through `detail` on Add, alone in `generateRender`, thrown by `renderCombo`/`renderItemPic`/`queueCombo`, toasted for pattern reading via `limitNote`
- testers see no costs (`showCost()` in settings.js)
- About's Feedback line (`#fb-help`) says where feedback goes to testers only
- tests: `tests/accounts.test.js`, `tests/testerview.test.js`, `tests/invitelink.test.js`

### `setup.js`

- first-run setup and empty states (loaded last): `#setup`, built by `setupEl()`, not in index.html
- `setupStart()` (start.js chain) opens it for an empty wardrobe with no recorded day and no `settings.setupDone`
- with items it never shows: `setupDone` is set in memory only and stored with the next settings change (storing it at once would force a full sync)
- steps `SETUP_STEPS` (welcome, week, wear, weather, connect, done) via `setupStep`, `setupGo`, `setupDraw`; Skip finishes at once
- steps store through the app's own functions (`toggleDay`, `setUnits`, `setVestMode`, `setLocation`, `useMyLocation`, `findCity`)
- `setupSearch` uses Settings' `#cfg-city` and `window._cities`; `setupLocate` polls `settings.location`
- leaving the Weather step with an unfinished city search warns once (`setupCityOpen`, `cityWarned`)
- What you wear: `settings.dress = {jacket, tie}` (`setupSetDress`, `setupDress`; missing = true), releasing the week's locks (`clearLocks`)
- a new person who doesn't choose gets `vestMode='never'` (`setupFinish`, self-opened setup only); the stored default stays `auto`
- Connection: `setupConnected`, else an invite link field (`connectFromLink`, or `setupParseLink`)
- `setupFinish` stores `setupDone` via `saveUserSettings`; the last step lists workdays Sunday first and asks for trousers only with jackets on and no suit
- picks the time zone country's holidays (`setupHolidays`, `tzCountry`, `TZ_CC`); without a list yet the country is kept with `fetched` 0 and `refreshHolidays` retries
- default workdays Sunday to Thursday (`settings.workdays` [0..4]): the owner's choice
- "Run setup again" (`#setup-again`) → `setupOpen(true)`, keeping the stored vest choice
- a self-opened setup steps aside when items arrive or another tab opens (`setupYield`, from `show()` and `setupToday`)
- while up the page is inert (`setupInert`); z-index 980, under Settings
- under `navigator.webdriver` it opens only with `window.SETUP_AUTO=true` (`setupAuto`), since every test starts as a new install
- Today's checklist (`setupToday`, rows from `setupNeeds`): suit or blazer, shirt, tie, trousers ("If no suit" with jackets on and no suit), shoes; goes in place of the picture, above the score card or under the note depending on how dressed the day is
- empty Wardrobe: `setupWardEmpty()` (`#wempty`)
- `tests/setup.test.js` covers the flow, both connection paths, stepping aside, both checklist kinds, and layout at 320/390/626px

### `kit.js`

- getting started (2026-11-14, the owner's ask after the audit's new-user walkthrough), loaded after setup.js; `tests/kit.test.js`
- one full-screen sheet (`#kitsheet`, z-index 2000, the page inert while open, Escape closes, ← → step) serves the tour, the close-up guide and the import (`kitOpen`/`kitDraw`/`kitClose`/`kitGo`)
- the quick tour (`tourOpen(then, lastLabel)`, `TOUR_CARDS`): four cards with drawn pictures: the score, the close-up (white paper along one edge), Shade, patterns; marked seen on close (`localStorage.tour_seen`, `tourSeen`)
- a first-time person who taps "Add my first item" at the setup's end gets the tour between the setup and Add, its last button "Add my first item" (`setupFinish`); Escape or ✕ also goes on to Add
- the tour is offered again by "Take the 1-minute tour" on the setup's last step and Today's first-outfit checklist (`kitStartRow`), and Settings → About → "Take the tour" (`#tour-again`)
- the close-up guide (`kitCloseupGuide`, `GUIDE_CARD`): fill the screen with cloth, plain white paper along one edge out of the dashed middle (where the colour is measured), the same light on both, the paper white not blown out, tap the paper; opened from the Add card's close-up step ("Tips for a good close-up", `.texguide` in `texSlot`) and the tour's close-up card; its pictures draw the paper as a straight band
- the Add card's close-up step itself says "Lay white paper along one edge and tap it on the screen to set the exposure." (`.texpaper` in add.js `texSlot`, the owner's ask), so a returning user sees it without opening the guide
- Undo after Confirm (`kitSaved`, called at the end of add.js `save`): "Saved: <name>." with Undo for `KIT_UNDO_MS` (8 s); cards saved within 1.5 s of each other are one Undo ("Saved 2 items")
- How many (add.js `qtyRow`/`stepQty`/`qtyOf`, 2026-11-14, the owner: "tap a plus or minus for the amount before I add", shirts and socks only, `QTY_TYPES`): a "How many" stepper above Confirm, 1 to `QTY_MAX` (12), 44 px buttons, changed in place (no redraw); Confirm reads "Confirm 3" and `save` makes that many items, each its own id (deep copies of the first: same tags, photo and close-up; the server keeps a photo once by its hash), so the planner and laundry count them apart; the toast "Saved 3: White." and its Undo take them all back (`kitSaved(it,q,i,copies)`); another type ignores a number set before; `tests/addqty.test.js`
- `kitUnsave` deletes the items (tombstones, as Delete) and puts their cards back on Add in their places; `q.raw` and the canvases were already dropped by save, so white balance can't be toggled again on a restored card
- `kitQuiet` silences Undo during an import or the sample
- Duplicate (`kitDuplicate`, `#iv-dup` in itemsheet.js): a deep copy with a new id and `added` now, without `paused`, `order`, `arrives`, `away`, `cleaned`, `sample` (`KIT_NO_COPY`); opens the copy
- Duplicate is its own row (`.ivdup`) above Delete, which stays alone at the very end of the item sheet (`tests/wardrobetap.test.js`, `tests/uipages.test.js`)
- import from a spreadsheet (`kitImportOpen`: Add → "Import from a spreadsheet" `#add-import`, and the empty Wardrobe card): a CSV/TSV file or pasted rows (`kitSplit`: tab, ; or , from the first row, quotes)
- the first row names the columns in any order (`KIT_COLS`: Type and Colour required; second/third colour, pattern, name, brand, material, notes, vest, cuffs, kind, style, leather, season)
- words are matched to the app's lists (`KIT_TYPE_WORDS`; `kitColour`: colour names as shown, the owner's own colours by name; `kitPattern` with synonyms)
- a preview row per line says what was left out and why; nothing is saved until "Add N items"; each row is saved through `save` as a hand-added card (`kitSaveCards`), with one Undo for them all; "Download a template" (`KIT_TEMPLATE`)
- the sample wardrobe (`kitSampleLoad`, `KIT_SAMPLE`: 24 pieces, three suits, two blazers, two trousers, five shirts, five ties, shoes, belts, socks, a watch): saved with `item.sample` (`save` copies `q.sample`), asks first when the wardrobe already has pieces, jumps to the next workday (`goToday`); offered on the setup's last step, Today's checklist and the empty Wardrobe
- Today shows "You're trying a sample wardrobe" (`kitSampleBanner`, `#kit-sample`) with Add my own and Remove the sample (`kitSampleRemove`: asks, deletes every sample piece, releases locks)

### `remind.js`

- morning reminder (after account.js): `#remind-box` (`.conn-only`), `remindOn`/`remindOff`, `remindTime`; per phone in `localStorage.remind`
- switching on asks permission, subscribes and posts the time, time zone and coming workdays
- `remindLines` (next 14 workdays, `piecesLine`) are kept by `remindKeep` in `dw-keep-remind` as `remind.json` for sw.js
- `remindSoon` rewrites them and tells the server only when dates or time change, or once a day (`remind_sent`)
- on iPhone Safari it asks to add to the Home Screen first (Web Push only there, iOS 16.4+)
- sw.js: `push` shows "Today’s outfit" with today's line, `notificationclick` opens the app; keep the title UTF-8 (it was once saved garbled)

### `about.js`

- Settings → About (`SET_CATS` ends with `about`, `#sc-about`, `renderAbout`): version and updates, feedback, deleting one's data, the privacy note; loaded last
- `appVersion()`: the `CACHE` number in the cached `sw.js` (`swVersionOf`, `aboutReadVersion`), so the version running, not the newest
- `checkForUpdate` (start-up, foreground after `ABOUT_FRONT_MS`, every `ABOUT_CHECK_MS`, the button): `aboutLatest` fetches `sw.js` with `cache:'no-store'`; a higher number downloads it and offers Update once per version (`aboutToasted`, `aboutShow`); never reloads by itself
- `updateNow()`: asks first if Add has unsaved cards, sends the waiting worker `{type:'skipWaiting'}` and reloads on `controllerchange`; gives up after `ABOUT_INSTALL_MS` (45 s) without reloading
- `aboutAdopt()`: a waiting worker of the version already running takes over without a reload (`aboutAsk`)
- feedback (`sendFeedback`): `POST /feedback` with `x-app-token` (`aboutConn`); `loadFeedback` lists it in `#fb-list` for the owner only
- delete my data: `askDelete` (`#del-confirm`), `deleteMyData(server)` → `wipeDevice()` → reload
- `wipeDevice()`: deletes the IndexedDB database (`ABOUT_DB`), the `dw-keep-*` caches, online also the service worker and its caches, and the app's own localStorage keys (`ABOUT_KEYS`, `ABOUT_KEY_PREFIXES`); never `localStorage.clear()`, as GitHub Pages sites of one account share an origin
- a new localStorage key must be added to `ABOUT_KEYS`: `tests/about.test.js` fails otherwise
- "Delete everything" sends `DELETE /account` first with the connection removed and sync stopped; a 404 clears the device and says the server copy remains; any other failure restores the connection and deletes nothing
- deleting on the device only also removes the connection, or the next sync would bring the wardrobe back
- the after-restart message goes in `sessionStorage.about_note` (`ABOUT_NOTE`), shown by `aboutStart()`
- the privacy note (`.about-fold`) names everyone who gets something: the server's owner, Cloudflare and GitHub Pages, Anthropic, OpenAI, Open-Meteo, Nager.Date / Google
- `tests/about.test.js` mocks `/me`, `/feedback`, `/account`

### `stats.js`

- the stats page (the Insights tab, `#n-stats`, `openStats`/`renderStats`, shown as the `#stats` section by `show('stats')`): `buildStats()` counts what was really worn (`wornDays()`: day records from when the wardrobe existed, not days marked "Not worn") and what is planned for the next six months (`plannedDays()`)
- sections: 'Your scores', wear counts by type (folded sections build their rows when opened), what costs points, colour balance, pairings and rest, never-worn pieces with a reason, what the planner learned (`forgetLearned`)
- 'Your scores' (`#st-trend`): the average score of each of the last `TREND_WEEKS` (8) worn weeks as columns (red when a day had a hard check), with the worn average, the days with a real mistake and the plan's average
- the next six months are planned a week at a time while the phone is idle (`statsPlan`, `STATS_SLICE` 7 days of the shared simulation per `requestIdleCallback`), started 4 s after start-up and by opening the tab (opening Insights used to freeze a phone 1.3 s)
- `show('stats')` calls `statsShow`, which draws the page at once when the months are planned (`statsPlanned`; always with `TEST_PLAN`), else the header and "Planning your next 6 months…" (`.st-wait`) and the rest when done; `renderStats()` called directly still plans at once
- pieces the dress code leaves out are not counted as never worn (`buildStats().unused`)
- `whyUnused` reads every jacket's best outfit overall and per shirt and tie from one table built once per page (`fitMemo`, reset in `buildStats`); searching again per unused piece took 94 s at 250 items
- `whyUnused`: a paused item was taken out of rotation; an item on the way says so, with its arrival date if there is one; a piece away says "It's at the cleaner's" / "It's in the laundry", with the date it joins the outfits again; a dress-code exclusion says so ("Your dress code leaves out ties…")
- `whyUnused` never says a suiting tie, shirt or pair of trousers "comes up later than six months" (it can't know that); it says the others suit a little better or have rested longer, so it isn't in the next six months' plan

### `pack.js`

- the packing list page (Settings → Packing list `#pack-btn`; the month on Today has no link to it, the owner took that button out): the `#pack` section, shown by `show('pack')` through `packShow(t)` (called at the end of `show()`), `openPack`/`renderPack`
- the trip (`packTrip()`, `localStorage.pack_trip` `{a, b, j, s}`: first and last day as `YYYY-MM-DD`, most jackets and pairs of shoes, 0 = no limit) defaults to the workdays of the week starting on the user's next first workday (`packDefault`, `packWeekStart`: a workday whose day before is not one; Sunday for Sunday-Thursday, Monday for Monday-Friday or when there is no such day)
- a stored trip that is over makes way for the default; at most `PACK_MAX` (31) days (`packSetDate`)
- `packDays(t, plan)`: every day of the range with its outfit from `planMonth` (or from a plan passed in), `o` null on a day off or a day with nothing planned; the page lists each with the month's stack drawing (`stackSVG`) and `shortTop`/`shortRest`
- `packList(days, wear)` → `{groups, worn, counts, total}`: every distinct piece once with its days (`n`), grouped by type in `TYPES` order (`PACK_TITLE`); a suit's `o.bot` is the suit itself and is not counted again; a suit worn with its vest says so
- one belt per shoe colour worn (`leatherGroup` of the shoes): the belt planned most often with that colour, so two brown belts planned on different days are one line
- what the wardrobe lacks is a line without an item (keys `x-belt-<group>`, `x-links`, `x-coat`): a belt for shoes with none that matches, cufflinks for a French-cuff shirt, a coat on a cold or wet day
- the count line (`packCount`, `PACK_COUNTED`: suits, blazers, dress pants, shirts, ties, shoes, socks; nouns in `PACK_NOUN`)
- ticks and travel wear are kept per trip on the device (`localStorage.pack_marks`: `{'<a>_<b>': {t:[line keys], w:[item ids], at}}`, the newest `PACK_TRIPS` 8; `packMark`/`packSetMark`, `packTick`, `packWear`)
- a piece marked Wear moves to "Wearing on the way" and is not counted; `packWearDay` marks the first outfit day's whole outfit (`packWornIds`: its belt is the list's belt for that shoe colour)
- pack lighter (`packLight(t, base)`, memoised on the `cache` object): with a limit below what the trip uses, the trip's days are planned again on a copy of the day records (`packPlanOf(recs, end)`: `planSim` from the shared start with `dayRecs` swapped, like `planWith` in today.js)
- `packLightRecs(days, AJ, AS)`: each live day rules out (`rec.skip.top` / `.shoes`) every jacket of its kind and every pair of shoes not in the allowed sets, drops its lock, and takes the other kind of jacket (`rec.kind`) when none of its own kind is allowed and the day has no occasion
- pieces picked by hand (`rec.force`) and days already worn are never changed and come first in the allowed sets (`packTally`)
- up to `PACK_TRIES` (3) sets of jackets × 3 sets of shoes are tried, the most worn first (`packSets`), with one suit and one blazer first when the limit is 2+ and the trip has both; measured 100 ms on the test wardrobe
- the best set by `packRate` wins: outfit scores, −50 for a hard check, −1000 for an incomplete outfit, −3000 for each piece over the limit
- the page shows the lighter plan's outfits and list with what it saves (`packSaved`) and the average score before and after; nothing is saved until "Keep this plan" (`packLock` → `packLockDays`, which also saves `rec.kind` for a day that took the other kind)
- `packLockDays` gives every live day of the trip `rec.lock = lockIds(o)` (the app's own lock only covers 7 days); `packLockState` counts the days whose lock is what the plan shows; the page says Locked / n of m days locked / Not locked; `packRelease` removes the locks
- `clearLocks()` (a planner setting, an occasion, Re-plan) releases a trip's lock like any other; the page then says Not locked
- `packText(t, days, list)` is the plain-text list (title, count line, groups, travel wear, the outfits per day); `packCopy` uses `navigator.clipboard`, falling back to a hidden textarea; Share (`packShare`) only where `navigator.share` exists
- `tests/pack.test.js`; `PACK_SHOTS=<folder>` saves pictures of the page at 320/390/626px in both themes

### `wardrobe.js`

- the Wardrobe tab's search and sort, the item fields `name` / `brand` / `material` / `notes`, and Delete with Undo (loaded after stats.js; called from `renderWardrobe`, `wardList`, `itemBody` and `rm` in itemsheet.js and `save` in add.js)
- search: a field above the type chips (`wardBar`, `#wsearch`, `wardQ`); every word typed must be in the item's name, brand, notes, material, type, colour names or pattern (`wardHay`, `wardMatch`; case and accents ignored); it combines with the type chip and stays when the chip changes
- typing redraws only the grid and the count (`wardSearch` → `wardRefresh`: `#wslide`, `#wcount`, `#wclear`), never the field, so the focus and the keyboard stay; a full `renderWardrobe` while the field is in use (a sync arriving) puts the focus and the caret back (`wardKeep`/`wardBack`)
- the header count reads "n items", or "n of m items" when a chip or the search narrows the list (`wardCount`); × in the field clears it (`wardClear`, also Escape)
- nothing matches: `#wnone` (`wardGrid`) says so, with "Clear search" and, when a chip is on and other types match, how many and "Search all types"
- sort: the dropdown beside the search field (`#wsort`, `WARD_SORTS`, `setWardSort`), remembered in `localStorage.ward_sort`: By type, Newest first, Most worn, Longest since worn (never worn first), Colour, A to Z (by the title shown)
- By type follows the type chips' order (`Object.keys(TYPES)`, suits first), newest first within a type
- Most worn and Longest since worn count the days really worn (`wardWear` over `wornDays()` in stats.js) and each box says "Worn n times" / "Last worn 3 Nov" / "Not worn yet" (`.wwear`)
- Colour groups by family (`WARD_FAMS`: neutrals, blues, browns, greens, reds, purples, then pieces shown by their metal; `WARD_FAM` over the planner's `fam`), light to dark within each (`lumCol`, the item's `shade` counted)
- `wardView()` is the list on screen (chip, search, sort) and `wardList()` (itemsheet.js) returns it, so the item sheet's ‹ ›, swipes and "n of m" follow the filtered, sorted list; it is kept in `wardMemo` until the next redraw (`wardFresh`), since the sheet's swipe asks for it on every touch move
- `wardGrid(list)` draws the grid: a box's title is `itemTitle(i)`
- fields: `item.name` (60 characters), `item.brand` (40), `item.material` (40), `item.notes` (500) (`WARD_FIELDS`, `WARD_MAX`); an empty one is removed from the item
- the item sheet's Details card has Name and Brand at its top (`wardFieldsTop`), Material and Notes at its end (`wardFieldsEnd`)
- `setItemField` saves a text field when it is left and 600 ms after the last keystroke (`itemFieldSoon`: a sheet swiped away never tells a field it was left) without redrawing the sheet (the next field tapped would lose its focus); only the header's title and the grid follow
- Material (`matRow`) is None, the type's `MATERIALS_BY` list, Other; Other shows "Which material?" and the text typed is the material (`'other'` until something is typed); types without a list show no Material row
- the Add card has "More details" (`moreRow`, `toggleMore`, `q.more`), folded until tapped, with the same four fields (`setQField`, kept on the card as typed); folded with something in it, it says "n filled in"; `wardSaveFields(q,it)` in `save()` copies them onto the item
- a name is the item's title in the Wardrobe grid, the item sheet's header, Today's pieces list and the piece picker (and their `aria-label`s)
- the fields are ordinary item properties, so they sync, back up, restore and roll back with the item (whole items are merged, newest wins)
- Delete (`rm` → `wardDelete`) doesn't ask: it removes the item at once, closes the sheet and shows the toast "Deleted <name>" with Undo for `WARD_UNDO_MS` (8 s)
- Undo (`wardUndelete`) writes the item back as it was (same id, photos, close-up, tags, fields, rotation state, its place in `items`) with `updated` one above the deletion's time, and saves again any day record that referred to it and was changed meanwhile (a day re-planned without it)
- why that survives a sync: the tombstone stays, and in `mergeState` a tombstone only wins over an item whose stamp is not newer; so the restored item wins on every device, also on one that had already taken the deletion; a delete that is not undone propagates as before
- `tests/wardrobe.test.js`: search by each field and with a chip, each sort order, the sheet stepping through the filtered list, the fields (sheet, Add card, two synced devices, backup file restored on an empty device), the name in its four places, materials by type, delete / Undo with and without a sync in between, sizes and no sideways scroll at 320 / 390 / 626px in both themes
- Material (`matRow`, types in `MATERIALS_BY`) sits on the Add card above "More details" and at the end of the item sheet's Details

### `colpick.js`

- the colour picker (loaded after wardrobe.js): the Colour, Second colour / Toe cap and Third colour fields of the Add card and the item sheet are a button with a chip and the name (`colBtn`, `EC` in the editor), not a `<select>`: the owner couldn't tell what the colour names looked like
- a tap opens `#col-sheet` (z-index 1201, above the item sheet and the pickers): the item's close-up (or photo; a Close-up / Whole photo switch when it has both) edge to edge with a large chip of the colour being looked at, kept at the top while the chips scroll
- under it: "Closest to your close-up/photo" (main colour only, from `item.meas` via `nearestCols`: Very close ≤4 ΔE, Close ≤8, Nearest), then every colour `COLOR_OPTS` allows for the type, grouped by family from Lab (`colFamily`: chroma under 9 neutral, then hue bands) and light to dark; accents start with None
- "Closest to your close-up" uses the measured parts (`item.meas.parts`) for a patterned cloth, and offers nothing for one without them
- an item without a photo shows its drawing in the sheet, redrawn in the colour being looked at (`renderColPick`, the owner's ask); a New chip (Claude's own colour) keeps the item's colour there
- a tap on a chip only previews it; the bottom button "Use <colour>" / "Keep <colour>" saves through `setq` (Add card) or `sete` (editor); Escape closes it without leaving the item (window keydown in the capture phase)
- the pattern field is the same kind of button (`patBtn`, `EP` in the editor; a small drawn swatch, `swatchSVG(patVar(…),true)`) and opens the same sheet with k 'pattern' (`renderPatPick`): the close-up beside a large drawing of the item in the pattern looked at (`itemThumb(patVar(it,p),true)`: another pattern is drawn without the item's reading), then every pattern `PATS_BY` allows, drawn, grouped (`PAT_GROUPS`: plain, stripes, checks, weaves, figures, other)
- without a photo the pattern sheet's left side is the item's shaped drawing (`itemThumb(patVar(it,drawAs(sel)))`: a tie, a jacket's panel) in the pattern being looked at, beside the large swatch (the owner's ask)
- Ask Claude (`colAskRun`, `colAskHtml`): with a close-up, the sheet offers to have Claude read the colours again (cost from `benchEstimate(1)`); the request is the tagger's (`ask`) with the white-balanced close-up, the sharp photo (`tagImgOf`, else the photo) and the close-up's measurement, like `refineFromCloseup`
- without a close-up it says to add one first; not connected, the button is off with `NEED_CONN`
- the answer is kept in memory per item (`colAsk`, not saved or synced), so every colour field of that item shows it without asking again; Claude's pick for the field is selected beside the close-up, its runner-up (`altColor`) shown next to it with the confidence and any `newColor`; nothing is saved until "Use …" or "Use all …"
- any colour: the picker's ask sends `freeColors:true` (`tagExtras`); the worker then adds `ownColors {primary, secondary, tertiary: {name, hex} | null}` to the schema and prompt (`FREE_EXTRA`, `OWN_COLORS`, tidied in `cleanTag`; worker/tag.js), Claude's own names and shades not limited to the list; the app keeps them as `ownColors` (`ownColorsOf` in `normTag`, app.js); a normal tag doesn't ask for them
- Ask Claude from the pattern sheet sends `freePattern:true`: the worker adds `ownPattern {name, description, fits}` (`OWN_PATTERN`, `FREE_PAT_EXTRA`, tidied in `cleanTag`; worker/tag.js), Claude's own precise name for the pattern and whether the listed one names it fully
- one own reading per request: a colour sheet sends `freeColors`, the pattern sheet `freePattern`, never both (answers kept apart, `colAsk['<id>|c']` / `colAsk['<id>|p']`); with both the schema is more than the API compiles ("compiled grammar is too large", found on the live worker 2026-11-13), and worker.js drops `freeColors` when both come (a phone with the older app)
- a pattern Claude named that the list lacks (`patNewFor`: the listed one doesn't name it fully and no pattern of that name exists) is a "New · Claude's name" chip drawn like Claude's listed pick, beside "Closest you have" and Claude's second choice
- "Add <name> to your patterns and use it" (`patAddNew`): `addCustomPattern` (synced) with Claude's description, drawn and planned like Claude's listed pick (`patNewBase`), for suits, blazers and trousers together or the item's own type; then set like any pattern; `tests/colpick.test.js`, `tests/claude.test.js`
- a colour Claude named that the app lacks (`colNewFor`: not a built-in's name, not the owner's own key, not within ΔE00 2 of the listed pick) is offered first as a "New · Claude's exact" chip in Claude's shade (`NEW_COL` '+new'), with "Closest you have" beside it; the listed pick stays selected, so a colour is only added when the owner picks it
- "Add <name> to your colours and use it" (`colAddNew`): `addCustomColor` (synced, `settings.custom`) for the item's type group (`groupOf`), behaving like the nearest built-in colour (`colBaseFor`, as `openColForm`), an accent colour too when it was a second or third colour; then set like any colour
- "Use both colours" / "Use all N colours" (`colAskUseAll`, `.cpall`): shown whenever Claude named more than one colour and any field, the open one included, would change (`colAllDiff`); it takes every colour Claude named, its new ones too (`colAllOf`: each added through `colAddNew`; one already added is the owner's colour of that name), on the Add card and in the editor; the owner wanted to accept all of Claude's colours at once
- `tests/colpick.test.js`

### `care.js`

- laundry and dry cleaning (loaded after stats.js); kept light: nothing has to be logged, the app counts from the days worn and the user taps only when a piece goes out or comes back
- away: `item.away = {why:'laundry'|'cleaner', since, back|null}` is stored together with `item.paused` and `item.arrives = back`, the mechanism of a piece on the way: `inRotation(i, n)`, `planSim`'s `byOn(n)`, the picker, "Suggest another" and the locked week need no code of their own, and the plan takes the piece back from the day after its date
- `careSend(id, why, back)` sends a piece away (not one already out of rotation) and releases the upcoming days pinned to it (`careRelease`, as `togglePause` does); its toast has Undo (`careUnsend`, which doesn't count as cleaned); `careSetBack(id, date)` sets or clears the date
- coming back sets `item.cleaned` (YYYY-MM-DD) and deletes `away`, `paused`, `arrives`: by itself in `checkArrivals()` (add.js) the day after `away.back`, with `cleaned` = that date on every device, or with "It's back" (`careBack`), cleaned today
- wears since cleaning: `careCounts()` counts, per item, the days of `wornDays()` (stats.js) dated after `item.cleaned`; kept on the plan cache (`cache.careW`), so anything that resets `cache={}` recounts
- a wear on the day of `item.cleaned` itself is not counted (the piece was cleaned after it), so a piece marked back in the morning and worn that day loses that one wear
- limits: `careLimit(type)` = `settings.care[type]`, else `CARE_DEF` (suit 5, blazer 6, pants 4, shirt 1), else 0 = never; `careState(i)` → `{wears, limit, each, due, near, over}`: due at the limit, near one wear short (limits of 3 and more)
- a limit of 1 (shirts) means washed after every wear (`each`): such pieces are never flagged one by one (every worn shirt would carry a tag); the Care page shows them as one line per type with "All washed today" (`careCleanedType`)
- "Cleaned today" / "Washed today" (`careCleaned`) sets `item.cleaned` without sending the piece away, with Undo
- the item sheet's Care card (`careCard(i)`, `#ivcare`, appended to the Rotation card's markup in `itemBody` (itemsheet.js) so the sheet's last line is untouched): the count ("Worn 4 times since cleaning (Nov 3) · due after 5"), "Send to the dry cleaner" / "In the laundry" (the laundry first for shirts and socks, `careWashed`), and while away: since when, an optional "Back on" date and "It's back"; only for `CARE_ABLE` types, not for a piece on the way
- while a piece is away the Rotation card has no button (it says the piece is away): "Put back in rotation" would bring it back without `cleaned`
- the Wardrobe grid: `careTag(i)` ("At the cleaner's · back Nov 20" / "In the laundry") in the `.pausetag`, and `careBadge(i)`, a quiet `.caretag` "Due for cleaning" on a due piece
- the page (`#care`, `openCare`, `renderCare`, `careLists()`; in Settings as "Laundry & cleaning" in the "Your wardrobe" card): Due for cleaning (most overdue first), Nearly due, Washed after every wear, Away now; each row has "Send to the cleaner" and "Cleaned today", away rows "It's back"
- `show()` (start.js) calls `careShow(t)` for every page, which hides `#care` or shows and draws it (`show('care')`), so `show()`'s own list of pages is unchanged
- Today: `careNote(o)` adds one quiet line (`#carenote`) under the cards, on today only, when today's suit, blazer or odd trousers reaches its limit with this wear or is past it; nothing otherwise
- Settings → Care (`#sc-care`, `renderCareUI` from `renderSettingsExtras`; `'care'` is in `SET_CATS` in settings.js, after weather): a dropdown per type in `CARE_TYPES` (`setCareLimit`: Never, After every wear, After 2–10 wears) and "A worn shirt waits" (`setLaundryDays`, which releases the coming week's locks like `setDarkShirts`); the summary `#sum-care` is written by `renderCareUI`
- `tests/care.test.js` covers all of it, with two devices for `away` / `cleaned` / the settings and sizes at 320, 390 and 626px in both themes

### `assemble.js`

- loaded after tagging.js and before asm-color.js and asm-gl.js (also in asm-worker.js): the cloths and geometry the colour-coded painter shares (shirt weaves, ties, jacket cloths, sleeves, body flow, the drawn tie bar) and the plumbing around it (the Web Worker, kept pictures, the computer's pictures, building ahead, Today's hook); every picture is painted on a colour-coded master (asm-color.js)
- the earlier photo-per-item assembler (one master photo, calibration photos, an OpenAI-edited "piece" per item, zones, `asmCompose`) and the atlas-painting trial (`asmComposeP2`, `/p2`) were deleted on 2026-11-14 by the owner's order; a look with no colour-coded master shows its own photo or the drawing; its photos still sit on the worker, and worker.js still accepts edit-a-kept-photo jobs (`baseKey`, `swap`), which nothing in the app sends
- `ASM_ON` (true; `let`): off, Today shows each outfit's own photo or drawing and nothing is fetched or painted; tests run with it off (`ASM_TEST_OFF`) unless the test file says `module.exports.assembled=true` (tests/run.js)
- `ASM_VER` (3) is in every key (`asmKey`), the colour-coded masters' too: never change it
- `asmMasterKey`, `asmCalibKey`, `asmVestKey`, `asmZoneKey`, `asmZoneImgs`, `asmMaskFromImg` stay for the computer's full atlas only (`npm run atlas` measures the earlier masters still on the worker); the phones' share of the atlas went with the earlier assembler
- a phone's stored `asm_paint2`, `asm_none` and `asm_vest` are removed at start-up
- Today: `renderFor(o)` (photos.js) returns `asmFor(o)` first, the picture kept on the device (`asmOut`, meta `asm:out:<key>`, the newest `ASM_KEEP` 150); `figureStage` (today.js) calls `asmEnsure(o)`, which looks for the look's master (`asmCmLook`) and hands over to asm-color.js `asmCmEnsure`
- a photo made for the outfit after its master (Settings: Regenerate) wins (`asmFullWins`, the owner's choice): `asmFor` gives null and `asmEnsure` does nothing for it (taking that null as "not made yet" once painted and redrew Today in a loop after a Regenerate)
- a look's key carries everything it is painted from (`asmOutKey` = asm-color.js `asmCmOutKey`), so a kept picture is right whoever made it (`asmFresh` is true for it): a fresh phone with newer copies of the masters used to refuse every PC picture and paint them all itself
- Today has no Generate / Try again button (2026-11-13, the owner: paid pictures only from Settings): Settings → This day's photo (`#regen-btn`, `generateRender` in photos.js); for a look painted on a colour-coded master it only paints (`asmEnsure`, nothing paid); Regenerate makes a whole photo of the outfit
- no picture is ever made or paid for by itself (the owner, 2026-11-13); there is no month batch; don't add automatic paid generation back
- off the page: the painting runs in a Web Worker, `asm-worker.js`; `asmJob(o)` (= `asmCmJob`, or null) gathers plain data, `asmBuild(job)` paints in either thread, `asmRun(job, front)` queues it, the day on screen first (`asmQ`)
- no worker (it failed to load, or no OffscreenCanvas: `{ready:false}`, `asmWorkerDown`): pictures are painted on the page and nothing is built ahead (`asmOffPage`); `window.ASM_NO_WORKER` forces that in tests
- a picture the worker hasn't answered in `ASM_RUN_MS` (180 s, `asmStuck`) fails, the worker is replaced and the pictures behind it go on; `tests/asmstuck.test.js`
- building ahead (`asmAhead`, `ASM_AHEAD_WAIT` 1.2 s after `asmEnsure` runs for the day on screen, `asmAheadSoon`): the looks of the next `ASM_AHEAD` (60) days' workdays, nearest the day on screen first; the computer's pictures first, `ASM_AHEAD_N` (3) at a time, then the unbuilt looks grouped by master; it starts over when Today is drawn again, skips painted looks and stops while the app is hidden
- a picture for the day on screen that is ready while a finger is down waits for the finger to lift (`asmShow`, `asmTouchWatch`): a redraw removes what the touch started on and stops the swipe; `tests/asmahead.test.js`
- kept pictures are Blobs (`asmKeepOut`: `{blob, stamp, t, pre}`) shown by an object URL (`asmImgOf`, revoked by `asmTrim`), so start-up holds stamps and dates, not 150 base64 pictures (heap after `asmLoad` 114 MB -> 0); a base64 record from before still shows and becomes a Blob 5 s after start (`asmBlobUp`)
- start-up reads only the key ranges it needs: `asmLoad` the `asm:out:` range, `loadRenders` (photos.js) the `render:` range
- `asmGet(key)` brings one record from the worker (`GET /render?key=`, one download at a time per key)
- a download that fails (no network, a 5xx) is not counted as tried: `asmGetOnce` and `asmGetPre1` mark a key only on the worker's answer (the record or a 404) and ask again after `ASM_RETRY_MS` (30 s, `asmRetryAt`)
- `asmSync(true)` (Settings) clears what was tried (before the colour-coded branch returns) and reads the worker's list and the masters' manifest again; `asmSync` downloads none of the earlier assembler's photos (a fresh install 47.8 -> 45 MB)
- `asmListGet` (one `GET /render?list=1` per `ASM_LIST_MS`, 5 min) says which looks the computer built and which colour-coded masters exist (`asmCmHeld`, remembered in `localStorage.asm_cm_listed` so a restart shows kept pictures at once)
- Settings → Outfit pictures → Advanced: `renderAsmUI` shows `#asm-group` (hidden while `ASM_ON` is off) and asm-color.js `asmCmUI` fills it (Pictures ahead, Painted plain, the graphics-chip switch)
- a phone asks for the computer's upload before downloading a master (`asmGetPre`, once a session per look); PC pictures are signed `asm/out/cm<ASM_CMV>/<stamp>` (`asmPreSig`); one signed another way (`asmPreSigOk`: the earlier assembler's `asm/out/z…`) is never taken
- a listed PC picture that was refused is not downloaded again until the list is read again (`asmPreNo`); building ahead used to download each refused picture on every pass
- `asmPrebuildOne(o)` is the computer's one look (see `npm run assemble` under asm-color.js); `tests/asmprebuild.test.js`

#### Shirt weaves
- the shirt weaves (`asmWeave(i)`, the owner's choice 2026-11-12 from renders of his shirts on the 2048 master): herringbone at Claude's count across the shirt (`ASM_SHIRT_MM` 550 / `sett.tr`), 12 mm when the count is at the server's cap (`ASM_TR_CAP` 80) or missing (`ASM_HB_TR` 45: his pink herringbone as he chose it)
- a figured weave (dobby diamonds, basket, twill readings): the repeat measured in its close-up (`asmTexMm`/`asmRepeatPx`: a correlation peak whose double comes back; the close-up taken as `ASM_CLOSEUP_MM` 80 mm wide), never finer than `ASM_TEX_MIN_MM` 2.9 mm (his white woven diamond measured 2.9, white basket 2.3, light-blue dobby 1.2)
- why not Claude's counts for those: `cleanPattern` caps them (60 a close-up, 80 a shirt) and a 270px item photo can't show a 3 mm weave; the white diamond's uncapped 65 across the shirt was 3x too big (read as a windowpane)
- end-on-end, and any weave never read (oxford, twill, chambray…): plain with a faint thread-sized fleck (`{f:'fleck'}`); enlarged to 2.9 mm, end-on-end's one-thread reading became a pinstripe or a micro-check
- figured shirts (a motif reading with figures and a close-up count `cr`, `asmMotif`) are drawn in colour (`{f:'col', mm: two cells of ASM_CLOSEUP_MM / cr, never under ASM_TEX_MIN_MM, rot}`; the owner's choice 2026-11-12 from renders of his grey chevron dobby and lavender micro-print neat: "perfect")
- the weave runs upright on the front and along the arm on each cuff (`asmShirtAngles`: the shirt's connected parts, the biggest is the front; a cuff's tile follows its band's long axis, rounded to 1/254 of a half turn); measured on the 2048 master: the cuffs at −79° and −85°
- the shirt-weave prototype and the owner's approved renders are in `C:\code\watch-test\shirt-texture\` on his PC
- `ASM_PX_MM` (3.2 px a mm at 2048) is one figure for the whole picture: a single photo can't give depth pixel by pixel

#### Ties
- ties (`asmTieFor`, the owner's choice 2026-11-12 from his black, navy & pink stripe, charcoal check and purple foulard ties): `asmTieTile` renders the reading's drawing (`fabricDef(…,'tie')`) without its turn or the swatch's white sheen line (at full size it read as stray lines), three tiles each way with the middle one read (a lone tile's edges antialiased into lines), in the reading's own colours (matching its main colour to the tag shifted the others: a pink stripe went lavender); a tie with no reading is its tagged colour; `asmTieSig` (with `ASM_TIEV`) is in the look's key
- `asmStripeCount`: a striped tie's close-up, its stripes' direction (sharpest projection) and spacing (first autocorrelation peak); when it disagrees with the reading's `cr` by over a third, the repeats across the blade are scaled to match (the owner's navy & pink: read 1.7, measured 2.8); not for checks
- a woven tie's weave repeats at most `ASM_TIE_TEX_MAX` (50, twill or herringbone) or `ASM_TIE_FIG_MAX` (22, a figured weave) times across, so it shows on a phone; both are in `asmTieSig` (see `### tagging.js` for `TIE_TEX_K`, `TIE_DARK_L`, `TIE_DARK_X`)

#### Jacket cloths
- jackets read in bands (`asmSuitBands`: a `v:2` sett with `tr`, a stripe or check, `STRIPE_PATS`/`CHECK_PATS`) are drawn by `asmSuitTex`: one repeat, `ASM_SHIRT_MM / tr` mm across, in Claude's own colours band by band from `patternSpec` (the owner's choice: measured from the pixels a thin line is blurred into the ground)
- lines are at least `ASM_LINE_PX` (4) wide at 2048, stripes at least `ASM_STRIPE_PX` (3) (at 4 the owner's navy pinstripe read heavy and white); a windowpane's crossing lines at full strength (`fabricDef` draws them at half for a swatch)
- a stripe reads as in a photo (`ASM_STRIPE`, fitted 2026-11-13 to the owner's navy pinstripe close-up by an automatic score, 30 -> 63 of 100): the line only 18% of the way from the ground to Claude's line colour, blurred across (2 px at 2048), its strength varying 30% along it every 8 px, the weave under it 8%; a dark ground (under 6% light) also 40% of its saturation and shading 0.9 × shading^1.4; windowpanes and checks are unchanged
- the cloth's weave under the bands (`asmClothOf`: linen, herringbone, twill, from the material or Claude's description): diagonal lines 4 px apart at 2048 with a fleck along each thread, as a share of the visible brightness (as a share of linear light the owner's dark navy herringbone did not show); a herringbone's columns are half a stripe repeat wide with their breaks on the stripes, else 8 mm
- a linen jacket (`asmLinen`) gets `asmLinenTile`: two-pixel threads, each a little lighter or darker, plain-woven, with slubs, a 5.5% spread around 1
- plain twill jackets (`asmSuitTwill`, `asmTwillTex`, 2026-11-13): one colour with the twill's ribs (`ASM_TWILL` amp .06, fleck .025: at the stripes' .16 the ribs read as columns), the rib averaged over four points a pixel (`ss`), and on a two-colour twill the ribs lean toward the second colour (`mix` .22)
- herringbone jackets with no band reading (`asmSuitWeave` reads the weave from the pattern, an own pattern's name or Claude's description): `asmTwillTex` with the herringbone cloth; `ASM_HB_MM` 5.4, `ASM_HB_RIB` 3.6, `ASM_HB_AMP` .28, `ASM_HB_FLECK` .16, `ASM_HB_YARN` .5, `ASM_HB_MOTTLE` .13, `ASM_HB_GRAIN` .1, `ASM_HB_FLOAT` .7/1.1, `ASM_HB_PBRK` .25, `ASM_HB_THIN`/`ASM_HB_BREAK`/`ASM_HB_SOFT` 0 (matched 2026-11-13 to an OpenAI picture the owner liked)
- ribs meet in clean V's at a column edge only when the column is a whole number of half rib-spacings (`asmHbCw` snaps it: 5.4 mm = 3 × 1.8); 4.4 mm against 1.7 mm ribs stair-stepped the V's, which the owner saw on his phone; a break inside the V or on every column read as stripes, none at all as continuous zigzags
- tweed jackets (`asmSuitTweed`, `asmTweedTex`; a tweed read as a check keeps the band painter): `asmTweedTile()` (512 px): plain-woven 2 px threads whose yarn changes every 1-3 px between a light pick, a dark pick and the ground (`ASM_TWEED` light .35, dark .2, sd .13), three short nubs a thread, flecks in 1.8% of the cells (in the second colour when there is one, a Donegal); sampled upright (along a sleeve it streaked at the crease); 2-7 px runs read as slubbed silk
- small woven figures (`ASM_MICRO`, `asmMicroGrid`, `asmMicroTex`, `asmMicroKind` also from an own pattern's name): houndstooth and sharkskin are a 2/2 twill of dark and light yarns (4+4, 1+1), birdseye and nailhead drawn; a houndstooth with no second colour is tonal
- `ASM_SUITV` (7) is in `asmSuitSig`, so it never changes without a repaint

#### Sleeves, body and lapels
- sleeves are one tube of cloth (`asmSleeveSegs` on a copy at most 512 px, `asmTubeAt`): ends found travelling inside the sleeve, bent where two lines fit 20% better than one, the elbow's corner rounded; past `ASM_CREASE_DEG` (30°) a crease (`asmTubePart`, chosen in whole numbers by `asmTubePartQ` so the CPU and the graphics chip agree): the forearm lies in front up to the elbow's outer edge, the upper arm's stripes stop at its top fold
- the parts' lines are fitted again from the middles of the cloth across (`asmTubeTabs`, twice): the first fit of the forearm took in some of the elbow and ran 20° off
- sleeves are cylinders (`ASM_TUBE_K` 1.15): a point x from the middle is R·asin(x/R) of cloth from it, so stripes close up toward a sleeve's edges (measured 43 px apart in the middle, 25–33 at the edges)
- `ASM_SLEEVE_FLOW` (the stripes' drift along each arm part, traced on the owner's target photo) and `ASM_FORE_K` (1.15: a creased sleeve's forearm, nearer the camera, has larger stripes) are in `asmTubeAt`; tried and dropped: an upper arm and forearm turned apart (broken lines), one line through both parts (ran back on itself), the path along the sleeve's middle (diagonal, stepped stripes)
- the body's stripes follow a learned flow (`ASM_FLOW`, `asmBodyFlow`, `asmFlowAt`: the slope of every stripe on the owner's target photo binned by distance from the midline and height below the shoulder line, laid on the master in its own frame), so they lean in toward the neck, close in at the waist and spread over the hips; a windowpane's cross lines stay square to its verticals
- lapels are one straight part each (`one`), the pattern along the whole lapel's long axis (the local window read it nearly upright)

#### Tie bar
- the tie bar is drawn, not photographed (`asmBarDraw`, the owner's choice 2026-11-13): a flat bar `ASM_BAR_AT` (0.6) of the way down the tie that shows, square to its centre line, clipped on from its left edge (a near-square end, darkened where it turns round the tie; the owner: a clip doesn't float), `ASM_BAR_LEN` (0.8) of its width, `ASM_BAR_MM` (5.5 mm) tall, rounded ends, polished metal lit from the upper left with the tie's colour reflected low, a soft shadow on the tie
- its colour (`asmBarRgb`): silver, white, the greys, gold, rose gold and gunmetal have metal tones (`ASM_METAL`), any other colour is an enamel bar in `colOf`; `asmBarSig` (with `ASM_BARV`) is in the look's key (asm-color.js `asmCmSig`); none on a waistcoat day

#### Tests
- `tests/assemble.test.js` (the tie bar, `ASM_ON`, Today's picture rules, the earlier assembler gone, the worker's edit jobs), `tests/asmcloth.test.js` (asmWeave, ties, `asmSuitTex`, sleeves, lapels, linen), `tests/asmweave.test.js`, `tests/asmtwill.test.js`, `tests/asmahead.test.js`, `tests/asmprebuild.test.js`, `tests/asmstuck.test.js`
- `tests/dress.test.js`: the default plan against the recorded signature (`GOLD`, recorded from commit 671db36 with the test's own `PLAN_SIG` and `WARD`); the four combinations; the score; Today, the drawing, the photo text, key and the worker's prompt; stats and what to buy; the Settings switches in both themes at 390 and 626px; the waistcoat default, the migration, a new wardrobe, and two devices on one backup in either order
- `tests/multi.test.js`: "saved suits have their matching vest by default" now expects no waistcoat (the intended change)
- test wardrobes put into `items` by a test have no `settings.vestDef`, so their suits with no `vest` value still read as three-piece, as before
- `prettyCols` (core.js) builds its colour-name pattern when first needed and again after `applyCustom`: built once at load it never knew the owner's colours, and photo descriptions said "a owntaupe tie"

### `asm-color.js`

#### Masters and kinds
- colour-coded masters (2026-11-13, the owner's restart of the assembler): loaded after assemble.js on the page and in asm-worker.js; every garment of an outfit is painted on a master photo in which each garment was one flat strong colour (gpt-image-2, 2880); nothing is photographed per item
- the master by the day's dress (`asmCmKind(o)`): a jacket and a tie → `suit` (on a waistcoat day `vest`); a jacket, no tie → `suit-open` (`vest-open` on a waistcoat day); no jacket, a tie → `shirt-tie`; no jacket, no tie → `shirt-open`; the shirt masters need trousers and a belt (`o.bot`, `o.belt`)
- `vest-open` has no master and is never used (no waistcoat without a tie): `asmCmUse` is null and the day shows its own photo or the drawing, as for any kind whose master isn't on the worker
- assemble.js `asmCmUse(o)` is the kind when its master is on the device; `asmEnsure` and `asmPrebuildOne` first look for it on the worker (`asmCmLook`, once a session); with it `asmJob`, `asmOutKey` (`out/cm…`, from `asmCmSig`: every garment's colour, reading and pattern spec), `asmStamp`, `asmWants` and `asmFullWins` follow it
- `asmCmSet('off')` (tests only: `localStorage.asm_cm` '0') turns the colour-coded masters off on this phone: no picture is painted
- the masters, masks and how they were made are on the owner's PC in `C:\code\watch-test\colormaster` (colormaster.js: zones from colour; paint.js: the prototype; SAM sleeve/lapel masks via `C:\code\sam2\cm_sleeves.py`)
- `suit-open` is built without an image generator (the owner's choice): `C:\code\watch-test\colormaster\cm-compose.js` fills the V between the suit master's lapels from the open-collar master, scaled 1.17 and placed so the two masters' collar points meet (matched by eye it sat 230 px off the body's centre line, which the owner called not human); the masks combine the same way; written to `out-suit-open`, uploaded with `npm run cm-upload -- --kinds suit-open`
- the shirt-and-tie master's skin, tie and shirt masks were remade along the hand's underside (2026-11-14, the owner approved v3): the spike under the hand and the wrist's cast shadow went to the tie and the shirt; the dark wedge between the wrist and the bracelet stays skin; the 512 fixture has the same fix; originals in `C:\code\watch-test\colormaster\out-shirt-tie\backup-2026-11-14-skinedge\`

#### Records and the manifest
- each master is photo records on the worker under `asmCmKey(kind, name)` = `asmKey('cm'+ASM_CMV+'/'+kind+'/'+name)`: `master` (2880 JPEG), `mask/<zone>` (2048 PNGs, soft, adding up to white), `part/sleeveR|sleeveL` (all) and `part/lapelR|lapelL` (jacket masters)
- they are put there by `npm run cm-upload -- --dir C:\code\watch-test\colormaster` (tools/asm-cm-upload.js, `DW_WORKER`/`DW_TOKEN`; a record already there with the same signature is not written; `--kinds` for some kinds)
- after any master, mask, part or the background is made again: run that cm-upload (it writes the manifest); the watcher then repaints, or run `npm run assemble`
- the background (the owner's choice): one picture behind all the masters, `asmCmBgKey()` = `asmCmKey('all','background')`, uploaded with `npm run cm-upload -- --bg <file>` (JPEG; a blurred cream office, `C:\code\watch-test\colormaster\bg\office-plate-desk-extended.png`, its desk carried left so its end hides behind the trousers on the shirt masters)
- the background's date is in `asmCmSig`, so a new background paints every look again; `asmCmLook` fetches it once a session (`asmCmBgGet`) even on a phone that holds the masters
- the masters' manifest (`asmCmMfKey()` = `asmCmKey('all','manifest')`, signed `asm/cm-manifest {"keys":{<key>:<record date>}}`, a 1x1 picture): written by cm-upload after its uploads, merged, only when a date changed; without it a re-uploaded record never reached a device that held it
- a device reads the manifest (`asmCmMfGet`, from `asmCmLook` and `asmCmGet`) whenever the worker's list was read again (`asmListAt`), or once a session without a list; a held record older than the manifest's date is deleted (`asmCmMfApply`) and downloaded again; kept in `localStorage.asm_cm_mf`
- the manifest's dates go into the looks' keys (`asmCmRev`, `mf:` in `asmCmSig`) and the job's record dates into the kept setup's key (`job.rev`), so a re-uploaded mask is a new setup and new pictures; with no manifest nothing changes
- the PC pre-build reads the manifest every cycle (`asmCmMfGet(true)`) and says when the worker has none yet

#### The painting
- `asmCmPrep` once per master (the setup), `asmCmBuild` per outfit: each pixel the zones' shares (Uint8, adding to 255) of: a garment's cloth × its light (the master's brightness over the zone's lit level, 75th percentile, a white shirt's 90th; at most 1.6, a shirt 1.15; pushed out from each zone's clean pixels over its edge, so no zone's light reaches into another)
- skin, watch, buckle and dark details are the master's own pixels (along their edge their clean neighbours', and never greener than red or blue: the chroma wall); skin is never bluer than red (`z==='skin'`)
- against the median (the prototype's first try) every garment came out half again too light (a navy read periwinkle, khaki cream)
- above its usual brightness a cloth gains neutral light, not more of its own colour, and a pixel past full brightness goes toward white keeping its hue (a light khaki's lit side turned peach)
- `asmCmRoute(item, zone)` is the one rule for which painter paints a garment (`{how, gap, why}`: flat, bands, twill, herringbone, tweed, tile, tie, or plain with gap 'reading' or 'painter'); `asmCmJob` paints by it, and the item sheet (`asmGapNote`), Settings' "Painted plain" list with "Read N patterns" (`asmGapUI`, `asmReadGaps`, Claude one call each, only on a tap) and the pre-build's log ("Painted plain (n):", `asmCmGaps`) all ask it
- the cloth: a patterned suit or blazer read in bands is the app's own suit cloth (`asmSuitTex`); a tie is `asmTieFor`'s; any other patterned shirt or trousers one repeat of `fabricDef` (`asmCmTile`, softened toward its ground: shirts 45%, trousers 30%), sized from the reading (`ASM_SHIRT_MM / tr`, a weave's own rules); solids and belts their colour
- woven shirts (`asmWeave` gives a tile: dobby, basket, diamond, herringbone readings) follow assemble.js's approved rules: no `ASM_CM_SOFT` softening, the repeat from `asmTexMm` (or the herringbone's count), and 3x3 points a pixel on the front and cuffs (`tile.fine`); at 45% and one point a pixel the owner's white woven diamond was a 3 L* swing and looked plain
- herringbone shirts (`asmHbShirt`; the owner's pick "every other column lighter"): `asmHbShirtLook` holds the tile's average at `ASM_HB_SHIRT_Y` (.78) of the tagged colour, then lifts its second column `ASM_HB_COL_LIFT` (.07) in linear light (10% toward white made bold pale stripes); `/hbs1-…` in only those looks' keys; `tests/hbshirt.test.js`
- on the shirt masters the sleeves carry the shirt's weave (the body upright); on the jacket masters each cuff's weave runs along the arm (`asmShirtAngles`' rule)
- herringbone jackets with no band reading, and own patterns based on solid whose name or description says twill or herringbone, are painted (`asmSuitWeave`, `asmTwillTex`); `asmCmWeaveTag` puts that in only those looks' keys
- the herringbone (constants in assemble.js, `C.yarn` the yarn breakup here) was matched on a test bench that renders the cloth formula, shrinks it as a phone does and sets it beside the same patch of the reference; `ASM_HB_BREAK` at 0.5 read as vertical stripes at phone size, `ASM_HB_SOFT` left a flat seam: both stay 0
- trousers in twill, herringbone or tweed (or an own pattern named so) are painted with the jacket's cloths (`asmTwillTex`, `asmTweedTex`, upright), marked by `asmCmWeaveTag`
- houndstooth, sharkskin, birdseye and nailhead jackets and trousers are painted in `suitCol` as `T.wv` (a thread grid along the cloth, 4x4 points a pixel from three `uvAt` lookups); a tonal houndstooth's teeth are 0.35x the cloth, 2.6x on a dark one
- knit ties (`asmKnitTile`, V stitches, 14 across) and paisley ties (`asmPaisleyTile`, teardrops in the second colour with a third-colour drop and an eye, 2.6 across; no second colour: cream on a dark tie, aubergine on a light one)
- `ASM_NO_PAINTER` is only "other" on jackets and trousers; `tests/asmroute.test.js`: every pattern in worker/tag.js `PATTERN_LIST` is in `PATS_BY`; every type's every pattern is painted, waits for a reading it can get, or is on `ASM_NO_PAINTER` (a snapshot that changes only on purpose); once read, every readable pattern is painted
- still flat: a pinstripe with no reading (the ink aubergine two-colour pinstripe: needs "Read pattern from photo"), plain-weave melanges, and trousers without a band reading (the steel blue fresco crosshatch)
- painting the background: its zone's share is the picture as it is (with the master's light the wall's blotches showed on the dark laptop), darker by the figure's soft shadow (`P.bgShadow`, `ASM_CM_BG_SHADOW` .22); without the record the wall stays flat `#E6E2DC`
- the sleeves reach the garment's outer edge (`ASM_CM_RIM` 24 px at 2048): the SAM sleeve outlines stop up to ~20 px short of the wall and that strip was painted as body cloth; jacket pixels within the rim of the wall join the sleeve or lapel beside them; the atlas's parts follow the same rule
- size: a phone paints at 2048 (`ASM_SIZE`); `npm run assemble` sets `ASM_CM_SIZE` 2880 and scales the picture to 2048; about 7 s a picture at 2048 on the owner's PC
- `asmCmBuild` keeps one master's setup in memory (`asmCmMem.list`), on a phone and in each of the PC's pool workers (all four at 2880 per worker was several GB with 16 workers); each pool worker gets one master's looks, and a switch reads the kept setup back
- `tests/asmcolor.test.js` (fixtures `tests/fixtures/cm/<kind>/` at 512: the suit and shirt-and-tie masters)

#### Cloth look and lighting
- the cloth look and lighting (`ASM_CM_LOOK`, `ASM_CM_LIGHT`, `asmCmLightPrep`): the owner's choice 2026-11-13 after many rounds of mockups of his ten non-pinstripe jackets; a first version with a bolder weave broke the pinstripes' lines and was rolled back (its pictures are still on the worker under p6)
- a jacket painted with stripes (`c.suit.k`, his two pinstripes) is left exactly as before (`e.keep`)
- a dark cloth (luminance under `dark` .035: his black twill and chocolate brown) takes the full look; a lighter cloth keeps its colour exactly (`e.light`, the owner: "the colors are good, I just need lighting fixes"): only its large folds get more contrast around the zone's mean (`lgam` 1.3 on the shading blurred `lr` 12 px at 2048; on the shading itself it strengthened the master's blotchy grain, which smudged the weave)
- the full look: a cloth's albedo kept between real black wool (`ymin`, less on a coloured cloth by `chroma` so a navy stays navy) and white cotton (`cmax`); a neutral sheen where the master is lit, the same for every colour (a share of the cloth's own brightness gave nothing on black); the weave bolder than life on a dark cloth; a soft tone curve; `job.look:false` paints without it
- the lighting on jacket, waistcoat, shirt and tie (`ASM_CM_LIGHT`, the master-only part `hit.lx`): contact shadows where a layer lies on another, cast down-right away from the window; a window light from the left (`win`, half on a dark cloth: the full fall-off sank the black suit's right side to black); lit edges facing the light; warm shadows; a film grain matching the photographed hands
- trousers take only the folds' lighting (`e.light`, whatever their colour: the full look's bolder weave read as diagonal lines down each leg and its sheen turned the window-side leg a blotchy grey beside a black one) and contact shadows under the belt and buckle (`OVER`)
- the lighting's master-only part is 16-bit (`ao`, `aob`, `rim` over `ASM_CM_U16`, `smb` over 40000 like the shading), worked out with the setup and packed with it (`P.lx`): a master in memory at 2048 201 -> 145 MB, a picture from the kept setup 5.9 -> 3.1 s
- a silk tie's darker edges and sheen: `ts` .018 (wide, `tsw` .2) and `te` .2 (the owner, 2026-11-13: ties looked too glossy); the silk reads matte with a hint of roundness
- a tie's sheen follows its own brightness (`asmTieSheenK`: the tie's luminance over `ASM_TIE_SHEEN_Y` .18, mid-tone and lighter unchanged, never under `ASM_TIE_SHEEN_MIN` .15): a fixed amount of light made a black tie about twice its own brightness in the band (the owner: "the black tie is still super glossy"); only dark ties' looks get a new key (`/tsh1`, `asmCmTieTag`)
- ribs squeezed finer than the picture can show are softened (2026-11-14, `ASM_CM_AA` .7, in `suitCol`'s twill and herringbone branch): the rib's cycles per pixel come from the solved positions half a pixel either side, scaled by a Gaussian pixel's response against its response where the cloth faces the camera, so facing cloth is unchanged and only squeezed ribs fade; `job.aa` false turns it off, a number sets the strength
- why `ASM_CM_AA` .7: on a bench against a 4096 reference (`C:\code\watch-test\geo3d\compare\aa-bench.js`) the error fell 7% on the mushroom twill, 2% on the charcoal herringbone, 16% on the aubergine pinstripe on twill; 0.9 lost the herringbone's contrast
- the cut-off for a jump into another piece (`ASM_CM_AA_CUT`) fades over `ASM_CM_AA_FADE` (.05) either side (`asmAaK`), so float64 and float32 agree

#### Buttons, hands and ties
- the button between finger and thumb (the masters' `dark` zone, under 160 px across) is drawn as a horn button in the jacket's colour (`BL`/`BT` in the painter; the master's flat grey oval read as a smudge)
- the shirt's buttons are drawn (`ASM_CM_BTN`, `asmCmButtons`; painted with the cloth they were ghost discs with the weave through them), positions measured by eye per master on the 2048 painting (none on the suit masters); a remade master needs its buttons measured again
- the button's colour (`asmCmBtnCol`) is `ASM_CM_BTN_MIX` (.55) of the shirt mixed into `ASM_CM_BTN_PEARL` in sRGB, lighter than its shirt but coloured with it (the owner's pick from mockups; a tint was too light); `ASM_CM_BTNV` in the looks of masters with buttons
- the hand's outline against the shirt (`asmCmHandEdge`, in `asmCmPrep`): within `ASM_CM_HAND_R` (6 px at 2048) of where skin and shirt meet, a pixel's share between them follows the master's colour (warm: skin; near-neutral and light: shirt), so the shirt between the fingers shows no white wedges and nail tips stay skin; only shares between skin and shirt move
- only skin over half a pixel counts as a hand: stray skin shares of 1-9 levels in the tie's fringe gave a pinkish band down the tie's edge on every shirt-and-tie look (the owner: "looks terrible"); a skin share with no such skin within `ASM_CM_HAND_STRAY` (24 px) goes to the pixel's largest painted zone
- beside the tie (within `ASM_CM_HAND_R`) a light pixel whose blue is not below its green minus 4 is the tie's fringe: it goes to the shirt
- `ASM_CM_HAND_LIT` (150): an in-between pixel darker than that may only lose skin to the shirt, never gain it (the shirt in the hand's shade read warm and got a grey-purple band under the wrist)
- `tests/cmhandedge.test.js`: on the 512 fixture no skin share is left in the tie's right-edge band or far from the hand, and the band paints in the shirt's colour
- the tie's knot ends at its neck: the narrowest row from a third of its widest row below its top to the lesser of 30% of its length and 1.5 widest rows (on the shirt-and-tie master the hand grips the tie at 30%, and the knot's turned stripes ran down to it)
- a tie clip is drawn with `asmBarDraw` (not on a waistcoat day)

#### Trousers and legs
- a suit's own trousers (jacket taken off, `o.suitBot`) are painted with the jacket's band cloth (`asmCmRoute` → `bands`) on the shirt masters; suit cloth on trousers is drawn at the master's own scale (`lsc` = `ls` × the kind's `pxmm` in `suitCol`; the jacket master's was about 1.5x too large), marked `/sc` in those looks' keys (`asmCmTrSc`); `tests/takeoff.test.js`
- the trousers' lines follow the legs (the owner: straight even stripes read as printed on): `asmLegsPrep` (in `asmCmPrep`, kept as `P.legs`) finds the fly, the crotch and each row's edges (an outer edge with the hand beside it filled from the rows around; smoothed over `ASM_LEG_SMOOTH` 40 px)
- `asmLegsAt` (from `uvAt` while painting the trousers zone, `ZC`) gives across = cloth from the fly on a cylinder: the hips' about the fly above the crotch blending into each leg's about its crease below (`ASM_LEG_BLEND` 140 px, R = `ASM_LEG_K` 1.15 × half width), so lines stay parallel to the crease and close up at the sides; plus a bend with the folds (`ASM_LEG_FOLD` 150, at most `ASM_LEG_FOLD_MAX` 4 px)
- every lined cloth on trousers takes it; only those looks' keys change (`/lg` + `ASM_LEGV` in `asmCmTrSc`)

#### Solved cloth positions
- the jacket's geometry is the app's (`asmSleeveSegs`, `asmTubeAt`, `asmBodyFlow`, lapels as one straight part each); `ASM_SLEEVE_FLOW` is left out (on the new master's hanging arm it folded the stripes); `asmCmRefit` fits a creased sleeve again when its forearm is over 15° from the app's fit: k-lines, the cloth's middles, the direction in which the forearm is narrowest
- solved positions (2026-11-14, the owner's pick from comparisons on his pinstripe and windowpane jackets; `asmGeoPrep`, `asmUvAt`): per master two PNGs on the worker (`asmCmKey(kind,'geo/u'|'geo/v')`, each value round((position+1024)*16) in red (high) and green (low), blue the piece); every pattern on those pieces is painted at its solved position (`uvAt`), the body's still through the traced stripe flow (`asmFlowAt`)
- piece ids: 1 jacket body, 2 shirt front, 3 trousers, 10..39 sleeve parts (the jacket's, or on the shirt masters the shirt's), 40..59 lapels, 60..79 the shirt's cuffs on the jacket masters, 80 the tie's knot, 81 its blade
- the tie reads 80/81 in the painter's frames (the blade's lean, a quarter turn more in the knot) and turns them by the pattern's own angle; its positions are one unit per pixel across the blade on the median, so the reading's count across the blade stays (`e.rep`)
- the shear term (stripes slanted by the sleeve's tilt along its length) is left out on sleeves and the tie: it hooked the pinstripes at the cuff
- why: on the owner's reference photo the surface model predicts the sleeves' stripe spacing within about 4% (R² 0.78) where the painter's cylinders miss by 8-9% (R² 0.19), and the cylinders add nothing on top of it (`geo3d\calib\sleeves`)
- the maps are part of a master only once the manifest lists both (`asmCmGeoKeys`): then `asmCmGet` downloads them (about 1.5 MB a jacket master), their dates are in the looks' keys (`asmCmRev`), and `asmCmJob` sends them (`job.geoU`, `job.geoV`, `job.gt`); without them the painter is as before; `tests/geomaps.test.js`
- decoded at their own 2048 (`ASM_GEO_PX`) and resampled value by value for the PC's 2880 (a resampled picture would blend the two bytes and the pieces' ids); kept beside the master's setup, not packed with it
- made on the owner's PC in `C:\code\watch-test\geo3d` from Meta's Sapiens-2B surface normals: `flatten\flatten.py` solves each garment by least squares, `flatten\export_pieces.js pieces-v2` exports the painter's own pieces with their frames, `flatten\flatten_pieces.py --pieces pieces-v2 … --no-shear` solves each in its frame (the forearm's lines meet the upper arm's at the crease); the trousers keep one upright solve
- the shipped set is `flatten\final-v2\<kind>`, copied to the colormaster `out-<kind>\uv-u.png`/`uv-v.png` and uploaded by `npm run cm-upload` (lossless, never re-encoded)
- a remade master or mask needs its maps made again (export_pieces.js reads the painter's sleeve parts from the masks)

#### Code fingerprints and keys
- the painter's code is in every colour-coded look's key (`asmCmCodeSig`: a hash of the source of every function and the value of every constant in `asmCmCode`, the closure of `asmCmJob`, `asmCmPrep` and `asmCmBuild` in assemble.js and asm-color.js), so changing anything it reaches repaints every look by itself
- the kept setup's key is the master's record, `ASM_CMV`, `ASM_CM_PACKV` and `asmCmSrcSig`, which hashes the same way the closure of `asmCmPrep` and `asmCmLightPrep` (`asmCmPrepCode`: `asmCmHandEdge`, the blur, the tube helpers, `ASM_CM_RIM`, `ASM_LEG_*`…); changing what it reaches makes every device work every setup out again (and, through `asmCmCode`, repaints every look)
- `tests/asmcode.test.js` reads both files, follows every top-level name those functions reach and fails when one is missing from `asmCmCode`/`asmCmPrepCode` (state such as memo maps is on its `SKIP` list); a new helper or constant used by the painter must be added to the list the test names
- not in the code hash: draw.js's drawings (`fabricDef`) that shirt and tie tiles are made from; a change there that should repaint needs `ASM_CM_PAINTV` (9) or the look's own tag
- `ASM_CM_PAINTV` is for a deliberate repaint (it went to 9 when the tie sheen, hand edge and trousers lighting had shipped without a bump and the PC kept its old pictures)
- the cell fades keep float64 (CPU) and float32 (graphics chip) positions in agreement and are in the code hash: a stripe index fades into its neighbour's within `ASM_CELL_FADE` of a repeat's edge; a herringbone's column fades its rib and fleck into the next column's; yarn, floats, grain cells, a small woven figure's thread grid and the linen's threads are read through `asmCellT` (as `asmCellV`); see `### asm-gl.js`
- `asmTubeAt` chooses upper arm or forearm with `asmTubePartQ` (whole numbers: points in 1/16 px, directions in 1/1024, thresholds `round(-1.3 r 16384)`); `asmTubeTabs` keeps the float `asmTubePart`, so the kept setup's key is unchanged

#### The lighting rework (2026-11-14; the owner approved it from before/after sheets, four rounds, then his brown suits)
- the lighting rework (2026-11-14): measured against the owner's two real photos (a Brooks Brothers navy pinstripe suit, a white shirt and tie outdoors; the bench and the photos are in `C:\code\watch-test\light`: `bench.js` paints 13 fixed looks from a checkout with local master files, `stats.js` measures a garment's light, `run-stats.ps1`)
- what the photos showed: the masters' shadows are far deeper than real cloth's (a jacket's median light .41-.48 of its lit level painted, .76 photographed; fold contrast .44-.55 against .23), and a real shirt's folds are gentler than the painted ones (10th percentile .47-.52 painted, .68 photographed)
- a light map per master (`asmCmLightKeys`, record `light`, optional like the solved positions; `job.light`): R the form light from the Sapiens normals (a window from the left), laid into every cloth's light in `asmCmPrep` (kept under 1.63: the 16-bit light is over 40000, and an overflow painted black specks); G the glow where cloth turns away, into the jacket's lit edges (`ASM_CM_GLOW`); B the collar leaves' shadow, into the shirt's and tie's contact shadows (`ASM_CM_COLLAR`); with one, the old left-to-right ramp keeps `ASM_CM_WINK` (.25) of its strength (`uWin` in asm-gl.js)
- the light maps and the collar leaves' cloth positions (the solved maps' piece 2 turned square to each leaf's fold, so a weave runs as on a real collar) are made on the PC by `C:\code\watch-test\light\lightmap.js` into `light\over\out-<kind>` (leaf outlines placed by eye on 2x crops of the three collars; suit-open's from the open collar as cm-compose.js placed it); not uploaded yet: to ship, copy `light.png`, `uv-u.png`, `uv-v.png` into the colormaster `out-<kind>` folders and run `npm run cm-upload` (it uploads `light.png` as `light`)
- a striped jacket takes the lighting (not the cloth look's bolder weave): `lit` no longer leaves out `e.keep`, `uJm.w` is always 1
- a weave's ribs follow the light (`ASM_CM_WLIGHT`, `asmCmWk`: a jacket's, waistcoat's or trousers' ribs at .5-1.15 of their strength by the light; one line after `suitCol` and in the shader's `outer`)
- `asmCmHandEdge` also (beside main's own fix of the tie's pinkish fringe, `ASM_CM_HAND_STRAY`, which this branch took in the merge): the tie's dark magenta shadow kept as skin is tie (a dark red speck at the fist), and the cuff's inner face inside the watch's hull is shirt (`ASM_CM_CUFF_PX`, `ASM_CM_CUFF_STEP`: from the shirt's edge while the master stays smooth and neutral)
- (2026-11-14, shirt-open's top links) the cuff rule in `asmCmHandEdge` only takes cool pixels (blue >= red - 6): smooth warm-grey link steel next to the shirt (red 10-25 above blue) stays watch instead of painting in the shirt's colour; the cuff's white is cool (`tests/cmcuffsteel.test.js`, 512 fixture)
- `asmCmFinish` (both painters, on the finished 8-bit picture; `ASM_CM_FIN`, `asmCmFinPrep` once per master in a session, `hit.fin`): the figure's outline softened over 3x3 within 3 px, a little of the room's colour from 9 px beyond the outline on the figure's edge, and the cloth's fine grain on the room
- (the owner, 2026-11-14, on the first before/afters: "everything looks more washed out") lifting the shadows alone made every garment lighter overall: after the fold power the zone's mean light is brought back `ASM_CM_FOLD_KEEP` (.8) of the way to what it was, so a cloth keeps its tone and only the folds' shape changes; the look's sheen is `s0` .45 / `sheen` .024 (a black suit stays black); `ASM_CM_FIN.wrap` .12 (was .22)
- (the owner, same day, on the mid grey suit of the second sheets: "you don't think the lighting totally washes it out here?") the fold power is no longer applied in `asmCmPrep`: it only keeps each zone's power and scale (`P.fold`), and each look takes as much of them as its cloth is dark (`asmCmFoldW`: all below luminance `ASM_CM_FOLD_Y` .02, none from .05, at most `ASM_CM_FOLD_MAX` .55; `asmCmMp` joins it with the material into [power, highlight strength, scale], `e.mp` / `uMatO`, `uMatS`, `uMatT`); only jackets, waistcoats and trousers have an entry in `ASM_CM_FOLD` (shirts and ties keep their folds); `LK.lgam` is 1.3 again (his earlier pick for lighter cloth) and `ASM_CM_WINK` .8; so a mid or light cloth keeps the folds it had on main, and only black, dark navy and dark pinstripes have their shadows opened, half way
- (the owner, same day, on both pinstripes of the third sheets: "no shadowing on the right side (away from the light source)") a striped jacket takes none of the fold opening (`asmCmMp`: `c.suit.k`) and keeps `ASM_STRIPE`'s `gam`/`gain` (the job's override is gone): its far side's shadow is that steeper shading; and the light is read from the master's luminance again, not along the garment's colour (in the masters' shadows the strong channel falls less than the others, so shadows read about 30% lighter); measured on the navy pinstripe, before → after: window-side chest 56 → 63, far chest 29 → 28, far sleeve 22 → 21 (`C:\code\watch-test\light\boxmean.js`)
- lesson: matching a real photo's light statistics is not a goal by itself; one dark navy studio suit said nothing about mid grey cloth, and the owner judges by depth and tone first; show him a mid-tone look before calling a lighting change done
- the material's light (`ASM_CM_MAT`, `asmCmMat(item, zone)` → `cloth[z].mat` = [the power on the light below the lit level, the strength of the light above it]; `e.mp` on the CPU, `matS` with `uMat`/`uMatT` in the shader): linen crisp and matt, tweed/flannel/melange soft and matt, a worsted a little sheen, chinos and denim crisp and matt, oxford/twill shirts softer than poplin, sateen shinier, a silk tie crisp and shiny, a knit/wool/grenadine tie soft and matt; read from the item's material, its pattern's name and Claude's description (few items have a material set)
- a tie's sheen lies where the tie itself is lit (`ASM_TIE_LIT`, `asmTieLit`: none below .7 of its lit level, so the knot's dimple and the folds shape it), times the material's highlight strength; it was one even band down the blade
- filtered tile reads (`asmCmMips`, `asmCmRead`, `ASM_CM_MIPS` 4, `ASM_CM_LOD0` 2; the shader's `tileRead`/`tileLv`, `uTO[5t+L]`, the levels stacked to each tile's right in `asmGlAtlas`): a pixel's 2x2 or 3x3 read points each take the tile level whose texels are as far apart as the points (blended between two levels; exactly as before while the points are under 2 texels apart); at the tie, the shirt's tile (solved, sleeves and the woven 3x3), read trousers along the legs and the suit cloth's band tile; the single-point reads (an upright shirt, a turned cuff's one point) are as before
- a `${...}` or a `//` comment pasted into asm-gl.js through a script needs care: the shader is one template string per line of many statements (see the bullet below)
- a comment inside a line of asm-gl.js cuts off the rest of that line (the file's lines hold many statements): it dropped `uJl` and every dark jacket differed from the CPU; `tests/asmgl.test.js` caught it

#### Cloth from the close-up (2026-11-14; the owner: his brown suits "just look bland", approved from before/after sheets of every item it changes)
- a jacket, waistcoat or trousers routed `flat`, `twill` or `plain` whose item has a close-up (`asmCuWants`) is painted with a tile cut from that close-up (`asmCuTile` → `cloth[z].suit`, in `asmCmJob`; `asmCuTag` in `asmCmSig`); striped, checked, herringbone, tweed and linen cloths keep their own painters, and an item with no close-up is painted as before
- `asmCuPatch`: the largest clean square of cloth on a 420 px copy (all cloth, light even within `ASM_CU.even`, no line over `ASM_CU.edge` times the cloth's usual: seams measured 10-24 times, clean cloth 4-7), the sharpest such window; none clean: no tile
- `asmCuTile1`: the square at 256 texels, its light flattened at 1/`ASM_CU.flat` of its side, made to tile without mirroring (`asmCuWrap`), its detail laid on the item's tagged colour (the tile's mean is that colour; the close-up gives texture only), drawn `ASM_CU.zoom` (3) times life size, since a fine weave at life size is under a picture pixel
- (the owner: "what happened to medium gray, it looks like a disaster") flattening at a seventh of the square left the close-up's soft blotches and crease shadows in the tile, which repeated as a patchwork; hence `ASM_CU.flat` 18
- (the owner: "Half strength for medium grey") a cloth whose pattern or description says fine or worsted (`asmCuFine`) shows its grain no stronger than `ASM_CU.fine` (.5 swing); other cloths show theirs as in the close-up, brought up to `ASM_CU.show` when fainter
- (the owner: "Leave the current painter for black solid color suits") cloth darker than `ASM_CU.dark` is not taken from the close-up (`asmCuDark`): his black suit lost its ribs and went plain
- a new close-up or a retagged colour repaints the item's looks by itself (the tag holds the close-up's length and tail, the key the colour); a change to `ASM_CU` or the functions repaints all (they are in `asmCmCode`); tests/asmcu.test.js
- (the owner, same day: a new Light Grey close-up "painting without any texture") `asmCuPatch` counted a well-lit light grey's light threads as white paper (27% of the picture, scattered), found no all-cloth window and the suit fell back to flat colour; paper is now a solid area (`ASM_CU.solid` of its 13 px surroundings) brighter than `ASM_CU.paper` times the picture's 30th percentile of light
- (the owner, same day, from bench sheets of his Grey Herringbone at full, double and triple strength: "put the herringbone on triple") a jacket, waistcoat or trousers routed `herringbone` with a close-up takes the close-up cloth too, at `ASM_CU.hb` (3) times life on the body, lapels and waistcoat and `ASM_CU.hbs` (2) on the jacket's sleeves (his choice from mocks with single, double and triple sleeves; the tile's `slv`, applied per pixel by `suitCol` where `geo.seg` is 1 or 2 and by the shader's `uSlv`), whatever `asmCuFine` says; without a close-up, or read in bands, it keeps the herringbone painter; sheets in `C:\code\watch-test\light\cu\hb`
- the bench's sheets for this are in `C:\code\watch-test\light\brown3\show`, `cu\show` and `cu\r2`

#### A figured shirt from its close-up (2026-11-14; the owner, from 2048 mockups: "Move the repeat finder into the app", then "Build it with the strict confidence test")
- a shirt routed `tile` with a close-up (`asmCrWants`: not herringbone, twill, end-on-end or a band reading; a printed pattern is taken too) is painted with ONE WHOLE REPEAT cut from the close-up when the finder is sure (`asmCrTile` in `asmCmJob`, replacing `asmCmTile`'s drawing; `asmCrTag` in `asmCmSig`); else it is drawn as before
- why not the suits' close-up cloth (`asmCuTile1`): blending a square's edges cuts and doubles a regular figure (the first mock had brick-like seams, figures near black and rows drifting with the camera's angle)
- `asmCrFind`: the cloth's light with the lighting divided out, its self-similarity over the middle window, the two shortest strong non-parallel peaks as the repeat's steps (a brick layout: a rectangle two cells tall), the steps nudged until the 7 x 7 cells round the middle, laid over each other, are sharpest
- the strict confidence test: `per` (the share of the cells' contrast the averaged cell explains) at least `ASM_CR.per` (.6) and `sd` (the averaged cell's strength) at least `ASM_CR.sd` (.12); the figures as first measured are superseded by the bullet on his shirts below; tone-on-tone weaves are too faint (sd) and stay as drawn
- `asmCrTile1`: the cells averaged into one along the pattern's own rows and columns (straightened), the ground (the lighter 55%) set to the tagged colour, the figure keeping its own colour against it; life size, never finer than `ASM_TEX_MIN_MM`; an ordinary fine shirt tile ({t,TW,TH,mm,fine}), so the CPU painter and the WebGL shader paint it with no change of theirs
- (the owner, the same day, sending his lavender print's close-up: "why didn't this one pass the strict test") it had been left out by name because the first finder tiled the weave under it; the finder was wrong, not the close-up: the search stopped at W/7 (its sprigs repeat 70 px apart) and took the two shortest peaks (the threads, 1 mm)
- the finder since: the search reaches W/`ASM_CR.D` (4) on the light smoothed over `ASM_CR.smooth` px (figures stay, threads go); the candidates are the shortest of the strong peaks; every pair is tried and the pair whose pile explains most wins (of those within `ASM_CR.near`, the smallest cell); the score is cross-checked between alternate cells of the pile, so a pile of few large cells is not flattered
- (the owner: "how come they turned the pattern sideways?") a print on a diagonal grid was sampled along its diagonals and laid level; the tile's cell is now upright: its sides are the shortest repeats within `ASM_CR.tilt` degrees of level and of upright (whole-number sums of the two steps, nudged again), so a cell may hold several repeats (`cr.cells`)
- (the owner chose "sharpen the figures first") each cell of the pile is lined up on the others (`ASM_CR.align` px, then half steps, twice) before they are averaged: unaligned, the print's sprigs were soft dashes; the tile is up to `ASM_CR.TWmax` texels wide for a large cell
- on his shirts now: "White & grey & white dobby" (per .95, sd .31) and "Lavender & navy micro-print neat" (.90, .37) pass; the rest fail on sd (.06 or less: White woven .75 / .06, Check .70 / .04) or on per
- the bench's prototype and sheets: `C:\code\watch-test\light\patch-repeat.js`, `cu\dobby`, `cu\fig`; `tests/asmcr.test.js`

#### Phones
- faster masters on a phone (the owner's ask; first use was 15.5 s on a simulated phone, 2.6 s with the setup kept): `asmCmWarm` (end of `asmAhead`) warms coming masters in the background as setup-only jobs (`job.setupOnly`, assemble.js `asmBuild`), once a session, not on save-data or 2G; `tests/masterspeed.test.js`
- `npm run assemble` shares each master's setup (`asmCmSetupBlob`, `asmCmBlobOf`/`asmCmBlobRead`, PUT /blob); a phone fetches it into IndexedDB in `asmCmGet` (`asmCmSetupFetch`, key `asmCmDiskKey`)
- it also uploads a 2048 copy of each master (`asmCmMasterCopyRec`), kept by a phone under the master's own key and date (`asmCmMasterCopy`); an older copy is ignored
- `asmData` is out of `asmCmPrepCode` (still in `asmCmCode`): the worker swaps its own decoder, so including it made page and worker setup keys differ; `tests/asmcode.test.js` skips it
- a phone asks for the computer's picture first (the owner's ask: the phone side was slow); `asmCmEnsure` downloads the master, masks and parts (2.8 MB) only to paint a look nobody built
- while building ahead an unbuilt look is left to the computer for `ASM_PC_WAIT` (10 min, `asmCmLate`); the day on screen is painted at once
- a master's setup (`asmCmPrep`) is kept on every device, phones included, packed (`asmCmPack`/`asmCmUnpack`: the large arrays gzipped, the master's pixels decoded again): about 145 MB in memory at 2048 -> about 5 MB, read back in about 0.6 s at phone speed against about 23 s to work it out; `job.diskCache:false` skips it

#### The PC pre-build and its watcher
- `npm run assemble` (tools/asm-prebuild.js, `DW_WORKER` and `DW_TOKEN` (the owner's code) in the environment, `--days`, `--dry`, `--origin`) runs the app in headless Chromium connected as the owner, loads the wardrobe from the backup (its uploads are answered locally: the backup is never written), paints every coming look that has a colour-coded master exactly as a phone does and uploads it with `PUT /render` under the look's key, signed `asm/out/cm<ASM_CMV>/<stamp>` (`asmPreSig`)
- every request the page makes goes through the script (`route.fetch`), so the worker's allowed origins and CORS don't matter
- it is one page driving a pool of `--jobs` Web Workers (`__poolRun`; default half the logical cores, at most 16), looks shared out by master; each look's key and signature are known before painting (every master's masks downloaded first, since the signature is the newest record's date), then one `GET /render?list=1` and the record of earlier uploads (`made-pictures.json`) say what to paint; a look already current is skipped (no KV write); 120 days: 39 s from a fresh profile, 20 s warm
- `--profile <folder>` keeps the browser's data (wardrobe, masters) and each master's setup (`job.diskCache`: IndexedDB `dw-asm-prep`, keyed by `asmCmSrcSig`) between runs
- `--watch <min>` keeps the page open, re-syncs and re-plans every few minutes, builds only changed looks, says nothing when nothing changed, and exits with code 10 when main on GitHub moves; a cycle with a look not made is checked again next cycle
- the pool's workers have an error handler and a per-look timeout (`--look-timeout`, 180 s): the look fails and the worker is replaced (the new one reads its master's kept setup back); a dead worker used to leave `--watch` waiting forever without noticing main moved
- `--cycle-timeout` (45 min): a cycle that hangs ends the script with code 4, a crashed page with code 3; the watcher starts it again after 5 minutes
- this computer's daily upload cap (2026-11-14, the owner: "limit the pc to only upload 300 items per day"): `tools/upload-budget.js` counts every `PUT /render` from `asm-prebuild.js` and `asm-cm-upload.js` in one ledger for all checkouts (`<home>\.dw-upload-budget.json`, a lock file, the UTC day; `DW_UPLOAD_LIMIT`, `DW_UPLOAD_LEDGER`)
- a limit for one day only (2026-11-14, the owner: "lift the upload cap for today"): `node tools/upload-budget.js --today <n>` writes today's limit into the ledger (`--today off` takes it out; no argument prints today's count and limit); every tool reads it while the ledger's day is today (`limitNow`, `today`), and the usual limit is back the next UTC day by itself; the worker's own daily write allowance still applies
- every look is painted first and the uploads follow together (2026-11-14, the owner's ask: a picture's upload took about a second and each look waited for its own): `finish` keeps the painted picture (`pending`; its place in the day's budget is taken then, so no more are painted than can be sent) and `uploadAll` sends them `--uploads` (8) at a time after the CPU and GPU passes, outside the GPU guard; a write the worker refuses pauses the rest and gives their places back; a look's line says "painted", then one line for the uploads
- the chip's pixels are encoded on the CPU pool (2026-11-14, the owner's ask: "I shouldn't have to wait and do one at a time"; measured: the chip paints a look in about 30 ms, the shrink to 2048 and the JPEG took most of the rest of about 0.2 s): a GPU job says `job.raw`, `asmGlTry` returns the finished pixels (`{px, S}`, after the buttons, the clip and `asmCmFinish`), asm-worker.js hands them over without a copy, and the page gives them to a pool worker (`{encode}` → `asmGlEncode` in asm-gl.js; `__encPut`/`__encTake`, up to six workers in turn) while the chip paints the next look; `uploadAll` waits for each picture; a look's line says "painted" without a size
- a GPU look's job goes without its master once the GPU worker holds it (`job.hk` names the master: its key, record dates and size; asm-worker.js keeps `master`, `masks`, `parts`, `geoU`, `geoV`, `light` from the last whole job (`asmHeavy`) and fills them in, or answers "needs the full job", and the page sends it whole): a job is 13-40 MB with them
- the masters are set up at the same time (`presetup`, before the GPU worker is asked): each master whose setup is not yet kept on disk (IndexedDB `dw-asm-prep`, `asmCmDiskKey`; after a change of the painter's setup code or of a master's files, about 19 s each at 2880) is worked out on its own CPU pool worker (`{setup}`), the page waits until it is on disk, and the GPU worker reads it back; they used to be worked out one after another in the GPU worker
- `asmGlEncode` and the worker's messages are not in the pictures' code hash (asm-gl.js and asm-worker.js are outside `asmCmCode`), so these changes repaint nothing
- when the cap is used up the builder pauses as for the worker's kv-limit; cm-upload reserves its whole batch first (exit 4, nothing uploaded); tests give every script a temporary ledger; `tests/uploadbudget.test.js`
- the PC builder's upload pause (`upload-pause.json` in its profile) records why: `cap` (this computer's daily limit) lifts at the next cycle once the limit has room again (a limit raised for the day with `budget.today`), `server` (the worker's kv-limit) is tried again an hour later; a pause file with no reason counts as `cap` (2026-11-14: the owner raised the day's limit and the watcher stayed paused until 03:02)
- every new upload a PC tool makes (`PUT /render`, `PUT /blob`, any write to the worker) takes `budget.take(n)` from `tools/upload-budget.js` first (the master copies and setups for phones were once added without it and went uncounted)
- on the owner's PC `C:\code\assemble-watch.ps1` runs `--watch` in a loop from its own copy of main (`C:\code\dw-assemble`, profile `C:\code\dw-assemble-profile`, log `C:\code\dw-assemble-watch.log`, one at a time), started hidden at sign-in by "DW assemble watch.vbs" in the Startup folder; it passes the commit it checked out (`--head <sha>`), so a move of main before the script starts is noticed
- `assemble.ps1` has its own checkout (`C:\code\dw-assemble-once`) and profile (`dw-assemble-profile-once`): it used to hard-reset `C:\code\dw-assemble` under the running watcher, and one browser can't open a profile in use
- after changing `C:\code\assemble-watch.ps1`: end the processes whose command line matches `assemble-watch.ps1|asm-prebuild.js`, run "DW assemble watch.vbs" from the Startup folder, and check `C:\code\dw-assemble-watch.log`
- `npm run atlas` also measures each colour-coded master on the worker (`atlasMeasureCm` in tools/atlas-measure.js): at 2048 from the painter's own `asmCmPrep`, written to `--out` as `cm-<kind>/` (11 layers) with each zone's lit level and the painter's geometry in atlas.json; nothing of it is uploaded; `--cm-size` for tests; `tests/asmatlas.test.js`

#### GPU painting
- `npm run assemble -- --gpu` paints the looks the graphics chip covers (`asmGlWhy`) on the PC's graphics card at 2880, in one extra Web Worker; the watcher passes `--gpu`, `assemble.ps1` only with `-Gpu`
- no GPU guard (2026-11-14, the owner: "remove the gpu guard completely"; `tools/gpu-guard.js` and its test are gone, and the PC's `gpu_guard.py`): the covered looks are painted one after another across the masters, with no bursts, rests, nvidia-smi watchdog, temperature, power or memory stops, and no `gpu.lock`; a master's setup runs in the GPU worker before its first look (`{setup}`), the next one as soon as the master before it is done
- CPU fallback: a failure in the GPU worker, or WebGL2 that isn't the card (the renderer must match `--gpu-match`, NVIDIA, with `MAX_TEXTURE_SIZE` >= 2880, checked once a run before any look, `{probe}`): those looks go to the CPU pool, every look is still built, and the log says per look `GPU <ms>` or `CPU[: why]`, plus a cycle total
- a picture painted on another renderer (Chromium lost the card) is logged with `!!!!! THE GRAPHICS CARD WAS LOST` and switches the GPU off until the script restarts
- the browser for `--gpu` is Chromium's new headless (`channel: 'chromium'`) with `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`, 2D canvas and rasterising on the processor (`--disable-accelerated-2d-canvas --disable-gpu-rasterization`); never a no-throttling flag such as `--disable-gpu-watchdog`
- the CPU pool's workers are `asm-worker.js?nogl=1` and their jobs say `gl:false`
- tests: `tests/asmgpu.test.js` runs the script end to end on SwiftShader (`--gpu-angle swiftshader --gpu-match SwiftShader --cm-size 512`); nothing in the tests touches the real card

### `asm-gl.js`

#### Routing
- the colour-coded painter's per-look pass on the graphics chip (WebGL2), ported with the owner's approval after the iPhone bench: about 90 ms a look on a phone chip against 0.45-1.5 s on the CPU at 2048; loaded after asm-color.js (index.html, asm-worker.js); in `ASSETS`
- `asmCmBuild` first calls `asmGlTry(job, hit)` (hit = `asmCmSetup`, shared by both painters); a covered look with working WebGL2 paints on the chip (`{url, gl:true, ms, renderer}`), else it returns null (why in `asmGlNot`) and the CPU paints
- the worker reports WebGL2 (`{ready, gl}`, `asmGlProbe`); without it (iPhone before iOS 17) `asmRun` paints a covered look on the page's WebGL2 (`asmGlOnPage`)
- a lost context: that look is painted on the CPU and the chip retried after `ASM_GL_RETRY_MS` (60 s); no WebGL2 at all is remembered for the session (`asmGlNone`)
- the switch: Settings → Outfit pictures → Advanced (owner only), "Graphics-chip painting" (`asmGlUI`, `asmGlSet`, `localStorage.asm_gl` '0' = off), passed in the job as `job.gl` by `asmCmJob`; the line under it says how the last picture was made and how long it took (`asmGlNote`)

#### Coverage
- one rule, `asmGlWhy(job, P)` ('' = covered, else the reason; `asmGlCovers`); without P it checks the job only (the page's routing)
- every master (`ASM_GL_KINDS`: suit, vest, suit-open, vest-open, shirt-tie, shirt-open) and every jacket cloth, tie, shirt and trousers the routes give are covered; only no WebGL2, a lost context, the switch off, `job.look === false`, a size over `ASM_GL_MAX` (2880, the PC pre-build's size) or no background picture go to the CPU
- a picture over `ASM_SIZE` is scaled to 2048 exactly as asmCmBuild does
- reasons that can still occur on bad input: a missing garment, tile or geometry, tiles over `ASM_GL_TILE` (4096) alone or stacked, a small-figure grid over 8x8, a herringbone with soft column edges (`ASM_HB_SOFT`, 0 today), more than `ASM_GL_CUFFS` (15) turned cuffs, a polyline over 256 points or in a creased sleeve, trousers folds that don't fit a byte, a waistcoat cloth not the jacket's (`asmGlSame`), a patterned belt

#### CPU and GL agreement
- a GL picture has the CPU picture's key ("look + code"); asm-gl.js is not in `asmCmCode`, so a GL change must keep the two within 2 levels (`tests/asmgl.test.js`)
- every random cloth detail goes through `asmH32` (`Math.imul` and `>>> 0`, which a shader's uint multiply reproduces bit for bit); the GLSL is written by `asmGlHashGlsl`
- a detail read at a cloth position goes through `asmCellV` / `asmCellT`, which fade a cell into its neighbour within `ASM_CELL_FADE` (.02 of a cell) of its edge: float64 on the CPU against float32 on the chip flipped details at hard edges (iPhone: up to 8 levels); with the fade the largest difference is 1-2
- faded reads: the twill/herringbone fleck, the linen's threads, a herringbone's grain cells, yarn breakup and floats (`ynOf` in `suitCol`), a small woven figure's thread crossing
- the sleeves pick upper arm or forearm in whole numbers on both painters (`asmTubePartQ`, lines as `uQ` uniforms); `asmTubeTabs` keeps the float `asmTubePart`, so the kept setup's key (`asmCmSrcSig`) is unchanged
- the tweed's cell `floor(i/lsc)` comes from float64 via the tables texture, since float32 could pick the next cell on the shirt masters (`pxmm` 116/174)
- a polyline segment ends exactly where the next starts, so a point beyond a bend ties and the first segment wins on both painters

#### Shader
- the outer garment (`uOut`) is the jacket on the jacket masters and the trousers on the shirt masters (folds' lighting only, as on the CPU); `uvC` is its cloth position (the shader's `uvAt`: solved piece, legs, tube, lapel, flow)
- the twill's squeezed-rib softening (`ASM_CM_AA`) is `uAA`; band tiles (`asmSuitTex`) are read at four points a pixel as `asmCmAt` does, with the stripe breakup and dark-ground shading added in the shader; a striped jacket takes neither cloth look nor lighting (`uJm.w`), like the CPU's `e.keep`
- the waistcoat is the jacket's own item (`asmCmItems`) painted with the jacket's cloth; the cloth is read once a pixel and `outer()` applies each garment's light: two whole readings made the program too big for SwiftShader (lost context), a loop over the two garments was 3x slower
- one program per kind of master (`asmGlVar`, built once per context by `asmGlUse`): SwiftShader runs every branch, and one program for all made a suit-master look about twice as slow
- ties (`asmTieFor`) and shirts (`asmCmTile`) read from tiles are bilinear, so no CPU change was needed; without `P.tieGeo` a tile tie is its colour on both painters; turned shirt parts are indexed in the lighting texture (`asmGlCuffs`, `uCu`)
- polyline sleeves (`asmPolyAt`, arms bent less than `ASM_CREASE_DEG`) are `polyAt`; the trousers' position is `asmLegsAt`; the tie clip (`asmBarDraw`) and shirt buttons (`asmCmButtons`) stay CPU passes after read-back

#### Textures
- the master is packed once (`asmGlPack`) and uploaded (`asmGlUpload`), the solved positions separately as RG16UI (`asmGlUploadGeo`)
- WebGL2 guarantees only 16 sampler units: the jacket's, tie's and shirt's tiles share one stacked texture (`asmGlAtlas`), linen and tweed share unit 14 (re-uploaded when `G.clothK` changes), a small figure's grid is a uniform array (`uWg`), the output is bound to no unit, the tables texture holds the legs, `ASM_LIN` and polyline points, and the shirt masters reuse the lighting texture's dead channels (`asmGlLegsOk` checks the fold shifts fit)
- texture memory at 2048 (`asmGlBytes`): about 197-199 MB, 229-231 MB on a waistcoat day (the waistcoat's own texture)
- on SwiftShader (software) at 2048 a look takes about 0.6-1.8 s; a real phone chip is the bench's ~90 ms

#### Tests
- `tests/asmgl.test.js`: each `LOOKS` row painted both ways at 512 in SwiftShader, max difference at most 2 and mean under 0.1; plus no WebGL2, a lost context and retry, the switch, the page's routing, the real worker's chip, and the sleeves' part rule
- rows carry `has` tags (the cloth a row must have) so a row can't quietly turn plain; `ASMGL_SIZE=2048`/`2880` paints at a phone's or the pre-build's size, `ASMGL_ONLY=<regexp>` picks rows
- the test derives stand-in vest, open and shirt masters and their solved maps in the page from the two fixtures (no real masters)
- `lab/gl-bench.html` (the iPhone bench) compares the live asm-color.js and asm-gl.js; `tests/labbench.test.js` asks for at most 2 levels

### `asm-worker.js`

- the Web Worker that paints the pictures (see `assemble.js`); in `ASSETS` in sw.js
- it loads assemble.js, asm-color.js and asm-gl.js (`importScripts`) and has its own `asmData` and `asmJpeg` on an OffscreenCanvas; its ready message says whether WebGL2 works in it (`gl`)
- `asm-worker.js?nogl=1` never touches the graphics chip (ready `gl:false`, every job painted with `gl:false`); `{setup: job}` works a master out only, `{probe: 1}` names the WebGL2 renderer and `MAX_TEXTURE_SIZE`; a CPU picture of a job that allowed the chip carries `glWhy` (`asmGlNot`)

### `sw.js`

- one version at a time: install caches every `ASSETS` file into `CACHE`, then cache-first; works offline
- why: network-first with a per-file race mixed old and new files on slow connections after a release
- add new app files to `ASSETS` and bump `CACHE`
- install fetches with `cache:'no-cache'`, so unchanged files are a 304
- a new version waits (no `skipWaiting` at install) until the next start or `{type:'skipWaiting'}` (about.js `updateNow`); `{type:'version'}` answers the version
- `cache:'no-store'` requests are left to the network; `sw.js` is in `ASSETS` so the page can read its own version
- an `ASSETS` file requested under another folder (an offline deep link) is served from the cache, or the page came up unstyled
- icons are 256-colour palette PNGs; the manifest has `id` "./" and separate `any`/`maskable` entries; one `theme_color` (#101820, the dark header in both themes)
- `tests/assets.test.js`: every `ASSETS` file exists and every needed file is listed (one missing breaks every update)
- `tests/sw.test.js`: reload stays put, a bump prompts and waits, Update switches, a waiting version runs on next open, takeover from the old network-first worker

### `worker.js`

- worker.js is the entry (the route table `ROUTES`, `serve`, `corsFor`, the handlers fetch/queue/scheduled, `export { RenderHub }`); the routes live in ES modules in `worker/` (2026-11-14): `tag.js` (POST /, /tag-many, the prompt and schema, the Workers AI fallback), `pattern.js`, `links.js` (GET /fetch), `render.js` (POST /render, the queue jobs, `RenderHub`), `items.js` (item pictures), `records.js` (GET/PUT/DELETE /render, /blob), `holidays.js`, `backup.js` (the backup's versions, parts, snapshots, syncLite), `photostore.js` (photos stored once, their clean-up, /sync), `people.js` (`whoIs`, plain errors, caps, invitations, feedback, account deletion), `remind.js` (Web Push)
- each module imports what it uses from the others by name; the modules import each other in cycles (only functions cross at load), and none imports worker.js: a constant read at load time by another module would hit the cycle's TDZ, so keep load-time tables inside their own module
- Wrangler bundles the modules on deploy (`main = "worker.js"`; checked with `npx wrangler@4.158.0 deploy --dry-run --outdir <dir>`), and the deploy workflow also runs on `worker/**`
- tests that read the worker's text (prompts, lists) take `require('./workersrc.js')()`: worker.js and every worker/ module; tests/impact.js records worker/ modules function by function like worker.js (`workerFile`, `workerFiles`) and follows a changed constant across the worker's files
- Cloudflare Worker; every endpoint needs the owner's `APP_TOKEN` or a tester's invite code (`whoIs`, worker/people.js); with `APP_TOKEN` unset every route refuses (403), the three tagging routes included (they used to run open)
- the router is the table `ROUTES` (`'<METHOD> <path>'` → `[handler(req, env, json, who, cors), what to say when APP_TOKEN is unset]`): `fetch()` resolves the caller once and hands `who` to the handler; no handler checks the token itself
- a switched-off tester may still `DELETE /account` (`whoIs` returns `offWho`, the router lets only that route through); every other route answers 403 "invite off"
- only `POST /` tags a photo: any other address not in `ROUTES` answers 404 (a `POST /holidayz` used to spend a Claude call), a known address with the wrong method 405
- `POST /` reads the token from the `x-app-token` header before reading the body; the body's `appToken` is no longer accepted (the app has sent the header since 2026-11-12); it reads at most 15 MB of body and stops there (`TAG_LIMIT`, `readCapped`) → 413
- `fetch()` wraps the router (`serve`) in a try/catch: anything a route throws (a KV write over the day's allowance, a Durable Object restarting) answers JSON 503 `{error:'server', message}` with the CORS headers (`SERVER_DOWN`), and the error goes to the log; Cloudflare's error 1101 page had no CORS headers and every call showed "Failed to fetch" until midnight UTC (2026-11-13 audit)
- `ALLOWED_ORIGIN` may be several origins separated by commas: the matching one is echoed in `Access-Control-Allow-Origin` (with `Vary: Origin`), any other origin gets 403
- CORS answers carry `Access-Control-Max-Age: 7200` (`corsFor`): a phone keeps a preflight's answer 2 hours instead of asking before nearly every call
- `scheduled()` (cron `*/15 * * * *` in wrangler.toml) runs `sendReminders` (worker/remind.js) and the daily photo clean-up (`photoGc`, worker/photostore.js)
- the `queue()` consumer makes queued photos and finishes account wipes (worker/render.js, worker/people.js); its catch acks a message in `PAID`
- a Worker may make about 50 KV calls a request on the free plan; the free plan allows 1,000 KV writes and 1,000 lists a day for everyone together, which shapes the caps and the list-free reads below

#### Deploy

- deployed automatically by `.github/workflows/deploy-worker.yml` (Wrangler, config in `wrangler.toml`) when a merge to `main` changes `worker.js`, `worker/**`, wrangler.toml or the workflow; it creates the queue if missing, so the token needs Queues edit
- it needs the repo's `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID` / `WARDROBE_KV_ID` variables; without them it prints a `::warning::` that the live worker was not updated (it was a quiet notice) and the user deploys by hand; the workflow has `permissions: contents: read`
- its test step is `npm test`: on `main` that selects nothing when the merged branch was tested (the map carries the fingerprint of `main`'s files) and every test when it was not, so a normal deploy runs no test and needs no browser
- the step "Which tests will run" (`node tests/run.js --changed --list`) decides: Chromium is installed only when the answer is not one of `tests/impact.js`'s two "nothing runs" sentences (`tests/deploy.test.js` checks they still match)
- when a browser is needed, the system packages (`npx playwright install-deps chromium`, apt) get two minutes and may fail with a warning, and the browser download is tried three times; no step uses `--with-deps`: on 2026-11-11 the runners could not resolve the Ubuntu mirrors for hours and deploys failed in apt although no test was going to run; the whole suite passes without the font packages
- the workflow installs with `npm install --no-package-lock`: a `package-lock.json` written on the runner is a new file and made the selection run everything
- is the current worker live: `DELETE /render?key=not-a-key` with the app's Origin answers 400 from a worker that has `delRender`, 405 from an older one (a key that fails `COMBO_RE` deletes nothing)

#### worker/tag.js

- photo tagging via the Claude API (secret `ANTHROPIC_API_KEY`, optional `CLAUDE_MODEL`); falls back to the Workers AI binding `AI`
- single tag (POST /): `tagSchema(custom,true)` adds confidence, `altColor`/`altPattern`, `newColor`/`newPattern` ({name, why} or null) and `clothBox`; effort medium; an optional `closeup` is sent as a second image; `measured` and `corrections` become prompt text (`measuredText`/`correctionsText`); `custom` is checked by `cleanCustom`
- `/tag-many`: several items in one photo; Claude lists every item with a confidence and a rough box in thousandths; the app crops each into its own Add card
- Claude calls are cached (`tagWithClaude`, 2026-11-13 audit; the fixed text used to come after the photos, so nothing was cached): `system` is the fixed instructions (`CLAUDE_SYSTEM` + `opts.prompt`: `TAG_INTRO` + `TAG_RULES` + `SINGLE_EXTRA` for one item, `MULTI_PROMPT`, `PATTERN_PROMPT`) with the first `cache_control`, then the owner's colours, patterns and corrections (`opts.owner`) with the second; the photos and the per-call text (`opts.text`: close-up note, light wording, measurement, the colour/pattern picker's extras, `/pattern`'s item type) come last
- Claude gets the field rules without the JSON template or "no code fences" (`TAG_RULES`, from "type —"; structured output answers); Workers AI still reads `PROMPT` whole, template included; `PROMPT`'s JSON template lists `trouserKind` and `shoeStyle`
- the light wording follows the app's optional `wb` boolean on `POST /`, `/tag-many` and `/pattern` (`lightText`, `wbOf`): `true` = the app white-balanced the photos from a white reference (take colours as shown), `false` = sent as the camera took them (judge as in neutral daylight, allowing for the light's cast), absent = the safe wording (judge as in daylight, allow for a cast only where the photo clearly has one); no other prompt text says the photos are white-balanced or how to judge colours (the old wordings contradicted)
- `cleanTag` keeps `weave.repeatsAcross` up to 80 (a cap of 12 drew a pinstripe jacket's stripes, asked for as 20–40, about 2.5x too far apart)
- each Claude call has a 3-minute limit (`CLAUDE_MS`; running out answers 504) and one retry on 429, 529, 5xx or a dropped connection, after the `retry-after` (at most `CLAUDE_RETRY_MAX` 20 s) or `CLAUDE_RETRY_MS` (2 s; `env.CLAUDE_RETRY_MS` overrides it, the tests set 0); a 4xx is not retried
- the log line of every Claude call has input, cache read, cache written and output tokens
- the Workers AI fallback is `tagWithWorkersAi`: any failure (including the licence step `AI.run(model, {prompt:'agree'})`, inside a try) answers 502 and gives the tester's tag count back
- the pattern list (`PATTERN_LIST`) must stay in sync with `PATS_BY` in core.js, and the per-type colour lists `TYPE_COLORS` / `DIAL_COLS` with `COLS_BY` / `DIAL_COLS` in core.js (`tests/colouraudit.test.js` checks it)

#### worker/pattern.js

- `/pattern`: the woven pattern as data (`PATTERN_SCHEMA`/`PATTERN_PROMPT`, effort high): `across`/`along` bands `{role, name, hex, w}` (shares of a repeat), `stripeDirection`, `repeatsInCloseup`, `repeatsAcrossItem`, `paneAspect`, `ignored`, `description`; tidied by `cleanPattern`; 422 when there is none
- motif: `layout:'motif'` with `motif {grid: straight|diagonal, ground {name,hex}, figures [{shape (MOTIF_SHAPES), placement: cell|corner|alternate-cells, colours (1, or 2 alternating), centre (square-with-dot), sizePct}]}`; `across`/`along` are null; `repeatsInCloseup`/`repeatsAcrossItem` count grid cells

#### worker/links.js

- `/fetch` downloads photo links for the app (`fetchLinked`)
- it refuses anything but a public host (`publicHost`: no IP address in any spelling, no `localhost`, no single-label or `.local` / `.internal` / `.lan` / `.home` / `.corp` name), follows redirects by hand (5 at most) checking each stop, checks the page's share image the same way, and stops reading at its caps (15 MB photo, 600 kB page)
- a link that can't be reached (dead domain, refused connection: `fetch` throws) answers 502 "That link could not be reached…"

#### worker/render.js

- `/render` POST: a realistic outfit photo via OpenAI's image edit API (`nojacket:true` uses a shirt-sleeves pose prompt); secret `OPENAI_API_KEY`, optional `OPENAI_IMAGE_MODEL` (default `gpt-image-2`) and `OPENAI_IMAGE_QUALITY`
- an outfit request or queued job may set its own `quality`, `model` (a `gpt-image-*` id) and `complexity`, to try another model under a test key, and its own `size` (`IMG_SIZES`: 1024x1024, 1536x1536, 2048x2048; anything else or nothing is 1024x1024; a queued job keeps it)
- a tester cannot choose `model`, `quality`, `complexity` or `size`: `handleRender` deletes them from the body before anything reads it, so a queued job keeps none either
- a direct outfit request (not a queued job) answers with OpenAI's token counts (`usage`); a photo's record keeps them too, so `GET /render?key=` shows what it cost
- OpenAI calls have a 5-minute limit (`OPENAI_MS`)
- `RENDER_PROMPT` (jacket pose) asks for "a silk tie if one is listed (if none is listed he wears no tie: the shirt collar is open, the top button undone)"; the shirt-sleeves prompt says "no tie unless one is listed"
- the room behind him is spelled out in `BACKDROP` (daylight from the left; far out of focus, a plain light office wall, off-white and pale grey, light but not glowing; the blurred corner of a wooden desk with a laptop at lower right; a brighter strip of daylight at the far left; nothing else: the room of the photo the owner chose as the model); a furnished office with rows of desks was too busy and too sharp, and "softly blurred bright office background" came back as blown-out windows, different every time
- `master:true` adds `MASTER_NOTE` (plain cloth, no tie bar or pocket square): the master of assembled photos
- it still accepts edit-a-kept-photo jobs from the deleted earlier assembler (`swap {what, text}` with `SWAP_PROMPT`, `swap.add` with `SWAP_ADD_PROMPT`, `SWAP_KEEP`, `mask`/`markup`, `baseKey` = a photo kept in KV); nothing sends them
- POST `{mode:'queue'}` keeps an outfit's inputs as `job:<key>` in KV and sends `{key}` (`{key, ns}` for a tester, `jobMsg`) to the Cloudflare Queue `wardrobe-renders` (binding `RENDER_QUEUE`); `queueRender` writes `jobrun:` with attempts 0
- the consumer makes the photo in the background, retrying temporary OpenAI errors and recording others as `jobfail:<key>`; a job that keeps throwing is recorded as `jobfail:` after 4 tries; `jobrun:<key>` {attempts, at} is reported as `running` by `/render-queue`
- the consumer reads the ns with `msgNs` (worker/people.js): a message without one is the owner's; one that is not `u:<id>:` is dropped untouched
- the consumer retries a message whose `job:` it can't see yet (20 s, up to 6 tries): KV can take a minute to show the job written just before the message, and acking it lost the photo, which sat "pending" for days
- `GET /render-queue` (`queueStatus`) sends nothing again and writes nothing (2026-11-13 audit: a re-send after 3 minutes made a second paid photo, and giving up after 3 re-sends deleted a job still waiting behind others); the queue delivers every message and redelivers a run that was cut off; a job no message has touched for `LOST_JOB_MS` (6 h) is reported in `failed` without deleting anything
- `/render-queue` never lists KV: the app sends `?keys=` and the worker reads each key (`jobfail:`, `jobrun:`, `job:`); polling with lists used up the free plan's 1,000 a day and every list threw (error 1101); without keys a failed list answers 503 instead of crashing, and a tester's `/render-queue` without `?keys=` answers empty
- one run per job (`jobClaim` → the person's RenderHub, `job-claim`/`job-done`/`job-release`/`job-state`, serialised by `jobQ`): a message claims its job (keyed by the photo key, with the job's `t`) before calling OpenAI; a second copy while it runs is retried after the claim's time left (`CLAIM_MS`, OpenAI's 5 minutes + 2), one for a job made or given up after it was queued is acked (`DONE_MS` 3 days); a regenerate queued after the photo was made is a new job and runs; without the hub binding (or the hub unreachable) a run goes ahead
- the consumer writes `jobrun:` only after it holds the claim (a duplicate writes nothing)
- never retried after OpenAI answered: a message whose photo was made is in `PAID`, so `queue()`'s catch acks it; `keepMade` catches a failed save (KV over its writes), still hands the photo to an open app through the hub, records `jobfail:` ("made but the server couldn't keep it") and acks; `tests/workerfix.test.js` checks one OpenAI call for a failed save, two copies at once, and a Try again while it runs
- one helper gives up a job, `failJob`: refund, `jobfail:`, delete `job:` and `jobrun:`, tell the hub, each step in its own try (four separate copies used to differ)
- a queued photo's earlier `jobfail:` is deleted only when it is there (`dropFail`: a delete of nothing still counts as a write)
- the push: the consumer hands each finished photo (or failure) to the Durable Object `RenderHub` (binding `RENDER_HUB`, `tellHub(env, ns, m)`), which answers the app's held `GET /render-wait?keys=…&ms=` (`waitForRenders`) with the photo itself (KV can lag a minute); no binding → 501 and the app only polls
- RenderHub's `recent` keeps `{key, ok}` or `{key, error}` for 10 minutes, never the photo (2048 photos for 10 minutes could near the object's 128 MB); a waiting app still gets the photo in the push, and `waitForRenders` reads a remembered one from KV (left out while KV doesn't show it yet)
- `RenderHub` is one instance per person (`hubOf(env, ns)`: `renders` for the owner, `renders:u:<id>:` for a tester), so a held `/render-wait` can only be answered with the caller's own photos
- the app (photos.js) holds `/render-wait` open while photos are queued and it is visible (`waitPush`, `PUSH_WAIT` 90 s, `takeQueued`); polling `/render-queue` is the backup on a schedule (`queueDelay`: first look 40 s after sending, then 20 s, 60 s after 5 min; `scheduleQueueCheck`, `rqGet().sentAt`)
- the app (photos.js) offers "Try again" for a photo waiting over 10 minutes (`renderStalled`, `STALL_MS`), which queues it again; the `#busy` pill doesn't count stalled photos; when the worker started a job again the app waits afresh from `running[k].at`
- the app (photos.js): a queued photo missing from `/render-queue` and not yet made counts as lost only after `LOST_MS` (45 min, from `rqGet().at[key]`): KV lists lag up to a minute, and giving up early made the push be ignored; `takeQueued` keeps any pushed photo, waited for or not
- the app (photos.js): `checkQueue` and `takeQueued` apply their changes to a fresh copy of the waiting list, so a push and a poll finishing together don't undo each other
- Today's Generate and Settings → Regenerate use the queue (`generateRender` → `queueCombo(o,replace)` in photos.js), so the app can be swiped, closed or locked; `{replace:true}` makes the worker queue and make it though a photo is kept; the button shows "Making photo…" while queued (`renderPending`), a failure shows its reason with "Try again" (`renderFail`); a worker without the queue still makes it on the page

#### worker/items.js

- `/render` POST with `mode:'item'`: a product picture of one item from a text description via OpenAI image generation, stored under the given key (`itemPhoto`), with the same 5-minute limit as outfit photos (`OPENAI_MS`)

#### worker/records.js
- `GET`/`PUT /blob` (`handleBlob`): raw bytes as `blob:<key>`, owner-only writes up to 20 MB, the same `sig` not rewritten
- photos are saved per outfit combination (`comboKey()` in photos.js: the shirt by base colour only; the jacket/tie/clip/watch by how they look; plus the vest) as `render:c<16 hex>` in KV (no expiry) and in `meta`, so a combination is never generated twice
- GET/PUT `/render?key=` share a photo between devices; `GET /render?list=1` lists every kept key (a failed list answers 503); older `render:<date>` copies are migrated on first use
- `DELETE /render?key=` removes a kept photo (one made wrong; `delRender`)
- photos under test keys (`c7e57…`) expire from KV after 7 days (`renderTtl`)
- not done: `GET /render?list=1` is still one KV list per app start per person (a read cannot replace it without an index document that costs a write per photo)

#### worker/holidays.js

- `/holidays?country=XX`: public holidays from Google's public holiday calendars, for countries Nager.Date lacks (the app asks Nager.Date itself first)

#### worker/backup.js

- `/sync`: KV binding `WARDROBE`; the backup's `{rev, saved}` is kept as the KV key's metadata, so `?v=` and the PUT conflict check don't load the backup
- `kvMeta(env, key)` reads a key's metadata with `getWithMetadata(key, {type:'stream'})` and never reads the value, so `syncVersion` (every sync) and `keepSnapshots` (every save) don't list KV; a KV without `getWithMetadata` (the test mocks) lists
- `GET /sync?lite=1&since=` (`syncLiteGet`) reads only the small value; `GET /sync?ph=` (`syncPhotos`) returns photos; `POST /sync` (`syncLitePost`) merges the delta by the app's rules (`mergeLite` = core.js `mergeState`), keeps the daily copies (`keepSnapshots`) and writes once; nothing new → nothing written; an older worker answers POST 405, and the app only POSTs after a `lite:1` answer
- `/sync` takes backups up to 48 MiB (`BACKUP_MAX`); KV holds 25 MiB a value, so one over 20 MiB (`PART_MAX`) is kept in parts: the first under the key, with `parts:n` in its metadata, the rest as `<key>~<rev>~<i>`, written before the key; reads (`storedResponse`, `partedStream`) stream them back part by part, daily copies copy them (`copyStored`), a new version deletes the old version's parts (`dropParts`), "Delete everything" takes `wardrobe:v1~…` too
- a PUT over 20 MiB is never parsed whole (`putParted`, `BIG_HEAD`): sync.js sends `data` last so the worker reads `baseRev`, `day` and `reason` from the first bytes; an older app (data first) is answered 413 "update the app"; `tests/snapshots.test.js` checks 30, 46 and 51 MB backups
- a backup stored inline (the whole data, or with #284's index `{"rev","saved","index","data"}`, read by `readHead`/`loadSync`) is still read and is converted to the photos-stored-once form at its next save (worker/photostore.js); an older app's `PUT /sync` has its photos hashed out by `splitPhotos`
- a tester's backups: 30 a day (`EXTRA_CAPS.backup`; 300 for all testers together), counted on each save and given back on a conflict; over it, 429 `{what:'backup'}` "Today’s 30 backups are used up. Your changes are kept on this phone and backed up tomorrow."
- a backup whose new photos pass the day's writes stores the photos that fit and is refused 429 `{what:'backup', write:true}` ("…N of M new photos are saved…", `writeBudget`), so sync.js pauses until the next UTC day; the stored photos are skipped next time (`phThere`), and the save finishes then

#### worker/photostore.js

- photos stored once (2026-11-13): each photo is its own KV value `<ns>ph:<hash>` (the hash `phHash`; the value the photo's JSON string; metadata `{t}` = when written), and the backup is `{"rev","saved","pv":1,"revs","data"}` with every photo in `data` as `dwph:<hash>`, metadata `{rev, saved, pv:1}` (`pvText`, `pvMeta`, `isPv`); the owner's is about 137 KB
- a save (`syncLitePost`, an older app's `PUT` → `putWhole`) writes only the photos not stored yet (`putPhotos`: a photo is written again only when the clean-up has it in view, `ph:gc`'s `cand`/`gone`) and then the small value; photos first, so a failed photo write never leaves a backup pointing at nothing
- the daily and monthly copies (`keepSnapshots`) copy the small value with `pv:1`, so they share the photos
- the old form is rebuilt on request (`pvResponse`, streamed 8 photos at a time, `{rev, saved, data}` only): an older app's `GET /sync` and its 409, `?snap=` (Roll back), and `putParted`'s 409; `storedResponse` sends any `pv` value that way
- `?ph=` reads each photo from its own key; `?lite=1` reads the small value (`loadAny` = `loadSync` for a backup still stored inline)
- conversion: a backup stored inline is converted at its next save: all its photos are stored, its daily copy is written in the small form (`storePhotos` gives `keepSnapshots` the old version by reference), then the new version; nothing is converted on a save that changes nothing
- a PUT over 20 MiB has its photos cut out of the bytes unparsed (`scanPhotos`: a `"data:` string of `PH_MIN`+ characters with no escapes, hashed over its bytes) and is saved like any other; if what is left is still over 20 MiB (or a single photo is), it is kept in parts
- the daily clean-up (`photoGc`, from `scheduled()` in the quarter-hour at 23:00 UTC, `gcDue`; the owner and every tester in `invites:index`): a photo is deleted only when neither the backup nor any kept copy refers to it (`refsInUse` reads every `pv` value; an inline copy refers to nothing; an incomplete list deletes nothing), it was seen so at two runs a day apart (`ph:gc` `{cand: {hash: first seen}, gone}`), and its own `t` is over a day old (`GC_AGE`); it reads each photo again before deleting, holds the bytes, reads the backups once more after and puts back any now referred to; at most `GC_MAX` (200) a run
- it also converts kept copies stored inline, `GC_SNAPS` (2) a run, monthly ones first, keeping their expiry, once the backup itself is converted (`convertSnaps`)
- measured on a copy of the owner's backup (98 items, 191 photos, 16.74 MB): a later save of the day 16.89 MB written → 136 KB; a day's first save (backup + daily copy) 33.8 MB → 273 KB; 42 copies at steady state about 726 MB → 22 MB (the photos 16.5 MB once); the converting save writes 191 photos + 3 values (194 KV writes, once); an older app's GET still gets the identical 16.74 MB; the clean-up with 42 copies about 2 ms
- don't roll the worker back past this change without converting the backups back: an earlier worker would hand `dwph:` references to apps as photos (nothing is lost, the photos stay in `ph:`)
- `tests/photostore.test.js`: saves and dedupe, copies and Roll back, an older app's GET, PUT, 409 and a 25 MB PUT, conversion from inline and from #284's index, the clean-up (never a referenced photo, also one only an old copy refers to; two runs; a save meanwhile; a race put back; inline copies converted), account deletion

#### worker/people.js

- `whoIs(env, token)` is the one place that says who is calling, from the `x-app-token` header: the owner when the token's SHA-256 equals `APP_TOKEN`'s (`sha256Hex`, `sameText`; never `!==`) → `{id:'owner', role:'owner', ns:'', caps:null}`; a tester when KV has `invite:<sha256 hex of the code>` = `{id, name, caps, created, off}` → `{id, name, role:'tester', ns:'u:<id>:', caps, hash}`; `off` → 403 `{error:'invite off', message}`
- storage per person: every KV key of a person's data starts with `who.ns`: the backup (`<ns>wardrobe:v1`), `<ns>snap:*`, `<ns>render:*`, `<ns>job:*`, `<ns>jobfail:*`, `<ns>jobrun:*`, `<ns>ph:*`; the owner's ns is the empty string, so the owner's key names are byte for byte what they were (`tests/accounts.test.js` asserts the exact names)
- keys that belong to nobody's namespace: `invite:<hash>`, `invites:index` (the list of invitations, so `GET /invites` reads one document instead of listing KV), `feedback:log`, and `use:<id>:<day>` (the count, only without the Durable Object)
- `GET /render?list=1`, `/render-queue`, `/render-wait`, `/sync?snaps=1`, `?snap=` and roll back see only the caller's keys
- daily caps, testers only (`DEFAULT_CAPS` `{tag:40, pattern:10, photo:12, item:20}` per UTC day, `utcDay`; an invitation's own `caps` override them, `cleanCaps`): tag = `POST /` and `/tag-many`, pattern = `/pattern`, photo = outfit photos (direct, queued, `replace`), item = item pictures and one-piece edits (`photoCap`: a body with `swap`)
- a tester's first 7 days after the invitation was made (`FIRST_WEEK_MS`): every daily limit twice (`FIRST_WEEK_X`, in `whoIs`); `/me` gives `firstUntil`, and Connection says until when
- more caps the app does not show protect KV's daily writes (`EXTRA_CAPS`): 60 photo uploads (`PUT /render`), 20 feedback messages, 30 backups, 20 reminder changes (`push`) a day per tester
- every KV write a tester causes is counted (`write` in `EXTRA_CAPS`: 200 a day, 400 in the first week; `ALL_CAPS.write` 450 for all testers together, so the owner always has over half of the free plan's 1,000): each new `ph:` photo a backup stores and the backup itself (`writeBudget` → `putPhotos`' `allow`), its daily copies (`keepSnapshots` returns its writes, `countWrites`, never refused), `PUT /render`, `DELETE /render`, feedback, reminder changes, a direct photo (1) and a queued one (`JOB_WRITES` 5); `spendEach` takes several counts for one call or none, `spendUpTo` as many as are left
- KV lists are counted too (`list`: 30 a day per tester, 60 the first week, 150 for all testers): `GET /render?list=1` and `/sync?snaps=1`
- all testers together have a daily total (`ALL_CAPS`: tag 150, pattern 40, photo 40, item 60, upload 300, feedback 100; the `TESTER_DAILY_TOTAL` variable, JSON, changes any), counted like one more tester under the id `all` (hub `renders:u:all:`, or KV `use:all:<day>`) after the tester's own cap; over it the call is refused in plain words (`all:true`) and the tester's own count goes back; the owner is never counted; set budget limits on the OpenAI and Anthropic accounts as well: this only bounds what testers can spend
- over a cap: 429 `{error:'limit', what, cap, used, message, detail}`, the message a plain sentence ("Today’s limit of 12 outfit photos is used up. It starts again at midnight UTC.", `CAP_WORDS`); `detail` repeats it because the app's tagging errors show `detail`
- `spend(env, who, what)` counts before the AI call and answers null or `{status, body}`; `unspend` gives the count back when the call fails; a queued job remembers `cap` and `capDay` and `refundJob` gives it back when the consumer gives up or the photo was already there; `unspend` and `refundJob` give back both the tester's and the `all` count
- the counting is in the tester's `RenderHub` (`POST /use {what, n, cap, day}` → `{ok, used}`, kept in the object's storage as `use` = `{day, n:{…}}`; `GET /used?day=`): no KV write per AI call; without the `RENDER_HUB` binding `useCount` falls back to KV `use:<id>:<day>` with a 3-day TTL
- a tester's answers are in plain words (`plainFor` in the router's `json`, `viewer` = who asked): an `error`, `detail` or `message` that names an API, a provider, a secret, a binding, the worker, KV, billing or a dashboard (`TECH_RE`) becomes a plain sentence chosen by the route (`PLAIN`: photo, tag, pattern, sync, other; `error` becomes `server`), and the original goes to the worker's log; sentences already written for people (limits, sizes) are left alone; a tester's failed queued photo is pushed in plain words too (`failFor`); the owner sees everything
- invitations, owner only (`handleInvites`): `POST /invites {name, caps?}` → `{id, code, name}`, the code 32 URL-safe characters from 24 random bytes, shown once, only its hash stored; `GET /invites` → `{invites:[{id, name, caps, created, off, used}], day}`; `DELETE /invites?id=` switches one off (`MAX_INVITES` 30 active)
- switching off: the tester's hub is told first (`POST /off`), so capped calls stop at once (`spend` answers 403); the `invite:` record is rewritten with `off:true`, which every other route sees as soon as KV shows it (up to a minute in another location)
- `DELETE /invites?id=&purge=1` (owner): switches the invitation off, deletes everything under `u:<id>:` (the queue finishes a large one), their feedback and today's count, and takes them off the list; the code stays refused ("switched off")
- `GET /me` → `{id, name, role, caps, used, day}` (`handleMe`, `usedOf`; the owner: `caps` null and `used` all 0)
- `POST /feedback {text, version, where}` → `{ok:true}` (text 1–4,000 characters); `GET /feedback` (owner) → `{items:[{t, name, text, version, where}]}` newest first; one document `feedback:log`, messages older than 180 days dropped on every write and read, 500 at most, the key itself expiring 180 days after the last message
- `DELETE /account {confirm:'delete'}` → `{ok:true}` deletes only the caller's: a tester's `u:<id>:*` keys (their `ph:` photos included), their `invite:` record and line in `invites:index` (the code stops working), their feedback, their hub's storage and their push subscriptions (`dropPush`); the owner's own families only (`OWNER_FAMILIES`: the backup, `snap:`, `render:`, `job:`, `jobfail:`, `jobrun:`, `ph:`), never `u:*`, `invite:*`, `invites:index` or `feedback:log`
- `wipeSome(env, ns, budget)` deletes a part (30 KV calls in the request) and the queue finishes the rest a part per message (`{wipe:'owner'|'u:<id>:', n}`, `runWipe`); without the queue the answer carries `more:true` and the same call deletes the next part
- KV budget with testers, for the record: a queued photo is about 6 KV writes (job, jobrun twice, the photo, two deletes); moving the job records into the Durable Object would be the next step
- `tests/accounts.test.js`: the owner and two testers against one mocked KV, queue and a Durable Object per name: isolation of sync, snapshots, photos, lists, queue and push; the owner's exact key names; caps (429, clear the next day by moving `Date.now`, refunds, KV fallback); invitations, revoking, `/me`, feedback, account deletion; the hardening; and the app (invitation link, Connection page, limit messages)
- the owner's path is covered by the existing suites `queue`, `todayqueue`, `sync`, `snapshots`, `render`, `render-sync`, `prefetch`, `paste`, `tagging`, `multi`

#### worker/remind.js

- the morning reminder: `GET /push?endpoint=` → `{key, on, time}` (key null while the server has no VAPID keys), `POST /push {endpoint, time, tz, dates}` switches a phone on or updates it, `{endpoint, off:true}` off; one KV document `push:subs` (`PUSH_MAX` 200); a tester's changes are counted (`push`, 20 a day)
- `POST /push` changes or switches off only the caller's own subscription (`mine`: same push address and `x.ns === who.ns`); knowing another account's push address is not enough
- `sendReminders` (from `scheduled()`): each phone whose time, in its own time zone (`localNow`), falls in the run's window, on a date the app gave, once a day (`last`), gets a push with no body signed with the VAPID keys (`vapidAuth`: an ES256 JWT, `aud` the push service's origin); 404/410 drops the subscription
- the window (`dueDay`): a run covers the local clock from the run 15 minutes before to now, so a reminder at 23:46–23:59 fires at the 23:45–00:00 run (for the day before; a window `[at, at+15)` ran past midnight and never fired), one in the hour the clocks skip fires at the run that jumps over it, and the repeated hour sends it once (`last`); `tests/workerfix.test.js`
- secrets `VAPID_PUBLIC_KEY` (base64url of the 65-byte public point), `VAPID_PRIVATE_KEY` (base64url of the 32-byte private scalar) and the variable `VAPID_SUBJECT` (the app's https address); `tests/remind.test.js`

### `README.md`

- covers what the app is, joining by invite link, privacy, hosting (GitHub Pages + the Cloudflare Worker), running the tests

## Testing

`npm run test:all` (or `node tests/run.js`) serves the repo, drives it in headless Chromium and checks rendering, swipe/layout on phone and iPhone Duo viewports, the planner against an independent rule checklist, belts/leather/metals, the outfit score, photo-less adding, pattern detection, and the worker with mocked bindings. Add a check for every behaviour you change; extra suites can go in `tests/*.test.js`.

#### Running tests

- `npm test` = `node tests/run.js --changed` (only the tests a change can affect); `--changed --list` only says what would run; `npm run test:all` runs everything
- `NO_IMPACT=1` turns the recording off; `TEST_BASE=<commit>` compares with another commit
- docs-only changes (`*.md`) need no `npm test`: they are not part of the fingerprint; README.md is not read by any test
- Safari's engine: `npm run test:webkit` (`node tests/run.js --webkit`, or `TEST_BROWSER=webkit`) runs every test on Playwright's WebKit instead of Chromium, with no map and no selection; the owner uses only Safari on an iPhone, so run it after changes to touch, focus, storage or layout
- WebKit is not preinstalled: `node /opt/node-tools/node_modules/playwright/cli.js install webkit` then `… install-deps webkit` (apt); a cloud container loses it when it is reclaimed
- `tests/webkit.js` stands in for what only Chromium has: CORS-free mocks (headers added, preflights answered), CDP touches (synthetic touch events, a tap also clicks, no native scrolling), and service workers blocked (with one in control Playwright's WebKit stops routing POST/PUT to the mocks)
- expected WebKit harness failures: native scrolling under a swipe (`shopswipe`, `wardrobetap`), `sw.test.js`, and "access control checks" from fake hosts asked from a Web Worker or sw.js; the first run (2026-11-12) found one real bug, in `wardrobe.test` (a shared save timer, `wardTypeT`, drops a text field's edit when the sheet is redrawn before its `change` fires)
- WebKit's Linux build is not iOS Safari: no safe areas, URL-bar resizing, momentum scrolling, ITP or 7-day storage eviction; the phone stays the last check for those
- ESLint 10 (`npm run lint`, `eslint.config.mjs`, `tests/lint.js`): `no-undef`, `no-redeclare` (errors) and `no-unused-vars` (a warning); each classic script is given the top-level names of the scripts it shares a scope with (index.html's scripts; each Web Worker and what it `importScripts`), read from their sources when the config loads, plus names put on `window` from inside functions and by the tests
- the pre-push hook runs ESLint on the scripts the branch changed (`--changed`, as committed, about 1 s) and refuses the push on an error; warnings show only on lines the branch touched; with ESLint not installed it says so and passes
- `npm run gaps` (`tests/gaps.js`): the top-level functions and `styles.css` rules no test reaches, from the committed map

#### Parallel runner

- `tests/run.js` gives every `tests/*.test.js` file one shared Chromium (a file's `chromium.launch()`/`close()` open and close only its own contexts) and prints the slowest files at the end
- tests run several at a time: `tests/run.js` starts worker processes (`node tests/run.js --worker`; `together`, `worker`), one fewer than the processor cores, at most 16; `TEST_JOBS=<n>` sets the number, and `TEST_JOBS=1` runs them one after another in one process, printing as it goes
- why one fewer than the cores: at as many as the cores, once the suite passed 2,000 checks, a different start-up step failed each run (a 30 s page load, a click), on `main` too: the machine starving rather than a test; why at most 16: on the owner's 16-core / 32-thread PC 16 at a time took 27 s and 28 took 26–52 s with a test failing under load
- each worker process has its own local server, Chromium, recorder and Node coverage (`bench`) and runs one test at a time, so two tests never share any of them; the built-in suites of `run.js` are handed out like the files
- a test's lines are kept in its worker and printed together when it finishes (`• name`, then its checks); the parent adds up the counts and what each test used, and writes `tests/impact.map` once at the end
- the slowest tests start first, by the times of the last run (`node_modules/.cache/dw-test-times.json`, never committed)
- a worker process that dies fails the test it was running, and another takes its place
- a promise that fails with nothing waiting for it fails the test it happened in, with its stack (`unhandledRejection` in run.js's worker process); one that fails after its test ended is reported with the name of the test before it

#### Timing and flaky tests

- after a tap, tests wait with `settle(page, ms)` (passed to every test file) instead of a fixed `waitForTimeout`: it returns once no animation runs and the scroll is still, waiting up to 2×`ms` (`DEBUG_SETTLE=1` logs each wait)
- a test that fails while others are running is run once more by itself after the rest (`RETRY_MAX` 5 such tests at most; more than that is not the load); only that run counts, and the summary names it ("failed with other tests running, passed by itself") and ends with "N flaky (passed on retry)"
- when the summary names a test that way, make its check wait for its condition: a test must not rely on a quiet machine (`settle`, `waitForFunction` on the condition the next check reads, a short polling loop, not a fixed time)
- fixed sleeps left in tests are only part of a gesture (a long press, the pace of touch moves, a double tap's gap) or wait to see that something does not happen
- a test that sets `items` or `dayRecs` in memory with a mocked worker that can sync (its `env` has `WARDROBE`) makes the mock answer no `/sync` (`pathname==='/sync'` → 503, as in `itempics` and `queue`), unless it tests syncing: the start-up sync (300 ms after the database opens) merges in what is saved and empties them on a busy machine
- set the worker for a page with `addInitScript` before the one page load, not on a first page followed by a reload: the first page's delayed start-up work can run before the reload (`prefetch` counted a photo downloaded twice)
- `window.appReady` is set once the kept photos are loaded (`loadRenders`, which starts `renders` afresh) and every script has run (`afterDom`, DOMContentLoaded, not the load event, which also waits for pictures): tests put photos into `renders` right after it, and read notes later scripts show
- a test that depends on today's date fixes the clock (`watchmatch` failed on the 12th of every month: the date watch's window read as a 12 numeral)
- touch gestures take their speed from `e.timeStamp`, not `Date.now()` when handled (the shop sheet's swipe); `tests/shopswipe.test.js` gives every CDP touch its own `timestamp`, so its gestures have the same speed however busy the machine is

#### The impact map and selection

- while a test runs, the runner records in `tests/impact.map` every top-level function it runs (the app's scripts in the page over CDP coverage, worker.js and its worker/ modules in Node), every `styles.css` rule that applied to an element, the files its pages were served (`<loaded>`) and the files it read itself or ran in a Web Worker (`<any>`)
- the recorder loads the worker in Node before any test (`prepare`) and gives what ran then to every test that runs any of it: Node loads a module once per process, so its load-time code was otherwise noted for the first test that imported it only
- a test that starts a Node child process (`spawnSync(process.execPath, [tools/…])`) is recorded too: the recorder patches `child_process` (`spawn`, `spawnSync`, `execFile`, `execFileSync`, `fork`), notes a repo file in a subfolder named on the command line, and gives a Node child `tests/childrec.js` (`NODE_OPTIONS=--require`), which writes the repo files it reads when it exits; files in subfolders (`tools/*.js`, fixtures) go into the map as `<any>`; root-level files a tool serves to its own headless page are left out (the test's own pages record those function by function)
- Chromium answers no coverage request while a page load is pending and drops the old document's coverage, so the recorder reads it just before `goto`/`reload` and before a page or context closes (`recorder`); a test that navigates another way would lose what it ran before
- maps from parallel and one-after-another runs differ only in functions a timer fires (the scheduled sync, `prefetchRenders`, `lockUpcoming`); the map only adds up, so that only selects more
- the map adds up: what a test used is added to what it used before, names and tests that no longer exist are dropped (`save`)
- for a change, `git diff` against `origin/main` (committed, uncommitted and new files) is turned into the edited top-level functions and CSS rules (`jsImpact`, `cssImpact`); a test runs when it uses one of them, reads the file, was edited itself or is not in the map yet; comments and spacing select nothing
- a changed top-level constant is followed by name to the functions and constants that name it, in the scripts that share its scope (`follow`; across all the worker's files for the worker), and to the test files that name it
- a test file can leave a name out of the constant name matching with `module.exports.ignoreNames=['CACHE']` (`namedBy` in impact.js): `impact.test.js` does, since its `CACHE` lines are a made-up sw.js and the `CACHE` bump every app change needs ran that slowest test every time
- what can't be narrowed selects every test that loads the file: other top-level code, `index.html`, a new selector that no plain rule covers, an `@media` condition, a script V8 can't parse
- a top-level block called on the spot (`(()=>{…})()`) runs at load in every test, so its own functions (the listeners it installs) are recorded and selected as units, named `<block>>name` (`units`, `kids`, `flat`; `scan` lists them by compiling the block's body inside a function that does nothing)
- the block's own name (`@{<its first statement>}`) stands for its load-time code: an edit there, a listener added to it, or a whole block added or removed still selects every test that loads the file (what runs at load can reach any test, and a new block has no record to select by)
- a listener in a block is named after the code before it (`@el.addEventListenertouchmove`); two alike in one file share a name, which only selects more
- a selector new to the sheet (a rule added or its selector changed, inside `@media` or not) can only apply where its last compound matches: when an old unconditional rule's plain selector (one compound of a tag, classes and ids) asks for no more than that compound (`.head` for `.sheet .head::before`, `.card` for `.card.on`), only the tests that used that old rule are selected (`within` in `cssImpact`); with no such plain rule (`.card .dot b`, a class only styled inside `@media`), every test that loads the sheet
- a class inside `:not(…)` doesn't make a rule "for a new class" (`.card:not(.fresh)` styles the old cards); `selNeeds` reads only what an element must have, outside brackets
- a whole `@media` block added or removed counts as its rules; an edited condition is the stylesheet as a whole
- a changed `@keyframes` block selects only the tests that used a rule naming it (`animation` or `animation-name`, in the old or the new sheet; `kf` in `cssScan`): a new animation that no old rule names selects nothing by itself; any other at-rule (`@font-face`, an `@media` condition) is the stylesheet as a whole
- after `main` was merged in, `select` looks for the newest commit of the branch from before that merge whose fingerprint is in the map (`lastPass`): a test can only have turned if both the incoming change (`impactOf` from that commit) and the branch's own (`impactOf` from `origin/main`) can affect it, so the tests both select run; with a file changed on both sides (docs and the map aside), or when the incoming change selects everything, the branch's whole selection runs
- `tests/run.js`, `tests/impact.js`, `tests/fixedplan.js`, `tests/childrec.js` and `package.json` select everything (`FULL`); so does a missing map or a missing `origin/main`
- a change to a file the browser gets also runs the built-in suite "renders the outfit without errors"; `sw.js` is otherwise covered only by `tests/sw.test.js`, since service-worker code isn't recorded
- `npm test` fetches `origin/main` before comparing (`baseOf`): a cloud session's own copy can be months old with its history cut short, and then everything would run
- the fingerprint: a passing `npm test` (or whole suite; not a run by name) writes `# tested <hash>` into the map, a hash of every file's content but the map, `*.md` and `LICENSE` (`fingerprint`, the same for a folder and for the commit made from it)
- `select` trusts the map only when `origin/main`'s copy carries the fingerprint of `origin/main`'s own files; otherwise it says so and runs everything, which records and stamps anew (a map left out of a commit, an edit after the last test run, two changes merged on GitHub without a run on the result, an edit made on github.com)
- the push check is `.githooks/pre-push` (`node tests/impact.js pre-push`, `prePush`): it refuses an uncommitted map and prints a note when the commit's files were not passed by `npm test` (a note only); every test run switches it on in the clone (`installHook`: `git config core.hooksPath .githooks`, unless hooks are already set up otherwise)
- `tests/impact.test.js` checks the selection

#### Fixed plan and assembled pictures off

- the fixed plan (`tests/fixedplan.js`): `tests/run.js` puts it into every page of a test file (an init script on each context, `track` in `file()`) unless the file ends with `module.exports.realPlanner=true`; the page then has `window.TEST_PLAN`, and the app's seams take their outfits and score from it without calling the planner: `planMonth` (today.js), `scoreCard`, `adviceFor` and `checkPlanRules` (history.js; it only calls `planRulesCheck`, the one that reads `PLAN_RULES`, without it)
- its outfits: each workday's pieces taken in turn from the pieces in rotation (sorted by id, picked by the day number), with a day's record honoured as the planner honours it (frozen past days from `ids`, `force`, `skip`, `lock`, `kind`, a casual day with no jacket or tie, the day's `vest`); the score is always 94 with four checks, so the score card still opens and folds
- why: the planner ran at start-up in every page test, so an edit to `outfit()` or `planSim`, or a `PLAN_RULES` bump, selected 101 of 103 tests; with the fixed plan (2026-11-12) `outfit()` or `planSim` 101 → 30, `rateOutfit` 67 → 29, `scoreAdvice` 58 → 16, `tieScore` 70 → 35, a `PLAN_RULES` bump 101 → 25
- `realPlanner` files check what the planner chose (e.g. `dress`, `occasions`, `weather`, `scorefix`, `replan`, `picker`, `weeklock`, `stats`); a test that calls the planner itself (`outfit`, `buildPlan`, `planWith`, `rateOutfit`) still runs it and is still selected by planner edits
- a new test gets the fixed plan by default: if it checks which outfit, score or advice the planner gives, it needs `module.exports.realPlanner=true` (it will usually fail without it, since the fixed outfits are plain)
- the built-in suites in `run.js` get the fixed plan too, except `REAL_SUITES`: the two planner checklists, the outfit score and "renders the outfit without errors", which keeps the real planner so a planner change that breaks start-up is still caught
- a change to `tests/fixedplan.js` selects every test (`FULL`): it is put into pages, not served, so nothing records it
- assembled pictures are switched off in tests the same way: `tests/run.js` puts `window.ASM_TEST_OFF=true` into every test page (`ASM_OFF`, also the built-in suites) unless the file ends with `module.exports.assembled=true` (`assemble`, `asmahead`); assemble.js starts with `ASM_ON=!self.ASM_TEST_OFF`, and the app calls into assemble.js only through `asmLive()` (photos.js), so a test with them off runs none of it (`asmSync`, `asmLoad`, `asmKey` used to run at start-up in every test and an edit to one selected 104 of 106; now 6–7)
- `self`, not `window`: asm-worker.js loads assemble.js with `importScripts`, where there is no `window` (`asmahead` caught the Web Worker stopping)
- Settings still calls `renderAsmUI` (it hides the Outfit pictures group while assembled pictures are off) and asks the worker only through `asmLive()`
- in the map, a test's entries for each file it ran with switched off are replaced, not added to: `fixedOf(test)` in run.js returns the files (`planner.js` with the fixed plan, `assemble.js` with assembled pictures off) and `save` drops them before adding (`true` means `['planner.js']`); otherwise old entries (or a branch's older map merged in by `merge=union`) would select such a test for every planner change for good

#### Writing tests

- old worker versions that tests sync against (`deltasync`, `photostore`) are fixtures (`tests/fixtures/old-worker/worker-<commit>.js`), not `git show`: in a shallow clone those checks skipped themselves silently
- tests that read the worker's text take `require('./workersrc.js')()` (worker.js and every worker/ module)

#### On Windows

- the suite runs on Windows too (the owner's PC, `C:\code\DailyWardrobe`, 16 cores: 2169 checks in 42 s, 8 at a time)
- `.gitattributes` checks every text file out with LF (`* text=auto eol=lf`), since Git for Windows defaults to `core.autocrlf=true` and CRLF broke source checks that look for `\n`
- a test that makes its own git repo turns `core.autocrlf` off in it (`impact.test.js`): that repo has no `.gitattributes`, and a merge there wrote CRLF on Windows
- on Windows, read a file's executable bit from git (`git ls-files -s`: `100755`), not `fs.statSync`, which shows none there
- on Windows PowerShell, `npm` and `npx` may be blocked by the script policy: `npm.cmd` / `npx.cmd` work; install with `npm.cmd install --no-package-lock`

### Writing a change the selector can narrow

- check before running: `node tests/run.js --changed --list` says what changed and which tests it selects; "top-level code" or "the stylesheet as a whole" in that line means the change can be restructured
- new behaviour goes inside a function that is called from where it is used, not in a block that runs when the script loads: `shopSwipe()` is called from `openShop()`, so only tests that open the sheet run it
- a listener is installed by such a function the first time it is needed (a flag like `shopSwipeOn` keeps it to once), not by a top-level `(()=>{…})()` or `document.addEventListener(…)`
- don't add the call to a function that every test runs (`show()`, `renderToday()`, `closeShop()`): an edit there selects everything; call it from the narrowest function that needs it
- a new top-level `const`/`let` is fine: it is followed by name to the functions that use it
- a new constant gets its own `const` line, never appended to an existing `const A=1,B=2;`: the selector takes one statement as one change, so every name on that line counts as changed (in assemble.js a constant appended to the `ASM_VER` line selected 90 of 92, on its own line 2)
- a few tuning sets that are only read together share a line (the herringbone's `ASM_HB_*`), where an edit to one counts as an edit to all of them
- a new visual element gets its own class name (`.shop-grab`), not a new selector built from existing classes or a `::before` on an existing element: a rule for a class the app never had selects no existing test
- state for an existing element also gets a new class (`.x.new-state`) rather than new declarations in its base rule: a rule that applies on every page (`#shop-sheet`, `body`, `.card`) selects every page test when its declarations change, and rightly so
- measured on the swipe-down change: as a load-time block with `.shop-top-head::before` it selected 89 of 91; as `shopSwipe()` from `openShop()` with `.shop-grab` it selects 5; an edit inside the item sheet's `touchmove` listener went 89 → 5, a new `.ivhead::after` rule 89 → 17
