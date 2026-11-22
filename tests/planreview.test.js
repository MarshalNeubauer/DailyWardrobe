// The code review's planner findings (2026-11-16, fix round A; C:\code\cr-2026-11-16\findings\reviewer3.md), each checked the way it
// showed: a kept trip keeps its lock against rain and against a pick on another day (CR-3-01, CR-3-05, through the Packing list's
// "Keep these outfits" and Today's picker), suede in the rain says why (CR-3-02), a jacket-off day is the day before for repeats
// (CR-3-04), the planner's speed when nothing is clean (CR-3-06), taking the jacket off keeps the shoe note (CR-3-07), a hand-written
// verdict table for shoes against the jacket (CR-3-08) and casual tops (CR-3-09), a suit worn without its jacket in the cleaning frame
// (CR-3-10), a corrected past day in the wear counts (CR-3-11), and "Pack lighter" on days without a jacket (CR-3-12).
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kuwait'})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);await p.evaluate(()=>{CK_OPEN['*']=true});
    // the reviewer's rain wardrobe: Thursdays are blazer days, where the brown suede loafers are planned
    const RAIN=`(()=>{let k=0;const I=(type,c,x={})=>({id:type+(k++),type,primaryColor:c,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('blazer','navy'),I('blazer','tan'),I('pants','grey'),I('pants','charcoal'),
        I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','white'),I('tie','burgundy'),I('tie','green'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','purple'),
        I('shoes','brown',{leather:'suede',shoeStyle:'loafer'}),I('shoes','brown',{leather:'calf'}),I('shoes','black',{leather:'calf'}),
        I('belt','brown',{leather:'suede',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('belt','black',{leather:'calf',metal:'silver'})];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];settings.holidays=null;settings.daysOff=[];TODAY_OVERRIDE='2026-11-09T08:00:00';dayRecs={};weather={};climate=null;cache={}})()`;

    // ---- CR-3-01: a kept trip and rain against its suede shoes: the lock stays and the day says so; an ordinary lock still lets go
    const rain=await p.evaluate(`(()=>{${RAIN};const ids=o=>['top','bot','shirt','tie','shoes'].map(s=>o[s]&&o[s].id).join();
      let P=buildPlan(2026,10);const D=['2026-11-12','2026-11-19','2026-11-26'].find(d=>P[d].shoes&&P[d].shoes.leather==='suede');if(!D)return {none:true};
      const o=P[D],lock={};for(const s of SLOTS)if(o[s]&&!(s==='bot'&&o.suitDay)&&s!=='coat')lock[s]=o[s].id;
      lock.shirt=items.find(i=>i.type==='shirt'&&i.id!==o.shirt.id&&i.primaryColor==='white').id;lock.tie=items.find(i=>i.type==='tie'&&i.id!==o.tie.id&&i.primaryColor==='burgundy').id;
      dayRecs[D]={date:D,lock,lockAt:Date.now(),updated:1,trip:1};weather[D]={tmax:18,pop:80};cache={};const wet=buildPlan(2026,10)[D];
      // the trip's locked shirt deleted: only that slot is planned afresh
      const keep=items;items=items.filter(i=>i.id!==lock.shirt);cache={};const gone=buildPlan(2026,10)[D];items=keep;
      delete dayRecs[D].trip;cache={};const plain=buildPlan(2026,10)[D];
      const want=[lock.top,lock.bot,lock.shirt,lock.tie,lock.shoes].join();
      return {D,want,wet:ids(wet),notes:wet.notes,gone:ids(gone),goneShirt:gone.shirt&&gone.shirt.id,plain:ids(plain)}})()`);
    ok(!rain.none&&rain.wet===rain.want,`a kept trip day keeps every locked piece when rain is forecast against its suede shoes (${rain.wet})`);
    ok(rain.notes&&rain.notes.some(n=>/^Rain is forecast and the packed .* are suede/.test(n)),`and its note says the packed shoes are suede (${rain.notes})`);
    const gw=rain.want.split(','),gg=(rain.gone||'').split(',');
    ok(gg[0]===gw[0]&&gg[1]===gw[1]&&gg[3]===gw[3]&&gg[4]===gw[4]&&rain.goneShirt&&rain.goneShirt!==gw[2],`a kept trip's piece deleted: only its slot is planned again (${rain.gone})`);
    ok(rain.plain!==rain.want,'an ordinary week lock is still let go as a whole by the rain (the documented rule)');

    // ---- CR-3-02, rain wins (the owner, 2026-11-17): no suede on a rainy day, even if yesterday's leather pair comes again; suede only: said so
    const sd=await p.evaluate(`(()=>{${RAIN};let P=buildPlan(2026,10);const D=['2026-11-12','2026-11-19','2026-11-26'].find(d=>P[d].shoes&&P[d].shoes.leather==='suede');
      const prevK=Object.keys(P).filter(k=>keyDate(k)<keyDate(D)).sort((a,b)=>keyDate(b)-keyDate(a))[0];
      weather[D]={tmax:18,pop:80};cache={};let Q=buildPlan(2026,10);const o=Q[D],y=Q[prevK];
      // every day rainy: suede never comes, though one calf pair must then repeat
      const rainy=[];for(let d=10;d<=30;d++){const k='2026-11-'+d;weather[k]={tmax:18,pop:80};}cache={};Q=buildPlan(2026,10);for(const [k,x] of Object.entries(Q))if(keyDate(k)>=todayDate()&&x.shoes)rainy.push(x.shoes.leather);
      // only the suede loafers left
      items=items.filter(i=>i.type!=='shoes'||i.leather==='suede');cache={};const s=buildPlan(2026,10)[D];
      return {D,leather:o.shoes&&o.shoes.leather,shoes:o.shoes&&o.shoes.id,yShoes:y&&y.shoes&&y.shoes.id,rainySuede:rainy.filter(l=>l==='suede').length,rainyDays:rainy.length,onlyLeather:s.shoes&&s.shoes.leather,onlyNotes:s.notes}})()`);
    ok(sd.leather!=='suede'&&sd.shoes===sd.yShoes,`rain with suede and yesterday's leather pair: the leather pair is worn again (${sd.shoes}, yesterday ${sd.yShoes})`);
    ok(sd.rainyDays>10&&sd.rainySuede===0,`three rainy weeks plan no suede (${sd.rainySuede} of ${sd.rainyDays} days)`);
    ok(sd.onlyLeather==='suede'&&sd.onlyNotes.some(n=>/^Rain is forecast and suede shoes are the only ones you have for today/.test(n)),`suede only: the day's note says so (${sd.onlyNotes.join(' | ')})`);

    // ---- CR-3-04 and CR-3-07: the jacket taken off for a day
    const off=await p.evaluate(()=>{let k=0;const I=(type,c,x={})=>({id:type+(k++),type,primaryColor:c,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','green'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'})];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[];TODAY_OVERRIDE='2026-11-09T12:00:00';dayRecs={};weather={};cache={};
      let P=buildPlan(2026,10);const D='2026-11-11',o=P[D],force={};for(const s of SLOTS)if(o[s]&&s!=='bot')force[s]=o[s].id;
      dayRecs[D]={date:D,off:{top:true},force,kind:'suit'};cache={};P=buildPlan(2026,10);
      const nx=P['2026-11-12'];
      // a brown suit with only black shoes: "None of your shoes suit brown pants." is still true without the jacket
      k=0;items=[I('suit','brown'),I('shirt','white'),I('tie','navy'),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'})];
      TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};const B='2026-11-12',b0=buildPlan(2026,10)[B],f2={};for(const s of SLOTS)if(b0[s]&&s!=='bot')f2[s]=b0[s].id;
      dayRecs[B]={date:B,off:{top:true},force:f2,kind:'suit'};cache={};const b1=buildPlan(2026,10)[B];
      return {offTie:P[D].tie&&P[D].tie.id,nextTie:nx.tie&&nx.tie.id,prevN:nx.ctx.prev[0].n,offN:di(new Date(2026,10,11)),notes:b1.notes}});
    ok(off.prevN===off.offN&&off.offTie!==off.nextTie,`a day with the jacket taken off is the workday before for repeats: the next day's tie differs (${off.offTie} then ${off.nextTie})`);
    ok(off.notes.some(n=>/None of your shoes suit brown pants/.test(n)),`taking the jacket off keeps a note that only says "suit" as a verb (${off.notes})`);

    // ---- CR-3-08 and CR-3-09: verdicts written by hand, not with the planner's own functions
    const v=await p.evaluate(()=>{const I=(id,type,c,x={})=>({id,type,primaryColor:c,pattern:'solid',...x});
      const pants=I('p','pants','charcoal'),white=I('w','shirt','white'),tieN=I('t','tie','navy'),tieB=I('tb','tie','burgundy');
      const blk=I('bk','shoes','black',{leather:'calf'}),brn=I('br','shoes','brown',{leather:'calf'}),sue=I('su','shoes','brown',{leather:'suede',shoeStyle:'loafer'}),boot=I('bo','shoes','brown',{leather:'calf',shoeStyle:'boot'});
      const tan=I('tan','blazer','tan'),navyB=I('nb','blazer','navy'),navyS=I('ns','suit','navy'),blackS=I('ks','suit','black'),char=I('cb','blazer','charcoal');
      const R=o=>{const r=rateOutfit(o),s=r.checks.find(c=>c.label==='Shoes')||{},sh=r.checks.find(c=>c.label==='Shirt')||{};return {hard:r.hard,shoes:s.why||'',shirt:sh.why||'',score:r.score}};
      const out={
        tanBlack:R({suitDay:false,top:tan,bot:pants,shirt:white,tie:tieN,shoes:blk}),
        tanBrown:R({suitDay:false,top:tan,bot:pants,shirt:white,tie:tieN,shoes:brn}),
        navyBlack:R({suitDay:false,top:navyB,bot:pants,shirt:white,tie:tieB,shoes:blk}),
        blackSuitBrown:R({suitDay:true,top:blackS,bot:blackS,shirt:white,tie:tieB,shoes:brn}),
        navySuitSuede:R({suitDay:true,top:navyS,bot:navyS,shirt:white,tie:tieB,shoes:sue}),
        navySuitBoots:R({suitDay:true,top:navyS,bot:navyS,shirt:white,tie:tieB,shoes:boot}),
        sweater:R({suitDay:false,top:char,bot:I('cp','pants','grey',{trouserKind:'chinos'}),shirt:I('sw','sweater','navy'),tie:null,shoes:sue}),
        teeSame:R({suitDay:false,top:char,bot:I('cp','pants','grey',{trouserKind:'chinos'}),shirt:I('te','tee','charcoal'),tie:null,shoes:sue})};
      // the planner: a tan blazer with black and brown shoes never takes the black pair (Thursdays)
      let k=0;const J=(type,c,x={})=>({id:type+(k++),type,primaryColor:c,pattern:'solid',...x});
      items=[J('suit','navy'),J('suit','charcoal'),J('blazer','tan'),J('pants','charcoal'),J('pants','grey'),J('shirt','white'),J('shirt','lightblue'),J('tie','navy'),J('tie','burgundy'),J('tie','green'),
        J('shoes','black',{leather:'calf'}),J('shoes','brown',{leather:'calf'}),J('belt','black',{leather:'calf',metal:'silver'}),J('belt','brown',{leather:'calf',metal:'silver'})];
      settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];TODAY_OVERRIDE='2026-11-09T12:00:00';dayRecs={};weather={};cache={};
      const P=buildPlan(2026,11),tanDays=Object.values(P).filter(o=>o.top&&o.top.primaryColor==='tan');
      out.tanDays=tanDays.length;out.tanBlackDays=tanDays.filter(o=>o.shoes&&o.shoes.primaryColor==='black').length;return out});
    ok(v.tanBlack.hard.includes('Shoes')&&/black shoes don't suit a tan jacket/.test(v.tanBlack.shoes),`tan blazer and black shoes: a real mistake, said so (${v.tanBlack.shoes})`);
    ok(!v.tanBrown.hard.length&&!v.navyBlack.hard.length,'tan blazer and brown shoes, navy blazer and black shoes: no mistake');
    ok(v.blackSuitBrown.hard.includes('Shoes')&&v.blackSuitBrown.shoes==='a black suit needs black shoes',`a black suit with brown shoes: "${v.blackSuitBrown.shoes}"`);
    ok(!v.navySuitSuede.hard.length,'a navy suit with brown suede loafers: casual, not a mistake');
    ok(v.navySuitBoots.hard.includes('Shoes')&&/boots don't go with a suit/.test(v.navySuitBoots.shoes),`boots with a suit: a mistake, said so (${v.navySuitBoots.shoes})`);
    ok(!v.sweater.hard.length&&!v.sweater.shirt,`a navy sweater picked by hand under a charcoal blazer is no "dark shirt" mistake (${v.sweater.score})`);
    ok(v.teeSame.hard.includes('Shirt'),'a T-shirt the jacket\'s own color still is');
    ok(v.tanDays>=3&&v.tanBlackDays===0,`the planner never puts the black shoes under the tan blazer (${v.tanBlackDays} of ${v.tanDays} days)`);

    // ---- CR-3-06: planning a wardrobe where nothing is clean (sneakers only with suits) is not many times slower
    const sp=await p.evaluate(()=>{const run=sneak=>{let k=0;const I=(type,c,x={})=>({id:type+String(k++).padStart(4,'0'),type,primaryColor:c,pattern:'solid',...x});
        const C=['navy','charcoal','grey','brown','lightgrey','darkgrey','tan','olive','blue','black'],SC=['white','lightblue','pink','cream','lavender','ivory'],TC=['burgundy','green','gold','purple','red','navy','silver','pink','brown','olive'];
        items=[];for(let i=0;i<12;i++)items.push(I('suit',C[i%10]));for(let i=0;i<4;i++)items.push(I('blazer',C[(i+3)%10]));for(let i=0;i<8;i++)items.push(I('pants',['grey','charcoal','tan','navy'][i%4]));
        for(let i=0;i<40;i++)items.push(I('shirt',SC[i%6]));for(let i=0;i<40;i++)items.push(I('tie',TC[i%10]));
        if(sneak)items.push(I('shoes','white',{leather:'calf',shoeStyle:'sneaker'}),I('shoes','black',{leather:'canvas',shoeStyle:'sneaker'}));
        else items.push(I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf'}),I('belt','brown',{leather:'calf'}));
        settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};weather={};cache={};
        const t0=performance.now();planSim(planStart(2026,10)).upTo(new Date(2027,2,31));return performance.now()-t0};
      run(false);const a=Math.min(run(false),run(false)),b=Math.min(run(true),run(true));return {a:Math.round(a),b:Math.round(b)}});
    ok(sp.b<sp.a*2.5,`sneakers only (no clean outfit) plans in ${sp.b} ms against ${sp.a} ms with good shoes (6.5x before)`);

    // ---- CR-3-10, CR-3-11, CR-3-12
    const lows=await p.evaluate(()=>{const I=(id,type,c,x={})=>({id,type,primaryColor:c,pattern:'solid',added:1,...x});
      const suit=I('s1','suit','navy'),pants=I('p1','pants','grey');
      // a suit worn with its jacket off counts toward its cleaning limit and gets the frame (careDayState)
      items=[suit,I('sh','shirt','white'),I('ti','tie','navy'),I('bs','shoes','black',{leather:'calf'})];settings.care={suit:2};
      TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};const d=new Date(2026,10,11);
      const st=careDayState({suitDay:false,top:null,bot:suit,suitBot:true,shirt:items[1]},d);delete settings.care;
      // a past day corrected by hand with a piece added after it still counts as worn
      const late=I('s2','suit','grey',{added:+new Date(2026,10,10,12)});items.push(late);
      dayRecs={'2026-11-3':{date:'2026-11-3',ids:{top:'s2',shirt:'sh',tie:'ti',shoes:'bs'},suitDay:true,worn:true,edited:true},
        '2026-11-4':{date:'2026-11-4',ids:{top:'s2',shirt:'sh',tie:'ti',shoes:'bs'},suitDay:true,auto:1}};
      const wd=wornDays().map(x=>x.date);
      // a day without a jacket (taken off, or none in the dress code) is a complete packed day
      const o={suitDay:false,top:null,bot:pants,shirt:items[1],shoes:items[3],off:{top:true}};
      return {st:st&&st.k,corrected:wd.includes('2026-11-3'),warm:wd.includes('2026-11-4'),pack:packComplete(o),packJ:packComplete({...o,off:null})}});
    ok(!!lows.st,`a suit worn with its jacket off is in the cleaning frame (${lows.st})`);
    ok(lows.corrected&&!lows.warm,'a past day corrected with a piece added later counts as worn; an app-recorded warm-up day still does not');
    ok(lows.pack&&!lows.packJ,'"Pack lighter" counts a day with the jacket taken off as complete (a jacket day without one is not)');

    // ---- CR-3-05: a kept trip survives a pick on Today that clashes with a later lock (the real Packing list and picker)
    await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic.map(i=>({...i}));settings.workdays=[1,2,3,4,5];settings.blazerDays=[];settings.holidays=null;settings.daysOff=[];
      weather={};climate=null;TODAY_OVERRIDE='2026-11-23T09:00:00';dayRecs={};cache={};localStorage.removeItem('pack_trip');
      packT={a:'2026-11-25',b:'2026-11-27',j:0,s:0};show('pack')})()`);await settle(p,500);
    await p.click('#pk-lockbtn');await p.waitForFunction(()=>['2026-11-25','2026-11-26','2026-11-27'].every(k=>dayRecs[k]&&dayRecs[k].trip&&dayRecs[k].lock));
    const tie=await p.evaluate(async()=>{await lockUpcoming();sel=new Date(2026,10,23);view={y:2026,m:10};listOpen=true;show('today');const t=dayRecs['2026-11-25'].lock.tie,o=planFor()[key(sel)];return o.tie&&o.tie.id===t?null:t});
    ok(!!tie,'the trip\'s first day wears a tie other than today\'s');
    await settle(p,300);await p.click('#ri-tie button.swap');await p.waitForSelector('#pick-sheet.on');
    await p.click(`#pick-sheet .pick-it[data-id="${tie}"]`);await p.waitForFunction(t=>dayRecs['2026-11-23']&&dayRecs['2026-11-23'].force&&dayRecs['2026-11-23'].force.tie===t,tie);await settle(p,500);
    const tr=await p.evaluate(()=>{show('pack');const s=packLockState(packNow.days);return {n:s.n,of:s.of,locks:['2026-11-25','2026-11-26','2026-11-27'].map(k=>!!dayRecs[k].lock).join(),msg:(document.querySelector('#pk-lockmsg')||{}).textContent||''}});
    ok(tr.locks==='true,true,true'&&tr.n===tr.of&&/Locked\./.test(tr.msg),`a pick today of the trip's tie leaves the kept trip locked (${tr.locks}; ${tr.msg.slice(0,40)})`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // it checks what the planner chooses, not the fixed test plan
