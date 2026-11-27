// The notice board (bus.js; the restructure, step 0's pilot, 2026-11-25): how a file tells a screen something without naming it.
// Node only. bus.js itself (pin order, one throw doesn't stop the rest, the first error thrown on, heard), and the topics the app
// uses: TOPICS lists each with who announces it and who listens, and the test fails on a topic the files use that isn't listed, a
// listed announcer or listener that no longer does it, a listener with nobody announcing, or an announcement nobody hears.
const fs=require('fs'),path=require('path'),vm=require('vm');
const {appSrc}=require('./appsrc');

/* topic -> {emit: files that announce it, on: files that pin for it (in load order), what: what it means} */
const TOPICS={
  'settings-open':{emit:['settings.js'],on:['ui.js','sync-status.js'],what:'Settings is opening: the Advanced folds close, the Backup line is written'},
  'settings-draw':{emit:['settings.js'],on:['daysoff.js','weather.js','ui.js','dress.js','own-lists.js','care.js'],what:'Settings is drawn: each part draws its own rows'},
  'settings-summaries':{emit:['settings.js'],on:['weather.js','daysoff.js','ui.js','dress.js','account.js','calendar.js','remind.js'],what:'the category summaries are written: parts fill in what only they know'},
  'settings-parts':{emit:['settings.js'],on:['look.js','account.js','calendar.js','remind.js'],what:'the parts drawn last (settingsPart)'},
  'settings-category':{emit:['settings.js'],on:['care.js','snapshots.js','about.js'],what:'a category opened (its key)'},
  'settings-saved':{emit:['settings.js'],on:['sync.js'],what:'the settings were stored: a backup soon'},
  'settings-closed':{emit:['settings.js'],on:['nav.js'],what:'Settings closed (the page a sync changed meanwhile, or null)'},
  'connection-saved':{emit:['settings.js'],on:['sync.js'],what:'Done stored the connection: a backup now'},
  'connection-typed':{emit:['settings.js'],on:['account.js'],what:'another address or code typed in Connection: the account decides'},
  'folding-all':{emit:['today.js'],on:['ui.js'],what:'a swipe to another day folds everything at once (true), and is done (false): the folds are quiet meanwhile'},
  'day-changed':{emit:['month.js','history.js'],on:['today.js'],what:'the day shown or its record changed (a day opened from the month, a swap, a pick, a mark, an occasion, Reset): Today is drawn again'},
  'backup-changed':{emit:['sync.js'],on:['sync-status.js'],what:'the backup\'s status changed (a sync ran, failed, paused or was held): the Backup line is written again'},
  'figure-cloth':{emit:['draw.js'],on:['today.js'],what:'the mannequin\'s cloth for an item is ready (draw.js figCuGet): Today\'s figure is drawn again with it'},
  'invite-ended':{emit:['app.js'],on:['sync-status.js','account.js'],what:'the invitation this phone uses has ended: the Backup line, then the account box, say so'},
  'page-showing':{emit:['nav.js'],on:['settings.js'],what:'a page is being shown (its name): Settings closes'},
  'page-back':{emit:['nav.js'],on:['settings.js'],what:'the phone\'s Back with no page over Settings: Settings, when open, does what Done does'},
  'sub-opening':{emit:['nav.js'],on:['settings.js'],what:'a page opens over another (subOpen): Settings, when open, fills in S.set, its open categories and scroll'},
  'sub-back':{emit:['nav.js'],on:['settings.js'],what:'that page goes back to Settings (subBack, with what S.set held): Settings opens as it was'},
  'sample-asked':{emit:['stats.js'],on:['kit.js'],what:'"Try a sample wardrobe" tapped on an empty Insights or Packing list (heard: whether the button is offered)'},
  'card-changed':{emit:['measure.js','pattern-read.js','tagging.js','checklist.js','add-keep.js','own-lists.js','colpick.js','add-more.js','add-save.js','add-card.js','add-sheet.js','account.js'],on:['add.js'],what:'an Add card changed (a field, a reading, a measurement): Add is drawn again (the restructure S3c: the files loaded before add.js never call renderAdd; S6c: nor account.js, another group)'},
  'wardrobe-changed':{emit:['app.js','pattern-read.js','checklist.js','photos.js','colpick.js','add-card.js','look.js','fav.js','item-photo.js','item-view.js','wardrobe.js','care.js','shop.js','sync.js','kit.js'],on:['itemsheet.js'],what:'a piece changed (or the Wardrobe\'s filter): the Wardrobe and the item sheet are drawn again (renderWardrobe; the restructure S3d: the files loaded before itemsheet.js never call it; S6c: nor shop.js, sync.js and kit.js, other groups, where the Wardrobe shows)'},
};

/* name -> {serve: files that serve it (one), ask: files that ask for it (in load order), what: what it does}. A socket is how a
   required (or today-no-picture) file calls into an optional one without importing it (tests/load-contract.json) */
