/* Daily Wardrobe: the outfit history: saving a day and recording what each day showed, "Suggest another" and the piece picker,
   correcting a past day, occasions, Reset, the vest, "Start the plan over" and the planning rules' re-plan
   (A classic script sharing one global scope with the others, loaded in index.html's order; split out of app.js on 2026-11-14. Round C,
   2026-11-17: the missed days are in missed.js, the week's locks in locks.js, the picker's scoring in pickscore.js, the score card in
   scorecard.js and the cards' fold motion in boxfold.js, loaded right after this file.) */
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
/* the planner no longer learns from swaps and picks (removed 2026-11-15, the owner's ask): the votes earlier versions kept in the settings
   (settings.learn) are dropped at start-up, after the first pull, so they stop syncing as dead weight. The removal is stamped like any
   setting change (stampSettings marks it removed), so it wins on the other devices too; a phone still on an older version may add votes
   again, which nothing reads, and the next start here drops them */
async function dropLearn(){if(!settings||!('learn' in settings))return;delete settings.learn;await saveUserSettings()}
/* ---- choosing a piece by hand: a sheet with every item for the slot, best match for the rest of the outfit first ---- */
let picker=null,pastEdit=null;
const pluralWord=w=>/^(shoes|pants|socks|cufflinks|jeans|chinos)$/.test(w);   // "Choose shoes", not "Choose a shoes" (W2-17-13)
const pickPic=i=>i.photo?`<img src="${srcOk(phSm(i))}" alt="">`:itemPic(i)?`<img src="${srcOk(itemPic(i).img)}" alt="">`:itemThumb(i,true);
function openPicker(slot){const o=planFor()[key(sel)];if(!o||!canPick(o))return;const pool=slotPool(slot,o),hand=handPool(slot,o),cur=o[slot]&&o[slot].id,label=slotLabel(slot,{...o,shirt:null,top:null}).toLowerCase();   // (the slot's own word, not a casual piece's: "Choose a shirt")
  if(!o.frozen&&pool.length+hand.length<2&&!(slot==='pocket'&&!o.pocket&&pool.length)){swapMsg=`That's your only ${slot==='coat'?'coat':(TYPES[SLOT_TYPE(slot,o.suitDay)]||slot).toLowerCase()}, so there's nothing to choose from.`;renderToday();return}
  const scored=pool.map(i=>[fitOf(slot,o,i),i]).sort((a,b)=>b[0]-a[0]||(a[1].id<b[1].id?-1:1)),best=scored.length?scored[0][0]:0;
  const card=([f,i])=>{const [cls,txt]=fitTag(best-f),on=i.id===cur,sub=slot==='bot'&&i.type==='suit'?'The suit’s own pants':pickSub(i,pool);
    return `<button class="pick-it${on?' cur':''}" onclick="pickItem('${slot}','${jsq(i.id)}')" aria-label="${esc(itemTitle(i)||nm(i))}${sub?', '+esc(sub):''}: ${on?'wearing, ':''}${txt.toLowerCase()}"${on?' aria-current="true"':''}><span class="pick-pic">${pickPic(i)}</span>${typeof favMark==='function'?favMark(i):''}<span class="pick-nm ${titleCls(i)}">${esc(itemTitle(i)||sentence(nm(i)))}</span>${sub?`<small class="mut pick-sub">${esc(sub)}</small>`:''}<small class="fit ${cls}">${on?(o.frozen?'Recorded':'Wearing')+' · ':''}${txt}</small></button>`};
  const none=o.frozen&&slot!=='top'&&cur?`<button type="button" onclick="pickItem('${slot}','')">None: I didn't wear one</button>`:'';
  $('#pick-sheet').innerHTML=`<div class="pick-head"><b id="pick-title">${o.frozen?`What ${label} did you wear?`:`Choose ${pluralWord(label)?label:aAn(label)}`}</b><button class="pick-x" onclick="closePicker()" aria-label="Close">×</button></div>
    ${typeof favStrip==='function'?favStrip(o):''}<p class="mut"><small>${o.frozen?'Pick what you really wore on '+shortDate(sel)+'.':`${pluralWord(label)?`All the ${label}`:`Every ${label}`} you own, by the score the outfit gets with each, best first.`}</small></p>
    ${!o.frozen||none?`<div class="btns">${o.frozen?none:`<button type="button" id="pick-next" onclick="pickNext()">Suggest another <span aria-hidden="true">↻</span></button>`}</div>`:''}
    <div class="pick-grid">${scored.map(card).join('')}</div>${handGroup(slot,o,hand,cur)}${combatAway(slot,o,hand)}`;
  picker={slot};$('#pick-sheet').classList.add('on');$('#pick-backdrop').classList.add('on');$('#pick-sheet').scrollTop=0;
  if(typeof layerOpen==='function')layerOpen($('#pick-sheet'));backPush('pick')}   // the phone's Back closes it (back.js)
