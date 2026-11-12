// The dress code (settings.dress = {jacket, tie}; missing = yes) and the waistcoat default.
// - with no dress object the planner picks exactly what it picked before the dress code existed (GOLD: recorded from the app
//   as it was, for fixed wardrobes and a fixed date)
// - each of the four combinations plans complete outfits and scores them without "Incomplete"; a formal day, a wedding
//   and a funeral are still dressed in full
// - Today, the drawing, the photo request, the stats and the what-to-buy check leave out what the dress code leaves out
// - Settings → Schedule → Dress code: two switches; a change releases the locked week
// - a suit has a waistcoat only with vest:'yes'; a wardrobe from before keeps its three-piece suits (migrateVests)
const path=require('path'),{pathToFileURL}=require('url');
/* the wardrobes (built inside the page) */
const WARD=`(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++).toString().padStart(3,'0'),type,primaryColor,pattern:'solid',added:1,...x});
 const common=()=>[I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('shoes','oxblood',{leather:'cordovan'}),I('shoes','brown',{leather:'suede'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('belt','burgundy',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'suede',metal:'silver'}),
   I('watch','grey',{metal:'silver'}),I('watch','brown',{metal:'gold',band:'leather'}),I('socks','navy'),I('socks','charcoal'),I('socks','brown'),I('socks','grey'),I('tieclip','grey',{metal:'silver'}),I('tieclip','gold',{metal:'gold'}),I('cufflinks','silver',{metal:'silver'}),I('overcoat','charcoal'),I('raincoat','tan')];
 return {
  full:[I('suit','navy'),I('suit','charcoal'),I('suit','grey',{pattern:'herringbone'}),I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','lightgrey',{vest:'no'}),I('suit','black'),I('blazer','navy'),I('blazer','tan'),I('blazer','brown',{pattern:'tweed'}),
   I('pants','grey'),I('pants','charcoal'),I('pants','tan'),I('pants','navy'),I('pants','cream'),
   I('shirt','white'),I('shirt','white',{cuff:'french'}),I('shirt','lightblue'),I('shirt','lightblue',{pattern:'gingham',secondaryColor:'white'}),I('shirt','pink'),I('shirt','white',{pattern:'pinstripe',secondaryColor:'blue'}),I('shirt','lavender'),I('shirt','navy'),
   I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','burgundy'),I('tie','burgundy',{pattern:'paisley',secondaryColor:'navy'}),I('tie','green'),I('tie','navy',{pattern:'polka-dot',secondaryColor:'white'}),I('tie','black'),I('tie','silver'),I('tie','purple'),I('tie','grey'),...common()],
  small:[I('suit','navy'),I('suit','brown',{pattern:'chalk-stripe',secondaryColor:'white'}),I('blazer','grey',{pattern:'glen-check'}),I('pants','grey'),I('pants','navy'),I('shirt','white'),I('shirt','lightblue',{pattern:'stripe',secondaryColor:'white'}),I('shirt','pink'),
   I('tie','navy'),I('tie','red',{pattern:'stripe',secondaryColor:'gold'}),I('tie','silver'),...common()]}})()`;
/* the plan of three months as one signature: every day's pieces, vest, score, label and number of notes */
const PLAN_SIG=`(W,n)=>{items=W[n];settings={...settings,workdays:[0,1,2,3,4],blazerDays:[4],vestMode:'auto',darkShirts:'some',learn:null,holidays:null,daysOff:[]};weather={};climate=null;
  TODAY_OVERRIDE='2026-11-08T12:00:00';dayRecs={'2026-11-12':{date:'2026-11-12',formal:true},'2026-11-18':{date:'2026-11-18',occasion:'casual'},'2026-11-24':{date:'2026-11-24',occasion:'wedding'},'2026-12-2':{date:'2026-12-2',occasion:'funeral'},
    '2026-11-16':{date:'2026-11-16',force:{tie:items.find(i=>i.type==='tie').id}},'2026-11-17':{date:'2026-11-17',vest:false}};cache={};
  const lines=[];for(const [y,m] of [[2026,10],[2026,11],[2027,0]]){const P=buildPlan(y,m);for(const k of Object.keys(P).sort()){if(!k.startsWith(y+'-'+(m+1)+'-'))continue;const o=P[k],r=rateOutfit(o);
    lines.push(k+' '+(o.suitDay?'S':'B')+(o.vest?'V':'')+' '+SLOTS.map(s=>o[s]?o[s].id:'-').join(',')+' '+r.score+r.label+' '+r.checks.map(c=>c.label[0]+c.pts).join('')+' '+o.notes.length)}}
  let h=0x811c9dc5;for(const c of lines.join('\\n'))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return {n:lines.length,h:h.toString(16),first:lines[0]}}`;
/* recorded from the app before the dress code (commit 671db36), with the same two strings */
const GOLD={full:'fb07c45e',small:'27343082'};   // small: recorded again after the shirt rule (care.js: a worn shirt waits a day), which changes a wardrobe this small; full is the pre-dress-code recording
const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

