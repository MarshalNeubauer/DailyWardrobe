/* Daily Wardrobe: the outfit history: past days, the coming week's locks, choosing a piece by hand, correcting a past day,
   occasions and the score card
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
/* ---- outfit history: freeze past days, swap pieces, record what was worn ---- */
const idsOf=o=>Object.fromEntries(SLOTS.map(s=>[s,o[s]?o[s].id:null]));
const keyDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
let swapMsg='';
async function saveDay(rec,quiet,auto){rec.updated=nextStamp(rec.updated);if(!auto){delete rec.lockOnly;delete rec.base}const was=dayRecs[rec.date];dayRecs[rec.date]=rec;   /* (core.js dayFields: the fields changed since the copy before get this save's stamp; the one in memory, or, changed in place, the stored one) */
  if(was!==rec){dayFields(rec,was);await txs('days','readwrite',s=>s.put(rec))}else await atomic('days',rec.date,cur=>{dayFields(rec,cur);return {put:rec}});planDirty();if(!quiet&&window.scheduleSync)scheduleSync();if(typeof remindSoon==='function')remindSoon()}
/* start-up writers wait for the first pull (sync.js afterPull; sync.js loads after this file, so through afterScripts) */
let todayPullWait=false;
const whenPulled=f=>afterScripts(()=>typeof afterPull==='function'?afterPull(f):f());
/* remember what each day showed: past days become fixed, and today's record follows the screen until the day ends */
async function recordDays(p){
  const T=todayDate(),tk=key(T),mine=dayRecs,out=[],first=firstReal();
  // the days missed since the app was first used for real are worked out and put in memory first, synchronously, so a drawing of Today
  // that follows the call (renderToday) already counts them: "This look last worn" and the cleaning frame changed a moment after opening
  // (fix round 3, W2-14-12). The planner's first days before any real use, and today, are saved as before, after the drawing
  // past days are recorded only up to the corrected date (core.js trueToday): a phone whose clock was a year ahead recorded 64 workdays that
  // hadn't happened as worn and backed them up (the audit's W1-9-03)
  const P=Math.min(+T,+trueToday());
  for(const [k,o] of Object.entries(p)){
    if(!SLOTS.some(s=>o[s])||o.frozen)continue;const d=keyDate(k),r=dayRecs[k];
    // a past day with no pieces recorded: none at all, or only the week's lock (lockUpcoming), as on a day the app was not opened;
    // recorded with what the record already has, else it never became history (no wear counts, an outfit that could still change)
    // (noOutfit: a past day dressed only from the sample wardrobe, since removed, kept with no outfit: kit.js kitSampleDay)
    // (idsAhead, planner.js: pieces an earlier version wrote ahead of the day with a pick, the outfit from before it: recorded again)
    if(+d<P&&!(r&&((r.ids&&!idsAhead(r))||r.noOutfit))){const n={...(r||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest,auto:true},now=+d>first;if(now)dayRecs[k]=n;out.push({n,past:true,prev:r,now})}
    else if(k===tk&&+T===P){const ids=idsOf(o);if(!r||JSON.stringify(r.ids)!==JSON.stringify(ids)||!!r.vestOn!==!!o.vest){const n={...(r||{date:k}),ids,suitDay:o.suitDay,vestOn:!!o.vest};out.push({n,past:false,prev:r,now:false})}}   // (today's own record counts in no drawing: saved in turn)
  }
  if(!out.length)return;if(cache)delete cache.careW;   // the cleaning counts follow the days just recorded (care.js careCounts)
  await null;   // the saves start after the caller's drawing (saveDay puts a record in memory before it waits)
  for(const {n,past,prev,now} of out){
    if(dayRecs!==mine)break;   // the history was replaced meanwhile (sync, restore): this plan is stale, record nothing more
    if(dayRecs[n.date]!==(now?n:prev))continue;   // changed again meanwhile (a pick, a mark): that record stands
    await saveDay(n,true);if(past)missedNote(n.date)}
  if(window.scheduleSync)scheduleSync();
}
/* past workdays the app was not opened on are recorded as planned and count as worn: say so once, with a way to mark them not worn
   (2026-11-15, the audit: back after a week away, every missed workday was silently counted as worn, toward the cleaning counts too) */
let missedDays=[],missedT=0;
// the day the app was first used for real (a record it didn't make by itself): the first plan of past days before it is no gap
const firstReal=()=>{const real=Object.values(dayRecs).filter(r=>r.ids&&!r.auto).map(r=>+keyDate(r.date));return real.length?Math.min(...real):Infinity};
const missedSpan=ks=>{const n=ks.length,f=d=>shortDate(keyDate(d));return n===1?f(ks[0]):`${f(ks[0])} – ${f(ks[n-1])}`};
function missedNote(k){missedDays.push(k);clearTimeout(missedT);missedT=setTimeout(missedTell,400)}
function missedTell(){const first=firstReal();
  // only days after the app was first used for real (not the first plan of past days)
  const ks=[...new Set(missedDays)].filter(k=>+keyDate(k)>first).sort((a,b)=>keyDate(a)-keyDate(b));missedDays=[];if(!ks.length||typeof toast!=='function')return;
  const n=ks.length;
  // the days were recorded after Today was drawn: put their card in (missedCard) without drawing Today again, which would cut off
  // an unfolding box or a swipe. The toast says it only where the card isn't on screen (another day or page shown): both at once said
  // the same thing twice (fix round 3, W2-14-11)
  missedPut();const card=document.querySelector('#missbox');if(card&&!card.closest('[hidden]'))return;
  toast(`${n===1?'A past workday':n+' past workdays'} you didn’t open the app (${missedSpan(ks)}) ${n===1?'was':'were'} counted as worn, as planned.`,12000,{label:`I didn’t wear ${n===1?'it':'them'}`,fn:()=>missedNotWorn(ks)})}
function missedPut(){const h=missedCard(),old=document.querySelector('#missbox');
  if(old){if(h)old.outerHTML=h;else old.remove();return}
  const m=h&&document.querySelector('#today #mbox');if(m)m.insertAdjacentHTML('afterend',h)}
async function missedNotWorn(ks){for(const k of ks){const r=dayRecs[k];if(r&&r.ids&&r.worn!==false)await saveDay({...r,worn:false},true)}
  if(window.scheduleSync)scheduleSync();toast(`Marked as not worn: ${ks.length===1?'that day':'those days'} no longer count${ks.length===1?'s':''} toward rest and cleaning.`,4000);if(typeof refreshToday==='function')refreshToday()}
/* the missed days also stay on Today as a card (missedCard, under the month) until they are marked not worn or the card is closed
   (the re-audit, 2026-11-15: the 12-second toast was the only way to undo the batch, gone if the user looked away while the app
   started): the days the app recorded by itself (rec.auto) in the last MISSED_KEEP days, after it was first used for real, still
   counted as worn and not corrected by hand; "Keep as worn" hides them on this phone (localStorage missed_ok: the last day it covered) */
const MISSED_KEEP=30;
function missedOpen(){const T=todayDate(),first=firstReal();let ok=null;try{ok=localStorage.getItem('missed_ok')}catch{}
  const okD=ok&&/^\d{4}-\d{1,2}-\d{1,2}$/.test(ok)?+keyDate(ok):-Infinity;
  return Object.values(dayRecs).filter(r=>{if(!r||!r.auto||!r.ids||r.worn===false||r.edited)return false;const d=keyDate(r.date);return d<T&&+d>first&&+d>okD&&T-d<=MISSED_KEEP*864e5})
    .map(r=>r.date).sort((a,b)=>keyDate(a)-keyDate(b))}
/* the card is shown on at most MISSED_DAYS different days for the same missed days (localStorage missed_seen {k: the last missed day,
   d: the dates it was shown}); a newly missed day shows it again (fix round 3, W1-8-04: someone who skips a workday now and then had it on
   Today on 216 of 226 mornings, each skipped day keeping it for 30 days) */
const MISSED_DAYS=3;
function missedSeen(ks){const last=ks[ks.length-1],t=isoKey(todayDate());let s=null;try{s=JSON.parse(localStorage.getItem('missed_seen')||'null')}catch{}
  if(!s||s.k!==last||!Array.isArray(s.d))s={k:last,d:[]};if(s.d.includes(t))return true;if(s.d.length>=MISSED_DAYS)return false;
  s.d.push(t);try{localStorage.setItem('missed_seen',JSON.stringify(s))}catch{}return true}
let missedPick=false;   // the card's day-by-day choice is open (W2-17-18: the card was all or nothing)
function missedCard(){if(typeof homeDay!=='function'||isoKey(sel)!==isoKey(homeDay()))return '';const ks=missedOpen(),n=ks.length;if(!n||!missedSeen(ks))return '';
  const one=k=>`<button class="linkbtn missone" onclick="missedOne('${k}')" aria-label="I didn’t wear the outfit of ${esc(shortDate(keyDate(k)))}">${esc(shortDate(keyDate(k)))} ✕</button>`;
  return `<section class="mbox missbox" id="missbox" aria-label="Days counted as worn"><p class="misstxt">${n===1?'A workday':n+' workdays'} you didn’t open the app (${esc(missedSpan(ks))}) ${n===1?'counts':'count'} as worn, as planned.</p>`+
    `<div class="missbtns"><button class="linkbtn" onclick="missedCardNo()">I didn’t wear ${n===1?'it':'them'}</button>${n>1?`<button class="linkbtn" onclick="missedPickToggle()" aria-expanded="${missedPick}">Choose days</button>`:''}<button class="linkbtn" onclick="missedCardOk()">Keep as worn</button></div>`+
    (n>1&&missedPick?`<p class="misstxt mut"><small>Tap a day you didn’t wear its outfit:</small></p><div class="missbtns missdays">${ks.map(one).join('')}</div>`:'')+`</section>`}
function missedPickToggle(){missedPick=!missedPick;missedPut()}
async function missedOne(k){const r=dayRecs[k];if(!r||!r.ids||r.worn===false)return;await saveDay({...r,worn:false},true);if(window.scheduleSync)scheduleSync();
  toast(`Marked as not worn: ${shortDate(keyDate(k))}.`,3000);if(typeof refreshToday==='function')refreshToday()}
function missedCardNo(){const ks=missedOpen();if(ks.length)missedNotWorn(ks)}
function missedCardOk(){const ks=missedOpen();if(ks.length){try{localStorage.setItem('missed_ok',ks[ks.length-1])}catch{}}missedPut()}
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
async function swapSlot(slot){
  const k=key(sel),o=planFor()[k];if(!o||o.frozen)return;
  const cur=o[slot]&&o[slot].id,pool=items.filter(i=>(slot==='coat'?i.type==='overcoat'||i.type==='raincoat':i.type===SLOT_TYPE(slot,o.suitDay))&&!isHandPick(i)&&inRotation(i,di(sel)));   // (Suggest another never brings a hand-pick piece)
  const suitOff=slot==='bot'&&!!o.offSuit;   // a suit's jacket taken off: its own pants are one more choice
  if(pool.length+(suitOff?1:0)<2){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to swap.`;renderToday();return}
  const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest};
  const skip={...(rec.skip||{})};skip[slot]=[...new Set([...(skip[slot]||[]),cur].filter(Boolean))];
  if(pool.every(i=>skip[slot].includes(i.id)))skip[slot]=[cur];       // tried them all: start the cycle again
  // keep the rest of the outfit; pieces that must follow the swapped one are re-picked
  const follow=FOLLOW[slot]||[];
  const force={};for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  // the planner keeps a suit's own pants with its jacket off, so Suggest another pins the best-matching pants not shown yet (fitOf)
  if(suitOff){const nx=pool.filter(i=>!skip.bot.includes(i.id)).map(i=>[fitOf('bot',o,i),i]).sort((a,b)=>b[0]-a[0]||(a[1].id<b[1].id?-1:1))[0];if(nx)force.bot=nx[1].id}
  keepOff(force,k,slot);rec.skip=skip;rec.force=force;delete rec.lock;notAhead(rec,k);
  if(slot==='belt'&&o.belt&&beltless(k,rec)){swapMsg=BELT_STUCK;renderToday();return}
  suggestClean(k,o,slot,rec,pool);
  swapMsg='';await saveDay(rec);await unlockClash(k);renderToday();
}
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
/* a piece taken off (rec.off) stays pinned through a swap or a pick of another piece, so putting it back brings the same one */
const keepOff=(force,k,slot)=>{const r=dayRecs[k];if(!r||!r.off||!r.force)return;for(const s of ['top','tie','clip','pocket'])if(s!==slot&&r.off[s==='clip'?'tie':s]&&r.force[s])force[s]=r.force[s]};
// (the pocket square follows the jacket, the tie and the shirt it is chosen against: 2026-11-16)
const FOLLOW={top:['bot','shirt','tie','shoes','belt','socks','watch','clip','pocket'],shoes:['belt','socks'],belt:['shoes','socks'],tie:['pocket'],shirt:['pocket']};   // (a belt swap brings shoes that match it, as a shoe swap brings a belt: the owner's ask, 2026-11-14)
/* would this record leave the day with no belt? (planned with the record in memory only, nothing saved): a belt swap or pick whose
   only matching shoes don't suit the outfit (a black suit wants black shoes, and only the black belt matches them) changes nothing */
const beltless=(k,rec)=>{const prev=dayRecs[k];dayRecs[k]=rec;planDirty();let n=null;try{n=planFor()[k]}finally{if(prev)dayRecs[k]=prev;else delete dayRecs[k];planDirty()}return !(n&&n.belt)};
const BELT_STUCK='Your other belts need shoes that don’t suit this outfit, so the belt stays.';
/* the planner no longer learns from swaps and picks (removed 2026-11-15, the owner's ask): the votes earlier versions kept in the settings
   (settings.learn) are dropped at start-up, after the first pull, so they stop syncing as dead weight. The removal is stamped like any
   setting change (stampSettings marks it removed), so it wins on the other devices too; a phone still on an older version may add votes
   again, which nothing reads, and the next start here drops them */
async function dropLearn(){if(!settings||!('learn' in settings))return;delete settings.learn;await saveUserSettings()}
/* ---- choosing a piece by hand: a sheet with every item for the slot, best match for the rest of the outfit first ---- */
let picker=null,pastEdit=null;
// (with a suit's jacket taken off, the pants picker offers the suit's own pants first: o.offSuit, takeOff in planner.js)
const slotPool=(slot,o)=>(slot==='bot'&&o.offSuit&&!o.frozen?[o.offSuit]:[]).concat((slot==='coat'?items.filter(i=>i.type==='overcoat'||i.type==='raincoat'):slot==='top'&&o.frozen?items.filter(i=>i.type==='suit'||i.type==='blazer'):items.filter(i=>i.type===SLOT_TYPE(slot,o.suitDay))).filter(i=>!isHandPick(i)&&(o.frozen||inRotation(i,di(sel)))));
/* the pieces worn only when picked by hand (core.js isHandPick) for this slot: the picker's "Casual · pick by hand" group, never scored,
   swapped in by Suggest another or planned (2026-11-16, the owner's new casual garments) */
const handPool=(slot,o)=>items.filter(i=>handPickSlot(i)===slot&&(o.frozen||inRotation(i,di(sel)))).sort((a,b)=>(TYPES[a.type]||'').localeCompare(TYPES[b.type]||'')||(a.id<b.id?-1:1));
/* the picker ranks and labels each piece by the score the outfit would get with it (W2-17-03, fix round 3: "Best match" lowered the score
   93 → 81, leaving out the belt, variety and rest): a coming day is planned with the pick held in memory only (the record pickItem would
   save, planSim's peek: the pieces that follow it, like the belt after the shoes, are chosen again), a past day being corrected has the
   piece put in. Worked out once per day, slot and plan (pickMemo; the plan cache is cleared by any change). The tests' fixed plan
   (TEST_PLAN) keeps the rule-of-thumb fit (fitRule) */
let pickMemo={c:null,key:'',v:null};
const pickRec=(k,o,slot,id)=>{const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest},follow=FOLLOW[slot]||[],force={};
  for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  force[slot]=id;suitPants(force,slot,o);keepOff(force,k,slot);const skip={...(rec.skip||{})};delete skip[slot];rec.force=force;rec.skip=skip;delete rec.lock;notAhead(rec,k);pocketOn(rec,slot);return rec};
/* a pocket square chosen puts the square back on (a − on it before: rec.off.pocket) */
const pocketOn=(rec,slot)=>{if(slot!=='pocket'||!rec.off||!rec.off.pocket)return;rec.off={...rec.off};delete rec.off.pocket;if(!rec.off.top&&!rec.off.tie)delete rec.off};
// the suit's own pants chosen back (its jacket taken off): no pick of pants, the suit is worn as before
const suitPants=(force,slot,o)=>{if(slot==='bot'&&o.offSuit&&force.bot===o.offSuit.id)delete force.bot};
const pickSim=()=>planSim(planStart(sel.getFullYear(),sel.getMonth()));
function pickScores(slot,o){const k=key(sel),mk=k+'|'+slot+'|'+JSON.stringify(idsOf(o))+'|'+!!o.vest;
  if(pickMemo.c===cache&&pickMemo.key===mk)return pickMemo.v;
  const cur=o[slot]&&o[slot].id,v=new Map();let sim=null;
  for(const c of slotPool(slot,o)){let r;
    if(c.id===cur)r=rateOutfit(o);
    else if(o.frozen){const a={...o,[slot]:c};if(slot==='top'){if(c.type==='suit'){a.suitDay=true;a.bot=c}else{if(o.suitDay)a.bot=null;a.suitDay=false}a.vest=false}r=rateOutfit(a)}
    else{sim=sim||pickSim();r=rateOutfit(sim.peek(k,pickRec(k,o,slot,c.id)))}
    v.set(c.id,r)}
  pickMemo={c:cache,key:mk,v};return v}
/* Suggest another (swapSlot) never brings a real mistake while a piece not yet shown makes a clean outfit (W2-17-07, fix round 3: a black
   shirt under a navy suit, 69, with lavender not yet offered): when the planner's next choice is a hard one, the best-scoring clean piece
   not in the cycle yet is pinned instead (it joins the cycle on the next tap); nothing clean left, the planner's choice stays */
function suggestClean(k,o,slot,rec,pool){if(window.TEST_PLAN||!rec.skip)return;
  const sim=pickSim(),next=sim.peek(k,rec);if(!rateOutfit(next).hard.length)return;
  let best=null;for(const c of pool){if(rec.skip[slot].includes(c.id))continue;const r=rateOutfit(sim.peek(k,{...rec,force:{...rec.force,[slot]:c.id}}));
    if(!r.hard.length&&(!best||r.score>best.s))best={id:c.id,s:r.score}}
  if(best)rec.force={...rec.force,[slot]:best.id}}
/* how well a candidate suits the rest of the day's outfit (higher is better): the score it gives (pickScores), or the planner's rules
   of thumb in the tests' fixed plan */
function fitOf(slot,o,c){if(window.TEST_PLAN)return fitRule(slot,o,c);const r=pickScores(slot,o).get(c.id);return r?r.score:fitRule(slot,o,c)}
function fitRule(slot,o,c){
  const day={formal:!!o.formal,clim:o.clim||dayClimate(sel),hasLinks:items.some(i=>i.type==='cufflinks')},suit=slot==='top'?c.type==='suit':o.suitDay,top=slot==='top'?c:o.top,bot=suit?top:slot==='bot'?c:o.bot,legs=suit?top:bot;
  switch(slot){
    case 'top':case 'bot':case 'shirt':case 'tie':return clothesScore(top,bot,slot==='shirt'?c:o.shirt,slot==='tie'?c:o.tie,suit,day)+(slot==='top'?seasonFit(c,day.clim.season)*2+(day.formal?formalTop(c)*2:0):0);
    case 'shoes':return legs?shoeScore(top,legs,c)+shoeFormality(c,suit):0;
    case 'belt':{const f=o.shoes?beltFit(o.shoes,c):0;return f===null?-60:f}
    case 'socks':return sockScore(legs,o.shoes,c,sockEcho(o.shirt,o.tie),{top:o.top,bot:legs,shirt:o.shirt,tie:o.tie,formal:!!o.formal,occasion:o.occasion,season:day.clim.season});   // (a patterned sock's rules, a bright sock on a formal day, the material by season, 2026-11-17)
    case 'watch':return watchFit(c,o.shoes,o.belt);
    case 'clip':case 'links':return accMetal(c,o.tie,o.watch,o.belt);   // the planner's own metal rule (planner.js), enamel and two-tone included
    case 'pocket':return pocketScore(c,o.top,o.shirt,o.tie,{formal:!!o.formal,occ:o.occasion==='formal'?null:o.occasion})}
  return 0}
// gaps in score points (the fixed test plan's rule-of-thumb fit used the same bands)
const fitTag=gap=>gap<=.5?['best','Best match']:gap<=(window.TEST_PLAN?QWIN:4)?['good','Good match']:gap<=(window.TEST_PLAN?18:12)?['ok','Works']:['weak','Weak match'];
/* two pieces the picker would name alike ("Navy" twice, W2-15-09): a second line tells them apart, by brand, else material, else notes,
   else the order they were added in ("2 of 2") */
const pickSub=(i,pool)=>{const t=x=>itemTitle(x)||nm(x),same=pool.filter(x=>t(x)===t(i));if(same.length<2)return '';
  const by=f=>{const v=String(f(i)||'').trim();return v&&same.filter(x=>String(f(x)||'').trim()===v).length===1?v:''};
  return by(x=>x.brand)||by(x=>x.material&&x.material!=='other'?cap1(x.material):'')||by(x=>String(x.notes||'').slice(0,40))||
    `${[...same].sort((a,b)=>(a.added||0)-(b.added||0)||(a.id<b.id?-1:1)).indexOf(i)+1} of ${same.length}`};
const pluralWord=w=>/^(shoes|pants|socks|cufflinks|jeans|chinos)$/.test(w);   // "Choose shoes", not "Choose a shoes" (W2-17-13)
const pickPic=i=>i.photo?`<img src="${srcOk(phSm(i))}" alt="">`:itemPic(i)?`<img src="${srcOk(itemPic(i).img)}" alt="">`:itemThumb(i,true);
function openPicker(slot){const o=planFor()[key(sel)];if(!o||!canPick(o))return;const pool=slotPool(slot,o),hand=handPool(slot,o),cur=o[slot]&&o[slot].id,label=slotLabel(slot,{...o,shirt:null,top:null}).toLowerCase();   // (the slot's own word, not a casual piece's: "Choose a shirt")
  if(!o.frozen&&pool.length+hand.length<2&&!(slot==='pocket'&&!o.pocket&&pool.length)){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to choose from.`;renderToday();return}
  const scored=pool.map(i=>[fitOf(slot,o,i),i]).sort((a,b)=>b[0]-a[0]||(a[1].id<b[1].id?-1:1)),best=scored.length?scored[0][0]:0;
  const card=([f,i])=>{const [cls,txt]=fitTag(best-f),on=i.id===cur,sub=slot==='bot'&&i.type==='suit'?'The suit’s own pants':pickSub(i,pool);
    return `<button class="pick-it${on?' cur':''}" onclick="pickItem('${slot}','${jsq(i.id)}')" aria-label="${esc(itemTitle(i)||nm(i))}${sub?', '+esc(sub):''}: ${on?'wearing, ':''}${txt.toLowerCase()}"${on?' aria-current="true"':''}><span class="pick-pic">${pickPic(i)}</span><span class="pick-nm ${titleCls(i)}">${esc(itemTitle(i)||sentence(nm(i)))}</span>${sub?`<small class="mut pick-sub">${esc(sub)}</small>`:''}<small class="fit ${cls}">${on?(o.frozen?'Recorded':'Wearing')+' · ':''}${txt}</small></button>`};
  const none=o.frozen&&slot!=='top'&&cur?`<button type="button" onclick="pickItem('${slot}','')">None: I didn't wear one</button>`:'';
  $('#pick-sheet').innerHTML=`<div class="pick-head"><b id="pick-title">${o.frozen?`What ${label} did you wear?`:`Choose ${pluralWord(label)?label:aAn(label)}`}</b><button class="pick-x" onclick="closePicker()" aria-label="Close">×</button></div>
    <p class="mut"><small>${o.frozen?'Pick what you really wore on '+shortDate(sel)+'.':`${pluralWord(label)?`All the ${label}`:`Every ${label}`} you own, by the score the outfit gets with each, best first.`}</small></p>
    ${!o.frozen||none?`<div class="btns">${o.frozen?none:`<button type="button" id="pick-next" onclick="pickNext()">Suggest another <span aria-hidden="true">↻</span></button>`}</div>`:''}
    <div class="pick-grid">${scored.map(card).join('')}</div>${handGroup(slot,o,hand,cur)}`;
  picker={slot};$('#pick-sheet').classList.add('on');$('#pick-backdrop').classList.add('on');$('#pick-sheet').scrollTop=0;
  if(typeof layerOpen==='function')layerOpen($('#pick-sheet'));backPush('pick')}   // the phone's Back closes it (back.js)
/* the picker's "Casual · pick by hand" group (handPool): the casual pieces for the slot, under the usual ones, not scored; a casual top is
   worn instead of the shirt and the tie comes off that day (core.js needsTie, planner.js outfit) */
const HAND_NOTE={shirt:'Worn instead of the shirt: no tie that day.',top:'Worn instead of the jacket.',bot:'Worn instead of the pants.'};
function handGroup(slot,o,hand,cur){if(!hand.length)return '';
  const card=i=>{const on=i.id===cur,sub=isCargo(i)?'Cargo pants':TYPES[i.type];
    return `<button class="pick-it hand-it${on?' cur':''}" onclick="pickItem('${slot}','${jsq(i.id)}')" aria-label="${esc(itemTitle(i)||nm(i))}, ${esc(sub.toLowerCase())}: ${on?'wearing, ':''}picked by hand"${on?' aria-current="true"':''}><span class="pick-pic">${pickPic(i)}</span><span class="pick-nm ${titleCls(i)}">${esc(itemTitle(i)||sentence(nm(i)))}</span><small class="mut pick-sub">${esc(sub)}</small><small class="fit hand">${on?(o.frozen?'Recorded':'Wearing')+' · ':''}By hand</small></button>`};
  return `<div class="pick-hand" role="group" aria-labelledby="pick-hand-h"><b id="pick-hand-h" class="pick-hand-h">Casual · pick by hand</b><p class="mut"><small>${HAND_NOTE[slot]||''} Never planned or suggested.</small></p><div class="pick-grid">${hand.map(card).join('')}</div></div>`}
function closePicker(){const was=!!picker;picker=null;const s=$('#pick-sheet'),b=$('#pick-backdrop');if(s)s.classList.remove('on');if(b)b.classList.remove('on');
  if(was&&typeof layerClose==='function')layerClose(s);if(was)backDrop('pick');
  if(typeof syncLaterRun==='function')syncLaterRun('today')}   // a sync's redraw that waited for the picker (sync.js)
backOn('pick',()=>closePicker());
function pickNext(){const s=picker&&picker.slot;closePicker();if(s)swapSlot(s)}
async function pickItem(slot,id){const k=key(sel),o=planFor()[k];if(!o)return;closePicker();
  const it=id?items.find(i=>i.id===id)||null:null;
  if(o.frozen)return correctPast(slot,it);
  if(!it||(o[slot]&&o[slot].id===id))return;
  const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest},follow=FOLLOW[slot]||[],force={};
  for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  force[slot]=id;suitPants(force,slot,o);keepOff(force,k,slot);const skip={...(rec.skip||{})};delete skip[slot];rec.force=force;rec.skip=skip;delete rec.lock;notAhead(rec,k);pocketOn(rec,slot);
  if(slot==='belt'&&beltless(k,rec)){swapMsg='That belt needs shoes that don’t suit this outfit, so the belt stays as it was.';renderToday();return}
  swapMsg='';await saveDay(rec);await unlockClash(k);renderToday()}
