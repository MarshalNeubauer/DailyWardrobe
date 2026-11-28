// The notice board (bus.js; the restructure, step 0's pilot, 2026-11-25): how a file tells a screen something without naming it.
// Node only. bus.js itself (pin order, one throw doesn't stop the rest, the first error thrown on, heard), and the topics the app
// uses: TOPICS lists each with who announces it and who listens, and the test fails on a topic the files use that isn't listed, a
// listed announcer or listener that no longer does it, a listener with nobody announcing, or an announcement nobody hears.
// The typed registry (types/sockets.d.ts, N1, 2026-11-27): it fails on a socket the files use that it doesn't declare, a declared one
// nobody asks, an index signature, a need of a name outside Needs, a hook outside Hooks, and a copy that tools/sockets-dts.js wouldn't
// write; the hooks (register, runHooks, runHooksSeq, slotsOf, hooked) are checked as bus.js runs them. Every name bus.js exports is
// imported by a page file (N7, 2026-11-28: `registered`, which nothing asked, went).
// The hooks (the notice board made clean, N2, 2026-11-27): HOOKS lists each moment with the files that run it and the features that register
// for it, in load order; it fails on a moment used but not listed, a runner or a feature that changed, a feature that registers twice, under
// another name than its file's, or anywhere but as its file's last statement.
const fs=require('fs'),path=require('path'),vm=require('vm');
const {appSrc}=require('./appsrc');

/* topic -> {emit: files that announce it, on: files that pin for it (in load order), what: what it means} */
const TOPICS={
  'settings-closed':{emit:['settings.js'],on:['nav.js'],what:'Settings closed (the page a sync changed meanwhile, or null)'},
  'folding-all':{emit:['today.js'],on:['ui.js'],what:'a swipe to another day folds everything at once (true), and is done (false): the folds are quiet meanwhile'},
  'backup-changed':{emit:['sync.js'],on:['sync-status.js'],what:'the backup\'s status changed (a sync ran, failed, paused or was held): the Backup line is written again'},
  'figure-cloth':{emit:['draw.js'],on:['today.js'],what:'the mannequin\'s cloth for an item is ready (draw.js figCuGet): Today\'s figure is drawn again with it'},
  'page-showing':{emit:['nav.js'],on:['settings.js'],what:'a page is being shown (its name): Settings closes'},
  'page-back':{emit:['nav.js'],on:['settings.js'],what:'the phone\'s Back with no page over Settings: Settings, when open, does what Done does'},
  'sub-opening':{emit:['nav.js'],on:['settings.js'],what:'a page opens over another (subOpen): Settings, when open, fills in S.set, its open categories and scroll'},
  'sub-back':{emit:['nav.js'],on:['settings.js'],what:'that page goes back to Settings (subBack, with what S.set held): Settings opens as it was'},
  'sample-asked':{emit:['stats.js'],on:['kit.js'],what:'"Try a sample wardrobe" tapped on an empty Insights or Packing list (heard: whether the button is offered)'},
  'card-changed':{emit:['measure.js','pattern-read.js','tagging.js','checklist.js','add-keep.js','own-lists.js','colpick.js','add-more.js','add-save.js','add-card.js','add-sheet.js','account.js'],on:['add.js'],what:'an Add card changed (a field, a reading, a measurement): Add is drawn again (the restructure S3c: the files loaded before add.js never call renderAdd; S6c: nor account.js, another group)'},
};

/* name -> {serve: files that serve it (one), ask: files that ask for it (in load order), what: what it does}. A socket is how a
   file calls into one it doesn't import (a lower layer calling up, or tests/load-contract.json's `optional`); A3-A10 turn most into imports */
