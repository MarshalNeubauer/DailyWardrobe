/* Daily Wardrobe: the current week's locks: locking today through Friday as shown, letting them go (releaseLocks, clearLocks,
   careUnlock) and after a change by hand that clashes with them (unlockClash)
   (An ES module since 2026-11-23; split out of history.js, Round C 2026-11-17, and loaded after it.) */
/* ---- the current week stays as shown ----
   Each workday from today through the coming Friday (lockSpan) gets rec.lock, the pieces the plan showed for it (not the coat: that
   follows the forecast). The planner keeps a locked day's pieces (planner.js, outfit()), so swapping today's tie, marking a day not
   worn or adding an item re-plans only the days after the lock, not tomorrow's outfit. A change made by hand on a day (a swap, a pick,
   an occasion, Reset, a move) drops that day's lock: the day is planned again around the change and locked as it then shows. */
const lockIds=o=>{const l=idsOf(o);delete l.coat;return l};
/* the lock runs through Friday, not seven days (the owner, 2026-11-15: "only lock today through Friday ... a current week lock"): on a
   Saturday that is next week's Friday (the next Sunday to Friday), on a Friday today alone. Only workdays among them are locked, so a
   Sunday-Thursday week and a Monday-Friday week both get the rest of their work week; the days after are planned afresh each time */
const LOCK_LAST=5;   // Friday (getDay)
const lockSpan=T=>(LOCK_LAST-T.getDay()+7)%7+1;   // the days from today through the coming Friday, today counted
async function lockUpcoming(){
  if(!items.length)return;const T=todayDate(),mine=dayRecs,span=lockSpan(T);let n=0;
  if(+T>+trueToday())return;   // the phone's date is ahead of the right one (core.js): no week of days that haven't come is locked and backed up

  for(let g=0;g<span;g++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+g);if(!isWorkday(d))continue;
    if(dayRecs!==mine)break;   // the history was replaced meanwhile (sync, restore)
    // the plan is read afresh for each day (it is cached; a change made while an earlier lock was being saved has reset it), and the lock
    // is put on the record before the write is awaited, so a lock never comes from a plan that is no longer the one on screen
    const k=key(d),o=planMonth(d.getFullYear(),d.getMonth())[k];if(!o||o.frozen||!SLOTS.some(s=>o[s]))continue;
    const r=dayRecs[k],l=lockIds(o);if(r&&r.lock&&JSON.stringify(r.lock)===JSON.stringify(l)&&!lockStale(r,t=>items.filter(i=>i.type===t&&!isHandPick(i)&&inRotation(i,di(d)))))continue;   // (the planner's pool, planSim's byOn: a hand-pick piece added, cargo pants, re-wrote the week's locks for nothing, CR-3-14)
    // (lockAt: when it was made, so a lock made while the wardrobe had too few of a type lets go once more come in: planner.js lockStale)
    const rec={...(r||{date:k}),lock:l,lockAt:nowMs(),updated:nextStamp(r&&r.updated),lockOnly:1,base:(r&&(r.lockOnly?r.base:r.updated))||0};dayRecs[k]=rec;n++;   // the cached plan stays valid: the lock is what it shows
    dayFields(rec,r);await txs('days','readwrite',s=>s.put(rec))}   // (only the lock's fields get its stamp: core.js dayFields)
  n+=await lockPast(di(T)+span-1,mine);
  if(n&&window.scheduleSync)scheduleSync()}
/* the week's locks on days after the window (end: its last day number) let go: those made when the lock ran seven days, or by a phone
   still on that version. Only rec.lock goes: the owner's own picks (force, skip, the vest, kind, off), a kept trip's lock (pack.js
   rec.trip) and a day marked worn stay. Done after the window is locked, so its days keep what was shown; day numbers, not dates */
async function lockPast(end,mine){return releaseLocks(r=>di(keyDate(r.date))>end,mine)}
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
/* a piece away being cleaned (care.js): the week's locks after today let go when it leaves while a lock holds it, so the days are planned
   again around each other (two suits left, and the one still locked for Tuesday was held back on Sunday and Monday: the other suit on
   both), and again when it is back, for the locks made while it was away (`since`: when it left, ms), so it rejoins the week (fix
   round 3, W1-8-05: "It's back" left the same suit locked on two workdays running) */
async function careUnlock(id,since){const T=todayDate();
  const hit=Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>T&&r.worn!==true&&(id?Object.values(r.lock).includes(id):(+r.lockAt||0)>=since));
  return hit?clearLocks():0}
/* after a change by hand on a day: when a lock on the next workdays holds the piece the day now has (its tie on any of the next three
   workdays, its shirt or jacket on the next one), the locks after that day are let go, so the days are planned again in turn around it
   (2026-11-15, the audit: two ties, today's swapped, and the next two locked days kept that same tie: three workdays running; letting
   go of the clashing days alone left the next lock's tie to tie with it). No clash, nothing changes */
/* (past: a corrected past day, correctPast) */
async function unlockClash(k,past){const o=planFor()[k];if(!o||(o.frozen&&!past))return 0;const x=keyDate(k),T=todayDate();let w=0,clash=false;
  for(let g=0;g<10&&w<3&&!clash;g++){x.setDate(x.getDate()+1);if(!isWorkday(x))continue;const r=dayRecs[key(x)],l=r&&r.lock;
    if(l&&r.worn!==true&&((o.tie&&l.tie===o.tie.id)||(!w&&o.shirt&&l.shirt===o.shirt.id)||(!w&&o.top&&l.top===o.top.id)))clash=true;
    w++}
  if(!clash)return 0;const from=keyDate(k),n=await releaseLocks(r=>keyDate(r.date)>from&&keyDate(r.date)>=T);   // (a kept trip stays locked: CR-3-05)
  if(n&&window.scheduleSync)scheduleSync();return n}
/* the bridge (tests/bridge.test.js): what the classic scripts, the other modules and the tests still use as globals: clearLocks
   (history, settings, dress, care, setup, kit), lockIds (pack), lockUpcoming (today), careUnlock (add-more, care), unlockClash
   (history). The file has no top-level call, so the bridge is its last lines */
Object.assign(globalThis,{lockIds,lockUpcoming,clearLocks,careUnlock,unlockClash});
export {lockIds,lockUpcoming,clearLocks,careUnlock,unlockClash};