/* ---- correcting a past day: what was really worn replaces what was planned, so rest and "last worn" stay true ---- */
function togglePastEdit(){const k=key(sel);pastEdit=pastEdit===k?null:k;if(pastEdit)listOpen=true;swapMsg='';renderToday()}
async function correctPast(slot,it){const k=key(sel),r=dayRecs[k],o=planFor()[k];if(!r||!r.ids||!o||pastEdit!==k)return;
  const ids={...r.ids};let suitDay=!!r.suitDay;
  if(slot==='top'){if(!it)return;ids.top=it.id;if(it.type==='suit'){suitDay=true;ids.bot=it.id}else{if(suitDay||ids.bot===r.ids.top)ids.bot=null;suitDay=false}}
  else ids[slot]=it?it.id:null;
  const rec={...r,ids,suitDay,worn:true,edited:true};delete rec.auto;
  if(!suitDay||!hasVest(items.find(i=>i.id===ids.top)))rec.vestOn=false;
  swapMsg='Corrected.';
  // the locked days after it let go when one holds what was really worn (the jacket on the next workday, the tie within three): yesterday
  // corrected to the pink suit left today locked on it, "the same suit as the workday before" (fix round 3, W2-17-06)
  await saveDay(rec);await unlockClash(k,true);renderToday()}