const SOCKETS={
  'add-for':{serve:'add-sheet.js',ask:['nav.js'],what:'Add opened with the type Today\'s "Add one" asked for, or that type dropped when Add is left (setAddFor; the restructure S3c)'},
  'nps-leave':{serve:'add-sheet.js',ask:['nav.js'],what:'Add is left with the "Add without a photo" sheet open: it goes, its Back entry handed back first (npsLeave)'},
  'add-draw':{serve:'add.js',ask:['nav.js'],what:'Add is shown: it is drawn (renderAdd)'},
  'setup-yield':{serve:'setup.js',ask:['nav.js'],what:'a page is shown: a setup that opened by itself steps aside (setupYield)'},
  'shop-close':{serve:'shop.js',ask:['nav.js'],what:'another page is shown: What to buy closes (closeShop)'},
  'pack-show':{serve:'pack.js',ask:['nav.js'],what:'a page is shown: the packing list page shows or hides (packShow)'},
  'setup-needs':{serve:'setup.js',ask:['stats.js'],what:'what the wardrobe still needs before a day can be dressed (setupNeeds), for Insights'},
  'shop-button':{serve:'shop.js',ask:['stats.js'],what:'What to buy\'s button on Insights (shopButton)'},
  'fav-stats-card':{serve:'fav.js',ask:['stats.js'],what:'the favorites card on Insights (favStatsCard)'},
  'cpw-stats-card':{serve:'cost.js',ask:['stats.js'],what:'the cost-per-wear card on Insights (cpwStatsCard)'},
  'item-open':{serve:'item-view.js',ask:['toast.js','nav.js','checklist.js','item-photo.js'],what:'which piece the item sheet has open: its id, or null (editing; the restructure S3d)'},
  'item-draw':{serve:'item-view.js',ask:['nav.js','checklist.js'],what:'the item sheet is drawn again, or put away when nothing is open (renderItem)'},
  'item-drop':{serve:'item-view.js',ask:['nav.js'],what:'another page is shown: the item sheet goes without sliding (dropItem)'},
  'wardrobe-draw':{serve:'itemsheet.js',ask:['nav.js'],what:'the Wardrobe is shown: it is drawn (renderWardrobe)'},
  'backed-up-words':{serve:'sync.js',ask:['setup.js'],what:'how the backup stands, in words, for the setup\'s Connection step (backedUpWords)'},
  'look-use-pick':{serve:'look.js',ask:['colpick.js'],what:'the color sheet\'s Use on a material, leather, metal or buckle (lookUsePick; the restructure S5d: colpick.js loads before look.js)'},
  'look-set-enamel':{serve:'look.js',ask:['colpick.js'],what:'a tie clip\'s enamel set from the color sheet (lookSetEnamel)'},
  'look-write':{serve:'look.js',ask:['colpick.js'],what:'a field written from the color sheet: a watch\'s dial (lookWrite)'},
  'look-pick-draw':{serve:'look.js',ask:['colpick.js'],what:'the color sheet drawn as the material, leather, metal or buckle picker (renderLookPick)'},
  'look-sug-cols':{serve:'look.js',ask:['colpick.js'],what:'the color sheet\'s Suggested colors in the beta (lookSugCols)'},
  'look-sug-pats':{serve:'look.js',ask:['colpick.js'],what:'the pattern sheet\'s Suggested patterns in the beta (lookSugPats)'},
  'look-shade-html':{serve:'look.js',ask:['colpick.js'],what:'the beta\'s Shade under the color sheet\'s preview (lookShadeHtml)'},
  'item-set':{serve:'itemsheet.js',ask:['colpick.js','look.js'],what:'a saved piece\'s field set as the item sheet sets it (sete; the restructure S5d: both load before itemsheet.js)'},
  'pat-summary':{serve:'itemsheet.js',ask:['look.js'],what:'the item sheet\'s pattern layout in words, under the Look beta\'s Pattern row (patSummary)'},
  'pat-redetect':{serve:'itemsheet.js',ask:['look.js'],what:'Read pattern from photo, from the Look beta\'s Pattern row (redetect)'},
  'pat-clear':{serve:'itemsheet.js',ask:['look.js'],what:'Use generic, from the Look beta\'s Pattern row (clearStripes)'},
  'care-tag':{serve:'care.js',ask:['wardrobe.js'],what:'a piece away being cleaned, in words, on its Wardrobe tile (careTag; the restructure S5d: wardrobe.js loads before care.js)'},
  'care-badge':{serve:'care.js',ask:['wardrobe.js'],what:'"Due for cleaning" on a Wardrobe tile (careBadge)'},
  'care-log':{serve:'care.js',ask:['add-more.js'],what:'a piece back from the cleaner noted in its record (careLog)'},
  'care-back-text':{serve:'care.js',ask:['add-more.js'],what:'the toast for pieces back from the cleaner (careBackText)'},
  // the painter's (the restructure S6p, 2026-11-27): where a today-no-picture file (assemble, asm-look, asm-today, draw), a required one
  // (settings, start), another optional group (today-picture, look, itemsheet, mannequin's typeof reads) or a lower layer (fav) calls into
  // the painter's optional files, or the painter into a file that loads after it
  'asm-build':{serve:'asm-color.js',ask:['assemble.js'],what:'one picture painted on the page, where no worker can (asmBuild; the restructure S6p, 2026-11-27: moved into asm-color.js, which assemble.js, today-no-picture, may not import)'},
  'asm-cm-warming':{serve:'asm-color.js',ask:['assemble.js'],what:'whether the masters are being warmed, so the worker is not let go (asmCmWarming, for asmIdle)'},
  'asm-cm-kind':{serve:'asm-color.js',ask:['draw.js','asm-look.js','asm-today.js'],what:'the color-coded master a look takes, or null (asmCmKind): the mannequin drawn, the picture asked for'},
  'asm-nk-base-of':{serve:'asm-color.js',ask:['asm-look.js','asm-today.js'],what:'a new garment\'s base master (asmNkBaseOf)'},
  'asm-cm-btn-col':{serve:'asm-color.js',ask:['mannequin.js'],what:'the painter\'s own button color, for the drawn mannequin (asmCmBtnCol)'},
  'asm-cu-v':{serve:'asm-color.js',ask:['draw.js','today-picture.js'],what:'the close-up block\'s version (ASM_CU.v), in the mannequin\'s and the swatch\'s cloth keys'},
  'asm-wt-v':{serve:'asm-color.js',ask:['draw.js'],what:'the worsted tile\'s version (ASM_WT.v), in the mannequin\'s cloth key'},
  'asm-hb-lift':{serve:'asm-color.js',ask:['today-picture.js'],what:'the herringbone shirt\'s lift and row (ASM_HB_COL_LIFT, ASM_HB_SHIRT_Y), in the swatch\'s key'},
  'asm-gl-try':{serve:'asm-gl.js',ask:['asm-color.js'],what:'a look painted on the graphics chip, or null (asmGlTry; asm-gl.js loads after asm-color.js and imports it)'},
  'asm-gl-free':{serve:'asm-gl.js',ask:['assemble.js'],what:'the page\'s graphics state let go with the worker (asmGlFree)'},
  'asm-gl-note':{serve:'asm-gl.js',ask:['assemble.js'],what:'which painter painted a picture, for Settings\' line (asmGlNote)'},
  'asm-gl-on-page':{serve:'asm-gl.js',ask:['assemble.js'],what:'whether a covered look is drawn on the page\'s chip (asmGlOnPage)'},
  'asm-gl-state':{serve:'asm-gl.js',ask:['assemble.js'],what:'the page\'s graphics state (asmGlState), for asmRunPage'},
  'asm-gl-page':{serve:'asm-gl.js',ask:['assemble.js'],what:'the page\'s draw of a covered look (asmGlPage)'},
  'asm-watch-paint':{serve:'asm-watch.js',ask:['asm-color.js'],what:'the day\'s watch painted on the finished picture (asmWatchPaint)'},
  'asm-pocket-paint':{serve:'asm-pocket.js',ask:['asm-color.js'],what:'the pocket square painted on the finished picture (asmPocketPaint)'},
  'asm-pocket-quad':{serve:'asm-pocket.js',ask:['mannequin.js'],what:'where the pocket square sits, for the drawn mannequin (asmPocketQuad)'},
  'asm-ocp-paint':{serve:'asm-ocp.js',ask:['asm-color.js'],what:'the uniform blouse\'s tapes and rank painted on the finished picture (asmOcpPaint)'},
  'asm-nk-base':{serve:'asm-kinds.js',ask:['asm-color.js'],what:'a new garment\'s base master (asmNkBase; asm-kinds.js loads after asm-color.js)'},
  'asm-job':{serve:'asm-cm-job.js',ask:['asm-look.js'],what:'everything a look\'s painting needs, as plain data, or null (asmJob)'},
  'asm-kind-of':{serve:'asm-cm-job.js',ask:['asm-look.js','asm-today.js'],what:'a look\'s master kind, the new garments\' included (asmKindOf)'},
  'asm-cm-out-key':{serve:'asm-cm-job.js',ask:['asm-look.js'],what:'a look\'s picture key (asmCmOutKey)'},
  'asm-cm-stamp':{serve:'asm-cm-job.js',ask:['asm-look.js'],what:'the newest record date a look is painted from (asmCmStamp)'},
  'asm-cm-bg-get':{serve:'asm-cm-job.js',ask:['asm-today.js'],what:'the masters\' background brought onto the device (asmCmBgGet)'},
  'asm-cm-route':{serve:'asm-cm-job.js',ask:['draw.js','today-picture.js'],what:'how the painter lays a piece\'s cloth (asmCmRoute)'},
  'asm-cu-wants':{serve:'asm-cm-job.js',ask:['draw.js','today-picture.js'],what:'whether the painter takes the close-up block (asmCuWants)'},
  'asm-wt-wants':{serve:'asm-cm-job.js',ask:['draw.js'],what:'whether the painter takes the worsted tile (asmWtWants)'},
  'asm-cu-tile':{serve:'asm-cm-job.js',ask:['draw.js','today-picture.js'],what:'the close-up block (asmCuTile)'},
  'asm-worsted-tile':{serve:'asm-cm-job.js',ask:['draw.js'],what:'the worsted tile (asmWorstedTile)'},
  'asm-cm-tile':{serve:'asm-cm-job.js',ask:['today-picture.js'],what:'a shirt\'s painted cloth tile, for its swatch (asmCmTile)'},
  'asm-hb-shirt':{serve:'asm-cm-job.js',ask:['today-picture.js'],what:'whether a shirt is painted as herringbone (asmHbShirt)'},
  'asm-gap-note':{serve:'asm-cm-job.js',ask:['look.js','itemsheet.js'],what:'the item sheet\'s "Outfit pictures: …" line (asmGapNote)'},
  'asm-cm-mf-get':{serve:'asm-cm-page.js',ask:['asm-today.js'],what:'the masters\' manifest (asmCmMfGet)'},
  'asm-cm-get':{serve:'asm-cm-page.js',ask:['asm-today.js'],what:'a master\'s records brought onto the device (asmCmGet)'},
  'asm-cm-ensure':{serve:'asm-cm-page.js',ask:['asm-today.js'],what:'a look\'s picture painted, kept and shown (asmCmEnsure)'},
  'asm-cm-warm':{serve:'asm-cm-page.js',ask:['asm-today.js'],what:'the coming looks\' masters set up ahead (asmCmWarm)'},
  'asm-cm-ui':{serve:'asm-cm-page.js',ask:['asm-today.js'],what:'Settings\' Pictures ahead and Painted plain rows (asmCmUI)'},
  'asm-suit-weave':{serve:'asm-look.js',ask:['draw.js'],what:'the weave the painter reads from a jacket, for the drawn figure (asmSuitWeave)'},
  'asm-load':{serve:'asm-today.js',ask:['start.js'],what:'the painted pictures kept on the device read at start-up (asmLoad)'},
  'asm-sync':{serve:'asm-today.js',ask:['settings.js','start.js'],what:'the pictures on the server listed, the day\'s painted (asmSync)'},
  'asm-ensure':{serve:'asm-today.js',ask:['settings.js'],what:'the day\'s picture painted when "Painted pictures" is chosen again (asmEnsure)'},
  'asm-ui':{serve:'asm-today.js',ask:['settings.js','start.js'],what:'Settings\' Outfit pictures Advanced rows drawn (renderAsmUI)'},
  'pattern-readable':{serve:'pattern-read.js',ask:['asm-cm-job.js'],what:'whether a piece\'s pattern can be read, for Painted plain (readable; the painter may not import the Add group)'},
  'pattern-reread':{serve:'pattern-read.js',ask:['asm-cm-page.js'],what:'Read N patterns: a piece\'s pattern read again (rereadSett)'},
  'refresh-today':{serve:'settings.js',ask:['asm-today.js','asm-cm-page.js'],what:'Today redrawn when its picture is ready (refreshToday; settings.js loads after the painter)'},
  'plan-on':{serve:'month.js',ask:['asm-today.js','asm-cm-page.js'],what:'a day\'s planned outfit, for building ahead and Pictures ahead (planOn; month.js loads after the painter)'},
  'swatch-svg':{serve:'draw.js',ask:['fav.js'],what:'a piece\'s swatch on the favorites (swatchSVG; fav.js, a logic file, may not import the painter)'},
  // the restructure S6c (2026-11-27, STEP6 rule 3): an optional file's call into another group it doesn't need, or into a file of its own
  // group that loads after it
  'sync-soon':{serve:'sync.js',ask:['locks.js','add-save.js','pack.js','wardrobe.js','kit.js'],what:'a backup soon, after a change (scheduleSync; the restructure S6c: sync.js loads after its callers)'},
  'sync-now':{serve:'sync.js',ask:['daysoff.js','dress.js','kit.js','about.js'],what:'a backup now, its answer whether it went (syncNow)'},
  'sync-redraw':{serve:'sync.js',ask:['pattern-read.js'],what:'a sync\'s redraw of a page, which waits while Settings is open (syncRedraw)'},
  'sync-needs-pull':{serve:'sync.js',ask:['migrate.js'],what:'whether this phone must pull first, before remaking pictures (syncNeedsPull)'},
  'sync-later-run':{serve:'sync.js',ask:['today-gestures.js','item-view.js'],what:'the redraw a gesture or the item sheet held back runs now (syncLaterRun)'},
  'sync-stop':{serve:'sync.js',ask:['about.js'],what:'the backup that was due is called off (clearTimeout(syncTimer)), before the device is wiped'},
  'sync-running':{serve:'sync.js',ask:['about.js'],what:'the backup under way, if any (syncRun)'},
  'err-note':{serve:'safety.js',ask:['pattern-read.js','tagging.js','add-save.js','add-card.js','add.js','shop.js','about.js'],what:'an error noted for the error report (errNote)'},
  'save-failed':{serve:'safety.js',ask:['add-save.js','kit.js'],what:'a failed save on this phone told (saveFailed)'},
  'tag-failed':{serve:'safety.js',ask:['add.js'],what:'a card\'s failed tagging noted on it (tagFailed)'},
  'guard-unsaved':{serve:'safety.js',ask:['add-keep.js'],what:'the warning before the tab closes over unsaved cards (guardUnsaved)'},
  'err-report':{serve:'safety.js',ask:['about.js'],what:'the problems noted on this phone, for Feedback (errReport)'},
  'sync-store-tell':{serve:'safety.js',ask:['sync.js'],what:'a storage failure during a sync told (syncStoreTell)'},
  'safari-remind':{serve:'kit.js',ask:['safety.js'],what:'Safari\'s \"Download a backup\" reminder (safariRemind)'},
  'ward-pending-restore':{serve:'wardrobe.js',ask:['safety.js'],what:'a name typed just before the app was killed put back (wardPendingRestore)'},
  'add-restore':{serve:'add-keep.js',ask:['safety.js'],what:'the Add cards not saved before the app was closed brought back (addRestore)'},
  'app-version':{serve:'about.js',ask:['safety.js'],what:'the app\'s version, for the error report (appVersion)'},
  'acct-role':{serve:'who.js',ask:['safety.js','sync.js','kit.js','about.js'],what:'the role this phone is connected as: owner, tester or null (acctRole)'},
  'acct-me':{serve:'who.js',ask:['colpick.js','look.js'],what:'the account the server answered (acct.me), whose lookups count is kept up to date'},
  'kit-quiet':{serve:'kit.js',ask:['add-keep.js'],what:'whether the sample or an import is being written (kitQuiet)'},
  'kit-saved':{serve:'kit.js',ask:['add-save.js'],what:'\"Saved\", with Undo, for an item saved from Add (kitSaved)'},
  'paper-tip':{serve:'kit.js',ask:['item-photo.js'],what:'the white paper tip opened (kitOpen([PAPER_CARD]))'},
  'kit-sample-tag':{serve:'kit.js',ask:['wardrobe.js'],what:'a sample piece\'s tag on its Wardrobe tile (kitSampleTag)'},
  'kit-duplicate':{serve:'kit.js',ask:['wardrobe.js'],what:'a piece duplicated (kitDuplicate)'},
  'kit-sample-note':{serve:'kit.js',ask:['itemsheet.js'],what:'the item sheet\'s note on a sample piece (kitSampleNote)'},
  'kit-no-mine':{serve:'kit.js',ask:['itemsheet.js'],what:'a change that doesn\'t make a sample piece his, on and off (setKitNoMine)'},
  'kit-share-filter':{serve:'kit.js',ask:['sync.js'],what:'what of the sample wardrobe a backup sends (kitShareFilter)'},
  'kit-sent-stamp':{serve:'kit.js',ask:['sync.js'],what:'a sample day\'s stamp as sent (kitSentStamp)'},
  'kit-share-done':{serve:'kit.js',ask:['sync.js'],what:'the sample days sent noted (kitShareDone)'},
  'kit-shown':{serve:'kit.js',ask:['account.js'],what:'whether the kit\'s sheet is open'},
  'home-open':{serve:'kit.js',ask:['account.js'],what:'the Home Screen sheet opened (homeOpen)'},
  'kit-home-close':{serve:'kit.js',ask:['setup.js'],what:'the kit\'s Home Screen sheet closed when the setup shows its own step'},
  'tour-open':{serve:'kit.js',ask:['setup.js'],what:'the tour of the app, then what comes after it (tourOpen)'},
  'home-steps':{serve:'kit.js',ask:['setup.js'],what:'the Home Screen steps, for the setup\'s step (homeSteps)'},
  'kit-start-row':{serve:'kit.js',ask:['setup.js'],what:'Import from a spreadsheet and Try a sample wardrobe (kitStartRow)'},
  'home-tester':{serve:'kit.js',ask:['setup.js'],what:'whether a tester\'s invitation link can be copied (homeTester)'},
  'home-copy-btn':{serve:'kit.js',ask:['setup.js'],what:'Copy my invitation link (homeCopyBtn)'},
  'kit-sample-load':{serve:'kit.js',ask:['setup.js'],what:'the sample wardrobe loaded (kitSampleLoad)'},
  'kit-import-open':{serve:'kit.js',ask:['setup.js'],what:'the spreadsheet import opened (kitImportOpen)'},
  'kit-open':{serve:'kit.js',ask:['calendar.js'],what:'a walkthrough opened over the app (kitOpen)'},
  'home-about':{serve:'kit.js',ask:['about.js'],what:'About\'s Add to Home Screen button (homeAbout)'},
  'setup-shown':{serve:'setup.js',ask:['account.js','kit.js'],what:'whether the setup is on screen (setupShown)'},
  'setup-finish':{serve:'setup.js',ask:['kit.js'],what:'the setup finished (setupFinish)'},
  'setup-sample':{serve:'setup.js',ask:['kit.js'],what:'the sample wardrobe from the setup\'s last step (setupSample)'},
  'setup-conn-draw':{serve:'setup.js',ask:['account.js'],what:'the setup\'s Connection and All set steps drawn again, when showing'},
  'setup-ward-empty':{serve:'setup.js',ask:['wardrobe.js'],what:'the empty Wardrobe\'s first steps (setupWardEmpty)'},
  'tz-country':{serve:'setup.js',ask:['weather.js'],what:'the country of the phone\'s time zone (tzCountry)'},
  'invite-checking':{serve:'account.js',ask:['add.js','setup.js'],what:'whether an invitation link is being checked (inviteChecking)'},
  'acct-why':{serve:'account.js',ask:['add.js','setup.js'],what:'why the last invitation link didn\'t connect (acctWhy)'},
  'connect-link':{serve:'account.js',ask:['setup.js'],what:'an invitation link pasted in the setup connects (connectFromLink)'},
  'acct-fail-text':{serve:'account.js',ask:['setup.js'],what:'what an invitation that failed says (acctFailText)'},
  'limit-note':{serve:'account.js',ask:['pattern-read.js'],what:'today\'s limit on readings said (limitNote)'},
  'wipe-device':{serve:'about.js',ask:['account.js'],what:'this phone cleared (wipeDevice)'},
  'about-note':{serve:'about.js',ask:['account.js'],what:'the key of About\'s one-time note (ABOUT_NOTE)'},
  'add-texture':{serve:'add.js',ask:['colpick.js','add-card.js'],what:'a close-up added to an Add card (addTexture)'},
  'retry-tag':{serve:'add.js',ask:['add-card.js'],what:'an Add card tagged again, its Try again (retryTag)'},
  'drop-texture':{serve:'add.js',ask:['add-card.js'],what:'an Add card\'s close-up removed (dropTexture)'},
  'col-form':{serve:'colpick.js',ask:['tagging.js'],what:'the New color sheet on an Add card\'s main color, with Claude\'s name (openColForm)'},
  'pat-form':{serve:'colpick.js',ask:['tagging.js'],what:'the New pattern sheet on an Add card\'s pattern, with Claude\'s name (openPatForm)'},
  'multi-msg':{serve:'add.js',ask:['add-save.js'],what:'Add\'s line for several items (multiMsg)'},
  'add-calm':{serve:'add.js',ask:['add-save.js'],what:'the calm Add keeps while a card closes (addCalm)'},
  'measure-guess':{serve:'add.js',ask:['add-card.js'],what:'an Add card measured again after a type chosen (measureGuess)'},
  'wb-note':{serve:'add.js',ask:['add-card.js'],what:'an Add card\'s white balance note (wbNote)'},
  'skip-card':{serve:'add.js',ask:['add-sheet.js'],what:'an Add card skipped (skipCard)'},
  'add-back-online':{serve:'add.js',ask:['add-keep.js'],what:'back online: the cards that failed for want of a connection read again (addBackOnline)'},
  'card-set':{serve:'add-card.js',ask:['colpick.js'],what:'an Add card\'s field set as the card sets it (setq)'},
  'card-field':{serve:'add-card.js',ask:['own-lists.js','colpick.js'],what:'an Add card\'s field set and counted as chosen (setQField)'},
  'add-keep':{serve:'add-keep.js',ask:['pattern-read.js','tagging.js','about.js'],what:'the Add cards kept now (addKeep)'},
  'add-keep-soon':{serve:'add-keep.js',ask:['cost.js'],what:'the Add cards kept soon (addKeepSoon)'},
  'look-section':{serve:'look.js',ask:['add-card.js'],what:'the Look beta\'s section of an Add card (lookSection)'},
  'look-save':{serve:'look.js',ask:['add-save.js'],what:'the Look beta\'s fields saved with an item (lookSave)'},
  'look-own-mat-ui':{serve:'look.js',ask:['own-lists.js'],what:'the Look beta\'s own leathers and metals in Settings (lookOwnMatUI)'},
  'new-suit-vest':{serve:'dress.js',ask:['add-save.js','add-card.js'],what:'whether a new suit has a vest (newSuitVest)'},
  'dress-new-item':{serve:'dress.js',ask:['add-save.js','shop.js','kit.js'],what:'the dress code looked at again after a new item (dressNewItem)'},
  'cpw-save-fields':{serve:'cost.js',ask:['add-save.js'],what:'the price and the day bought saved with an item (cpwSaveFields)'},
  'cpw-q-row':{serve:'cost.js',ask:['add-card.js'],what:'an Add card\'s price row (cpwQRow)'},
  'cpw-settings-ui':{serve:'cost.js',ask:['care.js'],what:'the currency and what a cleaning costs, in Laundry & cleaning (cpwSettingsUI)'},
  'cpw-block':{serve:'cost.js',ask:['itemsheet.js'],what:'the item sheet\'s price and cost per wear (cpwBlock)'},
  'cpw-sum':{serve:'cost.js',ask:['itemsheet.js'],what:'the cost per wear in the item sheet\'s summary (cpwSum)'},
  'care-band-soon':{serve:'care.js',ask:['today-picture.js'],what:'the cleaning banner\'s cut follows the swatches (careBandSoon)'},
  'care-state':{serve:'care.js',ask:['itemsheet.js'],what:'a piece\'s wears since cleaning (careState)'},
  'care-card':{serve:'care.js',ask:['itemsheet.js'],what:'the item sheet\'s cleaning card (careCard)'},
  'care-reminders':{serve:'care.js',ask:['remind.js'],what:'the cleaning reminders for the days ahead (careReminders)'},
  'care-unlock':{serve:'locks.js',ask:['add-more.js','care.js'],what:'the locks made while a piece was away released (careUnlock)'},
  'check-arrivals':{serve:'add-more.js',ask:['care.js'],what:'the pieces on order that arrived put in rotation (checkArrivals)'},
  'remind-soon':{serve:'remind.js',ask:['care.js'],what:'the reminders sent again soon (remindSoon)'},
  'fav-ward':{serve:'fav.js',ask:['wardrobe.js'],what:'whether the Wardrobe shows the favorite pieces'},
  'fav-mark':{serve:'fav.js',ask:['wardrobe.js'],what:'a favorite\'s heart on its tile (favMark)'},
  'fav-item-row':{serve:'fav.js',ask:['itemsheet.js'],what:'the item sheet\'s favorite switch (favItemRow)'},
  'fav-chip':{serve:'fav.js',ask:['itemsheet.js'],what:'the Wardrobe\'s Favorites chip (favChip)'},
  'fav-off':{serve:'fav.js',ask:['itemsheet.js'],what:'the Favorites chip let go (favOff)'},
  'item-show':{serve:'item-view.js',ask:['cost.js','kit.js'],what:'a piece opened in the item sheet (openItem)'},
  'item-synced':{serve:'item-view.js',ask:['sync.js'],what:'the item sheet follows a synced copy (itemSynced)'},
  'replace-texture':{serve:'item-photo.js',ask:['colpick.js'],what:'an item\'s close-up replaced (replaceTexture)'},
  'item-field':{serve:'wardrobe.js',ask:['colpick.js'],what:'a saved piece\'s field set as the Wardrobe sets it (setItemField)'},
  'ward-view':{serve:'wardrobe.js',ask:['item-view.js'],what:'the Wardrobe\'s pieces as shown (wardView)'},
  'ward-synced':{serve:'wardrobe.js',ask:['dress.js'],what:'the materials and sock toes of synced pieces from an older app made current'},
  'item-body':{serve:'itemsheet.js',ask:['item-view.js'],what:'the item sheet\'s body (itemBody)'},
  'zoomed':{serve:'today-picture.js',ask:['today-gestures.js'],what:'the picture\'s zoom, or null'},
  'shop-open':{serve:'shop.js',ask:['today-gestures.js'],what:'whether What to buy is open (shopOpen)'},
  'today-busy':{serve:'today-gestures.js',ask:['sync.js'],what:'whether a finger is on Today (todayBusy)'},
  'day-off-add':{serve:'daysoff.js',ask:['calendar.js'],what:'a day off added (dayOffAdd)'},
  'pack-set-trip':{serve:'pack.js',ask:['calendar.js'],what:'a trip set (packSetTrip)'},
  'pack-open':{serve:'pack.js',ask:['calendar.js'],what:'the packing list opened (openPack)'},
  'backup-download':{serve:'backupfile.js',ask:['kit.js'],what:'a backup file downloaded (downloadBackup)'},
  'worn-days':{serve:'stats.js',ask:['care.js'],what:'the days really worn, for the wears since cleaning (wornDays; care.js asks: with an import, a missing stats.js left care.js unrun and Today drew its picture, where main\'s contract says none)'},
  'stat-pic':{serve:'stats.js',ask:['care.js'],what:'a piece\'s small picture in Laundry & cleaning (statPic)'},
  'ph-in':{serve:'sync-photos.js',ask:['sync.js'],what:'a pulled backup\'s photos put back from their references (phIn)'},
  'ph-batch':{serve:'sync-photos.js',ask:['sync.js'],what:'the next batch an upload carries (phBatch)'},
  'ph-out':{serve:'sync-photos.js',ask:['sync.js'],what:'an upload\'s photos sent as references (phOut)'},
  'weather-load':{serve:'weather.js',ask:['sync.js'],what:'the weather loaded again (loadWeather)'},
};

