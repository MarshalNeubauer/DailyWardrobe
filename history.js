/* Daily Wardrobe: the outfit history: past days, the coming week's locks, choosing a piece by hand, correcting a past day,
   occasions and the score card
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
/* ---- outfit history: freeze past days, swap pieces, record what was worn ---- */
const idsOf=o=>Object.fromEntries(SLOTS.map(s=>[s,o[s]?o[s].id:null]));
const keyDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
let swapMsg='';
async function saveDay(rec,quiet,auto){rec.updated=nextStamp(rec.updated);if(!auto){delete rec.lockOnly;delete rec.base}const was=dayRecs[rec.date];dayRecs[rec.date]=rec;   /* (core.js dayFields: the fields changed since the copy before get this save's stamp; the one in memory, or, changed in place, the stored one) */
  if(was!==rec){dayFields(rec,was);await txs('days','readwrite',s=>s.put(rec))}else await atomic('days',rec.date,cur=>{dayFields(rec,cur);return {put:rec}});cache={};if(!quiet&&window.scheduleSync)scheduleSync();if(typeof remindSoon==='function')remindSoon()}
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
    const r=dayRecs[k],l=lockIds(o);if(r&&r.lock&&JSON.stringify(r.lock)===JSON.stringify(l)&&!lockStale(r,t=>items.filter(i=>i.type===t&&inRotation(i,di(d)))))continue;
    // (lockAt: when it was made, so a lock made while the wardrobe had too few of a type lets go once more come in: planner.js lockStale)
    const rec={...(r||{date:k}),lock:l,lockAt:nowMs(),updated:nextStamp(r&&r.updated),lockOnly:1,base:(r&&(r.lockOnly?r.base:r.updated))||0};dayRecs[k]=rec;n++;   // the cached plan stays valid: the lock is what it shows
    dayFields(rec,r);await txs('days','readwrite',s=>s.put(rec))}   // (only the lock's fields get its stamp: core.js dayFields)
  n+=await lockPast(di(T)+span-1,mine);
  if(n&&window.scheduleSync)scheduleSync()}
/* the week's locks on days after the window (end: its last day number) let go: those made when the lock ran seven days, or by a phone
   still on that version. Only rec.lock goes: the owner's own picks (force, skip, the vest, kind, off), a kept trip's lock (pack.js
   rec.trip) and a day marked worn stay. Done after the window is locked, so its days keep what was shown; day numbers, not dates */
async function lockPast(end,mine){let n=0;
  for(const r of Object.values(dayRecs)){if(dayRecs!==mine)break;
    if(r.lock&&!r.trip&&r.worn!==true&&di(keyDate(r.date))>end){const c={...r,lockOnly:1,base:r.lockOnly?r.base||0:r.updated||0};delete c.lock;await saveDay(c,true,true);n++}}
  return n}
/* let the planner choose the days after today again (a setting that changes the plan, Re-plan, new planning rules) */
async function clearLocks(){const T=todayDate();let n=0;
  for(const r of Object.values(dayRecs))if(r.lock&&!r.trip&&keyDate(r.date)>T&&r.worn!==true){const c={...r,lockOnly:1,base:r.lockOnly?r.base||0:r.updated||0};delete c.lock;await saveDay(c,true,true);n++}   // (lockOnly: core.js dayWins; a kept trip, pack.js rec.trip, stays: its suitcase may be packed, audit 2026-11-14)
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
  const cur=o[slot]&&o[slot].id,pool=items.filter(i=>(slot==='coat'?i.type==='overcoat'||i.type==='raincoat':i.type===SLOT_TYPE(slot,o.suitDay))&&inRotation(i,di(sel)));
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
  if(!clash)return 0;const from=keyDate(k);let n=0;
  for(const r of Object.values(dayRecs))if(r.lock&&keyDate(r.date)>from&&keyDate(r.date)>=T&&r.worn!==true){const c={...r,lockOnly:1,base:r.lockOnly?r.base||0:r.updated||0};delete c.lock;await saveDay(c,true,true);n++}
  if(n&&window.scheduleSync)scheduleSync();return n}
