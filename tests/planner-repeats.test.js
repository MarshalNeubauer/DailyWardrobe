// Repeats over weeks and months, with the real planner: the same tie, planning ahead, the six-month audit, the shared simulation.
// Joined by feature from 4 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/tiegap.test.js ---- */
// The same tie is not planned again within three workdays (the owner's choice, 2026-11-13: one tie on Dec 6 and Dec 8 cost only 4, two
// workdays back); the score names a repeat three workdays back. Tie colours keep their own two-day rule.
const tiegap=async({ok,chromium,url,WARDROBES})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};
      // (each key once: planMonth gives the shared simulation's whole plan, so a later month holds the earlier months' days too, and
      // without the check the sequence ran Nov 30, then Nov 11 again, and compared those)
      const seq=[],seen=new Set();for(const [y,m] of [[2026,10],[2026,11],[2027,0]]){const P=planMonth(y,m);for(const k of Object.keys(P).sort((a,b)=>keyDate(a)-keyDate(b)))if(!seen.has(k)&&keyDate(k)>=todayDate()&&P[k].tie){seen.add(k);seq.push({k,o:P[k]})}}
      const near=[];for(let a=0;a<seq.length;a++)for(let g=1;g<=3&&a+g<seq.length;g++)if(seq[a].o.tie.id===seq[a+g].o.tie.id)near.push(seq[a].k+'+'+g);
      const ties=new Set(seq.map(x=>x.o.tie.id)).size;
      // the score: a tie worn three workdays back
      const o=seq[5].o,s=rateOutfit({...o,ctx:{...o.ctx,prev:[o.ctx.prev[0],o.ctx.prev[1]],prev3:{tid:o.tie.id}}}).checks.find(c=>c.label==='Variety');
      // the case that repeated on the owner's wardrobe: a day's own best tie worn two or three workdays before it (fixed there by hand)
      const wd=seq.map(x=>x.k),pin=[];for(const [i,g] of [[12,2],[20,2],[28,3],[36,3]]){dayRecs={};cache={};const b0=planMonth(2026,11);const a=wd[i],b=wd[i-g],x=(b0[a]||planMonth(2027,0)[a]).tie.id;
        dayRecs[b]={date:b,force:{tie:x}};cache={};const pl={...planMonth(2026,10),...planMonth(2026,11),...planMonth(2027,0)};pin.push({a,g,kept:pl[b].tie.id===x,again:pl[a].tie.id===x})}
      // few ties (four: just enough for three workdays apart): the rule has to hold the strongest match back
      const keep=W.realistic.filter(i=>i.type==='tie').slice(0,4).map(i=>i.id);items=W.realistic.filter(i=>i.type!=='tie'||keep.includes(i.id));dayRecs={};cache={};
      const s4=[];for(const [y,m] of [[2026,10],[2026,11]]){const P=planMonth(y,m);for(const k of Object.keys(P).sort((a,b)=>keyDate(a)-keyDate(b)))if(keyDate(k)>=todayDate()&&P[k].tie)s4.push(P[k].tie.id)}
      let few=0;for(let a=0;a<s4.length;a++)for(let g=1;g<=3&&a+g<s4.length;g++)if(s4[a]===s4[a+g])few++;
      items=W.realistic;dayRecs={};cache={};
      return {days:seq.length,near,ties,pin,few,fewDays:s4.length,owned:items.filter(i=>i.type==='tie').length,why:s&&s.why,pts:s&&s.pts}})()`);
    ok(r.days>40&&r.near.length===0,`over ${r.days} workdays no tie comes back within three workdays (${r.near.join(', ')||'none'})`);
    for(const x of r.pin)ok(x.kept&&!x.again,`a day's best tie, worn ${x.g} workdays before it, is not planned again on ${x.a}`);
    // (16 before the rule; a few stay: not every tie suits every jacket, and a hard mismatch costs more than a repeat)
    ok(r.few<=4&&r.fewDays>30,`with only four ties a tie comes back within three workdays at most a few times (${r.few} in ${r.fewDays} days; 16 before)`);
    ok(r.ties>=r.owned-2,`the ties still rotate (${r.ties} of ${r.owned} worn)`);
    ok(/three workdays ago/.test(r.why||'')&&r.pts<5,`the score names a tie worn three workdays back (${r.why})`);
    // two suits, two shirts, two ties (the code review, CR-3-03): each jacket's memory of its last tie (comboRepeat) outweighed TIE_NEXT
    // and the plan settled into A A B B, yesterday's tie again on 41 of 103 workdays
    const two=await p.evaluate(()=>{let k=0;const I=(type,c,x={})=>({id:type+(k++),type,primaryColor:c,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','green'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'})];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[];TODAY_OVERRIDE='2026-11-09T12:00:00';dayRecs={};weather={};cache={};
      const P=planSim(planStart(2026,10)).upTo(new Date(2027,2,31)),ks=Object.keys(P).filter(k=>keyDate(k)>=new Date(2026,10,9)).sort((a,b)=>keyDate(a)-keyDate(b));
      let rep=0;for(let i=1;i<ks.length;i++)if(P[ks[i]].tie.id===P[ks[i-1]].tie.id)rep++;return {rep,days:ks.length}});
    ok(two.days>90&&two.rep===0,`with two suits and two ties yesterday's tie never comes back the next workday (${two.rep} of ${two.days}; 41 before)`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
// (realPlanner) it checks what the planner chooses, not the fixed test plan

/* ---- was tests/planahead.test.js ---- */
// The day before a workday whose tie and shirt are fixed (an outfit moved there, pieces picked, a day shown and locked) avoids that tie
// and shirt like it avoids the workday before's (fixedAhead's nx). Found 2026-11-13: an outfit moved from Nov 23 to Nov 24, and
// Nov 23, planned afresh, took the same black tie and check shirt, since repeats were only checked against the days before.
const planahead=async({ok,chromium,url,WARDROBES})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    // as a drag in the month does: the outfit pinned on the next workday (moveRecs), the day it left planned afresh (planWith)
    const r=await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};
      const base=planMonth(2026,10),out=[];
      for(const [a,b] of [['2026-11-16','2026-11-17'],['2026-11-23','2026-11-24'],['2026-11-24','2026-11-25']]){const pl=planWith(HOOK.moveRecs(a,b,base),2026,10),prev=pl[a],fixed=pl[b];
        out.push({a,held:fixed.tie.id===base[a].tie.id,tie:prev.tie.id===fixed.tie.id,tieGroup:tieGroup(prev.tie)===tieGroup(fixed.tie),shirt:prev.shirt.id===fixed.shirt.id,
          was:base[a].tie.id+'/'+base[a].shirt.id,now:prev.tie.id+'/'+prev.shirt.id})}
      // the case that repeated on the owner's wardrobe: the next day fixed to exactly the tie and shirt this day would choose (its best
      // match), so only the forward check keeps it off them
      const pin=[];for(const [a,b] of [['2026-11-17','2026-11-18'],['2026-11-24','2026-11-25'],['2026-11-10','2026-11-11']]){dayRecs={};cache={};const b0=planMonth(2026,10),x=b0[a].tie.id,y=b0[a].shirt.id;
        dayRecs[b]={date:b,force:{tie:x,shirt:y}};cache={};const pl=planMonth(2026,10);pin.push({a,keep:pl[b].tie.id===x&&pl[b].shirt.id===y,tie:pl[a].tie.id===x,shirt:pl[a].shirt.id===y,was:x+'/'+y,now:pl[a].tie.id+'/'+pl[a].shirt.id})}
      dayRecs={};cache={};
      return {out,pin}})()`);
    for(const x of r.out)ok(x.held&&!x.tie&&!x.tieGroup&&!x.shirt,`moved ${x.a} onto the next day: that day keeps the tie, the day it left plans another tie (not even its colour) and another shirt (${x.was} -> ${x.now})`);
    for(const x of r.pin)ok(x.keep&&!x.tie&&!x.shirt,`the next day fixed to ${x.a}'s own best tie and shirt: ${x.a} plans others (${x.was} -> ${x.now})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
