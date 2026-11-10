// Month view (wear plan): calendar of fabric stacks with worn/today/planned/rest states, a Today/Tomorrow card,
// opened from the box on Today; photo caption shows when the look was last worn; Settings can generate the month's photos.
const path=require('path'),{pathToFileURL}=require('url');
module.exports=async({ok,chromium,url,ROOT,settle})=>{
  const worker=(await import(pathToFileURL(path.join(ROOT,'worker.js')).href)).default;
  const JPG='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const realFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async href=>{if(String(href)!=='https://api.openai.com/v1/images/edits')return new Response('',{status:404});calls++;
    return new Response(JSON.stringify({data:[{b64_json:JPG}]}),{status:200,headers:{'content-type':'application/json'}})};
  const store=new Map(),KV={get:async(k,t)=>store.has(k)?(t==='json'?JSON.parse(store.get(k)):store.get(k)):null,put:async(k,v)=>{store.set(k,v)}};
  const env={APP_TOKEN:'t',OPENAI_API_KEY:'k',WARDROBE:KV},HOST='https://w.test/';
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:900}});
    await ctx.route(HOST+'**',async route=>{const q=route.request();const res=await worker.fetch(new Request(q.url(),{method:q.method(),headers:q.headers(),body:q.method()==='GET'?undefined:q.postData()}),env);
      await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())})});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await p.evaluate(h=>{localStorage.setItem('worker_url',h);localStorage.setItem('app_token','t')},HOST);await p.reload();await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','charcoal'),I('suit','grey'),I('blazer','navy'),I('pants','grey'),I('shirt','lightblue'),I('shirt','white'),
        I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[0,1,2,3,4];settings.blazerDays=[4];dayRecs={};weather={};TODAY_OVERRIDE='2026-11-09T12:00:00';cache={};sel=new Date(2026,10,9);view={y:2026,m:10};show('today')});
    const t=await p.evaluate(()=>({link:!!document.querySelector('#mbox .month-link'),strip:document.querySelectorAll('#mbox .month-link .mli').length,old:!!document.querySelector('#today .pl'),
      txt:document.querySelector('#mbox .month-link').textContent}));
    ok(t.link&&t.strip===5&&!t.old,'Today has a box with the next 5 outfits instead of the month list');
    ok(/November wear plan/.test(t.txt),'the box names the month');
    // the month unfolds in place: still on Today, panel grows from the box
    const closedH=await p.evaluate(()=>document.querySelector('#mbox').getBoundingClientRect().height);
    await p.click('#mbox .month-link');await settle(p,600);
    const m=await p.evaluate(()=>{const c=[...document.querySelectorAll('#mbox .mc:not(.blank)')];return {today:!$('#today').hidden,open:$('#mbox').classList.contains('open'),
      exp:document.querySelector('#mbox .month-link').getAttribute('aria-expanded'),h:document.querySelector('#mbox').getBoundingClientRect().height,title:document.querySelector('#mbox .mhead h3').textContent,
      n:c.length,rest:c.filter(x=>x.classList.contains('rest')).map(x=>x.querySelector('.dn').textContent).join(),
      todayCell:c.filter(x=>x.classList.contains('today')).map(x=>x.querySelector('.dn').textContent).join(),worn:c.filter(x=>x.classList.contains('worn')).length,
      planned:c.filter(x=>x.classList.contains('planned')).length,thu:c[18].querySelectorAll('.stack rect[fill^="url"]').length,sun:c[14].querySelectorAll('.stack rect[fill^="url"]').length,
      label:c[8].getAttribute('aria-label'),legend:document.querySelector('#mbox .mlegend').textContent,anim:getComputedStyle(c[3]).animationName}});
    ok(m.today&&m.open&&m.exp==='true'&&m.h>closedH+250,`the month unfolds in place on Today (box ${Math.round(closedH)}px → ${Math.round(m.h)}px)`);
    ok(m.anim==='mcIn','the days settle in with an animation');
    ok(m.title==='November 2026'&&m.n===30,'30 day cells; November 2026 starts on a Sunday');
    ok(m.rest==='6,7,13,14,20,21,27,28','Fridays and Saturdays are rest days');
    ok(m.todayCell==='9'&&m.worn===6&&m.planned===16,`today is outlined, earlier workdays read as worn (${m.worn}), later ones planned (${m.planned})`);
    ok(m.sun===3&&m.thu===4,'suit days show jacket, shirt and tie; blazer days add the trousers');
    ok(/Monday, November 9: /.test(m.label)&&/Worn.*Today.*Planned.*Rest/.test(m.legend),`labelled days and a legend (${m.label})`);
    await p.click('#mbox .mbtns button[aria-label="Next month"]');
    ok(await p.evaluate(()=>document.querySelector('#mbox .mhead h3').textContent==='December 2026'&&key(sel)==='2026-11-9'&&!!planFor()['2026-11-9']),'next month inside the panel, without changing the shown day');
    await p.click('#mbox .mbtns button[aria-label="Previous month"]');
    await p.click('#mbox .month-link');await settle(p,600);
    ok(await p.evaluate(()=>!$('#mbox').classList.contains('open')&&document.querySelector('#mbox').getBoundingClientRect().height<120),'tapping the box again folds it away');
    await p.click('#mbox .month-link');await settle(p,500);
    await p.click('#mbox .mc:not(.blank) >> nth=15');
    ok(await p.evaluate(()=>!$('#today').hidden&&key(sel)==='2026-11-16'&&!monthOpen),'tapping a day shows it on Today and folds the month');
    // caption: last worn
    const cap=await p.evaluate(async()=>{const o=planFor()['2026-11-16'];
      dayRecs={};   // only the history planted here
      dayRecs['2026-11-2']={date:'2026-11-2',ids:{top:o.top.id,shirt:o.shirt.id,tie:o.tie.id,clip:null,watch:null},suitDay:true,vestOn:!!o.vest,worn:true};
      dayRecs['2026-10-27']={date:'2026-10-27',ids:{top:o.top.id,shirt:o.shirt.id,tie:o.tie.id},suitDay:true,vestOn:!!o.vest,worn:true};
      // keep Nov 16 on that look (the planner may otherwise move it once Nov 2 is recorded)
      dayRecs['2026-11-16']={date:'2026-11-16',force:{top:o.top.id,shirt:o.shirt.id,tie:o.tie.id,...(o.clip?{clip:o.clip.id}:{}),...(o.watch?{watch:o.watch.id}:{})},vest:!!o.vest};
      cache={};const o2=planFor()['2026-11-16'];const d=lastWorn(o2);
      // a white shirt instead of light blue is a different look; another light blue shirt would be the same
      const diff=lastWorn({...o2,shirt:{...o2.shirt,primaryColor:'pink'}});return {d:d&&key(d),diff}});
    ok(cap.d==='2026-11-2'&&cap.diff===null,'last worn finds the most recent day with the same look');
    await p.evaluate(()=>{const o=planFor()['2026-11-16'];renderTried.add(comboKey(o));/* a stand-in photo: keep it off the worker */renders[comboKey(o)]={sig:'x',img:'data:image/jpeg;base64,'+document.title.length,model:'gpt-image-2',t:1};figView='photo';renderToday()});
    ok(/^Last worn Mon, Nov 2$/.test(await p.textContent('.fig.photo .lastworn')),'the photo caption is just the last-worn date');
    // Settings: generate the month's missing photos
    await p.evaluate(()=>{for(const k of Object.keys(renders))delete renders[k];dayRecs={};cache={};openSettings()});
    const before=await p.evaluate(()=>({btn:$('#batch-btn').textContent,n:batchCombos().length}));
    ok(new RegExp(`^Generate ${before.n} photos for November 2026$`).test(before.btn)&&before.n>=3,`Settings offers to generate the month's missing photos (${before.btn})`);
    // the worker starts empty except for one look another device already made: that one is fetched, not generated
    store.clear();
    const pre=await p.evaluate(()=>comboKey(batchCombos()[1]));
    store.set('render:'+pre,JSON.stringify({sig:'x',img:'data:image/jpeg;base64,'+JPG,model:'gpt-image-2',t:5}));
    await p.click('#batch-btn');
    await p.waitForFunction(()=>!batch,null,{timeout:30000});
    const after=await p.evaluate(()=>({left:batchCombos().length,btn:$('#batch-btn').textContent,status:$('#batch-status').textContent,disabled:$('#batch-btn').disabled}));
    ok(calls===before.n-1,`one photo per distinct look, generated in a row (${calls} of ${before.n}); the one already on the worker was fetched, not paid for again`);
    ok(after.left===0&&after.disabled&&/All of November 2026 has photos/.test(after.btn)&&new RegExp(`Done: ${before.n} photos ready`).test(after.status),'afterwards nothing is left to generate');
    ok(await p.evaluate(()=>Object.keys(planFor()).filter(k=>keyDate(k).getMonth()===10).every(k=>!planFor()[k].top||!!renders[comboKey(planFor()[k])])),'every November outfit now has a photo');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};
