// Occasions (Settings → Occasions): formal as before, plus a funeral, a wedding and a day with no jacket or tie.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const realFetch=globalThis.fetch,prompts=[];
  globalThis.fetch=async(href,init)=>{if(String(href)!=='https://api.openai.com/v1/images/edits')return new Response('',{status:404});prompts.push(init.body.get('prompt'));
    return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}})};
  const env={APP_TOKEN:'t',OPENAI_API_KEY:'k'},HOST='https://w.test/';
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:900},locale:'en-US'});
    await ctx.route(HOST+'**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t');localStorage.setItem('last_sync',String(Date.now()))},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;window.I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','black'),I('suit','navy'),I('suit','charcoal'),I('suit','lightgrey'),I('suit','brown'),I('suit','tan'),I('blazer','navy'),I('pants','grey'),I('pants','tan'),I('pants','navy'),
        I('shirt','white'),I('shirt','white'),I('shirt','lightblue'),I('shirt','pink'),I('shirt','navy'),
        I('tie','black'),I('tie','burgundy'),I('tie','navy'),I('tie','silver',{pattern:'paisley',secondaryColor:'lightblue'}),I('tie','pink'),I('tie','green'),I('tieclip','silver',{metal:'silver'}),
        I('shoes','black',{leather:'calf'}),I('shoes','brown',{leather:'calf'}),I('shoes','brown',{leather:'suede'}),I('belt','black',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('belt','brown',{leather:'suede',metal:'silver'}),
        I('socks','navy'),I('socks','charcoal'),I('socks','black'),I('watch','silver',{metal:'silver'})];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];settings.vestMode='auto';settings.learn=null;dayRecs={};weather={};climate=null;TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
    // ---- the planner ----
    const r=await p.evaluate(()=>{const day=(k,occ)=>{dayRecs={};if(occ)dayRecs[k]=occ==='formal'?{date:k,formal:true}:{date:k,occasion:occ};cache={};const pl=planMonth(2026,10),o=pl[k],ra=rateOutfit(o);
        const prevK=Object.keys(pl).filter(x=>keyDate(x)<keyDate(k)).pop();
        return {top:o.top&&o.top.primaryColor,kind:o.top&&o.top.type,suitDay:o.suitDay,bot:o.bot&&o.bot.type,shirt:o.shirt&&o.shirt.primaryColor,tie:o.tie&&o.tie.primaryColor,tiePat:o.tie&&o.tie.pattern,shoes:o.shoes&&o.shoes.primaryColor+' '+o.shoes.leather,
          clip:!!o.clip,vest:o.vest,occ:o.occasion,formal:o.formal,score:ra.score,checks:Object.fromEntries(ra.checks.map(c=>[c.label,c.pts+'/'+c.max])),notes:o.notes,prevTop:pl[prevK].top&&pl[prevK].top.primaryColor}};
      // every Tuesday-to-Thursday of two weeks, so rotation cannot hide a wrong choice
      const ks=['2026-11-11','2026-11-12','2026-11-15','2026-11-16','2026-11-17','2026-11-18'];
      return {plain:day('2026-11-12',null),fun:ks.map(k=>day(k,'funeral')),wed:ks.map(k=>day(k,'wedding')),cas:ks.map(k=>day(k,'casual')),formal:day('2026-11-12','formal')}});
    ok(r.fun.every(o=>o.top==='black'&&o.kind==='suit'&&o.shirt==='white'&&o.tie==='black'&&o.shoes==='black calf'&&o.occ==='funeral'),`a funeral always gets the black suit, a white shirt, the black tie and black shoes, whatever the rotation says (${r.fun.map(o=>o.top+'/'+o.shirt+'/'+o.tie+'/'+o.shoes).join(' | ')})`);
    ok(r.fun.every(o=>o.prevTop!=='black'),'the black suit is kept back on the day before the funeral');
    ok(r.fun.every(o=>o.checks.Funeral==='10/10'&&o.checks['Tie and jacket']==='10/10'&&o.score>=90),`a black tie on a black suit scores full marks at a funeral (${r.fun[0].score}); on other days it is marked down`);
    ok(r.wed.every(o=>o.kind==='suit'&&o.top!=='black'&&['white','lightblue','pink'].includes(o.shirt)&&o.tie!=='black'&&!/suede/.test(o.shoes)&&o.checks.Wedding==='10/10'),`a wedding gets a suit that is not black, a light shirt, a tie that is not black, smooth shoes (${r.wed.map(o=>o.top+'/'+o.shirt+'/'+o.tie).join(' | ')})`);
    ok(r.wed.filter(o=>['navy','lightgrey'].includes(o.top)).length>=5&&r.wed.some(o=>['silver','pink'].includes(o.tie))&&r.wed.every(o=>o.vest),`it favours navy or light grey with a lively tie, and wears the vest (${r.wed.map(o=>o.tie).join()})`);
    ok(r.cas.every(o=>o.top===null&&o.tie===null&&!o.clip&&!o.vest&&o.bot==='pants'&&o.shirt&&o.suitDay===false&&o.occ==='casual'&&o.score>=85),`a no-jacket day is trousers and a shirt: no jacket, tie, clip or vest (score ${r.cas.map(o=>o.score).join()})`);
    ok(r.cas.every(o=>!('Tie and shirt' in o.checks)&&'Shirt and trousers' in o.checks),'its score judges the shirt against the trousers instead of the tie and jacket');
    ok(r.formal.formal&&r.formal.occ==='formal'&&['navy','charcoal','black'].includes(r.formal.top)&&r.formal.shirt==='white'&&r.formal.shoes==='black calf','a formal day still works as before');
    ok(r.plain.occ===null&&r.plain.kind==='blazer','a day without an occasion is unchanged');
    const gaps=await p.evaluate(()=>{const keep=items;items=items.filter(i=>!(i.type==='tie'&&i.primaryColor==='black')&&!(i.type==='suit'&&['black','navy','charcoal'].includes(i.primaryColor)));dayRecs={'2026-11-12':{date:'2026-11-12',occasion:'funeral'}};cache={};
      const o=planMonth(2026,10)['2026-11-12'];items=keep.filter(i=>i.type!=='pants');dayRecs={'2026-11-12':{date:'2026-11-12',occasion:'casual'}};cache={};const c=planMonth(2026,10)['2026-11-12'];items=keep;dayRecs={};cache={};
      return {notes:o.notes.join(' / '),tie:o.tie.primaryColor,casual:c.notes.join(' / '),cshirt:!!c.shirt}});
    ok(/No black tie/.test(gaps.notes)&&/No black, charcoal or navy suit/.test(gaps.notes)&&gaps.tie==='navy',`without a black tie or dark suit it picks the darkest and says so (${gaps.tie})`);
    ok(/No separate trousers/.test(gaps.casual)&&gaps.cshirt,'a no-jacket day without odd trousers says so');
    // ---- Settings → Occasions ----
    await p.evaluate(()=>openSettings('daysoff'));
    ok((await p.locator('#cfg-occasion option').allTextContents()).join()==='Formal,Wedding,Funeral,No jacket or tie','Settings offers the four occasions');
    const add=async(date,occ)=>{await p.fill('#cfg-formal-date',date);await p.selectOption('#cfg-occasion',occ);await p.evaluate(()=>{$('#formal-msg').textContent=''});await p.click('#occ-add');await p.waitForFunction(()=>/is now/.test($('#formal-msg').textContent),null,{timeout:8000})};
    await add('2026-11-17','wedding');const m1=await p.textContent('#formal-msg');await add('2026-11-18','casual');const m2=await p.textContent('#formal-msg');await add('2026-11-19','funeral');
    const chips=await p.locator('#formal-list .fchip').allTextContents();
    ok(/is now a wedding day: a lighter suit/.test(m1)&&/is now a day without a jacket or tie/.test(m2)&&chips.length===3&&/Nov 17 · Wedding/.test(chips[0])&&/No jacket or tie/.test(chips[1])&&/Funeral/.test(chips[2]),`occasions are added by date and listed (${chips.join(' | ')})`);
    await p.click('#occ-add');
    ok(/already a funeral day/.test(await p.textContent('#formal-msg')),'adding the same occasion again says so');
    await p.evaluate(()=>closeSettings());
    // ---- Today ----
    const t=await p.evaluate(()=>{const go=d=>{sel=new Date(2026,10,d);view={y:2026,m:10};listOpen=true;renderToday();return {tag:(document.querySelector('.ftag')||{}).textContent,rows:[...document.querySelectorAll('#ibox .row > .mut:first-child')].map(e=>e.textContent).join(),
          lapels:/href="#[^"]*lapL"/.test(document.querySelector('#mannequin-container').innerHTML),label:document.querySelector('#mannequin-container svg').getAttribute('aria-label'),sum:document.querySelector('#ibox .mltxt small').textContent}};
      const w=go(17),c=go(18),f=go(19);monthOpen=false;toggleMonth();const cell=[...document.querySelectorAll('#mpanel .mc')].find(x=>/November 18/.test(x.getAttribute('aria-label')));
      const o=planFor()['2026-11-18'],o2={...o,bot:items.find(i=>i.type==='pants'&&i.id!==o.bot.id)};
      return {w,c,f,cellCls:cell.className,cellLabel:cell.getAttribute('aria-label'),stack:!!cell.querySelector('svg.stack'),text:outfitText(o),keyDiff:comboKey(o)!==comboKey(o2),refs:outfitRefs(o).labels.join()}});
    ok(t.w.tag==='Wedding'&&t.f.tag==='Funeral'&&t.c.tag==='No jacket','Today shows the day\'s occasion');
    ok(!t.c.lapels&&t.w.lapels&&/no jacket/.test(t.c.label)&&!/Suit|Blazer|Tie/.test(t.c.rows)&&/Pants,Shirt/.test(t.c.rows)&&/trousers/i.test(t.c.sum),`the no-jacket day is drawn in shirt sleeves and lists no jacket or tie (${t.c.rows})`);
    ok(/planned/.test(t.cellCls)&&t.stack&&/No jacket/.test(t.cellLabel),`the month shows it as an outfit (${t.cellLabel})`);
    ok(/no jacket/.test(t.text)&&/collar open with no tie/.test(t.text)&&/trousers|pants/.test(t.text)&&t.keyDiff,'its photo is described without a jacket or tie, and the trousers are part of the look');
    // the photo prompt: shirt sleeves for the no-jacket day, the jacket pose otherwise
    await p.evaluate(()=>{sel=new Date(2026,10,18);renderToday()});await p.evaluate(()=>generateRender());await p.waitForFunction(()=>!rendering,null,{timeout:15000});
    await p.evaluate(()=>{sel=new Date(2026,10,17);renderToday()});await p.evaluate(()=>generateRender());await p.waitForFunction(()=>!rendering,null,{timeout:15000});
    ok(prompts.length===2&&/in shirt sleeves with no jacket/.test(prompts[0])&&!/waist button/.test(prompts[0])&&/waist button, fastening it/.test(prompts[1])&&/just below the jacket pocket flaps/.test(prompts[1])&&/both shoulders and both elbows fully inside the picture/.test(prompts[1])&&/crown and pushers point toward the hand/.test(prompts[1])&&prompts.every(t=>/a smooth creamy blur with no sharp detail anywhere: a plain light office wall/.test(t)&&!/bright office/.test(t)),'the realistic photo of a no-jacket day asks for shirt sleeves; other days keep the jacket pose');
    // re-planning keeps the occasions; × makes a day regular again
    const keep=await p.evaluate(async()=>{await swapSlot('shirt');await replanFuture();cache={};return [17,18,19].map(d=>occOf(dayRecs['2026-11-'+d])).join()});
    ok(keep==='wedding,casual,funeral','re-planning upcoming days keeps their occasions');
    await p.evaluate(()=>openSettings('daysoff'));await p.click('#formal-list .fchip button');await p.waitForFunction(()=>!occOf(dayRecs['2026-11-17'])&&document.querySelectorAll('#formal-list .fchip').length===2);
    ok(await p.evaluate(()=>{closeSettings();return planFor()['2026-11-17'].occasion===null&&document.querySelectorAll('#formal-list .fchip').length===2}),'× makes it a regular day again');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
module.exports.realPlanner=true;   // runs the real planner (occasion days are planned); other tests get tests/fixedplan.js