const setFormal=(v,k)=>setOccasion(v?'formal':null,k);
/* give a day an occasion (or none): its swaps are dropped, since the outfit is chosen afresh for the occasion, and the coming days are
   released so they are planned around it (the suit that is right for the occasion may be locked on the day before) */
async function setOccasion(occ,k){k=k||key(sel);const r={...(dayRecs[k]||{date:k})};delete r.force;delete r.off;delete r.skip;delete r.vest;delete r.formal;delete r.occasion;delete r.lock;if(occ==='formal')r.formal=true;else if(occ)r.occasion=occ;if(k===key(sel))swapMsg='';await clearLocks();await saveDay(r);if(settingsOpen()){todayDirty();renderFormalUI()}else renderToday()}
async function resetDay(){const k=key(sel),r=dayRecs[k];if(!r)return;const n={...r};delete n.off;delete n.force;delete n.skip;delete n.worn;delete n.vest;delete n.lock;delete n.kind;notAhead(n,k);swapMsg='';await saveDay(n);renderToday()}   // (kind too: a piece taken off or a moved outfit pinned the suit or blazer, CR-4-07)
/* a coming day's record holds no pieces (ids): they are written when the day is shown (recordDays, today) or once it is past. A pick or
   swap ahead used to write the outfit from before it, which then stood as worn in place of the pick when the app wasn't opened that day
   (fix round 3, W2-17-01); today's record is rewritten from the screen right after (recordDays) */
