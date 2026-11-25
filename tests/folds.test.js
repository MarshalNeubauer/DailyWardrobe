// Today's folding boxes, the picture fold, taps, reveal, scrolling.
// Joined by feature from 5 files (Round B, 2026-11-17: the code review's CR-10-14); each part below is one old file, its checks unchanged.

/* ---- was tests/boxfold.test.js ---- */
// The score box and the pieces list unfold and fold like the month (app.js boxUnfold / boxFold): the page is laid out a few times,
// not on every frame (an animated height did that), the card's edge (a strip, app.js foldEdge) slides down and back up, and folding plays the box's own cascade
// backwards (the last check or piece lifts out first), then the card closes; nothing jumps and the box ends shut.
const boxfold=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy'),I('watch','grey',{metal:'silver'})];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};scoreOpen=listOpen=false;show('today')});
    let cdp=null;try{cdp=await ctx.newCDPSession(p);await cdp.send('Performance.enable')}catch{cdp=null}   // the layout count is Chromium's (CDP); on WebKit (npm run test:webkit) it isn't counted
    const lay=async()=>cdp?(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount').value:0;
    const laid=n=>cdp?`${n} times`:'(not counted on WebKit)';
    for(const [name,id,toggle,items] of [['score','#sbox','toggleScore','#spanel .sli'],['pieces list','#ibox','toggleList','#ipanel .list>*']]){
      await p.evaluate(()=>scrollTo(0,0));await settle(p,300);
      const l0=await lay();
      const u=await p.evaluate(([id,toggle])=>{(toggle in HOOK?HOOK:window)[toggle]();const b=$(id);return {clip:b.getAnimations({subtree:true}).some(a=>a.effect.target.closest('.fedge'))&&!b.getAnimations().some(a=>a.effect.getKeyframes()[0].clipPath),trans:getComputedStyle(b.querySelector('.mpanel')).transitionDuration}},[id,toggle]);
      await p.waitForFunction(id=>!$(id).getAnimations({subtree:true}).some(a=>a.playState==='running'&&a.effect.getComputedTiming().endTime!==Infinity),id,{timeout:3000});await settle(p,800);
      const layouts=await lay()-l0;
      ok(u.clip&&u.trans==='0s'&&layouts<=8,`the ${name} unfolds with its edge sliding down (a strip, not a clip-path), its height not animated, the page laid out ${laid(layouts)}`);
      const f=await p.evaluate(([id,toggle,items])=>new Promise(res=>{const b=$(id),its=[...b.querySelectorAll(items)];(toggle in HOOK?HOOK:window)[toggle]();
        const cs=its.map(e=>getComputedStyle(e)),lift={name:cs[0].animationName,d0:parseFloat(cs[0].animationDelay),dn:parseFloat(cs[cs.length-1].animationDelay),n:its.length},chev=b.classList.contains('bshut');
        const tops=[];const f=()=>{tops.push(Math.round(b.getBoundingClientRect().top));if(b.getAnimations({subtree:true}).some(a=>a.playState==='running'&&a.effect.getComputedTiming().endTime!==Infinity)||tops.length<5)requestAnimationFrame(f);else res({lift,chev,tops,open:b.classList.contains('open'),h:b.querySelector('.mpanel').offsetHeight})};requestAnimationFrame(f)}),[id,toggle,items]);
      let jump=0;for(let i=1;i<f.tops.length;i++)jump=Math.max(jump,Math.abs(f.tops[i]-f.tops[i-1]));
      ok(f.lift.name==='mcLift'&&f.lift.dn===0&&f.lift.d0>0.05&&f.chev,`folding the ${name} lifts its ${f.lift.n} rows out last first (the first ${Math.round(f.lift.d0*1000)} ms after the last), the arrow turning back at once`);
      ok(!f.open&&f.h===0&&jump<120,`the ${name} ends shut, with no jump (largest step ${jump}px)`);
    }
    // a tap in the middle of a fold finishes it and opens again cleanly
    const mid=await p.evaluate(async()=>{HOOK.toggleList();await new Promise(r=>setTimeout(r,500));HOOK.toggleList();await new Promise(r=>setTimeout(r,120));HOOK.toggleList();await new Promise(r=>setTimeout(r,60));
      const b=$('#ibox');return {open:b.classList.contains('open'),lift:b.classList.contains('blift')}});
    await p.waitForFunction(()=>!$('#ibox').getAnimations({subtree:true}).some(a=>a.playState==='running'&&a.effect.getComputedTiming().endTime!==Infinity),null,{timeout:3000});
    ok(mid.open&&!mid.lift&&await p.evaluate(()=>getComputedStyle($('#ibox')).clipPath==='none'&&!document.querySelector('#ibox .fedge')),'opening the list in the middle of its fold stops the fold and opens it fully');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};

