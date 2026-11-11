// Today: the tab bar grows upward until its top is one design gap (12px) below the below-the-waist tiles, so nothing peeks out
// between them; at most 64px more, and unchanged when the tiles already reach it (a short screen).
module.exports=async({ok,chromium,url,settle})=>{
  const browser=await chromium.launch();
  try{
    const run=async(w,h)=>{const ctx=await browser.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>window.appReady);
      await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
        items=[I('suit','grey'),I('shirt','lightblue'),I('tie','navy',{pattern:'stripe',secondaryColor:'grey'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
        settings.workdays=[0,1,2,3,4];dayRecs={};TODAY_OVERRIDE='2026-11-08T12:00:00';cache={};sel=new Date(2026,10,8);view={y:2026,m:10};
        const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');x.fillStyle='#9a958c';x.fillRect(0,0,1024,1024);
        const o=planFor()[key(sel)];renders[comboKey(o)]={sig:comboSig(o),img:c.toDataURL('image/jpeg',.7),model:'m',t:1};show('today');scrollTo(0,0)});
      await p.waitForSelector('#mannequin-container img');await settle(p,600);await p.waitForTimeout(300);
      const m=await p.evaluate(()=>{const nav=document.querySelector('body>nav').getBoundingClientRect(),tiles=document.querySelector('.below').getBoundingClientRect(),btn=document.querySelector('nav button').getBoundingClientRect();
        return {gap:Math.round(nav.top-tiles.bottom),navx:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navx')),btn:Math.round(btn.height)}});
      // a day without a photo (the drawing and its Generate button push the tiles lower), and a weekend, keep the size
      const keep=await p.evaluate(async()=>{const nx=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navx'));const before=nx();
        renders={};renderToday();await new Promise(r=>setTimeout(r,400));const drawing=nx(),btn=!!document.querySelector('.render-btn');
        sel=new Date(2026,10,13);renderToday();await new Promise(r=>setTimeout(r,400));const weekend=nx();return {before,drawing,weekend,btn}});
      m.keep=keep;
      await ctx.close();return {...m,errs}};
    const a=await run(390,844);
    ok(a.navx>0&&a.navx<=64&&(Math.abs(a.gap-12)<=1||a.navx===64),`on a phone the tab bar grows to one 12px gap below the tiles (gap ${a.gap}px, ${a.navx}px taller, buttons ${a.btn}px)`);
    const d=await run(466,710);   // like the user's screenshot: about 35px between the tiles and the bar, the score card peeking out
    ok(d.navx>15&&d.navx<40&&Math.abs(d.gap-12)<=1,`with ~35px to spare (466×710) the bar's top lands 12px below the tiles (gap ${d.gap}px, ${d.navx}px taller)`);
    ok(d.keep.btn&&d.keep.drawing===d.navx&&d.keep.weekend===d.navx,`the bar keeps that size on a day with only the drawing (${d.keep.drawing}px) and on a weekend (${d.keep.weekend}px)`);
    const s=await run(390,600);
    ok(s.navx===0&&s.btn===38,`on a short screen, where the tiles already reach it, the bar keeps its 38px buttons (grown ${s.navx}px)`);
    const t=await run(430,1100);
    ok(t.navx===64,`on a tall screen it grows at most 64px (${t.navx}px)`);
    ok(!d.errs.length&&!a.errs.length&&!s.errs.length&&!t.errs.length,'no page errors');
  }finally{await browser.close()}
};