function notAhead(rec,k){if(keyDate(k)>todayDate()){delete rec.ids;delete rec.suitDay;delete rec.vestOn;delete rec.auto}}
async function setWorn(v){const k=key(sel),o=planFor()[k];if(!o)return;const r=dayRecs[k]||{date:k};await saveDay({...r,ids:r.ids&&o.frozen?r.ids:idsOf(o),suitDay:o.suitDay,vestOn:o.frozen?!!r.vestOn:!!o.vest,worn:v});renderToday()}
/* clear what swaps and vest choices pinned on days after today, so the planner picks those days again; formal days stay.
   rules (new PLAN_RULES): only what the app chose goes, the week's locks (rec.lock) and pieces it recorded by itself (rec.auto);
   the owner's own picks (force, skip, the vest, a moved outfit's kind, a piece taken off) stay. Returns the days changed
   (rules: the days whose lock or recorded pieces went; else the days whose own picks were cleared) */
/* new planning rules (rules: true) let the coming days be planned again, keeping the owner's own picks. Start the plan over (Settings →
   Schedule, the owner's ask 2026-11-14: "let me completely redo the plan, throwing out my locks and changes") clears today and every
   coming day not marked worn: locks, swaps, picks, the vest, pieces taken off, the suit or blazer chosen; occasions stay (and days off,
   which are settings), and the past */
const dayChanged=(r,today)=>!!(r.force||r.skip||(!today&&r.ids)||typeof r.vest==='boolean'||(r.off&&(r.off.top||r.off.tie))||r.kind||(!today&&r.vestOn!==undefined)||(!today&&r.auto));
async function replanFuture(rules){const T=todayDate();let n=0;
  for(const r of Object.values(dayRecs)){const d=keyDate(r.date);if((rules?d<=T:d<T)||r.worn===true)continue;
    if(rules){if((!r.lock||r.trip)&&!r.auto)continue;const keep={...r};if(!r.trip)delete keep.lock;if(keep.auto){delete keep.auto;delete keep.ids;delete keep.suitDay;delete keep.vestOn}await saveDay(keep,true);n++;continue}   // (a kept trip's lock stays)
    const mine=dayChanged(r,+d===+T);if(!mine&&!r.lock&&!(+d===+T&&r.ids))continue;
    const keep={date:r.date};if(r.formal)keep.formal=true;if(r.occasion)keep.occasion=r.occasion;await saveDay(keep,true);if(mine)n++}
  planDirty();swapMsg='';if(window.scheduleSync)scheduleSync();return n}
