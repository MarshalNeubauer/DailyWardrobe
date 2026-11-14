/* Daily Wardrobe: the outfit history: past days, the coming week's locks, learning from changes, choosing a piece by hand, correcting a past day,
   occasions and the score card
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14.) */
/* ---- outfit history: freeze past days, swap pieces, record what was worn ---- */
const idsOf=o=>Object.fromEntries(SLOTS.map(s=>[s,o[s]?o[s].id:null]));
const keyDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
let swapMsg='';
async function saveDay(rec,quiet,auto){rec.updated=Date.now();if(!auto){delete rec.lockOnly;delete rec.base}dayRecs[rec.date]=rec;await txs('days','readwrite',s=>s.put(rec));cache={};if(!quiet&&window.scheduleSync)scheduleSync();if(typeof remindSoon==='function')remindSoon()}
/* start-up writers wait for the first pull (sync.js afterPull; sync.js loads after this file, so through afterScripts) */
let todayPullWait=false;
const whenPulled=f=>afterScripts(()=>typeof afterPull==='function'?afterPull(f):f());
/* remember what each day showed: past days become fixed, and today's record follows the screen until the day ends */
async function recordDays(p){
  const T=todayDate(),tk=key(T),mine=dayRecs;let changed=false;
  for(const [k,o] of Object.entries(p)){
    if(dayRecs!==mine)break;   // the history was replaced meanwhile (sync, restore): this plan is stale, record nothing more
    if(!SLOTS.some(s=>o[s])||o.frozen)continue;const d=keyDate(k);
    // a past day with no pieces recorded: none at all, or only the week's lock (lockUpcoming), as on a day the app was not opened;
    // recorded with what the record already has, else it never became history (no wear counts, an outfit that could still change)
    if(d<T&&!(dayRecs[k]&&dayRecs[k].ids)){await saveDay({...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest,auto:true},true);changed=true}
    else if(k===tk){const r=dayRecs[k],ids=idsOf(o);if(!r||JSON.stringify(r.ids)!==JSON.stringify(ids)||!!r.vestOn!==!!o.vest){await saveDay({...(r||{date:k}),ids,suitDay:o.suitDay,vestOn:!!o.vest},true);changed=true}}
  }
  if(changed&&window.scheduleSync)scheduleSync();
}
/* ---- the coming week stays as shown ----
   Each workday from today to LOCK_DAYS-1 days on gets rec.lock, the pieces the plan showed for it (not the coat: that follows the
   forecast). The planner keeps a locked day's pieces (planner.js, outfit()), so swapping today's tie, marking a day not worn or
   adding an item re-plans only the days after the lock, not tomorrow's outfit. A change made by hand on a day (a swap, a pick, an
   occasion, Reset, a move) drops that day's lock: the day is planned again around the change and locked as it then shows. */
const LOCK_DAYS=7,lockIds=o=>{const l=idsOf(o);delete l.coat;return l};
async function lockUpcoming(){
  if(!items.length)return;const T=todayDate(),mine=dayRecs;let n=0;
  for(let g=0;g<LOCK_DAYS;g++){const d=new Date(T.getFullYear(),T.getMonth(),T.getDate()+g);if(!isWorkday(d))continue;
    if(dayRecs!==mine)break;   // the history was replaced meanwhile (sync, restore)
    // the plan is read afresh for each day (it is cached; a change made while an earlier lock was being saved has reset it), and the lock
    // is put on the record before the write is awaited, so a lock never comes from a plan that is no longer the one on screen
    const k=key(d),o=planMonth(d.getFullYear(),d.getMonth())[k];if(!o||o.frozen||!SLOTS.some(s=>o[s]))continue;
    const r=dayRecs[k],l=lockIds(o);if(r&&r.lock&&JSON.stringify(r.lock)===JSON.stringify(l))continue;
    const rec={...(r||{date:k}),lock:l,updated:Date.now(),lockOnly:1,base:(r&&(r.lockOnly?r.base:r.updated))||0};dayRecs[k]=rec;n++;   // the cached plan stays valid: the lock is what it shows
    await txs('days','readwrite',s=>s.put(rec))}
  if(n&&window.scheduleSync)scheduleSync()}
