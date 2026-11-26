// The bridge (the ES-module move, MODULES-PLAN.md "If the owner wants the full move anyway", step 3, 2026-11-23; the recipe for
// converting a file is C:\code\cr-2026-11-16\MODULES-RECIPE.md).
// A page script that becomes an ES module keeps its top-level names to itself. While other files, the tests' page.evaluate() and
// the checkers still use some of them as globals, the module hands those over at its end (tests/modscope.js reads the statements):
//   Object.assign(globalThis, {name, …})                                   a function or a constant
//   Object.defineProperties(globalThis, {name: {get: () => name}})           a `let` others only read: always the value of the moment
//   … {name: {get: () => name, set: v => {name = v}}}                        a `let` another file or a test assigns: the write
//                                                                            reaches the module's own variable
// BRIDGE below lists every bridged name, per file.
// - a bridged name that isn't listed fails: add the file's row in the pull request that converts the file, and say why each name
//   is still needed (who reads it);
// - a listed name that is no longer bridged fails until it is taken off: after a file's conversion its row only shrinks, down to
//   nothing when every reader imports the name and no test assigns it. The bridge is temporary;
// - a row that origin/main already has may not gain a name (compared with main's copy of this file through git): only the pull
//   request that converts a file writes its row. A name a later change really has to add goes in GROWN too, with the reason.
// And the mistakes that would otherwise show only as a blank page or a silent `undefined` (Node only, a few seconds):
// - a file uses, as a global, a name that a module declares and doesn't bridge (`typeof name==='function'` guards too, which
//   ESLint's no-undef can't see in a classic script): import it or bridge it;
// - a module's tag without an import or export in its text (TypeScript and tests/appsrc.js go by the text: `export {}` will do);
// - a bridge statement the checkers can't read (a spread, a computed key), a name bridged twice, or one a classic script also
//   declares at its top level (the classic `let` would hide the bridged value);
// - a `let` handed over with Object.assign (the global would keep the value it had at that moment), an accessor that isn't plainly
//   `get: () => name` on the file's own `let` of that name, or a setter that assigns another name;
// - a write nobody would see: another page script, a test or a tool assigns a bridged name (`name = …`, `name++`, `window.name = …`)
//   that has a getter and no setter (the assignment does nothing, or throws in strict code), or that was handed over with
//   Object.assign (the global is replaced and the module goes on using its own: a test's stub of a function never runs for the
//   module's own calls);
// - an import that isn't a plain relative path to a page script that is itself a module with its own tag in index.html (the tag
//   is what fetches it in parallel on iOS 16.4, which has no modulepreload, and what puts it in every checker's list), or one
//   under another name, a default or a namespace import (tests/appsrc.js can't run those for the Node tests);
// - a Web Worker that importScripts a module (`export` is a syntax error there: the worker and its files move together);
// - a module missing from sw.js ASSETS under the exact spelling of its tag and of every import of it (a cold offline start with one
//   module missing fails the whole graph).
// Not checked here: that a bridged name is still needed by someone (a test's page.evaluate may be its only reader); that comes
// with the bridge's removal (step 5). A write inside a string handed to page.evaluate('…') isn't seen either.
// The tests' access point, HOOK (T2, 2026-11-25; tests/hook.js): each module puts the names only the tests use on HOOK too, so the
// tests can stop using them as globals and those names can come off the bridge. Checked here: each HOOK statement (one per module,
// names of its own, a `let` behind a getter, a setter for what a test assigns), every name only the tests use is on HOOK, every
// HOOK.name a test uses is there, the app never reads HOOK. The tests' uses (testUses) count strings too: the code inside a string
// (page.evaluate('…'), a SETUP template), and a sentence's words (safe side; not an ok() message). `--hook` lists the names the
// tests use through HOOK alone (they can come off BRIDGE) and the files still using the rest as globals; `--to-hook <file>` rewrites one.
const fs=require('fs'),path=require('path');
const acorn=require('acorn'),escope=require('eslint-scope');
const modscope=require('./modscope');

/* file -> the names it bridges onto globalThis. Rows are added by the pull request that converts the file; after that they only shrink.
   T2 phase 3 (2026-11-25) took off the 468 names the tests alone used, through HOOK alone: they are on each module's HOOK, not here.
   A row's note may still name tests as readers of names that have since left; what is left is read by the app's files, the Web
   Workers, lab/, or by a test that runs older builds as well (syncing, kitEdited, asmCmMf, asmCmCodeSig, asmCmSig, asmCmSrcSig). */
