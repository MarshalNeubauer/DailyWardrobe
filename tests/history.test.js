// Outfit history: past days are frozen, single pieces can be swapped, and the worn log drives rotation.
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const ids=o=>JSON.stringify(SLOTS_IDS(o));
  await p.evaluate(`(()=>{const W=${WARDROBES};HOOK.items=W.realistic;HOOK.dayRecs={};HOOK.TODAY_OVERRIDE='2026-11-15T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,15);HOOK.view={y:2026,m:10};HOOK.show('today')})()`);
  await p.waitForFunction(()=>Object.keys(HOOK.dayRecs).length>=10,null,{timeout:5000}).catch(()=>{});await settle(p,300);
  const snap=k=>p.evaluate(k=>{const o=HOOK.planFor()[k];return o?Object.fromEntries(HOOK.SLOTS.map(s=>[s,o[s]?o[s].id:null])):null},k);
  const recs=await p.evaluate(()=>Object.keys(HOOK.dayRecs).length);
  ok(recs>=10,`viewing the app records past days (${recs} saved)`);

  // adding clearly better items must not rewrite the past
  const past=await snap('2026-11-10'),fut=()=>p.evaluate(()=>{const P=HOOK.planFor();return JSON.stringify(Object.keys(P).filter(k=>HOOK.keyDate(k)>HOOK.todayDate()).map(k=>HOOK.SLOTS.map(s=>P[k][s]&&P[k][s].id)))}),futureBefore=await fut();
  await p.evaluate(()=>{for(let i=0;i<6;i++)HOOK.items.push({id:'zz-new-tie-'+i,type:'tie',primaryColor:['burgundy','navy','green','gold','purple','grey'][i],pattern:'solid',added:Date.now()},{id:'zz-new-shirt-'+i,type:'shirt',primaryColor:i%2?'white':'lightblue',pattern:'solid',added:Date.now()});HOOK.cache={}});
  ok(JSON.stringify(await snap('2026-11-10'))===JSON.stringify(past),'past days stay exactly as they were after the wardrobe changes');
  ok(await fut()!==futureBefore&&(await fut()).includes('zz-new'),'future days do pick up new items');

  // swap one piece on a future day
  await p.evaluate(()=>{HOOK.sel=new Date(2026,10,18);HOOK.view={y:2026,m:10};HOOK.renderToday()});
  const before=await snap('2026-11-18');
  await p.evaluate(()=>{HOOK.listOpen=true;HOOK.renderToday()});
  await p.click('.row button[aria-label="Change tie"]');await p.click('#pick-next');await settle(p,150);
  const afterTie=await snap('2026-11-18');
  ok(afterTie.tie!==before.tie,'↻ on the tie gives a different tie');
  ok(['top','bot','shirt','shoes','belt','socks','watch'].every(s=>afterTie[s]===before[s]),'everything else stays the same');
  await p.click('.row button[aria-label="Change shirt"]');await p.click('#pick-next');await settle(p,150);
  const afterShirt=await snap('2026-11-18');
  ok(afterShirt.shirt!==afterTie.shirt&&afterShirt.tie===afterTie.tie,'swapping the shirt keeps the swapped tie');
  await p.click('.row button[aria-label="Change shoes"]');await p.click('#pick-next');await settle(p,150);
  const afterShoes=await p.evaluate(()=>{const o=HOOK.planFor()['2026-11-18'];return {shoes:o.shoes.id,belt:o.belt&&o.belt.id,fit:o.belt?HOOK.beltFit(o.shoes,o.belt):null}});
  ok(afterShoes.shoes!==afterShirt.shoes&&afterShoes.fit!==null,'swapping shoes re-picks a matching belt');
  // cycling through every tie never errors and eventually returns
  const seen=new Set();for(let i=0;i<25;i++){await p.click('.row button[aria-label="Change tie"]');await p.click('#pick-next');seen.add((await snap('2026-11-18')).tie)}
  const nTies=await p.evaluate(()=>HOOK.items.filter(i=>i.type==='tie').length);
  ok(seen.size>=Math.min(nTies,12),`repeated swaps cycle through the ties (${seen.size} of ${nTies} seen)`);
  await p.click('[aria-label="Reset changes"]');await p.waitForFunction(()=>!HOOK.planFor()['2026-11-18'].overrides,null,{timeout:5000}).catch(()=>{});
  ok(!(await p.evaluate(()=>HOOK.planFor()['2026-11-18'].overrides)),'Reset changes clears the swaps');
  // only one of a type: no swap, a message instead
  const msg=await p.evaluate(async()=>{const keep=HOOK.items;HOOK.items=HOOK.items.filter(i=>i.type!=='watch'||i.id===HOOK.items.find(x=>x.type==='watch').id);HOOK.cache={};await HOOK.swapSlot('watch');const t=document.querySelector('#today').textContent;HOOK.items=keep;HOOK.cache={};return t});
  ok(msg.includes('only watch'),'swapping your only watch explains there is nothing to swap');

  // worn log: "didn't wear" frees the suit for rotation sooner
  const rot=await p.evaluate(async()=>{const k='2026-11-12',suit=HOOK.dayRecs[k].ids.top;
    const restOn=d=>{HOOK.cache={};const o=HOOK.buildPlan(2026,10)[d];return o.top&&o.top.id===suit?o.top.rest:null};
    const nextUse=()=>{HOOK.cache={};const p=HOOK.buildPlan(2026,10);return Object.keys(p).filter(d=>HOOK.keyDate(d)>HOOK.keyDate(k)&&p[d].top&&p[d].top.id===suit).sort((a,b)=>HOOK.keyDate(a)-HOOK.keyDate(b))[0]};
    const a=nextUse();HOOK.sel=new Date(2026,10,12);await HOOK.setWorn(false);const b=nextUse();return {a,b,flag:HOOK.dayRecs[k].worn}});
  ok(rot.flag===false,'"Didn\'t wear" is recorded');
  ok(!rot.a||!rot.b||rot.b<=rot.a||new Date(rot.b)<=new Date(rot.a),'a suit marked not worn comes back into rotation no later than before');
  // marking today as worn freezes it
  await p.evaluate(async()=>{HOOK.sel=new Date(2026,10,15);HOOK.renderToday();await HOOK.setWorn(true)});
  const todayIds=await snap('2026-11-15');
  await p.evaluate(()=>{HOOK.items.push({id:'zz-amazing',type:'suit',primaryColor:'navy',pattern:'solid',added:Date.now()});HOOK.cache={}});
  ok(JSON.stringify(await snap('2026-11-15'))===JSON.stringify(todayIds),'"Wore this" locks today even if the wardrobe changes');
  // persistence: records survive a reload
  const nRecs=await p.evaluate(()=>Object.keys(HOOK.dayRecs).length);
  await p.reload();await p.waitForFunction(()=>window.appReady);
  ok(await p.evaluate(n=>Object.keys(HOOK.dayRecs).length===n&&HOOK.dayRecs['2026-11-15']&&HOOK.dayRecs['2026-11-15'].worn===true,nRecs),'history survives a reload');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
function SLOTS_IDS(o){return o}