module.exports=async({ok,chromium,url,ROOT,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:900},locale:'en-US'});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);

    // ---- 1. the default plans exactly what it did ----
    for(const n of ['full','small']){
      const a=await p.evaluate(`(${PLAN_SIG})(${WARD},'${n}')`),b=await p.evaluate(`(()=>{settings.dress={jacket:true,tie:true};const r=(${PLAN_SIG})(${WARD},'${n}');delete settings.dress;return r})()`);
      ok(a.h===GOLD[n],`with no dress code the "${n}" wardrobe is planned and scored exactly as before (${a.n} days, ${a.h}; before: ${GOLD[n]})`);
      ok(b.h===GOLD[n],`and the same with both switches on (${b.h})`)}

    // ---- 2. the four combinations ----
    const combos=await p.evaluate(`(()=>{const out={};
      for(const [j,t] of [[true,true],[true,false],[false,true],[false,false]]){(${PLAN_SIG})(${WARD},'full');settings.dress={jacket:j,tie:t};cache={};
        const P={...buildPlan(2026,10),...buildPlan(2026,11)},ks=Object.keys(P).filter(k=>keyDate(k)>=todayDate()&&!P[k].frozen).sort((a,b)=>keyDate(a)-keyDate(b)),occ=k=>P[k].occasion,plain=ks.filter(k=>!occ(k));
        const R=k=>rateOutfit(P[k]),sh=plain.map(k=>P[k].shirt&&P[k].shirt.id),ti=plain.map(k=>P[k].tie&&P[k].tie.id);
        out[(j?'J':'-')+(t?'T':'-')]={days:plain.length,
          jackets:plain.filter(k=>P[k].top).length,ties:plain.filter(k=>P[k].tie).length,clips:plain.filter(k=>P[k].clip).length,vests:plain.filter(k=>P[k].vest).length,
          whole:plain.every(k=>P[k].shirt&&P[k].shoes&&P[k].socks&&P[k].belt&&P[k].watch&&(P[k].top||P[k].bot)&&(P[k].suitDay||P[k].bot)),
          incomplete:ks.filter(k=>R(k).label==='Incomplete'||R(k).checks.some(c=>c.label==='Complete outfit')).length,
          min:Math.min(...plain.map(k=>R(k).score)),hard:plain.filter(k=>R(k).hard.length).length,
          tieChecks:plain.filter(k=>R(k).checks.some(c=>/^Tie/.test(c.label))).length,shirtTr:plain.filter(k=>R(k).checks.some(c=>c.label==='Shirt and trousers')).length,
          variety:plain.filter(k=>R(k).checks.some(c=>c.label==='Variety')).length,
          tieNotes:plain.filter(k=>P[k].notes.some(n=>/\\btie\\b/i.test(n))).length,trNotes:plain.filter(k=>P[k].notes.some(n=>/separate trousers/.test(n))).length,
          shirts:new Set(sh).size,shRep:sh.filter((s,n)=>n&&s===sh[n-1]).length,tieRep:ti.filter((s,n)=>n&&s&&s===ti[n-1]&&plain[n]!=='2026-11-16').length,trousers:new Set(plain.map(k=>P[k].bot&&P[k].bot.id)).size,
          formal:['2026-11-12','2026-11-24','2026-12-2'].map(k=>(P[k].top?'J':'-')+(P[k].tie?'T':'-')+(P[k].suitDay?'S':'')).join(),casual:(P['2026-11-18'].top?'J':'-')+(P['2026-11-18'].tie?'T':'-'),
          forced:!!P['2026-11-16'].tie}}
      delete settings.dress;cache={};return out})()`);
    const c=combos,say=x=>JSON.stringify(x);
    ok(c.JT.jackets===c.JT.days&&c.JT.ties===c.JT.days&&c.JT.vests>0&&c.JT.clips>0&&c.JT.incomplete===0,`jackets and ties: every day has both (${say(c.JT)})`);
    ok(c['J-'].jackets===c['J-'].days&&c['J-'].ties===0&&c['J-'].clips===0&&c['J-'].tieChecks===0&&c['J-'].tieNotes===0&&!c['J-'].forced,`jackets, no ties: a jacket every day, never a tie or a tie clip, no tie rule applied, a pinned tie ignored (${say(c['J-'])})`);
    ok(c['-T'].jackets===0&&c['-T'].ties===c['-T'].days&&c['-T'].vests===0&&c['-T'].shirtTr===c['-T'].days,`ties, no jackets: trousers, a shirt and a tie every day, the shirt judged against the trousers (${say(c['-T'])})`);
    ok(c['--'].jackets===0&&c['--'].ties===0&&c['--'].clips===0&&c['--'].vests===0&&c['--'].shirtTr===c['--'].days,`no jackets, no ties: trousers and a shirt (${say(c['--'])})`);
    for(const k of ['JT','J-','-T','--'])ok(c[k].whole&&c[k].incomplete===0&&c[k].min>=85&&c[k].hard===0&&c[k].trNotes===0,`${k}: every outfit is complete, none reads Incomplete, and they score ${c[k].min} or more with no real mistake`);
    for(const k of ['-T','--'])ok(c[k].shirts>=6&&c[k].shRep===0&&c[k].trousers>=4&&c[k].variety>=c[k].days-1&&c[k].tieRep===0,`${k}: without jackets the shirts and trousers still rotate (${c[k].shirts} shirts, ${c[k].trousers} trousers, the same shirt two workdays running ${c[k].shRep} times)`);
    ok(['J-','-T','--'].every(k=>c[k].formal==='JTS,JTS,JTS'),`a formal day, a wedding and a funeral get a suit and a tie whatever the dress code (${c['--'].formal})`);
    ok(c['-T'].casual==='--'&&c.JT.casual==='--','a day marked "No jacket or tie" has neither, also when ties are worn');

    // ---- 3. the score ----
    const sc=await p.evaluate(`(()=>{(${PLAN_SIG})(${WARD},'full');const o=buildPlan(2026,10)['2026-11-10'],R=x=>{const r=rateOutfit(x);return {l:r.label,miss:(r.checks.find(c=>c.label==='Complete outfit')||{}).why||''}};
      const noTie={...o,tie:null,clip:null},noJ={...o,top:null,suitDay:false,vest:false,bot:items.find(i=>i.type==='pants')},out={def:[R(noTie),R(noJ)]};
      settings.dress={jacket:true,tie:false};out.noTies=[R(noTie),R(noJ)];settings.dress={jacket:false,tie:true};out.noJackets=[R(noTie),R(noJ)];settings.dress={jacket:false,tie:false};out.none=[R({...noJ,tie:null,clip:null}),R({...noJ,tie:null,clip:null,shoes:null})];
      delete settings.dress;return out})()`);
    ok(sc.def[0].l==='Incomplete'&&/no tie/.test(sc.def[0].miss)&&sc.def[1].l==='Incomplete'&&/no jacket/.test(sc.def[1].miss),'by default an outfit without a tie or a jacket is Incomplete, as before');
    ok(sc.noTies[0].l!=='Incomplete'&&/no jacket/.test(sc.noTies[1].miss)&&!/no tie/.test(sc.noTies[1].miss),'without ties a tieless outfit is complete; a missing jacket still counts');
    ok(sc.noJackets[1].l!=='Incomplete'&&/no tie/.test(sc.noJackets[0].miss)&&sc.none[0].l!=='Incomplete'&&/^no shoes/.test(sc.none[1].miss),`without jackets a jacketless outfit is complete; other missing pieces still count (${sc.none[1].miss})`);

    // ---- 4. Today, the drawing and the photo ----
    const today=async(dress,d)=>p.evaluate(`(async()=>{(${PLAN_SIG})(${WARD},'full');settings.dress=${JSON.stringify(dress)};if(!settings.dress)delete settings.dress;cache={};sel=new Date(2026,10,${d});view={y:2026,m:10};listOpen=true;scoreOpen=true;show('today');
      const o=planFor()[key(sel)],fig=document.querySelector('#mannequin-container'),a=adviceFor(o);monthOpen=false;toggleMonth();
      const cell=[...document.querySelectorAll('#mpanel .mc')].find(x=>x.getAttribute('aria-label')&&new RegExp('November ${d}\\\\b').test(x.getAttribute('aria-label')));
      const r={rows:[...document.querySelectorAll('#ibox .row > .mut:first-child')].map(e=>e.textContent).join(),none:[...document.querySelectorAll('#ibox .none')].map(e=>e.textContent).join(),sum:document.querySelector('#ibox .mltxt small').textContent,
        open:!!fig.querySelector('.fig-open'),blade:/href="#[^"]*bladeP"/.test(fig.innerHTML),clip:!!fig.querySelector('.fig-clip'),lapels:/href="#[^"]*lapL"/.test(fig.innerHTML),label:fig.querySelector('svg').getAttribute('aria-label'),
        ids:['suitB','suitL','suitR','shirt','tie'].every(x=>!!fig.querySelector('pattern[id$="'+x+'"]')),use:/<clipPath[^>]*>\\s*<use/.test(fig.innerHTML),
        chips:[...document.querySelectorAll('#ibox .pchip')].map(e=>e.title.split(':')[0]).join(),notes:[...document.querySelectorAll('#today .note, #today .notes li')].map(e=>e.textContent).join('|'),
        text:document.querySelector('#today').textContent,fixes:a?a.fixes.map(f=>f.slot).join():'',stuck:a?a.stuck.join():'',cell:cell?cell.getAttribute('aria-label'):'',stackRects:cell?cell.querySelectorAll('svg.stack defs').length:-1,
        photo:outfitText(o),key:comboKey(o),sig:comboSig(o),nojacket:!o.top,keyTie:comboKey({...o,tie:items.find(i=>i.type==='tie')})};
      toggleMonth();return r})()`);
    const tJ=await today({jacket:true,tie:false},10),tD=await today(null,10),tN=await today({jacket:false,tie:false},10),tT=await today({jacket:false,tie:true},10);
    ok(/Tie,Tie clip|Tie,/.test(tD.rows)&&!tD.open&&tD.blade,'by default Today lists the tie and draws it');
    ok(/^Suit/.test(tJ.rows)&&!/Tie/.test(tJ.rows)&&!/Add one/.test(tJ.none)&&!/Tie/.test(tJ.chips)&&!/\btie\b/i.test(tJ.sum)&&!/tie/.test(tJ.fixes)&&!/Tie/.test(tJ.stuck),`without ties Today has no tie row, prompt, chip or advice (${tJ.rows})`);
    ok(tJ.open&&!tJ.blade&&!tJ.clip&&tJ.lapels&&/open collar/.test(tJ.label)&&tJ.ids&&!tJ.use,'the jacket is drawn over an open collar with a placket, no tie or clip; the pattern ids stay');
    ok(!/Suit|Blazer|Tie/.test(tN.rows)&&/^Pants,Shirt/.test(tN.rows)&&!/Add one/.test(tN.none)&&tN.open&&!tN.lapels&&!tN.blade&&/no jacket, open collar/.test(tN.label)&&tN.ids,`without jackets or ties Today lists trousers and a shirt and draws shirt sleeves with an open collar (${tN.rows})`);
    ok(/^Pants,Shirt,Tie/.test(tT.rows)&&!tT.open&&tT.blade&&!tT.lapels,`without jackets but with ties: shirt sleeves and a tie (${tT.rows})`);
    ok(!/No jacket/.test(tN.cell)&&/trousers/i.test(tN.cell)&&tN.stackRects===2&&tJ.stackRects===2&&tD.stackRects===3,`the month's stacks show only what is worn (${tN.cell})`);
    ok(!/Incomplete/.test(tJ.text)&&!/Incomplete/.test(tN.text)&&!/Incomplete/.test(tT.text),'no day reads Incomplete on Today');
    ok(/collar open/.test(tJ.photo)&&/no tie/.test(tJ.photo)&&!/ tie[;,]| tie$/.test(tJ.photo.replace(/no tie/g,''))&&tJ.key!==tJ.keyTie&&/\|-\|/.test(tJ.sig)&&!tJ.nojacket,`a jacket without a tie is described with an open collar and has its own photo key (${tJ.photo})`);
    ok(/no jacket/.test(tN.photo)&&/collar open with no tie/.test(tN.photo)&&tN.nojacket&&tN.key!==tN.keyTie&&/no jacket/.test(tT.photo)&&!/no tie/.test(tT.photo),'shirt sleeves without a tie likewise; with a tie it is listed');
    // what the server's prompt says for it
    const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default,realFetch=globalThis.fetch,prompts=[];
    globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.openai.com/v1/images/edits')return new Response('',{status:404});prompts.push(init.body.get('prompt'));
      return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}})};
    try{for(const [text,nj] of [[tJ.photo,false],[tN.photo,true]]){
        await worker.fetch(new Request('https://w.test/render',{method:'POST',headers:{'content-type':'application/json','x-app-token':'t'},body:JSON.stringify({image:'data:image/jpeg;base64,'+JPG,refs:[],labels:[],outfit:text,key:'c7e57000000000d0'+(nj?'2':'1'),sig:'x',...(nj?{nojacket:true}:{})})}),{APP_TOKEN:'t',OPENAI_API_KEY:'k'})}}
    finally{globalThis.fetch=realFetch}
    ok(prompts.length===2&&/if none is listed he wears no tie: the shirt collar is open/.test(prompts[0])&&/collar open/.test(prompts[0])&&!/shirt, silk tie,/.test(prompts[0])&&/no tie unless one is listed/.test(prompts[1]),'the photo prompt asks for an open collar and no tie when none is listed, with and without a jacket');

    // ---- 5. stats and what to buy ----
    const st=await p.evaluate(`(()=>{(${PLAN_SIG})(${WARD},'full');settings.dress={jacket:true,tie:false};cache={};dayRecs={};const S=buildStats(),tie=items.find(i=>i.type==='tie');
      const r={unused:S.unused.map(x=>x.i.type).join(),ties:S.ties.length,pairs:S.pairs.length,why:whyUnused(tie)};
      settings.dress={jacket:false,tie:false};cache={};const S2=buildStats();r.unused2=[...new Set(S2.unused.map(x=>x.i.type))].join();r.jackets2=S2.jackets.length;r.whySuit=whyUnused(items.find(i=>i.type==='suit'));r.whyAll=S2.unused.map(x=>whyUnused(x.i)).join('|');
      delete settings.dress;cache={};return r})()`);
    ok(!/tie/.test(st.unused)&&st.ties===0&&st.pairs===0&&/dress code leaves out ties/.test(st.why),`without ties the stats don't count ties or tie clips as never worn (${st.unused||'none'})`);
    ok(!/suit|blazer|tie/.test(st.unused2)&&st.jackets2===0&&/dress code leaves out jackets/.test(st.whySuit)&&!/Infinity|NaN|blazer|jacket/.test(st.whyAll),`without jackets they don't count suits and blazers either (${st.unused2||'none'}: ${st.whyAll})`);
    const shop=await p.evaluate(`(()=>{(${PLAN_SIG})(${WARD},'small');dayRecs={};const T=todayDate(),out={};
      for(const [n,d] of [['def',null],['noTie',{jacket:true,tie:false}],['none',{jacket:false,tie:false}]]){if(d)settings.dress=d;else delete settings.dress;const r=runAnalysis(items,T,6),recs=r.cats.flatMap(c=>c.recs);
        out[n]={cats:r.cats.map(c=>c.key).join(),types:[...new Set(recs.flatMap(x=>x.items.map(i=>i.type)))].join(),why:recs.flatMap(x=>x.why).join(' '),idle:r.base.idle.map(i=>i.type).join(),avg:r.base.avg,sig:shopSig().split('|').slice(-2).join('|')}}
      delete settings.dress;cache={};return out})()`);
    ok(/tie/.test(shop.def.cats)&&/suit/.test(shop.def.cats)&&!/nojacket|notie/.test(shop.def.sig),`by default the what-to-buy check covers suits and ties (${shop.def.cats})`);
    ok(!/\btie\b/.test(shop.noTie.cats)&&!/tie/.test(shop.noTie.types)&&!/\bties?\b|tie clip/.test(shop.noTie.why)&&!/tie/.test(shop.noTie.idle)&&/suit/.test(shop.noTie.cats)&&/shirt/.test(shop.noTie.types)&&/notie/.test(shop.noTie.sig),`without ties it suggests no tie or tie clip and names none in its reasons (${shop.noTie.types})`);
    ok(!/suit|blazer|\btie\b/.test(shop.none.cats)&&!/suit|blazer|tie/.test(shop.none.types)&&!/suit|blazer|tie/.test(shop.none.idle)&&shop.none.avg>=85&&/nojacket\|notie/.test(shop.none.sig),`without jackets it suggests no suit or blazer, and checks again (${shop.none.cats}; ${shop.none.types||'no ideas'})`);

    // ---- 6. Settings ----
    await p.evaluate(`(async()=>{(${PLAN_SIG})(${WARD},'full');dayRecs={};delete settings.dress;cache={};sel=new Date(2026,10,9);view={y:2026,m:10};show('today')})()`);
    await p.waitForFunction(()=>['2026-11-10','2026-11-11','2026-11-12'].every(k=>dayRecs[k]&&dayRecs[k].lock),null,{timeout:8000});
    await p.evaluate(()=>openSettings('schedule'));await settle(p,400);
    const s0=await p.evaluate(()=>({sw:[...document.querySelectorAll('#cfg-dress .dress-sw')].map(b=>b.getAttribute('role')+':'+b.getAttribute('aria-checked')+':'+Math.round(b.getBoundingClientRect().height)).join(),
      labels:[...document.querySelectorAll('#cfg-dress .dress-txt b')].map(b=>b.textContent).join('|'),help:[...document.querySelectorAll('#cfg-dress .dress-txt small')].every(s=>s.textContent.length>20),
      blazer:document.querySelector('#blazer-group').offsetHeight>0,vest:document.querySelector('#vest-row').offsetHeight>0,sum:document.querySelector('#sum-schedule').textContent,wide:document.documentElement.scrollWidth<=innerWidth}));
    ok(s0.sw==='switch:true:44,switch:true:44'&&s0.labels==='Jackets (suits and blazers)|Ties'&&s0.help&&s0.blazer&&s0.vest&&/vest/.test(s0.sum)&&s0.wide,`Settings → Schedule has the two dress-code switches, both on, each with its help (${s0.labels}; ${s0.sum})`);
    await p.click('#dress-tie');await p.waitForFunction(()=>settings.dress&&settings.dress.tie===false&&document.querySelector('#dress-tie').getAttribute('aria-checked')==='false');
    const s1=await p.evaluate(async()=>({dress:JSON.stringify(settings.dress),locks:Object.values(dayRecs).filter(r=>r.lock&&keyDate(r.date)>todayDate()).length,stored:JSON.stringify((await metaGet('settings')).dress),sum:document.querySelector('#sum-schedule').textContent,stamped:settings.updated>0}));
    ok(s1.dress==='{"jacket":true,"tie":false}'&&s1.stored===s1.dress&&s1.locks===0&&/no ties/.test(s1.sum)&&s1.stamped,`switching ties off is saved and releases the locked week (${s1.sum})`);
    await p.click('#dress-jacket');await p.waitForFunction(()=>settings.dress.jacket===false&&document.querySelector('.dress-note'));
    const s2=await p.evaluate(()=>({blazer:document.querySelector('#blazer-group').offsetHeight,vest:document.querySelector('#vest-row').offsetHeight,note:document.querySelector('.dress-note').textContent,sum:document.querySelector('#sum-schedule').textContent}));
    ok(s2.blazer===0&&s2.vest===0&&/Blazer days and the suit vest/.test(s2.note)&&/no jackets or ties/.test(s2.sum)&&!/vest|blazers/.test(s2.sum),`with jackets off the blazer days and the vest setting are hidden, with a note (${s2.sum})`);
    await p.evaluate(()=>saveSettings());await p.waitForFunction(()=>!settingsOpen()&&!document.querySelector('.fig svg [href$="lapL"]')&&!!document.querySelector('.fig .fig-open'));
    ok(await p.evaluate(()=>{const o=planFor()[key(sel)];return !o.top&&!o.tie&&!!o.bot&&!/Incomplete/.test(document.querySelector('#today').textContent)}),'Today is planned again without a jacket or tie once Settings closes');
    await p.evaluate(()=>openSettings('schedule'));await settle(p,300);await p.click('#dress-jacket');await p.waitForFunction(()=>settings.dress.jacket===true);await p.click('#dress-tie');await p.waitForFunction(()=>settings.dress.tie===true);
    const s3=await p.evaluate(()=>({blazer:document.querySelector('#blazer-group').offsetHeight>0,note:!!document.querySelector('.dress-note'),j:wearsJacket(),t:wearsTie()}));
    ok(s3.blazer&&!s3.note&&s3.j&&s3.t,'switching both back on brings the blazer days and the vest setting back');
    await p.evaluate(()=>{closeSettings();delete settings.dress});
    // both themes, phone and the unfolded Duo
    for(const [w,theme] of [[390,'dark'],[626,'light']]){await p.setViewportSize({width:w,height:900});
      const v=await p.evaluate(async t=>{document.documentElement.dataset.theme=t;settings.dress={jacket:false,tie:true};openSettings('schedule');await new Promise(r=>setTimeout(r,0));
        const cs=e=>getComputedStyle(e),on=document.querySelector('#dress-tie i'),off=document.querySelector('#dress-jacket i'),m=document.querySelector('#settings-modal');
        const r={on:cs(on).backgroundColor,off:cs(off).backgroundColor,knob:cs(on,'::after').backgroundColor,ink:cs(document.documentElement).getPropertyValue('--ink').trim(),wide:m.scrollWidth<=m.clientWidth+1,
          right:document.querySelector('#dress-tie').getBoundingClientRect().right<=m.getBoundingClientRect().right};closeSettings();delete settings.dress;delete document.documentElement.dataset.theme;return r},theme);
      ok(v.on!==v.off&&v.wide&&v.right,`${w}px, ${theme}: the switches fit and on reads differently from off (${v.on} / ${v.off})`)}
    await p.setViewportSize({width:390,height:900});

    // ---- 7. waistcoats ----
    const hv=await p.evaluate(()=>{delete settings.vestDef;const a=[hasVest({type:'suit'}),hasVest({type:'suit',vest:'yes'}),hasVest({type:'suit',vest:'no'}),hasVest({type:'blazer',vest:'yes'})];settings.vestDef=1;
      const b=[hasVest({type:'suit'}),hasVest({type:'suit',vest:'yes'}),hasVest({type:'suit',vest:'no'})];delete settings.vestDef;return a.join()+'|'+b.join()});
    ok(hv==='true,true,false,false|false,true,false',`a suit has a waistcoat only when it says so; one with no value keeps it until its wardrobe is marked (${hv})`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();

    // a wardrobe from before: its suits stay three-piece, a suit added afterwards is two-piece
    {const c2=await browser.newContext({viewport:{width:390,height:900}}),q=await c2.newPage(),e2=[];q.on('pageerror',e=>e2.push(e.message));
      await q.goto(url);await q.waitForFunction(()=>window.appReady);
      const fresh=await q.evaluate(async()=>({n:await migrateVests(),flag:!!settings.vestDef,stored:await metaGet('settings')}));
      ok(fresh.n===0&&!fresh.flag&&!(fresh.stored&&fresh.stored.vestDef),'an empty wardrobe is left alone at start-up');
      await q.evaluate(async()=>{const I=(id,type,x={})=>({id,type,primaryColor:'navy',pattern:'solid',added:1000,...x});
        for(const i of [I('s1','suit'),I('s2','suit',{primaryColor:'charcoal',vest:'no'}),I('s3','suit',{primaryColor:'grey',vest:'yes',updated:2000}),I('b1','blazer'),I('h1','shirt',{primaryColor:'white'}),I('t1','tie',{primaryColor:'burgundy'})])await putRaw(i);
        await metaPut('settings',{workdays:[0,1,2,3,4],blazerDays:[4],vestMode:'auto',units:'C',planRules:PLAN_RULES,updated:5000})});
      await q.reload();await q.waitForFunction(()=>window.appReady&&settings.vestDef===1,null,{timeout:10000});
      const m=await q.evaluate(async()=>{const all=await tx('readonly',s=>s.getAll()),by=Object.fromEntries(all.map(i=>[i.id,i])),st=await metaGet('settings');
        return {vests:['s1','s2','s3'].map(id=>by[id].vest).join(),has:['s1','s2','s3'].map(id=>hasVest(items.find(i=>i.id===id))).join(),stamped:by.s1.updated>5000,s2:by.s2.updated||0,s3:by.s3.updated,b1:by.b1.vest===undefined&&!by.b1.updated,
          flag:st.vestDef,units:st.units,newer:st.updated>5000,again:await migrateVests()}});
      ok(m.vests==='yes,no,yes'&&m.has==='true,false,true'&&m.stamped&&m.s2===0&&m.s3===2000&&m.b1,`the suits of a wardrobe from before keep their waistcoat: each with no value is saved as "Matching vest" with a new stamp, the others are untouched (${m.vests})`);
      ok(m.flag===1&&m.units==='C'&&m.newer&&m.again===0,'the wardrobe is marked in its synced settings, which keep their other values, and it is not done twice');
      // a suit added on the Add card, and one bought from the what-to-buy sheet
      await q.evaluate(()=>{queue=[{id:'n1',type:'suit',primaryColor:'brown',pattern:'solid',manual:true}];show('add')});
      await q.waitForFunction(()=>!!document.querySelector('#queue select'));
      const sel0=await q.evaluate(()=>{const s=[...document.querySelectorAll('#queue label')].find(l=>/^Vest/.test(l.textContent)).querySelector('select');return s.selectedOptions[0].textContent});
      await q.evaluate(()=>save(0));await q.waitForFunction(()=>items.some(i=>i.id==='n1'));
      const n1=await q.evaluate(()=>{const i=items.find(x=>x.id==='n1');return {vest:i.vest,has:hasVest(i)}});
      ok(sel0==='No vest'&&n1.vest==='no'&&!n1.has,`a suit added afterwards is two-piece, and the Add card's Vest choice shows it (${sel0})`);
      await q.evaluate(()=>{queue=[{id:'n2',type:'suit',primaryColor:'tan',pattern:'solid',manual:true,vest:'yes'}];return save(0)});await q.waitForFunction(()=>items.some(i=>i.id==='n2'));
      await q.evaluate(()=>{show('wardrobe');openItem('n1')});await q.waitForFunction(()=>!!document.querySelector('#item-view select'));
      const ed=await q.evaluate(()=>{const pick=()=>{const s=[...document.querySelectorAll('#item-view select')].find(s=>[...s.options].some(o=>o.textContent==='Matching vest'));return s?s.selectedOptions[0].textContent:''};
        const a=pick();openItem('s1');const b=pick();closeItem();return {a,b,n2:hasVest(items.find(i=>i.id==='n2')),need:typeof asmNeeds==='function'?asmNeeds().filter(x=>x.kind==='piece'&&x.slot==='vest').length:-1,
          never:(()=>{settings.vestMode='never';const n=asmNeeds().filter(x=>/vest/.test(x.kind)||x.slot==='vest').length;settings.vestMode='auto';return n})()}});
      ok(ed.a==='No vest'&&ed.b==='Matching vest'&&ed.n2,`the editor shows each suit's own answer (${ed.a} / ${ed.b}); "Matching vest" on the Add card is kept`);
      ok(ed.need===3&&ed.never===0,`assembled pictures ask for a waistcoat photo only for the suits that have one (${ed.need}), none when vests are never worn`);
      const pl=await q.evaluate(()=>{settings.workdays=[0,1,2,3,4];settings.blazerDays=[];weather={};climate=null;dayRecs={};TODAY_OVERRIDE='2026-11-08T12:00:00';for(const i of items)if(i.type==='suit')delete i.paused;cache={};
        const P=buildPlan(2026,10),o=Object.entries(P).filter(([k,o])=>k.startsWith('2026-11-')&&o.suitDay&&!o.frozen).map(x=>x[1]);return {yes:o.filter(x=>['s1','s3','n2'].includes(x.top.id)).every(x=>x.vest),no:o.filter(x=>['s2','n1'].includes(x.top.id)).every(x=>!x.vest),n:o.length,
          both:o.some(x=>x.vest)&&o.some(x=>!x.vest)}});
      ok(pl.yes&&pl.no&&pl.both,`the planner wears the waistcoat with the three-piece suits only (${pl.n} suit days)`);
      const bought=await q.evaluate(async()=>{shop={sig:'x',at:Date.now(),res:{cats:[{key:'suit',recs:[{key:'suit|k',name:'plain olive suit',items:[{id:'cand-1',type:'suit',primaryColor:'olive',pattern:'solid',added:0}],why:[]}]}],top:[]}};
        await shopBought('suit|k');if(shopWorker){shopWorker.terminate();shopWorker=null}const i=items.find(x=>x.primaryColor==='olive');return i?{vest:i.vest,has:hasVest(i),order:!!i.order}:null});
      ok(bought&&bought.vest==='no'&&!bought.has&&bought.order,'a suit added with "Bought it" is two-piece too');
      ok(e2.length===0,'no page errors ('+e2.join('; ')+')');await c2.close()}

    // a new wardrobe: marked when its first item is added, without stamping the settings
    {const c3=await browser.newContext({viewport:{width:390,height:900}}),q=await c3.newPage();await q.goto(url);await q.waitForFunction(()=>window.appReady);
      await q.waitForFunction(()=>settings.planRules===PLAN_RULES);const u0=await q.evaluate(()=>settings.updated);
      await q.evaluate(()=>{queue=[{id:'f1',type:'suit',primaryColor:'navy',pattern:'solid',manual:true}];return save(0)});await q.waitForFunction(()=>items.some(i=>i.id==='f1'));
      const f=await q.evaluate(async u0=>{const st=await metaGet('settings');return {flag:settings.vestDef,stored:st&&st.vestDef,updated:st.updated!==u0,vest:items[0].vest,has:hasVest(items[0]),has2:hasVest({type:'suit'})}},u0);
      ok(f.flag===1&&f.stored===1&&!f.updated&&f.vest==='no'&&!f.has&&!f.has2,'a new wardrobe is marked when its first item is added (the settings get no new stamp for it), and its suits are two-piece');
      await c3.close()}

    // two devices on one backup, in either order
    {const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default,store=new Map(),meta=new Map();
      const KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v,o)=>{store.set(k,v);meta.set(k,o&&o.metadata)},
        list:async({prefix})=>({keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name,metadata:meta.get(name)})),list_complete:true})};
      const env={APP_TOKEN:'secret',WARDROBE:KV},HOST='https://dress-sync.test/';let online=true;
      const device=async()=>{const c=await browser.newContext();
        await c.route(HOST+'**',async route=>{if(!online)return route.abort();const r=route.request();
          const res=await worker.fetch(new Request(r.url(),{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()}),env);
          await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()})});
        const q=await c.newPage();await q.goto(url);await q.waitForFunction(()=>window.appReady);return {c,q}};
      const connect=q=>q.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','secret')},HOST);
      const state=q=>q.evaluate(async()=>{const all=await tx('readonly',s=>s.getAll()),st=await metaGet('settings');return {suits:all.filter(i=>i.type==='suit').map(i=>i.id+':'+i.primaryColor+':'+i.vest).sort().join(),flag:st&&st.vestDef,units:st&&st.units,
        has:items.filter(i=>i.type==='suit').map(i=>hasVest(i)).join()}});
      // both hold the wardrobe from before; A then changed a suit and a setting that B has not seen yet
      const A=await device(),B=await device();
      const seed=q=>q.evaluate(async()=>{const I=(id,c)=>({id,type:'suit',primaryColor:c,pattern:'solid',added:1000});for(const i of [I('s1','navy'),I('s2','grey')])await putRaw(i);await metaPut('settings',{workdays:[0,1,2,3,4],blazerDays:[4],vestMode:'auto',units:'C',planRules:PLAN_RULES,updated:5000})});
      await seed(A.q);await seed(B.q);
      await A.q.evaluate(async()=>{await putRaw({id:'s1',type:'suit',primaryColor:'charcoal',pattern:'solid',added:1000,updated:Date.now()-60000});await metaPut('settings',{workdays:[0,1,2,3,4],blazerDays:[4],vestMode:'auto',units:'F',planRules:PLAN_RULES,updated:Date.now()-60000})});
      store.set('wardrobe:v1',JSON.stringify({rev:1,saved:Date.now()-50000,data:await A.q.evaluate(()=>localState())}));meta.set('wardrobe:v1',{rev:1,saved:Date.now()-50000});
      // B opens first, with the backup out of reach: nothing is changed, and its suits still read as three-piece
      online=false;await connect(B.q);await B.q.reload();await B.q.waitForFunction(()=>window.appReady);await B.q.waitForFunction(()=>!syncing&&!vestMigrating&&/failed/i.test(localStorage.getItem('sync_status')||''),null,{timeout:15000});
      const b0=await state(B.q);
      ok(b0.suits==='s1:navy:undefined,s2:grey:undefined'&&!b0.flag&&b0.has==='true,true',`a device that can't reach the backup changes nothing yet, and its suits stay three-piece (${b0.suits})`);
      // back online: it takes the other device's newer suit and settings first, then gives the suits their value
      online=true;await B.q.reload();await B.q.waitForFunction(()=>window.appReady&&settings.vestDef===1,null,{timeout:15000});
      await B.q.waitForFunction(()=>!syncing&&!vestMigrating);await B.q.evaluate(()=>syncNow());
      const b1=await state(B.q),kv=JSON.parse(store.get('wardrobe:v1')).data;
      ok(b1.suits==='s1:charcoal:yes,s2:grey:yes'&&b1.flag===1&&b1.units==='F'&&b1.has==='true,true',`with the backup in reach it syncs first, so the other device's newer suit and settings are kept (${b1.suits}, °${b1.units})`);
      ok(kv.settings.vestDef===1&&kv.items.filter(i=>i.type==='suit').every(i=>i.vest==='yes'),'the suits and the mark are in the backup');
      // A opens afterwards: it receives both and has nothing to do
      await connect(A.q);await A.q.reload();await A.q.waitForFunction(()=>window.appReady&&settings.vestDef===1,null,{timeout:15000});await A.q.waitForFunction(()=>!syncing&&!vestMigrating);
      const a1=await state(A.q),same=await A.q.evaluate(()=>items.filter(i=>i.type==='suit').map(i=>i.updated).sort().join()),sameB=await B.q.evaluate(()=>items.filter(i=>i.type==='suit').map(i=>i.updated).sort().join());
      ok(a1.suits===b1.suits&&a1.flag===1&&a1.units==='F'&&same===sameB,'the other device receives the suits and the mark and changes nothing itself');
      // a suit added on A now is two-piece on both
      await A.q.evaluate(()=>{queue=[{id:'n9',type:'suit',primaryColor:'tan',pattern:'solid',manual:true}];return save(0)});await A.q.waitForFunction(()=>items.some(i=>i.id==='n9'));await A.q.evaluate(()=>syncNow());await B.q.evaluate(()=>syncNow());
      const b2=await B.q.evaluate(()=>items.filter(i=>i.type==='suit').map(i=>i.id+':'+hasVest(i)).sort().join());
      ok(b2==='n9:false,s1:true,s2:true',`a suit added after that is two-piece on both devices (${b2})`);
      // a device with a newer mark that receives older, unmarked settings and suits from before drops the mark and gives them their value
      const C=await device();await C.q.evaluate(async()=>{settings.vestDef=1;items=[{id:'x1',type:'suit',primaryColor:'black',pattern:'solid',added:1}];await putRaw(items[0]);dressSynced({settings:{updated:1}})});
      await C.q.waitForFunction(()=>settings.vestDef===1&&items[0].vest==='yes'&&!vestMigrating);
      ok(await C.q.evaluate(()=>hasVest(items[0])),'settings that arrive by sync without the mark are taken as they are: the suits that came with them keep their waistcoat');
      await A.c.close();await B.c.close();await C.c.close()}
  }finally{await browser.close()}
};
module.exports.PLAN_SIG=PLAN_SIG;module.exports.WARD=WARD;
module.exports.realPlanner=true;   // runs the real planner (the dress code is planning); other tests get tests/fixedplan.js