const BRIDGE={
  // the notice board (restructure step 0's pilot, 2026-11-25): every file that pins or announces on it imports it, nothing reads it as a global
  'bus.js':[],

  // nearly every page script, classic or module, and analysis-worker.js and its other files read these as globals (no page module imports
  // another); 184 test files read items; items (analysis.js, analysis-worker.js), dayRecs (today, pack), settings (snapshots),
  // weather and climate (today, weather), clockSkew (sync), TODAY_OVERRIDE (the worker) and the tests assign seven lets: setters;
  // CUSTOM_COL and CUSTOM_PAT are lets only core.js writes (applyCustom): getters

  'core.js':['$','ACCENT_MAX','BANDS','BELT_MATS','BEZELS','BLOUSE_TAPE_MAX','CAMO_V','CASUAL_JACKETS','CASUAL_TOPS','CLOCK_AHEAD','CLOCK_MIN','COLORS','COLOR_OPTS','COLS_BY','COL_ALIAS','COOL','CUFFS','CUSTOM_COL','CUSTOM_PAT','DAY_NAMES','DIAL_COLS','DIAL_OPTS','FABRIC','HANDPICK_TYPES','LEATHERS','LUM','LUMS','MATERIALS_BY','MAT_ALIAS','METAL','METAL_TONES','METAL_TYPES','MONTH_EASE','MONTH_MS','OCCASIONS','OCP_CAMO','OCP_RANKS','OCP_V','OWN_COL_RE','OWN_MAT_MAX','OWN_PAT_RE','PATS_BY','PAT_ALIAS','REC_PHOTO','SEASONS','SEASON_TYPES','SHADE_MAX','SHIRT_WEAVE_MAT','SHOE_NAP','SHOE_STYLES','SHOE_TEXTILES','SLOTS','SLOT_TYPE','STRAP_BANDS','TAG_TYPES','TEXTURE_TYPES','TODAY_OVERRIDE','TROUSER_KINDS','TYPES','VESTS','WATCH_STYLES','accentOf','accentsFor','accentsOf','applyCustom','arriveN','avgText','blouseTapes','camoImage','camoPants','camoPat','cleanDay','cleanRecord','cleanSettings','cleanState','climate','clipMetal','clockSkew','colBase','colBaseFor','colName','colOf','colorDesc','colsFor','dE00','dayClimate','dayFields','dayRecs','desc','di','dressOut','fitCol','handPickSlot','hasPat','hasVest','hexRgb','inRotation','isCargo','isHandPick','isOcp','isWorkday','isoKey','itemFields','itemName','itemSeason','itemTitle','items','key','keySettings','labHex','labOf','leatherLabel','leatherWord','leathersFor','linkFace','lum','lumCol','matAlias','matTypeOne','matTypeWord','matsFor','mergeSettings','mergeState','metalOptsFor','metalWord','mix','nameHtml','nameIso','needsJacket','needsTie','nextStamp','nm','noBidi','normCol','normColFor','normPat','nowMs','occLabel','occOf','ocpImage','offDays','offName','ownColFind','ownColKey','ownDescClean','ownFreeKey','ownKeyNorm','ownMatName','ownMats','ownNameBad','ownNameClean','ownNameShort','ownPatFind','ownPatKey','patBase','patLabel','patName','patNameTaken','patOf','planCol','prettyCols','primaryCol','pw','rgbLab','seasonFit','sentence','setClimate','setClockSkew','setStr','setWardrobe','setWeather','settings','shadeFor','shadeHex','shadeName','shoeStyle','shortCol','shortDesc','sockPatterned','sockToe','sockToeKey','soleStyle','stampAllSettings','stampSettings','strapBand','styleWord','tagTypesNow','takeSettings','tapeText','thirdOf','titleCls','todayDate','trouserKind','trouserKindShown','trueToday','typeWord','watchOpts','watchText','wearsJacket','wearsTie','weather'],
  // analysis.js (in the page and the worker), history, pickscore, scorecard, today-plan, today, month, stats, pack, fav, wardrobe,
  // itemsheet, locks, dress and shop plan and score with these; analysis-worker.js ranks with rankLooks; the rest: tests (LOOK_K, lookLeather and planLook
  // only inside a string tests/lookplan.test.js runs in the page)

  'planner.js':['DIAL_KEYS','DIAL_NAMES','DIAL_OF_CHECK','DIAL_RULES','HARD_CAP','PAIR_DAYS','PLAN_RULES','QWIN','SH','accMetal','beltFit','beltWait','buildPlan','clothesScore','colsOf','dCol','darkMode','darkShirt','dialFreshness','dialHarmony','dialInterest','dialOccasion','dialTexture','dialVariety','fam','favItemSet','favKey','favLookKey','favLookOf','favLooks','finish','formalTop','idsAhead','isFavItem','jacketGroup','leatherGroup','lockStale','metalOf','outfit','pairScore','pairSeen','patInfo','patternScore','pcol','planSim','planStart','pocketScore','rankLooks','rateOutfit','shirtGroup','shirtLook','shirtScore','shoeFormality','shoeScore','shoeSuits','sockBold','sockEcho','sockScore','tieGroup','tieLook','watchFit','withColRun'],
  // shop.js runs the check where no worker starts (runAnalysis) and draws it (CLASS_NAMES, groupLabel, TYPE_WORD, listAnd), stats.js
  // and shop.js count the same days (SHOP_WEEKS, horizonKeys, listAnd), analysis-worker.js runs runAnalysis; the rest: tests

  'analysis.js':['CLASS_NAMES','SHOP_WEEKS','TYPE_WORD','groupLabel','horizonKeys','listAnd','runAnalysis'],
// the painter (C3, 2026-11-24): pattern-read.js reads detect.js's lists while it loads; tagging, measure, colpick, itemsheet, today, draw.js and the painter read the readings (usableSett, texPat, settSig, settToTag); the rest: tests
  'detect.js':['CAMO_TR','CHECK_PATS','DETECT_PATS','MOTIF_PATS','STRIPE_PATS','TEXTURE_PATS','detectPattern','detectQueued','settFromCanvas','settSig','texPat','tieWeave','usableSett'],
// the painter (C3, 2026-11-24): the sRGB conversions for draw.js, mannequin.js, the painter (asm-worker.js too), tagging, measure, migrate and pattern-read; the colormath test
  'srgb.js':['linSrgb','linSrgb8','srgbLin','srgbLin8'],
  // who is connected (the restructure S3b, 2026-11-26, from account.js and sync-status.js): ui, photos, colpick, look, add, settings,
  // safety, sync, sync-status, about, remind, kit and account read the account and the role; app, photos, account, sync, snapshots and
  // about hear an ended invitation; account.js assigns acct with setAcct and remembers the role (rememberRole); acct has a setter (tests)
  'who.js':['ENDED','acct','acctBase','acctCall','acctEsc','acctRole','applyRole','endedAnswer','hasInviteHash','inviteEnded','isTester','rememberRole','setAcct'],
  // the photo keys (the restructure S3b, 2026-11-26, from photos.js): esc is called by 36 page scripts, srcOk by ten, jsq by add-save and
  // look; the painter (assemble, asm-color, asm-kinds, asm-ocp) reads the kept pictures and their keys; photos.js draws and fetches with
  // them (shareRender, listPaused), start.js loads them (loadRenders); renders and listAt have setters (tests assign them)
  'photo-keys.js':['comboKey','comboSig','esc','fnv64','jsq','keepRender','listAt','listPaused','loadRenders','picsDrawn','renders','shareRender','srcOk','workerBase','workerList'],
  // the photo-tagging request: app, add, item-photo, migrate, measure, pattern-read, colpick, look, safety and stats are classic
  // scripts; add-keep.js, add-save.js, tagging.js (TAG_Q) and checklist.js (texSig) are modules that read these as globals
  'tag-request.js':['CLOSE_MAX','TAGIMG_CACHE','TAG_MAX','TAG_Q','TEX_MAX','TEX_MIN_PX','benchEstimate','customForTag','describeEstimate','keepCloseImg','keepTagImg','readEstimate','recordTagResult','resignTagImg','sharpCloseOf','tagExtras','tagFixes','tagImgOf','tagStatsCard','texSig'],
// the painter (C3, 2026-11-24): mannequin.js puts outfitMannequinSvg and mqData on self itself, and each pose file its MQ_RAW entry: nothing to bridge
  'mannequin.js':[],
  'mq/vest.js':[],
  'mq/suit.js':[],
  'mq/suit-open.js':[],
  'mq/shirt-tie.js':[],
  'mq/shirt-open.js':[],
// the painter (C3, 2026-11-24): the drawings for every screen (itemThumb, swatchSVG, figureSvg, fabricDef), the tiles the painter's shirts and ties are made from, the mannequin's cloth (figCuKey, figWay, FIG_CU); swN, thumbN and figBgMemo have setters (tests assign them); the rest: tests
  'draw.js':['OCP_RANK_SVG','TIE_DARK_L','TIE_DARK_X','TIE_TEX_K','fabricDef','figureSvg','itemThumb','swatchSVG','texPlainBand','texTileSmooth','texTileUrl','texTones'],
  // the app's state, storage and shared helpers for nearly every file and the tests; flt, queue, view, sel, the database's and the
  // connection copy's flags, aiError and aiModel have setters (tests assign flt,
  // queue, view and sel; since S1a the other files call setSel, setView, setFlt …, the owner's setters)
  'app.js':['DEAD_MSG','S','addTombstones','afterDom','afterScripts','aiError','aiLabel','aiModel','announce','ask','atomic','cap1','cleanStored','cleanStoredSettings','connKeep','connReady','connRestored','db','dbConn','dbCur','dbGone','dbMark','dbRetry','dbUnhold','dbWiping','deadCanvas','deadPic','del','fill','fitNavSoon','fixupRedraw','flt','generateSwatch','keepFocus','loadImg','metaGet','metaPut','normTag','put','putRaw','queue','refreshSwatch','sel','setAiError','setAiModel','setConnReady','setDbConn','setDbCur','setDbWiping','setFlt','setSel','setView','shrink','stillCur','texSwatches','tx','txFail','txs','updateSwatchParam','view'],
  // the pages and sheets that Back closes are classic scripts: add-sheet, colpick, history, item-view, kit, settings, setup, shop,
  // start, ui and account call these. appHist, appKind and itemHist are read by the tests only (back, backgesture, shellfix): getters
  'back.js':['backBorrow','backDrop','backHold','backKind','backLand','backOn','backOver','backPush','backReturn','backSettled','backWanted','histDrop','histPush'],
  // every file registers its handlers with acts; today.js and care.js call actTaps; ui.js and tests read ACTS
  'act.js':['ACTS','actTaps','acts'],
  // the day records (the restructure S3b, 2026-11-26, from history.js): keyDate is read by 18 page scripts (planner.js, earlier in the
  // list, too), saveDay by 9, idsOf by six (pickscore, history, locks, scorecard, today-plan, today-gestures), notAhead by pickscore and history
  'days.js':['idsOf','keyDate','notAhead','saveDay'],
  // toast: 34 page scripts; toastDrop: start; TOAST_ACT_MS: tests/a11y.test.js
  'toast.js':['toast','toastDrop'],
  // the question, the close-up chooser, the layers' focus, the connection's state and plain errors, for nearly every page script;
  // connMsg has a setter (tests/restacts.test.js), asking, cuOpen and connBusy are getters
  'ui.js':['NEED_CONN','addGate','advClose','askAnswer','askConfirm','asking','closeupBtn','closeupPick','connSummary','cuGot','cuOpen','cuTouch','inviteOver','isConnected','layerClose','layerFrom','layerInert','layerOpen','needConn','netErr','plainErr','renderConnUI','tell'],
  // the sheets that close on a swipe down are classic scripts: add-sheet, item-view, colpick and kit call it
  'sheet-swipe.js':['sheetSwipe'],
  // add, add-card, tagging, pattern-read, safety, colpick, checklist, look and item-photo; the rest: tests
  'measure.js':['BLUR_SHARP','FAR_DE','MEAS_GAP','aiSignals','applyWb','closeRead','colRef','colourVerdicts','measHint','measKL','measureAndApply','measureCard','measureCloth','measureParts','multiCol','nearestCols','paperCopy','paperKey','paperNow','paperOf','sharpness','undoMeasured','wbGains','wbRead'],
  // the restructure S3c (2026-11-26): a card by its id and its state, moved here from add-save.js and add.js; every Add file, tagging,
  // pattern-read, colpick, look, checklist and own-lists find a card with these, and the tests call cardOf, qAt, needType and cardReading
  'add-ids.js':['cardAt','cardIx','cardOf','cardReading','needType','qAt','qh'],
  // add, add-card, add-save, tagging, itemsheet, look, measure, migrate and asm-color; the rest: tests
  'pattern-read.js':['TEX_WORDS','claudeOnly','missedPattern','readPatternWithClaude','readSett','readable','rereadSett','settFromSpec','settNote','settSummary','settable'],
  // add, add-card, measure, pattern-read, colpick and safety are classic scripts; add-save.js and tag-request.js (fieldLabel, valName),
  // modules earlier in the list, read these as globals; confTxt is read by tests/records.test.js only
  'tagging.js':['aiFields','closeTagImg','fieldLabel','readAbort','readBegin','readEnd','refineFromCloseup','tagNotes','takeExtras','valName'],
  // history.js, a classic script, swaps, picks and draws the picker with these; slotPool, fitOf, fitTag and pickSub are also called by
  // the care, onorder, planner-rules and rotation-pause tests
  'pickscore.js':['BELT_STUCK','FOLLOW','beltless','bootsOff','fitOf','fitTag','handPool','handWhy','keepHand','keepOff','pickSub','pocketOn','slotPool','suggestClean','suitPants'],
  // the restructure S3c (2026-11-26): the field rows the Add card and the item sheet share, moved here from wardrobe.js and itemsheet.js:
  // add-card, add-save, wardrobe, itemsheet and kit draw, save and size them; the tests call matRow
  'fields.js':['WARD_FIELDS','WARD_MAX','fldRow','matLabel','matPicked','matRow','matTidy','notesRow','optLab','wardSaveFields'],
  // add-card, itemsheet, colpick, look, add, add-sheet and item-view draw their sections and the close-up comparison with these;
  // CK_OPEN is also how 53 test files open the sections
  'checklist.js':['CK_OPEN','accRow','ckChip','ckColSum','ckIsOpen','ckSec','ckSure','ckToggle','cmpDiff','cmpDiffText','cmpDrawn','cmpHtml','cmpLab','cmpMatchHtml','cmpMount','cmpPaper','cmpPaperLine','cmpSteps'],
  // add, add-card, add-keep, add-save, itemsheet, item-view, history, stats, wardrobe, colpick, look, migrate, measure, pattern-read and app draw and edit with these; the rest: tests
  'item-photo.js':['PH_MAX','cropEditor','cropKeep','cropSource','imgOf','makeSmall','paperCloth','paperHint','paperLine','paperRetake','paperSteps','phSm','photoTools','replaceTexture','smallPhotos'],
  // editing is read by twelve classic page scripts and set by 31 tests (a setter); wardrobe, cost and kit open a piece (openItem), start
  // and wardrobe drop the sheet (dropItem), sync says a sync changed the open piece (itemSynced), itemsheet, start and checklist redraw
  // it (renderItem); itemGoneTell: itemsheet, wardrobe, look, cost; noMotion: nine files; closeItem, stepItem and wardList: tests only
  'item-view.js':['dropItem','editing','itemGoneTell','itemSynced','noMotion','openItem','renderItem'],
  // renderWardrobe is called by 16 page scripts and 15 tests; item-view draws the sheet with itemBody and reads phEdit, as item-photo
  // and photos do (a getter: only itemsheet.js assigns it); add-card (optLab, matTidy), add-save (matTidy), colpick and look (sete,
  // patSummary, redetect, clearStripes), wardrobe (wardPic), colpick (wardPic); rm and togglePause: tests only
  'itemsheet.js':['clearStripes','itemBody','patSummary','phEdit','redetect','renderWardrobe','sete','wardPic'],
  // (keyDate, saveDay, idsOf and notAhead went to days.js, restructure S3b) today.js draws and records with recordDays, openPicker, closePicker,
  // setWorn, setVest, resetCard and dayActions and sets todayPullWait and pastEdit (setters; tests set pastEdit too; swapMsg: HOOK,
  // S1f); picker is a getter (today, today-gestures and sync read it); whenPulled: start, safety, wardrobe, calendar; dropLearn and
  // checkPlanRules: start; renderReplanUI: settings; setOccasion: daysoff, calendar; wearFav: fav; pickItem: scorecard; swapSlot, togglePastEdit, correctPast, setFormal, resetDay, replanFuture and planRulesNote: tests only
  'history.js':['checkPlanRules','closePicker','dayActions','dropLearn','openPicker','pastEdit','pickItem','picker','recordDays','renderReplanUI','resetCard','setOccasion','setPastEdit','setSwapMsg','setTodayPullWait','setVest','setWorn','todayPullWait','wearFav','whenPulled'],
  // history.js (firstReal, missedNote) and today.js (missedCard) are classic scripts; the rest are called by the todayacts and weeklock tests
  'missed.js':['firstReal','missedCard','missedNote'],
  // history, settings, dress, care, setup and kit (clearLocks), pack (lockIds), today (lockUpcoming), add-more and care (careUnlock), history (unlockClash)
  'locks.js':['careUnlock','clearLocks','lockIds','lockUpcoming','unlockClash'],
  // scorecard.js and today.js fold and unfold the cards (boxFold, boxUnfold); today-photofold.js (foldEdge, revealNeed, pageScroll,
  // keepInView, foldQuiet) and month.js (foldEdge, revealNeed, pageScroll, monthBelow) slide with these: modules that read them as
  // globals (no page module imports another yet); foldQuiet is a let only boxfold.js writes (today.js foldAll tells it through bus.js):
  // a getter. revealNeed, pageScroll and monthBelow came from month.js, keepInView and foldQuiet from today.js (restructure S3a)
  'boxfold.js':['boxFold','boxUnfold','foldEdge','foldQuiet','keepInView','monthBelow','pageScroll','revealNeed'],
  // today.js draws and folds the card (scoreCard, toggleScore) and sets scoreOpen, as the advicefresh, folds, scoreanim and scoredials
  // tests do (a setter); history.js and fav.js say dayWord; month.js reads recentWork; dialHtml, dialsFor, rankFor and rankPools are
  // called by tests only (advicefresh, scoredials, takeoff), which also read rankMemo and rankW (getters: only scorecard.js writes them)
  'scorecard.js':['dayWord','recentWork','scoreCard','scoreOpen','setScoreOpen','toggleScore'],
  // planDirty is called by 25 classic page scripts, planFor by 14, planMonth by 9; cache is read by nine and set by 95 tests (a
  // setter); today and stats ask planStartDay, today planTrim, outSig and planSnapSoon, start PLAN_SNAP and planSnapUse, shop strHash;
  // planRuns, planSig and planSnapUsed (a getter): tests/speed.test.js
  'today-plan.js':['PLAN_SNAP','cache','outSig','planDirty','planFor','planMonth','planSnapSoon','planSnapUse','planStartDay','planTrim','strHash'],
  // Today's names for the screens that step, fold and pick (history, scorecard, today-gestures, month, settings, start, kit, …) and the
  // tests; openRow, belowOpen, dayShown and BLOUSE_ROLL_ON have setters (tests assign them), recordRun is a getter; figureStage: tests/todayswatch.test.js, inside a string run in the page
  'today.js':['canPick','figCuDone','foldAll','goToday','hasOutfit','homeDay','keepHome','planWith','recordRun','renderToday','setListOpen','slotLabel','stepDay','wardShort','wxPreload'],
  // today.js opens and shuts a piece's photo with these
  'today-photofold.js':['picOpenReady','picShut','picSnap','picStop'],
  // today.js lays out the swatches with ovlPiece and calls applyZoom, zoomOut, swApply, swTap and swClose; zoom is a getter
  // (today-gestures reads it); tests/care.test.js sets swOpen (a setter); the swatch makers and their caches, zoomTarget and
  // toggleZoom: the todayswatch, hbswatch, twillswatch, asmrelease, materials, todayzoom and swatchzoom tests (ovlItem only inside a
  // string tests/todayswatch.test.js runs in the page, which --plan can't see)
  'today-picture.js':['applyZoom','ovlPiece','swApply','swClose','swTap','zoom','zoomOut'],
  // sync.js asks todayBusy before a redraw; month.js signs a day's outfit with mvSig (it comes after in the list, read as a global);
  // tests/moveoutfit.test.js calls moveRecs and reads outfitMove (a getter: only today-gestures.js writes it)
  'today-gestures.js':['mvSig','todayBusy'],
  // today.js (the month box, the pieces line, the home day; it sets monthOpen, as nine tests do: a setter), daysoff, history, pack,
  // remind, start, stats and the painter (assemble.js, asm-color.js: planOn) are classic scripts; scorecard
  // and today-gestures, modules earlier in the list, and fav, one later, read these as globals (the motion helpers went to boxfold.js
  // and core.js in the restructure S3a); monthGridHtml and
  // monthStep are called by tests only (month, setup); tests/setup.test.js sets monthPanel (a setter)
  'month.js':['dayOnly','monthDrag','monthLink','monthOpen','monthPanel','monthPlan','monthRelease','nextWorkday','openDay','piecesLine','piecesParts','planOn','setMonthOpen','shortRest','shortTop','stackSVG','toggleMonth'],
  // (the photo keys, the kept pictures and esc, jsq and srcOk went to photo-keys.js, restructure S3b) today, start, settings, daysoff and stats (classic), history, today-picture and itemsheet (modules that
  // read them as globals) draw with the rest; 15 names are read by
  // tests only. remoteListed is assigned from outside (tests): a getter and a setter; itemBatch is a let only photos.js writes: a getter
  'photos.js':['PIC_BG','aAn','asmLive','fetchItemPic','fetchRemoteRender','figureLabel','fixItemBackdrops','itemKey','itemPic','itemPicHtml','lastWorn','picBgs','renderFor','renderItemPicUI','schedulePrefetch','setRemoteKeys'],
  // cost.js formats money in the app's language
  'locale.js':['APP_LOC'],
  // nearly every page script opens, closes or saves through these; settingsPart is called at load by look, account, calendar and remind.
  // viewStale (sync.js) and setSeen (start.js) have setters, todayStale and setOther are getters
  'settings.js':['SET_CATS','backupSummary','closeSettings','openSettings','picsSwitched','refreshToday','renderPicturesUI','renderSettingsExtras','saveSettings','saveUserSettings','setCatOpen','setSeen','setSetSeen','setVestMode','setViewStale','setWanted','settingsOpen','settingsPart','settingsSummaries','showCost','todayDirty','toggleCat','toggleDay','viewStale','weekFirst'],
  // settings (countryName, renderDaysOffUI, renderFormalUI), setup (COUNTRY_CODES, setHolidayCountry), start (refreshHolidays), calendar
  // (isoToDate, dayOffAdd, yearDate), history and missed (shortDate, renderFormalUI); the rest: tests; holidayMsg is a getter
  'daysoff.js':['COUNTRY_CODES','countryName','dayOffAdd','isoToDate','refreshHolidays','renderDaysOffUI','renderFormalUI','setHolidayCountry','shortDate','yearDate'],
  // settings.js and setup.js (unit, renderWxLoc, setUnits, setLocation, useMyLocation, findCity), today.js (wxChip, loadWeather), start.js
  // and safety.js (loadWeather) read these as globals (setup.js is a module later in the list); scorecard.js, a module earlier in the list, reads temp; geoName is read
  // by tests/setup.test.js only
  'weather.js':['findCity','loadWeather','renderWxLoc','setLocation','setUnits','temp','unit','useMyLocation','wxChip'],
  // read by the tests only: a11y (applyTheme, cycleTheme), actsindex (cycleTheme), modload (themeTap)
  'theme.js':[],
  // moving between pages and start-up: index.html's last script calls startUp; pagesOn is a getter
  'start.js':['onSyncedData','openAdd','pagesOn','show','startUp','subBack','subOpen','subShown'],
  // start.js calls safetyStart and storageDown; add-save and kit storeFailure, saveFailed and askPersist; sync storeFailure,
  // storeFailText and adoptBackupSettings and sets storeToldAt with setStoreToldAt (S1a); add, add-card and app the tagging failure's
  // (tagFailText, tagFailed, tagFailNote, tagNetText, retryTag; tagWhy and tagNetLast have setters for the errreport and tagreads
  // tests); add-keep guardUnsaved; tagging oneStop; about errReport; seven page scripts errNote; dbDown is a getter (sync reads it);
  // errTapAt (a setter), errList and pruneTagImgs: tests only
  'safety.js':['adoptBackupSettings','askPersist','dbDown','errNote','errReport','guardUnsaved','oneStop','retryTag','safetyStart','saveFailed','setStoreToldAt','storageDown','storeFailText','storeFailure','tagFailNote','tagFailText','tagFailed','tagNetLast','tagNetText','tagWhy'],
  // settings.js, stats.js, start.js, add-card.js, add-save.js, shop.js and kit.js are classic scripts; vestMigrating is read by the
  // dress test only: a getter
  'dress.js':['dressNewItem','dressSummary','dressSynced','dressWhyUnused','migrateVests','newSuitVest','renderDressUI'],
  // every file that changes a card keeps it (addKeep, addKeepSoon); add and add-sheet (addWatch, addCardRec), kit (addRevive),
  // safety (addRestore); addKeepT is read by tests/addcards.test.js, which also assigns addRestoreState (add.js reads it): a setter
  'add-keep.js':['addCardRec','addKeep','addKeepSoon','addRestore','addRestoreState','addRevive','addWatch'],
  // colpick, look, settings and add-card are classic scripts; tagging.js, a module earlier in the list, reads openColForm and openPatForm
  // as globals (tests/restacts.test.js replaces those two on window, which reaches tagging.js's calls); guessPatBase is called by
  // tests/asmroute.test.js only
  'own-lists.js':['addCustomColor','addCustomPattern','addOwnMaterial','groupOf','matGuessUse','matOffer','newColHex','openColForm','openPatForm','ownColOffer','removeCustom','removeOwnMaterial','renderCustomUI','renderOwnMatUI','typePl'],
  // add, add-card, add-save, itemsheet, look, checklist and own-lists; colPick (a test assigns it) and rd (tests assign it) have setters, rdLast a getter; the rest: tests
  'colpick.js':['EP','NEW_COL','RD_LOOKUPS','SOCK_THIRD','SW_GRAB','accDel','closeColPick','cnHex','cnLeft','colHas','colNameTaken','colNear','colPick','colPickSel','colRows','colShows','colTarget','colTidy','openColNew','openColPick','openCustomNew','openPatNew','patBtn','patChoices','patVar','rdAddBtn','rdCost','rdCostLine','rdDoneHtml','rdEditorBtn','rdOff','rdStart','renderColPick','useColPick'],
  // itemsheet (orderHint, arriveVal, ARRIVE_PAST, checkArrivals), stats, wardrobe, care and shop (fmtDay), today, start and care
  // (checkArrivals); add-card and add-save read the rows; setOrder and setArrives are called by tests only
  'add-more.js':['ARRIVE_PAST','arriveVal','checkArrivals','fmtDay','orderHint','orderRow','qtyLabel','qtyOf','qtyRow'],
  // add, look, kit, wardrobe, colpick, safety, tagging, pattern-read and the other Add files find a card and save it with these;
  // saveAllOn is a let only add-save.js writes (add and add-card read it): a getter
  'add-save.js':['cardReady','save','saveAll','saveAllOn','savedTitle'],
  // add, itemsheet, look, tagging and colpick are classic scripts; add-sheet, add-more and checklist read these as globals too (no
  // page module imports another yet); setq, cardSafe, ckCheck and addCkSecs are also called by tests
  'add-card.js':['busyCard','cardSafe','ckLeftLine','ckLr','confBtn','errCard','formCard','matGuessOf','matNewOf','matchShadeE','matchShadeQ','multiErrCard','photoPair','setQField','setq','shadeRow','shirtColFix','typeCard'],
  // add (renderAddFor, npsDraw, npsId), ui (npsId, npsAsking, npsInert, npsCancel), start (npsLeave; it sets addFor with setAddFor, S1a);
  // addManual and npsClose by tests only; npsId and npsAsking are lets only add-sheet.js writes: getters
  'add-sheet.js':['npsAsking','npsCancel','npsDraw','npsId','npsInert','npsLeave','renderAddFor','setAddFor'],
  // the other Add files, tagging, pattern-read, measure, item-photo, migrate, safety, settings, kit and others draw and read cards with these; addCalm is a let only add.js writes (add-save reads it): a getter; the rest: tests
  'add.js':['PAIR_TYPES','STOPPED','addBackOnline','addCalm','addFiles','addTexture','dropTexture','errToHand','measureGuess','multiAgain','multiMsg','renderAdd','skipCard','stopRead','wbNote'],
  // tests/paste.test.js clears the line under the "Photo or link" field with it
  'add-paste.js':[],
  // core, item-photo and colpick are classic scripts; add-card, item-view, itemsheet, tagging, own-lists, add-save and checklist
  // are modules that read these as globals; LOOK_OTHER, lookSet, lookOwnMats, lookSetMat, lookShadeStep and lookCheck by tests only
  'look.js':['LOOK_COATS','LOOK_ENAMEL','LOOK_KS','LOOK_METALT','LOOK_METAL_COLS','LOOK_PAT_GROUPS','LOOK_PK','lookClipMetal','lookCu','lookCur','lookHasPat','lookOn','lookOpenFresh','lookOwnMatUI','lookPatGroupOf','lookSave','lookSection','lookSetEnamel','lookShadeHtml','lookShadeOk','lookSugCols','lookSugPats','lookUsePick','lookWrite','renderLookPick'],
  // start.js runs the four remakes, item-photo.js counts its own within the day's (remakeLeft, remakeSpend); REMAKE_DAY is read by
  // tests/tagreads.test.js only
  'migrate.js':['fixBlackBackdrops','recolourSpecSetts','remakeLeft','remakeSpend','upgradeCloseups','upgradePhotos'],
// the painter (C3, 2026-11-24): Today (asmFor, asmShown, asmEnsure), photos, settings, start, today-picture, colpick and the other painter files read these; asm-worker.js replaces asmData and asmJpeg and the tests stub asmAhead, asmAheadSoon and asmPhoto (lets with setters); ASM_ON, ASM_IDLE_MS, asmList, asmOut and asmW are assigned by tests (setters)
  'assemble.js':['ASM_AHEAD','ASM_BAR_AT','ASM_BAR_LEN','ASM_BAR_MM','ASM_CLOSEUP_MM','ASM_CREASE_DEG','ASM_FLOW','ASM_FORE_K','ASM_HB_AMP','ASM_HB_BREAK','ASM_HB_FLECK','ASM_HB_FLOAT','ASM_HB_FLOATL','ASM_HB_GRAIN','ASM_HB_MM','ASM_HB_MOTTLE','ASM_HB_PBRK','ASM_HB_RIB','ASM_HB_SNAP','ASM_HB_SOFT','ASM_HB_THIN','ASM_HB_TR','ASM_HB_YARN','ASM_LIN','ASM_LINE_PX','ASM_METAL','ASM_MICRO','ASM_MICRO_KINDS','ASM_ON','ASM_PX_MM','ASM_RETRY_MS','ASM_SHIRT_MM','ASM_SIZE','ASM_SLEEVE_FLOW','ASM_STRIPE','ASM_STRIPE_PX','ASM_SUITV','ASM_TEX_MIN_MM','ASM_TIEV','ASM_TIE_FIG_MAX','ASM_TIE_TEX_MAX','ASM_TR_CAP','ASM_TUBE_K','ASM_TWEED','ASM_TWILL','asmAreas','asmBarDraw','asmBarRgb','asmBarSig','asmBodyFlow','asmBuild','asmBuildAfter','asmBusy','asmClothOf','asmCmUse','asmData','asmDrawn','asmEnsure','asmFlowAt','asmFor','asmFullWins','asmGet','asmGetPre','asmHbCw','asmImg','asmJpeg','asmKeepOut','asmKey','asmLinen','asmLinenTile','asmList','asmListAt','asmListGet','asmLoad','asmLookId','asmMicroGrid','asmMicroKind','asmMicroTex','asmMotif','asmOutKey','asmPhoto','asmPolyAt','asmRepeatPx','asmRun','asmShow','asmShown','asmSleeveFlow','asmSleeveSegs','asmStamp','asmStripeCount','asmSuitBands','asmSuitSig','asmSuitTex','asmSuitTweed','asmSuitTwill','asmSuitWeave','asmSync','asmTexMm','asmTieFor','asmTieSig','asmTieTile','asmTq','asmTqn','asmTqr','asmTried','asmTubeAt','asmTubePart','asmTubePartQ','asmTubeRaw','asmTubeTabs','asmTweedTex','asmTweedTile','asmTwillTex','asmWeave','renderAsmUI','setAsmOut'],
// the painter (C3, 2026-11-24): the item sheet (asmGapNote), Settings (asmCmUI), today-picture (asmCmTile, asmCuTile) and the other painter files; asm-worker.js wraps asmCmPack and asmCmDiskPut, the tests stub asmCmPrep, asmCmSetup, asmCmBuild and asmCmHandEdge and clear asmCmMem, asmCmMf, asmCmCodeH and asmCmSrc (lets with setters)
  'asm-color.js':['ASM_CELL_FADE','ASM_CMV','ASM_CM_AA','ASM_CM_AA_CUT','ASM_CM_AA_FADE','ASM_CM_BG_SHADOW','ASM_CM_BTN','ASM_CM_KINDS','ASM_CM_LIGHT','ASM_CM_LOD0','ASM_CM_LOOK','ASM_CM_MIPS','ASM_CM_U16','ASM_CM_WINK','ASM_CM_WLIGHT','ASM_CU','ASM_HB_COL_LIFT','ASM_HB_SHIRT_Y','ASM_TIE_LIT','ASM_WT','asmCmBaseJob','asmCmBgGet','asmCmBgKey','asmCmBtnCol','asmCmBuild','asmCmButtons','asmCmCanvas','asmCmCodeSig','asmCmCodeText','asmCmDiskGet','asmCmDiskKey','asmCmDiskPut','asmCmEnsure','asmCmFinish','asmCmGet','asmCmHash','asmCmJob','asmCmKey','asmCmKind','asmCmLightKeys','asmCmLightPrep','asmCmMem','asmCmMf','asmCmMfGet','asmCmMfNow','asmCmMips','asmCmMp','asmCmOutKey','asmCmPack','asmCmPrep','asmCmRoute','asmCmSetup','asmCmSig','asmCmSrcSig','asmCmStamp','asmCmTile','asmCmUI','asmCmWarm','asmCmWarming','asmCuTile','asmCuWants','asmGapNote','asmHbShirt','asmKindOf','asmNkBaseOf','asmTieSheenK','asmWorstedTile','asmWtWants'],
// the painter (C3, 2026-11-24): assemble.js and asm-color.js paint the watch through these; the rest: tests
  'asm-watch.js':['asmWatchJob','asmWatchPaint','asmWatchPaints','asmWatchSig'],
// the painter (C3, 2026-11-24): assemble.js, asm-color.js and mannequin.js (asmPocketQuad); the rest: tests
  'asm-pocket.js':['asmPocketJob','asmPocketPaint','asmPocketQuad','asmPocketSig'],
// the painter (C3, 2026-11-24): assemble.js and asm-color.js route to the graphics chip, asm-worker.js answers its steps (asmGlPrepOff, asmGlFinOff, asmGlProbe); lab/gl-bench-run.js draws with asmGlContext, asmGlProgram, asmGlRenderer, asmGlPack, asmGlUpload and asmGlUploadGeo and clears asmGlState, asmGlNot (a getter) says in the console why the last look went to the CPU; the tests stub asmGlPaint and asmGlPage and set asmGlRetry (setters)
  'asm-gl.js':['ASM_GL_KINDS','asmGlContext','asmGlFinOff','asmGlFree','asmGlNot','asmGlNote','asmGlOnPage','asmGlPack','asmGlPage','asmGlPaint','asmGlPref','asmGlPrepOff','asmGlProbe','asmGlProgram','asmGlRenderer','asmGlState','asmGlTry','asmGlUI','asmGlUpload','asmGlUploadGeo','asmGlWhy'],
// the painter (C3, 2026-11-24): assemble.js and asm-color.js build the new garments' jobs and keys with these; the rest: tests
  'asm-kinds.js':['ASM_NK','asmCmKindOf','asmJfWants','asmNkBase','asmNkGet','asmNkJob','asmNkSig'],
// the painter (C3, 2026-11-24): assemble.js builds the blouse's job (asmOcpBase, asmOcpJob, asmOcpPaint), asm-color.js its key (asmOcpSig); asmOcpPhotoTex: tests
  'asm-ocp.js':['asmOcpBase','asmOcpJob','asmOcpPaint','asmOcpSig'],
  // start (renderStats, statsShow), wardrobe, care and cost (wornDays), dress (shoesWhyUnused), fav, cost, care and pack (the names and pictures); the rest: tests; statsOpen and fitMemo are getters (only stats.js writes them)
  'stats.js':['emptyAdd','renderStats','shoesWhyUnused','statDate','statName','statName1','statPic','statsShow','wornDays'],
  // history, today, itemsheet, wardrobe, scorecard and stats; favData, favSave and favToggleItem by the favorites tests only;
  // favWard is a let only fav.js writes (wardrobe.js reads it): a getter
  'fav.js':['FAV_UNDO_MS','favChip','favItemRow','favLastIcon','favMark','favOff','favPieces','favPillSeg','favStatsCard','favStrip','favWard','favWhy'],
  // calendar.js opens the page and sets the trip (openPack, packSetTrip), start.js shows it (packShow); the rest are called or read by
  // the pack, packcare-taps, planreview, stats, calendar, restacts and pocketsquare tests, which set packT and packNow (setters)
  'pack.js':['openPack','packSetTrip','packShow'],
  // itemsheet draws the Wardrobe and the item sheet with these, item-view lists with wardView, add-card draws its fields, add-save and
  // kit save them (wardSaveFields), colpick and own-lists set a field, dress.js runs the one-time renames (matMigrate, matRenameTo,
  // sockToeMigrate, sockLegacy), safety asks wardPendingRestore, fav reads wardFlt; the search and sort names, itemFieldSoon,
  // wardDeleteNow and WARD_UNDO_MS: tests only; tests/materials.test.js sets wardQ (a setter)
  'wardrobe.js':['WATCH_DETAILS_MAX','ivOn','matMigrate','matOnItem','matRenameTo','setItemField','sockLegacy','sockToeMigrate','wardBack','wardBar','wardCount','wardDelete','wardDuplicate','wardFieldsTop','wardFlt','wardFresh','wardGrid','wardKeep','wardPendingRestore','wardView'],
  // itemsheet, cost, wardrobe, add-more, settings, today, today-picture and remind; the rest: tests
  'care.js':['CARE_ABLE','careBackText','careBadge','careBandSoon','careCard','careFrame','careLimit','careLog','careNote','careReminders','careState','careTag','careTimes','careWashed','careWord','renderCare','renderCareUI'],
  // itemsheet (cpwSum, cpwBlock), add-card (cpwQRow), add-save (cpwSaveFields), stats (cpwStatsCard), care (cpwSettingsUI); the
  // other nine are read by tests/costwear.test.js only
  'cost.js':['cpwBlock','cpwQRow','cpwSaveFields','cpwSettingsUI','cpwStatsCard','cpwSum'],
  // stats (shopButton), start (closeShop), today-gestures (shopOpen); the rest: tests, which assign shop, shopBusy, shopWorker and shopShown (getters and setters)
  'shop.js':['closeShop','shopButton','shopOpen'],
  // the backup for every screen that saves (scheduleSync, syncNow) and the tests; restoring (snapshots.js), syncing and syncDue (tests)
  // have setters, syncTimer, syncRun and syncLater are getters
  'sync.js':['SYNC_SEND_MAX','WIPED_SYNC','afterPull','applyMerged','backedUpWords','localState','pulledYet','restoring','safariTab','scheduleSync','setRestoring','syncLaterRun','syncMark','syncNeedsPull','syncNow','syncPaused','syncRedraw','syncRun','syncTimer','syncUrl','syncWaiting','syncing','tabBrowser'],
  // backupfile.js draws the Backup line after a restore (showSyncStatus); the addcards and backup-storage tests too. Since the
  // restructure S3b the backup's state is sync.js's and an ended invitation who.js's
  'sync-status.js':['showSyncStatus'],
  // sync.js calls phIn, phOut and phBatch; PH_MIN, isPh, phMap and phStrings are read by tests only (backup-storage, lib-verify18)
  'sync-photos.js':['phBatch','phIn','phOut'],
  // settings.js lists the daily backups when Backup opens (loadSnapshots); the tests call the four (actsindex, backup-storage, clock,
  // rollback, sample)
  'snapshots.js':['loadSnapshots'],
  // kit.js offers the backup file (downloadBackup); the tests restore one (restoreBackup: actsindex, fieldmerge, records, wardrobe)
  'backupfile.js':['downloadBackup'],
  // ui, add, setup and pattern-read read the invitation link's state (who is connected is who.js's since the restructure S3b), kit and
  // remind iosInSafari and myInviteLink; the rest: tests. inviteChecking has a setter (tests assign it); acctWhy and acctLinkRun are getters
  'account.js':['acctFailText','acctTyped','acctWhy','connectFromLink','inviteChecking','iosInSafari','limitNote','myInviteLink'],
  // start.js starts and yields the setup (setupStart, setupYield), account and kit read and redraw it (setup, SETUP_STEPS, setupShown,
  // setupDraw, setupFinish, setupSample), today, stats and wardrobe draw the empty states (setupNeeds, setupToday, setupWardEmpty),
  // weather asks tzCountry; the rest: tests only. SETUP_STEPS is a getter (only setup.js writes it), setup has a setter
  // (tests/rollback.test.js)
  'setup.js':['SETUP_STEPS','setup','setupDraw','setupFinish','setupNeeds','setupSample','setupShown','setupStart','setupToday','setupWardEmpty','setupYield','tzCountry'],
  // account, setup, item-photo, calendar, add-save, add-keep, app, itemsheet, wardrobe, start, stats, sync, sync-status, today, remind, safety,
  // about use it; the rest: tests. kitNoMine (itemsheet.js) and kitSdNew (tests/sample.test.js) have setters, the other lets are getters
  'kit.js':['HOME_CARD','PAPER_CARD','homeAbout','homeAndroid','homeBrowser','homeCopyBtn','homeIOS','homeNeeded','homeOpen','homeShareShort','homeStandalone','homeSteps','homeTester','kit','kitClose','kitDuplicate','kitEdited','kitFixOldImports','kitImportOpen','kitNoMine','kitOpen','kitQuiet','kitSampleBanner','kitSampleLoad','kitSampleMigrate','kitSampleNote','kitSampleTag','kitSaved','kitSentStamp','kitShareDone','kitShareFilter','kitStartRow','kitUserEdit','safariRemind','setKitNoMine','tourOpen','tourSeen'],
  // settings.js (calSummary) and today.js (calBanner) are classic scripts; the rest are read by the calendar test, calBusy by the
  // restacts test only: a getter
  'calendar.js':['calBanner','calSummary'],
  // history.js, settings.js, start.js and care.js are classic scripts (remindSoon); the rest are read by the remind, connkeep and
  // restacts tests, remindBusy too (a getter: only remind.js writes it)
  'remind.js':['remindSoon'],
  // safety (appVersion), account (ABOUT_NOTE, wipeDevice), settings (renderAbout); the rest: tests; aboutUpdating has a setter (tests/invite.test.js)
  'about.js':['ABOUT_NOTE','appVersion','renderAbout','wipeDevice'],
};
/* file -> names its row gained after its conversion (each with the reason beside it); every one is in BRIDGE too */
const GROWN={
  // restructure S3c (2026-11-26): what the files loaded before add.js read moved down out of it: applyWb into measure.js, TEX_MIN_PX and
  // TEX_MAX into tag-request.js (beside CLOSE_MAX; migrate.js and item-photo.js read them too); the Add card's setQField from wardrobe.js
  // into add-card.js
  'tag-request.js':['TEX_MAX','TEX_MIN_PX'],
  'measure.js':['applyWb'],
  'add-card.js':['setQField'],
  // restructure S1a (2026-11-25): the setters other files call instead of assigning the owner's let (once files import each other an
  // imported binding is read-only); setFlt moved here from itemsheet.js
  // and restructure S3a (2026-11-26): the motion helpers moved down out of the screens (RESTRUCTURE-PLAN.md section 3): MONTH_MS and
  // MONTH_EASE from month.js into core.js (start.js, a required file, eases the pages on them), revealNeed, pageScroll and monthBelow
  // from month.js and keepInView and foldQuiet from today.js into boxfold.js
  'core.js':['MONTH_EASE','MONTH_MS','setClimate','setClockSkew','setWeather'],
  'boxfold.js':['foldQuiet','keepInView','monthBelow','pageScroll','revealNeed'],
  'app.js':['setAiError','setAiModel','setConnReady','setDbConn','setDbCur','setDbWiping','setFlt','setSel','setView'],
  'add-sheet.js':['setAddFor'],
  'history.js':['setPastEdit','setSwapMsg','setTodayPullWait'],
  'scorecard.js':['setScoreOpen'],
  'today.js':['setListOpen'],
  'month.js':['setMonthOpen'],
  'photos.js':['setRemoteKeys'],
  'settings.js':['setSetSeen','setViewStale'],
  'safety.js':['setStoreToldAt'],
  'assemble.js':['setAsmOut'],
  // and restructure S3b (2026-11-26): the backup's state (the pause, the status words) moved down from sync-status.js into sync.js
  'sync.js':['backedUpWords','safariTab','setRestoring','syncPaused','syncWaiting','tabBrowser'],
  'kit.js':['setKitNoMine'],
};
const WORKERS=['asm-worker.js','analysis-worker.js'];
let PLATFORM=null;
const platform=()=>{if(!PLATFORM){PLATFORM=new Set();try{const g=require('globals');for(const n of Object.keys({...g.browser,...g.worker}))PLATFORM.add(n)}catch(e){}}return PLATFORM};

