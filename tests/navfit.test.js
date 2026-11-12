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
    ok(d.keep.drawing===d.navx&&d.keep.weekend===d.navx,`the bar keeps that size on a day with only the drawing (${d.keep.drawing}px) and on a weekend (${d.keep.weekend}px)`);
    // the user's bug: measured before the photo loaded (it has no height yet), the bar jumped to 64px and was kept there
    {const ctx=await browser.newContext({viewport:{width:466,height:710},isMobile:true,hasTouch:true});
      await ctx.route('https://slow.test/**',async r=>{await new Promise(z=>setTimeout(z,1500));const c=Buffer.from((await (await ctx.newPage()).evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=1024;c.getContext('2d').fillRect(0,0,9,9);return c.toDataURL('image/jpeg').split(',')[1]})),'base64');r.fulfill({status:200,contentType:'image/jpeg',body:c})});
      const p=await ctx.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady);
      await p.evaluate(()=>localStorage.setItem('nav_fit:466x710','64'));await p.reload();await p.waitForFunction(()=>window.appReady);
      const nx=()=>p.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navx')));
      await p.evaluate(()=>{let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
        items=[I('suit','grey'),I('shirt','lightblue'),I('tie','navy',{pattern:'stripe',secondaryColor:'grey'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal')];
        settings.workdays=[0,1,2,3,4];dayRecs={};TODAY_OVERRIDE='2026-11-08T12:00:00';cache={};sel=new Date(2026,10,8);view={y:2026,m:10};
        const o=planFor()[key(sel)];renders[comboKey(o)]={sig:comboSig(o),img:'https://slow.test/p.jpg',model:'m',t:1};show('today');fitNav()});
      await p.waitForTimeout(400);const early=await nx();
      await p.waitForFunction(()=>{const i=document.querySelector('#mannequin-container img');return i&&i.complete&&i.naturalHeight>0},null,{timeout:8000});await p.waitForTimeout(400);
      const late=await nx(),gap=await p.evaluate(()=>Math.round(document.querySelector('body>nav').getBoundingClientRect().top-document.querySelector('.below').getBoundingClientRect().bottom));
      ok(early===0&&late>15&&late<40&&Math.abs(gap-12)<=1&&await p.evaluate(()=>localStorage.getItem('nav_fit:466x710')===null),`the bar isn't sized before the photo loads (${early}px then; ${late}px after, gap ${gap}px), and the old inflated 64px is dropped`);
      await ctx.close()}
    // a blazer day (trousers too: four tiles, each narrower) keeps the three-tile day's size
    {const ctx=await browser.newContext({viewport:{width:466,height:710},isMobile:true,hasTouch:true});const p=await ctx.newPage();await p.goto(url);await p.waitForFunction(()=>window.appReady);
      const nx=()=>p.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navx')));
      const day=async(blazer)=>{await p.evaluate(b=>{localStorage.clear();let k=0;const I=(type,primaryColor,x={})=>({id:type+(k++),type,primaryColor,pattern:'solid',...x});
        items=b?[I('blazer','navy'),I('pants','grey')]:[I('suit','grey')];items.push(I('shirt','lightblue'),I('tie','navy',{pattern:'stripe',secondaryColor:'grey'}),I('shoes','black',{leather:'calf'}),I('belt','black',{leather:'calf',metal:'silver'}),I('socks','charcoal'));
        // product pictures, like the user's: a picture tile's picture follows its width, so four of them are shorter than three
        const pc=document.createElement('canvas');pc.width=pc.height=200;pc.getContext('2d').fillRect(0,0,9,9);const pu=pc.toDataURL('image/jpeg',.6);for(const it of items)if(ITEM_PIC_TYPES.includes(it.type))renders[itemKey(it)]={sig:'item',img:pu,model:'m',t:1,grey:1};
        settings.workdays=[0,1,2,3,4];settings.blazerDays=b?[0]:[];dayRecs={};TODAY_OVERRIDE='2026-11-08T12:00:00';cache={};sel=new Date(2026,10,8);view={y:2026,m:10};
        const c=document.createElement('canvas');c.width=c.height=1024;c.getContext('2d').fillRect(0,0,9,9);const o=planFor()[key(sel)];renders[comboKey(o)]={sig:comboSig(o),img:c.toDataURL('image/jpeg',.6),model:'m',t:1};
        document.documentElement.style.setProperty('--navx','0px');show('today')},blazer);
        await p.waitForSelector('#mannequin-container img');await p.waitForTimeout(700);return {x:await nx(),n:await p.evaluate(()=>document.querySelectorAll('.below .tile').length),pics:await p.evaluate(()=>document.querySelectorAll('.below .tile.has-pic').length),h:await p.evaluate(()=>Math.round(document.querySelector('.below').getBoundingClientRect().height))}};
      const three=await day(false),four=await day(true);
      ok(three.n===3&&four.n===4&&four.pics===4&&four.h<three.h-10&&Math.abs(four.x-three.x)<=1,`a day with four picture tiles (a shorter row: ${four.h}px against ${three.h}px) gets the same bar as a day with three (${four.x}px and ${three.x}px)`);
      await ctx.close()}
    const s=await run(390,600);
    ok(s.navx===0&&s.btn===38,`on a short screen, where the tiles already reach it, the bar keeps its 38px buttons (grown ${s.navx}px)`);
    const t=await run(430,1100);
    ok(t.navx===64,`on a tall screen it grows at most 64px (${t.navx}px)`);
    ok(!d.errs.length&&!a.errs.length&&!s.errs.length&&!t.errs.length,'no page errors');
  }finally{await browser.close()}
};