/* the planning rules changed since this wardrobe was last planned: re-plan the future once */
async function checkPlanRules(){if(!window.TEST_PLAN)return planRulesCheck()}   // (PLAN_RULES is read in planRulesCheck only: a bump selects only the tests that plan for real)
/* the rules this phone last planned by are the phone's own (meta PLAN_RULES_KEY, never synced; fix round 3, W1-1-01 = W1-4-01 = W1-2-06):
   kept in the synced settings, a joining phone took the backup's old number and re-planned on its second start, a phone still on an
   older version sent its lower number back with every settings save, and a roll-back brought one back. settings.planRules is read once,
   for a phone that has no number of its own yet (from before), and never written again */
const PLAN_RULES_KEY='plan_rules';
// (kept in localStorage too, read first so start-up waits for nothing on the usual path; the database's copy where it was lost)
const planRulesLs=()=>{try{const v=+localStorage.getItem(PLAN_RULES_KEY);return v>0?v:null}catch{return null}};
async function planRulesNote(v){try{localStorage.setItem(PLAN_RULES_KEY,String(v))}catch{}await metaPut(PLAN_RULES_KEY,v)}
async function planRulesCheck(){let mine=planRulesLs();if(mine!==null&&mine>=PLAN_RULES)return;
  // (nothing a re-plan would change, as on a new phone: no read, no re-plan, the number is noted)
  const T=todayDate(),work=Object.values(dayRecs).some(r=>(r.lock||r.auto)&&r.worn!==true&&keyDate(r.date)>T);
  if(mine===null&&work){try{const m=await metaGet(PLAN_RULES_KEY);if(typeof m==='number')mine=m}catch{}}
  const had=mine!==null?mine:(settings.planRules||0);
  if(had>=PLAN_RULES||!work){await planRulesNote(Math.max(had,PLAN_RULES));return}
  const n=await replanFuture(true);await planRulesNote(PLAN_RULES);
  if(n)setTimeout(()=>toast('The planner was updated: upcoming days were planned again. Your own picks were kept.',4500),400)}
const replanCount=()=>{const T=todayDate();return Object.values(dayRecs).filter(r=>{const d=keyDate(r.date);return d>=T&&r.worn!==true&&dayChanged(r,+d===+T)}).length};
async function replanButton(){const T=todayDate(),n=replanCount();
  const locked=Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>=T&&r.worn!==true);
  if(!n&&!locked){renderReplanUI('Nothing to start over: today and every coming day already follow the planner.');return}
  // (fix round 3, W2-17-19: today's outfit changed although its pill read "✓ Wore": the question now says so plainly)
  const tw=isWorkday(T)&&!(dayRecs[key(T)]&&dayRecs[key(T)].worn===false)?' Today’s outfit may change too, even though it shows ✓ Wore: if you are already wearing it, tap Cancel.':'';
  if(!await askConfirm(`Start the plan over?\n\nToday and every coming day are planned afresh: the week's locks and ${n?`your changes on ${n} day${n===1?'':'s'} (swaps, picks, the vest, pieces taken off)`:'any changes'} are thrown out.${tw} Occasions, days off, days marked worn and the past stay as they are.`,{ok:'Start over'}))return;
  const m=await replanFuture();renderReplanUI(m?`Started over: ${m} day${m===1?'':'s'} with changes planned afresh, and the week unlocked.`:'Started over: the week was unlocked and planned afresh.');todayDirty()}
function renderReplanUI(msg){const el=$('#replan-status');if(!el)return;const n=replanCount();
  el.textContent=msg||((n?`${n} day${n===1?' has':'s have'} your changes (swaps, picks, the vest, pieces taken off).`:'Today and the coming days follow the planner.')+' Plans afresh from today, throwing out the week\'s locks and your changes; occasions, days off and days marked worn stay.')}
async function setVest(v){const k=key(sel),o=planFor()[k];if(!o)return;
  if(o.frozen){const r0=dayRecs[k];if(pastEdit!==k||!r0)return;await saveDay({...r0,vestOn:!!v,worn:true,edited:true});renderToday();return}
 const r={...(dayRecs[k]||{date:k})};r.vest=v;swapMsg='';await saveDay(r);renderToday()}
/* Reset: a card of its own under the month, like the other cards, on a day the user changed (a swap, a pick, the vest); it puts the
   planned outfit back */
function resetCard(o){return o&&!o.frozen&&(o.overrides||o.vestOverride)?`<section class="mbox resetbox" id="rbox"><button class="month-link resetlink" onclick="resetDay()" aria-label="Reset changes" title="Undo your changes to this day"><span class="rsicon" aria-hidden="true">↺</span><b>Reset</b></button></section>`:''}
function dayActions(o){
  const T=todayDate(),d=dayOnly(sel),past=d<T;
  let h='';
  // whether it was worn is marked on the picture (wornMarks)
  if(o.occasion)h+=`<span class="ftag" title="Set in Settings, Occasions" aria-label="${o.occasion==='formal'?'Formal day':'Occasion: '+occLabel(o.occasion)}">${o.occasion==='casual'?'No jacket':occLabel(o.occasion)}${o.occasion==='formal'?'<span class="fx"> day</span>':''}</span>`;
  // today is a public holiday or a day off of the user's own: Today shows the next workday, and says why (fix round 3, W2-16-09: it jumped
  // to Sunday without a word on National Day)
  const offT=d>T&&typeof homeDay==='function'&&+d===+homeDay()&&settings.workdays.includes(T.getDay())?offName(T):'';
  const offNote=offT?`<p class="mut offtoday" id="offtoday"><small>Today is ${esc(offT)}, a day off. This is ${esc(DAY_NAMES[d.getDay()])}’s outfit.</small></p>`:'';
  if(past&&o.frozen)h+=`<button class="pastedit${pastEdit===key(sel)?' on':''}" onclick="togglePastEdit()" aria-pressed="${pastEdit===key(sel)}">${pastEdit===key(sel)?'Done':'Correct this day'}</button>`;
  return offNote+(h?`<div class="dayact">${h}</div>`:'')+(past&&o.frozen&&pastEdit===key(sel)?'<p class="mut"><small>Tap ⇄ beside a piece to set what you really wore. The planner then counts that, not what was planned.</small></p>':past&&o.frozen&&o.worn!==true?'<p class="mut"><small>Past day: kept as it was planned.</small></p>':'')+(swapMsg?`<p class="mut"><small>${swapMsg}</small></p>`:'');
}

/* ---- the score card: five dials (2026-11-17, the owner's approved design, C:\code\audit-2026-11-13\score-ideas\score-dials.html) ----
   Folded, one 52px row of five dials (planner.js dialHarmony, dialTexture, dialFreshness, dialVariety, dialOccasion), a broken rule ringing
   its dial red with "!". Unfolded: the rank among the day's outfits (rankFor, worked out in analysis-worker.js and filled in when it comes),
   the rules line, a Why sentence, swaps that rank higher (a tap wears one: applyFix → pickItem), each dial's reason, the week's variety and
   the month's weeks, the weather and the rules. No swaps on past or worn days. It replaced the 0-100 checklist score (nearly always 99-100:
   the planner optimizes the same rateOutfit checks); rateOutfit stays for the rules, the planner and Insights */
let scoreOpen=false;
const dialTone=v=>v>=80?'good':v>=60?'ok':'low';
const ordinal=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};
const dayWord=()=>key(sel)===key(todayDate())?'today':'this day';
/* the latest workdays before d with an outfit (a day marked not worn left out, as the planner's history does), latest first: [{d, o}] */
function recentWork(d,n=PAIR_DAYS){const out=[],x=dayOnly(d);for(let g=0;g<n*3+14&&out.length<n;g++){x.setDate(x.getDate()-1);if(!isWorkday(x))continue;
  const r=dayRecs[key(x)];if(r&&r.worn===false)continue;const o=planOn(x);if(o&&hasOutfit(o))out.push({d:new Date(x),o})}return out}
/* how many calendar days a piece of a type usually waits between wears (Freshness): the pieces of the type in rotation over the days a week
   that wear the type (suits on the days that aren't blazer days, blazers and pants on blazer days, the rest every workday) */
function dialCycle(d){const n=di(d),wd=Math.max(1,settings.workdays.length),bz=settings.blazerDays.filter(x=>settings.workdays.includes(x)).length,cnt={};
  for(const i of items)if(!isHandPick(i)&&inRotation(i,n))cnt[i.type]=(cnt[i.type]||0)+1;
  const jk=wearsJacket(),per={suit:jk&&cnt.blazer?Math.max(1,wd-bz):wd,blazer:cnt.suit?Math.max(1,bz):wd,pants:jk&&cnt.suit?Math.max(1,bz):wd};
  return t=>Math.max(1,cnt[t]||1)*7/(per[t]||wd)}