/* let the planner choose the days after today again (a setting that changes the plan, Re-plan, new planning rules) */
async function clearLocks(){const T=todayDate();let n=0;
  for(const r of Object.values(dayRecs))if(r.lock&&keyDate(r.date)>T&&r.worn!==true){const c={...r,lockOnly:1,base:r.lockOnly?r.base||0:r.updated||0};delete c.lock;await saveDay(c,true,true);n++}   // (lockOnly: core.js dayWins)
  if(n&&window.scheduleSync)scheduleSync();return n}
async function swapSlot(slot){
  const k=key(sel),o=planFor()[k];if(!o||o.frozen)return;
  const cur=o[slot]&&o[slot].id,pool=items.filter(i=>(slot==='coat'?i.type==='overcoat'||i.type==='raincoat':i.type===SLOT_TYPE(slot,o.suitDay))&&inRotation(i,di(sel)));
  if(pool.length<2){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to swap.`;renderToday();return}
  const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest};
  const skip={...(rec.skip||{})};skip[slot]=[...new Set([...(skip[slot]||[]),cur].filter(Boolean))];
  if(pool.every(i=>skip[slot].includes(i.id)))skip[slot]=[cur];       // tried them all: start the cycle again
  // keep the rest of the outfit; pieces that must follow the swapped one are re-picked
  const follow=FOLLOW[slot]||[];
  const force={};for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  keepOff(force,k,slot);rec.skip=skip;rec.force=force;delete rec.lock;
  if(slot==='belt'&&o.belt&&beltless(k,rec)){swapMsg=BELT_STUCK;renderToday();return}
  swapMsg=learnFrom(slot,o,o[slot],null,false);await saveDay(rec);renderToday();
}
/* a piece taken off (rec.off) stays pinned through a swap or a pick of another piece, so putting it back brings the same one */
const keepOff=(force,k,slot)=>{const r=dayRecs[k];if(!r||!r.off||!r.force)return;for(const s of ['top','tie','clip'])if(s!==slot&&r.off[s==='clip'?'tie':s]&&r.force[s])force[s]=r.force[s]};
const FOLLOW={top:['bot','shirt','tie','shoes','belt','socks','watch','clip'],shoes:['belt','socks'],belt:['shoes','socks']};   // (a belt swap brings shoes that match it, as a shoe swap brings a belt: the owner's ask, 2026-11-14)
/* would this record leave the day with no belt? (planned with the record in memory only, nothing saved): a belt swap or pick whose
   only matching shoes don't suit the outfit (a black suit wants black shoes, and only the black belt matches them) changes nothing */
const beltless=(k,rec)=>{const prev=dayRecs[k];dayRecs[k]=rec;cache={};let n=null;try{n=planFor()[k]}finally{if(prev)dayRecs[k]=prev;else delete dayRecs[k];cache={}}return !(n&&n.belt)};
const BELT_STUCK='Your other belts need shoes that don’t suit this outfit, so the belt stays.';
/* ---- learning from changes (the votes are read by the planner, see planner.js) ----
   A piece swapped away votes against its pairing with the pieces that stayed (a shirt with the jacket and the tie, a tie
   with the jacket and the shirt, trousers or shoes with the jacket); a piece chosen by hand votes for its pairings. Pieces
   with no partner (a jacket, a belt, socks) get a vote of their own. Kept in the settings, so it syncs. */
const LEARN_PARTNERS={shirt:['top','tie'],tie:['top','shirt'],bot:['top'],shoes:['top']};
function learnVote(kind,k,d){const L=settings.learn={p:{...(settings.learn&&settings.learn.p)},i:{...(settings.learn&&settings.learn.i)}},m=L[kind];
  const v=Math.max(-LEARN_CAP,Math.min(LEARN_CAP,(m[k]||0)+d));if(v)m[k]=v;else delete m[k]}
function learnFrom(slot,o,oldIt,newIt,picked){
  const partners=(LEARN_PARTNERS[slot]||[]).map(s=>o[s]).filter(p=>p&&(!oldIt||p.id!==oldIt.id)&&(!newIt||p.id!==newIt.id));let down=false,up=false;
  if(oldIt&&(!newIt||oldIt.id!==newIt.id)){if(partners.length){for(const p of partners)learnVote('p',pairKey(oldIt,p),-1);down=true}else if(!picked){learnVote('i',oldIt.id,-1);down=true}}
  if(picked&&newIt){if(partners.length)for(const p of partners)learnVote('p',pairKey(newIt,p),1);else learnVote('i',newIt.id,1);up=true}
  if(!down&&!up)return '';
  stampSettings(settings);metaPut('settings',settings);cache={};
  return up?'Noted: the planner will reach for this choice more often.':'Noted: the planner will suggest that pairing less often.'}
/* ---- choosing a piece by hand: a sheet with every item for the slot, best match for the rest of the outfit first ---- */
let picker=null,pastEdit=null;
const slotPool=(slot,o)=>(slot==='coat'?items.filter(i=>i.type==='overcoat'||i.type==='raincoat'):slot==='top'&&o.frozen?items.filter(i=>i.type==='suit'||i.type==='blazer'):items.filter(i=>i.type===SLOT_TYPE(slot,o.suitDay))).filter(i=>o.frozen||inRotation(i,di(sel)));
/* how well a candidate suits the rest of the day's outfit (higher is better), by the planner's own rules */
function fitOf(slot,o,c){
  const day={formal:!!o.formal,clim:o.clim||dayClimate(sel),hasLinks:items.some(i=>i.type==='cufflinks')},suit=slot==='top'?c.type==='suit':o.suitDay,top=slot==='top'?c:o.top,bot=suit?top:slot==='bot'?c:o.bot,legs=suit?top:bot;
  switch(slot){
    case 'top':case 'bot':case 'shirt':case 'tie':return clothesScore(top,bot,slot==='shirt'?c:o.shirt,slot==='tie'?c:o.tie,suit,day)+(slot==='top'?seasonFit(c,day.clim.season)*2+(day.formal?formalTop(c)*2:0):0);
    case 'shoes':return legs?shoeScore(top,legs,c)+shoeFormality(c,suit):0;
    case 'belt':{const f=o.shoes?beltFit(o.shoes,c):0;return f===null?-60:f}
    case 'socks':return sockScore(legs,o.shoes,c,sockEcho(o.shirt,o.tie));
    case 'watch':return watchFit(c,o.shoes,o.belt);
    case 'clip':case 'links':return o.watch&&metalOf(c)!==null?(metalOf(c)===metalOf(o.watch)?6:-4):0}
  return 0}
const fitTag=gap=>gap<=.5?['best','Best match']:gap<=QWIN?['good','Good match']:gap<=18?['ok','Works']:['weak','Weak match'];
const pickPic=i=>i.photo?`<img src="${phSm(i)}" alt="">`:itemPic(i)?`<img src="${itemPic(i).img}" alt="">`:itemThumb(i,true);
function openPicker(slot){const o=planFor()[key(sel)];if(!o||!canPick(o))return;const pool=slotPool(slot,o),cur=o[slot]&&o[slot].id,label=slotLabel(slot,o).toLowerCase();
  if(!o.frozen&&pool.length<2){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to choose from.`;renderToday();return}
  const scored=pool.map(i=>[fitOf(slot,o,i),i]).sort((a,b)=>b[0]-a[0]||(a[1].id<b[1].id?-1:1)),best=scored.length?scored[0][0]:0;
  const card=([f,i])=>{const [cls,txt]=fitTag(best-f),on=i.id===cur;
    return `<button class="pick-it${on?' cur':''}" onclick="pickItem('${slot}','${i.id}')" aria-label="${esc(itemTitle(i)||nm(i))}: ${on?'wearing, ':''}${txt.toLowerCase()}"${on?' aria-current="true"':''}><span class="pick-pic">${pickPic(i)}</span><span class="pick-nm ${titleCls(i)}">${esc(itemTitle(i)||sentence(nm(i)))}</span><small class="fit ${cls}">${on?(o.frozen?'Recorded':'Wearing')+' · ':''}${txt}</small></button>`};
  const none=o.frozen&&slot!=='top'&&cur?`<button type="button" onclick="pickItem('${slot}','')">None: I didn't wear one</button>`:'';
  $('#pick-sheet').innerHTML=`<div class="pick-head"><b id="pick-title">${o.frozen?`What ${label} did you wear?`:`Choose ${aAn(label)}`}</b><button class="pick-x" onclick="closePicker()" aria-label="Close">×</button></div>
    <p class="mut"><small>${o.frozen?'Pick what you really wore on '+shortDate(sel)+'.':`Every ${label} you own, the best match for the rest of the outfit first.`}</small></p>
    ${!o.frozen||none?`<div class="btns">${o.frozen?none:`<button type="button" id="pick-next" onclick="pickNext()">Suggest another ↻</button>`}</div>`:''}
    <div class="pick-grid">${scored.map(card).join('')}</div>`;
  picker={slot};$('#pick-sheet').classList.add('on');$('#pick-backdrop').classList.add('on');$('#pick-sheet').scrollTop=0;
  if(typeof layerOpen==='function')layerOpen($('#pick-sheet'))}