/* ---- was tests/picfold.test.js ---- */
// A piece's photo (a row of the pieces list, a tile's photo under the tiles) opens and shuts like the cards (app.js picOpen/picShut):
// the page is laid out a few times, not on every frame; the photo's edge (a strip, app.js foldEdge) slides open while what is below slides down in step and
// the pieces card grows with it; the photo drops in with a bounce and lifts out with a dip before the space closes; a photo is decoded
// before it opens (no late jump); opening another row while one above is open keeps the tapped row where it was.
const picfold=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=800;const x=c.getContext('2d');x.fillStyle='#ccd';x.fillRect(0,0,600,800);x.fillStyle='#335';x.fillRect(100,100,400,600);const photo=c.toDataURL('image/jpeg',.8);
      let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{photo}),I('suit','charcoal',{photo}),I('shirt','white',{photo}),I('shirt','lightblue',{photo}),I('tie','burgundy',{photo}),I('tie','navy',{pattern:'stripe',secondaryColor:'white',photo}),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy'),I('watch','grey',{metal:'silver'})];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};scoreOpen=listOpen=false;HOOK.openRow=null;HOOK.belowOpen=null;show('today')});
    let cdp=null;try{cdp=await ctx.newCDPSession(p);await cdp.send('Performance.enable')}catch{cdp=null}   // the layout count is Chromium's (CDP); on WebKit (npm run test:webkit) it isn't counted
    const lay=async()=>cdp?(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount').value:0;
    const laid=n=>cdp?`${n} times`:'(not counted on WebKit)';
    const quiet=()=>p.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect&&a.effect.getComputedTiming().endTime!==Infinity),null,{timeout:4000});
    await p.evaluate(()=>HOOK.toggleList());await quiet();await settle(p,400);
    // a row's photo opens: clipped open, the card grows with it, the rows below slide, the photo drops in with a bounce
    const l0=await lay();
    const o=await p.evaluate(async()=>{const el=$('#ri-shirt'),seen=new Set(),hs=[];HOOK.toggleRow('shirt');
      const t0=performance.now();while(performance.now()-t0<700){for(const a of document.getAnimations()){const k=a.effect.getKeyframes()[0],t=a.effect.target;
          const eg=t.closest('.fedge');if(eg&&eg.parentElement===el)seen.add('row edge');if(eg&&eg.parentElement.id==='ibox')seen.add('card edge');if(k.clipPath)seen.add('a clip-path');if(/translateY\(-/.test(k.transform||'')&&t.matches('.ritem')&&t!==el)seen.add('rows below slide');
          if(t.classList.contains('rpanel-in')&&/cubic-bezier\(0\.34, 1\.56/.test(a.effect.getTiming().easing))seen.add('photo bounce')}
        hs.push(Math.round(el.getBoundingClientRect().height));await new Promise(r=>requestAnimationFrame(r))}
      const late=[];for(let i=0;i<10;i++){late.push(Math.round(el.getBoundingClientRect().height));await new Promise(r=>requestAnimationFrame(r))}
      return {seen:[...seen],open:el.classList.contains('open'),img:el.querySelector('.rpanel-in img').naturalWidth,late:new Set(late).size,first:hs[0],last:hs[hs.length-1],clip:getComputedStyle(el).clipPath}});
    const layouts=await lay()-l0;
    ok(['row edge','card edge','rows below slide','photo bounce'].every(x=>o.seen.includes(x))&&!o.seen.includes('a clip-path'),`a row's photo opens with its edge sliding down (a strip, no clip-path), the card's edge growing with it, the rows below sliding, the photo dropping in with a bounce (${o.seen.join(', ')})`);
    ok(o.open&&o.img>0&&o.last>o.first+100&&o.late===1&&o.clip==='none',`the photo was decoded before it opened: its height (${o.last}px) is right at once and doesn't change after (no late jump)`);
    ok(layouts<=10,`opening it lays the page out ${laid(layouts)} (an animated height did it every frame)`);
    // another row while one above is open: the tapped row stays under the finger
    const keep=await p.evaluate(async()=>{const t=$('#ri-tie').getBoundingClientRect().top;HOOK.toggleRow('tie');   // read right after the tap: the photo's own reveal scroll starts after it
      
      return {before:Math.round(t),after:Math.round($('#ri-tie').getBoundingClientRect().top),shirt:$('#ri-shirt').classList.contains('open')}});
    await quiet();
    ok(!keep.shirt&&Math.abs(keep.after-keep.before)<=2,`opening the tie's photo shuts the shirt's above it and the tie's row stays where it was under the finger (${keep.before} → ${keep.after}px)`);
    // shutting: the photo lifts out with a dip, then the space closes; it ends shut, nothing jumps
    const s=await p.evaluate(()=>new Promise(res=>{const el=$('#ri-tie');HOOK.toggleRow('tie');const an=document.getAnimations(),pin=an.find(a=>a.effect.target.classList.contains('rpanel-in')),clip=an.find(a=>{const eg=a.effect.target.closest('.fedge');return eg&&eg.parentElement===el});
      const r={dip:!!pin&&/cubic-bezier\(0\.36, 0, 0\.66, -0\.56\)/.test(pin.effect.getTiming().easing),clipDelay:clip?clip.effect.getTiming().delay:-1},tops=[];const ib=$('#ibox');
      const vis=b=>{const e=[...b.querySelectorAll(':scope>.fedge>i')][0];return e?e.getBoundingClientRect().top+parseFloat(e.style.getPropertyValue('--fh')):b.getBoundingClientRect().bottom};
      const f=()=>{tops.push(Math.round(vis(ib)));if(document.getAnimations().some(a=>a.playState==='running'&&a.effect.getComputedTiming().endTime!==Infinity)||tops.length<5)requestAnimationFrame(f);
        else res({...r,tops,open:el.classList.contains('open'),h:el.querySelector('.rpanel').offsetHeight})};requestAnimationFrame(f)}));
    let jump=0;for(let i=1;i<s.tops.length;i++)jump=Math.max(jump,Math.abs(s.tops[i]-s.tops[i-1]));
    ok(s.dip&&s.clipDelay>=100&&!s.open&&s.h===0,`shutting lifts the photo out with a dip and closes the space after it (from ${s.clipDelay} ms); the row ends shut`);
    ok(jump<90,`the card's edge closes up smoothly, no jump at the end (largest step ${jump}px: ${s.tops.join(' ')})`);
    // a tile's photo: the cards under the stage slide; another tile swaps the photo; it shuts again
    await p.evaluate(()=>{HOOK.toggleList();scrollTo(0,0)});await quiet();await settle(p,300);
    const t=await p.evaluate(async()=>{const el=$('#bbox');HOOK.pickPiece('shoes');await new Promise(r=>setTimeout(r,40));
      const an=document.getAnimations(),r={clip:an.some(a=>{const eg=a.effect.target.closest('.fedge');return eg&&eg.parentElement===el}),side:an.some(a=>a.effect.target.classList.contains('side')&&/translateY\(-/.test(a.effect.getKeyframes()[0].transform||''))};
      await new Promise(r=>setTimeout(r,700));HOOK.pickPiece('belt');r.swap=el.classList.contains('open')&&HOOK.belowOpen==='belt'&&/belt/i.test(el.querySelector('.rpanel-in').innerHTML);
      await new Promise(r=>setTimeout(r,300));HOOK.pickPiece('belt');await new Promise(r=>setTimeout(r,900));r.shut=!el.classList.contains('open')&&HOOK.belowOpen===null;return r});
    ok(t.clip&&t.side&&t.swap&&t.shut,`a tile's photo opens by a clip with the cards below sliding; another tile swaps the photo in place; tapping it again shuts it (${JSON.stringify(t)})`);
    // reduced motion: no animation
    await p.emulateMedia({reducedMotion:'reduce'});
    const rm=await p.evaluate(()=>{HOOK.toggleList();const own=()=>document.getAnimations().filter(x=>!(x instanceof CSSTransition)&&!(x instanceof CSSAnimation)).length;HOOK.toggleRow('top');const a=own();HOOK.toggleRow('top');return {a,b:own(),shut:!$('#ri-top').classList.contains('open')}});
    ok(rm.b===0&&rm.shut,'with reduced motion a photo opens and shuts at once');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};

/* ---- was tests/foldtap.test.js ---- */
// Folding from inside: a photo opened from the pieces list or a tile folds when tapped; the open score breakdown folds on a
// tap; a tap in the open pieces list that is not on a button or a photo (the names on the left) folds the list; the open
// month has a fold button at its bottom right. Folding a box whose top is above the screen brings the card back into view.
const foldtap=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:664},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const setup=(x={})=>p.evaluate(async x=>{let k=0;const I=(type,primaryColor,y={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...y});
      items=[I('suit','deeptaupe'),I('suit','navy'),I('shirt','lightblue'),I('shirt','white'),I('tie','brown'),I('tie','burgundy'),I('shoes','brown',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','brown'),I('watch','silver',{metal:'silver'})];
      settings.workdays=[1,2,3,4,5];TODAY_OVERRIDE='2026-11-10T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,10);view={y:2026,m:10};
      listOpen=!!x.list;monthOpen=!!x.month;scoreOpen=!!x.score;HOOK.belowOpen=null;HOOK.openRow=null;show('today');scrollTo(0,0);await new Promise(r=>setTimeout(r,200))},x);
    const into=s=>p.evaluate(s=>{const e=document.querySelector(s);scrollBy(0,e.getBoundingClientRect().top-100)},s);
    const open=s=>p.evaluate(s=>document.querySelector(s).classList.contains('open'),s);
    // pieces list: open a piece's photo, tap the photo: it folds, the list stays open
    await setup({list:true});await into('#ri-shirt');await p.tap('#ri-shirt .rowtap');await settle(p,600);
    const o1=await open('#ri-shirt');await p.tap('#ri-shirt .rpanel-in');await settle(p,600);
    ok(o1&&!(await open('#ri-shirt'))&&await open('#ibox'),'a piece\'s photo in the list folds when the photo is tapped (the list stays open)');
    // tapping the name on the left folds the whole list; ⇄ and the item still do their own thing
    await into('#ri-tie');await p.tap('#ri-tie .row>.mut');await settle(p,600);
    ok(!(await open('#ibox'))&&await p.evaluate(()=>!listOpen&&document.querySelector('#ibox .month-link').getAttribute('aria-expanded')==='false'),'tapping a name on the left of the open list folds the list');
    await setup({list:true});await into('#ri-tie');await p.tap('#ri-tie .rowtap');await settle(p,500);
    ok(await open('#ibox')&&await open('#ri-tie'),'tapping the item itself still opens its photo, not folding the list');
    await p.tap('#ri-tie .swap');await settle(p,400);
    ok(await open('#ibox')&&await p.evaluate(()=>!!picker),'⇄ still opens the picker, not folding the list');
    await p.evaluate(()=>closePicker());
    // a tile's photo folds when tapped
    await setup();await into('.below');await p.tap('.below .tile');await settle(p,600);const b1=await open('#bbox');
    await p.tap('#bbox .rpanel-in');await settle(p,600);
    ok(b1&&!(await open('#bbox'))&&await p.evaluate(()=>HOOK.belowOpen===null),'a tile\'s photo folds when the photo is tapped');
    // score: a tap on the breakdown folds it
    await setup();await into('#sbox');await p.tap('#sbox .month-link');await settle(p,900);const s1=await open('#sbox');
    await p.tap('#sbox .sdl >> nth=1');await settle(p,700);
    ok(s1&&!(await open('#sbox'))&&await p.evaluate(()=>!scoreOpen&&document.querySelector('#sbox .month-link').getAttribute('aria-expanded')==='false'),'tapping the open score breakdown folds it');
    // month: a full-width fold bar along its bottom
    await setup({month:true});await into('#mbox');
    const fb=await p.evaluate(()=>{const b=document.querySelector('#mbox .foldbar'),r=b.getBoundingClientRect(),box=document.querySelector('#mbox').getBoundingClientRect(),cells=[...document.querySelectorAll('#mbox .mc')].map(c=>c.getBoundingClientRect().bottom);
      return {label:b.getAttribute('aria-label'),text:b.textContent,wide:r.width>=box.width-48,bottom:box.bottom-r.bottom<=24,below:r.top>=Math.max(...cells)-1,h:Math.round(r.height)}});
    ok(fb.label==='Fold away the month'&&/Fold away/.test(fb.text)&&fb.wide&&fb.bottom&&fb.below&&fb.h>=44,`the open month has a full-width "Fold away" bar along its bottom (${JSON.stringify(fb)})`);
    // folding from the bottom of a long box brings the card back into view
    await p.setViewportSize({width:390,height:480});   // shorter than the open month, so its top is off screen at its bottom
    await setup({month:true,list:true,score:true});await p.evaluate(()=>{const b=document.querySelector('#mbox .foldbar');scrollBy(0,b.getBoundingClientRect().bottom-380)});
    const topBefore=await p.evaluate(()=>Math.round(document.querySelector('#mbox').getBoundingClientRect().top));
    await p.tap('#mbox .foldbar');await settle(p,900);
    const after=await p.evaluate(()=>({open:monthOpen,cls:document.querySelector('#mbox').classList.contains('open'),top:Math.round(document.querySelector('#mbox').getBoundingClientRect().top)}));
    ok(!after.open&&!after.cls&&topBefore<0&&after.top>=0&&after.top<=480-78-60,`the fold bar folds the month, and the card comes back into view (top ${topBefore} → ${after.top}px)`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};

/* ---- was tests/reveal.test.js ---- */
// Tapping a box on Today unfolds it and scrolls down just enough to show what opened, stopping once the tapped box's top
// reaches the top of the screen (never further, never up). Same for the score card, the pieces list, the month plan, a row
// in the pieces list and a tile's photo (the tile row is what reaches the top).
const reveal=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:664},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const setup=()=>p.evaluate(async()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',added:1,...x});
      items=[I('suit','deeptaupe'),I('suit','navy'),I('shirt','lightblue'),I('shirt','white'),I('tie','brown',{pattern:'stripe',secondaryColor:'cream'}),I('tie','burgundy'),
        I('shoes','brown',{leather:'calf'}),I('belt','brown',{leather:'calf',metal:'silver'}),I('socks','brown'),I('watch','silver',{metal:'silver'})];
      settings.workdays=[1,2,3,4,5];TODAY_OVERRIDE='2026-11-10T12:00:00';dayRecs={};cache={};sel=new Date(2026,10,10);view={y:2026,m:10};listOpen=false;monthOpen=false;HOOK.belowOpen=null;scoreOpen=false;
      const o=planFor()[key(sel)];HOOK.renderTried.add(comboKey(o));renders[comboKey(o)]={sig:'x',img:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#5f5449"/></svg>'),model:'x',t:1};
      show('today');scrollTo(0,0);await new Promise(r=>setTimeout(r,300))});
    const navTop=()=>p.evaluate(()=>document.querySelector('body>nav').getBoundingClientRect().top);
    const at=s=>p.evaluate(s=>{const b=document.querySelector(s).getBoundingClientRect();return {top:Math.round(b.top),bottom:Math.round(b.bottom)}},s);
    const scrollY=()=>p.evaluate(()=>Math.round(scrollY));
    // a tall box (month plan, pieces list, score breakdown): it ends with its top at the top of the screen
    for(const [name,box,tap,prep] of [['month plan','#mbox','#mbox .month-link'],['pieces list','#ibox','#ibox .month-link'],['score card','#sbox','#sbox .month-link']]){
      await setup();
      // bring the box into view near the bottom of the screen, as when scrolling down to it
      await p.evaluate(([b])=>{const r=document.querySelector(b).getBoundingClientRect(),nav=document.querySelector('body>nav').getBoundingClientRect().top;scrollBy(0,r.bottom-nav+4)},[box]);
      const before=await at(box);await p.tap(tap);await settle(p,1100);const after=await at(box),nt=await navTop();
      const fits=after.bottom-after.top<=nt-12-8;
      ok(fits?after.bottom<=nt-11&&after.top>=7:Math.abs(after.top-8)<=2,`${name}: unfolds and scrolls until its top reaches the top of the screen (top ${before.top} → ${after.top}px)`);
    }
    // a small reveal: a row in the open pieces list only scrolls as much as its photo needs, not to the top
    await setup();await p.evaluate(()=>{listOpen=true;renderToday()});
    await p.evaluate(()=>{const r=document.querySelector('#ibox').getBoundingClientRect();scrollBy(0,r.top-60)});
    const row=await p.evaluate(()=>{const rows=[...document.querySelectorAll('#ibox .ritem')];const nav=document.querySelector('body>nav').getBoundingClientRect().top;
      const r=rows.find(x=>{const b=x.getBoundingClientRect();return b.top>nav-160&&b.bottom<nav&&x.querySelector('.rowtap')});return r&&r.id});
    if(row){const y0=await scrollY();await p.tap(`#${row} .rowtap`);await settle(p,1100);const r=await at('#'+row),nt=await navTop(),y1=await scrollY();
      ok(y1>y0&&r.top>8&&r.bottom<=nt-11,`a piece's photo scrolls only as far as needed to show it (row top ${r.top}px, bottom ${r.bottom}px)`)}
    else ok(false,'found a piece row near the bottom of the screen');
    // a tile's photo: the tile row is the box that reaches the top at most
    await setup();await p.evaluate(()=>{const r=document.querySelector('.below').getBoundingClientRect(),nav=document.querySelector('body>nav').getBoundingClientRect().top;scrollBy(0,r.bottom-nav+4)});
    await p.tap('.below .tile');await settle(p,1100);const t=await at('.below'),bb=await at('#bbox'),nt=await navTop();
    ok(t.top>=6&&(bb.bottom<=nt-11||Math.abs(t.top-8)<=2),`a tile's photo: scrolls to show it, the tile row stops at the top at most (tiles top ${t.top}px, photo bottom ${bb.bottom}px)`);
    // already visible after unfolding: no scroll; folding never scrolls
    // (on a tall screen, where the open score box fits where it is; judged from where it would end with no scroll)
    await p.setViewportSize({width:390,height:2600});await setup();
    const y0=await scrollY();await p.tap('#sbox .month-link');await settle(p,900);const s=await at('#sbox'),y2=await scrollY();
    const fits=s.bottom+(y2-y0)<=(await navTop())-12;
    ok(fits&&y2===y0,`a box that fits on screen once open does not scroll (fits: ${fits}, scrolled ${y2-y0}px)`);
    const y1=await scrollY();await p.tap('#sbox .month-link');await settle(p,600);ok(await scrollY()<=y1,'folding a box does not scroll down');await p.setViewportSize({width:390,height:664});
    // a touch during the scroll stops it
    await setup();await p.evaluate(()=>{const r=document.querySelector('#mbox').getBoundingClientRect(),nav=document.querySelector('body>nav').getBoundingClientRect().top;scrollBy(0,r.bottom-nav+4)});
    await p.tap('#mbox .month-link');await p.waitForTimeout(90);const mid=await p.evaluate(()=>{const y=scrollY;dispatchEvent(new Event('touchstart'));return y});   // read and touch in one step, so a busy machine can't scroll in betweenawait settle(p,900);
    ok(await scrollY()-mid<40,'touching the screen while it scrolls stops it');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};

/* ---- was tests/pagescroll.test.js ---- */
// The scroll that goes with an unfold or a fold (app.js pageScroll): the page is scrolled once at the start and Today slides back by
// that much and eases to rest with the cards, so no script moves the page on any frame. A scrollTo on every frame ran out of step with
// the clip and the slide on an iPhone and the calendar, pieces and score cards juddered. Checked here: one scroll, a slide of Today,
// the card moving smoothly on screen, and a second tap in the middle carrying on from where the page is drawn.
const pagescroll=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};scoreOpen=listOpen=monthOpen=false;show('today');scrollTo(0,0)});
    await p.waitForFunction(()=>{const el=$('#mpanel-in');return el&&el.querySelectorAll('.mc[data-k]').length>=28},null,{timeout:5000});await settle(p,300);
    const quiet=()=>p.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect&&a.effect.getComputedTiming().endTime!==Infinity),null,{timeout:4000});
    // watch one tap: how often the page is scrolled, whether Today slides, and the card's top on screen every frame
    const watch=(tap,el)=>p.evaluate(({tap,el})=>new Promise(res=>{let scrolls=0;const on=()=>scrolls++;addEventListener('scroll',on);
      const y0=scrollY;new Function(tap)();const slide=($('#today').getAnimations()[0]||null);const tr=slide?slide.effect.getKeyframes()[0].transform:'';const tops=[];
      const f=()=>{tops.push(Math.round($(el).getBoundingClientRect().top));if(document.getAnimations().some(a=>a.playState==='running'&&a.effect.getComputedTiming().endTime!==Infinity)||tops.length<5)requestAnimationFrame(f);
        else setTimeout(()=>{removeEventListener('scroll',on);res({scrolls,tr,tops,moved:scrollY-y0,left:getComputedStyle($('#today')).transform})},50)};requestAnimationFrame(f)}),{tap,el});
    const smooth=w=>{let jump=0,moving=0;for(let i=1;i<w.tops.length;i++){const d=Math.abs(w.tops[i]-w.tops[i-1]);jump=Math.max(jump,d);if(d>2)moving++}
      const way=Math.abs(w.tops[w.tops.length-1]-w.tops[0]);return {jump,moving,way,ok:way<4||(jump<=Math.max(way*.4,40)&&moving>=5)}};
    for(const [name,tap,el] of [['calendar','toggleMonth()','#mbox'],['pieces list','HOOK.toggleList()','#ibox'],['score','toggleScore()','#sbox']]){
      // the card's head near the bottom of the screen, so unfolding has to scroll to show it
      await p.evaluate(el=>{const b=$(el);scrollTo(0,0);scrollBy(0,b.getBoundingClientRect().top-innerHeight+200)},el);await settle(p,200);
      const u=await watch(tap,el),su=smooth(u);
      ok(u.moved>40&&u.scrolls<=2&&/translateY\(\d/.test(u.tr)&&u.left==='none',`unfolding the ${name} scrolls the page once (${u.scrolls} scroll events for ${u.moved}px) and slides Today back by it (${u.tr}), nothing left over`);
      ok(su.ok,`and the ${name} card moves smoothly on screen (largest step ${su.jump} of ${su.way}px over ${su.moving} frames: ${u.tops.join(' ')})`);
      await quiet();
      // folding from the bottom of the page: the page has to come back up, also once
      await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await settle(p,200);
      const f=await watch(tap,el),sf=smooth(f);
      ok(f.scrolls<=3&&f.left==='none'&&sf.ok,`folding the ${name} from the page's end: ${f.scrolls} scroll events, moving smoothly (largest step ${sf.jump} of ${sf.way}px: ${f.tops.join(' ')})`);
      await quiet();await settle(p,100);
    }
    // a second tap while the first still runs: the page carries on from where it is drawn, no jump
    await p.evaluate(()=>{const b=$('#mbox');scrollTo(0,0);scrollBy(0,b.getBoundingClientRect().top-innerHeight+200)});await settle(p,200);
    const twice=await p.evaluate(()=>new Promise(res=>{toggleMonth();setTimeout(()=>{const before=Math.round($('#mbox').getBoundingClientRect().top);toggleMonth();const after=Math.round($('#mbox').getBoundingClientRect().top);
      setTimeout(()=>res({before,after,left:getComputedStyle($('#today')).transform,open:$('#mbox').classList.contains('open')}),1400)},150)}));
    ok(Math.abs(twice.after-twice.before)<=3&&twice.left==='none'&&!twice.open,`folding again halfway through the unfold starts from where the card is (${twice.before} → ${twice.after}px) and ends shut, nothing left over`);
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};

// the parts run one after another; one that throws is reported and the rest still run (each was its own file)
module.exports=async t=>{for(const [name,part] of [['boxfold',boxfold],['picfold',picfold],['foldtap',foldtap],['reveal',reveal],['pagescroll',pagescroll]]){try{await part(t)}catch(e){t.ok(false,`threw (${name}): ${e.message}`)}}};