/* the day's dials and its rules (rateOutfit), kept per outfit and plan like the picker's scores (the plan cache is cleared by any change) */
let dialMemo={c:null,k:'',v:null};
const outfitKey=o=>key(sel)+JSON.stringify(idsOf(o))+!!o.vest+items.length;
function dialsFor(o){const k=outfitKey(o);if(dialMemo.c===cache&&dialMemo.k===k)return dialMemo.v;let v;
  if(window.TEST_PLAN)v=TEST_PLAN.dials(o);   // (tests/fixedplan.js: fixed dials, no planner)
  else{const rec=recentWork(sel);v={h:dialHarmony(o),t:dialTexture(o),f:dialFreshness(o,dialCycle(sel)),v:dialVariety(o,rec),o:dialOccasion(o),r:rateOutfit(o)}}
  v.bad={};for(const c of v.r.hard)v.bad[DIAL_OF_CHECK[c]||'o']=c;
  dialMemo={c:cache,k,v};return v}
/* ---- the rank: in analysis-worker.js (planner.js rankLooks), only for the day on screen, kept per day and outfit (rankMemo, like the
   dials); the card shows the dials at once and fills the rank line, the Why and the swaps in when the answer comes (rankFill) ---- */
let rankMemo={c:null,k:'',v:null},rankW=null,rankN=0;const rankWait=new Map();
/* the outfits the day allows: each slot's pieces of the day's kind in rotation that day (not away), no hand-pick pieces */
function rankPools(o){const n=di(sel),pool=t=>items.filter(i=>i.type===t&&!isHandPick(i)&&inRotation(i,n)).sort((a,b)=>a.id<b.id?-1:1);
  return {top:pool(o.top?o.top.type:o.suitDay?'suit':'blazer'),bot:pool('pants'),shirt:pool('shirt'),tie:pool('tie'),shoes:pool('shoes'),belt:pool('belt'),watch:pool('watch'),socks:pool('socks')}}
function rankWorker(){if(rankW!==null)return rankW||null;
  try{rankW=new Worker('analysis-worker.js')}catch(e){rankW=false;return null}
  rankW.onmessage=e=>{const d=e.data||{},w=rankWait.get(d.rank);if(!w)return;rankWait.delete(d.rank);if(d.res)w.done(d.res);else{console.warn('rank: '+d.error);w.done(null)}};
  // a worker that fails: the asks still waiting are worked out here instead, and the next ones too
  rankW.onerror=()=>{rankW=false;const left=[...rankWait.values()];rankWait.clear();for(const w of left)setTimeout(()=>{try{w.done(rankLooks(w.P,w.o))}catch(e){w.done(null)}},30)};
  return rankW}
function rankFor(o){if(!o||!hasOutfit(o))return null;if(window.TEST_PLAN)return TEST_PLAN.rank(o);const k=outfitKey(o);
  if(rankMemo.c===cache&&rankMemo.k===k)return rankMemo.v;   // (null while it is worked out)
  const mine=rankMemo={c:cache,k,v:null},id=k+'#'+(++rankN),P=rankPools(o),list=new Map(),t0=performance.now();
  for(const l of Object.values(P))for(const i of l)list.set(i.id,i);for(const s of SLOTS)if(o[s])list.set(o[s].id,o[s]);
  const strip=({photo,swatch,stripes,texture,sett,patternText,weave,pbox,patternSpec,meas,tagAI,rest,...i})=>i;   // the tags only (as What to buy sends)
  const done=res=>{if(rankMemo!==mine||!res)return;res.wall=Math.round(performance.now()-t0);mine.v=res;rankFill()};
  const w=rankWorker();
  if(w){rankWait.set(id,{done,P,o});w.postMessage(JSON.parse(JSON.stringify({rank:{id,settings,list:[...list.values()].map(strip),pools:Object.fromEntries(Object.entries(P).map(([s,l])=>[s,l.map(i=>i.id)])),
    ids:idsOf(o),day:{suitDay:!!o.suitDay,suitBot:!!o.suitBot,clim:o.clim||null,formal:!!o.formal,occasion:o.occasion||null}}})))}
  else setTimeout(()=>{try{done(rankLooks(P,o))}catch(e){console.warn(e)}},30);   // (where workers aren't available)
  return null}
/* the rank's answer arrived: put it into the card on screen, if it is still this outfit's */
function rankFill(){const box=$('#sbox');if(!box||box.dataset.rk!==rankMemo.k||!rankMemo.v)return;const o=planFor()[key(sel)];if(!o)return;
  const D=dialsFor(o),R=rankMemo.v,put=(s,h)=>{const e=box.querySelector(s);if(e)e.innerHTML=h};
  put('#srank',rankLine(R,D));put('#swhy',whyText(o,D,R));put('#sswaps',swapsHtml(o,D,R));box.classList.add('ranked');
  const b=box.querySelector('.month-link');if(b)b.setAttribute('aria-label',cardLabel(D,R))}
function rankLine(R,D){if(!R)return `<span class="mut">Ranking ${dayWord()==='today'?'today’s':'this day’s'} outfits…</span>`;const w=dayWord();
  if(!R.n)return `No outfit you own meets every rule ${w}`;
  if(R.rank>R.n)return `Below all ${R.n} outfits that meet every rule ${w}`;
  return (R.rank===1?`Best of ${R.n} outfit${R.n===1?'':'s'} ${w}`:`${ordinal(R.rank)} best of ${R.n} outfits ${w}`)+(D.r.hard.length?'':` · Top ${Math.max(1,Math.ceil(100*R.rank/R.n))}%`)}
/* a broken rule in words ("Brown belt with black shoes") */
function failText(o,c){if(c.label==='Belt'&&o.belt&&o.shoes)return `${sentence(dCol(o.belt))} belt with ${dCol(o.shoes)} shoes`;return sentence(c.why||c.label)}
const lowFirst=t=>t?t[0].toLowerCase()+t.slice(1):t;
const itemWord=(i,slot,o)=>`${shortDesc(i)||nm(i)} ${slotLabel(slot,o).toLowerCase()}`;   // (the short titles, as the picker's swaps had them)
/* the Why sentence: a broken rule and what mends it; the pieces' rest when it beat a better-ranked look; else the strongest dial's reason and
   the weakest's */
function whyText(o,D,R){const w=dayWord(),hard=D.r.checks.filter(c=>c.hard);
  if(hard.length){const f=R&&R.swaps.find(s=>s.fix),it=f&&items.find(i=>i.id===f.id);
    return esc(failText(o,hard[0])+'.'+(it?` With the ${itemWord(it,f.slot,o)}, this would be the ${f.rank<=R.n?ordinal(f.rank)+' best':'one'} look ${w}.`:''))}
  const ks=['h','t','o','v','f'],best=ks.reduce((m,k)=>D[k].v>D[m].v?k:m),weak=ks.reduce((m,k)=>D[k].v<D[m].v?k:m),wk=D[weak];
  const tail=wk.v<70&&weak!==best?' '+(wk.weak?`But ${lowFirst(wk.weak)}.`:wk.why):'';
  if(R&&R.rank>1&&D.f.v>=75&&D.f.most)return esc(`Picked because the ${D.f.most.piece} had rested ${D.f.most.rest>=60?'60+':D.f.most.rest} days.`+(weak!=='f'?tail:''));
  return esc((D[best].good?D[best].good+'.':D[best].why)+tail)}
function swapsHtml(o,D,R){if(o.frozen||!canPick(o))return '';if(!R)return '';const hard=D.r.hard.length>0;
  const head=`<p class="ssec">${hard?'These would put it right':'These would rank higher'}</p>`;
  if(!R.swaps.length)return head+`<p class="snone">${hard?'Nothing you own puts it right with one swap.':`Nothing you own makes a better look ${dayWord()}.`}</p>`;
  return head+R.swaps.map(s=>{const it=items.find(i=>i.id===s.id);if(!it)return '';const gain=R.rank-s.rank,place=s.rank>R.n?'meets every rule':s.rank===1?'best':ordinal(s.rank)+' best',w=itemWord(it,s.slot,o);
    return `<button type="button" class="sfixbtn${s.fix?' fix':''}" onclick="event.stopPropagation();applyFix('${jsq(s.slot)}','${jsq(s.id)}')" aria-label="${s.fix?'Fix it: wear the ':'Wear the '}${esc(w)}: ${gain>0?gain+' place'+(gain===1?'':'s')+' higher, ':''}${place}"><span class="dot" aria-hidden="true">${swatchSVG(it,true)}</span><span class="sfixnm">${s.fix?'Fix it: ':'Wear the '}${esc(w)}</span><b>${gain>0?`+${gain} place${gain===1?'':'s'}`:''}<small>${place}</small></b></button>`}).join('')}
