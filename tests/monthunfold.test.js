// The month box unfolds and folds without animating its height (app.js monthUnfold / monthFold): the page is laid out once and a clip,
// a slide and a fade do the moving. An animated height laid the page out on every frame (30 layouts for one unfold), which was choppy
// on a phone. The days are put into the folded box while the app is idle (monthFillSoon), and the folded box takes no taps or focus.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('suit','grey'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),I('tie','green'),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy')];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};show('today')});
    // folded: the days are put in while idle, and can't be tapped or reached with the keyboard
    await p.waitForFunction(()=>{const el=$('#mpanel-in');return el&&el.querySelectorAll('.mc[data-k]').length>=28},null,{timeout:5000});
    const folded=await p.evaluate(()=>({inert:$('#mpanel-in').inert,open:$('#mbox').classList.contains('open'),h:$('#mpanel').offsetHeight}));
    ok(folded.inert&&!folded.open&&folded.h===0,'the folded month box already holds the days (put in while idle), with no height, and takes no taps or focus');
    // unfolding: the page is laid out a few times, not on every frame; a clip, a slide and a fade move
    let cdp=null;try{cdp=await ctx.newCDPSession(p);await cdp.send('Performance.enable')}catch{cdp=null}   // the layout count is Chromium's (CDP); on WebKit (npm run test:webkit) it isn't counted
    const lay=async()=>cdp?(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount').value:0;
    const laid=n=>cdp?`${n} times`:'(not counted on WebKit)';
    const l0=await lay();
    const during=await p.evaluate(()=>{const a0=performance.now();document.querySelector('#mbox .month-link').click();const tap=performance.now()-a0;
      const an=document.getAnimations().map(a=>(a.effect.target.closest('.fedge')?'edge ':'')+Object.keys(a.effect.getKeyframes()[0]).filter(k=>!['offset','easing','composite','computedOffset'].includes(k)).join('+'));
      return {tap,an,drop:getComputedStyle(document.querySelector('#mbox .mc:not(.blank)')).animationName,cells:document.querySelectorAll('#mbox .mc').length,inert:$('#mpanel-in').inert,heightAnim:getComputedStyle($('#mpanel')).transitionDuration}});
    await settle(p,700);await p.waitForFunction(()=>!document.getAnimations().length,null,{timeout:3000});
    const layouts=await lay()-l0;
    const opened=await p.evaluate(()=>{const b=$('#mbox').getBoundingClientRect(),nav=document.querySelector('body>nav').getBoundingClientRect();return {open:monthOpen&&$('#mbox').classList.contains('open'),inert:$('#mpanel-in').inert,clip:getComputedStyle($('#mbox')).clipPath,edge:!!document.querySelector('.fedge')||$('#mbox').classList.contains('fedge-on'),fold:$('#mbox .foldbar').getBoundingClientRect().bottom<=nav.top+1,top:b.top>=0}});
    // the card's edge is a strip that slides (app.js foldEdge), not a clip-path: Safari repaints a clip every frame on the page's thread
    // while it slides the cards below on its own, and the two drifted apart
    ok(during.an.includes('edge transform')&&!during.an.some(x=>/clipPath/.test(x))&&during.an.includes('opacity')&&during.heightAnim==='0s'&&!during.inert,`unfolding is the card's edge sliding down (no clip-path) and a fade of the days, the height is not animated (${[...new Set(during.an)].join(', ')})`);
    const drop=await p.evaluate(async()=>{await new Promise(r=>setTimeout(r,1100));const gone=!$('#mbox').classList.contains('mdrop');monthStep(1);const again=getComputedStyle(document.querySelector('#mbox .mc:not(.blank)')).animationName;monthStep(-1);return {gone,again}});
    ok(during.drop==='mcDrop'&&drop.gone&&drop.again==='none',`the days drop in only while the box unfolds: not again on a month swiped to (${during.drop}, then ${drop.again})`);
    ok(layouts<=8,`unfolding lays the page out ${laid(layouts)} (it was about 30, once a frame)`);
    ok(opened.open&&!opened.inert&&opened.clip==='none'&&!opened.edge&&opened.fold&&opened.top,'unfolded: the whole month shows, scrolled so "Fold away" is above the tab bar, with no clip or edge strip left');
    // what lies under the box slides with it: the Reset card on a changed day
    await p.evaluate(async()=>{toggleMonth();await new Promise(r=>setTimeout(r,600));const o=planFor()[key(sel)];await saveDay({...(dayRecs[key(sel)]||{date:key(sel)}),force:{tie:items.find(i=>i.type==='tie'&&i.id!==o.tie.id).id}});cache={};renderToday();scrollTo(0,0)});
    const slide=await p.evaluate(()=>{const r=$('#rbox');if(!r)return null;const y0=r.getBoundingClientRect().top;toggleMonth();const a=r.getAnimations()[0];const y1=r.getBoundingClientRect().top;
      return {anim:!!a&&/translateY\(-\d/.test(a.effect.getKeyframes()[0].transform),still:Math.abs(y1-y0)<2}});
    ok(slide&&slide.anim&&slide.still,'the Reset card under the box starts where it was and slides down with the unfolding');
    await p.waitForFunction(()=>!document.getAnimations().length,null,{timeout:3000});
    // folding: the days fade and the clip closes, then the box is laid out shut; the page doesn't jump at the end
    await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await settle(p,300);
    const fold=await p.evaluate(()=>new Promise(res=>{const tops=[];document.querySelector('#mbox .foldbar').click();const cs=[...document.querySelectorAll('#mbox .mc:not(.blank)')],first=getComputedStyle(cs[0]),last=getComputedStyle(cs[cs.length-1]),clipA=document.getAnimations().find(a=>a.effect.target.closest('#mbox .fedge'));
      const lift={name:first.animationName,ease:first.animationTimingFunction,d0:parseFloat(first.animationDelay),dn:parseFloat(last.animationDelay),clipDelay:clipA?clipA.effect.getTiming().delay:-1};const an=document.getAnimations().length,chev=$('#mbox').classList.contains('mshut')&&getComputedStyle($('#mbox .chev')).transitionProperty;
      const f=()=>{tops.push(Math.round($('#mbox').getBoundingClientRect().top));if(document.getAnimations().length||tops.length<5)requestAnimationFrame(f);else res({lift,an,chev,tops,open:$('#mbox').classList.contains('open'),inert:$('#mpanel-in').inert,h:$('#mpanel').offsetHeight,over:scrollY-(document.documentElement.scrollHeight-innerHeight)})};requestAnimationFrame(f)}));
    ok(fold.lift.name==='mcLift'&&/cubic-bezier\(0\.36, 0, 0\.66, -0\.56\)/.test(fold.lift.ease)&&fold.lift.dn===0&&fold.lift.d0>0.15&&fold.lift.clipDelay>100,`folding plays the drop backwards: the last day lifts out first, the first last (${Math.round(fold.lift.d0*1000)} ms later), each with a little dip, and the card closes after them (from ${Math.round(fold.lift.clipDelay)} ms)`);
    let jump=0;for(let i=1;i<fold.tops.length;i++)jump=Math.max(jump,Math.abs(fold.tops[i]-fold.tops[i-1]));
    ok(fold.an>=2&&!!fold.chev&&!fold.open&&fold.inert&&fold.h===0&&fold.over<=1,`folding: the arrow turns back at once, the clip closes and the box ends shut, inert, with nothing scrolled past the page's end ${JSON.stringify({...fold,tops:fold.tops.length})}`);
    // a jump is one frame covering most of the way; an ease-out starts fast (WebKit's frames come further apart than Chromium's)
    const way=Math.abs(fold.tops[fold.tops.length-1]-fold.tops[0]),moving=fold.tops.filter((v,i)=>i&&Math.abs(v-fold.tops[i-1])>2).length;
    ok(way<4||(jump<=way*.4&&moving>=6),`folding from the bottom of the page moves the box smoothly over ${moving} frames, no jump (largest step ${jump} of ${way}px: ${fold.tops.join(" ")})`);
    // reduced motion: no animation, it just opens and shuts
    await p.emulateMedia({reducedMotion:'reduce'});
    const rm=await p.evaluate(()=>{toggleMonth();const own=()=>document.getAnimations().filter(x=>!(x instanceof CSSTransition)&&!(x instanceof CSSAnimation)).length,a=own(),o=$('#mbox').classList.contains('open');toggleMonth();return {a,o,b:own(),shut:!$('#mbox').classList.contains('open')}});
    ok(rm.a===0&&rm.o&&rm.b===0&&rm.shut,'with reduced motion the month opens and shuts at once '+JSON.stringify(rm));
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