// (realPlanner) it checks what the planner chooses (planMonth), not the fixed test plan

/* ---- was tests/planaudit.test.js ---- */
// The planner audit's fixes (2026-11-14):
// - the tie and shirt fixed on each of the next 3 workdays are avoided (fixedAhead's fx): a tie pinned two or three workdays ahead
//   was planned the day before anyway (20 of 20), a shirt pinned two days ahead with laundry 3 too (12 of 12)
// - ties' rest creeps (capped, TIE_CREEP_MAX): on a 40-tie wardrobe 9 ties were never planned in a year; no tie comes back within 3 workdays
// - a formal day takes the white shirt (FORMAL_SHIRT_K, FORMAL_QWIN): 3 of 20 took light blue
// - a day marked "Not worn" is not the previous workday for repeats; a past day whose piece was deleted is rated without it, not "Incomplete"
// - the what-to-buy signature follows the settings the planner reads
const planaudit=async({ok,chromium,url,WARDROBES})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(`(()=>{const W=${WARDROBES};const kd=k=>keyDate(k);
      const base=()=>{settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.daysOff=[];settings.holidays=null;delete settings.laundryDays;delete settings.darkShirts;delete settings.dress;weather={};climate=null;TODAY_OVERRIDE='2026-11-13T12:00:00';dayRecs={};cache={}};
      const plan=()=>{cache={};return {...planMonth(2026,10),...planMonth(2026,11),...planMonth(2027,0)}};
      const out={};
      // 1. a tie pinned 2 or 3 workdays ahead, a shirt pinned 2 days ahead with laundry 3
      items=W.realistic.map(i=>({...i}));base();let P0=plan();const ks=Object.keys(P0).filter(k=>kd(k)>=todayDate()).sort((a,b)=>kd(a)-kd(b));
      out.tie2=0;out.tie3=0;out.shirt2=0;out.nShirt=0;
      for(let i=2;i<12;i++)for(const g of [2,3]){const a=ks[i],b=ks[i+g],x=P0[a].tie.id;dayRecs={[b]:{date:b,force:{tie:x}}};const Q=plan();if(Q[a].tie.id===x)out['tie'+g]++}
      dayRecs={};settings.laundryDays=3;P0=plan();
      for(let i=2;i<12;i++){const a=ks[i],b=ks[i+2];if(di(kd(b))-di(kd(a))>3)continue;const x=P0[a].shirt.id;dayRecs={[b]:{date:b,force:{shirt:x}}};const Q=plan();out.nShirt++;if(Q[a].shirt.id===x)out.shirt2++}
      // 2. and 3. a big wardrobe: every tie comes round in a year, never within 3 workdays; formal days in white
      let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff},pick=a=>a[Math.floor(rnd()*a.length)];let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',...x});
      const huge=[];
      for(let n=0;n<16;n++)huge.push(I('suit',pick(['navy','charcoal','grey','lightgrey','darkgrey','navy','brown','blue','midgrey','darknavy']),{pattern:pick(['solid','solid','herringbone','pinstripe','birdseye','glen-check','sharkskin']),secondaryColor:'white',vest:n%4?'no':'yes',season:n%7===0?'warm':n%9===0?'cold':'all'}));
      for(let n=0;n<8;n++)huge.push(I('blazer',pick(['navy','tan','brown','olive','grey','burgundy','green']),{pattern:pick(['solid','tweed','herringbone','windowpane','glen-check']),secondaryColor:'lightblue'}));
      for(let n=0;n<12;n++)huge.push(I('pants',pick(['grey','charcoal','tan','cream','navy','olive','brown','lightgrey']),{trouserKind:n%6===0?'chinos':n===11?'jeans':'dress'}));
      for(let n=0;n<40;n++)huge.push(I('shirt',pick(['white','white','lightblue','lightblue','pink','lavender','ivory','paleyellow','mint','blue','navy','charcoal','periwinkle']),{pattern:pick(['solid','solid','oxford','stripe','gingham','fine-stripe','twill']),secondaryColor:pick(['white','blue','navy']),cuff:n%8===0?'french':'button'}));
      for(let n=0;n<40;n++)huge.push(I('tie',pick(['navy','burgundy','green','gold','purple','red','grey','black','pink','silver','brown','blue','lightblue','olive']),{pattern:pick(['solid','woven','stripe','paisley','polka-dot','knit','check','foulard']),secondaryColor:pick(['white','navy','gold','burgundy'])}));
      for(const [c,l,st] of [['black','calf'],['black','cordovan'],['brown','calf'],['brown','suede'],['tan','calf'],['oxblood','cordovan'],['brown','calf','loafer'],['white','canvas','sneaker']])huge.push(I('shoes',c,{leather:l,shoeStyle:st}));
      for(const [c,l,m] of [['black','calf','silver'],['brown','calf','silver'],['brown','suede','gold'],['tan','calf','silver'],['burgundy','calf','silver'],['black','calf','gold']])huge.push(I('belt',c,{leather:l,metal:m}));
      for(const [c,m,b] of [['grey','silver','bracelet'],['brown','gold','leather'],['black','silver','leather'],['grey','other','integrated']])huge.push(I('watch',c,{metal:m,band:b}));
      for(const c of ['navy','charcoal','brown','grey','burgundy','tan','black','olive'])huge.push(I('socks',c));
      huge.push(I('cufflinks','silver',{metal:'silver'}),I('cufflinks','gold',{metal:'gold'}),I('tieclip','silver'),I('tieclip','gold'),I('overcoat','charcoal'),I('overcoat','tan'),I('raincoat','tan'));
      items=huge;base();const t0=performance.now();const Y=planSim(planStart(2026,10)).upTo(new Date(2027,10,0));out.ms=Math.round(performance.now()-t0);
      const used={};let prev=[];out.rep=0;let sum=0,n=0;
      for(const [k,o] of Object.entries(Y).filter(([k])=>kd(k)>=todayDate()).sort((a,b)=>kd(a[0])-kd(b[0]))){if(!o.tie)continue;used[o.tie.id]=1;if(prev.includes(o.tie.id))out.rep++;prev=[o.tie.id,...prev].slice(0,3);sum+=rateOutfit(o).score;n++}
      out.unusedTies=huge.filter(i=>i.type==='tie'&&!used[i.id]).length;out.avg=sum/n;
      const P1=planMonth(2026,11),fk=Object.keys(P1).filter(k=>kd(k)>=todayDate()).sort((a,b)=>kd(a)-kd(b)).slice(0,20);out.notWhite=0;
      for(const k of fk){dayRecs={[k]:{date:k,formal:true}};cache={};const o=planMonth(2026,11)[k];if(planCol(o.shirt)!=='white')out.notWhite++}
      // 4. "Not worn" past day; a deleted piece on a past day
      items=W.realistic.map(i=>({...i}));base();TODAY_OVERRIDE='2026-11-20T12:00:00';
      const tie=items.find(i=>i.type==='tie'),ids={top:items.find(i=>i.type==='suit').id,shirt:items.find(i=>i.type==='shirt').id,tie:tie.id,shoes:items.find(i=>i.type==='shoes').id};
      dayRecs={'2026-11-16':{date:'2026-11-16',ids,suitDay:true,worn:false},'2026-11-17':{date:'2026-11-17',ids:{...ids,tie:'gone-tie'},suitDay:true,worn:true}};cache={};
      const N=planMonth(2026,10);out.notWornPrev=N['2026-11-17'].ctx.prev.some(p=>p&&p.n===di(new Date(2026,10,16)));
      const R=rateOutfit(N['2026-11-17']);out.goneLabel=R.label;out.goneHard=R.hard.join();
      // 5. the what-to-buy signature
      const s0=HOOK.shopSig();settings.laundryDays=3;const s1=HOOK.shopSig();settings.darkShirts='often';const s2=HOOK.shopSig();
      dayRecs['2026-12-1']={date:'2026-12-1',occasion:'wedding'};const s4=HOOK.shopSig();settings.daysOff=[{d:'2026-12-3',n:'x'}];const s5=HOOK.shopSig();settings.dress={jeans:true};const s6=HOOK.shopSig();
      out.sigs=new Set([s0,s1,s2,s4,s5,s6]).size;
      base();return out})()`);
    ok(r.tie2===0&&r.tie3===0,`a tie fixed two or three workdays ahead is not planned the day before (${r.tie2} and ${r.tie3} of 10; before 20 of 20 each)`);
    ok(r.nShirt>0&&r.shirt2===0,`with laundry 3, a shirt fixed two days ahead is kept for that day (${r.shirt2} of ${r.nShirt}; before 12 of 12)`);
    ok(r.unusedTies===0&&r.rep===0,`on a 40-tie wardrobe every tie comes round in a year (${r.unusedTies} never planned; before 9) and none within three workdays (${r.rep}), ${r.ms} ms`);
    ok(r.avg>=99.4,`its average score stays (${r.avg.toFixed(2)}; before 99.57, about 99.50 since fix round 3 rotates the shoes: not yesterday's pair, formality with a suit)`);
    ok(r.notWhite===0,`formal days take a white shirt (${r.notWhite} of 20 did not; before 3)`);
    ok(!r.notWornPrev,'a day marked "Not worn" is not the previous workday for repeats');
    ok(r.goneLabel!=='Incomplete'&&!r.goneHard,`a past day whose tie was deleted since is rated without it (${r.goneLabel}${r.goneHard?', hard: '+r.goneHard:''})`);
    ok(r.sigs===6,`What to buy checks again after laundry days, dark shirts, an occasion, a day off or jeans change (${r.sigs} of 6 signatures differ)`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
// (realPlanner) it checks what the planner chooses

/* ---- was tests/reviewfixes.test.js ---- */
// Fixes from the code review: adding or deleting an item re-plans; a blazer day without blazers still gets a jacket;
// the month's outfit count a year ahead; a new day while the app stayed open; one shared simulation for every month
// (same outfits as planning each month on its own, each day planned once); "Last worn" ignores days from before a piece
// was in the wardrobe; the what-to-buy analysis is sent without pictures.
const reviewfixes=async({ok,chromium,url,settle:settleFor})=>{
  const browser=await chromium.launch();const p=await (await browser.newContext({viewport:{width:390,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const settle=()=>settleFor(p,350);
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{window.confirm=()=>true;let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      window.base=()=>[I('suit','navy'),I('suit','charcoal'),I('suit','brown'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','navy')];
      items=base();settings.workdays=[0,1,2,3,4];settings.blazerDays=[];dayRecs={};weather={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
    await settle();await p.evaluate(()=>renderToday());await settle();
    // deleting the tie planned for today: Today must plan again without it
    const del=await p.evaluate(async()=>{const id=planFor()[key(sel)].tie.id;await HOOK.rm(id);await new Promise(r=>setTimeout(r,300));show('today');const o=planFor()[key(sel)];
      return {gone:!items.some(i=>i.id===id),planned:o.tie&&o.tie.id!==id,shown:!Object.values(planFor()).some(x=>x.tie&&x.tie.id===id&&!x.frozen)}});
    ok(del.gone&&del.planned&&del.shown,'after deleting an item, Today plans again without it');
    // adding an item: the plan is built again, and the new piece gets worn
    await settle();
    const add=await p.evaluate(async()=>{const before=planFor();queue=[{id:'newtie',type:'tie',primaryColor:'gold',pattern:'solid',manual:true}];await save(0);await new Promise(r=>setTimeout(r,300));show('today');
      return {rebuilt:planFor()!==before,worn:Object.values(planMonth(2026,11)).some(o=>o.tie&&o.tie.id==='newtie')}});
    ok(add.rebuilt&&add.worn,'after adding an item, the plan is built again and uses it');
    // a blazer day with no blazer in the wardrobe gets a suit (and a suit day with only blazers a blazer), not a bare shirt
    const jk=await p.evaluate(()=>{settings.blazerDays=[4];cache={};const th=buildPlan(2026,10)['2026-11-12'];
      const keep=items;items=[...items.filter(i=>i.type!=='suit'),I('blazer','navy'),I('pants','grey')];settings.blazerDays=[];const mo=buildPlan(2026,10)['2026-11-16'];items=keep;cache={};
      return {th:th.top&&th.top.type,thSuit:th.suitDay,mo:mo.top&&mo.top.type,moPants:!!mo.bot&&mo.bot.type==='pants'}});
    ok(jk.th==='suit'&&jk.thSuit===true,`a blazer day with no blazers gets a suit (${jk.th})`);
    ok(jk.mo==='blazer'&&jk.moPants,`a suit day with only blazers gets a blazer and trousers (${jk.mo})`);
    // the box on Today counts this month's outfits only, also a year ahead (the plan then holds two Novembers)
    const cnt=await p.evaluate(()=>{settings.blazerDays=[];cache={};sel=new Date(2027,10,15);view={y:2027,m:10};renderToday();return +document.querySelector('#mbox .mltxt small').textContent.match(/(\d+) outfit/)[1]});
    ok(cnt>=20&&cnt<=23,`the month box counts one month's outfits, a year ahead too (${cnt})`);
    // one shared simulation: the same outfits as planning each month on its own, and each day planned once. The days dressed are
    // counted where outfit() reads the day's waistcoat setting (planner.js: settings.vestMode, once a call, read nowhere else in
    // planning): planner.js is an ES module (2026-11-24), so its own calls of outfit() no longer go through a wrapped window.outfit,
    // which this counted until then (on main the two counts were the same: C:\code\c2-core-lab\simcount.ps1)
    const sim=await p.evaluate(()=>{cache={};const s0=settings;let calls=0;
      settings=Object.defineProperty({...s0},'vestMode',{get(){calls++;return s0.vestMode},set(v){s0.vestMode=v},enumerable:true,configurable:true});
      const months=[[2026,10],[2026,11],[2027,0],[2027,1],[2027,2]],diff=[];
      for(const [y,m] of months)planMonth(y,m);const shared=calls;calls=0;
      for(const [y,m] of months){const a=planMonth(y,m),b=buildPlan(y,m);for(const k of Object.keys(b)){const d=keyDate(k);if(d.getMonth()!==m||d.getFullYear()!==y)continue;if(JSON.stringify(idsOf(a[k]))!==JSON.stringify(idsOf(b[k])))diff.push(k)}}
      const separate=calls;settings=s0;
      // a month from before the shared start is still planned on its own, the same as buildPlan
      const old=planMonth(2026,5),oldB=buildPlan(2026,5),oldDiff=Object.keys(oldB).filter(k=>JSON.stringify(idsOf(old[k]))!==JSON.stringify(idsOf(oldB[k]))).length;
      const future=Object.keys(planMonth(2027,2)).filter(k=>keyDate(k)>=todayDate()).length;
      return {diff,shared,separate,future,oldDiff,oldN:Object.keys(oldB).length}});
    ok(sim.diff.length===0,`months planned from the shared simulation match months planned on their own (${sim.diff.slice(0,4).join(' ')})`);
    ok(sim.shared<=sim.future+2&&sim.separate>sim.shared*2,`stepping through five months plans each day once (${sim.shared} outfits for ${sim.future} days; ${sim.separate} when every month starts over)`);
    ok(sim.oldDiff===0&&sim.oldN>0,'a month from before the shared start is still planned correctly');
    // a new day while the app stayed open: it moves on to today; a day the user was browsing is left alone
    const day=await p.evaluate(()=>{cache={};TODAY_OVERRIDE='2026-11-10T12:00:00';sel=new Date(2026,10,10);view={y:2026,m:10};renderToday();
      TODAY_OVERRIDE='2026-11-11T08:00:00';document.dispatchEvent(new Event('visibilitychange'));const a=key(sel);
      sel=new Date(2026,10,17);renderToday();TODAY_OVERRIDE='2026-11-12T08:00:00';document.dispatchEvent(new Event('visibilitychange'));const b=key(sel);
      // Thursday evening on Today, opened again on Friday (a day off): the next workday
      sel=new Date(2026,10,12);renderToday();TODAY_OVERRIDE='2026-11-13T08:00:00';document.dispatchEvent(new Event('visibilitychange'));const c=key(sel);
      return {a,b,c,head:document.querySelector('#today h2').textContent}});
    ok(day.a==='2026-11-11',`left open overnight, the app moves on to the new day (${day.a})`);
    ok(day.b==='2026-11-17','a day the user was looking at is not taken away');
    ok(day.c==='2026-11-15'&&/Sunday/.test(day.head),`when the new day is a day off, it shows the next workday (${day.c})`);
    // "Last worn": a record dated before a piece was added is the planner's warm-up, not something worn
    const lw=await p.evaluate(()=>{TODAY_OVERRIDE='2026-11-16T12:00:00';cache={};sel=new Date(2026,10,16);view={y:2026,m:10};const o=planFor()[key(sel)];
      const rec=d=>({date:d,ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest,worn:true});dayRecs={'2026-9-3':rec('2026-9-3')};cache={};
      items.forEach(i=>i.added=1);const real=lastWorn(o);items.forEach(i=>i.added=+new Date(2026,10,7));const warm=lastWorn(o);items.forEach(i=>i.added=1);dayRecs={};cache={};
      return {real:real&&key(real),warm}});
    ok(lw.real==='2026-9-3'&&lw.warm===null,`"Last worn" ignores days from before the pieces were in the wardrobe (${lw.real}, ${lw.warm})`);
    // the what-to-buy analysis gets the tags, not the pictures
    const pay=await p.evaluate(()=>{items[0].photo='data:image/jpeg;base64,AAAA';items[0].swatch='data:image/png;base64,BBBB';let sent=null;const W=window.Worker;
      window.Worker=function(){this.postMessage=d=>{sent=d};this.terminate=()=>{}};HOOK.analyzeWardrobe();window.Worker=W;HOOK.shopBusy=null;
      return {n:sent.list.length,pics:sent.list.some(i=>i.photo||i.swatch),kept:!!items[0].photo,tags:sent.list.every(i=>i.type&&i.primaryColor)}});
    ok(pay.n>0&&!pay.pics&&pay.kept&&pay.tags,'the what-to-buy analysis is sent the tags only, no pictures');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
// (realPlanner) runs the real planner (it checks the shared simulation); other tests get tests/fixedplan.js

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['tiegap',tiegap],['planahead',planahead],['planaudit',planaudit],['reviewfixes',reviewfixes]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
module.exports.realPlanner=true;   // runs the real planner (every part checks the planner's choices); other tests get tests/fixedplan.js