const SOCKETS={
  'add-draw':{serve:'add.js',ask:['nav.js','settings.js'],what:'Add is shown: it is drawn (renderAdd)'},
  'setup-needs':{serve:'setup.js',ask:['month.js','stats.js'],what:'what the wardrobe still needs before a day can be dressed (setupNeeds), for Insights'},
  'item-open':{serve:'item-view.js',ask:['toast.js','nav.js','checklist.js','item-photo.js'],what:'which piece the item sheet has open: its id, or null (editing; the restructure S3d)'},
  'item-draw':{serve:'item-view.js',ask:['nav.js','checklist.js'],what:'the item sheet is drawn again, or put away when nothing is open (renderItem)'},
  'backed-up-words':{serve:'sync.js',ask:['ui.js','setup.js'],what:'how the backup stands, in words, for the setup\'s Connection step (backedUpWords)'},
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
  'asm-gl-free':{serve:'asm-gl.js',ask:['assemble.js'],what:'the page\'s graphics state let go with the worker (asmGlFree)'},
  'asm-gl-note':{serve:'asm-gl.js',ask:['assemble.js'],what:'which painter painted a picture, for Settings\' line (asmGlNote)'},
  'asm-gl-on-page':{serve:'asm-gl.js',ask:['assemble.js'],what:'whether a covered look is drawn on the page\'s chip (asmGlOnPage)'},
  'asm-gl-state':{serve:'asm-gl.js',ask:['assemble.js'],what:'the page\'s graphics state (asmGlState), for asmRunPage'},
  'asm-gl-page':{serve:'asm-gl.js',ask:['assemble.js'],what:'the page\'s draw of a covered look (asmGlPage)'},
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
  'pattern-readable':{serve:'pattern-read.js',ask:['asm-cm-job.js'],what:'whether a piece\'s pattern can be read, for Painted plain (readable; the painter may not import the Add group)'},
  'pattern-reread':{serve:'pattern-read.js',ask:['asm-cm-page.js'],what:'Read N patterns: a piece\'s pattern read again (rereadSett)'},
  'refresh-today':{serve:'settings.js',ask:['asm-today.js','asm-cm-page.js','photos.js','missed.js','today.js','migrate.js'],what:'Today redrawn when its picture is ready, or a read sett was recolored at start-up (refreshToday; settings.js loads after the painter)'},
  'plan-on':{serve:'month.js',ask:['asm-today.js','asm-cm-page.js'],what:'a day\'s planned outfit, for building ahead and Pictures ahead (planOn; month.js loads after the painter)'},
  // the restructure S6b (2026-11-27, STEP6 rule 2): what a required or today-no-picture file asks of a file it may not import, through
  // need (a ReferenceError when nothing is served, as the bare name threw when the file was missing)
  'announce':{serve:'app.js',ask:['toast.js'],what:"words read out by the live region (announce): the Undo button's"},
  'today-draw':{serve:'today.js',ask:['nav.js','settings.js'],what:"Today drawn (renderToday): the router, Settings closing, a redraw; without today.js the router still throws, so start-up says \"Today couldn’t be shown\""},
  'pics-drawn':{serve:'photo-keys.js',ask:['settings.js','start.js'],what:"whether \"Drawing only\" is chosen (picsDrawn)"},
  'today-home':{serve:'today.js',ask:['settings.js'],what:"Today on the home day follows a workday taken away (keepHome)"},
  'conn-keep':{serve:'app.js',ask:['settings.js'],what:"the database's copy of the connection follows (connKeep)"},
  'meta-get':{serve:'app.js',ask:['settings.js','start.js'],what:"a value read from the database's meta store (metaGet): the stored settings, the plan snapshot"},
  'meta-put':{serve:'app.js',ask:['photo-keys.js','settings.js'],what:"a value written to the database's meta store (metaPut): the settings"},
  'sel-day':{serve:'app.js',ask:['settings.js','start.js'],what:"the day Today shows (sel)"},
  'plan-for':{serve:'today-plan.js',ask:['settings.js'],what:"the plan of the month shown (planFor)"},
  'has-outfit':{serve:'today-plan.js',ask:['settings.js'],what:"whether a planned day has an outfit (hasOutfit)"},
  'plan-dirty':{serve:'today-plan.js',ask:['app.js','days.js','settings.js'],what:"the cached plan is stale (planDirty)"},
  'asm-live':{serve:'photos.js',ask:['settings.js','start.js'],what:"whether the painter is on (asmLive)"},
  'locks-clear':{serve:'days.js',ask:['settings.js'],what:"the coming days' locks let go after a rules change (clearLocks)"},
  'after-dom':{serve:'app.js',ask:['start.js'],what:"fn once the page's scripts have run (afterDom)"},
  'after-scripts':{serve:'app.js',ask:['start.js'],what:"fn once the page has loaded (afterScripts)"},
  'stored-clean':{serve:'app.js',ask:['start.js'],what:"the stored items and days checked as start-up reads them (cleanStored)"},
  'stored-settings-clean':{serve:'app.js',ask:['start.js'],what:"the stored settings checked as start-up reads them (cleanStoredSettings)"},
  'conn-restored':{serve:'app.js',ask:['start.js'],what:"the connection put back from the database (connRestored, a promise): start-up's reads wait for it"},
  'sel-set':{serve:'app.js',ask:['start.js'],what:"the day Today shows set (setSel)"},
  'view-set':{serve:'app.js',ask:['start.js'],what:"the month shown set (setView)"},
  'tex-swatches':{serve:'app.js',ask:['start.js'],what:"the one-time close-up swatches remade (texSwatches)"},
  'tx':{serve:'app.js',ask:['start.js'],what:"a transaction on the items store (tx): start-up reads the items"},
  'txs':{serve:'app.js',ask:['photo-keys.js','start.js'],what:"a transaction on a store (txs): start-up reads the days"},
  'plan-snap':{serve:'today-plan.js',ask:['start.js'],what:"the plan snapshot's key in the meta store (PLAN_SNAP)"},
  'plan-snap-use':{serve:'today-plan.js',ask:['start.js'],what:"the stored plan snapshot taken at start-up (planSnapUse)"},
  'wx-preload':{serve:'today.js',ask:['start.js'],what:"the kept weather put in place at start-up (wxPreload)"},
  'home-day':{serve:'month.js',ask:['start.js'],what:"the day Today opens on (homeDay)"},
  'when-pulled':{serve:'history.js',ask:['start.js'],what:"fn once the first pull is in (whenPulled)"},
  'weather-load':{serve:'weather.js',ask:['today.js','start.js','sync.js'],what:"the weather loaded (loadWeather): start-up, a sync"},
  'renders-load':{serve:'photo-keys.js',ask:['start.js'],what:"the kept pictures read at start-up (loadRenders)"},
  'renders':{serve:'photo-keys.js',ask:['start.js'],what:"the kept pictures (renders)"},
  'item-backdrops-fix':{serve:'photos.js',ask:['start.js'],what:"the one-time gray backdrops of item pictures (fixItemBackdrops)"},
  'belt-stuck':{serve:'pickscore.js',ask:['history.js'],what:"the words when the belt has to stay (BELT_STUCK)"},
  'pick-follow':{serve:'pickscore.js',ask:['history.js'],what:"which slots follow a swapped or picked one (FOLLOW)"},
  'beltless':{serve:'pickscore.js',ask:['history.js'],what:"whether a belt would need shoes that don't suit the outfit (beltless)"},
  'boots-off':{serve:'pickscore.js',ask:['history.js'],what:"combat boots taken off with pants they don't go with (bootsOff)"},
  'fit-of':{serve:'pickscore.js',ask:['history.js'],what:"how well a piece fits the outfit, for the picker (fitOf)"},
  'fit-tag':{serve:'pickscore.js',ask:['history.js'],what:"the picker's words for a fit (fitTag)"},
  'hand-pool':{serve:'pickscore.js',ask:['history.js'],what:"the picker's \"Casual · pick by hand\" pieces (handPool)"},
  'hand-why':{serve:'pickscore.js',ask:['history.js'],what:"why a hand-pick piece is offered (handWhy)"},
  'keep-hand':{serve:'pickscore.js',ask:['history.js'],what:"a hand-pick piece kept through a pick (keepHand)"},
  'keep-off':{serve:'pickscore.js',ask:['history.js'],what:"a piece taken off stays off through a swap or pick (keepOff)"},
  'pick-sub':{serve:'pickscore.js',ask:['history.js'],what:"a picker card's second line (pickSub)"},
  'pocket-on':{serve:'pickscore.js',ask:['history.js'],what:"a pick puts a taken-off pocket square back (pocketOn)"},
  'slot-pool':{serve:'pickscore.js',ask:['history.js'],what:"the picker's scored pieces (slotPool)"},
  'suggest-clean':{serve:'pickscore.js',ask:['history.js'],what:"Suggest another keeps the day clean (suggestClean)"},
  'suit-pants':{serve:'pickscore.js',ask:['history.js'],what:"a suit's own pants follow its jacket (suitPants)"},
  'unlock-clash':{serve:'locks.js',ask:['history.js'],what:"the coming days' locks that clash with a changed day let go (unlockClash)"},
  'lock-upcoming':{serve:'locks.js',ask:['today.js'],what:"the coming week locked after Today records its days (lockUpcoming)"},
  'pic-open-ready':{serve:'today-photofold.js',ask:['today.js'],what:"a piece's photo opened in its row (picOpenReady)"},
  'pic-shut':{serve:'today-photofold.js',ask:['today.js'],what:"a piece's photo shut (picShut)"},
  'pic-snap':{serve:'today-photofold.js',ask:['today.js'],what:"another row's photo shut at once (picSnap)"},
  'pic-stop':{serve:'today-photofold.js',ask:['today.js'],what:"a photo's motion stopped for another tile (picStop)"},
  'zoom-apply':{serve:'today-picture.js',ask:['today.js'],what:"the picture's zoom put back after a redraw (applyZoom)"},
  'ovl-piece':{serve:'today-picture.js',ask:['today.js'],what:"a cloth swatch on the picture (ovlPiece)"},
  'sw-tap':{serve:'today-picture.js',ask:['today.js'],what:"a swatch tapped: it opens up close (swTap)"},
  'ph-edit':{serve:'item-photo.js',ask:['photos.js'],what:"the photo editor's state (phEdit): a crop under way holds the Wardrobe's redraw"},
  'horizon-keys':{serve:'analysis.js',ask:['stats.js'],what:"the workdays Insights and What to buy measure (horizonKeys)"},
  'dress-why-unused':{serve:'dress.js',ask:['stats.js'],what:"why shoes are never worn, without jackets (dressWhyUnused)"},
  // the restructure S6c (2026-11-27, STEP6 rule 3): an optional file's call into another group it doesn't need, or into a file of its own
  // group that loads after it
  'sync-soon':{serve:'sync.js',ask:['app.js','days.js','locks.js','missed.js','history.js','add-save.js','pack.js','wardrobe.js','kit.js'],what:'a backup soon, after a change (scheduleSync; the restructure S6c: sync.js loads after its callers)'},
  'sync-now':{serve:'sync.js',ask:['daysoff.js','dress.js','kit.js','about.js'],what:'a backup now, its answer whether it went (syncNow)'},
  'sync-redraw':{serve:'sync.js',ask:['pattern-read.js','photos.js'],what:'a sync\'s redraw of a page, which waits while Settings is open (syncRedraw)'},
  'sync-needs-pull':{serve:'sync.js',ask:['migrate.js'],what:'whether this phone must pull first, before remaking pictures (syncNeedsPull)'},
  'sync-later-run':{serve:'sync.js',ask:['history.js','today-gestures.js','item-view.js'],what:'the redraw a gesture or the item sheet held back runs now (syncLaterRun)'},
  'sync-stop':{serve:'sync.js',ask:['about.js'],what:'the backup that was due is called off (clearTimeout(syncTimer)), before the device is wiped'},
  'sync-running':{serve:'sync.js',ask:['about.js'],what:'the backup under way, if any (syncRun)'},
  'err-note':{serve:'safety.js',ask:['pattern-read.js','tagging.js','scorecard.js','start.js','add-save.js','add-card.js','add.js','shop.js','about.js'],what:'an error noted for the error report (errNote)'},
  'save-failed':{serve:'safety.js',ask:['add-save.js','kit.js'],what:'a failed save on this phone told (saveFailed)'},
  'tag-failed':{serve:'safety.js',ask:['add.js'],what:'a card\'s failed tagging noted on it (tagFailed)'},
  'guard-unsaved':{serve:'safety.js',ask:['add-keep.js'],what:'the warning before the tab closes over unsaved cards (guardUnsaved)'},
  'err-report':{serve:'safety.js',ask:['about.js'],what:'the problems noted on this phone, for Feedback (errReport)'},
  'sync-store-tell':{serve:'safety.js',ask:['sync.js'],what:'a storage failure during a sync told (syncStoreTell)'},
  'app-version':{serve:'about.js',ask:['safety.js'],what:'the app\'s version, for the error report (appVersion)'},
  'acct-role':{serve:'who.js',ask:['ui.js','safety.js','sync.js','kit.js','about.js'],what:'the role this phone is connected as: owner, tester or null (acctRole)'},
  'acct-me':{serve:'who.js',ask:['ui.js','photos.js','colpick.js','look.js'],what:'the account the server answered (acct.me), whose lookups count is kept up to date'},
  'kit-quiet':{serve:'kit.js',ask:['add-keep.js'],what:'whether the sample or an import is being written (kitQuiet)'},
  'paper-tip':{serve:'kit.js',ask:['item-photo.js'],what:'the white paper tip opened (kitOpen([PAPER_CARD]))'},
  'kit-duplicate':{serve:'kit.js',ask:['wardrobe.js'],what:'a piece duplicated (kitDuplicate)'},
  'kit-no-mine':{serve:'kit.js',ask:['itemsheet.js'],what:'a change that doesn\'t make a sample piece his, on and off (setKitNoMine)'},
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
  'tz-country':{serve:'setup.js',ask:['weather.js'],what:'the country of the phone\'s time zone (tzCountry)'},
'country-codes':{serve:'daysoff.js',ask:['setup.js'],what:'the countries with a holiday list (COUNTRY_CODES) (the restructure S6g)'},
'holiday-country-set':{serve:'daysoff.js',ask:['setup.js'],what:"the time zone's holidays fetched at the setup's end (setHolidayCountry) (the restructure S6g)"},
  'invite-checking':{serve:'account.js',ask:['ui.js','add.js','setup.js'],what:'whether an invitation link is being checked (inviteChecking)'},
  'acct-why':{serve:'account.js',ask:['ui.js','add.js','setup.js'],what:'why the last invitation link didn\'t connect (acctWhy)'},
  'connect-link':{serve:'account.js',ask:['ui.js','setup.js'],what:'an invitation link pasted in the setup connects (connectFromLink)'},
  'acct-fail-text':{serve:'account.js',ask:['ui.js','setup.js'],what:'what an invitation that failed says (acctFailText)'},
  'limit-note':{serve:'account.js',ask:['pattern-read.js'],what:'today\'s limit on readings said (limitNote)'},
  'wipe-device':{serve:'about.js',ask:['account.js'],what:'this phone cleared (wipeDevice)'},
  'about-note':{serve:'about.js',ask:['account.js'],what:'the key of About\'s one-time note (ABOUT_NOTE)'},
  'add-keep':{serve:'add-keep.js',ask:['pattern-read.js','about.js','toast.js'],what:'the Add cards kept now (addKeep)'},
  'add-keep-soon':{serve:'add-keep.js',ask:['cost.js'],what:'the Add cards kept soon (addKeepSoon)'},
  'dress-new-item':{serve:'dress.js',ask:['add-save.js','shop.js','kit.js'],what:'the dress code looked at again after a new item (dressNewItem)'},
  'care-band-soon':{serve:'care.js',ask:['today-picture.js'],what:'the cleaning banner\'s cut follows the swatches (careBandSoon)'},
  'care-reminders':{serve:'care.js',ask:['remind.js'],what:'the cleaning reminders for the days ahead (careReminders)'},
  'care-unlock':{serve:'locks.js',ask:['add-more.js','care.js'],what:'the locks made while a piece was away released (careUnlock)'},
  'check-arrivals':{serve:'add-more.js',ask:['today.js','start.js','care.js'],what:'the pieces on order that arrived put in rotation (checkArrivals)'},
  'remind-soon':{serve:'remind.js',ask:['days.js','start.js','care.js'],what:'the reminders sent again soon (remindSoon)'},
  'fav-ward':{serve:'fav.js',ask:['wardrobe.js'],what:'whether the Wardrobe shows the favorite pieces'},
  'fav-mark':{serve:'fav.js',ask:['history.js','wardrobe.js'],what:'a favorite\'s heart on its tile (favMark)'},
  'fav-chip':{serve:'fav.js',ask:['itemsheet.js'],what:'the Wardrobe\'s Favorites chip (favChip)'},
  'fav-off':{serve:'fav.js',ask:['itemsheet.js'],what:'the Favorites chip let go (favOff)'},
  'item-show':{serve:'item-view.js',ask:['cost.js'],what:'a piece opened in the item sheet (openItem)'},
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
  // the restructure S6f (2026-11-27): the required and today-no-picture files' last reads of later or optional files, and the up-reads
  'look-on':{serve:'look-base.js',ask:['core.js'],what:"whether the Look beta is on (lookOn), for what a tag request names (core.js tagTypesNow; the restructure S6f)"},
  'plan-start':{serve:'planner.js',ask:['today-plan.js'],what:"the first day a month's plan starts from (planStart) (the restructure S6f)"},
  'plan-build':{serve:'planner.js',ask:['today-plan.js'],what:"a month planned alone (buildPlan) (the restructure S6f)"},
  'plan-sim':{serve:'planner.js',ask:['today-plan.js'],what:"the shared simulation of the months ahead (planSim) (the restructure S6f)"},
  'sett-sig':{serve:'detect.js',ask:['photo-keys.js'],what:"a reading's key (settSig), in a shirt's or a piece's picture key (the restructure S6f)"},
  'usable-sett':{serve:'detect.js',ask:['photo-keys.js'],what:"a piece's reading if it can be drawn (usableSett), for a shirt's picture key (the restructure S6f)"},
  'stripe-pats':{serve:'detect.js',ask:['photo-keys.js'],what:"the striped patterns (STRIPE_PATS), for a shirt's picture key (the restructure S6f)"},
  'check-pats':{serve:'detect.js',ask:['photo-keys.js'],what:"the checked patterns (CHECK_PATS), for a shirt's picture key (the restructure S6f)"},
  'is-tester':{serve:'who.js',ask:['app.js','ui.js','settings.js'],what:"whether this phone is a tester's (isTester) (the restructure S6f)"},
  'apply-role':{serve:'who.js',ask:['ui.js'],what:"the page follows who is connected (applyRole) (the restructure S6f)"},
  'ended-answer':{serve:'app.js',ask:['photo-keys.js'],what:"whether a server answer says the invitation ended (endedAnswer) (the restructure S6f)"},
  'invite-ended':{serve:'app.js',ask:['photo-keys.js'],what:"an ended invitation is taken in: the code forgotten, the person told once (inviteEnded) (the restructure S6f)"},
  'tag-extras':{serve:'tag-request.js',ask:['app.js'],what:"what a tag request sends beside the photo (tagExtras) (the restructure S6f)"},
  'toast':{serve:'toast.js',ask:['app.js'],what:"a toast (toast.js toast), for app.js, which loads before it (the restructure S6f)"},
  'load-failed':{serve:'toast.js',ask:['assemble.js'],what:"a file that failed once the app is running: the toast with Reload (toast.js loadFailed; all or nothing, A1), for assemble.js, a painting-worker file, which imports only the painter's"},
  'kit-user-edit':{serve:'kit.js',ask:['app.js'],what:"an edit in the item sheet makes a sample piece his (kitUserEdit) (the restructure S6f)"},
  'tag-why':{serve:'safety.js',ask:['app.js'],what:"why the last tag request failed (safety.js tagWhy) (the restructure S6f)"},
  'tag-net-last':{serve:'safety.js',ask:['app.js'],what:"whether the last tag request failed on the network (tagNetLast) (the restructure S6f)"},
  'tag-fail-text':{serve:'safety.js',ask:['app.js'],what:"the words for a failed tag request (tagFailText) (the restructure S6f)"},
  'tell':{serve:'ui.js',ask:['app.js'],what:"a plain notice (ui.js tell), for app.js, which loads before it (the restructure S6f)"},
  'nps-id':{serve:'add-sheet.js',ask:['ui.js'],what:"the piece the \"Add without a photo\" sheet is open for (npsId) (the restructure S6f)"},
  'nps-inert':{serve:'add-sheet.js',ask:['ui.js'],what:"the rest of Add out of reach around that sheet (npsInert) (the restructure S6f)"},
  'settings-close':{serve:'settings.js',ask:['ui.js','today.js'],what:"Settings closes (closeSettings) (the restructure S6f)"},
  'picker-close':{serve:'history.js',ask:['ui.js'],what:"the piece picker closes (closePicker) (the restructure S6f)"},
  'nps-asking':{serve:'add-sheet.js',ask:['ui.js'],what:"that sheet asks a question (npsAsking) (the restructure S6f)"},
  'nps-cancel':{serve:'add-sheet.js',ask:['ui.js'],what:"that sheet closes (npsCancel) (the restructure S6f)"},
  'cat-toggle':{serve:'settings.js',ask:['ui.js'],what:"a Settings category folds or unfolds (toggleCat) (the restructure S6f)"},
  'settings-extras':{serve:'settings.js',ask:['ui.js'],what:"Settings' parts drawn again (renderSettingsExtras) (the restructure S6f)"},
  'settings-open':{serve:'settings.js',ask:['ui.js','today.js'],what:"Settings opens, on a part (openSettings) (the restructure S6f)"},
  'show-cost':{serve:'settings.js',ask:['photos.js'],what:"whether costs are shown (showCost) (the restructure S6f)"},
  'week-first':{serve:'settings.js',ask:['month.js','scorecard.js'],what:"the work week's first day (weekFirst) (the restructure S6f)"},
  'after-pull':{serve:'sync.js',ask:['history.js'],what:"a call once the first pull is merged (afterPull) (the restructure S6f)"},
  'settings-save-user':{serve:'settings.js',ask:['history.js'],what:"the settings saved (saveUserSettings) (the restructure S6f)"},
  'fav-strip':{serve:'fav.js',ask:['history.js'],what:"the picker's favorite looks strip (favStrip) (the restructure S6f)"},
  'fav-pieces':{serve:'fav.js',ask:['history.js'],what:"a favorite look's pieces (favPieces) (the restructure S6f)"},
  'fav-undo-ms':{serve:'fav.js',ask:['history.js'],what:"how long a favorite's Undo stays (FAV_UNDO_MS) (the restructure S6f)"},
  'list-open-set':{serve:'today.js',ask:['history.js'],what:"the pieces list opens (setListOpen) (the restructure S6f)"},
  'today-dirty':{serve:'settings.js',ask:['history.js','today.js'],what:"Today drawn again when Settings closes (todayDirty) (the restructure S6f)"},
  'formal-ui':{serve:'daysoff.js',ask:['history.js'],what:"Settings' occasions drawn again (renderFormalUI) (the restructure S6f)"},
  'fav-why':{serve:'fav.js',ask:['scorecard.js'],what:"the score card's \"a favorite look\" line (favWhy) (the restructure S6f)"},
  'temp':{serve:'weather.js',ask:['scorecard.js'],what:"a temperature in the person's units (temp) (the restructure S6f)"},
  'pulled-yet':{serve:'sync.js',ask:['today.js'],what:"whether the first pull is merged (pulledYet) (the restructure S6f)"},
  'wx-unit':{serve:'weather.js',ask:['setup.js'],what:"the person's temperature unit (unit); served = the setup's Weather step is shown (the restructure S6h)"},
  'wx-units-set':{serve:'weather.js',ask:['setup.js'],what:'the temperature unit chosen (setUnits) (the restructure S6h)'},
  'wx-location-set':{serve:'weather.js',ask:['setup.js'],what:'the weather location set (setLocation) (the restructure S6h)'},
  'wx-locate':{serve:'weather.js',ask:['setup.js'],what:'Use my location (useMyLocation) (the restructure S6h)'},
  'wx-city-find':{serve:'weather.js',ask:['setup.js'],what:'the city search (findCity) (the restructure S6h)'},
  'wx-city-found':{serve:'weather.js',ask:['setup.js'],what:"the city search's answers (cityFound) (the restructure S6h)"},
  'wx-city-found-set':{serve:'weather.js',ask:['setup.js'],what:"the city search's answers cleared (setCityFound) (the restructure S6h)"},
  'storage-down':{serve:'safety.js',ask:['start.js'],what:"the page for a phone whose storage can't be read (storageDown) (the restructure S6f)"},
  'safety-start':{serve:'safety.js',ask:['start.js'],what:"start-up's safety checks: Add's unsaved cards back, the error report (safetyStart) (the restructure S6f)"},
};