/* a piece taken off (rec.off) stays pinned through a swap or a pick of another piece, so putting it back brings the same one */
const keepOff=(force,k,slot)=>{const r=dayRecs[k];if(!r||!r.off||!r.force)return;for(const s of ['top','tie','clip','pocket'])if(s!==slot&&r.off[s==='clip'?'tie':s]&&r.force[s])force[s]=r.force[s]};
// (the pocket square follows the jacket, the tie and the shirt it is chosen against: 2026-11-16)
const FOLLOW={top:['bot','shirt','tie','shoes','belt','socks','watch','clip','pocket'],shoes:['belt','socks'],belt:['shoes','socks'],tie:['pocket'],shirt:['pocket']};   // (a belt swap brings shoes that match it, as a shoe swap brings a belt: the owner's ask, 2026-11-14)
/* would this record leave the day with no belt? (planned with the record in memory only, nothing saved): a belt swap or pick whose
   only matching shoes don't suit the outfit (a black suit wants black shoes, and only the black belt matches them) changes nothing */
const beltless=(k,rec)=>{const prev=dayRecs[k];dayRecs[k]=rec;cache={};let n=null;try{n=planFor()[k]}finally{if(prev)dayRecs[k]=prev;else delete dayRecs[k];cache={}}return !(n&&n.belt)};
const BELT_STUCK='Your other belts need shoes that don’t suit this outfit, so the belt stays.';
/* the planner no longer learns from swaps and picks (removed 2026-11-15, the owner's ask): the votes earlier versions kept in the settings
   (settings.learn) are dropped at start-up, after the first pull, so they stop syncing as dead weight. The removal is stamped like any
   setting change (stampSettings marks it removed), so it wins on the other devices too; a phone still on an older version may add votes
   again, which nothing reads, and the next start here drops them */
