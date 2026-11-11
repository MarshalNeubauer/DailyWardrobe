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
- **No GitHub test run.** GitHub doesn't run the tests on pull requests (the user dropped it to save the wait). Your own full `npm test` on the final branch is the only gate: merge right after it passes, without waiting on GitHub checks or subscribing to the PR.
- Never tell the user to download a backup file before a change: the worker keeps daily backups and Settings → Roll back undoes a bad change (see `sync.js`).
- **Run only what you need while working.** `node tests/run.js <name>` (or `TEST_ONLY=<name>`) runs just the `tests/*.test.js` files whose name contains `<name>`. Run the full suite (`npm test`, about 2 min) once before pushing, and once more only if `main` had to be merged in.
- **CLAUDE.md: one fact per line.** Add a new bullet under the file's heading instead of extending an existing one, so sessions working in parallel don't edit the same line and conflict.

## Project

Static app served from `main` by GitHub Pages (no build step). Classic scripts loaded in order, sharing one global scope:

### `index.html`

- markup and script tags

### `styles.css`

- styles
- design system for every page but Today (scoped to `#wardrobe`, `#add`, `#stats`, `#settings-modal`; Today keeps its own tuned styles): page header `.phead` (22px title, `.pcount`, `.pback`), buttons and inputs 44px (`--ctl-h`/`--in-h`), radius 12px on controls and 14px on cards, bordered cards, `.pri` filled, `.danger` red outline; the base button rule uses `:where()` so page rules override it; `tests/uipages.test.js` checks sizes, titles and no sideways scroll at 320/466/626px

### `core.js`