function closePicker(){const was=!!picker;picker=null;const s=$('#pick-sheet'),b=$('#pick-backdrop');if(s)s.classList.remove('on');if(b)b.classList.remove('on');
  if(was&&typeof layerClose==='function')layerClose(s);
  if(typeof syncLaterRun==='function')syncLaterRun('today')}   // a sync's redraw that waited for the picker (sync.js)
function pickNext(){const s=picker&&picker.slot;closePicker();if(s)swapSlot(s)}
async function pickItem(slot,id){const k=key(sel),o=planFor()[k];if(!o)return;closePicker();
  const it=id?items.find(i=>i.id===id)||null:null;
  if(o.frozen)return correctPast(slot,it);
  if(!it||(o[slot]&&o[slot].id===id))return;
  const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest},follow=FOLLOW[slot]||[],force={};
  for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  force[slot]=id;keepOff(force,k,slot);const skip={...(rec.skip||{})};delete skip[slot];rec.force=force;rec.skip=skip;delete rec.lock;
  if(slot==='belt'&&beltless(k,rec)){swapMsg='That belt needs shoes that don’t suit this outfit, so the belt stays as it was.';renderToday();return}
  swapMsg=learnFrom(slot,o,o[slot],it,true);await saveDay(rec);renderToday()}
/* ---- correcting a past day: what was really worn replaces what was planned, so rest and "last worn" stay true ---- */
function togglePastEdit(){const k=key(sel);pastEdit=pastEdit===k?null:k;if(pastEdit)listOpen=true;swapMsg='';renderToday()}
async function correctPast(slot,it){const k=key(sel),r=dayRecs[k],o=planFor()[k];if(!r||!r.ids||!o||pastEdit!==k)return;
  const ids={...r.ids};let suitDay=!!r.suitDay;
  if(slot==='top'){if(!it)return;ids.top=it.id;if(it.type==='suit'){suitDay=true;ids.bot=it.id}else{if(suitDay||ids.bot===r.ids.top)ids.bot=null;suitDay=false}}
  else ids[slot]=it?it.id:null;
  const rec={...r,ids,suitDay,worn:true,edited:true};delete rec.auto;
  if(!suitDay||!hasVest(items.find(i=>i.id===ids.top)))rec.vestOn=false;
  swapMsg=it?learnFrom(slot,slot==='top'?{...o,top:null}:o,null,it,true)&&'Corrected. The planner counts what you really wore.':'Corrected.';
  await saveDay(rec);renderToday()}