/* the Node files whose functions run in the page (page.evaluate): tests/ (not the fixtures, not the old builds) and tools/ */
function nodeFiles(ROOT){
  const out=[],walk=d=>{let l=[];try{l=fs.readdirSync(path.join(ROOT,d),{withFileTypes:true})}catch(e){}
    for(const e of l){const f=d+'/'+e.name;
      if(e.isDirectory()){if(f!=='tests/fixtures'&&f!=='tests/replay/.work'&&e.name!=='node_modules')walk(f)}
      else if(e.name.endsWith('.js'))out.push(f)}};
  walk('tests');walk('tools');return out;
}
/* the names a file assigns without declaring them (`name = …`, `name++`, destructuring), and `window.name = …`: Map name -> count */
function writesOf(src,module){
  let ast;const opt={ecmaVersion:'latest',ranges:true,allowReturnOutsideFunction:!module,allowHashBang:true};
  try{ast=acorn.parse(src,{...opt,sourceType:module?'module':'script'})}catch(e){try{ast=acorn.parse(src,{...opt,sourceType:'module',allowReturnOutsideFunction:false});module=true}catch(e2){return null}}
  const out=new Map(),add=n=>out.set(n,(out.get(n)||0)+1);
  const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:module?'module':'script'}).globalScope,own=new Set(g.variables.filter(v=>v.defs.length).map(v=>v.name));
  // (r.init: a declaration's own initializer, which escope leaves unresolved in a function that has a direct eval: tests/sample.test.js's
  // `const key=` sat beside an eval(pd) and read as a write of core.js's key)
  for(const r of g.through)if(r.isWrite()&&!r.init&&!own.has(r.identifier.name))add(r.identifier.name);
  for(const m of src.matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*(?:=(?!=)|\+\+|--|[-+*\/%&|^]=|\*\*=|<<=|>>>?=|&&=|\|\|=|\?\?=)/g))add(m[1]);
  return out;
}