module.exports=async({ok,ROOT})=>{
  /* bus.js itself, run as a script with its export blanked */
  const ctx=vm.createContext({});vm.runInContext(appSrc(ROOT,'bus.js')+';this.B={on,emit,heard,serve,ask,served}',ctx);
  const {on,emit,heard,serve,ask,served}=ctx.B,log=[];
  /* the sockets */
  ok(ask('nobody',1,2)===undefined,'ask for a name nobody serves: nothing is called and the answer is undefined (the old typeof guard)');
  const seen=[];serve('sum',(a,b)=>{seen.push([a,b]);return a+b});
  ok(ask('sum',2,3)===5&&seen.length===1&&seen[0].join()==='2,3','ask calls what is served once, with the arguments, and gives back its answer');
  serve('sum',(a,b)=>a*b);ok(ask('sum',2,3)===6,'the last fn served under a name is the one asked');
  serve('nofn',undefined);ok(ask('nofn')===undefined,'serving something that is not a function serves nothing');
  const sboom=new Error('sboom');serve('throws',()=>{throw sboom});let sgot=null;try{ask('throws')}catch(e){sgot=e}
  ok(sgot===sboom,'an error the served fn throws reaches the one who asked, as a direct call\'s would');
  ok(served('sum')&&!served('nobody')&&!served('nofn'),'served says whether a fn is served under a name (the old typeof guard before a call with other arguments)');
  on('pinned',()=>'heard');ok(emit('sum')===0&&!heard('sum')&&ask('pinned')===undefined&&emit('pinned')===1,'sockets and topics are apart: a served name is no topic, a pinned topic no socket');
  ok(emit('nobody')===0&&!heard('nobody'),'a topic nobody pinned: emit calls nothing and says 0, heard is false');
  const a=x=>log.push('a'+x),b=x=>log.push('b'+x);on('t',a);on('t',b);on('t',a);
  ok(emit('t',1)===2&&log.join()==='a1,b1'&&heard('t'),'each pinned fn is called once, in pin order, with the arguments');
  log.length=0;const boom=new Error('boom'),late=new Error('late');on('u',()=>{log.push(1);throw boom});on('u',()=>log.push(2));on('u',()=>{log.push(3);throw late});
  let got=null;try{emit('u')}catch(e){got=e}
  ok(got===boom&&log.join()==='1,2,3','one that throws does not stop the others, and the first error is thrown on once all have run');
  log.length=0;on('v',()=>{on('v',()=>log.push('new'));log.push('first')});emit('v');
  ok(log.join()==='first','a fn pinned while the topic is being announced is called from the next announcement on');
  /* the topics the app uses */
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),page=[...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
  const used={},sockUsed={};
  const acorn=require('acorn');
  for(const f of page){if(f==='bus.js')continue;const src=fs.readFileSync(path.join(ROOT,f),'utf8');let ast;
    try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'})}catch(e){try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'})}catch(e2){continue}}
    // local name -> bus.js's name (a file that also reads app.js's own ask() imports bus.js's second name for it, askFor; served counts as asking)
    const imp=new Map(ast.body.filter(s=>s.type==='ImportDeclaration'&&s.source.value==='./bus.js').flatMap(s=>s.specifiers.map(x=>[x.local.name,x.imported?x.imported.name:x.local.name])));
    const add=(k,t)=>{const u=used[t]=used[t]||{emit:[],on:[],heard:[]};if(!u[k].includes(f))u[k].push(f)};
    const sock=(k,t)=>{const u=sockUsed[t]=sockUsed[t]||{serve:[],ask:[]};if(!u[k].includes(f))u[k].push(f)};
    const walk=n=>{if(!n||typeof n.type!=='string')return;
      if(n.type==='CallExpression'&&n.callee.type==='Identifier'){const c0=imp.get(n.callee.name)||null,c=c0==='askFor'||c0==='served'?'ask':c0,a=n.arguments[0],lit=a&&a.type==='Literal'&&typeof a.value==='string';
        // (settingsPart(fn) is settings.js's own way to pin for 'settings-parts': counted as the caller's pin)
        if(n.callee.name==='settingsPart'&&f!=='settings.js')add('on','settings-parts');
        else if(c&&/^(?:emit|on|heard)$/.test(c)&&lit&&!(f==='settings.js'&&c==='on'&&a.value==='settings-parts'))add(c,a.value);
        else if(c&&/^(?:serve|ask)$/.test(c)){if(lit)sock(c,a.value);else ok(false,`${f} calls ${n.callee.name}() of bus.js with a name that is not a plain string`)}
        else if(!c&&/^(?:emit|heard|serve)$/.test(n.callee.name))ok(false,`${f} calls ${n.callee.name}() without importing it from './bus.js'`)}
      for(const k in n){const v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v.type==='string')walk(v)}};
    walk(ast)}
  const sockNotListed=Object.keys(sockUsed).filter(t=>!SOCKETS[t]);
  ok(!sockNotListed.length,`every socket the files use is in SOCKETS${sockNotListed.length?': not '+sockNotListed.join(', '):''}`);
  const sbad=[];
  for(const [t,d] of Object.entries(SOCKETS)){const u=sockUsed[t]||{serve:[],ask:[]};
    if(u.serve.length!==1||u.serve[0]!==d.serve)sbad.push(`${t}: served by ${u.serve.join(', ')||'nobody'}, listed ${d.serve}`);
    const order=[...u.ask].sort((x,y)=>page.indexOf(x)-page.indexOf(y));
    if(order.join()!==[...d.ask].sort((x,y)=>page.indexOf(x)-page.indexOf(y)).join()||!order.length)sbad.push(`${t}: asked by ${order.join(', ')||'nobody'}, listed ${d.ask.join(', ')}`)}
  ok(!sbad.length,`each socket is served by the one file SOCKETS lists and asked by the files it lists (${Object.keys(SOCKETS).length} sockets)${sbad.length?': '+sbad.join('; '):''}`);
  const notListed=Object.keys(used).filter(t=>!TOPICS[t]);
  ok(!notListed.length,`every topic the files use is in TOPICS${notListed.length?': not '+notListed.join(', '):''}`);
  const bad=[];
  for(const [t,d] of Object.entries(TOPICS)){const u=used[t]||{emit:[],on:[],heard:[]};
    const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
    if(!same([...u.emit].sort(),[...d.emit].sort()))bad.push(`${t}: announced by ${u.emit.join(', ')||'nobody'}, listed ${d.emit.join(', ')}`);
    const order=[...u.on].sort((x,y)=>page.indexOf(x)-page.indexOf(y));
    if(!same(order,[...d.on].sort((x,y)=>page.indexOf(x)-page.indexOf(y))))bad.push(`${t}: pinned by ${order.join(', ')||'nobody'}, listed ${d.on.join(', ')}`);
    if(!d.emit.length||!d.on.length)bad.push(`${t}: needs an announcer and a listener`);
    for(const f of d.emit)if(page.indexOf(f)<0)bad.push(`${t}: ${f} is not a page script`)}
  ok(!bad.length,`each topic is announced and heard by the files TOPICS lists${bad.length?': '+bad.join('; '):''}`);
  ok(page.indexOf('bus.js')>=0&&page.indexOf('bus.js')<page.indexOf('core.js'),'bus.js is a page script, before core.js (it reads no other file)');
  // (offline, a deep link gets each file from the root's copy, so a module imported by another can run a second time: harmless only for
  // a file that keeps nothing on the page; see RESTRUCTURE-PLAN.md, step 5)
  const bus=fs.readFileSync(path.join(ROOT,'bus.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  ok(!/\b(?:globalThis|window|self|document|localStorage|addEventListener)\b|^\s*import\b/m.test(bus),'bus.js keeps nothing on the page and imports nothing (a second copy of it, as an offline deep link makes, is harmless)');
  const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
  ok(/'bus\.js'/.test(sw),'bus.js is in sw.js ASSETS (offline)');
};
module.exports.TOPICS=TOPICS;
module.exports.SOCKETS=SOCKETS;