/* moment -> {run: the files that run it (runHooks, runHooksSeq, slotsOf, hooked), register: the features (each its file) with a hook for it,
   in load order}. What each moment means, and which are run and which are slots, is tools/sockets-dts.js HOOKS (types/sockets.d.ts Hooks) */
const HOOKS={
  'start-checks':{run:['start.js'],register:['history.js','dress.js','kit.js']},
  'start-jobs':{run:['start.js'],register:['asm-today.js','daysoff.js','setup.js']},
  'start-safety':{run:['safety.js'],register:['add-keep.js','wardrobe.js','kit.js']},
  'after-pull-fixups':{run:['start.js'],register:['migrate.js','item-photo.js']},
  'synced':{run:['start.js','sync.js'],register:['dress.js','item-view.js','wardrobe.js']},
  'settings-open':{run:['settings.js'],register:['ui.js','sync-status.js']},
  'settings-draw':{run:['settings.js'],register:['ui.js','daysoff.js','weather.js','dress.js','own-lists.js','care.js','cost.js']},
  'settings-rows':{run:['settings.js','start.js'],register:['asm-today.js','photos.js','history.js','sync.js']},
  'settings-parts':{run:['settings.js'],register:['look.js','account.js','calendar.js','remind.js']},
  'settings-summary':{run:['settings.js'],register:['ui.js','daysoff.js','weather.js','dress.js','account.js','calendar.js','remind.js']},
  'settings-category':{run:['settings.js'],register:['care.js','snapshots.js','about.js']},
  'settings-saved':{run:['settings.js'],register:['sync.js']},
  'connection-saved':{run:['settings.js'],register:['sync.js']},
  'connection-typed':{run:['settings.js'],register:['account.js']},
  'pictures-switched':{run:['settings.js'],register:['asm-today.js','photos.js']},
  'page-shown':{run:['nav.js'],register:['stats.js','pack.js','add-sheet.js','item-view.js','itemsheet.js','shop.js','setup.js']},
  'today-parts':{run:['today.js'],register:['today-picture.js','weather.js','fav.js','care.js','kit.js','setup.js','calendar.js']},
  'today-fold':{run:['today.js'],register:['today-picture.js']},
  'day-changed':{run:['month.js','history.js'],register:['today.js']},
  'insights-cards':{run:['stats.js'],register:['tag-request.js','fav.js','cost.js','shop.js']},
  'item-sheet-parts':{run:['itemsheet.js'],register:['fav.js','care.js','cost.js','kit.js']},
  'wardrobe-tile':{run:['wardrobe.js'],register:['care.js','kit.js','setup.js']},
  'wardrobe-changed':{run:['app.js','pattern-read.js','checklist.js','photos.js','colpick.js','add-card.js','look.js','fav.js','item-photo.js','item-view.js','wardrobe.js','care.js','shop.js','sync.js','kit.js'],register:['itemsheet.js']},
  'add-card-sections':{run:['add-card.js'],register:['dress.js','look.js','cost.js']},
  'card-saved':{run:['add-save.js'],register:['dress.js','look.js','cost.js','kit.js']},
  'sync-send':{run:['sync.js'],register:['kit.js']},
  'invite-ended':{run:['app.js'],register:['sync-status.js','account.js']},
};

