// Rotation: pieces paused or out of rotation, and a full rail of shirts coming round.
// Joined by feature from 2 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/rotation-pause.test.js ---- */
// Taking an item out of rotation (Wardrobe item → "Take out of rotation"): it stays in the wardrobe and in the outfits already
// worn, the planner never picks it for upcoming days, the picker and "Suggest another" don't offer it (correcting a past day
// still does), upcoming days it was pinned to are planned again, and "Put back in rotation" brings it back.
const rotationPause=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{HOOK.CK_OPEN['*']=true});
    await p.evaluate(()=>{let k=0;const I=(id,type,primaryColor,x={})=>({id,type,primaryColor,pattern:'solid',added:1,...x});
      HOOK.items=[I('navy','suit','navy'),I('grey','suit','grey'),I('char','suit','charcoal'),I('sh1','shirt','white'),I('sh2','shirt','lightblue'),I('t1','tie','burgundy'),I('t2','tie','navy'),
        I('bs','shoes','black',{leather:'calf'}),I('bb','belt','black',{leather:'calf',metal:'silver'}),I('so','socks','charcoal')];
      HOOK.settings.workdays=[1,2,3,4,5];HOOK.settings.blazerDays=[];HOOK.TODAY_OVERRIDE='2026-11-11T12:00:00';HOOK.cache={};
      // the navy suit was worn last Monday (a frozen past day) and is pinned by a swap to next Monday
      HOOK.dayRecs={'2026-11-9':{date:'2026-11-9',ids:{top:'navy',shirt:'sh1',tie:'t1',shoes:'bs',belt:'bb',socks:'so'},suitDay:true,worn:true},
        '2026-11-16':{date:'2026-11-16',force:{top:'navy'}}};
      HOOK.sel=new Date(2026,10,11);HOOK.view={y:2026,m:10};HOOK.editing=null;HOOK.flt='all';HOOK.show('wardrobe')});
    // (the real planner, buildPlan: planMonth gives tests/fixedplan.js's outfits, which only shows that file filters inRotation; CR-10-05)
    const tops=()=>p.evaluate(()=>{const out=[];for(const [k,o] of Object.entries(HOOK.buildPlan(2026,11)))if(HOOK.keyDate(k)>=HOOK.todayDate()&&o.top)out.push(o.top.id);return out});
    const before=await tops();
    ok(before.includes('navy'),`before: the navy suit is in the upcoming plan (${before.filter(x=>x==='navy').length} days)`);
    // the button in the item's details
    await p.evaluate(()=>HOOK.openItem('navy'));await settle(p,500);
    const b0=await p.evaluate(()=>{const b=document.querySelector('#item-view .rotbtn');return b&&{t:b.textContent,pressed:b.getAttribute('aria-pressed')}});
    ok(b0&&b0.t==='Take out of rotation'&&b0.pressed==='false','the open item has a "Take out of rotation" button beside Close and Delete');
    await p.click('#item-view .rotbtn');await p.waitForFunction(()=>HOOK.items.find(i=>i.id==='navy').paused===true);await settle(p,500);
    const st=await p.evaluate(()=>({btn:document.querySelector('#item-view .rotbtn').textContent,note:(document.querySelector('#item-view .rotnote')||{}).textContent||'',
      still:HOOK.items.some(i=>i.id==='navy'),pin:HOOK.dayRecs['2026-11-16'].force,past:HOOK.dayRecs['2026-11-9'].ids.top}));
    ok(st.still&&st.btn==='Put back in rotation'&&/planner won't pick it/.test(st.note)&&/Outfits you already wore keep it/.test(st.note),'it stays in the wardrobe; the button now says "Put back in rotation" and a note says what it means');
    ok(!st.pin&&st.past==='navy','the upcoming day it was pinned to is let go; the worn day keeps it');
    const after=await tops();
    ok(!after.includes('navy')&&after.length===before.length,`the planner no longer picks it for any upcoming day (${after.length} days still planned with the other suits)`);
    const past=await p.evaluate(()=>{const o=HOOK.planMonth(2026,10)['2026-11-9'];return o&&o.top&&o.top.id});
    ok(past==='navy','the outfit already worn still shows the navy suit');
    // closed: the box says so
    await p.evaluate(()=>HOOK.closeItem());await settle(p,500);
    ok(await p.evaluate(()=>{const g=document.querySelector('#gi-navy');return g.classList.contains('paused')&&/Out of rotation/.test(g.textContent)}),'its box in the grid is dimmed and tagged "Out of rotation"');
    // picker and Suggest another on today leave it out; correcting a past day offers it
    const pick=await p.evaluate(async()=>{HOOK.sel=new Date(2026,10,11);HOOK.show('today');const o=HOOK.planFor()[HOOK.key(HOOK.sel)],today=HOOK.slotPool('top',o).map(i=>i.id);
      const pastO=HOOK.planFor()['2026-11-9'],pastPool=HOOK.slotPool('top',pastO).map(i=>i.id);
      const seen=new Set([o.top.id]);for(let n=0;n<4;n++){await HOOK.swapSlot('top');seen.add(HOOK.planFor()[HOOK.key(HOOK.sel)].top.id)}return {today,pastPool,seen:[...seen]}});
    ok(!pick.today.includes('navy')&&pick.today.length===2,`the picker doesn't offer it for today (${pick.today})`);
    ok(pick.pastPool.includes('navy'),'correcting a past day still offers it (it may have been worn then)');
    ok(!pick.seen.includes('navy'),`"Suggest another" cycles without it (${pick.seen})`);
    // stats explain it
    ok(await p.evaluate(()=>HOOK.whyUnused(HOOK.items.find(i=>i.id==='navy'))==='You took it out of rotation, so the planner leaves it out.'),'the stats page gives the reason it is not planned');
    // put it back
    await p.evaluate(()=>{HOOK.show('wardrobe');HOOK.openItem('navy')});await settle(p,500);await p.click('#item-view .rotbtn');await p.waitForFunction(()=>!('paused' in HOOK.items.find(i=>i.id==='navy'))&&document.querySelector('#item-view .rotbtn').textContent==='Take out of rotation');
    const back=await tops();
    ok(back.includes('navy')&&await p.evaluate(()=>!document.querySelector('#item-view .rotnote')&&document.querySelector('#item-view .rotbtn').textContent==='Take out of rotation'),`"Put back in rotation" brings it back into the plan (${back.filter(x=>x==='navy').length} days)`);
    // the only belt out of rotation: no belt, and no complaint about belts in the score
    const belt=await p.evaluate(()=>{HOOK.items.find(i=>i.id==='bb').paused=true;HOOK.cache={};const o=HOOK.planFor()['2026-11-12'];return {belt:o.belt,checks:HOOK.rateOutfit(o).checks.map(c=>c.label)}});
    ok(belt.belt===null,'with its only belt out of rotation, the outfit has no belt rather than the paused one');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};

