// The score box and the pieces list unfold and fold like the month (app.js boxUnfold / boxFold): the page is laid out a few times,
// not on every frame (an animated height did that), a clip over the card opens and closes, and folding plays the box's own cascade
// backwards (the last check or piece lifts out first), then the card closes; nothing jumps and the box ends shut.
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
      items=[I('suit','navy'),I('suit','charcoal'),I('shirt','white'),I('shirt','lightblue'),I('tie','burgundy'),I('tie','navy',{pattern:'stripe',secondaryColor:'white'}),
        I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','navy'),I('watch','grey',{metal:'silver'})];
      settings.workdays=[1,2,3,4,5];dayRecs={};TODAY_OVERRIDE='2026-11-10T12:00:00';cache={};sel=new Date(2026,10,10);view={y:2026,m:10};scoreOpen=listOpen=false;show('today')});
    const cdp=await ctx.newCDPSession(p);await cdp.send('Performance.enable');
    const lay=async()=>(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount').value;
    for(const [name,id,toggle,items] of [['score','#sbox','toggleScore','#spanel li'],['pieces list','#ibox','toggleList','#ipanel .list>*']]){
      await p.evaluate(()=>scrollTo(0,0));await settle(p,300);
      const l0=await lay();
      const u=await p.evaluate(([id,toggle])=>{window[toggle]();const b=$(id);return {clip:b.getAnimations().some(a=>a.effect.getKeyframes()[0].clipPath),trans:getComputedStyle(b.querySelector('.mpanel')).transitionDuration}},[id,toggle]);
      await p.waitForFunction(id=>!$(id).getAnimations().length,id,{timeout:3000});await settle(p,800);
      const layouts=await lay()-l0;
      ok(u.clip&&u.trans==='0s'&&layouts<=8,`the ${name} unfolds with a clip, its height not animated, the page laid out ${layouts} times`);
      const f=await p.evaluate(([id,toggle,items])=>new Promise(res=>{const b=$(id),its=[...b.querySelectorAll(items)];window[toggle]();
        const cs=its.map(e=>getComputedStyle(e)),lift={name:cs[0].animationName,d0:parseFloat(cs[0].animationDelay),dn:parseFloat(cs[cs.length-1].animationDelay),n:its.length},chev=b.classList.contains('bshut');
        const tops=[];const f=()=>{tops.push(Math.round(b.getBoundingClientRect().top));if(b.getAnimations().length||tops.length<5)requestAnimationFrame(f);else res({lift,chev,tops,open:b.classList.contains('open'),h:b.querySelector('.mpanel').offsetHeight})};requestAnimationFrame(f)}),[id,toggle,items]);
      let jump=0;for(let i=1;i<f.tops.length;i++)jump=Math.max(jump,Math.abs(f.tops[i]-f.tops[i-1]));
      ok(f.lift.name==='mcLift'&&f.lift.dn===0&&f.lift.d0>0.05&&f.chev,`folding the ${name} lifts its ${f.lift.n} rows out last first (the first ${Math.round(f.lift.d0*1000)} ms after the last), the arrow turning back at once`);
      ok(!f.open&&f.h===0&&jump<120,`the ${name} ends shut, with no jump (largest step ${jump}px)`);
    }
    // a tap in the middle of a fold finishes it and opens again cleanly
    const mid=await p.evaluate(async()=>{toggleList();await new Promise(r=>setTimeout(r,500));toggleList();await new Promise(r=>setTimeout(r,120));toggleList();await new Promise(r=>setTimeout(r,60));
      const b=$('#ibox');return {open:b.classList.contains('open'),lift:b.classList.contains('blift')}});
    await p.waitForFunction(()=>!$('#ibox').getAnimations().length,null,{timeout:3000});
    ok(mid.open&&!mid.lift&&await p.evaluate(()=>getComputedStyle($('#ibox')).clipPath==='none'),'opening the list in the middle of its fold stops the fold and opens it fully');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
    await ctx.close();
  }finally{await browser.close()}
};