- colours, types, item helpers (no DOM; also loaded by background workers)
- `isWorkday(d)` = a weekday in `settings.workdays` that is not a day off (`offName(d)`: a public holiday in `settings.holidays` `{country, list:[{d,n}], skip}` that is not skipped, or one of the user's own `settings.daysOff` `[{d,n}]`; dates as `YYYY-MM-DD`, `isoKey`)
- The planner skips days off like weekends
- `inRotation(i)`: false for an item the user took out of rotation (`item.paused`, synced with the item); it stays in the wardrobe and in past outfits
- bought, on the way: `item.order` with `item.paused`, optionally `item.arrives` (YYYY-MM-DD); `inRotation(i, n)` is true for day number `n` (`di`) after the arrival date (`arriveN`), so the plan includes it from then on
- `item.shade` (−6…+6 steps of `SHADE_STEP` 4 L*, `shadeHex`/`shadeFor`/`shadeName`): the owner's darker/lighter for the drawn main colour (`colOf`); the tag, the planner (`planCol`, `lumOf`) and photo keys keep the tagged colour; set on the Add card and in the editor (`shadeRow`, `stepShadeQ`/`matchShadeQ`, `stepShadeE`/`matchShadeE`), "Match close-up" from the close-up's measured lightness

### `planner.js`

- outfit rules, `outfit()` / `buildPlan()`, `rateOutfit()` (no DOM)
- Jackets rotate by rest and avoid the previous workdays' colour group (`jacketGroup`, `colourRepeat`)
- Shirts and ties do the same (`shirtRepeat`, `tieRepeat`; white and light blue shirts only mildly; dark shirts count as one look and black/charcoal/grey/silver ties as one, `shirtLook`/`tieLook`)
- the same jacket colour group with the same shirt look and tie look as either of the last two workdays is a whole-look repeat (`lookRepeat`)
- each jacket remembers its last two outfits so its tie and shirt colour vary (`comboRepeat`)
- a jacket pinned to one of the next 3 workdays is held back before its day
- the next fixed day's colour is avoided, and the suit before a blazer day avoids the colour of the blazer that is due (`fixedAhead`)
- odd trousers rotate on a long rest (`ptRest`, up to 60 days, since blazer days are weekly) and shoes avoid yesterday's pair when another suits
- steel blue is a mid-tone shirt, not a `darkShirt` (cutoff 95)
- what the user's changes taught it (`settings.learn`: votes on item pairings `p` and items `i`, −3…+3; a pairing voted down scores 6 lower per vote, one voted up is preferred among the good outfits; `pairVote`/`itemVote`) is applied in `outfit()`
- occasions:
  - `occOf(rec)`: `formal` stored as `rec.formal`, `wedding` / `funeral` / `casual` as `rec.occasion`
  - rules in `OCC` and `formalTop/Shirt/Tie`
  - an occasion's suit outweighs rotation and the one clearly right suit is held back on the days before
  - `casual` = no jacket, tie, clip or vest: `o.top` is null and the shirt is judged against the trousers
- every month from two months back is simulated from one shared start so months agree
- the simulation is resumable (`planSim(start).upTo(day)`; `buildPlan(y,m)` runs one from `planStart`)
- a day with no jacket of its kind (a blazer day with no blazers) takes the other kind
- the planner picks only items in rotation (`by()` in `planSim` filters `inRotation`; belt/coat notes in `rateOutfit` too); frozen past days look their pieces up in the full wardrobe (`frozenOutfit`), so a paused item stays in outfits already worn; the what-to-buy analysis runs the same planner
- `planSim` keeps on-the-way items with a date in `by()` and gives `outfit()` a per-day pool (`byOn(n)`), so an item joins the plan the day after it arrives

- working on it: every POST to the worker's AI endpoints (`/` tagging, `/tag-many`, `/pattern`, `/render` and item pictures, not `mode:'queue'`) is caught by a `fetch` hook (`busyLabelFor`) that shows `#busy`, a spinning pill above the tab bar, with what is running (`busyStart`/`renderBusy`); photos waiting in the background queue show there too; `.spin` is the ring, also in "Generating photo…", the Add card's busy state and "Claude is reading the pattern…"
- a shirt with a read weave texture (`shirtTextured`) gets its own photo key (`/tex/<settSig>` in `comboSig`), a prompt line (`shirtTexText`) and a drawing of its texture with 2.5× contrast (`fabricDef(…,'dia')`) after its close-up

### `tagging.js`

- photo tagging on the app side (loaded after app.js): `tagExtras()` adds to every tag request the owner's colours/patterns (`settings.custom`), the latest 20 corrections (`settings.tagFixes`, an item never gets its own), and on a second tag the close-up and the measurement
- the tagger gets a sharp copy (`TAG_MAX` 2048px, JPEG 0.92; group photos 2576px), kept on the device in Cache Storage `dw-keep-tagimg` (`keepTagImg`/`tagImgOf`; sw.js never deletes `dw-keep-*` caches) for the benchmark
- adding a close-up tags again with both photos (`refineFromCloseup`): fields the owner set by hand (`q.edited`, set by `setq`) stay, the rest take the new answer, and the card says what changed
- a white reference must be one solid area (half its pixels with 3+ reference neighbours) at least 1.15x the lightness of the picture's darker quarter: a khaki or beige cloth's own scattered highlights are not white (taking them was turning khaki grey); `settCanvas` also needs it to cover 3% of the frame before setting exposure
- white balance: `wbRead` (gains, whether a white reference is there, its brightness); a close-up with its own reference (white paper) is corrected and exposure-set from it (`texGains`), otherwise like its item photo
- measuring: `measureCloth` gives the median Lab of the close-up (or of Claude's `clothBox` in the item photo); `nearestCols` compares by ΔE2000 (`dE00` in core.js; lightness counts half without a reference) against `calibLab`, the median of the owner's own measured items of that colour once there are two (`item.meas`), else the swatch
- the card shows confidence, one-tap runner-ups (`altColor`/`altPattern`), the measurement, and offers a new colour (Claude's `newColor`, or ΔE over `FAR_DE` 12) or pattern (`newPattern`) through `newColForm`/`newPatForm`
- when a close-up (or a measurement with a white reference) is near a listed colour (ΔE ≤ 8) that is 4+ ΔE closer than the tagged one, the card offers it in a tap (`measuredAlt`, `.measalt`); a photo-only measurement doesn't count (the user's dark mink suit measured nearest black from the photo, deep taupe from the close-up); the tagger is told to give the nearest measured colour as `altColor` when it picks another (`measuredText`); fixtures `tests/fixtures/suit-mink*.{jpg,png}`
- owner colours/patterns: `settings.custom` (synced), applied by `applyCustom` in core.js; keys `own<letters>` / `own-<slug>`; each has a base (`colBase`/`patBase`): the planner reads `planCol(i)`/`patOf(i)` so it behaves like the base, while drawings and brightness (`lumCol`) use the colour's own shade; Settings lists them, removable when unused (`renderCustomUI`)
- corrections: saving an AI-tagged card records changed fields (`recordTagResult`: `settings.tagFixes`, last 60; `settings.tagStats` counts) and the stats page shows the accuracy (`tagStatsCard`)
- full patterns (`readSett`/`settFrom`): for a striped/checked tie or shirt (`SETT_PATS`, or any cloth Claude gives a `weave` for) the sett is read from Claude's `patternBox` in the sharp photo, else the close-up (direction then from Claude's `weave.direction`), else Claude's own `weave.colours`; Claude's `weave.repeatsAcross` sets the figure scale; the card says what was read and can switch to the simple pattern (`toggleSett`); saved as `item.sett`, `item.pbox`, `item.weave`, `item.patternText`; the editor's "Read pattern from photo" re-reads from the kept sharp copy (`rereadSett`)
- suits, blazers and trousers read their stripes and checks too (`SETT_PATS`); fine weaves (herringbone, birdseye, nailhead, sharkskin, twill) and houndstooth keep their drawn tiles; with both a sharp photo and a close-up showing 1.5+ repeats, the photo gives the direction and scale and the close-up the bands (`src:'photo+closeup'`); on the figure a jacket or shirt is ~200/180 pattern units across, so a 30-across pinstripe repeats every 6.7
- a striped or checked shirt (`shirtPatterned` in app.js) is described to the photo generator ("a white stripe dress shirt (…)") and gets its own photo key; plain and finely woven shirts still share one photo per colour
- the realistic photo gets a read pattern three ways (`patternPrompt`, `outfitRefsFull`): a description from the measurements (`settText`: direction as the viewer sees it from `sett.a`, each colour's share named with Claude's own `weave.colours` names (hue-weighted match), pinlines, crossing lines), Claude's `patternText` with any direction phrase removed (`dropDir`; Claude once had a plaid tie's stripes rising the wrong way and the generator copied it), and a drawing of the pattern (`patternDiagram`: a tie's blade tip down, else a square of cloth) inserted after the item's photo as a reference
- before a pattern is read, a photo with a white reference is exposure-corrected too (`settCanvas`, at most 1.6x in linear light), so an underexposed photo doesn't read every band too dark; a tie's scale (`tr`) comes from its own photo, a jacket's or shirt's from Claude's count
- tested against the user's real worker: the same outfit made the old way and the new way (queued under throwaway keys `render:c7e5700000000a001/2`), the new one had the right stripe direction, colour balance and crossing lines
- Claude reads the pattern itself once a card has a close-up (`readPatternWithClaude` → worker `POST /pattern`, `claudePattern`): every band of a repeat each way with its width, the pane shape and the repeats in the close-up and across the item, with the noise (seams, moire, uneven panes) left out; `settFromSpec` draws it with colours from the photos: each named thread matched to its own pixels, the close-up's exposure matched to the item photo's, Claude's hue where the pixels read grey (a light-blue line in khaki linen), a quarter of the ground's lightness mixed into each line (crossing threads); saved as `item.patternSpec`; the pixel reader (`settFrom`) is the fallback; the editor's "Read pattern from photo" asks Claude too
- a motif answer (`layout:'motif'`: a small figure on a grid, a neat/foulard, dots) becomes `sett = {v:3, motif:{grid, ground, figs:[{shape, place, size, cols, names, centre, centreName}]}, a, cr, tr, src:'claude+pixels'}` (`motifFromSpec`, chosen by `specSett`): each colour from its nearest pixels, Claude's hue kept where they read grey, the close-up's exposure matched to the photo only when there is a box on the cloth (else the photo's wall washes it out)
- `MOTIF_PATS` (foulard, polka-dot; detect.js) never get a band reading (`readSett`, `rereadSett`): a band reader turns a neat into a diagonal plaid; without Claude they are drawn with the generic tile
- `motifText()` describes a motif for the photo generator (grid, figures, colours, ground, repeats across); `outfitRefsFull` labels its diagram as figures
- `settFromSpec` matches the close-up's exposure to the item photo only inside the saved pattern box (`pbox`); with no box the close-up keeps its own colours (a whole-photo median took in the wall and turned a navy pinstripe lavender)
- if the measured ground still lands over 15 ΔE00 from Claude's ground colour, it drops the exposure match, and failing that uses Claude's colours
- `recolourSpecSetts()` (once, flag `localStorage.spec_recolour`) recolours saved Claude-read patterns that had no box, from the saved `patternSpec` and close-up, without calling Claude; the user's suit photos are `tests/fixtures/suit-pinstripe*.jpg`
- shirt weave textures (`TEXTURE_PATS`/`texPat` in detect.js: dobby, woven, oxford, twill, herringbone…): `/pattern` layout `texture` gives a one-repeat bitmap (`grid` rows of 1/0, 1 = raised), kind, two tones and contrast; `texFromSpec` saves `item.sett {v:4, tex:{kind,grid,lighter,contrast,rel}}`, `rel` being the close-up's lightness swing (`texContrast`, light falloff removed by a box blur) as a share of its lightness
- the texture is drawn in the tagged colour (`texTones` in draw.js: swing softened to 0.4× and capped at 7 L*, average kept at the tag, a white shirt's ground darkens slightly) as a soft image tile (`texTileUrl`), on the figure no finer than 6 units a repeat; only for shirts, and `usableSett` drops a texture reading once the pattern is no longer a weave (or a band reading on a weave)
- a texture's `aspect` (a repeat's height ÷ width, from Claude) stretches its tile: Claude drew the user's tall dobby diamonds as a square bitmap
- weave patterns never use the pixel band reader (`claudeOnly`); a texture isn't sent to the photo generator (plain shirts share one photo per colour); Settings → Shirt weaves (`renderWeaveUI`/`readWeaves`) reads textured shirts that have a close-up but no reading; the user's diamond-dobby close-up is `tests/fixtures/shirt-diamond-closeup.jpg`
- benchmark (Settings → Tagging benchmark, `renderBenchUI`/`runBench`): re-tags 25/50/75/100% of the items with photos (random), three at a time, compares type/colour/colour family/pattern with the confirmed tags; runs only when started, with a cost estimate; results in `localStorage.tag_bench` (last 10)

### `detect.js`

- stripe/check detection from photos (canvas)
- `usableSett(i)`: the item's `sett`, unless it is a band reading of a `MOTIF_PATS` pattern (an older reading); drawing, `settText`, photo diagrams and `patSummary` use it
- `settSig(s)`: a reading's signature for photo keys (`comboSig`): band colours, or the motif's grid, ground, figures and colours
- the full sett (`analyzeSett`/`settFromCanvas`): every band of one repeat in its own colour (per-step medians in Lab, merged until neighbours differ by ΔE 5; a 1–2 step band lying between its neighbours is their blurred edge), the direction, the lines crossing the other way (the residual after the main bands, projected; thread colour = 2 × pixel − band), and the scale (`cr`); stored as `item.sett` `{v:2,a,bands:[[hex,w]],cross:{d,bands:[[hex|null,w]],r},cr,tr,src}`
- `period()` takes the shortest whole fraction of a repeat that matches nearly as well (a clean pattern also matches at 2–3 repeats)
- `analyzeSett` finds the directions on a 320px copy and measures on a sharper one (up to 900px) so fine stripes keep their width; repeats are found in colour (`periodCh` over L*, a*, b*: a tattersall's red and green lines of one lightness stay apart); crossing lines are looked for after a moving average is taken out (`detrend`: light falloff and folds are not lines) and their repeat is at least 4% of the length (not the weave texture)
- directions are found from a colour-difference image (each pixel's Lab distance from the cloth's median, so a light-blue line on khaki linen counts even at the same lightness), with no coherence gate; `opt.straight` (every type but ties, from `settFrom`) tries only upright and level, ±6°; crossing lines are searched and marked in colour too (each step's kind is its strongest change: lighter/darker/bluer/…)
- the repeat is searched with and without the profile's slow drift and both candidates are scored on the drift-free profile (`corrAt`); without a plain repeat the drift-free one counts only above 0.75 (a plaid tie with no full repeat in view stays whole)
- the sharp copy is read in 8 strips running along the lines (`stripProfiles`): a draped cloth's lines wave, so one straight projection smears them; the repeat comes from all strips together and each strip is shifted into line (`stripShifts`, `foldBins`)
- sparse lines (windowpane, pinstripe) whose repeat doesn't match well (correlation under 0.6) are found one by one (`linePeaks`/`lineModel`: kept only where about half the strips have them, gaps varying under 25%), and every pixel is lined up on its strip's nearest line, so unevenly spaced panes (drape, a close-up taken at an angle) still fold into one repeat; the user's linen windowpane blazer (`tests/fixtures/blazer-windowpane*.jpg`) is the test case
- with a sharp photo and a close-up, the close-up's colours are shifted so its ground matches the photo's (the photo usually has a white wall to set exposure), and the swatch takes the close-up's scale (`cr`), since it sits beside it
- a narrow band (under 20% of the repeat, a pinstripe, a pinline) takes its strongest step's colour (if 5 ΔE or more from the ground) and its width at half contrast; each crossing line keeps its own thread colour (alike ones merged); the bands are measured without the pixels under the scarcer kind of crossing line (a gingham's white stays white)

### `figure.js`

- Today's torso figure (`jacket:false` draws it in shirt sleeves with a button placket, for no-jacket days)
- redrawn at the user's request: no head or neck (cropped at the collar, like the original handoff)
- athletic build
- shirt collar band with points on the tie knot
- slim notched lapels around a wide opening so the vest shows
- set-in sleeves cut by the shoulder line (`clipShoulder`)
- the left forearm across the chest with the watch
- the right hand at the button
- No tap targets on it
- Fabrics come in as ready-made `<pattern>`s from `figFabric()` in draw.js
- keep the pattern ids (`suitB/suitL/suitR/shirt/tie`)
- keep `bladeP`, `.fig-clip`, `.fig-watch`, `.fig-vest`, and no `<use>` inside `<clipPath>`

### `draw.js`

- procedural fabric patterns (`fabricDef`)
- an item's `sett` is drawn first: its bands, the crossing lines over them at half opacity, at its angle (ties) or snapped (others); a swatch shows at least one repeat, the figure keeps the repeat's share of the item's width (`fabricDef(..., 'fig')`)
- a motif `sett` is drawn as a 2×2-cell tile (two colours alternate like a checkerboard; `corner` figures where four cells meet; `alternate-cells` in every other cell), turned 45° for a diagonal grid; swatch scale from `cr` (cells in the close-up), figure scale from `tr` (cells across the item)
- `outfitText()` adds an item's `patternText` (Claude's description) for the photo generator, and `comboSig` includes the sett and description, so such an item gets its own photo
- `figureSvg()` glue for the torso figure
- accessories
- wardrobe thumbnails

### `analysis.js`

- "what to buy" analysis (no DOM; runs in `analysis-worker.js`, a Web Worker)

### `app.js`

- IndexedDB storage (items, day history, settings; generated photos in `meta` as `render:<combination key>`)
- forms (the Wardrobe editor can replace, rotate, zoom-crop and undo an item's photo without touching its tags: `photoTools`, `setPhoto`)
- screens:
  - Today: worn / not worn are ✕ and ✓ over the picture's bottom corners on today and past days, with a "Last worn" pill between them when the look was worn before (`wornMarks`, `setWorn`)
  - no "Below the waist" heading
  - the bottom tab bar is compact so the picture and the tiles fit on one screen: 38px buttons, and it keeps only `--navpad` (the home-indicator inset minus 18px) below them; `--navh` is its height, used by the body padding and the toast
  - the score, pieces and month cards share one size (76px folded, a 112px picture slot, one text column) and everything on Today is spaced by `--gap` (12px) in styles.css
  - tiles show a short 4:3 picture
  - the score card is a `#sbox` fold box like `#ibox`/`#mbox` (`scoreCard`, `toggleScore`, `scoreOpen`; its checks slide in one after another and each `.sbar` fills to the points scored)
  - folding from inside: a tap on an open photo (pieces list row or tile) folds it, a tap on the open score breakdown folds it, a tap in the open pieces list that is not on a button or photo folds the list (`foldListTap`), the open month has a `.foldbtn` at its bottom right, and folding a box whose top is off screen scrolls the card back into view (`keepInView`)
  - a box that unfolds (score, pieces list, a piece row, month plan, a tile's photo) scrolls with `reveal(el, top)`: just far enough to show what opened, stopping when the tapped box's top reaches the top of the screen
  - no piece card under the score (removed)
  - a below-the-waist tile under the figure unfolds that item's photo in `#bbox` below the tiles (`pickPiece`/`belowOpen`; tapping the tile again or the photo folds it), the pieces list folded into `#ibox` (each piece unfolds into its photo, `toggleRow`) and the month plan into `#mbox`, both unfolding in place
  - `goToday()` from the date-bar pill and the Today tab
  - double-tap the picture (photo or drawing) to zoom 2.5x on the tapped spot, again to zoom out (`toggleZoom`/`applyZoom`, `zoom` state, kept across redraws of the same day); a drag pans while zoomed and doesn't change the day; `#mannequin-container` has `touch-action:manipulation` and clips the zoomed picture
  - a sideways swipe folds every open box (score, list and rows, below-the-waist photo, month) as soon as the drag locks sideways, and zooms out (`foldAll`, also from `stepDay`)
  - ⇄ beside a piece opens the picker sheet (`openPicker`/`pickItem`: every item for the slot, best match first by `fitOf`; "Suggest another" is the old cycling `swapSlot`)
  - changes teach the planner (`learnFrom`: a swap votes a pairing down, a hand pick votes it up)
  - a past day can be corrected to what was really worn (`togglePastEdit`/`correctPast`: the record gets `edited`, `worn:true` and the real ids)
  - `planMonth(y,m)` / `planFor()` keep one shared `planSim` in `cache` (anything that changes the wardrobe, history, settings or weather must reset `cache={}`)
  - `newDayCheck()` moves on to today when the app is reopened on a later day
  - Wardrobe (an opened item takes the full width of its row from where it was, so the tapped box stays put; its row-mates slide under it and a blank `.gi-gap` keeps later rows; tapping the open photo/swatch, Close or Done folds it back; `openItem`/`closeItem`/`flipWardrobe`, FLIP animations; swiping the grid or ←/→ steps through the type filters in chip order, skipping empty types, not while an item is open: `stepType`/`wardTypes`), Add
- fabric close-ups: `TEXTURE_TYPES` (core.js: suit, blazer, pants, shirt, tie) can have a second photo `item.texture` (a close-up of the cloth, 640px). Add asks "One item" (`#add-one`, `addFiles(files)`; paste and drag too) or "Several items" (`#add-group`, `addFiles(files,true)` → `addMulti`); a card for those types shows "Step 2 · Fabric close-up" (`texSlot`/`addTexture`), optional
- the precision swatch (`item.swatch`, 128px, `cropSwatch`) is cut from the fabric close-up when there is one (`q.texCanvas`, white-balanced; the Add inspector's zoom/position sliders work on it), else from the item photo; `item.swSrc` says which ('tex'/'photo'); the editor re-cuts it when the close-up is added, replaced, removed or undone (`refreshSwatch`), and `texSwatches()` (once, `localStorage.tex_swatch`) re-cut it for items that already had a close-up
- a close-up swatch takes its lightness from the tagged colour (`matchLight`: each pixel keeps its lightness above/below the crop's median and its hue; near white the swing narrows so threads stay under paper white): a close-up shot in dim light made a white shirt grey; changing the colour (Add card `setq`, editor `sete`) re-cuts it, and `texSwatches` (flag `tex_swatch2`) re-cut existing ones
- `swatchSVG` (pieces list, vest row, outfit chips, stats) shows the close-up swatch for an item with `swSrc:'tex'`; others stay drawn from the tags, never cut from the item photo
- Today's pieces list, vest row and outfit chips show the drawn swatch even for an item with a close-up (`swatchSVG(i,true)`); stats keep the close-up one; Today's piece squares are 30px (`#today .row .dot`)
- every drawn small swatch uses `fabricDef(…,'dot')`, a scale that reads at that size: two repeats of a band sett (T 8 of 16), three motif cells, two and a half weave repeats with 1.7× contrast
- the "As tagged" swatch (`tagSwInner`) splits when there is a close-up: drawn colour on the left half, the close-up on the right (`.swsplit .swtex`); the Wardrobe editor adds/replaces/removes it (`replaceTexture`/`setTexture`, undo per field via `setPic`)
- `outfitRefs()` sends each close-up after its item's photo, labelled "a close-up of the … fabric (match its exact colour and weave)" (suit/blazer, shirt, tie; trousers on no-jacket days); the worker takes up to 8 reference photos; the planner worker never gets `texture`
- automatic white balance on new Add photos (`wbGains`/`applyWb`): gains from the brightest near-neutral pixels (≤35% saturated, 0.5–85% of the frame), capped at −15%/+18% per channel, skipped under 2%; a card's close-up gets its item photo's gains; the card has Show original (`toggleWb`, originals kept in `q.raw` until saved); close-ups added later in the editor are not corrected
- product pictures for shoes/belts/socks/pants/coats/watches:
  - `itemDesc()`
  - socks are one sock in side profile on the same warm grey as every other item (the worker's `ITEM_BG`; it ignores an old app's `bg:'white'`)
  - product photos kept on a white backdrop are toned down to `PIC_BG` once in the app (`greyBackdrop`/`fixItemBackdrops`, flag `grey` on the render)
  - a sock's `secondaryColor` is its toe cap colour (`sockToe()` in core.js: the tagger is told so, `drawSock` draws it (the sock outline `SOCK_D` is traced from a catalogue photo, a 60×72 box; details are clipped inside it), `desc` names it, the editor labels it "Toe cap"; the planner ignores it)
  - made from the item's own photo by image edit when it has one, saved as `render:c<16 hex>` of the description
  - Settings button generates the missing ones
- batch photo generation
- background download of the worker's photos for the month on screen and the next, nearest day first (`prefetchRenders`, after one `GET /render?list=1`)
- swipe gestures
- occasions in Settings (`setOccasion`, `addFormalDay`, `renderFormalUI`; `hasOutfit(o)` is true for a no-jacket day too, whose photo key includes the trousers and whose request sends `nojacket`)
- days off in Settings (`setHolidayCountry`, `toggleHoliday`, `addDayOff`, `renderDaysOffUI`; the holiday list is refetched monthly, `refreshHolidays`)
- Settings is a full-screen page (a centred panel from 600px): a sticky header with Done (`saveSettings`: saves the connection fields and closes), a Wardrobe stats link, then categories that unfold like Today's cards (`SET_CATS`: schedule, daysoff, weather, photos, tagging, backup, connection; `.scat`, `toggleCat`, `setCatOpen`), each with a one-line summary (`settingsSummaries`); `openSettings('<key>')` opens one category and scrolls to it, and tests must open the category before clicking inside it
- out of rotation: the open Wardrobe item has "Take out of rotation" / "Put back in rotation" beside Close and Delete (`togglePause`); taking it out releases upcoming days it was pinned to (`force`), the picker and "Suggest another" leave it out (`slotPool`/`swapSlot`; correcting a past day still offers it), and its grid box is dimmed with an "Out of rotation" tag (`.gi.paused`, `.pausetag`)
- Wardrobe boxes are one tap target (photo, type eyebrow `.gtype`, name) with no buttons; the open item has Close, Delete (`.danger`) and the rotation button in `.giact`; Add and the editor use one set of labels (Type, Colour, Second colour, Third colour) and dropdown labels start with a capital (`cap1`)
- bought, on the way: the Add card has "Bought, on the way" (`orderRow`/`setOrder`) with an optional Arrives date (`setArrives`); `save()` stores it paused; the grid tag reads "On the way · <date>", the open item can change the date (`setItemArrives`) or "It arrived: put in rotation"; `checkArrivals()` (start-up and `newDayCheck`) puts items back in rotation the day after their date, with a toast
- weather:
  - 16-day forecast
  - beyond it `loadClimate()` fills `climate` in core.js with the location's usual monthly highs from Open-Meteo's archive, kept in `localStorage.wx_norm`, so `dayClimate()` does not fall back to a temperate calendar

### `stats.js`

- the stats page (Settings → Wardrobe stats, `openStats`/`renderStats`, shown as the `#stats` section by `show('stats')`): `buildStats()` counts what was really worn (`wornDays()`: day records from when the wardrobe existed, not days marked "Not worn") and what is planned for the next six months (`plannedDays()`)
- never-worn pieces with a reason (`whyUnused`)
- a paused item's reason is that it was taken out of rotation
- an item on the way says so, with its arrival date if there is one
- wear counts by type (folded sections build their rows when opened)
- what costs points
- colour balance
- pairings and rest
- what the planner learned (`forgetLearned`)

### `sync.js`

- backup/sync through the worker's `/sync` endpoint (KV)
- backup file download/restore
- When nothing changed on the device since the last sync (`sync_mark`: the backup's version and a fingerprint of the wardrobe), it asks `GET /sync?v=<rev>:<saved>` and neither downloads nor uploads the backup
- any local change takes the full merge path
- daily backups: before the first `/sync` PUT of each calendar day (the app sends its `day`), the worker keeps the stored backup as `snap:<YYYY-MM-DD>` (30 days) and `snap:<YYYY-MM>` (400 days); `GET /sync?snaps=1` lists them, `GET /sync?snap=<id>` returns one
- Settings → "Roll back" (`loadSnapshots`/`rollBack`/`rollBackState` in sync.js) replaces items, days and settings with a snapshot by giving them a new stamp and tombstoning everything else, so it wins the merge on every device; the PUT carries `reason:'restore'` and the worker first keeps the replaced backup as `snap:before-restore`

### `sw.js`

- service worker: network-first app files, offline fallback
- Add new app files to `ASSETS` and bump `CACHE`

### `worker.js`

Cloudflare Worker. Every endpoint except tagging requires `APP_TOKEN`.

- Photo tagging via the Claude API (secret `ANTHROPIC_API_KEY`, optional `CLAUDE_MODEL`); falls back to the Workers AI binding `AI`.
- single tag (POST /): `tagSchema(custom,true)` adds confidence, `altColor`/`altPattern`, `newColor`/`newPattern` ({name, why} or null) and `clothBox`; effort medium; an optional `closeup` is sent as a second image; `measured` and `corrections` become prompt text (`measuredText`/`correctionsText`); `custom` is checked by `cleanCustom`; the system prompt says photos are already white-balanced
- `/pattern`: the woven pattern as data (`PATTERN_SCHEMA`/`PATTERN_PROMPT`, effort high): `across`/`along` bands `{role, name, hex, w}` (shares of a repeat), `stripeDirection`, `repeatsInCloseup`, `repeatsAcrossItem`, `paneAspect`, `ignored`, `description`; tidied by `cleanPattern`; 422 when there is none
- `/pattern` motif: `layout:'motif'` with `motif {grid: straight|diagonal, ground {name,hex}, figures [{shape (MOTIF_SHAPES), placement: cell|corner|alternate-cells, colours (1, or 2 alternating), centre (square-with-dot), sizePct}]}`; `across`/`along` are null; `repeatsInCloseup`/`repeatsAcrossItem` count grid cells
- `/tag-many`: several items in one photo. Claude lists every item with a confidence and a rough box in thousandths; the app crops each into its own Add card.
- `/sync`: KV binding `WARDROBE`. The backup's `{rev, saved}` is kept as the KV key's metadata, so `?v=` and the PUT conflict check don't load the backup.
- `/fetch`: downloads photo links for the app.
- `/holidays?country=XX`: public holidays from Google's public holiday calendars, for countries Nager.Date lacks (the app asks Nager.Date itself first).
- `/render` POST with `mode:'item'`: a product picture of one item from a text description via OpenAI image generation, stored under the given key.
- `/render` POST otherwise: a realistic outfit photo via OpenAI's image edit API (`nojacket:true` uses a shirt-sleeves pose prompt).
  - Secret `OPENAI_API_KEY`; optional `OPENAI_IMAGE_MODEL` (default `gpt-image-2`) and `OPENAI_IMAGE_QUALITY`.
  - An outfit request or queued job may set its own `quality`, `model` (a `gpt-image-*` id) and `complexity`, to try another model under a test key.
- Photos are saved per outfit combination (`comboKey()` in app.js: the shirt by base colour only; the jacket/tie/clip/watch by how they look; plus the vest) as `render:c<16 hex>` in KV (no expiry) and in `meta`, so a combination is never generated twice.
- GET/PUT `/render?key=` share a photo between devices; `GET /render?list=1` lists every kept key. Older `render:<date>` copies are migrated on first use.
- POST `{mode:'queue'}` keeps an outfit's inputs as `job:<key>` in KV and sends `{key}` to the Cloudflare Queue `wardrobe-renders` (binding `RENDER_QUEUE`).
  - Its consumer (`queue()` export) makes the photo in the background, retrying temporary OpenAI errors and recording others as `jobfail:<key>`.
  - GET `/render-queue` lists pending and failed jobs.
  - the consumer retries a message whose `job:` it can't see yet (20 s, up to 6 tries): KV can take a minute to show the job written just before the message, and acking it lost the photo, which sat "pending" for days
  - OpenAI calls have a 5-minute limit (`OPENAI_MS`); a job that keeps throwing is recorded as `jobfail:` after 4 tries; `jobrun:<key>` {attempts, at} is reported as `running` by `/render-queue`
  - the app offers "Try again" for a photo waiting over 10 minutes (`renderStalled`, `STALL_MS`), which queues it again
  - `GET /render-queue` heals stuck jobs: one not started 3 min after queueing (`jobrun` attempts 0, written by `queueRender`) or started over 20 min ago is sent to the queue again (`START_STALE_MS`/`RUN_STALE_MS`, `resends` in `jobrun`), and after 3 resends recorded as `jobfail:`; a legacy job without `jobrun` uses its own `t`
  - the app moves a photo's wait start to the worker's resend time (`running[k].at`), and the `#busy` pill doesn't count stalled photos
  - the push: the queue consumer hands each finished photo (or failure) to the Durable Object `RenderHub` (binding `RENDER_HUB`, `tellHub`), which answers the app's held `GET /render-wait?keys=…&ms=` (`waitForRenders`) with the photo itself (KV can lag a minute); results are kept 10 minutes in memory for an app between waits; no binding → 501 and the app only polls
  - the app holds `/render-wait` open while photos are queued and it is visible (`waitPush`, `PUSH_WAIT` 90 s, `takeQueued`); polling `/render-queue` is the backup on a schedule (`queueDelay`: first look 40 s after sending, then 7 s, 20 s after 3 min, 60 s after 15; `scheduleQueueCheck`, `rqGet().sentAt`)
  - a queued photo missing from `/render-queue` and not yet made counts as lost only after `LOST_MS` (45 min, from `rqGet().at[key]`): KV lists lag up to a minute, and giving up early made the push be ignored (the photo showed only after a reload); `takeQueued` keeps any pushed photo, waited for or not
  - `checkQueue` and `takeQueued` apply their changes to a fresh copy of the waiting list, so a push and a poll finishing together don't undo each other
  - The Settings month batch uses the queue and falls back to generating on the page when the worker has no queue.
  - Today's Generate and Settings → Regenerate also use the queue (`generateRender` → `queueCombo(o,replace)`), so the app can be swiped, closed or locked; `{replace:true}` makes the worker queue and make it though a photo is kept; the button shows "Making photo…" while the combination is queued (`renderPending`), a failure shows its reason with "Try again" (`renderFail`); the app checks the queue every 20 s while open; a worker without the queue still makes it on the page
- Deployed automatically by `.github/workflows/deploy-worker.yml` (Wrangler, config in `wrangler.toml`) when a merge to `main` changes it.
  - It creates the queue if missing, so the token needs Queues edit.
  - Needs the repo's `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID` / `WARDROBE_KV_ID` variables; until then the workflow skips and the user deploys by hand.

**Planner rules:** whenever a change alters how outfits are chosen (planner.js scoring, groups, rotation), bump `PLAN_RULES` in planner.js. On the next start the app clears swaps and vest choices on every day after today (`checkPlanRules()` / `replanFuture()` in app.js; formal days, today and past days stay), so the new rules apply to the whole future. Settings has "Re-plan upcoming days" for the same on demand.

Colours always come from the item's tagged colours, matched by brightness rank, never from the photo, except an item's `sett`: it is read from the white-balanced sharp photo or close-up at the user's request, so its bands keep their measured colours. Pattern lists in `PATS_BY` (core.js) must stay in sync with the prompt in `worker.js`, and so must the per-type colour lists (`COLS_BY` / `DIAL_COLS` in core.js = `TYPE_COLORS` / `DIAL_COLS` in worker.js; `tests/colouraudit.test.js` checks it). Each item type offers only colours it really comes in; an off-list tag moves to the closest allowed colour (`fitCol`), and a colour an existing item already has stays selectable for it.

## Testing

`npm test` (or `node tests/run.js`) serves the repo, drives it in headless Chromium and checks rendering, swipe/layout on phone and iPhone Duo viewports, the planner against an independent rule checklist, belts/leather/metals, the outfit score, photo-less adding, pattern detection, and `worker.js` with mocked bindings. Add a check for every behaviour you change; extra suites can go in `tests/*.test.js`.

- After a tap, tests wait with `settle(page, ms)` (passed to every test file) instead of a fixed `waitForTimeout`: it returns once no animation runs and the scroll is still, waiting up to 2×`ms` (`DEBUG_SETTLE=1` logs each wait)
- `tests/run.js` gives every `tests/*.test.js` file one shared Chromium (a file's `chromium.launch()`/`close()` open and close only its own contexts) and prints the slowest files at the end.

The user's phone may run the Dark Reader extension. The page opts out via the `darkreader-lock` meta tag; keep it.
