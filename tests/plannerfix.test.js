// Planner fixes found by running the owner's real wardrobe through six months of planning:
// quiet neutral ties (black, charcoal, grey, silver) are right with navy, charcoal and grey suits; black trousers go under a grey
// jacket and mid-blue ones under tan, brown and grey; a piece that is always a point short of another still comes round (the rest
// bonuses keep creeping up past their caps); a cold-weather suit is not planned on a warm day while another suit is there; a suit whose
// only shoes were worn yesterday waits a day; dark shirts follow the owner's setting; a wardrobe with no jacket still gets trousers;
// the month's last day is planned where the clocks change at midnight.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',...x});
      window.fresh=()=>{settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];settings.vestMode='never';delete settings.darkShirts;settings.learn=null;dayRecs={};weather={};climate=null;TODAY_OVERRIDE='2026-11-11T12:00:00';cache={}};
      window.months=n=>{const T=todayDate(),pl=planSim(planStart(T.getFullYear(),T.getMonth())).upTo(new Date(T.getFullYear(),T.getMonth()+n,0));return Object.entries(pl).filter(([k,o])=>keyDate(k)>=T)};
      window.uses=(pl,slot)=>{const u={};for(const [k,o] of pl)if(o[slot]&&!(slot==='bot'&&o.suitDay))u[o[slot].id]=(u[o[slot].id]||0)+1;return u}});
    // ---- rule tables
    const t=await p.evaluate(()=>{const J=c=>I('suit',c),X=c=>I('tie',c),W=I('shirt','white'),h=(j,x)=>HARM[pcol(J(j))].includes(pcol(X(x)));
      const rate=(j,x)=>rateOutfit({suitDay:true,top:J(j),bot:null,shirt:W,tie:X(x),notes:[]}).checks.find(c=>c.label==='Tie and jacket').pts;
      return {ok:[['navy','black'],['navy','charcoal'],['navy','silver'],['charcoal','black'],['charcoal','silver'],['charcoal','grey'],['grey','charcoal'],['grey','red'],['black','charcoal'],['brown','charcoal'],['darknavy','darkgrey']].filter(([j,x])=>!h(j,x)).join(' '),
        no:[['brown','black'],['tan','black'],['olive','black']].filter(([j,x])=>h(j,x)).join(' '),navyBlack:rate('navy','black'),charSilver:rate('charcoal','silver'),brownBlack:rate('brown','black'),
        pair:{greyBlack:pairScore(I('blazer','lightgrey'),I('pants','black')),navyBlack:pairScore(I('blazer','navy'),I('pants','black')),blackGrey:pairScore(I('blazer','black'),I('pants','grey')),
          tanBlue:pairScore(I('blazer','khaki'),I('pants','steelblue')),greyBlue:pairScore(I('blazer','lightgrey'),I('pants','steelblue')),navyBlue:pairScore(I('blazer','navy'),I('pants','steelblue'))}}});
    ok(t.ok===''&&t.no==='',`black, charcoal, grey and silver ties are classic partners for navy, charcoal and grey suits (charcoal and grey for brown); black is still not one for brown, tan or olive (missing: "${t.ok}", wrongly in: "${t.no}")`);
    ok(t.navyBlack===10&&t.charSilver===10&&t.brownBlack<10,`the score agrees: a black tie on navy ${t.navyBlack}/10, silver on charcoal ${t.charSilver}/10, black on brown ${t.brownBlack}/10`);
    ok(t.pair.greyBlack>0&&t.pair.navyBlack<0&&t.pair.blackGrey>0,`black trousers go under a grey jacket (${t.pair.greyBlack}), not under a navy one (${t.pair.navyBlack}); a black jacket takes grey trousers (${t.pair.blackGrey})`);
    ok(t.pair.tanBlue>0&&t.pair.greyBlue>0&&t.pair.navyBlue<0,`mid-blue trousers go under tan and grey jackets (${t.pair.tanBlue}, ${t.pair.greyBlue}), not under navy (${t.pair.navyBlue})`);
    // ---- nothing starves: trousers a point or two short of the favourite, and interchangeable socks
    const st=await p.evaluate(()=>{fresh();settings.blazerDays=[2,4];
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('blazer','charcoal'),I('blazer','slate'),I('pants','grey'),I('pants','grey'),I('pants','khaki'),I('pants','taupe',{pattern:'windowpane',secondaryColor:'white'}),I('pants','taupe'),
        I('shirt','white'),I('shirt','white'),I('shirt','lightblue'),I('shirt','lightblue'),I('shirt','pink'),I('tie','burgundy'),I('tie','navy'),I('tie','green'),I('tie','purple'),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),
        I('socks','charcoal'),I('socks','charcoal'),I('socks','darkgrey'),I('socks','charcoal'),I('socks','navy'),I('socks','grey')];
      const pl=months(8),pu=uses(pl,'bot'),su=uses(pl,'socks');
      return {pants:items.filter(i=>i.type==='pants').map(i=>pu[i.id]||0),socks:items.filter(i=>i.type==='socks'&&pcol(i)==='charcoal').map(i=>su[i.id]||0)}});
    ok(st.pants.every(n=>n>=3),`every pair of trousers that suits the blazers is worn over eight months, the windowpane pair too (${st.pants.join(', ')})`);
    ok(st.socks.every(n=>n>=3)&&Math.max(...st.socks)-Math.min(...st.socks)<=4,`four interchangeable charcoal socks take turns (${st.socks.join(', ')})`);
    // ---- seasons
    const se=await p.evaluate(()=>{fresh();climate=Array.from({length:12},()=>({tmax:32,tmin:20,rainDays:0}));
      const tw=I('suit','brown',{season:'cold'});items=[tw,I('suit','navy'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy'),I('shoes','brown',{leather:'calf'}),I('shoes','black',{leather:'calf'})];
      const warm=months(4).filter(([k,o])=>o.top&&o.top.id===tw.id).length;
      climate=Array.from({length:12},()=>({tmax:8,tmin:0,rainDays:0}));cache={};const cold=months(4).filter(([k,o])=>o.top&&o.top.id===tw.id).length;
      climate=Array.from({length:12},()=>({tmax:32,tmin:20,rainDays:0}));items=items.filter(i=>i.type!=='suit'||i.id===tw.id);const only=months(1)[0][1];
      return {warm,cold,only:only.top&&only.top.id===tw.id,note:only.notes.join(' ')}});
    ok(se.warm===0&&se.cold>10,`a cold-weather suit is not planned on warm days while other suits are there (${se.warm} warm days), and takes its turn on cold ones (${se.cold})`);
    ok(se.only&&/cold-weather piece on a warm day/.test(se.note),'when it is the only suit it is worn, with a note');
    // ---- a suit whose only shoes were worn yesterday waits
    const sb=await p.evaluate(()=>{fresh();const bk=I('suit','black'),nv=I('suit','navy'),sB=I('shoes','black',{leather:'calf'}),sR=I('shoes','brown',{leather:'calf'});
      items=[bk,nv,I('shirt','white'),I('tie','burgundy'),sB,sR];const by=t=>items.filter(i=>i.type===t),day={formal:false,clim:{season:'mild',rain:false,cold:false},hasLinks:false,prev:[]};
      const a=outfit(true,100,by,{[sB.id]:99,[bk.id]:80,[nv.id]:80},null,day),b=outfit(true,100,by,{[sB.id]:96,[bk.id]:80,[nv.id]:80},null,day);
      return {after:a.top.id===nv.id,rested:b.top.id===bk.id}});
    ok(sb.after&&sb.rested,'the day after black shoes the navy suit goes before the black one; once the shoes have rested the black suit takes its turn');
    // ---- dark shirts follow the setting
    const dk=await p.evaluate(()=>{fresh();settings.workdays=[1,2,3,4,5];settings.blazerDays=[];
      items=[I('suit','lightgrey'),I('suit','midgrey'),I('suit','darkgrey'),I('suit','navy'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','black'),I('shirt','navy'),I('shirt','charcoal'),
        I('tie','silver'),I('tie','lightgrey'),I('tie','burgundy'),I('tie','navy'),I('tie','charcoal',{pattern:'check',secondaryColor:'lightgrey'}),I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'})];
      const n=()=>{cache={};return months(4).filter(([k,o])=>o.shirt&&darkShirt(o.shirt)).length},some=n();settings.darkShirts='often';const often=n(),
        under=darkUnderLight(items[2],items.find(i=>i.type==='shirt'&&i.primaryColor==='black')),sc=rateOutfit({suitDay:true,top:items[0],bot:null,shirt:items[7],tie:items[10],notes:[]}).checks.find(c=>c.label==='Shirt');
      settings.darkShirts='never';const never=n(),underNever=darkUnderLight(items[0],items[7]);delete settings.darkShirts;
      return {some,often,never,under,underSome:darkUnderLight(items[2],items[7]),underNever,shirtPts:sc.pts}});
    ok(dk.often>dk.some&&dk.never===0,`dark shirts: "often" plans them more than the default (${dk.often} against ${dk.some} days in four months), "never" not at all (${dk.never})`);
    ok(dk.under&&!dk.underSome&&!dk.underNever,'with "often" a dark shirt also goes under a mid-tone jacket that is clearly lighter (black under dark grey); by default only under a light one');
    // ---- no jacket in the wardrobe
    const nj=await p.evaluate(()=>{fresh();items=[I('shirt','white'),I('shirt','lightblue'),I('pants','grey'),I('pants','navy'),I('pants','charcoal'),I('tie','burgundy'),I('shoes','black',{leather:'calf'})];
      return months(1).map(([k,o])=>!!o.bot&&!!o.shirt&&!o.top)});
    ok(nj.length>5&&nj.every(Boolean),'a wardrobe with no suit or blazer still gets trousers and a shirt every workday');
    // ---- socks may pick up the shirt's or the tie's colour
    const sk=await p.evaluate(()=>{const tr=I('suit','charcoal'),pu=I('socks','purple'),sh=I('shirt','lavender'),ti=I('tie','purple');
      return {plain:sockScore(tr,null,pu,[]),shirt:sockScore(tr,null,pu,sockEcho(sh,null)),tie:sockScore(tr,null,pu,sockEcho(null,ti)),match:sockScore(tr,null,I('socks','charcoal'),sockEcho(sh,ti))}});
    ok(sk.shirt>sk.plain&&sk.tie>sk.plain&&sk.match>sk.shirt,`purple socks are a choice with a lavender shirt or a purple tie (${sk.shirt} against ${sk.plain}), behind socks that match the trousers (${sk.match})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    // ---- where the clocks go forward at midnight (Cairo, 24 April 2026) the month's last day is still planned
    const c2=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Africa/Cairo'}),q=await c2.newPage();await q.goto(url);await q.waitForFunction(()=>window.appReady);
    const dst=await q.evaluate(()=>{let k=0;const I=(type,primaryColor)=>({id:type+(k++),type,primaryColor,pattern:'solid'});items=[I('suit','navy'),I('suit','grey'),I('shirt','white'),I('tie','burgundy'),I('shoes','black')];
      settings.workdays=[0,1,2,3,4,5,6];settings.blazerDays=[];dayRecs={};TODAY_OVERRIDE='2026-04-02T12:00:00';cache={};const pl=buildPlan(2026,3);return {last:!!pl['2026-4-30'],n:Object.keys(pl).filter(k=>k.startsWith('2026-4-')).length}});
    ok(dst.last&&dst.n===30,`Cairo: all ${dst.n} days of April 2026 are planned, the 30th too`);
    await c2.close();
  }finally{await browser.close()}
};