async function dropLearn(){if(!settings||!('learn' in settings))return;delete settings.learn;await saveUserSettings()}
/* ---- choosing a piece by hand: a sheet with every item for the slot, best match for the rest of the outfit first ---- */
let picker=null,pastEdit=null;
// (with a suit's jacket taken off, the pants picker offers the suit's own pants first: o.offSuit, takeOff in planner.js)
const slotPool=(slot,o)=>(slot==='bot'&&o.offSuit&&!o.frozen?[o.offSuit]:[]).concat((slot==='coat'?items.filter(i=>i.type==='overcoat'||i.type==='raincoat'):slot==='top'&&o.frozen?items.filter(i=>i.type==='suit'||i.type==='blazer'):items.filter(i=>i.type===SLOT_TYPE(slot,o.suitDay))).filter(i=>o.frozen||inRotation(i,di(sel))));
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
    case 'socks':return sockScore(legs,o.shoes,c,sockEcho(o.shirt,o.tie));
    case 'watch':return watchFit(c,o.shoes,o.belt);
    case 'clip':case 'links':return o.watch&&metalOf(c)!==null?(metalOf(c)===metalOf(o.watch)?6:-4):0;
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
function openPicker(slot){const o=planFor()[key(sel)];if(!o||!canPick(o))return;const pool=slotPool(slot,o),cur=o[slot]&&o[slot].id,label=slotLabel(slot,o).toLowerCase();
  if(!o.frozen&&pool.length<2&&!(slot==='pocket'&&!o.pocket&&pool.length)){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to choose from.`;renderToday();return}   // (no pocket square today: its + chooses one, the only one too)
  const scored=pool.map(i=>[fitOf(slot,o,i),i]).sort((a,b)=>b[0]-a[0]||(a[1].id<b[1].id?-1:1)),best=scored.length?scored[0][0]:0;
  const card=([f,i])=>{const [cls,txt]=fitTag(best-f),on=i.id===cur,sub=slot==='bot'&&i.type==='suit'?'The suit’s own pants':pickSub(i,pool);
    return `<button class="pick-it${on?' cur':''}" onclick="pickItem('${slot}','${jsq(i.id)}')" aria-label="${esc(itemTitle(i)||nm(i))}${sub?', '+esc(sub):''}: ${on?'wearing, ':''}${txt.toLowerCase()}"${on?' aria-current="true"':''}><span class="pick-pic">${pickPic(i)}</span><span class="pick-nm ${titleCls(i)}">${esc(itemTitle(i)||sentence(nm(i)))}</span>${sub?`<small class="mut pick-sub">${esc(sub)}</small>`:''}<small class="fit ${cls}">${on?(o.frozen?'Recorded':'Wearing')+' · ':''}${txt}</small></button>`};
  const none=o.frozen&&slot!=='top'&&cur?`<button type="button" onclick="pickItem('${slot}','')">None: I didn't wear one</button>`:'';
  $('#pick-sheet').innerHTML=`<div class="pick-head"><b id="pick-title">${o.frozen?`What ${label} did you wear?`:`Choose ${pluralWord(label)?label:aAn(label)}`}</b><button class="pick-x" onclick="closePicker()" aria-label="Close">×</button></div>
    <p class="mut"><small>${o.frozen?'Pick what you really wore on '+shortDate(sel)+'.':`${pluralWord(label)?`All the ${label}`:`Every ${label}`} you own, by the score the outfit gets with each, best first.`}</small></p>
    ${!o.frozen||none?`<div class="btns">${o.frozen?none:`<button type="button" id="pick-next" onclick="pickNext()">Suggest another <span aria-hidden="true">↻</span></button>`}</div>`:''}
    <div class="pick-grid">${scored.map(card).join('')}</div>`;
  picker={slot};$('#pick-sheet').classList.add('on');$('#pick-backdrop').classList.add('on');$('#pick-sheet').scrollTop=0;
  if(typeof layerOpen==='function')layerOpen($('#pick-sheet'));if(typeof appPush==='function')appPush('pick')}   // the phone's Back closes it (start.js)
function closePicker(){const was=!!picker;picker=null;const s=$('#pick-sheet'),b=$('#pick-backdrop');if(s)s.classList.remove('on');if(b)b.classList.remove('on');
  if(was&&typeof layerClose==='function')layerClose(s);if(was&&typeof appDrop==='function')appDrop('pick');
  if(typeof syncLaterRun==='function')syncLaterRun('today')}   // a sync's redraw that waited for the picker (sync.js)
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
async function setOccasion(occ,k){k=k||key(sel);const r={...(dayRecs[k]||{date:k})};delete r.force;delete r.off;delete r.skip;delete r.vest;delete r.formal;delete r.occasion;delete r.lock;if(occ==='formal')r.formal=true;else if(occ)r.occasion=occ;if(k===key(sel))swapMsg='';await clearLocks();await saveDay(r);if(settingsOpen()){todayStale=true;renderFormalUI()}else renderToday()}
async function resetDay(){const k=key(sel),r=dayRecs[k];if(!r)return;const n={...r};delete n.off;delete n.force;delete n.skip;delete n.worn;delete n.vest;delete n.lock;notAhead(n,k);swapMsg='';await saveDay(n);renderToday()}
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
  cache={};swapMsg='';if(window.scheduleSync)scheduleSync();return n}
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
  const m=await replanFuture();renderReplanUI(m?`Started over: ${m} day${m===1?'':'s'} with changes planned afresh, and the week unlocked.`:'Started over: the week was unlocked and planned afresh.');todayStale=true}
function renderReplanUI(msg){const el=$('#replan-status');if(!el)return;const n=replanCount();
  el.textContent=msg||((n?`${n} day${n===1?' has':'s have'} your changes (swaps, picks, the vest, pieces taken off).`:'Today and the coming days follow the planner.')+' Plans afresh from today, throwing out the week\'s locks and your changes; occasions, days off and days marked worn stay.')}
async function setVest(v){const k=key(sel),o=planFor()[k];if(!o)return;
  if(o.frozen){const r0=dayRecs[k];if(pastEdit!==k||!r0)return;await saveDay({...r0,vestOn:!!v,worn:true,edited:true});renderToday();return}
 const r={...(dayRecs[k]||{date:k})};r.vest=v;swapMsg='';await saveDay(r);renderToday()}
/* Reset: a card of its own under the month, like the other cards, on a day the user changed (a swap, a pick, the vest); it puts the
   planned outfit back */
function resetCard(o){return o&&!o.frozen&&(o.overrides||o.vestOverride)?`<section class="mbox resetbox" id="rbox"><button class="month-link resetlink" onclick="resetDay()" aria-label="Reset changes" title="Undo your changes to this day"><span class="rsicon" aria-hidden="true">↺</span><b>Reset</b></button></section>`:''}
function dayActions(o){
  const T=todayDate(),d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()),past=d<T,isToday=+d===+T;
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

