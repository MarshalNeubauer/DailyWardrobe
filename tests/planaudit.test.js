// The planner audit's fixes (2026-11-14):
// - the tie and shirt fixed on each of the next 3 workdays are avoided (fixedAhead's fx): a tie pinned two or three workdays ahead
//   was planned the day before anyway (20 of 20), a shirt pinned two days ahead with laundry 3 too (12 of 12)
// - ties' rest creeps (capped, TIE_CREEP_MAX): on a 40-tie wardrobe 9 ties were never planned in a year; no tie comes back within 3 workdays
// - a formal day takes the white shirt (FORMAL_SHIRT_K, FORMAL_QWIN): 3 of 20 took light blue
// - a day marked "Not worn" is not the previous workday for repeats; a past day whose piece was deleted is rated without it, not "Incomplete"
// - learned votes stored as text count as numbers; the what-to-buy signature follows the settings the planner reads
module.exports=async({ok,chromium,url,WARDROBES})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(`(()=>{const W=${WARDROBES};const kd=k=>keyDate(k);
      const base=()=>{settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.daysOff=[];settings.holidays=null;settings.learn=null;delete settings.laundryDays;delete settings.darkShirts;delete settings.dress;weather={};climate=null;TODAY_OVERRIDE='2026-11-13T12:00:00';dayRecs={};cache={}};
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
      // 5. a vote stored as text; the what-to-buy signature
      settings.learn={i:{[tie.id]:'2'},p:{}};out.vote=itemVote(tie);
      const s0=shopSig();settings.laundryDays=3;const s1=shopSig();settings.darkShirts='often';const s2=shopSig();settings.learn={i:{},p:{[tie.id+'|zz']:-1}};const s3=shopSig();
      dayRecs['2026-12-1']={date:'2026-12-1',occasion:'wedding'};const s4=shopSig();settings.daysOff=[{d:'2026-12-3',n:'x'}];const s5=shopSig();settings.dress={jeans:true};const s6=shopSig();
      out.sigs=new Set([s0,s1,s2,s3,s4,s5,s6]).size;
      base();return out})()`);
    ok(r.tie2===0&&r.tie3===0,`a tie fixed two or three workdays ahead is not planned the day before (${r.tie2} and ${r.tie3} of 10; before 20 of 20 each)`);
    ok(r.nShirt>0&&r.shirt2===0,`with laundry 3, a shirt fixed two days ahead is kept for that day (${r.shirt2} of ${r.nShirt}; before 12 of 12)`);
    ok(r.unusedTies===0&&r.rep===0,`on a 40-tie wardrobe every tie comes round in a year (${r.unusedTies} never planned; before 9) and none within three workdays (${r.rep}), ${r.ms} ms`);
    ok(r.avg>=99.5,`its average score stays (${r.avg.toFixed(2)}; before 99.57)`);
    ok(r.notWhite===0,`formal days take a white shirt (${r.notWhite} of 20 did not; before 3)`);
    ok(!r.notWornPrev,'a day marked "Not worn" is not the previous workday for repeats');
    ok(r.goneLabel!=='Incomplete'&&!r.goneHard,`a past day whose tie was deleted since is rated without it (${r.goneLabel}${r.goneHard?', hard: '+r.goneHard:''})`);
    ok(r.vote===2,'a learned vote stored as text counts as a number');
    ok(r.sigs===7,`What to buy checks again after laundry days, dark shirts, what was learned, an occasion, a day off or jeans change (${r.sigs} of 7 signatures differ)`);
    ok(!errs.length,'no page errors: '+errs.join('; '));
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // it checks what the planner chooses
