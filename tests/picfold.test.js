// A piece's photo (a row of the pieces list, a tile's photo under the tiles) opens and shuts like the cards (app.js picOpen/picShut):
// the page is laid out a few times, not on every frame; the photo's area is clipped open while what is below slides down in step and
// the pieces card grows with it; the photo drops in with a bounce and lifts out with a dip before the space closes; a photo is decoded
// before it opens (no late jump); opening another row while one above is open keeps the tapped row where it was.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=800;const x=c.getContext('2d');x.fillStyle='#ccd';x.fillRect(0,0,600,800);x.fillStyle='#335';x.fillRect(100,100,400,600);const photo=c.toDataURL('image/jpeg',.8);
      let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy',{photo}),I('suit','charcoal',{photo}),I('shirt','white',{photo}),I('shirt','lightblue',{photo}),I('tie','burgundy',{photo}),I('tie','navy',{pattern:'stripe',secondaryColor:'white',photo}),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy'),I('watch','grey',{metal:'silver'})];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};scoreOpen=listOpen=false;openRow=null;belowOpen=null;show('today')});
    let cdp=null;try{cdp=await ctx.newCDPSession(p);await cdp.send('Performance.enable')}catch{cdp=null}   // the layout count is Chromium's (CDP); on WebKit (npm run test:webkit) it isn't counted
    const lay=async()=>cdp?(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount').value:0;
    const laid=n=>cdp?`${n} times`:'(not counted on WebKit)';
    const quiet=()=>p.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect&&a.effect.getComputedTiming().endTime!==Infinity),null,{timeout:4000});
    await p.evaluate(()=>toggleList());await quiet();await settle(p,400);
    // a row's photo opens: clipped open, the card grows with it, the rows below slide, the photo drops in with a bounce
    const l0=await lay();
    const o=await p.evaluate(async()=>{const el=$('#ri-shirt'),seen=new Set(),hs=[];toggleRow('shirt');
      const t0=performance.now();while(performance.now()-t0<700){for(const a of document.getAnimations()){const k=a.effect.getKeyframes()[0],t=a.effect.target;
          if(k.clipPath&&t===el)seen.add('row clip');if(k.clipPath&&t.id==='ibox')seen.add('card clip');if(/translateY\(-/.test(k.transform||'')&&t.matches('.ritem')&&t!==el)seen.add('rows below slide');
          if(t.classList.contains('rpanel-in')&&/cubic-bezier\(0\.34, 1\.56/.test(a.effect.getTiming().easing))seen.add('photo bounce')}
        hs.push(Math.round(el.getBoundingClientRect().height));await new Promise(r=>requestAnimationFrame(r))}
      const late=[];for(let i=0;i<10;i++){late.push(Math.round(el.getBoundingClientRect().height));await new Promise(r=>requestAnimationFrame(r))}
      return {seen:[...seen],open:el.classList.contains('open'),img:el.querySelector('.rpanel-in img').naturalWidth,late:new Set(late).size,first:hs[0],last:hs[hs.length-1],clip:getComputedStyle(el).clipPath}});
    const layouts=await lay()-l0;
    ok(['row clip','card clip','rows below slide','photo bounce'].every(x=>o.seen.includes(x)),`a row's photo opens with a clip, the card growing with it, the rows below sliding, the photo dropping in with a bounce (${o.seen.join(', ')})`);
    ok(o.open&&o.img>0&&o.last>o.first+100&&o.late===1&&o.clip==='none',`the photo was decoded before it opened: its height (${o.last}px) is right at once and doesn't change after (no late jump)`);
    ok(layouts<=10,`opening it lays the page out ${laid(layouts)} (an animated height did it every frame)`);
    // another row while one above is open: the tapped row stays under the finger
    const keep=await p.evaluate(async()=>{const t=$('#ri-tie').getBoundingClientRect().top;toggleRow('tie');   // read right after the tap: the photo's own reveal scroll starts after it
      
      return {before:Math.round(t),after:Math.round($('#ri-tie').getBoundingClientRect().top),shirt:$('#ri-shirt').classList.contains('open')}});
    await quiet();
    ok(!keep.shirt&&Math.abs(keep.after-keep.before)<=2,`opening the tie's photo shuts the shirt's above it and the tie's row stays where it was under the finger (${keep.before} → ${keep.after}px)`);
    // shutting: the photo lifts out with a dip, then the space closes; it ends shut, nothing jumps
    const s=await p.evaluate(()=>new Promise(res=>{const el=$('#ri-tie');toggleRow('tie');const an=document.getAnimations(),pin=an.find(a=>a.effect.target.classList.contains('rpanel-in')),clip=an.find(a=>a.effect.target===el&&a.effect.getKeyframes()[0].clipPath);
      const r={dip:!!pin&&/cubic-bezier\(0\.36, 0, 0\.66, -0\.56\)/.test(pin.effect.getTiming().easing),clipDelay:clip?clip.effect.getTiming().delay:-1},tops=[];const ib=$('#ibox');
      const vis=b=>{const m=/inset\(\S+ \S+ ([\d.]+)px/.exec(getComputedStyle(b).clipPath);return b.getBoundingClientRect().bottom-(m?+m[1]:0)};
      const f=()=>{tops.push(Math.round(vis(ib)));if(document.getAnimations().some(a=>a.playState==='running'&&a.effect.getComputedTiming().endTime!==Infinity)||tops.length<5)requestAnimationFrame(f);
        else res({...r,tops,open:el.classList.contains('open'),h:el.querySelector('.rpanel').offsetHeight})};requestAnimationFrame(f)}));
    let jump=0;for(let i=1;i<s.tops.length;i++)jump=Math.max(jump,Math.abs(s.tops[i]-s.tops[i-1]));
    ok(s.dip&&s.clipDelay>=100&&!s.open&&s.h===0,`shutting lifts the photo out with a dip and closes the space after it (from ${s.clipDelay} ms); the row ends shut`);
    ok(jump<90,`the card's edge closes up smoothly, no jump at the end (largest step ${jump}px: ${s.tops.join(' ')})`);
    // a tile's photo: the cards under the stage slide; another tile swaps the photo; it shuts again
    await p.evaluate(()=>{toggleList();scrollTo(0,0)});await quiet();await settle(p,300);
    const t=await p.evaluate(async()=>{const el=$('#bbox');pickPiece('shoes');await new Promise(r=>setTimeout(r,40));
      const an=document.getAnimations(),r={clip:an.some(a=>a.effect.target===el&&a.effect.getKeyframes()[0].clipPath),side:an.some(a=>a.effect.target.classList.contains('side')&&/translateY\(-/.test(a.effect.getKeyframes()[0].transform||''))};
      await new Promise(r=>setTimeout(r,700));pickPiece('belt');r.swap=el.classList.contains('open')&&belowOpen==='belt'&&/belt/i.test(el.querySelector('.rpanel-in').innerHTML);
      await new Promise(r=>setTimeout(r,300));pickPiece('belt');await new Promise(r=>setTimeout(r,900));r.shut=!el.classList.contains('open')&&belowOpen===null;return r});
    ok(t.clip&&t.side&&t.swap&&t.shut,`a tile's photo opens by a clip with the cards below sliding; another tile swaps the photo in place; tapping it again shuts it (${JSON.stringify(t)})`);
    // reduced motion: no animation
    await p.emulateMedia({reducedMotion:'reduce'});
    const rm=await p.evaluate(()=>{toggleList();const own=()=>document.getAnimations().filter(x=>!(x instanceof CSSTransition)&&!(x instanceof CSSAnimation)).length;toggleRow('top');const a=own();toggleRow('top');return {a,b:own(),shut:!$('#ri-top').classList.contains('open')}});
    ok(rm.b===0&&rm.shut,'with reduced motion a photo opens and shuts at once');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