function applyFix(slot,id){return pickItem(slot,id)}
function cardLabel(D,R){return DIAL_KEYS.map(k=>`${DIAL_NAMES[k]} ${D.bad[k]?'broken rule':D[k].v}`).join(', ')+'. '+(R?rankLine(R,D).replace(/<[^>]+>/g,'')+'. ':'')+(D.r.hard.length?`${D.r.hard.length} thing${D.r.hard.length===1?'':'s'} to fix`:'All rules met')+'. '+(scoreOpen?'Fold away':'Show why')}
/* one dial: a ring filled to the value, the number inside (or "!" for a broken rule, ringed in red), the name under it; at 0 no arc is
   drawn (its round cap alone was a red dot at the top of the ring, read as a broken rule: the owner, 2026-11-17) */
function dialHtml(k,d,bad){const t=bad?'bad':dialTone(d.v),r=15,c=2*Math.PI*r,p=c*Math.max(0,Math.min(100,d.v))/100;
  const arc=p>=.05?`<circle class="darc" cx="20" cy="20" r="${r}" stroke-dasharray="${p.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 20 20)"/>`:'';
  return `<span class="dial d-${t}"><svg viewBox="0 0 40 40" aria-hidden="true">${bad?'<circle class="dbad" cx="20" cy="20" r="18.6"/>':''}<circle class="dtrack" cx="20" cy="20" r="${r}"/>${arc}<text x="20" y="24.4" text-anchor="middle">${bad?'!':d.v}</text></svg><small>${DIAL_NAMES[k]}</small></span>`}
/* ---- the week's variety (the unfolded card's last part): the work week holding the day, and each week of its month ---- */
function weekOf(d){const w0=typeof weekFirst==='function'?weekFirst():0,s=dayOnly(d);s.setDate(s.getDate()-((s.getDay()-w0+7)%7));const days=[];
  for(let g=0;g<7;g++){const x=new Date(s.getFullYear(),s.getMonth(),s.getDate()+g);if(!isWorkday(x))continue;const r=dayRecs[key(x)];if(r&&r.worn===false)continue;const o=planOn(x);if(o&&hasOutfit(o))days.push({d:x,o})}
  return {start:s,days}}
/* three parts, 0-100 each, and their average: Colors spread (different tie, shirt and jacket colors over the week's days), No pairing
   repeats (a day with the shirt color and tie of one of its PAIR_DAYS workdays before: the calendar's gold), Suits spread (a jacket again
   within the week) */
function weekVariety(wk){const D=wk.days;if(!D.length)return null;
  const share=(f)=>{const v=D.map(x=>f(x.o)).filter(Boolean);return v.length?{n:new Set(v).size,of:v.length}:null};
  const tc=share(o=>o.tie&&tieGroup(o.tie)),sc=share(o=>o.shirt&&shirtGroup(o.shirt)),jc=share(o=>o.top&&jacketGroup(o.top)),parts=[tc,sc,jc].filter(Boolean);
  const colors=parts.length?Math.round(100*parts.reduce((a,p)=>a+p.n/p.of,0)/parts.length):100;
  const reps=D.map(x=>({x,i:pairSeen(x.o,recentWork(x.d))})).filter(r=>r.i>=0),pairs=Math.max(0,100-30*reps.length);
  const seen=new Set(),dup=[];for(const x of D){if(!x.o.top)continue;if(seen.has(x.o.top.id))dup.push(x);seen.add(x.o.top.id)}const suits=Math.max(0,100-30*dup.length);
  const fd=d=>d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  const repTxt=reps.length?(()=>{const r=reps[0],p=recentWork(r.x.d)[r.i];return `The ${dCol(r.x.o.shirt)} shirt with the ${dCol(r.x.o.tie)} tie on ${fd(r.x.d)}, as on ${fd(p.d)}${reps.length>1?`, and ${reps.length-1} more`:''}.`})():'No shirt and tie together again within 10 workdays.';
  const dupTxt=dup.length?`The ${dCol(dup[0].o.top)} ${dup[0].o.top.type==='suit'?'suit':'jacket'} twice this week${dup.length>1?`, and ${dup.length-1} more`:''}.`:'A different jacket every day.';
  const cTxt=[tc&&`${tc.n} tie color${tc.n===1?'':'s'}`,sc&&`${sc.n} shirt color${sc.n===1?'':'s'}`,jc&&`${jc.n} jacket color${jc.n===1?'':'s'}`].filter(Boolean).join(', ')+` over ${D.length} day${D.length===1?'':'s'}.`;
  const score=Math.round((colors+pairs+suits)/3);
  const note=reps.length?`${reps.length} shirt-and-tie repeat${reps.length===1?'':'s'}`:dup.length?'A jacket twice':tc&&tc.n===tc.of?'Every tie different':`${tc?tc.n:0} tie colors`;
  return {score,parts:[['Colors spread',colors,cTxt],['No pairing repeats',pairs,repTxt],['Suits spread',suits,dupTxt]],note}}
let weekMemo={c:null,k:'',v:null};
function weeksHtml(){const k=key(sel);if(weekMemo.c===cache&&weekMemo.k===k)return weekMemo.v;
  const T=todayDate(),cur=weekOf(sel),V=weekVariety(cur),bar=(t,v,why,n)=>`<div class="sdl sli" style="--i:${n}"><div class="sdh"><span>${t}</span><b class="c-${dialTone(v)}">${v}</b></div><span class="sdb" aria-hidden="true"><i class="b-${dialTone(v)}" style="--p:${v/100}"></i></span><small>${esc(why)}</small></div>`;
  let h='';if(V){h+=`<p class="ssec sli">This week’s variety · <b class="c-${dialTone(V.score)}">${V.score}</b></p>`+V.parts.map((p,n)=>bar(p[0],p[1],p[2],n+8)).join('');
    const m=sel.getMonth(),y=sel.getFullYear(),last=new Date(y,m+1,0),rows=[];
    for(let s=weekOf(new Date(y,m,1)).start;s<=last;s=new Date(s.getFullYear(),s.getMonth(),s.getDate()+7)){const wk=weekOf(s);wk.days=wk.days.filter(x=>x.d.getMonth()===m);const v=weekVariety(wk);if(!v)continue;
      const a=wk.days[0].d,b=wk.days[wk.days.length-1].d,mo=a.toLocaleDateString('en-US',{month:'short'}),isCur=+cur.start===+wk.start,fut=a>T;
      rows.push(`<li class="${isCur?'cur':''}"><span class="wn b-${dialTone(v.score)}">${v.score}</span><span>${mo} ${a.getDate()}${+a===+b?'':' – '+b.getDate()}<small>${isCur?'This week':fut?'Planned':esc(v.note)}</small></span></li>`)}
    if(rows.length)h+=`<p class="ssec sli">Weeks this month</p><ul class="sweeks sli">${rows.join('')}</ul>`}
  weekMemo={c:cache,k,v:h};return h}
/* the weather in one line: the forecast (or the month's usual highs) and whether the cloth suits it (the Weather check) */
function wxLine(o,D){const c=o.clim;if(!c)return '';const w=c.wx,chk=D.r.checks.find(x=>x.label==='Weather'),tp=v=>typeof temp==='function'?temp(v):Math.round(v);
  const t=w&&typeof w.tmax==='number'?`${tp(w.tmax)}°${c.rain?' · rain likely':''}`:c.norm&&typeof c.norm.tmax==='number'?`Usually ${tp(c.norm.tmax)}° this month`:'';
  return [t,chk&&chk.why?sentence(chk.why):`Cloth for a ${c.season} day`].filter(Boolean).join('. ')+'.'}