/* the picker's "Casual · pick by hand" group (handPool): the casual pieces for the slot, under the usual ones, not scored; a casual top is
   worn instead of the shirt and the tie comes off that day (core.js needsTie, planner.js outfit) */
const HAND_NOTE={shirt:'Worn instead of the shirt: no tie that day.',top:'Worn instead of the jacket.',bot:'Worn instead of the pants.',shoes:'Combat boots, with camouflage pants.'};
/* combat boots owned but not offered (the day's pants are not camouflage): a line says why, so they don't seem lost */
const combatAway=(slot,o,hand)=>slot==='shoes'&&!o.frozen&&!hand.length&&items.some(i=>handPickSlot(i)==='shoes'&&inRotation(i,di(sel)))?'<p class="mut pick-away"><small>Combat boots go with camouflage pants: pick those first.</small></p>':'';
function handGroup(slot,o,hand,cur){if(!hand.length)return '';
  const card=i=>{const on=i.id===cur,sub=isCargo(i)?'Cargo pants':i.type==='shoes'?'Combat boots':TYPES[i.type],why=handWhy(i,o);
    return `<button class="pick-it hand-it${on?' cur':''}${why?' hand-no':''}" onclick="pickItem('${slot}','${jsq(i.id)}')" aria-label="${esc(itemTitle(i)||nm(i))}, ${esc(sub.toLowerCase())}: ${on?'wearing, ':''}${why?esc(why.toLowerCase()):'picked by hand'}"${on?' aria-current="true"':''}><span class="pick-pic">${pickPic(i)}</span><span class="pick-nm ${titleCls(i)}">${esc(itemTitle(i)||sentence(nm(i)))}</span><small class="mut pick-sub">${esc(sub)}</small><small class="fit ${why?'weak':'hand'}">${on?(o.frozen?'Recorded':'Wearing')+' · ':''}${why||'By hand'}</small></button>`};
  return `<div class="pick-hand" role="group" aria-labelledby="pick-hand-h"><b id="pick-hand-h" class="pick-hand-h">Casual · pick by hand</b><p class="mut"><small>${HAND_NOTE[slot]||''} Never planned or suggested.</small></p><div class="pick-grid">${hand.map(card).join('')}</div></div>`}
function closePicker(){const was=!!picker;picker=null;const s=$('#pick-sheet'),b=$('#pick-backdrop');if(s)s.classList.remove('on');if(b)b.classList.remove('on');
  if(was&&typeof layerClose==='function')layerClose(s);if(was)backDrop('pick');
  if(typeof syncLaterRun==='function')syncLaterRun('today')}   // a sync's redraw that waited for the picker (sync.js)