const setFormal=(v,k)=>setOccasion(v?'formal':null,k);
/* give a day an occasion (or none): its swaps are dropped, since the outfit is chosen afresh for the occasion, and the coming days are
   released so they are planned around it (the suit that is right for the occasion may be locked on the day before) */
async function setOccasion(occ,k){k=k||key(sel);const r={...(dayRecs[k]||{date:k})};delete r.force;delete r.off;delete r.skip;delete r.vest;delete r.formal;delete r.occasion;delete r.lock;if(occ==='formal')r.formal=true;else if(occ)r.occasion=occ;if(k===key(sel))swapMsg='';await clearLocks();await saveDay(r);if(settingsOpen()){todayStale=true;renderFormalUI()}else renderToday()}
async function resetDay(){const k=key(sel),r=dayRecs[k];if(!r)return;const n={...r};delete n.off;delete n.force;delete n.skip;delete n.worn;delete n.vest;delete n.lock;swapMsg='';await saveDay(n);renderToday()}
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
    if(rules){if(!r.lock&&!r.auto)continue;const keep={...r};delete keep.lock;if(keep.auto){delete keep.auto;delete keep.ids;delete keep.suitDay;delete keep.vestOn}await saveDay(keep,true);n++;continue}
    const mine=dayChanged(r,+d===+T);if(!mine&&!r.lock&&!(+d===+T&&r.ids))continue;
    const keep={date:r.date};if(r.formal)keep.formal=true;if(r.occasion)keep.occasion=r.occasion;await saveDay(keep,true);if(mine)n++}
  cache={};swapMsg='';if(window.scheduleSync)scheduleSync();return n}