function scoreCard(o){
  const D=dialsFor(o),R=rankFor(o),hard=D.r.checks.filter(c=>c.hard),rules=DIAL_RULES.filter(([l])=>l==='Complete outfit'||D.r.checks.some(c=>c.label===l));
  const dials=DIAL_KEYS.map(k=>dialHtml(k,D[k],!!D.bad[k])).join('');
  const rl=hard.length?`<p class="srules bad sli">! ${hard.length} thing${hard.length===1?'':'s'} to fix: ${esc(lowFirst(failText(o,hard[0])))}</p>`:`<p class="srules ok sli">✓ All ${rules.length} rules met</p>`;
  const bars=DIAL_KEYS.map((k,n)=>{const d=D[k],bad=D.bad[k],t=bad?'bad':dialTone(d.v),c=bad&&D.r.checks.find(x=>x.label===bad);
    return `<div class="sdl sli" style="--i:${n+3}"><div class="sdh"><span>${DIAL_NAMES[k]}</span><b class="c-${t}">${bad?'!':d.v}</b></div><span class="sdb" aria-hidden="true"><i class="b-${t}" style="--p:${d.v/100}"></i></span><small>${esc(c?failText(o,c)+'.':d.why)}</small></div>`}).join('');
  const rlist=rules.map(([l,t])=>{const c=D.r.checks.find(x=>x.label===l&&x.hard);return `<li${c?' class="f"':''}>${esc(c?failText(o,c):l==='Shoes'&&o.suitDay?'Shoes suit the suit':t)}</li>`}).join('');
  const wx=wxLine(o,D);
  // unfolds like the pieces list and the month plan (boxUnfold); each part slides in, the bars fill to their value
  return `<section class="mbox score dials${hard.length?' hasbad':''}${scoreOpen?' open instant':''}${R?' ranked':''}" id="sbox" data-rk="${esc(outfitKey(o))}"><button class="month-link" onclick="toggleScore()" aria-expanded="${scoreOpen}" aria-controls="spanel" aria-label="${esc(cardLabel(D,R))}">
    <span class="dialrow" aria-hidden="true">${dials}</span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="spanel"><div class="mpanel-in" onclick="toggleScore()"><p class="srank sli" id="srank" style="--i:0">${rankLine(R,D)}</p>${rl}<p class="swhy sli" id="swhy" style="--i:2">${whyText(o,D,R)}</p><div id="sswaps" class="sswaps" onclick="event.stopPropagation()">${swapsHtml(o,D,R)}</div>
    <p class="ssec sli">Why each dial</p>${bars}${weeksHtml()}${wx?`<p class="ssec sli">Weather</p><p class="swx sli">${esc(wx)}</p>`:''}<p class="ssec sli">Rules</p><ul class="srl sli">${rlist}</ul></div></div></section>`;
}

/* the score box and the pieces list unfold and fold like the month (monthUnfold / monthFold): the page is laid out once and the card's
   edge (a strip, foldEdge) and what is under it slide; their own entry cascades (the checks and their bars, the pieces) still play.
   Folding is that cascade backwards: the last check or piece lifts out first (BOX_LIFT ms apart, styles.css .blift), the card closes
   once about half are gone. A box's running animations are kept on it (box._fa) so a tap in the middle finishes the last move. */
const BOX_LIFT=20;
function boxStop(box){const a=box._fa;box._fa=null;if(!a)return;for(const x of a.list)x.cancel();if(a.end)a.end()}
function boxUnfold(box){boxStop(box);const pan=box.querySelector('.mpanel');box.classList.remove('instant','bshut','blift');box.classList.add('bfast','open');
  const g=pan?pan.offsetHeight:0,d=revealNeed(box,box);
  if(noMotion()||!g){if(d>.5)scrollBy(0,d);return}
  const o={duration:MONTH_MS,easing:MONTH_EASE},c=foldEdge(box,g,0,o),list=[c.anim];
  for(const e of monthBelow(box))list.push(e.animate([{transform:`translateY(${-g}px)`},{transform:'none'}],o));
  const a=box._fa={list,end:c.drop};list[0].finished.then(()=>{if(box._fa===a){box._fa=null;c.drop()}},()=>{});
  if(d>.5)pageScroll(scrollY+d,o.duration)}
/* A card's moving bottom edge, while it unfolds or folds: a strip laid over the card (.fedge) drawing the card's rounded bottom border
   with the page's background under it, sliding with what is below the card, from `from` px above the card's bottom to `to`. It replaces
   a clip-path on the card: Safari repaints a clip on the page's own thread every frame but slides the cards below on its compositor, so
   on a phone the edge and the cards drifted apart and the folding juddered; now every moving part is a slide the browser runs together.
   drop() takes it away, where the card's own edge then is. */
/* The same strip serves a piece's photo row (a straight bottom line, the card's colour under it) and the tile photo under the stage (no
   border, the page under it): it draws whatever bottom border the element has and fills with what is behind the element. */
function foldEdge(box,from,to,o){const cs=getComputedStyle(box),px=v=>parseFloat(v)||0,R=px(cs.borderBottomLeftRadius),bw=px(cs.borderBottomWidth),H=box.offsetHeight,eh=Math.max(R,bw);
  let under='';for(let n=box.parentElement;n&&!under;n=n.parentElement){const c=getComputedStyle(n).backgroundColor;if(c&&!/^(transparent|rgba\(.*,\s*0\))$/.test(c))under=c}
  const w=document.createElement('div');w.className='fedge';w.setAttribute('aria-hidden','true');
  w.style.inset=`${-px(cs.borderTopWidth)}px ${-px(cs.borderRightWidth)}px ${-bw}px ${-px(cs.borderLeftWidth)}px`;w.style.borderRadius=cs.borderRadius;
  const s=document.createElement('i');s.style.cssText=`top:${H-eh}px;height:${eh+Math.max(from,to)+2}px;--fr:${R}px;--fh:${eh}px;--fl:${cs.borderBottomColor};--fw:${bw}px;--fs:${px(cs.borderLeftWidth)}px;--fb:${under||'var(--bg)'}`;w.appendChild(s);
  box.classList.add('fedge-on');if(cs.overflow!=='visible')box.classList.add('fedge-bfc');box.appendChild(w);   // a card stays its own formatting context, a row is left as it is
  const anim=s.animate([{transform:`translateY(${-from}px)`},{transform:`translateY(${-to}px)`}],o);
  return {anim,drop:()=>{w.remove();box.classList.remove('fedge-on','fedge-bfc')}}}
function boxFold(box,items){boxStop(box);const pan=box.querySelector('.mpanel'),pin=box.querySelector('.mpanel-in'),g=pan?pan.offsetHeight:0;
  const close=()=>{box.classList.add('bfast');box.classList.remove('open','instant','bshut','blift')};
  if(noMotion()||!g||foldQuiet||!box.classList.contains('open')){close();keepInView(box);return}
  // the page gets shorter at the end: scroll now to where it can stay (and bring the card's top back into view)
  const top=box.getBoundingClientRect().top,max=Math.max(0,document.documentElement.scrollHeight-g-innerHeight);
  let want=top<8?scrollY+top-8:scrollY;want=Math.min(want,max);
  const its=[...box.querySelectorAll(items)];its.forEach((e,i)=>{e.classList.add('bli');e.style.setProperty('--bi',i)});box.style.setProperty('--bn',its.length);
  const wait=Math.round((its.length*BOX_LIFT+260)*.55);box.classList.add('bfast','bshut','blift');
  const o={duration:MONTH_MS-60,delay:wait,easing:MONTH_EASE,fill:'forwards'},c=foldEdge(box,0,g,o),list=[c.anim];
  for(const e of monthBelow(box))list.push(e.animate([{transform:'none'},{transform:`translateY(${-g}px)`}],o));
  if(pin)list.push(pin.animate([{opacity:1},{opacity:0}],{...o,delay:wait+Math.round((MONTH_MS-60)*.35),duration:200}));
  if(want<scrollY-.5)pageScroll(want,o.duration,o.delay);
  const end=()=>{c.drop();if(scrollY>max)scrollTo(0,max);close()},a=box._fa={list,end};
  list[0].finished.then(()=>{if(box._fa!==a)return;box._fa=null;end();for(const x of list)x.cancel()},()=>{})}
function toggleScore(){const box=$('#sbox');if(!box)return;scoreOpen=!scoreOpen;
  const b=box.querySelector('.month-link');b.setAttribute('aria-expanded',scoreOpen);
  b.setAttribute('aria-label',b.getAttribute('aria-label').replace(/Fold away|Show why/,scoreOpen?'Fold away':'Show why'));
  if(scoreOpen)boxUnfold(box);else boxFold(box,'#spanel .sli, #spanel .sfixbtn')}
