/* Daily Wardrobe: what a swap or a pick keeps and follows (keepOff, FOLLOW, beltless), and how the piece picker ranks each candidate
   (slotPool, handPool, pickScores, fitOf, fitRule, fitTag, pickSub) and Suggest another stays clean (suggestClean)
   (A classic script sharing one global scope with the others; split out of history.js, Round C 2026-11-17, and loaded after it.) */
/* a piece taken off (rec.off) stays pinned through a swap or a pick of another piece, so putting it back brings the same one */
const keepOff=(force,k,slot)=>{const r=dayRecs[k];if(!r||!r.off||!r.force)return;for(const s of ['top','tie','clip','pocket'])if(s!==slot&&r.off[s==='clip'?'tie':s]&&r.force[s])force[s]=r.force[s]};
// (the pocket square follows the jacket, the tie and the shirt it is chosen against: 2026-11-16)
const FOLLOW={top:['bot','shirt','tie','shoes','belt','socks','watch','clip','pocket'],shoes:['belt','socks'],belt:['shoes','socks'],tie:['pocket'],shirt:['pocket']};   // (a belt swap brings shoes that match it, as a shoe swap brings a belt: the owner's ask, 2026-11-14)
/* would this record leave the day with no belt? (planned with the record in memory only, nothing saved): a belt swap or pick whose
   only matching shoes don't suit the outfit (a black suit wants black shoes, and only the black belt matches them) changes nothing */
const beltless=(k,rec)=>{const prev=dayRecs[k];dayRecs[k]=rec;planDirty();let n=null;try{n=planFor()[k]}finally{if(prev)dayRecs[k]=prev;else delete dayRecs[k];planDirty()}return !(n&&n.belt)};
const BELT_STUCK='Your other belts need shoes that don’t suit this outfit, so the belt stays.';
// (with a suit's jacket taken off, the pants picker offers the suit's own pants first: o.offSuit, takeOff in planner.js)
const slotPool=(slot,o)=>(slot==='bot'&&o.offSuit&&!o.frozen?[o.offSuit]:[]).concat((slot==='coat'?items.filter(i=>i.type==='overcoat'||i.type==='raincoat'):slot==='top'&&o.frozen?items.filter(i=>i.type==='suit'||i.type==='blazer'):items.filter(i=>i.type===SLOT_TYPE(slot,o.suitDay))).filter(i=>!isHandPick(i)&&(o.frozen||inRotation(i,di(sel)))));
/* the pieces worn only when picked by hand (core.js isHandPick) for this slot: the picker's "Casual · pick by hand" group, never scored,
   swapped in by Suggest another or planned (2026-11-16, the owner's new casual garments) */
// (combat boots, 2026-11-17: offered only while the day's pants are camouflage, core.js camoPants; a pair already worn stays listed)
const handPool=(slot,o)=>items.filter(i=>handPickSlot(i)===slot&&(o.frozen||inRotation(i,di(sel)))&&(slot!=='shoes'||camoPants(o.bot)||(o.shoes&&o.shoes.id===i.id))).sort((a,b)=>handOk(b,o)-handOk(a,o)||(TYPES[a.type]||'').localeCompare(TYPES[b.type]||'')||(a.id<b.id?-1:1));
/* the uniform blouse goes only with camouflage pants (2026-11-17, the owner; core.js camoPants): with other pants it is listed last, with
   the reason (handWhy) */
const handOk=(i,o)=>i.type!=='blouse'||camoPants(o.suitDay?null:o.bot)?1:0;
const handWhy=(i,o)=>handOk(i,o)?'':'Goes with camouflage pants';
/* the picker ranks and labels each piece by the score the outfit would get with it (W2-17-03, fix round 3: "Best match" lowered the score
   93 → 81, leaving out the belt, variety and rest): a coming day is planned with the pick held in memory only (the record pickItem would
   save, planSim's peek: the pieces that follow it, like the belt after the shoes, are chosen again), a past day being corrected has the
   piece put in. Worked out once per day, slot and plan (pickMemo; the plan cache is cleared by any change). The tests' fixed plan
   (TEST_PLAN) keeps the rule-of-thumb fit (fitRule) */
let pickMemo={c:null,key:'',v:null};
const pickRec=(k,o,slot,id)=>{const rec={...(dayRecs[k]||{date:k}),ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest},follow=FOLLOW[slot]||[],force={};
  for(const s of SLOTS)if(s!==slot&&!follow.includes(s)&&o[s]&&!(s==='bot'&&o.suitDay))force[s]=o[s].id;
  force[slot]=id;suitPants(force,slot,o);keepHand(force,slot,o);bootsOff(force,slot,o);keepOff(force,k,slot);const skip={...(rec.skip||{})};delete skip[slot];rec.force=force;rec.skip=skip;delete rec.lock;notAhead(rec,k);pocketOn(rec,slot);return rec};
/* a pocket square chosen puts the square back on (a − on it before: rec.off.pocket) */
const pocketOn=(rec,slot)=>{if(slot!=='pocket'||!rec.off||!rec.off.pocket)return;rec.off={...rec.off};delete rec.off.pocket;if(!rec.off.top&&!rec.off.tie)delete rec.off};
// other pants than camouflage, or a jacket, chosen while combat boots are worn: the boots come off (the planner picks the shoes again)
/* the pieces that follow a swap (FOLLOW) are chosen again, except hand-picked ones (isHandPick: combat boots, a uniform's pieces): the
   planner never chooses those itself, so freeing them swapped them out (2026-11-18: a belt picked on a camo day took the boots off for black
   calf shoes, which suit neither the camo pants nor the canvas belt, and the belt was refused); bootsOff runs after and still takes the boots
   off when the pants or jacket change to ones that aren't camouflage */
const keepHand=(force,slot,o)=>{for(const s of FOLLOW[slot]||[])if(o[s]&&!(s in force)&&typeof isHandPick==='function'&&isHandPick(o[s]))force[s]=o[s].id};
const bootsOff=(force,slot,o)=>{if((slot==='bot'||slot==='top')&&o.shoes&&shoeStyle(o.shoes)==='combat'&&!camoPants(slot==='bot'?items.find(i=>i.id===force.bot):o.bot))delete force.shoes};
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
