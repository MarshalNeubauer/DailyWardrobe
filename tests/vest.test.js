// Three-piece suits: suits have a matching 5-button vest. The planner wears it per the setting (default: suit days that
// aren't hot, and formal days), never on blazer days; a day can override it. With a vest there is no tie clip.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url);await p.waitForFunction(()=>window.appReady);
  await p.evaluate(()=>{localStorage.removeItem('fig_mode');let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
    items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','charcoal'),I('suit','grey',{vest:'no'}),I('blazer','navy'),I('pants','grey'),I('shirt','white'),I('shirt','lightblue'),
      I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tieclip','silver',{metal:'silver'}),I('watch','black',{metal:'silver'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
    settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.vestMode='auto';weather={};dayRecs={};TODAY_OVERRIDE='2026-11-15T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};show('today')});
  const plan=await p.evaluate(()=>{const P=buildPlan(2026,10);return Object.entries(P).filter(([k])=>keyDate(k)>=new Date(2026,10,15)).map(([k,o])=>({k,suit:o.suitDay,vestOk:hasVest(o.top),vest:o.vest,clip:!!o.clip}))});
  ok(plan.filter(d=>d.suit&&d.vestOk).every(d=>d.vest),'November (not hot): every suit day with a vest-suit wears the vest');
  ok(plan.filter(d=>d.vest).every(d=>!d.clip),'no tie clip on a vest day');
  ok(plan.filter(d=>!d.suit).every(d=>!d.vest&&d.clip),'blazer days: no vest, tie clip as usual');
  ok(plan.filter(d=>d.suit&&!d.vestOk).every(d=>!d.vest&&d.clip),'a suit marked "No vest" never gets one, and keeps the clip');
  // hot weather: no vest unless formal
  const hot=await p.evaluate(()=>{const ks=[];for(let d=16;d<=20;d++)ks.push(key(new Date(2026,10,d)));weather=Object.fromEntries(ks.map(k=>[k,{tmax:31,tmin:24,pop:0,rain:0,code:0}]));cache={};
    const P=buildPlan(2026,10);const a=ks.map(k=>P[k]).filter(o=>o&&o.suitDay&&hasVest(o.top));
    dayRecs['2026-11-17']={date:'2026-11-17',formal:true};cache={};const f=buildPlan(2026,10)['2026-11-17'];delete dayRecs['2026-11-17'];
    const r={none:a.every(o=>!o.vest),formalVest:f.vest||!hasVest(f.top)};weather={};cache={};return r});
  ok(hot.none,'on a hot day the vest is left off');
  ok(hot.formalVest,'a formal day wears the vest even when hot');
  // settings: always / never
  const modes=await p.evaluate(()=>{const r={};for(const m of ['always','never']){settings.vestMode=m;cache={};const P=buildPlan(2026,10);r[m]=Object.values(P).filter(o=>o.suitDay&&hasVest(o.top)&&!o.frozen).map(o=>o.vest)}settings.vestMode='auto';cache={};return r});
  ok(modes.always.every(Boolean)&&modes.never.every(v=>!v),'the vest setting (every suit day / never) is followed');
  // Today: list row, figure, per-day toggle
  await p.evaluate(()=>{const P=planFor();const k=Object.keys(P).find(k=>keyDate(k)>=new Date(2026,10,16)&&P[k].suitDay&&P[k].vest);sel=keyDate(k);renderToday()});
  const t=await p.evaluate(()=>({row:document.querySelector('.vest-row').textContent,clipRow:[...document.querySelectorAll('#today .list .row')].find(r=>r.querySelector('.mut').textContent==='Tie clip').textContent,
    fig:!!document.querySelector('.fig .fig-vest'),figClip:!!document.querySelector('.fig .fig-clip'),hot:!!document.querySelector('.hot[aria-label^="Vest"]'),label:document.querySelector('.fig svg').getAttribute('aria-label')}));
  ok(/Matching vest/.test(t.row)&&/Not with the vest/.test(t.clipRow),'the list shows the vest, and the tie clip row says "Not with the vest"');
  ok(t.fig&&!t.figClip&&t.hot&&/with matching vest/.test(t.label),'the figure draws the vest (no clip) with a Vest tap target');
  await p.click('.vest-row .swap');await p.waitForFunction(()=>planFor()[key(sel)].vest===false&&/Not today/.test(document.querySelector('.vest-row').textContent),null,{timeout:5000}).catch(()=>{});
  const off=await p.evaluate(()=>{const o=planFor()[key(sel)];return {vest:o.vest,clip:!!o.clip,row:document.querySelector('.vest-row').textContent,fig:!!document.querySelector('.fig .fig-vest'),reset:[...document.querySelectorAll('.dayact button')].some(b=>b.textContent==='Reset changes')}});
  ok(!off.vest&&off.clip&&/Not today/.test(off.row)&&!off.fig,'leaving the vest off for the day brings the tie clip back');
  ok(off.reset,'the day shows Reset changes');
  await p.click('.vest-row .swap');await p.waitForFunction(()=>planFor()[key(sel)].vest===true,null,{timeout:5000}).catch(()=>{});
  ok(await p.evaluate(()=>planFor()[key(sel)].vest),'and it can be put back on');
  // full mannequin draws it too
  await p.click('.figmode >> text=Full outfit');
  ok(await p.evaluate(()=>!!document.querySelector('#mannequin-container .vest-layer')&&document.querySelectorAll('#mannequin-container .vest-layer circle').length===5),'Full outfit: the mannequin wears the 5-button vest');
  await p.click('.figmode >> text=Close-up');
  // suits: vest option in the editor; new suits default to having one
  ok(await p.evaluate(()=>{editing='suit0';show('wardrobe');const sel=[...document.querySelectorAll('#wardrobe select')].find(s=>[...s.options].some(o=>o.textContent==='Matching vest'));editing=null;return !!sel&&sel.value==='yes'}),'a suit\'s editor has a Vest option (Matching vest / No vest)');
  // past days keep what was worn
  const fz=await p.evaluate(()=>{const o=frozenOutfit({date:'2026-11-10',ids:{top:'suit0',shirt:'shirt5',tie:'tie7'},suitDay:true,vestOn:true},0,{});return o.vest});
  ok(fz,'a past day remembers that the vest was worn');
  // render prompt mentions it
  ok(await p.evaluate(()=>{const o=planFor()[key(sel)];return /waistcoat \(vest\)/.test(outfitText(o))&&figSig(o).startsWith('vest|')}),'the realistic photo prompt includes the vest');
  ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  await browser.close();
};