/* ---- was tests/rotation.test.js ---- */
// A full rail of shirts rotates: shirts that are less "classic" (periwinkle, beige, lavender, mid grey) still come around,
// because rest counts for more on shirts; outfit quality stays high.
const rotation=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  const r=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+String(k++).padStart(3,'0'),type,primaryColor,pattern:'solid',...x});
    const shirts=[['paleyellow','solid'],['midgrey','fine-texture'],['lightblue','solid'],['white','dobby'],['pink','solid'],['white','woven'],['lavender','solid'],['periwinkle','end-on-end'],['ivory','solid'],['white','textured'],['beige','solid']];
    HOOK.items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','charcoal'),I('suit','grey'),I('suit','navy'),I('blazer','navy'),I('pants','grey'),
      ...shirts.map(([c,pa])=>I('shirt',c,{pattern:pa})),
      I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('tie','green'),I('tie','navy'),I('tie','grey'),I('tie','purple'),I('tie','brown'),
      I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('watch','black',{metal:'silver'}),I('socks','navy'),I('socks','charcoal')];
    HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.blazerDays=[4];HOOK.settings.vestMode='auto';HOOK.dayRecs={};HOOK.weather={};HOOK.TODAY_OVERRIDE='2026-11-08T12:00:00';
    const cnt={};for(const s of HOOK.items.filter(i=>i.type==='shirt'))cnt[s.id]=0;let sum=0,n=0,min=100,maxRun=0;
    for(const m of [10,11]){HOOK.cache={};const P=HOOK.buildPlan(2026,m);for(const [kk,o] of Object.entries(P)){if(HOOK.keyDate(kk)<new Date(2026,10,8)||HOOK.keyDate(kk).getMonth()!==m)continue;
      if(o.shirt)cnt[o.shirt.id]++;const sc=HOOK.rateOutfit(o).score;sum+=sc;n++;min=Math.min(min,sc)}}
    const c=Object.values(cnt);return {min:Math.min(...c),max:Math.max(...c),avg:sum/n,low:min,days:n,
      byName:Object.entries(cnt).map(([id,v])=>HOOK.items.find(i=>i.id===id).primaryColor+'='+v).join(' ')}});
  ok(r.min>=2,`every one of 11 shirts is worn at least twice in ${r.days} workdays (${r.byName})`);
  ok(r.max-r.min<=4,'no shirt hogs the rotation');
  ok(r.avg>=95&&r.low>=90,`outfit quality stays high (average ${r.avg.toFixed(1)}, lowest ${r.low})`);
  ok(errs.length===0,'no page errors');
  await browser.close();
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['rotation-pause',rotationPause],['rotation',rotation]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