/* the names a text uses without declaring them (reads, calls, typeof guards, writes), or null when it doesn't parse */
function freeNames(src,module){
  let ast;const o={ecmaVersion:'latest',ranges:true,allowReturnOutsideFunction:!module,allowHashBang:true};
  try{ast=acorn.parse(src,{...o,sourceType:module?'module':'script'})}catch(e){try{ast=acorn.parse(src,{...o,sourceType:'module',allowReturnOutsideFunction:false});module=true}catch(e2){return null}}
  const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:module?'module':'script'}).globalScope,own=new Set(g.variables.filter(v=>v.defs.length).map(v=>v.name));
  return [...new Set(g.through.map(r=>r.identifier.name))].filter(n=>!own.has(n));
}
const ON_GLOBAL=/\b(?:window|self|globalThis)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\])/g;
const VIA_HOOK=/\bHOOK\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\])/g;
const ASSIGN_AFTER=/^\s*(?:=(?!=)|\+\+|--|[-+*\/%&|^]=|\*\*=|<<=|>>>?=|&&=|\|\|=|\?\?=)/;   // (what follows window.name when it is assigned)
const HOOK_WRITE=/\bHOOK\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\])\s*(?:=(?!=)|\+\+|--|[-+*\/%&|^]=|\*\*=|<<=|>>>?=|&&=|\|\|=|\?\?=)/g;
/* T2 phase 3 (2026-11-25): strings that are not code though they parse as code: a file name ('shop.js' is `shop.js`), a host name
   ('shop.test'), an id or key ('rd-camo' is `rd - camo`; a whole string of words joined by hyphens, no space); and in a string that
   doesn't parse, what is markup or data: an attribute selector's value (`[data-act="setOpenTap"]`), a tab-separated record (a
   tests/impact.map line). None of them is a use of a page name, and the rewrite leaves them alone. */