/* the planning rules changed since this wardrobe was last planned: re-plan the future once */
async function checkPlanRules(){if(!window.TEST_PLAN)return planRulesCheck()}   // (PLAN_RULES is read in planRulesCheck only: a bump selects only the tests that plan for real)
async function planRulesCheck(){if((settings.planRules||0)>=PLAN_RULES)return;const n=await replanFuture(true);
  settings.planRules=PLAN_RULES;await metaPut('settings',settings);   // kept without a new stamp: noting the rules is not a change to the settings, and a stamp made defaults win over the backup's settings
  if(n)setTimeout(()=>toast('The planner was updated: upcoming days were planned again. Your own picks were kept.',4500),400)}
const replanCount=()=>{const T=todayDate();return Object.values(dayRecs).filter(r=>{const d=keyDate(r.date);return d>=T&&r.worn!==true&&dayChanged(r,+d===+T)}).length};
async function replanButton(){const T=todayDate(),n=replanCount();
  const locked=Object.values(dayRecs).some(r=>r.lock&&keyDate(r.date)>=T&&r.worn!==true);
  if(!n&&!locked){renderReplanUI('Nothing to start over: today and every coming day already follow the planner.');return}
  if(!await askConfirm(`Start the plan over?\n\nToday and every coming day are planned afresh: the week's locks and ${n?`your changes on ${n} day${n===1?'':'s'} (swaps, picks, the vest, pieces taken off)`:'any changes'} are thrown out. Occasions, days off, days marked worn and the past stay as they are.`,{ok:'Start over'}))return;
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
  if(past&&o.frozen)h+=`<button class="pastedit${pastEdit===key(sel)?' on':''}" onclick="togglePastEdit()" aria-pressed="${pastEdit===key(sel)}">${pastEdit===key(sel)?'Done':'Correct this day'}</button>`;
  return (h?`<div class="dayact">${h}</div>`:'')+(past&&o.frozen&&pastEdit===key(sel)?'<p class="mut"><small>Tap ⇄ beside a piece to set what you really wore. The planner then counts that, not what was planned.</small></p>':past&&o.frozen&&o.worn!==true?'<p class="mut"><small>Past day: kept as it was planned.</small></p>':'')+(swapMsg?`<p class="mut"><small>${swapMsg}</small></p>`:'');
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
  const fixes=!fix?'':`<div class="sfix" onclick="event.stopPropagation()"><small>${r.hard.length?'These would put it right:':'Today\'s pieces were chosen for variety. These would score higher:'}</small>${A.fixes.map(f=>`<button type="button" class="sfixbtn" onclick="applyFix('${f.slot}','${f.item.id}')" aria-label="Wear the ${esc(desc(f.item)||nm(f.item))} ${esc(slotLabel(f.slot,o).toLowerCase())}: ${f.gain} more points"><span class="dot">${swatchSVG(f.item,true)}</span><span class="cap sfixnm">${sentence(desc(f.item)||nm(f.item))} <span class="mut">${slotLabel(f.slot,o).toLowerCase()}</span></span><b>+${f.gain}</b></button>`).join('')}</div>`;
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