module.exports=async({ok,ROOT})=>{
  /* bus.js itself, run as a script with its export blanked */
  const ctx=vm.createContext({});vm.runInContext(appSrc(ROOT,'bus.js')+';this.B={on,emit,heard,serve,ask,served,need,needFn,register,runHooks,runHooksSeq,slotsOf,hooked}',ctx);
  const {on,emit,heard,serve,ask,served,need,needFn,register,runHooks,runHooksSeq,hooked}=ctx.B,log=[];
  /* the hooks (N1; owner decision D1: a feature that didn't load registered nothing and is absent, nothing throws) */
  {const got=[];
    ok(Array.isArray(runHooks('nobody',1))&&!runHooks('nobody').length&&!hooked('today-parts'),'runHooks for a moment nobody registered for calls nothing and answers [] (a missing feature is just absent)');
    register('weather',{'today-parts':(P,o)=>{got.push('w');P.wx=o;return 'w'}});register('care',{'settings-draw':()=>got.push('c-draw')});
    register('cal',{'today-parts':P=>{got.push('c');P.cal=1;return 'c'}});
    const P={},ans=runHooks('today-parts',P,'o1');
    ok(ans.join()==='w,c'&&got.join()==='w,c'&&P.wx==='o1'&&P.cal===1,'runHooks calls each registered feature\'s hook in load order with the arguments, skips a feature without that hook, and gives back their answers');
    register('weather',{'settings-draw':()=>got.push('w-draw')});got.length=0;runHooks('settings-draw');
    ok(got.join()==='w-draw,c-draw','registering again adds hooks at the feature\'s first place (load order)');
    register('weather',{'today-parts':()=>'w2'});ok(runHooks('today-parts',{}).join()==='w2,c','registering a hook again replaces that feature\'s hook');
    const hb=new Error('hb');got.length=0;register('kit',{'sync-send':()=>{got.push('k');throw hb}});register('fav',{'sync-send':()=>got.push('f')});let hg=null;try{runHooks('sync-send',{})}catch(e){hg=e}
    ok(hg===hb&&got.join()==='k,f','a hook that throws does not stop the others, and the first error is thrown on once all have run (as emit)');
    got.length=0;register('kit',{'after-pull-fixups':async()=>{await null;got.push('k1');return 1}});register('fav',{'after-pull-fixups':()=>{got.push('f1');return 2}});
    const seq=await runHooksSeq('after-pull-fixups');
    ok(seq.join()==='1,2'&&got.join()==='k1,f1','runHooksSeq awaits each hook before the next, in load order, and answers their results');
    const sb=new Error('sb');got.length=0;register('cal',{'after-pull-fixups':()=>{throw sb}});let sg=null;try{await runHooksSeq('after-pull-fixups')}catch(e){sg=e}
    ok(sg===sb&&!got.length,'runHooksSeq stops at the first hook that throws: the later ones never run (a .then chain)');
    const {slotsOf}=ctx.B,f1=()=>1,f2=()=>2;ok(JSON.stringify(slotsOf('nobody'))==='{}'&&!hooked('nobody'),'slotsOf for a moment nobody fills gives {} (each part absent), and hooked says no');
    register('weather',{'page-shown':()=>({wxA:f1})});register('kit',{'page-shown':()=>({kitB:f2}),'synced':()=>{}});
    const SL=slotsOf('page-shown');ok(SL.wxA===f1&&SL.kitB===f2&&Object.keys(SL).join()==='wxA,kitB'&&hooked('page-shown')&&hooked('synced')&&!hooked('today-fold'),'slotsOf joins each feature\'s parts into one object, and hooked says whether any feature has a hook for the moment');
    ok(JSON.stringify(slotsOf('synced'))==='{}','a hook that answers no object fills no part')}
  /* the sockets */
  ok(ask('nobody',1,2)===undefined,'ask for a name nobody serves: nothing is called and the answer is undefined (the old typeof guard)');
  const seen=[];serve('sum',(a,b)=>{seen.push([a,b]);return a+b});
  ok(ask('sum',2,3)===5&&seen.length===1&&seen[0].join()==='2,3','ask calls what is served once, with the arguments, and gives back its answer');
  serve('sum',(a,b)=>a*b);ok(ask('sum',2,3)===6,'the last fn served under a name is the one asked');
  serve('nofn',undefined);ok(ask('nofn')===undefined,'serving something that is not a function serves nothing');
  const sboom=new Error('sboom');serve('throws',()=>{throw sboom});let sgot=null;try{ask('throws')}catch(e){sgot=e}
  ok(sgot===sboom,'an error the served fn throws reaches the one who asked, as a direct call\'s would');
  ok(served('sum')&&!served('nobody')&&!served('nofn'),'served says whether a fn is served under a name (the old typeof guard before a call with other arguments)');
  let nthrew=null;try{need('nobody',1)}catch(e){nthrew=e}
  ok(nthrew&&nthrew.name==='ReferenceError'&&need('sum',2,3)===6,'need: what is served is called and answers, as ask; nothing served throws a ReferenceError, as the missing name did');
  let fthrew=null;try{needFn('nobody')}catch(e){fthrew=e}const nf=needFn('sum');
  ok(fthrew&&fthrew.name==='ReferenceError'&&typeof nf==='function'&&nf(2,4)===8,'needFn: nothing served throws at once; else a fn that asks the socket');
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
  const used={},sockUsed={},needUsed=new Set(),hookUsed=new Set(),hookRun={},hookReg={},regBad=[];
  const acorn=require('acorn');
  /* the order the files run in, so the order they register in: the tags', but a file's imports run first (in the Add and item sheet
     cycle, itemsheet.js's tag comes first and it runs last: the notice board made clean, N3) */
  const runs=[];{const seen=new Set(),imps=f=>{const s=fs.readFileSync(path.join(ROOT,f),'utf8');let a;try{a=acorn.parse(s,{ecmaVersion:'latest',sourceType:'module'})}catch(e){return []}
      return a.body.filter(n=>(n.type==='ImportDeclaration'||n.type==='ExportAllDeclaration'||n.type==='ExportNamedDeclaration')&&n.source).map(n=>path.posix.normalize(path.posix.join(path.posix.dirname(f),n.source.value)))};
    const visit=f=>{if(seen.has(f)||!page.includes(f))return;seen.add(f);for(const t of imps(f))visit(t);runs.push(f)};page.forEach(visit)}
  for(const f of page){if(f==='bus.js')continue;const src=fs.readFileSync(path.join(ROOT,f),'utf8');let ast;
    try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'})}catch(e){try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'})}catch(e2){continue}}
    // local name -> bus.js's name (a file that also reads app.js's own ask() imports bus.js's second name for it, askFor; served, need and needFn count as asking)
    const imp=new Map(ast.body.filter(s=>s.type==='ImportDeclaration'&&s.source.value==='./bus.js').flatMap(s=>s.specifiers.map(x=>[x.local.name,x.imported?x.imported.name:x.local.name])));
    const add=(k,t)=>{const u=used[t]=used[t]||{emit:[],on:[],heard:[]};if(!u[k].includes(f))u[k].push(f)};
    const sock=(k,t)=>{const u=sockUsed[t]=sockUsed[t]||{serve:[],ask:[]};if(!u[k].includes(f))u[k].push(f)};
    const walk2=(n,fn)=>{if(!n||typeof n.type!=='string')return;fn(n);for(const k in n){const v=n[k];if(Array.isArray(v))v.forEach(x=>walk2(x,fn));else if(v&&typeof v.type==='string')walk2(v,fn)}};
    const walk=n=>{if(!n||typeof n.type!=='string')return;
      if(n.type==='CallExpression'&&n.callee.type==='Identifier'){const c0=imp.get(n.callee.name)||null,c=c0==='askFor'||c0==='served'||c0==='need'||c0==='needFn'?'ask':c0,a=n.arguments[0],lit=a&&a.type==='Literal'&&typeof a.value==='string';
        if(c&&/^(?:emit|on|heard)$/.test(c)&&lit)add(c,a.value);
        else if(c&&/^(?:serve|ask)$/.test(c)){if(lit){sock(c,a.value);if(c0==='need'||c0==='needFn')needUsed.add(a.value)}else ok(false,`${f} calls ${n.callee.name}() of bus.js with a name that is not a plain string`)}
        // (the hooks: runHooks/runHooksSeq/slotsOf/hooked's name, and each key of register's object)
        else if(/^(?:runHooks|runHooksSeq|slotsOf|hooked)$/.test(c0||'')){if(lit){hookUsed.add(a.value);(hookRun[a.value]=hookRun[a.value]||[]).includes(f)||hookRun[a.value].push(f)}else ok(false,`${f} calls ${n.callee.name}() of bus.js with a name that is not a plain string`)}
        else if(c0==='register'){const o=n.arguments[1];if(o&&o.type==='ObjectExpression')for(const p of o.properties){const k=p.key&&(p.key.type==='Literal'?p.key.value:p.key.name);if(k){hookUsed.add(k);(hookReg[k]=hookReg[k]||[]).push(f)}}}
        else if(!c&&/^(?:emit|heard|serve)$/.test(n.callee.name))ok(false,`${f} calls ${n.callee.name}() without importing it from './bus.js'`)}
      for(const k in n){const v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v.type==='string')walk(v)}};
    walk(ast);
    const regs=[];walk2(ast,n=>{if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&imp.get(n.callee.name)==='register')regs.push(n)});
    if(regs.length){const last=ast.body[ast.body.length-1],r=regs[0],nm=f.replace(/\.js$/,'');
      if(regs.length>1)regBad.push(f+' registers '+regs.length+' times');
      if(!(r.arguments[0]&&r.arguments[0].type==='Literal'&&r.arguments[0].value===nm))regBad.push(f+' registers under another name than '+nm);
      if(!(last&&last.type==='ExpressionStatement'&&last.expression===r))regBad.push(f+'\'s register is not its last statement')}}
  ok(!regBad.length,`each feature registers once, under its file's name, as its file's last statement (${Object.values(hookReg).flat().filter((x,i,l)=>l.indexOf(x)===i).length} features)${regBad.length?': '+regBad.join('; '):''}`);
  {const hb=[],hl=[...hookUsed].filter(m=>!HOOKS[m]);
    for(const [m,d] of Object.entries(HOOKS)){const run=[...(hookRun[m]||[])].sort(),reg=[...(hookReg[m]||[])].sort((x,y)=>runs.indexOf(x)-runs.indexOf(y));
      if(run.join()!==[...d.run].sort().join())hb.push(`${m}: run by ${run.join(', ')||'nobody'}, listed ${d.run.join(', ')}`);
      if(reg.join()!==d.register.join())hb.push(`${m}: registered by ${reg.join(', ')||'nobody'} (load order), listed ${d.register.join(', ')}`);
      if(!d.run.length||!d.register.length)hb.push(m+': needs a file that runs it and a feature that registers for it')}
    ok(!hl.length&&!hb.length,`each moment is run and registered by the files HOOKS lists, in load order (${Object.keys(HOOKS).length} moments)${hl.length?': not listed '+hl.join(', '):''}${hb.length?': '+hb.join('; '):''}`)}
  const sockNotListed=Object.keys(sockUsed).filter(t=>!SOCKETS[t]);
  ok(!sockNotListed.length,`every socket the files use is in SOCKETS${sockNotListed.length?': not '+sockNotListed.join(', '):''}`);
  const sbad=[];
  for(const [t,d] of Object.entries(SOCKETS)){const u=sockUsed[t]||{serve:[],ask:[]};
    if(u.serve.length!==1||u.serve[0]!==d.serve)sbad.push(`${t}: served by ${u.serve.join(', ')||'nobody'}, listed ${d.serve}`);
    const order=[...u.ask].sort((x,y)=>page.indexOf(x)-page.indexOf(y));
    if(order.join()!==[...d.ask].sort((x,y)=>page.indexOf(x)-page.indexOf(y)).join()||!order.length)sbad.push(`${t}: asked by ${order.join(', ')||'nobody'}, listed ${d.ask.join(', ')}`)}
  ok(!sbad.length,`each socket is served by the one file SOCKETS lists and asked by the files it lists (${Object.keys(SOCKETS).length} sockets)${sbad.length?': '+sbad.join('; '):''}`);
  /* the typed registry (types/sockets.d.ts, N1): every socket declared with its type, written from the serve lines */
  {const dts=fs.readFileSync(path.join(ROOT,'types','sockets.d.ts'),'utf8').replace(/\r\n/g,'\n');
    const block=n=>{const m=dts.match(new RegExp(`^export interface ${n} \\{\\n([\\s\\S]*?)^\\}`,'m'));return m?m[1]:''};
    const keys=n=>[...block(n).matchAll(/^  '([^']+)':/gm)].map(m=>m[1]);
    const decl=new Set(keys('Sockets')),needs=new Set(keys('Needs')),hooks=new Set(keys('Hooks'));
    const undeclared=Object.keys(sockUsed).filter(t=>!decl.has(t)),unused=[...decl].filter(t=>!sockUsed[t]||!sockUsed[t].ask.length);
    ok(decl.size&&!undeclared.length,`every socket the files use is declared in types/sockets.d.ts (Sockets, ${decl.size})${undeclared.length?': not '+undeclared.join(', '):''}`);
    ok(!unused.length,`every socket types/sockets.d.ts declares is served and asked${unused.length?': not '+unused.join(', '):''}`);
    ok(!['Sockets','Needs','Hooks'].some(n=>/^\s*\[/m.test(block(n))),'Sockets, Needs and Hooks have no index signature (an undeclared name is a type error)');
    const needOut=[...needUsed].filter(t=>!needs.has(t)),needIn=[...needs].filter(t=>!needUsed.has(t));
    ok(!needOut.length&&!needIn.length,`Needs is exactly the sockets asked with need or needFn (${needs.size})${needOut.length?': not in Needs '+needOut.join(', '):''}${needIn.length?': never needed '+needIn.join(', '):''}`);
    const hookOut=[...hookUsed].filter(t=>!hooks.has(t));
    ok(hooks.size&&!hookOut.length,`every hook the files register or run is declared in types/sockets.d.ts (Hooks, ${hooks.size})${hookOut.length?': not '+hookOut.join(', '):''}`);
    const gen=require(path.join(ROOT,'tools','sockets-dts.js')).generate(ROOT);
    ok(!gen.errs&&gen.text===dts,`types/sockets.d.ts is what tools/sockets-dts.js writes from the serve lines${gen.errs?': '+gen.errs.join('; '):gen.text!==dts?' (run `node tools/sockets-dts.js` and commit it)':''}`)}
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
  {const ex=(bus.match(/^export \{([^}]*)\};/m)||['',''])[1].split(',').map(s=>s.trim()).filter(Boolean);
    const imported=new Set(page.flatMap(f=>[...fs.readFileSync(path.join(ROOT,f),'utf8').matchAll(/^import \{([^}]*)\} from '\.\/bus\.js';/gm)].flatMap(m=>m[1].split(',').map(s=>s.trim().split(/\s+as\s+/)[0]))));
    const idle=ex.filter(n=>!imported.has(n));
    ok(ex.length>10&&!idle.length,`every name bus.js exports is imported by a page file (${ex.length})${idle.length?': not '+idle.join(', '):''}`)}
  ok(!/\b(?:globalThis|window|self|document|localStorage|addEventListener)\b|^\s*import\b/m.test(bus),'bus.js keeps nothing on the page and imports nothing (a second copy of it, as an offline deep link makes, is harmless)');
  const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
  ok(/'bus\.js'/.test(sw),'bus.js is in sw.js ASSETS (offline)');
};
module.exports.TOPICS=TOPICS;
module.exports.SOCKETS=SOCKETS;
module.exports.HOOKS=HOOKS;
