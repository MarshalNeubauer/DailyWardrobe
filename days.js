/* Daily Wardrobe: the day records (the restructure S3b, 2026-11-26: moved out of history.js, their text unchanged): a day's key as a
   date (keyDate), the pieces of an outfit as a record holds them (idsOf), saving a day's record (saveDay) and keeping a coming day's
   record free of pieces (notAhead). Data only: nothing is drawn here. Loaded right after act.js (app.js, back.js and act.js keep their places), before the files that read them
   (pickscore, add-more, itemsheet, history, locks, today-plan, today, fav and the others); planner.js, earlier, reads keyDate. */
import {SLOTS,dayFields,dayRecs,nextStamp,todayDate} from './core.js';
import {atomic,txs} from './app.js';
const idsOf=o=>Object.fromEntries(SLOTS.map(s=>[s,o[s]?o[s].id:null]));
const keyDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
async function saveDay(rec,quiet,auto){rec.updated=nextStamp(rec.updated);if(!auto){delete rec.lockOnly;delete rec.base}const was=dayRecs[rec.date];dayRecs[rec.date]=rec;   /* (core.js dayFields: the fields changed since the copy before get this save's stamp; the one in memory, or, changed in place, the stored one) */
  if(was!==rec){dayFields(rec,was);await txs('days','readwrite',s=>s.put(rec))}else await atomic('days',rec.date,cur=>{dayFields(rec,cur);return {put:rec}});planDirty();if(!quiet&&window.scheduleSync)scheduleSync();if(typeof remindSoon==='function')remindSoon()}
/* a coming day's record holds no pieces (ids): they are written when the day is shown (recordDays, today) or once it is past. A pick or
   swap ahead used to write the outfit from before it, which then stood as worn in place of the pick when the app wasn't opened that day
   (fix round 3, W2-17-01); today's record is rewritten from the screen right after (recordDays) */
function notAhead(rec,k){if(keyDate(k)>todayDate()){delete rec.ids;delete rec.suitDay;delete rec.vestOn;delete rec.auto}}
/* the bridge (tests/bridge.test.js): keyDate is read by 18 page scripts and saveDay by 9 (history, missed, locks, today, today-gestures,
   itemsheet, pack, care and the tests); idsOf by pickscore, history, locks, scorecard, today-plan and today-gestures; notAhead by
   pickscore and history. Nothing here runs at load */
Object.assign(globalThis,{idsOf,keyDate,saveDay,notAhead});
globalThis.HOOK={__proto__:globalThis.HOOK||null,idsOf,saveDay};
export {idsOf,keyDate,saveDay,notAhead};
