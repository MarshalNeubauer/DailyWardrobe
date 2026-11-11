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
- **`npm test` runs only the checks the change can affect** (the user's rule: never the whole suite for a small change). It compares the branch with `origin/main`, prints what changed and why each test runs, and runs nothing for a docs-only change.
- `npm run test:all` runs every check. It is not needed before a merge; use it only when the selection looks too small for what you changed.
- Test runs rewrite `tests/impact.map` (what each test uses). Commit it with the change: later sessions choose their tests from it.
- **The map must be in the commit (enforced).** `git push` is refused while `tests/impact.map` has uncommitted changes; commit it and push again. Never bypass it with `--no-verify`.
- If a change reaches `main` without its map, or without a passing `npm test` on the final files, the next session's `npm test` notices and runs every check. So run `npm test` after your last code edit, then commit everything it changed.
- A conflict in `tests/impact.map` needs no thought: `.gitattributes` merges it by keeping both sides' lines (`merge=union`).
- Never tell the user to download a backup file before a change: the worker keeps daily backups and Settings → Roll back undoes a bad change (see `sync.js`).
- **Run only what you need while working.** `node tests/run.js <name>` (or `TEST_ONLY=<name>`) runs just the `tests/*.test.js` files whose name contains `<name>`. Run `npm test` once before pushing, and once more only if `main` had to be merged in.
- **CLAUDE.md: one fact per line.** Add a new bullet under the file's heading instead of extending an existing one, so sessions working in parallel don't edit the same line and conflict.

## Project

Static app served from `main` by GitHub Pages (no build step). Classic scripts loaded in order, sharing one global scope:

### `index.html`

- markup and script tags

### `styles.css`

- styles
- design system for every page but Today (scoped to `#wardrobe`, `#item-view`, `#add`, `#stats`, `#settings-modal`; Today keeps its own tuned styles): page header `.phead` (22px title, `.pcount`, `.pback`), buttons and inputs 44px (`--ctl-h`/`--in-h`), radius 12px on controls and 14px on cards, bordered cards, `.pri` filled, `.danger` red outline; the base button rule uses `:where()` so page rules override it; `tests/uipages.test.js` checks sizes, titles and no sideways scroll at 320/466/626px

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
- rest bonuses keep creeping up past their caps (`over(i,from)`: 0.01 a day in `rb`, 0.05 for shirts and trousers, 0.2 for jackets, up to 300 days), so a piece that is always a point short of another still comes round; found on the owner's wardrobe, where 4 of 11 trousers and 2 of 4 interchangeable socks were never planned
- ties keep the capped rest (no creep): `tieRepeat` must outweigh it, so a tie colour never repeats on consecutive workdays (`tests/jacketcolour.test.js`)
- a jacket out of season (`seasonFit` −15: a cold-weather suit on a warm day) is planned only when there is no other (`offSeason`); it used to come up once it had rested about 40 days, with a note saying no better suit was available
- a suit whose only acceptable shoes were worn yesterday (a black suit the day after black shoes) loses 10 at the jacket choice (`shoeBound`), so another suit goes first
- `HARM`: black, charcoal, grey and silver ties are classic with navy, charcoal and grey jackets (charcoal and grey with brown, charcoal with tan); `BLAZER_TROUSERS` has mid blue under tan, brown and grey; black trousers lose 20 only where the jacket's own list lacks them (they are listed under grey)
- `settings.darkShirts` (`darkMode()`: 'some' default, 'often', 'never'; Settings → Schedule → Dark shirts, `setDarkShirts`): 'often' scores a dark shirt under a light jacket like a white one and also allows a mid-tone jacket (L ≥ 80) at least 40 lighter than the shirt; 'never' plans one only when there is nothing else
- socks may pick up the shirt's or the tie's colour (`sockEcho`: their colour groups, neutrals left out; +4 in `sockScore`, behind the trousers' colour)
- a wardrobe with no suit and no blazer is planned as trousers, shirt and tie (it used to get a suit day with nothing below the waist)
- `planSim`'s day loop compares day numbers (`di`), not dates: where the clocks go forward at midnight (Cairo, Santiago, Beirut) the month's last day was never planned
- `rec.lock` (the pieces the app showed for one of the coming days, see app.js): `pool()` returns the locked piece for a slot unless the day forces another or skips it; the whole lock is dropped when one of its pieces is not in the day's pool (deleted, out of rotation, the other jacket kind) or the forecast has turned against it (suede shoes on a rainy day, a piece out of season); a locked jacket sets the day's kind and counts as fixed in `fixedAhead`
- `tests/plannerfix.test.js` covers these; the figures came from the owner's backup run through six months of planning (not kept in the repo)
- the score (`rateOutfit`) takes points only for things that can be put right, not for taste: every quiet shirt colour scores 10 (`QUIET_SHIRTS`), a dark shirt under a light jacket too, any listed shoe or trouser colour 10, socks in the shoes' colour 5
- a check marked `hard` is a real mistake and caps the score at `HARD_CAP` (69): shoes that don't suit, three bold patterns or two of one type and scale, trousers the odd jacket's colour, a belt that doesn't match the shoes, a dark shirt under a dark jacket, shirt the jacket's colour, a black tie on a black suit, light socks with dark trousers, one colour head to toe, patent shoes, a piece out of season; `rateOutfit` returns `{score, label, checks:[{label, pts, max, why, hard}], raw, hard:[labels]}`
- a missing piece (shirt, trousers, shoes; jacket and tie unless the day is `casual`) adds the hard check 'Complete outfit' and the label 'Incomplete' (a shirt alone used to score 100)
- new checks: 'Variety' from `o.ctx` (`planSim` gives every day `{prev: the last two workdays' sumUp, n}`: the same look −3, the same tie −2 or tie colour as the workday before −1, the same shirt −2, yesterday's shoes −1), 'Watch strap' (a leather strap against the shoes' leather group), and 'Weather' whenever the climate is known (a piece a season off −1, out of season hard)
- `scoreAdvice(o, pool)`: every single swap of shirt, tie, odd trousers, shoes (with their best belt), belt, socks, watch or clip is scored; `fixes` = the best swap per slot that raises the score (up to 3), `best` = the score reached by taking the best swap again and again (the wardrobe's best with this jacket), `stuck` = the checks no swap improves
- measured on the owner's wardrobe after the rebuild: planned days 96–100 (80 of 114 at 100) with no hard check, random outfits 79% with a hard check; `tests/scorefix.test.js`

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
- a shirt with a figure (motif) reading counts as patterned too (`shirtPatterned`): its own photo key, `motifText` in the prompt and its drawing as a reference
- the realistic photo gets a read pattern three ways (`patternPrompt`, `outfitRefsFull`): a description from the measurements (`settText`: direction as the viewer sees it from `sett.a`, each colour's share named with Claude's own `weave.colours` names (hue-weighted match), pinlines, crossing lines), Claude's `patternText` with any direction phrase removed (`dropDir`; Claude once had a plaid tie's stripes rising the wrong way and the generator copied it), and a drawing of the pattern (`patternDiagram`: a tie's blade tip down, else a square of cloth) inserted after the item's photo as a reference
- before a pattern is read, a photo with a white reference is exposure-corrected too (`settCanvas`, at most 1.6x in linear light), so an underexposed photo doesn't read every band too dark; a tie's scale (`tr`) comes from its own photo, a jacket's or shirt's from Claude's count
- tested against the user's real worker: the same outfit made the old way and the new way (queued under throwaway keys `render:c7e5700000000a001/2`), the new one had the right stripe direction, colour balance and crossing lines
- Claude reads the pattern itself once a card has a close-up (`readPatternWithClaude` → worker `POST /pattern`, `claudePattern`): every band of a repeat each way with its width, the pane shape and the repeats in the close-up and across the item, with the noise (seams, moire, uneven panes) left out; `settFromSpec` draws it with colours from the photos: each named thread matched to its own pixels, the close-up's exposure matched to the item photo's, Claude's hue where the pixels read grey (a light-blue line in khaki linen), a quarter of the ground's lightness mixed into each line (crossing threads); saved as `item.patternSpec`; the pixel reader (`settFrom`) is the fallback; the editor's "Read pattern from photo" asks Claude too
- a motif answer (`layout:'motif'`: a small figure on a grid, a neat/foulard, dots) becomes `sett = {v:3, motif:{grid, ground, figs:[{shape, place, size, cols, names, centre, centreName}]}, a, cr, tr, src:'claude+pixels'}` (`motifFromSpec`, chosen by `specSett`): each colour from its nearest pixels, Claude's hue kept where they read grey, the close-up's exposure matched to the photo only when there is a box on the cloth (else the photo's wall washes it out)
- `MOTIF_PATS` (foulard, polka-dot; detect.js) never get a band reading (`readSett`, `rereadSett`): a band reader turns a neat into a diagonal plaid; without Claude they are drawn with the generic tile
- `readable(t,p,w)` = `settable` or `claudeOnly`: an Add card reads (and saves) a motif or shirt-weave pattern with Claude once its close-up is in, not only band patterns; `weavePool` skips shirts that already have a texture or a figure reading
- `motifText()` describes a motif for the photo generator (grid, figures, colours, ground, repeats across); `outfitRefsFull` labels its diagram as figures
- a motif figure can be any shape (`shape:'figure'`): Claude draws it as a bitmap (`bitmap` rows of 1/0, kept as `figs[].bmp`, with a `name`); the grid's cells can be taller or shorter than wide (`cellAspect` → `motif.aspect`) and every other row can be shifted half a cell (`rowOffset:'half'` → `motif.off`); a shirt's two-colour figured dobby (the user's grey chevrons on white, `tests/fixtures/shirt-chevron-closeup.png`) is a motif, not a texture, drawn at full contrast
- `settFromSpec` matches the close-up's exposure to the item photo only inside the saved pattern box (`pbox`); with no box the close-up keeps its own colours (a whole-photo median took in the wall and turned a navy pinstripe lavender)
- if the measured ground still lands over 15 ΔE00 from Claude's ground colour, it drops the exposure match, and failing that uses Claude's colours
- `recolourSpecSetts()` (once, flag `localStorage.spec_recolour`) recolours saved Claude-read patterns that had no box, from the saved `patternSpec` and close-up, without calling Claude; the user's suit photos are `tests/fixtures/suit-pinstripe*.jpg`
- shirt weave textures (`TEXTURE_PATS`/`texPat` in detect.js: dobby, woven, oxford, twill, herringbone…): `/pattern` layout `texture` gives a one-repeat bitmap (`grid` rows of 1/0, 1 = raised), kind, two tones and contrast; `texFromSpec` saves `item.sett {v:4, tex:{kind,grid,lighter,contrast,rel}}`, `rel` being the close-up's lightness swing (`texContrast`, light falloff removed by a box blur) as a share of its lightness
- the texture is drawn in the tagged colour (`texTones` in draw.js: swing softened to 0.4× and capped at 7 L*, average kept at the tag, a white shirt's ground darkens slightly) as a soft image tile (`texTileUrl`), on the figure no finer than 6 units a repeat; only for shirts, and `usableSett` drops a texture reading once the pattern is no longer a weave (or a band reading on a weave)
- a texture read as `herringbone` or `twill` is drawn with the woven tiles (`herringboneTile`, columns of slanted lines turning at each column edge), not Claude's bitmap: the user's blue shirt came back as one V that tiled into horizontal zigzags; contrast from `rel` (more in 'dot' and 'dia'), a swatch at most 20 column pairs (Claude counted 60 chevrons); figured weaves keep the bitmap
- a herringbone stripe's plain bands come from Claude's bitmap (`texPlainBand`: columns the same all the way down; all 1 = a shiny satin band): drawn after every twill column, alternating column / band / opposite column / band as on the user's pink shirt (`herringboneTile(…, band)`); the user's pink shirt has one (20%), the blue none; the worker prompt tells Claude to mark them so
- a texture's `aspect` (a repeat's height ÷ width, from Claude) stretches its tile: Claude drew the user's tall dobby diamonds as a square bitmap
- weave patterns never use the pixel band reader (`claudeOnly`); a texture isn't sent to the photo generator (plain shirts share one photo per colour); Settings → Shirt weaves (`renderWeaveUI`/`readWeaves`) reads textured shirts that have a close-up but no reading; the user's diamond-dobby close-up is `tests/fixtures/shirt-diamond-closeup.jpg`
- benchmark (Settings → Tagging benchmark, `renderBenchUI`/`runBench`): re-tags 25/50/75/100% of the items with photos (random), three at a time, compares type/colour/colour family/pattern with the confirmed tags; runs only when started, with a cost estimate; results in `localStorage.tag_bench` (last 10)

### `assemble.js`

- assembled pictures are switched off (`ASM_ON` false in assemble.js) since the owner rejected the first master: zoomed out, the lower hand at the groin, and the vest master's buttons read as seven; Today shows each outfit's own photo, nothing is fetched or made, Settings hides Item photos (`#asm-group`)
- the owner is having new masters made (a suit master and a vest master); to switch back on: set `ASM_ON` true and bump `ASM_VER`, so every device drops the old set and takes the new one; the 57 item photos and 5 calibration photos must be remade from the new masters (about $4.60)
- what a master must be for this code: 1024×1024; a plain solid jacket, plain white shirt, the owner's watch, no tie bar or pocket square; a solid bright tie in a colour none of the owner's ties has (dark green was too close to navy); the vest master an edit of the suit master, so hands, watch and background line up pixel for pixel; ideally no hand over the tie or the waistcoat's buttons
- check a new master's framing against the owner's liking before making anything from it: the first was generated once from the app's drawing and never compared with the existing photos
- `tests/assemble.test.js` sets `ASM_ON=true` in the page for the checks of the machinery, and checks the shipped state is off
- assembled outfit photos (loaded after tagging.js): one master photo fixes the pose, every item has one photo that is the master with only that piece changed, and an outfit's picture is put together on the device by copying pieces onto the master, with no image model
- the master (`asmMasterOutfit`, key `asmMasterKey()`): the owner's dark grey herringbone suit, a white shirt, a burgundy tie and his watch, no tie bar; things are added on top of it, never taken off
- `ASM_VER` 2, `ASM_ON` true: the masters the owner approved (close framing, the lower hand at the waist button, the watch turned as worn, the blurred light office); version 1 (a plain grey suit and green tie, zoomed out) was rejected and its keys are no longer asked for
- the two masters and the five calibration photos of version 2 were made outside the app and put on the worker by hand (`PUT /render`): master `cc34b55fd4df1971f`, vest master `c6e9828d666116957`; `asmMasterJob` and `asmVestMasterJob` only describe them, for the day one is missing
- the vest master is the master with only the chest opening changed: asked to add a waistcoat, with or without a mask, the generator redrew the whole picture about 4% smaller, so its waistcoat was lined up with the master (a similarity fit on matched features) and pasted between the lapels, stopping at the hand; a remade vest master needs the same, or its pieces won't line up
- one-piece swaps of the textured master stay in place: measured with `asmDrift`, the calibration photos and two real pieces (a pinstripe suit, a tie) made by the worker changed 0.1–0.9% outside their piece, the vest master 1.1%; the zones pass `asmZonesOk` (jacket 65%, shirt 3.5%, tie 2.7%, watch 0.7% of the picture)
- zones (`asmZones`): four calibration photos (the master with the jacket, shirt, tie or watch in a loud flat colour, `ASM_CALIB`) show where each piece is; a pixel goes to the piece whose calibration photo changed it most, if by more than `ASM_DE` (14, CIE Lab: a dark green and a dark navy of one brightness still differ); zones are kept packed in `meta` as `asm:zones:<master key>` and refused when a piece is missing or absurdly large (`asmZonesOk`)
- `asmCompose(master, zones, {jacket, shirt, tie, bar, watch})`: the jacket and shirt are copied over their whole zone; the tie by its own outline (`asmTieMask`: within 3px of the zone's edge each pixel is tie or not by the nearer colours); the tie bar is the biggest thing on the tie the master doesn't show (`asmBarMask`); another watch takes the master watch's zone and what it changed around it (`asmWatch`)
- a piece left out stays as the master shows it: the owner's watch and a white shirt need no piece (`asmInfo()`, read from the master photo's own record: its `sig` is `asm/master {watch, shirt}`, `asmMasterSig`), and the hands, the background and that watch always come from the master (edits redraw them slightly: the trial's jacket photo smeared the watch dial)
- joins (`asmSeams`): pixels where two pieces meet are rebuilt from the clean pixels within 2px either side, so a tie made over the white master shirt has no pale rim on a dark shirt
- where a smaller watch uncovers the cuff its photo shows the master's white shirt: cuff-coloured pixels joined to the cuff are tinted to the outfit's shirt (`asmWatch`)
- `asmCan(o)`: a jacket, shirt, tie and watch; no-jacket days and tieless days keep a photo of their own
- vest days (most of the user's days: every suit day outside hot weather): the vest master (`asmVestKey()`, `asmVestMasterJob`) is the master with a waistcoat added, and a suit that has one gets a second piece (`asmPieceKey('vest', suit)`), an edit of the vest master that swaps the jacket and waistcoat together; `asmParts` takes it on a day with `o.vest`, and no tie bar
- the waistcoat's zone (`asmVestZone`, kept as `asm:vest:<vest key>`) comes from its own calibration photo, the vest master with the waistcoat in orange (`asmCalibKey('vest')`); against the plain master a grey waistcoat over a shadowed white shirt left a ragged edge
- with a vest (`P.vest` in `asmCompose`) the suit's photo covers the jacket's zone and the waistcoat's (the generator opens the jacket's front to show it); the shirt and tie stop 3px under the waistcoat's edge where they meet it; only the tie's top area (joined to the knot) is used; small specks of the master's tie colour left in the suit's photo (its tip below the waistcoat) are filled from beside them
- wherever the master's tie shows and the new one doesn't (a narrower tie, the tip under a waistcoat), the pixel takes what is beside it in the picture so far; left alone it stayed the master's green
- `ASM_VEST` (2) is which vest master this is: the vest master's key, its calibration photo's and every suit's vest piece's carry it (`asmVestTag`), so a remade vest master replaces the old one on every device; `asmDropOld()` (start-up, once per version, `localStorage.asm_vest`) drops the earlier version's photos a device still holds. Version 1 drew five visible waistcoat buttons, which with those under the hand read as seven
- `asmMajor` smooths a mask's outline (most of the square around a pixel)
- `asmNeeds()` adds the vest master, its calibration photo and a vest piece per suit with a waistcoat, unless `settings.vestMode` is `never` or the suit has `vest:'no'`
- photo keys: `asmPieceKey(slot, item)` hashes `asmLook`: `lookSig` (app.js, shared with `comboSig`), so plain shirts of one colour share a piece, plus the weave's name for a shirt in a woven texture that was never read (the owner wants a photo per shirt look, not per colour)
- shirt textures (`asmShirtText`, `ASM_WEAVE`): a woven texture is asked for "bold … a little larger and with more contrast than life", since a true-to-life weave can't be seen in the strip of shirt beside the tie; tried on the user's pink herringbone
- the wording matters: "easy to see in this photo" made the generator answer with a collage (the figure moved aside, the reference photos pasted beside it); the worker's swap prompts now end with `ONE_PHOTO` (one photograph, same framing, no panels or copies of the references)
- a piece that didn't keep the picture is refused: `asmDrift` is the share of pixels outside the piece that changed (real pieces under 6%, the collage over 30%); over `ASM_DRIFT` (12%) the key goes in `asmBad`, the outfit keeps its own photo and Settings offers to make the piece again
- Today: `renderFor(o)` returns `asmFor(o)` first, the assembled picture kept on the device (`asmOut`, in `meta` as `asm:out:<key>`, the newest 80; stale once a piece is made again, `asmStamp`); `figureStage` calls `asmEnsure(o)`, which brings the master, the pieces (and the calibration photos while no zones are kept) home with `GET /render?key=` (`asmGet`, once a session each), assembles and redraws
- a photo made for the outfit itself after the master (Settings: Regenerate) wins over the assembled one; older outfit photos are superseded but stay as the fallback while a piece is missing
- Generate on Today, for an outfit that can be assembled (`asmWants`), sends only its missing pieces (`asmQueueOutfit`), about 8¢ each; `renderPending` counts them (`asmPending`); the month batch skips such outfits (`batchCombos`)
- Settings → Realistic photos → Item photos (`renderAsmUI`, `asmMakeMissing`): `asmSync()` looks at the worker (at start-up, when Settings opens, forced after a change), brings home what it has and lists what nobody made (`asmState.missing`, from `asmNeeds()`: the master, four calibration photos, one piece per in-rotation jacket, shirt look, tie, tie bar and extra watch); the button sends them after a confirm with the cost (`ASM_COST`: master 24¢, calibration 6.5¢, piece 8¢); a missing master is made first, alone
- a new item, or one put back in rotation (`put` → `asmAutoSoon`), has its photo made by itself when at most `ASM_AUTO` (3) pieces are missing; "New items: Only when I ask" (`settings.asmAuto`, `setAsmAuto`) turns that off
- a worker with no master is asked for it once and then not again for 6 hours (`localStorage.asm_none`, `ASM_NONE_MS`), except when Settings looks; without a master nothing else is asked for
- `prettyCols` (core.js) builds its colour-name pattern when first needed and again after `applyCustom`: built once at load it never knew the owner's colours, and photo descriptions said "a owntaupe tie"
- sent pieces go through the same queue watch as outfit photos (`rqGet().keys`, the push, `checkQueue`)
- `asmPhoto(o)`: the outfit's picture as a JPEG data URL from the photos kept on the device (`renders`), or null when the master, a piece or the calibration photos are missing
- the jobs (`asmMasterJob`, `asmCalibJob`, `asmPieceJob`): each is a `POST /render {mode:'queue'}`; pieces name the master by `baseKey` and swap one piece (`swap`), a tie bar is added (`swap.add`)
- the fixtures `tests/fixtures/asm-*.jpg` are the real photos (900px): the master, six one-piece edits, the vest master, its calibration photo and one suit with its waistcoat; `tests/assemble.test.js`

### `detect.js`

- stripe/check detection from photos (canvas)
- `usableSett(i)`: the item's `sett`, unless it is a band reading of a `MOTIF_PATS` pattern (an older reading); drawing, `settText`, photo diagrams and `patSummary` use it
- a weave pattern (`texPat`) takes a texture or a figure (motif) reading
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
- the pose follows the photo the owner chose as the model: the left forearm lower across the chest, the right hand raised to the waist button right under the left wrist, clear of the watch (`.fig-hand-l`, `.fig-hand-r`); a photo used as the pose source made the generator copy that photo's watch, so the pose comes from the drawing
- the photo generator gets a square crop of the drawing with a jacket (`FIG_CROP` in app.js, `figurePng`: shoulders across, ending under the pocket flaps); sent whole it came back zoomed out, down to the hips; a no-jacket day sends the whole drawing; the worker's `RENDER_PROMPT` describes the same pose and crop
- `FIG_CROP` is 368 of the drawing's 390 units and the prompt asks for both shoulders and elbows inside the picture with a strip of background either side: the crop alone changed nothing, the wording did ("shoulders filling the width" ran them off both edges)
- the chest pocket is a welt in the jacket's cloth (`.fig-welt`): drawn as a dark stroke it came back as a dark line in the pocket
- No tap targets on it
- Fabrics come in as ready-made `<pattern>`s from `figFabric()` in draw.js
- keep the pattern ids (`suitB/suitL/suitR/shirt/tie`)
- keep `bladeP`, `.fig-clip`, `.fig-watch`, `.fig-vest`, and no `<use>` inside `<clipPath>`

### `draw.js`

- procedural fabric patterns (`fabricDef`)
- an item's `sett` is drawn first: its bands, the crossing lines over them at half opacity, at its angle (ties) or snapped (others); a swatch shows at least one repeat, the figure keeps the repeat's share of the item's width (`fabricDef(..., 'fig')`)
- a motif `sett` is drawn as a 2×2-cell tile (two colours alternate like a checkerboard; `corner` figures where four cells meet; `alternate-cells` in every other cell), turned 45° for a diagonal grid; swatch scale from `cr` (cells in the close-up), figure scale from `tr` (cells across the item)
- a `figure` is drawn from its bitmap, its rows' runs of 1 as rects, at the figure's own proportions; cells are `T` wide and `T*aspect` tall, offset rows shift half a cell, and a figure crossing the tile's edge is drawn again on the other side
- `outfitText()` adds an item's `patternText` (Claude's description) for the photo generator, and `comboSig` includes the sett and description, so such an item gets its own photo
- `figureSvg()` glue for the torso figure
- accessories
- wardrobe thumbnails

### `analysis.js`

- "what to buy" analysis (no DOM; runs in `analysis-worker.js`, a Web Worker): `runAnalysis(list, T, weeks, progress, onCat)` → `{v:2, base, cats:[{key, title, verdict, own, notes, recs}], top, occasions}`
- `evalPlan(list,T,weeks)` plans the next `SHOP_WEEKS` (26) with the real `dayRecs` (history, occasions) and measures it: score, problem notes, jacket rest, colour/tie/look repeats, shoes worn two days running, first-choice shoe days, pieces never planned, points lost per check
- pieces on the way count as owned (`shopList`), pieces out of rotation don't
- suits, blazers, trousers, shirts and ties: candidates are every colour in `SHOP_COLS` × pattern class (`clothesCandidates`), ranked without simulating (`rankClothes`): fit = how many owned jackets/shirts/ties make an outfit within `QWIN` of that jacket's best (`compatBase`/`compat`), gap = a colour group (`shopGroup`) or pattern class (`shopClass`) not owned, staples first (`STAPLES`), a bonus for partners that are never planned; ranking by simulation alone is noise in a full wardrobe (the user's got "another brown suit" first)
- the best of each category (one per colour group and class, two per colour) are then simulated for the facts (`simFacts`): days planned, the score of its outfits, two sample outfits, problem days and short-rest days fixed; an idea planned under twice or scoring 1.5 below the usual is dropped
- solid and the fine weaves are one class for jackets (the planner treats them alike): a plain suit idea names the fine textures not owned yet (`shopDetail`)
- shoes, belts, socks, tie clip, cufflinks and coats (`smallCandidates`) are each simulated and ranked by their direct effect; shoes whose owner's pair only lacks a belt get the belt as the idea; `shoeNotes` says what the plan leans on
- tiers: `fix` (problem days or 2+ short-rest days gone), `better` (a check no longer marked down), `gap` (a staple), `variety`, `optional` (everything in a category that is full: 2+ pieces never planned, or each planned less than once in five weeks); category verdict needed / worth / covered
- two fixes for the same days are not both top picks: the best is taken, the rest re-checked as if it were bought (same section: kept as alternatives with `dup`; coats, belts and cufflinks: dropped)
- `occasionCheck` dresses one formal day, wedding, funeral and no-jacket day and lists what is missing
- `settings.shopSkip` (keys `type|colour group|pattern class`, synced) are left out of every check

### `shop.js`

- the "What to buy" button on the Wardrobe tab (`shopButton`, `#shop-btn`) and its sheet (`#shop-sheet`/`#shop-backdrop`, `openShop`/`closeShop`/`renderShop`): slides up from the bottom over the whole page like the piece picker; Escape, the backdrop, × and changing tab close it
- sections: top picks (`shopGo` opens the idea in its section), one per category with what is owned, a verdict and its ideas, occasions, hidden ideas
- an idea is folded to its picture, name and first reason; open it shows every reason, sample outfits drawn with `figureSvg` from the owner's pieces, "Bought it" and "Not for me"
- "Bought it" (`shopBought`) adds the piece as bought, on the way (`order`+`paused`, optional `arrives`) and checks again; "Not for me" (`shopHide`) adds its key to `settings.shopSkip` and hides it at once
- swiping the sheet down closes it, like the item sheet: its header (`.shop-top-head`, with a grabber) is a handle at any time, its content only while scrolled to the top; the sheet follows the finger and the backdrop lightens, and it closes past a quarter of its height or on a flick, else springs back (`shopSwipe`; `tests/shopswipe.test.js`)
- `shopSwipe()` installs the swipe listeners the first time the sheet opens (from `openShop`, once: `shopSwipeOn`), and the grabber is its own element (`<i class="shop-grab">` in the header), so a change to either selects only the tests that open the sheet
- the sheet and its backdrop slide and fade away on closing (`visibility` switches off after the transition; not `.on` = no pointer events); the handler only sets an inline transform and lets the CSS transition finish from there
- `renderShop` during a swipe (`shopDrag`) is put off until the finger lifts (`shopStale`): a redraw removes the element the touch started on and its moves stop coming
- the result is kept on the device (`meta` key `shop`: `{sig, at, res}`) and shown without checking again while the wardrobe is unchanged (`shopSig`) and it is under a week old; sections appear as the worker finishes them (`{cat}` messages)

### `app.js`

- IndexedDB storage (items, day history, settings; generated photos in `meta` as `render:<combination key>`)
- forms (the Wardrobe editor can replace, rotate, zoom-crop and undo an item's photo without touching its tags: `photoTools`, `setPhoto`)
- screens:
  - Today: worn / not worn are ✕ and ✓ over the picture's bottom corners on today and past days, with a "Last worn" pill between them when the look was worn before (`wornMarks`, `setWorn`)
  - no "Below the waist" heading
  - the bottom tab bar is compact so the picture and the tiles fit on one screen: 38px buttons, and it keeps only `--navpad` (the home-indicator inset minus 18px) below them; `--navh` is its height, used by the body padding and the toast
  - the tab bar grows upward (`--navx`, its buttons taller) until its top is one `--gap` below Today's below-the-waist tiles, so nothing peeks out between them (`fitNav`, after each render, on resize and when Today's size changes); at most 64px (`NAV_MAX`), never on a screen where the tiles already reach it; the natural top is computed, not measured, since the height animates
  - the fit is measured only on a day whose photo has loaded (before that the photo has no height and the bar jumped to its cap and stayed); that measurement is kept per screen size (`localStorage.nav_fit2:<w>x<h>`) and used on days with only the drawing (whose Generate button pushes the tiles lower) and on weekends; the photo's `onload` refits; old `nav_fit:` values are dropped
  - the fit is always taken as if the row had three tiles: with four (trousers, a coat) a picture tile is narrower and, its 4:3 picture following its width, shorter, which made the bar taller on those days; `fitNav` works out the three-tile height from each tile's picture shape (drawn tiles keep their height)
  - the score, pieces and month cards share one size (76px folded, a 112px picture slot, one text column) and everything on Today is spaced by `--gap` (12px) in styles.css
  - tiles show a short 4:3 picture
  - Today goes two columns (outfit left, cards right) only from 600px wide in landscape; upright (the Duo unfolded, a tablet) it stacks outfit, tiles and cards, the picture (`.fig`) the full width from 600px (under 600px it stays at most 390px, so a phone or the folded Duo fits picture and tiles on one screen); `tests/run.js` checks both
  - the score card is a `#sbox` fold box like `#ibox`/`#mbox` (`scoreCard`, `toggleScore`, `scoreOpen`; its checks slide in one after another and each `.sbar` fills to the points scored)
  - the score card's second line says what the score means (`scoreCard`, `adviceFor`, memoised per outfit): 'N things to put right' with a hard check (the badge turns red), 'Could be N with what you own' when a swap scores higher, 'The best your wardrobe allows' below 100 with none, else 'Outfit score'
  - unfolded, swaps that would score higher sit above the checks as 44px rows (`.sfix`, `.sfixbtn`: swatch, piece, +points; a tap wears it through `applyFix` → `pickItem`); a hard check is marked '!' in red, a check nothing owned improves says so (`.lim`), and a capped score explains the cap (`.scap`); none of this on past or worn days
  - folding from inside: a tap on an open photo (pieces list row or tile) folds it, a tap on the open score breakdown folds it, a tap in the open pieces list that is not on a button or photo folds the list (`foldListTap`), the open month has a full-width `.foldbar` ("Fold away") along its bottom, and folding a box whose top is off screen scrolls the card back into view (`keepInView`)
  - a box that unfolds (score, pieces list, a piece row, month plan, a tile's photo) scrolls with `reveal(el, top)`: just far enough to show what opened, stopping when the tapped box's top reaches the top of the screen
  - no piece card under the score (removed)
  - the pieces list has no Tie clip row on a day without one (a vest day, none owned); it stays while correcting a past day, to add the clip worn
  - Reset is a card of its own under the month (`resetCard`, `#rbox`, the cards' 76px look, "↺ Reset"), shown on a day the user changed (swaps, picks, the vest); it calls `resetDay`; the small ↺ in the day's row is gone
  - a below-the-waist tile under the figure unfolds that item's photo in `#bbox` below the tiles (`pickPiece`/`belowOpen`; tapping the tile again or the photo folds it), the pieces list folded into `#ibox` (each piece unfolds into its photo, `toggleRow`) and the month plan into `#mbox`, both unfolding in place
  - `goToday()` from the date-bar pill and the Today tab
  - the open month has no arrows, swipe hint or legend (the cells show worn/today/planned/rest themselves), its centred title close above the weekday row, and the fold bar right under the days: a sideways touch swipe inside `#mpanel-in` (handed over by the Today swipe handler, `st.month`) or a mouse drag moves between months (`monthDrag`/`monthRelease`, `monthStep(n, from)` slides the new month in; the `#mswipe` wrapper moves); the day doesn't change and nothing else folds; a drag's closing click doesn't open a day
  - moving an outfit in the open month: a long press (`MOVE_HOLD` 380 ms, still within `MOVE_SLOP` 8px) on today or a later workday that isn't worn and has no occasion (`data-mv` on the cell) lifts its drawing (`.mv-ghost`, held above the finger; the other days wiggle, `#mpanel-in.mv-on`); the mouse holds the button
  - while it is dragged, the day under it previews the month re-planned with the outfit there (`moveRecs` pins its pieces on the target with its `kind`, clears the day it left; `planWith` runs `buildPlan` on a copy of `dayRecs`); `showPlan` redraws only cells whose outfit changed (`mvSig`), sliding each outfit from the cell that showed it (FLIP), and nothing is saved until the drop
  - dropping saves both days, re-renders and toasts what moved with Undo (`toast(text, ms, {label, fn})`); dropping off the days, or on the day it came from, changes nothing; `outfitMove` stops the day swipe and month drag while moving
  - during a move the lifted day's old drawing stays in the page hidden (`.mv-held`): removing the node a touch started on stops its touchmove/touchend; the cells' children take no pointer events (`#mpanel-in.mv-on .mc *`), since a drawing sliding to its new day caught the pointer over its old one
  - a day record's `kind` ('suit' / 'blazer') fixes the day's jacket kind in `planSim`, so a suit outfit moved onto a blazer day stays a suit day; `tests/moveoutfit.test.js`
  - the coming week stays as shown: after each render `lockUpcoming()` gives every workday from today to `LOCK_DAYS`−1 (7) days on `rec.lock` = `lockIds(o)` (the plan's pieces, no coat), rewritten when the plan for that day differs; a different tie today, a new item or a day marked not worn then re-plans only the days after the lock
  - a change made by hand on a day drops its lock (`swapSlot`, `pickItem`, `setOccasion`, `resetDay`, `moveRecs`): the day is planned again around the change and locked as it then shows; the vest toggle and worn / not worn keep it
  - `clearLocks()` releases the locks after today: from `setDarkShirts`, `toggleDay` (workdays, blazer days) and `setOccasion` (the days around an occasion are planned around it); `replanFuture()` (Re-plan upcoming days, new `PLAN_RULES`) releases them too without counting them as days reset; `tests/weeklock.test.js`
  - double-tap the picture (photo or drawing) to zoom 2.5x on the tapped spot, again to zoom out (`toggleZoom`/`applyZoom`, `zoom` state, kept across redraws of the same day); a drag pans while zoomed and doesn't change the day; `#mannequin-container` has `touch-action:manipulation` and clips the zoomed picture
  - a sideways swipe folds every open box (score, list and rows, below-the-waist photo, month) as soon as the drag locks sideways, and zooms out (`foldAll`, also from `stepDay`)
  - ⇄ beside a piece opens the picker sheet (`openPicker`/`pickItem`: every item for the slot, best match first by `fitOf`; "Suggest another" is the old cycling `swapSlot`)
  - changes teach the planner (`learnFrom`: a swap votes a pairing down, a hand pick votes it up)
  - a past day can be corrected to what was really worn (`togglePastEdit`/`correctPast`: the record gets `edited`, `worn:true` and the real ids)
  - `planMonth(y,m)` / `planFor()` keep one shared `planSim` in `cache` (anything that changes the wardrobe, history, settings or weather must reset `cache={}`)
  - `newDayCheck()` moves on to today when the app is reopened on a later day
  - Wardrobe: swiping the grid or ←/→ steps through the type filters in chip order, skipping empty types (`stepType`/`wardTypes`); Add
  - Wardrobe item sheet: tapping an item opens it in `#item-view`, a sheet that slides up over the Wardrobe (the full width of a phone, from `--ivtop` below the top of the screen: the status bar's height on a notched phone, else 36px; a centred panel from 600px), over `#item-backdrop`; the grid never moves or reshuffles (`openItem`/`closeItem`/`renderItem`, drawn by `renderWardrobe` whenever `editing` is set)
  - swiping the item sheet down closes it: its header (with the grabber) is a handle at any time, its content only while scrolled to the top (further down the swipe scrolls it back up); decided on the first move of a touch, before the browser scrolls; the sheet follows the finger and the backdrop lightens, and it closes past a quarter of its height or on a flick, else springs back (`ivDrag`, `closeItem(false, dragged)`); not while cropping
  - closing the item sheet on another item than the one opened (`itemFrom`) first scrolls the grid to that item's box
  - the item sheet also closes with Done in its bottom bar (`.ivbar`, always on screen), a tap on the backdrop (the strip above the sheet), the phone's Back button or gesture (one history entry while open: `histPush`/`histDrop`, `itemBack` marks our own `history.back()`) and Esc (which first leaves a crop); the photo is not a close button
  - ‹ › beside Done, a sideways swipe on the sheet (it may start on a dropdown) and the arrow keys go to the previous / next item of the list on screen (`stepItem`, `wardList`); the header shows the type, the name and "n of m"
  - the item sheet's body (`itemBody`): the photo beside the swatch, "Edit photos" folding the photo tools right under it (`togglePhotoTools`, `phEdit.open`; an item with no photo shows Add photo directly), a Details card (shade, tags, pattern reading), a Rotation card, and Delete item alone at the end
  - while the item sheet is up, `header`, `main` and `nav` are `inert` (`itemShown`), `body.iv-on` lifts the toast and the busy pill above the bottom bar, and `show()` of another tab drops the sheet (`dropItem`)
  - `startCrop` scrolls the item sheet to the top, where the crop frame replaces the picture
  - in the item sheet, an item with a photo and a close-up gets a tappable pair (`#ivpair.cmpable`): a tap on the split swatch splits them up (`toggleCompare`, `phEdit.cmp`, class `cmp`): a copy of the drawing (`.cmpdraw`, hidden on the swatch's drawn half) slides over the photo's square and the close-up's clip opens to its whole square; a tap on either square puts them back; the captions switch to "As tagged" / "Close-up"; `tests/compare.test.js`
- fabric close-ups: `TEXTURE_TYPES` (core.js: suit, blazer, pants, shirt, tie) can have a second photo `item.texture` (a close-up of the cloth, 640px). Add asks "One item" (`#add-one`, `addFiles(files)`; paste and drag too) or "Several items" (`#add-group`, `addFiles(files,true)` → `addMulti`); a card for those types shows "Step 2 · Fabric close-up" (`texSlot`/`addTexture`), optional
- the precision swatch (`item.swatch`, 128px, `cropSwatch`) is cut from the fabric close-up when there is one (`q.texCanvas`, white-balanced; the Add inspector's zoom/position sliders work on it), else from the item photo; `item.swSrc` says which ('tex'/'photo'); the editor re-cuts it when the close-up is added, replaced, removed or undone (`refreshSwatch`), and `texSwatches()` (once, `localStorage.tex_swatch`) re-cut it for items that already had a close-up
- a close-up swatch takes its lightness from the tagged colour (`matchLight`: each pixel keeps its lightness above/below the crop's median and its hue; near white the swing narrows so threads stay under paper white): a close-up shot in dim light made a white shirt grey; changing the colour (Add card `setq`, editor `sete`) re-cuts it, and `texSwatches` (flag `tex_swatch2`) re-cut existing ones
- `swatchSVG` (pieces list, vest row, outfit chips, stats) shows the close-up swatch for an item with `swSrc:'tex'`; others stay drawn from the tags, never cut from the item photo
- Today's pieces list, vest row and outfit chips show the drawn swatch even for an item with a close-up (`swatchSVG(i,true)`); stats keep the close-up one; Today's piece squares are 40px (`#today .row .dot`), as large as the rows' 40px tap height allows, so no row is taller
- every drawn small swatch uses `fabricDef(…,'dot')`, a scale that reads at that size: two repeats of a band sett (T 8 of 16), three motif cells, two and a half weave repeats with 1.7× contrast
- the "As tagged" swatch (`tagSwInner`) splits when there is a close-up: drawn colour on the left half, the close-up on the right (`.swsplit .swtex`); the Wardrobe editor adds/replaces/removes it (`replaceTexture`/`setTexture`, undo per field via `setPic`)
- the watch's dial goes to the generator enlarged, after the watch's photo (`dialCrop`, `DIAL_PART` .48 of the photo's middle, `dialLabel`; in `outfitRefsFull`): the watch is about 80px in the picture and with its photo alone the dial came back generic; when there are over 8 references it goes right after the shirt's close-up (`refRank` .5)
- the watch's photo and its dial's enlargement go to the generator turned half a turn (`halfTurn`, label `WATCH_WORN`): on the left wrist, arm across the chest, a watch is seen with its crown toward the hand and 12 o'clock at the bottom; from upright photos it was drawn upright, crown toward the elbow, which the owner called backwards; the prompt says the same and the figure's watch has its crown toward the hand (`.fig-crown`)
- the worker takes 8 references; `trimRefs` (tagging.js) drops the least needed first (`refRank`: the shirt's close-up, then its texture drawing (the user's choice: the drawing is in the tagged colour, a dim close-up reads grey), other drawings, close-ups), never an item's photo: cutting at 8 dropped the watch (added last) once the pattern drawings came in, and the generator drew a generic one
- since then (the owner's choice after an A/B on the real worker): a tie with a close-up is sent without its photo (`outfitRefs`), and the shirt's close-up goes in its place; a tie without a close-up keeps its photo
- `refRank` now drops the watch dial's enlargement first, then the shirt's close-up, then the shirt's texture drawing; with the tie's photo gone at most one reference is over (a jacket with a read pattern), so only the enlargement ever goes, as it did before in that outfit
- a tie sent without its photo has its pattern drawing right before its close-up (`outfitRefsFull`); a tie's own piece job for assembled pictures still gets its photo, first (`asmPieceJob`, as the shirt's does)
- the A/B (2026-11-11, today's outfit, `gpt-image-2` medium, test keys `c7e5700000000e001/2`): with all 8 references 7,121 image tokens in and 11.45¢, without the suit's and the tie's photos 6,339 and 10.82¢ (about 391 tokens a 270×360 photo); no difference to see that one run to the next doesn't also make
- what a photo costs at `gpt-image-2` rates ($8 per million image tokens in, $5 text in, $30 image out): medium is 1,756 output tokens (5.3¢), high 7,024 (21.1¢); an outfit photo with 8 references is about 11¢, not the 7¢ the app's texts say
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
- background redraws of Today (photos arriving, weather, the start-up plan check, the queue) go through `refreshToday()`: while Settings is open they set `todayStale` and wait for it to close, since `renderToday` closes Settings (it snapped shut when opened right after launch)
- out of rotation: the item sheet's Rotation card has "Take out of rotation" / "Put back in rotation" (`togglePause`); taking it out releases upcoming days it was pinned to (`force`), the picker and "Suggest another" leave it out (`slotPool`/`swapSlot`; correcting a past day still offers it), and its grid box is dimmed with an "Out of rotation" tag (`.gi.paused`, `.pausetag`)
- Wardrobe boxes are one tap target (photo, type eyebrow `.gtype`, name) with no buttons; Delete (`.danger`) is in the item sheet; Add and the editor use one set of labels (Type, Colour, Second colour, Third colour) and dropdown labels start with a capital (`cap1`)
- bought, on the way: the Add card has "Bought, on the way" (`orderRow`/`setOrder`) with an optional Arrives date (`setArrives`); `save()` stores it paused; the grid tag reads "On the way · <date>", the open item can change the date (`setItemArrives`) or "It arrived: put in rotation"; `checkArrivals()` (start-up and `newDayCheck`) puts items back in rotation the day after their date, with a toast
- weather:
  - 16-day forecast
  - beyond it `loadClimate()` fills `climate` in core.js with the location's usual monthly highs from Open-Meteo's archive, kept in `localStorage.wx_norm`, so `dayClimate()` does not fall back to a temperate calendar

### `stats.js`

- the stats page (Settings → Wardrobe stats, `openStats`/`renderStats`, shown as the `#stats` section by `show('stats')`): `buildStats()` counts what was really worn (`wornDays()`: day records from when the wardrobe existed, not days marked "Not worn") and what is planned for the next six months (`plannedDays()`)
- never-worn pieces with a reason (`whyUnused`)
- `whyUnused` reads every jacket's best outfit overall and per shirt and tie from one table built once per page (`fitMemo`, reset in `buildStats`); it used to search again for every unused piece (94 s at 250 items)
- 'Your scores' (`#st-trend`): what was really worn, the average score of each of the last `TREND_WEEKS` (8) weeks as columns (red when a day had a hard check), with the worn average, the days with a real mistake and the plan's average
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
  - a direct outfit request (not a queued job) answers with OpenAI's token counts (`usage`), to measure what a photo costs
  - a photo's record keeps OpenAI's token counts (`usage`), so `GET /render?key=` shows what it cost
  - a queued job can be a one-piece edit too (`swap`, `mask`, `markup` kept in the job): a direct request waiting minutes is cut off by some proxies
  - photos under test keys (`c7e57…`) expire from KV after 7 days (`renderTtl`)
  - a one-piece edit of a kept photo (assemble.js builds and sends these jobs): `swap {what, text}` with the photo as `image`, the new piece's photos as `refs`, and a `mask` (PNG with alpha, the photo's size) or a `markup` layer; the prompt is `SWAP_PROMPT`
  - the room behind him is spelled out in `BACKDROP` (daylight from the left; far out of focus, a plain light office wall, off-white and pale grey, light but not glowing; the blurred corner of a wooden desk with a laptop at lower right; a brighter strip of daylight at the far left; nothing else: the room of the photo the owner chose as the model; a furnished office with rows of desks was too busy and too sharp): "softly blurred bright office background" came back as blown-out windows, different every time
  - `master:true` adds `MASTER_NOTE` to an outfit photo's prompt (plain cloth, no tie bar or pocket square): the master of assembled photos
  - `baseKey`: the photo to edit is one kept in KV (`render:<baseKey>`, the master), so a piece job uploads no image; while it isn't there the job retries
  - `swap.add` uses `SWAP_ADD_PROMPT` (add one thing, keep the rest): a tie bar on the master, which has none
  - `swap.what` is one of `SWAP_KEEP` (jacket, waistcoat, shirt, tie, tie bar, watch): the prompt lists every other piece as staying exactly as it is; a jacket swap keeps the cut and changes only the cloth
- Photos are saved per outfit combination (`comboKey()` in app.js: the shirt by base colour only; the jacket/tie/clip/watch by how they look; plus the vest) as `render:c<16 hex>` in KV (no expiry) and in `meta`, so a combination is never generated twice.
- `DELETE /render?key=` removes a kept photo (one made wrong)
- GET/PUT `/render?key=` share a photo between devices; `GET /render?list=1` lists every kept key. Older `render:<date>` copies are migrated on first use.
- POST `{mode:'queue'}` keeps an outfit's inputs as `job:<key>` in KV and sends `{key}` to the Cloudflare Queue `wardrobe-renders` (binding `RENDER_QUEUE`).
  - Its consumer (`queue()` export) makes the photo in the background, retrying temporary OpenAI errors and recording others as `jobfail:<key>`.
  - GET `/render-queue` lists pending and failed jobs.
  - KV lists are capped at 1,000 a day on the free plan: polling `/render-queue` (two lists a time) used them up and every list threw (error 1101); the app now sends `?keys=` and the worker reads each key (`jobfail:`, `jobrun:`, `job:`), never listing; without keys, and for `GET /render?list=1`, a failed list answers 503 instead of crashing
  - the consumer retries a message whose `job:` it can't see yet (20 s, up to 6 tries): KV can take a minute to show the job written just before the message, and acking it lost the photo, which sat "pending" for days
  - OpenAI calls have a 5-minute limit (`OPENAI_MS`); a job that keeps throwing is recorded as `jobfail:` after 4 tries; `jobrun:<key>` {attempts, at} is reported as `running` by `/render-queue`
  - the app offers "Try again" for a photo waiting over 10 minutes (`renderStalled`, `STALL_MS`), which queues it again
  - `GET /render-queue` heals stuck jobs: one not started 3 min after queueing (`jobrun` attempts 0, written by `queueRender`) or started over 20 min ago is sent to the queue again (`START_STALE_MS`/`RUN_STALE_MS`, `resends` in `jobrun`), and after 3 resends recorded as `jobfail:`; a legacy job without `jobrun` uses its own `t`
  - the app moves a photo's wait start to the worker's resend time (`running[k].at`), and the `#busy` pill doesn't count stalled photos
  - the push: the queue consumer hands each finished photo (or failure) to the Durable Object `RenderHub` (binding `RENDER_HUB`, `tellHub`), which answers the app's held `GET /render-wait?keys=…&ms=` (`waitForRenders`) with the photo itself (KV can lag a minute); results are kept 10 minutes in memory for an app between waits; no binding → 501 and the app only polls
  - the app holds `/render-wait` open while photos are queued and it is visible (`waitPush`, `PUSH_WAIT` 90 s, `takeQueued`); polling `/render-queue` is the backup on a schedule (`queueDelay`: first look 40 s after sending, then 20 s, 60 s after 5 min; `scheduleQueueCheck`, `rqGet().sentAt`)
  - a queued photo missing from `/render-queue` and not yet made counts as lost only after `LOST_MS` (45 min, from `rqGet().at[key]`): KV lists lag up to a minute, and giving up early made the push be ignored (the photo showed only after a reload); `takeQueued` keeps any pushed photo, waited for or not
  - `checkQueue` and `takeQueued` apply their changes to a fresh copy of the waiting list, so a push and a poll finishing together don't undo each other
  - The Settings month batch uses the queue and falls back to generating on the page when the worker has no queue.
  - Today's Generate and Settings → Regenerate also use the queue (`generateRender` → `queueCombo(o,replace)`), so the app can be swiped, closed or locked; `{replace:true}` makes the worker queue and make it though a photo is kept; the button shows "Making photo…" while the combination is queued (`renderPending`), a failure shows its reason with "Try again" (`renderFail`); the app checks the queue every 20 s while open; a worker without the queue still makes it on the page
- Deployed automatically by `.github/workflows/deploy-worker.yml` (Wrangler, config in `wrangler.toml`) when a merge to `main` changes it.
  - It creates the queue if missing, so the token needs Queues edit.
  - Needs the repo's `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID` / `WARDROBE_KV_ID` variables; until then the workflow skips and the user deploys by hand.
  - its test step is `npm test`: on `main` that selects nothing when the merged branch was tested (the map carries the fingerprint of `main`'s files) and every test when it was not, so a normal deploy runs no test and needs no browser
  - the step "Which tests will run" (`node tests/run.js --changed --list`) decides: Chromium is installed only when the answer is not one of `tests/impact.js`'s two "nothing runs" sentences (`tests/deploy.test.js` checks they still match)
  - when a browser is needed, the system packages (`npx playwright install-deps chromium`, apt) get two minutes and may fail with a warning, and the browser download is tried three times; no step uses `--with-deps`
  - why: on 2026-11-11 the runners could not resolve `archive.ubuntu.com` / `security.ubuntu.com` / `azure.archive.ubuntu.com` for hours, and runs 46–50 failed in `npx playwright install --with-deps chromium` (apt, nine font packages) although no test was going to run; the runner image was the same as in the last good run (`ubuntu-26.04` 20261101.186.1)
  - the workflow installs with `npm install --no-package-lock`: a `package-lock.json` written on the runner is a new file, the selection said "Running everything: package-lock.json changed", and run 52 (the first with the selection step) installed the browser and ran all 1488 checks before deploying
  - that run 52 is the browser path tried on a runner: apt was cut off after its two minutes (the mirrors still unreachable), the browser downloaded at the first try, and the whole suite passed without the font packages (1488 passed, 109 s, three at a time)
  - is the current `worker.js` live: `DELETE /render?key=not-a-key` with the app's Origin answers 400 from a worker that has `delRender`, 405 from an older one (a key that fails `COMBO_RE` deletes nothing)

**Planner rules:** whenever a change alters how outfits are chosen (planner.js scoring, groups, rotation), bump `PLAN_RULES` in planner.js. On the next start the app clears swaps and vest choices on every day after today (`checkPlanRules()` / `replanFuture()` in app.js; formal days, today and past days stay), so the new rules apply to the whole future. Settings has "Re-plan upcoming days" for the same on demand.

Colours always come from the item's tagged colours, matched by brightness rank, never from the photo, except an item's `sett`: it is read from the white-balanced sharp photo or close-up at the user's request, so its bands keep their measured colours. Pattern lists in `PATS_BY` (core.js) must stay in sync with the prompt in `worker.js`, and so must the per-type colour lists (`COLS_BY` / `DIAL_COLS` in core.js = `TYPE_COLORS` / `DIAL_COLS` in worker.js; `tests/colouraudit.test.js` checks it). Each item type offers only colours it really comes in; an off-list tag moves to the closest allowed colour (`fitCol`), and a colour an existing item already has stays selectable for it.

## Testing

`npm run test:all` (or `node tests/run.js`) serves the repo, drives it in headless Chromium and checks rendering, swipe/layout on phone and iPhone Duo viewports, the planner against an independent rule checklist, belts/leather/metals, the outfit score, photo-less adding, pattern detection, and `worker.js` with mocked bindings. Add a check for every behaviour you change; extra suites can go in `tests/*.test.js`.

- After a tap, tests wait with `settle(page, ms)` (passed to every test file) instead of a fixed `waitForTimeout`: it returns once no animation runs and the scroll is still, waiting up to 2×`ms` (`DEBUG_SETTLE=1` logs each wait)
- `tests/run.js` gives every `tests/*.test.js` file one shared Chromium (a file's `chromium.launch()`/`close()` open and close only its own contexts) and prints the slowest files at the end.
- tests run several at a time: `tests/run.js` starts worker processes (`node tests/run.js --worker`; `together`, `worker`), one fewer than the processor cores, at most 8; `TEST_JOBS=<n>` sets the number, and `TEST_JOBS=1` runs them one after another in one process, printing as it goes
- each worker process has its own local server, Chromium, recorder and Node coverage (`bench`) and runs one test at a time, so two tests never share any of them; the built-in suites of `run.js` are handed out like the files
- a test's lines are kept in its worker and printed together when it finishes (`• name`, then its checks); the parent adds up the counts and what each test used, and writes `tests/impact.map` once at the end
- the slowest tests start first, by the times of the last run (`node_modules/.cache/dw-test-times.json`, never committed)
- a worker process that dies fails the test it was running, and another takes its place
- measured on 4 cores, recording on: the whole suite takes 273 s one after another and 103 s three at a time (three runs, 1426 checks, none failed); four at a time (74–87 s without recording) made one or two timing-dependent checks fail in each of three runs, hence one fewer than the cores
- a test that fails while others are running is run once more by itself after the rest (`RETRY_MAX` 5 such tests at most; more than that is not the load), which is how every test ran before; only that run counts, and the summary names it ("failed with other tests running, passed by itself")
- when the summary names a test that way, make its check wait for its condition: a test must not rely on a quiet machine (`settle`, `waitForFunction`, a short polling loop, not a fixed time); `daysoff`, `itempics`, `wardrobetap`, `todaytight`, `tagging` each had such a check, and `itempics` and `weather` (the formal day's shirt) were still seen failing under load once
- `window.appReady` is set once the kept photos are loaded (`loadRenders`, which starts `renders` afresh): tests put photos into `renders` right after it, and on a busy machine the load came later and wiped them (`navfit` waited 30 s for a photo)
- the recorder loads `worker.js` in Node before any test (`prepare`) and gives what ran then to every test that runs any of it: Node loads a module once per process, so its load-time code used to be noted for the first test that imported it only
- the map from a parallel run against one recorded one after another (both from nothing, 31,251 entries): 47–82 entries differ, where two parallel runs differ by 26–65; all are functions a timer fires (the scheduled sync, `prefetchRenders`, `lockUpcoming`), a few more of them in parallel because a test takes longer; the map only adds up, so that only selects more
- test selection (`tests/impact.js`; `npm test` = `node tests/run.js --changed`, `--changed --list` only says what would run): while a test runs, the runner records in `tests/impact.map` every top-level function it runs (the app's scripts in the page over CDP coverage, `worker.js` in Node), every `styles.css` rule that applied to an element, the files its pages were served (`<loaded>`) and the files it read itself or ran in a Web Worker (`<any>`)
- for a change, `git diff` against `origin/main` (committed, uncommitted and new files) is turned into the edited top-level functions and CSS rules (`jsImpact`, `cssImpact`); a test runs when it uses one of them, reads the file, was edited itself or is not in the map yet; comments and spacing select nothing
- a changed top-level constant is followed by name to the functions and constants that name it, in the scripts that share its scope (`follow`), and to the test files that name it
- what can't be narrowed selects every test that loads the file: other top-level code, `index.html`, a new selector that no plain rule covers, an `@media` condition, `@keyframes`, a script V8 can't parse
- a top-level block called on the spot (`(()=>{…})()`) runs at load in every test, so by itself it tells no tests apart: its own functions (the listeners it installs) are recorded and selected as units, named `<block>>name` (`units`, `kids`, `flat`; `scan` lists them by compiling the block's body inside a function that does nothing)
- the block's own name (`@{<its first statement>}`) stands for its load-time code: an edit there, a listener added to it, or a whole block added or removed still selects every test that loads the file (left as it was: what runs at load can reach any test, and a new block has no record to select by)
- a listener in a block is named after the code before it (`@el.addEventListenertouchmove`); two alike in one file share a name, which only selects more
- a selector new to the sheet (a rule added or its selector changed, inside `@media` or not) can only apply where its last compound matches: when an old unconditional rule's plain selector (one compound of a tag, classes and ids) asks for no more than that compound (`.head` for `.sheet .head::before`, `.card` for `.card.on`), only the tests that used that old rule are selected (`within` in `cssImpact`)
- no such plain rule (`.card .dot b`, a class only styled inside `@media`): every test that loads the sheet, as before
- a whole `@media` block added or removed counts as its rules; an edited condition is still the stylesheet as a whole
- a class inside `:not(…)` no longer makes a rule "for a new class" (`.card:not(.fresh)` styles the old cards); `selNeeds` reads only what an element must have, outside brackets
- after `main` was merged in, `select` looks for the newest commit of the branch from before that merge whose fingerprint is in the map (`lastPass`): `npm test` passed there, and it passed on `main`, so a test can only have turned if both the change that came in (`impactOf` from that commit) and the branch's own (`impactOf` from `origin/main`) can affect it
- the tests both select run; with a file changed on both sides (docs and the map aside), or when the incoming change selects everything, the branch's whole selection runs; without such a commit nothing changes
- `tests/run.js`, `tests/impact.js` and `package.json` select everything; so does a missing map or a missing `origin/main`
- a change to a file the browser gets also runs the built-in suite "renders the outfit without errors" (the app still starts); `sw.js` is otherwise covered only by `tests/sw.test.js`, since service-worker code isn't recorded
- the map adds up: what a test used is added to what it used before (timers make two runs differ slightly), names and tests that no longer exist are dropped (`save`)
- Chromium answers no coverage request while a page load is pending and drops the old document's coverage, so the recorder reads it just before `goto`/`reload` and before a page or context closes (`recorder`); a test that navigates another way would lose what it ran before
- `npm test` fetches `origin/main` before comparing (`baseOf`): a cloud session's own copy of it can be months old with its history cut short, and then no common commit is found and everything would run
- the fingerprint: a passing `npm test` (or whole suite; not a run by name) writes `# tested <hash>` into the map, a hash of every file's content but the map, `*.md` and `LICENSE` (`fingerprint`, the same for a folder and for the commit made from it)
- `select` trusts the map only when `origin/main`'s copy carries the fingerprint of `origin/main`'s own files; otherwise it says so and runs everything, which records and stamps anew (a map left out of a commit, an edit after the last test run, two changes merged on GitHub without a run on the result, an edit made on github.com)
- the push check is `.githooks/pre-push` (`node tests/impact.js pre-push`, `prePush`): it refuses an uncommitted map and prints a note when the commit's files were not passed by `npm test` (a note only, so a branch with failing tests can still be pushed); every test run switches it on in the clone (`installHook`: `git config core.hooksPath .githooks`, unless hooks are already set up otherwise)
- docs-only changes (`*.md`) need no `npm test`: they are not part of the fingerprint
- `NO_IMPACT=1` turns the recording off; `TEST_BASE=<commit>` compares with another commit; `tests/impact.test.js` checks the selection

### Writing a change the selector can narrow

- New behaviour goes inside a function that is called from where it is used, not in a block that runs when the script loads: `shopSwipe()` is called from `openShop()`, so only tests that open the sheet run it.
- A listener is installed by such a function the first time it is needed (a flag like `shopSwipeOn` keeps it to once), not by a top-level `(()=>{…})()` or `document.addEventListener(…)`.
- A new top-level `const`/`let` is fine: it is followed by name to the functions that use it.
- Don't add the call to a function that every test runs (`show()`, `renderToday()`, `closeShop()`): an edit there selects everything; call it from the narrowest function that needs it.
- A new visual element gets its own class name (`.shop-grab`), not a new selector built from existing classes or a `::before` on an existing element: a rule for a class the app never had selects no existing test.
- State for an existing element also gets a new class (`.x.new-state`) rather than new declarations in its base rule: a rule that applies on every page (`#shop-sheet`, `body`, `.card`) selects every page test when its declarations change, and rightly so.
- Check before running: `node tests/run.js --changed --list` says what changed and which tests it selects; "top-level code" or "the stylesheet as a whole" in that line means the change can be restructured.
- Measured on the swipe-down change (handler and grabber): as a load-time block with `.shop-top-head::before` it selected 89 of 91; as `shopSwipe()` from `openShop()` with `.shop-grab` it selects 5 (`shop`, `shopswipe`, the start-up suite, and two tests that read `shop.js` as text).
- The slide-away part of that change edits the rules of `#shop-sheet` and `#shop-backdrop`, which are on every page: it selects 89 of 91 however it is written.
- Other measurements: an edit inside the item sheet's `touchmove` listener selected 89 of 91 and now 5; a new `.ivhead::after` rule selected 89 and now 17.

The user's phone may run the Dark Reader extension. The page opts out via the `darkreader-lock` meta tag; keep it.