const FILE_NAME=/^[\w$.\/*-]*\.(?:m?js|cjs|html?|css|json|png|jpe?g|webp|gif|svg|ico|txt|md|csv|ics|webmanifest|wasm|ya?ml|toml|ps1|sh)$/i;
const HOST_NAME=/^(?:[\w-]+\.)+(?:test|localhost|invalid|example|com|org|net)(?::\d+)?$/i;
const ID_LIKE=/^[\w$]+(?:-[\w$]+)+$/;
const CLI_FLAG=/^--[A-Za-z][\w-]*(?:=\S*)?$/;   // (a command-line flag: '--show' parses as a decrement of show, '--save-times' as save less times; S1a)
const notCode=t=>FILE_NAME.test(t)||HOST_NAME.test(t)||ID_LIKE.test(t)||CLI_FLAG.test(t);
const ATTR_SEL=/\[\s*[\w-]+\s*[~|^$*]?=\s*(?:"[^"]*"|'[^']*'|[^\]\s]*)\s*\]/g;
const markup=t=>/\t/.test(t)?'':t.replace(ATTR_SEL,s=>' '.repeat(s.length));   // (a non-code string's words, the markup and data blanked)
/* S1f (2026-11-25): two more kinds of string that parse as code and are not: a string searched for in another (the first argument
   of includes, indexOf, lastIndexOf, startsWith, endsWith: tests/motif.test.js's `m.def.includes(\`fill="${…}"\`)`, SVG markup, read
   as an assignment of fill), and a call's label: a string that is one call (`'loadSnapshots()'`, `'findCity()'`: what a wrapper
   records, tests/actsindex.test.js `step(what, act, 'findCity()')`) handed straight to a helper of the file (a plain name called)
   that is not inside a call that runs code (page.evaluate, addInitScript, waitForFunction, vm's runIn…Context, Function, eval). A
   one-call string anywhere else is code as before: `p.evaluate('rd()')`, and one kept in a list or a variable to be run later
   (tests/folds.test.js `[['score','toggleScore()','#sbox']]`, tools/cssdiff.js's screens). */
const SEARCHED=new Set(['includes','indexOf','lastIndexOf','startsWith','endsWith']);
const RUNS_CODE=new Set(['evaluate','evaluateHandle','$eval','$$eval','addInitScript','waitForFunction','runInContext','runInNewContext','runInThisContext','Script','Function','eval','compileFunction']);
const CALL_LABEL=/^\s*[A-Za-z_$][\w$]*\((?:[^()'"`]|'[^']*'|"[^"]*")*\)\s*$/;
const calleeName=c=>c.type==='Identifier'?c.name:c.type==='MemberExpression'&&!c.computed&&c.property.type==='Identifier'?c.property.name:null;
/* the string nodes of a parsed file that are not code by those two rules (searched for, or a call's label outside code) */
function notCodeStrings(ast){const out=new Set();
  const str=n=>n&&(n.type==='Literal'&&typeof n.value==='string'||n.type==='TemplateLiteral');
  const walk=(n,ev)=>{if(!n||typeof n.type!=='string')return;
    if((n.type==='CallExpression'||n.type==='NewExpression')&&n.callee){const c=calleeName(n.callee);
      if(n.callee.type==='MemberExpression'&&SEARCHED.has(c)&&str(n.arguments[0]))out.add(n.arguments[0]);
      if(RUNS_CODE.has(c))ev=true;
      else if(!ev&&n.callee.type==='Identifier')for(const a of n.arguments)if(a.type==='Literal'&&typeof a.value==='string'&&CALL_LABEL.test(a.value))out.add(a)}
    for(const k in n){if(k==='range'||k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(x=>walk(x,ev));else if(v&&typeof v.type==='string')walk(v,ev)}};
  walk(ast,false);return out}
/* A test's or tool's uses of page names (T2, 2026-11-25): {global: Set (bare or on window/self/globalThis), hook: Set (`HOOK.name`),
   globalWrites: Set, hookWrites: Set}. Its code (the functions handed to page.evaluate are code like any other) and the code inside
   its strings (page.evaluate('…'), addInitScript, a SETUP template: a string is parsed as JS, a template with each ${…} as 0; one that
   doesn't parse is read word by word, a word after a dot left out, so a name in an ok() message counts too: the safe side). Not a
   string joined after appSrc(…)/asScript(…): the vm tests run that in the files' own scope, where no bridge is involved. */
function testUses(src,words){
  const out={global:new Set(),hook:new Set(),globalWrites:new Set(),hookWrites:new Set()};
  const take=(text,code)=>{if(!code&&/^\s*[A-Za-z_$][\w$]*\s*$/.test(text))return;   // (one word alone is a key: metaGet('shop'); no test evaluates one)
    const f=freeNames(text,false);
    if(f){for(const n of f)if(words.has(n))out.global.add(n);for(const [n] of writesOf(text,false)||[])if(words.has(n))out.globalWrites.add(n)}
    else if(!code)for(const m of markup(text).matchAll(/(?<![\w$.#-])[A-Za-z_$][\w$]*(?![\w$-])/g))if(words.has(m[0]))out.global.add(m[0]);   // (not a CSS name: #shop-btn)
    for(const m of text.matchAll(ON_GLOBAL))if(words.has(m[1]||m[2]))out.global.add(m[1]||m[2])};
  take(src,true);
  let ast=null,cm=[];const o={ecmaVersion:'latest',ranges:true,allowHashBang:true,onComment:(b,t,a,z)=>cm.push([a,z])};
  try{ast=acorn.parse(src,{...o,sourceType:'script',allowReturnOutsideFunction:true})}catch(e){cm=[];try{ast=acorn.parse(src,{...o,sourceType:'module'})}catch(e2){cm=[]}}
  let code=src;for(const [a,z] of cm)code=code.slice(0,a)+code.slice(a,z).replace(/[^\r\n]/g,' ')+code.slice(z);   // (HOOK.name in a comment is no use)
  for(const m of code.matchAll(VIA_HOOK))out.hook.add(m[1]||m[2]);
  for(const m of code.matchAll(HOOK_WRITE))out.hookWrites.add(m[1]||m[2]);
  if(!ast)return out;
  const lexical=new Set(),strs=[];
  const left=e=>{while(e&&e.type==='BinaryExpression'&&e.operator==='+')e=e.left;return e};
  const prose=n=>{if(!n||typeof n.type!=='string')return;if(n.type==='Literal'||n.type==='TemplateQuasi'||n.type==='TemplateLiteral')lexical.add(n);
    for(const k in n){if(k==='range'||k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(prose);else if(v&&typeof v.type==='string')prose(v)}};
  const walk=n=>{if(!n||typeof n.type!=='string')return;
    // (an ok() message is words for a person: tests/run.js ok(cond, message))
    if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='ok'&&n.arguments[1])prose(n.arguments[1]);
    if(n.type==='BinaryExpression'&&n.operator==='+'){const l=left(n);
      if(l&&l.type==='CallExpression'&&l.callee.type==='Identifier'&&/^(?:appSrc|asScript)$/.test(l.callee.name)){let e=n;while(e.type==='BinaryExpression'&&e.operator==='+'){lexical.add(e.right);e=e.left}}}
    if(n.type==='Literal'&&typeof n.value==='string')strs.push([n,n.value]);
    else if(n.type==='TemplateLiteral')strs.push([n,n.quasis.map(q=>q.value.cooked==null?q.value.raw:q.value.cooked).join('0')]);
    for(const k in n){if(k==='range'||k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v.type==='string')walk(v)}};
  walk(ast);
  for(const n of notCodeStrings(ast))lexical.add(n);
  for(const [n,text] of strs){if(lexical.has(n)||text.length<2||notCode(text))continue;
    let any=false;for(const m of text.matchAll(/[A-Za-z_$][\w$]*/g))if(words.has(m[0])){any=true;break}
    if(any)take(text,false)}
  return out;
}
/* T2 phase 2's rewrite of one test or tool file: each global use of a name in `names` (a bare name, `window.name`, in the code and in
   the code of its strings, as testUses reads them) becomes `HOOK.name` (`{name}` becomes `{name:HOOK.name}`). {out, n (uses
   rewritten), manual: [text]}: what it leaves for a person: a `typeof name` (HOOK.name throws for a missing name in a test's page;
   write `'name' in HOOK`), a string with an escape in it, a string that isn't code (a sentence: reword it, or leave it, the name then
   stays on BRIDGE). `node tests/bridge.test.js --to-hook <file> [--write]` runs it with the names only the tests use. */
function toHook(src,names,writes=new Set(),noSet=new Set()){
  const edits=[],manual=[],any=w=>names.has(w)||writes.has(w)||noSet.has(w);
  const line=at=>src.slice(0,at).split('\n').length;
  const code=(text,base,top)=>{let ast;const o={ecmaVersion:'latest',ranges:true,allowHashBang:true};
    try{ast=acorn.parse(text,{...o,sourceType:'script',allowReturnOutsideFunction:true})}catch(e){try{ast=acorn.parse(text,{...o,sourceType:'module'})}catch(e2){return null}}
    const short=new Set(),tyof=new Set(),strs=[],skip=new Set();
    const mark=n=>{if(!n||typeof n.type!=='string')return;if(n.type==='Literal'||n.type==='TemplateLiteral')skip.add(n);for(const k in n){if(k==='range'||k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(mark);else if(v&&typeof v.type==='string')mark(v)}};
    const walk=n=>{if(!n||typeof n.type!=='string')return;
      if(n.type==='Property'&&n.shorthand&&n.value.type==='Identifier')short.add(n.value);
      if(n.type==='Property'&&n.shorthand&&n.value.type==='AssignmentPattern'&&n.value.left.type==='Identifier')short.add(n.value.left);   // ({x=1}=o)
      if(n.type==='UnaryExpression'&&n.operator==='typeof'&&n.argument.type==='Identifier')tyof.add(n.argument);
      if(top&&n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='ok'&&n.arguments[1])mark(n.arguments[1]);
      if(top&&n.type==='BinaryExpression'&&n.operator==='+'){let l=n;while(l.type==='BinaryExpression'&&l.operator==='+')l=l.left;
        if(l.type==='CallExpression'&&l.callee.type==='Identifier'&&/^(?:appSrc|asScript)$/.test(l.callee.name)){let e=n;while(e.type==='BinaryExpression'&&e.operator==='+'){mark(e.right);e=e.left}}}
      if(top&&(n.type==='Literal'&&typeof n.value==='string'||n.type==='TemplateLiteral'))strs.push(n);
      for(const k in n){if(k==='range'||k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v.type==='string')walk(v)}};
    walk(ast);
    if(top)for(const n of notCodeStrings(ast))mark(n);
    const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:ast.sourceType}).globalScope,own=new Set(g.variables.filter(v=>v.defs.length).map(v=>v.name));
    for(const r of g.through){const id=r.identifier,n=id.name;if(own.has(n))continue;
      // (a name the tests assign, S1a: only where it is assigned, `x=`, `x+=`, `x++`, a destructuring target; a read, `x.y=` and `x[k]=`
      // (a change to the object, not the name) stay as they are)
      if(!names.has(n)){if(!r.isWrite()||r.init)continue;
        if(noSet.has(n)){manual.push(`line ${line(base+id.range[0])}: assigns ${n}, which has no HOOK setter (not a \`let\`: replace the function another way)`);continue}
        if(!writes.has(n))continue}
      if(tyof.has(id)){manual.push(`line ${line(base+id.range[0])}: typeof ${n} (write '${n}' in HOOK, or HOOK.${n} where it must be there)`);continue}
      edits.push([base+id.range[0],base+id.range[1],short.has(id)?`${n}:HOOK.${n}`:`HOOK.${n}`])}
    for(const m of text.matchAll(/\b(?:window|self|globalThis)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*(['"])([A-Za-z_$][\w$]*)\2\s*\])/g)){const n=m[1]||m[3];
      const set=()=>ASSIGN_AFTER.test(text.slice(m.index+m[0].length));
      if(names.has(n)||writes.has(n)&&set())edits.push([base+m.index,base+m.index+m[0].length,`HOOK.${n}`]);
      else if(noSet.has(n)&&set())manual.push(`line ${line(base+m.index)}: assigns ${m[0]}, which has no HOOK setter (not a \`let\`: replace the function another way)`)}
    return {strs,skip}};
  const t=code(src,0,true);if(!t)return {out:src,n:0,manual:['the file does not parse']};
  for(const s of t.strs){if(t.skip.has(s))continue;let text,base;
    if(s.type==='Literal'){const raw=src.slice(s.range[0]+1,s.range[1]-1);if(!/[A-Za-z_$]/.test(raw))continue;
      let hit=false;for(const m of raw.matchAll(/[A-Za-z_$][\w$]*/g))if(any(m[0])){hit=true;break}if(!hit)continue;
      if(raw!==s.value&&/\t/.test(s.value)&&freeNames(s.value,false)==null)continue;   // (a tab-separated record: data)
      if(raw!==s.value){const u=[...raw.matchAll(/[A-Za-z_$][\w$]*/g)].map(m=>m[0]).filter(w=>names.has(w)),wr=[...(writesOf(s.value,false)||[]).keys()].filter(w=>writes.has(w)||noSet.has(w));
        if(u.length||wr.length)manual.push(`line ${line(s.range[0])}: a string with an escape in it `+(u.length?`uses ${u.join(', ')}`:`assigns ${wr.join(', ')}`));continue}
      if(/^\s*[A-Za-z_$][\w$]*\s*$/.test(raw)||notCode(raw))continue;
      text=raw;base=s.range[0]+1}
    else{const a=s.range[0]+1,b=s.range[1]-1,q=s.quasis;text=src.slice(a,b);
      for(let i=0;i+1<q.length;i++){const x=q[i].range[1]-a,y=q[i+1].range[0]-a;text=text.slice(0,x)+'0'.padEnd(y-x,' ')+text.slice(y)}   // (each ${…} a 0, the same length)
      let hit=false;for(const m of text.matchAll(/[A-Za-z_$][\w$]*/g))if(any(m[0])){hit=true;break}if(!hit||notCode(text))continue;
      base=a}
    if(!code(text,base,false)){const w=[...new Set([...markup(text).matchAll(/(?<![\w$.#-])[A-Za-z_$][\w$]*(?![\w$-])/g)].map(m=>m[0]).filter(x=>names.has(x)))];
      if(w.length)manual.push(`line ${line(s.range[0])}: a string that isn't code uses ${w.join(', ')} (reword it if it is a sentence)`)}}
  edits.sort((x,y)=>y[0]-x[0]);let out=src,last=Infinity,n=0;
  for(const [a,b,r] of edits){if(b>last)continue;out=out.slice(0,a)+r+out.slice(b);last=a;n++}
  return {out,n,manual};
}
/* T2 (2026-11-25): who uses each bridged name.{name: {file, app: [files], tests: [files], hook: [files], testWrites: [files],
   hookWrites: [files]}}. The app: the page scripts but the name's own file, index.html's inline scripts, the Web Workers' own files
   and lab/ (a read, a call, a typeof guard, a write, `window.name`). The tests: tests/ and tools/ (testUses). A name the app doesn't
   use and the tests use only through HOOK can come off BRIDGE (T2 phase 3); one the tests still use as a global can't yet. */
function readers(ROOT,m){
  m=m||measure(ROOT);const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8'),owner=new Map(),out={},viaHook={},hookWrites={};
  for(const [f,l] of Object.entries(m.bridge))for(const n of l){owner.set(n,f);out[n]={file:f,app:[],tests:[],hook:[],testWrites:[],hookWrites:[]}}
  const words=new Set(owner.keys());
  const app=(f,src,module)=>{const s=new Set(freeNames(src,module)||[]);for(const x of src.matchAll(ON_GLOBAL))s.add(x[1]||x[2]);
    for(const n of s)if(words.has(n)&&owner.get(n)!==f)out[n].app.push(f)};
  const tags=modscope.pageScripts(ROOT);
  for(const t of tags)app(t.src,rd(t.src),t.module);
  const html=rd('index.html');let i=0;
  for(const x of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))app('index.html (inline script '+(++i)+')',x[1],false);
  for(const w of [...WORKERS,'cal-worker.js'])if(fs.existsSync(path.join(ROOT,w)))app(w,rd(w),true);
  let lab=[];try{lab=fs.readdirSync(path.join(ROOT,'lab'))}catch(e){}
  for(const f of lab){const p='lab/'+f;
    if(f.endsWith('.js'))app(p,rd(p),false);
    else if(f.endsWith('.html')){let j=0;for(const x of rd(p).matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))app(p+' (inline script '+(++j)+')',x[1],false)}}
  for(const f of nodeFiles(ROOT)){if(f==='tests/bridge.test.js'||f==='tests/hook.js')continue;   // (its rows name every bridged name as a string; the access point's own root)
    const u=testUses(rd(f),words);
    for(const n of u.global)out[n].tests.push(f);
    for(const n of u.globalWrites)out[n].testWrites.push(f);
    for(const n of u.hook){if(out[n])out[n].hook.push(f);(viaHook[n]=viaHook[n]||[]).push(f)}
    for(const n of u.hookWrites){if(out[n])out[n].hookWrites.push(f);(hookWrites[n]=hookWrites[n]||[]).push(f)}}
  Object.defineProperties(out,{viaHook:{value:viaHook},hookWrites:{value:hookWrites}});   // (every name a test reads or writes as HOOK.name, bridged or not)
  return out;
}
/* S1a (2026-11-25): the bridged names --to-hook rewrites where a test assigns them: {writes: those a module puts on HOOK with a setter,
   noSet: those a test assigns that have none (a function: the rewrite names them for a person)} */
function writeSets(r,hk){const writes=new Set(),noSet=new Set();
  for(const l of Object.values(hk.hooked))for(const [n,x] of l)if(x.set&&r[n]&&!OLD_BUILD.has(n))writes.add(n);
  for(const n of Object.keys(r))if(r[n].testWrites.length&&!writes.has(n)&&!OLD_BUILD.has(n))noSet.add(n);
  return {names:new Set(hk.testOnly.filter(n=>!OLD_BUILD.has(n))),writes,noSet}}
/* the names a test also uses on an older build, which has no HOOK (T2 phase 3): they stay globals there, so --to-hook leaves them */
const OLD_BUILD=new Set(['syncing','kitEdited','asmCmMf','asmCmCodeSig','asmCmSig','asmCmSrcSig']);
/* of those, the ones a test assigns there, and the file (S1f): garmentpaint.test.js gives origin/main's page a HOOK of its own whose
   setter writes asmCmMf, the page's global on that build */
const OLD_BUILD_WRITES={asmCmMf:['tests/garmentpaint.test.js']};
/* T2: every module's HOOK statement checked against what the tests use. {hooked: {file: Map name -> {value, get, set}}, problems,
   missing: names only the tests use that their file doesn't put on HOOK, ready: those the tests use through HOOK alone (they can
   come off BRIDGE), testOnly: [names]} */
function hookCheck(ROOT,m,r){
  const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8'),tags=modscope.pageScripts(ROOT),problems=[],hooked={},where=new Map();
  const blankHook=(src,ranges)=>{let s=src;for(const [a,b] of ranges)s=s.slice(0,a)+s.slice(a,b).replace(/[^\r\n]/g,' ')+s.slice(b);return s};
  const noHook=(f,src)=>{if(/\bHOOK\b/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'')))problems.push(`${f} reads HOOK: the app must not depend on the tests' access point`)};
  for(const t of tags){const f=t.src,src=rd(f);let ast;try{ast=modscope.parse(src,t.module)}catch(e){continue}
    const h=modscope.hooked(ast,src);noHook(f,blankHook(src,h.ranges));
    if(!h.count)continue;
    if(!t.module){problems.push(`${f} is a classic script: its top-level names are the page's already, it has no HOOK statement`);continue}
    if(h.count>1)problems.push(`${f} has ${h.count} HOOK statements: one, after its bridge`);
    for(const o of h.odd)problems.push(`${f}: a HOOK property the checkers can't read: ${o}`);
    hooked[f]=h.names;
    const at=h.ranges[0][0],decl=new Map();
    for(const st of ast.body){const s=st.type==='ExportNamedDeclaration'&&st.declaration?st.declaration:st;
      for(const d of modscope.declared({body:[s]}))if(!decl.has(d.name))decl.set(d.name,{kind:d.kind,at:st.range[0]})}
    for(const [n,x] of h.names){const d=decl.get(n),mut=d&&/^(?:let|var)$/.test(d.kind);
      if(where.has(n))problems.push(`${n} is on HOOK from ${where.get(n)} and ${f}`);else where.set(n,f);
      if(!d){problems.push(`${f} puts ${n} on HOOK, but ${n} is not one of its top-level names`);continue}
      if(x.value&&(x.get||x.set))problems.push(`${f}: ${n} is on HOOK twice (a value and an accessor)`);
      if(x.value&&mut)problems.push(`${f}: ${n} is a \`${d.kind}\` put on HOOK as a value (the copy keeps the value of that moment): write \`get ${n}(){return ${n}}\``);
      if((x.get||x.set)&&!mut)problems.push(`${f}: ${n} has a HOOK accessor but is not a \`let\` of ${f}: write it as \`${n}\``);
      if(x.set&&!x.get)problems.push(`${f}: ${n} has a HOOK setter and no getter`);
      if(x.value&&d.kind!=='function'&&d.at>at)problems.push(`${f}: ${n} is declared after the HOOK statement, which would throw at load: put the statement after the bridge, at the end`)}}
  for(const w of [...WORKERS,'cal-worker.js'])if(fs.existsSync(path.join(ROOT,w)))noHook(w,rd(w));
  const html=rd('index.html').replace(/<!--[\s\S]*?-->/g,'');for(const x of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))noHook('index.html (an inline script)',x[1]);
  let lab=[];try{lab=fs.readdirSync(path.join(ROOT,'lab')).filter(f=>/\.(?:js|html)$/.test(f))}catch(e){}
  for(const f of lab)noHook('lab/'+f,rd('lab/'+f));
  const testOnly=Object.keys(r).filter(n=>!r[n].app.length&&(r[n].tests.length||r[n].hook.length)).sort();
  const on=n=>where.has(n)?hooked[where.get(n)].get(n):null;
  const missing=testOnly.filter(n=>!on(n)).map(n=>`${r[n].file}: ${n}`);
  const ready=testOnly.filter(n=>on(n)&&!r[n].tests.length);
  for(const [n,l] of Object.entries(r.viaHook))if(!on(n))problems.push(`${[...new Set(l)].join(', ')} ${l.length>1?'read':'reads'} HOOK.${n}, which no module puts on HOOK`);
  for(const n of testOnly){const h=on(n),w=[...new Set([...r[n].testWrites,...r[n].hookWrites])];if(h&&w.length&&!h.set)problems.push(`${n} is assigned by ${w.join(', ')}, but ${where.get(n)} puts it on HOOK without \`set ${n}(v){${n}=v}\``)}
  for(const [n,l] of Object.entries(r.hookWrites)){const h=on(n);if(h&&!h.set)problems.push(`${[...new Set(l)].join(', ')} assign${l.length>1?'':'s'} HOOK.${n}, which ${where.get(n)} puts on HOOK without a setter (the write would only hide it)`)}
  for(const [n,f] of where)if(!(r[n]&&(r[n].tests.length||r[n].hook.length))&&!r.viaHook[n])problems.push(`${f} puts ${n} on HOOK, but no test uses it: take it off`);
  return {hooked,problems,missing,ready,testOnly};
}

/* {page, mods, bridge: {file: [names]}, problems: [text], unbridged: [text], unseen: [text], assets: [text]} for the app in ROOT */
function measure(ROOT){
  const tags=modscope.pageScripts(ROOT),page=tags.map(t=>t.src),mods=tags.filter(t=>t.module).map(t=>t.src),isMod=new Set(mods);
  const problems=[],bridge={},info={},srcs={},how={},spelled={};
  for(const f of page){const m=isMod.has(f),src=srcs[f]=fs.readFileSync(path.join(ROOT,f),'utf8');let ast;
    try{ast=modscope.parse(src,m)}catch(e){if(m)problems.push(`${f} doesn't parse as a module: ${e.message}`);continue}   // (a classic script that doesn't parse is ESLint's to report)
    const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:m?'module':'script'}).globalScope,own=new Set(g.variables.map(v=>v.name));
    info[f]={top:modscope.declared(ast).map(d=>d.name),free:[...new Set(g.through.map(r=>r.identifier.name))].filter(n=>!own.has(n))};
    if(!m)continue;
    const b=modscope.bridged(ast,src),kind=new Map(modscope.declared(ast).map(d=>[d.name,d.kind]));bridge[f]=[...b.names.keys()].sort();
    for(const o of b.odd)problems.push(`${f}: a bridge statement the checkers can't read (name each property plainly): ${o}`);
    if(!modscope.hasModuleSyntax(ast))problems.push(`${f} is loaded as a module but has no import or export: add \`export {}\`, so TypeScript and tests/appsrc.js see a module too`);
    /* each name is handed over the way its declaration needs */
    for(const [n,k] of b.names){const a=b.acc.get(n),mut=/^(?:let|var)$/.test(kind.get(n)||'');how[n]={file:f,set:!!(a&&a.set),assign:k==='assign',own:kind.has(n)};
      if(k==='assign'){if(mut)problems.push(`${f}: ${n} is a \`${kind.get(n)}\` handed over with Object.assign, so the global keeps the value it had then: bridge it with a getter (Object.defineProperties(globalThis, {${n}: {get: () => ${n}}}))`);continue}
      if(!a)continue;
      if(!a.get||a.reads!==n)problems.push(`${f}: the bridge of ${n} needs \`get: () => ${n}\``+(a.get?' (its getter gives something else back, or more than that)':' (it has no getter)'));
      else if(!mut)problems.push(`${f}: ${n} has a getter but is not a \`let\` of ${f}: hand a function or a constant over with Object.assign(globalThis, {${n}})`);
      else if(a.set&&a.writes!==n)problems.push(`${f}: the setter of ${n} must be \`set: v => {${n} = v}\``)}
    for(const i of modscope.imports(ast,f)){
      if(i.odd)problems.push(`${f}: its import from ${i.from} is ${i.odd}`);
      else if(!isMod.has(i.from))problems.push(`${f} imports ${i.from}, which is not a type="module" script in index.html (every module has its own tag)`);
      else (spelled[i.from]=spelled[i.from]||new Set()).add(i.from)}}
  /* who gives the page each global name: a classic script its top-level names, a module its bridge */
  const giver=new Map(),kept=new Map();
  for(const f of page){if(!info[f])continue;
    if(!isMod.has(f)){for(const n of info[f].top)if(!giver.has(n))giver.set(n,f);continue}
    for(const n of bridge[f]){const o=giver.get(n);
      if(o&&o!==f)problems.push(`${n} is bridged by ${f} and also ${isMod.has(o)?'bridged':'declared at its top level'} by ${o}`);else giver.set(n,f)}}
  for(const f of page)if(info[f]&&!isMod.has(f))for(const n of info[f].top){const o=giver.get(n);if(o&&o!==f&&isMod.has(o))problems.push(`${n} is bridged by ${o} and also declared at its top level by ${f}`)}
  for(const f of mods)if(info[f])for(const n of info[f].top)if(!giver.has(n)&&!kept.has(n))kept.set(n,f);
  /* a global use of a name only a module has, kept to itself */
  const unbridged=[],plat=platform();
  for(const f of page)if(info[f])for(const n of info[f].free){const o=kept.get(n);if(o&&o!==f&&!plat.has(n))unbridged.push(`${f} uses ${n}, which ${o} declares and doesn't bridge`)}
  /* a classic worker can't importScripts a module; a module worker (analysis-worker.js) imports its files by plain relative paths, and
     what its files read as globals there must be some file's of its own list: a classic one's top-level name or a module's bridge */
  const wfiles={};
  for(const w of WORKERS){if(!fs.existsSync(path.join(ROOT,w)))continue;
    const k=modscope.workerFiles(ROOT,w);
    if(!k.module){for(const x of k.files)if(x!==w&&isMod.has(x))problems.push(`${w} importScripts ${x}, which the page loads as a module`);continue}
    const src=srcs[w]=fs.readFileSync(path.join(ROOT,w),'utf8');let ast;
    try{ast=modscope.parse(src,true)}catch(e){problems.push(`${w} doesn't parse as a module: ${e.message}`);continue}
    for(const i of modscope.imports(ast,w)){
      if(i.odd)problems.push(`${w}: its import from ${i.from} is ${i.odd}`);
      else if(!page.includes(i.from))problems.push(`${w} imports ${i.from}, which is not a page script (the worker's files are the page's, cached under their tags' names)`);
      else if(i.names.length)problems.push(`${w} imports names from ${i.from}: a worker's files hand theirs over on globalThis (the bridge), as on the page`);
      else (spelled[i.from]=spelled[i.from]||new Set()).add(i.from)}
    if(modscope.bridged(ast,src).names.size)problems.push(`${w} bridges names: a worker's own names are its own`);
    const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:'module'}).globalScope,own=new Set(g.variables.map(v=>v.name));
    info[w]={top:[],free:[...new Set(g.through.map(r=>r.identifier.name))].filter(n=>!own.has(n))};
    wfiles[w]=k.files}
  for(const [w,files] of Object.entries(wfiles)){const give=new Set(),keep=new Map();
    for(const f of files){if(!info[f])continue;if(isMod.has(f)){for(const n of bridge[f])give.add(n);for(const n of info[f].top)if(!keep.has(n))keep.set(n,f)}else for(const n of info[f].top)give.add(n)}
    for(const f of files)if(info[f])for(const n of info[f].free){const o=keep.get(n);if(o&&o!==f&&!give.has(n)&&!plat.has(n))unbridged.push(`${f} uses ${n} in ${w}, which ${o} declares and doesn't bridge`)}}
  /* a write to a bridged name from outside its file: seen by the module only through a setter */
  const unseen=[];
  if(Object.keys(how).length){const by={};
    const note=(f,w)=>{if(w)for(const [n,c] of w){const h=how[n];if(h&&h.file!==f&&!h.set&&(h.own||!h.assign))(by[n]=by[n]||[]).push(f+(c>1?' ('+c+')':''))}};
    for(const f of page)if(srcs[f]!=null)note(f,writesOf(srcs[f],isMod.has(f)));
    for(const w of Object.keys(wfiles))note(w,writesOf(srcs[w],true));
    for(const f of nodeFiles(ROOT))note(f,writesOf(fs.readFileSync(path.join(ROOT,f),'utf8'),false));
    for(const [n,l] of Object.entries(by)){const h=how[n];
      unseen.push(h.assign?`${n} is assigned by ${l.join(', ')}, but ${h.file} hands it over with Object.assign: the global is replaced and ${h.file} goes on using its own (make it a \`let\` with a getter and a setter, or give ${h.file} a function for it)`
        :`${n} is assigned by ${l.join(', ')}, but ${h.file} bridges it with a getter only: add \`set: v => {${n} = v}\``)}}
  /* every module is in sw.js ASSETS as its tag and its importers spell it */
  const assets=[];
  if(mods.length&&fs.existsSync(path.join(ROOT,'sw.js'))){const a=/const ASSETS=\[([^\]]*)\]/.exec(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8')),list=new Set(a?[...a[1].matchAll(/'([^']+)'/g)].map(m=>m[1]):[]);
    for(const f of mods)for(const s of new Set([f,...(spelled[f]||[])]))if(!list.has(s))assets.push(`${s} is a module and not in sw.js ASSETS under that spelling`)}
  return {page,mods,bridge,problems,unbridged,unseen,assets};
}
/* the ratchet: bridged names the list doesn't have (fresh), listed names no longer bridged (gone) */
function compare(now,base){
  const fresh=[],gone=[];
  for(const [f,l] of Object.entries(now))for(const n of l)if(!(base[f]||[]).includes(n))fresh.push(f+': '+n);
  for(const [f,l] of Object.entries(base))for(const n of l)if(!(now[f]||[]).includes(n))gone.push(f+': '+n);
  return {fresh,gone};
}
/* a row only shrinks once it is on main: names a row has that main's copy of the row lacks, less those allowed (grown) */
function grew(list,main,allowed={}){
  const out=[];
  for(const [f,l] of Object.entries(list))if(main[f])for(const n of l)if(!main[f].includes(n)&&!(allowed[f]||[]).includes(n))out.push(f+': '+n);
  return out;
}
/* BRIDGE as a text of this file has it (main's copy); null when it can't be read */
function rowsOf(text){
  const m=/\nconst BRIDGE=(\{[\s\S]*?\n\});/.exec(text||'');if(!m)return null;
  try{const o=Function('"use strict";return ('+m[1]+')')();return o&&typeof o==='object'?o:null}catch(e){return null}
}
function mainRows(ROOT){
  try{return rowsOf(require('child_process').execFileSync('git',['show','origin/main:tests/bridge.test.js'],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:15000}))}catch(e){return null}
}

module.exports=async({ok,ROOT})=>{
  /* the ratchet's rule, on made-up rows */
  const base={'a.js':['f','g'],'b.js':['h']};
  let r=compare({'a.js':['f','g'],'b.js':['h']},base);
  ok(!r.fresh.length&&!r.gone.length,'the same bridged names pass');
  r=compare({'a.js':['f','g','x'],'b.js':['h'],'n.js':['y']},base);
  ok(r.fresh.join()==='a.js: x,n.js: y'&&!r.gone.length,'a bridged name that isn\'t listed is named, in a listed file or a new one');
  r=compare({'a.js':['f']},base);
  ok(!r.fresh.length&&r.gone.join()==='a.js: g,b.js: h','a listed name that is no longer bridged is named, a whole file\'s too');
  ok(grew({'a.js':['f','g','x'],'b.js':[],'n.js':['y','z']},base).join()==='a.js: x'&&!grew({'a.js':['f','x'],'n.js':['y']},base,{'a.js':['x']}).length,
    'a row main already has may shrink but not gain a name, unless the name is in GROWN; a file main has no row for (the pull request converting it) brings its whole row');
  ok(JSON.stringify(rowsOf('x\nconst BRIDGE={\n  // why\n  \'a.js\':[\'f\'],\n};\n'))==='{"a.js":["f"]}'&&rowsOf('nothing')===null,'main\'s rows are read from its copy of this file');

  /* the app */
  const m=measure(ROOT),c=compare(m.bridge,BRIDGE),n=Object.values(m.bridge).reduce((a,l)=>a+l.length,0);
  ok(m.page.length>40,`the page scripts read (${m.page.length} scripts, ${m.mods.length} of them ES modules, ${n} bridged names)`);
  ok(m.mods.join()===Object.keys(BRIDGE).filter(f=>m.mods.includes(f)).join()&&Object.keys(BRIDGE).every(f=>m.mods.includes(f)),`BRIDGE has a row for every module, in index.html's order, and for nothing else (${m.mods.join(', ')||'no module'})`);
  ok(Object.values(BRIDGE).every(l=>l.join()===[...l].sort().join()),'each row is in a-z order (two branches taking a name off the same row merge cleanly)');
  ok(!c.fresh.length,'every bridged name is listed in BRIDGE'+(c.fresh.length?' (add it in tests/bridge.test.js with who still reads it: '+c.fresh.join('; ')+')':''));
  ok(!c.gone.length,'the bridge only shrinks: every listed name is still bridged'+(c.gone.length?' (take them off BRIDGE in tests/bridge.test.js: '+c.gone.join('; ')+')':''));
  const main=mainRows(ROOT),g=main?grew(BRIDGE,main,GROWN):[];
  ok(!g.length,(main?'no row that main already has gained a name':'(origin/main\'s rows could not be read here: not compared)')+(g.length?': '+g.join('; ')+' (only the pull request that converts a file writes its row; a name that must be added later goes in GROWN with the reason)':''));
  const stale=Object.entries(GROWN).flatMap(([f,l])=>l.filter(x=>!(BRIDGE[f]||[]).includes(x)).map(x=>f+': '+x));
  ok(!stale.length,'every name in GROWN is still in BRIDGE'+(stale.length?' (take them off GROWN: '+stale.join('; ')+')':''));
  ok(!m.unbridged.length,'no file uses, as a global, a name a module keeps to itself'+(m.unbridged.length?': '+m.unbridged.join('; ')+' (import it, or bridge it and list it)':''));
  ok(!m.problems.length,'every module has module syntax, a bridge the checkers can read (a function or constant assigned, a `let` behind `get: () => name`), plain relative imports of other page modules, and no Web Worker importScripts it'+(m.problems.length?': '+m.problems.join('; '):''));
  ok(!m.unseen.length,'no page script, test or tool assigns a bridged name that has no setter'+(m.unseen.length?': '+m.unseen.join('; '):''));
  ok(!m.assets.length,'every module is in sw.js ASSETS under the spelling of its tag and of each import of it'+(m.assets.length?': '+m.assets.join('; '):''));

  /* the tests' access point (T2, 2026-11-25; tests/hook.js): HOOK, on made-up files, then on the app */
  {const P=s=>modscope.hooked(modscope.parse(s,true),s);
    let h=P('let a=1;function f(){}const C=2;\nObject.assign(globalThis,{f});\nglobalThis.HOOK={__proto__:globalThis.HOOK||null,f,C,get a(){return a},set a(v){a=v}};\nexport {f};');
    ok(h.count===1&&!h.odd.length&&JSON.stringify([...h.names].map(([n,x])=>[n,x.value,x.get,x.set]))==='[["f",true,false,false],["C",true,false,false],["a",false,true,true]]'
      &&!modscope.bridged(modscope.parse('globalThis.HOOK={__proto__:globalThis.HOOK||null,f};',true)).names.size,
      'a HOOK statement is read name by name (a value, a getter, a setter), and it isn\'t a bridge: HOOK is not a page name');
    h=P('globalThis.HOOK={f};globalThis.HOOK={__proto__:globalThis.HOOK||null,get a(){return b},[k]:1,set a(v){a=v+1}};');
    ok(h.count===2&&h.odd.length===4,'a HOOK statement without its __proto__ first, a getter giving back another name, a computed key or a setter that doesn\'t plainly assign is named');
    const u=testUses("await p.evaluate(()=>{HOOK.a=1;b();window.c=2});p.evaluate('d(HOOK.e)');log('f is gone');ok(1,`h ${1} too`);vm.runInContext(appSrc(R,'x.js')+';this.K={g}',ctx);",new Set('abcdefgh'));
    ok([...u.global].sort().join()==='b,c,d,f'&&[...u.hook].sort().join()==='a,e'&&[...u.hookWrites].join()==='a'&&[...u.globalWrites].join()==='c',
      'a test\'s uses: bare names and window.name in its code and in the code of its strings (a word of a sentence counts, the safe side, but not an ok() message) are global, HOOK.name is the access point, a string joined after appSrc is the files\' own scope')
    /* strings that are not code (T2 phase 3): each is no use, and the rewrite leaves it as it is */
    const W=new Set(['shop','rd','setOpenTap','tieScore','a']);
    const NOT={'a file name':"src('shop.js');p.route('**/shop.js',r=>r.abort());",'an id':"p.click('#'+'rd-camo');tapAt('shop-backdrop');S('lock-shop');",
      'a data-act selector':"p.click('header .hbtns button[data-act=\"setOpenTap\"]');p.tap(`[data-act=setOpenTap]`);",'a host name':"p.goto('http://x/'+'shop.test');fetch(`shop.test:9210`);",
      'a tab-separated record':"fs.writeFileSync(f,'a.test.js\\tplanner.js\\t'+L+'\\toutfit\\ttieScore');",
      'a command-line flag':"if(argv.includes('--shop'))go(arg('--rd-x'));flag('--a=1');"};
    for(const [what,s] of Object.entries(NOT)){const u=testUses(s,W),x=toHook(s,W);
      ok(!u.global.size&&x.out===s&&!x.n&&!x.manual.length,`${what} in a string is not a use of a page name, and --to-hook leaves it alone`+(u.global.size||x.out!==s||x.manual.length?` (counted: ${[...u.global]}; rewritten: ${x.out!==s}; left: ${x.manual.join('; ')})`:''))}
    const y=testUses("p.evaluate('shop.x+1');p.evaluate('rd()');p.evaluate('setOpenTap(a)');log('the shop is open');",W),z=toHook("p.evaluate('rd()');p.evaluate(`shop.x-1`)",W);
    ok([...y.global].sort().join()==='a,rd,setOpenTap,shop'&&z.out==="p.evaluate('HOOK.rd()');p.evaluate(`HOOK.shop.x-1`)",'and code in a string, or a sentence, still counts and is still rewritten (the same names: shop.x+1, rd(), setOpenTap(a), "the shop is open")')
    /* S1f: a string searched for, and a call's label handed to a helper, are not code; a one-call string run or kept to be run is */
    const W3=new Set([...W,'fill']),NS3=new Set(['fill']);
    const srch="ok(m.def.includes(`fill=\"${c}\"`)&&d.startsWith('fill=1')&&d.indexOf('rd()')<0,'drawn');",lbl="await step('one tap',()=>tap('#b'),'rd()');want('shop()','x');";
    const s1=testUses(srch,W3),s2=toHook(srch,W3,new Set(),NS3),l1=testUses(lbl,W3),l2=toHook(lbl,W3,new Set(),NS3);
    ok(!s1.global.size&&!s1.globalWrites.size&&s2.out===srch&&!s2.manual.length,'a string searched for in another (includes, startsWith, indexOf: SVG markup like fill="…") is no use or write of a page name, and --to-hook leaves it'+(s1.global.size||s2.out!==srch||s2.manual.length?` (counted: ${[...s1.global]}; rewritten: ${s2.out!==srch}; left: ${s2.manual.join('; ')})`:''));
    ok(!l1.global.size&&l2.out===lbl,'a call\'s label handed to a helper (step(…, \'rd()\'), a wrapper\'s record) is no use of a page name, and --to-hook leaves it'+(l2.out===lbl?'':` (got ${l2.out})`));
    const run="p.evaluate('rd()');await p.waitForFunction('shop()');const L=[['score','rd()']];go(p.evaluate('shop()'));",r3=toHook(run,W3);
    ok(r3.out==="p.evaluate('HOOK.rd()');await p.waitForFunction('HOOK.shop()');const L=[['score','HOOK.rd()']];go(p.evaluate('HOOK.shop()'));",'and a one-call string run in the page, or kept in a list to be run, is still code and still rewritten'+(r3.manual.length?` (left: ${r3.manual})`:''))}
  /* S1a (2026-11-25): --to-hook rewrites a name the tests assign (one with a HOOK setter) where it is assigned, and only there */
  {const Wn=new Set(['x','cache']),NS=new Set(['f']),T=s=>toHook(s,new Set(),Wn,NS);
    const CASES=[
      ['a plain assignment','cache={};x=1;','HOOK.cache={};HOOK.x=1;'],
      ['a compound assignment, ++ and --','x+=2;x++;--x;cache??={};','HOOK.x+=2;HOOK.x++;--HOOK.x;HOOK.cache??={};'],
      ['a destructuring target','[a,x]=l;({x}=o);({x=1}=o);','[a,HOOK.x]=l;({x:HOOK.x}=o);({x:HOOK.x=1}=o);'],
      ['window.name assigned','window.x=1;globalThis.cache={};self.x++;','HOOK.x=1;HOOK.cache={};HOOK.x++;'],
      ['an assignment in the code of a string',"p.evaluate('cache={};f(x)');p.evaluate(`x=${1}`)","p.evaluate('HOOK.cache={};f(x)');p.evaluate(`HOOK.x=${1}`)"],
      ['a read stays a read','f(x);g(cache.y);const z=window.x;','f(x);g(cache.y);const z=window.x;'],
      ['x.y= and x[k]= change the object, not the name','cache.y=1;cache[k]=2;x.a.b=3;window.cache.y=4;delete cache[k];',
        'cache.y=1;cache[k]=2;x.a.b=3;window.cache.y=4;delete cache[k];'],
      ['a local of the same name','let x;x=1;function g(cache){cache={}}for(const x of l)x;','let x;x=1;function g(cache){cache={}}for(const x of l)x;'],
      ['an ok() message and a sentence',"ok(1,'cache={} is set');log('x= is the width')","ok(1,'cache={} is set');log('x= is the width')"],
    ];
    for(const [what,src,want] of CASES){const r=T(src);ok(r.out===want&&!r.manual.length,`--to-hook, a name the tests assign: ${what}`+(r.out===want?'':` (got ${r.out})`)+(r.manual.length?` (left: ${r.manual})`:''))}
    const a=T("f=()=>1;window.f=g;p.evaluate('f=h')"),b=T("p.evaluate('cache={}\\n')"),c=T('typeof x;x=1');
    ok(a.out==="f=()=>1;window.f=g;p.evaluate('f=h')"&&a.manual.length===3&&b.out==="p.evaluate('cache={}\\n')"&&b.manual.length===1&&/assigns cache/.test(b.manual[0])&&c.out==='typeof x;HOOK.x=1'&&!c.manual.length,
      '--to-hook leaves for a person an assigned name with no HOOK setter (a function) and a string with an escape that assigns one; a typeof of a name only assigned is no use to rewrite');
    const m2=measure(ROOT),r2=readers(ROOT,m2),w2=writeSets(r2,hookCheck(ROOT,m2,r2));
    ok(['items','dayRecs','TODAY_OVERRIDE','cache','sel','view','weather','monthOpen','editing'].every(n=>w2.writes.has(n))&&[...w2.noSet].every(n=>!w2.writes.has(n)),
      `every let the tests assign has a HOOK setter, so --to-hook can rewrite it (${w2.writes.size} names; without one: ${[...w2.noSet].sort().join(', ')||'none'})`);
    ok([...OLD_BUILD].every(n=>!w2.writes.has(n)&&!w2.names.has(n)&&!w2.noSet.has(n)),`--to-hook leaves the names a test also uses on an older build, which has no HOOK (${[...OLD_BUILD].join(', ')})`)}
  const rs=readers(ROOT,m),hk=hookCheck(ROOT,m,rs);
  ok(!hk.problems.length,'every HOOK statement is in a module, once, after its bridge, with names of the file\'s own (a `let` behind a getter, a setter for what a test assigns), none twice; no test uses a name that isn\'t on HOOK through it; the app never reads HOOK'+(hk.problems.length?': '+hk.problems.join('; '):''));
  ok(!hk.missing.length,`every name only the tests use is on its file's HOOK (${hk.testOnly.length} names)`+(hk.missing.length?': add '+hk.missing.join('; '):''));
  /* S1f (2026-11-25), the goal of restructure step 1: no test or tool assigns a bridged name (bare, window.name, in its code or the code
     of its strings): it sets the app's state through HOOK.name, a setter the owner puts on HOOK. The
     one exception: a name a test also writes on an older build, which has no HOOK (OLD_BUILD_WRITES) */
  const tw=Object.entries(rs).flatMap(([n,x])=>x.testWrites.filter(f=>!(OLD_BUILD_WRITES[n]||[]).includes(f)).map(f=>`${f} assigns ${n}`));
  ok(!tw.length,'no test or tool assigns a bridged name (it writes HOOK.name: node tests/bridge.test.js --to-hook <file> rewrites it)'+(tw.length?': '+tw.join('; '):''));
  ok(true,`${hk.ready.length} of the ${hk.testOnly.length} names only the tests use are used through HOOK alone and can come off BRIDGE (T2 phase 3; \`node tests/bridge.test.js --hook\` lists them and the tests still using the rest as globals)`);
};
module.exports.measure=measure;module.exports.compare=compare;module.exports.grew=grew;module.exports.writesOf=writesOf;
module.exports.readers=readers;module.exports.testUses=testUses;module.exports.toHook=toHook;module.exports.hookCheck=hookCheck;module.exports.writeSets=writeSets;

/* `node tests/bridge.test.js --plan file.js`: what a page script would have to bridge if it became a module today. For each of its
   top-level names: the page scripts that use it (a read, a call, a `typeof` guard), the tests and tools that do, and who assigns it.
   Prints the bridge lines to paste at the file's end, its BRIDGE row, and what needs a decision first. */
function plan(ROOT,file){
  const tags=modscope.pageScripts(ROOT),tag=tags.find(t=>t.src===file);if(!tag)throw new Error(file+' is not a page script of index.html');
  const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const decl=modscope.declared(modscope.parse(rd(file),tag.module)),kind=new Map(decl.map(d=>[d.name,d.kind])),use={};
  const at=n=>use[n]=use[n]||{page:[],node:[],wpage:[],wnode:[]};
  const free=(src,module)=>{let ast;const o={ecmaVersion:'latest',ranges:true,allowReturnOutsideFunction:!module,allowHashBang:true};
    try{ast=acorn.parse(src,{...o,sourceType:module?'module':'script'})}catch(e){try{ast=acorn.parse(src,{...o,sourceType:'module',allowReturnOutsideFunction:false});module=true}catch(e2){return []}}
    const g=escope.analyze(ast,{ecmaVersion:2024,sourceType:module?'module':'script'}).globalScope,own=new Set(g.variables.filter(v=>v.defs.length).map(v=>v.name));
    return [...new Set(g.through.map(r=>r.identifier.name))].filter(n=>!own.has(n))};
  for(const t of tags){if(t.src===file)continue;const src=rd(t.src);
    for(const n of free(src,t.module))if(kind.has(n))at(n).page.push(t.src);
    for(const [n] of writesOf(src,t.module)||[])if(kind.has(n))at(n).wpage.push(t.src)}
  for(const w of WORKERS)if(fs.existsSync(path.join(ROOT,w))&&new RegExp("importScripts\\([^)]*'"+file.replace(/[.\\/]/g,'\\$&')+"'").test(rd(w)))at('').page.push(w);
  // a module worker that imports the file reads its names as globals too (analysis-worker.js: through the file's bridge)
  for(const w of WORKERS){if(!fs.existsSync(path.join(ROOT,w)))continue;const k=modscope.workerFiles(ROOT,w);if(!k.module||!k.files.includes(file))continue;
    const src=rd(w);for(const n of free(src,true))if(kind.has(n))at(n).page.push(w);
    for(const [n] of writesOf(src,true)||[])if(kind.has(n))at(n).wpage.push(w)}
  for(const f of nodeFiles(ROOT)){const src=rd(f);
    for(const n of free(src,false))if(kind.has(n))at(n).node.push(f);
    for(const [n] of writesOf(src,false)||[])if(kind.has(n))at(n).wnode.push(f)}
  const names=decl.filter(d=>d.kind!=='import').map(d=>d.name),used=names.filter(n=>use[n]&&(use[n].page.length||use[n].node.length||use[n].wpage.length||use[n].wnode.length));
  const written=n=>use[n].wpage.length+use[n].wnode.length>0,mut=n=>/^(?:let|var)$/.test(kind.get(n));
  return {file,importScripts:(use['']||{page:[]}).page,names,kind,use,used,kept:names.filter(n=>!used.includes(n)),
    assign:used.filter(n=>!mut(n)),getters:used.filter(n=>mut(n)&&!written(n)),setters:used.filter(n=>mut(n)&&written(n)),stubbed:used.filter(n=>!mut(n)&&written(n))};
}
module.exports.plan=plan;
if(require.main===module){
  const ROOT=path.join(__dirname,'..'),i=process.argv.indexOf('--plan'),file=i>0&&process.argv[i+1];
  /* `node tests/bridge.test.js --hook [--json]`: the names only the tests use, those ready to come off BRIDGE (used through HOOK alone),
     and per test file the names it still uses as globals */
  const th=process.argv.indexOf('--to-hook');
  if(th>0){const f=process.argv[th+1],m=measure(ROOT),r=readers(ROOT,m),hk=hookCheck(ROOT,m,r),p=path.resolve(f);
    const w=writeSets(r,hk),x=toHook(fs.readFileSync(p,'utf8'),w.names,w.writes,w.noSet);
    if(process.argv.includes('--write'))fs.writeFileSync(p,x.out);
    console.log(`${f}: ${x.n} use${x.n===1?'':'s'} ${process.argv.includes('--write')?'rewritten':'to rewrite (--write writes them)'} to HOOK.name`+(x.manual.length?'\nLeft for you:\n  '+x.manual.join('\n  '):''));
    process.exit(0)}
  if(process.argv.includes('--hook')){const m=measure(ROOT),r=readers(ROOT,m),hk=hookCheck(ROOT,m,r),files={};
    for(const n of hk.testOnly)for(const f of r[n].tests)(files[f]=files[f]||[]).push(n);
    if(process.argv.includes('--json')){console.log(JSON.stringify({ready:hk.ready,testOnly:hk.testOnly,missing:hk.missing,problems:hk.problems,files},null,1));process.exit(0)}
    console.log(`${hk.testOnly.length} bridged names are used by the tests only; ${hk.ready.length} of them through HOOK alone (ready to come off BRIDGE)`+(hk.ready.length?':\n  '+hk.ready.join(', '):''));
    if(hk.missing.length)console.log('\nNot on HOOK yet: '+hk.missing.join('; '));
    if(hk.problems.length)console.log('\nProblems:\n  '+hk.problems.join('\n  '));
    const l=Object.entries(files).sort((a,b)=>a[0]<b[0]?-1:1);
    console.log(`\n${l.length} test and tool files still use some of them as globals:`);for(const [f,n] of l)console.log(`  ${f}: ${n.join(', ')}`);
    process.exit(0)}
  if(!file){console.log('node tests/bridge.test.js --plan <file.js>   what the file would bridge as a module (the test itself runs with: node tests/run.js bridge.test)');process.exit(1)}
  const p=plan(ROOT,file),short=l=>l.length>6?l.slice(0,6).join(', ')+' and '+(l.length-6)+' more':l.join(', ');
  console.log(`${file}: ${p.names.length} top-level names, ${p.used.length} used outside it, ${p.kept.length} it can keep to itself`);
  if(p.importScripts.length)console.log(`\nSTOP: ${p.importScripts.join(', ')} importScripts ${file}: it can't have \`export\` until that worker and its files move together`);
  for(const n of p.used){const u=p.use[n];console.log(`  ${n} (${p.kind.get(n)}): `+[u.page.length&&'used by '+short(u.page),u.node.length&&u.node.length+' test/tool file'+(u.node.length>1?'s':'')+' ('+short(u.node)+')',u.wpage.length&&'ASSIGNED by '+short(u.wpage),u.wnode.length&&'ASSIGNED by '+short(u.wnode)].filter(Boolean).join('; '))}
  if(p.stubbed.length)console.log(`\nDecide first: ${p.stubbed.join(', ')} ${p.stubbed.length>1?'are':'is'} assigned from outside but not a \`let\`: after Object.assign the write would replace the global only (see MODULES-RECIPE.md, "A stubbed function")`);
  console.log('\nThe file\'s last lines:');
  if(p.assign.length)console.log(`Object.assign(globalThis,{${p.assign.join(',')}});`);
  if(p.getters.length||p.setters.length)console.log(`Object.defineProperties(globalThis,{${[...p.getters.map(n=>`${n}:{get:()=>${n}}`),...p.setters.map(n=>`${n}:{get:()=>${n},set:v=>{${n}=v}}`)].join(',')}});`);
  console.log(p.used.length?`export {${p.used.join(',')}};`:'export {};');
  console.log(`\nIts row in BRIDGE:\n  '${file}':[${[...p.used].sort().map(n=>"'"+n+"'").join(',')}],`);
}
