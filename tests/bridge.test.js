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
const fs=require('fs'),path=require('path');
const acorn=require('acorn'),escope=require('eslint-scope');
const modscope=require('./modscope');

/* file -> the names it bridges onto globalThis. Rows are added by the pull request that converts the file; after that they only shrink */
const BRIDGE={
  // the pages and sheets that Back closes are classic scripts: add-sheet, colpick, history, item-view, kit, settings, setup, shop,
  // start, ui and account call these. appHist, appKind and itemHist are read by the tests only (back, backgesture, shellfix): getters
  'back.js':['appHist','appKind','backBorrow','backDrop','backHold','backKind','backLand','backOn','backOver','backPush','backReturn','backSettled','backWanted','histDrop','histPush','itemHist'],
  // the other Add files, tagging, pattern-read, measure, item-photo, migrate, safety, settings, kit and others draw and read cards with these; addCalm is a let only add.js writes (add-save reads it): a getter; the rest: tests
  'add.js':['PAIR_TYPES','STOPPED','TEX_MAX','TEX_MIN_PX','addBackOnline','addCalm','addFiles','addNoteText','addTexture','applyWb','cardPics','countWord','dropTexture','errToHand','measureGuess','multiAgain','multiMsg','needType','patternAgain','refineAgain','renderAdd','skipCard','stopRead','wbNote'],
  // tests/paste.test.js clears the line under the "Photo or link" field with it
  'add-paste.js':['pasteMsg'],
  // add, itemsheet, look, tagging and colpick are classic scripts; add-sheet, add-more and checklist read these as globals too (no
  // page module imports another yet); setq, cardSafe, ckCheck and addCkSecs are also called by tests
  'add-card.js':['addCkSecs','busyCard','cardSafe','ckCheck','ckLeftLine','ckLr','confBtn','errCard','formCard','matGuessOf','matNewOf','matchShadeE','matchShadeQ','multiErrCard','photoPair','setq','shadeRow','shirtColFix','typeCard'],
  // itemsheet (orderHint, arriveVal, ARRIVE_PAST, checkArrivals), stats, wardrobe, care and shop (fmtDay), today, start and care
  // (checkArrivals); add-card and add-save read the rows; setOrder and setArrives are called by tests only
  'add-more.js':['ARRIVE_PAST','arriveVal','checkArrivals','fmtDay','orderHint','orderRow','qtyLabel','qtyOf','qtyRow','setArrives','setOrder'],
  // add (renderAddFor, npsDraw, npsId), ui (npsId, npsAsking, npsInert, npsCancel), start (npsLeave; it assigns addFor: a setter);
  // addManual and npsClose by tests only; npsId and npsAsking are lets only add-sheet.js writes: getters
  'add-sheet.js':['addFor','addManual','npsAsking','npsCancel','npsClose','npsDraw','npsId','npsInert','npsLeave','renderAddFor'],
  // the sheets that close on a swipe down are classic scripts: add-sheet, item-view, colpick and kit call it
  'sheet-swipe.js':['sheetSwipe'],
  // add, look, kit, wardrobe, colpick, safety, tagging, pattern-read and the other Add files find a card and save it with these;
  // saveAllOn is a let only add-save.js writes (add and add-card read it): a getter
  'add-save.js':['cardAt','cardIx','cardOf','cardReading','cardReady','qAt','qh','save','saveAll','saveAllOn','savedTitle'],
  // every file that changes a card keeps it (addKeep, addKeepSoon); add and add-sheet (addWatch, addCardRec), kit (addRevive),
  // safety (addRestore); addKeepT is read by tests/addcards.test.js, which also assigns addRestoreState (add.js reads it): a setter
  'add-keep.js':['addCardRec','addKeep','addKeepSoon','addKeepT','addRestore','addRestoreState','addRevive','addWatch'],
  // add, add-card, add-keep, add-save, itemsheet, item-view, history, stats, wardrobe, colpick, look, migrate, measure, pattern-read and app draw and edit with these; the rest: tests
  'item-photo.js':['PH_MAX','applyCrop','cropEditor','cropKeep','cropSource','imgOf','layoutCrop','makeSmall','paperCloth','paperHint','paperLine','paperRetake','paperSteps','paperTip','phSigOf','phSm','photoTools','replaceTexture','setPhoto','setTexture','smallPhotos','startCrop','undoPhoto'],
  // editing is read by twelve classic page scripts and set by 31 tests (a setter); wardrobe, cost and kit open a piece (openItem), start
  // and wardrobe drop the sheet (dropItem), sync says a sync changed the open piece (itemSynced), itemsheet, start and checklist redraw
  // it (renderItem); itemGoneTell: itemsheet, wardrobe, look, cost; noMotion: nine files; closeItem, stepItem and wardList: tests only
  'item-view.js':['closeItem','dropItem','editing','itemGoneTell','itemSynced','noMotion','openItem','renderItem','stepItem','wardList'],
  // renderWardrobe is called by 16 page scripts and 15 tests; item-view draws the sheet with itemBody and reads phEdit, as item-photo
  // and photos do (a getter: only itemsheet.js assigns it); add-card (optLab, matTidy), add-save (matTidy), colpick and look (sete,
  // patSummary, redetect, clearStripes), wardrobe (setFlt, wardPic), colpick (wardPic); rm and togglePause: tests only
  'itemsheet.js':['clearStripes','itemBody','matTidy','optLab','patSummary','phEdit','redetect','renderWardrobe','rm','setFlt','sete','togglePause','wardPic'],
  // keyDate is read by 17 classic page scripts, saveDay by 8; today.js draws and records with recordDays, openPicker, closePicker,
  // setWorn, setVest, resetCard and dayActions and sets swapMsg, todayPullWait and pastEdit (setters; tests set swapMsg and pastEdit
  // too); picker is a getter (today, today-gestures and sync read it); whenPulled: start, safety, wardrobe, calendar; dropLearn and
  // checkPlanRules: start; renderReplanUI: settings; setOccasion: daysoff, calendar; wearFav: fav; pickItem: scorecard; notAhead and
  // idsOf: pickscore; swapSlot, togglePastEdit, correctPast, setFormal, resetDay, replanFuture and planRulesNote: tests only
  'history.js':['checkPlanRules','closePicker','correctPast','dayActions','dropLearn','idsOf','keyDate','notAhead','openPicker','pastEdit','pickItem','picker','planRulesNote','recordDays','renderReplanUI','replanFuture','resetCard','resetDay','saveDay','setFormal','setOccasion','setVest','setWorn','swapMsg','swapSlot','todayPullWait','togglePastEdit','wearFav','whenPulled'],
  // history.js (firstReal, missedNote) and today.js (missedCard) are classic scripts; the rest are called by the todayacts and weeklock tests
  'missed.js':['firstReal','missedCard','missedNote','missedOne','missedOpen','missedPickToggle','missedPut'],
  // history, settings, dress, care, setup and kit (clearLocks), pack (lockIds), today (lockUpcoming), add-more and care (careUnlock), history (unlockClash)
  'locks.js':['careUnlock','clearLocks','lockIds','lockUpcoming','unlockClash'],
  // history.js, a classic script, swaps, picks and draws the picker with these; slotPool, fitOf, fitTag and pickSub are also called by
  // the care, onorder, planner-rules and rotation-pause tests
  'pickscore.js':['BELT_STUCK','FOLLOW','beltless','bootsOff','fitOf','fitTag','handPool','handWhy','keepHand','keepOff','pickSub','pocketOn','slotPool','suggestClean','suitPants'],
  // today.js draws and folds the card (scoreCard, toggleScore) and sets scoreOpen, as the advicefresh, folds, scoreanim and scoredials
  // tests do (a setter); history.js and fav.js say dayWord; month.js reads recentWork; dialHtml, dialsFor, rankFor and rankPools are
  // called by tests only (advicefresh, scoredials, takeoff), which also read rankMemo and rankW (getters: only scorecard.js writes them)
  'scorecard.js':['dayWord','dialHtml','dialsFor','rankFor','rankMemo','rankPools','rankW','recentWork','scoreCard','scoreOpen','toggleScore'],
  // today.js is a classic script (boxFold, boxUnfold); scorecard.js (boxFold, boxUnfold), today-photofold.js and month.js (foldEdge)
  // are modules that still read these as globals: boxfold.js comes after scorecard.js in the list, and an import would run it first
  'boxfold.js':['boxFold','boxUnfold','foldEdge'],
  // planDirty is called by 25 classic page scripts, planFor by 14, planMonth by 9; cache is read by nine and set by 95 tests (a
  // setter); today and stats ask planStartDay, today planTrim, outSig and planSnapSoon, start PLAN_SNAP and planSnapUse, shop strHash;
  // planRuns, planSig and planSnapUsed (a getter): tests/speed.test.js
  'today-plan.js':['PLAN_SNAP','cache','outSig','planDirty','planFor','planMonth','planRuns','planSig','planSnapSoon','planSnapUse','planSnapUsed','planStartDay','planTrim','strHash'],
  // Today's names for the screens that step, fold and pick (history, scorecard, today-gestures, month, settings, start, kit, …) and the
  // tests; openRow, belowOpen, listOpen (history.js too), dayShown and BLOUSE_ROLL_ON have setters (tests assign them), recordRun and foldQuiet are getters; figureStage: tests/todayswatch.test.js, inside a string run in the page
  'today.js':['BLOUSE_ROLL_ON','belowOpen','canPick','dayShown','figCuDone','figureStage','foldAll','foldQuiet','goToday','hasOutfit','homeDay','keepHome','keepInView','listOpen','openRow','pickPiece','piecesBox','planWith','recordRun','renderToday','restWarn','setOff','setRoll','slotLabel','stepDay','swatchStack','todayTabTap','toggleList','toggleRow','wardShort','wxPreload'],
  // today.js opens and shuts a piece's photo with these
  'today-photofold.js':['picOpenReady','picShut','picSnap','picStop'],
  // today.js lays out the swatches with ovlPiece and calls applyZoom, zoomOut, swApply, swTap and swClose; zoom is a getter
  // (today-gestures reads it); tests/care.test.js sets swOpen (a setter); the swatch makers and their caches, zoomTarget and
  // toggleZoom: the todayswatch, hbswatch, twillswatch, asmrelease, materials, todayzoom and swatchzoom tests (ovlItem only inside a
  // string tests/todayswatch.test.js runs in the page, which --plan can't see)
  'today-picture.js':['OVL_CU','OVL_HB','applyZoom','ovlCuKey','ovlGrain','ovlHbKey','ovlHbShirt','ovlItem','ovlPiece','ovlSuitPng','ovlSvg','ovlWeave','swApply','swClose','swOpen','swTap','toggleZoom','zoom','zoomOut','zoomTarget'],
  // sync.js asks todayBusy before a redraw; month.js signs a day's outfit with mvSig (it comes after in the list, read as a global);
  // tests/moveoutfit.test.js calls moveRecs and reads outfitMove (a getter: only today-gestures.js writes it)
  'today-gestures.js':['moveRecs','mvSig','outfitMove','todayBusy'],
  // today.js (the month box, the pieces line, the home day; it sets monthOpen, as nine tests do: a setter), daysoff, history, pack,
  // remind, start, stats and the painter (assemble.js, asm-color.js: planOn) are classic scripts; boxfold, fav,
  // scorecard, today-gestures and today-photofold are modules earlier in the list that read these as globals; monthGridHtml and
  // monthStep are called by tests only (month, setup); tests/setup.test.js sets monthPanel (a setter)
  'month.js':['MONTH_EASE','MONTH_MS','dayOnly','monthBelow','monthDrag','monthGridHtml','monthLink','monthOpen','monthPanel','monthPlan','monthRelease','monthStep','nextWorkday','openDay','pageScroll','piecesLine','piecesParts','planOn','revealNeed','shortRest','shortTop','stackSVG','toggleMonth'],
  // esc is called by 35 page scripts, srcOk by nine; the painter (assemble, asm-color, asm-kinds, asm-ocp: classic) reads the kept
  // pictures and their keys; today, start, settings, daysoff and stats (classic), history, today-picture and itemsheet (modules that
  // read them as globals) draw with the rest; 15 names are read by
  // tests only. renders (tests), remoteKeys (today.js, tests), remoteListed, listKeys and listAt (tests) are assigned from outside:
  // a getter and a setter each; itemBatch is a let only photos.js writes: a getter
  'photos.js':['ITEM_PIC_TYPES','PIC_BG','aAn','asmLive','comboKey','comboSig','esc','fetchItemPic','fetchRemoteRender','figureLabel','fixItemBackdrops','fnv64','itemBatch','itemDesc','itemKey','itemPic','itemPicHtml','itemPicLimitText','itemPicsUsedUp','jsq','keepRender','lastWorn','listAt','listKeys','loadRenders','missingItemPics','picBgs','picsDrawn','prefetchRenders','remoteKeys','remoteList','remoteListed','renderFor','renderItemPic','renderItemPicUI','renderTried','renders','schedulePrefetch','shareLocalPics','shirtPatterned','srcOk','startItemPics','workerBase','workerList'],
  // cost.js formats money in the app's language
  'locale.js':['APP_LOC'],
  // nearly every page script opens, closes or saves through these; settingsPart is called at load by look, account, calendar and remind.
  // viewStale (sync.js) and setSeen (start.js) have setters, todayStale and setOther are getters
  'settings.js':['SET_CATS','backupSummary','closeSettings','openSettings','picsSwitched','refreshToday','renderPicturesUI','renderSettingsExtras','saveSettings','saveUserSettings','setCatOpen','setDarkShirts','setOpenTap','setOther','setPictures','setSeen','setVestMode','setWanted','settingsOpen','settingsPart','settingsSummaries','showCost','todayDirty','todayStale','toggleCat','toggleDay','viewStale','weekFirst'],
  // settings (countryName, renderDaysOffUI, renderFormalUI), setup (COUNTRY_CODES, setHolidayCountry), start (refreshHolidays), calendar
  // (isoToDate, dayOffAdd, yearDate), history and missed (shortDate, renderFormalUI); the rest: tests; holidayMsg is a getter
  'daysoff.js':['COUNTRY_CODES','addDayOff','builtinHolidays','countryName','dayOffAdd','holYears','holidayMsg','isoToDate','nagerKeep','refreshHolidays','renderDaysOffUI','renderFormalUI','setHolidayCountry','shortDate','toggleHoliday','yearDate'],
  // settings.js and setup.js (unit, renderWxLoc, setUnits, setLocation, useMyLocation, findCity), today.js (wxChip, loadWeather), start.js
  // and safety.js (loadWeather) read these as globals (setup.js is a module later in the list); scorecard.js, a module earlier in the list, reads temp; geoName is read
  // by tests/setup.test.js only
  'weather.js':['findCity','geoName','loadWeather','renderWxLoc','setLocation','setUnits','temp','unit','useMyLocation','wxChip'],
  // toast: 34 page scripts; toastDrop: start; TOAST_ACT_MS: tests/a11y.test.js
  'toast.js':['TOAST_ACT_MS','toast','toastDrop'],
  // read by the tests only: a11y (applyTheme, cycleTheme), actsindex (cycleTheme), modload (themeTap)
  'theme.js':['applyTheme','cycleTheme','themeTap'],
  // the question, the close-up chooser, the layers' focus, the connection's state and plain errors, for nearly every page script;
  // connMsg has a setter (tests/restacts.test.js), asking, cuOpen and connBusy are getters
  'ui.js':['NEED_CONN','addGate','advClose','askAnswer','askConfirm','asking','closeupBtn','closeupClose','closeupPick','connBusy','connMsg','connSummary','cuGot','cuOpen','cuTouch','inviteOver','isConnected','layerClose','layerFrom','layerInert','layerOpen','needConn','netErr','plainErr','renderConnUI','tell'],
  // start.js calls safetyStart and storageDown; add-save and kit storeFailure, saveFailed and askPersist; sync storeFailure,
  // storeFailText and adoptBackupSettings and sets storeToldAt (a setter, tests too); add, add-card and app the tagging failure's
  // (tagFailText, tagFailed, tagFailNote, tagNetText, retryTag; tagWhy and tagNetLast have setters for the errreport and tagreads
  // tests); add-keep guardUnsaved; tagging oneStop; about errReport; seven page scripts errNote; dbDown is a getter (sync reads it);
  // errTapAt (a setter), errList and pruneTagImgs: tests only
  'safety.js':['adoptBackupSettings','askPersist','dbDown','errList','errNote','errReport','errTapAt','guardUnsaved','oneStop','pruneTagImgs','retryTag','safetyStart','saveFailed','storageDown','storeFailText','storeFailure','storeToldAt','tagFailNote','tagFailText','tagFailed','tagNetLast','tagNetText','tagWhy'],
  // settings.js, stats.js, start.js, add-card.js, add-save.js, shop.js and kit.js are classic scripts; vestMigrating is read by the
  // dress test only: a getter
  'dress.js':['dressNewItem','dressSummary','dressSynced','dressWhyUnused','migrateVests','newSuitVest','renderDressUI','vestMigrating'],
  // the photo-tagging request: app, add, item-photo, migrate, measure, pattern-read, colpick, look, safety and stats are classic
  // scripts; add-keep.js, add-save.js, tagging.js (TAG_Q) and checklist.js (texSig) are modules that read these as globals
  'tag-request.js':['CLOSE_MAX','TAGIMG_CACHE','TAG_MAX','TAG_Q','benchEstimate','customForTag','describeEstimate','keepCloseImg','keepTagImg','readEstimate','recordTagResult','resignTagImg','sharpCloseOf','tagExtras','tagFixes','tagImgOf','tagStatsCard','texSig'],
  // start.js runs the four remakes, item-photo.js counts its own within the day's (remakeLeft, remakeSpend); REMAKE_DAY is read by
  // tests/tagreads.test.js only
  'migrate.js':['REMAKE_DAY','fixBlackBackdrops','recolourSpecSetts','remakeLeft','remakeSpend','upgradeCloseups','upgradePhotos'],
  // add, add-card, tagging, pattern-read, safety, colpick, checklist, look and item-photo; the rest: tests
  'measure.js':['AI_HIGH_FLAG','AI_LOW_AUTO','BLUR_SHARP','FAR_DE','MEAS_AUTO','MEAS_GAP','PAPER','aiSignals','applyMeasured','calibLab','closeRead','colRef','colourVerdicts','measHint','measKL','measureAndApply','measureCard','measureCloth','measureParts','multiCol','nearestCols','paperCopy','paperKey','paperNow','paperOf','sharpness','undoMeasured','urlCanvas','wbGains','wbRead'],
  // add, add-card, measure, pattern-read, colpick and safety are classic scripts; add-save.js and tag-request.js (fieldLabel, valName),
  // modules earlier in the list, read these as globals; confTxt is read by tests/records.test.js only
  'tagging.js':['aiFields','closeTagImg','confTxt','fieldLabel','readAbort','readBegin','readEnd','refineFromCloseup','tagNotes','takeExtras','valName'],
  // colpick, look, settings and add-card are classic scripts; tagging.js, a module earlier in the list, reads openColForm and openPatForm
  // as globals (tests/restacts.test.js replaces those two on window, which reaches tagging.js's calls); guessPatBase is called by
  // tests/asmroute.test.js only
  'own-lists.js':['addCustomColor','addCustomPattern','addOwnMaterial','groupOf','guessPatBase','matGuessUse','matOffer','newColHex','openColForm','openPatForm','ownColOffer','removeCustom','removeOwnMaterial','renderCustomUI','renderOwnMatUI','typePl'],
  // add, add-card, add-save, tagging, itemsheet, look, measure, migrate and asm-color; the rest: tests
  'pattern-read.js':['TEX_WORDS','camoFromPixels','claudeOnly','claudePattern','missedPattern','motifFromSpec','motifPat','readPatternWithClaude','readSett','readable','rereadSett','settCheck','settFrom','settFromSpec','settNote','settSummary','settable','specSett','texContrast','texFromSpec'],
  // start (renderStats, statsShow), wardrobe, care and cost (wornDays), dress (shoesWhyUnused), fav, cost, care and pack (the names and pictures); the rest: tests; statsOpen and fitMemo are getters (only stats.js writes them)
  'stats.js':['buildStats','emptyAdd','fitMemo','groupName','openStats','plannedDays','renderStats','shoesWhyUnused','statDate','statName','statName1','statPic','statsOpen','statsShow','statsToggle','whyUnused','wornDays'],
  // calendar.js opens the page and sets the trip (openPack, packSetTrip), start.js shows it (packShow); the rest are called or read by
  // the pack, packcare-taps, planreview, stats, calendar, restacts and pocketsquare tests, which set packT and packNow (setters)
  'pack.js':['PACK_TITLE','openPack','packComplete','packDefault','packLock','packLockState','packMark','packNow','packRelease','packSetCap','packSetDate','packSetTrip','packShow','packT','packTrip','packUses','packWear','renderPack'],
  // itemsheet draws the Wardrobe and the item sheet with these, item-view lists with wardView, add-card draws its fields, add-save and
  // kit save them (wardSaveFields), colpick and own-lists set a field, dress.js runs the one-time renames (matMigrate, matRenameTo,
  // sockToeMigrate, sockLegacy), safety asks wardPendingRestore, fav reads wardFlt; the search and sort names, itemFieldSoon,
  // wardDeleteNow and WARD_UNDO_MS: tests only; tests/materials.test.js sets wardQ (a setter)
  'wardrobe.js':['WARD_MAX','WARD_UNDO_MS','WATCH_DETAILS_MAX','fldRow','itemFieldSoon','ivOn','matLabel','matMigrate','matOn','matOnItem','matRenameTo','matRow','notesRow','setItemField','setQField','setWardSort','sockLegacy','sockToeMigrate','wardBack','wardBar','wardClear','wardCount','wardDelete','wardDeleteNow','wardDuplicate','wardFieldsTop','wardFlt','wardFresh','wardGrid','wardHay','wardKeep','wardMatch','wardNorm','wardOrder','wardPendingRestore','wardQ','wardSaveFields','wardSearch','wardSort','wardView'],
  // add, add-card, add-save, itemsheet, look, checklist and own-lists; colPick (a test assigns it) and rd (tests assign it) have setters, rdLast a getter; the rest: tests
  'colpick.js':['EP','NEW_COL','RD_LOOKUPS','SOCK_THIRD','SW_GRAB','accDel','closeColPick','cnDrawn','cnFromHsv','cnHex','cnLeft','cnName','colAsk','colAskImgs','colChoices','colFamily','colFieldLabel','colHas','colNameTaken','colNear','colNewAdd','colPick','colPickSel','colPickView','colRows','colShows','colTarget','colTidy','cpAskHint','openColNew','openColPick','openCustomNew','openPatNew','patBtn','patChoices','patVar','rd','rdAccOf','rdAddBtn','rdClose','rdColOf','rdCost','rdCostLine','rdDoneHtml','rdEditorBtn','rdLast','rdOff','rdOpen','rdRender','rdRetake','rdRun','rdStart','rdUndoAll','renderColPick','useColPick'],
  // add-card, itemsheet, colpick, look, add, add-sheet and item-view draw their sections and the close-up comparison with these;
  // CK_OPEN is also how 53 test files open the sections
  'checklist.js':['CK_OPEN','accRow','ckChip','ckColSum','ckIsOpen','ckSec','ckSure','ckToggle','cmpDiff','cmpDiffText','cmpDrawn','cmpHtml','cmpLab','cmpMatchHtml','cmpMount','cmpPaper','cmpPaperLine','cmpSteps'],
  // core, item-photo and colpick are classic scripts; add-card, item-view, itemsheet, tagging, own-lists, add-save and checklist
  // are modules that read these as globals; LOOK_OTHER, lookSet, lookOwnMats, lookSetMat, lookShadeStep and lookCheck by tests only
  'look.js':['LOOK_COATS','LOOK_ENAMEL','LOOK_KS','LOOK_METALT','LOOK_METAL_COLS','LOOK_OTHER','LOOK_PAT_GROUPS','LOOK_PK','lookCheck','lookClipMetal','lookCu','lookCur','lookHasPat','lookOn','lookOpenFresh','lookOwnMatUI','lookOwnMats','lookPatGroupOf','lookSave','lookSection','lookSet','lookSetEnamel','lookSetMat','lookShadeHtml','lookShadeOk','lookShadeStep','lookSugCols','lookSugPats','lookUsePick','lookWrite','renderLookPick'],
  // itemsheet, cost, wardrobe, add-more, settings, today, today-picture and remind; the rest: tests
  'care.js':['CARE_ABLE','CARE_DEF','careBack','careBackText','careBadge','careBandSoon','careCard','careCleaned','careCounts','careDayState','careFrame','careLimit','careLists','careLog','careName','careNote','careReminders','careSend','careState','careTag','careTimes','careWashed','careWord','openCare','renderCare','renderCareUI'],
  // itemsheet (cpwSum, cpwBlock), add-card (cpwQRow), add-save (cpwSaveFields), stats (cpwStatsCard), care (cpwSettingsUI); the
  // other nine are read by tests/costwear.test.js only
  'cost.js':['cpwBlock','cpwCleanYear','cpwCur','cpwHint','cpwMoney','cpwOf','cpwParse','cpwQRow','cpwQSet','cpwSaveFields','cpwSetPrice','cpwSettingsUI','cpwStatsCard','cpwSum','cpwText'],
  // history, today, itemsheet, wardrobe, scorecard and stats; favData, favSave and favToggleItem by the favorites tests only;
  // favWard is a let only fav.js writes (wardrobe.js reads it): a getter
  'fav.js':['FAV_UNDO_MS','favChip','favData','favItemRow','favLastIcon','favMark','favOff','favPieces','favPillSeg','favSave','favStatsCard','favStrip','favToggleItem','favWard','favWhy'],
  // stats (shopButton), start (closeShop), today-gestures (shopOpen); the rest: tests, which assign shop, shopBusy, shopWorker and shopShown (getters and setters)
  'shop.js':['analyzeWardrobe','closeShop','openShop','renderShop','shop','shopBought','shopBusy','shopBusyText','shopButton','shopDrag','shopForm','shopFresh','shopGo','shopOpen','shopPart','shopShown','shopSig','shopStale','shopSwipeOn','shopWorker'],
  // sync.js and the screens that say how the backup stands: app, photos, settings, snapshots, backupfile, account, about, ui, setup;
  // the clock, rollback, backup-storage, server-limits and addcards tests
  'sync-status.js':['ENDED','backedUpWords','backupFullMsg','endedAnswer','inviteEnded','pauseTillTomorrow','setSyncStatus','showSyncStatus','syncNetText','syncPaused','syncWaiting'],
  // the backup for every screen that saves (scheduleSync, syncNow) and the tests; restoring (snapshots.js), syncing and syncDue (tests)
  // have setters, syncTimer, syncRun and syncLater are getters
  'sync.js':['SYNC_SEND_MAX','TESTER_SYNC_MS','WIPED_SYNC','afterPull','applyMerged','localState','pulledYet','restoring','scheduleSync','syncDue','syncJoinAt','syncJoinMark','syncLater','syncLaterRun','syncMark','syncNeedsPull','syncNow','syncRedraw','syncRun','syncTap','syncTimer','syncUrl','syncing'],
  // sync.js calls phIn, phOut and phBatch; PH_MIN, isPh, phMap and phStrings are read by tests only (backup-storage, lib-verify18)
  'sync-photos.js':['PH_MIN','isPh','phBatch','phIn','phMap','phOut','phStrings'],
  // settings.js lists the daily backups when Backup opens (loadSnapshots); the tests call the four (actsindex, backup-storage, clock,
  // rollback, sample)
  'snapshots.js':['loadSnapshots','rollBack','rollBackState','snapLabel'],
  // kit.js offers the backup file (downloadBackup); the tests restore one (restoreBackup: actsindex, fieldmerge, records, wardrobe)
  'backupfile.js':['downloadBackup','restoreBackup'],
  // start.js starts and yields the setup (setupStart, setupYield), account and kit read and redraw it (setup, SETUP_STEPS, setupShown,
  // setupDraw, setupFinish, setupSample), today, stats and wardrobe draw the empty states (setupNeeds, setupToday, setupWardEmpty),
  // weather asks tzCountry; the rest: tests only. SETUP_STEPS is a getter (only setup.js writes it), setup has a setter
  // (tests/rollback.test.js)
  'setup.js':['SETUP_STEPS','setup','setupCancel','setupClose','setupDraw','setupDress','setupFinish','setupGo','setupNeeds','setupOpen','setupSample','setupSearch','setupShown','setupStart','setupToday','setupVestChosen','setupWardEmpty','setupYield','tzCountry'],
  // settings.js (calSummary) and today.js (calBanner) are classic scripts; the rest are read by the calendar test, calBusy by the
  // restacts test only: a getter
  'calendar.js':['CAL_GUIDES','CAL_X','calBanner','calBusy','calGuide','calNew','calPlan','calSummary','renderCalUI'],
  // history.js, settings.js, start.js and care.js are classic scripts (remindSoon); the rest are read by the remind, connkeep and
  // restacts tests, remindBusy too (a getter: only remind.js writes it)
  'remind.js':['outfitLine','remindBusy','remindCareOn','remindKeep','remindPrefs','remindRefresh','remindSave','remindSig','remindSoon','renderRemindUI'],
  // safety (appVersion), account (ABOUT_NOTE, wipeDevice), settings (renderAbout); the rest: tests; aboutUpdating has a setter (tests/invite.test.js)
  'about.js':['ABOUT_KEYS','ABOUT_NOTE','aboutAsk','aboutDeleteAccount','aboutNew','aboutResetAt','aboutUpdating','appVersion','askDelete','checkForUpdate','fbWithErrs','renderAbout','sendFeedback','updateNow','wipeDevice'],
};
/* file -> names its row gained after its conversion (each with the reason beside it); every one is in BRIDGE too */
const GROWN={
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
  for(const r of g.through)if(r.isWrite()&&!own.has(r.identifier.name))add(r.identifier.name);
  for(const m of src.matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*(?:=(?!=)|\+\+|--|[-+*\/%&|^]=|\*\*=|<<=|>>>?=|&&=|\|\|=|\?\?=)/g))add(m[1]);
  return out;
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
  for(const w of WORKERS){if(!fs.existsSync(path.join(ROOT,w)))continue;
    const m=/importScripts\(([^)]*)\)/.exec(fs.readFileSync(path.join(ROOT,w),'utf8'));
    for(const x of m?[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]):[])if(isMod.has(x))problems.push(`${w} importScripts ${x}, which the page loads as a module`)}
  /* a write to a bridged name from outside its file: seen by the module only through a setter */
  const unseen=[];
  if(Object.keys(how).length){const by={};
    const note=(f,w)=>{if(w)for(const [n,c] of w){const h=how[n];if(h&&h.file!==f&&!h.set&&(h.own||!h.assign))(by[n]=by[n]||[]).push(f+(c>1?' ('+c+')':''))}};
    for(const f of page)if(srcs[f]!=null)note(f,writesOf(srcs[f],isMod.has(f)));
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
};
module.exports.measure=measure;module.exports.compare=compare;module.exports.grew=grew;module.exports.writesOf=writesOf;

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
