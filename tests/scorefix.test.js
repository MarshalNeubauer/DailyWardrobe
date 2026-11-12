// The rebuilt outfit score. Points are lost for things that can be put right, not for taste; a real mistake (a check marked hard)
// caps the score at 69 however well the rest matches; a missing piece reads "Incomplete"; new checks cover variety against the
// last two workdays, a leather watch strap against the shoes and the weather. scoreAdvice() finds the single swaps that would
// score higher, the wardrobe's best with the day's jacket, and the checks nothing owned improves; the score card shows them,
// and a tap on a swap wears it. Stats: the score of what was really worn, week by week.
module.exports=async({ok,chromium,url,WARDROBES,settle})=>{
  const browser=await chromium.launch();
  try{
    const p=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const S=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});items=[];
      const navy=I('suit','navy'),bl=I('shoes','black',{leather:'calf'}),br=I('shoes','brown',{leather:'calf'}),bb=I('belt','black',{leather:'calf',metal:'silver'}),w=I('watch','silver',{metal:'silver'});items=[bb];
      const mk=(top,shirt,tie,shoes,belt,socks,x={})=>({suitDay:top&&top.type==='suit',top,bot:x.bot||top,shirt,tie,shoes,belt,socks,watch:w,clip:null,notes:[],...x});
      const R=o=>{const r=rateOutfit(o);return {s:r.score,l:r.label,hard:r.hard.join(),lost:Object.fromEntries(r.checks.filter(c=>c.pts<c.max).map(c=>[c.label,c.pts+'/'+c.max])),why:r.checks.filter(c=>c.pts<c.max).map(c=>c.why).join(' | ')}};
      const wh=I('shirt','white'),bu=I('tie','burgundy'),ns=I('socks','navy'),base=mk(navy,wh,bu,bl,bb,ns);
      const prev=(o,n)=>({jg:jacketGroup(o.top),jc:planCol(o.top),sg:shirtGroup(o.shirt),tg:tieGroup(o.tie),tid:o.tie.id,sl:shirtLook(o.shirt),tl:tieLook(o.tie),sid:o.shirt.id,sh:o.shoes.id,n});
      return {classic:R(base),
        taste:[R(mk(navy,I('shirt','pink'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),bl,bb,ns)),R(mk(navy,I('shirt','lavender'),bu,br,I('belt','brown',{leather:'calf',metal:'silver'}),ns)),R(mk(I('suit','charcoal'),wh,I('tie','silver'),bl,bb,I('socks','charcoal'))),
          R(mk(I('suit','lightgrey'),I('shirt','black'),I('tie','silver'),bl,bb,I('socks','grey')))],
        brownBlack:R(mk(I('suit','brown'),wh,I('tie','green'),bl,bb,I('socks','brown'))),stripes:R(mk(I('suit','navy',{pattern:'pinstripe'}),I('shirt','white',{pattern:'stripe',secondaryColor:'blue'}),I('tie','burgundy',{pattern:'stripe',secondaryColor:'navy'}),bl,bb,ns)),
        sameTr:R(mk(I('blazer','navy'),wh,bu,bl,bb,ns,{bot:I('pants','navy'),suitDay:false})),belt:R(mk(navy,wh,bu,bl,I('belt','brown',{leather:'calf',metal:'silver'}),ns)),
        darkShirt:R(mk(navy,I('shirt','black'),I('tie','silver'),bl,bb,ns)),whiteSocks:R(mk(navy,wh,bu,bl,bb,I('socks','white'))),
        tweed:R({...mk(I('suit','brown',{pattern:'tweed'}),wh,I('tie','green'),br,I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','brown')),clim:{season:'warm',wx:{tmax:38}}}),
        only:R({suitDay:true,top:null,bot:null,shirt:wh,tie:null,shoes:null,belt:null,socks:null,watch:null,clip:null,notes:[]}),noTie:R({...base,tie:null}),casual:R({...base,top:null,tie:null,suitDay:false,bot:I('pants','grey'),occasion:'casual',socks:I('socks','grey')}),
        strap:R({...base,watch:I('watch','brown',{band:'leather',metal:'silver'})}),strapOk:R({...base,watch:I('watch','black',{band:'leather',metal:'silver'})}),
        var0:R({...base,ctx:{n:10,prev:[prev(mk(I('suit','lightgrey'),I('shirt','lightblue'),I('tie','green'),br,bb,ns),9),null]}}),
        varTie:R({...base,ctx:{n:10,prev:[prev(mk(I('suit','lightgrey'),I('shirt','lightblue'),bu,br,bb,ns),9),null]}}),
        varLook:R({...base,ctx:{n:12,prev:[prev(mk(I('suit','lightgrey'),I('shirt','lightblue'),I('tie','green'),br,bb,ns),11),prev(mk(I('suit','darknavy'),I('shirt','ivory'),I('tie','wine'),br,bb,ns),10)]}}),
        varShoes:R({...base,ctx:{n:10,prev:[prev(mk(I('suit','lightgrey'),I('shirt','lightblue'),I('tie','green'),bl,bb,ns),9),null]}}),
        varShoesMon:R({...base,ctx:{n:12,prev:[prev(mk(I('suit','lightgrey'),I('shirt','lightblue'),I('tie','green'),bl,bb,ns),9),null]}})}});
    ok(S.classic.s===100&&S.classic.l==='Excellent','navy suit, white shirt, burgundy tie, black shoes: 100');
    ok(S.taste.every(t=>t.s===100),`no points off for taste: a pink shirt, a lavender shirt with brown shoes, a silver tie on charcoal, a black shirt under a light grey suit all score 100 (${S.taste.map(t=>t.s).join(', ')})`);
    const hard=(r,l)=>r.s<=69&&r.hard.split(',').includes(l);
    ok(hard(S.brownBlack,'Shoes')&&/black shoes don't suit brown trousers/.test(S.brownBlack.why),`a brown suit with black shoes is a real mistake: ${S.brownBlack.s}, ${S.brownBlack.l} (${S.brownBlack.why})`);
    ok(hard(S.stripes,'Patterns')&&hard(S.sameTr,'Trousers')&&hard(S.belt,'Belt')&&hard(S.darkShirt,'Shirt')&&hard(S.whiteSocks,'Socks')&&hard(S.tweed,'Weather'),
      `so are three bold patterns (${S.stripes.s}), trousers the jacket's colour (${S.sameTr.s}), a belt that doesn't match the shoes (${S.belt.s}), a dark shirt under a dark suit (${S.darkShirt.s}), white socks (${S.whiteSocks.s}) and tweed on a hot day (${S.tweed.s})`);
    ok(S.only.l==='Incomplete'&&S.only.s<=69&&/no trousers, no jacket, no tie, no shoes/.test(S.only.why)&&S.noTie.l==='Incomplete'&&S.casual.l!=='Incomplete',`a shirt alone reads Incomplete (${S.only.s}: ${S.only.why}), and so does a suit with no tie; a no-jacket day needs neither`);
    ok(S.strap.lost['Watch strap']==='2/5'&&!S.strapOk.lost['Watch strap'],`a brown leather watch strap with black shoes loses points (${S.strap.lost['Watch strap']}), a black one doesn't`);
    ok(!S.var0.lost.Variety&&S.varTie.lost.Variety==='3/5'&&S.varLook.lost.Variety==='2/5'&&S.varShoes.lost.Variety==='4/5'&&!S.varShoesMon.lost.Variety,
      `variety: the same tie as the workday before ${S.varTie.lost.Variety}, the same look as two workdays ago ${S.varLook.lost.Variety}, yesterday's shoes ${S.varShoes.lost.Variety} (not after a weekend)`);
    // ---- advice
    const A=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      const br=I('suit','brown'),wh=I('shirt','white'),gr=I('tie','green'),bl=I('shoes','black',{leather:'calf'}),bn=I('shoes','brown',{leather:'calf'}),bb=I('belt','black',{leather:'calf',metal:'silver'}),bnb=I('belt','brown',{leather:'calf',metal:'silver'}),
        so=I('socks','brown'),w=I('watch','silver',{metal:'silver'}),clip=I('tieclip','gold',{metal:'gold'});items=[br,wh,gr,bl,bn,bb,bnb,so,w,clip];
      const o={suitDay:true,top:br,bot:br,shirt:wh,tie:gr,shoes:bl,belt:bb,socks:so,watch:w,clip,notes:[]},a=scoreAdvice(o,s=>items.filter(i=>i.type===SLOT_TYPE(s,true)));
      return {score:a.score,best:a.best,fix:a.fixes.map(f=>f.slot+':'+f.item.primaryColor+':+'+f.gain),stuck:a.stuck.join()}});
    ok(A.score<=69&&A.fix[0]&&/^shoes:brown:\+\d+/.test(A.fix[0])&&A.best>=90,`advice for a brown suit with black shoes: the brown pair first (${A.fix.join(', ')}), best ${A.best}`);
    ok(A.stuck==='Metals','a check nothing owned improves is told apart (the only tie clip is gold, the watch silver)');
    // ---- the card
    await p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];TODAY_OVERRIDE='2026-11-11T12:00:00';dayRecs={};cache={};view={y:2026,m:10};const pl=planMonth(2026,10),k=Object.keys(pl).find(k=>keyDate(k)>=todayDate()&&pl[k].top&&items.some(s=>s.type==='shoes'&&shoeScore(pl[k].top,pl[k].bot||pl[k].top,s)<=-50));sel=keyDate(k);show('today')})()`);await settle(p,400);
    const c0=await p.evaluate(()=>{const o=planFor()[key(sel)],r=rateOutfit(o);return {s:r.score,hard:r.hard.length,num:document.querySelector('#sbox .num').textContent,sub:document.querySelector('#sbox .lbl small').textContent,variety:r.checks.some(c=>c.label==='Variety')}});
    ok(c0.hard===0&&c0.s>=90&&c0.num===String(c0.s)&&c0.variety,`the planned day scores ${c0.s} with no real mistake, and is checked for variety (${c0.sub})`);
    // wear the wrong shoes by hand: the card says so and offers the way back
    await p.evaluate(()=>{const o=planFor()[key(sel)],bad=items.filter(i=>i.type==='shoes').find(s=>shoeScore(o.top,o.bot||o.top,s)<=-50)||null;window.badShoes=bad&&bad.id;return bad&&pickItem('shoes',bad.id)});await settle(p,400);
    const c1=await p.evaluate(()=>({has:!!window.badShoes,num:+document.querySelector('#sbox .num').textContent,low:document.querySelector('#sbox').classList.contains('low'),sub:document.querySelector('#sbox .lbl small').textContent,label:document.querySelector('#sbox .lbl b').textContent}));
    ok(c1.has&&c1.num<=69&&c1.low&&/1 thing to put right/.test(c1.sub),`shoes that don't suit the suit, picked by hand: ${c1.num}, ${c1.label}, in red, "${c1.sub}"`);
    await p.click('#sbox .month-link');await settle(p,900);
    const c2=await p.evaluate(()=>({fix:[...document.querySelectorAll('#sbox .sfixbtn')].map(b=>b.textContent.trim()),h:[...document.querySelectorAll('#sbox .sfixbtn')].map(b=>Math.round(b.getBoundingClientRect().height)),hard:[...document.querySelectorAll('#sbox li.hard')].map(l=>l.textContent),cap:(document.querySelector('#sbox .scap')||{}).textContent||'',head:(document.querySelector('#sbox .sfix small')||{}).textContent||''}));
    ok(c2.fix.length>=1&&/shoes/.test(c2.fix[0])&&/\+\d+/.test(c2.fix[0])&&c2.h.every(h=>h>=44)&&/put it right/.test(c2.head),`unfolded, it offers the swap that puts it right as a 44px row (${c2.fix[0]})`);
    ok(c2.hard.length===1&&/Shoes/.test(c2.hard[0])&&/69 or below/.test(c2.cap),'the mistake is marked, and the card says why the score is held down');
    await p.click('#sbox .sfixbtn');await p.waitForFunction(()=>+document.querySelector('#sbox .num').textContent>=90,null,{timeout:5000}).catch(()=>{});
    const c3=await p.evaluate(()=>{const o=planFor()[key(sel)];return {num:+document.querySelector('#sbox .num').textContent,shoes:o.shoes.id!==window.badShoes,belt:!o.belt||beltFit(o.shoes,o.belt)!==null,open:document.querySelector('#sbox').classList.contains('open')}});
    ok(c3.num>=90&&c3.shoes&&c3.belt&&c3.open,`a tap on it wears those shoes (the belt follows) and the score is back at ${c3.num}; the card stays open`);
    // a tap on the breakdown still folds it; a tap on the advice row area doesn't
    await p.evaluate(()=>toggleScore());await settle(p,500);
    // ---- stats: what was really worn, week by week
    await p.evaluate(()=>{const T=todayDate();dayRecs={};cache={};const pl={...planMonth(2026,8),...planMonth(2026,9),...planMonth(2026,10)};
      for(const [k,o] of Object.entries(pl)){const d=keyDate(k);if(d<T&&o.top&&d>=new Date(2026,8,20))dayRecs[k]={date:k,ids:idsOf(o),suitDay:o.suitDay,vestOn:!!o.vest}}
      // one day worn with shoes that don't suit the suit
      const wrong=(o,s)=>shoeScore(o.top,o.bot||o.top,s)<=-50,k=Object.keys(dayRecs).find(k=>keyDate(k)>=new Date(2026,9,20)&&items.some(s=>s.type==='shoes'&&wrong(pl[k],s))),bad=items.find(s=>s.type==='shoes'&&wrong(pl[k],s));dayRecs[k].ids={...dayRecs[k].ids,shoes:bad.id,belt:null};
      cache={};openStats()});await settle(p,600);
    const st=await p.evaluate(()=>{const c=document.querySelector('#st-trend'),S=buildStats();return {cols:c?c.querySelectorAll('.st-wk').length:0,low:c?c.querySelectorAll('.st-col i.low').length:0,txt:c?c.textContent.replace(/\s+/g,' '):'',avg:S.wornAvg,hard:S.wornHard,days:S.trendDays,w:c?Math.round(c.getBoundingClientRect().width):0,over:document.documentElement.scrollWidth-document.documentElement.clientWidth}});
    ok(st.cols===8&&st.days>20&&st.avg>=85&&/What you really wore, week by week/.test(st.txt),`Stats → Your scores: eight weekly columns over ${st.days} worn days, average ${st.avg}`);
    ok(st.hard===1&&st.low===1&&/1 had a real mistake/.test(st.txt)&&st.over===0,'the week with a real mistake is marked, and the card says how many days had one');
    // the unused-piece reasons are worked out once for the page, not once per piece
    const perf=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:'x'+type+(k++),type,primaryColor,pattern:'solid',...x});const cols=['white','lightblue','pink','lavender','cream','navy','black','charcoal'];
      items=[...items,...Array.from({length:60},(_,n)=>I('shirt',cols[n%cols.length])),...Array.from({length:40},(_,n)=>I('tie',['navy','burgundy','green','purple','gold','charcoal'][n%6]))];dayRecs={};cache={};const t=performance.now();buildStats().unused.forEach(r=>whyUnused(r.i));return Math.round(performance.now()-t)});
    ok(perf<8000,`stats with 100 more shirts and ties: counted and explained in ${perf} ms`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
module.exports.realPlanner=true;   // runs the real planner (it checks the score); other tests get tests/fixedplan.js