/* outfit score card with an expandable breakdown */
let scoreOpen=false;
/* the score's advice for a day (planner.js, scoreAdvice): swaps that would raise it, the wardrobe's best with this jacket, and the
   checks nothing owned improves. Worked out once per outfit (kept until the day's pieces change); not for past or worn days */
let adviceMemo={k:'',v:null};
function adviceFor(o){if(!o||o.frozen||!hasOutfit(o))return null;const k=key(sel)+JSON.stringify(idsOf(o))+!!o.vest+items.length;
  if(adviceMemo.k!==k)adviceMemo={k,v:window.TEST_PLAN?TEST_PLAN.advice(o):scoreAdvice(o,slot=>slotPool(slot,o))};return adviceMemo.v}
function applyFix(slot,id){return pickItem(slot,id)}
function scoreCard(o){
  const r=window.TEST_PLAN?TEST_PLAN.rate(o):rateOutfit(o),tone=r.hard.length?'low':r.score>=80?'good':r.score>=65?'ok':'low',A=adviceFor(o);
  const sub=scoreOpen?'tap to fold away':'tap for why',fix=A&&A.fixes.length>0;
  const line=r.hard.length?`${r.hard.length} thing${r.hard.length===1?'':'s'} to put right`:fix&&A.best>r.score?`Could be ${A.best} with what you own`:A&&r.score<100?'The best your wardrobe allows':'Outfit score';
  const fixes=!fix?'':`<div class="sfix" onclick="event.stopPropagation()"><small>${r.hard.length?'These would put it right:':o.overrides?'These would score higher:':`${key(sel)===key(todayDate())?'Today’s':'This day’s'} pieces were chosen for variety. These would score higher:`}</small>${A.fixes.map(f=>`<button type="button" class="sfixbtn" onclick="applyFix('${f.slot}','${f.item.id}')" aria-label="Wear the ${esc(desc(f.item)||nm(f.item))} ${esc(slotLabel(f.slot,o).toLowerCase())}: ${f.gain} more points"><span class="dot">${swatchSVG(f.item,true)}</span><span class="cap sfixnm">${sentence(desc(f.item)||nm(f.item))} <span class="mut">${slotLabel(f.slot,o).toLowerCase()}</span></span><b>+${f.gain}</b></button>`).join('')}</div>`;
  // unfolds like the pieces list and the month plan; each check slides in and its bar fills to the points it scored
  return `<section class="mbox score ${tone}${scoreOpen?' open instant':''}" id="sbox"><button class="month-link" onclick="toggleScore()" aria-expanded="${scoreOpen}" aria-controls="spanel" aria-label="Outfit score ${r.score}, ${r.label}. ${line}. ${scoreOpen?'Fold away':'Show why'}">
    <span class="num" aria-hidden="true">${r.score}</span><span class="lbl" aria-hidden="true"><b>${r.label}</b><small>${line} · ${sub}</small></span><span class="chev" aria-hidden="true">›</span></button>
    <div class="mpanel" id="spanel"><div class="mpanel-in" onclick="toggleScore()">${fixes}<ul>${r.checks.map((c,n)=>`<li class="${c.pts===c.max?'ok':c.hard?'miss hard':'miss'}" style="--i:${n}"><span>${c.pts===c.max?'✓':c.hard?'!':'•'} ${c.label}</span><span class="pts">${c.pts}/${c.max}</span><span class="sbar" aria-hidden="true"><i style="--p:${c.max?Math.max(0,c.pts)/c.max:1}"></i></span>${c.why?`<small>${c.why}${A&&A.stuck.includes(c.label)?' <span class="lim">Nothing you own does better here.</span>':''}</small>`:''}</li>`).join('')}</ul>${r.hard.length?`<p class="scap">A real mistake keeps the score at ${HARD_CAP} or below, however well the rest matches.</p>`:''}</div></div></section>`;
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
  const sm=box.querySelector('.lbl small');if(sm)sm.textContent='Outfit score · '+(scoreOpen?'tap to fold away':'tap for why');
  if(scoreOpen)boxUnfold(box);else{revealRun++;boxFold(box,'#spanel .sfix, #spanel li, #spanel .scap')}}