backOn('pick',()=>closePicker());
function pickNext(){const s=picker&&picker.slot;closePicker();if(s)swapSlot(s)}
async function pickItem(slot,id){const k=key(sel),o=planFor()[k];if(!o)return;closePicker();
  const it=id?items.find(i=>i.id===id)||null:null;
  if(o.frozen)return correctPast(slot,it,true);   // (a pick on a day marked worn is what was really worn: it did nothing, silently, outside "Correct what you wore" (2026-11-18, the owner's coyote belt on a worn day))
  if(!it||(o[slot]&&o[slot].id===id))return;
  const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest},follow=FOLLOW[slot]||[],force={};
  for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  force[slot]=id;suitPants(force,slot,o);keepHand(force,slot,o);bootsOff(force,slot,o);keepOff(force,k,slot);const skip={...(rec.skip||{})};delete skip[slot];rec.force=force;rec.skip=skip;delete rec.lock;notAhead(rec,k);pocketOn(rec,slot);
  if(slot==='belt'&&beltless(k,rec)){swapMsg='That belt needs shoes that don’t suit this outfit, so the belt stays as it was.';renderToday();return}
  swapMsg='';await saveDay(rec);await unlockClash(k);renderToday()}
/* wear a favorite look (fav.js, the picker's "Favorite looks" strip) on the day shown: its jacket, shirt and tie become the owner's own
   picks (rec.force, as pickItem's), the pieces that follow them are chosen again, a jacket of the other kind brings its kind (rec.kind),
   and the days after it that hold one of them let go (unlockClash); Undo puts the day's record back */
async function wearFav(k){const dk=key(sel),o=planFor()[dk],l=favLooks().find(x=>favLookKey(x)===k);if(!o||o.frozen||!l)return;closePicker();
  const p=favPieces(l);if(!p.sh)return;
  const was=dayRecs[dk]?{...dayRecs[dk]}:{date:dk},rec={...was,ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest},follow=new Set(['top','shirt','tie',...FOLLOW.top,...FOLLOW.shirt,...FOLLOW.tie]),force={};
  for(const s of SLOTS)if(!follow.has(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  if(p.j){force.top=p.j.id;if(!isHandPick(p.j))rec.kind=p.j.type==='suit'?'suit':'blazer'}force.shirt=p.sh.id;if(p.tie)force.tie=p.tie.id;
  rec.force=force;delete rec.skip;delete rec.lock;delete rec.off;notAhead(rec,dk);
  swapMsg='';await saveDay(rec);await unlockClash(dk);renderToday();
  toast(`Wearing a favorite look ${dayWord()==='today'?'today':'on '+shortDate(sel)}.`,FAV_UNDO_MS,{label:'Undo',fn:async()=>{await saveDay({...was});renderToday()}})}
/* ---- correcting a past day: what was really worn replaces what was planned, so rest and "last worn" stay true ---- */
function togglePastEdit(){const k=key(sel);pastEdit=pastEdit===k?null:k;if(pastEdit)listOpen=true;swapMsg='';renderToday()}
async function correctPast(slot,it,picked){const k=key(sel),r=dayRecs[k],o=planFor()[k];if(!r||!r.ids||!o||(pastEdit!==k&&!picked))return;   // (picked: from the picker, pickItem)
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
async function setOccasion(occ,k){k=k||key(sel);const r={...(dayRecs[k]||{date:k})};delete r.force;delete r.off;delete r.roll;delete r.skip;delete r.vest;delete r.formal;delete r.occasion;delete r.lock;if(occ==='formal')r.formal=true;else if(occ)r.occasion=occ;if(k===key(sel))swapMsg='';await clearLocks();await saveDay(r);if(settingsOpen()){todayDirty();renderFormalUI()}else renderToday()}
async function resetDay(){const k=key(sel),r=dayRecs[k];if(!r)return;const n={...r};delete n.off;delete n.roll;delete n.force;delete n.skip;delete n.worn;delete n.vest;delete n.lock;delete n.kind;notAhead(n,k);swapMsg='';await saveDay(n);renderToday()}   // (kind too: a piece taken off or a moved outfit pinned the suit or blazer, CR-4-07)
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
/* index.html's (act.js): the piece picker's backdrop, and Settings' "Start the plan over" */
function pickBackdropTap(){closePicker()}
function replanTap(){replanButton()}
acts({pickBackdropTap,replanTap});
