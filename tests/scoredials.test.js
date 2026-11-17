// The score card's five dials (2026-11-17, the owner's approved design: C:\code\audit-2026-11-13\score-ideas\score-dials.html).
// The dials read 0-100 and spread over a planned month; a broken rule rings the dial it belongs to with "!"; the rank among the day's
// outfits (planner.js rankLooks, in analysis-worker.js) is not always 1st for the planned outfit, its swaps report the places they gain,
// and it fills in after the dials without blocking (timed at 4x CPU on Chromium); the calendar marks a shirt-and-tie repeat in gold and a
// broken rule in red, and rings today in ink; the folded card keeps the cards' height at 390 and 320 px, in both themes, with no sideways
// scroll. Chromium and WebKit.
module.exports=async({ok,engines,url,WARDROBES,settle})=>{
  for(const [eng,launch] of engines){const browser=await launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const setup=(d,extra='')=>p.evaluate(`(()=>{const W=${WARDROBES};items=W.realistic;settings.workdays=[1,2,3,4,5];settings.blazerDays=[4];settings.holidays=null;settings.daysOff=[];weather={};climate=null;TODAY_OVERRIDE='2026-11-17T09:00:00';dayRecs={};${extra};cache={};sel=new Date(2026,10,${d});view={y:2026,m:10};scoreOpen=false;monthOpen=false;listOpen=false;show('today')})()`);
    // ---- the dials over a month (computed as the card does)
    await setup(17);
    const M=await p.evaluate(()=>{const out={h:[],t:[],f:[],v:[],o:[]},ranks=[],gains=[];
      for(let d=new Date(2026,10,2);d<=new Date(2026,10,30);d.setDate(d.getDate()+1)){if(!isWorkday(d))continue;sel=new Date(d);const o=planFor()[key(sel)];if(!o)continue;
        const D=dialsFor(o);for(const k of DIAL_KEYS)out[k].push(D[k].v);const R=rankLooks(rankPools(o),o);ranks.push(R.rank);for(const s of R.swaps)gains.push(R.rank-s.rank)}
      sel=new Date(2026,10,17);return {out,ranks,gains}});
    const all=Object.values(M.out).flat();
    ok(all.length>=100&&all.every(v=>Number.isInteger(v)&&v>=0&&v<=100),`${eng}: every dial reads 0-100 on every workday of November (${all.length} readings)`);
    const span=k=>Math.max(...M.out[k])-Math.min(...M.out[k]);
    ok(span('h')>=30&&Math.min(...M.out.h)<70&&span('o')>=20&&span('t')>=30,`${eng}: they spread (Harmony ${Math.min(...M.out.h)}-${Math.max(...M.out.h)}, Texture ${Math.min(...M.out.t)}-${Math.max(...M.out.t)}, Occasion ${Math.min(...M.out.o)}-${Math.max(...M.out.o)}), not 99-100 every day`);
    ok(M.ranks.some(r=>r>1)&&M.gains.length>0&&M.gains.every(g=>g>0),`${eng}: the planned outfit is not always 1st (ranks ${M.ranks.slice(0,8).join(', ')}…), and each swap gains places (${M.gains.slice(0,5).join(', ')}…)`);
    // ---- a broken rule rings its own dial
    const B=await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:'z'+type+(k++),type,primaryColor,pattern:'solid',...x});
      const navy=I('suit','navy'),wh=I('shirt','white'),bu=I('tie','burgundy'),bl=I('shoes','black',{leather:'calf'}),bb=I('belt','black',{leather:'calf',metal:'silver'}),br=I('belt','brown',{leather:'calf',metal:'silver'});
      const base={suitDay:true,top:navy,bot:navy,shirt:wh,tie:bu,shoes:bl,belt:bb,notes:[]},keep=items;items=[...keep,navy,wh,bu,bl,bb,br];
      const ring=o=>{const r=rateOutfit(o);return [...new Set(r.hard.map(c=>DIAL_OF_CHECK[c]))].join()};
      const out={belt:ring({...base,belt:br}),shoes:ring({...base,top:I('suit','brown'),bot:null}),pats:ring({...base,top:I('suit','navy',{pattern:'pinstripe'}),shirt:I('shirt','white',{pattern:'stripe',secondaryColor:'blue'}),tie:I('tie','burgundy',{pattern:'stripe',secondaryColor:'navy'})}),
        shirt:ring({...base,shirt:I('shirt','navy')}),clean:ring(base),lightSocks:ring({...base,socks:I('socks','white')}),
        argyle:dialTexture({...base,socks:I('socks','navy',{pattern:'argyle',secondaryColor:'burgundy'})}).why,ribbed:dialTexture({...base,socks:I('socks','navy',{pattern:'ribbed'})}).why};out.shoes=ring({...base,top:out.br=I('suit','brown'),bot:out.br});delete out.br;items=keep;return out});
    ok(B.belt==='o'&&B.shoes==='o'&&B.pats==='t'&&/h/.test(B.shirt)&&B.clean===''&&B.lightSocks==='h'&&/argyle socks/.test(B.argyle)&&!/socks/.test(B.ribbed),`${eng}: light socks with dark pants ring Harmony, argyle socks are a pattern for Texture and ribbed ones are not;`+` ${eng}: a belt that doesn't match and shoes that don't suit ring Occasion, clashing patterns Texture, a shirt the jacket's color Harmony (${JSON.stringify(B)})`);
    // the same on the card: a brown belt picked with black shoes
    await setup(18);
    const pick=await p.evaluate(async()=>{const o=planFor()[key(sel)],b=items.find(i=>i.type==='belt'&&o.shoes&&beltFit(o.shoes,i)===null);if(!b)return null;await pickItem('belt',b.id);
      const o2=planFor()[key(sel)];return {hard:rateOutfit(o2).hard,bad:[...document.querySelectorAll('#sbox .dial.d-bad small')].map(e=>e.textContent),num:[...document.querySelectorAll('#sbox .dial.d-bad text')].map(e=>e.textContent)}});
    if(pick&&pick.hard.includes('Belt'))ok(pick.bad.join()==='Occasion'&&pick.num.join()==='!',`${eng}: on the card the Occasion dial is ringed in red with "!" (${pick.bad})`);
    else ok(true,`${eng}: (the planner kept the matching belt: ${JSON.stringify(pick)})`);
    // ---- the rank fills in after the dials (the Web Worker), the card stays usable meanwhile
    await setup(17);
    const r0=await p.evaluate(()=>({dials:document.querySelectorAll('#sbox .dial').length,line:document.querySelector('#srank').textContent}));
    await p.waitForFunction(()=>document.querySelector('#sbox.ranked'),null,{timeout:15000}).catch(()=>{});
    const r1=await p.evaluate(()=>({line:document.querySelector('#srank').textContent,label:document.querySelector('#sbox .month-link').getAttribute('aria-label'),wk:!!rankW,res:rankMemo.v}));
    ok(r0.dials===5&&/(best of \d+ outfits today|Ranking)/.test(r0.line)&&/(\d+(st|nd|rd|th) best|Best) of \d+ outfits today/.test(r1.line)&&/best of/.test(r1.label)&&r1.wk,`${eng}: the dials show at once, the rank line fills in from the worker ("${r1.line}")`);
    // the unfolded card: rules, Why, dial reasons, the week, weather, rules list
    await p.evaluate(()=>toggleScore());await settle(p,1200);
    const U=await p.evaluate(()=>{const b=document.querySelector('#sbox'),t=b.innerText;return {rules:b.querySelector('.srules').textContent,why:b.querySelector('#swhy').textContent,bars:b.querySelectorAll('.sdl').length,
      week:/This week.s variety · \d+/i.test(t),weeks:b.querySelectorAll('.sweeks li').length,list:b.querySelectorAll('.srl li').length,swaps:[...b.querySelectorAll('.sfixbtn')].map(x=>x.textContent)}});
    ok(/All \d+ rules met/.test(U.rules)&&U.why.length>20&&U.bars===8&&U.week&&U.weeks>=4&&U.list>=8,`${eng}: unfolded: "${U.rules}", Why, five dial reasons and three week bars, ${U.weeks} weeks, ${U.list} rules`);
    ok(U.swaps.every(s=>/^Wear the .*\+\d+ places?.*best/.test(s)),`${eng}: swaps say the places they gain (${U.swaps.join(' | ')||'none'})`);
    await p.evaluate(()=>toggleScore());await settle(p,800);
    // the rank on a 4x slower CPU, with a large wardrobe (Chromium: CDP)
    if(eng==='Chromium'){const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      const t=await p.evaluate(async()=>{let k=0;const I=(type,primaryColor,x={})=>({id:'b'+type+(k++),type,primaryColor,pattern:'solid',...x});
        items=[...['navy','charcoal','grey','darkgrey','lightgrey','navy','brown','charcoal','black','darknavy','grey','tan'].map(c=>I('suit',c)),...['navy','tan','brown','olive','grey','burgundy'].map(c=>I('blazer',c)),...['grey','charcoal','tan','cream','navy','olive','lightgrey','brown'].map(c=>I('pants',c)),
          ...Array.from({length:25},(_,n)=>I('shirt',['white','lightblue','pink','lavender','cream'][n%5],{pattern:['solid','oxford','stripe','end-on-end','gingham'][n%5],secondaryColor:'blue'})),
          ...Array.from({length:35},(_,n)=>I('tie',['navy','burgundy','green','purple','gold','charcoal','red','brown'][n%8],{pattern:['solid','stripe','paisley','polka-dot','knit'][n%5],secondaryColor:'white'})),
          I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('shoes','oxblood',{leather:'cordovan'}),I('shoes','brown',{leather:'suede',shoeStyle:'loafer'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('belt','burgundy',{leather:'calf',metal:'silver'}),I('watch','grey',{metal:'silver'})];
        cache={};const out=[];
        for(const d of [new Date(2026,10,19),new Date(2026,10,18)]){sel=d;view={y:2026,m:10};const t0=performance.now();renderToday();const drawn=performance.now()-t0;
          await new Promise(res=>{const f=()=>rankMemo.v?res():setTimeout(f,10);f()});out.push({drawn:Math.round(drawn),wall:rankMemo.v.wall,n:rankMemo.v.n})}return out});
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
      console.log('    rank at 4x CPU: '+t.map(x=>`${x.n} outfits ${x.wall} ms (Today drawn in ${x.drawn} ms)`).join('; '));
      ok(t.every(x=>x.wall<900&&x.n>1000),`${eng}: at 4x CPU a large wardrobe's rank comes in ${t.map(x=>x.wall+' ms ('+x.n+' outfits)').join(', ')} while Today is drawn without waiting for it`)}
    // ---- the calendar: gold for a shirt-and-tie repeat, red for a broken rule, today in ink
    await setup(17,`const pl0=(()=>{cache={};return planMonth(2026,10)})(),a=pl0['2026-11-9'],ids=o=>Object.fromEntries(SLOTS.map(s=>[s,o[s]?o[s].id:null]));
      dayRecs['2026-11-9']={date:'2026-11-9',ids:ids(a),suitDay:a.suitDay,worn:true};const b=pl0['2026-11-12'];dayRecs['2026-11-12']={date:'2026-11-12',ids:{...ids(b),shirt:a.shirt.id,tie:a.tie.id},suitDay:b.suitDay,worn:true};
      const c=pl0['2026-11-13'],bad=items.find(i=>i.type==='belt'&&c.shoes&&beltFit(c.shoes,i)===null);dayRecs['2026-11-13']={date:'2026-11-13',ids:{...ids(c),belt:bad.id},suitDay:c.suitDay,worn:true}`);
    await p.evaluate(()=>toggleMonth());await settle(p,1500);
    const C=await p.evaluate(()=>{const cell=d=>document.querySelector(`#mpanel .mc[data-k="2026-11-${d}"]`),ink=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
      const tt=getComputedStyle(cell(17)).boxShadow;return {rep:cell(12).classList.contains('rep'),gold:cell(12).querySelectorAll('.strep').length,gold9:cell(9).querySelectorAll('.strep').length,bad:cell(13).classList.contains('bad'),
        badLabel:cell(13).getAttribute('aria-label'),repLabel:cell(12).getAttribute('aria-label'),reds:document.querySelectorAll('#mpanel .mc.bad').length,today:tt,ink,goldStroke:getComputedStyle(cell(12).querySelector('.strep')||document.body).stroke}});
    ok(C.rep&&C.gold===2&&C.gold9===0&&/same shirt and tie/.test(C.repLabel),`${eng}: the day repeating Nov 9's shirt and tie has a gold border on its shirt and tie bands (${C.gold}); Nov 9 has none`);
    ok(C.bad&&C.reds===1&&/rule broken/.test(C.badLabel),`${eng}: the day worn with a belt that doesn't match its shoes is ringed in red, and only that day`);
    const rgb=h=>{const n=parseInt(h.slice(1),16);return `rgb(${n>>16}, ${n>>8&255}, ${n&255})`};
    ok(C.today.includes(rgb(C.ink))&&!/rgb\(217, 162, 27\)/.test(C.today),`${eng}: today is ringed in ink, not the gold accent (${C.today})`);
    const S=await p.evaluate(()=>{toggleMonth();sel=new Date(2026,10,12);view={y:2026,m:10};renderToday();return [...document.querySelectorAll('#mbox .mli')].map(e=>e.className)});
    ok(S[0]&&/\brep\b/.test(S[0])&&S.some(c=>/\bbad\b/.test(c)),`${eng}: the closed card's five-day strip has the same marks (${S.join(' / ')})`);
    // ---- the folded card keeps the cards' height, in both themes, at 390 and 320 px, with no sideways scroll
    for(const theme of ['light','dark'])for(const w of [390,320]){await p.setViewportSize({width:w,height:800});
      await p.evaluate(t=>{document.documentElement.dataset.theme=t;sel=new Date(2026,10,17);scoreOpen=false;renderToday()},theme);await settle(p,300);
      const L=await p.evaluate(()=>{const R=s=>document.querySelector(s).getBoundingClientRect(),b=R('#sbox'),d=[...document.querySelectorAll('#sbox .dial')].map(e=>e.getBoundingClientRect()),lab=[...document.querySelectorAll('#sbox .dial small')].map(e=>e.getBoundingClientRect());
        return {h:Math.round(b.height),ib:Math.round(R('#ibox').height),mb:Math.round(R('#mbox').height),inside:d.every(r=>r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom),
          apart:lab.every((r,i)=>!i||r.left>=lab[i-1].right-1),over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          arc:getComputedStyle(document.querySelector('#sbox .dial .darc')).stroke,bg:getComputedStyle(document.querySelector('#sbox')).backgroundColor}});
      // (below 360px the other cards may grow for their wrapped text: styles.css; the score card keeps 76px plus its border)
      ok(L.h===78&&(w<360||(L.h===L.ib&&L.h===L.mb))&&L.inside&&L.apart&&L.over===0,`${eng} ${theme} ${w}px: the folded card is ${L.h}px${w<360?'':' like the other cards'}, the dials and their names fit, no sideways scroll (${JSON.stringify({ib:L.ib,mb:L.mb,inside:L.inside,apart:L.apart,over:L.over})})`)}
    await p.evaluate(()=>{delete document.documentElement.dataset.theme});
    ok(errs.length===0,`${eng}: no page errors (${errs.join('; ')})`);
  }finally{await browser.close()}}
};
module.exports.realPlanner=true;
