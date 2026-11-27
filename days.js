/* Daily Wardrobe: the day records (the restructure S3b, 2026-11-26: moved out of history.js, their text unchanged): a day's key as a
   date (keyDate), the pieces of an outfit as a record holds them (idsOf), saving a day's record (saveDay) and keeping a coming day's
   record free of pieces (notAhead). Data only: nothing is drawn here. Loaded right after act.js (app.js, back.js and act.js keep their places), before the files that read them
   (pickscore, add-more, itemsheet, history, locks, today-plan, today, fav and the others); planner.js, earlier, reads keyDate. */
import {serve} from './bus.js';
import {SLOTS,dayFields,dayRecs,keyDate,nextStamp,todayDate} from './core.js';
import {atomic,txs} from './app.js';
const idsOf=o=>Object.fromEntries(SLOTS.map(s=>[s,o[s]?o[s].id:null]));
async function saveDay(rec,quiet,auto){rec.updated=nextStamp(rec.updated);if(!auto){delete rec.lockOnly;delete rec.base}const was=dayRecs[rec.date];dayRecs[rec.date]=rec;   /* (core.js dayFields: the fields changed since the copy before get this save's stamp; the one in memory, or, changed in place, the stored one) */
  if(was!==rec){dayFields(rec,was);await txs('days','readwrite',s=>s.put(rec))}else await atomic('days',rec.date,cur=>{dayFields(rec,cur);return {put:rec}});planDirty();if(!quiet&&window.scheduleSync)scheduleSync();if(typeof remindSoon==='function')remindSoon()}
/* a coming day's record holds no pieces (ids): they are written when the day is shown (recordDays, today) or once it is past. A pick or
   swap ahead used to write the outfit from before it, which then stood as worn in place of the pick when the app wasn't opened that day
   (fix round 3, W2-17-01); today's record is rewritten from the screen right after (recordDays) */
function notAhead(rec,k){if(keyDate(k)>todayDate()){delete rec.ids;delete rec.suitDay;delete rec.vestOn;delete rec.auto}}
/* (moved from locks.js with its text unchanged, the restructure S6a) */
const lockIds=o=>{const l=idsOf(o);delete l.coat;return l};
/* the one way the week's locks let go (the code review, CR-3-05/CR-3-14: five copies, and unlockClash's lacked the trip guard, so a pick
   today unlocked a kept trip): only rec.lock goes, saved as the lock's own change (lockOnly: core.js dayWins); a kept trip (pack.js
   rec.trip: its suitcase may be packed, audit 2026-11-14) and a day marked worn keep theirs. which(r): the days to release; mine: stop when
   the history was replaced meanwhile (sync, restore) */
async function releaseLocks(which,mine){let n=0;
  for(const r of Object.values(dayRecs)){if(mine&&dayRecs!==mine)break;
    if(!r.lock||r.trip||r.worn===true||!which(r))continue;const c={...r,lockOnly:1,base:r.lockOnly?r.base||0:r.updated||0};delete c.lock;await saveDay(c,true,true);n++}
  return n}
/* let the planner choose the days after today again (a setting that changes the plan, Re-plan, new planning rules) */
async function clearLocks(){const T=todayDate(),n=await releaseLocks(r=>keyDate(r.date)>T);
  if(n&&window.scheduleSync)scheduleSync();return n}
/* (lockIds, releaseLocks and clearLocks came from locks.js, the restructure S6a: the day records' own helpers, which dress, care, kit,
   setup and history import; keyDate went to core.js, which settings.js and planner.js may import.)
   the bridge (tests/bridge.test.js): clearLocks (settings.js) and saveDay are read by page scripts (history, missed, locks, today, today-gestures,
   itemsheet, pack, care and the tests); idsOf by pickscore, history, locks, scorecard, today-plan and today-gestures; notAhead by
   pickscore and history. Nothing here runs at load */
Object.assign(globalThis,{idsOf,saveDay,notAhead,lockIds,clearLocks});
globalThis.HOOK={__proto__:globalThis.HOOK||null,idsOf,saveDay,clearLocks,lockIds};
export {idsOf,saveDay,notAhead,lockIds,clearLocks,releaseLocks};
serve('locks-clear',clearLocks);   // the restructure S6b: what required and today-no-picture files ask of this file (bus.js need)
