// The month view: swiping and unfolding.
// Joined by feature from 3 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.
const path=require('path'),{pathToFileURL}=require('url');

/* ---- was tests/month.test.js ---- */
// Month view (wear plan): calendar of fabric stacks with worn/today/planned/rest states, a Today/Tomorrow card,
// opened from the box on Today; photo caption shows when the look was last worn; Settings can generate the month's photos.
const month=async({ok,chromium,url,ROOT,settle})=>{
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
      HOOK.items=[I('suit','navy',{pattern:'pinstripe',secondaryColor:'white'}),I('suit','charcoal'),I('suit','grey'),I('blazer','navy'),I('pants','grey'),I('shirt','lightblue'),I('shirt','white'),
        I('tie','burgundy',{pattern:'polka-dot',secondaryColor:'white'}),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      HOOK.settings.workdays=[0,1,2,3,4];HOOK.settings.blazerDays=[4];HOOK.dayRecs={};HOOK.weather={};HOOK.TODAY_OVERRIDE='2026-11-09T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,9);HOOK.view={y:2026,m:10};HOOK.show('today')});
    const t=await p.evaluate(()=>({link:!!document.querySelector('#mbox .month-link'),strip:document.querySelectorAll('#mbox .month-link .mli').length,old:!!document.querySelector('#today .pl'),
      txt:document.querySelector('#mbox .month-link').textContent}));
    ok(t.link&&t.strip===5&&!t.old,'Today has a box with the next 5 outfits instead of the month list');
    ok(/November wear plan/.test(t.txt),'the box names the month');
    // the month unfolds in place: still on Today, panel grows from the box
    const closedH=await p.evaluate(()=>document.querySelector('#mbox').getBoundingClientRect().height);
    await p.evaluate(()=>{document.querySelector('#mbox .month-link').click();const c=document.querySelectorAll('#mbox .mc:not(.blank)');window.__anim=getComputedStyle(c[3]).animationName+'|'+getComputedStyle(c[3]).animationTimingFunction});await settle(p,600);
    const m=await p.evaluate(()=>{const c=[...document.querySelectorAll('#mbox .mc:not(.blank)')];return {today:!HOOK.$('#today').hidden,open:HOOK.$('#mbox').classList.contains('open'),
      exp:document.querySelector('#mbox .month-link').getAttribute('aria-expanded'),h:document.querySelector('#mbox').getBoundingClientRect().height,title:document.querySelector('#mbox .mhead h3').textContent,
      n:c.length,rest:c.filter(x=>x.classList.contains('rest')).map(x=>x.querySelector('.dn').textContent).join(),
      todayCell:c.filter(x=>x.classList.contains('today')).map(x=>x.querySelector('.dn').textContent).join(),worn:c.filter(x=>x.classList.contains('worn')).length,
      planned:c.filter(x=>x.classList.contains('planned')).length,thu:c[18].querySelectorAll('.stack rect[fill^="url"]').length,sun:c[14].querySelectorAll('.stack rect[fill^="url"]').length,
      label:c[8].getAttribute('aria-label'),legend:!!document.querySelector('#mbox .mlegend'),anim:window.__anim,after:getComputedStyle(c[3]).animationName}});
    ok(m.today&&m.open&&m.exp==='true'&&m.h>closedH+250,`the month unfolds in place on Today (box ${Math.round(closedH)}px → ${Math.round(m.h)}px)`);
    ok(/^mcDrop\|cubic-bezier\(0\.34, 1\.56/.test(m.anim),`the days drop in one after another as the box unfolds, landing with a little bounce (${m.anim})`);
    ok(m.title==='November 2026'&&m.n===30,'30 day cells; November 2026 starts on a Sunday');
    ok(m.rest==='6,7,13,14,20,21,27,28','Fridays and Saturdays are rest days');
    ok(m.todayCell==='9'&&m.worn===6&&m.planned===16,`today is outlined, earlier workdays read as worn (${m.worn}), later ones planned (${m.planned})`);
    ok(m.sun===3&&m.thu===4,'suit days show jacket, shirt and tie; blazer days add the trousers');
    ok(/Monday, November 9: /.test(m.label)&&!m.legend,`labelled days, and no legend: the cells show worn, today, planned and rest themselves (${m.label})`);
    // no arrows: a drag inside the box (a mouse here; touch in tests/month.test.js) changes the month
    const drag=async(dx)=>{const b=await p.evaluate(()=>{const r=document.querySelector('#mbox .mgrid:not(.mdow)').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});
      await p.mouse.move(b.x,b.y);await p.mouse.down();for(let k=1;k<=6;k++)await p.mouse.move(b.x+dx*k/6,b.y+2);await p.mouse.up();await settle(p,500)};
    ok(await p.evaluate(()=>!document.querySelector('#mbox .mbtns')),'the month has no arrow buttons');
    await drag(-160);
    ok(await p.evaluate(()=>document.querySelector('#mbox .mhead h3').textContent==='December 2026'&&HOOK.key(HOOK.sel)==='2026-11-9'&&!!HOOK.planFor()['2026-11-9']),'dragging left shows the next month inside the panel, without changing the shown day');
    await drag(160);
    ok(await p.evaluate(()=>document.querySelector('#mbox .mhead h3').textContent==='November 2026'&&HOOK.key(HOOK.sel)==='2026-11-9'),'dragging right goes back, and the drag didn\'t open a day');
    await p.click('#mbox .month-link');await settle(p,600);
    ok(await p.evaluate(()=>!HOOK.$('#mbox').classList.contains('open')&&document.querySelector('#mbox').getBoundingClientRect().height<120),'tapping the box again folds it away');
    await p.click('#mbox .month-link');await settle(p,500);
    await p.click('#mbox .mc:not(.blank) >> nth=15');
    ok(await p.evaluate(()=>!HOOK.$('#today').hidden&&HOOK.key(HOOK.sel)==='2026-11-16'&&!HOOK.monthOpen),'tapping a day shows it on Today and folds the month');
    // caption: last worn
    const cap=await p.evaluate(async()=>{const o=HOOK.planFor()['2026-11-16'];
      HOOK.dayRecs={};   // only the history planted here
      HOOK.dayRecs['2026-11-2']={date:'2026-11-2',ids:{top:o.top.id,shirt:o.shirt.id,tie:o.tie.id,clip:null,watch:null},suitDay:true,vestOn:!!o.vest,worn:true};
      HOOK.dayRecs['2026-10-27']={date:'2026-10-27',ids:{top:o.top.id,shirt:o.shirt.id,tie:o.tie.id},suitDay:true,vestOn:!!o.vest,worn:true};
      // keep Nov 16 on that look (the planner may otherwise move it once Nov 2 is recorded)
      HOOK.dayRecs['2026-11-16']={date:'2026-11-16',force:{top:o.top.id,shirt:o.shirt.id,tie:o.tie.id,...(o.clip?{clip:o.clip.id}:{}),...(o.watch?{watch:o.watch.id}:{})},vest:!!o.vest};
      HOOK.cache={};const o2=HOOK.planFor()['2026-11-16'];const d=HOOK.lastWorn(o2);
      // a white shirt instead of light blue is a different look; another light blue shirt would be the same
      const diff=HOOK.lastWorn({...o2,shirt:{...o2.shirt,primaryColor:'pink'}});
      // a later day with the same look that nobody marked worn was only planned: it doesn't count
      HOOK.dayRecs['2026-11-9']={date:'2026-11-9',ids:{top:o.top.id,shirt:o.shirt.id,tie:o.tie.id,clip:null,watch:null},suitDay:true,vestOn:!!o.vest};
      const unmarked=HOOK.lastWorn(o2);delete HOOK.dayRecs['2026-11-9'];return {d:d&&HOOK.key(d),diff,unmarked:unmarked&&HOOK.key(unmarked)}});
    ok(cap.d==='2026-11-2'&&cap.diff===null,'last worn finds the most recent day with the same look');
    ok(cap.unmarked==='2026-11-2',`a day never marked worn isn't "last worn" (${cap.unmarked})`);
    // (the days between are marked not worn: the missed days after the first real use are recorded before Today is drawn, fix round 3,
    // and one of them could be this look)
    await p.evaluate(()=>{for(const d=new Date(2026,9,28);d<HOOK.todayDate();d.setDate(d.getDate()+1)){const k=HOOK.key(d);if(!HOOK.dayRecs[k])HOOK.dayRecs[k]={date:k,ids:{},worn:false}}HOOK.cache={};
      const o=HOOK.planFor()['2026-11-16'];HOOK.renderTried.add(HOOK.comboKey(o));/* a stand-in photo: keep it off the worker */HOOK.renders[HOOK.comboKey(o)]={sig:'x',img:'data:image/jpeg;base64,'+document.title.length,model:'gpt-image-2',t:1};HOOK.renderToday()});
    ok(/^This look last worn Mon, Nov 2$/.test(await p.textContent('.fig.photo .lastworn')),'the photo caption is just the last-worn date');
    // no paid outfit photo is offered at all (the owner: no month batch 2026-11-13; the day's photo retired 2026-11-14)
    await p.evaluate(()=>{for(const k of Object.keys(HOOK.renders))delete HOOK.renders[k];HOOK.dayRecs={};HOOK.cache={};HOOK.openSettings('photos')});
    const st=await p.evaluate(()=>({batch:!!document.querySelector('#batch-btn'),fn:typeof startBatch,regen:!!document.querySelector('#regen-btn')}));
    ok(!st.batch&&st.fn==='undefined'&&!st.regen&&calls===0,'Settings has no "Generate photos for this month" and no day\'s photo; nothing was made');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{globalThis.fetch=realFetch;await browser.close()}
};

/* ---- was tests/monthswipe.test.js ---- */
// The open month on Today: no arrows, the title centred; a sideways swipe inside the box moves between months (the shown day
// stays, nothing else folds), a short one springs back; a swipe outside it still changes the day; a full-width fold bar folds it.
const monthswipe=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      HOOK.settings.workdays=[1,2,3,4,5];HOOK.dayRecs={};HOOK.TODAY_OVERRIDE='2026-12-10T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,11,10);HOOK.view={y:2026,m:11};HOOK.show('today');HOOK.toggleScore();HOOK.toggleMonth()});
    await settle(p,700);
    const cdp=await ctx.newCDPSession(p);const T=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    const title=()=>p.evaluate(()=>document.querySelector('#mbox .mhead h3').textContent);
    const at=async()=>{await p.evaluate(()=>{const r=document.querySelector('#mbox .mgrid:not(.mdow)').getBoundingClientRect();scrollBy(0,r.top+r.height/2-420)});await settle(p,200);
      return p.evaluate(()=>{const r=document.querySelector('#mbox .mgrid:not(.mdow)').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})};
    // (pace: ms between moves. A short drag made fast is a flick, which turns the month by design (monthRelease: over 30 px at more than
    // 0.5 px/ms); on a quiet machine WebKit's touches ran 40 px in under 80 ms, so "a short drag" turned the month. It is held at a
    // drag's pace)
    const swipe=async(x,y,dx,mid,pace=0)=>{await T('touchStart',x,y);let m=null;for(let k=1;k<=8;k++){if(pace)await p.waitForTimeout(pace);await T('touchMove',x+dx*k/8,y+2);if(k===5&&mid)m=await mid()}await T('touchEnd');await settle(p,500);return m};
    const h=await p.evaluate(()=>{const hd=document.querySelector('#mbox .mhead'),t=hd.querySelector('h3').getBoundingClientRect(),b=document.querySelector('#mbox').getBoundingClientRect();
      return {arrows:document.querySelectorAll('#mbox .mbtns, #mbox .mhead button').length,centre:Math.abs((t.left+t.right)/2-(b.left+b.right)/2),hint:!!document.querySelector('#mbox .mhint'),legend:!!document.querySelector('#mbox .mlegend'),
        gap:Math.round(document.querySelector('#mbox .mdow').getBoundingClientRect().top-t.bottom),
        bar:Math.round(document.querySelector('#mbox .foldbar').getBoundingClientRect().top-Math.max(...[...document.querySelectorAll('#mbox .mc')].map(c=>c.getBoundingClientRect().bottom)))}});
    ok(h.arrows===0&&h.centre<=2&&!h.hint&&!h.legend,`no arrows, swipe tip or legend; the month and year are centred (${h.centre.toFixed(1)}px off)`);
    ok(h.gap<=8&&h.bar<=14,`the weekdays sit close under the title (${h.gap}px) and the Fold away bar right under the days (${h.bar}px)`);
    const day0=await p.evaluate(()=>HOOK.key(HOOK.sel)),c=await at();
    const mid=await swipe(c.x+60,c.y,-200,()=>p.evaluate(()=>document.querySelector('#mswipe').style.transform));
    ok(/translateX\(-/.test(mid||''),`the month follows the finger (${mid})`);
    ok(await title()==='January 2027'&&await p.evaluate(d=>HOOK.key(HOOK.sel)===d&&HOOK.monthOpen&&HOOK.scoreOpen,day0),'a swipe left inside the box shows the next month; the day and the other open boxes stay');
    const c2=await at();await swipe(c2.x-60,c2.y,200);await swipe(c2.x-60,c2.y,200);
    ok(await title()==='November 2026','swiping right goes back a month at a time');
    const c3=await at();await swipe(c3.x,c3.y,-40,null,30);
    ok(await title()==='November 2026'&&await p.evaluate(()=>{const s=document.querySelector('#mswipe').style.transform;return !s||s==='translateX(0px)'}),'a short drag springs back');
    // a swipe on the outfit (outside the month) still changes the day
    await p.evaluate(()=>scrollTo(0,0));await settle(p,200);
    const st=await p.evaluate(()=>{const b=document.querySelector('#stage').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+Math.min(b.height/2,300)}});
    await swipe(st.x+80,st.y,-200);
    ok(await p.evaluate(d=>HOOK.key(HOOK.sel)!==d&&!HOOK.monthOpen,day0),'a swipe on the outfit still changes the day (and folds the month)');
    // the fold bar
    await p.evaluate(()=>{HOOK.toggleMonth()});await settle(p,700);
    await p.evaluate(()=>{const b=document.querySelector('#mbox .foldbar');b.scrollIntoView({block:'center'})});await settle(p,300);
    await p.tap('#mbox .foldbar');await settle(p,800);
    ok(await p.evaluate(()=>!HOOK.monthOpen&&!document.querySelector('#mbox').classList.contains('open')),'tapping the Fold away bar folds the month');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};

/* ---- was tests/monthunfold.test.js ---- */
// The month box unfolds and folds without animating its height (app.js monthUnfold / monthFold): the page is laid out once and a clip,
// a slide and a fade do the moving. An animated height laid the page out on every frame (30 layouts for one unfold), which was choppy
// on a phone. The days are put into the folded box while the app is idle (monthFillSoon), and the folded box takes no taps or focus.
const monthunfold=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      HOOK.items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      HOOK.settings.workdays=[1,2,3,4,5];HOOK.dayRecs={};HOOK.TODAY_OVERRIDE='2026-11-10T12:00:00';HOOK.cache={};HOOK.sel=new Date(2026,10,10);HOOK.view={y:2026,m:10};HOOK.show('today')});
    // folded: the days are put in while idle, and can't be tapped or reached with the keyboard
    await p.waitForFunction(()=>{const el=HOOK.$('#mpanel-in');return el&&el.querySelectorAll('.mc[data-k]').length>=28},null,{timeout:5000});
    const folded=await p.evaluate(()=>({inert:HOOK.$('#mpanel-in').inert,open:HOOK.$('#mbox').classList.contains('open'),h:HOOK.$('#mpanel').offsetHeight}));
    ok(folded.inert&&!folded.open&&folded.h===0,'the folded month box already holds the days (put in while idle), with no height, and takes no taps or focus');
    // unfolding: the page is laid out a few times, not on every frame; a clip, a slide and a fade move
    let cdp=null;try{cdp=await ctx.newCDPSession(p);await cdp.send('Performance.enable')}catch{cdp=null}   // the layout count is Chromium's (CDP); on WebKit (npm run test:webkit) it isn't counted
    const lay=async()=>cdp?(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount').value:0;
    const laid=n=>cdp?`${n} times`:'(not counted on WebKit)';
    const l0=await lay();
    const during=await p.evaluate(()=>{const a0=performance.now();document.querySelector('#mbox .month-link').click();const tap=performance.now()-a0;
      const an=document.getAnimations().map(a=>(a.effect.target.closest('.fedge')?'edge ':'')+Object.keys(a.effect.getKeyframes()[0]).filter(k=>!['offset','easing','composite','computedOffset'].includes(k)).join('+'));
      return {tap,an,drop:getComputedStyle(document.querySelector('#mbox .mc:not(.blank)')).animationName,cells:document.querySelectorAll('#mbox .mc').length,inert:HOOK.$('#mpanel-in').inert,heightAnim:getComputedStyle(HOOK.$('#mpanel')).transitionDuration}});
    await settle(p,700);await p.waitForFunction(()=>!document.getAnimations().length,null,{timeout:3000});
    const layouts=await lay()-l0;
    const opened=await p.evaluate(()=>{const b=HOOK.$('#mbox').getBoundingClientRect(),nav=document.querySelector('body>nav').getBoundingClientRect();return {open:HOOK.monthOpen&&HOOK.$('#mbox').classList.contains('open'),inert:HOOK.$('#mpanel-in').inert,clip:getComputedStyle(HOOK.$('#mbox')).clipPath,edge:!!document.querySelector('.fedge')||HOOK.$('#mbox').classList.contains('fedge-on'),fold:HOOK.$('#mbox .foldbar').getBoundingClientRect().bottom<=nav.top+1,top:b.top>=0}});
    // the card's edge is a strip that slides (app.js foldEdge), not a clip-path: Safari repaints a clip every frame on the page's thread
    // while it slides the cards below on its own, and the two drifted apart
    ok(during.an.includes('edge transform')&&!during.an.some(x=>/clipPath/.test(x))&&during.an.includes('opacity')&&during.heightAnim==='0s'&&!during.inert,`unfolding is the card's edge sliding down (no clip-path) and a fade of the days, the height is not animated (${[...new Set(during.an)].join(', ')})`);
    const drop=await p.evaluate(async()=>{await new Promise(r=>setTimeout(r,1100));const gone=!HOOK.$('#mbox').classList.contains('mdrop');HOOK.monthStep(1);const again=getComputedStyle(document.querySelector('#mbox .mc:not(.blank)')).animationName;HOOK.monthStep(-1);return {gone,again}});
    ok(during.drop==='mcDrop'&&drop.gone&&drop.again==='none',`the days drop in only while the box unfolds: not again on a month swiped to (${during.drop}, then ${drop.again})`);
    ok(layouts<=8,`unfolding lays the page out ${laid(layouts)} (it was about 30, once a frame)`);
    ok(opened.open&&!opened.inert&&opened.clip==='none'&&!opened.edge&&opened.fold&&opened.top,'unfolded: the whole month shows, scrolled so "Fold away" is above the tab bar, with no clip or edge strip left');
    // what lies under the box slides with it: the Reset card on a changed day
    await p.evaluate(async()=>{HOOK.toggleMonth();await new Promise(r=>setTimeout(r,600));const o=HOOK.planFor()[HOOK.key(HOOK.sel)];await HOOK.saveDay({...(HOOK.dayRecs[HOOK.key(HOOK.sel)]||{date:HOOK.key(HOOK.sel)}),force:{tie:HOOK.items.find(i=>i.type==='tie'&&i.id!==o.tie.id).id}});HOOK.cache={};HOOK.renderToday();scrollTo(0,0)});
    const slide=await p.evaluate(()=>{const r=HOOK.$('#rbox');if(!r)return null;const y0=r.getBoundingClientRect().top;HOOK.toggleMonth();const a=r.getAnimations()[0];const y1=r.getBoundingClientRect().top;
      return {anim:!!a&&/translateY\(-\d/.test(a.effect.getKeyframes()[0].transform),still:Math.abs(y1-y0)<2}});
    ok(slide&&slide.anim&&slide.still,'the Reset card under the box starts where it was and slides down with the unfolding');
    await p.waitForFunction(()=>!document.getAnimations().length,null,{timeout:3000});
    // folding: the days fade and the clip closes, then the box is laid out shut; the page doesn't jump at the end
    await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await settle(p,300);
    const fold=await p.evaluate(()=>new Promise(res=>{const tops=[];document.querySelector('#mbox .foldbar').click();const cs=[...document.querySelectorAll('#mbox .mc:not(.blank)')],first=getComputedStyle(cs[0]),last=getComputedStyle(cs[cs.length-1]),clipA=document.getAnimations().find(a=>a.effect.target.closest('#mbox .fedge'));
      const lift={name:first.animationName,ease:first.animationTimingFunction,d0:parseFloat(first.animationDelay),dn:parseFloat(last.animationDelay),clipDelay:clipA?clipA.effect.getTiming().delay:-1};const an=document.getAnimations().length,chev=HOOK.$('#mbox').classList.contains('mshut')&&getComputedStyle(HOOK.$('#mbox .chev')).transitionProperty;
      const f=()=>{tops.push(Math.round(HOOK.$('#mbox').getBoundingClientRect().top));if(document.getAnimations().length||tops.length<5)requestAnimationFrame(f);else res({lift,an,chev,tops,open:HOOK.$('#mbox').classList.contains('open'),inert:HOOK.$('#mpanel-in').inert,h:HOOK.$('#mpanel').offsetHeight,over:scrollY-(document.documentElement.scrollHeight-innerHeight)})};requestAnimationFrame(f)}));
    ok(fold.lift.name==='mcLift'&&/cubic-bezier\(0\.36, 0, 0\.66, -0\.56\)/.test(fold.lift.ease)&&fold.lift.dn===0&&fold.lift.d0>0.15&&fold.lift.clipDelay>100,`folding plays the drop backwards: the last day lifts out first, the first last (${Math.round(fold.lift.d0*1000)} ms later), each with a little dip, and the card closes after them (from ${Math.round(fold.lift.clipDelay)} ms)`);
    let jump=0;for(let i=1;i<fold.tops.length;i++)jump=Math.max(jump,Math.abs(fold.tops[i]-fold.tops[i-1]));
    ok(fold.an>=2&&!!fold.chev&&!fold.open&&fold.inert&&fold.h===0&&fold.over<=1,`folding: the arrow turns back at once, the clip closes and the box ends shut, inert, with nothing scrolled past the page's end ${JSON.stringify({...fold,tops:fold.tops.length})}`);
    // a jump is one frame covering most of the way; an ease-out starts fast (WebKit's frames come further apart than Chromium's)
    const way=Math.abs(fold.tops[fold.tops.length-1]-fold.tops[0]),moving=fold.tops.filter((v,i)=>i&&Math.abs(v-fold.tops[i-1])>2).length;
    ok(way<4||(jump<=way*.4&&moving>=6),`folding from the bottom of the page moves the box smoothly over ${moving} frames, no jump (largest step ${jump} of ${way}px: ${fold.tops.join(" ")})`);
    // reduced motion: no animation, it just opens and shuts
    await p.emulateMedia({reducedMotion:'reduce'});
    const rm=await p.evaluate(()=>{HOOK.toggleMonth();const own=()=>document.getAnimations().filter(x=>!(x instanceof CSSTransition)&&!(x instanceof CSSAnimation)).length,a=own(),o=HOOK.$('#mbox').classList.contains('open');HOOK.toggleMonth();return {a,o,b:own(),shut:!HOOK.$('#mbox').classList.contains('open')}});
    ok(rm.a===0&&rm.o&&rm.b===0&&rm.shut,'with reduced motion the month opens and shuts at once '+JSON.stringify(rm));
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['month',month],['monthswipe',monthswipe],['monthunfold',monthunfold]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
